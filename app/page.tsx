import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ROLE_HOME, type Role } from "@/lib/roles";

export default async function Home() {
  const cookieStore = await cookies();
  const demoRole = cookieStore.get("demo_user_role")?.value as Role | undefined;

  if (demoRole) {
    redirect(ROLE_HOME[demoRole] ?? "/login");
  }

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
}
