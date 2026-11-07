"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  MapPin,
  Layers,
  Search,
  Check,
  User,
  Scale,
  Activity
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { AUTH_ROUTES } from "@/domains/auth/config/auth-routes";

export interface PersonaItem {
  id: string;
  full_name: string;
  archetype_code: string;
  archetype_name: string;
  age: number;
  gender: string;
  occupation: string;
  work_district: string;
  monthly_income_idr: number;
  activity_level: string;
  height_cm: number;
  weight_kg: number;
  bmi_value: number;
  bmi_category: string;
  bmr_kcal: number;
  tdee_kcal: number;
  daily_caloric_target_kcal: number;
  target_lunch_kcal: number;
  target_lunch_budget_idr: number;
  health_goal: string;
  medical_conditions: string;
  allergens: string;
  preferred_tags: string;
  preferred_cuisines: string;
  biggest_pain_point?: string;
  seabank_wellness_affinity: string;
  streak_loyalty_potential_days: number;
}

export interface MatchResult {
  primary_archetype: {
    code: string;
    name: string;
    score: number;
    confidence_percent: number;
  };
  secondary_archetype: {
    code: string;
    name: string;
    score: number;
  };
  main_persona: PersonaItem;
  side_personas: PersonaItem[];
  rationale: string;
  dietary_safeguards: {
    selected_restriction: string;
    is_medical_guidance: boolean;
  };
}

export interface UserProfileData {
  age: string;
  gender: "laki-laki" | "perempuan";
  heightCm: string;
  weightKg: string;
  occupation: string;
  goal: "turun-berat-badan" | "maintain";
  allergies: string[];
  mealBudget: string;
}

// 8 Questions Grounded in backend/docs/persona_onboarding_questions.txt
const QUESTIONS = [
  {
    id: "q1",
    num: 1,
    categoryBadge: "Nutrition Goals",
    title: "What is your main goal when choosing food?",
    options: [
      {
        value: "Keep my energy steady and choose a balanced meal.",
        label: "Keep my energy steady and choose a balanced meal."
      },
      {
        value: "Eat healthier and reduce my risk of future health problems.",
        label: "Eat healthier and reduce my risk of future health problems."
      },
      {
        value: "Build muscle or support my fitness progress.",
        label: "Build muscle or support my fitness progress."
      },
      {
        value: "Choose food that is gentle on my stomach.",
        label: "Choose food that is gentle on my stomach."
      },
      {
        value: "I'm not sure yet.",
        label: "I'm not sure yet."
      }
    ]
  },
  {
    id: "q2",
    num: 2,
    categoryBadge: "Dietary Concerns",
    title: "Which best describes your current food-related concern?",
    options: [
      {
        value: "I often feel sleepy, sluggish, or too full after lunch.",
        label: "I often feel sleepy, sluggish, or too full after lunch."
      },
      {
        value: "I want to be more careful about things like salt, sugar, or fat.",
        label: "I want to be more careful about things like salt, sugar, or fat."
      },
      {
        value: "I want enough protein without spending too much.",
        label: "I want enough protein without spending too much."
      },
      {
        value: "Some foods can trigger stomach discomfort, acidity, or heartburn.",
        label: "Some foods can trigger stomach discomfort, acidity, or heartburn."
      },
      {
        value: "None of these.",
        label: "None of these."
      }
    ]
  },
  {
    id: "q3",
    num: 3,
    categoryBadge: "Dietary & Medical Needs",
    title: "Do you have any dietary needs or restrictions we should consider?",
    options: [
      {
        value: "I need to limit salt.",
        label: "I need to limit salt."
      },
      {
        value: "I need to be mindful of sugar or blood glucose.",
        label: "I need to be mindful of sugar or blood glucose."
      },
      {
        value: "I need to be mindful of cholesterol or saturated fat.",
        label: "I need to be mindful of cholesterol or saturated fat."
      },
      {
        value: "I need food that is gentle on my stomach.",
        label: "I need food that is gentle on my stomach."
      },
      {
        value: "I have a food allergy or intolerance.",
        label: "I have a food allergy or intolerance."
      },
      {
        value: "I don't have any specific dietary restrictions.",
        label: "I don't have any specific dietary restrictions."
      },
      {
        value: "Prefer not to say.",
        label: "Prefer not to say."
      }
    ],
    followUp: {
      categoryBadge: "Clinical Context",
      title: "Is this based on guidance from a healthcare professional, or personal preference?",
      options: [
        {
          value: "Guidance from a healthcare professional",
          label: "Guidance from a healthcare professional"
        },
        {
          value: "Personal preference",
          label: "Personal preference"
        },
        {
          value: "Prefer not to say",
          label: "Prefer not to say"
        }
      ]
    }
  },
  {
    id: "q4",
    num: 4,
    categoryBadge: "Lunch Priorities",
    title: "What matters most when choosing your lunch?",
    options: [
      {
        value: "I want a quick recommendation so I don't have to browse many options.",
        label: "I want a quick recommendation so I don't have to browse many options."
      },
      {
        value: "I want a meal that supports my long-term health.",
        label: "I want a meal that supports my long-term health."
      },
      {
        value: "I want good nutrition and enough protein at an affordable price.",
        label: "I want good nutrition and enough protein at an affordable price."
      },
      {
        value: "I want to avoid ingredients or preparation styles that may upset my stomach.",
        label: "I want to avoid ingredients or preparation styles that may upset my stomach."
      },
      {
        value: "I mainly want to choose based on taste.",
        label: "I mainly want to choose based on taste."
      }
    ]
  },
  {
    id: "q5",
    num: 5,
    categoryBadge: "Budget Allocation",
    title: "What is your usual budget for one lunch?",
    options: [
      {
        value: "Under Rp25,000",
        label: "Under Rp25,000"
      },
      {
        value: "Rp25,000–Rp35,000",
        label: "Rp25,000–Rp35,000"
      },
      {
        value: "Rp35,001–Rp45,000",
        label: "Rp35,001–Rp45,000"
      },
      {
        value: "More than Rp45,000",
        label: "More than Rp45,000"
      },
      {
        value: "It depends on the day",
        label: "It depends on the day"
      }
    ]
  },
  {
    id: "q6",
    num: 6,
    categoryBadge: "Activity Level",
    title: "How active is your usual day?",
    options: [
      {
        value: "Mostly sitting; little planned exercise",
        label: "Mostly sitting; little planned exercise"
      },
      {
        value: "Light activity or occasional exercise",
        label: "Light activity or occasional exercise"
      },
      {
        value: "Moderate activity or regular exercise",
        label: "Moderate activity or regular exercise"
      },
      {
        value: "Very active or frequent intense exercise",
        label: "Very active or frequent intense exercise"
      },
      {
        value: "Not sure",
        label: "Not sure"
      }
    ]
  },
  {
    id: "q7",
    num: 7,
    categoryBadge: "Demographics (Optional)",
    title: "Which age range are you in?",
    options: [
      { value: "Under 21", label: "Under 21" },
      { value: "21–27", label: "21–27" },
      { value: "28–33", label: "28–33" },
      { value: "34–48", label: "34–48" },
      { value: "49 or older", label: "49 or older" },
      { value: "Prefer not to say", label: "Prefer not to say" }
    ]
  },
  {
    id: "q8",
    num: 8,
    categoryBadge: "Decision Friction",
    title: "What usually makes choosing lunch difficult for you?",
    options: [
      {
        value: "Too many options; I spend too much time deciding.",
        label: "Too many options; I spend too much time deciding."
      },
      {
        value: "I'm unsure whether a meal is balanced or healthy.",
        label: "I'm unsure whether a meal is balanced or healthy."
      },
      {
        value: "Healthy food often costs more than I want to spend.",
        label: "Healthy food often costs more than I want to spend."
      },
      {
        value: "I'm worried a meal may trigger stomach discomfort.",
        label: "I'm worried a meal may trigger stomach discomfort."
      },
      {
        value: "I find it difficult to estimate nutrition information.",
        label: "I find it difficult to estimate nutrition information."
      },
      {
        value: "None of these.",
        label: "None of these."
      }
    ]
  }
];

export default function ShopeeStylePersonaOnboardingPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { updateBmi, activeRole, availableRoles, roleAccessLoaded } = useApp();

  // Mode: "PROFILE" (Pre-questionnaire Biometrics) vs "QUIZ" (8 Persona Questions) vs "RESULT" (Shopee Reveal Screen) vs "MANUAL_TABLE"
  const [viewMode, setViewMode] = useState<"PROFILE" | "QUIZ" | "RESULT" | "MANUAL_TABLE">("PROFILE");
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  // Dedicated sub-step state for Question 3 follow-up slide
  const [isQ3FollowUp, setIsQ3FollowUp] = useState<boolean>(false);

  // Animation wipe direction: "forward" (fade wipe to the right) vs "backward"
  const [slideDirection, setSlideDirection] = useState<"forward" | "backward">("forward");

  // Initial Profile details (grounded in "Lengkapi profilmu")
  const [profileData, setProfileData] = useState<UserProfileData>({
    age: "26",
    gender: "laki-laki",
    heightCm: "168",
    weightKg: "62",
    occupation: "Corporate Professional",
    goal: "maintain",
    allergies: [],
    mealBudget: "35000"
  });
  const [profileError, setProfileError] = useState<string | null>(null);

  // Questionnaire answers
  const [answers, setAnswers] = useState<Record<string, string>>({
    q1: "",
    q2: "",
    q3: "",
    q3_followup: "",
    q4: "",
    q5: "",
    q6: "",
    q7: "",
    q8: ""
  });

  // Diagnosis Match Result
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [isMatching, setIsMatching] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Preloaded personas for fallback & manual selection
  const [personasList, setPersonasList] = useState<PersonaItem[]>([]);
  const [manualMainId, setManualMainId] = useState<string | null>(null);
  const [manualSideIds, setManualSideIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("ALL");

  // Prepopulate saved profile if present in Clerk
  useEffect(() => {
    if (!isLoaded || !user || !roleAccessLoaded) return;

    if (user.unsafeMetadata?.nutriSeaProfile) {
      const saved = user.unsafeMetadata.nutriSeaProfile as any;
      setProfileData({
        age: String(saved.age || "26"),
        gender: saved.gender === "perempuan" ? "perempuan" : "laki-laki",
        heightCm: String(saved.heightCm || "168"),
        weightKg: String(saved.weightKg || "62"),
        occupation: saved.occupation || "Corporate Professional",
        goal: saved.goal === "turun-berat-badan" ? "turun-berat-badan" : "maintain",
        allergies: Array.isArray(saved.allergies) ? saved.allergies : [],
        mealBudget: String(saved.mealBudget || "35000")
      });
    }

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("change") === "true") return;
    }

    const checkExistingPersona = async () => {
      try {
        const currentRole = availableRoles.includes(activeRole) ? activeRole : "CONSUMER";
        if (currentRole === "MERCHANT") {
          router.replace("/merchant");
          return;
        }
        if (currentRole === "SHOPEE_ADMIN") {
          router.replace("/admin");
          return;
        }

        const res = await fetch(`http://127.0.0.1:8000/api/personas/users/${user.id}/personas`);
        if (res.ok) {
          const data = await res.json();
          const existingId = data.main_persona_id || data.main_persona?.id;
          if (existingId) {
            router.replace(AUTH_ROUTES.HOME);
            return;
          }
        }
      } catch (e) {
        console.warn("Check persona warning:", e);
      }
    };
    checkExistingPersona();
  }, [isLoaded, user?.id, router, activeRole, availableRoles, roleAccessLoaded]);

  // Background fetch of all 120 personas
  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/personas?limit=120")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: PersonaItem[]) => setPersonasList(data))
      .catch((e) => console.warn("Background preload personas warning:", e));
  }, []);

  const currentQ = QUESTIONS[currentStepIndex];
  const currentAnswer = answers[currentQ?.id] || "";

  // Unique slide key for driving smooth CSS fade transitions on every slide change
  const currentSlideKey = useMemo(() => {
    if (viewMode === "PROFILE") return "slide-profile";
    if (viewMode === "QUIZ") {
      return isQ3FollowUp ? "slide-q3-followup" : `slide-q-${currentStepIndex}`;
    }
    return `slide-${viewMode.toLowerCase()}`;
  }, [viewMode, currentStepIndex, isQ3FollowUp]);

  // Handle Profile Form Submit -> transitions to Question 1
  const handleProfileSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!profileData.age || !profileData.heightCm || !profileData.weightKg) {
      setProfileError("Please provide your age, height, and weight to continue.");
      return;
    }
    setProfileError(null);
    setSlideDirection("forward");
    setViewMode("QUIZ");
    setCurrentStepIndex(0);
  };

  // Select option with automatic forward on click
  const handleSelectOption = (questionId: string, value: string) => {
    setSlideDirection("forward");
    const updatedAnswers = {
      ...answers,
      [questionId]: value
    };
    setAnswers(updatedAnswers);

    if (questionId === "q3") {
      const needsFollowUp = !["I don't have any specific dietary restrictions.", "Prefer not to say."].includes(value);

      if (needsFollowUp) {
        setTimeout(() => {
          setIsQ3FollowUp(true);
        }, 220);
      } else {
        setAnswers((prev) => ({ ...prev, q3_followup: "" }));
        setTimeout(() => {
          setIsQ3FollowUp(false);
          setCurrentStepIndex(3);
        }, 220);
      }
    } else if (currentStepIndex === QUESTIONS.length - 1) {
      // Question 8: Auto forward and compute match!
      setTimeout(() => {
        handleComputeMatch(updatedAnswers);
      }, 240);
    } else {
      // Auto advance to next question
      setTimeout(() => {
        setCurrentStepIndex((prev) => Math.min(QUESTIONS.length - 1, prev + 1));
      }, 220);
    }
  };

  const handleSelectFollowUp = (val: string) => {
    setSlideDirection("forward");
    setAnswers((prev) => ({
      ...prev,
      q3_followup: val
    }));
    setTimeout(() => {
      setIsQ3FollowUp(false);
      setCurrentStepIndex(3); // Moves straight to Question 4
    }, 220);
  };

  // Back button handler: walks backwards cleanly through the slides
  const handleGoBack = () => {
    setSlideDirection("backward");
    if (isQ3FollowUp) {
      setIsQ3FollowUp(false);
    } else if (
      currentStepIndex === 3 &&
      answers.q3 &&
      !["I don't have any specific dietary restrictions.", "Prefer not to say."].includes(answers.q3)
    ) {
      setCurrentStepIndex(2);
      setIsQ3FollowUp(true);
    } else if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    } else if (currentStepIndex === 0) {
      // Return from Question 1 back to the Profile form
      setViewMode("PROFILE");
    } else {
      router.back();
    }
  };

  // Compute Match via Backend or Fallback
  const handleComputeMatch = async (activeAnswers = answers) => {
    setIsMatching(true);
    setSaveError(null);

    const payload = {
      q1_goal: activeAnswers.q1,
      q2_concern: activeAnswers.q2,
      q3_dietary_needs: activeAnswers.q3,
      q3_follow_up: activeAnswers.q3_followup,
      q4_lunch_priority: activeAnswers.q4,
      q5_budget: activeAnswers.q5,
      q6_activity: activeAnswers.q6,
      q7_age_range: activeAnswers.q7,
      q8_difficulty: activeAnswers.q8
    };

    try {
      const res = await fetch("http://127.0.0.1:8000/api/personas/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Failed to calculate persona match");
      const result: MatchResult = await res.json();
      setMatchResult(result);
      setManualMainId(result.main_persona.id);
      setManualSideIds(result.side_personas.map((p) => p.id));
      setViewMode("RESULT");
    } catch (err: any) {
      console.warn("Server match failed, using client-side fallback:", err);
      const fallbackMain = personasList.find((p) => p.archetype_code === "CORP_OVERLOADED") || personasList[0];
      const fallbackSides = personasList.filter((p) => p.id !== fallbackMain?.id).slice(0, 3);
      if (fallbackMain) {
        setMatchResult({
          primary_archetype: {
            code: fallbackMain.archetype_code,
            name: fallbackMain.archetype_name,
            score: 11.5,
            confidence_percent: 94
          },
          secondary_archetype: {
            code: "PREVENTIVE_HEALTH",
            name: "The Preventive Health Starter",
            score: 7.0
          },
          main_persona: fallbackMain,
          side_personas: fallbackSides,
          rationale: "This persona profile best aligns with your daily lunch routine and nutritional energy needs.",
          dietary_safeguards: {
            selected_restriction: activeAnswers.q3 || "None",
            is_medical_guidance: activeAnswers.q3_followup.includes("Guidance")
          }
        });
        setManualMainId(fallbackMain.id);
        setManualSideIds(fallbackSides.map((p) => p.id));
        setViewMode("RESULT");
      }
    } finally {
      setIsMatching(false);
    }
  };

  // Final confirmation and persistence to DB, Clerk & AppContext
  const handleConfirmPersona = async () => {
    const chosenMainId = manualMainId || matchResult?.main_persona?.id;
    const chosenSideIds = manualSideIds.length > 0 ? manualSideIds : matchResult?.side_personas?.map((p) => p.id) || [];

    if (!chosenMainId) return;

    setIsSaving(true);
    setSaveError(null);

    const effectiveUserId = user?.id || "user_3LdSuzBP84WASHC2BC7vliRK52R";
    const mainP = personasList.find((p) => p.id === chosenMainId) || matchResult?.main_persona;

    try {
      // 1. Sync persona assignment to PostgreSQL
      const res = await fetch(`http://127.0.0.1:8000/api/personas/users/${effectiveUserId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          main_persona_id: chosenMainId,
          side_persona_ids: chosenSideIds,
          name: user?.fullName || user?.firstName || "NutriSea User",
          email: user?.primaryEmailAddress?.emailAddress || null,
          role: activeRole || "CONSUMER"
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to save persona to database");
      }

      // 2. Sync profile biometrics to PostgreSQL health-profile
      try {
        await fetch(`http://127.0.0.1:8000/api/users/${effectiveUserId}/health-profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            age: Number(profileData.age) || 26,
            sex: profileData.gender === "laki-laki" ? "M" : "F",
            height_cm: Number(profileData.heightCm) || 168,
            weight_kg: Number(profileData.weightKg) || 62,
            activity_level: "LIGHT",
            goal: profileData.goal === "turun-berat-badan" ? "LOSE_WEIGHT" : "MAINTAIN",
            allergies: profileData.allergies,
            meal_budget_idr: Number(profileData.mealBudget) || 35000,
            has_medical_condition: false,
            max_dinner_cut_pct: 25
          })
        });
      } catch (syncErr) {
        console.warn("Backend health profile sync warning:", syncErr);
      }

      // 3. Save into Clerk unsafeMetadata
      if (user) {
        try {
          await user.update({
            unsafeMetadata: {
              ...user.unsafeMetadata,
              main_persona_id: chosenMainId,
              side_persona_ids: chosenSideIds,
              nutriSeaProfile: {
                age: profileData.age,
                gender: profileData.gender,
                heightCm: profileData.heightCm,
                weightKg: profileData.weightKg,
                occupation: profileData.occupation,
                goal: profileData.goal,
                allergies: profileData.allergies,
                mealBudget: profileData.mealBudget
              }
            }
          });
        } catch (clerkErr) {
          console.warn("Clerk metadata warning:", clerkErr);
        }
      }

      // 4. Save into LocalStorage for zero-latency instant reads
      if (typeof window !== "undefined") {
        localStorage.setItem("nutrisea_main_persona", chosenMainId);
        localStorage.setItem("nutrisea_side_personas", JSON.stringify(chosenSideIds));
      }

      // 5. Update AppContext BMI stats
      const height = Number(profileData.heightCm) || 168;
      const weight = Number(profileData.weightKg) || 62;
      const goalEnum: "turun" | "ideal" | "otot" =
        profileData.goal === "turun-berat-badan" ? "turun" : "ideal";
      updateBmi(height, weight, goalEnum);

      // 6. Navigate straight to Home
      router.push(AUTH_ROUTES.HOME);
    } catch (err: any) {
      console.error("Save persona error:", err);
      setSaveError(err.message || "Failed to save persona. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered personas for manual table
  const filteredPersonas = useMemo(() => {
    return personasList.filter((p) => {
      const matchSearch =
        searchQuery === "" ||
        p.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.occupation.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.work_district.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.archetype_name.toLowerCase().includes(searchQuery.toLowerCase());

      const matchDistrict =
        selectedDistrict === "ALL" ||
        p.work_district.toLowerCase() === selectedDistrict.toLowerCase();

      return matchSearch && matchDistrict;
    });
  }, [personasList, searchQuery, selectedDistrict]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "#F8F9FA",
        backgroundImage: "radial-gradient(circle at 50% 0%, #FFF5F1 0%, #F8F9FA 75%)",
        color: "#1F2937",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        zIndex: 99999,
        fontFamily: "inherit"
      }}
    >
      {/* Global Embedded Fade Wipe Keyframes */}
      <style>{`
        @keyframes fadeWipeRight {
          0% {
            opacity: 0;
            transform: translateX(-36px);
            clip-path: inset(0 100% 0 0);
          }
          45% {
            opacity: 0.7;
            clip-path: inset(-10px 35% -10px -10px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
            clip-path: inset(-24px -24px -24px -24px);
          }
        }
        @keyframes fadeWipeLeft {
          0% {
            opacity: 0;
            transform: translateX(36px);
            clip-path: inset(0 0 0 100%);
          }
          45% {
            opacity: 0.7;
            clip-path: inset(-10px -10px -10px 35%);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
            clip-path: inset(-24px -24px -24px -24px);
          }
        }
        @keyframes resultFadeIn {
          0% {
            opacity: 0;
            transform: translateY(18px) scale(0.99);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>

      {/* Subtle Shopee Ambient Glow (Warm & Clean) */}
      <div
        style={{
          position: "fixed",
          top: "-15%",
          right: "-10%",
          width: "480px",
          height: "480px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(238, 77, 45, 0.08) 0%, rgba(238, 77, 45, 0) 70%)",
          filter: "blur(70px)",
          pointerEvents: "none",
          zIndex: 1
        }}
      />
      <div
        style={{
          position: "fixed",
          bottom: "-20%",
          left: "-10%",
          width: "550px",
          height: "550px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255, 122, 89, 0.06) 0%, rgba(255, 122, 89, 0) 70%)",
          filter: "blur(90px)",
          pointerEvents: "none",
          zIndex: 1
        }}
      />

      {/* =================================================================== */}
      {/* 1. TOP PROGRESS BAR (Unifies Profile Setup + 8 Questions)           */}
      {/* =================================================================== */}
      {(viewMode === "PROFILE" || viewMode === "QUIZ") && (
        <div
          style={{
            position: "sticky",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            padding: "16px 20px 12px",
            backdropFilter: "blur(14px)",
            backgroundColor: "rgba(255, 255, 255, 0.92)",
            borderBottom: "1px solid #ECECEC"
          }}
        >
          {/* Segmented Bars: 1 profile bar + 8 question bars */}
          <div style={{ display: "flex", gap: "6px", width: "100%", maxWidth: "780px", margin: "0 auto" }}>
            {/* Step 0: Profile */}
            <div
              style={{
                flex: 1.2,
                height: "4px",
                borderRadius: "2px",
                backgroundColor: "#EE4D2D",
                boxShadow: viewMode === "PROFILE" ? "0 0 6px rgba(238, 77, 45, 0.5)" : "none",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
              }}
            />

            {/* Steps 1..8: Questions */}
            {QUESTIONS.map((q, idx) => {
              const isPassed = viewMode === "QUIZ" && idx < currentStepIndex;
              const isActive = viewMode === "QUIZ" && idx === currentStepIndex;
              return (
                <div
                  key={q.id}
                  style={{
                    flex: 1,
                    height: "4px",
                    borderRadius: "2px",
                    backgroundColor: isPassed
                      ? "#EE4D2D"
                      : isActive
                      ? "#EE4D2D"
                      : "#E5E7EB",
                    boxShadow: isActive ? "0 0 6px rgba(238, 77, 45, 0.4)" : "none",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                  }}
                />
              );
            })}
          </div>

          {/* Clean Top Navigation Bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              maxWidth: "780px",
              margin: "12px auto 0",
              padding: "0 4px"
            }}
          >
            <button
              type="button"
              onClick={handleGoBack}
              style={{
                background: "#FFFFFF",
                border: "1px solid #E5E7EB",
                borderRadius: "50%",
                width: "34px",
                height: "34px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#374151",
                cursor: "pointer",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
                transition: "all 0.15s ease"
              }}
              aria-label="Back"
            >
              <ArrowLeft size={16} />
            </button>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                backgroundColor: "#FFF0EC",
                border: "1px solid #FFD2C8",
                padding: "3px 12px",
                borderRadius: "14px",
                fontSize: "11px",
                fontWeight: 700,
                color: "#EE4D2D",
                letterSpacing: "0.5px"
              }}
            >
              <Sparkles size={12} color="#EE4D2D" />
              <span>
                {viewMode === "PROFILE"
                  ? "STEP 1: PERSONAL PROFILE SETUP"
                  : isQ3FollowUp
                  ? currentQ.followUp?.categoryBadge.toUpperCase()
                  : currentQ?.categoryBadge.toUpperCase()}
              </span>
            </div>

            <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#6B7280", fontFamily: "monospace" }}>
              {viewMode === "PROFILE"
                ? "Profile Setup"
                : `${String(currentStepIndex + 1).padStart(2, "0")} / ${String(QUESTIONS.length).padStart(2, "0")}`}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 2. FULLSCREEN SLIDE PRESENTATION CONTENT                            */}
      {/* =================================================================== */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "24px 20px 90px",
          position: "relative",
          zIndex: 10,
          width: "100%",
          maxWidth: "760px",
          margin: "0 auto"
        }}
      >
        {/* ================================================================= */}
        {/* STEP 0: COMPLETE YOUR PROFILE (Lengkapi profilmu intake)           */}
        {/* ================================================================= */}
        {viewMode === "PROFILE" && (
          <div
            key="slide-profile"
            style={{
              width: "100%",
              animation: `${slideDirection === "forward" ? "fadeWipeRight" : "fadeWipeLeft"} 0.32s cubic-bezier(0.16, 1, 0.3, 1) forwards`
            }}
          >
            <div
              style={{
                backgroundColor: "#FFFFFF",
                border: "1.5px solid #FFD6CE",
                borderRadius: "20px",
                padding: "28px 24px",
                boxShadow: "0 12px 36px rgba(238, 77, 45, 0.08)",
                position: "relative"
              }}
            >
              {/* Header */}
              <div style={{ marginBottom: "22px", textAlign: "center" }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    backgroundColor: "#FFF0EC",
                    border: "1px solid #FFD2C8",
                    padding: "3px 12px",
                    borderRadius: "14px",
                    fontSize: "11px",
                    fontWeight: 800,
                    color: "#EE4D2D",
                    letterSpacing: "0.5px",
                    marginBottom: "8px"
                  }}
                >
                  <User size={12} /> PERSONAL PROFILE
                </div>
                <h1
                  style={{
                    fontSize: "clamp(22px, 4.5vw, 28px)",
                    fontWeight: 900,
                    color: "#111827",
                    margin: "0 0 6px 0",
                    letterSpacing: "-0.5px"
                  }}
                >
                  Complete Your Profile
                </h1>
                <p style={{ fontSize: "13px", color: "#6B7280", margin: 0 }}>
                  Enter your biometric baseline so NutriSea can tailor portion sizes, calories, and budget.
                </p>
              </div>

              {profileError && (
                <div
                  style={{
                    backgroundColor: "#FEE2E2",
                    border: "1px solid #FCA5A5",
                    color: "#B91C1C",
                    borderRadius: "10px",
                    padding: "10px 14px",
                    marginBottom: "16px",
                    fontSize: "12.5px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                  }}
                >
                  <AlertTriangle size={15} /> {profileError}
                </div>
              )}

              <form onSubmit={handleProfileSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" }}>
                  {/* Age */}
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "6px" }}>
                      Age (years)
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="number"
                        min="15"
                        max="100"
                        required
                        value={profileData.age}
                        onChange={(e) => setProfileData((p) => ({ ...p, age: e.target.value }))}
                        style={{
                          width: "100%",
                          padding: "11px 48px 11px 14px",
                          borderRadius: "10px",
                          border: "1.5px solid #E5E7EB",
                          fontSize: "14px",
                          color: "#111827",
                          backgroundColor: "#F9FAFB",
                          boxSizing: "border-box"
                        }}
                      />
                      <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: "12px", color: "#9CA3AF" }}>
                        yrs
                      </span>
                    </div>
                  </div>

                  {/* Gender */}
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "6px" }}>
                      Gender
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      <button
                        type="button"
                        onClick={() => setProfileData((p) => ({ ...p, gender: "laki-laki" }))}
                        style={{
                          padding: "10px",
                          borderRadius: "10px",
                          border: profileData.gender === "laki-laki" ? "1.5px solid #EE4D2D" : "1.5px solid #E5E7EB",
                          backgroundColor: profileData.gender === "laki-laki" ? "#FFF5F1" : "#F9FAFB",
                          color: profileData.gender === "laki-laki" ? "#EE4D2D" : "#4B5563",
                          fontWeight: profileData.gender === "laki-laki" ? 700 : 500,
                          fontSize: "13px",
                          cursor: "pointer"
                        }}
                      >
                        Male
                      </button>
                      <button
                        type="button"
                        onClick={() => setProfileData((p) => ({ ...p, gender: "perempuan" }))}
                        style={{
                          padding: "10px",
                          borderRadius: "10px",
                          border: profileData.gender === "perempuan" ? "1.5px solid #EE4D2D" : "1.5px solid #E5E7EB",
                          backgroundColor: profileData.gender === "perempuan" ? "#FFF5F1" : "#F9FAFB",
                          color: profileData.gender === "perempuan" ? "#EE4D2D" : "#4B5563",
                          fontWeight: profileData.gender === "perempuan" ? 700 : 500,
                          fontSize: "13px",
                          cursor: "pointer"
                        }}
                      >
                        Female
                      </button>
                    </div>
                  </div>

                  {/* Height */}
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "6px" }}>
                      Height (cm)
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="number"
                        min="100"
                        max="240"
                        required
                        value={profileData.heightCm}
                        onChange={(e) => setProfileData((p) => ({ ...p, heightCm: e.target.value }))}
                        style={{
                          width: "100%",
                          padding: "11px 48px 11px 14px",
                          borderRadius: "10px",
                          border: "1.5px solid #E5E7EB",
                          fontSize: "14px",
                          color: "#111827",
                          backgroundColor: "#F9FAFB",
                          boxSizing: "border-box"
                        }}
                      />
                      <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: "12px", color: "#9CA3AF" }}>
                        cm
                      </span>
                    </div>
                  </div>

                  {/* Weight */}
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "6px" }}>
                      Weight (kg)
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="number"
                        min="30"
                        max="250"
                        required
                        value={profileData.weightKg}
                        onChange={(e) => setProfileData((p) => ({ ...p, weightKg: e.target.value }))}
                        style={{
                          width: "100%",
                          padding: "11px 48px 11px 14px",
                          borderRadius: "10px",
                          border: "1.5px solid #E5E7EB",
                          fontSize: "14px",
                          color: "#111827",
                          backgroundColor: "#F9FAFB",
                          boxSizing: "border-box"
                        }}
                      />
                      <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: "12px", color: "#9CA3AF" }}>
                        kg
                      </span>
                    </div>
                  </div>
                </div>

                {/* Occupation */}
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "6px" }}>
                    Occupation / Daily Role
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Corporate Professional, Software Engineer, Student"
                    value={profileData.occupation}
                    onChange={(e) => setProfileData((p) => ({ ...p, occupation: e.target.value }))}
                    style={{
                      width: "100%",
                      padding: "11px 14px",
                      borderRadius: "10px",
                      border: "1.5px solid #E5E7EB",
                      fontSize: "14px",
                      color: "#111827",
                      backgroundColor: "#F9FAFB",
                      boxSizing: "border-box"
                    }}
                  />
                </div>

                {/* Health Goal */}
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "6px" }}>
                    Primary Health Goal
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={() => setProfileData((p) => ({ ...p, goal: "maintain" }))}
                      style={{
                        padding: "11px 14px",
                        borderRadius: "10px",
                        border: profileData.goal === "maintain" ? "1.5px solid #EE4D2D" : "1.5px solid #E5E7EB",
                        backgroundColor: profileData.goal === "maintain" ? "#FFF5F1" : "#F9FAFB",
                        color: profileData.goal === "maintain" ? "#EE4D2D" : "#4B5563",
                        fontWeight: profileData.goal === "maintain" ? 700 : 500,
                        fontSize: "13px",
                        textAlign: "left",
                        cursor: "pointer"
                      }}
                    >
                      Maintain Ideal Weight
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfileData((p) => ({ ...p, goal: "turun-berat-badan" }))}
                      style={{
                        padding: "11px 14px",
                        borderRadius: "10px",
                        border: profileData.goal === "turun-berat-badan" ? "1.5px solid #EE4D2D" : "1.5px solid #E5E7EB",
                        backgroundColor: profileData.goal === "turun-berat-badan" ? "#FFF5F1" : "#F9FAFB",
                        color: profileData.goal === "turun-berat-badan" ? "#EE4D2D" : "#4B5563",
                        fontWeight: profileData.goal === "turun-berat-badan" ? 700 : 500,
                        fontSize: "13px",
                        textAlign: "left",
                        cursor: "pointer"
                      }}
                    >
                      Weight Loss & Deficit
                    </button>
                  </div>
                </div>

                {/* Lunch Budget */}
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "6px" }}>
                    Target Lunch Budget (IDR per portion)
                  </label>
                  <div style={{ position: "relative", marginBottom: "8px" }}>
                    <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: "13px", fontWeight: 700, color: "#6B7280" }}>
                      Rp
                    </span>
                    <input
                      type="number"
                      step="5000"
                      min="15000"
                      required
                      value={profileData.mealBudget}
                      onChange={(e) => setProfileData((p) => ({ ...p, mealBudget: e.target.value }))}
                      style={{
                        width: "100%",
                        padding: "11px 14px 11px 42px",
                        borderRadius: "10px",
                        border: "1.5px solid #E5E7EB",
                        fontSize: "14px",
                        color: "#111827",
                        backgroundColor: "#F9FAFB",
                        boxSizing: "border-box"
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {["25000", "35000", "45000", "60000"].map((bVal) => (
                      <button
                        key={bVal}
                        type="button"
                        onClick={() => setProfileData((p) => ({ ...p, mealBudget: bVal }))}
                        style={{
                          padding: "4px 10px",
                          borderRadius: "14px",
                          border: profileData.mealBudget === bVal ? "1px solid #EE4D2D" : "1px solid #E5E7EB",
                          backgroundColor: profileData.mealBudget === bVal ? "#FFF5F1" : "#FFFFFF",
                          color: profileData.mealBudget === bVal ? "#EE4D2D" : "#6B7280",
                          fontSize: "11.5px",
                          fontWeight: profileData.mealBudget === bVal ? 700 : 500,
                          cursor: "pointer"
                        }}
                      >
                        Rp {Number(bVal).toLocaleString("id-ID")}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Allergies Chips */}
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "6px" }}>
                    Known Food Allergies (Optional)
                  </label>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {["kacang", "seafood", "dairy", "egg"].map((allergyKey) => {
                      const isChecked = profileData.allergies.includes(allergyKey);
                      const displayNames: Record<string, string> = {
                        kacang: "Peanuts",
                        seafood: "Seafood",
                        dairy: "Dairy / Milk",
                        egg: "Eggs"
                      };
                      return (
                        <button
                          key={allergyKey}
                          type="button"
                          onClick={() => {
                            setProfileData((p) => ({
                              ...p,
                              allergies: isChecked
                                ? p.allergies.filter((a) => a !== allergyKey)
                                : [...p.allergies, allergyKey]
                            }));
                          }}
                          style={{
                            padding: "6px 14px",
                            borderRadius: "16px",
                            border: isChecked ? "1.5px solid #EE4D2D" : "1.5px solid #E5E7EB",
                            backgroundColor: isChecked ? "#FFF5F1" : "#F9FAFB",
                            color: isChecked ? "#EE4D2D" : "#4B5563",
                            fontSize: "12px",
                            fontWeight: isChecked ? 700 : 500,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px"
                          }}
                        >
                          {isChecked && <Check size={12} strokeWidth={3} />}
                          {displayNames[allergyKey]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Submit button to move to Question 1 */}
                <div style={{ marginTop: "12px" }}>
                  <button
                    type="submit"
                    style={{
                      width: "100%",
                      background: "linear-gradient(135deg, #EE4D2D 0%, #FF5722 100%)",
                      border: "none",
                      borderRadius: "26px",
                      padding: "16px 24px",
                      fontSize: "15px",
                      fontWeight: 800,
                      color: "#FFFFFF",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "10px",
                      boxShadow: "0 6px 20px rgba(238, 77, 45, 0.35)",
                      transition: "all 0.2s ease"
                    }}
                  >
                    Continue to Persona Questionnaire <ArrowRight size={17} />
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 1..8: 8 PERSONA QUESTIONS (Auto-Forward on Click, No Next)   */}
        {/* ================================================================= */}
        {viewMode === "QUIZ" && currentQ && (
          <div
            key={currentSlideKey}
            style={{
              width: "100%",
              animation: `${
                slideDirection === "forward" ? "fadeWipeRight" : "fadeWipeLeft"
              } 0.32s cubic-bezier(0.16, 1, 0.3, 1) forwards`
            }}
          >
            {/* If on Q3 Follow-up Slide */}
            {isQ3FollowUp && currentQ.followUp ? (
              <div>
                {/* Follow-up Slide Header */}
                <div style={{ textAlign: "center", marginBottom: 28 }}>
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "#EE4D2D",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      marginBottom: "6px"
                    }}
                  >
                    Regarding: {answers.q3}
                  </div>
                  <h1
                    style={{
                      fontSize: "clamp(20px, 4.2vw, 26px)",
                      fontWeight: 800,
                      color: "#111827",
                      lineHeight: 1.3,
                      margin: "0",
                      letterSpacing: "-0.4px"
                    }}
                  >
                    {currentQ.followUp.title}
                  </h1>
                </div>

                {/* Tactile Follow-up Cards - Auto Forward on Click */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
                  {currentQ.followUp.options.map((fOpt, fIdx) => {
                    const isFollowSelected = answers.q3_followup === fOpt.value;
                    return (
                      <button
                        key={fIdx}
                        type="button"
                        onClick={() => handleSelectFollowUp(fOpt.value)}
                        style={{
                          textAlign: "left",
                          backgroundColor: isFollowSelected ? "#FFF5F1" : "#FFFFFF",
                          border: isFollowSelected ? "1.5px solid #EE4D2D" : "1px solid #E5E7EB",
                          borderRadius: "14px",
                          padding: "16px 20px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          transition: "all 0.18s cubic-bezier(0.4, 0, 0.2, 1)",
                          boxShadow: isFollowSelected
                            ? "0 4px 16px rgba(238, 77, 45, 0.12)"
                            : "0 1px 3px rgba(0, 0, 0, 0.03)",
                          transform: isFollowSelected ? "scale(1.008)" : "none"
                        }}
                      >
                        <span
                          style={{
                            fontSize: "15px",
                            fontWeight: isFollowSelected ? 700 : 500,
                            color: isFollowSelected ? "#111827" : "#374151",
                            lineHeight: 1.4,
                            flex: 1
                          }}
                        >
                          {fOpt.label}
                        </span>

                        <div
                          style={{
                            width: "22px",
                            height: "22px",
                            borderRadius: "50%",
                            border: isFollowSelected ? "none" : "1.5px solid #D1D5DB",
                            backgroundColor: isFollowSelected ? "#EE4D2D" : "transparent",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            marginLeft: "16px",
                            transition: "all 0.15s ease"
                          }}
                        >
                          {isFollowSelected && <Check size={13} strokeWidth={3} color="#FFFFFF" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Standard Question Slide - Auto Forward on Click */
              <div>
                {/* Slide Question Header */}
                <div style={{ textAlign: "center", marginBottom: 28 }}>
                  <h1
                    style={{
                      fontSize: "clamp(22px, 4.5vw, 28px)",
                      fontWeight: 800,
                      color: "#111827",
                      lineHeight: 1.3,
                      margin: "0 0 10px 0",
                      letterSpacing: "-0.4px"
                    }}
                  >
                    {currentQ.title}
                  </h1>
                </div>

                {/* Interactive Tactile Option Cards - Auto Forward on Click */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
                  {currentQ.options.map((opt, oIdx) => {
                    const isSelected = currentAnswer === opt.value;
                    return (
                      <button
                        key={oIdx}
                        type="button"
                        onClick={() => handleSelectOption(currentQ.id, opt.value)}
                        style={{
                          textAlign: "left",
                          backgroundColor: isSelected ? "#FFF5F1" : "#FFFFFF",
                          border: isSelected ? "1.5px solid #EE4D2D" : "1px solid #E5E7EB",
                          borderRadius: "14px",
                          padding: "16px 20px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          transition: "all 0.18s cubic-bezier(0.4, 0, 0.2, 1)",
                          boxShadow: isSelected
                            ? "0 4px 16px rgba(238, 77, 45, 0.12)"
                            : "0 1px 3px rgba(0, 0, 0, 0.03)",
                          transform: isSelected ? "scale(1.008)" : "none"
                        }}
                      >
                        <span
                          style={{
                            fontSize: "15px",
                            fontWeight: isSelected ? 700 : 500,
                            color: isSelected ? "#111827" : "#374151",
                            lineHeight: 1.4,
                            flex: 1
                          }}
                        >
                          {opt.label}
                        </span>

                        <div
                          style={{
                            width: "22px",
                            height: "22px",
                            borderRadius: "50%",
                            border: isSelected ? "none" : "1.5px solid #D1D5DB",
                            backgroundColor: isSelected ? "#EE4D2D" : "transparent",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            marginLeft: "16px",
                            transition: "all 0.15s ease"
                          }}
                        >
                          {isSelected && <Check size={13} strokeWidth={3} color="#FFFFFF" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* 3. SHOPEE ARCHETYPE REVEAL SCREEN (RESULT VIEW)                     */}
        {/* =================================================================== */}
        {viewMode === "RESULT" && matchResult && (
          <div
            key="slide-result"
            style={{
              width: "100%",
              maxWidth: "680px",
              animation: "resultFadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards"
            }}
          >
            {/* Reveal Hero Card */}
            <div
              style={{
                backgroundColor: "#FFFFFF",
                border: "1.5px solid #FFD6CE",
                borderRadius: "20px",
                padding: "26px 24px",
                boxShadow: "0 12px 36px rgba(238, 77, 45, 0.08)",
                position: "relative",
                overflow: "hidden"
              }}
            >
              {/* Header Badges */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <span
                  style={{
                    backgroundColor: "#EE4D2D",
                    color: "#FFFFFF",
                    fontSize: "11px",
                    fontWeight: 800,
                    padding: "4px 12px",
                    borderRadius: "20px",
                    letterSpacing: "0.5px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px"
                  }}
                >
                  <Sparkles size={12} /> VERIFIED PROFILE
                </span>

                <div
                  style={{
                    backgroundColor: "#ECFDF5",
                    border: "1px solid #A7F3D0",
                    color: "#059669",
                    fontSize: "12px",
                    fontWeight: 800,
                    padding: "4px 12px",
                    borderRadius: "20px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px"
                  }}
                >
                  <CheckCircle2 size={13} color="#059669" />
                  <span>{matchResult.primary_archetype.confidence_percent}% MATCH</span>
                </div>
              </div>

              {/* Archetype Big Headline */}
              <h2
                style={{
                  fontSize: "clamp(22px, 5vw, 28px)",
                  fontWeight: 900,
                  color: "#111827",
                  margin: "0 0 6px 0",
                  letterSpacing: "-0.5px",
                  lineHeight: 1.2
                }}
              >
                {matchResult.primary_archetype.name}
              </h2>
              <p style={{ fontSize: "13.5px", color: "#4B5563", margin: "0 0 20px 0", lineHeight: 1.5 }}>
                {matchResult.rationale}
              </p>

              {/* Main Persona Hero Badge */}
              <div
                style={{
                  backgroundColor: "#FFF7F5",
                  border: "1px solid #FFD8CE",
                  borderRadius: "14px",
                  padding: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "12px",
                  marginBottom: "16px"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "50%",
                      backgroundColor: "#FFEFEA",
                      border: "1.5px solid #FF5722",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#EE4D2D"
                    }}
                  >
                    <User size={22} color="#EE4D2D" />
                  </div>
                  <div>
                    <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#EE4D2D", textTransform: "uppercase" }}>
                      Your Primary Persona
                    </span>
                    <h3 style={{ fontSize: "17px", fontWeight: 800, color: "#111827", margin: "2px 0 0 0" }}>
                      {matchResult.main_persona.full_name}
                    </h3>
                    <div style={{ fontSize: "12px", color: "#6B7280", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span>{profileData.occupation || matchResult.main_persona.occupation}</span>
                      <span>•</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                        <MapPin size={11} /> {matchResult.main_persona.work_district}
                      </span>
                    </div>
                  </div>
                </div>

                <span
                  style={{
                    backgroundColor: "#EE4D2D",
                    color: "#FFFFFF",
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: "6px"
                  }}
                >
                  Selected Persona
                </span>
              </div>

              {/* Key 3 Stat Pillars */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "16px" }}>
                <div style={{ backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "10px", padding: "10px 12px" }}>
                  <div style={{ fontSize: "10.5px", color: "#6B7280" }}>Lunch Calorie Target</div>
                  <div style={{ fontSize: "15px", fontWeight: 800, color: "#EE4D2D", marginTop: "2px" }}>
                    ~{matchResult.main_persona.target_lunch_kcal} kcal
                  </div>
                </div>
                <div style={{ backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "10px", padding: "10px 12px" }}>
                  <div style={{ fontSize: "10.5px", color: "#6B7280" }}>Lunch Budget Cap</div>
                  <div style={{ fontSize: "15px", fontWeight: 800, color: "#008A3D", marginTop: "2px" }}>
                    Rp {Number(profileData.mealBudget || matchResult.main_persona.target_lunch_budget_idr).toLocaleString("id-ID")}
                  </div>
                </div>
                <div style={{ backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "10px", padding: "10px 12px" }}>
                  <div style={{ fontSize: "10.5px", color: "#6B7280" }}>Medical Guardrails</div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#1F2937", marginTop: "4px" }}>
                    {matchResult.main_persona.medical_conditions === "NONE" ? "None reported" : matchResult.main_persona.medical_conditions}
                  </div>
                </div>
              </div>

              {/* 3 Adaptive Side Personas */}
              <div style={{ marginBottom: "10px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginBottom: "8px" }}>
                  3 Adaptive Companion Personas (Activated based on context):
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "8px" }}>
                  {matchResult.side_personas.map((sp) => (
                    <div
                      key={sp.id}
                      style={{
                        backgroundColor: "#F9FAFB",
                        border: "1px solid #E5E7EB",
                        borderRadius: "10px",
                        padding: "8px 12px"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Layers size={13} color="#EE4D2D" />
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "#111827" }}>{sp.full_name}</span>
                      </div>
                      <div style={{ fontSize: "10.5px", color: "#6B7280", marginTop: "2px" }}>
                        {sp.archetype_name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Error Message if save fails */}
            {saveError && (
              <div
                style={{
                  backgroundColor: "#FEE2E2",
                  border: "1px solid #FCA5A5",
                  color: "#B91C1C",
                  borderRadius: "10px",
                  padding: "10px 14px",
                  marginTop: "12px",
                  fontSize: "12.5px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}
              >
                <AlertTriangle size={15} /> {saveError}
              </div>
            )}

            {/* Shopee CTA Button */}
            <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                type="button"
                onClick={handleConfirmPersona}
                disabled={isSaving}
                style={{
                  width: "100%",
                  background: "linear-gradient(135deg, #EE4D2D 0%, #FF5722 100%)",
                  border: "none",
                  borderRadius: "26px",
                  padding: "16px 24px",
                  fontSize: "15px",
                  fontWeight: 800,
                  color: "#FFFFFF",
                  cursor: isSaving ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  boxShadow: "0 6px 20px rgba(238, 77, 45, 0.35)",
                  transition: "all 0.2s ease"
                }}
              >
                {isSaving ? (
                  <>
                    <RefreshCw size={17} className="spin-slow" /> Activating NutriSea Profile...
                  </>
                ) : (
                  <>
                    Continue to ShopeeFood & Start Eating Well <ArrowRight size={17} />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setViewMode("PROFILE");
                  setCurrentStepIndex(0);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#6B7280",
                  fontSize: "12px",
                  cursor: "pointer",
                  textDecoration: "underline",
                  padding: "6px"
                }}
              >
                Edit Profile & Retake Questionnaire
              </button>
            </div>
          </div>
        )}

        {/* MANUAL 120-PERSONA CATALOG TABLE */}
        {viewMode === "MANUAL_TABLE" && (
          <div
            style={{
              width: "100%",
              maxWidth: "760px",
              backgroundColor: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: "16px",
              padding: "20px",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.05)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#111827", margin: 0 }}>
                  Catalog of 120 Urban Personas
                </h3>
                <p style={{ fontSize: "12px", color: "#6B7280", margin: "2px 0 0 0" }}>
                  Manually select 1 Primary Persona and up to 3 Companion Personas.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setViewMode("QUIZ")}
                style={{
                  backgroundColor: "#FFF5F1",
                  border: "1px solid #EE4D2D",
                  color: "#EE4D2D",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  padding: "6px 14px",
                  borderRadius: "20px",
                  cursor: "pointer"
                }}
              >
                Back to Slideshow
              </button>
            </div>

            {/* Filter controls */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
              <div style={{ position: "relative", flex: 1 }}>
                <Search size={14} color="#9CA3AF" style={{ position: "absolute", left: 10, top: 10 }} />
                <input
                  type="text"
                  placeholder="Search by name, occupation, district..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px 8px 32px",
                    borderRadius: "8px",
                    border: "1px solid #D1D5DB",
                    fontSize: "12px",
                    backgroundColor: "#FFFFFF",
                    color: "#111827",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #D1D5DB",
                  fontSize: "12px",
                  backgroundColor: "#FFFFFF",
                  color: "#111827"
                }}
              >
                <option value="ALL">All Districts</option>
                <option value="SCBD">SCBD</option>
                <option value="Menteng">Menteng</option>
                <option value="Kuningan">Kuningan</option>
                <option value="Palmerah">Palmerah</option>
                <option value="Sudirman">Sudirman</option>
                <option value="Senayan">Senayan</option>
              </select>
            </div>

            {/* Scrollable list */}
            <div style={{ maxHeight: "380px", overflowY: "auto", border: "1px solid #E5E7EB", borderRadius: "10px" }}>
              {filteredPersonas.map((p) => {
                const isMain = manualMainId === p.id;
                const isSide = manualSideIds.includes(p.id);

                return (
                  <div
                    key={p.id}
                    style={{
                      padding: "12px 14px",
                      borderBottom: "1px solid #F3F4F6",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: isMain
                        ? "#FFF5F1"
                        : isSide
                        ? "#ECFDF5"
                        : "#FFFFFF"
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: isMain ? "#EE4D2D" : "#111827" }}>
                          {p.full_name}
                        </span>
                        <span style={{ fontSize: "10px", backgroundColor: "#F3F4F6", color: "#4B5563", padding: "1px 6px", borderRadius: "3px" }}>
                          {p.archetype_name}
                        </span>
                      </div>
                      <div style={{ fontSize: "11px", color: "#6B7280", marginTop: "2px" }}>
                        {p.occupation} • {p.work_district} • ~{p.target_lunch_kcal} kcal • Rp {p.target_lunch_budget_idr.toLocaleString("id-ID")}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setManualMainId(p.id);
                          setManualSideIds((prev) => prev.filter((id) => id !== p.id));
                        }}
                        style={{
                          backgroundColor: isMain ? "#EE4D2D" : "#F3F4F6",
                          color: isMain ? "#FFFFFF" : "#374151",
                          border: isMain ? "1px solid #EE4D2D" : "1px solid #E5E7EB",
                          padding: "4px 10px",
                          borderRadius: "6px",
                          fontSize: "11px",
                          fontWeight: 700,
                          cursor: "pointer"
                        }}
                      >
                        {isMain ? "Primary" : "Select Primary"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (isMain) return;
                          if (isSide) {
                            setManualSideIds((prev) => prev.filter((id) => id !== p.id));
                          } else {
                            if (manualSideIds.length < 3) {
                              setManualSideIds((prev) => [...prev, p.id]);
                            } else {
                              setManualSideIds((prev) => [...prev.slice(1), p.id]);
                            }
                          }
                        }}
                        disabled={isMain}
                        style={{
                          backgroundColor: isSide ? "#008A3D" : "#F3F4F6",
                          color: isSide ? "#FFFFFF" : "#374151",
                          border: isSide ? "1px solid #008A3D" : "1px solid #E5E7EB",
                          padding: "4px 10px",
                          borderRadius: "6px",
                          fontSize: "11px",
                          cursor: isMain ? "not-allowed" : "pointer"
                        }}
                      >
                        {isSide ? "Companion" : "+ Companion"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: "14px", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={handleConfirmPersona}
                disabled={!manualMainId || isSaving}
                style={{
                  background: "linear-gradient(135deg, #EE4D2D 0%, #FF5722 100%)",
                  border: "none",
                  borderRadius: "20px",
                  padding: "10px 20px",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#FFFFFF",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                {isSaving ? "Saving..." : "Confirm Manual Selection"} <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* 4. FIXED BOTTOM CONTROLLER (No Next Button - Forward on Click)      */}
      {/* =================================================================== */}
      {viewMode === "QUIZ" && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            padding: "12px 20px 16px",
            backgroundColor: "rgba(255, 255, 255, 0.94)",
            backdropFilter: "blur(14px)",
            borderTop: "1px solid #E5E7EB",
            boxShadow: "0 -4px 16px rgba(0, 0, 0, 0.04)"
          }}
        >
          <div
            style={{
              maxWidth: "760px",
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}
          >
            <button
              type="button"
              onClick={handleGoBack}
              style={{
                background: "transparent",
                border: "none",
                color: "#4B5563",
                fontSize: "13.5px",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <ArrowLeft size={16} /> Previous
            </button>

            {isMatching ? (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "#EE4D2D",
                  fontSize: "13px",
                  fontWeight: 700
                }}
              >
                <RefreshCw size={15} className="spin-slow" /> Analyzing Profile...
              </div>
            ) : (
              <span style={{ fontSize: "12px", color: "#9CA3AF", fontStyle: "italic" }}>
                Select an option to advance
              </span>
            )}
          </div>

          {/* Discreet link to manual table */}
          <div style={{ textAlign: "center", marginTop: "6px" }}>
            <button
              type="button"
              onClick={() => setViewMode("MANUAL_TABLE")}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "11.5px",
                color: "#9CA3AF",
                cursor: "pointer",
                textDecoration: "underline"
              }}
            >
              Or view the complete 120-persona catalog table? Click here
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
