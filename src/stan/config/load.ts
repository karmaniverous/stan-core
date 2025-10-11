/* src/stan/config/load.ts
 * Load/parse STAN configuration and resolve stanPath.
 */
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

import YAML from 'yaml';
import { ZodError } from 'zod';

import { DEFAULT_STAN_PATH } from './defaults';
import { findConfigPathSync } from './discover';
import { type Config, configSchema } from './schema';
import type { ContextConfig } from './types';

const formatZodError = (e: unknown): string => {
  if (!(e instanceof ZodError)) return String(e);
  return e.issues
    .map((i) => {
      const path = i.path.join('.') || '(root)';
      let msg = i.message;
      if (path === 'stanPath' && /Expected string/i.test(msg)) {
        msg = 'stanPath must be a non-empty string';
      }
      return `${path}: ${msg}`;
    })
    .join('\n');
};

/** Normalize imports: string -\> [string]; arrays trimmed; invalid -\> undefined. */
const normalizeImports = (v: unknown): Record<string, string[]> | undefined => {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const out: Record<string, string[]> = {};
  for (const k of Object.keys(o)) {
    const raw = o[k];
    if (typeof raw === 'string') {
      const s = raw.trim();
      if (s) out[k] = [s];
    } else if (Array.isArray(raw)) {
      const arr = raw
        .map((x) => (typeof x === 'string' ? x.trim() : ''))
        .filter((s) => s.length > 0);
      if (arr.length) out[k] = arr;
    }
  }
  return Object.keys(out).length ? out : undefined;
};

const parseRoot = (
  rawText: string,
  isJson: boolean,
): Record<string, unknown> => {
  const rootUnknown: unknown = isJson
    ? (JSON.parse(rawText) as unknown)
    : (YAML.parse(rawText) as unknown);
  const root =
    rootUnknown && typeof rootUnknown === 'object'
      ? (rootUnknown as Record<string, unknown>)
      : {};
  return root;
};

const parseNode = (nodeUnknown: unknown): Config => {
  if (!nodeUnknown || typeof nodeUnknown !== 'object') {
    throw new Error('stan-core: missing or invalid "stan-core" section');
  }
  try {
    return configSchema.parse(nodeUnknown as Record<string, unknown>);
  } catch (e) {
    throw new Error(formatZodError(e));
  }
};

const parseFile = async (
  abs: string,
  relHint?: string,
): Promise<ContextConfig> => {
  const rawText = await readFile(abs, 'utf8');
  const root = parseRoot(rawText, abs.endsWith('.json'));
  if (!Object.prototype.hasOwnProperty.call(root, 'stan-core')) {
    const where = relHint ?? abs;
    throw new Error(
      `stan-core: missing "stan-core" section in ${where}. ` +
        'Add a top-level "stan-core" object with stanPath/includes/excludes/imports.',
    );
  }
  const parsed = parseNode(root['stan-core']);

  const importsNormalized = normalizeImports(parsed.imports);
  return {
    stanPath: parsed.stanPath,
    includes: parsed.includes ?? [],
    excludes: parsed.excludes ?? [],
    imports: importsNormalized,
  };
};

/**
 * Load and validate STAN configuration synchronously.
 *
 * @param cwd - Repo root or any descendant; the nearest `stan.config.*` is used.
 * @returns Parsed, validated {@link ContextConfig}.
 */
export const loadConfigSync = (cwd: string): ContextConfig => {
  const p = findConfigPathSync(cwd);
  if (!p) throw new Error('stan config not found');
  const rawText = readFileSync(p, 'utf8');
  const root = parseRoot(rawText, p.endsWith('.json'));
  if (!Object.prototype.hasOwnProperty.call(root, 'stan-core')) {
    const rel = p;
    throw new Error(
      `stan-core: missing "stan-core" section in ${rel}. ` +
        'Add a top-level "stan-core" object with stanPath/includes/excludes/imports.',
    );
  }
  const parsed = parseNode(root['stan-core']);
  const importsNormalized = normalizeImports(parsed.imports);
  return {
    stanPath: parsed.stanPath,
    includes: parsed.includes ?? [],
    excludes: parsed.excludes ?? [],
    imports: importsNormalized,
  };
};

/**
 * Load and validate STAN configuration (async).
 *
 * @param cwd - Repo root or any descendant; the nearest `stan.config.*` is used.
 * @returns Parsed, validated {@link ContextConfig}.
 */
export const loadConfig = async (cwd: string): Promise<ContextConfig> => {
  const p = findConfigPathSync(cwd);
  if (!p) throw new Error('stan config not found');
  const rel = p.replace(/\\/g, '/');
  return parseFile(p, rel);
};

/** Resolve stanPath from config or fall back to default (sync). */
export const resolveStanPathSync = (cwd: string): string => {
  try {
    return loadConfigSync(cwd).stanPath;
  } catch {
    return DEFAULT_STAN_PATH;
  }
};

/** Resolve stanPath from config or fall back to default (async). */
export const resolveStanPath = async (cwd: string): Promise<string> => {
  try {
    const cfg = await loadConfig(cwd);
    return cfg.stanPath;
  } catch {
    return DEFAULT_STAN_PATH;
  }
};
