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
    <label>Nama bahan<input required autoFocus maxLength={150} value={name} onChange={e => setName(e.target.value)} disabled={busy} /></label>
    <label>Kategori<input required maxLength={80} value={category} onChange={e => setCategory(e.target.value)} disabled={busy} /></label>
    <label>Satuan default<select value={unit} onChange={e => setUnit(e.target.value as IngredientUnit)} disabled={busy}>
      {INGREDIENT_UNITS.map(v => <option key={v}>{v}</option>)}
    </select></label>
    <label>Alias (satu per baris)<textarea rows={4} value={aliases} onChange={e => setAliases(e.target.value)} disabled={busy} /></label>
    <label><span><input style={{ width: "auto" }} type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} disabled={busy} /> Bahan aktif</span></label>
    <button className={styles.primary} disabled={busy || !name.trim() || !category.trim()}>{busy ? "Menyimpan…" : "Simpan bahan"}</button>
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
        if (!controller.signal.aborted) { setError(err instanceof Error ? err.message : "Gagal memuat bahan."); setLoading(false); }
      });
    }, 275);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [api, query, page, revision]);

  function refresh() { setLoading(true); setRevision(r => r + 1); }
  async function save(payload: IngredientWrite) {
    if (busy) return;
    setBusy(true); setDialogError("");
    try { await api.save(payload, editing?.item?.id); setEditing(null); setNotice("Bahan berhasil disimpan."); refresh(); }
    catch (err) { setDialogError(err instanceof Error ? err.message : "Gagal menyimpan bahan."); }
    finally { setBusy(false); }
  }
  async function deactivate() {
    if (!deleting || busy) return;
    setBusy(true); setDialogError("");
    try { await api.deactivate(deleting.id); setDeleting(null); setNotice("Bahan dinonaktifkan. Komposisi menu lama tetap tersimpan."); refresh(); }
    catch (err) { setDialogError(err instanceof Error ? err.message : "Gagal menonaktifkan bahan."); }
    finally { setBusy(false); }
  }

  return <main className={styles.page}>
    <Link href="/admin">← Kembali ke admin</Link>
    <div className={styles.heading}><div><h1>Kelola bahan makanan</h1><p className={styles.muted}>Master bahan dan alias untuk komposisi menu merchant.</p></div>
      <button className={styles.primary} onClick={() => { setDialogError(""); setEditing({ item: null }); }}>+ Tambah bahan</button>
    </div>
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    <div className={styles.toolbar}><label>Cari bahan atau alias<input type="search" value={query} maxLength={80} placeholder="Cari bahan…"
      onChange={e => { setQuery(e.target.value); setPage(1); setLoading(true); }} /></label>
      <span>{data?.total ?? 0} bahan</span><button onClick={refresh} disabled={loading}>Muat ulang</button>
    </div>
    {error && <p role="alert" className={styles.notice}>{error}</p>}
    {loading ? <p role="status">Memuat bahan…</p> : !error && <>
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Nama / alias</th><th>Kategori</th><th>Satuan</th><th>Status</th><th>Tindakan</th></tr></thead>
        <tbody>{data?.items.map(item => <tr key={item.id}>
          <td><strong>{item.name}</strong><p className={styles.muted}>{item.aliases.join(", ") || "Tanpa alias"}</p></td>
          <td>{item.category}</td><td>{item.default_unit}</td><td>{item.is_active ? "Aktif" : "Nonaktif"}</td>
          <td><button onClick={() => setNutrition(item)} aria-label={`Nutrisi ${item.name}`}>Nutrisi</button>
            <button onClick={() => { setDialogError(""); setEditing({ item }); }} aria-label={`Edit ${item.name}`}>Edit</button>
            <button disabled={!item.is_active} onClick={() => { setDialogError(""); setDeleting(item); }} aria-label={`Nonaktifkan ${item.name}`}>Nonaktifkan</button></td>
        </tr>)}</tbody></table></div>
      {!data?.items.length && <p>Belum ada bahan yang cocok. Tambahkan master bahan untuk mulai memilih komposisi.</p>}
    </>}
    <nav className={styles.actions} aria-label="Halaman bahan">
      <button disabled={loading || page === 1} onClick={() => { setPage(p => p - 1); setLoading(true); }}>Sebelumnya</button>
      <span>Halaman {page} dari {Math.max(1, Math.ceil((data?.total ?? 0) / 20))}</span>
      <button disabled={loading || !!error || !data?.has_more} onClick={() => { setPage(p => p + 1); setLoading(true); }}>Berikutnya</button>
    </nav>
    {nutrition && <IngredientNutrition key={nutrition.id} ingredientId={nutrition.id} name={nutrition.name} onClose={() => setNutrition(null)} />}
    {editing && <IngredientDialog title={editing.item ? "Edit bahan" : "Tambah bahan"} busy={busy} onClose={() => setEditing(null)}>
      {dialogError && <p role="alert" className={styles.notice}>{dialogError}</p>}
      <IngredientForm item={editing.item} busy={busy} onSave={save} />
    </IngredientDialog>}
    {deleting && <IngredientDialog title="Nonaktifkan bahan?" busy={busy} onClose={() => setDeleting(null)}>
      <p>{deleting.name} tidak akan muncul dalam saran baru. Komposisi menu yang sudah memakai bahan ini tetap disimpan.</p>
      {dialogError && <p role="alert" className={styles.notice}>{dialogError}</p>}
      <div className={styles.actions}><button onClick={() => setDeleting(null)} disabled={busy}>Batal</button>
        <button className={styles.primary} onClick={deactivate} disabled={busy}>{busy ? "Memproses…" : "Ya, nonaktifkan"}</button></div>
    </IngredientDialog>}
  </main>;
}

export default function IngredientManagement() { return <IngredientGuard><ManagementContent /></IngredientGuard>; }
