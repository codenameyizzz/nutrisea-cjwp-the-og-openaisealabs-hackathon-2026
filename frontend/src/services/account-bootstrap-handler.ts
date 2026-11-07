import { ensureCustomerRole, type ClerkUsers } from "./account-bootstrap";
import { isSameAppOrigin } from "./request-origin";

export async function accountBootstrapResponse(request: Request, dependencies: {
  authenticatedUserId: () => Promise<string | null>;
  users: () => Promise<ClerkUsers>;
}) {
  if (!isSameAppOrigin(request)) {
    return Response.json({ detail: "This request origin is not allowed." }, { status: 403 });
  }
  const userId = await dependencies.authenticatedUserId();
  if (!userId) return Response.json({ detail: "Please sign in first." }, { status: 401 });
  try {
    const result = await ensureCustomerRole(await dependencies.users(), userId);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ detail: "Clerk account setup failed. Please try again or contact the administrator." }, { status: 503 });
  }
}
