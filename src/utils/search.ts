export function includesSearch(values: Array<string | number | undefined | null>, search: string) {
  const term = search.trim().slice(0, 100).toLowerCase();
  if (!term) return true;
  return values.some((value) => String(value ?? "").toLowerCase().includes(term));
}

export function statusClass(status: string | number) {
  const normalized = String(status).toLowerCase();
  if (normalized.includes("cancel") || normalized.includes("failed") || normalized.includes("refund")) return "danger";
  if (normalized.includes("hold") || normalized.includes("pending") || normalized.includes("partial") || normalized.includes("overdue")) {
    return "warning";
  }
  if (
    normalized.includes("active") ||
    normalized.includes("delivered") ||
    normalized.includes("closed") ||
    normalized.includes("completed") ||
    normalized.includes("paid") ||
    normalized.includes("success") ||
    normalized.includes("ready")
  ) {
    return "success";
  }
  return "info";
}

export function sortByText<T>(items: T[], getValue: (item: T) => string | number | undefined, direction: "asc" | "desc" = "asc") {
  return [...items].sort((a, b) => {
    const left = String(getValue(a) ?? "").toLowerCase();
    const right = String(getValue(b) ?? "").toLowerCase();
    const result = left.localeCompare(right, undefined, { numeric: true });
    return direction === "asc" ? result : -result;
  });
}
