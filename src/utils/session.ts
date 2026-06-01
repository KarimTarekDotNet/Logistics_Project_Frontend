import { PENDING_VERIFICATION_KEY, SESSION_KEY } from "../constants/logistics";
import type { AuthResponse, AuthSession } from "../types";

export const COOKIE_SESSION_TOKEN = "cookie-session";

function decodeJwt(token: string) {
  try {
    const [, payload] = token.split(".");
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(normalized)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function normalizeRoles(raw: unknown) {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") return [raw];
  return [];
}

export function sessionFromAuth(response: AuthResponse): AuthSession {
  const token = response.accessToken ?? "";
  const claims = decodeJwt(token);
  const roleClaim =
    claims.role ??
    claims.roles ??
    claims["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"];

  return {
    accessToken: token || COOKIE_SESSION_TOKEN,
    refreshToken: token ? response.refreshToken : undefined,
    id:
      response.id ??
      String(
        claims.nameid ??
          claims.sub ??
          claims["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"] ??
          ""
      ),
    userName: response.userName ?? String(claims.unique_name ?? claims.name ?? ""),
    email: response.email ?? String(claims.email ?? ""),
    roles: normalizeRoles(roleClaim),
    expiresAt: response.expiration
  };
}

export function loadStoredSession() {
  localStorage.removeItem(SESSION_KEY);
  return null;
}

export function persistSession(session: AuthSession | null) {
  localStorage.removeItem(SESSION_KEY);
  void session;
}

export function loadPendingVerification() {
  const stored = localStorage.getItem(PENDING_VERIFICATION_KEY);
  if (!stored) return { userId: "", email: "", phone: "", userName: "", emailConfirmed: false };

  try {
    const parsed = JSON.parse(stored) as {
      userId?: string;
      email?: string;
      phone?: string;
      userName?: string;
      emailConfirmed?: boolean;
    };
    return {
      userId: parsed.userId ?? "",
      email: parsed.email ?? "",
      phone: parsed.phone ?? "",
      userName: parsed.userName ?? "",
      emailConfirmed: parsed.emailConfirmed ?? false
    };
  } catch {
    localStorage.removeItem(PENDING_VERIFICATION_KEY);
    return { userId: "", email: "", phone: "", userName: "", emailConfirmed: false };
  }
}

export function maskPhone(phone: string) {
  const compact = phone.replace(/\s+/g, "");
  if (!compact) return "your registered phone";
  const lastFour = compact.slice(-4);
  const prefix = compact.startsWith("+") ? compact.slice(0, 3) : compact.slice(0, 2);
  return `${prefix}*****${lastFour}`;
}
