type LoadingSpinnerProps = {
  size?: "sm" | "md" | "lg";
  label?: string;
  fullScreen?: boolean;
  className?: string;
};

export function LoadingSpinner({
  size = "md",
  label,
  fullScreen = false,
  className = ""
}: LoadingSpinnerProps) {
  const classes = [
    "loading-spinner-root",
    fullScreen ? "loading-spinner-full-screen" : "",
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} role="status" aria-live="polite" aria-busy="true">
      <span className={`loading-spinner-ring loading-spinner-ring-${size}`} aria-hidden="true" />
      {label ? <span className="loading-spinner-label">{label}</span> : <span className="visually-hidden">Loading</span>}
    </div>
  );
}
