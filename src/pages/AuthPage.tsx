import { ArrowLeft, CheckCircle2, CircleDollarSign, KeyRound, LogIn, Moon, Plus, Send, ShieldCheck, Ship, Sun } from "lucide-react";
import { BrandLogo } from "../components/brand/BrandLogo";
import { BRAND_NAME, BRAND_TAGLINE } from "../constants/brand";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Field, LoadingSpinner, PasswordInput, StatCard } from "../components/ui";
import type { RegisterForm, VerificationStep, VerifyDraft } from "../types";
import { maskPhone } from "../utils/session";

function OtpInput(props: { value: string; onChange: (value: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const value = props.value.replace(/\D/g, "").slice(0, 6);
  const cells = Array.from({ length: 6 }, (_, index) => value[index] ?? "");

  return (
    <div className="otp-control" onClick={() => inputRef.current?.focus()} role="group" aria-label="Phone verification code">
      <input
        ref={inputRef}
        className="otp-hidden-input"
        value={value}
        onChange={(event) => props.onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
      />
      <div className="otp-boxes" aria-hidden="true">
        {cells.map((cell, index) => (
          <span className={cell ? "filled" : ""} key={index}>
            {cell}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AuthPage(props: {
  authMode: "login" | "register" | "verify";
  setAuthMode: (mode: "login" | "register" | "verify") => void;
  loginForm: { identity: string; password: string };
  setLoginForm: (value: { identity: string; password: string }) => void;
  registerForm: RegisterForm;
  setRegisterForm: (value: RegisterForm) => void;
  onLogin: (event: FormEvent) => void;
  onRegister: (event: FormEvent) => void;
  verificationStep: VerificationStep;
  verifyDraft: VerifyDraft;
  setVerifyDraft: (value: VerifyDraft) => void;
  onResendEmail: (event: FormEvent) => void;
  onConfirmEmail: (event: FormEvent) => void;
  onResendPhone: (event: FormEvent) => void;
  onConfirmPhone: (event: FormEvent) => void;
  busy: boolean;
  publicRateCount: number;
  publicWorkflowCount: number;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onBackToLanding: () => void;
}) {
  const {
    authMode,
    setAuthMode,
    loginForm,
    setLoginForm,
    registerForm,
    setRegisterForm,
    onLogin,
    onRegister,
    verificationStep,
    verifyDraft,
    setVerifyDraft,
    onResendEmail,
    onConfirmEmail,
    onResendPhone,
    onConfirmPhone,
    busy,
    publicRateCount,
    publicWorkflowCount,
    theme,
    onToggleTheme,
    onBackToLanding
  } = props;
  const [resendSeconds, setResendSeconds] = useState(60);

  useEffect(() => {
    if (authMode === "verify" && verificationStep === "phone") {
      setResendSeconds(60);
    }
  }, [authMode, verificationStep, verifyDraft.phone]);

  useEffect(() => {
    if (authMode !== "verify" || verificationStep !== "phone" || resendSeconds <= 0) return;

    const timer = window.setInterval(() => {
      setResendSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [authMode, resendSeconds, verificationStep]);

  const hasPhoneForVerification = verifyDraft.phone.trim().length > 0;
  const canResendPhone = verificationStep === "phone" && resendSeconds === 0 && hasPhoneForVerification;
  const resendLabel = !hasPhoneForVerification
    ? "Phone unavailable"
    : canResendPhone
      ? "Resend code"
      : `Resend in ${String(Math.floor(resendSeconds / 60)).padStart(2, "0")}:${String(resendSeconds % 60).padStart(2, "0")}`;
  const publicRateValue = <span className="metric-plus">{publicRateCount.toLocaleString()}<b>+</b></span>;
  const workflowValue = <span className="metric-plus">{publicWorkflowCount.toLocaleString()}<b>+</b></span>;

  return (
    <main className="auth-page">
      <div className="auth-public-actions">
        <button className="ghost-button compact" type="button" onClick={onBackToLanding}>
          <ArrowLeft size={16} />
          Back to site
        </button>
        <button className="landing-nav-theme" type="button" onClick={onToggleTheme} aria-label="Toggle theme" title="Toggle theme">
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>

      <section className="auth-visual">
        <div className="brand large">
          <BrandLogo size="lg" />
          <div>
            <strong>{BRAND_NAME}</strong>
            <small>{BRAND_TAGLINE}</small>
          </div>
        </div>

        <div className="auth-map">
          <div className="map-node primary origin">CAI</div>
          <div className="map-node hub">JED</div>
          <div className="map-node destination">RTM</div>
          <div className="operation-card">
            <span>Shipment pipeline</span>
            <strong>Booking confirmed</strong>
            <small>ETA updated 12 min ago</small>
          </div>
        </div>

        <div className="auth-tagline">
          <h1>Centralize global logistics operations</h1>
          <p>Manage rates, quotes, shipments, and documents from one unified console.</p>
        </div>

        <div className="auth-metrics">
          <StatCard icon={<CircleDollarSign size={20} />} label="Public rates" value={publicRateValue} tone="green" />
          <StatCard icon={<ShieldCheck size={20} />} label="Protected portal" value="Ready" tone="blue" />
          <StatCard icon={<Ship size={20} />} label="Workflow states" value={workflowValue} tone="amber" />
        </div>
      </section>

      <section className="auth-panel">
        {authMode === "verify" ? (
          <div className="verify-flow">
            <button type="button" className="back-link" onClick={() => setAuthMode("login")}>
              Back to login
            </button>

            {verificationStep === "email" ? (
              <div className="verification-card">
                <div className="auth-form-header">
                  <div className="auth-form-icon">
                    <ShieldCheck size={22} />
                  </div>
                  <div>
                    <h2>Verify your email</h2>
                    <p>Check your inbox and click the confirmation link.</p>
                  </div>
                </div>

                <div className="verification-copy">
                  <CheckCircle2 size={26} />
                  <div>
                    <strong>Confirmation sent to</strong>
                    <span>{verifyDraft.email || "your registered email"}</span>
                  </div>
                </div>

                <div className="verify-actions">
                  <form onSubmit={onResendEmail}>
                    <button className="secondary-button" type="submit" disabled={busy || !verifyDraft.email.trim()}>
                      <Send size={16} />
                      Resend email
                    </button>
                  </form>
                  <form onSubmit={onConfirmEmail}>
                    <button className="primary-button" type="submit" disabled={busy || !verifyDraft.email.trim()}>
                      <CheckCircle2 size={16} />
                      I confirmed my email
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="verification-card">
                <div className="auth-form-header">
                  <div className="auth-form-icon">
                    <KeyRound size={22} />
                  </div>
                  <div>
                    <h2>Verify your phone</h2>
                    <p>Enter the 6-digit code we sent you.</p>
                  </div>
                </div>

                <div className="verification-copy">
                  <KeyRound size={26} />
                  <div>
                    <strong>Code sent to</strong>
                    <span>{maskPhone(verifyDraft.phone)}</span>
                  </div>
                </div>

                <form className="form-stack" onSubmit={onConfirmPhone}>
                  <p className="verification-note">
                    Phone verification uses the number entered during registration and cannot be changed here.
                  </p>
                  <OtpInput value={verifyDraft.phoneCode} onChange={(value) => setVerifyDraft({ ...verifyDraft, phoneCode: value })} />
                  <button className="primary-button" type="submit" disabled={busy || !hasPhoneForVerification || verifyDraft.phoneCode.length !== 6}>
                    <CheckCircle2 size={16} />
                    Verify phone number
                  </button>
                </form>

                <form
                  className="resend-row"
                  onSubmit={(event) => {
                    if (!canResendPhone) {
                      event.preventDefault();
                      return;
                    }
                    setResendSeconds(60);
                    void onResendPhone(event);
                  }}
                >
                  <span>Did not receive the code?</span>
                  <button className="resend-link" type="submit" disabled={busy || !canResendPhone}>
                    {resendLabel}
                  </button>
                </form>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="auth-form-header">
              <div className="auth-form-icon">{authMode === "login" ? <LogIn size={22} /> : <Plus size={22} />}</div>
              <div>
                <h2>{authMode === "login" ? "Welcome back" : "Create account"}</h2>
                <p>{authMode === "login" ? "Sign in to your account." : `Get started with ${BRAND_NAME}`}</p>
              </div>
            </div>

            <div className="segmented">
              <button type="button" className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>
                Login
              </button>
              <button type="button" className={authMode === "register" ? "active" : ""} onClick={() => setAuthMode("register")}>
                Register
              </button>
            </div>

            <div className="auth-mode-panel" key={authMode}>
              {authMode === "login" && (
                <form className="form-stack" onSubmit={onLogin}>
                <Field label="Email, username, or phone">
                  <input
                    value={loginForm.identity}
                    onChange={(event) => setLoginForm({ ...loginForm, identity: event.target.value.slice(0, 100) })}
                    autoComplete="username"
                    placeholder="ops@company.com"
                    maxLength={100}
                    spellCheck={false}
                    required
                  />
                </Field>
                <Field label="Password">
                  <PasswordInput
                    value={loginForm.password}
                    onChange={(event) => setLoginForm({ ...loginForm, password: event.currentTarget.value })}
                    autoComplete="current-password"
                    placeholder="Enter password"
                    maxLength={128}
                    required
                  />
                </Field>
                <button className="primary-button auth-submit" type="submit" disabled={busy}>
                  {busy ? <LoadingSpinner size="sm" /> : <LogIn size={18} />}
                  {busy ? "Signing in" : "Sign in"}
                </button>
                </form>
              )}

              {authMode === "register" && (
                <form className="form-stack" onSubmit={onRegister}>
                <div className="form-grid">
                  <Field label="First name">
                    <input value={registerForm.firstName} onChange={(event) => setRegisterForm({ ...registerForm, firstName: event.target.value.slice(0, 50) })} maxLength={50} required />
                  </Field>
                  <Field label="Last name">
                    <input value={registerForm.lastName} onChange={(event) => setRegisterForm({ ...registerForm, lastName: event.target.value.slice(0, 50) })} maxLength={50} required />
                  </Field>
                </div>
                <Field label="Username">
                  <input value={registerForm.userName} onChange={(event) => setRegisterForm({ ...registerForm, userName: event.target.value.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 30) })} maxLength={30} spellCheck={false} required />
                </Field>
                <Field label="Email">
                  <input type="email" value={registerForm.email} onChange={(event) => setRegisterForm({ ...registerForm, email: event.target.value.slice(0, 120) })} maxLength={120} spellCheck={false} required />
                </Field>
                <div className="form-grid">
                  <Field label="Country code">
                    <input value={registerForm.countryCode} onChange={(event) => setRegisterForm({ ...registerForm, countryCode: event.target.value.replace(/[^\d+]/g, "").slice(0, 5) })} maxLength={5} inputMode="tel" required />
                  </Field>
                  <Field label="Phone number">
                    <input value={registerForm.phoneNumber} onChange={(event) => setRegisterForm({ ...registerForm, phoneNumber: event.target.value.replace(/\D/g, "").slice(0, 15) })} maxLength={15} inputMode="tel" required />
                  </Field>
                </div>
                <div className="form-grid">
                  <Field label="Password">
                    <PasswordInput
                      value={registerForm.password}
                      onChange={(event) => setRegisterForm({ ...registerForm, password: event.currentTarget.value })}
                      maxLength={128}
                      required
                    />
                  </Field>
                  <Field label="Confirm password">
                    <PasswordInput
                      value={registerForm.confirmPassword}
                      onChange={(event) => setRegisterForm({ ...registerForm, confirmPassword: event.currentTarget.value })}
                      maxLength={128}
                      required
                    />
                  </Field>
                </div>
                <button className="primary-button auth-submit" type="submit" disabled={busy}>
                  {busy ? <LoadingSpinner size="sm" /> : <Plus size={18} />}
                  {busy ? "Creating account" : "Create account"}
                </button>
                </form>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
