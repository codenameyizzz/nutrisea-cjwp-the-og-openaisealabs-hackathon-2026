import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { AppProvider } from "@/context/AppContext";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "NutriSea by ShopeeFood - Rekomendasi Menu Sehat",
  description: "Rekomendasi Makanan Sehat ShopeeFood & SeaBank Wellness Saver",
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
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="id">
        <body>
          <AppProvider>
            <Suspense fallback={null}>
              <AppShell>{children}</AppShell>
            </Suspense>
          </AppProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
