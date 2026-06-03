const rawBasePath = import.meta.env.BASE_URL || "/";
const normalizedBasePath = rawBasePath.endsWith("/") ? rawBasePath : `${rawBasePath}/`;
const SPA_REDIRECT_KEY = "flowtix:spa-redirect";

function readStoredSpaRedirect() {
  try {
    const redirectedPath = sessionStorage.getItem(SPA_REDIRECT_KEY) ?? "";
    sessionStorage.removeItem(SPA_REDIRECT_KEY);
    if (!redirectedPath.startsWith("/") || redirectedPath.startsWith("//")) return "";
    return redirectedPath;
  } catch {
    return "";
  }
}

export function getAppPath() {
  const storedRedirect = readStoredSpaRedirect();
  if (storedRedirect) {
    window.history.replaceState(null, "", toBrowserPath(storedRedirect));
    return storedRedirect;
  }

  const hashRoute = window.location.hash.startsWith("#/") ? window.location.hash.slice(1) : "";
  if (hashRoute) {
    window.history.replaceState(null, "", toBrowserPath(hashRoute));
    return hashRoute;
  }

  const basePath = normalizedBasePath === "/" ? "" : normalizedBasePath.replace(/\/$/, "");
  let pathname = window.location.pathname || "/";

  if (basePath && (pathname === basePath || pathname.startsWith(`${basePath}/`))) {
    pathname = pathname.slice(basePath.length) || "/";
  }

  if (!pathname.startsWith("/")) pathname = `/${pathname}`;

  return `${pathname}${window.location.search}`;
}

export function getAppPathname(path = getAppPath()) {
  const pathname = path.split("?")[0] || "/";
  return pathname === "/" ? pathname : pathname.replace(/\/+$/, "") || "/";
}

export function toBrowserPath(path: string) {
  const appPath = path || "/";
  const normalizedPath = appPath.startsWith("/") ? appPath : `/${appPath}`;
  const basePath = normalizedBasePath === "/" ? "" : normalizedBasePath.replace(/\/$/, "");

  return `${basePath}${normalizedPath}`;
}
