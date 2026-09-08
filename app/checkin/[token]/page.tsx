import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { todayInTimeZone } from "@/lib/timezone";
import { issueFormToken, FORM_COOKIE } from "@/lib/checkin-security";
import { CheckinForm } from "./checkin-form";

// Público, sem sessão — validamos o token do cartaz com o service role
// (createAdminClient), mesmo caminho de app/login/otp-actions.ts. force-dynamic
// porque cada visita emite um cookie de formulário novo.
export const dynamic = "force-dynamic";

export default async function CheckinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: tokenRow } = await admin
    .from("clinic_checkin_tokens")
    .select("active")
    .eq("token", token)
    .maybeSingle();

  if (!tokenRow || !tokenRow.active) {
    return (
      <div className="card items-center text-center gap-3 p-8">
        <p className="card-title">Cartaz indisponível</p>
        <p className="card-body">Por favor, fale com a recepção para fazer seu check-in.</p>
      </div>
    );
  }

  const todayStr = todayInTimeZone(CLINIC_TIMEZONE);
  const formToken = issueFormToken(token, todayStr);
  const cookieStore = await cookies();
  cookieStore.set(FORM_COOKIE.name, formToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/checkin",
    maxAge: FORM_COOKIE.maxAgeSeconds,
  });

  return <CheckinForm token={token} />;
}
