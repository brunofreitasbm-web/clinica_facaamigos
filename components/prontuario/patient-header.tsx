import Link from "next/link";
import { Logo } from "@/components/brand/logo";

/**
 * Cabeçalho navy fixo da ficha do paciente — layout Broadsheet/Instituto
 * FaçaAmigos (Paciente.dc.html). Marca à esquerda leva à supervisão
 * (equivalente à tela "Coordenador" do design); "← Pacientes" volta pra
 * lista.
 */
export function PatientHeader() {
  return (
    <header
      style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
      className="flex h-16 items-center gap-8 px-10"
    >
      <Link href="/supervisao" className="mr-auto flex items-center gap-3 no-underline">
        <Logo variant="simbolo" tone="branco" height={30} decorative />
        <span style={{ fontFamily: "var(--font-heading)" }} className="text-[17px] font-semibold">
          FaçaAmigos{" "}
          <span style={{ color: "var(--color-on-accent-soft)" }} className="font-normal italic">
            · Prontuário
          </span>
        </span>
      </Link>
      <span className="text-[13px] font-semibold" style={{ color: "var(--color-on-accent-soft)" }}>
        ←{" "}
        <Link href="/recepcao/pacientes" className="no-underline" style={{ color: "var(--color-on-accent)" }}>
          Pacientes
        </Link>
      </span>
    </header>
  );
}
