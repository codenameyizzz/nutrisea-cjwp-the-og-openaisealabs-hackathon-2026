"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";
import { useMerchantApplications, type MerchantApplication, type MerchantApplicationInput } from "@/services/merchant-applications";
import { useApp } from "@/context/AppContext";
import MerchantRegistrationPanel from "@/components/merchant/MerchantRegistrationPanel";
import styles from "@/components/ingredients/ingredients.module.css";

export default function MerchantRegistrationPage() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  if (!isLoaded) return <p role="status">Memuat sesi...</p>;
  if (!isSignedIn) return <section className={styles.page}><h1>Daftar sebagai Merchant</h1><p>Masuk dengan akun Customer untuk mendaftarkan usaha. Akun yang sama tetap dapat digunakan untuk berbelanja.</p><Link href="/sign-in?redirect_url=%2Fmerchant%2Fregister">Masuk untuk mendaftar</Link></section>;
  return <RegistrationContent key={userId} />;
}

function RegistrationContent() {
  const api = useMerchantApplications();
  const { availableRoles, refreshAccountAccess } = useApp();
  const [application, setApplication] = useState<MerchantApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await api.own(signal);
      if (signal?.aborted) return;
      setApplication(result.application);
      setError("");
      if (result.application?.status === "APPROVED") refreshAccountAccess();
    } catch (err) {
      if (!signal?.aborted) setError(err instanceof Error ? err.message : "Status pengajuan gagal dimuat.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [api, refreshAccountAccess]);
  useEffect(() => {
    if (!api.isLoaded || !api.isSignedIn) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [api.isLoaded, api.isSignedIn, load]);
  useEffect(() => {
    if (application?.status !== "PENDING") return;
    const controller = new AbortController();
    const timer = window.setInterval(() => { void load(controller.signal); }, 15000);
    return () => { window.clearInterval(timer); controller.abort(); };
  }, [application?.status, load]);

  const submit = async (form: MerchantApplicationInput) => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const result = await api.submit(form);
      setApplication(result.application);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pengajuan gagal dikirim.");
    } finally { setBusy(false); }
  };
  if (!api.isLoaded) return <p role="status">Memuat sesi...</p>;
  if (!api.isSignedIn) return <section className={styles.page}><h1>Daftar sebagai Merchant</h1><p>Masuk dengan akun Customer untuk mendaftarkan usaha. Akun yang sama tetap dapat digunakan untuk berbelanja.</p><Link href="/sign-in?redirect_url=%2Fmerchant%2Fregister">Masuk untuk mendaftar</Link></section>;
  if (loading) return <p role="status">Memuat status pendaftaran...</p>;
  const hasAccess = availableRoles.includes("MERCHANT");
  return <MerchantRegistrationPanel application={application} hasAccess={hasAccess} busy={busy} error={error}
    onSubmit={submit} onReload={() => void load()} />;
}
