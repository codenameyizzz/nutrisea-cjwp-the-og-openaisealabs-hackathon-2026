export interface ScanAnalysis {
  detected_dish: string;
  preparation_style: string | null;
  qualitative_kcal_estimate: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  sodium_mg: number | null;
  source: "ai" | "demo";
}

function quantity(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function parseAnalysis(value: unknown): ScanAnalysis {
  if (!value || typeof value !== "object") throw new Error("The analysis results could not be read. The photo has not been logged.");
  const data = value as Record<string, unknown>;
  if (data.analysis_source !== "ai" || data.analysis_status !== "success") {
    throw new Error("Photo analysis is unavailable. Your photo is still available; please try again later. No meal log has been saved.");
  }
  if (typeof data.detected_dish !== "string" || !data.detected_dish.trim()) {
    throw new Error("The food could not be identified. Try a clearer photo. No meal log has been saved.");
  }
  return {
    detected_dish: data.detected_dish,
    preparation_style: typeof data.preparation_style === "string" ? data.preparation_style : null,
    qualitative_kcal_estimate: quantity(data.qualitative_kcal_estimate),
    protein_g: quantity(data.protein_g), carbs_g: quantity(data.carbs_g),
    fat_g: quantity(data.fat_g), sodium_mg: quantity(data.sodium_mg), source: "ai",
  };
}

export function canLogAnalysis(analysis: ScanAnalysis, calories: string): boolean {
  return analysis.source === "ai" && calories.trim() !== "" && Number.isInteger(Number(calories)) && Number(calories) >= 0
    && [analysis.protein_g, analysis.carbs_g, analysis.fat_g, analysis.sodium_mg]
      .every(value => typeof value === "number" && Number.isFinite(value) && value >= 0)
    && Number.isInteger(analysis.sodium_mg);
}
