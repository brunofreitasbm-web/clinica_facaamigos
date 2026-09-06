import type { Metadata, Viewport } from "next";
import { Nunito, Fredoka } from "next/font/google";
import { AuthStatus } from "@/components/auth-status";
import { OfflineBanner } from "@/components/offline-banner";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
  style: ["normal", "italic"],
});

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "FaçaAmigos — Gestão Clínica",
  description: "Sistema de gestão da clínica TEA/TDAH FaçaAmigos.",
};

export const viewport: Viewport = {
  themeColor: "#f0196b",
};

import { ToastProvider } from "@/components/toast-provider";
import { RouteProgressBar } from "@/components/route-progress-bar";
import { Suspense } from "react";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${nunito.variable} ${fredoka.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          <Suspense fallback={null}>
            <RouteProgressBar />
          </Suspense>
          <OfflineBanner />
          <AuthStatus />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
