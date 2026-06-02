# Logistics Project Frontend

Frontend application for the logistics workspace.

Live demo:
https://karimtarekdotnet.github.io/Logistics_Project_Frontend/

## Local Development

```bash
npm install
npm run dev
```

Local development keeps the existing Vite proxy behavior and targets the local backend by default. To use another backend target, create `.env.local` from `.env.example` and set:

```env
VITE_DEV_API_BASE_URL=<backend-origin>
```

Do not commit real tunnel hosts, callback URLs, API keys, or provider URLs. Values prefixed with `VITE_` are bundled into the browser app, so sensitive payment/provider configuration must stay on the backend.

For static deployments, prefer same-origin API hosting or a server-side proxy. A `VITE_API_BASE_URL` value is public to users after build.

Online payment starts with `{ invoiceId }` only. The backend should keep provider configuration server-side and return a ready checkout URL for the browser redirect.

## Deployment

GitHub Actions builds the app and deploys `dist` to GitHub Pages after pushes to `main` or `master`.

## Rights

No open-source license is included. All rights reserved.
