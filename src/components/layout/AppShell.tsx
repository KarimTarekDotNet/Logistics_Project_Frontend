import {
  ClipboardList,
  Database,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Settings,
  Ship,
  Sun,
  UserRound,
  WalletCards,
  X,
  Banknote
} from "lucide-react";
import type { ReactNode } from "react";
import { BrandLogo } from "../brand/BrandLogo";
import { BRAND_NAME } from "../../constants/brand";
import type { AppLanguage, AuthSession, View } from "../../types";

type NavItem = {
  view: View;
  label: Record<AppLanguage, string>;
  icon: ReactNode;
  privileged?: boolean;
};

const navItems: NavItem[] = [
  { view: "overview", label: { en: "Overview", ar: "نظرة عامة" }, icon: <LayoutDashboard size={18} /> },
  { view: "pricing", label: { en: "Pricing", ar: "التسعير" }, icon: <Banknote size={18} /> },
  { view: "master-data", label: { en: "Master Data", ar: "البيانات الأساسية" }, icon: <Database size={18} />, privileged: true },
  { view: "quotes", label: { en: "Quotes", ar: "عروض الأسعار" }, icon: <ClipboardList size={18} /> },
  { view: "shipments", label: { en: "Shipments", ar: "الشحنات" }, icon: <Ship size={18} /> },
  { view: "finance", label: { en: "Finance", ar: "المالية" }, icon: <WalletCards size={18} /> },
  { view: "documents", label: { en: "Documents", ar: "المستندات" }, icon: <FileText size={18} /> },
  { view: "account", label: { en: "Settings Profile", ar: "إعدادات الحساب" }, icon: <Settings size={18} /> }
];

const shellCopy = {
  en: {
    workspace: "Workspace",
    navigation: "Primary",
    closeNavigation: "Close navigation",
    signedIn: "Signed in",
    authenticated: "Authenticated",
    lightTheme: "Use light theme",
    darkTheme: "Use dark theme",
    logout: "Logout",
    showNavigation: "Show navigation",
    hideNavigation: "Hide navigation"
  },
  ar: {
    workspace: "مساحة العمل",
    navigation: "التنقل الرئيسي",
    closeNavigation: "إغلاق القائمة",
    signedIn: "تم تسجيل الدخول",
    authenticated: "حساب موثّق",
    lightTheme: "استخدام الوضع الفاتح",
    darkTheme: "استخدام الوضع الداكن",
    logout: "تسجيل الخروج",
    showNavigation: "إظهار القائمة",
    hideNavigation: "إخفاء القائمة"
  }
} satisfies Record<AppLanguage, Record<string, string>>;

export function AppShell(props: {
  children: ReactNode;
  session: AuthSession;
  activeView: View;
  setActiveView: (view: View) => void;
  isPrivileged: boolean;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  theme: "light" | "dark";
  language: AppLanguage;
  onToggleTheme: () => void;
  onOpenProfilePreview: () => void;
  onLogout: () => void;
}) {
  const visibleNav = navItems.filter((item) => !item.privileged || props.isPrivileged);
  const copy = shellCopy[props.language];
  const activeLabel = visibleNav.find((item) => item.view === props.activeView)?.label[props.language] ?? copy.workspace;

  function toggleNavigation() {
    if (window.matchMedia("(max-width: 900px)").matches) {
      props.setSidebarOpen(!props.sidebarOpen);
      return;
    }
    props.setSidebarCollapsed(!props.sidebarCollapsed);
  }

  return (
    <div className={`app-shell ${props.sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      {props.sidebarOpen && <button className="mobile-scrim" type="button" aria-label={copy.closeNavigation} onClick={() => props.setSidebarOpen(false)} />}

      <aside className={`sidebar ${props.sidebarOpen ? "open" : ""}`}>
        <div className="brand">
          <BrandLogo />
          <button className="sidebar-close" type="button" onClick={() => props.setSidebarOpen(false)} aria-label={copy.closeNavigation}>
            <X size={18} />
          </button>
        </div>

        <nav className="nav-list" aria-label={copy.navigation}>
          {visibleNav.map((item) => (
            <button
              type="button"
              className={`nav-button ${props.activeView === item.view ? "active" : ""}`}
              onClick={() => {
                props.setActiveView(item.view);
                props.setSidebarOpen(false);
              }}
              key={item.view}
            >
              {item.icon}
              <span>{item.label[props.language]}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="session-card" type="button" onClick={props.onOpenProfilePreview}>
            <UserRound size={18} />
            <div>
              <strong>{props.session.userName || props.session.email || copy.signedIn}</strong>
              <small>{props.session.roles.join(", ") || copy.authenticated}</small>
            </div>
          </button>
          <button className="sidebar-mode-row" type="button" onClick={props.onToggleTheme}>
            {props.theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            <span>{props.theme === "dark" ? copy.lightTheme : copy.darkTheme}</span>
          </button>
          <button className="sidebar-footer-logout" type="button" onClick={props.onLogout}>
            <LogOut size={17} />
            {copy.logout}
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <button
            className="icon-button menu-button"
            type="button"
            onClick={toggleNavigation}
            aria-label={props.sidebarCollapsed ? copy.showNavigation : copy.hideNavigation}
            title={props.sidebarCollapsed ? copy.showNavigation : copy.hideNavigation}
          >
            <Menu size={19} />
          </button>

          <div className="topbar-context" aria-live="polite">
            <strong>{BRAND_NAME}</strong>
            <span>{activeLabel}</span>
          </div>

        </header>

        {props.children}
      </main>
    </div>
  );
}
