import { sessionAccess } from "./session-access";

export interface ClerkUsers {
  getUser(userId: string): Promise<{ publicMetadata: Record<string, unknown>; firstName?: string | null;
    lastName?: string | null; primaryEmailAddress?: { emailAddress: string } | null }>;
  updateUserMetadata(userId: string, data: { publicMetadata: { role: "CONSUMER" } }): Promise<unknown>;
}

// Called only on the server with the user ID from Clerk auth(), never a request body.
export async function ensureCustomerRole(users: ClerkUsers, userId: string) {
  const user = await users.getUser(userId);
  const account = { user_id: userId, name: [user.firstName, user.lastName].filter(Boolean).join(" ") || "NutriSea user",
    email: user.primaryEmailAddress?.emailAddress || null };
  const role = user.publicMetadata.role;
  if (role !== undefined && role !== null && role !== "") {
    sessionAccess({ metadata: user.publicMetadata });
    return { role, initialized: false, account };
  }
  // Partial metadata merge preserves other fields and merchant ownership.
  await users.updateUserMetadata(userId, { publicMetadata: { role: "CONSUMER" } });
  return { role: "CONSUMER", initialized: true, account };
}

export function refreshedSessionAccess(token: string | null, userId: string) {
  if (!token) throw new Error("Your session is unavailable. Please sign in again.");
  try {
    // This decode checks UI readiness only. The backend verifies the signature.
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(payload));
    if (claims.sub !== userId || !claims.metadata?.role) throw new Error();
    return sessionAccess(claims);
  } catch {
    throw new Error("Your role was checked in Clerk, but session metadata is unavailable. Check the custom session claims and try again.");
  }
}
