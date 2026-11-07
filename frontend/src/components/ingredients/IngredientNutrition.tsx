"use client";

import { useEffect, useState } from "react";
import { ingredientNutritionNoteEnglish, loadIngredientNutrition } from "../../services/ingredient-nutrition";
import type { IngredientNutritionData } from "../../services/ingredient-nutrition";
import IngredientDialog from "./IngredientDialog";
import styles from "./ingredients.module.css";

const FIELDS = [
  ["calories", "Energy"], ["protein", "Protein"], ["carbohydrate", "Carbohydrates"],
  ["fat", "Fat"], ["saturated_fat", "Saturated fat"], ["fiber", "Fiber"],
  ["sugar", "Sugars"], ["sodium", "Sodium"], ["potassium", "Potassium"], ["cholesterol", "Cholesterol"],
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
      if (!controller.signal.aborted) setResult({ id: ingredientId, error: error instanceof Error ? error.message : "Nutrition could not be loaded." });
    });
    return () => controller.abort();
  }, [ingredientId]);

  const current = result?.id === ingredientId ? result : null;
  const data = current?.data;
  const choices = data?.sources.flatMap(source => source.servings.map(serving => ({
    key: `${source.source_key}/${serving.source_key}`, source, serving,
  }))) ?? [];
  const chosen = choices.find(choice => choice.key === selection) ?? choices[0];

  return <IngredientDialog title={`Nutrition reference: ${name}`} onClose={onClose}>
    {!current && <p role="status">Loading nutrition references...</p>}
    {current?.error && <p role="alert" className={styles.notice}>{current.error}</p>}
    {data && !choices.length && <p>No nutrition reference is available for this ingredient.</p>}
    {chosen && <div className={styles.form}>
      <label>Source serving<select value={chosen.key} onChange={event => setSelection(event.target.value)}>
        {choices.map(choice => <option key={choice.key} value={choice.key}>
          {choice.source.source_name}: {choice.serving.description} ({choice.serving.metric_amount} {choice.serving.metric_unit})
        </option>)}
      </select></label>
      <p>Values for {chosen.serving.metric_amount} {chosen.serving.metric_unit} of {chosen.source.source_name}.</p>
      <table className={styles.table} aria-label="Nutrition per source serving">
        <thead><tr><th>Nutrient</th><th>Amount</th></tr></thead>
        <tbody>{FIELDS.map(([key, label]) => {
          const value = chosen.serving.nutrients[key];
          const unit = chosen.serving.nutrient_units[key];
          return <tr key={key}><th scope="row">{label}</th><td>
            {value == null || !unit ? "Not available" : `${value.toLocaleString("en-US", { maximumFractionDigits: 3 })} ${unit}`}
          </td></tr>;
        })}</tbody>
      </table>
      {chosen.source.source_url && <a href={chosen.source.source_url} target="_blank" rel="noopener noreferrer">View FatSecret source</a>}
      <p className={styles.muted}>{ingredientNutritionNoteEnglish(data?.note ?? "")} Check the source for the ingredient&apos;s preparation state (raw or cooked).</p>
      {!!chosen.serving.unit_unverified_fields.length && <p className={styles.muted}>Micronutrients without verified units are not displayed.</p>}
    </div>}
  </IngredientDialog>;
}
