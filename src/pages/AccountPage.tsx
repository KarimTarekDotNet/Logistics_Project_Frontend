import { AtSign, Building2, CheckCircle2, KeyRound, Mail, Phone, Send, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ConfirmDialog, Field, OtpInput, PanelTitle, PasswordInput, SectionHeader, StatusBadge } from "../components/ui";
import type { Customer, CustomerDraft, PasswordDraft, ProfileDraft, ProfileResponse, VerifyDraft } from "../types";
import { formatDate } from "../utils/format";

export function AccountPage(props: {
  profile: ProfileResponse | null;
  customers: Customer[];
  currentCustomer?: Customer;
  isPrivileged: boolean;
  busy: boolean;
  profileDraft: ProfileDraft;
  setProfileDraft: (draft: ProfileDraft) => void;
  passwordDraft: PasswordDraft;
  setPasswordDraft: (draft: PasswordDraft) => void;
  verifyDraft: VerifyDraft;
  setVerifyDraft: (draft: VerifyDraft) => void;
  showProfileVerify: "email" | "phone" | null;
  setShowProfileVerify: (value: "email" | "phone" | null) => void;
  customerDraft: CustomerDraft;
  setCustomerDraft: (draft: CustomerDraft) => void;
  onUpdateProfile: (event: FormEvent) => void;
  onUpdatePassword: (event: FormEvent) => void;
  onResendCurrentPhone: () => void;
  onVerifyCurrentPhone: (code?: string) => void;
  onVerifyPendingPhone: (event?: FormEvent, code?: string) => void;
  onSaveCustomer: (event: FormEvent) => void;
  onDeleteCustomer: () => void;
  onLogoutAll: () => void;
}) {
  const {
    profile,
    customers,
    currentCustomer,
    isPrivileged,
    busy,
    profileDraft,
    setProfileDraft,
    passwordDraft,
    setPasswordDraft,
    verifyDraft,
    setVerifyDraft,
    showProfileVerify,
    setShowProfileVerify,
    customerDraft,
    setCustomerDraft,
    onUpdateProfile,
    onUpdatePassword,
    onResendCurrentPhone,
    onVerifyCurrentPhone,
    onVerifyPendingPhone,
    onSaveCustomer,
    onDeleteCustomer,
    onLogoutAll
  } = props;
  const [confirmCustomerDelete, setConfirmCustomerDelete] = useState(false);
  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false);

  function normalizePhoneInput(value: string) {
    const hasPlus = value.trimStart().startsWith("+");
    const digits = value.replace(/\D/g, "").slice(0, 15);
    return `${hasPlus ? "+" : ""}${digits}`;
  }

  return (
    <div className="view-stack">
      <SectionHeader icon={<UserRound size={22} />} title="Settings Profile" meta={profile?.username || "Profile settings"} />

      <div className="two-column account-layout">
        <section className="panel">
          <PanelTitle icon={<UserRound size={18} />} title="Profile" />
          <div className="profile-summary">
            <div>
              <strong>{profile?.name || "Signed in user"}</strong>
              <small>{profile?.email || "Email pending"}</small>
            </div>
            <div className="profile-statuses">
              <StatusBadge status={profile?.customer ? "Customer ready" : "Customer missing"} />
              {profile && (
                <span className={`verification-status ${profile.phoneNumberConfirmed ? "verified" : "pending"}`}>
                  {profile.phoneNumberConfirmed ? <CheckCircle2 size={14} /> : <Phone size={14} />}
                  {profile.phoneNumberConfirmed ? "Phone verified" : "Phone verification needed"}
                </span>
              )}
            </div>
          </div>

          <form className="settings-profile-form" onSubmit={onUpdateProfile}>
            <div className="settings-field-grid">
              <div className="settings-field-card">
                <span className="settings-field-icon"><UserRound size={18} /></span>
                <Field label="First name" hint="3 to 50 characters when changed">
                  <input value={profileDraft.firstName} onChange={(event) => setProfileDraft({ ...profileDraft, firstName: event.target.value.slice(0, 50) })} maxLength={50} />
                </Field>
              </div>
              <div className="settings-field-card">
                <span className="settings-field-icon"><UserRound size={18} /></span>
                <Field label="Last name" hint="3 to 50 characters when changed">
                  <input value={profileDraft.lastName} onChange={(event) => setProfileDraft({ ...profileDraft, lastName: event.target.value.slice(0, 50) })} maxLength={50} />
                </Field>
              </div>
              <div className="settings-field-card">
                <span className="settings-field-icon"><AtSign size={18} /></span>
                <Field label="Username" hint="3 to 20 letters, numbers, or underscores">
                  <input
                    value={profileDraft.username}
                    onChange={(event) => setProfileDraft({ ...profileDraft, username: event.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20) })}
                    minLength={3}
                    maxLength={20}
                    spellCheck={false}
                  />
                </Field>
              </div>
              <div className="settings-field-card">
                <span className="settings-field-icon"><Mail size={18} /></span>
                <Field label="Email" hint="Changing it requires email confirmation">
                  <input type="email" value={profileDraft.email} onChange={(event) => setProfileDraft({ ...profileDraft, email: event.target.value.slice(0, 120) })} maxLength={120} spellCheck={false} />
                </Field>
              </div>
              <div className="settings-field-card full">
                <span className="settings-field-icon"><Phone size={18} /></span>
                <Field label="Phone number" hint="Use international format, for example +201001234567">
                  <input
                    value={profileDraft.phoneNumber}
                    onChange={(event) => setProfileDraft({ ...profileDraft, phoneNumber: normalizePhoneInput(event.target.value) })}
                    inputMode="tel"
                    maxLength={16}
                  />
                </Field>
              </div>
            </div>
            <div className="settings-form-actions">
              <p>Only changed fields are sent to the server.</p>
              <button className="primary-button compact" type="submit" disabled={busy}>
                <CheckCircle2 size={17} />
                Save profile
              </button>
            </div>
          </form>

          {profile?.phoneNumberConfirmed === false && (
            <div className="verify-inline-card phone-verification-card">
              <div className="verify-inline-header">
                <div className="verify-inline-title">
                  <Phone size={16} />
                  <strong>Confirm your phone number</strong>
                </div>
                <button type="button" className="secondary-button compact" onClick={onResendCurrentPhone} disabled={busy || !profile.phoneNumber}>
                  <Send size={15} />
                  Send code
                </button>
              </div>
              <p className="flow-note">
                Send a code to <b>{profile.phoneNumber}</b>, then enter the six digits below.
              </p>
              <OtpInput
                value={verifyDraft.phoneCode}
                onChange={(value) => setVerifyDraft({ ...verifyDraft, phoneCode: value })}
                onComplete={onVerifyCurrentPhone}
                disabled={busy}
                ariaLabel="Account phone verification code"
              />
              <p className="otp-auto-submit-note">Verification starts automatically after the sixth digit.</p>
            </div>
          )}

          {showProfileVerify === "email" && (
            <div className="verify-inline-card">
              <div className="verify-inline-header">
                <div className="verify-inline-title">
                  <ShieldCheck size={16} />
                  <strong>Confirm new email</strong>
                </div>
                <button type="button" className="mini-button" onClick={() => setShowProfileVerify(null)}>
                  Dismiss
                </button>
              </div>
              <p className="flow-note">
                A confirmation link was sent to <b>{profileDraft.email}</b>. Open your inbox to finish the change.
              </p>
            </div>
          )}

          {showProfileVerify === "phone" && (
            <div className="verify-inline-card">
              <div className="verify-inline-header">
                <div className="verify-inline-title">
                  <KeyRound size={16} />
                  <strong>Verify new phone number</strong>
                </div>
                <button type="button" className="mini-button" onClick={() => setShowProfileVerify(null)}>
                  Dismiss
                </button>
              </div>
              <form className="form-stack" onSubmit={onVerifyPendingPhone}>
                <OtpInput
                  value={verifyDraft.pendingPhoneCode}
                  onChange={(value) => setVerifyDraft({ ...verifyDraft, pendingPhoneCode: value })}
                  onComplete={(code) => onVerifyPendingPhone(undefined, code)}
                  disabled={busy}
                  ariaLabel="New phone number verification code"
                />
                <p className="otp-auto-submit-note">Verification starts automatically after the sixth digit.</p>
              </form>
            </div>
          )}
        </section>

        <section className="panel">
          <PanelTitle icon={<KeyRound size={18} />} title="Security" />
          <form className="form-stack" onSubmit={onUpdatePassword}>
            <Field label="Current password">
              <PasswordInput value={passwordDraft.currentPassword} onChange={(event) => setPasswordDraft({ ...passwordDraft, currentPassword: event.currentTarget.value })} required />
            </Field>
            <div className="form-grid">
              <Field label="New password">
                <PasswordInput value={passwordDraft.newPassword} onChange={(event) => setPasswordDraft({ ...passwordDraft, newPassword: event.currentTarget.value })} required />
              </Field>
              <Field label="Confirm password">
                <PasswordInput value={passwordDraft.confirmPassword} onChange={(event) => setPasswordDraft({ ...passwordDraft, confirmPassword: event.currentTarget.value })} required />
              </Field>
            </div>
            <div className="button-row">
              <button className="secondary-button" type="submit" disabled={busy}>
                <ShieldCheck size={17} />
                Update password
              </button>
              <button className="danger-button subtle" type="button" disabled={busy} onClick={() => setConfirmLogoutAll(true)}>
                Logout all sessions
              </button>
            </div>
          </form>
        </section>
      </div>

      <section className="panel">
        <div className="panel-title-row">
          <PanelTitle icon={<Building2 size={18} />} title="Customer profile" />
          {currentCustomer && !isPrivileged && (
            <button className="mini-button danger" type="button" onClick={() => setConfirmCustomerDelete(true)} disabled={busy}>
              <Trash2 size={14} />
              Delete
            </button>
          )}
        </div>

        {!isPrivileged ? (
          <form className="customer-form" onSubmit={onSaveCustomer}>
            <div className="segmented inline">
              <button type="button" className={customerDraft.mode === "individual" ? "active" : ""} onClick={() => setCustomerDraft({ ...customerDraft, mode: "individual", taxNumber: "", companyName: "" })}>
                Individual
              </button>
              <button type="button" className={customerDraft.mode === "company" ? "active" : ""} onClick={() => setCustomerDraft({ ...customerDraft, mode: "company", nationalId: "" })}>
                Company
              </button>
            </div>

            {customerDraft.mode === "individual" ? (
              <div className="form-grid">
                <Field label="National number">
                  <input value={customerDraft.nationalId} onChange={(event) => setCustomerDraft({ ...customerDraft, nationalId: event.target.value })} required />
                </Field>
                <Field label="Date of birth">
                  <input type="date" value={customerDraft.dateOfBirth} onChange={(event) => setCustomerDraft({ ...customerDraft, dateOfBirth: event.target.value })} />
                </Field>
              </div>
            ) : (
              <div className="form-grid">
                <Field label="Company">
                  <input value={customerDraft.companyName} onChange={(event) => setCustomerDraft({ ...customerDraft, companyName: event.target.value })} required />
                </Field>
                <Field label="Country">
                  <input value={customerDraft.countryCode} onChange={(event) => setCustomerDraft({ ...customerDraft, countryCode: event.target.value.toUpperCase() })} maxLength={2} required />
                </Field>
                <Field label="Tax number">
                  <input value={customerDraft.taxNumber} onChange={(event) => setCustomerDraft({ ...customerDraft, taxNumber: event.target.value })} required />
                </Field>
                <Field label="Date of birth">
                  <input type="date" value={customerDraft.dateOfBirth} onChange={(event) => setCustomerDraft({ ...customerDraft, dateOfBirth: event.target.value })} />
                </Field>
              </div>
            )}

            <button className="primary-button compact" type="submit" disabled={busy}>
              <CheckCircle2 size={17} />
              {currentCustomer ? "Update customer" : "Create customer"}
            </button>
          </form>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>National number</th>
                  <th>Tax</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>{customer.companyName || "Individual"}</td>
                    <td>{customer.nationalId || "Not set"}</td>
                    <td>{customer.taxNumber || "Not set"}</td>
                    <td>{formatDate(customer.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmCustomerDelete}
        title="Delete customer profile"
        message="This removes your customer profile from the portal."
        confirmLabel="Delete profile"
        tone="danger"
        busy={busy}
        onClose={() => setConfirmCustomerDelete(false)}
        onConfirm={() => {
          onDeleteCustomer();
          setConfirmCustomerDelete(false);
        }}
      />

      <ConfirmDialog
        open={confirmLogoutAll}
        title="Logout all sessions"
        message="All refresh tokens for your account will be revoked."
        confirmLabel="Logout all"
        tone="danger"
        busy={busy}
        onClose={() => setConfirmLogoutAll(false)}
        onConfirm={() => {
          onLogoutAll();
          setConfirmLogoutAll(false);
        }}
      />
    </div>
  );
}
