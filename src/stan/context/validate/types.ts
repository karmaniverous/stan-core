/**
 * Public types for dependency selection validation (undo/redo seam); used by
 * validators and callers; no runtime code.
 * @module
 */

export type DependencyValidationMismatch = {
  nodeId: string;
  reason: 'map-missing' | 'file-missing' | 'hash-mismatch' | 'size-mismatch';
  locatorAbs?: string;
  expectedHash?: string;
  actualHash?: string;
  expectedSize?: number;
  actualSize?: number;
};

export type ValidateDependencySelectionResult = {
  ok: boolean;
  selectedNodeIds: string[];
  mismatches: DependencyValidationMismatch[];
};

export default {};
