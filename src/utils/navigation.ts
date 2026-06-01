const rawBasePath = import.meta.env.BASE_URL || "/";
const normalizedBasePath = rawBasePath.endsWith("/") ? rawBasePath : `${rawBasePath}/`;

export function getAppPath() {
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
