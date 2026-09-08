import type { Metadata, Viewport } from "next";

/**
 * Layout isolado da tela pública de check-in: sem RecepcaoNav, sem nada que
 * pressuponha sessão. Vive na entrada física da clínica (tablet fixo ou
 * celular da família) — tipografia grande, alto contraste, zoom desabilitado
 * (é um quiosque, não uma página de navegação livre).
 */
export const metadata: Metadata = {
  title: "Check-in — FaçaAmigos",
  description: "Registre sua chegada na clínica.",
};

export const viewport: Viewport = {
  themeColor: "#f0196b",
  // Zoom fixo: evita que um toque acidental (comum em quem não usa
  // smartphone no dia a dia — ver F11 do plano) desconfigure a tela.
  maximumScale: 1,
  userScalable: false,
};

export default function CheckinLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex items-center justify-center p-4" style={{ background: "var(--color-bg)" }}>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
