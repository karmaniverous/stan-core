/**
 * Public types for dependency selection validation (undo/redo seam); used by
 * validators and callers; no runtime code.
 * @module
 */

export type DependencyValidationMismatch =
  | {
      nodeId: string;
      kind: 'npm';
      reason:
        | 'invalid-nodeId'
        | 'meta-missing'
        | 'metadata-missing'
        | 'package-not-found'
        | 'package-version-mismatch'
        | 'file-missing'
        | 'hash-mismatch'
        | 'size-mismatch';
      pkgName?: string;
      pkgVersion?: string;
      pathInPackage?: string;
      expectedHash?: string;
      actualHash?: string;
      expectedSize?: number;
      actualSize?: number;
      candidates?: string[];
    }
  | {
      nodeId: string;
      kind: 'abs';
      reason:
        | 'meta-missing'
        | 'metadata-missing'
        | 'locator-missing'
        | 'file-missing'
        | 'hash-mismatch'
        | 'size-mismatch';
      locatorAbs?: string;
      expectedHash?: string;
      actualHash?: string;
      expectedSize?: number;
      actualSize?: number;
    };

export type ValidateDependencySelectionResult = {
  ok: boolean;
  selectedNodeIds: string[];
  checkedNodeIds: string[];
  mismatches: DependencyValidationMismatch[];
};

export default {};
