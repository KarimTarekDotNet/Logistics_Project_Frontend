import { CURRENCY_SYMBOL, DEFAULT_CURRENCY } from "../constants/logistics";

export function getLocalDateTime(daysFromNow = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export function toIso(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

export function isoToLocalDateTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export function normalizeDateOnly(value?: string) {
  if (!value) return "";
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "";

  const normalized = `${match[1]}-${match[2]}-${match[3]}`;
  const date = new Date(`${normalized}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) return "";
  return normalized;
}

export function formatDate(value?: string) {
  if (!value) return "Pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Pending";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function formatShortDate(value?: string) {
  if (!value) return "Pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Pending";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric"
  }).format(date);
}

export function formatMoney(value: number, _currency = DEFAULT_CURRENCY) {
  const displayCurrency = DEFAULT_CURRENCY;

  try {
    return new Intl.NumberFormat("en-EG", {
      style: "currency",
      currency: displayCurrency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 2
    }).format(value);
  } catch {
    return `${CURRENCY_SYMBOL}${value.toLocaleString("en-EG", { maximumFractionDigits: 2 })}`;
  }
}

const quoteStatuses = ["Pending", "Accepted", "Rejected"];
const quoteRequestStatuses = ["Pending Review", "Approved", "Rejected", "Cancelled"];

export function statusText(status: string | number, group?: "quote" | "quoteRequest") {
  if (typeof status === "number") {
    const labels = group === "quoteRequest" ? quoteRequestStatuses : quoteStatuses;
    return labels[status] ?? String(status);
  }

  return status;
}

export function compactStatus(status: string | number, group?: "quote" | "quoteRequest") {
  return statusText(status, group)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace("BL", "B/L")
    .replace(/\s+/g, " ")
    .trim();
}
