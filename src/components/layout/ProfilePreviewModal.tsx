import { Building2, Mail, Phone, Settings, ShieldCheck, UserRound } from "lucide-react";
import { MetricLine, StatusBadge } from "../ui";
import type { Customer, ProfileResponse } from "../../types";
import { formatDate } from "../../utils/format";

export function ProfilePreviewModal(props: {
  open: boolean;
  profile: ProfileResponse | null;
  currentCustomer?: Customer;
  roles: string[];
  onClose: () => void;
  onGoToSettings: () => void;
}) {
  if (!props.open) return null;

  const displayName = props.profile?.name || props.profile?.username || "Signed in user";
  const customer = props.currentCustomer ?? props.profile?.customer;

  return (
    <div className="modal-backdrop profile-preview-backdrop" role="presentation" onMouseDown={props.onClose}>
      <section className="profile-preview-modal" role="dialog" aria-modal="true" aria-labelledby="profile-preview-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="profile-preview-head">
          <span className="profile-avatar">
            <UserRound size={24} />
          </span>
          <div>
            <span className="landing-kicker">Read only profile</span>
            <h2 id="profile-preview-title">{displayName}</h2>
            <p>{props.roles.join(", ") || "Authenticated"}</p>
          </div>
          <StatusBadge status={customer ? "Customer ready" : "Profile only"} />
        </div>

        <div className="profile-preview-grid">
          <MetricLine label="Username" value={props.profile?.username || "Not set"} />
          <MetricLine label="Email" value={<span className="inline-profile-value"><Mail size={14} />{props.profile?.email || "Not set"}</span>} />
          <MetricLine label="Phone" value={<span className="inline-profile-value"><Phone size={14} />{props.profile?.phoneNumber || "Not set"}</span>} />
          <MetricLine label="Customer created" value={customer?.createdAt ? formatDate(customer.createdAt) : "Not created"} />
        </div>

        {customer && (
          <div className="profile-customer-card">
            <Building2 size={18} />
            <div>
              <strong>{customer.companyName || "Individual customer"}</strong>
              <small>{customer.taxNumber || customer.nationalId || "No customer identifier"}</small>
            </div>
          </div>
        )}

        <div className="settings-hint">
          <ShieldCheck size={18} />
          <span>If you would like to change anything, open settings from here.</span>
        </div>

        <div className="dialog-actions">
          <button className="secondary-button" type="button" onClick={props.onClose}>
            Close
          </button>
          <button className="primary-button" type="button" onClick={props.onGoToSettings}>
            <Settings size={17} />
            Go to settings
          </button>
        </div>
      </section>
    </div>
  );
}
