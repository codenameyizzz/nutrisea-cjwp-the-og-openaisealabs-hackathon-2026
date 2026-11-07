// Next's internal request URL can use 0.0.0.0 while the browser uses localhost.
// Compare against the HTTP Host authority, not the server's bind address.
export function isSameAppOrigin(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true; // Clerk authentication is still required.
  try {
    const url = new URL(request.url);
    const authority = request.headers.get("host") || url.host;
    const expected = new URL(`${url.protocol}//${authority}`);
    const source = new URL(origin);
    return ["http:", "https:"].includes(source.protocol) && !source.username && !source.password &&
      source.origin === expected.origin;
  } catch { return false; }
}
