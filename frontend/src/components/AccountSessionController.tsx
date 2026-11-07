"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ACCOUNT_UPDATED, initializeAccountSession, type AccountSnapshot } from "@/services/account-session";
import { AccountSessionContext } from "@/context/AccountSessionContext";
import { AUTH_ROUTES } from "@/domains/auth/config/auth-routes";

export interface AccountSessionProps {
  children: ReactNode; isLoaded: boolean; isSignedIn: boolean | undefined;
  sessionId: string | null | undefined; userId: string | null | undefined;
  getToken: (options: { skipCache: boolean }) => Promise<string | null>;
  pathname: string | null; router: { replace: (path: string) => void; refresh: () => void };
  initialize?: typeof initializeAccountSession;
}

export default function AccountSessionController({ children, isLoaded, isSignedIn, sessionId, userId, getToken,
  pathname, router, initialize = initializeAccountSession }: AccountSessionProps) {
  const publicShoppingPage = pathname === "/" || pathname === "/cart" || pathname?.startsWith("/menu/");
  const [attempt, setAttempt] = useState(0);
  const [readySessionId, setReadySessionId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<{ userId: string; account: AccountSnapshot } | null>(null);
  const [failure, setFailure] = useState<{ sessionId: string; message: string } | null>(null);
  const needsBootstrap = !!isSignedIn && readySessionId !== sessionId;
  useEffect(() => {
    const refresh = () => { setReadySessionId(null); setAttempt(current => current + 1); };
    window.addEventListener(ACCOUNT_UPDATED, refresh);
    return () => window.removeEventListener(ACCOUNT_UPDATED, refresh);
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !sessionId || !userId) return;
    let cancelled = false;
    const controller = new AbortController();
    const runBootstrap = async () => {
      try {
        const result = await initialize(userId, getToken, fetch, controller.signal);
        if (cancelled) return;
        setSnapshot({ userId, account: result.account });
        setFailure(null);
        if (result.needsPersona) router.replace(AUTH_ROUTES.PERSONA_SELECTION);
        else router.refresh();
        setReadySessionId(sessionId);
      } catch (error) {
        if (!cancelled) setFailure({ sessionId, message: error instanceof Error ? error.message : "Penyiapan akun gagal." });
      }
    };
    void runBootstrap();
    return () => { cancelled = true; controller.abort(); };
  }, [isLoaded, isSignedIn, sessionId, userId, getToken, router, attempt, initialize]);

  if (needsBootstrap && !publicShoppingPage) {
    const error = failure?.sessionId === sessionId ? failure?.message : null;
    return <main className="site-container" style={{ padding: 24 }}>
      {error ? <><p role="alert">{error}</p><button onClick={() => { setFailure(null); setAttempt(current => current + 1); }}>Coba lagi</button></>
        : <p role="status">Menyiapkan akun Customer...</p>}
    </main>;
  }
  return <AccountSessionContext.Provider key={isSignedIn ? userId : "guest"} value={{ account: isSignedIn && snapshot?.userId === userId ? snapshot?.account || null : null }}>
    {failure?.sessionId === sessionId && publicShoppingPage && <p role="alert">{failure?.message}</p>}
    {children}
  </AccountSessionContext.Provider>;
}
