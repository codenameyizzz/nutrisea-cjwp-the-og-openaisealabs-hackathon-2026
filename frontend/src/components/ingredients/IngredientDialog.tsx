"use client";

import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import styles from "./ingredients.module.css";

export default function IngredientDialog({ title, children, onClose, busy = false }: {
  title: string; children: ReactNode; onClose: () => void; busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => { previous?.focus(); };
  }, []);
  return <dialog ref={ref} className={styles.dialog} aria-labelledby={id} aria-busy={busy}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className={styles.heading}><h2 id={id}>{title}</h2><button type="button" disabled={busy} onClick={onClose} aria-label="Close dialog">×</button></div>
    {children}
  </dialog>;
}
