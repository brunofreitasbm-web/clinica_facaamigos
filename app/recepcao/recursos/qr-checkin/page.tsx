import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { generateCheckinQrSvg } from "@/lib/qrcode";
import { RotateTokenButton } from "./rotate-token-button";
import { PrintButton } from "./print-button";
import { Logo } from "@/components/brand/logo";

export const dynamic = "force-dynamic";

/**
 * Cartaz A4 imprimível do check-in por QR. Página administrativa (dentro de
 * /recepcao, exige login) — o único artefato público é a URL que o QR
 * codifica, aberta por quem escaneia.
 */
export default async function QrCheckinPage() {
  const supabase = await createClient();
  const { data: tokenRow } = await supabase
    .from("clinic_checkin_tokens")
    .select("id, token, created_at")
    .eq("clinic_id", DEV_CLINIC_ID)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const checkinUrl = tokenRow ? `${protocol}://${host}/checkin/${tokenRow.token}` : null;
  const qrSvg = checkinUrl ? await generateCheckinQrSvg(checkinUrl) : null;

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-6">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <div>
          <h1 style={{ fontFamily: "var(--font-heading)" }} className="text-xl font-semibold text-ink">
            Cartaz de check-in
          </h1>
          <p className="text-sm text-ink-soft">
            Imprima e fixe na entrada da clínica. Se o link vazar ou o cartaz precisar ser trocado, gire o token abaixo
            — o cartaz antigo para de funcionar imediatamente.
          </p>
        </div>
        <div className="flex gap-2">
          <PrintButton />
          <RotateTokenButton />
        </div>
      </div>

      {!checkinUrl && (
        <p className="card-body">Nenhum cartaz ativo. Gere um novo token para criar o QR.</p>
      )}

      {checkinUrl && qrSvg && (
        <div className="card items-center gap-4 p-10 text-center print:shadow-none print:border-none">
          <Logo variant="vertical-compacto" height={72} />
          <p style={{ fontFamily: "var(--font-heading)", fontSize: "1.75rem" }}>Bem-vindo(a)!</p>
          <p className="card-body">Escaneie o código para fazer seu check-in</p>
          <div
            className="[&_svg]:h-64 [&_svg]:w-64"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <p className="card-body" style={{ fontSize: "0.85rem", wordBreak: "break-all" }}>
            Ou acesse: {checkinUrl}
          </p>
          <ol className="text-left text-sm" style={{ maxWidth: 340 }}>
            <li>1. Aponte a câmera do celular para o QR.</li>
            <li>2. Informe seu primeiro nome e data de nascimento.</li>
            <li>3. Anote a senha — a chamada segue o horário agendado, não a ordem de chegada.</li>
          </ol>
          <p className="card-body" style={{ fontSize: "0.7rem", opacity: 0.6 }}>
            Seus dados são usados apenas para localizar sua sessão do dia e são apagados em até 90 dias.
          </p>
        </div>
      )}
    </div>
  );
}
