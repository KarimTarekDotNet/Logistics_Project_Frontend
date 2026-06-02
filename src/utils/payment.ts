import { getAppPathname } from "./navigation";

export const PAYMENT_RETURN_PATH = "/payment/return";
export const CREDIT_CARD_PAYMENT_METHOD = 2;

const PENDING_CARD_PAYMENT_KEY = "flowtix:pending-card-payment";
const DEFAULT_PAYMOB_PUBLIC_KEY = "egy_pk_test_eLDXTq0OZWONrQei68RthkxvvbFviDpX";
const DEFAULT_PAYMOB_BASE_URL = "https://accept.paymob.com/api";

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

function getStringEnv(name: string) {
  const env = import.meta.env as Record<string, string | undefined>;
  return (env[name] ?? "").trim();
}

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

export function getPaymobPublicKey() {
  return getStringEnv("VITE_PAYMOB_PUBLIC_KEY") || DEFAULT_PAYMOB_PUBLIC_KEY;
}

export function getPaymobCheckoutConfigError() {
  if (!getPaymobPublicKey()) {
    return "Paymob public key is missing. Add VITE_PAYMOB_PUBLIC_KEY before starting card checkout.";
  }

  return "";
}

function getPaymobCheckoutBaseUrl() {
  const configuredBaseUrl =
    getStringEnv("VITE_PAYMOB_CHECKOUT_BASE_URL") ||
    getStringEnv("VITE_PAYMOB_BASE_URL") ||
    DEFAULT_PAYMOB_BASE_URL;
  const normalizedBaseUrl = configuredBaseUrl.replace(/\/+$/, "");

  return normalizedBaseUrl.replace(/\/api$/i, "");
}

export function buildPaymobCheckoutUrl(clientSecret: string) {
  const publicKey = getPaymobPublicKey();
  const baseUrl = getPaymobCheckoutBaseUrl();
  const checkoutUrl = /\/unifiedcheckout$/i.test(baseUrl)
    ? new URL(`${baseUrl}/`)
    : new URL("unifiedcheckout/", `${baseUrl}/`);

  checkoutUrl.searchParams.set("publicKey", publicKey);
  checkoutUrl.searchParams.set("clientSecret", clientSecret);
  return checkoutUrl.toString();
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
