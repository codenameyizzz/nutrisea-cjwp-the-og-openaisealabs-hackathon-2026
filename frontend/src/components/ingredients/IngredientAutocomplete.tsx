"use client";

import { useEffect, useId, useRef, useState } from "react";
import { INGREDIENT_UNITS, quantityIsValid } from "../../services/ingredient-types";
import type { IngredientPage, IngredientSelection, IngredientUnit } from "../../services/ingredient-types";
import styles from "./ingredients.module.css";

interface Props {
  value: IngredientSelection[];
  onChange: (items: IngredientSelection[]) => void;
  search: (query: string, signal?: AbortSignal) => Promise<IngredientPage>;
  disabled?: boolean;
}

export default function IngredientAutocomplete({ value, onChange, search, disabled = false }: Props) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<IngredientPage["items"]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState(-1);
  const suggestions = results.filter(item => item.is_active && !value.some(v => v.ingredient_id === item.id));

  function close() { generation.current++; setOpen(false); setLoading(false); }

  useEffect(() => {
    if (!query.trim() || disabled) return;
    const controller = new AbortController();
    const current = ++generation.current;
    const timer = setTimeout(async () => {
      try {
        const data = await search(query.trim(), controller.signal);
        if (current === generation.current) { setResults(data.items); setLoading(false); }
      } catch (err) {
        if (!controller.signal.aborted && current === generation.current) {
          setError(err instanceof Error ? err.message : "Pencarian bahan gagal."); setLoading(false);
        }
      }
    }, 275);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, search, disabled]);

  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) { generation.current++; setOpen(false); setLoading(false); }
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);

  function clear() { generation.current++; setQuery(""); setResults([]); setError(""); setActive(-1); setLoading(false); setOpen(false); }
  function choose(index: number) {
    const item = suggestions[index];
    if (!item || disabled || value.length >= 100 || value.some(v => v.ingredient_id === item.id)) return;
    onChange([...value, { ingredient_id: item.id, name: item.name, quantity: "1", unit: item.default_unit, is_active: item.is_active }]);
    clear(); input.current?.focus();
  }
  function update(index: number, field: "quantity" | "unit", next: string) {
    onChange(value.map((item, i) => i === index ? { ...item, [field]: next } : item));
  }

  return <div className={styles.editor} ref={root} onBlur={e => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) close();
  }}>
    <label htmlFor={`${id}-input`}>Bahan menu</label>
    <p className={styles.muted} id={`${id}-hint`}>Cari nama atau alias, lalu pilih bahan. Maksimum 100 bahan; takaran hingga 3 desimal.</p>
    <div className={styles.search}>
      <input id={`${id}-input`} ref={input} role="combobox" autoComplete="off" placeholder="Cari bahan, misalnya bawang"
        aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`} aria-describedby={`${id}-hint`}
        aria-activedescendant={open && active >= 0 && suggestions[active] ? `${id}-option-${active}` : undefined}
        value={query} maxLength={80} disabled={disabled || value.length >= 100}
        onFocus={() => { if (query.trim()) setOpen(true); }}
        onChange={e => { generation.current++; setQuery(e.target.value); setResults([]); setError(""); setActive(-1); setLoading(Boolean(e.target.value.trim())); setOpen(Boolean(e.target.value.trim())); }}
        onKeyDown={e => {
          if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault(); setOpen(true);
            setActive(i => !suggestions.length ? -1 : i < 0 ? (e.key === "ArrowUp" ? suggestions.length - 1 : 0)
              : (i + (e.key === "ArrowDown" ? 1 : -1) + suggestions.length) % suggestions.length);
          }
          if (e.key === "Enter" && query.trim()) { e.preventDefault(); if (open && active >= 0) choose(active); }
        }} />
      {query && <button type="button" aria-label="Bersihkan pencarian bahan" onClick={() => { clear(); input.current?.focus(); }}>×</button>}
      {open && <div className={styles.dropdown}>
        <div role="status" aria-live="polite">{loading ? "Mencari bahan…" : !error && !suggestions.length ? "Tidak ada bahan yang cocok atau semua sudah dipilih." : ""}</div>
        {error && <p role="alert">{error}</p>}
        <ul role="listbox" id={`${id}-list`} aria-label="Saran bahan" aria-busy={loading}>
          {suggestions.map((item, index) => <li role="option" aria-selected={active === index} id={`${id}-option-${index}`} key={item.id}
            className={active === index ? styles.highlight : ""} onPointerDown={e => e.preventDefault()}
            onMouseMove={() => setActive(index)} onClick={() => choose(index)}>
            <strong>{item.name}</strong><span>{item.category} · {item.default_unit}</span>
          </li>)}
        </ul>
      </div>}
    </div>
    <div className={styles.selected} aria-label="Bahan terpilih">
      {!value.length && <p className={styles.muted}>Belum ada bahan dipilih. Data ini belum menyatakan resep lengkap atau bebas alergen.</p>}
      {value.map((item, index) => <div className={styles.selectedRow} key={item.ingredient_id}>
        <strong>{item.name}{!item.is_active && <small> (nonaktif)</small>}</strong>
        <label>Takaran {item.name}<input type="number" min="0.001" max="999999.999" step="0.001" required
          value={item.quantity} disabled={disabled || !item.is_active} aria-invalid={!quantityIsValid(item.quantity)}
          onChange={e => update(index, "quantity", e.target.value)} /></label>
        <label>Satuan {item.name}<select value={item.unit} disabled={disabled || !item.is_active}
          onChange={e => update(index, "unit", e.target.value as IngredientUnit)}>
          {INGREDIENT_UNITS.map(unit => <option value={unit} key={unit}>{unit}</option>)}
        </select></label>
        <button type="button" disabled={disabled} aria-label={`Hapus ${item.name}`} onClick={() => onChange(value.filter((_, i) => i !== index))}>Hapus</button>
        {!quantityIsValid(item.quantity) && <p className={styles.error} role="alert">Takaran harus positif, maksimum 999999.999 dan 3 desimal.</p>}
      </div>)}
    </div>
  </div>;
}
