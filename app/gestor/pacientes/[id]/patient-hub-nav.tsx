"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { key: "cadastro", label: "Cadastro & Dados" },
  { key: "anamnese", label: "Anamnese / 1ª Avaliação" },
  { key: "terapeutica", label: "Terapêutica & Documentos" },
] as const;

/** Submenu do hub do paciente; a aba ativa sai do pathname. */
export function PatientHubNav({ patientId }: { patientId: string }) {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label="Seções do paciente" className="flex gap-1 overflow-x-auto border-b px-6 sm:px-10" style={{ borderColor: "var(--color-neutral-200)" }}>
      {TABS.map((t) => {
        const href = `/gestor/pacientes/${patientId}/${t.key}`;
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={t.key}
            href={href}
            aria-current={active ? "page" : undefined}
            className="whitespace-nowrap px-3 py-2.5 text-[13px] font-semibold no-underline"
            style={{
              color: active ? "var(--color-accent)" : "var(--color-ink-faint, #6b7280)",
              borderBottom: active ? "2px solid var(--color-accent)" : "2px solid transparent",
            }}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
