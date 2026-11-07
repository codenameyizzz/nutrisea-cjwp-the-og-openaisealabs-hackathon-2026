"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";
import {
  MapPin,
  Utensils,
  ShoppingBag,
  Wallet,
  Search,
  Scale,
  Camera,
  ChevronDown,
  Store,
  ShieldCheck,
  LogOut,
  UserRound
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { AUTH_ROUTES } from "@/domains/auth/config/auth-routes";

export default function ShopeeHeader() {
  const pathname = usePathname();
  const { cartCount, setIsSeaBankOpen, searchQuery, setSearchQuery, logUserAction, availableRoles } = useApp();
  const { signOut } = useClerk();
  const { user } = useUser();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!profileRef.current?.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    setSignOutError(null);

    try {
      await signOut({ redirectUrl: "/sign-in" });
    } catch (error) {
      console.error("Clerk sign-out failed:", error);
      setSignOutError("Keluar gagal. Silakan coba lagi.");
      setIsSigningOut(false);
    }
  };

  return (
    <header className="shopee-navbar">
      {/* Top Main Row */}
      <div className="site-container">
        <div className="navbar-top-row">
          {/* Logo: NutriSea by Shopeefood with white stroke */}
          <div className="navbar-brand-group">
            <Link href="/" className="navbar-brand-logo" aria-label="NutriSea by ShopeeFood Home">
              <img
                src="/assets/NutriSea%20by%20Shopeefood.png"
                alt="NutriSea by ShopeeFood"
                className="navbar-brand-img"
              />
            </Link>
          </div>

          {/* Iconic Shopee Search Bar with Button */}
          <div className="navbar-search-bar">
            <input
              type="text"
              placeholder="Cari menu sehat, warteg terdekat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchQuery.trim().length >= 2) {
                  logUserAction("SEARCH_QUERY", { query: searchQuery.trim() });
                }
              }}
            />
            <button
              className="search-submit-btn"
              aria-label="Cari"
              onClick={() => {
                if (searchQuery.trim().length >= 2) {
                  logUserAction("SEARCH_QUERY", { query: searchQuery.trim() });
                }
              }}
            >
              <Search size={15} color="#FFFFFF" />
            </button>
          </div>

          {/* Clean Desktop Navigation Links */}
          <nav className="desktop-nav-links">
            <Link
              href="/"
              className={`desktop-nav-link ${pathname === "/" ? "active" : ""}`}
            >
              <Utensils size={14} /> Menu Sehat
            </Link>

            <Link
              href="/bmi"
              className={`desktop-nav-link ${pathname === "/bmi" ? "active" : ""}`}
            >
              <Scale size={14} /> Gizi & BMI
            </Link>

            <Link
              href="/scanner"
              className={`desktop-nav-link ${pathname === "/scanner" ? "active" : ""}`}
            >
              <Camera size={14} /> Scan Camilan
            </Link>

            <Link
              href="/cart"
              className={`desktop-nav-link ${pathname === "/cart" ? "active" : ""}`}
            >
              <ShoppingBag size={14} /> Keranjang
              {cartCount > 0 && <span className="desktop-cart-badge">{cartCount}</span>}
            </Link>

            <Link
              href={availableRoles.includes("MERCHANT") ? "/merchant" : "/merchant/register"}
              className={`desktop-nav-link ${pathname === "/merchant" ? "active" : ""}`}
              style={{
                backgroundColor: pathname === "/merchant" ? "#FFFFFF" : "rgba(255,255,255,0.18)",
                color: pathname === "/merchant" ? "#EE4D2D" : "#FFFFFF",
                borderRadius: "4px",
                padding: "3px 8px",
                fontWeight: 600
              }}
            >
              <Store size={14} /> {availableRoles.includes("MERCHANT") ? "Portal Mitra" : "Daftar sebagai Merchant"}
            </Link>

            <Link
              href="/admin"
              className={`desktop-nav-link ${pathname === "/admin" ? "active" : ""}`}
              style={{
                backgroundColor: pathname === "/admin" ? "#3B82F6" : "rgba(59, 130, 246, 0.25)",
                color: "#FFFFFF",
                borderRadius: "4px",
                padding: "3px 8px",
                fontWeight: 600,
                border: "1px solid rgba(255,255,255,0.2)"
              }}
            >
              <ShieldCheck size={14} /> Shopee Admin
            </Link>
          </nav>

          <div className="desktop-nav-profile" ref={profileRef}>
            <button
              type="button"
              className="desktop-nav-profile-trigger"
              aria-expanded={isProfileOpen}
              aria-haspopup="dialog"
              aria-label="Profil"
              onClick={() => setIsProfileOpen((isOpen) => !isOpen)}
            >
              {user?.imageUrl ? (
                <img
                  className="desktop-nav-profile-avatar"
                  src={user.imageUrl}
                  alt=""
                />
              ) : (
                <UserRound size={15} />
              )}
              <span className="desktop-nav-profile-label">Profil</span>
              <ChevronDown className="desktop-nav-profile-chevron" size={13} />
            </button>

            {isProfileOpen && (
              <section
                className="desktop-nav-profile-menu"
                aria-label="Menu profil"
              >
                <Link
                  href={AUTH_ROUTES.PROFILE}
                  className="desktop-nav-profile-detail"
                  onClick={() => setIsProfileOpen(false)}
                >
                  <UserRound size={14} />
                  Lihat detail profil
                </Link>

                {signOutError && (
                  <p className="desktop-nav-signout-error" role="alert">
                    {signOutError}
                  </p>
                )}

                <button
                  type="button"
                  className="desktop-nav-signout"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                >
                  <LogOut size={14} />
                  {isSigningOut ? "Keluar..." : "Keluar"}
                </button>
              </section>
            )}
          </div>
        </div>
      </div>

      {/* Sub-bar Location & Wallet */}
      <div className="navbar-sub-bar">
        <div className="site-container sub-bar-inner">
          <div className="sub-bar-location">
            <MapPin size={11} color="#FFFFFF" />
            <span className="sub-bar-location-text">Kirim ke: SCBD / Kuningan, Jakarta Selatan</span>
            <ChevronDown size={10} color="#FFFFFF" />
          </div>

          <div className="sub-bar-wallet-items">
            <div className="sub-bar-wallet-item">
              <Wallet size={11} />
              <span>ShopeePay: <strong>Rp 124.500</strong></span>
            </div>
            <div
              className="sub-bar-wallet-item"
              style={{ color: "#FFEAE4", cursor: "pointer" }}
              onClick={() => setIsSeaBankOpen(true)}
              title="Klik untuk membuka Tabungan & Reward SeaBank Wellness"
            >
              <span>SeaBank Sehat: <strong>+Rp 45.000</strong></span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
