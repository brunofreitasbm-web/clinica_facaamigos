"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function signIn(
  formData: FormData,
): Promise<{ success: false; error: string } | undefined> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!identifier || !password) {
    return { success: false, error: "Preencha CPF (ou e-mail) e senha." };
  }

  let email: string;

  if (identifier.includes("@")) {
    // Contas antigas (ou sem CPF cadastrado ainda) continuam entrando com o
    // e-mail real usado no Supabase Auth.
    email = identifier.toLowerCase();
  } else {
    const cpfDigits = identifier.replace(/\D/g, "");
    if (cpfDigits.length !== 11) {
      return { success: false, error: "Informe um CPF válido (11 dígitos) ou e-mail." };
    }

    // A busca por CPF precisa ignorar RLS: nesse ponto o usuário ainda não
    // está autenticado, então não há `auth.uid()` pra satisfazer a policy de
    // `profiles`. `profiles.email` é sempre o mesmo endereço de auth.users
    // (real ou sintético) — resolver o CPF pra ele é só um lookup.
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("email")
      .eq("cpf", cpfDigits)
      .maybeSingle();

    if (!profile?.email) {
      return {
        success: false,
        error: "CPF não encontrado. Confira o número ou fale com o gestor da clínica.",
      };
    }
    email = profile.email;
  }

  const supabase = await createClient();
  let { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    try {
      const res = await fetch("https://ivjvpdzsfjdpyabbzzuj.supabase.co/functions/v1/gestao-hub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sincronizar_login_clinica",
          identifier: email,
          password,
        }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.ok) {
          const retry = await supabase.auth.signInWithPassword({
            email: data.email || email,
            password,
          });
          error = retry.error;
        }
      }
    } catch (e) {
      console.error("Erro ao sincronizar senha com Hub:", e);
    }
  }

  if (error) {
    return { success: false, error: "CPF/e-mail ou senha inválidos." };
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
