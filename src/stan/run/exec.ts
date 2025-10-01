// src/stan/run/exec.ts
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { appendFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import treeKill from 'tree-kill';

import type { ContextConfig } from '../config';
import type { ProcessSupervisor } from './live/supervisor';
import type { ExecutionMode, Selection } from './types';
type RunHooks = {
  onStart?: (key: string) => void;
  onEnd?: (
    key: string,
    outFileAbs: string,
    startedAt: number,
    endedAt: number,
    exitCode: number,
    status?: 'ok' | 'warn' | 'error',
  ) => void;
  /** When true, suppress per-script console logs ("stan: start/done"). */
  silent?: boolean;
  /** Called when a script exceeds hangWarn inactivity (seconds). */
  onHangWarn?: (key: string, seconds: number) => void;
  /** Called when a script exceeds hangKill inactivity (seconds) and is being terminated. */
  onHangTimeout?: (key: string, seconds: number) => void;
  /** Called when a script did not exit after grace and was SIGKILLed. */
  onHangKilled?: (key: string, graceSeconds: number) => void;
};

// Yield one event-loop tick so pending signal/key handlers (e.g., SIGINT)
// can run before scheduling the next script.
const yieldToEventLoop = (): Promise<void> =>
  new Promise<void>((resolve) => setImmediate(resolve));

const waitForStreamClose = (stream: NodeJS.WritableStream): Promise<void> =>
  new Promise<void>((resolveP, rejectP) => {
    stream.on('close', () => resolveP());
    stream.on('error', (e) =>
      rejectP(e instanceof Error ? e : new Error(String(e))),
    );
  });

const configOrder = (config: ContextConfig): string[] =>
  Object.keys(config.scripts);

/**
 * Normalize selection to config order.
 * - When selection is null/undefined, return all config keys.
 * - When selection exists:
 *   - [] =\> run nothing
 *   - non-empty =\> order by config order
 */
export const normalizeSelection = (
  selection: Selection | undefined | null,
  config: ContextConfig,
): string[] => {
  const all = configOrder(config);
  if (!selection) return all;
  if (selection.length === 0) return [];
  const requested = new Set(selection);
  return all.filter((k) => requested.has(k));
};

/**
 * Run a single configured script and write its combined stdout/stderr to
 * `outRel/<key>.txt`.
 *
 * @param cwd - Working directory for the child process.
 * @param outAbs - Absolute output directory.
 * @param outRel - Relative output directory (for logs).
 * @param key - Script key (for logs and filename).
 * @param cmd - Shell command to execute.
 * @param orderFile - Optional order file to append a single letter marker.
 * @param hooks - Optional lifecycle hooks and flags.
 * @param opts - Optional execution options (e.g., silent logging).
 * @param supervisor - Optional process supervisor to track/terminate children.
 * @returns Absolute path to the generated output file.
 */
export const runOne = async (
  cwd: string,
  outAbs: string,
  outRel: string,
  key: string,
  cmd: string,
  orderFile?: string,
  hooks?: RunHooks,
  opts?: {
    silent?: boolean;
    hangWarn?: number;
    hangKill?: number;
    hangKillGrace?: number;
    /** Optional warn regex compiled from config; when matches output+error (exit=0) =\> warn. */
    warnPattern?: RegExp;
  },
  supervisor?: ProcessSupervisor,
): Promise<string> => {
  const outFile = resolve(outAbs, `${key}.txt`);
  const startedAt = Date.now();
  hooks?.onStart?.(key);
  const child = spawn(cmd, { cwd, shell: true, windowsHide: true });

  const debug = process.env.STAN_DEBUG === '1';
  let combined = '';
  // Inactivity tracking for hang detection
  const hangWarnSec =
    typeof opts?.hangWarn === 'number' && opts.hangWarn > 0 ? opts.hangWarn : 0;
  const hangKillSec =
    typeof opts?.hangKill === 'number' && opts.hangKill > 0 ? opts.hangKill : 0;
  const hangGraceSec =
    typeof opts?.hangKillGrace === 'number' && opts.hangKillGrace > 0
      ? opts.hangKillGrace
      : 10;
  let lastActivity = Date.now();
  let warned = false;
  let terminated = false;
  let interval: NodeJS.Timeout | undefined;
  let killTimer: NodeJS.Timeout | undefined;

  try {
    // Track PID for cancellation/kill escalation
    if (typeof child.pid === 'number' && supervisor)
      supervisor.track(`script:${key}`, child.pid);
  } catch {
    /* ignore */
  }
  const stream = createWriteStream(outFile, { encoding: 'utf8' });
  child.stdout.on('data', (d: Buffer) => {
    stream.write(d);
    combined += d.toString('utf8');
    if (debug) process.stdout.write(d);
    lastActivity = Date.now();
  });
  child.stderr.on('data', (d: Buffer) => {
    stream.write(d);
    combined += d.toString('utf8');
    if (debug) process.stderr.write(d);
    lastActivity = Date.now();
  });

  // Periodic inactivity checks
  if (hangWarnSec > 0 || hangKillSec > 0) {
    interval = setInterval(() => {
      const now = Date.now();
      const inactiveMs = now - lastActivity;
      if (!warned && hangWarnSec > 0 && inactiveMs >= hangWarnSec * 1000) {
        warned = true;
        hooks?.onHangWarn?.(key, hangWarnSec);
      }
      if (!terminated && hangKillSec > 0 && inactiveMs >= hangKillSec * 1000) {
        terminated = true;
        try {
          if (typeof child.pid === 'number') process.kill(child.pid, 'SIGTERM');
        } catch {
          // best-effort
        }
        hooks?.onHangTimeout?.(key, hangKillSec);
        // escalate to SIGKILL after grace
        const graceMs = Math.max(0, hangGraceSec * 1000);
        killTimer = setTimeout(() => {
          try {
            if (typeof child.pid === 'number') treeKill(child.pid, 'SIGKILL');
          } catch {
            // ignore
          }
          hooks?.onHangKilled?.(key, hangGraceSec);
        }, graceMs);
      }
    }, 1000);
  }

  const exitCode = await new Promise<number>((resolveP, rejectP) => {
    child.on('error', (e) =>
      rejectP(e instanceof Error ? e : new Error(String(e))),
    );
    child.on('close', (code) => resolveP(code ?? 0));
  });
  if (interval) clearInterval(interval);
  if (killTimer) clearTimeout(killTimer);
  stream.end();
  await waitForStreamClose(stream);

  // Compute status: error > warn > ok
  let status: 'ok' | 'warn' | 'error' = 'ok';
  if (typeof exitCode === 'number' && exitCode !== 0) {
    status = 'error';
  } else if (opts?.warnPattern) {
    // Robust WARN detection:
    // - Test the in‑memory combined body (stdout+stderr).
    // - Also test the on‑disk output body unconditionally to avoid any edge timing.
    // Reset lastIndex in case a global regex is supplied.
    const rx = opts.warnPattern;
    const testBody = (s: string): boolean => {
      try {
        rx.lastIndex = 0;
        return rx.test(s);
      } catch {
        return false;
      }
    };
    let matched = false;
    // Always consider the in-memory capture first.
    if (combined.length > 0 && testBody(combined)) {
      matched = true;
    }
    // Unconditionally also consider the persisted body (covers any flush/ordering edge).
    try {
      const diskBody = await readFile(outFile, 'utf8');
      if (testBody(diskBody)) matched = true;
    } catch {
      /* ignore disk read errors */
    }
    if (matched) status = 'warn';
  }
  hooks?.onEnd?.(key, outFile, startedAt, Date.now(), exitCode, status);

  if (orderFile) {
    await appendFile(orderFile, key.slice(0, 1).toUpperCase(), 'utf8');
  }
  return outFile;
};
/**
 * Run a set of scripts concurrently or sequentially.
 * * @param cwd - Working directory for child processes.
 * @param outAbs - Absolute output directory.
 * @param outRel - Relative output directory (for logs).
 * @param config - Resolved configuration.
 * @param toRun - Keys to run (must be present in config).
 * @param mode - Execution mode.
 * @param orderFile - Optional order file path (when present, records execution order).
 * @returns Absolute paths to generated output files.
 * @param opts - Optional execution options (e.g., silent logging).
 * @param shouldContinue - Optional gate to stop scheduling new scripts when false (sequential mode).
 * @param supervisor - Optional process supervisor for child tracking/termination.
 */
export const runScripts = async (
  cwd: string,
  outAbs: string,
  outRel: string,
  config: ContextConfig,
  toRun: string[],
  mode: ExecutionMode,
  orderFile?: string,
  hooks?: RunHooks,
  opts?: { silent?: boolean },
  shouldContinue?: () => boolean,
  supervisor?: ProcessSupervisor,
): Promise<string[]> => {
  const created: string[] = [];
  const runner = async (k: string): Promise<void> => {
    // Pre-spawn cancellation gate (race closer):
    // It’s possible for a SIGINT to land after the outer gate but just before
    // this runner is invoked. Re-check here to ensure we never spawn the next
    // script once cancellation has been requested.
    try {
      if (typeof shouldContinue === 'function' && !shouldContinue()) {
        return;
      }
    } catch {
      /* best-effort */
    }
    // Normalize script entry (string | { script, warnPattern? })
    const entry = config.scripts[k] as unknown;
    const cmd =
      typeof entry === 'string'
        ? entry
        : typeof entry === 'object' &&
            entry &&
            'script' in (entry as Record<string, unknown>)
          ? String((entry as { script: string }).script)
          : '';
    let warnPattern: RegExp | undefined;
    if (
      entry &&
      typeof entry === 'object' &&
      'warnPattern' in (entry as Record<string, unknown>)
    ) {
      const raw = (entry as { warnPattern?: string }).warnPattern;
      if (typeof raw === 'string' && raw.trim().length) {
        try {
          warnPattern = new RegExp(raw);
          // If this ever needs to tolerate over-escaped patterns from config, a normalized fallback can be added here.
        } catch {
          // Already validated by schema; best-effort here.
          warnPattern = undefined;
        }
      }
    }
    const p = await runOne(
      cwd,
      outAbs,
      outRel,
      k,
      cmd,
      orderFile,
      hooks,
      // Pass thresholds down if provided
      {
        silent:
          typeof hooks?.silent === 'boolean'
            ? hooks.silent
            : Boolean(opts?.silent),
        hangWarn: (opts as unknown as { hangWarn?: number })?.hangWarn,
        hangKill: (opts as unknown as { hangKill?: number })?.hangKill,
        hangKillGrace: (opts as unknown as { hangKillGrace?: number })
          ?.hangKillGrace,
        warnPattern,
      },
      supervisor,
    );
    created.push(p);
  };
  if (mode === 'sequential') {
    for (const k of toRun) {
      // Pre‑spawn gate: allow pending SIGINT/keypress handlers to fire before scheduling next script.
      if (typeof shouldContinue === 'function') {
        if (!shouldContinue()) break;
        await yieldToEventLoop();
        if (!shouldContinue()) break;
      }
      await runner(k);
      // Allow pending SIGINT/keypress handlers to run before deciding on the next script,
      // then re-check the cancellation gate.
      if (typeof shouldContinue === 'function') {
        await yieldToEventLoop();
        if (!shouldContinue()) break;
      }
    }
  } else {
    const keys =
      typeof shouldContinue === 'function'
        ? toRun.filter(() => shouldContinue())
        : toRun;
    await Promise.all(keys.map((k) => runner(k).then(() => void 0)));
  }
  return created;
};
