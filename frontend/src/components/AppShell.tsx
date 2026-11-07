"use client";

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import AiAssistantModal from "@/components/AiAssistantModal";
import BottomNav from "@/components/BottomNav";
import DemoBar from "@/components/DemoBar";
import SeaBankModal from "@/components/SeaBankModal";
import ShopeeFooter from "@/components/ShopeeFooter";
import ShopeeHeader from "@/components/ShopeeHeader";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
        <main className="auth-main">{children}</main>
      </div>
    );
  }

  return (
    <div className="app-wrapper">
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
