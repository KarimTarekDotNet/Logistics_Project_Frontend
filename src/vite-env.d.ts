/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_SKIP_TUNNEL_WARNING?: string;
  readonly VITE_PAYMOB_PUBLIC_KEY?: string;
  readonly VITE_PAYMOB_BASE_URL?: string;
  readonly VITE_PAYMOB_CHECKOUT_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
