import { LockKeyhole, Settings } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AppShell } from "./components/layout/AppShell";
import { ProfilePreviewModal } from "./components/layout/ProfilePreviewModal";
import { ConfirmDialog, LoadingState, ToastHost } from "./components/ui";
import { THEME_KEY, PENDING_VERIFICATION_KEY } from "./constants/logistics";
import {
  buildShipmentItemPayload,
  emptyShipmentItemDraft,
  shipmentItemToDraft
} from "./features/shipments/shipmentItems";
import { getWorkflowCharges } from "./features/shipments/shipmentCharges";
import { useShipmentWorkspace } from "./hooks/useShipmentWorkspace";
import { useToasts } from "./hooks/useToasts";
import { AccountPage } from "./pages/AccountPage";
import { AuthPage } from "./pages/AuthPage";
import { ChargeGenerationPage } from "./pages/ChargeGenerationPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { FinancePage } from "./pages/FinancePage";
import { InvoiceReviewPage } from "./pages/InvoiceReviewPage";
import { MasterDataPage } from "./pages/MasterDataPage";
import { OverviewPage } from "./pages/OverviewPage";
import { PricingPage, type AnalyticsDraft } from "./pages/PricingPage";
import { PublicLandingPage } from "./pages/PublicLandingPage";
import { QuoteRequestDetailsPage } from "./pages/QuoteRequestDetailsPage";
import { QuotesPage } from "./pages/QuotesPage";
import { ShipmentsPage } from "./pages/ShipmentsPage";
import { ApiError, api, SESSION_REFRESHED_EVENT } from "./services/api";
import type {
  AppData,
  AuthResponse,
  AuthSession,
  Carrier,
  ContainerType,
  Customer,
  CustomerDraft,
  Invoice,
  InvoicePaymentRequest,
  MarketAnalytics,
  PasswordDraft,
  Port,
  ProfileDraft,
  ProfileResponse,
  ProfileUpdateResponse,
  QueryParams,
  Quote,
  QuoteDraft,
  QuoteRequest,
  Rate,
  RateBookFilterDraft,
  RateDraft,
  RateRecommendationDraft,
  RateRecommendationResponse,
  RegisterForm,
  Route,
  Shipment,
  ShipmentCharge,
  ShipmentItem,
  ShipmentItemDraft,
  TrackingDraft,
  VerificationStep,
  VerifyDraft,
  View
} from "./types";
import { getFriendlyErrorMessage, isBackendUnavailableError, isNotFoundError, safe } from "./utils/errors";
import { getLocalDateTime, isoToLocalDateTime, toIso } from "./utils/format";
import { isValidId } from "./utils/ids";
import { getAppPath, getAppPathname, toBrowserPath } from "./utils/navigation";
import { loadPendingVerification, loadStoredSession, persistSession, sessionFromAuth } from "./utils/session";

const initialData: AppData = {
  rates: [],
  quoteRequests: [],
  carriers: [],
  ports: [],
  routes: [],
  containerTypes: [],
  quotes: [],
  shipments: [],
  customers: []
};

type ShipmentWorkflowStep = "charges" | "invoice";

const initialRegisterForm: RegisterForm = {
  firstName: "",
  lastName: "",
  userName: "",
  email: "",
  countryCode: "+20",
  phoneNumber: "",
  password: "",
  confirmPassword: ""
};

const initialRateDraft: RateDraft = {
  carrierId: "",
  routeId: "",
  containerTypeId: "",
  price: "1500",
  currency: "USD",
  validFrom: getLocalDateTime(),
  validTo: getLocalDateTime(30),
  maxGrossWeightKg: "",
  maxNetWeightKg: "",
  maxVolumeCbm: "",
  allowsHazardous: false,
  minTemperatureCelsius: "",
  maxTemperatureCelsius: ""
};

const initialRecommendationDraft: RateRecommendationDraft = {
  routeId: "",
  containerTypeId: "",
  currency: "USD",
  maxPrice: "",
  limit: "5",
  priority: "Cheapest"
};

const initialRateBookFilters: RateBookFilterDraft = {
  search: "",
  carrierName: "",
  containerTypeName: "",
  fromPortName: "",
  toPortName: "",
  minPrice: "",
  maxPrice: "",
  currency: "",
  validFrom: "",
  validTo: "",
  createdFrom: "",
  createdTo: "",
  onlyActive: false,
  onlyCurrentlyValid: false,
  sortBy: "price_asc",
  pageNumber: "1",
  pageSize: "10"
};

const initialShipmentItemDraft: ShipmentItemDraft = {
  ...emptyShipmentItemDraft()
};

function positiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function finiteNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function clampedInteger(value: string, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function trimOrUndefined(value: string, maxLength?: number) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function normalizeStatusKey(status?: string) {
  return String(status ?? "").replace(/[\s_-]+/g, "").toLowerCase();
}

function canQueryInvoicesForShipment(shipment?: Shipment) {
  return Boolean(shipment);
}

function readConfirmationLink(path: string) {
  const url = new URL(path, window.location.origin);
  const pathname = getAppPathname(url.pathname).toLowerCase();
  const isEmailConfirmation = pathname === "/confirm-email";
  const isEmailChangeConfirmation = pathname === "/confirm-email-change";

  if (!isEmailConfirmation && !isEmailChangeConfirmation) return null;

  return {
    type: isEmailConfirmation ? ("registration-email" as const) : ("profile-email" as const),
    userId: url.searchParams.get("userId") ?? url.searchParams.get("UserId") ?? "",
    token: (url.searchParams.get("token") ?? url.searchParams.get("Token") ?? "").replace(/ /g, "+")
  };
}

type ConfirmationRequestResult =
  | { type: "registration-email"; response: AuthResponse }
  | { type: "profile-email"; response: ProfileUpdateResponse };

function getConfirmationSafePath(type: "registration-email" | "profile-email") {
  return type === "registration-email" ? "/confirm-email" : "/confirm-email-change";
}

const browserGuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function hasSensitiveUrlDetails(path: string) {
  const confirmationLink = readConfirmationLink(path);
  if (confirmationLink) return false;

  const url = new URL(path, window.location.origin);
  const pathname = getAppPathname(url.pathname);
  const hasQuery = Array.from(url.searchParams.keys()).length > 0;
  const hasRecordId = pathname
    .split("/")
    .filter(Boolean)
    .some((segment) => browserGuidPattern.test(decodeURIComponent(segment)));

  return hasQuery || hasRecordId;
}

type ActionConfirmationOptions = {
  title?: string;
  message?: string;
  confirmLabel?: string;
  tone?: "danger" | "default";
};

type PendingActionConfirmation = Required<ActionConfirmationOptions> & {
  resolve: (confirmed: boolean) => void;
};

function CustomerRequiredView(props: { onGoToSettings: () => void }) {
  return (
    <div className="customer-lock-view">
      <div className="customer-lock-preview" aria-hidden="true">
        <div className="customer-lock-row wide" />
        <div className="customer-lock-grid">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="customer-lock-table">
          {Array.from({ length: 5 }, (_, index) => (
            <span key={index} />
          ))}
        </div>
      </div>

      <section className="customer-lock-panel" aria-labelledby="customer-lock-title">
        <span className="customer-lock-icon">
          <LockKeyhole size={24} />
        </span>
        <div>
          <h1 id="customer-lock-title">Customer profile required</h1>
          <p>This workspace is locked until you create your customer profile. Add your customer details in settings to load quotes, shipments, invoices, and documents.</p>
        </div>
        <button className="primary-button compact" type="button" onClick={props.onGoToSettings}>
          <Settings size={16} />
          Go to settings
        </button>
      </section>
    </div>
  );
}

function buildRateQuery(filters: RateBookFilterDraft): QueryParams {
  const search = trimOrUndefined(filters.search, 100);
  const currency = trimOrUndefined(filters.currency.toUpperCase(), 4);

  return {
    pageNumber: clampedInteger(filters.pageNumber, 1, 1, Number.MAX_SAFE_INTEGER),
    pageSize: clampedInteger(filters.pageSize, 10, 1, 50),
    search,
    sortBy: trimOrUndefined(filters.sortBy, 50),
    onlyActive: filters.onlyActive || undefined,
    onlyCurrentlyValid: filters.onlyCurrentlyValid || undefined,
    carrierName: trimOrUndefined(filters.carrierName),
    containerTypeName: trimOrUndefined(filters.containerTypeName),
    fromPortName: trimOrUndefined(filters.fromPortName),
    toPortName: trimOrUndefined(filters.toPortName),
    minPrice: positiveNumber(filters.minPrice),
    maxPrice: positiveNumber(filters.maxPrice),
    currency,
    validFrom: toIso(filters.validFrom),
    validTo: toIso(filters.validTo),
    createdFrom: toIso(filters.createdFrom),
    createdTo: toIso(filters.createdTo)
  };
}

export default function App() {
  const [path, setPath] = useState(() => getAppPath());
  const pathname = getAppPathname(path);
  const hasSensitiveDetailsInPath = hasSensitiveUrlDetails(path);
  const [session, setSession] = useState<AuthSession | null>(() => loadStoredSession());
  const [restoringSession, setRestoringSession] = useState(true);
  const [serverUnavailable, setServerUnavailable] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem(THEME_KEY) as "dark" | "light" | null) ?? "dark";
  });
  const [activeView, setActiveView] = useState<View>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [data, setData] = useState<AppData>(initialData);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingActionConfirmation, setPendingActionConfirmation] = useState<PendingActionConfirmation | null>(null);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [shipmentWorkflowStep, setShipmentWorkflowStep] = useState<ShipmentWorkflowStep | null>(null);
  const [workflowInvoice, setWorkflowInvoice] = useState<Invoice | null>(null);
  const [pageLoading, setPageLoading] = useState(false);
  const [profilePreviewOpen, setProfilePreviewOpen] = useState(false);
  const [quoteRequestDetailId, setQuoteRequestDetailId] = useState<string | null>(null);
  const [quoteRequestDetail, setQuoteRequestDetail] = useState<QuoteRequest | null>(null);
  const [quoteRequestDetailLoading, setQuoteRequestDetailLoading] = useState(false);
  const [quoteRequestDetailError, setQuoteRequestDetailError] = useState<string | null>(null);
  const [authMetrics, setAuthMetrics] = useState({ publicRateCount: 0, workflowStateCount: 0 });
  const [itemUpdateReturnStep, setItemUpdateReturnStep] = useState<ShipmentWorkflowStep | null>(null);

  const [loginForm, setLoginForm] = useState({ identity: "", password: "" });
  const [registerForm, setRegisterForm] = useState<RegisterForm>(initialRegisterForm);
  const [authMode, setAuthMode] = useState<"login" | "register" | "verify">("login");
  const [verificationStep, setVerificationStep] = useState<VerificationStep>("email");
  const [verifyDraft, setVerifyDraft] = useState<VerifyDraft>(() => {
    const pending = loadPendingVerification();
    return {
      email: pending.email,
      phone: pending.phone,
      phoneCode: "",
      pendingPhoneCode: ""
    };
  });

  const [rateDraft, setRateDraft] = useState<RateDraft>(initialRateDraft);
  const [analyticsDraft, setAnalyticsDraft] = useState<AnalyticsDraft>({
    routeId: "",
    containerId: "",
    currency: "USD"
  });
  const [analytics, setAnalytics] = useState<MarketAnalytics | null>(null);
  const [recommendationDraft, setRecommendationDraft] = useState<RateRecommendationDraft>(initialRecommendationDraft);
  const [recommendations, setRecommendations] = useState<RateRecommendationResponse | null>(null);
  const [quoteDraft, setQuoteDraft] = useState<QuoteDraft>({
    customerId: "",
    rateId: "",
    requestedGrossWeightKg: "1000",
    requestedNetWeightKg: "900",
    requestedVolumeCbm: "8",
    isHazardous: false,
    requiredTemperatureCelsius: ""
  });
  const [shipmentDraft, setShipmentDraft] = useState({ quoteId: "" });
  const [quoteSearch, setQuoteSearch] = useState("");
  const [trackingDraft, setTrackingDraft] = useState<TrackingDraft>({
    bookingNumber: "",
    vesselName: "",
    voyageNumber: "",
    currentCheckpoint: "",
    estimatedDeparture: "",
    estimatedArrival: "",
    actualDeparture: "",
    actualArrival: ""
  });
  const [actionReason, setActionReason] = useState("");
  const [documentDraft, setDocumentDraft] = useState<{ type: number; file: File | null }>({ type: 0, file: null });
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    phoneNumber: ""
  });
  const [passwordDraft, setPasswordDraft] = useState<PasswordDraft>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [showProfileVerify, setShowProfileVerify] = useState<"email" | "phone" | null>(null);
  const [customerDraft, setCustomerDraft] = useState<CustomerDraft>({
    mode: "individual",
    nationalId: "",
    dateOfBirth: "",
    companyName: "",
    taxNumber: "",
    countryCode: "EG"
  });
  const [itemDraft, setItemDraft] = useState<ShipmentItemDraft>(initialShipmentItemDraft);
  const [lastItemDraft, setLastItemDraft] = useState<ShipmentItemDraft>(initialShipmentItemDraft);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const { toasts, dismissToast, pushToast } = useToasts();
  const workspace = useShipmentWorkspace(session, setData);
  const loadSequenceRef = useRef(0);
  const pageLoadingTimerRef = useRef<number | null>(null);
  const completedConfirmationLinksRef = useRef<Set<string>>(new Set());
  const confirmationRequestsRef = useRef<Map<string, Promise<ConfirmationRequestResult>>>(new Map());
  const [appliedRateBookFilters, setAppliedRateBookFilters] = useState<RateBookFilterDraft>(initialRateBookFilters);
  const appliedRateBookFiltersRef = useRef<RateBookFilterDraft>(initialRateBookFilters);

  const navigate = useCallback((nextPath: string, options: { replace?: boolean; scroll?: boolean } = {}) => {
    const normalized = nextPath.startsWith("/") ? nextPath : `/${nextPath || ""}`;
    const safePath = hasSensitiveUrlDetails(normalized) ? "/" : normalized;
    if (getAppPath() !== safePath) {
      const browserPath = toBrowserPath(safePath);
      if (options.replace) {
        window.history.replaceState(null, "", browserPath);
      } else {
        window.history.pushState(null, "", browserPath);
      }
    }
    setPath(getAppPath());
    if (options.scroll !== false) window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const showPageLoading = useCallback((duration = 520) => {
    if (pageLoadingTimerRef.current) {
      window.clearTimeout(pageLoadingTimerRef.current);
    }
    setPageLoading(true);
    pageLoadingTimerRef.current = window.setTimeout(() => {
      setPageLoading(false);
      pageLoadingTimerRef.current = null;
    }, duration);
  }, []);

  const selectWorkspaceView = useCallback(
    (view: View) => {
      if (view !== activeView) showPageLoading();
      setActiveView(view);
      setWorkflowInvoice(null);
      setShipmentWorkflowStep(null);
      setItemUpdateReturnStep(null);
      setQuoteRequestDetailId(null);
      setQuoteRequestDetail(null);
      setQuoteRequestDetailError(null);
    },
    [activeView, showPageLoading]
  );

  const isPrivileged = Boolean(session?.roles.some((role) => role === "Admin" || role === "Staff"));
  const isAdmin = Boolean(session?.roles.includes("Admin"));
  const isUser = Boolean(session?.roles.includes("User"));
  const currentCustomer = data.currentCustomer ?? profile?.customer;
  const hasCustomerProfile = isPrivileged || Boolean(currentCustomer);
  const customerLockedViews = new Set<View>(["overview", "quotes", "shipments", "finance", "documents"]);
  const isCustomerLockedView = !isPrivileged && customerLockedViews.has(activeView) && !hasCustomerProfile;
  const selectedShipment =
    workspace.selectedShipmentDetail ?? data.shipments.find((shipment) => shipment.id === workspace.selectedShipmentId);
  const selectedShipmentId = selectedShipment?.id ?? "";
  const draftInvoiceForSelectedShipment = invoices.find(
    (invoice) =>
      String(invoice.paymentStatus).toLowerCase() === "draft" &&
      (!invoice.shipment?.id || invoice.shipment.id === selectedShipmentId)
  );
  const shipmentQuoteOptions = isPrivileged
    ? data.quotes
    : data.quotes.length > 0
      ? data.quotes
      : currentCustomer?.quotes ?? [];

  const handleBackendUnavailable = useCallback(
    (showToast = true) => {
      loadSequenceRef.current += 1;
      setServerUnavailable(true);
      setSession(null);
      persistSession(null);
      setData(initialData);
      setProfile(null);
      setInvoices([]);
      setWorkflowInvoice(null);
      setShipmentWorkflowStep(null);
      setItemUpdateReturnStep(null);
      closeQuoteRequestDetails();
      setProfilePreviewOpen(false);
      setActiveView("overview");
      setLoading(false);
      setBusy(false);
      workspace.clearShipmentContext();
      navigate("/", { replace: true, scroll: false });
      if (showToast) {
        pushToast("info", "Server under development", "The backend is currently unavailable. The public landing page will stay available.");
      }
    },
    [navigate, pushToast, workspace.clearShipmentContext]
  );

  const loadData = useCallback(
    async (showNotice = false) => {
      if (!session?.accessToken) return;

      const loadId = ++loadSequenceRef.current;
      let preservedExistingData = false;
      setLoading(true);
      const token = session.accessToken;
      const params: QueryParams = { pageSize: 50 };
      const rateParams = buildRateQuery(appliedRateBookFiltersRef.current);

      async function loadOrPreserve<T>(call: () => Promise<T>, notFoundValue: T) {
        try {
          return { preserve: false, value: await call() };
        } catch (error) {
          if (isBackendUnavailableError(error)) throw error;
          if (isNotFoundError(error)) return { preserve: false, value: notFoundValue };
          preservedExistingData = true;
          return { preserve: true, value: undefined as T | undefined };
        }
      }

      try {
        const [ratesResult, carriersResult, portsResult, routesResult, containerTypesResult, profileResult] = await Promise.all([
          loadOrPreserve(() => api.getRates(token, rateParams), [] as Rate[]),
          loadOrPreserve(() => api.getCarriers(params), [] as Carrier[]),
          loadOrPreserve(() => api.getPorts(params), [] as Port[]),
          loadOrPreserve(() => api.getRoutes(params), [] as Route[]),
          loadOrPreserve(() => api.getContainerTypes(params), [] as ContainerType[]),
          loadOrPreserve(() => api.getProfile(token), null as ProfileResponse | null)
        ]);

        if (loadId !== loadSequenceRef.current) return;

        setServerUnavailable(false);
        if (!profileResult.preserve) setProfile(profileResult.value ?? null);

        const currentCustomerResult = !isPrivileged
          ? await loadOrPreserve(() => api.getMyCustomer(token), undefined as Customer | undefined)
          : { preserve: false, value: undefined as Customer | undefined };
        const canLoadCustomerWorkspace = isPrivileged || Boolean(profileResult.value?.customer || currentCustomerResult.value);

        const [quotesResult, quoteRequestsResult, shipmentsResult, customersResult] = await Promise.all([
          isPrivileged
            ? loadOrPreserve(() => api.getQuotes(token, params), [] as Quote[])
            : canLoadCustomerWorkspace
              ? loadOrPreserve(() => api.getMyQuotes(token, params), [] as Quote[])
              : Promise.resolve({ preserve: false, value: [] as Quote[] }),
          isPrivileged
            ? loadOrPreserve(() => api.getQuoteRequests(token, params), [] as QuoteRequest[])
            : canLoadCustomerWorkspace
              ? loadOrPreserve(() => api.getMyQuoteRequests(token, params), [] as QuoteRequest[])
              : Promise.resolve({ preserve: false, value: [] as QuoteRequest[] }),
          isPrivileged
            ? loadOrPreserve(() => api.getShipments(token, params), [] as Shipment[])
            : canLoadCustomerWorkspace
              ? loadOrPreserve(() => api.getMyShipments(token, params), [] as Shipment[])
              : Promise.resolve({ preserve: false, value: [] as Shipment[] }),
          isPrivileged
            ? loadOrPreserve(() => api.getCustomers(token, params), [] as Customer[])
            : Promise.resolve({ preserve: false, value: [] as Customer[] })
        ]);

        if (loadId !== loadSequenceRef.current) return;

        setData((current) => {
          const nextShipments = shipmentsResult.preserve ? current.shipments : (shipmentsResult.value ?? []);

          return {
            rates: ratesResult.preserve ? current.rates : (ratesResult.value ?? []),
            quoteRequests: quoteRequestsResult.preserve ? current.quoteRequests : (quoteRequestsResult.value ?? []),
            carriers: carriersResult.preserve ? current.carriers : (carriersResult.value ?? []),
            ports: portsResult.preserve ? current.ports : (portsResult.value ?? []),
            routes: routesResult.preserve ? current.routes : (routesResult.value ?? []),
            containerTypes: containerTypesResult.preserve ? current.containerTypes : (containerTypesResult.value ?? []),
            quotes: quotesResult.preserve ? current.quotes : (quotesResult.value ?? []),
            shipments: nextShipments,
            customers: customersResult.preserve ? current.customers : (customersResult.value ?? []),
            currentCustomer: isPrivileged
              ? undefined
              : currentCustomerResult.preserve
                ? current.currentCustomer
                : (currentCustomerResult.value ?? profileResult.value?.customer)
          };
        });

        if (!shipmentsResult.preserve) {
          const nextShipments = shipmentsResult.value ?? [];
          workspace.reconcileSelectedShipment(nextShipments);
          if (!workspace.selectedShipmentId && nextShipments.length > 0) {
            workspace.setSelectedShipmentId(nextShipments[0].id);
          }
        }

        if (showNotice) {
          pushToast(
            preservedExistingData ? "info" : "success",
            preservedExistingData ? "Workspace kept current data" : "Data refreshed",
            preservedExistingData
              ? "Some requests did not complete, so existing visible data was preserved."
              : "The latest rates, quote requests, quotes, shipments, and account data are loaded."
          );
        }
      } catch (loadError) {
        if (isBackendUnavailableError(loadError)) {
          handleBackendUnavailable();
          return;
        }
        pushToast("error", "Could not refresh data", getFriendlyErrorMessage(loadError));
      } finally {
        if (loadId === loadSequenceRef.current) setLoading(false);
      }
    },
    [
      handleBackendUnavailable,
      isPrivileged,
      pushToast,
      session?.accessToken,
      workspace.reconcileSelectedShipment,
      workspace.selectedShipmentId,
      workspace.setSelectedShipmentId
    ]
  );

  useLayoutEffect(() => {
    const currentPath = getAppPath();
    const confirmationLink = readConfirmationLink(currentPath);

    if (confirmationLink) {
      window.history.replaceState(null, "", toBrowserPath(getConfirmationSafePath(confirmationLink.type)));
      return;
    }

    if (hasSensitiveUrlDetails(currentPath)) {
      window.history.replaceState(null, "", toBrowserPath("/"));
      setPath(getAppPath());
    }
  }, []);

  useEffect(() => {
    const onPopState = () => setPath(getAppPath());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function restoreCookieSession() {
      if (readConfirmationLink(getAppPath())) {
        setRestoringSession(false);
        return;
      }

      try {
        const response = await api.refresh();
        if (cancelled || !response.isAuthenticated) return;

        const nextSession = await resolveAuthenticatedSession(response);
        if (cancelled) return;

        setServerUnavailable(false);
        setSession(nextSession);
        persistSession(nextSession);
        void api.prepareCsrfToken(true);

        const currentPathname = getAppPathname(path).toLowerCase();
        if (currentPathname.startsWith("/auth/")) {
          navigate("/", { replace: true, scroll: false });
        }
      } catch (error) {
        persistSession(null);
        if (isBackendUnavailableError(error)) {
          setServerUnavailable(true);
          setSession(null);
        }
      } finally {
        if (!cancelled) setRestoringSession(false);
      }
    }

    void restoreCookieSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasSensitiveDetailsInPath) return;

    navigate("/", { replace: true, scroll: false });
    pushToast(
      "info",
      "Protected link removed",
      "Open records from the workspace so internal identifiers stay out of the browser URL."
    );
  }, [hasSensitiveDetailsInPath, navigate, pushToast]);

  useEffect(() => {
    if (session) return;

    let cancelled = false;

    async function loadAuthMetrics() {
      const [publicRateCountResult, workflowStateCountResult] = await Promise.allSettled([
        api.getPublicRateCount(),
        api.getPublicShipmentCount()
      ]);

      if (!cancelled) {
        const backendDown =
          publicRateCountResult.status === "rejected" &&
          workflowStateCountResult.status === "rejected" &&
          isBackendUnavailableError(publicRateCountResult.reason) &&
          isBackendUnavailableError(workflowStateCountResult.reason);

        setServerUnavailable(backendDown);
        setAuthMetrics({
          publicRateCount: publicRateCountResult.status === "fulfilled" ? publicRateCountResult.value : 0,
          workflowStateCount: workflowStateCountResult.status === "fulfilled" ? workflowStateCountResult.value : 0
        });
      }
    }

    void loadAuthMetrics();

    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (!serverUnavailable || getAppPathname(path) === "/") return;
    navigate("/", { replace: true, scroll: false });
  }, [navigate, path, serverUnavailable]);

  useEffect(() => {
    function handleSessionRefresh(event: Event) {
      const nextSession = (event as CustomEvent<AuthSession | null>).detail;

      if (nextSession?.accessToken) {
        setSession((current) => ({
          ...nextSession,
          roles: nextSession.roles.length > 0 ? nextSession.roles : (current?.roles ?? ["User"])
        }));
        return;
      }

      loadSequenceRef.current += 1;
      setSession(null);
      persistSession(null);
      setData(initialData);
      setProfile(null);
      setInvoices([]);
      setWorkflowInvoice(null);
      setShipmentWorkflowStep(null);
      setItemUpdateReturnStep(null);
      closeQuoteRequestDetails();
      setProfilePreviewOpen(false);
      workspace.clearShipmentContext();
      setActiveView("overview");
      navigate("/auth/login", { replace: true });
      pushToast("info", "Session expired", "Please sign in again to continue.");
    }

    window.addEventListener(SESSION_REFRESHED_EVENT, handleSessionRefresh);
    return () => window.removeEventListener(SESSION_REFRESHED_EVENT, handleSessionRefresh);
  }, [navigate, pushToast, workspace.clearShipmentContext]);

  useEffect(() => {
    return () => {
      if (pageLoadingTimerRef.current) window.clearTimeout(pageLoadingTimerRef.current);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (!session?.accessToken) return;
    void loadData();
  }, [loadData, session?.accessToken]);

  useEffect(() => {
    if (session) return;
    const pathname = getAppPathname(path).toLowerCase();
    if (pathname === "/auth/verify") setAuthMode("verify");
    if (pathname === "/auth/register") setAuthMode("register");
    if (pathname === "/auth/login") setAuthMode("login");
  }, [path, session]);

  useEffect(() => {
    const confirmationLink = readConfirmationLink(path);

    if (!confirmationLink) return;

    const { type, userId, token } = confirmationLink;
    const isEmailConfirmation = type === "registration-email";
    window.history.replaceState(null, "", toBrowserPath(getConfirmationSafePath(type)));

    if (!userId || !token) {
      if (isEmailConfirmation) {
        setAuthMode("verify");
        setVerificationStep("email");
        navigate("/auth/verify", { replace: true, scroll: false });
      } else {
        navigate(session ? "/" : "/auth/login", { replace: true, scroll: false });
      }
      pushToast("error", "Confirmation link is invalid", "Please request a new confirmation link.");
      return;
    }

    const confirmationKey = `${type}:${userId}:${token}`;
    if (completedConfirmationLinksRef.current.has(confirmationKey)) return;

    if (isEmailConfirmation) {
      const pending = loadPendingVerification();
      if (pending.userId && pending.userId !== userId) {
        localStorage.removeItem(PENDING_VERIFICATION_KEY);
        setVerifyDraft((current) => ({ ...current, email: "", phone: "", phoneCode: "" }));
      } else {
        localStorage.setItem(PENDING_VERIFICATION_KEY, JSON.stringify({ ...pending, userId }));
        setVerifyDraft((current) => ({
          ...current,
          email: current.email || pending.email,
          phone: current.phone || pending.phone,
          phoneCode: ""
        }));
      }
      setAuthMode("verify");
      setVerificationStep("email");
    }

    setBusy(true);
    let cancelled = false;

    function runConfirmationRequest() {
      const existing = confirmationRequestsRef.current.get(confirmationKey);
      if (existing) return existing;

      const request = (async (): Promise<ConfirmationRequestResult> => {
        if (isEmailConfirmation) {
          return { type: "registration-email", response: await api.confirmEmail(userId, token) };
        }

        return { type: "profile-email", response: await api.confirmProfileEmailChange(userId, token) };
      })().finally(() => {
        confirmationRequestsRef.current.delete(confirmationKey);
      });

      confirmationRequestsRef.current.set(confirmationKey, request);
      return request;
    }

    void runConfirmationRequest()
      .then((result) => {
        if (cancelled) return;

        completedConfirmationLinksRef.current.add(confirmationKey);

        if (result.type === "registration-email") {
          const response = result.response;
          const pending = loadPendingVerification();
          const nextPending = {
            ...pending,
            userId,
            email: response.email || pending.email,
            phone: response.phoneNumber || pending.phone,
            userName: response.userName || pending.userName,
            emailConfirmed: true
          };
          localStorage.setItem(PENDING_VERIFICATION_KEY, JSON.stringify(nextPending));
          setVerifyDraft((current) => ({
            ...current,
            email: nextPending.email,
            phone: nextPending.phone,
            phoneCode: ""
          }));
          setAuthMode("verify");
          setVerificationStep("phone");
          navigate("/auth/verify", { replace: true, scroll: false });
          pushToast("success", "Email confirmed", response.message || "Enter the 6-digit code sent to your phone.");
          return;
        }

        if (result.response.updatedProfile) setProfile(result.response.updatedProfile);
        navigate(session ? "/" : "/auth/login", { replace: true, scroll: false });
        pushToast("success", "Email change confirmed", result.response.message || "Your profile email has been updated.");
      })
      .catch((confirmationError) => {
        if (cancelled) return;
        navigate("/auth/login", { replace: true, scroll: false });
        pushToast("error", "Email confirmation failed", getFriendlyErrorMessage(confirmationError));
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });

    return () => {
      cancelled = true;
      setBusy(false);
    };
  }, [navigate, path, pushToast, session]);

  useEffect(() => {
    if (!profile) return;

    const [firstName = "", ...rest] = profile.name.split(" ").filter(Boolean);
    setProfileDraft({
      firstName,
      lastName: rest.join(" "),
      username: profile.username ?? "",
      email: profile.email ?? "",
      phoneNumber: profile.phoneNumber ?? ""
    });

    setVerifyDraft((current) => ({
      ...current,
      email: current.email || profile.email || "",
      phone: current.phone || profile.phoneNumber || ""
    }));
  }, [profile]);

  useEffect(() => {
    const customer = data.currentCustomer ?? profile?.customer;
    if (!customer) return;

    const isCompany = Boolean(customer.taxNumber || customer.companyName);
    setCustomerDraft({
      mode: isCompany ? "company" : "individual",
      nationalId: customer.nationalId ?? "",
      dateOfBirth: customer.dateOfBirth ?? "",
      companyName: customer.companyName ?? "",
      taxNumber: customer.taxNumber ?? "",
      countryCode: "EG"
    });
  }, [data.currentCustomer, profile?.customer]);

  useEffect(() => {
    if (!selectedShipment) return;

    setTrackingDraft({
      bookingNumber: selectedShipment.bookingNumber ?? "",
      vesselName: selectedShipment.vesselName ?? "",
      voyageNumber: selectedShipment.voyageNumber ?? "",
      currentCheckpoint: selectedShipment.currentCheckpoint ?? "",
      estimatedDeparture: isoToLocalDateTime(selectedShipment.estimatedDeparture),
      estimatedArrival: isoToLocalDateTime(selectedShipment.estimatedArrival),
      actualDeparture: isoToLocalDateTime(selectedShipment.actualDeparture),
      actualArrival: isoToLocalDateTime(selectedShipment.actualArrival)
    });
  }, [selectedShipment]);

  useEffect(() => {
    const hasInvoiceLookupSignal =
      workspace.timeline.some((item) => item.type === "InvoiceCreated" || item.category === "Invoice") ||
      ["paymentpending", "paymentcompleted", "telexreleased", "delivered", "closed"].includes(
        normalizeStatusKey(selectedShipment?.status)
      );
    const shouldLookupInvoices =
      Boolean(session?.accessToken && selectedShipmentId) &&
      canQueryInvoicesForShipment(selectedShipment) &&
      (activeView === "finance" ||
        (hasInvoiceLookupSignal && (shipmentWorkflowStep !== null || activeView === "shipments")));

    if (!shouldLookupInvoices) {
      setInvoices([]);
      return;
    }

    const token = session?.accessToken;
    if (!token) return;

    let cancelled = false;
    void (async () => {
      try {
        const nextInvoices = await api.getInvoicesByShipment(token, selectedShipmentId);
        if (!cancelled) setInvoices(nextInvoices);
      } catch (error) {
        if (!cancelled && isBackendUnavailableError(error)) {
          handleBackendUnavailable();
          return;
        }
        if (!cancelled && isNotFoundError(error)) setInvoices([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    activeView,
    selectedShipment,
    selectedShipmentId,
    session?.accessToken,
    shipmentWorkflowStep,
    handleBackendUnavailable,
    workspace.timeline
  ]);

  const filteredRates = data.rates;
  const filteredQuotes = data.quotes;
  const filteredShipments = data.shipments;

  const stats = useMemo(() => {
    const activeRates = data.rates.filter((rate) => rate.isActive).length;
    const openShipments = data.shipments.filter((shipment) => !["Closed", "Cancelled", "Delivered"].includes(shipment.status)).length;
    const quotedValue = data.quotes.reduce((total, quote) => total + quote.finalPrice, 0);
    const shipmentValue = data.shipments.reduce((total, shipment) => total + shipment.agreedPrice, 0);
    return { activeRates, openShipments, quotedValue, shipmentValue };
  }, [data.quotes, data.rates, data.shipments]);

  const requestActionConfirmation = useCallback((options: ActionConfirmationOptions = {}) => {
    return new Promise<boolean>((resolve) => {
      setPendingActionConfirmation({
        title: options.title ?? "Confirm action",
        message: options.message ?? "This request will update backend data. Continue?",
        confirmLabel: options.confirmLabel ?? "OK",
        tone: options.tone ?? "default",
        resolve
      });
    });
  }, []);

  function settleActionConfirmation(confirmed: boolean) {
    if (pendingActionConfirmation) pendingActionConfirmation.resolve(confirmed);
    setPendingActionConfirmation(null);
  }

  async function resolveAuthenticatedSession(response: AuthResponse) {
    const nextSession = sessionFromAuth(response);
    if (nextSession.roles.length > 0) return nextSession;

    try {
      await api.getCustomers(nextSession.accessToken, { pageSize: 1 });
      return { ...nextSession, roles: ["Staff"] };
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) throw error;
      return { ...nextSession, roles: ["User"] };
    }
  }

  async function runMutation<T>(
    label: string,
    mutation: () => Promise<T>,
    options: { refresh?: boolean; successToast?: boolean; successMessage?: string; confirm?: boolean | ActionConfirmationOptions } = {}
  ): Promise<T | null> {
    if (options.confirm !== false) {
      const dangerousAction = /(delete|cancel|reject|revoke|refund|logout)/i.test(label);
      const confirmationOptions = typeof options.confirm === "object" ? options.confirm : {};
      const confirmed = await requestActionConfirmation({
        title: confirmationOptions.title ?? "Confirm action",
        message: confirmationOptions.message ?? "This request will be sent to the server and update live workspace data.",
        confirmLabel: confirmationOptions.confirmLabel ?? "OK",
        tone: confirmationOptions.tone ?? (dangerousAction ? "danger" : "default")
      });

      if (!confirmed) return null;
    }

    setBusy(true);
    try {
      const result = await mutation();
      setServerUnavailable(false);
      if (options.successToast !== false) {
        pushToast("success", label, options.successMessage ?? "The workspace has been updated successfully.");
      }
      if (options.refresh !== false) {
        await loadData();
        if (workspace.selectedShipmentId) await workspace.loadShipmentRelated(workspace.selectedShipmentId);
      }
      return result;
    } catch (mutationError) {
      if (isBackendUnavailableError(mutationError)) {
        handleBackendUnavailable();
        return null;
      }
      pushToast("error", `${label} failed`, getFriendlyErrorMessage(mutationError));
      return null;
    } finally {
      setBusy(false);
    }
  }

  function handleToggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  function handleAuthModeChange(mode: "login" | "register" | "verify") {
    setAuthMode(mode);
    if (mode === "login") navigate("/auth/login");
    if (mode === "register") navigate("/auth/register");
    if (mode === "verify") navigate("/auth/verify");
  }

  function isUnconfirmedEmailResponse(error: unknown) {
    const message = getFriendlyErrorMessage(error).toLowerCase();
    return message.includes("confirm your email") || message.includes("email before logging in");
  }

  function isEmailConfirmationSentResponse(error: unknown) {
    const message = getFriendlyErrorMessage(error).toLowerCase();
    return message.includes("confirmation link has been sent") || message.includes("check your email");
  }

  function isExistingRegistrationResponse(error: unknown) {
    const message = getFriendlyErrorMessage(error).toLowerCase();
    return message.includes("already exists") || message.includes("already registered");
  }

  function isEmailAlreadyConfirmedResponse(response: AuthResponse | null) {
    const message = (response?.message ?? "").toLowerCase();
    return Boolean(response?.isAuthenticated) || message.includes("already confirmed");
  }

  function normalizeCountryCode(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    return digits ? `+${digits}` : "";
  }

  function normalizeRegisterFormForBackend(form: RegisterForm): RegisterForm {
    return {
      firstName: form.firstName.trim().slice(0, 50),
      lastName: form.lastName.trim().slice(0, 50),
      userName: form.userName.trim().slice(0, 30),
      email: form.email.trim().toLowerCase().slice(0, 120),
      countryCode: normalizeCountryCode(form.countryCode),
      phoneNumber: form.phoneNumber.replace(/\D/g, "").slice(0, 15),
      password: form.password,
      confirmPassword: form.confirmPassword
    };
  }

  function getRegisteredPhone(form: RegisterForm) {
    return `${form.countryCode}${form.phoneNumber}`;
  }

  function phoneMatches(left: string, right: string) {
    const first = left.replace(/\D/g, "");
    const second = right.replace(/\D/g, "");
    return Boolean(first && second && (first === second || first.endsWith(second) || second.endsWith(first)));
  }

  function isPhoneIdentity(value: string) {
    const digits = value.replace(/\D/g, "");
    return digits.length >= 6 && !/[a-z]/i.test(value);
  }

  function readAuthString(payload: unknown, ...keys: string[]) {
    if (typeof payload !== "object" || !payload) return "";
    const record = payload as Record<string, unknown>;

    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }

    return "";
  }

  function getAuthErrorPayload(error: unknown) {
    if (!(error instanceof ApiError)) return null;

    return {
      id: readAuthString(error.payload, "id", "Id"),
      email: readAuthString(error.payload, "email", "Email"),
      phoneNumber: readAuthString(error.payload, "phoneNumber", "PhoneNumber", "phone", "Phone"),
      userName: readAuthString(error.payload, "userName", "UserName")
    };
  }

  function storePendingVerification(pending: {
    userId?: string;
    email?: string;
    phone?: string;
    userName?: string;
    emailConfirmed?: boolean;
  }) {
    const nextPending = {
      userId: pending.userId ?? "",
      email: pending.email ?? "",
      phone: pending.phone ?? "",
      userName: pending.userName ?? "",
      emailConfirmed: pending.emailConfirmed ?? false
    };

    localStorage.setItem(PENDING_VERIFICATION_KEY, JSON.stringify(nextPending));
    setVerifyDraft((current) => ({
      ...current,
      email: nextPending.email,
      phone: nextPending.phone,
      phoneCode: ""
    }));

    return nextPending;
  }

  function resolvePendingVerificationForIdentity(identity: string, authPayload: ReturnType<typeof getAuthErrorPayload> = null) {
    const pending = loadPendingVerification();
    const normalizedIdentity = identity.trim();
    const lowerIdentity = normalizedIdentity.toLowerCase();
    const isEmailIdentity = lowerIdentity.includes("@");
    const registeredPhone = getRegisteredPhone(normalizeRegisterFormForBackend(registerForm));
    const payloadEmail = authPayload?.email ?? "";
    const payloadPhone = authPayload?.phoneNumber ?? "";
    const payloadUserName = authPayload?.userName ?? "";

    const identityMatchesPending =
      lowerIdentity === pending.email.toLowerCase() ||
      lowerIdentity === pending.userName.toLowerCase() ||
      phoneMatches(normalizedIdentity, pending.phone);

    const identityMatchesPayload =
      lowerIdentity === payloadEmail.toLowerCase() ||
      lowerIdentity === payloadUserName.toLowerCase() ||
      phoneMatches(normalizedIdentity, payloadPhone);

    const identityMatchesCurrentForm =
      lowerIdentity === registerForm.email.trim().toLowerCase() ||
      lowerIdentity === registerForm.userName.trim().toLowerCase() ||
      phoneMatches(normalizedIdentity, registeredPhone);

    return {
      userId: authPayload?.id || pending.userId,
      email:
        payloadEmail ||
        (identityMatchesPending && pending.email) ||
        (identityMatchesCurrentForm && registerForm.email.trim()) ||
        (isEmailIdentity ? normalizedIdentity : ""),
      phone:
        payloadPhone ||
        (identityMatchesPending && pending.phone) ||
        (identityMatchesCurrentForm && registeredPhone) ||
        (identityMatchesPayload && isPhoneIdentity(normalizedIdentity) && !isEmailIdentity ? normalizedIdentity : ""),
      userName: payloadUserName || pending.userName || registerForm.userName.trim(),
      emailConfirmed: pending.emailConfirmed
    };
  }

  async function resendEmailConfirmationLink(email: string): Promise<AuthResponse | null> {
    try {
      const response = await api.resendEmailConfirmation(email);
      pushToast(response.isAuthenticated ? "info" : "success", "Email verification request", response.message);
      return response;
    } catch (error) {
      if (isBackendUnavailableError(error)) {
        handleBackendUnavailable();
        return null;
      }

      if (isEmailConfirmationSentResponse(error)) {
        const message = getFriendlyErrorMessage(error);
        pushToast("success", "Email verification request", message);
        return { isAuthenticated: false, message, expiration: "" };
      }

      pushToast("error", "Email confirmation failed", getFriendlyErrorMessage(error));
      return null;
    }
  }

  async function resumeExistingRegistration(form: RegisterForm, originalError: unknown) {
    if (!form.email) return false;

    const response = await resendEmailConfirmationLink(form.email);
    if (!response) return false;

    const registeredPhone = getRegisteredPhone(form);
    const hasBackendAccountSignal = Boolean(response.id || response.email || response.phoneNumber || response.userName);

    if (isEmailAlreadyConfirmedResponse(response)) {
      localStorage.removeItem(PENDING_VERIFICATION_KEY);
      setLoginForm({ identity: response.email || form.email, password: "" });
      setVerifyDraft((current) => ({
        ...current,
        email: response.email || form.email,
        phone: response.phoneNumber || registeredPhone,
        phoneCode: ""
      }));
      handleAuthModeChange("login");
      pushToast("info", "Account already confirmed", "Sign in with your existing account.");
      return true;
    }

    if (!hasBackendAccountSignal) {
      pushToast("error", "Registration failed", getFriendlyErrorMessage(originalError));
      return true;
    }

    storePendingVerification({
      userId: response.id,
      email: response.email || form.email,
      phone: response.phoneNumber || registeredPhone,
      userName: response.userName || form.userName,
      emailConfirmed: false
    });
    handleAuthModeChange("verify");
    setVerificationStep("email");
    return true;
  }

  async function resumeEmailVerificationFromLogin(identity: string, error: unknown) {
    const pending = resolvePendingVerificationForIdentity(identity, getAuthErrorPayload(error));

    if (pending.email || pending.phone || pending.userName) {
      storePendingVerification(pending);
    } else {
      setVerifyDraft((current) => ({
        ...current,
        email: "",
        phone: "",
        phoneCode: ""
      }));
    }

    setAuthMode("verify");
    setVerificationStep("email");
    navigate("/auth/verify", { replace: true, scroll: false });

    if (!pending.email) {
      pushToast("info", "Confirm your email", "Enter the email address used during registration to send a new confirmation link.");
      return;
    }

    const response = await resendEmailConfirmationLink(pending.email);
    if (isEmailAlreadyConfirmedResponse(response)) {
      storePendingVerification({ ...pending, emailConfirmed: true, email: response?.email || pending.email, phone: response?.phoneNumber || pending.phone });
      setVerificationStep("phone");
    }
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    const normalizedLoginForm = {
      identity: loginForm.identity.trim().slice(0, 100),
      password: loginForm.password
    };
    setLoginForm(normalizedLoginForm);
    setBusy(true);

    try {
      const response = await api.login(normalizedLoginForm);
      if (!response.isAuthenticated) {
        pushToast("error", "Login failed", response.message || "The credentials could not be authenticated.");
        return;
      }

      const nextSession = await resolveAuthenticatedSession(response);
      loadSequenceRef.current += 1;
      setData(initialData);
      setProfile(null);
      setInvoices([]);
      setWorkflowInvoice(null);
      setShipmentWorkflowStep(null);
      setItemUpdateReturnStep(null);
      closeQuoteRequestDetails();
      setProfilePreviewOpen(false);
      workspace.clearShipmentContext();
      setActiveView("overview");
      showPageLoading(650);
      setSession(nextSession);
      persistSession(nextSession);
      void api.prepareCsrfToken(true);
      navigate("/", { replace: true });
      pushToast("success", "Signed in", `Welcome back${nextSession.userName ? `, ${nextSession.userName}` : ""}.`);
    } catch (loginError) {
      if (isBackendUnavailableError(loginError)) {
        handleBackendUnavailable();
        return;
      }
      if (isUnconfirmedEmailResponse(loginError)) {
        await resumeEmailVerificationFromLogin(normalizedLoginForm.identity, loginError);
        return;
      }

      pushToast("error", "Login failed", getFriendlyErrorMessage(loginError));
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister(event: FormEvent) {
    event.preventDefault();
    const normalizedForm = normalizeRegisterFormForBackend(registerForm);
    setRegisterForm(normalizedForm);
    setBusy(true);

    try {
      const response = await api.register(normalizedForm);
      const registeredPhone = response.phoneNumber || getRegisteredPhone(normalizedForm);

      storePendingVerification({
        userId: response.id,
        email: response.email || normalizedForm.email,
        phone: registeredPhone,
        userName: response.userName || normalizedForm.userName,
        emailConfirmed: false
      });

      if (response.message) pushToast("info", "Registration submitted", response.message);
      handleAuthModeChange("verify");
      setVerificationStep("email");
    } catch (registerError) {
      if (isBackendUnavailableError(registerError)) {
        handleBackendUnavailable();
        return;
      }
      if (isExistingRegistrationResponse(registerError)) {
        const resumed = await resumeExistingRegistration(normalizedForm, registerError);
        if (resumed) return;
      }

      pushToast("error", "Registration failed", getFriendlyErrorMessage(registerError));
    } finally {
      setBusy(false);
    }
  }

  async function handleResendEmail(event: FormEvent) {
    event.preventDefault();
    await runMutation(
      "Email confirmation sent",
      async () => {
        const pending = loadPendingVerification();
        const email = verifyDraft.email.trim() || pending.email;
        if (!email) {
          pushToast("info", "Email verification unavailable", "Start from login or registration so we can use the email returned by the server.");
          return null;
        }

        const response = await resendEmailConfirmationLink(email);
        if (isEmailAlreadyConfirmedResponse(response)) {
          storePendingVerification({
            ...pending,
            email: response?.email || email,
            phone: response?.phoneNumber || pending.phone || verifyDraft.phone,
            userName: response?.userName || pending.userName,
            emailConfirmed: true
          });
          setVerificationStep("phone");
        }
        return response;
      },
      { successToast: false, refresh: false, confirm: false }
    );
  }

  async function handleConfirmEmail(event: FormEvent) {
    event.preventDefault();
    setBusy(true);

    try {
      const pending = loadPendingVerification();
      if (pending.emailConfirmed) {
        setVerificationStep("phone");
        pushToast("success", "Email confirmed", "Enter the 6-digit code sent to your registered phone.");
        return;
      }

      const email = verifyDraft.email.trim() || pending.email;
      if (!email) {
        pushToast("info", "Email verification unavailable", "Start from login or registration so we can use the email returned by the server.");
        return;
      }

      const response = await resendEmailConfirmationLink(email);
      if (!isEmailAlreadyConfirmedResponse(response)) {
        pushToast("info", "Use your email link", "Open the confirmation link from your inbox. We will move you to phone verification automatically.");
        return;
      }

      storePendingVerification({
        ...pending,
        email: response?.email || email,
        phone: response?.phoneNumber || pending.phone || verifyDraft.phone,
        userName: response?.userName || pending.userName,
        emailConfirmed: true
      });
      setVerificationStep("phone");
      pushToast("success", "Email confirmed", "Enter the 6-digit code sent to your registered phone.");
    } catch (confirmationError) {
      if (isBackendUnavailableError(confirmationError)) {
        handleBackendUnavailable();
        return;
      }
      pushToast("error", "Email is not confirmed yet", getFriendlyErrorMessage(confirmationError));
    } finally {
      setBusy(false);
    }
  }

  async function handleResendPhone(event: FormEvent) {
    event.preventDefault();
    if (!verifyDraft.phone.trim()) {
      pushToast("error", "Phone number is required", "Enter the phone number used during registration.");
      return;
    }

    await runMutation(
      "Phone code sent",
      async () => {
        const response = await api.resendPhoneOtp(verifyDraft.phone.trim());
        pushToast("success", "Phone verification code sent", response.message);
        return response;
      },
      { successToast: false, refresh: false, confirm: false }
    );
  }

  async function handleConfirmPhone(event: FormEvent) {
    event.preventDefault();
    const code = verifyDraft.phoneCode.replace(/\D/g, "").slice(0, 6);

    if (code.length !== 6) {
      pushToast("error", "Invalid verification code", "Enter the 6-digit code sent to your registered phone.");
      return;
    }

    if (!verifyDraft.phone.trim()) {
      pushToast("error", "Phone number is required", "Enter the phone number used during registration.");
      return;
    }

    setBusy(true);

    try {
      const response = await api.confirmPhone(verifyDraft.phone.trim(), code);
      const phoneConfirmed = response.isAuthenticated || response.message.toLowerCase().includes("phone number confirmed");
      if (!phoneConfirmed) {
        pushToast("error", "Phone verification failed", response.message || "The code is invalid or expired.");
        return;
      }

      localStorage.removeItem(PENDING_VERIFICATION_KEY);
      pushToast("success", "Phone verified", response.message || "Your phone number has been confirmed.");

      const identity = response.email || verifyDraft.email.trim() || registerForm.email.trim() || verifyDraft.phone.trim();
      setLoginForm({ identity, password: "" });
      setRegisterForm(initialRegisterForm);
      setVerifyDraft((current) => ({ ...current, email: identity, phoneCode: "" }));
      handleAuthModeChange("login");
    } catch (phoneError) {
      if (isBackendUnavailableError(phoneError)) {
        handleBackendUnavailable();
        return;
      }
      pushToast("error", "Phone verification failed", getFriendlyErrorMessage(phoneError));
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    const current = session;
    loadSequenceRef.current += 1;
    setSession(null);
    persistSession(null);
    setData(initialData);
    setProfile(null);
    setInvoices([]);
    setWorkflowInvoice(null);
    setShipmentWorkflowStep(null);
    setItemUpdateReturnStep(null);
    closeQuoteRequestDetails();
    setProfilePreviewOpen(false);
    setActiveView("overview");
    workspace.clearShipmentContext();
    navigate("/", { replace: true });

    if (current?.accessToken) {
      await safe(() => api.logout(current.accessToken), { message: "" });
    }
  }

  async function handleLogoutAll() {
    if (!session?.accessToken) return;
    const result = await runMutation("Sessions revoked", () => api.logoutAll(session.accessToken), { refresh: false, confirm: false });
    if (result) await handleLogout();
  }

  async function handleLoadAnalytics(event: FormEvent) {
    event.preventDefault();
    if (!session?.accessToken) return;
    if (!analyticsDraft.routeId || !analyticsDraft.containerId) return;

    setBusy(true);
    try {
      const result = await api.getMarketAnalytics(session.accessToken, {
        routeId: analyticsDraft.routeId,
        containerId: analyticsDraft.containerId,
        currency: analyticsDraft.currency.trim().toUpperCase() || "USD"
      });
      setAnalytics(result);
    } catch (analyticsError) {
      if (isBackendUnavailableError(analyticsError)) {
        handleBackendUnavailable();
        return;
      }
      pushToast("error", "Market analytics failed", getFriendlyErrorMessage(analyticsError));
    } finally {
      setBusy(false);
    }
  }

  async function loadRateBook(filters: RateBookFilterDraft, options: { notice?: boolean } = {}) {
    if (!session?.accessToken) return;

    const normalizedFilters = {
      ...filters,
      currency: filters.currency.toUpperCase(),
      pageNumber: String(clampedInteger(filters.pageNumber, 1, 1, Number.MAX_SAFE_INTEGER)),
      pageSize: String(clampedInteger(filters.pageSize, 10, 1, 50))
    };

    appliedRateBookFiltersRef.current = normalizedFilters;
    setAppliedRateBookFilters(normalizedFilters);
    setBusy(true);
    try {
      const rates = await api.getRates(session.accessToken, buildRateQuery(normalizedFilters));
      setData((current) => ({ ...current, rates }));
      if (options.notice) {
        pushToast("success", "Rate book filtered", "The rate book is now using the selected backend filters.");
      }
    } catch (error) {
      if (isBackendUnavailableError(error)) {
        handleBackendUnavailable();
        return;
      }
      if (isNotFoundError(error)) {
        setData((current) => ({ ...current, rates: [] }));
        pushToast("info", "No rates found", "No rates matched the selected filters.");
      } else {
        pushToast("error", "Rate filter failed", getFriendlyErrorMessage(error));
      }
    } finally {
      setBusy(false);
    }
  }

  function handleApplyRateFilters(filters: RateBookFilterDraft) {
    void loadRateBook(filters, { notice: true });
  }

  function handleResetRateFilters() {
    void loadRateBook(initialRateBookFilters, { notice: true });
  }

  async function handleLoadRecommendations(event: FormEvent) {
    event.preventDefault();
    if (!session?.accessToken) return;
    if (!recommendationDraft.routeId || !recommendationDraft.containerTypeId) return;

    const currency = recommendationDraft.currency.trim().toUpperCase() || "USD";
    const maxPrice = recommendationDraft.maxPrice.trim() ? Number(recommendationDraft.maxPrice) : undefined;
    const limit = Math.min(20, Math.max(1, Number(recommendationDraft.limit) || 5));

    if (currency.length !== 3) {
      pushToast("error", "Recommendation setup incomplete", "Currency must be a 3-letter code.");
      return;
    }

    if (maxPrice !== undefined && (!Number.isFinite(maxPrice) || maxPrice <= 0)) {
      pushToast("error", "Recommendation setup incomplete", "Max price must be greater than zero.");
      return;
    }

    setBusy(true);
    try {
      const result = await api.getRateRecommendations(session.accessToken, {
        routeId: recommendationDraft.routeId,
        containerTypeId: recommendationDraft.containerTypeId,
        currency,
        maxPrice,
        limit,
        priority: recommendationDraft.priority
      });
      setRecommendations(result);
      pushToast(
        result.recommendations.length > 0 ? "success" : "info",
        "Recommendations loaded",
        result.recommendations.length > 0 ? "Recommended rates are ready for review." : "No recommended rates matched this setup."
      );
    } catch (recommendationError) {
      if (isBackendUnavailableError(recommendationError)) {
        handleBackendUnavailable();
        return;
      }
      pushToast("error", "Recommendations failed", getFriendlyErrorMessage(recommendationError));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateRate(event: FormEvent) {
    event.preventDefault();
    if (!session?.accessToken) return;
    if (!rateDraft.carrierId || !rateDraft.routeId || !rateDraft.containerTypeId) {
      pushToast("error", "Rate setup incomplete", "Choose carrier, route, and container type before creating the rate.");
      return;
    }
    const maxGrossWeightKg = positiveNumber(rateDraft.maxGrossWeightKg);
    const maxNetWeightKg = positiveNumber(rateDraft.maxNetWeightKg);
    const maxVolumeCbm = positiveNumber(rateDraft.maxVolumeCbm);
    const minTemperatureCelsius = finiteNumber(rateDraft.minTemperatureCelsius);
    const maxTemperatureCelsius = finiteNumber(rateDraft.maxTemperatureCelsius);

    if (maxGrossWeightKg && maxNetWeightKg && maxNetWeightKg > maxGrossWeightKg) {
      pushToast("error", "Rate limits need review", "Max net weight cannot be greater than max gross weight.");
      return;
    }

    if (minTemperatureCelsius !== undefined && maxTemperatureCelsius !== undefined && minTemperatureCelsius > maxTemperatureCelsius) {
      pushToast("error", "Temperature range needs review", "Minimum temperature cannot be greater than maximum temperature.");
      return;
    }

    const result = await runMutation("Rate created", () =>
      api.createRate(session.accessToken, {
        carrierId: rateDraft.carrierId,
        routeId: rateDraft.routeId,
        containerTypeId: rateDraft.containerTypeId,
        price: Number(rateDraft.price),
        currency: rateDraft.currency.trim().toUpperCase(),
        validFrom: toIso(rateDraft.validFrom)!,
        validTo: toIso(rateDraft.validTo)!,
        maxGrossWeightKg,
        maxNetWeightKg,
        maxVolumeCbm,
        allowsHazardous: rateDraft.allowsHazardous,
        minTemperatureCelsius,
        maxTemperatureCelsius
      })
    );

    if (result) setRateDraft((current) => ({ ...current, price: "1500" }));
  }

  function handleUpdateRate(id: string, draft: RateDraft) {
    if (!session?.accessToken) return Promise.resolve(null);
    const maxGrossWeightKg = positiveNumber(draft.maxGrossWeightKg);
    const maxNetWeightKg = positiveNumber(draft.maxNetWeightKg);
    const maxVolumeCbm = positiveNumber(draft.maxVolumeCbm);
    const minTemperatureCelsius = finiteNumber(draft.minTemperatureCelsius);
    const maxTemperatureCelsius = finiteNumber(draft.maxTemperatureCelsius);

    if (maxGrossWeightKg && maxNetWeightKg && maxNetWeightKg > maxGrossWeightKg) {
      pushToast("error", "Rate limits need review", "Max net weight cannot be greater than max gross weight.");
      return Promise.resolve(null);
    }

    if (minTemperatureCelsius !== undefined && maxTemperatureCelsius !== undefined && minTemperatureCelsius > maxTemperatureCelsius) {
      pushToast("error", "Temperature range needs review", "Minimum temperature cannot be greater than maximum temperature.");
      return Promise.resolve(null);
    }

    return runMutation("Rate updated", () =>
      api.updateRate(session.accessToken, id, {
        price: Number(draft.price),
        currency: draft.currency.trim().toUpperCase(),
        validFrom: toIso(draft.validFrom)!,
        validTo: toIso(draft.validTo)!,
        maxGrossWeightKg,
        maxNetWeightKg,
        maxVolumeCbm,
        allowsHazardous: draft.allowsHazardous,
        minTemperatureCelsius,
        maxTemperatureCelsius
      })
    );
  }

  function handleDeleteRate(id: string) {
    if (!session?.accessToken) return;
    void runMutation("Rate deleted", () => api.deleteRate(session.accessToken, id), { confirm: false });
  }

  function handleToggleRate(id: string) {
    if (!session?.accessToken) return;
    void runMutation("Rate status changed", () => api.toggleRate(session.accessToken, id));
  }

  async function handleCreateQuote(event: FormEvent) {
    event.preventDefault();
    if (!session?.accessToken) return;
    if (!quoteDraft.customerId || !quoteDraft.rateId) {
      pushToast("error", "Quote setup incomplete", "Choose a customer and rate before creating the quote.");
      return;
    }

    const requestedGrossWeightKg = positiveNumber(quoteDraft.requestedGrossWeightKg);
    const requestedNetWeightKg = positiveNumber(quoteDraft.requestedNetWeightKg);
    const requestedVolumeCbm = positiveNumber(quoteDraft.requestedVolumeCbm);
    const requiredTemperatureCelsius = finiteNumber(quoteDraft.requiredTemperatureCelsius);

    if (!requestedGrossWeightKg || !requestedNetWeightKg || !requestedVolumeCbm) {
      pushToast("error", "Cargo details incomplete", "Gross weight, net weight, and CBM must be greater than zero.");
      return;
    }

    if (requestedNetWeightKg > requestedGrossWeightKg) {
      pushToast("error", "Cargo details need review", "Net weight cannot be greater than gross weight.");
      return;
    }

    if (
      requiredTemperatureCelsius !== undefined &&
      (requiredTemperatureCelsius < -60 || requiredTemperatureCelsius > 60)
    ) {
      pushToast("error", "Cargo temperature needs review", "Required temperature must be between -60 and 60 Celsius.");
      return;
    }

    const result = await runMutation("Quote created", () =>
      api.createQuote(session.accessToken, {
        customerId: quoteDraft.customerId,
        rateId: quoteDraft.rateId,
        requestedGrossWeightKg,
        requestedNetWeightKg,
        requestedVolumeCbm,
        isHazardous: quoteDraft.isHazardous,
        requiredTemperatureCelsius
      })
    );

    if (result) {
      setQuoteDraft((current) => ({
        ...current,
        requestedGrossWeightKg: "1000",
        requestedNetWeightKg: "900",
        requestedVolumeCbm: "8",
        isHazardous: false,
        requiredTemperatureCelsius: ""
      }));
    }
  }

  function handleDeleteQuote(id: string) {
    if (!session?.accessToken) return;
    void runMutation("Quote deleted", () => api.deleteQuote(session.accessToken, id), { confirm: false });
  }

  function handleAcceptQuote(id: string) {
    if (!session?.accessToken) return;
    void runMutation("Quote accepted", () => api.acceptQuote(session.accessToken, id));
  }

  function handleRejectQuote(id: string, reason: string) {
    if (!session?.accessToken) return;
    const cleanReason = trimOrUndefined(reason, 500);
    if (!cleanReason || cleanReason.length < 5) {
      pushToast("error", "Rejection reason needed", "Please enter at least 5 characters.");
      return;
    }
    void runMutation("Quote rejected", () => api.rejectQuote(session.accessToken, id, cleanReason));
  }

  async function handleOpenQuoteRequestDetails(id: string) {
    if (!session?.accessToken) return;

    const cached = data.quoteRequests.find((request) => request.id === id) ?? null;
    setQuoteRequestDetailId(id);
    setQuoteRequestDetail(cached);
    setQuoteRequestDetailError(null);
    setQuoteRequestDetailLoading(true);
    showPageLoading(320);

    try {
      const detail = await api.getQuoteRequest(session.accessToken, id);
      setQuoteRequestDetail(detail);
      setData((current) => ({
        ...current,
        quoteRequests: [detail, ...current.quoteRequests.filter((request) => request.id !== detail.id)]
      }));
    } catch (error) {
      if (isBackendUnavailableError(error)) {
        handleBackendUnavailable();
        return;
      }
      setQuoteRequestDetailError(getFriendlyErrorMessage(error));
    } finally {
      setQuoteRequestDetailLoading(false);
    }
  }

  function closeQuoteRequestDetails() {
    setQuoteRequestDetailId(null);
    setQuoteRequestDetail(null);
    setQuoteRequestDetailError(null);
    setQuoteRequestDetailLoading(false);
  }

  async function handleApproveQuoteRequest(id: string) {
    if (!session?.accessToken) return null;
    return runMutation("Quote request approved", () => api.approveQuoteRequest(session.accessToken, id), {
      successMessage: "The customer has been emailed with the approval and next steps."
    });
  }

  async function handleRejectQuoteRequest(id: string, reason: string) {
    if (!session?.accessToken) return null;
    const cleanReason = trimOrUndefined(reason, 500);
    if (!cleanReason || cleanReason.length < 5) {
      pushToast("error", "Rejection reason needed", "Please enter at least 5 characters.");
      return null;
    }
    return runMutation("Quote request rejected", () => api.rejectQuoteRequest(session.accessToken, id, cleanReason), {
      successMessage: "The customer has been emailed with the rejection update."
    });
  }

  async function handleApproveQuoteRequestFromDetails(id: string) {
    const result = await handleApproveQuoteRequest(id);
    if (result) closeQuoteRequestDetails();
  }

  async function handleRejectQuoteRequestFromDetails(id: string, reason: string) {
    const result = await handleRejectQuoteRequest(id, reason);
    if (result) closeQuoteRequestDetails();
  }

  async function handleCancelQuoteRequest(id: string) {
    if (!session?.accessToken) return null;
    return runMutation("Quote request cancelled", () => api.cancelQuoteRequest(session.accessToken, id));
  }

  async function handleCancelQuoteRequestFromDetails(id: string) {
    const result = await handleCancelQuoteRequest(id);
    if (result) closeQuoteRequestDetails();
  }

  async function handleFilterQuotesByCustomer(customerName: string) {
    if (!session?.accessToken || !customerName.trim()) return;
    setBusy(true);
    try {
      const quotes = await api.getQuotesByCustomer(session.accessToken, customerName.trim(), { pageSize: 50 });
      setData((current) => ({ ...current, quotes }));
      pushToast("success", "Quotes loaded", "Customer quote lookup has been applied.");
    } catch (error) {
      if (isBackendUnavailableError(error)) {
        handleBackendUnavailable();
        return;
      }
      if (isNotFoundError(error)) {
        setData((current) => ({ ...current, quotes: [] }));
        pushToast("info", "No quotes found", "No quotes were found for this customer.");
      } else {
        pushToast("error", "Quote lookup failed", getFriendlyErrorMessage(error));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleFilterQuotesByRoute(routeId: string) {
    if (!session?.accessToken || !routeId) return;
    setBusy(true);
    try {
      const quotes = await api.getQuotesByRoute(session.accessToken, routeId, { pageSize: 50 });
      setData((current) => ({ ...current, quotes }));
      pushToast("success", "Quotes loaded", "Route quote lookup has been applied.");
    } catch (error) {
      if (isBackendUnavailableError(error)) {
        handleBackendUnavailable();
        return;
      }
      if (isNotFoundError(error)) {
        setData((current) => ({ ...current, quotes: [] }));
        pushToast("info", "No quotes found", "No quotes were found for this route.");
      } else {
        pushToast("error", "Quote lookup failed", getFriendlyErrorMessage(error));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateShipment(event: FormEvent) {
    event.preventDefault();
    if (!session?.accessToken) return;
    if (!shipmentDraft.quoteId.trim()) {
      pushToast("error", "Quote is required", "Choose one of the available quotes before creating a shipment.");
      return;
    }

    const created = await runMutation("Shipment created", () => api.createShipment(session.accessToken, shipmentDraft.quoteId.trim()), {
      refresh: false
    });

    if (created) {
      workspace.setSelectedShipmentId(created.id);
      setShipmentDraft({ quoteId: "" });
      setQuoteSearch("");
      setInvoices([]);
      setWorkflowInvoice(null);
      setShipmentWorkflowStep(null);
      setItemUpdateReturnStep(null);
      await loadData();
      await workspace.loadShipmentRelated(created.id);
      setActiveView("shipments");
    }
  }

  function handleSelectShipment(id: string) {
    if (!isValidId(id)) return;
    workspace.setSelectedShipmentId(id);
    setInvoices([]);
    setWorkflowInvoice(null);
    setShipmentWorkflowStep(null);
    setItemUpdateReturnStep(null);
    setActiveView("shipments");
  }

  async function handleShipmentAction(action: string) {
    if (!session?.accessToken || !selectedShipment) return null;
    const result = await runMutation("Shipment updated", () =>
      api.shipmentAction(session.accessToken, selectedShipment.id, action, actionReason.trim() || undefined),
      { confirm: false }
    );
    if (result) setActionReason("");
    return result;
  }

  async function handleUpdateTracking(event: FormEvent) {
    event.preventDefault();
    if (!session?.accessToken || !selectedShipment) return;

    const payload = {
      bookingNumber: trackingDraft.bookingNumber.trim() || undefined,
      vesselName: trackingDraft.vesselName.trim() || undefined,
      voyageNumber: trackingDraft.voyageNumber.trim() || undefined,
      currentCheckpoint: trackingDraft.currentCheckpoint.trim() || undefined,
      estimatedDeparture: toIso(trackingDraft.estimatedDeparture),
      estimatedArrival: toIso(trackingDraft.estimatedArrival),
      actualDeparture: toIso(trackingDraft.actualDeparture),
      actualArrival: toIso(trackingDraft.actualArrival)
    };

    await runMutation("Tracking updated", () => api.updateTracking(session.accessToken, selectedShipment.id, payload));
  }

  function handleDeleteShipment(id: string) {
    if (!session?.accessToken) return;
    void runMutation("Shipment deleted", () => api.deleteShipment(session.accessToken, id), { confirm: false });
  }

  async function handleSaveShipmentItem(event: FormEvent) {
    event.preventDefault();
    if (!session?.accessToken || !selectedShipment) return;

    const submittedDraft = { ...itemDraft };
    const builtItem = buildShipmentItemPayload(itemDraft, selectedShipment.id);
    if ("error" in builtItem) {
      pushToast("error", "Cargo item needs review", builtItem.error);
      return;
    }

    const payload = builtItem.payload;
    const result = editingItemId
      ? await runMutation("Cargo item updated", () => api.updateShipmentItem(session.accessToken, editingItemId, payload))
      : await runMutation("Cargo item added", () => api.createShipmentItem(session.accessToken, payload));

    if (result) {
      setLastItemDraft(submittedDraft);
      setItemDraft(initialShipmentItemDraft);
      setEditingItemId(null);
      setActiveView("shipments");
      pushToast(
        "info",
        editingItemId ? "Cargo item saved" : "Cargo item added",
        itemUpdateReturnStep
          ? "Review your cargo list, then confirm items or cancel the update to return."
          : "You can add more items, then confirm when the cargo list is complete."
      );
    }
  }

  function handleEditShipmentItem(item: ShipmentItem) {
    setEditingItemId(item.id);
    setItemDraft(shipmentItemToDraft(item));
  }

  function handleDeleteShipmentItem(id: string) {
    if (!session?.accessToken) return;
    void runMutation("Cargo item deleted", () => api.deleteShipmentItem(session.accessToken, id));
  }

  function handleConfirmShipmentItems() {
    if (!selectedShipment) return;
    const hasItems = workspace.shipmentItems.length > 0 || (selectedShipment.items?.length ?? 0) > 0;

    if (!hasItems) {
      pushToast("error", "Cargo items needed", "Add at least one cargo item before continuing to charges.");
      return;
    }

    setEditingItemId(null);
    setItemDraft(initialShipmentItemDraft);
    setItemUpdateReturnStep(null);
    setWorkflowInvoice(null);
    setShipmentWorkflowStep("charges");
    setActiveView("shipments");
    pushToast("success", "Cargo confirmed", "Move on to charge generation when you are ready.");
  }

  function handleCancelItemUpdate() {
    setEditingItemId(null);
    setItemDraft(initialShipmentItemDraft);

    if (!itemUpdateReturnStep) return;

    setShipmentWorkflowStep(itemUpdateReturnStep);
    setItemUpdateReturnStep(null);
    setActiveView("shipments");
  }

  async function loadInvoices() {
    if (!session?.accessToken || !selectedShipment) return;
    if (!canQueryInvoicesForShipment(selectedShipment)) {
      setInvoices([]);
      pushToast("info", "No invoices yet", "This shipment is not ready for invoice lookup yet.");
      return;
    }

    setBusy(true);
    try {
      const nextInvoices = await api.getInvoicesByShipment(session.accessToken, selectedShipment.id);
      setInvoices(nextInvoices);
    } catch (error) {
      if (isBackendUnavailableError(error)) {
        handleBackendUnavailable();
        return;
      }
      const message = getFriendlyErrorMessage(error);
      if (isNotFoundError(error) || message.toLowerCase().includes("invoice not found")) {
        setInvoices([]);
        pushToast("info", "No invoices found", "This shipment does not have invoices yet.");
      } else {
        pushToast("error", "Invoice lookup failed", message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateCharges() {
    if (!session?.accessToken || !selectedShipment) return;

    const existingCharges = workspace.charges.length > 0 ? workspace.charges : (selectedShipment.charges ?? []);
    const existingWorkflowCharges = getWorkflowCharges(existingCharges, selectedShipment);
    if (existingWorkflowCharges.length > 0) {
      workspace.setCharges(existingCharges);
      pushToast("info", "Charges already generated", "Review the saved charges, then create the invoice.");
      return;
    }

    const generatedCharges = await runMutation(
      "Charges generated",
      () => api.generateCharges(session.accessToken, selectedShipment.id),
      {
        refresh: false,
        successToast: false,
        confirm: {
          title: "Confirm billing action",
          message: "Charges will be generated from the selected shipment and shown before invoice creation.",
          confirmLabel: "Generate"
        }
      }
    );

    if (!generatedCharges) return;

    workspace.setCharges((current) => [
      ...generatedCharges,
      ...current.filter((charge) => generatedCharges.every((generated) => generated.id !== charge.id))
    ]);
    await workspace.loadShipmentRelated(selectedShipment.id);
    pushToast("success", "Charges generated", "Review the charges, then create the invoice.");
  }

  async function handleCreateWorkflowInvoice() {
    if (!session?.accessToken || !selectedShipment) return;

    const currentCharges = workspace.charges.length > 0 ? workspace.charges : (selectedShipment.charges ?? []);
    const billingCharges = getWorkflowCharges(currentCharges, selectedShipment);
    if (billingCharges.length === 0) {
      pushToast("error", "Charges needed", "Generate charges before creating the invoice.");
      return;
    }

    const draftInvoice = await runMutation(
      "Draft invoice created",
      () => api.createInvoice(session.accessToken, selectedShipment.id),
      { refresh: false, successToast: false, confirm: false }
    );

    if (!draftInvoice) return;

    setWorkflowInvoice(draftInvoice);
    setInvoices((current) => [draftInvoice, ...current.filter((invoice) => invoice.id !== draftInvoice.id)]);
    setShipmentWorkflowStep("invoice");
    pushToast(
      "success",
      "Invoice ready",
      "The draft invoice is ready for review."
    );
  }

  function handleUpdateItemsFromInvoice() {
    setItemUpdateReturnStep(shipmentWorkflowStep ?? "charges");
    setShipmentWorkflowStep(null);
    setEditingItemId(null);
    setItemDraft(lastItemDraft);
    setActiveView("shipments");
    if (selectedShipment) void workspace.loadShipmentRelated(selectedShipment.id);
  }

  async function restoreShipmentInvoiceWorkflow(
    shipmentId: string,
    requestedStep: ShipmentWorkflowStep = "invoice",
    invoiceId?: string
  ) {
    if (!session?.accessToken || !isValidId(shipmentId)) return false;

    setBusy(true);
    try {
      const token = session.accessToken;
      let restoredShipment = data.shipments.find((shipment) => shipment.id === shipmentId);

      if (!restoredShipment) {
        try {
          restoredShipment = await api.getShipment(token, shipmentId);
        } catch (error) {
          if (isNotFoundError(error)) {
            pushToast("info", "Workflow expired", "That saved shipment no longer exists.");
            return false;
          }
          throw error;
        }
      }

      workspace.setSelectedShipmentId(shipmentId);
      const [nextItems, nextCharges] = await Promise.all([
        safe(() => api.getShipmentItems(token, shipmentId), [] as ShipmentItem[]),
        safe(() => api.getChargesByShipment(token, shipmentId), [])
      ]);
      let nextInvoices: Invoice[] = [];

      try {
        nextInvoices = await api.getInvoicesByShipment(token, shipmentId);
      } catch (error) {
        if (!isNotFoundError(error)) throw error;
      }

      setInvoices(nextInvoices);
      workspace.setCharges(nextCharges);
      await workspace.loadShipmentRelated(shipmentId);
      const nextWorkflowCharges = getWorkflowCharges(nextCharges, restoredShipment);

      const requestedInvoice = invoiceId ? nextInvoices.find((invoice) => invoice.id === invoiceId) : undefined;
      const requestedInvoiceStatus = String(requestedInvoice?.paymentStatus ?? "").replace(/\s+/g, "").toLowerCase();
      const requestedReviewInvoice = requestedInvoiceStatus === "draft" ? requestedInvoice : undefined;
      const draftInvoice = nextInvoices.find((invoice) => String(invoice.paymentStatus).toLowerCase() === "draft");
      const payableInvoice = nextInvoices.find((invoice) =>
        ["pending", "partiallypaid"].includes(String(invoice.paymentStatus).replace(/\s+/g, "").toLowerCase())
      );
      const reviewInvoice = requestedReviewInvoice ?? draftInvoice;

      if (reviewInvoice) {
        setWorkflowInvoice(reviewInvoice);
        setShipmentWorkflowStep("invoice");
        setActiveView("shipments");
        pushToast("info", "Invoice restored", "The latest invoice for this shipment is open for review.");
        return true;
      }

      if (payableInvoice) {
        setWorkflowInvoice(null);
        setShipmentWorkflowStep(null);
        setActiveView("finance");
        pushToast("info", "Payment step restored", "The invoice is ready for payment in finance.");
        return true;
      }

      if (requestedStep === "charges" || nextWorkflowCharges.length > 0 || nextItems.length > 0 || restoredShipment.items?.length) {
        setWorkflowInvoice(null);
        setShipmentWorkflowStep("charges");
        setActiveView("shipments");
        pushToast("info", "Charge step restored", "Continue by generating charges for the saved cargo items.");
        return true;
      }

      pushToast("info", "Cargo items needed", "Add at least one cargo item before continuing the invoice cycle.");
      return false;
    } catch (error) {
      if (isBackendUnavailableError(error)) {
        handleBackendUnavailable();
        return false;
      }
      pushToast("error", "Could not continue invoice", getFriendlyErrorMessage(error));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleContinueInvoiceFlow() {
    if (!selectedShipment) return;
    await restoreShipmentInvoiceWorkflow(selectedShipment.id, "invoice");
  }

  async function handleCreateInvoice(event: FormEvent) {
    event.preventDefault();
    if (!session?.accessToken || !selectedShipment) return;

    const createdInvoice = await runMutation(
      "Draft invoice created",
      () => api.createInvoice(session.accessToken, selectedShipment.id),
      {
        refresh: false,
        successToast: false,
        confirm: {
          title: "Create draft invoice",
          message: "A draft invoice will be created or updated for the selected shipment.",
          confirmLabel: "OK"
        }
      }
    );

    if (createdInvoice) {
      setInvoices((current) => [createdInvoice, ...current.filter((invoice) => invoice.id !== createdInvoice.id)]);
      pushToast("success", "Draft invoice ready", `${createdInvoice.invoiceNumber} is now attached to the selected shipment.`);
      await loadData();
      await workspace.loadShipmentRelated(selectedShipment.id);
    }
  }

  function handleInvoiceStatus(id: string, action: "mark-as-paid" | "mark-as-partially-paid" | "mark-as-refunded", payment?: InvoicePaymentRequest) {
    if (!session?.accessToken) return;
    void (async () => {
      const updated = await runMutation("Invoice updated", () => api.invoiceStatus(session.accessToken, id, action, payment), {
        refresh: false
      });
      if (updated) {
        setInvoices((current) => current.map((invoice) => (invoice.id === updated.id ? updated : invoice)));
        if (selectedShipment) await workspace.loadShipmentRelated(selectedShipment.id);
      }
    })();
  }

  function handleConfirmInvoice(id: string) {
    if (!session?.accessToken) return;
    void (async () => {
      const updated = await runMutation(
        "Invoice confirmed",
        () => api.confirmInvoice(session.accessToken, id),
        {
          refresh: false,
          successToast: false,
          confirm: {
            title: "Confirm invoice",
            message: "The draft invoice will move to payment pending and become payable.",
            confirmLabel: "OK"
          }
        }
      );

      if (updated) {
        setInvoices((current) => [updated, ...current.filter((invoice) => invoice.id !== updated.id)]);
        setWorkflowInvoice(null);
        setShipmentWorkflowStep(null);

        if (selectedShipment) {
          try {
            const nextInvoices = await api.getInvoicesByShipment(session.accessToken, selectedShipment.id);
            setInvoices(nextInvoices);
          } catch (error) {
            if (isBackendUnavailableError(error)) {
              handleBackendUnavailable();
              return;
            }
            setInvoices((current) => [updated, ...current.filter((invoice) => invoice.id !== updated.id)]);
          }

          try {
            await workspace.loadShipmentRelated(selectedShipment.id);
          } catch (error) {
            if (isBackendUnavailableError(error)) {
              handleBackendUnavailable();
              return;
            }
            // Keep the payment handoff moving even if related shipment data refresh lags.
          }
        }

        setActiveView("finance");
        pushToast("success", "Invoice confirmed", "The invoice is ready for payment.");
      }
    })();
  }

  function handleCancelWorkflowInvoice(invoice: Invoice) {
    if (!session?.accessToken || !selectedShipment) return;

    const token = session.accessToken;
    const shipmentId = selectedShipment.id;
    const chargeIds = Array.from(
      new Set(
        getWorkflowCharges(
          [...workspace.charges, ...(invoice.charges ?? []), ...(selectedShipment.charges ?? [])] as ShipmentCharge[],
          selectedShipment
        )
          .map((charge) => charge.id)
          .filter(isValidId)
      )
    );
    const itemIds = Array.from(
      new Set(
        [...workspace.shipmentItems, ...(selectedShipment.items ?? [])]
          .map((item) => item.id)
          .filter(isValidId)
      )
    );

    void (async () => {
      const result = await runMutation(
        "Invoice cycle cancelled",
        async () => {
          const cancelled = await api.cancelInvoice(token, invoice.id, "Cancelled from invoice review");
          const cleanupResults = await Promise.allSettled([
            ...chargeIds.map((id) => api.deleteCharge(token, id)),
            ...itemIds.map((id) => api.deleteShipmentItem(token, id))
          ]);

          return {
            invoice: cancelled,
            cleanupFailed: cleanupResults.some((entry) => entry.status === "rejected")
          };
        },
        {
          refresh: false,
          successToast: false,
          confirm: {
            title: "Cancel invoice cycle",
            message: "The draft invoice will be cancelled, and generated charges and cargo items for this cycle will be removed.",
            confirmLabel: "Cancel cycle",
            tone: "danger"
          }
        }
      );

      if (!result) return;

      setInvoices((current) => current.map((currentInvoice) => (currentInvoice.id === result.invoice.id ? result.invoice : currentInvoice)));
      setWorkflowInvoice(null);
      setShipmentWorkflowStep(null);
      setItemUpdateReturnStep(null);
      setEditingItemId(null);
      setItemDraft(initialShipmentItemDraft);
      setLastItemDraft(initialShipmentItemDraft);
      workspace.setCharges([]);
      await workspace.loadShipmentRelated(shipmentId);
      setActiveView("shipments");
      pushToast(
        result.cleanupFailed ? "error" : "success",
        result.cleanupFailed ? "Invoice cancelled" : "Invoice cycle cancelled",
        result.cleanupFailed
          ? "The invoice was cancelled, but some charges or cargo items could not be removed."
          : "The invoice was cancelled and the generated charges and cargo items were removed."
      );
    })();
  }

  function handleCancelInvoice(id: string, reason: string) {
    if (!session?.accessToken) return;
    void (async () => {
      const updated = await runMutation("Invoice cancelled", () => api.cancelInvoice(session.accessToken, id, reason), {
        refresh: false,
        confirm: false
      });
      if (updated) {
        setInvoices((current) => current.map((invoice) => (invoice.id === updated.id ? updated : invoice)));
      }
    })();
  }

  function handleDeleteInvoice(id: string) {
    if (!session?.accessToken) return;
    void (async () => {
      const deleted = await runMutation("Invoice deleted", () => api.deleteInvoice(session.accessToken, id), {
        refresh: false,
        confirm: false
      });
      if (deleted) {
        setInvoices((current) => current.filter((invoice) => invoice.id !== id));
      }
    })();
  }

  async function handleUploadDocument(event: FormEvent) {
    event.preventDefault();
    if (!session?.accessToken || !selectedShipment || !documentDraft.file) return;

    const formData = new FormData();
    formData.append("Type", String(documentDraft.type));
    formData.append("File", documentDraft.file);

    const uploaded = await runMutation("Document uploaded", () => api.uploadDocument(session.accessToken, selectedShipment.id, formData));
    if (uploaded) setDocumentDraft({ type: 0, file: null });
  }

  function handleDeleteDocument(id: string) {
    if (!session?.accessToken) return;
    void runMutation("Document deleted", () => api.deleteDocument(session.accessToken, id), { confirm: false });
  }

  async function handleUpdateProfile(event: FormEvent) {
    event.preventDefault();
    if (!session?.accessToken) return;

    await runMutation(
      "Profile update submitted",
      async () => {
        const response = await api.updateProfile(session.accessToken, {
          firstName: profileDraft.firstName.trim() || undefined,
          lastName: profileDraft.lastName.trim() || undefined,
          username: profileDraft.username.trim() || undefined,
          email: profileDraft.email.trim() || undefined,
          phoneNumber: profileDraft.phoneNumber.trim() || undefined
        });

        if (response.updatedProfile) setProfile(response.updatedProfile);

        const emailChanged = profileDraft.email.trim() && profileDraft.email.trim() !== profile?.email;
        const phoneChanged = profileDraft.phoneNumber.trim() && profileDraft.phoneNumber.trim() !== profile?.phoneNumber;

        if (response.isEmailVerificationSent || emailChanged) {
          setVerifyDraft((current) => ({ ...current, email: profileDraft.email.trim() || current.email }));
          setShowProfileVerify("email");
        } else if (response.isPhoneVerificationSent || phoneChanged) {
          setShowProfileVerify("phone");
        }

        pushToast(
          response.isEmailVerificationSent || response.isPhoneVerificationSent ? "info" : "success",
          "Profile updated",
          response.isEmailVerificationSent
            ? "Check your inbox to confirm the new email address."
            : response.isPhoneVerificationSent
              ? "Enter the code sent to your new phone number."
              : "Your profile has been updated."
        );
        return response;
      },
      { successToast: false }
    );
  }

  async function handleUpdatePassword(event: FormEvent) {
    event.preventDefault();
    if (!session?.accessToken) return;

    await runMutation(
      "Password updated",
      async () => {
        const response = await api.updatePassword(session.accessToken, passwordDraft);
        if (response.success) {
          pushToast("success", "Password updated", "Your password has been changed successfully.");
          setPasswordDraft({ currentPassword: "", newPassword: "", confirmPassword: "" });
        } else {
          pushToast("error", "Password update failed", response.message);
        }
        return response;
      },
      { successToast: false }
    );
  }

  async function handleVerifyPendingPhone(event: FormEvent) {
    event.preventDefault();
    if (!session?.accessToken) return;

    await runMutation(
      "Phone change verified",
      async () => {
        const response = await api.verifyPhoneChange(session.accessToken, verifyDraft.pendingPhoneCode.trim());
        if (response.updatedProfile) setProfile(response.updatedProfile);
        setVerifyDraft((current) => ({ ...current, pendingPhoneCode: "" }));
        setShowProfileVerify(null);
        pushToast("success", "Phone number updated", "Your new phone number has been confirmed.");
        return response;
      },
      { successToast: false }
    );
  }

  async function handleSaveCustomer(event: FormEvent) {
    event.preventDefault();
    if (!session?.accessToken) return;

    const isCompany = customerDraft.mode === "company";
    const existingCustomer = data.currentCustomer ?? profile?.customer;
    const payload = isCompany
      ? {
          companyName: customerDraft.companyName.trim() || undefined,
          taxNumber: customerDraft.taxNumber.trim() || undefined,
          countryCode: customerDraft.countryCode.trim().toUpperCase() || undefined,
          dateOfBirth: customerDraft.dateOfBirth || undefined
        }
      : {
          nationalId: customerDraft.nationalId.trim() || undefined,
          dateOfBirth: customerDraft.dateOfBirth || undefined
        };

    await runMutation(existingCustomer ? "Customer profile updated" : "Customer profile created", async () => {
      const customer = existingCustomer
        ? await api.updateCustomer(session.accessToken, payload)
        : await api.createCustomer(session.accessToken, payload);
      setData((current) => ({ ...current, currentCustomer: customer }));
      setProfile((current) => (current ? { ...current, customer } : current));
      return customer;
    });
  }

  async function handleDeleteCustomer() {
    if (!session?.accessToken) return;
    await runMutation("Customer profile deleted", async () => {
      const result = await api.deleteCustomer(session.accessToken);
      setData((current) => ({ ...current, currentCustomer: undefined }));
      setProfile((current) => (current ? { ...current, customer: undefined } : current));
      return result;
    }, { confirm: false });
  }

  function handleCreateCarrier(body: { name: string; code: string }) {
    if (!session?.accessToken) return;
    void runMutation("Carrier created", () => api.createCarrier(session.accessToken, body));
  }

  function handleUpdateCarrier(id: string, body: { name?: string; code?: string }) {
    if (!session?.accessToken) return;
    void runMutation("Carrier updated", () => api.updateCarrier(session.accessToken, id, body));
  }

  function handleDeleteCarrier(id: string) {
    if (!session?.accessToken) return;
    void runMutation("Carrier deleted", () => api.deleteCarrier(session.accessToken, id), { confirm: false });
  }

  function handleCreatePort(body: { name: string; code: string; country: string }) {
    if (!session?.accessToken) return;
    void runMutation("Port created", () => api.createPort(session.accessToken, body));
  }

  function handleUpdatePort(id: string, body: { name?: string; code?: string; country?: string }) {
    if (!session?.accessToken) return;
    void runMutation("Port updated", () => api.updatePort(session.accessToken, id, body));
  }

  function handleDeletePort(id: string) {
    if (!session?.accessToken) return;
    void runMutation("Port deleted", () => api.deletePort(session.accessToken, id), { confirm: false });
  }

  function handleCreateRoute(body: { fromPortId: string; toPortId: string }) {
    if (!session?.accessToken) return;
    void runMutation("Route created", () => api.createRoute(session.accessToken, body));
  }

  function handleUpdateRoute(id: string, body: { fromPortId: string; toPortId: string }) {
    if (!session?.accessToken) return;
    void runMutation("Route updated", () => api.updateRoute(session.accessToken, id, body));
  }

  function handleDeleteRoute(id: string) {
    if (!session?.accessToken) return;
    void runMutation("Route deleted", () => api.deleteRoute(session.accessToken, id), { confirm: false });
  }

  function handleCreateContainerType(body: { name: string }) {
    if (!session?.accessToken) return;
    void runMutation("Container type created", () => api.createContainerType(session.accessToken, body));
  }

  function handleUpdateContainerType(id: string, body: { name: string }) {
    if (!session?.accessToken) return;
    void runMutation("Container type updated", () => api.updateContainerType(session.accessToken, id, body));
  }

  function handleDeleteContainerType(id: string) {
    if (!session?.accessToken) return;
    void runMutation("Container type deleted", () => api.deleteContainerType(session.accessToken, id), { confirm: false });
  }

  async function handleFilterPortsByCountry(country: string) {
    if (!country.trim()) return;
    setBusy(true);
    try {
      const ports = await api.getPortsByCountry(country.trim().toUpperCase(), { pageSize: 50 });
      setData((current) => ({ ...current, ports }));
      pushToast("success", "Ports loaded", "Country lookup has been applied.");
    } catch (error) {
      if (isBackendUnavailableError(error)) {
        handleBackendUnavailable();
        return;
      }
      if (isNotFoundError(error)) {
        setData((current) => ({ ...current, ports: [] }));
        pushToast("info", "No ports found", "No ports were found for this country.");
      } else {
        pushToast("error", "Port lookup failed", getFriendlyErrorMessage(error));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleFilterRoutesByPort(portId: string, direction: "from" | "to") {
    if (!portId) return;
    setBusy(true);
    try {
      const routes =
        direction === "from"
          ? await api.getRoutesByFromPort(portId, { pageSize: 50 })
          : await api.getRoutesByToPort(portId, { pageSize: 50 });
      setData((current) => ({ ...current, routes }));
      pushToast("success", "Routes loaded", "Port route lookup has been applied.");
    } catch (error) {
      if (isBackendUnavailableError(error)) {
        handleBackendUnavailable();
        return;
      }
      if (isNotFoundError(error)) {
        setData((current) => ({ ...current, routes: [] }));
        pushToast("info", "No routes found", "No routes were found for this port.");
      } else {
        pushToast("error", "Route lookup failed", getFriendlyErrorMessage(error));
      }
    } finally {
      setBusy(false);
    }
  }

  function renderWorkspace() {
    if (isCustomerLockedView) {
      return <CustomerRequiredView onGoToSettings={() => selectWorkspaceView("account")} />;
    }

    if (activeView === "overview") {
      return (
        <OverviewPage
          stats={stats}
          shipments={filteredShipments}
          rates={filteredRates}
          quotes={filteredQuotes}
          loading={loading}
          onSelectShipment={handleSelectShipment}
        />
      );
    }

    if (activeView === "pricing") {
      return (
        <PricingPage
          rates={filteredRates}
          carriers={data.carriers}
          routes={data.routes}
          containerTypes={data.containerTypes}
          session={session!}
          isPrivileged={isPrivileged}
          isAdmin={isAdmin}
          isUser={isUser}
          busy={busy}
          theme={theme}
          draft={rateDraft}
          setDraft={setRateDraft}
          analyticsDraft={analyticsDraft}
          setAnalyticsDraft={setAnalyticsDraft}
          analytics={analytics}
          rateFilters={appliedRateBookFilters}
          recommendationDraft={recommendationDraft}
          setRecommendationDraft={setRecommendationDraft}
          recommendations={recommendations}
          onCreateRate={handleCreateRate}
          onUpdateRate={handleUpdateRate}
          onDeleteRate={handleDeleteRate}
          onToggleRate={handleToggleRate}
          onApplyRateFilters={handleApplyRateFilters}
          onResetRateFilters={handleResetRateFilters}
          onLoadAnalytics={handleLoadAnalytics}
          onLoadRecommendations={handleLoadRecommendations}
          onToggleTheme={handleToggleTheme}
          onRateRequestCreated={(request) => {
            setData((current) => ({ ...current, quoteRequests: [request, ...current.quoteRequests] }));
            pushToast("success", "Quote request submitted", "Your request is under review. We will email you as soon as it is approved or rejected.");
          }}
          hasCustomerProfile={Boolean(currentCustomer)}
          onCreateCustomerProfile={() => selectWorkspaceView("account")}
        />
      );
    }

    if (activeView === "master-data") {
      return (
        <MasterDataPage
          carriers={data.carriers}
          ports={data.ports}
          routes={data.routes}
          containerTypes={data.containerTypes}
          isAdmin={isAdmin}
          busy={busy}
          onCreateCarrier={handleCreateCarrier}
          onUpdateCarrier={handleUpdateCarrier}
          onDeleteCarrier={handleDeleteCarrier}
          onCreatePort={handleCreatePort}
          onUpdatePort={handleUpdatePort}
          onDeletePort={handleDeletePort}
          onCreateRoute={handleCreateRoute}
          onUpdateRoute={handleUpdateRoute}
          onDeleteRoute={handleDeleteRoute}
          onCreateContainerType={handleCreateContainerType}
          onUpdateContainerType={handleUpdateContainerType}
          onDeleteContainerType={handleDeleteContainerType}
          onFilterPortsByCountry={handleFilterPortsByCountry}
          onFilterRoutesByPort={handleFilterRoutesByPort}
        />
      );
    }

    if (activeView === "quotes") {
      if (quoteRequestDetailId) {
        return (
          <QuoteRequestDetailsPage
            request={quoteRequestDetail}
            loading={quoteRequestDetailLoading && !quoteRequestDetail}
            error={quoteRequestDetailError}
            busy={busy}
            isPrivileged={isPrivileged}
            isUser={isUser}
            onBack={closeQuoteRequestDetails}
            onApprove={handleApproveQuoteRequestFromDetails}
            onReject={handleRejectQuoteRequestFromDetails}
            onCancel={handleCancelQuoteRequestFromDetails}
            onStillDraft={() => {
              closeQuoteRequestDetails();
              pushToast("info", "Request kept as draft", "No backend action was needed, so the request remains pending review.");
            }}
          />
        );
      }

      return (
        <QuotesPage
          quotes={filteredQuotes}
          quoteRequests={data.quoteRequests}
          rates={data.rates}
          routes={data.routes}
          customers={data.customers}
          session={session!}
          isPrivileged={isPrivileged}
          isAdmin={isAdmin}
          isUser={isUser}
          busy={busy}
          theme={theme}
          draft={quoteDraft}
          setDraft={setQuoteDraft}
          onCreateQuote={handleCreateQuote}
          onAcceptQuote={handleAcceptQuote}
          onRejectQuote={handleRejectQuote}
          onDeleteQuote={handleDeleteQuote}
          onOpenQuoteRequestDetails={handleOpenQuoteRequestDetails}
          onFilterByCustomer={handleFilterQuotesByCustomer}
          onFilterByRoute={handleFilterQuotesByRoute}
          onToggleTheme={handleToggleTheme}
          onRateRequestCreated={(request) => {
            setData((current) => ({ ...current, quoteRequests: [request, ...current.quoteRequests] }));
            pushToast("success", "Quote request submitted", "Your request is under review. We will email you as soon as it is approved or rejected.");
          }}
          hasCustomerProfile={Boolean(currentCustomer)}
          onCreateCustomerProfile={() => selectWorkspaceView("account")}
        />
      );
    }

    if (activeView === "shipments") {
      if (shipmentWorkflowStep === "charges") {
        return (
          <ChargeGenerationPage
            selectedShipment={selectedShipment}
            charges={workspace.charges}
            busy={busy}
            onGenerate={handleGenerateCharges}
            onCreateInvoice={handleCreateWorkflowInvoice}
            onUpdateItems={handleUpdateItemsFromInvoice}
          />
        );
      }

      if (shipmentWorkflowStep === "invoice") {
        return (
          <InvoiceReviewPage
            selectedShipment={selectedShipment}
            invoice={workflowInvoice}
            charges={workspace.charges}
            busy={busy}
            onConfirm={handleConfirmInvoice}
            onCancel={handleCancelWorkflowInvoice}
            onUpdateItems={handleUpdateItemsFromInvoice}
          />
        );
      }

      return (
        <ShipmentsPage
          shipments={filteredShipments}
          selectedShipment={selectedShipment}
          timeline={workspace.timeline}
          history={workspace.shipmentHistory}
          isPrivileged={isPrivileged}
          isAdmin={isAdmin}
          isUser={isUser}
          busy={busy}
          shipmentDraft={shipmentDraft}
          setShipmentDraft={setShipmentDraft}
          quoteOptions={shipmentQuoteOptions}
          quoteSearch={quoteSearch}
          setQuoteSearch={setQuoteSearch}
          trackingDraft={trackingDraft}
          setTrackingDraft={setTrackingDraft}
          actionReason={actionReason}
          setActionReason={setActionReason}
          onCreateShipment={handleCreateShipment}
          onSelectShipment={handleSelectShipment}
          onShipmentAction={handleShipmentAction}
          onUpdateTracking={handleUpdateTracking}
          onDeleteShipment={handleDeleteShipment}
          shipmentItems={workspace.shipmentItems}
          itemDraft={itemDraft}
          setItemDraft={setItemDraft}
          editingItemId={editingItemId}
          itemUpdateReturnStep={itemUpdateReturnStep}
          onSaveItem={handleSaveShipmentItem}
          onEditItem={handleEditShipmentItem}
          onCancelItemEdit={handleCancelItemUpdate}
          onDeleteItem={handleDeleteShipmentItem}
          onConfirmItems={handleConfirmShipmentItems}
          onCancelItemUpdate={handleCancelItemUpdate}
          hasDraftInvoice={Boolean(draftInvoiceForSelectedShipment)}
          onContinueInvoice={handleContinueInvoiceFlow}
        />
      );
    }

    if (activeView === "finance") {
      return (
        <FinancePage
          selectedShipment={selectedShipment}
          charges={workspace.charges}
          invoices={invoices}
          isPrivileged={isPrivileged}
          isAdmin={isAdmin}
          busy={busy}
          onCreateInvoice={handleCreateInvoice}
          onLoadInvoices={() => void loadInvoices()}
          onInvoiceStatus={handleInvoiceStatus}
          onCancelInvoice={handleCancelInvoice}
          onDeleteInvoice={handleDeleteInvoice}
        />
      );
    }

    if (activeView === "documents") {
      return (
        <DocumentsPage
          selectedShipment={selectedShipment}
          documents={workspace.documents}
          busy={busy}
          draft={documentDraft}
          setDraft={setDocumentDraft}
          onUpload={handleUploadDocument}
          onDeleteDocument={handleDeleteDocument}
        />
      );
    }

    return (
      <AccountPage
        profile={profile}
        customers={data.customers}
        currentCustomer={currentCustomer}
        isPrivileged={isPrivileged}
        busy={busy}
        profileDraft={profileDraft}
        setProfileDraft={setProfileDraft}
        passwordDraft={passwordDraft}
        setPasswordDraft={setPasswordDraft}
        verifyDraft={verifyDraft}
        setVerifyDraft={setVerifyDraft}
        showProfileVerify={showProfileVerify}
        setShowProfileVerify={setShowProfileVerify}
        customerDraft={customerDraft}
        setCustomerDraft={setCustomerDraft}
        onUpdateProfile={handleUpdateProfile}
        onUpdatePassword={handleUpdatePassword}
        onVerifyPendingPhone={handleVerifyPendingPhone}
        onSaveCustomer={handleSaveCustomer}
        onDeleteCustomer={handleDeleteCustomer}
        onLogoutAll={handleLogoutAll}
      />
    );
  }

  const actionConfirmationDialog = (
    <ConfirmDialog
      open={Boolean(pendingActionConfirmation)}
      title={pendingActionConfirmation?.title ?? "Confirm action"}
      message={pendingActionConfirmation?.message ?? "This request will update backend data. Continue?"}
      confirmLabel={pendingActionConfirmation?.confirmLabel ?? "OK"}
      tone={pendingActionConfirmation?.tone ?? "default"}
      busy={busy}
      onClose={() => settleActionConfirmation(false)}
      onConfirm={() => settleActionConfirmation(true)}
    />
  );

  if (restoringSession && !session) {
    return (
      <>
        <LoadingState label="Opening secure session" />
        <ToastHost toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  const activeConfirmationLink = readConfirmationLink(path);
  if (activeConfirmationLink) {
    return (
      <>
        <LoadingState label={activeConfirmationLink.type === "registration-email" ? "Confirming email" : "Confirming email change"} />
        <ToastHost toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  if (!session) {
    const lowerPathname = pathname.toLowerCase();
    const showAuth =
      !serverUnavailable &&
      (lowerPathname === "/auth/login" ||
        lowerPathname === "/auth/register" ||
        lowerPathname === "/auth/verify" ||
        lowerPathname === "/confirm-email" ||
        lowerPathname === "/confirm-email-change");

    return (
      <>
        {showAuth ? (
          <AuthPage
            authMode={authMode}
            setAuthMode={handleAuthModeChange}
            loginForm={loginForm}
            setLoginForm={setLoginForm}
            registerForm={registerForm}
            setRegisterForm={setRegisterForm}
            onLogin={handleLogin}
            onRegister={handleRegister}
            verificationStep={verificationStep}
            verifyDraft={verifyDraft}
            setVerifyDraft={setVerifyDraft}
            onResendEmail={handleResendEmail}
            onConfirmEmail={handleConfirmEmail}
            onResendPhone={handleResendPhone}
            onConfirmPhone={handleConfirmPhone}
            busy={busy}
            publicRateCount={authMetrics.publicRateCount}
            publicWorkflowCount={authMetrics.workflowStateCount}
            theme={theme}
            onToggleTheme={handleToggleTheme}
            onBackToLanding={() => {
              setAuthMode("login");
              navigate("/");
            }}
          />
        ) : (
          <PublicLandingPage
            theme={theme}
            onToggleTheme={handleToggleTheme}
            serverUnavailable={serverUnavailable}
            onSignIn={() => {
              if (serverUnavailable) return;
              setAuthMode("login");
              navigate("/auth/login");
            }}
            onGetStarted={() => {
              if (serverUnavailable) return;
              setAuthMode("register");
              navigate("/auth/register");
            }}
          />
        )}
        {actionConfirmationDialog}
        <ToastHost toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  return (
    <>
      <AppShell
        session={session}
        activeView={activeView}
        setActiveView={selectWorkspaceView}
        isPrivileged={isPrivileged}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onOpenProfilePreview={() => setProfilePreviewOpen(true)}
        onLogout={() => void handleLogout()}
      >
        {pageLoading || (loading && data.rates.length === 0 && data.shipments.length === 0 && data.quotes.length === 0) ? (
          <LoadingState label="Opening workspace" />
        ) : (
          renderWorkspace()
        )}
      </AppShell>
      <ProfilePreviewModal
        open={profilePreviewOpen}
        profile={profile}
        currentCustomer={currentCustomer}
        roles={session.roles}
        onClose={() => setProfilePreviewOpen(false)}
        onGoToSettings={() => {
          setProfilePreviewOpen(false);
          selectWorkspaceView("account");
        }}
      />
      {actionConfirmationDialog}
      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
