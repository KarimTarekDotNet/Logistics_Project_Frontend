import { BarChart3, Box, CheckCircle2, CircleDollarSign, Eye, Pencil, Plus, RotateCcw, Search, SlidersHorizontal, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ConfirmDialog, EmptyState, EntityActions, Field, MetricLine, PanelTitle, SectionHeader, StatusBadge } from "../components/ui";
import { CURRENCY_LOCK_NOTE, DEFAULT_CURRENCY } from "../constants/logistics";
import type { Carrier, ContainerType, MarketAnalytics, Rate, RateBookFilterDraft, RateDraft, RateRecommendationDraft, RateRecommendationResponse, RecommendationPriority, Route } from "../types";
import { formatMoney, formatShortDate, isoToLocalDateTime } from "../utils/format";

export type AnalyticsDraft = {
  routeId: string;
  containerId: string;
  currency: string;
};

const recommendationPriorities: RecommendationPriority[] = ["Cheapest", "Fastest", "Balanced", "Reliable"];

const rateSortOptions = [
  { value: "price_asc", label: "Price low to high" },
  { value: "price_desc", label: "Price high to low" },
  { value: "createdat_desc", label: "Newest created" },
  { value: "createdat_asc", label: "Oldest created" },
  { value: "validfrom_asc", label: "Valid from earliest" },
  { value: "validfrom_desc", label: "Valid from latest" },
  { value: "validto_asc", label: "Valid to earliest" },
  { value: "validto_desc", label: "Valid to latest" },
  { value: "name_asc", label: "Carrier A to Z" },
  { value: "name_desc", label: "Carrier Z to A" },
  { value: "type_asc", label: "Container A to Z" },
  { value: "type_desc", label: "Container Z to A" },
  { value: "route_asc", label: "Route A to Z" },
  { value: "route_desc", label: "Route Z to A" }
];

function CurrencyField() {
  return (
    <Field label="Currency" hint={CURRENCY_LOCK_NOTE}>
      <input className="currency-lock-input" value={DEFAULT_CURRENCY} readOnly aria-readonly="true" />
    </Field>
  );
}

function formatMarketPosition(value: string | number) {
  if (typeof value === "number") {
    return ["BelowMarket", "AverageMarket", "AboveMarket"][value] ?? "MarketPosition";
  }

  return value;
}

function draftFromRate(rate: Rate): RateDraft {
  return {
    carrierId: rate.carrierId,
    routeId: rate.routeId,
    containerTypeId: rate.containerTypeId,
    price: String(rate.price),
    currency: DEFAULT_CURRENCY,
    validFrom: isoToLocalDateTime(rate.validFrom),
    validTo: isoToLocalDateTime(rate.validTo),
    maxGrossWeightKg: rate.maxGrossWeightKg ? String(rate.maxGrossWeightKg) : "",
    maxNetWeightKg: rate.maxNetWeightKg ? String(rate.maxNetWeightKg) : "",
    maxVolumeCbm: rate.maxVolumeCbm ? String(rate.maxVolumeCbm) : "",
    allowsHazardous: Boolean(rate.allowsHazardous),
    minTemperatureCelsius: rate.minTemperatureCelsius != null ? String(rate.minTemperatureCelsius) : "",
    maxTemperatureCelsius: rate.maxTemperatureCelsius != null ? String(rate.maxTemperatureCelsius) : ""
  };
}

export function PricingPage(props: {
  rates: Rate[];
  carriers: Carrier[];
  routes: Route[];
  containerTypes: ContainerType[];
  isPrivileged: boolean;
  isAdmin: boolean;
  busy: boolean;
  mode: "ratebook" | "insights";
  onModeChange: (mode: "ratebook" | "insights") => void;
  onOpenRate: (rate: Rate) => void;
  draft: RateDraft;
  setDraft: (draft: RateDraft) => void;
  analyticsDraft: AnalyticsDraft;
  setAnalyticsDraft: (draft: AnalyticsDraft) => void;
  analytics: MarketAnalytics | null;
  rateFilters: RateBookFilterDraft;
  recommendationDraft: RateRecommendationDraft;
  setRecommendationDraft: (draft: RateRecommendationDraft) => void;
  recommendations: RateRecommendationResponse | null;
  onCreateRate: (event: FormEvent) => void;
  onUpdateRate: (id: string, draft: RateDraft) => Promise<unknown>;
  onDeleteRate: (id: string) => void;
  onToggleRate: (id: string) => void;
  onApplyRateFilters: (filters: RateBookFilterDraft) => void;
  onResetRateFilters: () => void;
  onLoadAnalytics: (event: FormEvent) => void;
  onLoadRecommendations: (event: FormEvent) => void;
}) {
  const {
    rates,
    carriers,
    routes,
    containerTypes,
    isPrivileged,
    isAdmin,
    busy,
    mode,
    onModeChange,
    onOpenRate,
    draft,
    setDraft,
    analyticsDraft,
    setAnalyticsDraft,
    analytics,
    rateFilters,
    recommendationDraft,
    setRecommendationDraft,
    recommendations,
    onCreateRate,
    onUpdateRate,
    onDeleteRate,
    onToggleRate,
    onApplyRateFilters,
    onResetRateFilters,
    onLoadAnalytics,
    onLoadRecommendations
  } = props;
  const [filterDraft, setFilterDraft] = useState<RateBookFilterDraft>(rateFilters);
  const [editingRate, setEditingRate] = useState<Rate | null>(null);
  const [editDraft, setEditDraft] = useState<RateDraft | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setFilterDraft(rateFilters);
  }, [rateFilters]);

  const activeFilterCount = useMemo(
    () =>
      [
        filterDraft.search,
        filterDraft.carrierName,
        filterDraft.containerTypeName,
        filterDraft.fromPortName,
        filterDraft.toPortName,
        filterDraft.minPrice,
        filterDraft.maxPrice,
        filterDraft.validFrom,
        filterDraft.validTo,
        filterDraft.createdFrom,
        filterDraft.createdTo,
        filterDraft.onlyActive,
        filterDraft.onlyCurrentlyValid
      ].filter(Boolean).length,
    [filterDraft]
  );

  const currentPage = Math.max(1, Number(filterDraft.pageNumber) || 1);
  const selectedPageSize = Math.min(50, Math.max(1, Number(filterDraft.pageSize) || 10));
  const pageButtons = useMemo(() => {
    const start = Math.max(1, currentPage - 2);
    return Array.from({ length: 5 }, (_, index) => start + index);
  }, [currentPage]);

  function applyFilterDraft(nextDraft: RateBookFilterDraft) {
    setFilterDraft(nextDraft);
    onApplyRateFilters(nextDraft);
  }

  async function submitEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingRate || !editDraft || busy) return;
    const result = await onUpdateRate(editingRate.id, editDraft);
    if (result) {
      setEditingRate(null);
      setEditDraft(null);
    }
  }

  return (
    <div className="view-stack">
      <SectionHeader icon={<CircleDollarSign size={22} />} title="Pricing" meta={`${rates.length} rate cards`}>
        <div className="workspace-tabs pricing-tabs">
          <button className={mode === "ratebook" ? "active" : ""} type="button" onClick={() => onModeChange("ratebook")}>
            <Box size={16} />
            Rate book
          </button>
          <button className={mode === "insights" ? "active" : ""} type="button" onClick={() => onModeChange("insights")}>
            <BarChart3 size={16} />
            Insights
          </button>
        </div>
      </SectionHeader>

      {mode === "ratebook" && isPrivileged && (
        <div className="pricing-create-region">
          <section className="panel">
            <PanelTitle icon={<Plus size={18} />} title={editingRate ? "Edit rate" : "New rate"} />
            <form className="rate-form" onSubmit={editingRate ? submitEdit : onCreateRate}>
              <Field label="Carrier">
                <select
                  value={editingRate ? editDraft?.carrierId ?? "" : draft.carrierId}
                  onChange={(event) =>
                    editingRate && editDraft
                      ? setEditDraft({ ...editDraft, carrierId: event.target.value })
                      : setDraft({ ...draft, carrierId: event.target.value })
                  }
                  disabled={Boolean(editingRate)}
                  required
                >
                  {!editingRate && <option value="">Select carrier</option>}
                  {carriers.map((carrier) => (
                    <option key={carrier.id} value={carrier.id}>
                      {carrier.name} ({carrier.code})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Route">
                <select
                  value={editingRate ? editDraft?.routeId ?? "" : draft.routeId}
                  onChange={(event) =>
                    editingRate && editDraft ? setEditDraft({ ...editDraft, routeId: event.target.value }) : setDraft({ ...draft, routeId: event.target.value })
                  }
                  disabled={Boolean(editingRate)}
                  required
                >
                  {!editingRate && <option value="">Select route</option>}
                  {routes.map((route) => (
                    <option key={route.id} value={route.id}>
                      {route.fromPortCode} to {route.toPortCode}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Container">
                <select
                  value={editingRate ? editDraft?.containerTypeId ?? "" : draft.containerTypeId}
                  onChange={(event) =>
                    editingRate && editDraft
                      ? setEditDraft({ ...editDraft, containerTypeId: event.target.value })
                      : setDraft({ ...draft, containerTypeId: event.target.value })
                  }
                  disabled={Boolean(editingRate)}
                  required
                >
                  {!editingRate && <option value="">Select container</option>}
                  {containerTypes.map((containerType) => (
                    <option key={containerType.id} value={containerType.id}>
                      {containerType.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Price">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={editingRate ? editDraft?.price ?? "" : draft.price}
                  onChange={(event) =>
                    editingRate && editDraft ? setEditDraft({ ...editDraft, price: event.target.value }) : setDraft({ ...draft, price: event.target.value })
                  }
                  required
                />
              </Field>
              <CurrencyField />
              <Field label="Valid from">
                <input
                  type="datetime-local"
                  value={editingRate ? editDraft?.validFrom ?? "" : draft.validFrom}
                  onChange={(event) =>
                    editingRate && editDraft ? setEditDraft({ ...editDraft, validFrom: event.target.value }) : setDraft({ ...draft, validFrom: event.target.value })
                  }
                  required
                />
              </Field>
              <Field label="Valid to">
                <input
                  type="datetime-local"
                  value={editingRate ? editDraft?.validTo ?? "" : draft.validTo}
                  onChange={(event) =>
                    editingRate && editDraft ? setEditDraft({ ...editDraft, validTo: event.target.value }) : setDraft({ ...draft, validTo: event.target.value })
                  }
                  required
                />
              </Field>
              <div className="rate-limits-grid">
                <Field label="Max gross kg">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={editingRate ? editDraft?.maxGrossWeightKg ?? "" : draft.maxGrossWeightKg}
                    onChange={(event) =>
                      editingRate && editDraft
                        ? setEditDraft({ ...editDraft, maxGrossWeightKg: event.target.value })
                        : setDraft({ ...draft, maxGrossWeightKg: event.target.value })
                    }
                    placeholder="Optional"
                  />
                </Field>
                <Field label="Max net kg">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={editingRate ? editDraft?.maxNetWeightKg ?? "" : draft.maxNetWeightKg}
                    onChange={(event) =>
                      editingRate && editDraft
                        ? setEditDraft({ ...editDraft, maxNetWeightKg: event.target.value })
                        : setDraft({ ...draft, maxNetWeightKg: event.target.value })
                    }
                    placeholder="Optional"
                  />
                </Field>
                <Field label="Max CBM">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={editingRate ? editDraft?.maxVolumeCbm ?? "" : draft.maxVolumeCbm}
                    onChange={(event) =>
                      editingRate && editDraft
                        ? setEditDraft({ ...editDraft, maxVolumeCbm: event.target.value })
                        : setDraft({ ...draft, maxVolumeCbm: event.target.value })
                    }
                    placeholder="Optional"
                  />
                </Field>
                <Field label="Min temp C">
                  <input
                    type="number"
                    step="0.1"
                    value={editingRate ? editDraft?.minTemperatureCelsius ?? "" : draft.minTemperatureCelsius}
                    onChange={(event) =>
                      editingRate && editDraft
                        ? setEditDraft({ ...editDraft, minTemperatureCelsius: event.target.value })
                        : setDraft({ ...draft, minTemperatureCelsius: event.target.value })
                    }
                    placeholder="Optional"
                  />
                </Field>
                <Field label="Max temp C">
                  <input
                    type="number"
                    step="0.1"
                    value={editingRate ? editDraft?.maxTemperatureCelsius ?? "" : draft.maxTemperatureCelsius}
                    onChange={(event) =>
                      editingRate && editDraft
                        ? setEditDraft({ ...editDraft, maxTemperatureCelsius: event.target.value })
                        : setDraft({ ...draft, maxTemperatureCelsius: event.target.value })
                    }
                    placeholder="Optional"
                  />
                </Field>
                <label className="check-row compact rate-haz-toggle">
                  <input
                    type="checkbox"
                    checked={editingRate ? Boolean(editDraft?.allowsHazardous) : draft.allowsHazardous}
                    onChange={(event) =>
                      editingRate && editDraft
                        ? setEditDraft({ ...editDraft, allowsHazardous: event.target.checked })
                        : setDraft({ ...draft, allowsHazardous: event.target.checked })
                    }
                  />
                  <span>Allows hazardous</span>
                </label>
              </div>
              <div className="button-row rate-form-actions">
                <button className="primary-button compact" type="submit" disabled={busy}>
                  {editingRate ? <CheckCircle2 size={17} /> : <Plus size={17} />}
                  {editingRate ? "Save" : "Create"}
                </button>
                {editingRate && (
                  <button
                    className="secondary-button compact"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setEditingRate(null);
                      setEditDraft(null);
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </section>
        </div>
      )}

      {mode === "insights" && (
        <div className="pricing-insights-grid">
        <section className="panel market-analytics-panel">
          <PanelTitle icon={<BarChart3 size={18} />} title="Market analytics" />
          <form className="form-stack" onSubmit={onLoadAnalytics}>
            <div className="form-grid">
              <Field label="Route">
                <select value={analyticsDraft.routeId} onChange={(event) => setAnalyticsDraft({ ...analyticsDraft, routeId: event.target.value })} required>
                  <option value="">Select route</option>
                  {routes.map((route) => (
                    <option key={route.id} value={route.id}>
                      {route.fromPortCode} to {route.toPortCode}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Container">
                <select
                  value={analyticsDraft.containerId}
                  onChange={(event) => setAnalyticsDraft({ ...analyticsDraft, containerId: event.target.value })}
                  required
                >
                  <option value="">Select container</option>
                  {containerTypes.map((containerType) => (
                    <option key={containerType.id} value={containerType.id}>
                      {containerType.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <CurrencyField />
            <button
              className="secondary-button compact"
              type="submit"
              disabled={busy || !analyticsDraft.routeId || !analyticsDraft.containerId}
            >
              <BarChart3 size={17} />
              Load analytics
            </button>
          </form>
          {analytics ? (
            <div className="analytics-dashboard">
              <div className="analytics-grid">
                <MetricLine label="Cheapest" value={formatMoney(analytics.cheapestPrice, analytics.currency)} />
                <MetricLine label="Average" value={formatMoney(analytics.averagePrice, analytics.currency)} />
                <MetricLine label="Highest" value={formatMoney(analytics.highestPrice, analytics.currency)} />
                <MetricLine label="Active count" value={analytics.activeCount} />
              </div>
              <div className="analytics-visuals">
                <div className="analytics-ring" aria-label={`${analytics.activeCount} active rates`}>
                  <div>
                    <strong>{analytics.activeCount}</strong>
                    <span>active rates</span>
                  </div>
                </div>
                <div className="price-comparison-chart" aria-label="Market price comparison">
                  {[
                    { label: "Cheapest", value: analytics.cheapestPrice },
                    { label: "Average", value: analytics.averagePrice },
                    { label: "Highest", value: analytics.highestPrice }
                  ].map((item) => (
                    <div className="price-comparison-row" key={item.label}>
                      <span>{item.label}</span>
                      <div>
                        <i style={{ width: `${Math.max(8, (item.value / Math.max(analytics.highestPrice, 1)) * 100)}%` }} />
                      </div>
                      <b>{formatMoney(item.value, analytics.currency)}</b>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="panel-note">Select a route and container type to review live USD market analytics.</p>
          )}
        </section>

        <section className="panel recommendation-panel">
          <PanelTitle
            icon={<Sparkles size={18} />}
            title="Rate recommendations"
            meta={recommendations ? `${recommendations.recommendations.length} options` : undefined}
          />
          <form className="form-stack" onSubmit={onLoadRecommendations}>
            <div className="form-grid">
              <Field label="Route">
                <select
                  value={recommendationDraft.routeId}
                  onChange={(event) => setRecommendationDraft({ ...recommendationDraft, routeId: event.target.value })}
                  required
                >
                  <option value="">Select route</option>
                  {routes.map((route) => (
                    <option key={route.id} value={route.id}>
                      {route.fromPortCode} to {route.toPortCode}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Container">
                <select
                  value={recommendationDraft.containerTypeId}
                  onChange={(event) => setRecommendationDraft({ ...recommendationDraft, containerTypeId: event.target.value })}
                  required
                >
                  <option value="">Select container</option>
                  {containerTypes.map((containerType) => (
                    <option key={containerType.id} value={containerType.id}>
                      {containerType.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="form-grid">
              <CurrencyField />
              <Field label="Priority">
                <select
                  value={recommendationDraft.priority}
                  onChange={(event) => setRecommendationDraft({ ...recommendationDraft, priority: event.target.value as RecommendationPriority })}
                >
                  {recommendationPriorities.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Max price">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={recommendationDraft.maxPrice}
                  onChange={(event) => setRecommendationDraft({ ...recommendationDraft, maxPrice: event.target.value })}
                  placeholder="Optional"
                />
              </Field>
              <Field label="Limit">
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={recommendationDraft.limit}
                  onChange={(event) => setRecommendationDraft({ ...recommendationDraft, limit: event.target.value })}
                  required
                />
              </Field>
            </div>
            <button
              className="primary-button compact"
              type="submit"
              disabled={busy || !recommendationDraft.routeId || !recommendationDraft.containerTypeId}
            >
              <Sparkles size={17} />
              Recommend rates
            </button>
          </form>

          {recommendations ? (
            recommendations.recommendations.length > 0 ? (
              <div className="recommendation-list">
                {recommendations.recommendations.map((item) => {
                  const marketPosition = formatMarketPosition(item.marketPosition);

                  return (
                    <article className={`recommendation-card ${item.isCheapest ? "is-cheapest" : ""}`} key={item.rate.id}>
                      <div className="recommendation-card-main">
                        <div>
                          <strong>{item.rate.carrierName}</strong>
                          <small>
                            {item.rate.fromPortCode} to {item.rate.toPortCode} - {item.rate.containerTypeName}
                          </small>
                        </div>
                        <b>{formatMoney(item.rate.price, item.rate.currency)}</b>
                      </div>
                      <div className="recommendation-card-meta">
                        <StatusBadge status={marketPosition} />
                        {item.isCheapest && <span className="rate-container-badge">Cheapest</span>}
                        <span>{item.score}/100 score</span>
                        {item.transitDays != null && <span>{item.transitDays} transit days</span>}
                        <span>Valid to {formatShortDate(item.rate.validTo)}</span>
                        <button className="inline-link inline-action" type="button" onClick={() => onOpenRate(item.rate)}>
                          <Eye size={13} />
                          Details
                        </button>
                      </div>
                      <p>{item.recommendationReason}</p>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState icon={<Sparkles size={24} />} title="No recommendations found" description="Try another route, container, or max price." />
            )
          ) : (
            <p className="panel-note">Ask the pricing engine for active rates ranked by your selected priority.</p>
          )}
        </section>
      </div>
      )}

      {mode === "ratebook" && (
      <section className="panel">
        <PanelTitle icon={<Box size={18} />} title="Rate book" meta={`${rates.length} shown`} />
        <form
          className="rate-filter-panel"
          onSubmit={(event) => {
            event.preventDefault();
            onApplyRateFilters(filterDraft);
          }}
        >
          <div className="rate-filter-head">
            <label className="rate-search-field">
              <Search size={17} />
              <input
                value={filterDraft.search}
                onChange={(event) => setFilterDraft({ ...filterDraft, search: event.target.value.slice(0, 100), pageNumber: "1" })}
                placeholder="Search carrier, route, port, country, container"
              />
            </label>
            <Field label="Sort by">
              <select value={filterDraft.sortBy} onChange={(event) => setFilterDraft({ ...filterDraft, sortBy: event.target.value, pageNumber: "1" })}>
                {rateSortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="rate-filter-grid">
            <Field label="Carrier">
              <input value={filterDraft.carrierName} onChange={(event) => setFilterDraft({ ...filterDraft, carrierName: event.target.value, pageNumber: "1" })} placeholder="Name" />
            </Field>
            <Field label="Container">
              <input
                value={filterDraft.containerTypeName}
                onChange={(event) => setFilterDraft({ ...filterDraft, containerTypeName: event.target.value, pageNumber: "1" })}
                placeholder="20Ft, Reefer..."
              />
            </Field>
            <Field label="From port">
              <input value={filterDraft.fromPortName} onChange={(event) => setFilterDraft({ ...filterDraft, fromPortName: event.target.value, pageNumber: "1" })} placeholder="Name, code, country" />
            </Field>
            <Field label="To port">
              <input value={filterDraft.toPortName} onChange={(event) => setFilterDraft({ ...filterDraft, toPortName: event.target.value, pageNumber: "1" })} placeholder="Name, code, country" />
            </Field>
            <Field label="Min price">
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={filterDraft.minPrice}
                onChange={(event) => setFilterDraft({ ...filterDraft, minPrice: event.target.value, pageNumber: "1" })}
              />
            </Field>
            <Field label="Max price">
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={filterDraft.maxPrice}
                onChange={(event) => setFilterDraft({ ...filterDraft, maxPrice: event.target.value, pageNumber: "1" })}
              />
            </Field>
            <CurrencyField />
            <Field label="Valid from">
              <input type="datetime-local" value={filterDraft.validFrom} onChange={(event) => setFilterDraft({ ...filterDraft, validFrom: event.target.value, pageNumber: "1" })} />
            </Field>
            <Field label="Valid to">
              <input type="datetime-local" value={filterDraft.validTo} onChange={(event) => setFilterDraft({ ...filterDraft, validTo: event.target.value, pageNumber: "1" })} />
            </Field>
            <Field label="Created from">
              <input type="datetime-local" value={filterDraft.createdFrom} onChange={(event) => setFilterDraft({ ...filterDraft, createdFrom: event.target.value, pageNumber: "1" })} />
            </Field>
            <Field label="Created to">
              <input type="datetime-local" value={filterDraft.createdTo} onChange={(event) => setFilterDraft({ ...filterDraft, createdTo: event.target.value, pageNumber: "1" })} />
            </Field>
          </div>

          <div className="rate-filter-footer">
            <div className="rate-filter-toggles">
              <label className="check-row compact">
                <input type="checkbox" checked={filterDraft.onlyActive} onChange={(event) => setFilterDraft({ ...filterDraft, onlyActive: event.target.checked, pageNumber: "1" })} />
                <span>Active only</span>
              </label>
              <label className="check-row compact">
                <input
                  type="checkbox"
                  checked={filterDraft.onlyCurrentlyValid}
                  onChange={(event) => setFilterDraft({ ...filterDraft, onlyCurrentlyValid: event.target.checked, pageNumber: "1" })}
                />
                <span>Currently valid</span>
              </label>
              <span className="filter-count">
                <SlidersHorizontal size={14} />
                {activeFilterCount} active
              </span>
            </div>
            <div className="button-row">
              <button className="secondary-button compact" type="button" onClick={onResetRateFilters} disabled={busy}>
                <RotateCcw size={16} />
                Reset
              </button>
              <button className="primary-button compact" type="submit" disabled={busy}>
                <SlidersHorizontal size={16} />
                Apply filters
              </button>
            </div>
          </div>
        </form>

        {rates.length > 0 ? (
          <div className="rate-list">
            {rates.map((rate) => (
              <article className={`rate-list-item ${rate.isActive ? "" : "inactive"}`} key={rate.id}>
                <div className="rate-list-left">
                  <div className="rate-list-carrier">
                    <strong>{rate.carrierName}</strong>
                    <span className="rate-container-badge">{rate.containerTypeName}</span>
                  </div>
                  <div className="rate-list-route">
                    <span className="port-tag">{rate.fromPortCode}</span>
                    <span className="route-arrow">to</span>
                    <span className="port-tag">{rate.toPortCode}</span>
                  </div>
                  <div className="rate-limit-chips" aria-label="Rate cargo limits">
                    {rate.maxGrossWeightKg != null && <span>{rate.maxGrossWeightKg} kg gross</span>}
                    {rate.maxNetWeightKg != null && <span>{rate.maxNetWeightKg} kg net</span>}
                    {rate.maxVolumeCbm != null && <span>{rate.maxVolumeCbm} CBM</span>}
                    {rate.allowsHazardous && <span>Hazardous allowed</span>}
                    {rate.minTemperatureCelsius != null && rate.maxTemperatureCelsius != null && (
                      <span>
                        {rate.minTemperatureCelsius} to {rate.maxTemperatureCelsius} C
                      </span>
                    )}
                  </div>
                </div>

                <div className="rate-list-center">
                  <small>Valid window</small>
                  <span>
                    {formatShortDate(rate.validFrom)} - {formatShortDate(rate.validTo)}
                  </span>
                </div>

                <div className="rate-list-right">
                  <b className="rate-price">{formatMoney(rate.price, rate.currency)}</b>
                  <StatusBadge status={rate.isActive ? "Active" : "Inactive"} />
                  <button className="mini-button" type="button" onClick={() => onOpenRate(rate)} title="Open rate details">
                    <Eye size={14} />
                    Details
                  </button>
                  {isPrivileged && (
                    <EntityActions>
                      {isAdmin && (
                        <button className="mini-button" type="button" onClick={() => onToggleRate(rate.id)} disabled={busy}>
                          {rate.isActive ? "Deactivate" : "Activate"}
                        </button>
                      )}
                      <button
                        className="icon-mini"
                        type="button"
                        title="Edit rate"
                        onClick={() => {
                          setEditingRate(rate);
                          setEditDraft(draftFromRate(rate));
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                      {isAdmin && (
                        <button className="icon-mini danger" type="button" title="Delete rate" onClick={() => setDeleteId(rate.id)}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </EntityActions>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState icon={<CircleDollarSign size={28} />} title="No rates found" description="Adjust filters or create a new rate card." />
        )}

        <div className="rate-pagination-bar" aria-label="Rate book pagination">
          <div className="pagination-group">
            <span>Page size</span>
            {[10, 20, 50].map((size) => (
              <button
                className={selectedPageSize === size ? "active" : ""}
                type="button"
                key={size}
                disabled={busy}
                onClick={() => applyFilterDraft({ ...filterDraft, pageSize: String(size), pageNumber: "1" })}
              >
                {size}
              </button>
            ))}
          </div>
          <div className="pagination-group">
            <span>Page</span>
            <button type="button" disabled={busy || currentPage === 1} onClick={() => applyFilterDraft({ ...filterDraft, pageNumber: String(currentPage - 1) })}>
              Prev
            </button>
            {pageButtons.map((page) => (
              <button
                className={currentPage === page ? "active" : ""}
                type="button"
                key={page}
                disabled={busy}
                onClick={() => applyFilterDraft({ ...filterDraft, pageNumber: String(page) })}
              >
                {page}
              </button>
            ))}
            <button type="button" disabled={busy || rates.length < selectedPageSize} onClick={() => applyFilterDraft({ ...filterDraft, pageNumber: String(currentPage + 1) })}>
              Next
            </button>
          </div>
        </div>
      </section>
      )}

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete rate"
        message="This removes the rate card from the pricing engine. Existing quotes remain unchanged."
        confirmLabel="Delete rate"
        tone="danger"
        busy={busy}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (!deleteId) return;
          onDeleteRate(deleteId);
          setDeleteId(null);
        }}
      />
    </div>
  );
}
