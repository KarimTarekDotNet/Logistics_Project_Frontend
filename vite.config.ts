import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import type { IncomingMessage } from "node:http";

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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const readEnv = (name: string) => process.env[name] ?? env[name];
  const isGitHubPages = readEnv("GITHUB_PAGES") === "true";
  const githubPagesBase = readEnv("GITHUB_PAGES_BASE") ?? "/Logistics_Project_Frontend/";
  const devApiTarget = readEnv("VITE_DEV_API_BASE_URL") ?? readEnv("VITE_API_BASE_URL") ?? "https://localhost:7100";
  const devAllowedHosts = (readEnv("VITE_DEV_ALLOWED_HOSTS") ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);
  const tunnelHeaders = readEnv("VITE_SKIP_TUNNEL_WARNING") === "false" ? {} : { "ngrok-skip-browser-warning": "true" };

  return {
    base: isGitHubPages ? githubPagesBase : "/",
    plugins: [react(), tailwindcss()],
    build: {
      target: ["es2018", "chrome87", "firefox78", "safari13"],
      cssTarget: "safari13",
    },
    server: {
      host: "0.0.0.0",
      proxy: {
        "/api": {
          target: devApiTarget,
          changeOrigin: true,
          secure: false,
          headers: tunnelHeaders,
          configure: (proxy) => {
            proxy.on("proxyRes", normalizeDevCookies);
          },
        },
        "/shipments": {
          target: devApiTarget,
          changeOrigin: true,
          secure: false,
          headers: tunnelHeaders,
        },
      },
      ...(devAllowedHosts.length > 0 ? { allowedHosts: devAllowedHosts } : {}),
    },
  };
});
