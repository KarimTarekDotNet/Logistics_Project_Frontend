import type { ShipmentItem, ShipmentItemDraft } from "../../types";

const CBM_TO_KG_FACTOR = 167;

const itemLockedStatuses = new Set([
  "ShippingInstructionsSubmitted",
  "PaymentCompleted",
  "TelexReleased",
  "Delivered",
  "Closed",
  "Cancelled"
]);

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
