import { ensureCustomerRole, type ClerkUsers } from "./account-bootstrap";
import { isSameAppOrigin } from "./request-origin";

export async function accountBootstrapResponse(request: Request, dependencies: {
  authenticatedUserId: () => Promise<string | null>;
  users: () => Promise<ClerkUsers>;
}) {
  if (!isSameAppOrigin(request)) {
    return Response.json({ detail: "Asal permintaan tidak diizinkan." }, { status: 403 });
  }
  const userId = await dependencies.authenticatedUserId();
  if (!userId) return Response.json({ detail: "Silakan masuk terlebih dahulu." }, { status: 401 });
  try {
    const result = await ensureCustomerRole(await dependencies.users(), userId);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ detail: "Penyiapan akun Clerk gagal. Silakan coba lagi atau hubungi pengelola." }, { status: 503 });
  }
}
