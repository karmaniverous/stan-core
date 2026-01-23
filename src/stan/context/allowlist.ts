/**
 * Computes context-mode allowlist plans (Base + dependency closure), applying
 * explicit excludes as hard denials and identifying stageable external nodeIds
 * under <stanPath>/context/{npm,abs}; filesystem IO only; no console output.
 * @module
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { filterFiles, listFiles } from '@/stan/fs';
import { makeGlobMatcher } from '@/stan/fs/match';
import {
  isOutputArchivePath,
  isReservedWorkspacePath,
} from '@/stan/fs/reserved';

import type { DependencyMetaFile } from './schema';
import { parseDependencyStateFile } from './schema';
import { computeSelectedNodeIds } from './state';

const toPosix = (p: string): string =>
  p.replace(/\\/g, '/').replace(/^\.\/+/, '');

const uniqSorted = (xs: string[]): string[] =>
  Array.from(new Set(xs.map((s) => toPosix(s).trim()).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b),
  );

const normalizePrefix = (p: string): string =>
  toPosix(p)
    .replace(/^\.\/+/, '')
    .replace(/\/+$/, '');

const isUnder = (prefix: string, rel: string): boolean => {
  const a = normalizePrefix(prefix);
  const b = normalizePrefix(rel);
  return b === a || b.startsWith(`${a}/`);
};

const isStageableNodeId = (stanPath: string, nodeId: string): boolean => {
  const base = normalizePrefix(stanPath);
  const rel = normalizePrefix(nodeId);
  return (
    isUnder(`${base}/context/npm`, rel) || isUnder(`${base}/context/abs`, rel)
  );
};

const isRepoRootFile = (rel: string): boolean => !toPosix(rel).includes('/');

const readJsonIfPresent = async (
  cwd: string,
  rel: string,
): Promise<unknown | null> => {
  const abs = resolve(cwd, rel);
  if (!existsSync(abs)) return null;
  try {
    const raw = await readFile(abs, 'utf8');
    return JSON.parse(raw) as unknown;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`failed to parse JSON at ${toPosix(rel)}: ${msg}`);
  }
};

export type ContextModeSelection = {
  includes?: string[];
  excludes?: string[];
};

export type ContextAllowlistPlan = {
  /** Base (system + dependency meta/state + repo-root base files). */
  baseFiles: string[];
  /** All selected nodeIds from dependency state closure (after excludes/reserved). */
  selectedNodeIds: string[];
  /** External nodeIds that must be staged into <stanPath>/context/**. */
  stageNodeIds: string[];
  /** Final allowlist (Base + selected closure; after excludes/reserved). */
  allowlistFiles: string[];
  /** True when dependency.state.json existed on disk and was used implicitly. */
  usedDiskState: boolean;
};

/**
 * Compute context-mode Base and allowlist selection.
 *
 * Base definition (v1):
 * - system docs under <stanPath>/system/** (excluding <stanPath>/system/.docs.meta.json)
 * - dependency meta at <stanPath>/context/dependency.meta.json (required)
 * - dependency state at <stanPath>/context/dependency.state.json (when present)
 * - plus repo-root files selected by current selection config (top-level files only)
 *
 * Allowlist:
 * - Base + selected dependency closure (repo-local nodeIds + staged externals)
 * - apply explicit excludes as hard denials
 * - reserved denials always win
 */
export const computeContextAllowlistPlan = async (args: {
  cwd: string;
  stanPath: string;
  meta: Pick<DependencyMetaFile, 'nodes' | 'edges'>;
  state?: unknown;
  selection?: ContextModeSelection;
}): Promise<ContextAllowlistPlan> => {
  const { cwd, stanPath, meta, selection } = args;
  const includes = selection?.includes ?? [];
  const excludes = selection?.excludes ?? [];

  const all = await listFiles(cwd);

  const stanRel = normalizePrefix(stanPath);
  const docsMetaRel = `${stanRel}/system/.docs.meta.json`;
  const systemPrefix = `${stanRel}/system/`;
  const depMetaRel = `${stanRel}/context/dependency.meta.json`;
  const depStateRel = `${stanRel}/context/dependency.state.json`;

  // Require dependency meta to exist on disk for context-mode archiving.
  // (Selection is allowlist-only; without meta the assistant cannot author state.)
  if (!all.includes(depMetaRel) || !existsSync(resolve(cwd, depMetaRel))) {
    throw new Error(
      `dependency meta not found at ${depMetaRel}; generate it before context-mode archiving`,
    );
  }

  const sysFiles = all
    .filter((p) => p.startsWith(systemPrefix))
    .filter((p) => p !== docsMetaRel);

  // Base repo-root files (config-driven selection, restricted to repo root).
  const filtered = await filterFiles(all, {
    cwd,
    stanPath,
    includeOutputDir: false,
    includes,
    excludes,
  });
  const repoRootBaseFiles = filtered.filter(isRepoRootFile);

  const depStateExists =
    all.includes(depStateRel) && existsSync(resolve(cwd, depStateRel));

  const baseFiles = uniqSorted([
    ...sysFiles,
    depMetaRel,
    ...(depStateExists ? [depStateRel] : []),
    ...repoRootBaseFiles,
  ]);

  // Dependency state input:
  // - prefer explicit state passed by caller
  // - else load dependency.state.json from disk when present
  let usedDiskState = false;
  let stateRaw: unknown | null =
    typeof args.state !== 'undefined' ? args.state : null;
  if (typeof args.state === 'undefined' && depStateExists) {
    stateRaw = await readJsonIfPresent(cwd, depStateRel);
    usedDiskState = true;
  }

  const isExcluded = makeGlobMatcher(excludes);
  const isReserved = (p: string): boolean =>
    isReservedWorkspacePath(stanRel, p) || isOutputArchivePath(stanRel, p);

  let selectedNodeIds: string[] = [];
  if (stateRaw) {
    const parsed = parseDependencyStateFile(stateRaw);
    selectedNodeIds = computeSelectedNodeIds({
      meta,
      include: parsed.include,
      exclude: parsed.exclude,
    });
  }

  // Apply explicit excludes as hard denials and reserved denials always.
  const selectedFiltered = selectedNodeIds
    .map(normalizePrefix)
    .filter((p) => !isExcluded(p))
    .filter((p) => !isReserved(p));

  const stageNodeIds = uniqSorted(
    selectedFiltered.filter((id) => isStageableNodeId(stanRel, id)),
  );

  // Allowlist is Base + selected closure.
  const allowlistFiles = uniqSorted(
    [...baseFiles, ...selectedFiltered]
      .filter((p) => !isExcluded(p))
      .filter((p) => !isReserved(p)),
  );

  return {
    baseFiles,
    selectedNodeIds: uniqSorted(selectedFiltered),
    stageNodeIds,
    allowlistFiles,
    usedDiskState,
  };
};

export default { computeContextAllowlistPlan };
