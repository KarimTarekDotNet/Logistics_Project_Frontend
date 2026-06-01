import type { Shipment, ShipmentCharge } from "../../types";

function normalizeChargeKey(value?: string | null) {
  return String(value ?? "").replace(/[\s_-]+/g, "").toLowerCase();
}

export function isBaseFreightCharge(charge: ShipmentCharge, shipment?: Shipment) {
  const chargeType = normalizeChargeKey(charge.chargeType);
  if (chargeType !== "oceanfreight") return false;

  const description = String(charge.description ?? "").toLowerCase();
  const looksLikeQuoteCharge = description.includes("quote");
  const matchesAgreedPrice =
    typeof shipment?.agreedPrice === "number" && Math.abs(Number(charge.amount) - shipment.agreedPrice) < 0.01;

  return looksLikeQuoteCharge || matchesAgreedPrice;
}

export function getWorkflowCharges(charges: ShipmentCharge[], shipment?: Shipment) {
  return charges.filter((charge) => !isBaseFreightCharge(charge, shipment));
}
