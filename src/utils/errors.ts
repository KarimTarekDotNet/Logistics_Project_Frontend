import { ApiError } from "../services/api";

export const API_ERROR_MESSAGES: Readonly<Record<number, string>> = {
  400: "Invalid request.",
  401: "Please sign in again.",
  403: "You do not have permission to complete this action.",
  404: "Resource not found.",
  409: "The operation conflicts with the current state.",
  419: "The request security check failed. Please try again.",
  422: "Validation failed. Please review the entered information.",
  429: "Too many requests. Please wait a moment and try again.",
  500: "Something went wrong. Please try again."
};

export function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Unexpected error";
}

function getApiStatusMessage(status: number) {
  if (status >= 500) return API_ERROR_MESSAGES[500];
  return API_ERROR_MESSAGES[status];
}

export function getFriendlyErrorMessage(error: unknown, fallback = "The request could not be completed. Please try again.") {
  logTechnicalError("Request failed", error);

  if (error instanceof ApiError) {
    const apiMessage = error.message.trim();
    if ([400, 409, 422].includes(error.status) && apiMessage && !apiMessage.startsWith("Request failed with status")) {
      return apiMessage;
    }

    return getApiStatusMessage(error.status) ?? fallback;
  }

  if (error instanceof TypeError) {
    return "The server could not be reached. Please check your connection and try again.";
  }

  return fallback;
}

export function logTechnicalError(context: string, error: unknown) {
  if (import.meta.env.DEV) {
    console.error(context, error);
  }
}

export function isNotFoundError(error: unknown) {
  return error instanceof ApiError && error.status === 404;
}

export function isBackendUnavailableError(error: unknown) {
  if (error instanceof ApiError) {
    const payloadText = typeof error.payload === "string" ? error.payload.trim().toLowerCase() : "";
    const message = error.message.toLowerCase();
    return (
      [502, 503, 504].includes(error.status) ||
      (error.status === 500 && (!payloadText || message.includes("proxy") || payloadText.includes("proxy")))
    );
  }

  if (error instanceof TypeError) return true;

  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("load failed") ||
    message.includes("network request failed")
  );
}

export async function safe<T>(call: () => Promise<T>, fallback: T) {
  try {
    return await call();
  } catch {
    return fallback;
  }
}
