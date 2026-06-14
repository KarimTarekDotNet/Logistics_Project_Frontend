export type Role = "Admin" | "Staff" | "User" | "Integration";

export type View =
  | "overview"
  | "pricing"
  | "subscriptions"
  | "master-data"
  | "quotes"
  | "shipments"
  | "finance"
  | "documents"
  | "account";

export type AccountSection = "profile" | "email" | "phone" | "security" | "subscription" | "customer" | "language";
export type AppLanguage = "en" | "ar";

export type RegisterForm = {
  firstName: string;
  lastName: string;
  userName: string;
  email: string;
  countryCode: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
};

export type Toast = {
  id: number;
  type: "success" | "error" | "info";
  title: string;
  message: string;
  exiting?: boolean;
};

export type AuthResponse = {
  isAuthenticated: boolean;
  id?: string;
  userName?: string;
  email?: string;
  phoneNumber?: string | null;
  message: string;
  expiration: string;
  accessToken?: string;
  refreshToken?: string;
};

export type AuthSession = {
  accessToken: string;
  refreshToken?: string;
  id?: string;
  userName?: string;
  email?: string;
  roles: string[];
  expiresAt?: string;
};

export type QueryParams = {
  pageNumber?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  onlyActive?: boolean;
  onlyCurrentlyValid?: boolean;
  carrierName?: string;
  containerTypeName?: string;
  fromPortName?: string;
  toPortName?: string;
  minPrice?: number;
  maxPrice?: number;
  currency?: string;
  validFrom?: string;
  validTo?: string;
  createdFrom?: string;
  createdTo?: string;
  deliveredFrom?: string;
  deliveredTo?: string;
  deletedFrom?: string;
  deletedTo?: string;
  dateOfBirth?: string;
};

export type Carrier = {
  id: string;
  name: string;
  code: string;
};

export type Port = {
  id: string;
  name: string;
  code: string;
  country: string;
};

export type Route = {
  id: string;
  fromPortId: string;
  fromPortName: string;
  fromPortCode: string;
  toPortId: string;
  toPortName: string;
  toPortCode: string;
};

export type ContainerType = {
  id: string;
  name: string;
};

export type Rate = {
  id: string;
  carrierId: string;
  carrierName: string;
  routeId: string;
  fromPortCode: string;
  toPortCode: string;
  containerTypeId: string;
  containerTypeName: string;
  price: number;
  currency: string;
  validFrom: string;
  validTo: string;
  maxGrossWeightKg?: number | null;
  maxNetWeightKg?: number | null;
  maxVolumeCbm?: number | null;
  allowsHazardous?: boolean | null;
  minTemperatureCelsius?: number | null;
  maxTemperatureCelsius?: number | null;
  createdAt: string;
  isActive: boolean;
};

export type MarketAnalytics = {
  cheapestPrice: number;
  highestPrice: number;
  averagePrice: number;
  activeCount: number;
  currency: string;
  rates?: Rate[];
};

export type RecommendationPriority = "Cheapest" | "Fastest" | "Balanced" | "Reliable";

export type MarketPosition = "BelowMarket" | "AverageMarket" | "AboveMarket" | number;

export type RecommendedRate = {
  rate: Rate;
  score: number;
  recommendationReason: string;
  transitDays?: number | null;
  marketPosition: MarketPosition;
  isCheapest: boolean;
};

export type RateRecommendationResponse = {
  recommendations: RecommendedRate[];
};

export type QuoteStatus = "Pending" | "Accepted" | "Rejected" | number;
export type QuoteRequestStatus = "PendingReview" | "Approved" | "Rejected" | "Cancelled" | number;

export type Quote = {
  id: string;
  customerId: string;
  customerName: string;
  rateId: string;
  routeId: string;
  fromPortCode: string;
  toPortCode: string;
  carrierId: string;
  carrierName: string;
  containerTypeId: string;
  containerTypeName: string;
  finalPrice: number;
  currency: string;
  requestedGrossWeightKg: number;
  requestedNetWeightKg: number;
  requestedVolumeCbm: number;
  isHazardous: boolean;
  requiredTemperatureCelsius?: number | null;
  status: QuoteStatus;
  createdAt: string;
};

export type QuoteRequest = {
  id: string;
  customerId: string;
  customerName: string;
  rateId: string;
  routeId: string;
  fromPortCode: string;
  toPortCode: string;
  carrierId: string;
  carrierName: string;
  containerTypeId: string;
  containerTypeName: string;
  requestedRatePrice: number;
  currency: string;
  requestedGrossWeightKg: number;
  requestedNetWeightKg: number;
  requestedVolumeCbm: number;
  isHazardous: boolean;
  requiredTemperatureCelsius?: number | null;
  status: QuoteRequestStatus;
  rejectionReason?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  reviewedByUserName?: string | null;
};

export type ShipmentItem = {
  id: string;
  shipmentId: string;
  description: string;
  quantity: number;
  chargeableWeight: number;
  grossWeight: number;
  netWeight: number;
  volumeCbm: number;
  isHazardous: boolean;
  requiredTemperatureCelsius?: number | null;
  marksAndNumbers?: string | null;
  createdAt: string;
  updatedAt?: string | null;
};

export type ShipmentCharge = {
  id: string;
  shipmentId: string;
  invoiceId?: string | null;
  description: string;
  amount: number;
  taxAmount: number;
  currency: string;
  totalAmount: number;
  chargeType: string;
  payerType: string;
  createdAt: string;
};

export type ShipmentHistory = {
  id: string;
  shipmentId: string;
  fromStatus: string;
  toStatus: string;
  changedAt: string;
  changedByUserId?: string;
  changedByRole?: string;
  changedBy?: string;
  reason?: string;
};

export type Shipment = {
  id: string;
  quoteId: string;
  routeId: string;
  carrierId: string;
  containerTypeId: string;
  customerId: string;
  customerName: string;
  containerTypeName: string;
  carrierName: string;
  agreedPrice: number;
  currency: string;
  status: string;
  createdAt: string;
  clientConfirmedAt?: string;
  bookingRequestedAt?: string;
  bookingConfirmedAt?: string;
  shippingInstructionsSubmittedAt?: string;
  draftBlReceivedAt?: string;
  draftBlApprovedAt?: string;
  paymentPendingAt?: string;
  paymentConfirmedAt?: string;
  telexReleasedAt?: string;
  deliveredAt?: string;
  closedAt?: string;
  bookingNumber?: string;
  vesselName?: string;
  voyageNumber?: string;
  cancellationReason?: string;
  holdReason?: string;
  currentCheckpoint?: string;
  estimatedDeparture?: string;
  estimatedArrival?: string;
  actualDeparture?: string;
  actualArrival?: string;
  items: ShipmentItem[];
  charges: ShipmentCharge[];
  statusHistory: ShipmentHistory[];
};

export type Customer = {
  id: string;
  applicationUserId: string;
  nationalId?: string;
  dateOfBirth?: string;
  companyName?: string;
  taxNumber?: string;
  createdAt: string;
  updatedAt?: string;
  shipments: Shipment[];
  quotes: Quote[];
};

export type ProfileResponse = {
  name: string;
  firstName?: string;
  lastName?: string;
  username: string;
  email: string;
  phoneNumber: string;
  phoneNumberConfirmed: boolean;
  customer?: Customer;
};

export type ProfileUpdateResponse = {
  isEmailVerificationSent: boolean;
  isPhoneVerificationSent: boolean;
  message?: string;
  updatedProfile?: ProfileResponse;
};

export type Invoice = {
  id: string;
  shipment?: Shipment;
  invoiceNumber: string;
  currency: string;
  charges: ShipmentCharge[];
  subTotal: number;
  taxAmount: number;
  totalAmount: number;
  paidPart?: number | null;
  remainingAmount?: number | null;
  remainingBalance?: number | null;
  amountDue?: number | null;
  balanceDue?: number | null;
  paymentStatus: string;
  issuedAt: string;
  dueDate: string;
  paidAt?: string;
  payerType: string;
  payments?: InvoicePayment[];
};

export type InvoicePaymentRequest = {
  amount: number;
  currency: string;
  referenceNumber?: string;
};

export type InvoicePayment = {
  id: string;
  transactionId?: string | null;
  referenceNumber?: string | null;
  amount: number;
  currency?: string | null;
  paymentMethod?: string | null;
  paymentProvider?: string | null;
  status?: string | null;
  paidAt: string;
};

export type PaymentTransactionStatus = "Pending" | "Succeeded" | "Failed" | "Refunded" | "Cancelled" | number;

export type StartPaymentRequest = {
  invoiceId?: string | null;
  subscriptionPlanId?: string | null;
};

export type StartPaymentResponse = {
  paymentTransactionId: string;
  clientSecret: string;
  status: PaymentTransactionStatus;
};

export type CheckoutPaymentResponse = {
  checkoutUrl?: string | null;
  CheckoutUrl?: string | null;
};

export type PaymentTransactionResponse = {
  id: string;
  invoiceId?: string | null;
  subscriptionPlanId?: string | null;
  amount: number;
  currency: string;
  provider: string;
  method: string;
  status: string;
  failureReason?: string | null;
  paidAt?: string | null;
  createdAt: string;
};

export type SubscriptionPlan = {
  id: string;
  title: string;
  description: string;
  currency: string;
  price: number;
  durationInDays: number;
  isActive: boolean;
  subscriptionFeatureResponses: SubscriptionFeature[];
  subscriptionPlanLimitResponses: SubscriptionPlanLimit[];
};

export type SubscriptionFeature = {
  id: string;
  code: string;
  name: string;
};

export type SubscriptionPlanLimit = {
  id: string;
  code: string;
  maxValue: number;
};

export type CreateSubscriptionFeature = {
  code: string;
  name: string;
};

export type CreateSubscriptionPlanLimit = {
  code: string;
  maxValue: number;
};

export type CreateSubscriptionPlanRequest = {
  title: string;
  description: string;
  currency: "EGP";
  price: number;
  durationInDays: number;
  createSubscriptionFeatures: CreateSubscriptionFeature[];
  createSubscriptionPlanLimits: CreateSubscriptionPlanLimit[];
};

export type UserSubscriptionUsage = {
  id: string;
  limitCode: string;
  usedValue: number;
  periodStart: string;
  periodEnd: string;
};

export type UserSubscription = {
  id: string;
  username: string;
  subscriptionPlanTitle: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
  usages: UserSubscriptionUsage[];
};

export type ShipmentDocument = {
  id: string;
  shipmentId: string;
  type: string;
  fileName: string;
  storagePath: string;
  contentType: string;
  uploadedByUserId: string;
  uploadedByUsername: string;
  uploadedAt: string;
};

export type TimelineItem = {
  type: string;
  category: string;
  title: string;
  description?: string;
  amount?: number;
  currency?: string;
  createdAt: string;
  createdBy?: string;
};

export type RateDraft = {
  carrierId: string;
  routeId: string;
  containerTypeId: string;
  price: string;
  currency: string;
  validFrom: string;
  validTo: string;
  maxGrossWeightKg: string;
  maxNetWeightKg: string;
  maxVolumeCbm: string;
  allowsHazardous: boolean;
  minTemperatureCelsius: string;
  maxTemperatureCelsius: string;
};

export type RateBookFilterDraft = {
  search: string;
  carrierName: string;
  containerTypeName: string;
  fromPortName: string;
  toPortName: string;
  minPrice: string;
  maxPrice: string;
  currency: string;
  validFrom: string;
  validTo: string;
  createdFrom: string;
  createdTo: string;
  onlyActive: boolean;
  onlyCurrentlyValid: boolean;
  sortBy: string;
  pageNumber: string;
  pageSize: string;
};

export type RateRecommendationDraft = {
  routeId: string;
  containerTypeId: string;
  currency: string;
  maxPrice: string;
  limit: string;
  priority: RecommendationPriority;
};

export type QuoteDraft = {
  customerId: string;
  rateId: string;
  requestedGrossWeightKg: string;
  requestedNetWeightKg: string;
  requestedVolumeCbm: string;
  isHazardous: boolean;
  requiredTemperatureCelsius: string;
};

export type QuoteRequestDraft = {
  rateId: string;
  requestedGrossWeightKg: string;
  requestedNetWeightKg: string;
  requestedVolumeCbm: string;
  isHazardous: boolean;
  requiredTemperatureCelsius: string;
  notes: string;
};

export type TrackingDraft = {
  bookingNumber: string;
  vesselName: string;
  voyageNumber: string;
  currentCheckpoint: string;
  estimatedDeparture: string;
  estimatedArrival: string;
  actualDeparture: string;
  actualArrival: string;
};

export type ShipmentItemDraft = {
  description: string;
  quantity: string;
  grossWeight: string;
  netWeight: string;
  volumeCbm: string;
  isHazardous: boolean;
  requiredTemperatureCelsius: string;
  marksAndNumbers: string;
};

export type ProfileDraft = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phoneNumber: string;
};

export type PasswordDraft = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export type VerifyDraft = {
  email: string;
  phone: string;
  phoneCode: string;
  pendingPhoneCode: string;
};

export type VerificationStep = "email" | "phone";

export type CustomerDraft = {
  mode: "individual" | "company";
  nationalId: string;
  dateOfBirth: string;
  companyName: string;
  taxNumber: string;
  countryCode: string;
};

export type AppData = {
  rates: Rate[];
  quoteRequests: QuoteRequest[];
  carriers: Carrier[];
  ports: Port[];
  routes: Route[];
  containerTypes: ContainerType[];
  quotes: Quote[];
  shipments: Shipment[];
  customers: Customer[];
  currentCustomer?: Customer;
};
