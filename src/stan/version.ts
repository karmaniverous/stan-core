// src/stan/version.ts
// Export package version for stan-cli handshake (no side effects).
// Resolved statically by Rollup via @rollup/plugin-json.
import pkg from '../../package.json' assert { type: 'json' };

export const CORE_VERSION: string =
  (pkg as { version?: string }).version ?? '0.0.0';
