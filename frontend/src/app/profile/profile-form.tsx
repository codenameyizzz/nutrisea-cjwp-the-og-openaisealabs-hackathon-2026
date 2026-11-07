"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { API_BASE_URL, responseJson } from "@/lib/api";
import { ACCOUNT_UPDATED } from "@/services/account-session";
import type { AccountProfile } from "@/services/account-session";
import { profileSignature } from "@/services/onboarding-contract";
import Link from "next/link";
import { useAccountSession } from "@/context/AccountSessionContext";
import { AUTH_ROUTES } from "@/domains/auth/config/auth-routes";
import styles from "./profile.module.css";
import {
  profileFormValue,
  profilePayload,
  ALLERGY_LABELS,
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
    return <p className={styles.loading}>Loading profile...</p>;
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
  const { account } = useAccountSession();
  const [baseline] = useState(account?.profile ?? null);
  const [profile, setProfile] = useState<NutriSeaProfile>(() => {
    return account?.profile ? profileFormValue(account.profile) : EMPTY_PROFILE;
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
      const payload = profilePayload(profile, baseline);
      const token = await getToken();
      if (!token) throw new Error("Please sign in again.");
      const currentResponse = await fetch(`${API_BASE_URL}/api/users/${user.id}/health-profile`, {
        headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
      });
      const current = currentResponse.status === 404 ? null : await responseJson<AccountProfile>(currentResponse);
      if (profileSignature(current) !== profileSignature(baseline)) {
        throw new Error("Your profile changed elsewhere. Your entries have not been saved. Reload to use the latest profile.");
      }
      await responseJson(await fetch(`${API_BASE_URL}/api/users/${user.id}/health-profile`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      }));
      window.dispatchEvent(new Event(ACCOUNT_UPDATED));

      router.push(AUTH_ROUTES.PROFILE);
    } catch (error) {
      console.error("Failed to save NutriSea profile:", error);
      setErrorMessage(error instanceof Error ? error.message : "Your profile could not be saved. Your entries are still here; try again.");
      setIsSaving(false);
    }
  };

  return (
    <section className={styles.page}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>NUTRISEA PERSONALIZATION</p>
        <h1>{baseline ? "Edit your profile" : "Complete your profile"}</h1>
        <p className={styles.intro}>
          This information helps us prepare food recommendations that match
          your needs and preferences.
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>Age</span>
            <div className={styles.inputWithUnit}>
              <input
                type="number"
                min="18"
                max="100"
                required
                placeholder="Example: 25"
                value={profile.age}
                onChange={(event) => updateField("age", event.target.value)}
              />
              <span>years</span>
            </div>
          </label>

          <label className={styles.field}>
            <span>Sex</span>
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
                Select sex
              </option>
              <option value="laki-laki">Male</option>
              <option value="perempuan">Female</option>
            </select>
          </label>

          <label className={styles.field}>
            <span>Height</span>
            <div className={styles.inputWithUnit}>
              <input
                type="number"
                min="120"
                max="230"
                step="any"
                required
                placeholder="Example: 165"
                value={profile.heightCm}
                onChange={(event) => updateField("heightCm", event.target.value)}
              />
              <span>cm</span>
            </div>
          </label>

          <label className={styles.field}>
            <span>Weight</span>
            <div className={styles.inputWithUnit}>
              <input
                type="number"
                min="30"
                max="250"
                step="any"
                required
                placeholder="Example: 58"
                value={profile.weightKg}
                onChange={(event) => updateField("weightKg", event.target.value)}
              />
              <span>kg</span>
            </div>
          </label>

          <label className={styles.field}>
            <span>Occupation (optional)</span>
            <input
              type="text"
              maxLength={100}
              placeholder="Example: Student, designer"
              value={profile.occupation}
              onChange={(event) =>
                updateField("occupation", event.target.value)
              }
            />
          </label>

          <label className={styles.field}>
            <span>Health goal</span>
            <select
              required
              value={profile.goal}
              onChange={(event) =>
                updateField("goal", event.target.value as "" | Goal)
              }
            >
              <option value="" disabled>
                Select a goal
              </option>
              <option value="turun-berat-badan">Lose weight</option>
              <option value="maintain">Maintain weight</option>
              <option value="otot">Build muscle</option>
            </select>
          </label>

          <fieldset className={`${styles.field} ${styles.allergies}`}>
            <legend>Food allergies</legend>
            {[...new Set([...Object.keys(ALLERGY_LABELS), ...(baseline?.allergies || [])])].map(allergy => (
              <label key={allergy} className={styles.checkbox}>
                <input type="checkbox" checked={profile.allergies.includes(allergy)} onChange={() => toggleAllergy(allergy)} />
                {ALLERGY_LABELS[allergy] || allergy}
              </label>
            ))}
            <span className={styles.hint}>
              Select known allergies. Unchecked options are not confirmed negatives. Saved allergies remain selected until you remove them.
            </span>
          </fieldset>

          <label className={styles.field}>
            <span>Meal budget limit</span>
            <div className={styles.inputWithUnit}>
              <span>Rp</span>
              <input
                type="number"
                min="5000"
                step="1"
                required
                placeholder="Example: 30000"
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
            {isSaving ? "Saving profile..." : "Save profile"}
          </button>
          <Link className={styles.cancel} href={AUTH_ROUTES.PROFILE}>Cancel and return to profile</Link>
        </form>
      </div>
    </section>
  );
}
