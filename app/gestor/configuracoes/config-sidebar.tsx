import Link from "next/link";

// gerais, cobrancas e modelos existiram aqui mas eram telas sem função
// real: formulário local (useState) com "salvar" simulado por setTimeout,
// sem nenhuma tabela no schema que sustentasse o conceito (razão social/
// CNPJ estendido, config de cobrança, modelos de documento). Removidas em
// vez de mantidas como enfeite. `profissionais` foi reconstruída como
// cadastro real de therapist_contracts (valor-hora por terapeuta).
const SIDEBAR_ITEMS = [
  { key: "atendimentos", label: "Atendimentos & Salas", href: "/gestor/configuracoes/atendimentos", enabled: true },
  { key: "profissionais", label: "Terapeutas", href: "/gestor/configuracoes/profissionais", enabled: true },
  { key: "comportamentos", label: "Comportamentos-alvo", href: "/gestor/configuracoes/comportamentos", enabled: true },
  { key: "notificacoes", label: "Notificações", href: "/gestor/configuracoes/notificacoes", enabled: true },
  { key: "usuarios", label: "Usuários", href: "/gestor/configuracoes/usuarios", enabled: true },
] as const;

export type ConfigSidebarKey = (typeof SIDEBAR_ITEMS)[number]["key"];

export function ConfigSidebar({ active }: { active: ConfigSidebarKey }) {
  return (
    <aside className="w-[220px] shrink-0 border-r border-paper-line-strong px-4 py-8">
      <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3 px-3">
        Gerais
      </h6>
      <nav className="flex flex-col gap-1">
        {SIDEBAR_ITEMS.map((item) =>
          item.enabled ? (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active === item.key ? "page" : undefined}
              className="rounded-md px-3 py-2 text-[14px] no-underline"
              style={{
                color: active === item.key ? "var(--color-accent)" : "var(--color-text)",
                background: active === item.key ? "var(--color-accent-100)" : "transparent",
                fontWeight: active === item.key ? 600 : 400,
              }}
            >
              {item.label}
            </Link>
          ) : (
            <span
              key={item.key}
              className="cursor-not-allowed rounded-md px-3 py-2 text-[14px] text-ink-faint"
              title="Em breve"
            >
              {item.label}
            </span>
          ),
        )}
      </nav>
    </aside>
  );
}
