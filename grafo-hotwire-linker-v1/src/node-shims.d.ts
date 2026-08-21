declare module "node:fs" {
  const fs: any;
  export default fs;
}
declare module "node:path" {
  const path: any;
  export default path;
}
declare module "node:url" {
  export function pathToFileURL(path: string): { href: string };
}
declare module "node:assert/strict" {
  const assert: any;
  export default assert;
}
declare module "node:test" {
  const test: any;
  export default test;
}
declare const process: any;
