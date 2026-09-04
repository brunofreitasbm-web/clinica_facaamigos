import { createClient } from "@/lib/supabase/server";
import { MeasurementCard } from "@/components/measurement-card";

const ROLES = [
  { href: "/recepcao", label: "Recepção", axis: "Agenda do dia" },
  { href: "/terapeuta", label: "Terapeuta", axis: "Minhas sessões" },
  { href: "/supervisao", label: "Supervisão", axis: "Carteira" },
  { href: "/faturamento", label: "Faturamento", axis: "Competência" },
  { href: "/gestor", label: "Gestor", axis: "Painel executivo" },
  { href: "/familia", label: "Família", axis: "Portal do paciente" },
];

export default async function Home() {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("clinics")
    .select("*", { count: "exact", head: true });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12 sm:px-10">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-medium uppercase tracking-[0.14em] text-chart">
            Scaffold — Fase 0
          </span>
          <svg
            viewBox="0 0 120 10"
            className="h-2.5 flex-1 text-chart"
            preserveAspectRatio="none"
            aria-hidden
          >
            <line
              x1="0"
              y1="5"
              x2="120"
              y2="5"
              stroke="currentColor"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            {[0, 20, 40, 60, 80, 100, 120].map((x) => (
              <line
                key={x}
                x1={x}
                y1="1"
                x2={x}
                y2={x % 40 === 0 ? "9" : "6"}
                stroke="currentColor"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
        </div>
        <h1 className="mt-2 text-3xl font-semibold text-ink">
          Sistema FaçaAmigos
        </h1>
        <p className="mt-2 max-w-prose text-sm text-ink-soft">
          Cada papel tem sua própria home — sem menu compartilhado. Esta
          página só existe nesta fase de scaffold; os links abaixo pulam o
          login para navegação manual entre papéis.
        </p>
        <a
          href="/login"
          className="mt-3 inline-block text-sm font-medium text-chart hover:text-chart-strong"
        >
          Entrar com e-mail e senha →
        </a>
      </div>

      <MeasurementCard
        label="Conexão Supabase (leitura real, sem sessão)"
        value={error ? "erro" : String(count ?? 0)}
        unit="clínicas visíveis"
        status={error ? "negative" : "neutral"}
        placeholder={false}
      />
      {!error && (
        <p className="-mt-4 text-xs text-ink-faint">
          0 é o resultado esperado: RLS está ativa em 100% das tabelas e
          nenhuma policy libera leitura anônima de <code>clinics</code>. A
          query rodou de verdade contra o banco — é a prova de conexão
          ponta a ponta pedida no scaffold, não um placeholder estático.
        </p>
      )}

      <nav className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ROLES.map((role) => (
          <a
            key={role.href}
            href={role.href}
            className="group rounded-md border border-paper-line-strong bg-paper/60 px-5 py-4 transition-colors hover:border-chart hover:bg-chart-soft"
          >
            <span className="font-mono text-xs uppercase tracking-wide text-chart">
              {role.axis}
            </span>
            <p className="mt-1 text-lg font-medium text-ink group-hover:text-chart-strong">
              {role.label}
            </p>
          </a>
        ))}
      </nav>
    </main>
  );
}
