"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useIngredientApi } from "../../services/ingredient-api";
import type { IngredientAccess } from "../../services/ingredient-types";
import styles from "./ingredients.module.css";

export default function IngredientGuard({ children, mode = "admin" }: { children: ReactNode; mode?: "admin" | "merchant" }) {
  const api = useIngredientApi();
  const [verified, setVerified] = useState<{ userId: string; access?: IngredientAccess; error?: string } | null>(null);
  useEffect(() => {
    if (!api.isLoaded || !api.isSignedIn) return;
    const controller = new AbortController();
    const userId = api.userId!;
    api.access(controller.signal).then(access => { if (!controller.signal.aborted) setVerified({ userId, access }); }).catch(err => {
      if (!controller.signal.aborted) setVerified({ userId, error: err instanceof Error ? err.message : "Pemeriksaan akses gagal." });
    });
    return () => controller.abort();
  }, [api]);
  if (!api.isLoaded) return <p role="status">Memuat sesi…</p>;
  if (!api.isSignedIn) return <div className={styles.page}><p>Masuk untuk mengelola bahan dan menu.</p><Link href="/sign-in">Masuk</Link></div>;
  const access = verified && verified.userId === api.userId ? verified.access : undefined;
  const error = verified && verified.userId === api.userId ? verified.error : undefined;
  if (error) return <p role="alert" className={styles.notice}>{error}</p>;
  if (!access) return <p role="status">Memeriksa akses…</p>;
  if (!(mode === "admin" ? access.is_admin : access.can_edit_menus)) return <div className={styles.notice}><p role="alert">{mode === "merchant" ? "Akses Merchant belum aktif. Daftarkan usaha atau periksa pengajuan Anda." : "Anda tidak memiliki akses untuk halaman ini."}</p>{mode === "merchant" && <Link href="/merchant/register">Daftar sebagai Merchant / Cek Pengajuan</Link>}</div>;
  return <>{children}</>;
}
