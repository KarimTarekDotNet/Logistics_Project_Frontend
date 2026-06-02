# Logistics Project Frontend

Frontend application for the logistics workspace.

Live demo:
https://karimtarekdotnet.github.io/Logistics_Project_Frontend/

## Local Development

```bash
npm install
npm run dev
```

Local development keeps the existing Vite proxy behavior and targets `https://localhost:7100` by default. To use the ngrok backend instead, set:

```env
VITE_DEV_API_BASE_URL=https://unmultipliable-kelsey-unloyal.ngrok-free.dev
```

Card checkout uses Paymob Unified Checkout. `VITE_PAYMOB_PUBLIC_KEY` defaults to the Paymob test public key, and `VITE_PAYMOB_BASE_URL=https://accept.paymob.com/api` is accepted in the same shape as the backend settings.

Production builds use `https://karimtarekdotnet.github.io/Logistics_project/` as the default backend API base URL unless `VITE_API_BASE_URL` is provided.

## Deployment

GitHub Actions builds the app and deploys `dist` to GitHub Pages after pushes to `main` or `master`.

## Rights

No open-source license is included. All rights reserved.
