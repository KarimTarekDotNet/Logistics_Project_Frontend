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
  CircleDollarSign
} from "lucide-react";
import type { ReactNode } from "react";
import { BrandLogo } from "../brand/BrandLogo";
import { BRAND_NAME } from "../../constants/brand";
import type { AuthSession, View } from "../../types";

type NavItem = {
  view: View;
  label: string;
  icon: ReactNode;
  privileged?: boolean;
};

const navItems: NavItem[] = [
  { view: "overview", label: "Overview", icon: <LayoutDashboard size={18} /> },
  { view: "pricing", label: "Pricing", icon: <CircleDollarSign size={18} /> },
  { view: "master-data", label: "Master Data", icon: <Database size={18} />, privileged: true },
  { view: "quotes", label: "Quotes", icon: <ClipboardList size={18} /> },
  { view: "shipments", label: "Shipments", icon: <Ship size={18} /> },
  { view: "finance", label: "Finance", icon: <WalletCards size={18} /> },
  { view: "documents", label: "Documents", icon: <FileText size={18} /> },
  { view: "account", label: "Settings Profile", icon: <Settings size={18} /> }
];

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
  onToggleTheme: () => void;
  onOpenProfilePreview: () => void;
  onLogout: () => void;
}) {
  const visibleNav = navItems.filter((item) => !item.privileged || props.isPrivileged);
  const activeLabel = visibleNav.find((item) => item.view === props.activeView)?.label ?? "Workspace";

  function toggleNavigation() {
    if (window.matchMedia("(max-width: 900px)").matches) {
      props.setSidebarOpen(!props.sidebarOpen);
      return;
    }
    props.setSidebarCollapsed(!props.sidebarCollapsed);
  }

  return (
    <div className={`app-shell ${props.sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      {props.sidebarOpen && <button className="mobile-scrim" type="button" aria-label="Close navigation" onClick={() => props.setSidebarOpen(false)} />}

      <aside className={`sidebar ${props.sidebarOpen ? "open" : ""}`}>
        <div className="brand">
          <BrandLogo />
          <button className="sidebar-close" type="button" onClick={() => props.setSidebarOpen(false)} aria-label="Close navigation">
            <X size={18} />
          </button>
        </div>

        <nav className="nav-list" aria-label="Primary">
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
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="session-card" type="button" onClick={props.onOpenProfilePreview}>
            <UserRound size={18} />
            <div>
              <strong>{props.session.userName || props.session.email || "Signed in"}</strong>
              <small>{props.session.roles.join(", ") || "Authenticated"}</small>
            </div>
          </button>
          <button className="sidebar-mode-row" type="button" onClick={props.onToggleTheme}>
            {props.theme === "dark" ? <Moon size={17} /> : <Sun size={17} />}
            <span>{props.theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
            <b>{props.theme === "dark" ? "ON" : "OFF"}</b>
          </button>
          <button className="sidebar-footer-logout" type="button" onClick={props.onLogout}>
            <LogOut size={17} />
            Logout
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <button
            className="icon-button menu-button"
            type="button"
            onClick={toggleNavigation}
            aria-label={props.sidebarCollapsed ? "Show navigation" : "Hide navigation"}
            title={props.sidebarCollapsed ? "Show navigation" : "Hide navigation"}
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
