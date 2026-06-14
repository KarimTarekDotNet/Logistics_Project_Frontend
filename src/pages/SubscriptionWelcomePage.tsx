import { ArrowLeft, ArrowRight, BadgePercent, Check, Crown, Moon, Sparkles, Sun } from "lucide-react";
import { BrandLogo } from "../components/brand/BrandLogo";
import { SubscriptionPlanBenefits } from "../components/subscriptions/SubscriptionPlanBenefits";
import { LoadingSpinner } from "../components/ui";
import { BRAND_NAME } from "../constants/brand";
import type { SubscriptionPlan } from "../types";
import { formatMoney } from "../utils/format";

export function SubscriptionWelcomePage(props: {
  plans: SubscriptionPlan[];
  plansLoading: boolean;
  paymentPlanId: string | null;
  busy: boolean;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onBackToLanding: () => void;
  onChoosePlan: (plan: SubscriptionPlan) => void;
  onSkip: () => void;
}) {
  const activePlans = props.plans
    .filter((plan) => plan.isActive && Number(plan.price) > 0)
    .sort((first, second) => first.price - second.price || first.title.localeCompare(second.title));

  return (
    <main className="subscription-welcome-page">
      <nav className="subscription-welcome-nav">
        <button className="landing-brand brand-button" type="button" onClick={props.onBackToLanding}>
          <BrandLogo />
          <div>
            <strong>{BRAND_NAME}</strong>
            <span>Subscriptions</span>
          </div>
        </button>
        <div>
          <button className="ghost-button compact" type="button" onClick={props.onBackToLanding}>
            <ArrowLeft size={15} />
            Back to site
          </button>
          <button className="landing-nav-theme" type="button" onClick={props.onToggleTheme} aria-label="Toggle theme">
            {props.theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </nav>

      <section className="subscription-welcome-content">
        <header className="subscription-welcome-hero">
          <span><Sparkles size={15} />Unlock the full FlowTix workspace</span>
          <h1>Before you open the dashboard, choose how far you want your operation to go.</h1>
          <p>
            Your free workspace remains available, but a subscription gives you clearer operating limits,
            connected logistics tools, and more room to manage rates, quotes, shipments, documents, and finance.
          </p>
          <div>
            <span><Check size={15} />Secure checkout through Paymob</span>
            <span><Check size={15} />Plan usage visible from Settings</span>
            <span><Check size={15} />Continue free whenever you are not ready</span>
          </div>
        </header>

        {props.plansLoading ? (
          <LoadingSpinner label="Loading subscription plans" />
        ) : activePlans.length === 0 ? (
          <div className="subscription-welcome-empty">
            <Crown size={28} />
            <strong>Paid plans are being prepared</strong>
            <p>You can continue to the free workspace now and review subscriptions later.</p>
          </div>
        ) : (
          <div className="subscription-welcome-grid">
            {activePlans.map((plan) => (
              <article className="subscription-welcome-card" key={plan.id}>
                <div className="subscription-welcome-card-head">
                  <span><Crown size={16} />{plan.title}</span>
                  <small>{plan.durationInDays} days</small>
                </div>
                <p>{plan.description}</p>
                <div className="subscription-welcome-offer">
                  <div>
                    <del>{formatMoney(plan.price + 300, "EGP")}</del>
                    <span><BadgePercent size={13} />Save EGP 300</span>
                  </div>
                  <strong>{formatMoney(plan.price, "EGP")}</strong>
                </div>
                <SubscriptionPlanBenefits plan={plan} />
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => props.onChoosePlan(plan)}
                  disabled={props.busy}
                >
                  {props.paymentPlanId === plan.id ? <LoadingSpinner size="sm" /> : <Crown size={16} />}
                  {props.paymentPlanId === plan.id ? "Opening Paymob" : `Choose ${plan.title}`}
                  {props.paymentPlanId !== plan.id && <ArrowRight size={16} />}
                </button>
              </article>
            ))}
          </div>
        )}

        <div className="subscription-welcome-skip">
          <span>You can upgrade later from Subscriptions or Settings.</span>
          <button type="button" onClick={props.onSkip}>
            Not now, continue to dashboard
            <ArrowRight size={15} />
          </button>
        </div>
      </section>
    </main>
  );
}
