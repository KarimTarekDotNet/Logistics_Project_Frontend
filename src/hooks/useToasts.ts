import { useCallback, useEffect, useRef, useState } from "react";
import type { Toast } from "../types";

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const activeToastIdRef = useRef<number | null>(null);
  const nextToastIdRef = useRef(1);
  const dismissTimerRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);

  const clearTimer = useCallback((timerRef: { current: number | null }) => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const dismissToast = useCallback((id: number) => {
    if (activeToastIdRef.current !== id) return;

    clearTimer(dismissTimerRef);
    clearTimer(exitTimerRef);
    setToasts((current) => current.map((toast) => (toast.id === id ? { ...toast, exiting: true } : toast)));
    exitTimerRef.current = window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
      if (activeToastIdRef.current === id) activeToastIdRef.current = null;
      exitTimerRef.current = null;
    }, 280);
  }, [clearTimer]);

  const pushToast = useCallback((type: Toast["type"], title: string, message?: string) => {
    clearTimer(dismissTimerRef);
    clearTimer(exitTimerRef);

    const id = nextToastIdRef.current++;
    const fallback =
      type === "success"
        ? "The operation completed successfully."
        : type === "error"
          ? "Please review the request and try again."
          : "The request was handled.";

    activeToastIdRef.current = id;
    setToasts([{ id, type, title, message: message ?? fallback }]);
    dismissTimerRef.current = window.setTimeout(() => {
      dismissToast(id);
    }, 6500);
  }, [clearTimer, dismissToast]);

  useEffect(() => {
    return () => {
      clearTimer(dismissTimerRef);
      clearTimer(exitTimerRef);
    };
  }, [clearTimer]);

  return { toasts, dismissToast, pushToast };
}
