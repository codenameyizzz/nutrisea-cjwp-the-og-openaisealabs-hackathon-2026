"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth, useUser } from "@clerk/nextjs";
import { ArrowLeft, ArrowRight, Check, Search, Sparkles } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useAccountSession } from "@/context/AccountSessionContext";
import { AUTH_ROUTES } from "@/domains/auth/config/auth-routes";
import { API_BASE_URL, responseJson } from "@/lib/api";
import { ACCOUNT_UPDATED, type AccountProfile, type AccountSnapshot } from "@/services/account-session";
import { ONBOARDING_QUESTIONS } from "@/services/onboarding-questions";
import { healthProfilePayload, needsDietaryFollowUp, profileAnswers, profileSignature, toggleDietaryNeed,
  validateOnboardingProfile, type AllergyStatus, type OnboardingProfile } from "@/services/onboarding-contract";
import { personaLabel } from "./indonesian-labels";
import styles from "./onboarding.module.css";

interface PersonaItem {
  id: string; full_name: string; archetype_code: string; archetype_name: string;
  occupation: string; work_district: string; target_lunch_budget_idr: number;
}
interface MatchResult {
  primary_archetype: { code: string; name: string; score: number; confidence_percent: number };
  main_persona: PersonaItem; side_personas: PersonaItem[];
}
const QUESTIONS = ONBOARDING_QUESTIONS.filter(question => question.id !== "q5" && question.id !== "q7");
const ALLERGENS: Record<string, string> = { kacang: "Peanuts", seafood: "Seafood", dairy: "Milk and dairy", egg: "Eggs", soy: "Soy", wheat: "Wheat" };
const PRIORITIES: Record<string, string> = {
  CORP_OVERLOADED: "Convenient meals for a busy routine", PREVENTIVE_HEALTH: "Balanced nutrition",
  BUDGET_FITNESS: "Protein and fitness within your budget", DIGESTIVE_GERD: "Gentle food choices",
};
const ACTIVITY_ANSWERS: Record<string, string> = { SEDENTARY: "Mostly sitting; little planned exercise", LIGHT: "Light activity or occasional exercise", MODERATE: "Moderate activity or regular exercise", ACTIVE: "Very active or frequent intense exercise" };
function initialProfile(saved: AccountProfile | null): OnboardingProfile {
  return { age: saved ? String(saved.age) : "", gender: saved ? saved.sex === "F" ? "perempuan" : "laki-laki" : "",
    heightCm: saved ? String(saved.height_cm) : "", weightKg: saved ? String(saved.weight_kg) : "", occupation: saved?.occupation || "",
    goal: saved?.goal === "LOSE_WEIGHT" ? "turun-berat-badan" : saved?.goal === "GAIN_MUSCLE" ? "otot" : "maintain",
    allergies: [...(saved?.allergies || [])], mealBudget: saved ? String(saved.meal_budget_idr) : "35000" };
}

export default function PersonaOnboardingPage() {
  const { account } = useAccountSession();
  if (!account) return <main className={styles.page}><p role="status">Preparing your account profile...</p></main>;
  return <OnboardingForm key={account.user.id} account={account} />;
}

function OnboardingForm({ account }: { account: AccountSnapshot }) {
  const router = useRouter();
  const { getToken } = useAuth();
  const { user } = useUser();
  const { updateBmi } = useApp();
  const [view, setView] = useState<"PROFILE" | "QUIZ" | "RESULT" | "CATALOG">("PROFILE");
  const [profile, setProfile] = useState(() => initialProfile(account.profile));
  const baseline = useRef(account.profile);
  const [allergyStatus, setAllergyStatus] = useState<AllergyStatus>(account.allergy_status || (account.profile?.allergies.length ? "reported" : ""));
  const [dietaryNeeds, setDietaryNeeds] = useState<string[]>(account.dietary_needs || []);
  const [answers, setAnswers] = useState<Record<string, string>>({
    q3_followup: account.dietary_guidance === "professional" ? "Guidance from a healthcare professional" : account.dietary_guidance === "personal" ? "Personal preference" : account.dietary_guidance === "undisclosed" ? "Prefer not to say" : "",
    q6: account.profile ? ACTIVITY_ANSWERS[account.profile.activity_level] || "Not sure" : "",
  });
  const [step, setStep] = useState(0);
  const [followUp, setFollowUp] = useState(false);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [mainId, setMainId] = useState<string | null>(null);
  const [sideIds, setSideIds] = useState<string[]>([]);
  const [personas, setPersonas] = useState<PersonaItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [district, setDistrict] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const question = QUESTIONS[step];
  const followUpRequired = needsDietaryFollowUp(dietaryNeeds);
  const totalSteps = QUESTIONS.length + (followUpRequired ? 1 : 0);
  const visibleStep = step + 1 + (followUp || step > 2 && followUpRequired ? 1 : 0);
  const selectedMain = personas.find(persona => persona.id === mainId) || match?.main_persona;
  const selectedSides = sideIds.map(id => personas.find(persona => persona.id === id) || match?.side_personas.find(persona => persona.id === id)).filter((persona): persona is PersonaItem => !!persona);
  const dietaryLabels = dietaryNeeds.map(value => ONBOARDING_QUESTIONS[2].options.find(option => option.value === value)?.label || value);

  useEffect(() => {
    if (account.onboarding_complete && new URLSearchParams(window.location.search).get("change") !== "true") router.replace(AUTH_ROUTES.HOME);
  }, [account.onboarding_complete, router]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    heading.current?.focus({ preventScroll: true });
  }, [view, step, followUp]);

  const filteredPersonas = useMemo(() => personas.filter(persona =>
    (!district || persona.work_district === district) && [persona.full_name, persona.archetype_name, persona.occupation, persona.work_district,
      personaLabel(persona.occupation), PRIORITIES[persona.archetype_code]].some(value => value?.toLocaleLowerCase("en").includes(search.toLocaleLowerCase("en")))
  ), [personas, district, search]);

  function updateProfile<K extends keyof OnboardingProfile>(key: K, value: OnboardingProfile[K]) {
    setProfile(current => ({ ...current, [key]: value }));
  }
  function submitProfile(event: FormEvent) {
    event.preventDefault();
    const invalid = validateOnboardingProfile(profile, allergyStatus);
    if (invalid) { setError(invalid); return; }
    setError(null); setView("QUIZ"); setStep(0); setFollowUp(false);
  }
  function back() {
    setError(null);
    if (followUp) setFollowUp(false);
    else if (step === 3 && followUpRequired) { setStep(2); setFollowUp(true); }
    else if (step > 0) setStep(current => current - 1);
    else setView("PROFILE");
  }
  async function next() {
    if (busy) return;
    const answered = followUp ? answers.q3_followup : question.id === "q3" ? dietaryNeeds.length > 0 : answers[question.id];
    if (!answered) { setError("Select an answer before continuing. You can choose not to answer where that option is available."); return; }
    setError(null);
    if (followUp) { setFollowUp(false); setStep(3); }
    else if (question.id === "q3" && followUpRequired) setFollowUp(true);
    else if (step < QUESTIONS.length - 1) setStep(current => current + 1);
    else await computeMatch();
  }
  async function computeMatch() {
    setBusy(true); setError(null);
    const derived = profileAnswers(profile);
    try {
      const result = await responseJson<MatchResult>(await fetch(`${API_BASE_URL}/api/personas/match`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q1_goal: answers.q1, q2_concern: answers.q2, q3_dietary_needs: dietaryNeeds.join(" "),
          q3_follow_up: followUpRequired ? answers.q3_followup : "", q4_lunch_priority: answers.q4,
          q5_budget: derived.q5, q6_activity: answers.q6, q7_age_range: derived.q7, q8_difficulty: answers.q8 })
      }));
      if (!result.main_persona?.id || !Array.isArray(result.side_personas)) throw new Error("The matching result is incomplete.");
      setMatch(result); setMainId(result.main_persona.id); setSideIds(result.side_personas.map(persona => persona.id)); setView("RESULT");
    } catch { setError("Matching failed and your profile has not been saved. Your answers are still here; select Try again."); }
    finally { setBusy(false); }
  }
  async function openCatalog() {
    setView("CATALOG"); setError(null);
    if (catalogLoaded) return;
    setCatalogLoading(true);
    try {
      const result = await responseJson<PersonaItem[]>(await fetch(`${API_BASE_URL}/api/personas?limit=120`));
      if (!Array.isArray(result)) throw new Error("Invalid catalog response");
      setPersonas(result); setCatalogLoaded(true);
    } catch { setError("The catalog could not be loaded. Your entries are still on this page."); }
    finally { setCatalogLoading(false); }
  }
  function toggleSide(id: string) {
    if (sideIds.includes(id)) setSideIds(current => current.filter(value => value !== id));
    else if (sideIds.length < 3) { setSideIds(current => [...current, id]); setError(null); }
    else setError("You have already selected three additional priorities. Remove one before adding another.");
  }
  async function save() {
    if (!mainId || busy) return;
    const invalid = validateOnboardingProfile(profile, allergyStatus);
    if (invalid) { setError(invalid); setView("PROFILE"); return; }
    setBusy(true); setError(null);
    try {
      const token = await getToken();
      if (!user?.id || user.id !== account.user.id || !token) throw new Error("Your account session changed. Sign in again; your profile has not been saved.");
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
      const currentResponse = await fetch(`${API_BASE_URL}/api/users/${user.id}/health-profile`, { headers, cache: "no-store" });
      const current = currentResponse.status === 404 ? null : await responseJson<AccountProfile>(currentResponse);
      if (profileSignature(current) !== profileSignature(baseline.current)) throw new Error("Your profile was updated elsewhere. These entries have not been saved. Reload the page to use the latest data.");
      await responseJson(await fetch(`${API_BASE_URL}/api/personas/users/${user.id}/assign`, {
        method: "POST", headers,
        body: JSON.stringify({ main_persona_id: mainId, side_persona_ids: sideIds,
          name: user.fullName || user.firstName || "NutriSea user", email: user.primaryEmailAddress?.emailAddress || null,
          profile: healthProfilePayload(profile, allergyStatus, answers.q6 || "", baseline.current),
          dietary_needs: dietaryNeeds.length ? dietaryNeeds : null,
          dietary_guidance: followUpRequired ? answers.q3_followup === "Guidance from a healthcare professional" ? "professional" : answers.q3_followup === "Personal preference" ? "personal" : "undisclosed" : null,
          allergy_status: allergyStatus || null })
      }));
      updateBmi(Number(profile.heightCm), Number(profile.weightKg), profile.goal === "turun-berat-badan" ? "turun" : profile.goal === "otot" ? "otot" : "ideal");
      window.dispatchEvent(new Event(ACCOUNT_UPDATED));
      router.push(AUTH_ROUTES.HOME);
    } catch (failure) {
      setError(failure instanceof Error ? `${failure.message} Your choices are still on this page.` : "Saving failed. Your choices are still here; please try again.");
    } finally { setBusy(false); }
  }

  return <main lang="en" className={styles.page}>
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <Image src="/assets/NutriSea%20by%20Shopeefood.png" alt="NutriSea by ShopeeFood" width={180} height={48} priority style={{ maxWidth: "100%", height: "auto", objectFit: "contain" }} />
        <span className={styles.progressText}>{view === "PROFILE" ? "1. Your profile" : view === "QUIZ" ? `2. Preferences · ${visibleStep} of ${totalSteps}` : view === "RESULT" ? "3. Review choices" : "Advanced options"}</span>
      </header>
      {view === "QUIZ" && <progress className={styles.progress} value={visibleStep} max={totalSteps} aria-label={`Question ${visibleStep} of ${totalSteps}`} />}
      {error && <div className={styles.error} role="alert">{error}</div>}

      {view === "PROFILE" && <section className={styles.card}>
        <p className={styles.eyebrow}>Personal profile</p>
        <h1 ref={heading} tabIndex={-1}>Complete your profile</h1>
        <p className={styles.intro}>This information helps estimate your energy needs and set your meal budget. Enter your age and budget just once.</p>
        <form onSubmit={submitProfile}>
          <div className={styles.formGrid}>
            <label>Age (years)<input type="number" min="18" max="100" required inputMode="numeric" value={profile.age} onChange={event => updateProfile("age", event.target.value)} /></label>
            <label>Sex used for energy calculations<select value={profile.gender} required onChange={event => updateProfile("gender", event.target.value as OnboardingProfile["gender"])}><option value="">Select sex</option><option value="laki-laki">Male</option><option value="perempuan">Female</option></select></label>
            <label>Height (cm)<input type="number" min="120" max="230" step="0.1" required inputMode="decimal" value={profile.heightCm} onChange={event => updateProfile("heightCm", event.target.value)} /></label>
            <label>Weight (kg)<input type="number" min="30" max="250" step="0.1" required inputMode="decimal" value={profile.weightKg} onChange={event => updateProfile("weightKg", event.target.value)} /></label>
            <label>Occupation / activity (optional)<input value={profile.occupation} maxLength={100} placeholder="Example: Office employee" onChange={event => updateProfile("occupation", event.target.value)} /></label>
            <label>Budget per meal (Rp)<input type="number" min="5000" step="1" required inputMode="numeric" value={profile.mealBudget} onChange={event => updateProfile("mealBudget", event.target.value)} /></label>
            <label className={styles.fullWidth}>Weight management goal<select value={profile.goal} onChange={event => updateProfile("goal", event.target.value as OnboardingProfile["goal"])}><option value="maintain">Maintain weight</option><option value="turun-berat-badan">Lose weight</option><option value="otot">Support muscle building</option></select></label>
          </div>
          <fieldset className={styles.fieldset}><legend>Known food allergies</legend>
            <p className={styles.help}>Select all that apply. Allergies are stored as restrictions, separately from food dislikes.</p>
            <div className={styles.chips}>{Object.entries({ ...ALLERGENS, ...Object.fromEntries(profile.allergies.filter(value => !(value in ALLERGENS)).map(value => [value, value])) }).map(([value, label]) => <label key={value} className={styles.chip}><input type="checkbox" checked={allergyStatus === "reported" && profile.allergies.includes(value)} onChange={() => { const previous = allergyStatus === "reported" ? profile.allergies : []; updateProfile("allergies", previous.includes(value) ? previous.filter(item => item !== value) : [...previous, value]); setAllergyStatus("reported"); }} />{label}</label>)}</div>
            <div className={styles.chips}>{([['none', 'No known food allergies'], ['undisclosed', 'Prefer not to answer']] as const).map(([value,label]) => <label key={value} className={styles.chip}><input type="radio" name="allergy-status" checked={allergyStatus === value} onChange={() => setAllergyStatus(value)} />{label}</label>)}</div>
            {allergyStatus === "undisclosed" && <p className={styles.help}>Not answering does not mean you have no allergies. Previously saved allergies will be kept.</p>}
          </fieldset>
          <button type="submit" className={styles.primary}>Continue to questionnaire <ArrowRight size={18} /></button>
        </form>
      </section>}

      {view === "QUIZ" && <section className={styles.card} aria-busy={busy}>
        <p className={styles.eyebrow}>{followUp ? question.followUp?.categoryBadge : question.categoryBadge}</p>
        <h1 ref={heading} tabIndex={-1}>{followUp ? question.followUp?.title : question.title}</h1>
        {question.id === "q3" && !followUp && <p className={styles.intro}>You can select more than one. These are your stated dietary needs, not a diagnosis. Allergies are recorded separately.</p>}
        {followUp && <p className={styles.intro}>Applies to: {dietaryLabels.join(" ")}</p>}
        <fieldset className={styles.answers} disabled={busy}>
          <legend className={styles.srOnly}>Answer choices</legend>
          {(followUp ? question.followUp?.options || [] : question.options).filter(option => question.id !== "q3" || option.value !== "I have a food allergy or intolerance.").map(option => {
            const multi = question.id === "q3" && !followUp;
            const selected = multi ? dietaryNeeds.includes(option.value) : (followUp ? answers.q3_followup : answers[question.id]) === option.value;
            return <label className={`${styles.answer} ${selected ? styles.selected : ""}`} key={option.value}>
              <input type={multi ? "checkbox" : "radio"} name={followUp ? "guidance" : question.id} checked={selected} onChange={() => {
                setError(null);
                if (multi) { setDietaryNeeds(current => toggleDietaryNeed(current, option.value)); }
                else setAnswers(current => ({ ...current, [followUp ? "q3_followup" : question.id]: option.value }));
              }} /><span>{option.label}</span>{selected && <Check size={20} aria-hidden="true" />}
            </label>;
          })}
        </fieldset>
        {question.id === "q6" && answers.q6 === "Not sure" && <p className={styles.help}>Calculations use your saved activity level, or assume light activity for a new profile. You can change this on the nutrition page.</p>}
        <div className={styles.actions}><button type="button" className={styles.secondary} onClick={back} disabled={busy}><ArrowLeft size={18} />Back</button>
          <button type="button" className={styles.primary} onClick={() => void next()} disabled={busy}>{busy ? "Matching your choices..." : step === QUESTIONS.length - 1 ? error ? "Try again" : "See my choices" : "Continue"}<ArrowRight size={18} /></button></div>
        <div className={styles.summaryLine}>Age: {profile.age} years · Budget: Rp{Number(profile.mealBudget).toLocaleString("en-US")} <button type="button" className={styles.textButton} onClick={() => setView("PROFILE")} disabled={busy}>Edit details</button></div>
        <button type="button" className={styles.textButton} onClick={() => void openCatalog()} disabled={busy}>Advanced options: explore sample personas</button>
      </section>}

      {view === "RESULT" && selectedMain && <section className={styles.card}>
        <p className={styles.eyebrow}><Sparkles size={16} /> Review before saving</p>
        <h1 ref={heading} tabIndex={-1}>Your food preference profile</h1>
        <p className={styles.intro}>These initial recommendations are based on your answers. You can change your preferences at any time.</p>
        <div className={styles.priority}><span>Main priority</span><h2>{PRIORITIES[selectedMain.archetype_code] || personaLabel(selectedMain.archetype_name)}</h2></div>
        <p className={styles.help}>Personas are recommendation templates, not your identity or a diagnosis. These choices have not been saved yet.</p>
        {selectedSides.length > 0 && <><h2 className={styles.sectionTitle}>Your additional priorities</h2><ul className={styles.priorities}>{selectedSides.map(persona => <li key={persona.id}>{PRIORITIES[persona.archetype_code] || personaLabel(persona.archetype_name)}</li>)}</ul></>}
        <dl className={styles.details}><div><dt>Budget per meal</dt><dd>Rp{Number(profile.mealBudget).toLocaleString("en-US")}</dd></div>
          <div><dt>Declared allergies</dt><dd>{allergyStatus === "undisclosed" ? "Not answered; previously saved allergies will be kept" : allergyStatus === "none" ? "No known food allergies" : profile.allergies.map(value => ALLERGENS[value] || value).join(", ")}</dd></div>
          <div><dt>Dietary needs</dt><dd>{dietaryLabels.length ? dietaryLabels.join(" ") : "Not answered"}</dd></div></dl>
        <p className={styles.help}>Dietary needs are stored as information you provide. This does not guarantee that every menu meets nutrient limits or is free of allergens; check menu information and confirm with the seller.</p>
        <div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => { setView("QUIZ"); setStep(0); }} disabled={busy}>Edit preferences</button><button type="button" className={styles.primary} onClick={() => void save()} disabled={busy}>{busy ? "Saving profile..." : "Start browsing food"}<ArrowRight size={18} /></button></div>
        <button type="button" className={styles.textButton} onClick={() => void openCatalog()} disabled={busy}>Change your template in the catalog</button>
      </section>}

      {view === "CATALOG" && <section className={styles.card}>
        <p className={styles.eyebrow}>Advanced feature · optional</p><h1 ref={heading} tabIndex={-1}>Explore sample personas</h1>
        <p className={styles.intro}>Choose one main template and up to three supporting templates. Catalog names represent sample personas, not real user profiles.</p>
        <div className={styles.filters}><label><span><Search size={16} /> Search personas</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, priority, occupation..." /></label><label>Area<select value={district} onChange={event => setDistrict(event.target.value)}><option value="">All areas</option>{Array.from(new Set(personas.map(persona => persona.work_district))).sort().map(value => <option key={value}>{value}</option>)}</select></label></div>
        <p role="status" className={styles.help}>{catalogLoading ? "Loading catalog..." : `${filteredPersonas.length} samples found. ${sideIds.length} of 3 supporting templates selected.`}</p>
        {selectedMain && <p className={styles.selection}>Main: {selectedMain.full_name}. Supporting: {selectedSides.map(persona => persona.full_name).join(", ") || "Not selected"}.</p>}
        {!catalogLoading && !catalogLoaded && <button type="button" className={styles.secondary} onClick={() => void openCatalog()}>Try loading the catalog again</button>}
        {catalogLoaded && filteredPersonas.length === 0 && <p>No samples match your search. Try another term or select all areas.</p>}
        <ul className={styles.catalog}>{filteredPersonas.map(persona => <li key={persona.id} className={mainId === persona.id ? styles.catalogSelected : ""}><div><h2>{persona.full_name}</h2><p>{PRIORITIES[persona.archetype_code] || personaLabel(persona.archetype_name)}</p><small>{personaLabel(persona.occupation)} · {persona.work_district}</small></div><div className={styles.catalogActions}><button type="button" className={styles.secondary} aria-pressed={mainId === persona.id} onClick={() => { setMainId(persona.id); setSideIds(current => current.filter(id => id !== persona.id)); }}>{mainId === persona.id ? "Main selected" : "Select main"}</button><button type="button" className={styles.secondary} disabled={mainId === persona.id} aria-pressed={sideIds.includes(persona.id)} onClick={() => toggleSide(persona.id)}>{sideIds.includes(persona.id) ? "Remove supporting" : "+ Supporting"}</button></div></li>)}</ul>
        <div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => { setError(null); setView("QUIZ"); }}>Back to questionnaire</button><button type="button" className={styles.primary} disabled={!mainId} onClick={() => setView("RESULT")}>Review choices <ArrowRight size={18} /></button></div>
      </section>}
    </div>
  </main>;
}
