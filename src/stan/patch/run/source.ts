/* src/stan/patch/run/source.ts
 * Resolve and read the patch source (clipboard, file, or argument).
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export type PatchSourceKind = 'clipboard' | 'file' | 'argument';

export type PatchSourceResult = {
  kind: PatchSourceKind;
  raw: string;
  /** When kind === 'file', this is the path relative to cwd (POSIX). */
  filePathRel?: string;
};

const repoJoin = (cwd: string, p: string): string =>
  p.startsWith('/') ? path.join(cwd, p.slice(1)) : path.resolve(cwd, p);

/** Read patch source with CLI-friendly logging performed by the caller. */
export const readPatchSource = async (
  cwd: string,
  inputMaybe?: string,
  opts?: {
    file?: string | boolean;
    /** Default patch file path to use when no argument/-f provided and not ignored. */
    defaultFile?: string | null | undefined;
    /** When true, ignore configured default patch file (forces clipboard unless arg/-f provided). */
    ignoreDefaultFile?: boolean;
    /** Injection point for clipboard reads (adapter/CLI provides). */
    clipboardRead?: () => Promise<string>;
  },
): Promise<PatchSourceResult> => {
  // Resolve source precedence (argument -> file flag -> clipboard)
  if (typeof inputMaybe === 'string' && inputMaybe.length > 0) {
    return { kind: 'argument', raw: inputMaybe };
  }
  if (Object.prototype.hasOwnProperty.call(opts ?? {}, 'file')) {
    const opt = (opts as { file?: string | boolean }).file;
    const fileRel = typeof opt === 'string' && opt.length > 0 ? opt : undefined;
    if (!fileRel) {
      // Treat as clipboard when -f/--file present without a name
      if (typeof opts?.clipboardRead !== 'function') {
        throw new Error(
          'clipboardRead not provided; cannot read clipboard in engine',
        );
      }
      return { kind: 'clipboard', raw: await opts.clipboardRead() };
    }
    const absFile = repoJoin(cwd, fileRel);
    const raw = await readFile(absFile, 'utf8');
    return {
      kind: 'file',
      raw,
      // Ensure the path is relative to cwd even if fileRel included segments
      filePathRel: path.relative(cwd, absFile).replace(/\\/g, '/'),
    };
  }
  // -F/--no-file: ignore default file and use clipboard
  if (opts?.ignoreDefaultFile) {
    if (typeof opts.clipboardRead !== 'function') {
      throw new Error(
        'clipboardRead not provided; cannot read clipboard in engine',
      );
    }
    return { kind: 'clipboard', raw: await opts.clipboardRead() };
  }
  // Default file (from config) if present; else clipboard
  const defaultFile =
    typeof opts?.defaultFile === 'string' && opts.defaultFile.trim().length
      ? opts.defaultFile.trim()
      : undefined;
  if (defaultFile) {
    const abs = repoJoin(cwd, defaultFile);
    const raw = await readFile(abs, 'utf8');
    return {
      kind: 'file',
      raw,
      filePathRel: path.relative(cwd, abs).replace(/\\/g, '/'),
    };
  }
  if (typeof opts?.clipboardRead !== 'function') {
    throw new Error(
      'clipboardRead not provided; cannot read clipboard in engine',
    );
  }
  return { kind: 'clipboard', raw: await opts.clipboardRead() };
};
