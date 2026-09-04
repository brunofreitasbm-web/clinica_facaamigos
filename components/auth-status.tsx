import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import { signOut } from "@/app/login/actions";

export async function AuthStatus() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="flex items-center justify-end gap-3 border-b border-paper-line-strong px-6 py-2 text-xs text-ink-soft sm:px-10">
      <span>
        {profile?.full_name ?? user.email}
        {profile?.role && ` — ${ROLE_LABEL[profile.role as Role]}`}
      </span>
      <form action={signOut}>
        <button type="submit" className="text-chart hover:underline">
          Sair
        </button>
      </form>
    </div>
  );
}
