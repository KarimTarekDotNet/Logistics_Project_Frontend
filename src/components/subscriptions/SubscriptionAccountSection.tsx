import { ArrowRight, CalendarDays, Crown, Gauge, RefreshCw } from "lucide-react";
import type { SubscriptionPlan, UserSubscription } from "../../types";
import { formatShortDate } from "../../utils/format";
import { EmptyState, LoadingSpinner, StatusBadge } from "../ui";
import { formatSubscriptionCode } from "./SubscriptionPlanBenefits";

function normalize(value?: string | null) {
  return String(value ?? "").trim().toLowerCase();
}

function findPlan(subscription: UserSubscription, plans: SubscriptionPlan[]) {
  return plans.find((plan) => normalize(plan.title) === normalize(subscription.subscriptionPlanTitle));
}

function UsageGrid(props: { subscription: UserSubscription; plan?: SubscriptionPlan }) {
  const usages = Array.isArray(props.subscription.usages) ? props.subscription.usages : [];

  if (usages.length === 0) {
    return <p className="subscription-account-empty-usage">Usage will appear here after you start using plan features.</p>;
  }

  return (
    <div className="subscription-account-usage-grid">
      {usages.map((usage) => {
        const limit = props.plan?.subscriptionPlanLimitResponses?.find(
          (item) => normalize(item.code) === normalize(usage.limitCode)
        );
        const usedValue = Number.isFinite(Number(usage.usedValue)) ? Number(usage.usedValue) : 0;
        const maxValue = limit && Number.isFinite(Number(limit.maxValue)) ? Number(limit.maxValue) : 0;
        const percent = maxValue > 0 ? Math.min(100, Math.max(0, (usedValue / maxValue) * 100)) : 0;

        return (
          <article className="subscription-account-usage-card" key={usage.id || usage.limitCode}>
            <div className="subscription-account-usage-head">
              <span><Gauge size={15} />{formatSubscriptionCode(usage.limitCode)}</span>
              <strong>{usedValue.toLocaleString("en-EG")} {maxValue > 0 ? `/ ${maxValue.toLocaleString("en-EG")}` : ""}</strong>
            </div>
            {maxValue > 0 && <progress max={100} value={percent} />}
            <small>{formatShortDate(usage.periodStart)} to {formatShortDate(usage.periodEnd)}</small>
          </article>
        );
      })}
    </div>
  );
}

export function SubscriptionAccountSection(props: {
  currentSubscriptions: UserSubscription[];
  subscriptions: UserSubscription[];
  plans: SubscriptionPlan[];
  loading: boolean;
  onRefresh: () => void;
  onBrowsePlans: () => void;
}) {
  const current = props.currentSubscriptions.find((subscription) => subscription.isActive);
  const currentPlan = current ? findPlan(current, props.plans) : undefined;

  return (
    <section className="panel settings-section subscription-account-section">
      <div className="settings-page-heading subscription-account-heading">
        <span className="settings-page-icon"><Crown size={20} /></span>
        <div>
          <h2>Subscription and usage</h2>
          <p>Track your active plan, renewal window, and every operational allowance from one place.</p>
        </div>
        <button className="secondary-button compact" type="button" onClick={props.onRefresh} disabled={props.loading}>
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      {props.loading ? (
        <LoadingSpinner label="Refreshing subscription" />
      ) : !current ? (
        <EmptyState
          icon={<Crown size={28} />}
          title="No active subscription"
          description="Choose a plan to unlock the subscription features and operating limits for your workspace."
          action={(
            <button className="primary-button" type="button" onClick={props.onBrowsePlans}>
              Browse plans <ArrowRight size={16} />
            </button>
          )}
        />
      ) : (
        <>
          <div className="subscription-account-current">
            <div className="subscription-account-current-copy">
              <div>
                <StatusBadge status="Active" />
                <span className="subscription-account-kicker">Current plan</span>
              </div>
              <h3>{current.subscriptionPlanTitle}</h3>
              <p>{currentPlan?.description || "Your workspace subscription is active and ready to use."}</p>
              <span className="subscription-account-dates">
                <CalendarDays size={15} />
                {formatShortDate(current.startDate)} to {formatShortDate(current.endDate)}
              </span>
            </div>
            <button className="secondary-button compact" type="button" onClick={props.onBrowsePlans}>
              View plans <ArrowRight size={15} />
            </button>
          </div>
          <UsageGrid subscription={current} plan={currentPlan} />
        </>
      )}

      {props.subscriptions.length > 0 && (
        <div className="subscription-account-history">
          <div>
            <strong>Subscription history</strong>
            <small>{props.subscriptions.length} records</small>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Started</th>
                  <th>Ends</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {props.subscriptions.map((subscription) => (
                  <tr key={subscription.id}>
                    <td>{subscription.subscriptionPlanTitle}</td>
                    <td>{formatShortDate(subscription.startDate)}</td>
                    <td>{formatShortDate(subscription.endDate)}</td>
                    <td><StatusBadge status={subscription.isActive ? "Active" : "Expired"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
