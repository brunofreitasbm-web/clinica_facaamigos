import { Logo } from "@/components/brand/logo";

/**
 * Timbre para telas que são impressas direto do navegador (window.print),
 * sem passar pelo @react-pdf/renderer — resultados de instrumentos, laudos
 * e afins. Fica escondido na tela e só aparece no papel, para não duplicar
 * a marca que já está no cabeçalho do módulo.
 *
 * Usa `horizontal`, o SVG que já traz o wordmark e a assinatura
 * "Centro de Terapia Comportamental" vetorizados — nada de texto redigitado.
 */
export function PrintLetterhead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="hidden print:flex print:items-end print:justify-between print:gap-6 print:border-b-2 print:border-black print:pb-3 print:mb-4">
      <Logo variant="horizontal" height={38} />
      <div className="text-right">
        <p className="m-0 text-[13px] font-semibold text-black">{title}</p>
        {subtitle && <p className="m-0 text-[10px] text-neutral-600">{subtitle}</p>}
      </div>
    </div>
  );
}
