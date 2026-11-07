"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Utensils, Scale, Camera, ShoppingBag, Store, ShieldCheck, MessageCircle } from "lucide-react";
import { useApp } from "@/context/AppContext";

export default function BottomNav() {
  const pathname = usePathname();
  const { cartCount, activeRole, availableRoles } = useApp();

  if (pathname?.startsWith("/admin")) return (
    <nav className="app-bottom-nav" aria-label="Admin navigation">
      {[{href:"/admin",label:"Overview"},{href:"/admin/merchant-applications",label:"Applications"},{href:"/admin/ingredients",label:"Ingredients"},{href:"/",label:"Food catalog"}].map(item =>
        <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined} className={`nav-item-btn ${pathname === item.href ? "active" : ""}`}>{item.label}</Link>)}
    </nav>
  );

  return (
    <nav className="app-bottom-nav" aria-label="Main navigation">
      <Link
        href="/"
        aria-current={pathname === "/" ? "page" : undefined}
        className={`nav-item-btn ${pathname === "/" ? "active" : ""}`}
      >
        <Utensils size={17} />
        <span>Menu</span>
      </Link>

      <Link
        href="/bmi"
        aria-current={pathname === "/bmi" ? "page" : undefined}
        className={`nav-item-btn ${pathname === "/bmi" ? "active" : ""}`}
      >
        <Scale size={17} />
        <span>Nutrition</span>
      </Link>

      <Link
        href="/scanner"
        aria-current={pathname === "/scanner" ? "page" : undefined}
        className={`nav-item-btn ${pathname === "/scanner" ? "active" : ""}`}
      >
        <Camera size={17} />
        <span>Scanner</span>
      </Link>

      {activeRole === "SHOPEE_ADMIN" ? (
        <Link
          href="/admin"
        aria-current={pathname === "/admin" ? "page" : undefined}
          className={`nav-item-btn ${pathname === "/admin" ? "active" : ""}`}
        >
          <ShieldCheck size={17} color="#3B82F6" />
          <span>Admin</span>
        </Link>
      ) : pathname?.startsWith("/merchant") && pathname !== "/merchant/register" ? (
        <Link
          href={availableRoles.includes("MERCHANT") ? "/merchant" : "/merchant/register"}
          aria-current={pathname?.startsWith("/merchant") ? "page" : undefined}
          className={`nav-item-btn ${pathname?.startsWith("/merchant") ? "active" : ""}`}
        >
          <Store size={17} />
          <span>{availableRoles.includes("MERCHANT") ? "Merchant" : "Sell food"}</span>
        </Link>
      ) : <button type="button" className="nav-item-btn" onClick={() => window.dispatchEvent(new Event("nutrisea:open-assistant"))} aria-label="Ask NutriSea AI"><MessageCircle size={17} /><span>Ask NutriSea</span></button>}

      <Link
        href="/cart"
        aria-current={pathname === "/cart" ? "page" : undefined}
        className={`nav-item-btn ${pathname === "/cart" ? "active" : ""}`}
      >
        <ShoppingBag size={17} />
        <span>Cart</span>
        {cartCount > 0 && <span className="nav-cart-badge">{cartCount}</span>}
      </Link>
    </nav>
  );
}
