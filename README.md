# Logistics Project Frontend

Frontend application for the logistics workspace.

Live demo:
https://karimtarekdotnet.github.io/Logistics_Project_Frontend/

## Local Development

```bash
npm install
npm run dev
```

Local development keeps the existing Vite proxy behavior and targets `https://localhost:7100` by default. You can override it with `VITE_DEV_API_BASE_URL` or `VITE_API_BASE_URL`.

Production builds use `https://karimtarekdotnet.github.io/Logistics_project/` as the default backend API base URL unless `VITE_API_BASE_URL` is provided.

## Deployment

GitHub Actions builds the app and deploys `dist` to GitHub Pages after pushes to `main` or `master`.

## Rights

No open-source license is included. All rights reserved.
