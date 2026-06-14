import { Activity, Check, CreditCard, Crown, Pencil, Plus, Save, Trash2, UserRound } from "lucide-react";
import { useEffect, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { formatSubscriptionCode, SubscriptionPlanBenefits } from "../components/subscriptions/SubscriptionPlanBenefits";
import { EmptyState, Field, LoadingSpinner, PanelTitle, SectionHeader, StatusBadge } from "../components/ui";
import { DateOfBirthInput } from "./AccountPage";
import type {
  AppLanguage,
  CreateSubscriptionPlanRequest,
  Customer,
  CustomerDraft,
  SubscriptionPlan,
  UserSubscription
} from "../types";
import { formatMoney, formatShortDate } from "../utils/format";

type SubscriptionFeatureDraft = {
  code: string;
  name: string;
};

type SubscriptionLimitDraft = {
  code: string;
  maxValue: string;
};

type PlanDraft = {
  title: string;
  description: string;
  price: string;
  durationInDays: string;
  features: SubscriptionFeatureDraft[];
  limits: SubscriptionLimitDraft[];
};

type SubscriptionFeatureErrors = Partial<Record<keyof SubscriptionFeatureDraft, string>>;
type SubscriptionLimitErrors = Partial<Record<keyof SubscriptionLimitDraft, string>>;
type PlanDraftErrors = Partial<Record<"title" | "description" | "price" | "durationInDays" | "features" | "limits", string>> & {
  featureRows?: SubscriptionFeatureErrors[];
  limitRows?: SubscriptionLimitErrors[];
};

function createEmptyPlanDraft(): PlanDraft {
  return {
    title: "",
    description: "",
    price: "",
    durationInDays: "30",
    features: [{ code: "", name: "" }],
    limits: [{ code: "", maxValue: "" }]
  };
}

function validatePlanDraft(draft: PlanDraft) {
  const errors: PlanDraftErrors = {};
  const title = draft.title.trim();
  const description = draft.description.trim();
  const price = Number(draft.price);
  const durationInDays = Number(draft.durationInDays);
  const createSubscriptionFeatures = draft.features.map((feature) => ({
    code: feature.code.trim(),
    name: feature.name.trim()
  }));
  const createSubscriptionPlanLimits = draft.limits.map((limit) => ({
    code: limit.code.trim(),
    maxValue: Number(limit.maxValue)
  }));

  if (!title) errors.title = "Title is required.";
  else if (title.length < 3) errors.title = "Title must be at least 3 characters.";
  else if (title.length > 100) errors.title = "Title cannot exceed 100 characters.";

  if (!description) errors.description = "Description is required.";
  else if (description.length < 10) errors.description = "Description must be at least 10 characters.";
  else if (description.length > 500) errors.description = "Description cannot exceed 500 characters.";

  if (!Number.isFinite(price) || price <= 0) errors.price = "Price must be greater than 0.";
  if (!Number.isInteger(durationInDays) || durationInDays <= 0) {
    errors.durationInDays = "Duration must be a whole number greater than 0.";
  }

  if (createSubscriptionFeatures.length === 0) {
    errors.features = "At least one feature is required.";
  } else {
    const featureRows = createSubscriptionFeatures.map<SubscriptionFeatureErrors>((feature) => {
      const rowErrors: SubscriptionFeatureErrors = {};
      if (!feature.code) rowErrors.code = "Feature code is required.";
      else if (feature.code.length > 100) rowErrors.code = "Feature code cannot exceed 100 characters.";
      if (!feature.name) rowErrors.name = "Feature name is required.";
      else if (feature.name.length > 150) rowErrors.name = "Feature name cannot exceed 150 characters.";
      return rowErrors;
    });
    if (featureRows.some((row) => Object.keys(row).length > 0)) errors.featureRows = featureRows;
  }

  if (createSubscriptionPlanLimits.length === 0) {
    errors.limits = "At least one limit is required.";
  } else {
    const limitRows = createSubscriptionPlanLimits.map<SubscriptionLimitErrors>((limit) => {
      const rowErrors: SubscriptionLimitErrors = {};
      if (!limit.code) rowErrors.code = "Limit code is required.";
      else if (limit.code.length > 100) rowErrors.code = "Limit code cannot exceed 100 characters.";
      if (!Number.isFinite(limit.maxValue) || limit.maxValue <= 0) {
        rowErrors.maxValue = "Max value must be greater than 0.";
      }
      return rowErrors;
    });
    if (limitRows.some((row) => Object.keys(row).length > 0)) errors.limitRows = limitRows;
  }

  return {
    errors,
    payload: Object.keys(errors).length === 0
      ? {
          title,
          description,
          currency: "EGP",
          price,
          durationInDays,
          createSubscriptionFeatures,
          createSubscriptionPlanLimits
        } satisfies CreateSubscriptionPlanRequest
      : null
  };
}

function planToDraft(plan: SubscriptionPlan): PlanDraft {
  const features = (plan.subscriptionFeatureResponses ?? []).map((feature) => ({
    code: feature.code,
    name: feature.name
  }));
  const limits = (plan.subscriptionPlanLimitResponses ?? []).map((limit) => ({
    code: limit.code,
    maxValue: String(limit.maxValue)
  }));

  return {
    title: plan.title,
    description: plan.description,
    price: String(plan.price),
    durationInDays: String(plan.durationInDays),
    features: features.length > 0 ? features : [{ code: "", name: "" }],
    limits: limits.length > 0 ? limits : [{ code: "", maxValue: "" }]
  };
}

function SubscriptionUsage(props: { subscription: UserSubscription; plan?: SubscriptionPlan; compact?: boolean }) {
  const usages = props.subscription.usages ?? [];
  if (usages.length === 0) return <small className="subscription-usage-empty">No usage recorded yet.</small>;

  return (
    <div className={`subscription-usage-list ${props.compact ? "compact" : ""}`}>
      {usages.map((usage) => {
        const limit = props.plan?.subscriptionPlanLimitResponses?.find(
          (item) => item.code.toLowerCase() === usage.limitCode.toLowerCase()
        );
        const percent = limit?.maxValue
          ? Math.min(100, Math.max(0, (usage.usedValue / limit.maxValue) * 100))
          : 0;

        return (
          <div className="subscription-usage-item" key={usage.id || usage.limitCode}>
            <div>
              <span>{formatSubscriptionCode(usage.limitCode)}</span>
              <strong>
                {usage.usedValue.toLocaleString("en-EG")}
                {limit ? ` / ${limit.maxValue.toLocaleString("en-EG")}` : ""}
              </strong>
            </div>
            {limit && <progress max={100} value={percent} aria-label={`${usage.limitCode} usage`} />}
            {!props.compact && (
              <small>{formatShortDate(usage.periodStart)} to {formatShortDate(usage.periodEnd)}</small>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PlanDraftFields(props: {
  draft: PlanDraft;
  errors: PlanDraftErrors;
  setDraft: Dispatch<SetStateAction<PlanDraft>>;
  setErrors: Dispatch<SetStateAction<PlanDraftErrors>>;
}) {
  function updateBaseField(field: "title" | "description" | "price" | "durationInDays", value: string) {
    props.setDraft((current) => ({ ...current, [field]: value }));
    props.setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function updateFeature(index: number, field: keyof SubscriptionFeatureDraft, value: string) {
    props.setDraft((current) => ({
      ...current,
      features: current.features.map((feature, rowIndex) =>
        rowIndex === index ? { ...feature, [field]: value } : feature
      )
    }));
    props.setErrors((current) => ({
      ...current,
      featureRows: current.featureRows?.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: undefined } : row
      )
    }));
  }

  function updateLimit(index: number, field: keyof SubscriptionLimitDraft, value: string) {
    props.setDraft((current) => ({
      ...current,
      limits: current.limits.map((limit, rowIndex) =>
        rowIndex === index ? { ...limit, [field]: value } : limit
      )
    }));
    props.setErrors((current) => ({
      ...current,
      limitRows: current.limitRows?.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: undefined } : row
      )
    }));
  }

  return (
    <>
      <div className="subscription-plan-core-fields">
        <Field label="Title" error={props.errors.title}>
          <input
            value={props.draft.title}
            onChange={(event) => updateBaseField("title", event.target.value.slice(0, 100))}
            minLength={3}
            maxLength={100}
            required
          />
        </Field>
        <Field label="Price (EGP)" error={props.errors.price}>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={props.draft.price}
            onChange={(event) => updateBaseField("price", event.target.value)}
            required
          />
        </Field>
        <Field label="Duration (days)" error={props.errors.durationInDays}>
          <input
            type="number"
            min="1"
            step="1"
            value={props.draft.durationInDays}
            onChange={(event) => updateBaseField("durationInDays", event.target.value)}
            required
          />
        </Field>
        <Field label="Description" error={props.errors.description}>
          <textarea
            value={props.draft.description}
            onChange={(event) => updateBaseField("description", event.target.value.slice(0, 500))}
            minLength={10}
            maxLength={500}
            required
          />
        </Field>
      </div>

      <div className="subscription-plan-definition-grid">
        <section className="subscription-plan-collection">
          <div className="subscription-plan-collection-head">
            <div>
              <strong>Features</strong>
              <small>Every plan must include at least one feature.</small>
            </div>
            <button
              className="secondary-button compact"
              type="button"
              onClick={() => {
                props.setDraft((current) => ({
                  ...current,
                  features: [...current.features, { code: "", name: "" }]
                }));
                props.setErrors((current) => ({ ...current, features: undefined }));
              }}
            >
              <Plus size={14} />Add feature
            </button>
          </div>
          {props.errors.features && <small className="field-error">{props.errors.features}</small>}
          <div className="subscription-plan-rows">
            {props.draft.features.map((feature, index) => (
              <div className="subscription-plan-row feature-row" key={`feature-${index}`}>
                <Field label={`Feature ${index + 1} code`} error={props.errors.featureRows?.[index]?.code}>
                  <input
                    value={feature.code}
                    onChange={(event) => updateFeature(index, "code", event.target.value.slice(0, 100))}
                    maxLength={100}
                    required
                  />
                </Field>
                <Field label="Name" error={props.errors.featureRows?.[index]?.name}>
                  <input
                    value={feature.name}
                    onChange={(event) => updateFeature(index, "name", event.target.value.slice(0, 150))}
                    maxLength={150}
                    required
                  />
                </Field>
                <button
                  className="mini-button danger subscription-row-remove"
                  type="button"
                  aria-label={`Remove feature ${index + 1}`}
                  onClick={() => props.setDraft((current) => ({
                    ...current,
                    features: current.features.filter((_, rowIndex) => rowIndex !== index)
                  }))}
                  disabled={props.draft.features.length === 1}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="subscription-plan-collection">
          <div className="subscription-plan-collection-head">
            <div>
              <strong>Limits</strong>
              <small>Every plan must include at least one positive limit.</small>
            </div>
            <button
              className="secondary-button compact"
              type="button"
              onClick={() => {
                props.setDraft((current) => ({
                  ...current,
                  limits: [...current.limits, { code: "", maxValue: "" }]
                }));
                props.setErrors((current) => ({ ...current, limits: undefined }));
              }}
            >
              <Plus size={14} />Add limit
            </button>
          </div>
          {props.errors.limits && <small className="field-error">{props.errors.limits}</small>}
          <div className="subscription-plan-rows">
            {props.draft.limits.map((limit, index) => (
              <div className="subscription-plan-row limit-row" key={`limit-${index}`}>
                <Field label={`Limit ${index + 1} code`} error={props.errors.limitRows?.[index]?.code}>
                  <input
                    value={limit.code}
                    onChange={(event) => updateLimit(index, "code", event.target.value.slice(0, 100))}
                    maxLength={100}
                    required
                  />
                </Field>
                <Field label="Max value" error={props.errors.limitRows?.[index]?.maxValue}>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={limit.maxValue}
                    onChange={(event) => updateLimit(index, "maxValue", event.target.value)}
                    required
                  />
                </Field>
                <button
                  className="mini-button danger subscription-row-remove"
                  type="button"
                  aria-label={`Remove limit ${index + 1}`}
                  onClick={() => props.setDraft((current) => ({
                    ...current,
                    limits: current.limits.filter((_, rowIndex) => rowIndex !== index)
                  }))}
                  disabled={props.draft.limits.length === 1}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function sortPlansByPrice(plans: SubscriptionPlan[]) {
  return [...plans].sort((first, second) => first.price - second.price || first.title.localeCompare(second.title));
}

export function SubscriptionsPage(props: {
  plans: SubscriptionPlan[];
  subscriptions: UserSubscription[];
  currentSubscriptions: UserSubscription[];
  selectedPlanId: string;
  currentCustomer?: Customer;
  customerDraft: CustomerDraft;
  setCustomerDraft: (draft: CustomerDraft) => void;
  isPrivileged: boolean;
  isUser: boolean;
  busy: boolean;
  loading: boolean;
  language: AppLanguage;
  paymentPlanId?: string | null;
  onSelectPlan: (planId: string) => void;
  onStartPayment: (plan: SubscriptionPlan) => void;
  onSaveCustomer: (event: FormEvent) => void;
  onCreatePlan: (body: CreateSubscriptionPlanRequest) => Promise<boolean>;
  onUpdatePlan: (id: string, body: CreateSubscriptionPlanRequest) => Promise<boolean>;
  onDeletePlan: (id: string) => void;
}) {
  const [createDraft, setCreateDraft] = useState<PlanDraft>(createEmptyPlanDraft);
  const [createErrors, setCreateErrors] = useState<PlanDraftErrors>({});
  const [editingPlanId, setEditingPlanId] = useState("");
  const [editDraft, setEditDraft] = useState<PlanDraft>(createEmptyPlanDraft);
  const [editErrors, setEditErrors] = useState<PlanDraftErrors>({});
  const selectedPlan = props.plans.find((plan) => plan.id === props.selectedPlanId);
  const activeTitles = new Set(
    props.currentSubscriptions.filter((subscription) => subscription.isActive).map((subscription) => subscription.subscriptionPlanTitle.toLowerCase())
  );
  const sortedPlans = sortPlansByPrice(props.plans);

  useEffect(() => {
    if (!props.selectedPlanId) return;
    window.setTimeout(() => {
      document.getElementById(`subscription-plan-${props.selectedPlanId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  }, [props.selectedPlanId]);

  async function submitCreate(event: FormEvent) {
    event.preventDefault();
    const { errors, payload } = validatePlanDraft(createDraft);
    setCreateErrors(errors);
    if (!payload) return;
    if (await props.onCreatePlan(payload)) {
      setCreateDraft(createEmptyPlanDraft());
      setCreateErrors({});
    }
  }

  async function submitUpdate(event: FormEvent, planId: string) {
    event.preventDefault();
    const { errors, payload } = validatePlanDraft(editDraft);
    setEditErrors(errors);
    if (!payload) return;
    if (await props.onUpdatePlan(planId, payload)) {
      setEditingPlanId("");
      setEditErrors({});
    }
  }

  if (props.isUser && !props.currentCustomer) {
    return (
      <div className="view-stack subscriptions-page">
        <SectionHeader icon={<Crown size={22} />} title="Complete your subscription" meta="Customer setup">
          {selectedPlan && <StatusBadge status={selectedPlan.title} />}
        </SectionHeader>

        <div className="subscription-onboarding-grid">
          <section className="panel selected-plan-summary">
            <PanelTitle icon={<Crown size={18} />} title="Selected plan" />
            {selectedPlan ? (
              <>
                <span className="subscription-step">Step 1 complete</span>
                <h2>{selectedPlan.title}</h2>
                <p>{selectedPlan.description}</p>
                <strong>{formatMoney(selectedPlan.price, "EGP")}</strong>
                <small>{selectedPlan.durationInDays} days of access</small>
                <SubscriptionPlanBenefits plan={selectedPlan} compact />
              </>
            ) : (
              <EmptyState icon={<Crown size={28} />} title="Choose a plan" description="Select a subscription after creating your customer profile." />
            )}
          </section>

          <section className="panel">
            <PanelTitle icon={<UserRound size={18} />} title="Create customer profile" meta="Step 2" />
            <p className="panel-note">Choose individual or company, complete the required details, then continue directly to secure checkout.</p>
            <form className="customer-form subscription-customer-form" onSubmit={props.onSaveCustomer}>
              <div className="segmented inline">
                <button
                  type="button"
                  className={props.customerDraft.mode === "individual" ? "active" : ""}
                  onClick={() => props.setCustomerDraft({ ...props.customerDraft, mode: "individual", companyName: "", taxNumber: "" })}
                >
                  Individual
                </button>
                <button
                  type="button"
                  className={props.customerDraft.mode === "company" ? "active" : ""}
                  onClick={() => props.setCustomerDraft({ ...props.customerDraft, mode: "company", nationalId: "" })}
                >
                  Company
                </button>
              </div>

              {props.customerDraft.mode === "individual" ? (
                <div className="form-grid">
                  <Field label="National number">
                    <input
                      className="numeric-input"
                      inputMode="numeric"
                      value={props.customerDraft.nationalId}
                      onChange={(event) => props.setCustomerDraft({ ...props.customerDraft, nationalId: event.target.value.replace(/\D/g, "") })}
                      required
                    />
                  </Field>
                  <Field label="Date of birth">
                    <DateOfBirthInput
                      value={props.customerDraft.dateOfBirth}
                      language={props.language}
                      onChange={(dateOfBirth) => props.setCustomerDraft({ ...props.customerDraft, dateOfBirth })}
                    />
                  </Field>
                </div>
              ) : (
                <div className="form-grid">
                  <Field label="Company name">
                    <input
                      value={props.customerDraft.companyName}
                      onChange={(event) => props.setCustomerDraft({ ...props.customerDraft, companyName: event.target.value })}
                      required
                    />
                  </Field>
                  <Field label="Country code">
                    <input
                      className="latin-input"
                      value={props.customerDraft.countryCode}
                      onChange={(event) => props.setCustomerDraft({ ...props.customerDraft, countryCode: event.target.value.toUpperCase().slice(0, 2) })}
                      maxLength={2}
                      required
                    />
                  </Field>
                  <Field label="Tax number">
                    <input
                      className="numeric-input"
                      inputMode="numeric"
                      value={props.customerDraft.taxNumber}
                      onChange={(event) => props.setCustomerDraft({ ...props.customerDraft, taxNumber: event.target.value.replace(/\D/g, "") })}
                      required
                    />
                  </Field>
                  <Field label="Date of birth">
                    <DateOfBirthInput
                      value={props.customerDraft.dateOfBirth}
                      language={props.language}
                      onChange={(dateOfBirth) => props.setCustomerDraft({ ...props.customerDraft, dateOfBirth })}
                    />
                  </Field>
                </div>
              )}

              <button className="primary-button" type="submit" disabled={props.busy}>
                {props.busy ? <LoadingSpinner size="sm" /> : <CreditCard size={17} />}
                {selectedPlan ? "Create customer and continue to payment" : "Create customer profile"}
              </button>
            </form>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="view-stack subscriptions-page">
      <SectionHeader
        icon={<Crown size={22} />}
        title={props.isPrivileged ? "Subscription plans" : "Subscriptions"}
        meta={props.isPrivileged ? `${props.plans.length} plans` : `${props.currentSubscriptions.length} active`}
      />

      {!props.isPrivileged && props.currentSubscriptions.length > 0 && (
        <section className="panel current-subscriptions-panel">
          <PanelTitle icon={<Check size={18} />} title="Current subscription" meta={`${props.currentSubscriptions.length} active`} />
          <div className="current-subscription-grid">
            {props.currentSubscriptions.map((subscription) => {
              const plan = props.plans.find(
                (item) => item.title.toLowerCase() === subscription.subscriptionPlanTitle.toLowerCase()
              );

              return (
                <article className="current-subscription-card" key={subscription.id}>
                  <div className="subscription-plan-head">
                    <StatusBadge status={subscription.isActive ? "Active" : "Inactive"} />
                    <Activity size={17} />
                  </div>
                  <h3>{subscription.subscriptionPlanTitle}</h3>
                  <span>{formatShortDate(subscription.startDate)} to {formatShortDate(subscription.endDate)}</span>
                  <SubscriptionUsage subscription={subscription} plan={plan} />
                </article>
              );
            })}
          </div>
        </section>
      )}

      {props.isPrivileged && (
        <section className="panel subscription-plan-create-panel">
          <PanelTitle icon={<Plus size={18} />} title="Create plan" />
          <form className="subscription-plan-form" onSubmit={submitCreate} noValidate>
            <PlanDraftFields
              draft={createDraft}
              errors={createErrors}
              setDraft={setCreateDraft}
              setErrors={setCreateErrors}
            />
            <button className="primary-button compact" type="submit" disabled={props.busy}>
              <Plus size={16} />
              Create plan
            </button>
          </form>
        </section>
      )}

      <section className="panel subscription-plans-panel">
        <PanelTitle icon={<Crown size={18} />} title={props.isPrivileged ? "Manage plans" : "Available plans"} />
        {props.loading ? (
          <LoadingSpinner label="Loading subscriptions" />
        ) : props.plans.length === 0 ? (
          <EmptyState icon={<Crown size={28} />} title="No subscription plans" description="There are no plans available yet." />
        ) : (
          <div className="subscription-plan-grid price-ordered-grid">
            {sortedPlans.map((plan) => {
              const isSelected = plan.id === props.selectedPlanId;
              const isCurrent = activeTitles.has(plan.title.toLowerCase());
              const isEditing = editingPlanId === plan.id;

              return (
                <article
                  className={`subscription-plan-card ${isSelected ? "selected" : ""} ${!plan.isActive ? "inactive" : ""} ${isEditing ? "editing" : ""}`}
                  id={`subscription-plan-${plan.id}`}
                  key={plan.id}
                >
                  {isEditing ? (
                    <form className="subscription-edit-form" onSubmit={(event) => void submitUpdate(event, plan.id)} noValidate>
                      <p className="subscription-edit-note">
                        The API requires the complete feature and limit lists when updating. Enter both lists before saving.
                      </p>
                      <PlanDraftFields
                        draft={editDraft}
                        errors={editErrors}
                        setDraft={setEditDraft}
                        setErrors={setEditErrors}
                      />
                      <div className="button-row">
                        <button className="primary-button compact" type="submit" disabled={props.busy}><Save size={15} />Save</button>
                        <button className="ghost-button compact" type="button" onClick={() => setEditingPlanId("")}>Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="subscription-plan-head">
                        <StatusBadge status={plan.isActive ? "Active" : "Inactive"} />
                        {isSelected && <span className="selected-plan-label">Selected</span>}
                      </div>
                      <h3>{plan.title}</h3>
                      <p>{plan.description}</p>
                      <div className="subscription-plan-price">
                        <strong>{formatMoney(plan.price, "EGP")}</strong>
                        <span>/ {plan.durationInDays} days</span>
                      </div>
                      <SubscriptionPlanBenefits plan={plan} />

                      {props.isPrivileged ? (
                        <div className="button-row">
                          <button
                            className="secondary-button compact"
                            type="button"
                            onClick={() => {
                              setEditingPlanId(plan.id);
                              setEditDraft(planToDraft(plan));
                              setEditErrors({});
                            }}
                            disabled={props.busy}
                          >
                            <Pencil size={15} />Edit
                          </button>
                          <button className="mini-button danger" type="button" onClick={() => props.onDeletePlan(plan.id)} disabled={props.busy}>
                            <Trash2 size={15} />Delete
                          </button>
                        </div>
                      ) : (
                        <button
                          className={isSelected ? "primary-button" : "secondary-button"}
                          type="button"
                          onClick={() => {
                            props.onSelectPlan(plan.id);
                            props.onStartPayment(plan);
                          }}
                          disabled={props.busy || !plan.isActive || isCurrent}
                        >
                          {props.paymentPlanId === plan.id ? <LoadingSpinner size="sm" /> : isCurrent ? <Check size={17} /> : <CreditCard size={17} />}
                          {props.paymentPlanId === plan.id ? "Opening checkout" : isCurrent ? "Current plan" : "Subscribe now"}
                        </button>
                      )}
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {!props.isPrivileged && props.subscriptions.length > 0 && (
        <section className="panel subscription-history-panel">
          <PanelTitle icon={<Crown size={18} />} title="Subscription history" meta={`${props.subscriptions.length} records`} />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Started</th>
                  <th>Ends</th>
                  <th>Usage</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {props.subscriptions.map((subscription) => {
                  const plan = props.plans.find(
                    (item) => item.title.toLowerCase() === subscription.subscriptionPlanTitle.toLowerCase()
                  );

                  return (
                    <tr key={subscription.id}>
                      <td data-label="Plan">{subscription.subscriptionPlanTitle}</td>
                      <td data-label="Started">{formatShortDate(subscription.startDate)}</td>
                      <td data-label="Ends">{formatShortDate(subscription.endDate)}</td>
                      <td data-label="Usage"><SubscriptionUsage subscription={subscription} plan={plan} compact /></td>
                      <td data-label="Status"><StatusBadge status={subscription.isActive ? "Active" : "Expired"} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
