"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  User,
  Store,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Check
} from "lucide-react";
import { useApp, UserAppRole } from "@/context/AppContext";
import { AUTH_ROUTES } from "@/domains/auth/config/auth-routes";
import { useAccountSession } from "@/context/AccountSessionContext";

interface RoleOption {
  id: UserAppRole;
  title: string;
  badge: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  iconBg: { background: string; border: string };
  benefits: string[];
  destination: string;
  destLabel: string;
}

const ROLES: RoleOption[] = [
  {
    id: "CONSUMER",
    title: "ShopeeFood customer",
    badge: "Food choices for your preferences",
    subtitle: "For customers",
    description: "Find food for your budget, preferences, and declared allergies. Orders in this app are simulated.",
    icon: <User size={24} color="#EE4D2D" />,
    iconBg: { background: "#FFF0EB", border: "#FFD0C0" },
    benefits: [
      "Recommendations based on your profile and available nutrition information",
      "AI food estimates from photos",
      "Cart and simulated order confirmation",
      "Allergy, sodium, and dietary preference filters",
    ],
    destination: AUTH_ROUTES.PERSONA_SELECTION,
    destLabel: "Set your food preferences",
  },
  {
    id: "MERCHANT",
    title: "Food stall and restaurant partner",
    badge: "Menu and outlet management",
    subtitle: "For food stall and restaurant owners",
    description: "Manage outlets, ingredients, and menu information. Partner access follows a review of your application.",
    icon: <Store size={24} color="#00B14F" />,
    iconBg: { background: "#EBF9F1", border: "#C2EFD7" },
    benefits: [
      "Branch management and daily menu inventory",
      "Menu nutrition information and its sources",
      "Menu pricing and availability",
      "Outlet application review status",
    ],
    destination: "/merchant",
    destLabel: "Open the partner portal",
  },
  {
    id: "SHOPEE_ADMIN",
    title: "Administrator",
    badge: "Platform management and oversight",
    subtitle: "For internal operations and audit teams",
    description: "Review partner applications and manage outlet information. Available only to accounts with administrator access.",
    icon: <ShieldCheck size={24} color="#2563EB" />,
    iconBg: { background: "#EFF6FF", border: "#BFDBFE" },
    benefits: [
      "Activity summaries and demonstration data",
      "Partner application review",
      "Ingredient and menu data management",
      "Partner activity monitoring",
    ],
    destination: "/admin",
    destLabel: "Open the administrator portal",
  },
];

export default function OnboardingRolePage() {
  const { account } = useAccountSession();
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { activeRole, setActiveRole, availableRoles, roleAccessLoaded, roleAccessError } = useApp();

  const [isCheckingPersona, setIsCheckingPersona] = useState<boolean>(true);
  const [selectedRole, setSelectedRole] = useState<UserAppRole>(activeRole || "CONSUMER");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Redirect check: if user already has personas configured, re-route to home
  useEffect(() => {
    if (!isLoaded || !roleAccessLoaded) return;
    if (!user) {
      setIsCheckingPersona(false);
      return;
    }

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("change") === "true") {
        setIsCheckingPersona(false);
        return;
      }
    }

    if (account?.onboarding_complete) router.replace(AUTH_ROUTES.HOME);
    else setIsCheckingPersona(false);
  }, [isLoaded, user?.id, router, roleAccessLoaded, account]);

  useEffect(() => {
    if (roleAccessLoaded && !availableRoles.includes(selectedRole)) setSelectedRole("CONSUMER");
  }, [roleAccessLoaded, availableRoles, selectedRole]);

  const selectedConfig = ROLES.find((r) => r.id === selectedRole) || ROLES[0];

  const handleRoleSelection = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (!availableRoles.includes(selectedRole)) {
        setErrorMessage("This access has not been assigned by an administrator.");
        setIsSubmitting(false);
        return;
      }
      setActiveRole(selectedRole);

      // 4. Determine destination
      let targetPath = selectedConfig.destination;
      if (selectedRole === "CONSUMER") {
        targetPath = AUTH_ROUTES.PERSONA_SELECTION;
      }

      router.push(targetPath);
    } catch (err: unknown) {
      console.error("Failed to set role:", err);
      setErrorMessage("Your role could not be selected. Please try again.");
      setIsSubmitting(false);
    }
  };

  const userName = user?.firstName || user?.fullName || "User";

  if (isCheckingPersona) {
    return (
      <div lang="en" className="onboarding-page-container" style={{ justifyContent: "center", minHeight: "80vh", display: "flex", alignItems: "center" }}>
        <div style={{ textAlign: "center", color: "#64748B" }}>
          <div style={{
            width: 32,
            height: 32,
            border: "3px solid rgba(238,77,45,0.2)",
            borderTopColor: "#EE4D2D",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
            margin: "0 auto 12px auto"
          }} />
          <p style={{ fontSize: 13, fontWeight: 600 }}>Checking your persona and profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div lang="en" className="onboarding-page-container">
      <div className="onboarding-wrapper">
        {/* Top Branding & Progress */}
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <Image
            src="/assets/NutriSea%20by%20Shopeefood.png"
            alt="NutriSea by ShopeeFood"
            width={220}
            height={58}
            priority
            style={{ height: 46, width: "auto", objectFit: "contain" }}
          />

          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 12px",
            borderRadius: 9999,
            backgroundColor: "#FFF0EB",
            color: "#EE4D2D",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.4
          }}>
            <Sparkles size={14} />
            <span>New account setup</span>
          </div>

          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0F172A", margin: 0 }}>
            How would you like to use NutriSea?
          </h1>
          <p style={{ fontSize: 13.5, color: "#64748B", maxWidth: 620, margin: 0, lineHeight: 1.55 }}>
            Welcome, <strong style={{ color: "#0F172A" }}>{userName}</strong>! Choose how you will use NutriSea to access the features available to your role.
          </p>
        </div>

        {/* 3 Role Selection Cards */}
        {roleAccessError && <p role="alert">{roleAccessError}</p>}
        <p>New accounts can browse food. Partner and administrator access is assigned by an administrator.</p>
        {!availableRoles.includes("MERCHANT") && <p style={{ marginBottom: 20 }}><Link href="/merchant/register" className="btn-shopee-primary">Register as a partner / view application</Link></p>}
        <div className="onboarding-roles-grid" role="radiogroup" aria-label="Account role">
          {ROLES.filter((role) => availableRoles.includes(role.id)).map((role) => {
            const isSelected = selectedRole === role.id;
            return (
              <div
                key={role.id}
                role="radio"
                aria-checked={isSelected}
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === " " || event.key === "Enter") { event.preventDefault(); setSelectedRole(role.id); }
                }}
                onClick={() => setSelectedRole(role.id)}
                className={`onboarding-role-card ${isSelected ? "selected" : ""}`}
              >
                {/* Active Checkmark Pin */}
                {isSelected && (
                  <div style={{
                    position: "absolute",
                    top: 14,
                    right: 14,
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    backgroundColor: "#EE4D2D",
                    color: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 2px 6px rgba(238, 77, 45, 0.4)"
                  }}>
                    <Check size={16} strokeWidth={3} />
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* Icon & Badge */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: role.iconBg.background,
                      border: `1px solid ${role.iconBg.border}`
                    }}>
                      {role.icon}
                    </div>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.6, color: "#64748B" }}>
                        {role.subtitle}
                      </span>
                      <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", margin: 0, lineHeight: 1.25 }}>
                        {role.title}
                      </h3>
                    </div>
                  </div>

                  <div style={{
                    display: "inline-block",
                    alignSelf: "flex-start",
                    padding: "3px 8px",
                    borderRadius: 6,
                    backgroundColor: "#F1F5F9",
                    color: "#334155",
                    fontSize: 11,
                    fontWeight: 600
                  }}>
                    {role.badge}
                  </div>

                  <p style={{ fontSize: 12, color: "#64748B", lineHeight: 1.5, margin: 0 }}>
                    {role.description}
                  </p>

                  <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "#94A3B8", letterSpacing: 0.5, margin: 0 }}>
                      Main features:
                    </p>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6, fontSize: 11.5, color: "#334155" }}>
                      {role.benefits.map((benefit, i) => (
                        <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                          <CheckCircle2 size={14} color="#00B14F" style={{ flexShrink: 0, marginTop: 2 }} />
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #F1F5F9" }}>
                  <div
                    style={{
                      width: "100%",
                      padding: "9px 14px",
                      borderRadius: 10,
                      fontSize: 11.5,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      border: "none",
                      cursor: "pointer",
                      backgroundColor: isSelected ? "#EE4D2D" : "#F1F5F9",
                      color: isSelected ? "#FFFFFF" : "#475569",
                      boxShadow: isSelected ? "0 2px 6px rgba(238, 77, 45, 0.3)" : "none"
                    }}
                  >
                    <span>{isSelected ? "Role selected" : "Select this role"}</span>
                    {isSelected && <ArrowRight size={14} />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Error message if any */}
        {errorMessage && (
          <div style={{ padding: "12px 16px", backgroundColor: "#FEF2F2", border: "1px solid #F87171", borderRadius: 10, color: "#B91C1C", fontSize: 12, textAlign: "center" }}>
            {errorMessage}
          </div>
        )}

        {/* Final Confirmation Action */}
        <div style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 16,
          padding: "18px 22px",
          border: "1px solid #ECECEC",
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#94A3B8", letterSpacing: 0.5 }}>
              Selected role
            </span>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", display: "flex", alignItems: "center", gap: 8 }}>
              <span>{selectedConfig.title}</span>
              <span style={{ fontSize: 10, fontWeight: 700, backgroundColor: "#FFF0EB", color: "#EE4D2D", padding: "2px 8px", borderRadius: 9999 }}>
                {selectedRole === "CONSUMER" ? "Customer" : selectedRole === "MERCHANT" ? "Partner" : "Administrator"}
              </span>
            </div>
            <p style={{ fontSize: 11.5, color: "#64748B", margin: 0 }}>
              Next step: <strong style={{ color: "#334155" }}>{selectedConfig.destLabel}</strong>
            </p>
          </div>

          <div>
            <button
              onClick={handleRoleSelection}
              disabled={isSubmitting}
              style={{
                backgroundColor: "#EE4D2D",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 12,
                padding: "13px 30px",
                fontSize: 13.5,
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: "0 4px 12px rgba(238, 77, 45, 0.3)",
                opacity: isSubmitting ? 0.5 : 1
              }}
            >
              <span>{isSubmitting ? "Opening page..." : selectedRole === "CONSUMER" ? "Continue as a customer" : selectedConfig.destLabel}</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {/* Footer Note */}
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: "#64748B" }}>
          <p>
            You can switch using <strong>Switch role in the profile menu</strong> according to your account permissions.
          </p>
          <p style={{ color: "#94A3B8" }}>
            NutriSea by ShopeeFood • Sea Labs food recommendation system
          </p>
        </div>
      </div>
    </div>
  );
}
