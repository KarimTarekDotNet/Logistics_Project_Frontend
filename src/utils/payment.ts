import { getAppPathname } from "./navigation";
import type { StartPaymentResponse } from "../types";

export const PAYMENT_RETURN_PATH = "/payment/return";

const PENDING_CARD_PAYMENT_KEY = "flowtix:pending-card-payment";

export type PendingCardPayment = {
  transactionId: string;
  invoiceId: string;
  shipmentId?: string;
  createdAt: string;
};

export type PaymentReturnDetails = {
  success: boolean | null;
  pending: boolean | null;
  status: string;
  transactionReference: string;
  orderReference: string;
};

function readBooleanParam(params: URLSearchParams, names: string[]) {
  for (const name of names) {
    const value = params.get(name);
    if (value == null) continue;

    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "0", "no", "n"].includes(normalized)) return false;
  }

  return null;
}

function getStringEnv(name: string) {
  const env = import.meta.env as Record<string, string | undefined>;
  return (env[name] ?? "").trim();
}

function createUrl(path: string) {
  return new URL(path || PAYMENT_RETURN_PATH, window.location.origin);
}

export function isPaymentReturnPath(path: string) {
  const url = createUrl(path);
  return getAppPathname(url.pathname).toLowerCase() === PAYMENT_RETURN_PATH;
}

export function readPaymentReturn(path: string): PaymentReturnDetails | null {
  if (!isPaymentReturnPath(path)) return null;

  const params = createUrl(path).searchParams;
  return {
    success: readBooleanParam(params, ["success", "is_success", "isSuccess"]),
    pending: readBooleanParam(params, ["pending", "is_pending", "isPending"]),
    status: params.get("status") ?? params.get("txn_response_code") ?? "",
    transactionReference: params.get("id") ?? params.get("transaction_id") ?? params.get("transactionId") ?? "",
    orderReference: params.get("order") ?? params.get("order_id") ?? params.get("orderId") ?? ""
  };
}

function getPaymobPublicKey() {
  return getStringEnv("VITE_PAYMOB_PUBLIC_KEY");
}

function getPaymobCheckoutBaseUrl() {
  const configuredBaseUrl =
    getStringEnv("VITE_PAYMOB_CHECKOUT_BASE_URL") ||
    getStringEnv("VITE_PAYMOB_BASE_URL");
  if (!configuredBaseUrl) return "";
  return configuredBaseUrl.replace(/\/+$/, "").replace(/\/api$/i, "");
}

function buildPaymobCheckoutUrl(clientSecret: string) {
  const publicKey = getPaymobPublicKey();
  if (!publicKey) return "";

  const baseUrl = getPaymobCheckoutBaseUrl();
  if (!baseUrl) return "";
  const checkoutUrl = /\/unifiedcheckout$/i.test(baseUrl)
    ? new URL(`${baseUrl}/`)
    : new URL("unifiedcheckout/", `${baseUrl}/`);

  checkoutUrl.searchParams.set("publicKey", publicKey);
  checkoutUrl.searchParams.set("clientSecret", clientSecret);
  return checkoutUrl.toString();
}

function normalizeCheckoutUrl(rawUrl: string) {
  if (!rawUrl.trim()) return "";

  try {
    const url = new URL(rawUrl, window.location.origin);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

export function resolvePaymentCheckoutUrl(payment: StartPaymentResponse) {
  const rawUrl = payment.checkoutUrl || payment.redirectUrl || payment.paymentUrl || payment.url || "";
  const checkoutUrl = normalizeCheckoutUrl(rawUrl);
  if (checkoutUrl) return checkoutUrl;

  return payment.clientSecret ? buildPaymobCheckoutUrl(payment.clientSecret) : "";
}

export function savePendingCardPayment(payment: PendingCardPayment) {
  sessionStorage.setItem(PENDING_CARD_PAYMENT_KEY, JSON.stringify(payment));
}

export function loadPendingCardPayment() {
  const raw = sessionStorage.getItem(PENDING_CARD_PAYMENT_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<PendingCardPayment>;
    if (!parsed.transactionId || !parsed.invoiceId) return null;

    return {
      transactionId: parsed.transactionId,
      invoiceId: parsed.invoiceId,
      shipmentId: parsed.shipmentId,
      createdAt: parsed.createdAt || new Date().toISOString()
    } satisfies PendingCardPayment;
  } catch {
    return null;
  }
}

export function clearPendingCardPayment() {
  sessionStorage.removeItem(PENDING_CARD_PAYMENT_KEY);
}
