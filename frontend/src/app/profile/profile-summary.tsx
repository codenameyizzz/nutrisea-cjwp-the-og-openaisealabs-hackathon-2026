"use client";

import { useApp } from "@/context/AppContext";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { PencilLine } from "lucide-react";
import { AUTH_ROUTES } from "@/domains/auth/config/auth-routes";
import styles from "./profile.module.css";
import { ALLERGY_LABELS, profileFormValue } from "./profile-types";
import { useAccountSession } from "@/context/AccountSessionContext";

export default function ProfileSummary() {
  const { isLoaded, user } = useUser();
  const { availableRoles } = useApp();
  const { account } = useAccountSession();

  if (!isLoaded || !user) {
    return <p className={styles.loading}>Loading profile...</p>;
  }

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  const profile = account?.profile ? profileFormValue(account.profile) : null;
  const allergies = profile?.allergies.length
    ? profile.allergies.map((allergy) => ALLERGY_LABELS[allergy] || allergy)
    : [account?.allergy_status === "none" ? "No known food allergies" : "Not provided"];

  return (
    <section className={styles.page}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>NUTRISEA ACCOUNT</p>
        <p className={styles.intro}>
          Review your account information and health preferences.
        </p>

        <div style={{ padding: "20px 0" }}>
          <h2>Business and merchant access</h2>
          <p>Manage your business with the same account. You can still shop as a customer.</p>
          <Link href={availableRoles.includes("MERCHANT") ? "/merchant" : "/merchant/register"} className="btn-shopee-primary" style={{ display: "inline-block", marginTop: 12 }}>
            {availableRoles.includes("MERCHANT") ? "Open merchant dashboard" : "Register as a merchant / check application"}
          </Link>
        </div>
        <dl className={styles.summary}>
          <div className={styles.summarySection}>
            <h2>Account information</h2>
            <div className={styles.summaryGrid}>
              <SummaryItem
                label="Name"
                value={fullName || user.username || "Not provided"}
              />
              <SummaryItem
                label="Email"
                value={user.primaryEmailAddress?.emailAddress || "Not provided"}
              />
            </div>
          </div>

          <div className={styles.summarySection}>
            <h2>Personal details and preferences</h2>
            <Link
              className={styles.summaryEditButton}
              href={AUTH_ROUTES.PROFILE_EDIT}
            >
              <PencilLine size={16} aria-hidden="true" />
              {profile ? "Edit profile" : "Complete profile"}
            </Link>
            {profile ? (
              <div className={styles.summaryGrid}>
                <SummaryItem label="Age" value={`${profile.age} years`} />
                <SummaryItem
                  label="Sex"
                  value={
                    profile.gender === "laki-laki"
                      ? "Male"
                      : profile.gender === "perempuan"
                        ? "Female"
                        : "Not provided"
                  }
                />
                <SummaryItem
                  label="Height"
                  value={`${profile.heightCm} cm`}
                />
                <SummaryItem
                  label="Weight"
                  value={`${profile.weightKg} kg`}
                />
                <SummaryItem label="Occupation" value={profile.occupation} />
                <SummaryItem
                  label="Target"
                  value={
                    profile.goal === "turun-berat-badan"
                      ? "Lose weight"
                      : profile.goal === "otot"
                        ? "Build muscle"
                      : profile.goal === "maintain"
                        ? "Maintain weight"
                        : "Not provided"
                  }
                />
                <SummaryItem label="Allergies" value={allergies.join(", ")} />
                <SummaryItem
                  label="Meal budget limit"
                  value={`Rp ${Number(profile.mealBudget).toLocaleString("en-US")}`}
                />
              </div>
            ) : (
              <p className={styles.emptySummary}>
                Your profile is incomplete. Complete it to make NutriSea recommendations
                more relevant to you.
              </p>
            )}
          </div>
        </dl>
      </div>
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.summaryItem}>
      <dt>{label}</dt>
      <dd>{value || "Not provided"}</dd>
    </div>
  );
}
