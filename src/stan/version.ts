/** src/stan/version.ts
 * Version and docs/baseline status helpers for CLI printing and preflight checks.
 */

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, realpath as realpathAsync } from 'node:fs/promises';
import path from 'node:path';

import { packageDirectorySync } from 'package-directory';

import { loadConfigSync, resolveStanPathSync } from '@/stan/config';
import { getModuleRoot } from '@/stan/module';

import { makeStanDirs } from './paths';
export type VersionInfo = {
  packageVersion: string | null;
  nodeVersion: string;
  repoRoot: string;
  stanPath: string;
  /** true when the running module root equals the current repo root (i.e., developing STAN itself) */
  isDevModuleRepo: boolean;
  systemPrompt: {
    localExists: boolean;
    baselineExists: boolean;
    inSync: boolean;
    localHash?: string;
    baselineHash?: string;
  };
  docsMeta?: {
    version?: string;
  } | null;
};

const sha256 = async (abs: string): Promise<string> => {
  const body = await readFile(abs);
  return createHash('sha256').update(body).digest('hex');
};

const realAbs = async (
  p: string | null | undefined,
): Promise<string | null> => {
  if (!p) return null;
  try {
    // Normalize symlinks/junctions (npm link, Windows) for reliable equality.
    const rp = await realpathAsync(p);
    return rp;
  } catch {
    return p ? path.resolve(p) : null;
  }
};

const readJson = async <T>(abs: string): Promise<T | null> => {
  try {
    const raw = await readFile(abs, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

/**
 * Collect version and baseline‑docs status for printing and preflight.
 *
 * @param cwd - Repo root (or descendant).
 * @returns Version info including Node/package versions, resolved stanPath,
 *          whether this repo is the module’s own workspace, system prompt
 *          in‑sync flags, and last installed docs metadata.
 */
export const getVersionInfo = async (cwd: string): Promise<VersionInfo> => {
  // Repo root and stanPath
  let repoRoot = cwd;
  try {
    const pkgRoot = packageDirectorySync({ cwd }) ?? cwd;
    repoRoot = pkgRoot;
  } catch {
    // ignore
  }

  const stanPath = (() => {
    try {
      return loadConfigSync(repoRoot).stanPath;
    } catch {
      return resolveStanPathSync(repoRoot);
    }
  })();

  // Optional config override for dev mode
  let devModeFromConfig: boolean | undefined;
  try {
    const cfg = loadConfigSync(repoRoot);
    devModeFromConfig =
      typeof cfg.devMode === 'boolean' ? cfg.devMode : undefined;
  } catch {
    devModeFromConfig = undefined;
  }

  const dirs = makeStanDirs(repoRoot, stanPath);
  const localSystem = path.join(dirs.systemAbs, 'stan.system.md');
  const docsMetaPath = path.join(dirs.systemAbs, '.docs.meta.json');

  // Module/package version
  let packageVersion: string | null = null;
  const moduleRoot = getModuleRoot();
  if (moduleRoot) {
    try {
      const pkg = await readJson<{ version?: string }>(
        path.join(moduleRoot, 'package.json'),
      );
      packageVersion = pkg?.version ?? null;
    } catch {
      packageVersion = null;
    }
  }

  // Baseline doc under dist/
  const baselineSystem =
    moduleRoot && existsSync(path.join(moduleRoot, 'dist', 'stan.system.md'))
      ? path.join(moduleRoot, 'dist', 'stan.system.md')
      : null;

  const localExists = existsSync(localSystem);
  const baselineExists = baselineSystem ? existsSync(baselineSystem) : false;

  const [localHash, baselineHash] = await Promise.all([
    localExists ? sha256(localSystem) : Promise.resolve(undefined),
    baselineExists && baselineSystem
      ? sha256(baselineSystem)
      : Promise.resolve(undefined),
  ]);

  const inSync =
    !!localHash && !!baselineHash ? localHash === baselineHash : false;

  const docsMeta = await readJson<{ version?: string }>(docsMetaPath);

  // Realpath-hardened, name-agnostic detection
  const [realModule, realRepo] = await Promise.all([
    realAbs(moduleRoot),
    realAbs(repoRoot),
  ]);
  const detectedHome = !!realModule && !!realRepo && realModule === realRepo;

  // Overrides: env > config > detection
  const env = process.env.STAN_DEV_MODE?.trim().toLowerCase();
  const envOverride =
    env === '1' || env === 'true'
      ? true
      : env === '0' || env === 'false'
        ? false
        : undefined;

  const isDevModuleRepo =
    typeof envOverride === 'boolean'
      ? envOverride
      : typeof devModeFromConfig === 'boolean'
        ? devModeFromConfig
        : detectedHome;

  return {
    packageVersion,
    nodeVersion: process.version,
    repoRoot,
    stanPath,
    isDevModuleRepo,
    systemPrompt: {
      localExists,
      baselineExists,
      inSync,
      localHash,
      baselineHash,
    },
    docsMeta: docsMeta ?? null,
  };
};

/**
 * Print a multi‑line human‑readable summary of version and docs status.
 *
 * @param v - Result of {@link getVersionInfo}.
 */
export const printVersionInfo = (v: VersionInfo): void => {
  const lines = [
    `STAN version: ${v.packageVersion ?? 'unknown'} (node ${v.nodeVersion})`,
    `repo: ${v.repoRoot.replace(/\\/g, '/')}`,
    `stanPath: ${v.stanPath}`,
    `system prompt in sync: ${v.systemPrompt.inSync ? 'yes' : 'no'} (local: ${
      v.systemPrompt.localExists ? 'yes' : 'no'
    }, baseline: ${v.systemPrompt.baselineExists ? 'yes' : 'no'})`,
    `docs last installed: ${v.docsMeta?.version ?? 'unknown'}`,
  ];

  console.log(lines.join('\n'));
};
