import Link from "next/link";

/**
 * Cabeçalho navy fixo da ficha do paciente — layout Broadsheet/Instituto
 * Faça Amigos (Paciente.dc.html). Marca à esquerda leva à supervisão
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
        <svg width="30" height="30" viewBox="0 0 100 100" fill="none">
          <path d="M22 18h34v10H33v18h20v10H33v26H22z" fill="var(--color-bg)" />
          <path
            d="M46 82 L64 26 h6 L88 82 h-9 l-4-13 H59 L55 82Z M61.5 61h11L67 42z"
            fill="var(--color-accent-2)"
          />
          <circle cx="33" cy="52.5" r="4.2" fill="var(--color-accent-2)" />
        </svg>
        <span style={{ fontFamily: "var(--font-heading)" }} className="text-[17px] font-semibold">
          Faça Amigos{" "}
          <span style={{ color: "var(--color-accent-2)" }} className="font-normal italic">
            · Prontuário
          </span>
        </span>
      </Link>
      <span className="text-[13px] opacity-75">
        ←{" "}
        <Link href="/recepcao/pacientes" className="text-inherit no-underline opacity-100">
          Pacientes
        </Link>
      </span>
    </header>
  );
}
