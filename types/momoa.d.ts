// Minimal shim for eslint-plugin-jsonc d.ts type import.
// The plugin only needs the type; no runtime usage in this project.
declare module '@humanwhocodes/momoa' {
  export type AnyNode = unknown;
}
