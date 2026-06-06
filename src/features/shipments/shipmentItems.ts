import type { Invoice, ShipmentItem, ShipmentItemDraft } from "../../types";

const CBM_TO_KG_FACTOR = 167;

const itemLockedStatuses = new Set([
  "ShippingInstructionsSubmitted",
  "PaymentCompleted",
  "TelexReleased",
  "Delivered",
  "Closed",
  "Cancelled"
]);

const invoicedPaymentStatuses = new Set(["partiallypaid", "paid"]);

function normalizeStatus(value?: string | null) {
  return String(value ?? "").replace(/[\s_-]+/g, "").toLowerCase();
}

function toTimestamp(value?: string | null) {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : Number.NaN;
}

function latestTimestamp(values: Array<string | null | undefined>) {
  const timestamps = values.map(toTimestamp).filter(Number.isFinite);
  return timestamps.length > 0 ? Math.max(...timestamps) : Number.NaN;
}

function getInvoiceBillingTimestamp(invoice: Invoice) {
  if (!invoicedPaymentStatuses.has(normalizeStatus(invoice.paymentStatus))) return Number.NaN;

  return latestTimestamp([invoice.issuedAt, ...(invoice.charges ?? []).map((charge) => charge.createdAt)]);
}

export function getUnbilledShipmentItems(items: ShipmentItem[], invoices: Invoice[]) {
  const billingTimestamps = invoices.map(getInvoiceBillingTimestamp).filter(Number.isFinite);
  if (billingTimestamps.length === 0) return items;

  const latestBillingTimestamp = Math.max(...billingTimestamps);
  return items.filter((item) => {
    // An edit must not turn an item from an issued invoice into new billable cargo.
    const itemTimestamp = toTimestamp(item.createdAt);
    return Number.isFinite(itemTimestamp) && itemTimestamp > latestBillingTimestamp;
  });
}

export function emptyShipmentItemDraft(): ShipmentItemDraft {
  return {
    description: "",
    quantity: "1",
    grossWeight: "1",
    netWeight: "1",
    volumeCbm: "0",
    isHazardous: false,
    requiredTemperatureCelsius: "",
    marksAndNumbers: ""
  };
}

export function shipmentItemToDraft(item: ShipmentItem): ShipmentItemDraft {
  return {
    description: item.description,
    quantity: String(item.quantity),
    grossWeight: String(item.grossWeight),
    netWeight: String(item.netWeight),
    volumeCbm: String(item.volumeCbm),
    isHazardous: item.isHazardous,
    requiredTemperatureCelsius: item.requiredTemperatureCelsius != null ? String(item.requiredTemperatureCelsius) : "",
    marksAndNumbers: item.marksAndNumbers ?? ""
  };
}

export function canModifyShipmentItems(status?: string) {
  return Boolean(status && !itemLockedStatuses.has(status));
}

export function estimateChargeableWeight(grossWeightKg: number, volumeCbm: number) {
  return Math.max(grossWeightKg, volumeCbm * CBM_TO_KG_FACTOR);
}

function readDraftNumber(value: string) {
  return value.trim() === "" ? Number.NaN : Number(value);
}

export function buildShipmentItemPayload(draft: ShipmentItemDraft, shipmentId: string) {
  const description = draft.description.trim();
  const quantity = readDraftNumber(draft.quantity);
  const grossWeight = readDraftNumber(draft.grossWeight);
  const netWeight = readDraftNumber(draft.netWeight);
  const volumeCbm = readDraftNumber(draft.volumeCbm);
  const requiredTemperatureCelsius = draft.requiredTemperatureCelsius.trim()
    ? readDraftNumber(draft.requiredTemperatureCelsius)
    : undefined;

  if (!description) return { error: "Description is required." };
  if (!Number.isInteger(quantity) || quantity <= 0) return { error: "Quantity must be a whole number greater than 0." };
  if (!Number.isFinite(grossWeight) || grossWeight <= 0) return { error: "Gross weight must be greater than 0." };
  if (!Number.isFinite(netWeight) || netWeight <= 0) return { error: "Net weight must be greater than 0." };
  if (!Number.isFinite(volumeCbm) || volumeCbm < 0) return { error: "Volume cannot be negative." };
  if (grossWeight < netWeight) return { error: "Gross weight must be greater than or equal to net weight." };
  if (
    requiredTemperatureCelsius !== undefined &&
    (!Number.isFinite(requiredTemperatureCelsius) || requiredTemperatureCelsius < -50 || requiredTemperatureCelsius > 50)
  ) {
    return { error: "Required temperature must be between -50 and 50." };
  }

  return {
    payload: {
      shipmentId,
      description,
      quantity,
      grossWeight,
      netWeight,
      volumeCbm,
      isHazardous: draft.isHazardous,
      requiredTemperatureCelsius,
      marksAndNumbers: draft.marksAndNumbers.trim() || undefined
    }
  };
}
