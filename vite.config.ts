import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import type { IncomingMessage } from "node:http";

const isGitHubPages = process.env.GITHUB_PAGES === "true";
const githubPagesBase = process.env.GITHUB_PAGES_BASE ?? "/Logistics_Project_Frontend/";
const devApiTarget = process.env.VITE_DEV_API_BASE_URL ?? process.env.VITE_API_BASE_URL ?? "https://localhost:7100";
const devAllowedHosts = (process.env.VITE_DEV_ALLOWED_HOSTS ?? "")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);

function normalizeDevCookieAttributes(cookie: string) {
  return cookie
    .replace(/;\s*secure/gi, "")
    .replace(/;\s*samesite=none/gi, "; samesite=lax");
}

function normalizeDevCookies(proxyRes: IncomingMessage) {
  const rawSetCookie = proxyRes.headers["set-cookie"];
  const setCookies = Array.isArray(rawSetCookie) ? rawSetCookie : rawSetCookie ? [rawSetCookie] : [];
  if (setCookies.length > 0) {
    proxyRes.headers["set-cookie"] = setCookies.map(normalizeDevCookieAttributes);
  }
}

export default defineConfig({
  base: isGitHubPages ? githubPagesBase : "/",
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target: devApiTarget,
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on("proxyRes", normalizeDevCookies);
        },
      },
      "/shipments": {
        target: devApiTarget,
        changeOrigin: true,
        secure: false,
      },
    },
    ...(devAllowedHosts.length > 0 ? { allowedHosts: devAllowedHosts } : {}),
  },
});
