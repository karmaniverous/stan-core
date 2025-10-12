/* src/stan/config/load.ts
 * Load/parse STAN configuration and resolve stanPath.
 */
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

import { formatZodError, normalizeImports, parseRoot } from './common';
import { DEFAULT_STAN_PATH } from './defaults';
import { findConfigPathSync } from './discover';
import { type Config, configSchema } from './schema';
import type { ContextConfig } from './types';

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
