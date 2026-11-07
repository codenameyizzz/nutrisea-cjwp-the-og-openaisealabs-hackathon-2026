import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import HomePage from "../page";
import { AUTH_ROUTES } from "@/domains/auth/config/auth-routes";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect(AUTH_ROUTES.SIGN_IN);
  }

  const user = await currentUser();
  const mainPersona = user?.unsafeMetadata?.main_persona_id;
  if (!mainPersona) {
    redirect(AUTH_ROUTES.PERSONA_SELECTION);
  }

  return <HomePage />;
}
