"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useIngredientApi } from "../../services/ingredient-api";
import { INGREDIENT_UNITS } from "../../services/ingredient-types";
import type { Ingredient, IngredientPage, IngredientUnit, IngredientWrite } from "../../services/ingredient-types";
import IngredientDialog from "./IngredientDialog";
import IngredientNutrition from "./IngredientNutrition";
import IngredientGuard from "./IngredientGuard";
import styles from "./ingredients.module.css";

function IngredientForm({ item, busy, onSave }: { item: Ingredient | null; busy: boolean; onSave: (data: IngredientWrite) => void }) {
  const [name, setName] = useState(item?.name || "");
  const [category, setCategory] = useState(item?.category || "Bumbu");
  const [unit, setUnit] = useState<IngredientUnit>(item?.default_unit || "gram");
  const [aliases, setAliases] = useState(item?.aliases.join("\n") || "");
  const [active, setActive] = useState(item?.is_active ?? true);
  return <form className={styles.form} onSubmit={event => {
    event.preventDefault();
    onSave({ name, category, default_unit: unit, aliases: aliases.split("\n").map(v => v.trim()).filter(Boolean), is_active: active });
  }}>
    <label>Ingredient name<input required autoFocus maxLength={150} value={name} onChange={e => setName(e.target.value)} disabled={busy} /></label>
    <label>Category<input required maxLength={80} value={category} onChange={e => setCategory(e.target.value)} disabled={busy} /></label>
    <label>Default unit<select value={unit} onChange={e => setUnit(e.target.value as IngredientUnit)} disabled={busy}>
      {INGREDIENT_UNITS.map(v => <option key={v}>{v}</option>)}
    </select></label>
    <label>Aliases (one per line)<textarea rows={4} value={aliases} onChange={e => setAliases(e.target.value)} disabled={busy} /></label>
    <label><span><input style={{ width: "auto" }} type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} disabled={busy} /> Active ingredient</span></label>
    <button className={styles.primary} disabled={busy || !name.trim() || !category.trim()}>{busy ? "Saving..." : "Save ingredient"}</button>
  </form>;
}

function ManagementContent() {
  const api = useIngredientApi();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<IngredientPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<{ item: Ingredient | null } | null>(null);
  const [deleting, setDeleting] = useState<Ingredient | null>(null);
  const [nutrition, setNutrition] = useState<Ingredient | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api.manage(query, page, controller.signal).then(result => {
        if (!controller.signal.aborted) { setData(result); setLoading(false); setError(""); }
      }).catch(err => {
        if (!controller.signal.aborted) { setError(err instanceof Error ? err.message : "Ingredients could not be loaded."); setLoading(false); }
      });
    }, 275);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [api, query, page, revision]);

  function refresh() { setLoading(true); setRevision(r => r + 1); }
  async function save(payload: IngredientWrite) {
    if (busy) return;
    setBusy(true); setDialogError("");
    try { await api.save(payload, editing?.item?.id); setEditing(null); setNotice("Ingredient saved."); refresh(); }
    catch (err) { setDialogError(err instanceof Error ? err.message : "The ingredient could not be saved."); }
    finally { setBusy(false); }
  }
  async function deactivate() {
    if (!deleting || busy) return;
    setBusy(true); setDialogError("");
    try { await api.deactivate(deleting.id); setDeleting(null); setNotice("Ingredient deactivated. Existing meal recipes have been preserved."); refresh(); }
    catch (err) { setDialogError(err instanceof Error ? err.message : "The ingredient could not be deactivated."); }
    finally { setBusy(false); }
  }

  return <main className={styles.page}>
    <Link href="/admin">← Back to admin</Link>
    <div className={styles.heading}><div><h1>Manage ingredients</h1><p className={styles.muted}>Ingredient names and aliases for merchant meal recipes.</p></div>
      <button className={styles.primary} onClick={() => { setDialogError(""); setEditing({ item: null }); }}>+ Add ingredient</button>
    </div>
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    <div className={styles.toolbar}><label>Search ingredients or aliases<input type="search" value={query} maxLength={80} placeholder="Search ingredients..."
      onChange={e => { setQuery(e.target.value); setPage(1); setLoading(true); }} /></label>
      <span>{data?.total ?? 0} ingredients</span><button onClick={refresh} disabled={loading}>Reload</button>
    </div>
    {error && <p role="alert" className={styles.notice}>{error}</p>}
    {loading ? <p role="status">Loading ingredients...</p> : !error && <>
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Name / aliases</th><th>Category</th><th>Unit</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{data?.items.map(item => <tr key={item.id}>
          <td><strong>{item.name}</strong><p className={styles.muted}>{item.aliases.join(", ") || "No aliases"}</p></td>
          <td>{item.category}</td><td>{item.default_unit}</td><td>{item.is_active ? "Active" : "Inactive"}</td>
          <td><button type="button" onClick={() => setNutrition(item)} aria-label={`Nutrition for ${item.name}`}>Nutrition</button>
            <button onClick={() => { setDialogError(""); setEditing({ item }); }} aria-label={`Edit ${item.name}`}>Edit</button>
            <button disabled={!item.is_active} onClick={() => { setDialogError(""); setDeleting(item); }} aria-label={`Deactivate ${item.name}`}>Deactivate</button></td>
        </tr>)}</tbody></table></div>
      {!data?.items.length && <p>No matching ingredients. Add an ingredient to start building meal recipes.</p>}
    </>}
    <nav className={styles.actions} aria-label="Ingredient pages">
      <button disabled={loading || page === 1} onClick={() => { setPage(p => p - 1); setLoading(true); }}>Previous</button>
      <span>Page {page} of {Math.max(1, Math.ceil((data?.total ?? 0) / 20))}</span>
      <button disabled={loading || !!error || !data?.has_more} onClick={() => { setPage(p => p + 1); setLoading(true); }}>Next</button>
    </nav>
    {nutrition && <IngredientNutrition key={nutrition.id} ingredientId={nutrition.id} name={nutrition.name} onClose={() => setNutrition(null)} />}
    {editing && <IngredientDialog title={editing.item ? "Edit ingredient" : "Add ingredient"} busy={busy} onClose={() => setEditing(null)}>
      {dialogError && <p role="alert" className={styles.notice}>{dialogError}</p>}
      <IngredientForm item={editing.item} busy={busy} onSave={save} />
    </IngredientDialog>}
    {deleting && <IngredientDialog title="Deactivate ingredient?" busy={busy} onClose={() => setDeleting(null)}>
      <p>{deleting.name} will no longer appear in new suggestions. Existing meal recipes using this ingredient will be preserved.</p>
      {dialogError && <p role="alert" className={styles.notice}>{dialogError}</p>}
      <div className={styles.actions}><button onClick={() => setDeleting(null)} disabled={busy}>Cancel</button>
        <button className={styles.primary} onClick={deactivate} disabled={busy}>{busy ? "Processing..." : "Yes, deactivate"}</button></div>
    </IngredientDialog>}
  </main>;
}

export default function IngredientManagement() { return <IngredientGuard><ManagementContent /></IngredientGuard>; }
