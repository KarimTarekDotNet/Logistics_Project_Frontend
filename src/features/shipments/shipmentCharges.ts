import type { Shipment, ShipmentCharge } from "../../types";

function normalizeChargeKey(value?: string | null) {
  return String(value ?? "").replace(/[\s_-]+/g, "").toLowerCase();
}

export function isBaseFreightCharge(charge: ShipmentCharge, shipment?: Shipment) {
  const chargeType = normalizeChargeKey(charge.chargeType);
  if (chargeType !== "oceanfreight") return false;

  const description = String(charge.description ?? "").toLowerCase();
  return description.includes("quote");
}

export function getWorkflowCharges(charges: ShipmentCharge[], shipment?: Shipment) {
  return charges.filter((charge) => !isBaseFreightCharge(charge, shipment));
}

export function getUninvoicedWorkflowCharges(charges: ShipmentCharge[], shipment?: Shipment) {
  return getWorkflowCharges(charges, shipment).filter((charge) => !charge.invoiceId);
}

export function getInvoiceCycleCharges(charges: ShipmentCharge[], invoiceId: string, shipment?: Shipment) {
  return getWorkflowCharges(charges, shipment).filter(
    (charge) => !charge.invoiceId || charge.invoiceId === invoiceId
  );
}
