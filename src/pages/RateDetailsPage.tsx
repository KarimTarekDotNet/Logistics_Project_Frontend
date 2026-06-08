import { ArrowLeft, Banknote, CheckCircle2, ExternalLink, Moon, Send, ShieldCheck, Sun, Weight } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BrandLogo } from "../components/brand/BrandLogo";
import { EmptyState, Field, LoadingSpinner, MetricLine, PanelTitle, StatusBadge } from "../components/ui";
import { BRAND_NAME } from "../constants/brand";
import { api } from "../services/api";
import type { AuthSession, QuoteRequest, QuoteRequestDraft, Rate } from "../types";
import { getFriendlyErrorMessage } from "../utils/errors";
import { formatDate, formatMoney, formatShortDate } from "../utils/format";
import { toBrowserPath } from "../utils/navigation";

const initialRequestDraft: QuoteRequestDraft = {
  rateId: "",
  requestedGrossWeightKg: "1000",
  requestedNetWeightKg: "900",
  requestedVolumeCbm: "8",
  isHazardous: false,
  requiredTemperatureCelsius: "",
  notes: ""
};

function positiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function optionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function limitValue(value?: number | null, suffix = "") {
  return value == null ? "Not specified" : `${value.toLocaleString()}${suffix}`;
}

function leaveDetailPage() {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }

  window.location.assign(toBrowserPath("/"));
}

export function RateDetailsPage(props: {
  rateId: string;
  session: AuthSession;
  isUser: boolean;
  hasCustomerProfile: boolean;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  initialRate?: Rate;
  embedded?: boolean;
  onBack?: () => void;
  onCreateCustomerProfile?: () => void;
  onRequestCreated?: (request: QuoteRequest) => void;
}) {
  const isEmbedded = Boolean(props.embedded);
  const [rate, setRate] = useState<Rate | null>(() => props.initialRate ?? null);
  const [draft, setDraft] = useState<QuoteRequestDraft>({ ...initialRequestDraft, rateId: props.rateId });
  const [createdRequest, setCreatedRequest] = useState<QuoteRequest | null>(null);
  const [loading, setLoading] = useState(() => !props.initialRate);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft((current) => ({ ...current, rateId: props.rateId }));
    setCreatedRequest(null);
  }, [props.rateId]);

  useEffect(() => {
    let cancelled = false;

    async function loadRate() {
      if (props.initialRate?.id === props.rateId) {
        setRate(props.initialRate);
        setLoading(false);
        setError(null);
        return;
      }

      setRate(props.initialRate ?? null);
      setLoading(!props.initialRate);
      setError(null);
      try {
        const result = await api.getRate(props.session.accessToken, props.rateId);
        if (!cancelled) setRate(result);
      } catch (loadError) {
        if (!cancelled) {
          setError(getFriendlyErrorMessage(loadError));
          if (!props.initialRate) setRate(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadRate();
    return () => {
      cancelled = true;
    };
  }, [props.initialRate, props.rateId, props.session.accessToken]);

  const handleBack = props.onBack ?? leaveDetailPage;
  const canRequestQuote = props.isUser && props.hasCustomerProfile;
  const quoteRequestMeta = !props.isUser
    ? "User role required"
    : props.hasCustomerProfile
      ? "Email decision notice"
      : "Customer profile required";

  const validationMessage = useMemo(() => {
    if (!rate) return null;

    const gross = positiveNumber(draft.requestedGrossWeightKg);
    const net = positiveNumber(draft.requestedNetWeightKg);
    const volume = positiveNumber(draft.requestedVolumeCbm);
    const temperature = optionalNumber(draft.requiredTemperatureCelsius);

    if (!gross || !net || !volume) return "Gross weight, net weight, and volume must be greater than zero.";
    if (net > gross) return "Net weight cannot exceed gross weight.";
    if (rate.maxGrossWeightKg != null && gross > rate.maxGrossWeightKg) return "Gross weight exceeds this rate limit.";
    if (rate.maxNetWeightKg != null && net > rate.maxNetWeightKg) return "Net weight exceeds this rate limit.";
    if (rate.maxVolumeCbm != null && volume > rate.maxVolumeCbm) return "Volume exceeds this rate limit.";
    if (draft.isHazardous && rate.allowsHazardous === false) return "Hazardous cargo is not allowed for this rate.";
    if (temperature !== undefined && (temperature < -50 || temperature > 50)) return "Temperature must be between -50 and 50 Celsius.";
    if (temperature !== undefined && rate.minTemperatureCelsius != null && temperature < rate.minTemperatureCelsius) return "Temperature is below this rate range.";
    if (temperature !== undefined && rate.maxTemperatureCelsius != null && temperature > rate.maxTemperatureCelsius) return "Temperature is above this rate range.";

    return null;
  }, [draft, rate]);

  async function submitQuoteRequest(event: FormEvent) {
    event.preventDefault();
    if (!canRequestQuote) {
      setError("Create your customer profile before requesting a quote.");
      return;
    }
    if (!rate || validationMessage) return;

    const requestedGrossWeightKg = positiveNumber(draft.requestedGrossWeightKg);
    const requestedNetWeightKg = positiveNumber(draft.requestedNetWeightKg);
    const requestedVolumeCbm = positiveNumber(draft.requestedVolumeCbm);
    const requiredTemperatureCelsius = optionalNumber(draft.requiredTemperatureCelsius);

    if (!requestedGrossWeightKg || !requestedNetWeightKg || !requestedVolumeCbm) return;

    setBusy(true);
    setError(null);
    try {
      const request = await api.createQuoteRequestFromRate(props.session.accessToken, {
        rateId: rate.id,
        requestedGrossWeightKg,
        requestedNetWeightKg,
        requestedVolumeCbm,
        isHazardous: draft.isHazardous,
        requiredTemperatureCelsius,
        notes: draft.notes.trim().slice(0, 1000) || undefined
      });
      setCreatedRequest(request);
      props.onRequestCreated?.(request);
      setDraft({ ...initialRequestDraft, rateId: rate.id });
    } catch (requestError) {
      setError(getFriendlyErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`rate-detail-page ${isEmbedded ? "embedded" : ""}`}>
      {!isEmbedded && (
        <header className="rate-detail-topbar">
          <a className="rate-detail-brand" href={toBrowserPath("/")} target="_blank" rel="noopener noreferrer">
            <BrandLogo />
            <div>
              <strong>{BRAND_NAME}</strong>
              <span>Rate detail</span>
            </div>
          </a>
          <div className="rate-detail-actions">
            <button className="icon-button" type="button" onClick={props.onToggleTheme} title="Toggle theme" aria-label="Toggle theme">
              {props.theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="secondary-button compact" type="button" onClick={handleBack}>
              <ArrowLeft size={16} />
              Back to workspace
            </button>
          </div>
        </header>
      )}

      {loading && (
        <section className="rate-detail-shell">
          <LoadingSpinner label="Loading rate details" size="lg" />
        </section>
      )}

      {!loading && error && !rate && (
        <section className="rate-detail-shell">
          <div className="panel">
            <EmptyState
              icon={<ShieldCheck size={28} />}
              title="Rate could not be loaded"
              description={error}
              action={
                isEmbedded ? (
                  <button className="secondary-button compact" type="button" onClick={handleBack}>
                    <ArrowLeft size={16} />
                    Back to rates
                  </button>
                ) : undefined
              }
            />
          </div>
        </section>
      )}

      {!loading && rate && (
        <section className="rate-detail-shell">
          <div className="rate-detail-hero">
            <div>
              <span className="landing-kicker">Selected rate</span>
              <h1>
                {rate.carrierName} / {rate.fromPortCode} to {rate.toPortCode}
              </h1>
              <p>
                {rate.containerTypeName} container, valid from {formatShortDate(rate.validFrom)} to {formatShortDate(rate.validTo)}.
              </p>
            </div>
            <div className="rate-detail-price">
              <strong>{formatMoney(rate.price, rate.currency)}</strong>
              <StatusBadge status={rate.isActive ? "Active" : "Inactive"} />
              {isEmbedded && (
                <button className="secondary-button compact" type="button" onClick={handleBack}>
                  <ArrowLeft size={16} />
                  Back to rates
                </button>
              )}
            </div>
          </div>

          <div className="rate-detail-grid">
            <section className="panel">
              <PanelTitle icon={<Banknote size={18} />} title="Commercial details" />
              <div className="detail-grid">
                <MetricLine label="Carrier" value={rate.carrierName} />
                <MetricLine label="Route" value={`${rate.fromPortCode} to ${rate.toPortCode}`} />
                <MetricLine label="Container" value={rate.containerTypeName} />
                <MetricLine label="Price" value={formatMoney(rate.price, rate.currency)} />
                <MetricLine label="Created" value={formatDate(rate.createdAt)} />
              </div>
            </section>

            <section className="panel">
              <PanelTitle icon={<Weight size={18} />} title="Cargo limits" />
              <div className="detail-grid">
                <MetricLine label="Max gross weight" value={limitValue(rate.maxGrossWeightKg, " kg")} />
                <MetricLine label="Max net weight" value={limitValue(rate.maxNetWeightKg, " kg")} />
                <MetricLine label="Max volume" value={limitValue(rate.maxVolumeCbm, " CBM")} />
                <MetricLine label="Hazardous cargo" value={rate.allowsHazardous ? "Allowed" : "Not allowed"} />
                <MetricLine
                  label="Temperature"
                  value={
                    rate.minTemperatureCelsius != null && rate.maxTemperatureCelsius != null
                      ? `${rate.minTemperatureCelsius} to ${rate.maxTemperatureCelsius} C`
                      : "Not supported"
                  }
                />
              </div>
            </section>
          </div>

          <section className="panel quote-request-panel">
            <PanelTitle icon={<Send size={18} />} title="Request a quote" meta={quoteRequestMeta} />
            {props.isUser ? (
              <div className={`customer-action-lock ${canRequestQuote ? "" : "locked"}`}>
                <form className="quote-request-form" onSubmit={submitQuoteRequest} aria-hidden={!canRequestQuote}>
                  <div className="form-grid">
                    <Field label="Gross kg" error={validationMessage?.includes("Gross") ? validationMessage : undefined}>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={draft.requestedGrossWeightKg}
                        onChange={(event) => setDraft({ ...draft, requestedGrossWeightKg: event.target.value })}
                        disabled={!canRequestQuote}
                        required
                      />
                    </Field>
                    <Field label="Net kg" error={validationMessage?.includes("Net") ? validationMessage : undefined}>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={draft.requestedNetWeightKg}
                        onChange={(event) => setDraft({ ...draft, requestedNetWeightKg: event.target.value })}
                        disabled={!canRequestQuote}
                        required
                      />
                    </Field>
                    <Field label="Volume CBM" error={validationMessage?.includes("Volume") ? validationMessage : undefined}>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={draft.requestedVolumeCbm}
                        onChange={(event) => setDraft({ ...draft, requestedVolumeCbm: event.target.value })}
                        disabled={!canRequestQuote}
                        required
                      />
                    </Field>
                    <Field label="Temperature C" error={validationMessage?.includes("Temperature") ? validationMessage : undefined}>
                      <input
                        type="number"
                        min="-50"
                        max="50"
                        step="0.1"
                        value={draft.requiredTemperatureCelsius}
                        onChange={(event) => setDraft({ ...draft, requiredTemperatureCelsius: event.target.value })}
                        placeholder="Optional"
                        disabled={!canRequestQuote}
                      />
                    </Field>
                  </div>
                  <label className="check-row compact">
                    <input
                      type="checkbox"
                      checked={draft.isHazardous}
                      onChange={(event) => setDraft({ ...draft, isHazardous: event.target.checked })}
                      disabled={!canRequestQuote}
                    />
                    <span>Hazardous cargo</span>
                  </label>
                  <Field label="Notes" error={validationMessage?.includes("Hazardous") ? validationMessage : undefined}>
                    <textarea
                      value={draft.notes}
                      onChange={(event) => setDraft({ ...draft, notes: event.target.value.slice(0, 1000) })}
                      maxLength={1000}
                      rows={4}
                      placeholder="Optional operational notes"
                      disabled={!canRequestQuote}
                    />
                  </Field>
                  {validationMessage && <p className="field-error">{validationMessage}</p>}
                  {error && canRequestQuote && <p className="field-error">{error}</p>}
                  {createdRequest && (
                    <div className="request-success">
                      <CheckCircle2 size={18} />
                      <span>
                        Request submitted. We will email you when it is approved or rejected. Current status:{" "}
                        <StatusBadge status={createdRequest.status} group="quoteRequest" />
                      </span>
                    </div>
                  )}
                  <button className="primary-button" type="submit" disabled={busy || Boolean(validationMessage) || !rate.isActive || !canRequestQuote}>
                    {busy ? <LoadingSpinner size="sm" /> : <Send size={17} />}
                    {busy ? "Submitting" : "Request quote"}
                  </button>
                </form>
                {!canRequestQuote && (
                  <div className="customer-action-lock-overlay">
                    <ShieldCheck size={24} />
                    <div>
                      <strong>Customer profile required</strong>
                      <p>Create your customer profile to send this request for review and receive the decision by email.</p>
                    </div>
                    {props.onCreateCustomerProfile && (
                      <button className="primary-button compact" type="button" onClick={props.onCreateCustomerProfile}>
                        Create profile
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="quote-request-locked">
                <ShieldCheck size={22} />
                <p>Quote requests from a rate are available to customer users. Staff can review submitted requests from the Quotes workspace.</p>
                {!isEmbedded && (
                  <a href={toBrowserPath("/")} target="_blank" rel="noopener noreferrer">
                    Open workspace
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            )}
          </section>
        </section>
      )}
    </section>
  );
}
