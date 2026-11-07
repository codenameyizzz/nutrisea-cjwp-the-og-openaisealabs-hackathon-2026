"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import AccountSessionController from "./AccountSessionController";

export default function AccountSessionGate({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, sessionId, userId, getToken } = useAuth();
  const { signOut } = useClerk();
  const router = useRouter();
  const pathname = usePathname();
  return <AccountSessionController isLoaded={!!isLoaded} isSignedIn={isSignedIn} sessionId={sessionId}
    userId={userId} getToken={getToken} router={router} pathname={pathname}
    onSignOut={() => signOut({ redirectUrl: "/sign-in" })}>{children}</AccountSessionController>;
}
