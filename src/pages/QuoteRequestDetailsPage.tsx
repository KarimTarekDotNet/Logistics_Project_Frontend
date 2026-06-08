import { ArrowLeft, Banknote, CheckCircle2, ClipboardList, Clock3, PackageCheck, UserRound, XCircle } from "lucide-react";
import { useState, type FormEvent } from "react";
import { EmptyState, Field, LoadingSpinner, MetricLine, PanelTitle, SectionHeader, StatusBadge } from "../components/ui";
import type { QuoteRequest } from "../types";
import { formatDate, formatMoney } from "../utils/format";

function isPendingRequest(status?: QuoteRequest["status"]) {
  return status === "PendingReview" || status === 0;
}

function tempText(value?: number | null) {
  return value == null ? "Not required" : `${value} C`;
}

export function QuoteRequestDetailsPage(props: {
  request: QuoteRequest | null;
  loading: boolean;
  error?: string | null;
  busy: boolean;
  isPrivileged: boolean;
  isUser: boolean;
  onBack: () => void;
  onApprove: (id: string) => void | Promise<unknown>;
  onReject: (id: string, reason: string) => void | Promise<unknown>;
  onCancel: (id: string) => void | Promise<unknown>;
  onStillDraft: () => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const request = props.request;
  const canReview = Boolean(props.isPrivileged && request && isPendingRequest(request.status));
  const canCancel = Boolean(props.isUser && request && isPendingRequest(request.status));

  function submitReject(event: FormEvent) {
    event.preventDefault();
    if (!request || reason.trim().length < 5) return;
    void props.onReject(request.id, reason);
  }

  if (props.loading) {
    return <LoadingSpinner label="Loading quote request details" size="lg" />;
  }

  if (!request) {
    return (
      <div className="view-stack">
        <SectionHeader icon={<ClipboardList size={22} />} title="Quote request details" meta="Unavailable">
          <button className="secondary-button compact" type="button" onClick={props.onBack}>
            <ArrowLeft size={16} />
            Back
          </button>
        </SectionHeader>
        <EmptyState icon={<ClipboardList size={28} />} title="Quote request could not be loaded" description={props.error ?? "Try opening it again from the quote requests list."} />
      </div>
    );
  }

  return (
    <div className="view-stack quote-request-detail-view">
      <SectionHeader icon={<ClipboardList size={22} />} title="Quote request details" meta={`${request.customerName} / ${request.fromPortCode} to ${request.toPortCode}`}>
        <div className="button-row">
          <button className="secondary-button compact" type="button" onClick={props.onBack}>
            <ArrowLeft size={16} />
            Back
          </button>
          {canReview && (
            <>
              <button className="primary-button compact" type="button" disabled={props.busy} onClick={() => void props.onApprove(request.id)}>
                <CheckCircle2 size={17} />
                Approve
              </button>
              <button className="danger-button compact" type="button" disabled={props.busy} onClick={() => setRejecting(true)}>
                <XCircle size={17} />
                Reject
              </button>
              <button className="secondary-button compact" type="button" disabled={props.busy} onClick={props.onStillDraft}>
                <Clock3 size={16} />
                Still draft
              </button>
            </>
          )}
          {canCancel && (
            <button className="danger-button compact" type="button" disabled={props.busy} onClick={() => void props.onCancel(request.id)}>
              <XCircle size={17} />
              Cancel request
            </button>
          )}
        </div>
      </SectionHeader>

      <section className="quote-request-hero panel">
        <div>
          <span className="landing-kicker">Selected request</span>
          <h2>
            {request.carrierName} / {request.fromPortCode} to {request.toPortCode}
          </h2>
          <p>
            {request.containerTypeName} container requested by {request.customerName} on {formatDate(request.createdAt)}.
          </p>
        </div>
        <div className="rate-detail-price">
          <strong>{formatMoney(request.requestedRatePrice, request.currency)}</strong>
          <StatusBadge status={request.status} group="quoteRequest" />
        </div>
      </section>

      <div className="rate-detail-grid">
        <section className="panel">
          <PanelTitle icon={<Banknote size={18} />} title="Commercial details" />
          <div className="detail-grid">
            <MetricLine label="Carrier" value={request.carrierName} />
            <MetricLine label="Route" value={`${request.fromPortCode} to ${request.toPortCode}`} />
            <MetricLine label="Container" value={request.containerTypeName} />
            <MetricLine label="Requested rate" value={formatMoney(request.requestedRatePrice, request.currency)} />
            <MetricLine label="Status" value={<StatusBadge status={request.status} group="quoteRequest" />} />
          </div>
        </section>

        <section className="panel">
          <PanelTitle icon={<PackageCheck size={18} />} title="Cargo details" />
          <div className="detail-grid">
            <MetricLine label="Gross weight" value={`${request.requestedGrossWeightKg.toLocaleString()} kg`} />
            <MetricLine label="Net weight" value={`${request.requestedNetWeightKg.toLocaleString()} kg`} />
            <MetricLine label="Volume" value={`${request.requestedVolumeCbm.toLocaleString()} CBM`} />
            <MetricLine label="Hazardous cargo" value={request.isHazardous ? "Yes" : "No"} />
            <MetricLine label="Temperature" value={tempText(request.requiredTemperatureCelsius)} />
          </div>
        </section>
      </div>

      <section className="panel">
        <PanelTitle icon={<UserRound size={18} />} title="Review trail" />
        <div className="detail-grid review-trail-grid">
          <MetricLine label="Customer" value={request.customerName} />
          <MetricLine label="Created" value={formatDate(request.createdAt)} />
          <MetricLine label="Reviewed" value={request.reviewedAt ? formatDate(request.reviewedAt) : "Not reviewed yet"} />
          <MetricLine label="Reviewed by" value={request.reviewedByUserName || "Not assigned"} />
          <MetricLine label="Rejection reason" value={request.rejectionReason || "None"} />
        </div>
      </section>

      {rejecting && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setRejecting(false)}>
          <form className="confirm-dialog review-dialog" role="dialog" aria-modal="true" aria-labelledby="detail-reject-title" onSubmit={submitReject} onMouseDown={(event) => event.stopPropagation()}>
            <div className="confirm-icon danger">
              <XCircle size={22} />
            </div>
            <div>
              <h2 id="detail-reject-title">Reject quote request</h2>
              <p>Write the reason that will be saved on the request.</p>
            </div>
            <Field label="Reason">
              <textarea value={reason} onChange={(event) => setReason(event.target.value.slice(0, 500))} maxLength={500} minLength={5} rows={4} required />
            </Field>
            <div className="dialog-actions">
              <button type="button" className="secondary-button" onClick={() => setRejecting(false)} disabled={props.busy}>
                Keep draft
              </button>
              <button type="submit" className="danger-button" disabled={props.busy || reason.trim().length < 5}>
                Reject
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
