import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Application render failed", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const isArabic = document.documentElement.lang === "ar";
    return (
      <main className="app-error-screen" role="alert">
        <div>
          <h1>{isArabic ? "تعذر عرض الصفحة" : "The page could not be displayed"}</h1>
          <p>
            {isArabic
              ? "أعد تحميل الصفحة للعودة إلى آخر حالة محفوظة."
              : "Reload the page to return to the latest saved state."}
          </p>
          <button type="button" className="primary-button" onClick={() => window.location.reload()}>
            {isArabic ? "إعادة تحميل الصفحة" : "Reload page"}
          </button>
        </div>
      </main>
    );
  }
}
