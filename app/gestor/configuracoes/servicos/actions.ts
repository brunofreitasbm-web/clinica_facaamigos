"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";

type ActionResult = { success: true } | { success: false; error: string };

type ServicePriceInput = {
  procedureCode: string;
  procedureName: string;
  insurerId: string;
  cost: number | null;
  price: number;
  validFrom: string;
  validTo: string | null;
};

function parseInput(formData: FormData): { data: ServicePriceInput } | { error: string } {
  const procedureCode = String(formData.get("procedure_code") ?? "").trim();
  const procedureName = String(formData.get("procedure_name") ?? "").trim();
  const insurerId = String(formData.get("insurer_id") ?? "").trim();
  const costRaw = String(formData.get("cost") ?? "").trim();
  const priceRaw = String(formData.get("price") ?? "").trim();
  const validFrom = String(formData.get("valid_from") ?? "").trim();
  const validTo = String(formData.get("valid_to") ?? "").trim();

  if (!procedureCode) return { error: "Código do procedimento é obrigatório." };
  if (!procedureName) return { error: "Nome do serviço é obrigatório." };
  if (!insurerId) return { error: "Escolha um convênio." };

  const price = Number(priceRaw.replace(",", "."));
  if (!priceRaw || !Number.isFinite(price) || price <= 0) return { error: "Preço é obrigatório e deve ser maior que zero." };

  let cost: number | null = null;
  if (costRaw) {
    cost = Number(costRaw.replace(",", "."));
    if (!Number.isFinite(cost) || cost < 0) return { error: "Custo deve ser um número maior ou igual a zero." };
  }

  if (!validFrom) return { error: "Data de início da vigência é obrigatória." };

  return {
    data: { procedureCode, procedureName, insurerId, cost, price, validFrom, validTo: validTo || null },
  };
}

export async function createServicePrice(formData: FormData): Promise<ActionResult> {
  const parsed = parseInput(formData);
  if ("error" in parsed) return { success: false, error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("insurer_price_tables").insert({
    insurer_id: parsed.data.insurerId,
    procedure_code: parsed.data.procedureCode,
    procedure_name: parsed.data.procedureName,
    cost: parsed.data.cost,
    price: parsed.data.price,
    valid_from: parsed.data.validFrom,
    valid_to: parsed.data.validTo,
  });

  if (error) {
    return {
      success: false,
      error: error.code === "23P01" ? "Já existe um preço vigente para esse serviço nesse convênio nesse período." : "Não foi possível salvar o serviço. Tente de novo.",
    };
  }

  revalidatePath("/gestor/configuracoes/servicos");
  return { success: true };
}

export async function updateServicePrice(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = parseInput(formData);
  if ("error" in parsed) return { success: false, error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("insurer_price_tables")
    .update({
      insurer_id: parsed.data.insurerId,
      procedure_code: parsed.data.procedureCode,
      procedure_name: parsed.data.procedureName,
      cost: parsed.data.cost,
      price: parsed.data.price,
      valid_from: parsed.data.validFrom,
      valid_to: parsed.data.validTo,
    })
    .eq("id", id);

  if (error) {
    return {
      success: false,
      error: error.code === "23P01" ? "Já existe um preço vigente para esse serviço nesse convênio nesse período." : "Não foi possível salvar o serviço. Tente de novo.",
    };
  }

  revalidatePath("/gestor/configuracoes/servicos");
  return { success: true };
}

export async function deleteServicePrice(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("insurer_price_tables").delete().eq("id", id);

  if (error) {
    return { success: false, error: "Não foi possível excluir o serviço. Tente de novo." };
  }

  revalidatePath("/gestor/configuracoes/servicos");
  return { success: true };
}

export async function createInsurerQuick(formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { success: false, error: "Nome do convênio é obrigatório." };

  const supabase = await createClient();
  const { error } = await supabase.from("insurers").insert({ clinic_id: DEV_CLINIC_ID, name });

  if (error) {
    return { success: false, error: "Não foi possível salvar o convênio. Tente de novo." };
  }

  revalidatePath("/gestor/configuracoes/servicos");
  revalidatePath("/gestor/convenios");
  return { success: true };
}
