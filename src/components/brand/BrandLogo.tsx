import { BRAND_NAME } from "../../constants/brand";

type BrandLogoSize = "sm" | "md" | "lg";

export function BrandLogo(props: { size?: BrandLogoSize; className?: string; alt?: string }) {
  const size = props.size ?? "md";
  const className = ["brand-mark", `brand-mark--${size}`, props.className].filter(Boolean).join(" ");

  return (
    <span className={className} role="img" aria-label={props.alt ?? `${BRAND_NAME} automation flow mark`}>
      <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <path className="brand-flow-track" d="M10 31C17 16 29 15 38 23" />
        <path className="brand-flow-line" d="M10 31C17 16 29 15 38 23" />
        <circle className="brand-node brand-node-start" cx="10" cy="31" r="4" />
        <circle className="brand-node brand-node-mid" cx="24" cy="18" r="5" />
        <circle className="brand-node brand-node-end" cx="38" cy="23" r="4" />
      </svg>
    </span>
  );
}
