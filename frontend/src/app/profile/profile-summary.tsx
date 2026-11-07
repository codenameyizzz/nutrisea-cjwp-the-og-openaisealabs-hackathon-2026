"use client";

import { useApp } from "@/context/AppContext";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { PencilLine } from "lucide-react";
import { AUTH_ROUTES } from "@/domains/auth/config/auth-routes";
import styles from "./profile.module.css";
import { isNutriSeaProfile } from "./profile-types";

export default function ProfileSummary() {
  const { isLoaded, user } = useUser();
  const { availableRoles } = useApp();

  if (!isLoaded || !user) {
    return <p className={styles.loading}>Memuat profil...</p>;
  }

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  const profileValue = user.unsafeMetadata.nutriSeaProfile;
  const profile = isNutriSeaProfile(profileValue) ? profileValue : null;
  const allergies = profile?.allergies.length
    ? profile.allergies.map((allergy) =>
        allergy === "kacang" ? "Kacang" : "Seafood",
      )
    : ["Tidak ada"];

  return (
    <section className={styles.page}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>AKUN NUTRISEA</p>
        <p className={styles.intro}>
          Periksa informasi akun dan preferensi kesehatanmu.
        </p>

        <div style={{ padding: "20px 0" }}>
          <h2>Usaha & akses Merchant</h2>
          <p>Kelola usaha dengan akun yang sama. Anda tetap dapat berbelanja sebagai Customer.</p>
          <Link href={availableRoles.includes("MERCHANT") ? "/merchant" : "/merchant/register"} className="btn-shopee-primary" style={{ display: "inline-block", marginTop: 12 }}>
            {availableRoles.includes("MERCHANT") ? "Buka Dashboard Merchant" : "Daftar sebagai Merchant / Cek Pengajuan"}
          </Link>
        </div>
        <dl className={styles.summary}>
          <div className={styles.summarySection}>
            <h2>Informasi akun</h2>
            <div className={styles.summaryGrid}>
              <SummaryItem
                label="Nama"
                value={fullName || user.username || "Belum diisi"}
              />
              <SummaryItem
                label="Email"
                value={user.primaryEmailAddress?.emailAddress || "Belum diisi"}
              />
            </div>
          </div>

          <div className={styles.summarySection}>
            <h2>Data diri dan preferensi</h2>
            <Link
              className={styles.summaryEditButton}
              href={AUTH_ROUTES.PROFILE_EDIT}
            >
              <PencilLine size={16} aria-hidden="true" />
              {profile ? "Edit profil" : "Lengkapi profil"}
            </Link>
            {profile ? (
              <div className={styles.summaryGrid}>
                <SummaryItem label="Usia" value={`${profile.age} tahun`} />
                <SummaryItem
                  label="Jenis kelamin"
                  value={
                    profile.gender === "laki-laki"
                      ? "Laki-laki"
                      : profile.gender === "perempuan"
                        ? "Perempuan"
                        : "Belum diisi"
                  }
                />
                <SummaryItem
                  label="Tinggi badan"
                  value={`${profile.heightCm} cm`}
                />
                <SummaryItem
                  label="Berat badan"
                  value={`${profile.weightKg} kg`}
                />
                <SummaryItem label="Pekerjaan" value={profile.occupation} />
                <SummaryItem
                  label="Target"
                  value={
                    profile.goal === "turun-berat-badan"
                      ? "Turun berat badan"
                      : profile.goal === "maintain"
                        ? "Maintain berat badan"
                        : "Belum diisi"
                  }
                />
                <SummaryItem label="Alergi" value={allergies.join(", ")} />
                <SummaryItem
                  label="Batas budget makan"
                  value={`Rp ${Number(profile.mealBudget).toLocaleString("id-ID")}`}
                />
              </div>
            ) : (
              <p className={styles.emptySummary}>
                Data profil belum diisi. Lengkapi profil agar rekomendasi
                NutriSea lebih sesuai untukmu.
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
      <dd>{value || "Belum diisi"}</dd>
    </div>
  );
}
