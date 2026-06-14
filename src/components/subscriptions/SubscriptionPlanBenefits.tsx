import { Check, Gauge } from "lucide-react";
import type { SubscriptionPlan } from "../../types";

export function formatSubscriptionCode(code: string) {
  return code
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

export function SubscriptionPlanBenefits(props: { plan: SubscriptionPlan; compact?: boolean }) {
  const features = props.plan.subscriptionFeatureResponses ?? [];
  const limits = props.plan.subscriptionPlanLimitResponses ?? [];

  if (features.length === 0 && limits.length === 0) return null;

  return (
    <div className={`subscription-plan-benefits ${props.compact ? "compact" : ""}`}>
      {features.length > 0 && (
        <ul className="subscription-feature-list">
          {features.map((feature) => (
            <li key={feature.id || feature.code}>
              <Check size={15} />
              <span>
                <strong>{feature.name}</strong>
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
              <b>{limit.maxValue.toLocaleString("en-EG")}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
