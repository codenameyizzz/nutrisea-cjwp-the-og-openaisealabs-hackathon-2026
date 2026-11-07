"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, RefreshCw } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { API_BASE_URL, responseJson } from "@/lib/api";
import { ACCOUNT_UPDATED } from "@/services/account-session";
import { canLogAnalysis, parseAnalysis, type ScanAnalysis } from "./analysis";
import styles from "./scanner.module.css";

const SAMPLES = [
  { name: "Bakwan sayur (demo)", kcal: 320, img: "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=400&q=80" },
  { name: "Martabak manis (demo)", kcal: 480, img: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&q=80" },
  { name: "Kopi susu (demo)", kcal: 220, img: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=400&q=80" },
];

export default function ScannerPage() {
  const router = useRouter();
  const { userId, getToken } = useAuth();
  const [sample, setSample] = useState<(typeof SAMPLES)[number] | null>(null);
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ScanAnalysis | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [dish, setDish] = useState("");
  const [calories, setCalories] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const selectionVersion = useRef(0);
  const busy = useRef(false);
  const resultRef = useRef<HTMLElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => { if (analysis) resultRef.current?.focus(); }, [analysis]);

  const resetResult = () => { setAnalysis(null); setError(null); setSaved(false); setConfirmed(false); };
  const chooseImage = (file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {
      setError("Choose a JPG, PNG, or WebP photo up to 8 MB. Your previous photo is still available."); return;
    }
    const version = ++selectionVersion.current;
    setIsReading(true); resetResult();
    const reader = new FileReader();
    reader.onerror = () => { if (version === selectionVersion.current) { setIsReading(false); setError("The photo could not be read. Please select it again."); } };
    reader.onload = () => {
      if (version !== selectionVersion.current) return;
      const data = String(reader.result);
      setPreview(data); setImageData(data.split(",")[1]); setImageMimeType(file.type); setSample(null); setIsReading(false);
    };
    reader.readAsDataURL(file);
  };

  const analyze = async () => {
    if (busy.current || isReading || (!imageData && !sample)) return;
    busy.current = true; setIsAnalyzing(true); resetResult();
    try {
      let result: ScanAnalysis;
      if (!imageData && sample) {
        result = { detected_dish: sample.name, qualitative_kcal_estimate: sample.kcal, preparation_style: null,
          protein_g: null, carbs_g: null, fat_g: null, sodium_mg: null, source: "demo" };
      } else {
        result = parseAnalysis(await responseJson(await fetch(`${API_BASE_URL}/api/scan`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_base64: imageData, image_mime_type: imageMimeType ?? undefined }),
        })));
      }
      setAnalysis(result); setDish(result.detected_dish);
      setCalories(result.qualitative_kcal_estimate === null ? "" : String(Math.round(result.qualitative_kcal_estimate)));
    } catch (err) {
      setError(err instanceof Error ? `${err.message} You can try again without selecting the photo again.` : "Analysis failed. Your photo is still available and has not been logged. Please try again.");
    } finally { busy.current = false; setIsAnalyzing(false); }
  };

  const saveMeal = async () => {
    if (!analysis || !confirmed || !dish.trim() || !canLogAnalysis(analysis, calories) || busy.current) return;
    if (!userId) { router.push("/sign-in?redirect_url=%2Fscanner"); return; }
    busy.current = true; setIsSaving(true); setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Your session has expired. Sign in again to save the meal log.");
      const result = await responseJson<{ status: string; id: number }>(await fetch(`${API_BASE_URL}/api/users/${userId}/meal-logs`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ source: "PHOTO", meal_type: "SNACK", label: dish.trim(), kcal: Number(calories),
          protein_g: analysis.protein_g, carbs_g: analysis.carbs_g, fat_g: analysis.fat_g, sodium_mg: analysis.sodium_mg,
          cooking_style: analysis.preparation_style, portion_factor: 1, confidence: null }),
      }));
      if (result.status !== "logged" || !result.id) throw new Error("The server has not confirmed the save. Check your meal log before trying again.");
      setSaved(true); window.dispatchEvent(new Event(ACCOUNT_UPDATED));
    } catch (err) { setError(err instanceof Error ? err.message : "The meal log could not be saved. Your inputs are still available."); }
    finally { busy.current = false; setIsSaving(false); }
  };

  return <div className={styles.page}>
    <button className={styles.back} onClick={() => router.push("/")}><ArrowLeft size={18} aria-hidden="true" /> Back to menu</button>
    <header><h1>Food photo analysis</h1><p>Upload a photo, review the estimates, then confirm your meal details.</p></header>
    <p className={styles.description}>Results are estimates based on the photo. The food type, portion size, and nutrient content may differ from the actual meal.</p>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.grid}>
      <section className={styles.card} aria-labelledby="photo-title">
        <h2 id="photo-title"><Camera size={20} aria-hidden="true" /> Meal photo</h2>
        {preview ? (
          // User-selected data URLs need the native image element.
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.preview} src={preview} alt={imageData ? "Your uploaded meal photo" : "Illustrative image for a demo sample"} />
        ) : <div className={styles.uploadPlaceholder}><Camera size={32} aria-hidden="true" /><p>Choose a clear photo of your meal.</p></div>}
        <p id="photo-help">Upload a JPG, PNG, or WebP photo (up to 8 MB)</p>
        <input ref={fileInput} id="meal-photo" type="file" hidden accept="image/jpeg,image/png,image/webp" disabled={isAnalyzing || isSaving || isReading} onChange={event => chooseImage(event.target.files?.[0])} />
        <button className={imageData ? styles.upload : styles.primary} aria-describedby="photo-help" disabled={isAnalyzing || isSaving || isReading} onClick={() => fileInput.current?.click()}>{isReading ? "Reading photo..." : imageData ? "Change photo" : "Upload meal photo"}</button>
        {imageData && <button className={styles.primary} disabled={isAnalyzing || isSaving || isReading} onClick={analyze}>
          {isAnalyzing && <RefreshCw size={18} aria-hidden="true" />}
          {isAnalyzing ? "Analyzing photo..." : "Estimate nutrition"}
        </button>}
        <details className={styles.details}><summary>Try a demo sample</summary>
          <p>The illustrative images and sample values are not AI analysis results or actual portion measurements.</p>
          <div className={styles.samples}>{SAMPLES.map(item => <button key={item.name} aria-pressed={!imageData && item.name === sample?.name} disabled={isAnalyzing || isSaving || isReading} onClick={() => { selectionVersion.current++; setSample(item); setPreview(item.img); setImageData(null); setImageMimeType(null); resetResult(); }}>{item.name}</button>)}</div>
          {sample && !imageData && <button className={styles.upload} disabled={isAnalyzing || isSaving || isReading} onClick={analyze}>View demo results</button>}
        </details>
      </section>
      <section ref={resultRef} tabIndex={-1} className={styles.card} aria-labelledby="analysis-title">
        <h2 id="analysis-title">{analysis?.source === "demo" ? "Demo estimates" : "AI photo analysis results"}</h2>
        {!analysis ? <p role="status">{isAnalyzing ? "Your photo is being analyzed. No meal log has been saved." : "Choose a photo and start analysis. Results will appear here for you to review."}</p> : <>
          <p className={styles.description}>{analysis.source === "demo" ? "Demo sample data. This cannot be saved as a meal log." : "AI photo estimate, not a laboratory measurement. Review before saving."}</p>
          <label htmlFor="scan-dish">Food name (editable)</label>
          <input id="scan-dish" value={dish} disabled={saved || isSaving} onChange={event => { setDish(event.target.value); setConfirmed(false); }} />
          <label htmlFor="scan-calories">Estimated energy (kcal)</label>
          <input id="scan-calories" type="number" min="0" step="1" placeholder="Unavailable" value={calories} disabled={saved || isSaving} onChange={event => { setCalories(event.target.value); setConfirmed(false); }} />
          <details className={styles.details}><summary>Nutrition details</summary>
            <dl className={styles.nutrients}>{([['Protein', analysis.protein_g, 'g'], ['Carbohydrates', analysis.carbs_g, 'g'], ['Fat', analysis.fat_g, 'g'], ['Sodium', analysis.sodium_mg, 'mg']] as const).map(([name,value,unit]) => <div key={name}><dt>{name}</dt><dd>{value === null ? "Unavailable" : `${value} ${unit}`}</dd></div>)}</dl>
            <p className={styles.description}>Missing measurements stay unavailable; they are not filled with zero.</p>
          </details>
          {!canLogAnalysis(analysis, calories) && analysis.source !== "demo" && <p className={styles.description}>Logging requires complete nutrition data. These estimates cannot be saved yet.</p>}
          <label className={styles.confirm}><input type="checkbox" checked={confirmed} disabled={saved || isSaving || !canLogAnalysis(analysis,calories)} onChange={event => setConfirmed(event.target.checked)} /> I have reviewed the food name and estimated energy.</label>
          <button className={styles.primary} disabled={!confirmed || !dish.trim() || !canLogAnalysis(analysis, calories) || isSaving || saved} onClick={saveMeal}>{isSaving ? "Saving..." : saved ? "Meal log saved" : "Save meal log"}</button>
          {saved && <p role="status">Your meal log was saved. This does not automatically change all recommendations or meal targets.</p>}
        </>}
      </section>
    </div>
  </div>;
}
