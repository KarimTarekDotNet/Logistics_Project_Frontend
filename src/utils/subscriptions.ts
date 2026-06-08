const PENDING_SUBSCRIPTION_PLAN_KEY = "flowtix:pending-subscription-plan";

export function savePendingSubscriptionPlan(planId: string) {
  sessionStorage.setItem(PENDING_SUBSCRIPTION_PLAN_KEY, planId);
}

export function loadPendingSubscriptionPlan() {
  return sessionStorage.getItem(PENDING_SUBSCRIPTION_PLAN_KEY) ?? "";
}

export function clearPendingSubscriptionPlan() {
  sessionStorage.removeItem(PENDING_SUBSCRIPTION_PLAN_KEY);
}
