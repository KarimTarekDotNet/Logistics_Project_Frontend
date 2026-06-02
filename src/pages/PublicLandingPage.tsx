import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Facebook,
  FileText,
  Instagram,
  Linkedin,
  LockKeyhole,
  Moon,
  Network,
  ReceiptText,
  Route,
  ServerCog,
  ShieldCheck,
  Ship,
  Sun,
  UsersRound,
  WalletCards
} from "lucide-react";
import { useEffect, useState } from "react";
import { BrandLogo } from "../components/brand/BrandLogo";
import { BRAND_NAME } from "../constants/brand";

const modules = [
  { title: "Rate management", text: "Keep carrier rates, lanes, containers, currency, validity, and active pricing controls in one governed rate book.", icon: WalletCards },
  { title: "Quote generation", text: "Convert controlled rates and operational charges into customer-ready quotations without rebuilding pricing context.", icon: ClipboardList },
  { title: "Shipment lifecycle", text: "Run each file from confirmation through booking, B/L, payment, telex release, delivery, and close.", icon: Ship },
  { title: "Cargo items", text: "Capture quantity, weight, CBM, marks, hazardous cargo, and temperature requirements on the shipment record.", icon: Boxes },
  { title: "Invoices and charges", text: "Manage charge lines, payer responsibility, due dates, payment state, partial payments, refunds, and cancellation control.", icon: ReceiptText },
  { title: "Document handling", text: "Attach shipment documents to the operational record with role-based visibility and clean document history.", icon: FileText }
];

const navSections = [
  { id: "platform", label: "Platform" },
  { id: "workflow", label: "Workflow" },
  { id: "modules", label: "Modules" },
  { id: "security", label: "Security" }
];

const workflow = [
  "Rate imported",
  "Quote created",
  "Shipment confirmed",
  "Documents uploaded",
  "Invoice issued",
  "Payment tracked",
  "Telex released",
  "Shipment closed"
];

const roles = [
  { title: "Admin", text: "Own master data, pricing governance, staff access, lifecycle control, finance visibility, and operating standards." },
  { title: "Staff", text: "Execute daily forwarding work with shipment context, document checks, billing actions, and customer follow-up in one place." },
  { title: "Customer", text: "Track shipment progress, upload documents, manage cargo details, and see clearer milestone visibility." },
  { title: "Automation user", text: "Structured records make future carrier connectivity and intelligent operational handoffs easier to add safely." }
];

export function PublicLandingPage(props: {
  onSignIn: () => void;
  onGetStarted: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  serverUnavailable?: boolean;
}) {
  const [activeSection, setActiveSection] = useState("platform");
  const currentYear = new Date().getFullYear();
  const authDisabled = Boolean(props.serverUnavailable);

  useEffect(() => {
    const sections = navSections
      .map((section) => document.getElementById(section.id))
      .filter((section): section is HTMLElement => Boolean(section));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActiveSection(visible.target.id);
      },
      { rootMargin: "-22% 0px -58% 0px", threshold: [0.16, 0.32, 0.48] }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="landing-page">
      <nav className="landing-nav" aria-label="Public">
        <button className="landing-brand brand-button" type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label={`${BRAND_NAME} home`}>
          <BrandLogo />
          <div>
            <strong>{BRAND_NAME}</strong>
            <span>  Forwarding operations platform</span>
          </div>
        </button>
        <div className="landing-nav-links">
          {navSections.map((section) => (
            <button className={activeSection === section.id ? "active" : ""} type="button" onClick={() => scrollToSection(section.id)} key={section.id}>
              {section.label}
            </button>
          ))}
        </div>
        <div className="landing-nav-actions">
          <button className="landing-nav-theme" type="button" onClick={props.onToggleTheme} aria-label="Toggle theme" title="Toggle theme">
            {props.theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button className="ghost-button" type="button" onClick={props.onSignIn} disabled={authDisabled}>
            Sign in
          </button>
          <button className="primary-button compact" type="button" onClick={props.onGetStarted} disabled={authDisabled}>
            Get started
            <ArrowRight size={16} />
          </button>
        </div>
      </nav>

      {props.serverUnavailable && (
        <section className="server-status-banner" role="status" aria-live="polite">
          <ServerCog size={22} />
          <div>
            <strong>Server currently under development</strong>
            <span>The public site is available, but protected workspace actions are paused until the backend is online.</span>
          </div>
        </section>
      )}

      <section className="landing-hero" id="top">
        <div className="landing-hero-copy">
          <span className="landing-kicker">Freight forwarding operating system</span>
          <h1>Freight forwarding operations, automated from rate to release.</h1>
          <p>
            {BRAND_NAME} connects rates, quotes, bookings, shipments, cargo, invoices, documents, and status timelines in one operational platform for freight
            forwarders, logistics teams, admins, staff, customers, and automation-ready operations.
          </p>
          <div className="landing-hero-actions">
            <button className="primary-button" type="button" onClick={props.onSignIn} disabled={authDisabled}>
              Sign in
            </button>
            <button className="secondary-button" type="button" onClick={props.onGetStarted} disabled={authDisabled}>
              Create account
              <ArrowRight size={17} />
            </button>
          </div>
          <div className="landing-proof">
            <span>
              <ShieldCheck size={16} />
              Role-based portal
            </span>
            <span>
              <Route size={16} />
              Rate-to-release flow
            </span>
            <span>
              <FileText size={16} />
              Document controls
            </span>
          </div>
        </div>

        <div className="landing-visual" aria-label={`${BRAND_NAME} dashboard preview`}>
          <div className="visual-topline">
            <span>Operations control tower</span>
            <strong>Live shipment desk</strong>
          </div>
          <div className="visual-automation-flow" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="visual-grid">
            <div className="visual-card pipeline-card">
              <div className="visual-card-head">
                <span>Shipment pipeline</span>
                <b>Booking confirmed</b>
              </div>
              <div className="pipeline-line">
                {["Rate", "Quote", "Booking", "B/L", "Release"].map((item, index) => (
                  <span className={index < 3 ? "done" : ""} key={item}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div className="visual-card rate-preview-card">
              <span>Active lane</span>
              <strong>CNSHA to NLRTM</strong>
              <small>20ft Standard - EUR 1,500 - Valid 30 days</small>
            </div>
            <div className="visual-card map-preview-card">
              <span>Route monitor</span>
              <div className="route-map-preview" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
              <strong>ETA variance: +12 min</strong>
            </div>
            <div className="visual-card finance-preview-card">
              <span>Invoice state</span>
              <strong>Payment pending</strong>
              <small>Charges linked - Customer documents received</small>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-band problem-band" id="platform">
        <div>
          <span className="landing-kicker">The operating gap</span>
          <h2>Forwarding teams are still coordinating serious freight work across tools that were never designed to run operations.</h2>
        </div>
        <p>
          Without a connected platform, rates live in spreadsheets, quote decisions sit inside email threads, shipment updates arrive through chat, invoice
          follow-up becomes manual, and documents drift away from the file they belong to. The result is duplicated work, pricing confusion, missed updates, and
          teams spending too much time proving what already happened.
        </p>
      </section>

      <section className="landing-section compare-section">
        <div className="compare-card fragmented">
          <span className="landing-kicker">Scattered operations</span>
          <h2>Excel, email, chat, manual rate checks, and disconnected folders create status chaos.</h2>
          <p>
            Every handoff creates another place for the truth to split. Staff chase the same update twice, customers ask for visibility, admins lose clean control,
            and finance decisions happen without the full shipment context.
          </p>
        </div>
        <div className="compare-card unified">
          <span className="landing-kicker">Connected platform</span>
          <h2>{BRAND_NAME} keeps the commercial, operational, financial, and document record together.</h2>
          <p>
            Rates feed quotes, quotes become shipments, cargo stays linked, documents remain attached, charges support invoices, and the timeline shows the
            operational story. Customers get clearer visibility while staff and admins get cleaner control.
          </p>
        </div>
      </section>

      <section className="landing-section solution-section">
        <div className="section-copy">
          <span className="landing-kicker">The {BRAND_NAME} answer</span>
          <h2>One operating layer for teams that need speed without losing governance.</h2>
          <p>
            Freight teams move faster when pricing, quoting, shipment execution, billing, documents, and status history are connected. {BRAND_NAME} reduces manual
            follow-up, missed updates, duplicated data entry, and uncertainty over which rate, invoice, document, or milestone is current.
          </p>
        </div>
        <div className="solution-stack">
          {[
            "Operational records stay linked from rate to release",
            "Teams spend less time chasing updates and more time moving shipments",
            "Customers see clearer status while staff and admins retain control"
          ].map((item) => (
            <div className="solution-row" key={item}>
              <CheckCircle2 size={18} />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section workflow-section" id="workflow">
        <div className="section-copy">
          <span className="landing-kicker">Operational workflow</span>
          <h2>A controlled path from commercial rate to final shipment release.</h2>
          <p>
            Instead of rebuilding context at every step, the workflow keeps each team working from the same shipment file and the same operational timeline.
          </p>
        </div>
        <div className="workflow-track">
          {workflow.map((item) => (
            <div className="workflow-step" key={item}>
              <span />
              <strong>{item}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section" id="modules">
        <div className="section-copy centered">
          <span className="landing-kicker">Core modules</span>
          <h2>Built around the real forwarding desk, not a simple dashboard.</h2>
          <p>
            {BRAND_NAME} is an operational SaaS workspace for rate control, quoting, shipment execution, cargo, finance, documents, timeline visibility, and
            customer collaboration.
          </p>
        </div>
        <div className="module-grid">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <article className="module-card" key={module.title}>
                <Icon size={20} />
                <h3>{module.title}</h3>
                <p>{module.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="landing-section role-section">
        <div className="section-copy centered">
          <span className="landing-kicker">Role-based experience</span>
          <h2>Different workspaces for the people and processes that move freight forward.</h2>
        </div>
        <div className="role-grid">
          {roles.map((role) => (
            <article className="role-card" key={role.title}>
              <UsersRound size={20} />
              <h3>{role.title}</h3>
              <p>{role.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section automation-section">
        <div className="automation-card">
          <span className="landing-kicker">Automation-ready operations</span>
          <h2>Structured shipment records that can support future carrier connectivity and intelligent operational handoffs.</h2>
          <p>
            The platform keeps rate, quote, shipment, cargo, billing, document, and timeline data in a predictable operating model so teams can scale volume without
            losing auditability, customer visibility, or staff control.
          </p>
        </div>
      </section>

      <section className="landing-section security-section" id="security">
        <div className="security-card">
          <LockKeyhole size={24} />
          <h2>Protected portal and role-based access.</h2>
          <p>
            Admins, staff, and customers see the right workspace for their role, with protected workflows and controlled operational actions.
          </p>
        </div>
        <div className="security-card">
          <Network size={24} />
          <h2>Audit-friendly shipment timeline.</h2>
          <p>
            Status history, document controls, invoice actions, cargo records, and shipment milestones stay connected so the operation is easier to review and
            manage.
          </p>
        </div>
      </section>

      <section className="landing-cta">
        <span className="landing-kicker">Move forwarding work into one system</span>
        <h2>Start with a protected portal. Scale into connected logistics operations.</h2>
        <div className="landing-hero-actions">
          <button className="primary-button" type="button" onClick={props.onSignIn} disabled={authDisabled}>
            Sign in
          </button>
          <button className="secondary-button" type="button" onClick={props.onGetStarted} disabled={authDisabled}>
            Get started
          </button>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-simple">
          <div className="landing-footer-identity">
            <BrandLogo />
            <div>
              <strong>{BRAND_NAME}</strong>
              <p>Enterprise logistics SaaS for governed freight operations.</p>
            </div>
          </div>
          <div className="landing-footer-legal-block">
            <span>© {currentYear} {BRAND_NAME}. All rights reserved.</span>
            <small>Built by Karim Tarek for secure, audit-ready logistics workflows.</small>
          </div>
          <div className="landing-footer-social">
            <a href="https://www.linkedin.com/in/karim-tarekmohamed" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
              <Linkedin size={18} />
              <span>LinkedIn</span>
            </a>
            <a href="https://www.facebook.com/KVRIM.1/" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
              <Facebook size={18} />
              <span>Facebook</span>
            </a>
            <a href="https://www.instagram.com/kariimtarek11/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <Instagram size={18} />
              <span>Instagram</span>
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
