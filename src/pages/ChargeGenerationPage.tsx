import { Calculator, CircleDollarSign, PackageCheck, Pencil, ReceiptText } from "lucide-react";
import { EmptyState, PanelTitle, SectionHeader } from "../components/ui";
import { ShipmentContextPanel } from "../features/shipments/ShipmentContextPanel";
import { getWorkflowCharges } from "../features/shipments/shipmentCharges";
import type { Shipment, ShipmentCharge } from "../types";
import { formatMoney } from "../utils/format";

export function ChargeGenerationPage(props: {
  selectedShipment?: Shipment;
  charges: ShipmentCharge[];
  busy: boolean;
  onGenerate: () => void;
  onCreateInvoice: () => void;
  onUpdateItems: () => void;
}) {
  const { selectedShipment, charges, busy, onGenerate, onCreateInvoice, onUpdateItems } = props;
  const workflowCharges = getWorkflowCharges(charges, selectedShipment);
  const chargeTotal = workflowCharges.reduce((total, charge) => total + charge.amount + charge.taxAmount, 0);
  const hasCharges = workflowCharges.length > 0;

  return (
    <div className="view-stack workflow-page">
      <SectionHeader icon={<Calculator size={22} />} title="Charge generation" meta={selectedShipment ? "Shipment charge cycle" : "No shipment"} />

      {selectedShipment ? (
        <>
          <ShipmentContextPanel
            shipment={selectedShipment}
            extra={[
              { label: "Current charges", value: String(workflowCharges.length) },
              { label: "Charge total", value: formatMoney(chargeTotal, selectedShipment.currency) }
            ]}
          />

          <section className="workflow-center-panel">
            <div className="workflow-center-copy">
              <span className="workflow-step-mark">2</span>
              <h2>{hasCharges ? "Create invoice from charges" : "Generate shipment charges"}</h2>
              <p>
                {hasCharges
                  ? "Saved shipment charges are loaded. Review them, then create the draft invoice for confirmation."
                  : "Charges are calculated from the active rules for this shipment currency, cargo totals, volume, and agreed value."}
              </p>
            </div>
            <button
              className="primary-button workflow-primary-action"
              type="button"
              onClick={hasCharges ? onCreateInvoice : onGenerate}
              disabled={busy}
            >
              {hasCharges ? <ReceiptText size={22} /> : <Calculator size={22} />}
              {hasCharges ? "Create invoice" : "Generate"}
            </button>
            <button className="secondary-button compact" type="button" onClick={onUpdateItems} disabled={busy}>
              <Pencil size={16} />
              Update items
            </button>
          </section>

          <section className="panel">
            <PanelTitle icon={<CircleDollarSign size={18} />} title="Charges preview" />
            <div className="compact-list">
              {workflowCharges.map((charge) => (
                <div className="list-row" key={charge.id}>
                  <div>
                    <strong>{charge.description}</strong>
                    <small>
                      {charge.chargeType} - {charge.payerType}
                    </small>
                  </div>
                  <span>{formatMoney(charge.amount + charge.taxAmount, charge.currency)}</span>
                </div>
              ))}
              {workflowCharges.length === 0 && <EmptyState icon={<PackageCheck size={24} />} title="No charges generated yet" />}
            </div>
          </section>
        </>
      ) : (
        <EmptyState icon={<Calculator size={28} />} title="No shipment selected" />
      )}
    </div>
  );
}
