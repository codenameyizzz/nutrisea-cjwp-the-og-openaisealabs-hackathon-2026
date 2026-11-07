"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { API_BASE_URL } from "@/lib/api";
import { AUTH_ROUTES } from "@/domains/auth/config/auth-routes";
import styles from "./profile.module.css";
import {
  isNutriSeaProfile,
  type Allergy,
  type Goal,
  type NutriSeaProfile,
} from "./profile-types";

const EMPTY_PROFILE: NutriSeaProfile = {
  age: "",
  gender: "",
  heightCm: "",
  weightKg: "",
  occupation: "",
  goal: "",
  allergies: [],
  mealBudget: "",
};

export default function ProfileForm() {
  const { isLoaded, user } = useUser();

  if (!isLoaded || !user) {
    return <p className={styles.loading}>Memuat profil...</p>;
  }

  return <ProfileEditor key={user.id} user={user} />;
}

function ProfileEditor({
  user,
}: {
  user: NonNullable<ReturnType<typeof useUser>["user"]>;
}) {
  const router = useRouter();
  const { getToken } = useAuth();
  const [profile, setProfile] = useState<NutriSeaProfile>(() => {
    const savedProfile = user.unsafeMetadata.nutriSeaProfile;
    return isNutriSeaProfile(savedProfile) ? savedProfile : EMPTY_PROFILE;
  });
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const updateField = <K extends keyof NutriSeaProfile>(
    field: K,
    value: NutriSeaProfile[K],
  ) => {
    setProfile((current) => ({ ...current, [field]: value }));
  };

  const toggleAllergy = (allergy: Allergy) => {
    setProfile((current) => ({
      ...current,
      allergies: current.allergies.includes(allergy)
        ? current.allergies.filter((item) => item !== allergy)
        : [...current.allergies, allergy],
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || isSaving) {
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    try {
      await user.update({
        unsafeMetadata: {
          ...user.unsafeMetadata,
          nutriSeaProfile: profile,
        },
      });

      // Synchronize with PostgreSQL database on Aiven Cloud
      try {
        const token = await getToken();
        if (!token) throw new Error("Silakan masuk kembali.");
        await fetch(`${API_BASE_URL}/api/users/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            user_id: user.id,
            name: user.fullName || user.firstName || "NutriSea User",
            email: user.primaryEmailAddress?.emailAddress || null,
            consent_health_data: true,
          }),
        });

        await fetch(`http://127.0.0.1:8000/api/users/${user.id}/health-profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            age: Number(profile.age) || 26,
            sex: profile.gender === "laki-laki" ? "M" : "F",
            height_cm: Number(profile.heightCm) || 165,
            weight_kg: Number(profile.weightKg) || 60,
            activity_level: "LIGHT",
            goal:
              profile.goal === "turun-berat-badan"
                ? "LOSE_WEIGHT"
                : "MAINTAIN",
            allergies: profile.allergies,
            meal_budget_idr: Number(profile.mealBudget) || 35000,
            has_medical_condition: false,
            max_dinner_cut_pct: 25,
          }),
        });
      } catch (backendError) {
        console.warn("Backend PostgreSQL sync warning:", backendError);
      }

      router.push(AUTH_ROUTES.PROFILE);
    } catch (error) {
      console.error("Failed to save NutriSea profile:", error);
      setErrorMessage("Profil belum berhasil disimpan. Silakan coba lagi.");
      setIsSaving(false);
    }
  };

  return (
    <section className={styles.page}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>PERSONALISASI NUTRISEA</p>
        <h1>Lengkapi profilmu</h1>
        <p className={styles.intro}>
          Data ini membantu kami menyiapkan rekomendasi makanan yang sesuai
          dengan kebutuhan dan preferensimu.
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>Usia</span>
            <div className={styles.inputWithUnit}>
              <input
                type="number"
                min="1"
                max="120"
                required
                placeholder="Contoh: 25"
                value={profile.age}
                onChange={(event) => updateField("age", event.target.value)}
              />
              <span>tahun</span>
            </div>
          </label>

          <label className={styles.field}>
            <span>Jenis kelamin</span>
            <select
              required
              value={profile.gender}
              onChange={(event) =>
                updateField(
                  "gender",
                  event.target.value as NutriSeaProfile["gender"],
                )
              }
            >
              <option value="" disabled>
                Pilih jenis kelamin
              </option>
              <option value="laki-laki">Laki-laki</option>
              <option value="perempuan">Perempuan</option>
            </select>
          </label>

          <label className={styles.field}>
            <span>Tinggi badan</span>
            <div className={styles.inputWithUnit}>
              <input
                type="number"
                min="50"
                max="250"
                required
                placeholder="Contoh: 165"
                value={profile.heightCm}
                onChange={(event) => updateField("heightCm", event.target.value)}
              />
              <span>cm</span>
            </div>
          </label>

          <label className={styles.field}>
            <span>Berat badan</span>
            <div className={styles.inputWithUnit}>
              <input
                type="number"
                min="20"
                max="400"
                required
                placeholder="Contoh: 58"
                value={profile.weightKg}
                onChange={(event) => updateField("weightKg", event.target.value)}
              />
              <span>kg</span>
            </div>
          </label>

          <label className={styles.field}>
            <span>Pekerjaan</span>
            <input
              type="text"
              maxLength={100}
              required
              placeholder="Contoh: Mahasiswa, desainer"
              value={profile.occupation}
              onChange={(event) =>
                updateField("occupation", event.target.value)
              }
            />
          </label>

          <label className={styles.field}>
            <span>Target kesehatan</span>
            <select
              required
              value={profile.goal}
              onChange={(event) =>
                updateField("goal", event.target.value as "" | Goal)
              }
            >
              <option value="" disabled>
                Pilih target
              </option>
              <option value="turun-berat-badan">Turun berat badan</option>
              <option value="maintain">Maintain berat badan</option>
            </select>
          </label>

          <fieldset className={`${styles.field} ${styles.allergies}`}>
            <legend>Alergi makanan</legend>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={profile.allergies.includes("kacang")}
                onChange={() => toggleAllergy("kacang")}
              />
              Kacang
            </label>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={profile.allergies.includes("seafood")}
                onChange={() => toggleAllergy("seafood")}
              />
              Seafood
            </label>
            <span className={styles.hint}>
              Kosongkan jika tidak memiliki alergi tersebut.
            </span>
          </fieldset>

          <label className={styles.field}>
            <span>Batas budget makan</span>
            <div className={styles.inputWithUnit}>
              <span>Rp</span>
              <input
                type="number"
                min="1"
                step="1000"
                required
                placeholder="Contoh: 30000"
                value={profile.mealBudget}
                onChange={(event) =>
                  updateField("mealBudget", event.target.value)
                }
              />
            </div>
          </label>

          {errorMessage && (
            <p className={styles.error} role="alert">
              {errorMessage}
            </p>
          )}

          <button className={styles.submit} type="submit" disabled={isSaving}>
            {isSaving ? "Menyimpan profil..." : "Simpan dan lanjutkan"}
          </button>
        </form>
      </div>
    </section>
  );
}
