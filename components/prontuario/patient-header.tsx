import Link from "next/link";
import { BrandLockup } from "@/components/brand/brand-lockup";

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
      <BrandLockup module="Prontuário" href="/supervisao" className="mr-auto" />
      <span className="text-[13px] font-semibold" style={{ color: "var(--color-on-accent-soft)" }}>
        ←{" "}
        <Link href="/recepcao/pacientes" className="no-underline" style={{ color: "var(--color-on-accent)" }}>
          Pacientes
        </Link>
      </span>
    </header>
  );
}
