/**
 * Public types for the engine config surface (`stan-core` block); used by
 * loaders and callers; no runtime code.
 * @module
 */

export type ContextConfig = {
  /** STAN workspace directory (e.g., ".stan"). */
  stanPath: string;
  /**
   * Additive allow‑list globs for selection. Reserved workspace exclusions
   * still apply (<stanPath>/diff and <stanPath>/patch are always excluded;
   * <stanPath>/output is excluded unless combine mode includes it at archive time).
   */
  includes?: string[];
  /** Deny‑list globs (take precedence over includes). */
  excludes?: string[];
  /** Imports mapping normalized to arrays. */
  imports?: Record<string, string[]>;
};
