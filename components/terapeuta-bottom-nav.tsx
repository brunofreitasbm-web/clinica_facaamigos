/**
 * Nav inferior do portal do terapeuta (mobile) — antes duplicada
 * literalmente em app/terapeuta/page.tsx e app/terapeuta/pacientes/page.tsx
 * (cada uma com o item ativo hardcoded diferente). Extraída pra
 * app/terapeuta/paciente/[patientId]/page.tsx (ficha do paciente) poder
 * usar a mesma nav sem duplicar de novo.
 */
export function TerapeutaBottomNav({ active }: { active: "hoje" | "pacientes" | "pendencias" }) {
  const itemStyle = (key: typeof active) => ({
    color: active === key ? "var(--color-accent)" : "var(--color-neutral-600)",
    fontWeight: active === key ? 600 : 400,
  });

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-3 border-t bg-white py-2.5 text-[11px] sm:hidden"
      style={{ borderColor: "var(--color-divider)" }}
      aria-label="Navegação do terapeuta"
    >
      <a
        href="/terapeuta"
        aria-current={active === "hoje" ? "page" : undefined}
        className="flex flex-col items-center gap-1 no-underline"
        style={itemStyle("hoje")}
      >
        📅 Hoje
      </a>
      <a
        href="/terapeuta/pacientes"
        aria-current={active === "pacientes" ? "page" : undefined}
        className="flex flex-col items-center gap-1 no-underline"
        style={itemStyle("pacientes")}
      >
        👥 Pacientes
      </a>
      <a
        href="/terapeuta#pendencias"
        aria-current={active === "pendencias" ? "page" : undefined}
        className="flex flex-col items-center gap-1 no-underline"
        style={itemStyle("pendencias")}
      >
        📈 Pendências
      </a>
    </nav>
  );
}
