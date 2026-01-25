/**
 * Types for dependency graph build and normalization.
 * @module
 */
import type { DependencyMapFile, DependencyMetaFile } from '../schema';

export type BuildDependencyMetaArgs = {
  cwd: string;
  stanPath: string;
  selection?: { includes?: string[]; excludes?: string[] };
  nodeDescriptionLimit?: number;
  nodeDescriptionTags?: string[];
  maxErrors?: number;
  /** Host-injected TypeScript compiler API module (passed through to stan-context). */
  typescript?: unknown;
  /** Host-injected absolute path to a CommonJS TypeScript entry module (passed through to stan-context). */
  typescriptPath?: string;
};

export type NodeSource =
  | { kind: 'repo' }
  | {
      kind: 'npm';
      sourceAbs: string;
      pkgName: string;
      pkgVersion: string;
      pathInPackage: string;
    }
  | { kind: 'abs'; sourceAbs: string; locatorAbs: string };

export type BuildDependencyMetaResult = {
  meta: DependencyMetaFile;
  map: DependencyMapFile;
  warnings: string[];
  stats?: { modules: number; edges: number; dirty: number };
};

// Internal types for raw graph data
export type GraphNode = {
  kind?: 'source' | 'external' | 'builtin' | 'missing';
  metadata?: { size?: number; hash?: string };
  description?: string;
};

export type GraphEdge = {
  target?: string;
  kind?: 'runtime' | 'type' | 'dynamic';
  resolution?: 'explicit' | 'implicit';
};

export type RawGraph = {
  nodes?: Record<string, GraphNode>;
  edges?: Record<string, GraphEdge[]>;
};

export type RawResult = {
  graph?: RawGraph;
  stats?: unknown;
  errors?: unknown;
};
