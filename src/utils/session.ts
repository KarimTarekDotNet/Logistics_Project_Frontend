import { PENDING_VERIFICATION_KEY, SESSION_KEY } from "../constants/logistics";
import type { AuthResponse, AuthSession } from "../types";

export const COOKIE_SESSION_TOKEN = "cookie-session";
export const PENDING_VERIFICATION_TTL_MS = 2 * 60 * 60 * 1000;

export type PendingVerification = {
  email: string;
  phone: string;
  userName: string;
  emailConfirmed: boolean;
  expiresAt: number;
};

type PendingVerificationInput = Partial<Omit<PendingVerification, "expiresAt">>;

let pendingVerificationExpiryTimer: number | null = null;

function emptyPendingVerification(): PendingVerification {
  return {
    email: "",
    phone: "",
    userName: "",
    emailConfirmed: false,
    expiresAt: 0
  };
}

function schedulePendingVerificationExpiry(expiresAt: number) {
  if (typeof window === "undefined") return;
  if (pendingVerificationExpiryTimer !== null) {
    window.clearTimeout(pendingVerificationExpiryTimer);
  }

  const remaining = expiresAt - Date.now();
  if (remaining <= 0) {
    clearPendingVerification();
    return;
  }

  pendingVerificationExpiryTimer = window.setTimeout(() => {
    clearPendingVerification();
  }, Math.min(remaining, 2_147_483_647));
}

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
  localStorage.removeItem(PENDING_VERIFICATION_KEY);

  const stored = sessionStorage.getItem(PENDING_VERIFICATION_KEY);
  if (!stored) return emptyPendingVerification();

  try {
    const parsed = JSON.parse(stored) as Partial<PendingVerification>;
    const expiresAt = Number(parsed.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      clearPendingVerification();
      return emptyPendingVerification();
    }

    const pending = {
      email: parsed.email ?? "",
      phone: parsed.phone ?? "",
      userName: parsed.userName ?? "",
      emailConfirmed: parsed.emailConfirmed ?? false,
      expiresAt
    };
    schedulePendingVerificationExpiry(expiresAt);
    return pending;
  } catch {
    clearPendingVerification();
    return emptyPendingVerification();
  }
}

export function savePendingVerification(pending: PendingVerificationInput) {
  const nextPending: PendingVerification = {
    email: pending.email?.trim() ?? "",
    phone: pending.phone?.trim() ?? "",
    userName: pending.userName?.trim() ?? "",
    emailConfirmed: pending.emailConfirmed ?? false,
    expiresAt: Date.now() + PENDING_VERIFICATION_TTL_MS
  };

  localStorage.removeItem(PENDING_VERIFICATION_KEY);
  sessionStorage.setItem(PENDING_VERIFICATION_KEY, JSON.stringify(nextPending));
  schedulePendingVerificationExpiry(nextPending.expiresAt);
  return nextPending;
}

export function clearPendingVerification() {
  localStorage.removeItem(PENDING_VERIFICATION_KEY);
  sessionStorage.removeItem(PENDING_VERIFICATION_KEY);
  if (pendingVerificationExpiryTimer !== null && typeof window !== "undefined") {
    window.clearTimeout(pendingVerificationExpiryTimer);
    pendingVerificationExpiryTimer = null;
  }
}

export function maskPhone(phone: string) {
  const compact = phone.replace(/\s+/g, "");
  if (!compact) return "your registered phone";
  const lastFour = compact.slice(-4);
  const prefix = compact.startsWith("+") ? compact.slice(0, 3) : compact.slice(0, 2);
  return `${prefix}*****${lastFour}`;
}
