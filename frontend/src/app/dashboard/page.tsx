import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import HomePage from "../page";
import { AUTH_ROUTES } from "@/domains/auth/config/auth-routes";
import { sessionAccess } from "@/services/session-access";

export default async function DashboardPage() {
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    redirect(AUTH_ROUTES.SIGN_IN);
  }

  // The session gate provisions missing roles and refreshes this server route.
  if (!sessionClaims?.metadata?.role) return <HomePage />;

  let access;
  try { access = sessionAccess(sessionClaims); }
  catch (error) { return <p role="alert">{error instanceof Error ? error.message : "Session verification failed."}</p>; }
  if (access.is_admin) redirect("/admin");
  if (access.can_edit_menus) redirect("/merchant");

  return <HomePage />;
}
