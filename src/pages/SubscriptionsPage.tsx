import { Check, CreditCard, Crown, Pencil, Plus, Save, Trash2, UserRound } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { EmptyState, Field, LoadingSpinner, PanelTitle, SectionHeader, StatusBadge } from "../components/ui";
import { DateOfBirthInput } from "./AccountPage";
import type {
  AppLanguage,
  CreateSubscriptionPlanRequest,
  Customer,
  CustomerDraft,
  SubscriptionPlan,
  UpdateSubscriptionPlanRequest,
  UserSubscription
} from "../types";
import { formatMoney, formatShortDate } from "../utils/format";

type PlanDraft = {
  title: string;
  description: string;
  price: string;
  durationInDays: string;
};

type PlanDraftErrors = Partial<Record<keyof PlanDraft, string>>;

const emptyPlanDraft: PlanDraft = {
  title: "",
  description: "",
  price: "",
  durationInDays: "30"
};

function validatePlanDraft(draft: PlanDraft) {
  const errors: PlanDraftErrors = {};
  const title = draft.title.trim();
  const description = draft.description.trim();
  const price = Number(draft.price);
  const durationInDays = Number(draft.durationInDays);

  if (title.length < 3) errors.title = "Title must be at least 3 characters.";
  else if (title.length > 100) errors.title = "Title cannot exceed 100 characters.";

  if (description.length < 10) errors.description = "Description must be at least 10 characters.";
  else if (description.length > 500) errors.description = "Description cannot exceed 500 characters.";

  if (!Number.isFinite(price) || price <= 0) errors.price = "Price must be greater than 0.";
  if (!Number.isInteger(durationInDays) || durationInDays <= 0) {
    errors.durationInDays = "Duration must be a whole number greater than 0.";
  }

  return {
    errors,
    payload: Object.keys(errors).length === 0
      ? { title, description, price, durationInDays } satisfies CreateSubscriptionPlanRequest
      : null
  };
}

function planToDraft(plan: SubscriptionPlan): PlanDraft {
  return {
    title: plan.title,
    description: plan.description,
    price: String(plan.price),
    durationInDays: String(plan.durationInDays)
  };
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
  onUpdatePlan: (id: string, body: UpdateSubscriptionPlanRequest) => Promise<boolean>;
  onDeletePlan: (id: string) => void;
}) {
  const [createDraft, setCreateDraft] = useState<PlanDraft>(emptyPlanDraft);
  const [createErrors, setCreateErrors] = useState<PlanDraftErrors>({});
  const [editingPlanId, setEditingPlanId] = useState("");
  const [editDraft, setEditDraft] = useState<PlanDraft>(emptyPlanDraft);
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
      setCreateDraft(emptyPlanDraft);
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
                <strong>{formatMoney(selectedPlan.price)}</strong>
                <small>{selectedPlan.durationInDays} days of access</small>
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
            {props.currentSubscriptions.map((subscription) => (
              <article className="current-subscription-card" key={subscription.id}>
                <StatusBadge status={subscription.isActive ? "Active" : "Inactive"} />
                <h3>{subscription.subscriptionPlanTitle}</h3>
                <span>{formatShortDate(subscription.startDate)} to {formatShortDate(subscription.endDate)}</span>
              </article>
            ))}
          </div>
        </section>
      )}

      {props.isPrivileged && (
        <section className="panel subscription-plan-create-panel">
          <PanelTitle icon={<Plus size={18} />} title="Create plan" />
          <form className="subscription-plan-form" onSubmit={submitCreate} noValidate>
            <Field label="Title" error={createErrors.title}>
              <input
                value={createDraft.title}
                onChange={(event) => {
                  setCreateDraft({ ...createDraft, title: event.target.value.slice(0, 100) });
                  setCreateErrors((current) => ({ ...current, title: undefined }));
                }}
                minLength={3}
                maxLength={100}
                required
              />
            </Field>
            <Field label="Price (EGP)" error={createErrors.price}>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={createDraft.price}
                onChange={(event) => {
                  setCreateDraft({ ...createDraft, price: event.target.value });
                  setCreateErrors((current) => ({ ...current, price: undefined }));
                }}
                required
              />
            </Field>
            <Field label="Duration (days)" error={createErrors.durationInDays}>
              <input
                type="number"
                min="1"
                step="1"
                value={createDraft.durationInDays}
                onChange={(event) => {
                  setCreateDraft({ ...createDraft, durationInDays: event.target.value });
                  setCreateErrors((current) => ({ ...current, durationInDays: undefined }));
                }}
                required
              />
            </Field>
            <Field label="Description" error={createErrors.description}>
              <textarea
                value={createDraft.description}
                onChange={(event) => {
                  setCreateDraft({ ...createDraft, description: event.target.value.slice(0, 500) });
                  setCreateErrors((current) => ({ ...current, description: undefined }));
                }}
                minLength={10}
                maxLength={500}
                required
              />
            </Field>
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
                <article className={`subscription-plan-card ${isSelected ? "selected" : ""} ${!plan.isActive ? "inactive" : ""}`} id={`subscription-plan-${plan.id}`} key={plan.id}>
                  {isEditing ? (
                    <form className="subscription-edit-form" onSubmit={(event) => void submitUpdate(event, plan.id)} noValidate>
                      <Field label="Title" error={editErrors.title}>
                        <input
                          value={editDraft.title}
                          onChange={(event) => {
                            setEditDraft({ ...editDraft, title: event.target.value.slice(0, 100) });
                            setEditErrors((current) => ({ ...current, title: undefined }));
                          }}
                          minLength={3}
                          maxLength={100}
                          required
                        />
                      </Field>
                      <Field label="Description" error={editErrors.description}>
                        <textarea
                          value={editDraft.description}
                          onChange={(event) => {
                            setEditDraft({ ...editDraft, description: event.target.value.slice(0, 500) });
                            setEditErrors((current) => ({ ...current, description: undefined }));
                          }}
                          minLength={10}
                          maxLength={500}
                          required
                        />
                      </Field>
                      <div className="form-grid">
                        <Field label="Price (EGP)" error={editErrors.price}>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={editDraft.price}
                            onChange={(event) => {
                              setEditDraft({ ...editDraft, price: event.target.value });
                              setEditErrors((current) => ({ ...current, price: undefined }));
                            }}
                            required
                          />
                        </Field>
                        <Field label="Duration (days)" error={editErrors.durationInDays}>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={editDraft.durationInDays}
                            onChange={(event) => {
                              setEditDraft({ ...editDraft, durationInDays: event.target.value });
                              setEditErrors((current) => ({ ...current, durationInDays: undefined }));
                            }}
                            required
                          />
                        </Field>
                      </div>
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
                        <strong>{formatMoney(plan.price)}</strong>
                        <span>/ {plan.durationInDays} days</span>
                      </div>

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
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {props.subscriptions.map((subscription) => (
                  <tr key={subscription.id}>
                    <td data-label="Plan">{subscription.subscriptionPlanTitle}</td>
                    <td data-label="Started">{formatShortDate(subscription.startDate)}</td>
                    <td data-label="Ends">{formatShortDate(subscription.endDate)}</td>
                    <td data-label="Status"><StatusBadge status={subscription.isActive ? "Active" : "Expired"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
