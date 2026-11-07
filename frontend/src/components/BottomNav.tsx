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
    <nav className="app-bottom-nav">
      <Link
        href="/"
        className={`nav-item-btn ${pathname === "/" ? "active" : ""}`}
      >
        <Utensils size={17} />
        <span>Menu</span>
      </Link>

      <Link
        href="/bmi"
        className={`nav-item-btn ${pathname === "/bmi" ? "active" : ""}`}
      >
        <Scale size={17} />
        <span>Gizi & BMI</span>
      </Link>

      <Link
        href="/scanner"
        className={`nav-item-btn ${pathname === "/scanner" ? "active" : ""}`}
      >
        <Camera size={17} />
        <span>Scan</span>
      </Link>

      {activeRole === "SHOPEE_ADMIN" ? (
        <Link
          href="/admin"
          className={`nav-item-btn ${pathname === "/admin" ? "active" : ""}`}
        >
          <ShieldCheck size={17} color="#3B82F6" />
          <span>Admin</span>
        </Link>
      ) : (
        <Link
          href={availableRoles.includes("MERCHANT") ? "/merchant" : "/merchant/register"}
          className={`nav-item-btn ${pathname === "/merchant" ? "active" : ""}`}
        >
          <Store size={17} />
          <span>{availableRoles.includes("MERCHANT") ? "Mitra" : "Daftar Mitra"}</span>
        </Link>
      )}

      <Link
        href="/cart"
        className={`nav-item-btn ${pathname === "/cart" ? "active" : ""}`}
      >
        <ShoppingBag size={17} />
        <span>Keranjang</span>
        {cartCount > 0 && <span className="nav-cart-badge">{cartCount}</span>}
      </Link>
    </nav>
  );
}
