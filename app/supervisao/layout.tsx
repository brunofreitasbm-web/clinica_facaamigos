import { SupervisaoTabProvider } from "./supervisao-tab-context";
import { SupervisaoHeader } from "@/components/supervisao-header";
import { BonusFloatingWidget } from "@/components/bonus-floating-widget";
import { ParticularSaleAlert } from "@/components/particular-sale-alert";

/**
 * Layout do módulo Coordenação — monta o cabeçalho (SupervisaoHeader) em
 * toda tela do módulo.
 */
export default function SupervisaoLayout({ children }: { children: React.ReactNode }) {
  return (
    <SupervisaoTabProvider>
      <div className="flex min-h-0 flex-1 flex-col">
        <SupervisaoHeader />
        {children}
        <BonusFloatingWidget />
        <ParticularSaleAlert />
      </div>
    </SupervisaoTabProvider>
  );
}

