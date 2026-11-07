"use client";

import React from "react";
import Link from "next/link";
import { useApp } from "@/context/AppContext";

export default function ShopeeFooter({ showDemoGuide, onToggleDemo, showDemoToggle }: { showDemoGuide: boolean; onToggleDemo: () => void; showDemoToggle: boolean }) {
  const { setIsSeaBankOpen } = useApp();
  return (
    <footer className="shopee-app-footer">
      <div className="site-container">
        <div className="commerce-footer">
          <div><strong>NutriSea</strong><p>Independent hackathon prototype. Not an official ShopeeFood or SeaBank service.</p></div>
          <nav aria-label="Footer navigation">
            <Link href="/merchant/register">Become a merchant</Link>
            {showDemoToggle && <button type="button" onClick={() => setIsSeaBankOpen(true)}>Rewards demo</button>}
            {showDemoToggle && <button type="button" aria-pressed={showDemoGuide} onClick={onToggleDemo}>{showDemoGuide ? "Hide presenter guide" : "Presenter guide"}</button>}
          </nav>
        </div>
      </div>
    </footer>
  );
}
