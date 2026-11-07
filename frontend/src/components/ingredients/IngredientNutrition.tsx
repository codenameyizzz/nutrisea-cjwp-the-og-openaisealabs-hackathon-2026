"use client";

import { useEffect, useState } from "react";
import { loadIngredientNutrition } from "../../services/ingredient-nutrition";
import type { IngredientNutritionData } from "../../services/ingredient-nutrition";
import IngredientDialog from "./IngredientDialog";
import styles from "./ingredients.module.css";

const FIELDS = [
  ["calories", "Energi"], ["protein", "Protein"], ["carbohydrate", "Karbohidrat"],
  ["fat", "Lemak"], ["saturated_fat", "Lemak jenuh"], ["fiber", "Serat"],
  ["sugar", "Gula"], ["sodium", "Natrium"], ["potassium", "Kalium"], ["cholesterol", "Kolesterol"],
] as const;

export default function IngredientNutrition({ ingredientId, name, onClose }: {
  ingredientId: string; name: string; onClose: () => void;
}) {
  const [result, setResult] = useState<{ id: string; data?: IngredientNutritionData; error?: string } | null>(null);
  const [selection, setSelection] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    loadIngredientNutrition(ingredientId, controller.signal).then(data => {
      if (!controller.signal.aborted) setResult({ id: ingredientId, data });
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ id: ingredientId, error: error instanceof Error ? error.message : "Gagal memuat nutrisi." });
    });
    return () => controller.abort();
  }, [ingredientId]);

  const current = result?.id === ingredientId ? result : null;
  const data = current?.data;
  const choices = data?.sources.flatMap(source => source.servings.map(serving => ({
    key: `${source.source_key}/${serving.source_key}`, source, serving,
  }))) ?? [];
  const chosen = choices.find(choice => choice.key === selection) ?? choices[0];

  return <IngredientDialog title={`Referensi nutrisi: ${name}`} onClose={onClose}>
    {!current && <p role="status">Memuat referensi nutrisi...</p>}
    {current?.error && <p role="alert" className={styles.notice}>{current.error}</p>}
    {data && !choices.length && <p>Belum ada referensi nutrisi untuk bahan ini.</p>}
    {chosen && <div className={styles.form}>
      <label>Porsi sumber<select value={chosen.key} onChange={event => setSelection(event.target.value)}>
        {choices.map(choice => <option key={choice.key} value={choice.key}>
          {choice.source.source_name}: {choice.serving.description} ({choice.serving.metric_amount} {choice.serving.metric_unit})
        </option>)}
      </select></label>
      <p>Nilai untuk {chosen.serving.metric_amount} {chosen.serving.metric_unit} {chosen.source.source_name}.</p>
      <table className={styles.table} aria-label="Nutrisi per porsi sumber">
        <thead><tr><th>Zat gizi</th><th>Jumlah</th></tr></thead>
        <tbody>{FIELDS.map(([key, label]) => {
          const value = chosen.serving.nutrients[key];
          const unit = chosen.serving.nutrient_units[key];
          return <tr key={key}><th scope="row">{label}</th><td>
            {value == null || !unit ? "Belum tersedia" : `${value.toLocaleString("id-ID", { maximumFractionDigits: 3 })} ${unit}`}
          </td></tr>;
        })}</tbody>
      </table>
      {chosen.source.source_url && <a href={chosen.source.source_url} target="_blank" rel="noopener noreferrer">Lihat sumber FatSecret</a>}
      <p className={styles.muted}>{data?.note} Periksa bentuk bahan (mentah atau matang) pada sumber.</p>
      {!!chosen.serving.unit_unverified_fields.length && <p className={styles.muted}>Mikronutrien tanpa satuan terverifikasi belum ditampilkan.</p>}
    </div>}
  </IngredientDialog>;
}
