import "server-only";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AUTH_ROUTES } from "@/domains/auth/config/auth-routes";

export async function requireAuth() {
  const { userId } = await auth();

  if (!userId) {
    redirect(AUTH_ROUTES.SIGN_IN);
  }

  return { userId };
}
