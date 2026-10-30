"use server";

import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID, CLINIC_TIMEZONE } from "@/lib/constants";
import { REPORT_CONFIGS, type ReportFilterState } from "./types";

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return "";
  let s = String(val).trim();
  if (s.includes(";") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    s = `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function formatDateDisplay(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const parts = iso.split("T")[0].split("-");
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR", { timeZone: CLINIC_TIMEZONE });
  } catch {
    return "—";
  }
}

function formatDateTimeDisplay(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE });
  } catch {
    return "—";
  }
}

function formatCurrencyDisplay(val: number | string | null | undefined): string {
  if (val == null) return "—";
  const num = Number(val);
  if (isNaN(num)) return "—";
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function calculateAge(birthDateStr: string | null | undefined): string {
  if (!birthDateStr) return "—";
  try {
    const bDate = new Date(birthDateStr);
    if (isNaN(bDate.getTime())) return "—";
    const now = new Date();
    let age = now.getFullYear() - bDate.getFullYear();
    const m = now.getMonth() - bDate.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < bDate.getDate())) {
      age--;
    }
    return `${Math.max(0, age)} anos`;
  } catch {
    return "—";
  }
}

export async function generateReportData(
  filter: ReportFilterState,
  isExportAll: boolean = false,
): Promise<{
  success: boolean;
  error?: string;
  count: number;
  headers: string[];
  sampleRows: string[][];
  csv?: string;
  filename?: string;
}> {
  try {
    const supabase = await createClient();
    const config = REPORT_CONFIGS[filter.reportType];
    if (!config) {
      return { success: false, error: "Tipo de relatório inválido", count: 0, headers: [], sampleRows: [] };
    }

    const activeCols = config.columns.filter((col) =>
      filter.selectedColumns.includes(col.key),
    );

    const headers = activeCols.map((c) => c.label);

    let rows: Record<string, string>[] = [];

    if (filter.reportType === "clientes") {
      let query = supabase
        .from("patients")
        .select(`
          id,
          full_name,
          cpf,
          birth_date,
          sexo,
          status,
          support_level,
          cid,
          address_cidade,
          address_bairro,
          address_cep,
          entry_source,
          created_at,
          patient_insurance(
            is_private,
            card_number,
            card_valid_until,
            insurer:insurers(id, name)
          ),
          guardians(
            full_name,
            phone,
            is_financial
          )
        `)
        .eq("clinic_id", DEV_CLINIC_ID)
        .order("full_name");

      if (filter.status && filter.status !== "todos") {
        query = query.eq("status", filter.status);
      }
      if (filter.dateStart) {
        query = query.gte("created_at", `${filter.dateStart}T00:00:00Z`);
      }
      if (filter.dateEnd) {
        query = query.lte("created_at", `${filter.dateEnd}T23:59:59Z`);
      }
      if (filter.searchTerm) {
        query = query.ilike("full_name", `%${filter.searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      let list = data ?? [];

      if (filter.insurerId && filter.insurerId !== "todos") {
        if (filter.insurerId === "particular") {
          list = list.filter((p) =>
            (p.patient_insurance as Array<{ is_private: boolean }> ?? []).some((i) => i.is_private),
          );
        } else {
          list = list.filter((p) =>
            (p.patient_insurance as Array<{ insurer: { id: string } | null }> ?? []).some(
              (i) => i.insurer?.id === filter.insurerId,
            ),
          );
        }
      }

      rows = list.map((p) => {
        const insurances = (p.patient_insurance ?? []) as Array<{
          is_private: boolean;
          card_number: string | null;
          card_valid_until: string | null;
          insurer: { id: string; name: string } | null;
        }>;
        const mainInsurance = insurances[0];
        let insurerName = "Particular";
        if (mainInsurance && !mainInsurance.is_private && mainInsurance.insurer?.name) {
          insurerName = mainInsurance.insurer.name;
        }

        const guardians = (p.guardians ?? []) as Array<{
          full_name: string;
          phone: string | null;
          is_financial: boolean;
        }>;
        const mainGuardian = guardians.find((g) => g.is_financial) ?? guardians[0];

        return {
          full_name: p.full_name ?? "—",
          cpf: p.cpf ?? "—",
          birth_date: formatDateDisplay(p.birth_date),
          age: calculateAge(p.birth_date),
          sexo: p.sexo ? p.sexo.toUpperCase() : "—",
          status: p.status ?? "—",
          support_level: p.support_level ? `Nível ${p.support_level}` : "Não informado",
          cid: p.cid ?? "—",
          insurer_name: insurerName,
          card_number: mainInsurance?.card_number ?? "—",
          guardian_name: mainGuardian?.full_name ?? "—",
          guardian_phone: mainGuardian?.phone ?? "—",
          address_cidade: p.address_cidade ?? "—",
          address_bairro: p.address_bairro ?? "—",
          address_cep: p.address_cep ?? "—",
          entry_source: p.entry_source ?? "—",
          created_at: formatDateDisplay(p.created_at),
        };
      });
    } else if (filter.reportType === "terapias") {
      let query = supabase
        .from("appointments")
        .select(`
          id,
          starts_at,
          ends_at,
          discipline,
          status,
          modality,
          cancel_reason,
          is_evaluation,
          is_family_meeting,
          is_patient_feedback,
          patient:patients!inner(id, full_name, cpf, clinic_id),
          therapist:profiles!therapist_id(id, full_name, council_type, council_number),
          room:rooms(name),
          authorizations(guide_number),
          session_notes(id, signed_at)
        `)
        .eq("patient.clinic_id", DEV_CLINIC_ID)
        .order("starts_at", { ascending: false });

      if (filter.status && filter.status !== "todos") {
        query = query.eq("status", filter.status);
      }
      if (filter.discipline && filter.discipline !== "todas") {
        query = query.ilike("discipline", `%${filter.discipline}%`);
      }
      if (filter.therapistId && filter.therapistId !== "todos") {
        query = query.eq("therapist_id", filter.therapistId);
      }
      if (filter.modality && filter.modality !== "todas") {
        query = query.eq("modality", filter.modality);
      }
      if (filter.dateStart) {
        query = query.gte("starts_at", `${filter.dateStart}T00:00:00Z`);
      }
      if (filter.dateEnd) {
        query = query.lte("starts_at", `${filter.dateEnd}T23:59:59Z`);
      }

      const { data, error } = await query;
      if (error) throw error;

      let list = data ?? [];

      if (filter.searchTerm) {
        const term = filter.searchTerm.toLowerCase();
        list = list.filter((a) => {
          const pName = (a.patient as { full_name?: string } | null)?.full_name?.toLowerCase() ?? "";
          const tName = (a.therapist as { full_name?: string } | null)?.full_name?.toLowerCase() ?? "";
          return pName.includes(term) || tName.includes(term);
        });
      }

      rows = list.map((a) => {
        const patient = a.patient as { full_name?: string; cpf?: string } | null;
        const therapist = a.therapist as { full_name?: string; council_type?: string; council_number?: string } | null;
        const room = a.room as { name?: string } | null;
        const auth = Array.isArray(a.authorizations) ? a.authorizations[0] : a.authorizations;
        const notes = a.session_notes as Array<{ signed_at?: string | null }> | null;
        const hasEvolution = Boolean(notes && notes.length > 0 && notes[0]?.signed_at);

        const startsAt = a.starts_at ? new Date(a.starts_at) : null;
        const endsAt = a.ends_at ? new Date(a.ends_at) : null;

        const dateStr = startsAt
          ? startsAt.toLocaleDateString("pt-BR", { timeZone: CLINIC_TIMEZONE })
          : "—";

        const startTime = startsAt
          ? startsAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: CLINIC_TIMEZONE })
          : "";
        const endTime = endsAt
          ? endsAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: CLINIC_TIMEZONE })
          : "";

        let sessionType = "Sessão Terapêutica";
        if (a.is_evaluation) sessionType = "Avaliação Inicial";
        else if (a.is_family_meeting) sessionType = "Reunião de Família";
        else if (a.is_patient_feedback) sessionType = "Devolutiva";

        const council = [therapist?.council_type, therapist?.council_number].filter(Boolean).join(" ");

        return {
          session_date: dateStr,
          time_range: startTime && endTime ? `${startTime} - ${endTime}` : startTime || "—",
          patient_name: patient?.full_name ?? "—",
          patient_cpf: patient?.cpf ?? "—",
          discipline: a.discipline ?? "—",
          therapist_name: therapist?.full_name ?? "—",
          therapist_council: council || "—",
          room_name: room?.name ?? "—",
          modality: a.modality === "grupo" ? "Grupo" : "Individual",
          status: a.status ?? "—",
          session_type: sessionType,
          has_evolution: hasEvolution ? "Sim" : "Não",
          guide_number: auth?.guide_number ?? "—",
          cancel_reason: a.cancel_reason ?? "—",
        };
      });
    } else if (filter.reportType === "planos") {
      let query = supabase
        .from("patient_insurance")
        .select(`
          id,
          is_private,
          plan_name,
          card_number,
          card_valid_until,
          patient:patients!inner(id, full_name, cpf, status, clinic_id),
          insurer:insurers(id, name, ans_code, provider_code)
        `)
        .eq("patient.clinic_id", DEV_CLINIC_ID);

      if (filter.insurerId && filter.insurerId !== "todos") {
        if (filter.insurerId === "particular") {
          query = query.eq("is_private", true);
        } else {
          query = query.eq("insurer_id", filter.insurerId);
        }
      }

      if (filter.status && filter.status !== "todos") {
        query = query.eq("patient.status", filter.status);
      }

      const { data, error } = await query;
      if (error) throw error;

      let list = data ?? [];

      if (filter.searchTerm) {
        const term = filter.searchTerm.toLowerCase();
        list = list.filter((r) => {
          const pName = (r.patient as { full_name?: string } | null)?.full_name?.toLowerCase() ?? "";
          const card = r.card_number?.toLowerCase() ?? "";
          return pName.includes(term) || card.includes(term);
        });
      }

      rows = list.map((r) => {
        const patient = r.patient as { full_name?: string; cpf?: string; status?: string } | null;
        const insurer = r.insurer as { name?: string; ans_code?: string; provider_code?: string } | null;

        return {
          patient_name: patient?.full_name ?? "—",
          patient_cpf: patient?.cpf ?? "—",
          patient_status: patient?.status ?? "—",
          is_private: r.is_private ? "Particular" : "Convênio",
          insurer_name: r.is_private ? "Particular" : (insurer?.name ?? "—"),
          ans_code: r.is_private ? "—" : (insurer?.ans_code ?? "—"),
          provider_code: r.is_private ? "—" : (insurer?.provider_code ?? "—"),
          plan_name: r.plan_name ?? "—",
          card_number: r.card_number ?? "—",
          card_valid_until: formatDateDisplay(r.card_valid_until),
        };
      });
    } else if (filter.reportType === "contratos") {
      let query = supabase
        .from("patient_contracts")
        .select(`
          id,
          plan_type,
          monthly_fee,
          payment_day,
          start_date,
          end_date,
          status,
          notes,
          patient:patients!inner(id, full_name, cpf, clinic_id)
        `)
        .eq("clinic_id", DEV_CLINIC_ID)
        .order("start_date", { ascending: false });

      if (filter.status && filter.status !== "todos") {
        query = query.eq("status", filter.status);
      }
      if (filter.dateStart) {
        query = query.gte("start_date", filter.dateStart);
      }
      if (filter.dateEnd) {
        query = query.lte("start_date", filter.dateEnd);
      }

      const { data, error } = await query;
      if (error) throw error;

      let list = data ?? [];

      if (filter.searchTerm) {
        const term = filter.searchTerm.toLowerCase();
        list = list.filter((c) => {
          const pName = (c.patient as { full_name?: string } | null)?.full_name?.toLowerCase() ?? "";
          return pName.includes(term);
        });
      }

      rows = list.map((c) => {
        const patient = c.patient as { full_name?: string; cpf?: string } | null;
        return {
          patient_name: patient?.full_name ?? "—",
          patient_cpf: patient?.cpf ?? "—",
          plan_type: c.plan_type ?? "—",
          monthly_fee: formatCurrencyDisplay(c.monthly_fee),
          payment_day: c.payment_day ? `Dia ${c.payment_day}` : "—",
          start_date: formatDateDisplay(c.start_date),
          end_date: formatDateDisplay(c.end_date),
          status: c.status ?? "—",
          notes: c.notes ?? "—",
        };
      });
    } else if (filter.reportType === "pts") {
      let query = supabase
        .from("treatment_plans")
        .select(`
          id,
          version,
          status,
          general_objective,
          approved_at,
          delivered_at,
          family_accepted_at,
          review_due_at,
          supervisor_notes,
          patient:patients!inner(id, full_name, clinic_id)
        `)
        .eq("patient.clinic_id", DEV_CLINIC_ID)
        .order("version", { ascending: false });

      if (filter.status && filter.status !== "todos") {
        query = query.eq("status", filter.status);
      }

      const { data, error } = await query;
      if (error) throw error;

      let list = data ?? [];

      if (filter.searchTerm) {
        const term = filter.searchTerm.toLowerCase();
        list = list.filter((p) => {
          const pName = (p.patient as { full_name?: string } | null)?.full_name?.toLowerCase() ?? "";
          return pName.includes(term);
        });
      }

      rows = list.map((p) => {
        const patient = p.patient as { full_name?: string } | null;
        return {
          patient_name: patient?.full_name ?? "—",
          version: `v${p.version ?? 1}`,
          status: p.status ?? "—",
          general_objective: p.general_objective ?? "—",
          approved_at: formatDateDisplay(p.approved_at),
          delivered_at: formatDateDisplay(p.delivered_at),
          family_accepted_at: formatDateDisplay(p.family_accepted_at),
          review_due_at: formatDateDisplay(p.review_due_at),
          supervisor_notes: p.supervisor_notes ?? "—",
        };
      });
    } else if (filter.reportType === "profissionais") {
      let query = supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          email,
          phone,
          cpf,
          role,
          discipline,
          council_type,
          council_number,
          council_uf,
          esdm_certified,
          is_rt,
          is_at_professional,
          active,
          created_at
        `)
        .eq("clinic_id", DEV_CLINIC_ID)
        .eq("hidden_in_app", false)
        .order("full_name");

      if (filter.status === "ativo") {
        query = query.eq("active", true);
      } else if (filter.status === "inativo") {
        query = query.eq("active", false);
      }

      if (filter.discipline && filter.discipline !== "todas") {
        query = query.ilike("discipline", `%${filter.discipline}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      let list = data ?? [];

      if (filter.searchTerm) {
        const term = filter.searchTerm.toLowerCase();
        list = list.filter((p) =>
          p.full_name.toLowerCase().includes(term) || (p.email?.toLowerCase().includes(term) ?? false),
        );
      }

      rows = list.map((p) => {
        const council = [p.council_type, p.council_number, p.council_uf].filter(Boolean).join(" ");
        return {
          full_name: p.full_name,
          email: p.email ?? "—",
          phone: p.phone ?? "—",
          role: p.role ?? "—",
          discipline: p.discipline ?? "Geral / Administrativo",
          council: council || "—",
          esdm_certified: p.esdm_certified ? "Sim" : "Não",
          is_rt: p.is_rt ? "Sim" : "Não",
          is_at_professional: p.is_at_professional ? "Sim" : "Não",
          status: p.active ? "Ativo" : "Inativo",
          created_at: formatDateDisplay(p.created_at),
        };
      });
    } else if (filter.reportType === "faturamento") {
      let query = supabase
        .from("billing_items")
        .select(`
          id,
          procedure_code,
          amount,
          billing_periods!inner(
            competence_month,
            status,
            insurers!inner(id, name, clinic_id)
          ),
          appointments(
            starts_at,
            patients(full_name),
            authorizations(
              guide_number,
              patient_insurance(card_number)
            ),
            therapist:profiles!therapist_id(
              full_name,
              council_type,
              council_number
            )
          )
        `)
        .eq("billing_periods.insurers.clinic_id", DEV_CLINIC_ID)
        .order("procedure_code");

      if (filter.insurerId && filter.insurerId !== "todos") {
        query = query.eq("billing_periods.insurers.id", filter.insurerId);
      }
      if (filter.dateStart) {
        query = query.gte("billing_periods.competence_month", `${filter.dateStart.slice(0, 7)}-01`);
      }
      if (filter.dateEnd) {
        query = query.lte("billing_periods.competence_month", `${filter.dateEnd.slice(0, 7)}-01`);
      }

      const { data, error } = await query;
      if (error) throw error;

      let list = data ?? [];

      if (filter.searchTerm) {
        const term = filter.searchTerm.toLowerCase();
        list = list.filter((i) => {
          const appt = i.appointments as {
            patients?: { full_name?: string } | null;
            authorizations?: { guide_number?: string } | null;
          } | null;
          const pName = appt?.patients?.full_name?.toLowerCase() ?? "";
          const guide = appt?.authorizations?.guide_number?.toLowerCase() ?? "";
          return pName.includes(term) || guide.includes(term) || i.procedure_code.toLowerCase().includes(term);
        });
      }

      rows = list.map((i) => {
        const period = i.billing_periods as {
          competence_month: string;
          status: string;
          insurers: { name: string } | null;
        } | null;
        const appt = i.appointments as {
          starts_at: string | null;
          patients: { full_name: string } | null;
          authorizations: {
            guide_number: string | null;
            patient_insurance: { card_number: string | null } | null;
          } | null;
          therapist: {
            full_name: string;
            council_type: string | null;
            council_number: string | null;
          } | null;
        } | null;

        const dateStr = appt?.starts_at ? formatDateDisplay(appt.starts_at) : "—";
        const timeStr = appt?.starts_at
          ? new Date(appt.starts_at).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: CLINIC_TIMEZONE,
            })
          : "—";

        const council = [appt?.therapist?.council_type, appt?.therapist?.council_number]
          .filter(Boolean)
          .join(" ");

        return {
          competence_month: period?.competence_month?.slice(0, 7) ?? "—",
          insurer_name: period?.insurers?.name ?? "—",
          patient_name: appt?.patients?.full_name ?? "—",
          card_number: appt?.authorizations?.patient_insurance?.card_number ?? "—",
          guide_number: appt?.authorizations?.guide_number ?? "—",
          procedure_code: i.procedure_code,
          service_date: dateStr,
          service_time: timeStr,
          therapist_name: appt?.therapist?.full_name ?? "—",
          therapist_council: council || "—",
          amount: formatCurrencyDisplay(i.amount),
          status: period?.status ?? "—",
        };
      });
    }

    const sampleRows = rows.slice(0, 6).map((r) =>
      activeCols.map((c) => r[c.key] ?? "—"),
    );

    let csv: string | undefined;
    let filename: string | undefined;

    if (isExportAll) {
      const headerLine = headers.map(escapeCsv).join(";");
      const dataLines = rows.map((r) =>
        activeCols.map((c) => escapeCsv(r[c.key] ?? "")).join(";"),
      );

      const bom = String.fromCharCode(0xfeff);
      csv = bom + [headerLine, ...dataLines].join("\r\n");

      const today = new Date().toISOString().slice(0, 10);
      filename = `relatorio-${config.id}-${today}.csv`;
    }

    return {
      success: true,
      count: rows.length,
      headers,
      sampleRows,
      csv,
      filename,
    };
  } catch (err: unknown) {
    console.error("Erro ao gerar relatório:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro desconhecido ao gerar relatório",
      count: 0,
      headers: [],
      sampleRows: [],
    };
  }
}
