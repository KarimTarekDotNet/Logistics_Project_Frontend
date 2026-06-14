import { Check, Gauge } from "lucide-react";
import type { SubscriptionPlan } from "../../types";

export function formatSubscriptionCode(code: string) {
  return String(code ?? "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim() || "Usage";
}

export function SubscriptionPlanBenefits(props: { plan: SubscriptionPlan; compact?: boolean }) {
  const features = Array.isArray(props.plan.subscriptionFeatureResponses)
    ? props.plan.subscriptionFeatureResponses
    : [];
  const limits = Array.isArray(props.plan.subscriptionPlanLimitResponses)
    ? props.plan.subscriptionPlanLimitResponses
    : [];

  if (features.length === 0 && limits.length === 0) return null;

  return (
    <div className={`subscription-plan-benefits ${props.compact ? "compact" : ""}`}>
      {features.length > 0 && (
        <ul className="subscription-feature-list">
          {features.map((feature) => (
            <li key={feature.id || feature.code}>
              <Check size={15} />
              <span>
                <strong>{feature.name || formatSubscriptionCode(feature.code)}</strong>
                <small>{formatSubscriptionCode(feature.code)}</small>
              </span>
            </li>
          ))}
        </ul>
      )}
      {limits.length > 0 && (
        <div className="subscription-limit-list">
          {limits.map((limit) => (
            <span key={limit.id || limit.code}>
              <Gauge size={14} />
              <strong>{formatSubscriptionCode(limit.code)}</strong>
              <b>{(Number.isFinite(Number(limit.maxValue)) ? Number(limit.maxValue) : 0).toLocaleString("en-EG")}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
