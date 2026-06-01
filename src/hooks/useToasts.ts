import { useCallback, useState } from "react";
import type { Toast } from "../types";

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.map((toast) => (toast.id === id ? { ...toast, exiting: true } : toast)));
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 280);
  }, []);

  const pushToast = useCallback((type: Toast["type"], title: string, message?: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const fallback =
      type === "success"
        ? "The operation completed successfully."
        : type === "error"
          ? "Please review the request and try again."
          : "The request was handled.";
    setToasts((current) => [...current, { id, type, title, message: message ?? fallback }]);
    window.setTimeout(() => {
      dismissToast(id);
    }, 6500);
  }, [dismissToast]);

  return { toasts, dismissToast, pushToast };
}
