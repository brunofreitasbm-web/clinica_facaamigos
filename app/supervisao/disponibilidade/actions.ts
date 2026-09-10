"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { DEV_CLINIC_ID } from "@/lib/constants";

type ActionResult = { success: true } | { success: false; error: string };

const MANAGER_ROLES = ["supervisor", "gestor"];

/**
 * Disponibilidade é cadastro de coordenação: só supervisão e gestão alteram.
 * O terapeuta apenas visualiza a própria janela — decisão explícita do dono
 * do produto (2026-09-09), que descartou a ideia anterior de deixar o
 * terapeuta ajustar a própria agenda com 10 dias de antecedência.
 *
 * A regra já vale no banco (policies `professional_availability_manage_*`,
 * 20260909220000_professional_availability.sql) e na rota (middleware só
 * libera /supervisao pra supervisor/gestor); esta checagem existe pra o
 * erro chegar na tela como mensagem, em vez de um "não foi possível
 * salvar" genérico vindo do RLS.
 */
async function assertManager(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Sem sessão = ambiente de dev sem login; o RLS segue sendo a barreira real.
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role && !MANAGER_ROLES.includes(profile.role)) {
    return "Somente supervisão ou gestão pode alterar a disponibilidade dos profissionais.";
  }
  return null;
}

/**
 * Bloco semanal de disponibilidade de um terapeuta (dia + janela de
 * horário) — base real usada pelo trigger `appointments_availability_guard`
 * (20260909220000_professional_availability.sql) pra bloquear agendamento
 * fora do expediente, em qualquer fluxo que grave em `appointments`
 * (recepção, PTS, geração de recorrência da grade).
 */
export async function addAvailabilityBlock(formData: FormData): Promise<ActionResult> {
  const profileId = String(formData.get("profile_id") ?? "");
  const dayOfWeek = Number(formData.get("day_of_week"));
  const startTime = String(formData.get("start_time") ?? "");
  const endTime = String(formData.get("end_time") ?? "");

  if (!profileId || !startTime || !endTime) {
    return { success: false, error: "Preencha terapeuta, horário de início e de término." };
  }
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return { success: false, error: "Dia da semana inválido." };
  }
  if (startTime >= endTime) {
    return { success: false, error: "O horário de término precisa ser depois do início." };
  }

  const supabase = await createClient();
  const denied = await assertManager(supabase);
  if (denied) return { success: false, error: denied };

  const { error } = await supabase.from("professional_availability").insert({
    clinic_id: DEV_CLINIC_ID,
    profile_id: profileId,
    day_of_week: dayOfWeek,
    start_time: startTime,
    end_time: endTime,
  });

  if (error) {
    if (error.code === "23P01") {
      return { success: false, error: "Já existe um bloco de horário sobreposto para esse dia." };
    }
    return { success: false, error: "Não foi possível salvar este bloco de disponibilidade." };
  }

  revalidatePath("/supervisao/disponibilidade");
  return { success: true };
}

export async function removeAvailabilityBlock(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const denied = await assertManager(supabase);
  if (denied) return { success: false, error: denied };

  const { error } = await supabase.from("professional_availability").delete().eq("id", id);

  if (error) {
    return { success: false, error: "Não foi possível remover este bloco de disponibilidade." };
  }

  revalidatePath("/supervisao/disponibilidade");
  return { success: true };
}

/**
 * Copia a janela de um dia para os outros dias úteis (seg–sex) do mesmo
 * terapeuta, substituindo o que houver neles. Existe porque a clínica é
 * multiprofissional com muitos terapeutas e a maioria repete o mesmo
 * expediente de segunda a sexta — sem isso, cadastrar a equipe inteira são
 * cinco formulários por pessoa.
 *
 * Substitui em vez de somar: o `exclude using gist` da tabela rejeitaria
 * qualquer cópia que se sobrepusesse ao que já existe no dia de destino, e
 * "replicar" significa deixar o dia igual ao de origem, não mesclar.
 */
export async function replicateDayToWeekdays(
  profileId: string,
  sourceDay: number,
): Promise<ActionResult> {
  if (!profileId) return { success: false, error: "Terapeuta não informado." };
  if (!Number.isInteger(sourceDay) || sourceDay < 0 || sourceDay > 6) {
    return { success: false, error: "Dia da semana inválido." };
  }

  const supabase = await createClient();
  const denied = await assertManager(supabase);
  if (denied) return { success: false, error: denied };

  const { data: source, error: readError } = await supabase
    .from("professional_availability")
    .select("start_time, end_time")
    .eq("clinic_id", DEV_CLINIC_ID)
    .eq("profile_id", profileId)
    .eq("day_of_week", sourceDay)
    .eq("active", true);

  if (readError) {
    return { success: false, error: "Não foi possível ler a janela de origem." };
  }
  if (!source || source.length === 0) {
    return { success: false, error: "Este dia não tem nenhum bloco pra replicar." };
  }

  const targetDays = [1, 2, 3, 4, 5].filter((d) => d !== sourceDay);

  const { error: deleteError } = await supabase
    .from("professional_availability")
    .delete()
    .eq("clinic_id", DEV_CLINIC_ID)
    .eq("profile_id", profileId)
    .in("day_of_week", targetDays);

  if (deleteError) {
    return { success: false, error: "Não foi possível limpar os dias de destino." };
  }

  const { error: insertError } = await supabase.from("professional_availability").insert(
    targetDays.flatMap((day) =>
      source.map((block) => ({
        clinic_id: DEV_CLINIC_ID,
        profile_id: profileId,
        day_of_week: day,
        start_time: block.start_time,
        end_time: block.end_time,
      })),
    ),
  );

  if (insertError) {
    return { success: false, error: "Não foi possível replicar a janela nos dias úteis." };
  }

  revalidatePath("/supervisao/disponibilidade");
  return { success: true };
}

/** Limpa a semana inteira de um terapeuta. */
export async function clearTherapistAvailability(profileId: string): Promise<ActionResult> {
  if (!profileId) return { success: false, error: "Terapeuta não informado." };

  const supabase = await createClient();
  const denied = await assertManager(supabase);
  if (denied) return { success: false, error: denied };

  const { error } = await supabase
    .from("professional_availability")
    .delete()
    .eq("clinic_id", DEV_CLINIC_ID)
    .eq("profile_id", profileId);

  if (error) {
    return { success: false, error: "Não foi possível limpar a disponibilidade deste terapeuta." };
  }

  revalidatePath("/supervisao/disponibilidade");
  return { success: true };
}
