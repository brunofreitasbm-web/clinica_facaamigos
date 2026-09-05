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
  };
}
