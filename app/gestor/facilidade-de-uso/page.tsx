import { AuditoriaSubnav } from "@/components/auditoria-subnav";
import { PageContainer } from "@/components/page-container";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import {
  compareLowerIsBetter,
  describeRoute,
  describeTrend,
  formatNumber,
  type Comparison,
  type Tone,
} from "@/lib/ux-friction-report";
import { getFrictionReport, type KpiRow } from "./data";

export const dynamic = "force-dynamic";

const TONE_STYLE: Record<Tone, { badge: string; label: string }> = {
  bom: { badge: "bg-status-positive-soft text-status-positive-text", label: "Bom" },
  atencao: { badge: "bg-status-pending-soft text-status-pending-text", label: "Atenção" },
  sem_dados: { badge: "bg-status-neutral-soft text-status-neutral-text", label: "Sem dados" },
};

function formatWeek(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function roleLabel(papel: string | null): string {
  if (!papel || papel === "todos") return "Todos";
  return ROLE_LABEL[papel as Role] ?? papel;
}

function Badge({ tone }: { tone: Tone }) {
  const style = TONE_STYLE[tone];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.badge}`}>{style.label}</span>;
}

/** Indicador com atual, semana anterior, meta e leitura — nunca um número solto. */
function KpiCard({
  title,
  help,
  atual,
  anterior,
  meta,
  unit,
  metaLabel,
  leitura,
}: {
  title: string;
  help: string;
  atual: number | null;
  anterior: number | null;
  meta: number | null;
  unit: string;
  metaLabel: string;
  leitura?: string | null;
}) {
  const c: Comparison = compareLowerIsBetter(atual, anterior, meta);
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-paper-line bg-paper p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <Badge tone={c.tone} />
      </div>
      <p className="text-3xl font-bold text-ink">
        {formatNumber(atual)}
        <span className="ml-1 text-base font-semibold text-ink-soft">{unit}</span>
      </p>
      <dl className="grid grid-cols-2 gap-2 text-xs text-ink-soft">
        <div>
          <dt className="font-semibold uppercase tracking-wide">Semana passada</dt>
          <dd>
            {formatNumber(anterior)} {anterior === null ? "" : unit}
          </dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-wide">Meta</dt>
          <dd>
            {metaLabel} {formatNumber(meta)} {unit}
          </dd>
        </div>
      </dl>
      <p className="text-xs text-ink-soft">Nesta semana {describeTrend(c, unit)}.</p>
      {leitura && <p className="text-sm text-ink">{leitura}</p>}
      <p className="text-xs text-ink-faint">{help}</p>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-xl font-bold text-ink">{title}</h2>
        <p className="text-sm text-ink-soft">{subtitle}</p>
      </div>
      <div className="rounded-lg border border-paper-line bg-paper p-5 shadow-sm">{children}</div>
    </section>
  );
}

const TH = "px-4 py-3";
const THEAD = "border-b border-paper-line bg-paper-subtle text-xs font-semibold text-ink-soft uppercase tracking-wider";

function Empty({ cols, text }: { cols: number; text: string }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-6 text-center text-ink-soft">
        {text}
      </td>
    </tr>
  );
}

export default async function FacilidadeDeUsoPage() {
  const supabase = await createClient();
  const report = await getFrictionReport(supabase, DEV_CLINIC_ID);
  const geral: KpiRow | undefined = report.kpis.find((k) => k.papel === "todos");
  const porPapel = report.kpis.filter((k) => k.papel !== "todos");

  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <AuditoriaSubnav activeTab="uso" />

      <PageContainer>
        <div>
          <h1 className="text-2xl font-bold text-ink">Facilidade de uso do sistema</h1>
          <p className="text-sm text-ink-soft">
            Mostra onde a equipe tropeça ao usar o sistema: botões que não respondem, telas onde se perdem,
            formulários que travam. Não guarda o que foi digitado nem dados de pacientes, e mede telas, não pessoas.
          </p>
        </div>

        {!geral && (
          <div className="rounded-lg border border-paper-line bg-paper p-6 text-sm text-ink-soft shadow-sm">
            Ainda não há dados. A coleta começa assim que a migration <code>20260929000000_ux_friction_events</code> está
            aplicada no banco e a equipe usa o sistema; os primeiros números aparecem em poucos dias de uso normal.
          </div>
        )}

        {geral && (
          <>
            <p className="text-sm text-ink-soft">
              Semana de <strong>{formatWeek(report.semana)}</strong>
              {geral.semana_em_andamento ? " (ainda em andamento)" : ""} · {formatNumber(geral.usuarios_ativos, 0)}{" "}
              pessoa(s) usando · {formatNumber(geral.telas_vistas, 0)} telas abertas.
              {(geral.telas_vistas ?? 0) < 30 && " Poucos dados: ainda não tire conclusões."}
            </p>

            <div className="grid gap-4 md:grid-cols-3">
              <KpiCard
                title="Usos com algum tropeço"
                help="Das vezes em que alguém abriu o sistema, quantas tiveram clique sem resposta, erro ou formulário barrado."
                atual={geral.pct_sessoes_com_friccao_atual}
                anterior={geral.pct_sessoes_com_friccao_semana_anterior}
                meta={geral.meta_max_pct_sessoes_com_friccao}
                unit="%"
                metaLabel="no máximo"
                leitura={geral.leitura}
              />
              <KpiCard
                title="Tropeços a cada 100 telas"
                help="Quanto menor, mais fluido o uso."
                atual={geral.sinais_por_100_telas_atual}
                anterior={geral.sinais_por_100_telas_semana_anterior}
                meta={geral.meta_max_sinais_por_100_telas}
                unit="por 100"
                metaLabel="no máximo"
              />
              <KpiCard
                title="Tempo até o primeiro clique"
                help="Demorar muito depois de abrir a tela sugere dúvida sobre o que fazer."
                atual={geral.ttfa_mediano_atual_s}
                anterior={geral.ttfa_mediano_semana_anterior_s}
                meta={geral.meta_max_ttfa_s}
                unit="s"
                metaLabel="até"
              />
            </div>

            <Section title="Por área" subtitle="Onde o tropeço é maior: recepção, terapeuta, faturamento...">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-ink">
                  <thead className={THEAD}>
                    <tr>
                      <th className={TH}>Área</th>
                      <th className={TH}>Usos com tropeço</th>
                      <th className={TH}>Semana passada</th>
                      <th className={TH}>Meta</th>
                      <th className={TH}>Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-paper-line">
                    {porPapel.length === 0 && <Empty cols={5} text="Sem dados por área nesta semana." />}
                    {porPapel.map((k) => {
                      const c = compareLowerIsBetter(
                        k.pct_sessoes_com_friccao_atual,
                        k.pct_sessoes_com_friccao_semana_anterior,
                        k.meta_max_pct_sessoes_com_friccao,
                      );
                      return (
                        <tr key={k.papel} className="hover:bg-paper-subtle/50 transition-colors">
                          <td className="px-4 py-3.5 font-medium">{roleLabel(k.papel)}</td>
                          <td className="px-4 py-3.5">{formatNumber(k.pct_sessoes_com_friccao_atual)}%</td>
                          <td className="px-4 py-3.5 text-ink-soft">
                            {formatNumber(k.pct_sessoes_com_friccao_semana_anterior)}%
                          </td>
                          <td className="px-4 py-3.5 text-ink-soft">até {formatNumber(k.meta_max_pct_sessoes_com_friccao)}%</td>
                          <td className="px-4 py-3.5">
                            <Badge tone={c.tone} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title="O que consertar primeiro" subtitle="Telas com mais sinais de dificuldade, da mais urgente para a menos.">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-ink">
                  <thead className={THEAD}>
                    <tr>
                      <th className={TH}>Tela</th>
                      <th className={TH}>Tropeços a cada 100 aberturas</th>
                      <th className={TH}>Semana passada</th>
                      <th className={TH}>O que significa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-paper-line">
                    {report.pages.length === 0 && <Empty cols={4} text="Nenhuma tela com sinal de dificuldade nesta semana." />}
                    {report.pages.map((p) => {
                      const c = compareLowerIsBetter(p.sinais_por_100_atual, p.sinais_por_100_semana_anterior, p.meta_max_sinais_por_100);
                      return (
                        <tr key={p.tela} className="align-top hover:bg-paper-subtle/50 transition-colors">
                          <td className="px-4 py-3.5">
                            <p className="font-medium">{describeRoute(p.tela ?? "")}</p>
                            <p className="font-mono text-xs text-ink-faint">{p.tela}</p>
                            <p className="text-xs text-ink-soft">
                              {formatNumber(p.visualizacoes, 0)} aberturas · {formatNumber(p.usuarios_distintos, 0)} pessoa(s)
                            </p>
                          </td>
                          <td className="px-4 py-3.5">
                            <p>
                              {formatNumber(p.sinais_por_100_atual)} <Badge tone={c.tone} />
                            </p>
                            <p className="text-xs text-ink-soft">meta até {formatNumber(p.meta_max_sinais_por_100)}</p>
                          </td>
                          <td className="px-4 py-3.5 text-ink-soft">
                            {p.sinais_por_100_semana_anterior === null ? "—" : formatNumber(p.sinais_por_100_semana_anterior)}
                          </td>
                          <td className="px-4 py-3.5 text-sm">{p.leitura}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title="Botões que não respondem" subtitle="Onde as pessoas clicam várias vezes ou clicam e nada acontece.">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-ink">
                  <thead className={THEAD}>
                    <tr>
                      <th className={TH}>Botão / área</th>
                      <th className={TH}>Tela</th>
                      <th className={TH}>Esta semana</th>
                      <th className={TH}>Semana passada</th>
                      <th className={TH}>O que significa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-paper-line">
                    {report.elements.length === 0 && <Empty cols={5} text="Nenhum botão com problema nesta semana." />}
                    {report.elements.map((e) => (
                      <tr key={`${e.tela}|${e.elemento}|${e.tipo}`} className="align-top hover:bg-paper-subtle/50 transition-colors">
                        <td className="px-4 py-3.5">
                          <p className="font-medium">{e.elemento}</p>
                          <p className="text-xs text-ink-soft">{e.tipo}</p>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-ink-soft">{describeRoute(e.tela ?? "")}</td>
                        <td className="px-4 py-3.5">
                          {formatNumber(e.ocorrencias_atual, 0)}
                          <span className="ml-1 text-xs text-ink-soft">(meta até {formatNumber(e.meta_max_ocorrencias, 0)})</span>
                        </td>
                        <td className="px-4 py-3.5 text-ink-soft">{formatNumber(e.ocorrencias_semana_anterior, 0)}</td>
                        <td className="px-4 py-3.5 text-sm">{e.leitura}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section
              title="Onde não estão achando o que procuram"
              subtitle="A pessoa abre uma tela, volta para a anterior em segundos: o atalho provavelmente levou ao lugar errado."
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-ink">
                  <thead className={THEAD}>
                    <tr>
                      <th className={TH}>Estava em</th>
                      <th className={TH}>Abriu e voltou</th>
                      <th className={TH}>Esta semana</th>
                      <th className={TH}>Semana passada</th>
                      <th className={TH}>O que significa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-paper-line">
                    {report.loops.length === 0 && <Empty cols={5} text="Nenhum vai-e-volta relevante nesta semana." />}
                    {report.loops.map((l) => (
                      <tr key={`${l.tela_de_origem}|${l.tela_visitada}`} className="align-top hover:bg-paper-subtle/50 transition-colors">
                        <td className="px-4 py-3.5 font-medium">{describeRoute(l.tela_de_origem ?? "")}</td>
                        <td className="px-4 py-3.5">{describeRoute(l.tela_visitada ?? "")}</td>
                        <td className="px-4 py-3.5">
                          {formatNumber(l.idas_e_voltas_atual, 0)}
                          <span className="ml-1 text-xs text-ink-soft">(meta até {formatNumber(l.meta_max_idas_e_voltas, 0)})</span>
                        </td>
                        <td className="px-4 py-3.5 text-ink-soft">{formatNumber(l.idas_e_voltas_semana_anterior, 0)}</td>
                        <td className="px-4 py-3.5 text-sm">{l.leitura}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            {report.history.length > 1 && (
              <Section title="Evolução semana a semana" subtitle="Os tropeços estão diminuindo depois de cada melhoria?">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-ink">
                    <thead className={THEAD}>
                      <tr>
                        <th className={TH}>Semana de</th>
                        <th className={TH}>Usos com tropeço</th>
                        <th className={TH}>vs. semana anterior</th>
                        <th className={TH}>Meta</th>
                        <th className={TH}>Telas abertas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-paper-line">
                      {report.history.map((h) => {
                        const c = compareLowerIsBetter(
                          h.pct_sessoes_com_friccao_atual,
                          h.pct_sessoes_com_friccao_semana_anterior,
                          h.meta_max_pct_sessoes_com_friccao,
                        );
                        return (
                          <tr key={h.semana} className="hover:bg-paper-subtle/50 transition-colors">
                            <td className="px-4 py-3.5 font-medium">
                              {formatWeek(h.semana)}
                              {h.semana_em_andamento ? " (em andamento)" : ""}
                            </td>
                            <td className="px-4 py-3.5">
                              {formatNumber(h.pct_sessoes_com_friccao_atual)}% <Badge tone={c.tone} />
                            </td>
                            <td className="px-4 py-3.5 text-ink-soft">{describeTrend(c, "pp")}</td>
                            <td className="px-4 py-3.5 text-ink-soft">até {formatNumber(h.meta_max_pct_sessoes_com_friccao)}%</td>
                            <td className="px-4 py-3.5 text-ink-soft">{formatNumber(h.telas_vistas, 0)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}
          </>
        )}

        <details className="rounded-lg border border-paper-line bg-paper p-5 text-sm text-ink-soft shadow-sm">
          <summary className="cursor-pointer font-semibold text-ink">Como ler esta tela</summary>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>Tudo é &quot;quanto menor, melhor&quot;. Cada número vem com a semana passada e uma meta.</li>
            <li>As metas (15% de usos com tropeço, 5 por 100 telas, 10 s até o primeiro clique) são um ponto de partida; ajuste depois de algumas semanas.</li>
            <li>Uma pessoa só repetindo o problema costuma ser dúvida individual; várias pessoas no mesmo ponto indicam problema do sistema.</li>
            <li>Semana em andamento: as porcentagens valem, mas os totais ainda vão crescer.</li>
            <li>Um clique &quot;sem resposta&quot; pode ser falso alarme quando o botão só age nos bastidores. Se o botão é legítimo, dar um aviso na tela (&quot;salvando...&quot;) resolve.</li>
          </ul>
        </details>
      </PageContainer>
    </div>
  );
}
