"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ACCOUNT_UPDATED, initializeAccountSession, type AccountSnapshot } from "@/services/account-session";
import { AccountSessionContext } from "@/context/AccountSessionContext";
import { AUTH_ROUTES } from "@/domains/auth/config/auth-routes";
import styles from "@/app/auth.module.css";

export interface AccountSessionProps {
  children: ReactNode; isLoaded: boolean; isSignedIn: boolean | undefined;
  sessionId: string | null | undefined; userId: string | null | undefined;
  getToken: (options: { skipCache: boolean }) => Promise<string | null>;
  pathname: string | null; router: { replace: (path: string) => void; refresh: () => void };
  initialize?: typeof initializeAccountSession;
  onSignOut?: () => Promise<unknown>;
  initializationTimeoutMs?: number;
}

export default function AccountSessionController({ children, isLoaded, isSignedIn, sessionId, userId, getToken,
  pathname, router, initialize = initializeAccountSession, onSignOut, initializationTimeoutMs = 20000 }: AccountSessionProps) {
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
    let timer: ReturnType<typeof setTimeout>;
    const runBootstrap = async () => {
      try {
        const result = await Promise.race([
          initialize(userId, getToken, fetch, controller.signal),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              controller.abort();
              reject(new Error("The account setup service has not responded. Please try again."));
            }, initializationTimeoutMs);
          }),
        ]);
        if (cancelled) return;
        setSnapshot({ userId, account: result.account });
        setFailure(null);
        if (result.needsPersona) router.replace(AUTH_ROUTES.PERSONA_SELECTION);
        else router.refresh();
        setReadySessionId(sessionId);
      } catch (error) {
        if (!cancelled) setFailure({ sessionId, message: error instanceof Error ? error.message : "Account setup failed." });
      } finally {
        clearTimeout(timer);
      }
    };
    void runBootstrap();
    return () => { cancelled = true; controller.abort(); clearTimeout(timer); };
  }, [isLoaded, isSignedIn, sessionId, userId, getToken, router, attempt, initialize, initializationTimeoutMs]);

  if (needsBootstrap && !publicShoppingPage) {
    const error = failure?.sessionId === sessionId ? failure?.message : null;
    return <main className={styles.sessionCard} aria-busy={!error}>
      <h1>{error ? "Your profile is not ready" : "Setting up your account"}</h1>
      {error ? <>
        <p role="alert">You are signed in, but your NutriSea profile setup is incomplete. We cannot confirm whether it was saved. Try again without creating another account.</p>
        <details><summary>Error details</summary><p>{error}</p></details>
        <button className="btn-shopee-primary" onClick={() => { setFailure(null); setAttempt(current => current + 1); }}>Retry profile setup</button>
        {onSignOut && <button className={styles.secondaryButton} onClick={() => {
          void onSignOut().catch(() => setFailure({ sessionId: sessionId!, message: "Could not sign out. Please try again." }));
        }}>Sign out and sign in again</button>}
        <a href={AUTH_ROUTES.HOME}>Browse the menu for now</a>
      </> : <p role="status">Connecting your account and loading saved preferences...</p>}
    </main>;
  }
  return <AccountSessionContext.Provider key={isSignedIn ? userId : "guest"} value={{ account: isSignedIn && snapshot?.userId === userId ? snapshot?.account || null : null }}>
    {failure?.sessionId === sessionId && publicShoppingPage && <p role="alert">{failure?.message}</p>}
    {children}
  </AccountSessionContext.Provider>;
}
