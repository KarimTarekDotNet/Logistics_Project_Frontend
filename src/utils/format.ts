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

export function formatMoney(value: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(value);
  } catch {
    return `${value.toLocaleString()} ${currency}`;
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
