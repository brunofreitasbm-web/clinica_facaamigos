export type AvailabilityWindow = {
  day_of_week: number;
  start_time: string;
  end_time: string;
};

const DAYS = [
  { index: 1, label: "Segunda" },
  { index: 2, label: "Terça" },
  { index: 3, label: "Quarta" },
  { index: 4, label: "Quinta" },
  { index: 5, label: "Sexta" },
  { index: 6, label: "Sábado" },
  { index: 0, label: "Domingo" },
];

function formatTime(t: string) {
  return t.slice(0, 5);
}

/**
 * Janela de atendimento cadastrada para o terapeuta, somente leitura.
 *
 * O terapeuta não altera a própria disponibilidade — o cadastro é exclusivo
 * da supervisão/gestão em /supervisao/disponibilidade (decisão do dono do
 * produto em 2026-09-09, que descartou a ideia de auto-ajuste com 10 dias de
 * antecedência). Aqui ele só vê o que está valendo, porque é essa janela que
 * bloqueia agendamento fora do expediente
 * (trigger `appointments_availability_guard`).
 */
export function MyAvailability({ windows }: { windows: AvailabilityWindow[] }) {
  const byDay = DAYS.map((day) => ({
    ...day,
    blocks: windows
      .filter((w) => w.day_of_week === day.index)
      .sort((a, b) => a.start_time.localeCompare(b.start_time)),
  }));

  const hasAny = windows.length > 0;

  return (
    <details className="rounded-lg border border-paper-line bg-white px-4 py-3 shadow-sm">
      <summary className="cursor-pointer text-sm font-bold text-ink">
        Minha disponibilidade
        <span className="ml-2 text-xs font-semibold text-ink-faint">
          {hasAny ? "janela cadastrada pela supervisão" : "nenhuma janela cadastrada"}
        </span>
      </summary>

      {hasAny ? (
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {byDay.map((day) => (
            <div key={day.index} className="flex items-baseline justify-between gap-3">
              <dt className="text-xs font-bold uppercase tracking-wide text-ink-soft">{day.label}</dt>
              <dd className="m-0 flex flex-wrap justify-end gap-1">
                {day.blocks.length === 0 ? (
                  <span className="text-xs text-ink-faint">—</span>
                ) : (
                  day.blocks.map((block) => (
                    <span
                      key={`${block.start_time}-${block.end_time}`}
                      className="rounded-md bg-chart-soft px-2 py-0.5 text-[11px] font-semibold tabular-nums text-chart-strong"
                    >
                      {formatTime(block.start_time)}–{formatTime(block.end_time)}
                    </span>
                  ))
                )}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-3 mb-0 text-xs text-ink-faint">
          A supervisão ainda não cadastrou dias e horários de atendimento para este perfil.
        </p>
      )}

      <p className="mt-3 mb-0 text-xs text-ink-faint">
        Só a supervisão altera esta janela — para mudar seu expediente, fale com a coordenação.
      </p>
    </details>
  );
}
