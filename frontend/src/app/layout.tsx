import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { enUS } from "@clerk/localizations";
import { AppProvider } from "@/context/AppContext";
import AppShell from "@/components/AppShell";
import AccountSessionGate from "@/components/AccountSessionGate";

export const metadata: Metadata = {
  title: "NutriSea - Food for your preferences",
  description: "Explore local meals, compare catalog nutrition, and prepare a simulated order. Independent hackathon prototype.",
  icons: {
    icon: [
      { url: "/assets/NutriSea%20Icon%20Page.png" },
      { url: "/icon.png" }
    ],
    shortcut: "/assets/NutriSea%20Icon%20Page.png",
    apple: "/assets/NutriSea%20Icon%20Page.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider localization={{ ...enUS,
      formFieldInputPlaceholder__emailAddress: "Enter your email address",
      formFieldInputPlaceholder__password: "Enter your password",
      formFieldInputPlaceholder__signUpPassword: "Create a password",
      signIn: { ...enUS.signIn, start: { ...enUS.signIn?.start, title: "Sign in to NutriSea" } },
      signUp: { ...enUS.signUp, start: { ...enUS.signUp?.start, title: "Create your NutriSea account" } },
    }}>
      <html lang="en">
        <body>
          <Suspense fallback={<p role="status">Loading NutriSea...</p>}>
          <AccountSessionGate><AppProvider>
            <Suspense fallback={null}>
              <AppShell>{children}</AppShell>
            </Suspense>
          </AppProvider></AccountSessionGate>
          </Suspense>
        </body>
      </html>
    </ClerkProvider>
  );
}
