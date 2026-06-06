import { CheckCircle2, ClipboardList, Eye, Plus, Search, Trash2, XCircle } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { ConfirmDialog, EmptyState, EntityActions, Field, PanelTitle, SectionHeader, StatusBadge } from "../components/ui";
import { RateDetailsPage } from "./RateDetailsPage";
import type { AuthSession, Customer, Quote, QuoteDraft, QuoteRequest, Rate, Route } from "../types";
import { formatDate, formatMoney } from "../utils/format";
import { includesSearch } from "../utils/search";

function isPendingQuote(status: Quote["status"]) {
  return status === "Pending" || status === 0;
}

export function QuotesPage(props: {
  quotes: Quote[];
  quoteRequests: QuoteRequest[];
  rates: Rate[];
  routes: Route[];
  customers: Customer[];
  session: AuthSession;
  isPrivileged: boolean;
  isAdmin: boolean;
  isUser: boolean;
  busy: boolean;
  theme: "light" | "dark";
  draft: QuoteDraft;
  setDraft: (draft: QuoteDraft) => void;
  onCreateQuote: (event: FormEvent) => void;
  onAcceptQuote: (id: string) => void;
  onRejectQuote: (id: string, reason: string) => void;
  onDeleteQuote: (id: string) => void;
  onOpenQuoteRequestDetails: (id: string) => void;
  onFilterByCustomer: (customerName: string) => void;
  onFilterByRoute: (routeId: string) => void;
  onToggleTheme: () => void;
  onRateRequestCreated: (request: QuoteRequest) => void;
  hasCustomerProfile: boolean;
  onCreateCustomerProfile: () => void;
}) {
  const {
    quotes,
    quoteRequests,
    rates,
    routes,
    customers,
    session,
    isPrivileged,
    isAdmin,
    isUser,
    busy,
    theme,
    draft,
    setDraft,
    onCreateQuote
  } = props;
  const [query, setQuery] = useState("");
  const [requestQuery, setRequestQuery] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [customerLookup, setCustomerLookup] = useState("");
  const [routeLookup, setRouteLookup] = useState("");
  const [rejectTarget, setRejectTarget] = useState<{ kind: "quote"; id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedRateId, setSelectedRateId] = useState<string | null>(null);

  const filteredQuotes = useMemo(
    () =>
      quotes.filter((quote) =>
        includesSearch(
          [
            quote.customerName,
            quote.carrierName,
            quote.fromPortCode,
            quote.toPortCode,
            quote.containerTypeName,
            quote.finalPrice,
            quote.currency,
            quote.status
          ],
          query
        )
      ),
    [query, quotes]
  );

  const filteredRequests = useMemo(
    () =>
      quoteRequests.filter((request) =>
        includesSearch(
          [
            request.customerName,
            request.carrierName,
            request.fromPortCode,
            request.toPortCode,
            request.containerTypeName,
            request.requestedRatePrice,
            request.currency,
            request.status
          ],
          requestQuery
        )
      ),
    [quoteRequests, requestQuery]
  );
  const selectedRate = useMemo(() => rates.find((rate) => rate.id === selectedRateId) ?? null, [rates, selectedRateId]);

  function openRateDetails(rateId: string) {
    setSelectedRateId(rateId);
  }

  function submitRejection(event: FormEvent) {
    event.preventDefault();
    if (!rejectTarget) return;

    props.onRejectQuote(rejectTarget.id, rejectReason);

    setRejectTarget(null);
    setRejectReason("");
  }

  if (selectedRateId) {
    return (
      <RateDetailsPage
        rateId={selectedRateId}
        session={session}
        isUser={isUser}
        hasCustomerProfile={props.hasCustomerProfile}
        theme={theme}
        onToggleTheme={props.onToggleTheme}
        initialRate={selectedRate ?? undefined}
        embedded
        onBack={() => setSelectedRateId(null)}
        onCreateCustomerProfile={props.onCreateCustomerProfile}
        onRequestCreated={props.onRateRequestCreated}
      />
    );
  }

  return (
    <div className="view-stack">
      <SectionHeader icon={<ClipboardList size={22} />} title="Quotes" meta={`${quotes.length} quotes / ${quoteRequests.length} requests`} />

      {isPrivileged && (
        <section className="panel">
          <PanelTitle icon={<Plus size={18} />} title="Create quote" />
          <form className="dense-form quote-create-form" onSubmit={onCreateQuote}>
            <Field label="Customer">
              <select value={draft.customerId} onChange={(event) => setDraft({ ...draft, customerId: event.target.value })} required>
                <option value="">Select customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.companyName || customer.nationalId || "Individual customer"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Rate">
              <select value={draft.rateId} onChange={(event) => setDraft({ ...draft, rateId: event.target.value })} required>
                <option value="">Select rate</option>
                {rates.map((rate) => (
                  <option key={rate.id} value={rate.id}>
                    {rate.carrierName} - {rate.fromPortCode} to {rate.toPortCode} - {formatMoney(rate.price, rate.currency)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Gross kg">
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={draft.requestedGrossWeightKg}
                onChange={(event) => setDraft({ ...draft, requestedGrossWeightKg: event.target.value })}
                required
              />
            </Field>
            <Field label="Net kg">
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={draft.requestedNetWeightKg}
                onChange={(event) => setDraft({ ...draft, requestedNetWeightKg: event.target.value })}
                required
              />
            </Field>
            <Field label="Volume CBM">
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={draft.requestedVolumeCbm}
                onChange={(event) => setDraft({ ...draft, requestedVolumeCbm: event.target.value })}
                required
              />
            </Field>
            <Field label="Temp C">
              <input
                type="number"
                min="-60"
                max="60"
                step="0.1"
                value={draft.requiredTemperatureCelsius}
                onChange={(event) => setDraft({ ...draft, requiredTemperatureCelsius: event.target.value })}
                placeholder="Optional"
              />
            </Field>
            <label className="check-row compact quote-haz-toggle">
              <input type="checkbox" checked={draft.isHazardous} onChange={(event) => setDraft({ ...draft, isHazardous: event.target.checked })} />
              <span>Hazardous cargo</span>
            </label>
            <button className="primary-button compact" type="submit" disabled={busy}>
              <Plus size={17} />
              Create
            </button>
          </form>
        </section>
      )}

      {isPrivileged && (
        <section className="panel endpoint-panel">
          <PanelTitle icon={<Search size={18} />} title="Quote lookups" />
          <div className="endpoint-grid">
            <div className="endpoint-tool">
              <Field label="Customer name">
                <input value={customerLookup} onChange={(event) => setCustomerLookup(event.target.value.slice(0, 100))} placeholder="Company or customer" maxLength={100} />
              </Field>
              <button className="secondary-button compact" type="button" disabled={!customerLookup || busy} onClick={() => props.onFilterByCustomer(customerLookup)}>
                Load customer quotes
              </button>
            </div>
            <div className="endpoint-tool">
              <Field label="Route">
                <select value={routeLookup} onChange={(event) => setRouteLookup(event.target.value)}>
                  <option value="">Choose route</option>
                  {routes.map((route) => (
                    <option key={route.id} value={route.id}>
                      {route.fromPortCode} to {route.toPortCode}
                    </option>
                  ))}
                </select>
              </Field>
              <button className="secondary-button compact" type="button" disabled={!routeLookup || busy} onClick={() => props.onFilterByRoute(routeLookup)}>
                Load route quotes
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="panel">
        <PanelTitle icon={<ClipboardList size={18} />} title="Quote requests" meta={`${filteredRequests.length} shown`} />
        <div className="toolbar">
          <label className="toolbar-search">
            <Search size={16} />
            <input value={requestQuery} onChange={(event) => setRequestQuery(event.target.value.slice(0, 100))} placeholder="Filter requests" maxLength={100} spellCheck={false} />
          </label>
        </div>
        {filteredRequests.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Rate</th>
                  <th>Cargo</th>
                  <th>Requested rate</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((request) => (
                  <tr key={request.id}>
                    <td>{request.customerName}</td>
                    <td>
                      {request.carrierName} / {request.fromPortCode} to {request.toPortCode}
                    </td>
                    <td>
                      {request.requestedGrossWeightKg}kg / {request.requestedVolumeCbm} CBM
                    </td>
                    <td>{formatMoney(request.requestedRatePrice, request.currency)}</td>
                    <td>
                      <StatusBadge status={request.status} group="quoteRequest" />
                    </td>
                    <td>{formatDate(request.createdAt)}</td>
                    <td>
                      <EntityActions>
                        <button className="icon-mini" type="button" title="Open request details" disabled={busy} onClick={() => props.onOpenQuoteRequestDetails(request.id)}>
                          <Eye size={14} />
                        </button>
                      </EntityActions>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={<ClipboardList size={28} />} title="No quote requests found" description="Requests created from rate details appear here." />
        )}
      </section>

      <section className="panel">
        <PanelTitle icon={<ClipboardList size={18} />} title="Quote list" meta={`${filteredQuotes.length} shown`} />
        <div className="toolbar">
          <label className="toolbar-search">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value.slice(0, 100))} placeholder="Filter customer, lane, carrier, value" maxLength={100} spellCheck={false} />
          </label>
        </div>
        {filteredQuotes.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Carrier</th>
                  <th>Route</th>
                  <th>Container</th>
                  <th>Cargo</th>
                  <th>Final price</th>
                  <th>Status</th>
                  <th>Created</th>
                  {(isAdmin || isUser) && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredQuotes.map((quote) => (
                  <tr key={quote.id}>
                    <td>{quote.customerName}</td>
                    <td>{quote.carrierName}</td>
                    <td>
                      {quote.fromPortCode} to {quote.toPortCode}
                    </td>
                    <td>{quote.containerTypeName}</td>
                    <td>
                      {quote.requestedGrossWeightKg}kg / {quote.requestedVolumeCbm} CBM
                    </td>
                    <td>{formatMoney(quote.finalPrice, quote.currency)}</td>
                    <td>
                      <StatusBadge status={quote.status} group="quote" />
                    </td>
                    <td>{formatDate(quote.createdAt)}</td>
                    {(isAdmin || isUser) && (
                      <td>
                        <EntityActions>
                          <button className="icon-mini" type="button" title="Open rate details" disabled={busy} onClick={() => openRateDetails(quote.rateId)}>
                            <Eye size={14} />
                          </button>
                          {isUser && isPendingQuote(quote.status) && (
                            <>
                              <button className="icon-mini" type="button" title="Accept quote" disabled={busy} onClick={() => props.onAcceptQuote(quote.id)}>
                                <CheckCircle2 size={14} />
                              </button>
                              <button className="icon-mini danger" type="button" title="Reject quote" disabled={busy} onClick={() => setRejectTarget({ kind: "quote", id: quote.id })}>
                                <XCircle size={14} />
                              </button>
                            </>
                          )}
                          {isAdmin && (
                            <button className="icon-mini danger" type="button" title="Delete quote" onClick={() => setDeleteId(quote.id)}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </EntityActions>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={<ClipboardList size={28} />} title="No quotes found" description="Quotes created by staff appear here for shipment conversion." />
        )}
      </section>

      {rejectTarget && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setRejectTarget(null)}>
          <form className="confirm-dialog review-dialog" role="dialog" aria-modal="true" aria-labelledby="reject-title" onSubmit={submitRejection} onMouseDown={(event) => event.stopPropagation()}>
            <div className="confirm-icon danger">
              <XCircle size={22} />
            </div>
            <div>
              <h2 id="reject-title">Reject quote</h2>
              <p>Provide a clear reason for audit history and customer visibility.</p>
            </div>
            <Field label="Reason">
              <textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value.slice(0, 500))} maxLength={500} minLength={5} rows={4} required />
            </Field>
            <div className="dialog-actions">
              <button type="button" className="secondary-button" onClick={() => setRejectTarget(null)} disabled={busy}>
                Keep
              </button>
              <button type="submit" className="danger-button" disabled={busy || rejectReason.trim().length < 5}>
                Reject
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete quote"
        message="This removes the quote from the quoting workspace. Shipments already created from it are not changed."
        confirmLabel="Delete quote"
        tone="danger"
        busy={busy}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (!deleteId) return;
          props.onDeleteQuote(deleteId);
          setDeleteId(null);
        }}
      />
    </div>
  );
}
