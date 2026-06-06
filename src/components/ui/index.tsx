import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
  Search,
  X,
  XCircle
} from "lucide-react";
import { useMemo, useState, type InputHTMLAttributes, type ReactNode } from "react";
import type { Toast } from "../../types";
import { compactStatus } from "../../utils/format";
import { statusClass } from "../../utils/search";

export { LoadingSpinner } from "./LoadingSpinner";

export function SectionHeader(props: { icon: ReactNode; title: string; meta?: string; children?: ReactNode }) {
  return (
    <div className="section-header">
      <div className="section-heading">
        <span className="section-icon">{props.icon}</span>
        <div>
          <h1>{props.title}</h1>
          {props.meta && <span>{props.meta}</span>}
        </div>
      </div>
      {props.children && <div className="section-actions">{props.children}</div>}
    </div>
  );
}

export function PanelTitle(props: { icon: ReactNode; title: string; meta?: ReactNode }) {
  return (
    <div className="panel-title">
      <span className="panel-title-icon">{props.icon}</span>
      <h2>{props.title}</h2>
      {props.meta && <span className="panel-title-meta">{props.meta}</span>}
    </div>
  );
}

export function Field(props: { label: string; children: ReactNode; hint?: string; error?: string }) {
  return (
    <label className={`field ${props.error ? "has-error" : ""}`}>
      <span>{props.label}</span>
      {props.children}
      {props.error && <small className="field-error">{props.error}</small>}
      {!props.error && props.hint && <small className="field-hint">{props.hint}</small>}
    </label>
  );
}

export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <div className="password-control">
      <input {...props} type={visible ? "text" : "password"} />
      <button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? "Hide password" : "Show password"}>
        <Icon size={17} />
      </button>
    </div>
  );
}

export function StatCard(props: { icon: ReactNode; label: string; value: ReactNode; tone?: "blue" | "green" | "amber" | "red" }) {
  return (
    <div className={`stat-card ${props.tone ?? "blue"}`}>
      <span>{props.icon}</span>
      <div>
        <small>{props.label}</small>
        <strong>{props.value}</strong>
      </div>
    </div>
  );
}

export function MetricLine(props: { label: string; value: ReactNode }) {
  return (
    <div className="metric-line">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

export function StatusBadge(props: { status: string | number; group?: "quote" | "quoteRequest" }) {
  const label = compactStatus(props.status, props.group);
  return <span className={`status-badge ${statusClass(label)}`}>{label}</span>;
}

export function EmptyState(props: { icon: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      {props.icon}
      <strong>{props.title}</strong>
      {props.description && <p>{props.description}</p>}
      {props.action}
    </div>
  );
}

export function SearchInput(props: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <div className="search-box">
      <Search size={17} />
      <input
        value={props.value}
        onChange={(event) => props.onChange(event.target.value.slice(0, 100))}
        placeholder={props.placeholder ?? "Search"}
        maxLength={100}
        spellCheck={false}
      />
    </div>
  );
}

export function ConfirmDialog(props: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  busy?: boolean;
  children?: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!props.open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={props.onClose}>
      <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="dialog-close-button" onClick={props.onClose} disabled={props.busy} aria-label="Close confirmation">
          <X size={16} />
        </button>
        <div className={`confirm-icon ${props.tone === "danger" ? "danger" : ""}`}>
          <AlertTriangle size={22} />
        </div>
        <div>
          <h2 id="confirm-title">{props.title}</h2>
          <p>{props.message}</p>
        </div>
        {props.children && <div className="dialog-extra">{props.children}</div>}
        <div className="dialog-actions">
          <button type="button" className="secondary-button" onClick={props.onClose} disabled={props.busy}>
            {props.cancelLabel ?? "Cancel"}
          </button>
          <button type="button" className={props.tone === "danger" ? "danger-button" : "primary-button"} onClick={props.onConfirm} disabled={props.busy}>
            {props.confirmLabel ?? "OK"}
          </button>
        </div>
      </section>
    </div>
  );
}

export function ToastHost(props: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  const icons = useMemo(
    () => ({
      success: <CheckCircle2 size={18} />,
      error: <XCircle size={18} />,
      info: <Info size={18} />
    }),
    []
  );

  return (
    <div className="toast-host" aria-live="polite" aria-atomic="true">
      {props.toasts.map((toast) => (
        <div className={`toast ${toast.type} ${toast.exiting ? "exiting" : ""}`} key={toast.id}>
          <span className="toast-icon">{icons[toast.type]}</span>
          <div className="toast-content">
            <strong>{toast.title}</strong>
            <span>{toast.message}</span>
          </div>
          <svg className="toast-timer" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="toast-timer-track" cx="12" cy="12" r="8" />
            <circle className="toast-timer-ring" cx="12" cy="12" r="8" pathLength="100" />
          </svg>
          <button type="button" onClick={() => props.onDismiss(toast.id)} aria-label="Dismiss message">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function EntityActions(props: { children: ReactNode }) {
  return <div className="entity-actions">{props.children}</div>;
}
