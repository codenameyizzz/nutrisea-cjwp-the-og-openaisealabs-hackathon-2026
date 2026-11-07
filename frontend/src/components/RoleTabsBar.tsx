"use client";

import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { User, Store, ShieldCheck, CheckCircle2 } from "lucide-react";
import { useApp, UserAppRole } from "@/context/AppContext";

export default function RoleTabsBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { activeRole, setActiveRole, availableRoles, roleAccessLoaded, roleAccessError } = useApp();

  const handleRoleSelect = (role: UserAppRole) => {
    if (!availableRoles.includes(role)) return;
    setActiveRole(role);

    if (role === "CONSUMER") {
      if (pathname?.startsWith("/merchant") || pathname?.startsWith("/admin")) {
        router.push("/");
      }
    } else if (role === "MERCHANT") {
      if (pathname !== "/merchant") {
        router.push("/merchant");
      }
    } else if (role === "SHOPEE_ADMIN") {
      if (pathname !== "/admin") {
        router.push("/admin");
      }
    }
  };

  return (
    <div className="role-tabs-container" style={{
      backgroundColor: "#1E232A",
      borderBottom: "1px solid rgba(255,255,255,0.08)",
      padding: "8px 16px",
      fontSize: "12px",
      color: "#CBD5E1"
    }}>
      {roleAccessError && <p role="alert">{roleAccessError}</p>}
      <div className="site-container" style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "10px"
      }}>
        {/* Left: Role explanation label */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{
            fontSize: "10px",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontWeight: 700,
            color: "#94A3B8"
          }}>
            View:
          </span>
          <span style={{
            color: "#FFFFFF",
            fontWeight: 700
          }}>
            {activeRole === "CONSUMER" && "Customer"}
            {activeRole === "MERCHANT" && "Merchant"}
            {activeRole === "SHOPEE_ADMIN" && "Administrator"}
          </span>
        </div>

        {/* Right: The 3 Role Tabs */}
        <div className="role-tabs-actions" role="group" aria-label="Choose a role">
          {/* Tab 1: Customer */}
          <button
            type="button"
            onClick={() => handleRoleSelect("CONSUMER")}
            aria-pressed={activeRole === "CONSUMER"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              padding: "4px 12px",
              borderRadius: "20px",
              border: activeRole === "CONSUMER" ? "1px solid #EE4D2D" : "1px solid rgba(255,255,255,0.12)",
              backgroundColor: activeRole === "CONSUMER" ? "#EE4D2D" : "rgba(255,255,255,0.04)",
              color: "#FFFFFF",
              fontWeight: activeRole === "CONSUMER" ? 700 : 500,
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
          >
            <User size={13} />
            <span>Customer</span>
            {activeRole === "CONSUMER" && <CheckCircle2 size={12} />}
          </button>

          {/* Tab 2: Merchant */}
          <button
            type="button"
            onClick={() => availableRoles.includes("MERCHANT") ? handleRoleSelect("MERCHANT") : router.push("/merchant/register")}
            aria-pressed={activeRole === "MERCHANT"}
            disabled={!roleAccessLoaded}
            title={availableRoles.includes("MERCHANT") ? "Open merchant view" : "Register your business or check your application"}
            style={{
              opacity: roleAccessLoaded ? 1 : 0.45,
              display: "flex",
              alignItems: "center",
              gap: "5px",
              padding: "4px 12px",
              borderRadius: "20px",
              border: activeRole === "MERCHANT" ? "1px solid #10B981" : "1px solid rgba(255,255,255,0.12)",
              backgroundColor: activeRole === "MERCHANT" ? "#10B981" : "rgba(255,255,255,0.04)",
              color: "#FFFFFF",
              fontWeight: activeRole === "MERCHANT" ? 700 : 500,
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
          >
            <Store size={13} />
            <span>{availableRoles.includes("MERCHANT") ? "Merchant" : "Become a merchant"}</span>
            {activeRole === "MERCHANT" && <CheckCircle2 size={12} />}
          </button>

          {/* Tab 3: Admin */}
          <button
            type="button"
            onClick={() => handleRoleSelect("SHOPEE_ADMIN")}
            aria-pressed={activeRole === "SHOPEE_ADMIN"}
            disabled={!roleAccessLoaded || !availableRoles.includes("SHOPEE_ADMIN")}
            title={availableRoles.includes("SHOPEE_ADMIN") ? "Open admin view" : "An administrator must grant access"}
            style={{
              opacity: availableRoles.includes("SHOPEE_ADMIN") ? 1 : 0.45,
              display: "flex",
              alignItems: "center",
              gap: "5px",
              padding: "4px 12px",
              borderRadius: "20px",
              border: activeRole === "SHOPEE_ADMIN" ? "1px solid #3B82F6" : "1px solid rgba(255,255,255,0.12)",
              backgroundColor: activeRole === "SHOPEE_ADMIN" ? "#3B82F6" : "rgba(255,255,255,0.04)",
              color: "#FFFFFF",
              fontWeight: activeRole === "SHOPEE_ADMIN" ? 700 : 500,
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
          >
            <ShieldCheck size={13} />
            <span>Admin</span>
            {activeRole === "SHOPEE_ADMIN" && <CheckCircle2 size={12} />}
          </button>

          {/* Onboarding Wizard Link */}
          <button
            type="button"
            onClick={() => router.push("/onboarding?change=true")}
            title="Change your role selection"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 10px",
              borderRadius: "20px",
              border: "1px dashed rgba(255,255,255,0.25)",
              backgroundColor: "rgba(255,255,255,0.03)",
              color: "#94A3B8",
              fontSize: "11px",
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
          >
            <span>Role guide</span>
          </button>
        </div>
      </div>
    </div>
  );
}
