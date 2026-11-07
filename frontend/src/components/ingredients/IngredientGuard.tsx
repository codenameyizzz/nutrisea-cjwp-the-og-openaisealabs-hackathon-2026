"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useAuth } from "@clerk/nextjs";
import { useApp } from "../../context/AppContext";
import styles from "./ingredients.module.css";

export default function IngredientGuard({ children, mode = "admin" }: { children: ReactNode; mode?: "admin" | "merchant" }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { availableRoles, roleAccessError } = useApp();
  if (!isLoaded) return <p role="status">Memuat sesi…</p>;
  if (!isSignedIn) return <div className={styles.page}><p>Masuk untuk mengelola bahan dan menu.</p><Link href="/sign-in">Masuk</Link></div>;
  if (roleAccessError) return <p role="alert" className={styles.notice}>{roleAccessError}</p>;
  if (!availableRoles.includes(mode === "admin" ? "SHOPEE_ADMIN" : "MERCHANT")) return <div className={styles.notice}><p role="alert">{mode === "merchant" ? "Akses Merchant belum aktif. Daftarkan usaha atau periksa pengajuan Anda." : "Anda tidak memiliki akses untuk halaman ini."}</p>{mode === "merchant" && <Link href="/merchant/register">Daftar sebagai Merchant / Cek Pengajuan</Link>}</div>;
  return <>{children}</>;
}
