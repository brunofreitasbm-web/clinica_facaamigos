import { GestorNav } from "@/components/gestor-nav";
import { getTargetsData } from "./actions";
import { TargetForm } from "./target-form";
import { DeleteTargetButton } from "./delete-target-button";

const ACHIEVEMENT_STYLE: Record<string, string> = {
  atingida: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  abaixo: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  sem_calculo: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
};
const ACHIEVEMENT_LABEL: Record<string, string> = {
  atingida: "✓ Atingida",
  abaixo: "✗ Abaixo",
  sem_calculo: "Sem cálculo ainda",
};

const PERIOD_LABEL: Record<string, string> = {
  mensal: "Mensal",
  trimestral: "Trimestral",
  semestral: "Semestral",
};

export default async function MetasPage() {
  const { targets, roles } = await getTargetsData();

  const byRole = new Map<string, typeof targets>();
  for (const t of targets) {
    const list = byRole.get(t.role) ?? [];
    list.push(t);
    byRole.set(t.role, list);
  }

  return (
    <div className="min-h-screen bg-canvas">
      <GestorNav />

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">Metas por cargo (§10.6 do PRD)</h1>
          <p className="text-sm text-ink-soft">
            Cadastre meta e peso por métrica e cargo. O atingimento compara com o último mês
            fechado em `metric_snapshots` (job `close_monthly_metric_snapshots`, dia 1) — métricas
            que ainda não têm pipeline de cálculo aparecem como &quot;sem cálculo ainda&quot;, nunca
            com número inventado.
          </p>
        </div>

        <section className="rounded-xl border border-paper-line bg-paper p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-ink">Nova meta</h2>
          <TargetForm roles={roles} />
        </section>

        {roles.map(({ value: role, label }) => {
          const rows = byRole.get(role) ?? [];
          if (rows.length === 0) return null;
          return (
            <section key={role} className="rounded-xl border border-paper-line bg-paper p-6 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-ink">{label}</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-paper-subtle border-b border-paper-line font-semibold text-ink-soft uppercase">
                    <tr>
                      <th className="p-3">Métrica</th>
                      <th className="p-3">Período</th>
                      <th className="p-3">Meta</th>
                      <th className="p-3">Peso</th>
                      <th className="p-3">Último mês fechado</th>
                      <th className="p-3">Atingimento</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-paper-line">
                    {rows.map((t) => (
                      <tr key={t.id}>
                        <td className="p-3 font-medium text-ink">{t.metricLabel}</td>
                        <td className="p-3 text-ink-soft">{PERIOD_LABEL[t.period] ?? t.period}</td>
                        <td className="p-3 text-ink-soft">
                          {t.targetValue}
                          {t.unit === "pct" ? "%" : t.unit === "dias" ? " dias" : t.unit === "min" ? " min" : ""}
                        </td>
                        <td className="p-3">{t.weight}%</td>
                        <td className="p-3 text-ink-soft">
                          {t.achievement.periodLabel
                            ? `${t.achievement.periodLabel} · ${t.achievement.actualLabel}`
                            : "—"}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold ${ACHIEVEMENT_STYLE[t.achievement.status]}`}
                          >
                            {ACHIEVEMENT_LABEL[t.achievement.status]}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <DeleteTargetButton targetId={t.id} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}

        {targets.length === 0 && (
          <p className="text-sm text-ink-soft">Nenhuma meta cadastrada ainda.</p>
        )}
      </main>
    </div>
  );
}
