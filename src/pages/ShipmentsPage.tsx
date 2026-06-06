import {
  Activity,
  Box,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ClipboardList,
  FileText,
  Package,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  ReceiptText,
  Send,
  Ship,
  Trash2,
  WalletCards,
  XCircle
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { ConfirmDialog, EmptyState, Field, PanelTitle, SectionHeader, StatusBadge } from "../components/ui";
import type { Quote, Shipment, ShipmentHistory, ShipmentItem, ShipmentItemDraft, TimelineItem, TrackingDraft } from "../types";
import { ShipmentContextPanel } from "../features/shipments/ShipmentContextPanel";
import { canModifyShipmentItems, estimateChargeableWeight } from "../features/shipments/shipmentItems";
import { formatDate, formatMoney } from "../utils/format";
import { includesSearch } from "../utils/search";

const lifecycleByStatus: Record<string, Array<{ label: string; action: string; icon: typeof CheckCircle2; dangerous?: boolean }>> = {
  Created: [
    { label: "Confirm client", action: "confirm-client", icon: CheckCircle2 },
    { label: "Put on hold", action: "put-on-hold", icon: PauseCircle },
    { label: "Cancel", action: "cancellation", icon: XCircle, dangerous: true }
  ],
  ClientConfirmed: [
    { label: "Request booking", action: "request-booking", icon: Send },
    { label: "Put on hold", action: "put-on-hold", icon: PauseCircle },
    { label: "Cancel", action: "cancellation", icon: XCircle, dangerous: true }
  ],
  BookingRequested: [
    { label: "Confirm booking", action: "confirm-booking", icon: CheckCircle2 },
    { label: "Put on hold", action: "put-on-hold", icon: PauseCircle },
    { label: "Cancel", action: "cancellation", icon: XCircle, dangerous: true }
  ],
  BookingConfirmed: [
    { label: "Submit instructions", action: "submit-shipping-instructions", icon: ClipboardList },
    { label: "Put on hold", action: "put-on-hold", icon: PauseCircle },
    { label: "Cancel", action: "cancellation", icon: XCircle, dangerous: true }
  ],
  ShippingInstructionsSubmitted: [
    { label: "Receive draft B/L", action: "receive-draft-bl", icon: FileText },
    { label: "Put on hold", action: "put-on-hold", icon: PauseCircle },
    { label: "Cancel", action: "cancellation", icon: XCircle, dangerous: true }
  ],
  DraftBLReceived: [
    { label: "Approve draft B/L", action: "approve-draft-bl", icon: CheckCircle2 },
    { label: "Put on hold", action: "put-on-hold", icon: PauseCircle },
    { label: "Cancel", action: "cancellation", icon: XCircle, dangerous: true }
  ],
  DraftBLApproved: [
    { label: "Payment pending", action: "mark-payment-pending", icon: Clock3 },
    { label: "Put on hold", action: "put-on-hold", icon: PauseCircle },
    { label: "Cancel", action: "cancellation", icon: XCircle, dangerous: true }
  ],
  PaymentPending: [
    { label: "Confirm payment", action: "confirm-payment", icon: WalletCards },
    { label: "Put on hold", action: "put-on-hold", icon: PauseCircle },
    { label: "Cancel", action: "cancellation", icon: XCircle, dangerous: true }
  ],
  PaymentCompleted: [
    { label: "Release telex", action: "release-telex", icon: Send },
    { label: "Put on hold", action: "put-on-hold", icon: PauseCircle }
  ],
  TelexReleased: [
    { label: "Complete delivery", action: "complete-delivery", icon: Package },
    { label: "Put on hold", action: "put-on-hold", icon: PauseCircle }
  ],
  Delivered: [{ label: "Close", action: "close", icon: CheckCircle2 }],
  OnHold: [{ label: "Resume", action: "resume-from-hold", icon: PlayCircle }]
};

export function ShipmentsPage(props: {
  shipments: Shipment[];
  selectedShipment?: Shipment;
  timeline: TimelineItem[];
  history: ShipmentHistory[];
  isPrivileged: boolean;
  isAdmin: boolean;
  isUser: boolean;
  busy: boolean;
  shipmentDraft: { quoteId: string };
  setShipmentDraft: (draft: { quoteId: string }) => void;
  quoteOptions: Quote[];
  quoteSearch: string;
  setQuoteSearch: (value: string) => void;
  trackingDraft: TrackingDraft;
  setTrackingDraft: (draft: TrackingDraft) => void;
  actionReason: string;
  setActionReason: (value: string) => void;
  onCreateShipment: (event: FormEvent) => void;
  onSelectShipment: (id: string) => void;
  onShipmentAction: (action: string) => Promise<unknown>;
  onUpdateTracking: (event: FormEvent) => void;
  onDeleteShipment: (id: string) => void;
  shipmentItems: ShipmentItem[];
  itemDraft: ShipmentItemDraft;
  setItemDraft: (draft: ShipmentItemDraft) => void;
  editingItemId: string | null;
  itemUpdateReturnStep: "charges" | "invoice" | null;
  onSaveItem: (event: FormEvent) => void;
  onEditItem: (item: ShipmentItem) => void;
  onCancelItemEdit: () => void;
  onDeleteItem: (id: string) => void;
  onConfirmItems: () => void;
  onCancelItemUpdate: () => void;
  hasUnbilledItems: boolean;
  hasDraftInvoice: boolean;
  onContinueInvoice: () => void;
}) {
  const {
    shipments,
    selectedShipment,
    timeline,
    history,
    isPrivileged,
    isAdmin,
    isUser,
    busy,
    shipmentDraft,
    setShipmentDraft,
    quoteOptions,
    quoteSearch,
    setQuoteSearch,
    trackingDraft,
    setTrackingDraft,
    actionReason,
    setActionReason,
    onCreateShipment,
    onSelectShipment,
    onShipmentAction,
    onUpdateTracking,
    onDeleteShipment,
    shipmentItems,
    itemDraft,
    setItemDraft,
    editingItemId,
    itemUpdateReturnStep,
    onSaveItem,
    onEditItem,
    onCancelItemEdit,
    onDeleteItem,
    onConfirmItems,
    onCancelItemUpdate,
    hasUnbilledItems,
    hasDraftInvoice,
    onContinueInvoice
  } = props;
  const [quotePickerOpen, setQuotePickerOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [deleteShipmentId, setDeleteShipmentId] = useState<string | null>(null);
  const actions = selectedShipment ? lifecycleByStatus[selectedShipment.status] ?? [] : [];
  const visibleQuotes = quoteOptions
    .filter((quote) => includesSearch([quote.customerName, quote.fromPortCode, quote.toPortCode, quote.containerTypeName, quote.finalPrice, quote.currency], quoteSearch))
    .slice(0, 8);
  const selectedQuote = quoteOptions.find((quote) => quote.id === shipmentDraft.quoteId);
  const filteredShipments = useMemo(
    () => shipments.filter((shipment) => statusFilter === "all" || shipment.status === statusFilter),
    [shipments, statusFilter]
  );
  const statusOptions = Array.from(new Set(shipments.map((shipment) => shipment.status)));
  const itemTotals = useMemo(
    () =>
      shipmentItems.reduce(
        (totals, item) => ({
          quantity: totals.quantity + item.quantity,
          chargeableWeight: totals.chargeableWeight + item.chargeableWeight,
          grossWeight: totals.grossWeight + item.grossWeight,
          volumeCbm: totals.volumeCbm + item.volumeCbm,
          hazardous: totals.hazardous + (item.isHazardous ? 1 : 0)
        }),
        { quantity: 0, chargeableWeight: 0, grossWeight: 0, volumeCbm: 0, hazardous: 0 }
      ),
    [shipmentItems]
  );
  const canEditItems = Boolean(isUser && selectedShipment && canModifyShipmentItems(selectedShipment.status));
  const isEditingItem = Boolean(editingItemId);

  function runAction(action: string, dangerous?: boolean) {
    if (dangerous) {
      setPendingAction(action);
      return;
    }
    void onShipmentAction(action);
  }

  return (
    <div className="view-stack">
      <SectionHeader icon={<Ship size={22} />} title="Shipments" meta={`${shipments.length} records`} />

      {isUser && (
        <section className="panel">
          <PanelTitle icon={<Plus size={18} />} title="Create shipment" />
          <form className="shipment-create-form" onSubmit={onCreateShipment}>
            <div className="quote-picker">
              <Field label="Search quotes">
                <div className="combo-field">
                  <input
                    value={quoteSearch}
                    onFocus={() => setQuotePickerOpen(true)}
                    onChange={(event) => {
                      setQuoteSearch(event.target.value.slice(0, 100));
                      setQuotePickerOpen(true);
                    }}
                    placeholder="Customer, route, container, price"
                    maxLength={100}
                    spellCheck={false}
                  />
                  <button className="combo-button" type="button" onClick={() => setQuotePickerOpen((current) => !current)} aria-label="Show matching quotes">
                    <ChevronDown size={16} />
                  </button>
                </div>
              </Field>
              {quotePickerOpen && (
                <div className="quote-option-list dropdown">
                  {visibleQuotes.map((quote) => (
                    <button
                      type="button"
                      className={`quote-option ${quote.id === shipmentDraft.quoteId ? "selected" : ""}`}
                      key={quote.id}
                      onClick={() => {
                        setShipmentDraft({ quoteId: quote.id });
                        setQuoteSearch(`${quote.customerName} - ${quote.fromPortCode} to ${quote.toPortCode}`);
                        setQuotePickerOpen(false);
                      }}
                    >
                      <span>
                        <strong>{quote.customerName}</strong>
                        <small>
                          {quote.fromPortCode} to {quote.toPortCode} - {quote.containerTypeName}
                        </small>
                      </span>
                      <b>{formatMoney(quote.finalPrice, quote.currency)}</b>
                    </button>
                  ))}
                  {visibleQuotes.length === 0 && <div className="quote-empty">No matching quotes</div>}
                </div>
              )}
            </div>
            {selectedQuote && (
              <div className="selected-quote">
                <CheckCircle2 size={17} />
                <span>
                  {selectedQuote.fromPortCode} to {selectedQuote.toPortCode} - {formatMoney(selectedQuote.finalPrice, selectedQuote.currency)}
                </span>
              </div>
            )}
            <button className="primary-button compact" type="submit" disabled={busy || !shipmentDraft.quoteId}>
              <Plus size={17} />
              Create
            </button>
          </form>
        </section>
      )}

      <div className="split-layout">
        <section className="panel">
          <PanelTitle icon={<Ship size={18} />} title="Shipment list" meta={`${filteredShipments.length} shown`} />
          <div className="toolbar">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Carrier</th>
                  <th>Status</th>
                  <th>Checkpoint</th>
                  <th>Value</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredShipments.map((shipment) => {
                  const isSelected = shipment.id === selectedShipment?.id;
                  return (
                    <tr key={shipment.id} className={`clickable-row ${isSelected ? "selected-row" : ""}`} aria-current={isSelected ? "true" : undefined} onClick={() => onSelectShipment(shipment.id)}>
                      <td>{shipment.customerName}</td>
                      <td>{shipment.carrierName}</td>
                      <td>
                        <StatusBadge status={shipment.status} />
                      </td>
                      <td>{shipment.currentCheckpoint || "Pending"}</td>
                      <td>{formatMoney(shipment.agreedPrice, shipment.currency)}</td>
                      {isAdmin && (
                        <td>
                          <button
                            className="icon-mini danger"
                            type="button"
                            title="Delete shipment"
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeleteShipmentId(shipment.id);
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel detail-panel">
          <PanelTitle icon={<Activity size={18} />} title="Shipment detail" />
          {selectedShipment ? (
            <>
              <ShipmentContextPanel shipment={selectedShipment} />

              {isUser && hasDraftInvoice && (
                <div className="shipment-workflow-actions">
                  <button className="primary-button compact" type="button" disabled={busy} onClick={onContinueInvoice}>
                    <ReceiptText size={17} />
                    Continue invoice
                  </button>
                </div>
              )}

              {isPrivileged && (
                <div className="operations-block">
                  <Field label="Reason">
                    <input value={actionReason} onChange={(event) => setActionReason(event.target.value.slice(0, 300))} placeholder="Required for hold/cancel and useful for audits" maxLength={300} />
                  </Field>
                  <div className="button-row">
                    {actions.map((action) => {
                      const Icon = action.icon;
                      return (
                        <button key={action.action} className={action.dangerous ? "danger-button subtle" : "secondary-button"} type="button" disabled={busy} onClick={() => runAction(action.action, action.dangerous)}>
                          <Icon size={17} />
                          {action.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {isPrivileged && (
                <form className="tracking-form" onSubmit={onUpdateTracking}>
                  <PanelTitle icon={<Clock3 size={18} />} title="Tracking" />
                  <div className="form-grid">
                    <Field label="Booking">
                      <input value={trackingDraft.bookingNumber} onChange={(event) => setTrackingDraft({ ...trackingDraft, bookingNumber: event.target.value.slice(0, 100) })} maxLength={100} />
                    </Field>
                    <Field label="Vessel">
                      <input value={trackingDraft.vesselName} onChange={(event) => setTrackingDraft({ ...trackingDraft, vesselName: event.target.value.slice(0, 200) })} maxLength={200} />
                    </Field>
                    <Field label="Voyage">
                      <input value={trackingDraft.voyageNumber} onChange={(event) => setTrackingDraft({ ...trackingDraft, voyageNumber: event.target.value.slice(0, 100) })} maxLength={100} />
                    </Field>
                    <Field label="Checkpoint">
                      <input value={trackingDraft.currentCheckpoint} onChange={(event) => setTrackingDraft({ ...trackingDraft, currentCheckpoint: event.target.value.slice(0, 250) })} maxLength={250} />
                    </Field>
                    <Field label="ETD">
                      <input type="datetime-local" value={trackingDraft.estimatedDeparture} onChange={(event) => setTrackingDraft({ ...trackingDraft, estimatedDeparture: event.target.value })} />
                    </Field>
                    <Field label="ETA">
                      <input type="datetime-local" value={trackingDraft.estimatedArrival} onChange={(event) => setTrackingDraft({ ...trackingDraft, estimatedArrival: event.target.value })} />
                    </Field>
                    <Field label="ATD">
                      <input type="datetime-local" value={trackingDraft.actualDeparture} onChange={(event) => setTrackingDraft({ ...trackingDraft, actualDeparture: event.target.value })} />
                    </Field>
                    <Field label="ATA">
                      <input type="datetime-local" value={trackingDraft.actualArrival} onChange={(event) => setTrackingDraft({ ...trackingDraft, actualArrival: event.target.value })} />
                    </Field>
                  </div>
                  <button className="primary-button compact" type="submit" disabled={busy}>
                    <CheckCircle2 size={17} />
                    Save tracking
                  </button>
                </form>
              )}

              <div className="timeline-grid">
                <div className="timeline">
                  <PanelTitle icon={<Clock3 size={18} />} title="Operations timeline" />
                  {timeline.map((item) => (
                    <div className="timeline-item" key={`${item.type}-${item.createdAt}`}>
                      <span className="timeline-dot" />
                      <div>
                        <strong>{item.title}</strong>
                        <small>{formatDate(item.createdAt)}</small>
                        {item.description && <p>{item.description}</p>}
                      </div>
                    </div>
                  ))}
                  {timeline.length === 0 && <EmptyState icon={<Clock3 size={24} />} title="No timeline entries" />}
                </div>

                <div className="timeline">
                  <PanelTitle icon={<ClipboardList size={18} />} title="Status history" />
                  {history.map((item) => (
                    <div className="timeline-item" key={item.id}>
                      <span className="timeline-dot amber" />
                      <div>
                        <strong>
                          {item.fromStatus} to {item.toStatus}
                        </strong>
                        <small>
                          {formatDate(item.changedAt)} - {item.changedBy || item.changedByRole || "System"}
                        </small>
                        {item.reason && <p>{item.reason}</p>}
                      </div>
                    </div>
                  ))}
                  {history.length === 0 && <EmptyState icon={<ClipboardList size={24} />} title="No status history" />}
                </div>
              </div>

              <CargoItems
                shipmentItems={shipmentItems}
                itemDraft={itemDraft}
                setItemDraft={setItemDraft}
                itemTotals={itemTotals}
                canEditItems={canEditItems}
                isUser={isUser}
                busy={busy}
                isEditingItem={isEditingItem}
                editingItemId={editingItemId}
                itemUpdateReturnStep={itemUpdateReturnStep}
                onSaveItem={onSaveItem}
                onEditItem={onEditItem}
                onCancelItemEdit={onCancelItemEdit}
                onDeleteItem={onDeleteItem}
                onConfirmItems={onConfirmItems}
                onCancelItemUpdate={onCancelItemUpdate}
                hasUnbilledItems={hasUnbilledItems}
              />
            </>
          ) : (
            <EmptyState icon={<Ship size={28} />} title="No shipment selected" />
          )}
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title="Confirm shipment action"
        message="This operation changes the shipment lifecycle and writes to the audit history."
        confirmLabel="Apply action"
        tone="danger"
        busy={busy}
        onClose={() => setPendingAction(null)}
        onConfirm={async () => {
          if (!pendingAction) return;
          const action = pendingAction;
          setPendingAction(null);
          await onShipmentAction(action);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteShipmentId)}
        title="Delete shipment"
        message="This removes the shipment record. Use this only for test or invalid operational records."
        confirmLabel="Delete shipment"
        tone="danger"
        busy={busy}
        onClose={() => setDeleteShipmentId(null)}
        onConfirm={() => {
          if (!deleteShipmentId) return;
          onDeleteShipment(deleteShipmentId);
          setDeleteShipmentId(null);
        }}
      />
    </div>
  );
}

function CargoItems(props: {
  shipmentItems: ShipmentItem[];
  itemDraft: ShipmentItemDraft;
  setItemDraft: (draft: ShipmentItemDraft) => void;
  itemTotals: { quantity: number; chargeableWeight: number; grossWeight: number; volumeCbm: number; hazardous: number };
  canEditItems: boolean;
  isUser: boolean;
  busy: boolean;
  isEditingItem: boolean;
  editingItemId: string | null;
  itemUpdateReturnStep: "charges" | "invoice" | null;
  onSaveItem: (event: FormEvent) => void;
  onEditItem: (item: ShipmentItem) => void;
  onCancelItemEdit: () => void;
  onDeleteItem: (id: string) => void;
  onConfirmItems: () => void;
  onCancelItemUpdate: () => void;
  hasUnbilledItems: boolean;
}) {
  const {
    shipmentItems,
    itemDraft,
    setItemDraft,
    itemTotals,
    canEditItems,
    isUser,
    busy,
    isEditingItem,
    editingItemId,
    itemUpdateReturnStep,
    onSaveItem,
    onEditItem,
    onCancelItemEdit,
    onDeleteItem,
    onConfirmItems,
    onCancelItemUpdate,
    hasUnbilledItems
  } = props;
  const grossDraft = Number(itemDraft.grossWeight);
  const volumeDraft = Number(itemDraft.volumeCbm);
  const estimatedChargeable =
    Number.isFinite(grossDraft) && Number.isFinite(volumeDraft)
      ? estimateChargeableWeight(Math.max(0, grossDraft), Math.max(0, volumeDraft))
      : 0;
  const hasItems = shipmentItems.length > 0;
  const isUpdatingFromWorkflow = Boolean(itemUpdateReturnStep);
  const canConfirmItems = isUpdatingFromWorkflow || hasUnbilledItems;
  const returnLabel = itemUpdateReturnStep === "invoice" ? "invoice review" : "charge generation";

  return (
    <div className="items-section">
      <div className="items-heading">
        <PanelTitle icon={<Box size={18} />} title="Cargo items" />
        {shipmentItems.length > 0 && (
          <div className="items-summary">
            <span>{itemTotals.quantity} pcs</span>
            <span>{itemTotals.chargeableWeight.toFixed(2)} kg chargeable</span>
            <span>{itemTotals.grossWeight.toFixed(2)} kg gross</span>
            <span>{itemTotals.volumeCbm.toFixed(2)} CBM</span>
            {itemTotals.hazardous > 0 && <span className="danger-text">{itemTotals.hazardous} hazardous</span>}
          </div>
        )}
      </div>

      {canEditItems && (
        <form className="form-stack cargo-form" onSubmit={onSaveItem}>
          <Field label="Description">
            <input value={itemDraft.description} onChange={(event) => setItemDraft({ ...itemDraft, description: event.target.value })} placeholder="Electronics, furniture, spare parts" maxLength={250} required />
          </Field>
          <div className="form-grid">
            <Field label="Qty">
              <input type="number" min="1" step="1" value={itemDraft.quantity} onChange={(event) => setItemDraft({ ...itemDraft, quantity: event.target.value })} required />
            </Field>
            <Field label="Vol (CBM)">
              <input type="number" min="0" step="0.01" value={itemDraft.volumeCbm} onChange={(event) => setItemDraft({ ...itemDraft, volumeCbm: event.target.value })} required />
            </Field>
            <Field label="Gross (kg)">
              <input type="number" min="0.01" step="0.01" value={itemDraft.grossWeight} onChange={(event) => setItemDraft({ ...itemDraft, grossWeight: event.target.value })} required />
            </Field>
            <Field label="Net (kg)">
              <input type="number" min="0.01" step="0.01" value={itemDraft.netWeight} onChange={(event) => setItemDraft({ ...itemDraft, netWeight: event.target.value })} required />
            </Field>
            <Field label="Marks and numbers">
              <input value={itemDraft.marksAndNumbers} maxLength={200} onChange={(event) => setItemDraft({ ...itemDraft, marksAndNumbers: event.target.value })} />
            </Field>
            <div className="readonly-metric">
              <span>Chargeable kg</span>
              <strong>{estimatedChargeable.toFixed(2)}</strong>
            </div>
          </div>
          <label className="check-row">
            <input type="checkbox" checked={itemDraft.isHazardous} onChange={(event) => setItemDraft({ ...itemDraft, isHazardous: event.target.checked })} />
            <span>Hazardous cargo</span>
          </label>
          {itemDraft.isHazardous && (
            <Field label="Required temp (deg C)">
              <input type="number" min="-50" max="50" step="0.1" value={itemDraft.requiredTemperatureCelsius} onChange={(event) => setItemDraft({ ...itemDraft, requiredTemperatureCelsius: event.target.value })} />
            </Field>
          )}
          <div className="button-row">
            <button className="primary-button compact" type="submit" disabled={busy}>
              {isEditingItem ? <CheckCircle2 size={17} /> : <Plus size={17} />}
              {isEditingItem ? "Save item" : "Add item"}
            </button>
            {isEditingItem && (
              <button className="secondary-button compact" type="button" disabled={busy} onClick={onCancelItemEdit}>
                <XCircle size={17} />
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {canEditItems && canConfirmItems && (
        <div className="cargo-confirm-strip">
          <div>
            <strong>{isUpdatingFromWorkflow ? "Review cargo updates" : "Confirm cargo list"}</strong>
            <small>
              {isUpdatingFromWorkflow
                ? `Save any item edits, then confirm to regenerate charges or cancel to return to ${returnLabel}.`
                : "Add as many items as needed. Confirm only when the cargo list is complete."}
            </small>
          </div>
          <div className="button-row">
            {isUpdatingFromWorkflow && (
              <button className="secondary-button compact" type="button" disabled={busy} onClick={onCancelItemUpdate}>
                <XCircle size={17} />
                Cancel update
              </button>
            )}
            <button className="primary-button compact" type="button" disabled={busy || !hasItems || isEditingItem} onClick={onConfirmItems}>
              <CheckCircle2 size={17} />
              Confirm items
            </button>
          </div>
        </div>
      )}

      {!canEditItems && isUser && <p className="empty-hint">Cargo items are locked for this shipment status.</p>}

      <div className="compact-list cargo-list">
        {shipmentItems.length === 0 && <p className="empty-hint">No cargo items yet.</p>}
        {shipmentItems.map((item) => (
          <div className={`list-row cargo-item ${editingItemId === item.id ? "editing" : ""}`} key={item.id}>
            <div className="cargo-item-body">
              <strong>{item.description}</strong>
              <div className="cargo-metrics">
                <span>Qty {item.quantity}</span>
                <span>{item.volumeCbm.toFixed(2)} CBM</span>
                <span>{item.grossWeight.toFixed(2)} kg gross</span>
                <span>{item.netWeight.toFixed(2)} kg net</span>
                <span>{item.chargeableWeight.toFixed(2)} kg chargeable</span>
                {item.requiredTemperatureCelsius != null && <span>{item.requiredTemperatureCelsius} deg C</span>}
                {item.isHazardous && <span className="danger-text">Hazardous</span>}
              </div>
              {item.marksAndNumbers && <small>Marks: {item.marksAndNumbers}</small>}
            </div>
            {canEditItems && (
              <div className="cargo-actions">
                <button className="mini-button" type="button" disabled={busy} onClick={() => onEditItem(item)}>
                  <Pencil size={14} />
                  Edit
                </button>
                <button className="mini-button danger" type="button" disabled={busy} onClick={() => onDeleteItem(item.id)}>
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
