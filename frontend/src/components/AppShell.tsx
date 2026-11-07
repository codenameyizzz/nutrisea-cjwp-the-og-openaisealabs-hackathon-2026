"use client";

import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import AiAssistantModal from "@/components/AiAssistantModal";
import BottomNav from "@/components/BottomNav";
import DemoBar from "@/components/DemoBar";
import RoleTabsBar from "@/components/RoleTabsBar";
import SeaBankModal from "@/components/SeaBankModal";
import ShopeeFooter from "@/components/ShopeeFooter";
import ShopeeHeader from "@/components/ShopeeHeader";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [showDemoGuide, setShowDemoGuide] = useState(false);
  const isOperationsPage = pathname?.startsWith("/admin") || (pathname?.startsWith("/merchant") && pathname !== "/merchant/register");
  const isAuthPage =
    pathname?.startsWith("/sign-in") ||
    pathname?.startsWith("/sign-up") ||
    pathname?.startsWith("/onboarding");

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
    <div className={`app-wrapper commerce-shell${isOperationsPage ? " operations-shell" : ""}${pathname === "/cart" ? " cart-shell" : ""}`}>
      <a className="skip-to-content" href="#main-content">Skip to content</a>

      <Suspense fallback={null}>
        <ShopeeHeader />
      </Suspense>

      <main id="main-content" className="main-content">
        <div className="site-container">{children}</div>
      </main>

      <Suspense fallback={null}>
        <ShopeeFooter showDemoGuide={showDemoGuide} onToggleDemo={() => setShowDemoGuide(value => !value)} showDemoToggle={!isOperationsPage} />
      </Suspense>

      {!isOperationsPage && <Suspense fallback={null}>
        <AiAssistantModal inlineTrigger={pathname === "/cart"} />
      </Suspense>}

      <Suspense fallback={null}>
        <SeaBankModal />
      </Suspense>

      {showDemoGuide && !isOperationsPage && <Suspense fallback={null}>
        <DemoBar />
      </Suspense>}

      <Suspense fallback={null}>
        <BottomNav />
      </Suspense>
    </div>
  );
}
