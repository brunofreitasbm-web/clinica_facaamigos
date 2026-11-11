import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { APPOINTMENT_STATUS_STYLE, GRID_EXCLUDED_STATUSES } from "@/lib/appointment-status-style";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { hourInTimeZone } from "@/lib/timezone";
import {
  BI_EVADED_PATIENT_STATUSES,
  BI_INACTIVE_PATIENT_STATUSES,
  buildPatientCheckinIndex,
  isInPeriod,
  patientDedupeKey,
} from "@/lib/bi-checkin";
import { currentMonthRange } from "../data";
import {
  buildWeekHourHeatmap,
  getOnboardingFunnel,
  getTeamProductivity,
  getPlrTrend,
  buildInsurerConcentration,
  type WeekHourHeatmap,
  type OnboardingFunnel,
  type TeamProductivity,
  type PlrTrend,
  type InsurerConcentration,
} from "./data-quadros";

type Supa = SupabaseClient<Database>;

export type StatusDonutItem = {
  status: string;
  label: string;
  count: number;
  color: string;
  pct: number;
};

export type WeeklyVolumeItem = {
  weekLabel: string;
  count: number;
  startDate: string;
  endDate: string;
};

export type HourlyFlowItem = {
  hour: number;
  label: string;
  checkinCount: number;
  isPeak: boolean;
};

export type LiveRoomItem = {
  roomId: string;
  roomName: string;
  isEvaluationRoom: boolean;
  activePatientsCount: number;
  capacity: number;
  occupancyStatus: "livre" | "movimentada" | "lotada";
};

export type WhatsAppStatItem = {
  totalFirstAppointments: number;
  whatsappCount: number;
  whatsappPct: number;
};

export type InsurerPatientCountItem = {
  insurerId: string;
  insurerName: string;
  patientCount: number;
  percentage: number;
};

export type InsurerRevenueItem = {
  insurerId: string;
  insurerName: string;
  totalRevenue: number;
  percentage: number;
};

export type NewPatientsWeeklyItem = {
  weekLabel: string;
  newCount: number;
};

export type EvadedPatientItem = {
  id: string;
  name: string;
  status: string;
};

export type EvadedPatientsStat = {
  totalEvaded: number;
  evadedRatePct: number;
  list: EvadedPatientItem[];
};

export type RoomRankingItem = {
  roomId: string;
  roomName: string;
  isEvaluationRoom: boolean;
  capacity: number;
  totalRevenue: number;
  paidRevenue: number;
  pendingRevenue: number;
  appointmentsCount: number;
  bookedHours: number;
  occupancyPct: number;
};

export type AniversarianteItem = {
  id: string;
  name: string;
  type: "paciente" | "terapeuta";
  birthDay: number;
  birthMonth: number;
  formattedDate: string;
  age?: number;
  phone?: string | null;
};

/**
 * Leads = cadastros que ainda NÃO fizeram check-in na recepção. Só vira
 * paciente (e entra nos demais quadros) depois do primeiro check-in.
 */
export type LeadsStat = {
  /** Leads em aberto hoje (sem check-in, não evadidos), independente do período. */
  total: number;
  /** Leads com agendamento válido, aguardando o check-in. */
  scheduledNoCheckin: number;
  /** Leads sem nenhum agendamento. */
  noSchedule: number;
  /** Entrada de leads: cadastros criados no período (viraram paciente ou não). */
  newInPeriod: number;
  /** Idem, no período anterior (comparativo obrigatório do BI). */
  newInPrevPeriod: number;
};

export type InteligenciaMetrics = {
  // Atendimentos KPIs (apenas sessões com check-in na recepção)
  totalAppointments: number;
  /** Agendamentos totais no período (com ou sem check-in), para contexto. */
  scheduledAppointments: number;
  prevMonthAppointments: number;
  growthPct: number;

  // Leads (cadastros sem check-in)
  leads: LeadsStat;

  // Financeiro KPIs
  totalCobrancas: number;
  valorTotalCobrancas: number;
  valorRecebido: number;
  valorPendente: number;
  
  // Contagens por Status (Sessões)
  statusDonut: StatusDonutItem[];
  statusTotalCount: number;
  
  // Histórico por Semana
  weeklyVolume: WeeklyVolumeItem[];
  
  // Métricas Gerais
  pacientesAtivos: number;
  equipeCount: number;
  horasEconomizadas: number;
  
  // 7 Novos Quadros Solicitados
  hourlyFlow: HourlyFlowItem[];
  peakHourLabel: string;
  liveRooms: LiveRoomItem[];
  whatsappStat: WhatsAppStatItem;
  patientsByInsurer: InsurerPatientCountItem[];
  revenueByInsurer: InsurerRevenueItem[];
  newPatientsWeekly: NewPatientsWeeklyItem[];
  evadedPatientsStat: EvadedPatientsStat;

  // Aniversariantes
  aniversariantes: AniversarianteItem[];

  // Ranking de Salas
  roomRanking: RoomRankingItem[];
  roomsTotalRevenue: number;
  roomsAvgOccupancyPct: number;

  // Capacidade Operacional da Clínica (indicador em destaque)
  clinicCapacity: ClinicCapacityItem[];
  roomCapacityAlerts: RoomCapacityAlert[];

  // Necessidade de Estagiário (indicador em destaque)
  internShortageAlerts: InternShortageAlert[];
  internCoverage: InternCoverageItem[];
  internCoverageOverallPct: number;

  // Novos quadros
  weekHourHeatmap: WeekHourHeatmap;
  onboardingFunnel: OnboardingFunnel;
  teamProductivity: TeamProductivity;
  plrTrend: PlrTrend;
  insurerConcentration: InsurerConcentration;
};

export type ClinicCapacityPeriodKey = "manha" | "tarde" | "dia" | "semana" | "mes";

export type ClinicCapacityItem = {
  key: ClinicCapacityPeriodKey;
  label: string;
  bookedHours: number;
  availableHours: number;
  occupancyPct: number;
  roomsConsidered: number;
};

export type RoomCapacityAlert = {
  roomId: string;
  roomName: string;
  shift: "manha" | "tarde";
  shiftLabel: string;
  occupancyPct: number;
  bookedHours: number;
  availableHours: number;
  description: string;
};

export type InternShortageAlert = {
  specialtyId: string;
  specialtyLabel: string;
  childrenCount: number;
  internsCount: number;
  deficitPct: number;
  description: string;
};

export type InternCoverageItem = {
  specialtyId: string;
  specialtyLabel: string;
  childrenCount: number;
  internsCount: number;
  coveragePct: number;
  status: "adequada" | "atencao" | "critica" | "sem_demanda";
};

// PostgREST corta em 1000 linhas por resposta; pagina até esgotar para o
// índice de check-ins nunca ficar truncado conforme a clínica cresce.
async function fetchAppointmentHistory(
  supabase: Supa,
  clinicId: string,
): Promise<{ patient_id: string; status: string; checkin_at: string | null }[]> {
  const PAGE = 1000;
  const rows: { patient_id: string; status: string; checkin_at: string | null }[] = [];
  for (let from = 0; from < 100_000; from += PAGE) {
    const { data, error } = await supabase
      .from("appointments")
      .select("patient_id, status, checkin_at, patients!inner(clinic_id)")
      .eq("patients.clinic_id", clinicId)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error || !data) break;
    for (const r of data) rows.push({ patient_id: r.patient_id, status: r.status, checkin_at: r.checkin_at });
    if (data.length < PAGE) break;
  }
  return rows;
}

export async function getInteligenciaMetrics(
  supabase: Supa,
  clinicId: string,
  periodKey: string = "month"
): Promise<InteligenciaMetrics> {
  const { startISO: defaultStart, endISO: defaultEnd } = currentMonthRange();
  
  let startISO = defaultStart;
  let endISO = defaultEnd;

  const now = new Date();
  if (periodKey === "30days") {
    startISO = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    endISO = now.toISOString();
  } else if (periodKey === "prev_month") {
    const prevMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const prevMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59));
    startISO = prevMonthDate.toISOString();
    endISO = prevMonthEnd.toISOString();
  }

  // Janelas "ao vivo" para Capacidade e Salas em Tempo Real
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const weekDayIdx = (now.getDay() + 6) % 7;
  const weekStart = new Date(todayStart.getTime() - weekDayIdx * 24 * 60 * 60 * 1000);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const capacityQueryStart = new Date(Math.min(weekStart.getTime(), monthStart.getTime()));
  const capacityQueryEnd = new Date(Math.max(weekEnd.getTime(), monthEnd.getTime()));

  // Datas período anterior
  const currentStart = new Date(startISO);
  const currentEnd = new Date(endISO);
  const durationMs = Math.max(86400000, currentEnd.getTime() - currentStart.getTime());
  const prevStartISO = new Date(currentStart.getTime() - durationMs).toISOString();
  const prevEndISO = startISO;

  // Promessas paralelas
  const [
    { data: currentAppointments },
    { data: prevAppointments },
    appointmentHistory,
    { data: therapistsList },
    { data: billingItems },
    { data: patientsList },
    { data: profilesList },
    { data: roomsList },
    { data: roomAppointments },
    { data: clinicCapacityAppointments },
    { data: internCheckins },
    { data: specialtiesList },
    { data: liveAppointmentsData },
    { data: insurersList },
    { data: patientInsuranceList },
    { data: allPatientsWithStatus },
    { count: draftsAutomatedCount },
    { count: faqResolvedCount },
    { count: intakeScheduledCount },
  ] = await Promise.all([
    // Atendimentos no período
    supabase
      .from("appointments")
      .select(
        "id, status, starts_at, ends_at, checkin_at, patient_id, room_id, therapist_id, cancelled_at, patients!inner(clinic_id)"
      )
      .eq("patients.clinic_id", clinicId)
      .gte("starts_at", startISO)
      .lt("starts_at", endISO),

    // Atendimentos período anterior
    supabase
      .from("appointments")
      .select("id, status, checkin_at, patients!inner(clinic_id)")
      .eq("patients.clinic_id", clinicId)
      .gte("starts_at", prevStartISO)
      .lt("starts_at", prevEndISO),

    // Histórico completo de agendamentos/check-ins: base da regra
    // "paciente = fez check-in" (lib/bi-checkin.ts). Todos os quadros de
    // pacientes (ativos, planos, aniversários, funil) derivam daqui.
    fetchAppointmentHistory(supabase, clinicId),

    // Equipe/Terapeutas
    supabase
      .from("profiles")
      .select("id, full_name, role, active")
      .eq("clinic_id", clinicId)
      .eq("role", "terapeuta")
      .eq("hidden_in_app", false)
      .eq("active", true),

    // Billing Items (Cobranças) do período — filtradas pela data da sessão
    // (appointments.starts_at), mesma janela usada nos demais cards. Inclui
    // o convênio via billing_periods.insurer_id (join real, não estimativa).
    supabase
      .from("billing_items")
      .select(
        "id, amount, status, paid_at, appointment_id, appointments!inner(room_id, starts_at, patients!inner(clinic_id)), billing_periods!inner(insurer_id, insurers(id, name))"
      )
      .eq("appointments.patients.clinic_id", clinicId)
      .gte("appointments.starts_at", startISO)
      .lt("appointments.starts_at", endISO),

    // Pacientes com Data de Nascimento e Criados
    supabase
      .from("patients")
      .select("id, full_name, birth_date, status, created_at")
      .eq("clinic_id", clinicId),

    // Equipe/Perfis para Aniversariantes
    supabase
      .from("profiles")
      .select("id, full_name, role, active")
      .eq("clinic_id", clinicId)
      .eq("active", true),

    // Salas da clínica
    supabase
      .from("rooms")
      .select("id, name, capacity, specialty_id, is_evaluation_room")
      .eq("clinic_id", clinicId),

    // Atendimentos por Sala no período — só sessões com check-in na recepção
    // (antes contava tudo o que estava na agenda, inclusive o que ainda não aconteceu).
    supabase
      .from("appointments")
      .select("id, room_id, starts_at, ends_at, status, patients!inner(clinic_id)")
      .eq("patients.clinic_id", clinicId)
      .not("checkin_at", "is", null)
      .not("status", "in", `(${GRID_EXCLUDED_STATUSES.join(",")})`)
      .gte("starts_at", startISO)
      .lt("starts_at", endISO),

    // Atendimentos para capacidade/ocupação — também só com check-in
    supabase
      .from("appointments")
      .select("id, room_id, starts_at, ends_at, status, patients!inner(clinic_id)")
      .eq("patients.clinic_id", clinicId)
      .not("checkin_at", "is", null)
      .not("status", "in", `(${GRID_EXCLUDED_STATUSES.join(",")})`)
      .gte("starts_at", capacityQueryStart.toISOString())
      .lt("starts_at", capacityQueryEnd.toISOString()),

    // Check-ins da semana atual
    supabase
      .from("appointments")
      .select(
        "id, patient_id, checkin_at, room_id, appointment_types(requires_intern_ratio), patients!inner(clinic_id)"
      )
      .eq("patients.clinic_id", clinicId)
      .not("checkin_at", "is", null)
      .gte("checkin_at", weekStart.toISOString())
      .lt("checkin_at", weekEnd.toISOString()),

    // Especialidades da clínica
    supabase.from("specialties").select("id, label, intern_count").eq("clinic_id", clinicId).eq("active", true),

    // Atendimentos EM TEMPO REAL: só quem já fez check-in e ainda não saiu
    // (checkout_at nulo). Sessão apenas agendada para este horário não conta.
    supabase
      .from("appointments")
      .select("id, room_id, starts_at, ends_at, status, patient_id, patients!inner(clinic_id)")
      .eq("patients.clinic_id", clinicId)
      .not("checkin_at", "is", null)
      .is("checkout_at", null)
      .not("status", "in", `(${GRID_EXCLUDED_STATUSES.join(",")})`)
      .lte("starts_at", now.toISOString())
      .gte("ends_at", now.toISOString()),

    // Convênios cadastrados na clínica
    supabase
      .from("insurers")
      .select("id, name")
      .eq("clinic_id", clinicId),

    // Vínculo de convênios de todos os cadastros da clínica; o filtro para
    // "só quem fez check-in" é feito em memória com o índice de check-ins.
    supabase
      .from("patient_insurance")
      .select("patient_id, insurer_id, is_private, insurers(id, name), patients!inner(clinic_id, status)")
      .eq("patients.clinic_id", clinicId),

    // Todos os pacientes da clínica com status e marcos de estágio
    // (created_at/first_contact_at/evaluated_at/first_session_at/entry_source)
    // — usados no Funil de Onboarding e no card real de "via WhatsApp".
    supabase
      .from("patients")
      .select("id, full_name, status, created_at, entry_source, first_contact_at, evaluated_at, first_session_at")
      .eq("clinic_id", clinicId),

    // Pré-cadastros extraídos pela IA e validados sem retrabalho manual (Horas Economizadas)
    supabase
      .from("registration_drafts")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .not("processed_at", "is", null)
      .not("validated_at", "is", null)
      .gte("validated_at", startISO)
      .lt("validated_at", endISO),

    // Conversas de FAQ resolvidas pelo bot sem escalar para humano (Horas Economizadas)
    // kind="patient" são conversas gerais (FAQ); kind="lead" são de convênio, já contadas
    // via insurance_intake_leads abaixo — sem isso o mesmo atendimento entraria duas vezes.
    supabase
      .from("twilio_conversations")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("kind", "patient")
      .is("escalated_at", null)
      .gte("last_message_at", startISO)
      .lt("last_message_at", endISO),

    // Leads de convênio com laudo/guia coletados e agendamento feito pelo bot (Horas Economizadas)
    supabase
      .from("insurance_intake_leads")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .not("scheduled_at", "is", null)
      .gte("scheduled_at", startISO)
      .lt("scheduled_at", endISO),
  ]);

  const appointments = currentAppointments ?? [];
  const prevApps = prevAppointments ?? [];

  // Regra do BI: só conta atendimento quem fez check-in na recepção.
  // `appointments` (agenda completa) segue sendo usado só no quadro de status.
  const attendedAppointments = appointments.filter((a) => !!a.checkin_at);
  const scheduledAppointments = appointments.length;
  const totalAppointments = attendedAppointments.length;
  const prevMonthAppointments = prevApps.filter((a) => !!a.checkin_at).length;

  // Índice de check-ins (histórico inteiro) → quem é paciente e quem é lead.
  const checkinIndex = buildPatientCheckinIndex(appointmentHistory ?? [], GRID_EXCLUDED_STATUSES);

  let growthPct = 0;
  if (prevMonthAppointments > 0) {
    growthPct = Math.round(((totalAppointments - prevMonthAppointments) / prevMonthAppointments) * 10000) / 100;
  } else if (totalAppointments > 0) {
    growthPct = 100;
  }

  // 1. Sessões por Status para Donut Chart
  const statusCounts = new Map<string, number>();
  for (const app of appointments) {
    statusCounts.set(app.status, (statusCounts.get(app.status) ?? 0) + 1);
  }

  const COLOR_MAP: Record<string, string> = {
    realizada: "#84cc16",
    agendada: "#38bdf8",
    cancelada: "#f43f5e",
    falta: "#fbbf24",
    confirmada: "#10b981",
    em_atendimento: "#a855f7",
    outros: "#64748b",
  };

  let statusTotalCount = 0;
  const statusDonutRaw: { status: string; label: string; count: number; color: string }[] = [];

  for (const [statusKey, style] of Object.entries(APPOINTMENT_STATUS_STYLE)) {
    const count = statusCounts.get(statusKey) ?? 0;
    if (count > 0) {
      statusTotalCount += count;
      statusDonutRaw.push({
        status: statusKey,
        label: style.label,
        count,
        color: COLOR_MAP[statusKey] || "#64748b",
      });
    }
  }

  const registeredCount = statusDonutRaw.reduce((sum, item) => sum + item.count, 0);
  if (scheduledAppointments > registeredCount) {
    const remaining = scheduledAppointments - registeredCount;
    statusTotalCount += remaining;
    statusDonutRaw.push({
      status: "outros",
      label: "Outros",
      count: remaining,
      color: COLOR_MAP.outros,
    });
  }

  const statusDonut: StatusDonutItem[] = statusDonutRaw.map((item) => ({
    ...item,
    pct: statusTotalCount > 0 ? Math.round((item.count / statusTotalCount) * 1000) / 10 : 0,
  }));

  // 2. Histórico Semanal de Sessões e Novos Pacientes
  const weeklyVolume: WeeklyVolumeItem[] = [];
  const newPatientsWeekly: NewPatientsWeeklyItem[] = [];

  const currStart = new Date(startISO);
  const currEnd = new Date(endISO);
  const rangeDays = Math.ceil((currEnd.getTime() - currStart.getTime()) / (1000 * 60 * 60 * 24));
  const weekStep = Math.max(7, Math.ceil(rangeDays / 4));

  let weekPointer = new Date(currStart);
  let weekIndex = 1;

  const items = billingItems ?? [];
  const allPats = allPatientsWithStatus ?? [];

  while (weekPointer < currEnd) {
    const nextWeek = new Date(Math.min(currEnd.getTime(), weekPointer.getTime() + weekStep * 24 * 60 * 60 * 1000));
    
    // Sessões COM check-in na semana
    const count = attendedAppointments.filter((app) => {
      const appDate = new Date(app.starts_at);
      return appDate >= weekPointer && appDate < nextWeek;
    }).length;

    // Novos pacientes na semana = 1º check-in na recepção caiu na semana
    // (cadastro sem check-in é lead, não paciente).
    const newCount = allPats.filter((p) => {
      const firstCheckin = checkinIndex.firstCheckinAt.get(p.id);
      if (!firstCheckin) return false;
      const cdate = new Date(firstCheckin);
      return cdate >= weekPointer && cdate < nextWeek;
    }).length;

    const startLabel = weekPointer.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    const weekLabel = `Semana ${weekIndex} (${startLabel})`;

    weeklyVolume.push({
      weekLabel,
      count,
      startDate: weekPointer.toISOString(),
      endDate: nextWeek.toISOString(),
    });

    newPatientsWeekly.push({
      weekLabel,
      newCount,
    });

    weekPointer = nextWeek;
    weekIndex++;
  }

  // 3. Faturamento & Cobranças Consolidadas
  const totalCobrancas = items.length;
  let valorTotalCobrancas = 0;
  let valorRecebido = 0;
  let valorPendente = 0;

  for (const item of items) {
    const val = Number(item.amount || 0);
    valorTotalCobrancas += val;
    if (item.status === "pago" || item.paid_at != null) {
      valorRecebido += val;
    } else {
      valorPendente += val;
    }
  }

  // 4. Horas Economizadas com Automação
  // Baseado em volume real de eventos tratados ponta-a-ponta pelos bots Twilio no
  // período, sem intervenção humana — não numa proporção fixa por agendamento.
  // Tempos manuais estimados por evento (contexto de recepção de clínica):
  //   - pré-cadastro (lib/registration-drafts-ingest.ts): ~4min digitando dados
  //     manualmente a partir de foto de documento (nome/CPF/nascimento/responsável/convênio)
  //   - FAQ (lib/twilio-faq-bot.ts): ~2min respondendo dúvida por WhatsApp
  //   - intake de convênio (lib/twilio-intake-bot.ts): ~10min coletando laudo/guia
  //     por telefone e oferecendo horários manualmente
  const MIN_PER_DRAFT_AUTOMATED = 4;
  const MIN_PER_FAQ_RESOLVED = 2;
  const MIN_PER_INTAKE_SCHEDULED = 10;
  const horasEconomizadas =
    Math.round(
      ((draftsAutomatedCount ?? 0) * MIN_PER_DRAFT_AUTOMATED +
        (faqResolvedCount ?? 0) * MIN_PER_FAQ_RESOLVED +
        (intakeScheduledCount ?? 0) * MIN_PER_INTAKE_SCHEDULED) /
        60
    );

  // --- 7 NOVOS QUADROS SOLICITADOS ---

  // QUADRO 1: Fluxo de Pacientes por Horário (08:00 às 18:00)
  const hourlyMap = new Map<number, number>();
  for (let h = 8; h <= 18; h++) {
    hourlyMap.set(h, 0);
  }

  // Só check-ins reais, no horário civil da clínica. Antes caía no horário
  // agendado quando não havia check-in e usava getHours() (UTC na Vercel),
  // deslocando o gráfico em 3h.
  for (const app of attendedAppointments) {
    const hour = hourInTimeZone(app.checkin_at!, CLINIC_TIMEZONE);
    if (hour >= 8 && hour <= 18) {
      hourlyMap.set(hour, (hourlyMap.get(hour) ?? 0) + 1);
    }
  }

  let maxCheckins = 0;
  let peakHour = 8;
  for (const [h, cnt] of hourlyMap.entries()) {
    if (cnt > maxCheckins) {
      maxCheckins = cnt;
      peakHour = h;
    }
  }

  const hourlyFlow: HourlyFlowItem[] = [];
  for (let h = 8; h <= 18; h++) {
    const checkinCount = hourlyMap.get(h) ?? 0;
    hourlyFlow.push({
      hour: h,
      label: `${String(h).padStart(2, "0")}:00`,
      checkinCount,
      isPeak: h === peakHour && maxCheckins > 0,
    });
  }
  const peakHourLabel = maxCheckins > 0 ? `${String(peakHour).padStart(2, "0")}:00` : "08:00";

  // QUADRO 2: Salas em Tempo Real (Top 8 salas com atendimentos agora)
  const liveRoomCounts = new Map<string, number>();
  for (const app of liveAppointmentsData ?? []) {
    if (app.room_id) {
      liveRoomCounts.set(app.room_id, (liveRoomCounts.get(app.room_id) ?? 0) + 1);
    }
  }

  // A Sala de Avaliação (rooms.is_evaluation_room) entra na visão operacional como
  // qualquer outra sala — antes era removida por regex no nome, o que a escondia
  // de "Salas em Tempo Real", do ranking e dos alertas de capacidade.
  const rooms = roomsList ?? [];

  const liveRoomsRaw: LiveRoomItem[] = rooms.map((r) => {
    const activePatientsCount = liveRoomCounts.get(r.id) ?? 0;
    const capacity = r.capacity || 1;
    const occupancyStatus: "livre" | "movimentada" | "lotada" =
      activePatientsCount === 0
        ? "livre"
        : activePatientsCount >= capacity
          ? "lotada"
          : "movimentada";

    return {
      roomId: r.id,
      roomName: r.name,
      isEvaluationRoom: r.is_evaluation_room,
      activePatientsCount,
      capacity,
      occupancyStatus,
    };
  });

  liveRoomsRaw.sort((a, b) => b.activePatientsCount - a.activePatientsCount);
  const liveRooms = liveRoomsRaw.slice(0, 8);

  // QUADRO 3: Primeiros Agendamentos via WhatsApp
  // Cohort real: pacientes NOVOS no período (1º check-in na recepção dentro do
  // período), com origem de entrada via chatbot Twilio (entry_source). Cadastro
  // sem check-in é lead e não entra aqui.
  const WHATSAPP_ENTRY_SOURCES = new Set(["chatbot_whatsapp", "acolhimento_plano_saude"]);
  const isWhatsAppEntry = (entrySource: string | null) =>
    !!entrySource && (WHATSAPP_ENTRY_SOURCES.has(entrySource) || /whats|zap/i.test(entrySource));

  // Base de pacientes pela regra do check-in: só entra quem já foi à recepção.
  // Quem tem cadastro/agendamento/guia sem check-in é lead (ver `leads` abaixo).
  const patientRows = allPats.filter((p) => checkinIndex.checkedInIds.has(p.id));
  const activePatientRows = patientRows.filter(
    (p) => !(BI_INACTIVE_PATIENT_STATUSES as readonly string[]).includes(p.status),
  );
  const activePatientIds = new Set(activePatientRows.map((p) => p.id));
  const activePatientsCount = activePatientRows.length;

  // Cohort do card: pacientes NOVOS no período = 1º check-in dentro do período.
  const newPatientsCohort = patientRows.filter((p) =>
    isInPeriod(checkinIndex.firstCheckinAt.get(p.id), startISO, endISO),
  );
  const totalFirst = newPatientsCohort.length;
  const whatsappCount = newPatientsCohort.filter((p) => isWhatsAppEntry(p.entry_source)).length;
  const whatsappStat: WhatsAppStatItem = {
    totalFirstAppointments: totalFirst,
    whatsappCount,
    whatsappPct: totalFirst > 0 ? Math.round((whatsappCount / totalFirst) * 100) : 0,
  };

  // QUADRO 4: Pacientes por Plano de Saúde / Convênio
  const insurerPatientMap = new Map<string, { name: string; count: number }>();
  for (const ins of insurersList ?? []) {
    insurerPatientMap.set(ins.id, { name: ins.name, count: 0 });
  }

  // Só pacientes (com check-in). Cada paciente é contado uma única vez, no
  // primeiro convênio encontrado; quem não tem convênio (ou é marcado como
  // particular) cai em "Particular / sem convênio" com a contagem real — antes
  // havia um piso de 1 e 8 pacientes ficavam fora da soma.
  const PARTICULAR_ID = "particular";
  insurerPatientMap.set(PARTICULAR_ID, { name: "Particular / sem convênio", count: 0 });
  const patientsWithInsurer = new Set<string>();
  for (const pi of patientInsuranceList ?? []) {
    if (!activePatientIds.has(pi.patient_id) || patientsWithInsurer.has(pi.patient_id)) continue;
    if (pi.is_private || !pi.insurer_id) continue;
    const insObj = Array.isArray(pi.insurers) ? pi.insurers[0] : pi.insurers;
    if (!insurerPatientMap.has(pi.insurer_id)) {
      insurerPatientMap.set(pi.insurer_id, { name: insObj?.name || "Plano de Saúde", count: 0 });
    }
    insurerPatientMap.get(pi.insurer_id)!.count++;
    patientsWithInsurer.add(pi.patient_id);
  }
  insurerPatientMap.get(PARTICULAR_ID)!.count = activePatientsCount - patientsWithInsurer.size;

  const activeTotalPats = Math.max(1, activePatientsCount);
  const patientsByInsurer: InsurerPatientCountItem[] = [...insurerPatientMap.entries()]
    .map(([insurerId, item]) => ({
      insurerId,
      insurerName: item.name,
      patientCount: item.count,
      percentage: Math.round((item.count / activeTotalPats) * 100),
    }))
    .sort((a, b) => b.patientCount - a.patientCount);

  // QUADRO 5: Plano de Saúde por Faturamento — join real via
  // billing_items.billing_period_id -> billing_periods.insurer_id (antes
  // a atribuição era aleatória por item.id.charCodeAt(0) % n).
  const insurerRevMap = new Map<string, { name: string; rev: number }>();

  for (const item of items) {
    const bp = Array.isArray(item.billing_periods) ? item.billing_periods[0] : item.billing_periods;
    if (!bp || item.status === "glosado") continue;
    const insObj = Array.isArray(bp.insurers) ? bp.insurers[0] : bp.insurers;
    const insId = bp.insurer_id;
    const insName = insObj?.name ?? "Plano de Saúde";
    const val = Number(item.amount || 0);

    if (!insurerRevMap.has(insId)) {
      insurerRevMap.set(insId, { name: insName, rev: 0 });
    }
    const curr = insurerRevMap.get(insId)!;
    curr.rev += val;
  }

  const grandTotalRev = Math.max(1, [...insurerRevMap.values()].reduce((sum, i) => sum + i.rev, 0));
  const revenueByInsurer: InsurerRevenueItem[] = [...insurerRevMap.entries()]
    .map(([insurerId, item]) => ({
      insurerId,
      insurerName: item.name,
      totalRevenue: item.rev,
      percentage: Math.round((item.rev / grandTotalRev) * 100),
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  // Concentração por convênio (top-3 share + ticket médio por sessão) —
  // deriva do mesmo `items` já filtrado por período, join real.
  const insurerConcentration = buildInsurerConcentration(items);

  // QUADRO 7: Pacientes Evadidos
  // Só pacientes (com check-in) podem "evadir"; lead que sumiu não é evasão.
  const evadedList: EvadedPatientItem[] = patientRows
    .filter((p) => (BI_EVADED_PATIENT_STATUSES as readonly string[]).includes(p.status))
    .map((p) => ({
      id: p.id,
      name: p.full_name,
      status: p.status || "inativo",
    }));

  const totalEvaded = evadedList.length;
  const totalAllPats = Math.max(1, patientRows.length);
  const evadedRatePct = Math.round((totalEvaded / totalAllPats) * 100);
  const evadedPatientsStat: EvadedPatientsStat = {
    totalEvaded,
    evadedRatePct,
    list: evadedList.slice(0, 10),
  };

  // 5. Aniversariantes do Mês
  const targetMonth = currentStart.getMonth() + 1;
  const aniversariantes: AniversarianteItem[] = [];

  // Só pacientes (com check-in) e sem cadastro duplicado (mesmo nome + nascimento):
  // o botão "Enviar Parabéns" dispara WhatsApp, então lead não pode aparecer aqui.
  const seenBirthdayKeys = new Set<string>();
  for (const pat of patientsList ?? []) {
    if (!pat.birth_date) continue;
    if (!checkinIndex.checkedInIds.has(pat.id)) continue;
    const dedupeKey = patientDedupeKey(pat.full_name, pat.birth_date);
    if (seenBirthdayKeys.has(dedupeKey)) continue;
    seenBirthdayKeys.add(dedupeKey);
    const bdate = new Date(pat.birth_date);
    const bMonth = bdate.getUTCMonth() + 1;
    const bDay = bdate.getUTCDate();

    if (bMonth === targetMonth) {
      const todayYear = new Date().getFullYear();
      const age = todayYear - bdate.getUTCFullYear();
      aniversariantes.push({
        id: pat.id,
        name: pat.full_name,
        type: "paciente",
        birthDay: bDay,
        birthMonth: bMonth,
        formattedDate: `${String(bDay).padStart(2, "0")}/${String(bMonth).padStart(2, "0")}`,
        age: age > 0 && age < 120 ? age : undefined,
      });
    }
  }

  for (const prof of profilesList ?? []) {
    if (prof.role === "terapeuta") {
      // Simulação para terapeutas
    }
  }

  aniversariantes.sort((a, b) => a.birthDay - b.birthDay);

  // 6. Ranking de Salas (faturamento + taxa de ocupação)
  const HOURS_PER_BUSINESS_DAY = 10;
  let businessDaysInPeriod = 0;
  for (let d = new Date(currentStart); d < currentEnd; d.setDate(d.getDate() + 1)) {
    const weekday = d.getDay();
    if (weekday !== 0 && weekday !== 6) businessDaysInPeriod++;
  }
  const availableHoursPerRoom = Math.max(1, businessDaysInPeriod) * HOURS_PER_BUSINESS_DAY;

  type RoomAcc = {
    roomName: string;
    capacity: number;
    isEvaluationRoom: boolean;
    totalRevenue: number;
    paidRevenue: number;
    pendingRevenue: number;
    appointmentsCount: number;
    bookedHours: number;
  };
  const roomAcc = new Map<string, RoomAcc>();

  for (const room of roomsList ?? []) {
    roomAcc.set(room.id, {
      roomName: room.name,
      capacity: room.capacity,
      isEvaluationRoom: room.is_evaluation_room,
      totalRevenue: 0,
      paidRevenue: 0,
      pendingRevenue: 0,
      appointmentsCount: 0,
      bookedHours: 0,
    });
  }

  for (const app of roomAppointments ?? []) {
    if (!app.room_id) continue;
    const acc = roomAcc.get(app.room_id);
    if (!acc) continue;
    acc.appointmentsCount++;
    const durationHours = (new Date(app.ends_at).getTime() - new Date(app.starts_at).getTime()) / (1000 * 60 * 60);
    if (durationHours > 0) acc.bookedHours += durationHours;
  }

  for (const item of items) {
    const appRow = Array.isArray(item.appointments) ? item.appointments[0] : item.appointments;
    const roomId = appRow?.room_id ?? null;
    if (!roomId) continue;
    const acc = roomAcc.get(roomId);
    if (!acc) continue;
    const val = Number(item.amount || 0);
    acc.totalRevenue += val;
    if (item.status === "pago" || item.paid_at != null) {
      acc.paidRevenue += val;
    } else {
      acc.pendingRevenue += val;
    }
  }

  const roomRanking: RoomRankingItem[] = [...roomAcc.entries()]
    .map(([roomId, acc]) => ({
      roomId,
      roomName: acc.roomName,
      capacity: acc.capacity,
      isEvaluationRoom: acc.isEvaluationRoom,
      totalRevenue: acc.totalRevenue,
      paidRevenue: acc.paidRevenue,
      pendingRevenue: acc.pendingRevenue,
      appointmentsCount: acc.appointmentsCount,
      bookedHours: Math.round(acc.bookedHours * 10) / 10,
      occupancyPct: Math.min(100, Math.round((acc.bookedHours / availableHoursPerRoom) * 1000) / 10),
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  const roomsTotalRevenue = roomRanking.reduce((sum, r) => sum + r.totalRevenue, 0);
  const roomsAvgOccupancyPct =
    roomRanking.length > 0
      ? Math.round((roomRanking.reduce((sum, r) => sum + r.occupancyPct, 0) / roomRanking.length) * 10) / 10
      : 0;

  // 7. Capacidade Operacional da Clínica
  function countBusinessDays(start: Date, end: Date): number {
    let count = 0;
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      const weekday = d.getDay();
      if (weekday !== 0 && weekday !== 6) count++;
    }
    return count;
  }

  const roomsConsidered = roomAcc.size;
  const isTodayBusinessDay = countBusinessDays(todayStart, todayEnd) > 0;
  const businessDaysThisWeek = countBusinessDays(weekStart, weekEnd);
  const businessDaysThisMonth = countBusinessDays(monthStart, monthEnd);

  const HOURS_MANHA = 4;
  const HOURS_TARDE = 5;
  const HOURS_DIA = 10;

  let manhaHours = 0;
  let tardeHours = 0;
  let diaHours = 0;
  let semanaHours = 0;
  let mesHours = 0;

  type ShiftAcc = { manha: number; tarde: number };
  const roomWeeklyShift = new Map<string, ShiftAcc>();

  for (const app of clinicCapacityAppointments ?? []) {
    if (!app.room_id || !roomAcc.has(app.room_id)) continue;
    const appStart = new Date(app.starts_at);
    const durationHours = (new Date(app.ends_at).getTime() - appStart.getTime()) / (1000 * 60 * 60);
    if (durationHours <= 0) continue;

    if (appStart >= monthStart && appStart < monthEnd) mesHours += durationHours;

    const inCurrentWeek = appStart >= weekStart && appStart < weekEnd;
    if (inCurrentWeek) {
      semanaHours += durationHours;
      const shiftAcc = roomWeeklyShift.get(app.room_id) ?? { manha: 0, tarde: 0 };
      if (appStart.getHours() < 12) shiftAcc.manha += durationHours;
      else shiftAcc.tarde += durationHours;
      roomWeeklyShift.set(app.room_id, shiftAcc);
    }

    if (appStart >= todayStart && appStart < todayEnd) {
      diaHours += durationHours;
      if (appStart.getHours() < 12) manhaHours += durationHours;
      else tardeHours += durationHours;
    }
  }

  const capacityBuckets: { key: ClinicCapacityPeriodKey; label: string; bookedHours: number; availableHours: number }[] = [
    { key: "manha", label: "Manhã (hoje)", bookedHours: manhaHours, availableHours: roomsConsidered * (isTodayBusinessDay ? HOURS_MANHA : 0) },
    { key: "tarde", label: "Tarde (hoje)", bookedHours: tardeHours, availableHours: roomsConsidered * (isTodayBusinessDay ? HOURS_TARDE : 0) },
    { key: "dia", label: "Hoje (dia todo)", bookedHours: diaHours, availableHours: roomsConsidered * (isTodayBusinessDay ? HOURS_DIA : 0) },
    { key: "semana", label: "Semana atual", bookedHours: semanaHours, availableHours: roomsConsidered * businessDaysThisWeek * HOURS_DIA },
    { key: "mes", label: "Mês atual", bookedHours: mesHours, availableHours: roomsConsidered * businessDaysThisMonth * HOURS_DIA },
  ];

  const clinicCapacity: ClinicCapacityItem[] = capacityBuckets.map((b) => ({
    key: b.key,
    label: b.label,
    bookedHours: Math.round(b.bookedHours * 10) / 10,
    availableHours: Math.round(b.availableHours * 10) / 10,
    occupancyPct: b.availableHours > 0 ? Math.min(100, Math.round((b.bookedHours / b.availableHours) * 1000) / 10) : 0,
    roomsConsidered,
  }));

  const CAPACITY_ALERT_THRESHOLD_PCT = 80;
  const roomCapacityAlerts: RoomCapacityAlert[] = [];

  for (const [roomId, acc] of roomAcc.entries()) {
    const shiftAcc = roomWeeklyShift.get(roomId) ?? { manha: 0, tarde: 0 };

    const shiftDefs: { shift: "manha" | "tarde"; shiftLabel: string; bookedHours: number; hoursPerDay: number }[] = [
      { shift: "manha", shiftLabel: "Manhã", bookedHours: shiftAcc.manha, hoursPerDay: HOURS_MANHA },
      { shift: "tarde", shiftLabel: "Tarde", bookedHours: shiftAcc.tarde, hoursPerDay: HOURS_TARDE },
    ];

    for (const def of shiftDefs) {
      const availableHours = businessDaysThisWeek * def.hoursPerDay;
      if (availableHours <= 0) continue;
      const occupancyPct = Math.round((def.bookedHours / availableHours) * 1000) / 10;
      if (occupancyPct >= CAPACITY_ALERT_THRESHOLD_PCT) {
        roomCapacityAlerts.push({
          roomId,
          roomName: acc.roomName,
          shift: def.shift,
          shiftLabel: def.shiftLabel,
          occupancyPct: Math.min(100, occupancyPct),
          bookedHours: Math.round(def.bookedHours * 10) / 10,
          availableHours,
          description: `${acc.roomName} está a ${Math.min(100, occupancyPct)}% da capacidade no turno da ${def.shiftLabel.toLowerCase()} nesta semana.`,
        });
      }
    }
  }

  roomCapacityAlerts.sort((a, b) => b.occupancyPct - a.occupancyPct);

  const INTERN_DEFICIT_ALERT_THRESHOLD_PCT = 20;
  const roomSpecialtyMap = new Map((roomsList ?? []).map((r) => [r.id, r.specialty_id]));
  const childrenBySpecialty = new Map<string, Set<string>>();

  for (const app of internCheckins ?? []) {
    if (!app.patient_id || !app.room_id) continue;
    const specialtyId = roomSpecialtyMap.get(app.room_id);
    if (!specialtyId) continue;
    const appointmentType = app.appointment_types as { requires_intern_ratio: boolean } | null;
    const requiresInternRatio = appointmentType?.requires_intern_ratio ?? true;
    if (!requiresInternRatio) continue;

    const children = childrenBySpecialty.get(specialtyId) ?? new Set<string>();
    children.add(app.patient_id);
    childrenBySpecialty.set(specialtyId, children);
  }

  const internShortageAlerts: InternShortageAlert[] = [];
  const internCoverage: InternCoverageItem[] = [];
  let coverageChildrenTotal = 0;
  let coverageInternsTotal = 0;

  for (const specialty of specialtiesList ?? []) {
    const childrenCount = childrenBySpecialty.get(specialty.id)?.size ?? 0;
    const internsCount = specialty.intern_count;

    const coveragePct =
      childrenCount === 0 ? 0 : Math.round((internsCount / childrenCount) * 1000) / 10;
    internCoverage.push({
      specialtyId: specialty.id,
      specialtyLabel: specialty.label,
      childrenCount,
      internsCount,
      coveragePct,
      status:
        childrenCount === 0
          ? "sem_demanda"
          : coveragePct >= 100
            ? "adequada"
            : coveragePct >= 100 - INTERN_DEFICIT_ALERT_THRESHOLD_PCT
              ? "atencao"
              : "critica",
    });
    if (childrenCount > 0) {
      coverageChildrenTotal += childrenCount;
      coverageInternsTotal += internsCount;
    }

    if (childrenCount === 0) continue;

    const deficitPct = Math.round(((childrenCount - internsCount) / childrenCount) * 1000) / 10;
    if (deficitPct >= INTERN_DEFICIT_ALERT_THRESHOLD_PCT) {
      internShortageAlerts.push({
        specialtyId: specialty.id,
        specialtyLabel: specialty.label,
        childrenCount,
        internsCount,
        deficitPct,
        description: `${specialty.label} teve ${childrenCount} criança(s) com check-in nesta semana e apenas ${internsCount} estagiário(s) contratado(s).`,
      });
    }
  }

  internShortageAlerts.sort((a, b) => b.deficitPct - a.deficitPct);

  internCoverage.sort((a, b) => {
    if (a.status === "sem_demanda" && b.status !== "sem_demanda") return 1;
    if (b.status === "sem_demanda" && a.status !== "sem_demanda") return -1;
    if (a.status === "sem_demanda" && b.status === "sem_demanda") {
      return a.specialtyLabel.localeCompare(b.specialtyLabel, "pt-BR");
    }
    return a.coveragePct - b.coveragePct;
  });

  const internCoverageOverallPct =
    coverageChildrenTotal === 0
      ? 0
      : Math.round((coverageInternsTotal / coverageChildrenTotal) * 1000) / 10;

  // Novos quadros — reaproveitam appointments/pacientes/terapeutas já buscados acima
  const weekHourHeatmap = buildWeekHourHeatmap(attendedAppointments);

  // Leads = cadastros sem check-in (e ainda não evadidos). Comparativo: entrada
  // de cadastros no período anterior.
  const leadRows = allPats.filter(
    (p) =>
      !checkinIndex.checkedInIds.has(p.id) &&
      !(BI_INACTIVE_PATIENT_STATUSES as readonly string[]).includes(p.status),
  );
  const leads: LeadsStat = {
    total: leadRows.length,
    scheduledNoCheckin: leadRows.filter((p) => checkinIndex.scheduledIds.has(p.id)).length,
    noSchedule: leadRows.filter((p) => !checkinIndex.scheduledIds.has(p.id)).length,
    newInPeriod: allPats.filter((p) => isInPeriod(p.created_at, startISO, endISO)).length,
    newInPrevPeriod: allPats.filter((p) => isInPeriod(p.created_at, prevStartISO, prevEndISO)).length,
  };

  const [onboardingFunnel, teamProductivity, plrTrend] = await Promise.all([
    getOnboardingFunnel(supabase, clinicId, startISO, endISO, allPats, checkinIndex),
    getTeamProductivity(supabase, clinicId, appointments, therapistsList ?? [], startISO, endISO),
    getPlrTrend(supabase, clinicId),
  ]);

  return {
    totalAppointments,
    scheduledAppointments,
    prevMonthAppointments,
    growthPct,
    leads,
    totalCobrancas,
    valorTotalCobrancas,
    valorRecebido,
    valorPendente,
    statusDonut,
    statusTotalCount,
    weeklyVolume,
    pacientesAtivos: activePatientsCount,
    equipeCount: (therapistsList ?? []).length,
    horasEconomizadas,

    // 7 novos quadros
    hourlyFlow,
    peakHourLabel,
    liveRooms,
    whatsappStat,
    patientsByInsurer,
    revenueByInsurer,
    newPatientsWeekly,
    evadedPatientsStat,

    aniversariantes,
    roomRanking,
    roomsTotalRevenue,
    roomsAvgOccupancyPct,
    clinicCapacity,
    roomCapacityAlerts,
    internShortageAlerts,
    internCoverage,
    internCoverageOverallPct,

    weekHourHeatmap,
    onboardingFunnel,
    teamProductivity,
    plrTrend,
    insurerConcentration,
  };
}
