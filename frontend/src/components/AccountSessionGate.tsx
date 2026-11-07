"use client";

import { useAuth } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import AccountSessionController from "./AccountSessionController";

export default function AccountSessionGate({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, sessionId, userId, getToken } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  return <AccountSessionController isLoaded={!!isLoaded} isSignedIn={isSignedIn} sessionId={sessionId}
    userId={userId} getToken={getToken} router={router} pathname={pathname}>{children}</AccountSessionController>;
}
