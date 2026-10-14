/** Set by Vite's `define` (vite.config.ts): package.json's version, and the commit CI built. */
declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;

export const APP_VERSION = __APP_VERSION__;
/** The short commit hash, or "dev" outside CI. */
export const APP_COMMIT = __APP_COMMIT__;
