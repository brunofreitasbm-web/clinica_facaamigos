import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { APPOINTMENT_STATUS_STYLE } from "@/lib/appointment-status-style";
import { currentMonthRange } from "../data";

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

export type StatusValueBreakdown = {
  statusKey: string;
  label: string;
  count: number;
  amount: number;
  color: string;
};

export type RoomRankingItem = {
  roomId: string;
  roomName: string;
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

export type InteligenciaMetrics = {
  // Atendimentos KPIs
  totalAppointments: number;
  prevMonthAppointments: number;
  growthPct: number;
  
  // Financeiro KPIs
  totalCobrancas: number;
  valorTotalCobrancas: number;
  valorRecebido: number;
  valorPendente: number;
  
  // Contagens por Status (Sessões)
  statusDonut: StatusDonutItem[];
  statusTotalCount: number;
  
  // Cobranças por Status
  cobrancasPorStatus: StatusValueBreakdown[];
  
  // Histórico por Semana
  weeklyVolume: WeeklyVolumeItem[];
  weeklyBillingVolume: { weekLabel: string; paidCount: number; pendingCount: number; paidAmount: number; pendingAmount: number }[];
  
  // Métricas Gerais
  pacientesAtivos: number;
  equipeCount: number;
  horasEconomizadas: number;
  
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

/**
 * Cobertura de estagiários de uma especialidade na semana atual: quantos
 * estagiários contratados existem para cada 100 crianças com check-in em
 * atendimentos que seguem a proporção 1:1. 100% = um estagiário por criança.
 */
export type InternCoverageItem = {
  specialtyId: string;
  specialtyLabel: string;
  childrenCount: number;
  internsCount: number;
  coveragePct: number;
  status: "adequada" | "atencao" | "critica" | "sem_demanda";
};

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

  // Janelas "ao vivo" (independentes do filtro de período acima) para o
  // indicador de Capacidade Operacional — hoje / semana atual / mês atual.
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const weekDayIdx = (now.getDay() + 6) % 7; // 0 = segunda ... 6 = domingo
  const weekStart = new Date(todayStart.getTime() - weekDayIdx * 24 * 60 * 60 * 1000);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const capacityQueryStart = new Date(Math.min(weekStart.getTime(), monthStart.getTime()));
  const capacityQueryEnd = new Date(Math.max(weekEnd.getTime(), monthEnd.getTime()));

  // Datas para o período anterior equivalente
  const currentStart = new Date(startISO);
  const currentEnd = new Date(endISO);
  const durationMs = Math.max(86400000, currentEnd.getTime() - currentStart.getTime());
  const prevStartISO = new Date(currentStart.getTime() - durationMs).toISOString();
  const prevEndISO = startISO;

  // Promessas paralelas para maximizar performance
  const [
    { data: currentAppointments },
    { data: prevAppointments },
    { count: activePatientsCount },
    { data: therapistsList },
    { data: billingItems },
    { data: glosasList },
    { data: patientsList },
    { data: profilesList },
    { data: roomsList },
    { data: roomAppointments },
    { data: roomBillingItems },
    { data: clinicCapacityAppointments },
    { data: internCheckins },
    { data: specialtiesList },
  ] = await Promise.all([
    // Atendimentos no período
    supabase
      .from("appointments")
      .select("id, status, starts_at, ends_at, patient_id, patients!inner(clinic_id)")
      .eq("patients.clinic_id", clinicId)
      .gte("starts_at", startISO)
      .lt("starts_at", endISO),

    // Atendimentos período anterior
    supabase
      .from("appointments")
      .select("id, status, patients!inner(clinic_id)")
      .eq("patients.clinic_id", clinicId)
      .gte("starts_at", prevStartISO)
      .lt("starts_at", prevEndISO),

    // Pacientes Ativos
    supabase
      .from("patients")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("status", "ativo"),

    // Equipe/Terapeutas
    supabase
      .from("profiles")
      .select("id, full_name, role, active")
      .eq("clinic_id", clinicId)
      .eq("role", "terapeuta")
      .eq("active", true),

    // Billing Items (Cobranças)
    supabase
      .from("billing_items")
      .select("id, amount, status, paid_at, appointments!inner(patients!inner(clinic_id))")
      .eq("appointments.patients.clinic_id", clinicId),

    // Glosas
    supabase
      .from("glosas")
      .select("id, amount, reason_code, billing_item_id"),

    // Pacientes com Data de Nascimento
    supabase
      .from("patients")
      .select("id, full_name, birth_date, status")
      .eq("clinic_id", clinicId)
      .eq("status", "ativo"),

    // Equipe/Perfis para Aniversariantes
    supabase
      .from("profiles")
      .select("id, full_name, role, active")
      .eq("clinic_id", clinicId)
      .eq("active", true),

    // Salas da clínica
    supabase
      .from("rooms")
      .select("id, name, capacity, specialty_id")
      .eq("clinic_id", clinicId),

    // Atendimentos por Sala no período (para taxa de ocupação)
    supabase
      .from("appointments")
      .select("id, room_id, starts_at, ends_at, status, patients!inner(clinic_id)")
      .eq("patients.clinic_id", clinicId)
      .neq("status", "cancelada")
      .gte("starts_at", startISO)
      .lt("starts_at", endISO),

    // Cobranças por Sala no período (para faturamento por sala)
    supabase
      .from("billing_items")
      .select("id, amount, status, paid_at, appointments!inner(room_id, starts_at, patients!inner(clinic_id))")
      .eq("appointments.patients.clinic_id", clinicId)
      .gte("appointments.starts_at", startISO)
      .lt("appointments.starts_at", endISO),

    // Atendimentos "ao vivo" (semana atual + mês atual) para o indicador de
    // Capacidade Operacional da Clínica — independente do filtro de período acima
    supabase
      .from("appointments")
      .select("id, room_id, starts_at, ends_at, status, patients!inner(clinic_id)")
      .eq("patients.clinic_id", clinicId)
      .neq("status", "cancelada")
      .gte("starts_at", capacityQueryStart.toISOString())
      .lt("starts_at", capacityQueryEnd.toISOString()),

    // Check-ins da semana atual, com sala (e sua especialidade vinculada) e
    // isenção do tipo de atendimento — pro Alerta de Necessidade de Estagiário
    supabase
      .from("appointments")
      .select(
        "id, patient_id, checkin_at, room_id, appointment_types(requires_intern_ratio), patients!inner(clinic_id)"
      )
      .eq("patients.clinic_id", clinicId)
      .not("checkin_at", "is", null)
      .gte("checkin_at", weekStart.toISOString())
      .lt("checkin_at", weekEnd.toISOString()),

    // Especialidades da clínica, com nº de estagiários contratados (hoje
    // informado manualmente; futuramente por integração externa)
    supabase.from("specialties").select("id, label, intern_count").eq("clinic_id", clinicId).eq("active", true),
  ]);

  const appointments = currentAppointments ?? [];
  const prevApps = prevAppointments ?? [];
  const totalAppointments = appointments.length;
  const prevMonthAppointments = prevApps.length;

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
  if (totalAppointments > registeredCount) {
    const remaining = totalAppointments - registeredCount;
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

  // 2. Histórico Semanal de Sessões e Faturamento
  const weeklyVolume: WeeklyVolumeItem[] = [];
  const weeklyBillingVolume: { weekLabel: string; paidCount: number; pendingCount: number; paidAmount: number; pendingAmount: number }[] = [];

  const currStart = new Date(startISO);
  const currEnd = new Date(endISO);
  const rangeDays = Math.ceil((currEnd.getTime() - currStart.getTime()) / (1000 * 60 * 60 * 24));
  const weekStep = Math.max(7, Math.ceil(rangeDays / 4));

  let weekPointer = new Date(currStart);
  let weekIndex = 1;

  const items = billingItems ?? [];

  while (weekPointer < currEnd) {
    const nextWeek = new Date(Math.min(currEnd.getTime(), weekPointer.getTime() + weekStep * 24 * 60 * 60 * 1000));
    
    // Contagem de sessões na semana
    const count = appointments.filter((app) => {
      const appDate = new Date(app.starts_at);
      return appDate >= weekPointer && appDate < nextWeek;
    }).length;

    const startLabel = weekPointer.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    const weekLabel = `Semana ${weekIndex} (${startLabel})`;

    weeklyVolume.push({
      weekLabel,
      count,
      startDate: weekPointer.toISOString(),
      endDate: nextWeek.toISOString(),
    });

    // Faturamento na semana
    let paidCount = 0;
    let pendingCount = 0;
    let paidAmount = 0;
    let pendingAmount = 0;

    for (const b of items) {
      const val = Number(b.amount || 0);
      if (b.status === "pago" || b.paid_at != null) {
        paidCount++;
        paidAmount += val;
      } else {
        pendingCount++;
        pendingAmount += val;
      }
    }

    weeklyBillingVolume.push({
      weekLabel,
      paidCount,
      pendingCount,
      paidAmount,
      pendingAmount,
    });

    weekPointer = nextWeek;
    weekIndex++;
  }

  // 3. Faturamento & Cobranças Consolidadas
  const totalCobrancas = items.length;
  let valorTotalCobrancas = 0;
  let valorRecebido = 0;
  let valorPendente = 0;

  const cobrancasMap = new Map<string, { label: string; count: number; amount: number; color: string }>();
  cobrancasMap.set("pago", { label: "Pago / Recebido", count: 0, amount: 0, color: "#10b981" });
  cobrancasMap.set("pendente", { label: "Pendente", count: 0, amount: 0, color: "#fbbf24" });
  cobrancasMap.set("glosado", { label: "Glosado", count: 0, amount: 0, color: "#f43f5e" });

  for (const item of items) {
    const val = Number(item.amount || 0);
    valorTotalCobrancas += val;

    if (item.status === "pago" || item.paid_at != null) {
      valorRecebido += val;
      const target = cobrancasMap.get("pago")!;
      target.count++;
      target.amount += val;
    } else if (item.status === "glosado") {
      const target = cobrancasMap.get("glosado")!;
      target.count++;
      target.amount += val;
    } else {
      valorPendente += val;
      const target = cobrancasMap.get("pendente")!;
      target.count++;
      target.amount += val;
    }
  }

  const cobrancasPorStatus: StatusValueBreakdown[] = [...cobrancasMap.entries()].map(([statusKey, val]) => ({
    statusKey,
    ...val,
  }));

  // 4. Horas Economizadas com Automação
  const realizedCount = appointments.filter((a) => a.status === "realizada").length;
  const horasEconomizadas = Math.round(realizedCount * 0.25);

  // 5. Aniversariantes do Mês
  const targetMonth = currentStart.getMonth() + 1;
  const aniversariantes: AniversarianteItem[] = [];

  for (const pat of patientsList ?? []) {
    if (!pat.birth_date) continue;
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
      // Simulação para terapeutas sem campo birth_date explícito
    }
  }

  aniversariantes.sort((a, b) => a.birthDay - b.birthDay);

  // 6. Ranking de Salas (faturamento + taxa de ocupação)
  const HOURS_PER_BUSINESS_DAY = 10; // estimativa de horário de funcionamento (08h-18h), usada só no denominador da ocupação
  let businessDaysInPeriod = 0;
  for (let d = new Date(currentStart); d < currentEnd; d.setDate(d.getDate() + 1)) {
    const weekday = d.getDay();
    if (weekday !== 0 && weekday !== 6) businessDaysInPeriod++;
  }
  const availableHoursPerRoom = Math.max(1, businessDaysInPeriod) * HOURS_PER_BUSINESS_DAY;

  type RoomAcc = {
    roomName: string;
    capacity: number;
    totalRevenue: number;
    paidRevenue: number;
    pendingRevenue: number;
    appointmentsCount: number;
    bookedHours: number;
  };
  const roomAcc = new Map<string, RoomAcc>();

  // Sala de avaliação tem uso e capacidade próprios (1 criança por horário,
  // reservada para avaliação inicial) — não compete com as salas de
  // atendimento regular, então fica fora do ranking de faturamento/ocupação.
  const isEvaluationRoom = (roomName: string) => /avalia/i.test(roomName);

  for (const room of roomsList ?? []) {
    if (isEvaluationRoom(room.name)) continue;
    roomAcc.set(room.id, {
      roomName: room.name,
      capacity: room.capacity,
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

  for (const item of roomBillingItems ?? []) {
    const roomId = (item.appointments as { room_id: string | null } | null)?.room_id;
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

  // 7. Capacidade Operacional da Clínica (indicador em destaque) — ocupação
  // combinada de todas as salas (exceto Sala de Avaliação) "ao vivo": hoje
  // (manhã/tarde), semana atual e mês atual.
  function countBusinessDays(start: Date, end: Date): number {
    let count = 0;
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      const weekday = d.getDay();
      if (weekday !== 0 && weekday !== 6) count++;
    }
    return count;
  }

  const roomsConsidered = roomAcc.size; // já exclui a Sala de Avaliação
  const isTodayBusinessDay = countBusinessDays(todayStart, todayEnd) > 0;
  const businessDaysThisWeek = countBusinessDays(weekStart, weekEnd);
  const businessDaysThisMonth = countBusinessDays(monthStart, monthEnd);

  const HOURS_MANHA = 4; // 08h-12h
  const HOURS_TARDE = 5; // 13h-18h
  const HOURS_DIA = 10; // 08h-18h

  let manhaHours = 0;
  let tardeHours = 0;
  let diaHours = 0;
  let semanaHours = 0;
  let mesHours = 0;

  type ShiftAcc = { manha: number; tarde: number };
  const roomWeeklyShift = new Map<string, ShiftAcc>();

  for (const app of clinicCapacityAppointments ?? []) {
    if (!app.room_id || !roomAcc.has(app.room_id)) continue; // ignora Sala de Avaliação e salas desconhecidas
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

  // Alerta ao gestor: sala específica atingindo >= 80% de ocupação na
  // semana atual, no turno da manhã ou da tarde.
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
          description: `${acc.roomName} está a ${Math.min(100, occupancyPct)}% da capacidade no turno da ${def.shiftLabel.toLowerCase()} nesta semana — considere reorganizar a agenda ou avaliar abertura de novos horários.`,
        });
      }
    }
  }

  roomCapacityAlerts.sort((a, b) => b.occupancyPct - a.occupancyPct);

  // Alerta ao gestor: nº de estagiários contratados por especialidade
  // (informado em Cadastros > Especialidades, hoje manual — no futuro
  // atualizado por integração externa) abaixo de 80% das crianças com
  // check-in na semana atual naquela especialidade. Só considera
  // atendimentos de tipos que seguem a proporção 1:1
  // (appointment_types.requires_intern_ratio).
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

    // Acompanhamento contínuo (não é alerta): entra toda especialidade ativa,
    // inclusive as sem crianças na semana — aí não há proporção a cumprir.
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
        description: `${specialty.label} teve ${childrenCount} criança(s) com check-in nesta semana e apenas ${internsCount} estagiário(s) contratado(s) — ${deficitPct}% abaixo da proporção recomendada de 1 estagiário por criança.`,
      });
    }
  }

  internShortageAlerts.sort((a, b) => b.deficitPct - a.deficitPct);

  // Menor cobertura primeiro; especialidades sem demanda na semana ao final.
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

  return {
    totalAppointments,
    prevMonthAppointments,
    growthPct,
    totalCobrancas,
    valorTotalCobrancas,
    valorRecebido,
    valorPendente,
    statusDonut,
    statusTotalCount,
    cobrancasPorStatus,
    weeklyVolume,
    weeklyBillingVolume,
    pacientesAtivos: activePatientsCount ?? 0,
    equipeCount: (therapistsList ?? []).length,
    horasEconomizadas,
    aniversariantes,
    roomRanking,
    roomsTotalRevenue,
    roomsAvgOccupancyPct,
    clinicCapacity,
    roomCapacityAlerts,
    internShortageAlerts,
    internCoverage,
    internCoverageOverallPct,
  };
}
