import type {
  AuthResponse,
  AuthSession,
  Carrier,
  CheckoutPaymentResponse,
  ContainerType,
  Customer,
  Invoice,
  InvoicePayment,
  InvoicePaymentRequest,
  MarketAnalytics,
  PaymentTransaction,
  Port,
  ProfileResponse,
  ProfileUpdateResponse,
  QueryParams,
  Quote,
  QuoteRequest,
  Rate,
  RateRecommendationResponse,
  RecommendationPriority,
  Route,
  Shipment,
  ShipmentCharge,
  ShipmentDocument,
  ShipmentHistory,
  ShipmentItem,
  StartPaymentResponse,
  TimelineItem
} from "../types";
import { sessionFromAuth } from "../utils/session";

const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

function shouldUseDevProxy(apiBaseUrl: string) {
  if (!import.meta.env.DEV) return false;
  if (!apiBaseUrl) return true;

  try {
    new URL(apiBaseUrl);
    return true;
  } catch {
    return false;
  }
}

const API_BASE_URL = shouldUseDevProxy(configuredApiBaseUrl) ? "" : configuredApiBaseUrl;
const SKIP_TUNNEL_WARNING = import.meta.env.VITE_SKIP_TUNNEL_WARNING !== "false";
export const SESSION_REFRESHED_EVENT = "flowtix:session-refreshed";
const CSRF_COOKIE_NAME = "XSRF-TOKEN";
const CSRF_HEADER_NAME = "X-CSRF-TOKEN";
const CSRF_RESPONSE_HEADER_NAME = "X-CSRF-REQUEST-TOKEN";

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string;
  headers?: Record<string, string>;
  skipAuthRefresh?: boolean;
  skipCsrfRetry?: boolean;
};

let refreshPromise: Promise<AuthSession | null> | null = null;
let csrfPromise: Promise<void> | null = null;
let csrfRequestToken = "";

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

function buildQuery(params?: QueryParams | Record<string, string | number | boolean | undefined>) {
  if (!params) return "";

  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.set(key, String(value));
  });

  const result = query.toString();
  return result ? `?${result}` : "";
}

function normalizeToken(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function toSafeAmount(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function isSuccessfulInvoicePayment(payment: InvoicePayment) {
  const status = normalizeToken(payment.status);
  return !status || status === "succeeded" || status === "paid";
}

function hasInvoiceBalanceFields(invoice: Invoice) {
  return (
    invoice.paidPart != null &&
    (invoice.remainingAmount != null ||
      invoice.remainingBalance != null ||
      invoice.amountDue != null ||
      invoice.balanceDue != null)
  );
}

function mergeInvoicePayments(invoice: Invoice, payments: InvoicePayment[] = []): Invoice {
  const total = Math.max(0, toSafeAmount(invoice.totalAmount));
  const status = normalizeToken(invoice.paymentStatus);
  const responseRemaining =
    invoice.remainingAmount ?? invoice.remainingBalance ?? invoice.amountDue ?? invoice.balanceDue;
  const inferredPaidFromRemaining = responseRemaining != null ? total - toSafeAmount(responseRemaining) : 0;
  const paidFromResponse = Math.max(
    0,
    toSafeAmount(invoice.paidPart ?? (status === "paid" ? total : inferredPaidFromRemaining))
  );
  const paidFromPayments = payments
    .filter(isSuccessfulInvoicePayment)
    .reduce((sum, payment) => sum + Math.max(0, toSafeAmount(payment.amount)), 0);
  const paidPart = Math.min(total, payments.length > 0 ? paidFromPayments : paidFromResponse);
  const shouldComputeRemaining = payments.length > 0 || paidPart > 0 || status === "paid" || responseRemaining == null;
  const remainingAmount =
    shouldComputeRemaining ? Math.max(0, total - paidPart) : Math.max(0, toSafeAmount(responseRemaining));

  return {
    ...invoice,
    payments,
    paidPart,
    remainingAmount,
    remainingBalance: remainingAmount,
    amountDue: remainingAmount,
    balanceDue: remainingAmount
  };
}

async function hydrateInvoicePayments(token: string, invoice: Invoice) {
  if (hasInvoiceBalanceFields(invoice)) return mergeInvoicePayments(invoice);

  try {
    const payments = await request<InvoicePayment[]>(`/api/Invoice/payments/${invoice.id}`, { token });
    return mergeInvoicePayments(invoice, payments);
  } catch {
    return mergeInvoicePayments(invoice);
  }
}

async function hydrateInvoicesPayments(token: string, invoices: Invoice[]) {
  return Promise.all(invoices.map((invoice) => hydrateInvoicePayments(token, invoice)));
}

async function parseResponse(response: Response) {
  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const text = await response.text();
    return text ? parseJsonString(text) ?? text : null;
  }

  const text = await response.text();
  return text || null;
}

function parseJsonString(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function cleanMessage(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/["{}[\]]/g, "")
    .trim()
    .slice(0, 260);
}

function extractErrorStrings(value: unknown): string[] {
  if (typeof value === "string") {
    const parsed = value.trim().startsWith("{") || value.trim().startsWith("[") ? parseJsonString(value) : null;
    return parsed ? extractErrorStrings(parsed) : [cleanMessage(value)];
  }

  if (Array.isArray(value)) {
    return value.flatMap(extractErrorStrings);
  }

  if (typeof value === "object" && value) {
    const record = value as Record<string, unknown>;
    const direct = [record.message, record.Message, record.error, record.Error, record.detail]
      .flatMap(extractErrorStrings)
      .filter(Boolean);

    if (direct.length > 0) return direct;
    if (record.errors) return extractErrorStrings(record.errors);
    if (record.title) return extractErrorStrings(record.title);

    return Object.values(record).flatMap(extractErrorStrings);
  }

  return [];
}

function extractApiMessage(payload: unknown, status: number) {
  const messages = extractErrorStrings(payload).filter((message) => message.length > 0);
  if (messages.length > 0) return Array.from(new Set(messages)).slice(0, 2).join(" ");
  return `Request failed with status ${status}`;
}

function extractCsrfToken(payload: unknown) {
  if (typeof payload === "string") return payload.trim();
  if (typeof payload !== "object" || !payload) return "";

  const record = payload as Record<string, unknown>;
  const token = record.requestToken ?? record.csrfToken ?? record.token ?? record.xsrfToken ?? record.antiForgeryToken;
  return typeof token === "string" ? token.trim() : "";
}

function resolveRequestBody(method: string, body: unknown): BodyInit | undefined {
  if (body instanceof FormData) return body;
  if (body !== undefined) return JSON.stringify(body);

  const verb = method.toUpperCase();
  if (verb === "POST" || verb === "PUT" || verb === "PATCH") {
    return "{}";
  }

  return undefined;
}

function isUnsafeMethod(method: string) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}

function readCookie(name: string) {
  if (typeof document === "undefined") return "";

  const encodedName = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(encodedName));

  return cookie ? decodeURIComponent(cookie.slice(encodedName.length)) : "";
}

async function ensureCsrfToken(force = false) {
  if (!force && csrfRequestToken) return;
  if (csrfPromise) return csrfPromise;

  csrfPromise = fetch(`${API_BASE_URL}/api/auth/csrf-token`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(SKIP_TUNNEL_WARNING ? { "ngrok-skip-browser-warning": "true" } : {})
    },
    credentials: "include",
    referrerPolicy: "strict-origin-when-cross-origin"
  })
    .then(async (response) => {
      const payload = await parseResponse(response);

      if (!response.ok) {
        const message =
          response.status === 429
            ? "Too many security token requests. Please wait about a minute, then try again."
            : "Could not prepare request security token";
        throw new ApiError(response.status, message, payload);
      }

      csrfRequestToken =
        extractCsrfToken(payload) ||
        response.headers.get(CSRF_RESPONSE_HEADER_NAME) ||
        response.headers.get(CSRF_HEADER_NAME) ||
        readCookie(CSRF_COOKIE_NAME);

      if (!csrfRequestToken) {
        throw new ApiError(
          419,
          "Could not prepare request security token. Use the Vite API proxy for local auth requests.",
          payload
        );
      }
    })
    .finally(() => {
      csrfPromise = null;
    });

  return csrfPromise;
}

function isPotentialCsrfFailure(status: number, payload: unknown) {
  if (status !== 400 && status !== 419) return false;
  if (payload === null || payload === undefined || payload === "") return true;

  const message = extractApiMessage(payload, status).toLowerCase();
  return message.includes("csrf") || message.includes("xsrf") || message.includes("antiforgery");
}

function notifySessionRefresh(session: AuthSession | null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AuthSession | null>(SESSION_REFRESHED_EVENT, { detail: session }));
}

export function getApiAssetUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}/${path.replace(/^\/+/, "")}`;
}

export async function openApiAsset(path: string, filename = "document") {
  const url = getApiAssetUrl(path);
  const popup = window.open("about:blank", "_blank");
  if (popup) popup.opener = null;

  try {
    const response = await fetch(url, {
      headers: SKIP_TUNNEL_WARNING ? { "ngrok-skip-browser-warning": "true" } : {},
      credentials: "include",
      referrerPolicy: "strict-origin-when-cross-origin"
    });

    if (!response.ok) {
      throw new ApiError(response.status, `Could not open ${filename}`, await parseResponse(response));
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    if (popup) {
      popup.location.href = objectUrl;
    } else {
      const link = document.createElement("a");
      link.href = objectUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
    }

    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (error) {
    popup?.close();
    throw error;
  }
}

async function refreshStoredSession() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = request<AuthResponse>("/api/Auth/refresh", {
    method: "POST",
    skipAuthRefresh: true
  })
    .then((response) => {
      if (!response.isAuthenticated) {
        throw new ApiError(401, response.message || "Session refresh failed", response);
      }

      const nextSession = sessionFromAuth(response);
      notifySessionRefresh(nextSession);
      void ensureCsrfToken(true);
      return nextSession;
    })
    .catch((error) => {
      notifySessionRefresh(null);
      throw error;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

function isAuthEntryRequest(path: string, method: string) {
  if (method.toUpperCase() !== "POST") return false;
  const normalizedPath = path.toLowerCase().split("?")[0];
  return normalizedPath === "/api/auth/login" || normalizedPath === "/api/auth/register";
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const method = options.method ?? "GET";
  const upperMethod = method.toUpperCase();
  const requestBody = resolveRequestBody(method, options.body);

  if (isUnsafeMethod(upperMethod)) {
    await ensureCsrfToken(isAuthEntryRequest(path, upperMethod));
  }

  let csrfToken = isUnsafeMethod(upperMethod) ? csrfRequestToken || readCookie(CSRF_COOKIE_NAME) : "";
  if (isUnsafeMethod(upperMethod) && !csrfToken) {
    await ensureCsrfToken(true);
    csrfToken = csrfRequestToken || readCookie(CSRF_COOKIE_NAME);
  }
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(SKIP_TUNNEL_WARNING ? { "ngrok-skip-browser-warning": "true" } : {}),
    ...(isFormData ? {} : upperMethod !== "GET" && upperMethod !== "DELETE" ? { "Content-Type": "application/json" } : {}),
    ...(csrfToken ? { [CSRF_HEADER_NAME]: csrfToken } : {}),
    ...options.headers
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: requestBody,
    credentials: "include",
    referrerPolicy: "strict-origin-when-cross-origin"
  });

  const payload = await parseResponse(response);

  if (response.status === 401 && options.token && !options.skipAuthRefresh) {
    const nextSession = await refreshStoredSession();
    if (nextSession?.accessToken) {
      return request<T>(path, {
        ...options,
        token: nextSession.accessToken,
        skipAuthRefresh: true
      });
    }
  }

  if (isUnsafeMethod(upperMethod) && !options.skipCsrfRetry && isPotentialCsrfFailure(response.status, payload)) {
    csrfRequestToken = "";
    await ensureCsrfToken(true);
    return request<T>(path, {
      ...options,
      skipCsrfRetry: true
    });
  }

  if (!response.ok) {
    throw new ApiError(response.status, extractApiMessage(payload, response.status), payload);
  }

  return payload as T;
}

export const api = {
  baseUrl: API_BASE_URL,

  login(body: { identity: string; password: string }) {
    return request<AuthResponse>("/api/Auth/login", { method: "POST", body });
  },

  register(body: {
    firstName: string;
    lastName: string;
    userName: string;
    email: string;
    countryCode: string;
    phoneNumber: string;
    password: string;
    confirmPassword: string;
  }) {
    return request<AuthResponse>("/api/Auth/register", { method: "POST", body });
  },

  confirmEmail(userId: string, token: string) {
    return request<AuthResponse>(`/api/Auth/confirm-email${buildQuery({ userId, token })}`);
  },

  resendEmailConfirmation(email: string) {
    return request<AuthResponse>(`/api/Auth/resend-email-confirmation${buildQuery({ Email: email })}`, {
      method: "POST"
    });
  },

  confirmPhone(phone: string, code: string) {
    return request<AuthResponse>("/api/Auth/confirm-phone", {
      method: "POST",
      body: { phone, code }
    });
  },

  resendPhoneOtp(phone: string) {
    return request<AuthResponse>(`/api/Auth/resend-phone-otp${buildQuery({ phone })}`, { method: "POST" });
  },

  refresh() {
    return request<AuthResponse>("/api/Auth/refresh", { method: "POST", skipAuthRefresh: true });
  },

  logout(token: string) {
    return request<{ message: string }>("/api/Auth/logout", {
      method: "POST",
      token,
      skipAuthRefresh: true
    });
  },

  prepareCsrfToken(force = false) {
    return ensureCsrfToken(force);
  },

  logoutAll(token: string) {
    return request<{ message: string }>("/api/Auth/logout-all", {
      method: "POST",
      token
    });
  },

  getRates(token: string, params?: QueryParams) {
    return request<Rate[]>(`/api/rates${buildQuery(params)}`, { token });
  },

  getPublicRateCount() {
    return request<number>("/api/rates/count");
  },

  getRate(token: string, id: string) {
    return request<Rate>(`/api/rates/${id}`, { token });
  },

  getMarketAnalytics(token: string, params: { routeId: string; containerId: string; currency: string }) {
    return request<MarketAnalytics>(
      `/api/rates/market-analytics${buildQuery({
        RouteId: params.routeId,
        ContainerId: params.containerId,
        Currency: params.currency
      })}`,
      { token }
    );
  },

  getRateRecommendations(token: string, params: {
    routeId: string;
    containerTypeId: string;
    currency: string;
    maxPrice?: number;
    limit: number;
    priority: RecommendationPriority;
  }) {
    return request<RateRecommendationResponse>(
      `/api/rates/recommended${buildQuery({
        RouteId: params.routeId,
        ContainerTypeId: params.containerTypeId,
        Currency: params.currency,
        MaxPrice: params.maxPrice,
        Limit: params.limit,
        Priority: params.priority
      })}`,
      { method: "POST", token }
    );
  },

  createRate(token: string, body: {
    carrierId: string;
    routeId: string;
    containerTypeId: string;
    price: number;
    currency: string;
    validFrom: string;
    validTo: string;
    maxGrossWeightKg?: number;
    maxNetWeightKg?: number;
    maxVolumeCbm?: number;
    allowsHazardous?: boolean;
    minTemperatureCelsius?: number;
    maxTemperatureCelsius?: number;
  }) {
    return request<Rate>("/api/rates", { method: "POST", token, body });
  },

  updateRate(token: string, id: string, body: {
    price: number;
    currency: string;
    validFrom: string;
    validTo: string;
    maxGrossWeightKg?: number;
    maxNetWeightKg?: number;
    maxVolumeCbm?: number;
    allowsHazardous?: boolean;
    minTemperatureCelsius?: number;
    maxTemperatureCelsius?: number;
  }) {
    return request<Rate>(`/api/rates/${id}`, { method: "PUT", token, body });
  },

  deleteRate(token: string, id: string) {
    return request<{ message: string }>(`/api/rates/${id}`, { method: "DELETE", token });
  },

  toggleRate(token: string, id: string) {
    return request<{ message: string }>(`/api/rates/${id}/active`, { method: "PATCH", token });
  },

  getCarriers(params?: QueryParams) {
    return request<Carrier[]>(`/api/carriers${buildQuery(params)}`);
  },

  getCarrier(id: string) {
    return request<Carrier>(`/api/carriers/${id}`);
  },

  createCarrier(token: string, body: { name: string; code: string }) {
    return request<Carrier>("/api/carriers", { method: "POST", token, body });
  },

  updateCarrier(token: string, id: string, body: { name?: string; code?: string }) {
    return request<Carrier>(`/api/carriers/${id}`, { method: "PUT", token, body });
  },

  deleteCarrier(token: string, id: string) {
    return request<{ message: string }>(`/api/carriers/${id}`, { method: "DELETE", token });
  },

  getPorts(params?: QueryParams) {
    return request<Port[]>(`/api/ports${buildQuery(params)}`);
  },

  getPort(id: string) {
    return request<Port>(`/api/ports/${id}`);
  },

  getPortsByCountry(country: string, params?: QueryParams) {
    return request<Port[]>(`/api/ports/country${buildQuery({ ...params, country })}`);
  },

  createPort(token: string, body: { name: string; code: string; country: string }) {
    return request<Port>("/api/ports", { method: "POST", token, body });
  },

  updatePort(token: string, id: string, body: { name?: string; code?: string; country?: string }) {
    return request<Port>(`/api/ports/${id}`, { method: "PUT", token, body });
  },

  deletePort(token: string, id: string) {
    return request<{ message: string }>(`/api/ports/${id}`, { method: "DELETE", token });
  },

  getRoutes(params?: QueryParams) {
    return request<Route[]>(`/api/routes${buildQuery(params)}`);
  },

  getRoute(id: string) {
    return request<Route>(`/api/routes/${id}`);
  },

  getRoutesByFromPort(fromPortId: string, params?: QueryParams) {
    return request<Route[]>(`/api/routes/from-port/${fromPortId}${buildQuery(params)}`);
  },

  getRoutesByToPort(toPortId: string, params?: QueryParams) {
    return request<Route[]>(`/api/routes/to-port/${toPortId}${buildQuery(params)}`);
  },

  createRoute(token: string, body: { fromPortId: string; toPortId: string }) {
    return request<Route>("/api/routes", { method: "POST", token, body });
  },

  updateRoute(token: string, id: string, body: { fromPortId: string; toPortId: string }) {
    return request<Route>(`/api/routes/${id}`, { method: "PUT", token, body });
  },

  deleteRoute(token: string, id: string) {
    return request<{ message: string }>(`/api/routes/${id}`, { method: "DELETE", token });
  },

  getContainerTypes(params?: QueryParams) {
    return request<ContainerType[]>(`/api/container-types${buildQuery(params)}`);
  },

  getContainerType(id: string) {
    return request<ContainerType>(`/api/container-types/${id}`);
  },

  createContainerType(token: string, body: { name: string }) {
    return request<ContainerType>("/api/container-types", { method: "POST", token, body });
  },

  updateContainerType(token: string, id: string, body: { name: string }) {
    return request<ContainerType>(`/api/container-types/${id}`, { method: "PUT", token, body });
  },

  deleteContainerType(token: string, id: string) {
    return request<{ message: string }>(`/api/container-types/${id}`, { method: "DELETE", token });
  },

  getQuotes(token: string, params?: QueryParams) {
    return request<Quote[]>(`/api/quotes${buildQuery(params)}`, { token });
  },

  getMyQuotes(token: string, params?: QueryParams) {
    return request<Quote[]>(`/api/quotes/my${buildQuery(params)}`, { token });
  },

  getQuote(token: string, id: string) {
    return request<Quote>(`/api/quotes/${id}`, { token });
  },

  getQuotesByCustomer(token: string, customerName: string, params?: QueryParams) {
    return request<Quote[]>(`/api/quotes/customer/${encodeURIComponent(customerName)}${buildQuery(params)}`, { token });
  },

  getQuotesByRoute(token: string, routeId: string, params?: QueryParams) {
    return request<Quote[]>(`/api/quotes/route/${routeId}${buildQuery(params)}`, { token });
  },

  createQuote(token: string, body: {
    customerId: string;
    rateId: string;
    requestedGrossWeightKg: number;
    requestedNetWeightKg: number;
    requestedVolumeCbm: number;
    isHazardous: boolean;
    requiredTemperatureCelsius?: number;
  }) {
    return request<Quote>("/api/quotes", { method: "POST", token, body });
  },

  acceptQuote(token: string, id: string) {
    return request<Quote>(`/api/quotes/${id}/accept-from-user`, { method: "PATCH", token });
  },

  rejectQuote(token: string, id: string, reason: string) {
    return request<Quote>(`/api/quotes/${id}/rejected-from-user${buildQuery({ reason })}`, {
      method: "PATCH",
      token
    });
  },

  deleteQuote(token: string, id: string) {
    return request<{ message: string }>(`/api/quotes/${id}`, { method: "DELETE", token });
  },

  getQuoteRequests(token: string, params?: QueryParams) {
    return request<QuoteRequest[]>(`/api/QuoteRequest${buildQuery(params)}`, { token });
  },

  getMyQuoteRequests(token: string, params?: QueryParams) {
    return request<QuoteRequest[]>(`/api/QuoteRequest/my${buildQuery(params)}`, { token });
  },

  getQuoteRequest(token: string, id: string) {
    return request<QuoteRequest>(`/api/QuoteRequest/${id}`, { token });
  },

  createQuoteRequestFromRate(token: string, body: {
    rateId: string;
    requestedGrossWeightKg: number;
    requestedNetWeightKg: number;
    requestedVolumeCbm: number;
    isHazardous: boolean;
    requiredTemperatureCelsius?: number;
    notes?: string;
  }) {
    return request<QuoteRequest>("/api/QuoteRequest/from-rate", { method: "POST", token, body });
  },

  approveQuoteRequest(token: string, id: string) {
    return request<QuoteRequest>(`/api/QuoteRequest/${id}/approve`, { method: "PATCH", token });
  },

  rejectQuoteRequest(token: string, id: string, reason: string) {
    return request<QuoteRequest>(`/api/QuoteRequest/${id}/reject`, {
      method: "PATCH",
      token,
      body: { reason }
    });
  },

  cancelQuoteRequest(token: string, id: string) {
    return request<QuoteRequest>(`/api/QuoteRequest/${id}/cancel`, { method: "PATCH", token });
  },

  getCustomers(token: string, params?: QueryParams) {
    return request<Customer[]>(`/api/Customer${buildQuery(params)}`, { token });
  },

  getMyCustomer(token: string) {
    return request<Customer>("/api/Customer/me", { token });
  },

  createCustomer(token: string, body: {
    nationalId?: string;
    dateOfBirth?: string;
    companyName?: string;
    taxNumber?: string;
    countryCode?: string;
  }) {
    return request<Customer>("/api/Customer", { method: "POST", token, body });
  },

  updateCustomer(token: string, body: {
    nationalId?: string;
    dateOfBirth?: string;
    companyName?: string;
    taxNumber?: string;
    countryCode?: string;
  }) {
    return request<Customer>("/api/Customer", { method: "PUT", token, body });
  },

  deleteCustomer(token: string) {
    return request<string>("/api/Customer", { method: "DELETE", token });
  },

  getProfile(token: string) {
    return request<ProfileResponse>("/api/user/profile", { token });
  },

  updateProfile(token: string, body: {
    firstName?: string;
    lastName?: string;
    username?: string;
    email?: string;
    phoneNumber?: string;
  }) {
    return request<ProfileUpdateResponse>("/api/user/profile", {
      method: "PUT",
      token,
      body
    });
  },

  confirmProfileEmailChange(userId: string, token: string) {
    return request<ProfileUpdateResponse>(`/api/user/profile/confirm-email-change${buildQuery({ userId, token })}`);
  },

  updatePassword(token: string, body: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) {
    return request<{ success: boolean; message: string }>("/api/user/profile/password", {
      method: "PUT",
      token,
      body
    });
  },

  verifyPhoneChange(token: string, code: string) {
    return request<ProfileUpdateResponse>("/api/user/profile/verify-phone-change", {
      method: "POST",
      token,
      body: { code }
    });
  },

  getShipments(token: string, params?: QueryParams) {
    return request<Shipment[]>(`/api/Shipment${buildQuery(params)}`, { token });
  },

  getPublicShipmentCount() {
    return request<number>("/api/Shipment/Count");
  },

  getMyShipments(token: string, params?: QueryParams) {
    return request<Shipment[]>(`/api/Shipment/my${buildQuery(params)}`, { token });
  },

  getShipment(token: string, id: string) {
    return request<Shipment>(`/api/Shipment/${id}`, { token });
  },

  createShipment(token: string, quoteId: string) {
    return request<Shipment>("/api/Shipment", {
      method: "POST",
      token,
      body: { quoteId }
    });
  },

  updateShipment(token: string, id: string, body: Record<string, string | undefined>) {
    return request<Shipment>(`/api/Shipment/${id}`, {
      method: "PUT",
      token,
      body
    });
  },

  deleteShipment(token: string, id: string) {
    return request<string>(`/api/Shipment/${id}`, { method: "DELETE", token });
  },

  updateTracking(token: string, id: string, body: Record<string, string | undefined>) {
    return request<Shipment>(`/api/Shipment/${id}/tracking`, {
      method: "PUT",
      token,
      body
    });
  },

  shipmentAction(token: string, id: string, action: string, reason?: string) {
    return request<Shipment>(`/api/Shipment/${id}/${action}`, {
      method: "PATCH",
      token,
      body: { reason: reason?.trim() || null }
    });
  },

  getTimeline(token: string, id: string, params?: QueryParams) {
    return request<TimelineItem[]>(`/api/Shipment/${id}/timeline${buildQuery(params)}`, { token });
  },

  getShipmentHistory(token: string, id: string, params?: QueryParams) {
    return request<ShipmentHistory[]>(`/api/ShipmentStatusHistory/${id}${buildQuery(params)}`, { token });
  },

  getChargesByShipment(token: string, shipmentId: string) {
    return request<ShipmentCharge[]>(`/api/ShipmentCharge/shipment/${shipmentId}`, { token });
  },

  getCharge(token: string, id: string) {
    return request<ShipmentCharge>(`/api/ShipmentCharge/${id}`, { token });
  },

  generateCharges(token: string, shipmentId: string, options: { chargeType?: number; payerType?: number } = {}) {
    return request<ShipmentCharge[]>("/api/ShipmentCharge/generate", {
      method: "POST",
      token,
      body: {
        shipmentId,
        chargeType: options.chargeType ?? 0,
        payerType: options.payerType ?? 0
      }
    });
  },

  updateCharge(token: string, id: string, body: {
    description?: string;
    amount?: number;
    currency?: string;
    chargeType?: number;
    payerType?: number;
  }) {
    return request<ShipmentCharge>(`/api/ShipmentCharge/${id}`, { method: "PUT", token, body });
  },

  deleteCharge(token: string, id: string) {
    return request<string>(`/api/ShipmentCharge/${id}`, { method: "DELETE", token });
  },

  async getInvoice(token: string, id: string) {
    const invoice = await request<Invoice>(`/api/Invoice/${id}`, { token });
    return hydrateInvoicePayments(token, invoice);
  },

  async getInvoicesByShipment(token: string, shipmentId: string) {
    const invoices = await request<Invoice[]>(`/api/Invoice/shipment/${shipmentId}`, { token });
    return hydrateInvoicesPayments(token, invoices);
  },

  getInvoicePayments(token: string, invoiceId: string) {
    return request<InvoicePayment[]>(`/api/Invoice/payments/${invoiceId}`, { token });
  },

  createInvoice(token: string, shipmentId: string) {
    return request<Invoice>(`/api/Invoice/${shipmentId}`, { method: "POST", token });
  },

  async invoiceStatus(
    token: string,
    id: string,
    action: "mark-as-paid" | "mark-as-partially-paid" | "mark-as-refunded",
    payment?: InvoicePaymentRequest
  ) {
    const invoice = await request<Invoice>(`/api/Invoice/${id}/${action}`, {
      method: "PATCH",
      token,
      body: action === "mark-as-refunded" ? undefined : payment
    });
    return hydrateInvoicePayments(token, invoice);
  },

  async confirmInvoice(token: string, id: string) {
    const invoice = await request<Invoice>(`/api/Invoice/${id}/confirm`, {
      method: "PATCH",
      token
    });
    return hydrateInvoicePayments(token, invoice);
  },

  async cancelInvoice(token: string, id: string, reason: string) {
    const invoice = await request<Invoice>(`/api/Invoice/${id}/cancel`, {
      method: "PATCH",
      token,
      body: { reason }
    });
    return hydrateInvoicePayments(token, invoice);
  },

  deleteInvoice(token: string, id: string) {
    return request<string>(`/api/Invoice/${id}`, { method: "DELETE", token });
  },

  startPayment(token: string, body: { invoiceId: string }) {
    return request<StartPaymentResponse>("/api/Payment/start", { method: "POST", token, body });
  },

  checkoutPayment(token: string, paymentTransactionId: string) {
    return request<CheckoutPaymentResponse>(`/api/Payment/checkout${buildQuery({ paymentTransactionId })}`, {
      method: "POST",
      token
    });
  },

  getPaymentTransaction(token: string, id: string) {
    return request<PaymentTransaction>(`/api/Payment/${id}`, { token });
  },

  cancelPayment(token: string, paymentTransactionId: string) {
    return request<void>(`/api/Payment/cancel${buildQuery({ paymentTransactionId })}`, {
      method: "POST",
      token
    });
  },

  getDocument(token: string, id: string) {
    return request<ShipmentDocument>(`/api/ShipmentDocument/${id}`, { token });
  },

  getDocuments(token: string, shipmentId: string) {
    return request<ShipmentDocument[]>(`/api/ShipmentDocument/shipment/${shipmentId}`, { token });
  },

  uploadDocument(token: string, shipmentId: string, formData: FormData) {
    return request<ShipmentDocument>(`/api/ShipmentDocument/shipment/${shipmentId}`, {
      method: "POST",
      token,
      body: formData
    });
  },

  deleteDocument(token: string, id: string) {
    return request<string>(`/api/ShipmentDocument/${id}`, { method: "DELETE", token });
  },

  getShipmentItems(token: string, shipmentId: string) {
    return request<ShipmentItem[]>(`/api/ShipmentItem/shipment/${shipmentId}`, { token });
  },

  getShipmentItem(token: string, id: string) {
    return request<ShipmentItem>(`/api/ShipmentItem/${id}`, { token });
  },

  createShipmentItem(token: string, body: {
    shipmentId: string;
    description: string;
    quantity: number;
    grossWeight: number;
    netWeight: number;
    volumeCbm: number;
    isHazardous: boolean;
    requiredTemperatureCelsius?: number;
    marksAndNumbers?: string;
  }) {
    return request<ShipmentItem>("/api/ShipmentItem", { method: "POST", token, body });
  },

  updateShipmentItem(token: string, id: string, body: {
    shipmentId?: string;
    description?: string;
    quantity?: number;
    grossWeight?: number;
    netWeight?: number;
    volumeCbm?: number;
    isHazardous?: boolean;
    requiredTemperatureCelsius?: number;
    marksAndNumbers?: string;
  }) {
    return request<ShipmentItem>(`/api/ShipmentItem/${id}`, { method: "PUT", token, body });
  },

  deleteShipmentItem(token: string, id: string) {
    return request<string>(`/api/ShipmentItem/${id}`, { method: "DELETE", token });
  }
};
