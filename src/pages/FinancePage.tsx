import { Banknote, CreditCard, FileText, Plus, ReceiptText, RotateCcw, Trash2, WalletCards } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ConfirmDialog, EmptyState, Field, PanelTitle, SectionHeader, StatusBadge } from "../components/ui";
import { ShipmentContextPanel } from "../features/shipments/ShipmentContextPanel";
import type { Invoice, InvoicePaymentRequest, Shipment, ShipmentCharge } from "../types";
import { formatDate, formatMoney } from "../utils/format";

type InvoiceStatusAction = "mark-as-paid" | "mark-as-partially-paid" | "mark-as-refunded";

export function FinancePage(props: {
  selectedShipment?: Shipment;
  charges: ShipmentCharge[];
  invoices: Invoice[];
  isPrivileged: boolean;
  isAdmin: boolean;
  busy: boolean;
  onCreateInvoice: (event: FormEvent) => void;
  onLoadInvoices: () => void;
  onInvoiceStatus: (id: string, action: InvoiceStatusAction, payment?: InvoicePaymentRequest) => void;
  onCancelInvoice: (id: string, reason: string) => void;
  onDeleteInvoice: (id: string) => void;
}) {
  const {
    selectedShipment,
    charges,
    invoices,
    isPrivileged,
    isAdmin,
    busy,
    onCreateInvoice,
    onLoadInvoices,
    onInvoiceStatus,
    onCancelInvoice,
    onDeleteInvoice
  } = props;
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>({});
  const [paymentReferences, setPaymentReferences] = useState<Record<string, string>>({});
  const [deleteInvoiceId, setDeleteInvoiceId] = useState<string | null>(null);
  const [cancelInvoiceId, setCancelInvoiceId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("Cancelled from operations console");

  const chargeTotal = charges.reduce((total, charge) => total + charge.amount + charge.taxAmount, 0);

  function resolveInvoiceBalance(invoice: Invoice) {
    const explicitRemaining =
      invoice.remainingAmount ?? invoice.remainingBalance ?? invoice.amountDue ?? invoice.balanceDue;
    const total = Math.max(0, Number(invoice.totalAmount ?? 0));
    const normalizedRemaining = explicitRemaining != null ? Math.max(0, Number(explicitRemaining)) : null;
    const inferredPaidPart =
      invoice.paidPart != null
        ? Number(invoice.paidPart)
        : normalizedRemaining != null
          ? total - normalizedRemaining
          : 0;
    const status = normalizePaymentStatus(invoice.paymentStatus);
    const isPaid = status === "paid" || (status.includes("paid") && !status.includes("partial"));
    const paidPart = isPaid ? total : Math.min(total, Math.max(0, inferredPaidPart));
    const shouldComputeRemaining = paidPart > 0 || isPaid || normalizedRemaining == null;
    const remaining =
      shouldComputeRemaining ? (isPaid ? 0 : Math.max(0, total - paidPart)) : normalizedRemaining;

    return { total, paidPart, remaining, hasPartialPayment: paidPart > 0 && remaining > 0 && remaining < total };
  }

  function normalizePaymentStatus(status: string) {
    return status.replace(/\s+/g, "").toLowerCase();
  }

  function buildManualPayment(invoice: Invoice, amount: number): InvoicePaymentRequest {
    const referenceNumber = paymentReferences[invoice.id]?.trim().slice(0, 80);

    return {
      amount: Number(amount.toFixed(2)),
      currency: invoice.currency,
      ...(referenceNumber ? { referenceNumber } : {})
    };
  }

  const invoiceCurrency = invoices[0]?.currency ?? selectedShipment?.currency ?? "USD";
  const invoiceSummary = invoices.reduce(
    (summary, invoice) => {
      const balance = resolveInvoiceBalance(invoice);
      const status = normalizePaymentStatus(invoice.paymentStatus);

      return {
        total: summary.total + balance.total,
        paid: summary.paid + (status === "paid" ? balance.total : balance.paidPart),
        remaining: summary.remaining + balance.remaining,
        actionable: summary.actionable + (status === "pending" || status === "partiallypaid" ? 1 : 0),
        drafts: summary.drafts + (status === "draft" ? 1 : 0),
        settled: summary.settled + (status === "paid" ? 1 : 0),
        exceptions: summary.exceptions + (status === "cancelled" || status === "refunded" ? 1 : 0)
      };
    },
    { total: 0, paid: 0, remaining: 0, actionable: 0, drafts: 0, settled: 0, exceptions: 0 }
  );
  const collectionRatio = invoiceSummary.total > 0 ? Math.round((invoiceSummary.paid / invoiceSummary.total) * 100) : 0;
  const chargeCoverageRatio = chargeTotal > 0 ? Math.min(100, Math.round((invoiceSummary.total / chargeTotal) * 100)) : 0;

  return (
    <div className="view-stack">
      <SectionHeader icon={<WalletCards size={22} />} title="Finance" meta={selectedShipment ? "Shipment finance" : "No shipment"} />

      {selectedShipment ? (
        <>
          <ShipmentContextPanel
            shipment={selectedShipment}
            extra={[
              { label: "Invoices", value: String(invoices.length) },
              { label: "Outstanding", value: formatMoney(invoiceSummary.remaining, invoiceCurrency) }
            ]}
          />

          <section className="panel finance-invoices-panel">
            <div className="panel-title-row">
              <PanelTitle icon={<FileText size={18} />} title="Invoices" />
              <button className="mini-button" type="button" onClick={onLoadInvoices} disabled={busy}>
                Load
              </button>
            </div>

            <div className="payment-overview-grid">
              <div>
                <span>Total invoices</span>
                <strong>{formatMoney(invoiceSummary.total, invoiceCurrency)}</strong>
              </div>
              <div>
                <span>Collected</span>
                <strong>{formatMoney(invoiceSummary.paid, invoiceCurrency)}</strong>
              </div>
              <div>
                <span>Outstanding</span>
                <strong>{formatMoney(invoiceSummary.remaining, invoiceCurrency)}</strong>
              </div>
              <div>
                <span>Payable</span>
                <strong>{invoiceSummary.actionable}</strong>
              </div>
            </div>

            <div className="finance-signal-grid">
              <div>
                <span>Collection health</span>
                <strong>{collectionRatio}%</strong>
                <small>Paid value against issued invoices</small>
                <div className="signal-meter" aria-hidden="true">
                  <i style={{ width: `${collectionRatio}%` }} />
                </div>
              </div>
              <div>
                <span>Charge coverage</span>
                <strong>{chargeCoverageRatio}%</strong>
                <small>Invoice value against loaded charges</small>
                <div className="signal-meter" aria-hidden="true">
                  <i style={{ width: `${chargeCoverageRatio}%` }} />
                </div>
              </div>
              <div>
                <span>Control queue</span>
                <strong>{invoiceSummary.drafts + invoiceSummary.actionable}</strong>
                <small>{invoiceSummary.drafts} drafts / {invoiceSummary.actionable} payment actions</small>
              </div>
              <div>
                <span>Exceptions</span>
                <strong>{invoiceSummary.exceptions}</strong>
                <small>Cancelled or refunded invoices</small>
              </div>
            </div>

            {isPrivileged && (
              <form className="form-stack" onSubmit={onCreateInvoice}>
                <div className="invoice-draft-summary">
                  <span>{charges.length > 0 ? "Ready to draft" : "No billing lines"}</span>
                  <strong>{formatMoney(chargeTotal, selectedShipment.currency)}</strong>
                </div>
                <button className="primary-button compact" type="submit" disabled={busy || charges.length === 0}>
                  <Plus size={17} />
                  Create draft invoice
                </button>
              </form>
            )}

            <div className="compact-list invoice-list">
              {invoices.map((invoice) => {
                const balance = resolveInvoiceBalance(invoice);
                const status = normalizePaymentStatus(invoice.paymentStatus);
                const isDraft = status === "draft";
                const isPending = status === "pending";
                const isCancelled = status === "cancelled";
                const isRefunded = status === "refunded";
                const isPaid = status === "paid";
                const isPartiallyPaid = status === "partiallypaid";
                const canPay = isPrivileged && (isPending || isPartiallyPaid) && !isPaid && !isCancelled && !isRefunded && balance.remaining > 0;
                const canRefund = isPrivileged && (isPaid || isPartiallyPaid) && !isCancelled && !isRefunded;
                const canCancel = (isDraft || isPending) && !isPaid && !isPartiallyPaid && !isCancelled && !isRefunded;
                const paymentAmount = Number(paymentAmounts[invoice.id] ?? "");
                const paymentCents = Math.round(paymentAmount * 100);
                const remainingCents = Math.round(balance.remaining * 100);
                const canRecordPayment = canPay && paymentCents > 0 && paymentCents <= remainingCents;
                const paymentAction: InvoiceStatusAction =
                  paymentCents >= remainingCents ? "mark-as-paid" : "mark-as-partially-paid";
                const paymentLabel = isPaid
                  ? "Settled"
                  : isPartiallyPaid
                    ? "Part paid"
                    : isDraft
                      ? "Draft"
                      : isCancelled
                        ? "Cancelled"
                        : isRefunded
                          ? "Refunded"
                          : "Payment due";

                return (
                  <div className="invoice-row payment-card" key={invoice.id}>
                    <div className="invoice-card-head">
                      <div className="invoice-title-block">
                        <span className="invoice-kicker">
                          <ReceiptText size={14} />
                          Invoice
                        </span>
                        <strong>{invoice.invoiceNumber}</strong>
                        <small>
                          Issued {formatDate(invoice.issuedAt)} - Due {formatDate(invoice.dueDate)}
                        </small>
                      </div>
                      <div className="invoice-status-stack">
                        <StatusBadge status={invoice.paymentStatus} />
                        <span className="payment-state">{paymentLabel}</span>
                      </div>
                    </div>

                    <div className="payment-summary-grid">
                      <div>
                        <span>Total</span>
                        <strong>{formatMoney(balance.total, invoice.currency)}</strong>
                      </div>
                      <div>
                        <span>Paid</span>
                        <strong>{formatMoney(isPaid ? balance.total : balance.paidPart, invoice.currency)}</strong>
                      </div>
                      <div>
                        <span>Remaining</span>
                        <strong>{formatMoney(balance.remaining, invoice.currency)}</strong>
                      </div>
                      <div>
                        <span>Payer</span>
                        <strong>{invoice.payerType || "Customer"}</strong>
                      </div>
                    </div>

                    <div className="payment-method-strip">
                      <span>
                        <CreditCard size={14} />
                        Manual receipt
                      </span>
                      <span>
                        <Banknote size={14} />
                        Cash default
                      </span>
                      <span>
                        <ReceiptText size={14} />
                        Reference optional
                      </span>
                    </div>

                    {canPay && (
                      <div className="payment-capture-panel">
                        <label>
                          <span>Reference</span>
                          <input
                            value={paymentReferences[invoice.id] ?? ""}
                            onChange={(event) =>
                              setPaymentReferences((current) => ({
                                ...current,
                                [invoice.id]: event.target.value.slice(0, 80)
                              }))
                            }
                            placeholder="Optional manual reference"
                            disabled={busy}
                          />
                        </label>
                      </div>
                    )}

                    <div className="invoice-actions payment-actions">
                      <div className="invoice-balance">
                        <span>{formatMoney(balance.remaining, invoice.currency)}</span>
                        {balance.hasPartialPayment && (
                          <small>
                            Remaining after {formatMoney(balance.paidPart, invoice.currency)} paid
                          </small>
                        )}
                      </div>
                      {canPay && (
                        <div className="partial-pay-row">
                          <input
                            type="number"
                            min="0.01"
                            max={balance.remaining || undefined}
                            step="0.01"
                            placeholder="Amount"
                            className="mini-input"
                            value={paymentAmounts[invoice.id] ?? ""}
                            onChange={(event) => setPaymentAmounts((current) => ({ ...current, [invoice.id]: event.target.value }))}
                            disabled={busy}
                          />
                          <button
                            className="mini-button"
                            type="button"
                            disabled={busy || !canRecordPayment}
                            onClick={() => {
                              if (!canRecordPayment) return;
                              onInvoiceStatus(invoice.id, paymentAction, buildManualPayment(invoice, paymentAmount));
                              setPaymentAmounts((current) => ({ ...current, [invoice.id]: "" }));
                            }}
                          >
                            Paid
                          </button>
                        </div>
                      )}
                      {isPrivileged && (
                        <button className="mini-button" type="button" onClick={() => onInvoiceStatus(invoice.id, "mark-as-refunded")} disabled={busy || !canRefund}>
                          <RotateCcw size={14} />
                          Refund
                        </button>
                      )}
                      <button className="mini-button danger" type="button" onClick={() => setCancelInvoiceId(invoice.id)} disabled={busy || !canCancel}>
                        Cancel
                      </button>
                      {isAdmin && (
                        <button className="icon-mini danger" type="button" onClick={() => setDeleteInvoiceId(invoice.id)} title="Delete invoice" disabled={busy}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {invoices.length === 0 && <EmptyState icon={<FileText size={24} />} title="No invoices loaded" description="Load shipment invoices or create one when billing lines are ready." />}
            </div>
          </section>
        </>
      ) : (
        <EmptyState icon={<WalletCards size={28} />} title="No shipment selected" />
      )}

      <ConfirmDialog
        open={Boolean(deleteInvoiceId)}
        title="Delete invoice"
        message="This admin-only action removes the invoice record."
        confirmLabel="Delete invoice"
        tone="danger"
        busy={busy}
        onClose={() => setDeleteInvoiceId(null)}
        onConfirm={() => {
          if (!deleteInvoiceId) return;
          onDeleteInvoice(deleteInvoiceId);
          setDeleteInvoiceId(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(cancelInvoiceId)}
        title="Cancel invoice"
        message="Write the operational reason that will be saved with this invoice cancellation."
        confirmLabel="Cancel invoice"
        tone="danger"
        busy={busy}
        onClose={() => setCancelInvoiceId(null)}
        onConfirm={() => {
          if (!cancelInvoiceId) return;
          onCancelInvoice(cancelInvoiceId, cancelReason);
          setCancelInvoiceId(null);
        }}
      >
        <Field label="Cancellation reason">
          <input value={cancelReason} onChange={(event) => setCancelReason(event.target.value.slice(0, 300))} maxLength={300} />
        </Field>
      </ConfirmDialog>
    </div>
  );
}
