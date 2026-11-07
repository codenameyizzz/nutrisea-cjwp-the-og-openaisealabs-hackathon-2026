"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@clerk/nextjs";
import { useApp } from "../../context/AppContext";
import styles from "./ingredients.module.css";

export default function IngredientGuard({ children, mode = "admin" }: { children: ReactNode; mode?: "admin" | "merchant" }) {
  const { isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname();
  const { availableRoles, roleAccessError } = useApp();
  if (!isLoaded) return <p role="status">Loading session...</p>;
  if (!isSignedIn) return <div className={styles.page}><p>Sign in to manage ingredients and meals.</p><Link href={`/sign-in?redirect_url=${encodeURIComponent(pathname || (mode === "admin" ? "/admin" : "/merchant"))}`}>Sign in</Link></div>;
  if (roleAccessError) return <p role="alert" className={styles.notice}>{roleAccessError}</p>;
  if (!availableRoles.includes(mode === "admin" ? "SHOPEE_ADMIN" : "MERCHANT")) return <div className={styles.notice}><p role="alert">{mode === "merchant" ? "Merchant access is not active. Register your business or check your application." : "You do not have access to this page."}</p>{mode === "merchant" && <Link href="/merchant/register">Register as a merchant / Check application</Link>}</div>;
  return <>{children}</>;
}
