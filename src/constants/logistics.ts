export const DEFAULT_CURRENCY = "USD";
export const CURRENCY_LOCK_NOTE = "مؤقت لحد ما نضيف عملات أخرى";
export const ALLOWED_CURRENCIES = [DEFAULT_CURRENCY] as const;

export const SESSION_KEY = "logistic-project-session";
export const PENDING_VERIFICATION_KEY = "logistic-project-pending-verification";
export const THEME_KEY = "logistic-project-theme";

export const payerTypes = [
  { label: "Shipper", value: 0 },
  { label: "Consignee", value: 1 },
  { label: "Third Party", value: 2 }
];

export const chargeTypes = [
  { label: "Ocean Freight", value: 0 },
  { label: "Customs", value: 1 },
  { label: "Documentation", value: 2 },
  { label: "Insurance", value: 3 },
  { label: "Handling", value: 4 },
  { label: "Storage", value: 5 },
  { label: "Other", value: 6 }
];

export const documentTypes = [
  { label: "Shipping Instructions", value: 0 },
  { label: "Draft Bill of Lading", value: 1 },
  { label: "Final Bill of Lading", value: 2 },
  { label: "Payment Proof", value: 3 },
  { label: "Invoice", value: 4 },
  { label: "Booking Confirmation", value: 5 },
  { label: "Customs Document", value: 6 },
  { label: "Other", value: 7 }
];

export const shipmentStatuses = [
  "Created",
  "ClientConfirmed",
  "BookingRequested",
  "BookingConfirmed",
  "ShippingInstructionsSubmitted",
  "DraftBLReceived",
  "DraftBLApproved",
  "PaymentPending",
  "PaymentCompleted",
  "TelexReleased",
  "Delivered",
  "Closed",
  "Cancelled",
  "OnHold"
];

export const integrationSources = ["Workflow_Automation", "Carrier_Api", "Email_Import"] as const;
