import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROLE_HOME, type Role } from "@/lib/roles";
import { isRedirectError } from "next/dist/client/components/redirect-error";

export default async function Home() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = profile?.role as Role | undefined;
    redirect(role ? ROLE_HOME[role] : "/login");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error("Erro na página inicial:", error);
    redirect("/login");
  }
}
