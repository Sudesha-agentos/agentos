/** Marketing + auth forms that must render without waiting on the API. */
const OPEN_WITHOUT_API = new Set([
  "/",
  "/roi",
  "/contact",
  "/docs-code",
  "/privacy",
  "/terms",
  "/welcome",
  "/login",
  "/forgot-password",
  "/reset-password",
]);

export function opensWithoutApi(pathname) {
  if (!pathname) return false;
  const path = pathname.split("?")[0].replace(/\/+$/, "") || "/";
  return OPEN_WITHOUT_API.has(path);
}
