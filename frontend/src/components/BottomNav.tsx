"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Utensils, Scale, Camera, ShoppingBag, Store, ShieldCheck } from "lucide-react";
import { useApp } from "@/context/AppContext";

export default function BottomNav() {
  const pathname = usePathname();
  const { cartCount, activeRole, availableRoles } = useApp();

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
      ) : (
        <Link
          href={availableRoles.includes("MERCHANT") ? "/merchant" : "/merchant/register"}
          aria-current={pathname?.startsWith("/merchant") ? "page" : undefined}
          className={`nav-item-btn ${pathname?.startsWith("/merchant") ? "active" : ""}`}
        >
          <Store size={17} />
          <span>{availableRoles.includes("MERCHANT") ? "Merchant" : "Sell food"}</span>
        </Link>
      )}

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
