import { CheckCircle2, FileText, Pencil, ReceiptText, XCircle } from "lucide-react";
import { EmptyState, MetricLine, PanelTitle, SectionHeader, StatusBadge } from "../components/ui";
import { DEFAULT_CURRENCY } from "../constants/logistics";
import { ShipmentContextPanel } from "../features/shipments/ShipmentContextPanel";
import type { Invoice, Shipment, ShipmentCharge } from "../types";
import { formatDate, formatMoney } from "../utils/format";

export function InvoiceReviewPage(props: {
  selectedShipment?: Shipment;
  invoice?: Invoice | null;
  charges: ShipmentCharge[];
  busy: boolean;
  canUpdateItems: boolean;
  onConfirm: (id: string) => void;
  onCancel: (invoice: Invoice) => void;
  onUpdateItems: () => void;
}) {
  const { selectedShipment, invoice, charges, busy, canUpdateItems, onConfirm, onCancel, onUpdateItems } = props;
  const visibleCharges = invoice?.charges?.length ? invoice.charges : charges;
  const invoiceTotal =
    invoice?.totalAmount ?? visibleCharges.reduce((total, charge) => total + charge.amount + charge.taxAmount, 0);
  const currency = DEFAULT_CURRENCY;
  const canConfirm = Boolean(invoice && String(invoice.paymentStatus).toLowerCase() === "draft");

  return (
    <div className="view-stack workflow-page">
      <SectionHeader icon={<ReceiptText size={22} />} title="Invoice review" meta={invoice ? "Draft invoice" : "No invoice"} />

      {selectedShipment ? (
        <>
          <ShipmentContextPanel shipment={selectedShipment} extra={[{ label: "Invoice total", value: formatMoney(invoiceTotal, currency) }]} />

          {invoice ? (
            <section className="panel invoice-review-panel">
              <div className="panel-title-row">
                <PanelTitle icon={<FileText size={18} />} title={invoice.invoiceNumber} />
                <StatusBadge status={invoice.paymentStatus} />
              </div>

              <div className="invoice-review-grid">
                <MetricLine label="Subtotal" value={formatMoney(invoice.subTotal, invoice.currency)} />
                <MetricLine label="Tax" value={formatMoney(invoice.taxAmount, invoice.currency)} />
                <MetricLine label="Total" value={formatMoney(invoice.totalAmount, invoice.currency)} />
                <MetricLine label="Due" value={formatDate(invoice.dueDate)} />
              </div>

              <div className="invoice-charge-list">
                {visibleCharges.map((charge) => (
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
              </div>

              <div className="workflow-actions">
                <button className="primary-button" type="button" disabled={busy || !canConfirm} onClick={() => onConfirm(invoice.id)}>
                  <CheckCircle2 size={18} />
                  Confirm
                </button>
                {canUpdateItems && (
                  <button className="secondary-button" type="button" disabled={busy} onClick={onUpdateItems}>
                    <Pencil size={17} />
                    Update
                  </button>
                )}
                <button className="danger-button subtle" type="button" disabled={busy || !canConfirm} onClick={() => onCancel(invoice)}>
                  <XCircle size={17} />
                  Cancel
                </button>
              </div>
            </section>
          ) : (
            <EmptyState icon={<FileText size={28} />} title="Invoice is not ready yet" />
          )}
        </>
      ) : (
        <EmptyState icon={<ReceiptText size={28} />} title="No shipment selected" />
      )}
    </div>
  );
}
