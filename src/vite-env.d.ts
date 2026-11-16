/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_XTREAM_SERVER: string;
  readonly VITE_DEV_PROXY_TARGET: string;
  readonly VITE_BASE_PATH: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
