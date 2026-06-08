import { Building2, CheckCircle2, KeyRound, Languages, Mail, Phone, Send, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ConfirmDialog, Field, OtpInput, PanelTitle, PasswordInput, SectionHeader, StatusBadge } from "../components/ui";
import type { AccountSection, AppLanguage, Customer, CustomerDraft, PasswordDraft, ProfileDraft, ProfileResponse, VerifyDraft } from "../types";
import { formatDate, normalizeDateOnly } from "../utils/format";

type DateParts = {
  day: string;
  month: string;
  year: string;
};

function splitDate(value: string): DateParts {
  const normalized = normalizeDateOnly(value);
  if (!normalized) return { day: "", month: "", year: "" };
  const [year, month, day] = normalized.split("-");
  return { day, month, year };
}

export function DateOfBirthInput(props: {
  value: string;
  language: AppLanguage;
  onChange: (value: string) => void;
}) {
  const [parts, setParts] = useState<DateParts>(() => splitDate(props.value));
  const emittedValueRef = useRef<string | null>(null);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 121 }, (_, index) => String(currentYear - index));
  const monthNumber = Number(parts.month);
  const yearNumber = Number(parts.year || currentYear);
  const daysInMonth = monthNumber ? new Date(yearNumber, monthNumber, 0).getDate() : 31;

  useEffect(() => {
    const normalized = normalizeDateOnly(props.value);
    if (emittedValueRef.current === normalized) {
      emittedValueRef.current = null;
      return;
    }
    setParts(splitDate(normalized));
  }, [props.value]);

  function updatePart(key: keyof DateParts, value: string) {
    const next = { ...parts, [key]: value };
    const nextMonth = Number(next.month);
    const nextYear = Number(next.year || currentYear);
    const nextMaxDay = nextMonth ? new Date(nextYear, nextMonth, 0).getDate() : 31;
    if (Number(next.day) > nextMaxDay) next.day = "";

    setParts(next);
    const nextValue = next.year && next.month && next.day ? `${next.year}-${next.month}-${next.day}` : "";
    emittedValueRef.current = nextValue;
    props.onChange(nextValue);
  }

  const labels =
    props.language === "ar"
      ? { day: "اليوم", month: "الشهر", year: "السنة" }
      : { day: "Day", month: "Month", year: "Year" };

  return (
    <div className="date-parts" dir="ltr">
      <select aria-label={labels.day} value={parts.day} onChange={(event) => updatePart("day", event.target.value)}>
        <option value="">{labels.day}</option>
        {Array.from({ length: daysInMonth }, (_, index) => String(index + 1).padStart(2, "0")).map((day) => (
          <option key={day} value={day}>{day}</option>
        ))}
      </select>
      <select aria-label={labels.month} value={parts.month} onChange={(event) => updatePart("month", event.target.value)}>
        <option value="">{labels.month}</option>
        {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")).map((month) => (
          <option key={month} value={month}>{month}</option>
        ))}
      </select>
      <select aria-label={labels.year} value={parts.year} onChange={(event) => updatePart("year", event.target.value)}>
        <option value="">{labels.year}</option>
        {years.map((year) => (
          <option key={year} value={year}>{year}</option>
        ))}
      </select>
    </div>
  );
}

export function AccountPage(props: {
  activeSection: AccountSection;
  onSectionChange: (section: AccountSection) => void;
  language: AppLanguage;
  onLanguageChange: (language: AppLanguage) => void;
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
    activeSection,
    onSectionChange,
    language,
    onLanguageChange,
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
  const setActiveSection = onSectionChange;
  const text = (english: string, arabic: string) => language === "ar" ? arabic : english;

  useEffect(() => {
    if (showProfileVerify) setActiveSection(showProfileVerify);
  }, [showProfileVerify]);

  function normalizePhoneInput(value: string) {
    const hasPlus = value.trimStart().startsWith("+");
    const digits = value.replace(/\D/g, "").slice(0, 15);
    return `${hasPlus ? "+" : ""}${digits}`;
  }

  return (
    <div className="view-stack">
      <SectionHeader
        icon={<UserRound size={22} />}
        title={text("Settings Profile", "إعدادات الحساب")}
        meta={profile?.username || text("Profile settings", "إعدادات الملف الشخصي")}
      />

      <nav className="settings-tabs" aria-label={text("Account settings", "إعدادات الحساب")}>
        <button className={activeSection === "profile" ? "active" : ""} type="button" onClick={() => setActiveSection("profile")}>
          <UserRound size={17} />
          {text("Profile", "الملف الشخصي")}
        </button>
        <button className={activeSection === "email" ? "active" : ""} type="button" onClick={() => setActiveSection("email")}>
          <Mail size={17} />
          {text("Email", "البريد الإلكتروني")}
        </button>
        <button className={activeSection === "phone" ? "active" : ""} type="button" onClick={() => setActiveSection("phone")}>
          <Phone size={17} />
          {text("Phone", "الهاتف")}
          {profile?.phoneNumberConfirmed === false && <span className="tab-alert-dot" aria-label={text("Verification needed", "التأكيد مطلوب")} />}
        </button>
        <button className={activeSection === "security" ? "active" : ""} type="button" onClick={() => setActiveSection("security")}>
          <KeyRound size={17} />
          {text("Security", "الأمان")}
        </button>
        <button className={activeSection === "customer" ? "active" : ""} type="button" onClick={() => setActiveSection("customer")}>
          <Building2 size={17} />
          {text("Customer", "بيانات العميل")}
        </button>
        <button className={activeSection === "language" ? "active" : ""} type="button" onClick={() => setActiveSection("language")}>
          <Languages size={17} />
          {text("Language", "اللغة")}
        </button>
      </nav>

      {activeSection === "profile" && (
        <section className="panel settings-section">
          <PanelTitle icon={<UserRound size={18} />} title={text("Profile", "الملف الشخصي")} />
          <div className="profile-summary">
            <div>
              <strong>{profile?.name || text("Signed in user", "المستخدم الحالي")}</strong>
              <small>{profile?.email || text("Email pending", "البريد الإلكتروني قيد الانتظار")}</small>
            </div>
            <div className="profile-statuses">
              <StatusBadge status={profile?.customer ? text("Customer ready", "بيانات العميل مكتملة") : text("Customer missing", "بيانات العميل ناقصة")} />
              {profile && (
                <button
                  className={`verification-status ${profile.phoneNumberConfirmed ? "verified" : "pending"}`}
                  type="button"
                  onClick={() => setActiveSection("phone")}
                >
                  {profile.phoneNumberConfirmed ? <CheckCircle2 size={14} /> : <Phone size={14} />}
                  {profile.phoneNumberConfirmed ? text("Phone verified", "الهاتف مؤكّد") : text("Phone verification needed", "يجب تأكيد الهاتف")}
                </button>
              )}
            </div>
          </div>

          <form className="settings-profile-form" onSubmit={onUpdateProfile}>
            <div className="settings-field-grid">
              <div className="settings-field">
                <Field label={text("First name", "الاسم الأول")} hint={text("3 to 50 characters when changed", "من 3 إلى 50 حرفًا عند التغيير")}>
                  <input value={profileDraft.firstName} onChange={(event) => setProfileDraft({ ...profileDraft, firstName: event.target.value.slice(0, 50) })} maxLength={50} />
                </Field>
              </div>
              <div className="settings-field">
                <Field label={text("Last name", "اسم العائلة")} hint={text("3 to 50 characters when changed", "من 3 إلى 50 حرفًا عند التغيير")}>
                  <input value={profileDraft.lastName} onChange={(event) => setProfileDraft({ ...profileDraft, lastName: event.target.value.slice(0, 50) })} maxLength={50} />
                </Field>
              </div>
              <div className="settings-field">
                <Field label={text("Username", "اسم المستخدم")} hint={text("3 to 20 letters, numbers, or underscores", "من 3 إلى 20 حرفًا أو رقمًا أو شرطة سفلية")}>
                  <input
                    value={profileDraft.username}
                    onChange={(event) => setProfileDraft({ ...profileDraft, username: event.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20) })}
                    minLength={3}
                    maxLength={20}
                    spellCheck={false}
                  />
                </Field>
              </div>
            </div>
            <div className="settings-form-actions">
              <p>{text("Only changed fields are sent to the server.", "يتم إرسال الحقول التي تغيّرت فقط.")}</p>
              <button className="primary-button compact" type="submit" disabled={busy}>
                <CheckCircle2 size={17} />
                {text("Save profile", "حفظ الملف الشخصي")}
              </button>
            </div>
          </form>

        </section>
      )}

      {activeSection === "email" && (
        <section className="panel settings-section contact-settings-page">
          <div className="settings-page-heading">
            <span className="settings-page-icon"><Mail size={20} /></span>
            <div>
              <h2>{text("Email address", "البريد الإلكتروني")}</h2>
              <p>{text(
                "Change the address used for account communication. The new address must be confirmed before it becomes active.",
                "غيّر البريد المستخدم للتواصل مع الحساب. يجب تأكيد البريد الجديد قبل تفعيله."
              )}</p>
            </div>
          </div>
          <form className="settings-contact-form" onSubmit={onUpdateProfile}>
            <Field
              label={text("New email address", "البريد الإلكتروني الجديد")}
              hint={`${text("Current email", "البريد الحالي")}: ${profile?.email || text("Not available", "غير متاح")}`}
            >
              <input
                type="email"
                value={profileDraft.email}
                onChange={(event) => setProfileDraft({ ...profileDraft, email: event.target.value.slice(0, 120) })}
                maxLength={120}
                spellCheck={false}
              />
            </Field>
            <div className="settings-form-actions">
              <p>{text("Only the changed email value is sent.", "يتم إرسال البريد الجديد فقط عند تغييره.")}</p>
              <button className="primary-button compact" type="submit" disabled={busy}>
                <Mail size={17} />
                {text("Update email", "تحديث البريد")}
              </button>
            </div>
          </form>

          {showProfileVerify === "email" && (
            <div className="verify-inline-card">
              <div className="verify-inline-header">
                <div className="verify-inline-title">
                  <ShieldCheck size={16} />
                  <strong>{text("Confirm new email", "تأكيد البريد الجديد")}</strong>
                </div>
                <button type="button" className="mini-button" onClick={() => setShowProfileVerify(null)}>
                  {text("Dismiss", "إغلاق")}
                </button>
              </div>
              <p className="flow-note">
                {text("A confirmation link was sent to", "تم إرسال رابط تأكيد إلى")} <b>{profileDraft.email}</b>.
                {" "}{text("Open your inbox to finish the change.", "افتح بريدك لإكمال التغيير.")}
              </p>
            </div>
          )}
        </section>
      )}

      {activeSection === "phone" && (
        <section className="panel settings-section contact-settings-page">
          <div className="settings-page-heading">
            <span className="settings-page-icon"><Phone size={20} /></span>
            <div>
              <h2>{text("Phone number", "رقم الهاتف")}</h2>
              <p>{text(
                "Verify the current number or submit a replacement number. Six-digit codes are sent automatically once entered.",
                "أكّد الرقم الحالي أو أدخل رقمًا بديلًا. يتكون رمز التأكيد من ستة أرقام."
              )}</p>
            </div>
          </div>

          <form className="settings-contact-form" onSubmit={onUpdateProfile}>
            <Field label={text("Phone number", "رقم الهاتف")} hint={text("Use international format, for example +201001234567", "استخدم الصيغة الدولية، مثال +201001234567")}>
              <input
                value={profileDraft.phoneNumber}
                onChange={(event) => setProfileDraft({ ...profileDraft, phoneNumber: normalizePhoneInput(event.target.value) })}
                inputMode="tel"
                maxLength={16}
              />
            </Field>
            <div className="settings-form-actions">
              <p>{profile?.phoneNumberConfirmed
                ? text("Changing the number requires a new verification code.", "تغيير الرقم يتطلب رمز تأكيد جديدًا.")
                : text("You can verify the current number below or replace it first.", "يمكنك تأكيد الرقم الحالي أو استبداله أولًا.")}</p>
              <button className="primary-button compact" type="submit" disabled={busy}>
                <Phone size={17} />
                {text("Update phone", "تحديث الهاتف")}
              </button>
            </div>
          </form>

          {profile?.phoneNumberConfirmed === false && showProfileVerify !== "phone" && (
            <div className="verify-inline-card phone-verification-card">
              <div className="verify-inline-header">
                <div className="verify-inline-title">
                  <Phone size={16} />
                  <strong>{text("Confirm your phone number", "تأكيد رقم الهاتف")}</strong>
                </div>
                <button type="button" className="secondary-button compact" onClick={onResendCurrentPhone} disabled={busy || !profile.phoneNumber}>
                  <Send size={15} />
                  {text("Send code", "إرسال الرمز")}
                </button>
              </div>
              <p className="flow-note">
                {text("Send a code to", "أرسل رمزًا إلى")} <b dir="ltr">{profile.phoneNumber}</b>
                {text(", then enter the six digits below.", "، ثم أدخل الأرقام الستة بالأسفل.")}
              </p>
              <OtpInput
                value={verifyDraft.phoneCode}
                onChange={(value) => setVerifyDraft({ ...verifyDraft, phoneCode: value })}
                onComplete={onVerifyCurrentPhone}
                disabled={busy}
                ariaLabel="Account phone verification code"
              />
              <p className="otp-auto-submit-note">{text("Verification starts automatically after the sixth digit.", "يبدأ التأكيد تلقائيًا بعد إدخال الرقم السادس.")}</p>
            </div>
          )}

          {showProfileVerify === "phone" && (
            <div className="verify-inline-card">
              <div className="verify-inline-header">
                <div className="verify-inline-title">
                  <KeyRound size={16} />
                  <strong>{text("Verify new phone number", "تأكيد رقم الهاتف الجديد")}</strong>
                </div>
                <button type="button" className="mini-button" onClick={() => setShowProfileVerify(null)}>
                  {text("Dismiss", "إغلاق")}
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
                <p className="otp-auto-submit-note">{text("Verification starts automatically after the sixth digit.", "يبدأ التأكيد تلقائيًا بعد إدخال الرقم السادس.")}</p>
              </form>
            </div>
          )}
        </section>
      )}

      {activeSection === "security" && (
        <section className="panel settings-section settings-security-section">
          <PanelTitle icon={<KeyRound size={18} />} title={text("Security", "الأمان")} />
          <form className="form-stack" onSubmit={onUpdatePassword}>
            <Field label={text("Current password", "كلمة المرور الحالية")}>
              <PasswordInput value={passwordDraft.currentPassword} onChange={(event) => setPasswordDraft({ ...passwordDraft, currentPassword: event.currentTarget.value })} required />
            </Field>
            <div className="form-grid">
              <Field label={text("New password", "كلمة المرور الجديدة")}>
                <PasswordInput value={passwordDraft.newPassword} onChange={(event) => setPasswordDraft({ ...passwordDraft, newPassword: event.currentTarget.value })} required />
              </Field>
              <Field label={text("Confirm password", "تأكيد كلمة المرور")}>
                <PasswordInput value={passwordDraft.confirmPassword} onChange={(event) => setPasswordDraft({ ...passwordDraft, confirmPassword: event.currentTarget.value })} required />
              </Field>
            </div>
            <div className="button-row">
              <button className="secondary-button" type="submit" disabled={busy}>
                <ShieldCheck size={17} />
                {text("Update password", "تحديث كلمة المرور")}
              </button>
              <button className="danger-button subtle" type="button" disabled={busy} onClick={() => setConfirmLogoutAll(true)}>
                {text("Logout all sessions", "تسجيل الخروج من كل الأجهزة")}
              </button>
            </div>
          </form>
        </section>
      )}

      {activeSection === "language" && (
        <section className="panel settings-section contact-settings-page">
          <div className="settings-page-heading">
            <span className="settings-page-icon"><Languages size={20} /></span>
            <div>
              <h2>{text("Language", "اللغة")}</h2>
              <p>{text("Choose the interface language. The preference is saved on this device.", "اختر لغة الواجهة. يتم حفظ اختيارك على هذا الجهاز.")}</p>
            </div>
          </div>
          <div className="language-options" role="radiogroup" aria-label={text("Interface language", "لغة الواجهة")}>
            <button
              className={language === "en" ? "active" : ""}
              type="button"
              role="radio"
              aria-checked={language === "en"}
              onClick={() => onLanguageChange("en")}
            >
              <strong>English</strong>
              <span>{text("Left-to-right interface", "واجهة من اليسار إلى اليمين")}</span>
            </button>
            <button
              className={language === "ar" ? "active" : ""}
              type="button"
              role="radio"
              aria-checked={language === "ar"}
              onClick={() => onLanguageChange("ar")}
            >
              <strong>العربية</strong>
              <span>واجهة من اليمين إلى اليسار</span>
            </button>
          </div>
          <p className="flow-note">
            {text(
              "Automatic browser translation is disabled because it can change page elements and cause a blank screen.",
              "تم تعطيل الترجمة التلقائية للمتصفح لأنها قد تغيّر عناصر الصفحة وتتسبب في ظهور شاشة فارغة."
            )}
          </p>
        </section>
      )}

      {activeSection === "customer" && (
      <section className="panel settings-section">
        <div className="panel-title-row">
          <PanelTitle icon={<Building2 size={18} />} title={text("Customer profile", "بيانات العميل")} />
          {currentCustomer && !isPrivileged && (
            <button className="mini-button danger" type="button" onClick={() => setConfirmCustomerDelete(true)} disabled={busy}>
              <Trash2 size={14} />
              {text("Delete", "حذف")}
            </button>
          )}
        </div>

        {!isPrivileged ? (
          <form className="customer-form" onSubmit={onSaveCustomer}>
            <div className="segmented inline">
              <button type="button" className={customerDraft.mode === "individual" ? "active" : ""} onClick={() => setCustomerDraft({ ...customerDraft, mode: "individual", taxNumber: "", companyName: "" })}>
                {text("Individual", "فرد")}
              </button>
              <button type="button" className={customerDraft.mode === "company" ? "active" : ""} onClick={() => setCustomerDraft({ ...customerDraft, mode: "company", nationalId: "" })}>
                {text("Company", "شركة")}
              </button>
            </div>

            {customerDraft.mode === "individual" ? (
              <div className="form-grid">
                <Field label={text("National number", "الرقم القومي")}>
                  <input className="numeric-input" inputMode="numeric" value={customerDraft.nationalId} onChange={(event) => setCustomerDraft({ ...customerDraft, nationalId: event.target.value.replace(/\D/g, "") })} required />
                </Field>
                <Field label={text("Date of birth", "تاريخ الميلاد")}>
                  <DateOfBirthInput
                    value={customerDraft.dateOfBirth}
                    language={language}
                    onChange={(dateOfBirth) => setCustomerDraft({ ...customerDraft, dateOfBirth })}
                  />
                </Field>
              </div>
            ) : (
              <div className="form-grid">
                <Field label={text("Company", "اسم الشركة")}>
                  <input value={customerDraft.companyName} onChange={(event) => setCustomerDraft({ ...customerDraft, companyName: event.target.value })} required />
                </Field>
                <Field label={text("Country", "الدولة")}>
                  <input className="latin-input" value={customerDraft.countryCode} onChange={(event) => setCustomerDraft({ ...customerDraft, countryCode: event.target.value.toUpperCase() })} maxLength={2} required />
                </Field>
                <Field label={text("Tax number", "الرقم الضريبي")}>
                  <input className="numeric-input" inputMode="numeric" value={customerDraft.taxNumber} onChange={(event) => setCustomerDraft({ ...customerDraft, taxNumber: event.target.value.replace(/\D/g, "") })} required />
                </Field>
                <Field label={text("Date of birth", "تاريخ الميلاد")}>
                  <DateOfBirthInput
                    value={customerDraft.dateOfBirth}
                    language={language}
                    onChange={(dateOfBirth) => setCustomerDraft({ ...customerDraft, dateOfBirth })}
                  />
                </Field>
              </div>
            )}

            <button className="primary-button compact" type="submit" disabled={busy}>
              <CheckCircle2 size={17} />
              {currentCustomer ? text("Update customer", "تحديث بيانات العميل") : text("Create customer", "إنشاء بيانات العميل")}
            </button>
          </form>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{text("Company", "الشركة")}</th>
                  <th>{text("National number", "الرقم القومي")}</th>
                  <th>{text("Tax", "الضريبة")}</th>
                  <th>{text("Created", "تاريخ الإنشاء")}</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>{customer.companyName || text("Individual", "فرد")}</td>
                    <td>{customer.nationalId || text("Not set", "غير محدد")}</td>
                    <td>{customer.taxNumber || text("Not set", "غير محدد")}</td>
                    <td>{formatDate(customer.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      )}

      <ConfirmDialog
        open={confirmCustomerDelete}
        title={text("Delete customer profile", "حذف بيانات العميل")}
        message={text("This removes your customer profile from the portal.", "سيؤدي هذا إلى حذف بيانات العميل من المنصة.")}
        confirmLabel={text("Delete profile", "حذف البيانات")}
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
        title={text("Logout all sessions", "تسجيل الخروج من كل الأجهزة")}
        message={text("All refresh tokens for your account will be revoked.", "سيتم إنهاء جميع جلسات حسابك على الأجهزة الأخرى.")}
        confirmLabel={text("Logout all", "تسجيل الخروج من الكل")}
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
