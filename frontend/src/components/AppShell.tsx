"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import type { MouseEvent } from "react";
import AiAssistantModal from "@/components/AiAssistantModal";
import BottomNav from "@/components/BottomNav";
import DemoBar from "@/components/DemoBar";
import RoleTabsBar from "@/components/RoleTabsBar";
import SeaBankModal from "@/components/SeaBankModal";
import ShopeeFooter from "@/components/ShopeeFooter";
import ShopeeHeader from "@/components/ShopeeHeader";
import { API_BASE_URL } from "@/lib/api";
import { AUTH_ROUTES } from "@/domains/auth/config/auth-routes";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const isAuthPage =
    pathname?.startsWith("/sign-in") ||
    pathname?.startsWith("/sign-up") ||
    pathname?.startsWith("/onboarding");

  // Automatic background sync of Clerk user to PostgreSQL app_user
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;

    const syncUser = async () => {
      try {
        const token = await getToken();
        if (!token) return;
        await fetch(`${API_BASE_URL}/api/users/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            user_id: user.id,
            name: user.fullName || user.firstName || "Pengguna NutriSea",
            email: user.primaryEmailAddress?.emailAddress || null,
            consent_health_data: true
          })
        });
      } catch (err) {
        console.warn("Auto user sync warning:", err);
      }
    };

    syncUser();
  }, [isLoaded, isSignedIn, user, getToken]);

  const handleHomeButtonClick = (event: MouseEvent<HTMLDivElement>) => {
    if (pathname !== "/" || (isLoaded && isSignedIn)) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element) || !target.closest("button")) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    router.push(AUTH_ROUTES.SIGN_IN);
  };

  if (isAuthPage) {
    // If user is on the onboarding persona questionnaire, render completely standalone & fullscreen without any headers or tabs
    if (pathname?.startsWith("/onboarding/personas")) {
      return <>{children}</>;
    }

    return (
      <div className="app-wrapper">
        {pathname?.startsWith("/onboarding") && (
          <Suspense fallback={null}>
            <RoleTabsBar />
          </Suspense>
        )}
        <main className="auth-main">{children}</main>
      </div>
    );
  }

  return (
    <div className="app-wrapper" onClickCapture={handleHomeButtonClick}>
      {/* Role Switcher Bar across all screens */}
      <Suspense fallback={null}>
        <RoleTabsBar />
      </Suspense>

      <Suspense fallback={null}>
        <ShopeeHeader />
      </Suspense>

      <main className="main-content">
        <div className="site-container">{children}</div>
      </main>

      <Suspense fallback={null}>
        <ShopeeFooter />
      </Suspense>

      <Suspense fallback={null}>
        <AiAssistantModal />
      </Suspense>

      <Suspense fallback={null}>
        <SeaBankModal />
      </Suspense>

      <Suspense fallback={null}>
        <DemoBar />
      </Suspense>

      <Suspense fallback={null}>
        <BottomNav />
      </Suspense>
    </div>
  );
}
