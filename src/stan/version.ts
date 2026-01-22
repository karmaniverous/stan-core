/**
 * Exposes the engine package version for CLI handshake; resolved statically at
 * build time; no runtime side effects beyond the constant export.
 * @module
 */
import pkg from '../../package.json' assert { type: 'json' };

export const CORE_VERSION: string =
  (pkg as { version?: string }).version ?? '0.0.0';
