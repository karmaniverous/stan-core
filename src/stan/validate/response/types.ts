/**
 * Types for response validation (blocks, options, results); used by parser and
 * validator logic.
 * @module
 */

export type BlockKind = 'patch' | 'full' | 'commit';

export type Block = {
  kind: BlockKind;
  /** Repo-relative target path for patch/listing blocks; undefined for commit. */
  path?: string;
  /** Start index (character offset) in the source for ordering checks. */
  start: number;
  /** Block body (content between its heading and the next heading). */
  body: string;
};

export type ValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

export type ValidateResponseOptions = {
  dependencyMode?: boolean;
  stanPath?: string;
};
