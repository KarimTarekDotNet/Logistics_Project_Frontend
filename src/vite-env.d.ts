/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_SKIP_TUNNEL_WARNING?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
