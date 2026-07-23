/**
 * Canonical public origin for auth email links (confirmation, invite,
 * password reset). NEXT_PUBLIC_APP_URL wins so emails always point at the
 * deployed domain regardless of which host served the request; the request
 * origin is the dev fallback. Never hardcode localhost.
 */
export function getAppUrl(requestOrigin?: string | null): string {
  const url = process.env.NEXT_PUBLIC_APP_URL || requestOrigin;
  if (!url) {
    throw new Error("NEXT_PUBLIC_APP_URL is not set and no request origin available");
  }
  return url.replace(/\/$/, "");
}
