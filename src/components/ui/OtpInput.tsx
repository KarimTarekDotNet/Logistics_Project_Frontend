import { useRef } from "react";

export function OtpInput(props: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const lastCompletedCodeRef = useRef("");
  const value = props.value.replace(/\D/g, "").slice(0, 6);
  const cells = Array.from({ length: 6 }, (_, index) => value[index] ?? "");

  function handleChange(rawValue: string) {
    const nextValue = rawValue.replace(/\D/g, "").slice(0, 6);
    props.onChange(nextValue);

    if (nextValue.length < 6) {
      lastCompletedCodeRef.current = "";
      return;
    }

    if (nextValue !== lastCompletedCodeRef.current) {
      lastCompletedCodeRef.current = nextValue;
      props.onComplete?.(nextValue);
    }
  }

  return (
    <div
      className={`otp-control ${props.disabled ? "disabled" : ""}`}
      onClick={() => inputRef.current?.focus()}
      role="group"
      aria-label={props.ariaLabel ?? "Phone verification code"}
    >
      <input
        ref={inputRef}
        className="otp-hidden-input"
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        maxLength={6}
        disabled={props.disabled}
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
