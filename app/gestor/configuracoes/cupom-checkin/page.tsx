import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { couponSettingsFromRow, type CheckinCouponSettingsRow } from "@/lib/checkin-coupon";
import { CupomManager } from "./cupom-manager";
import { PageContainer } from "@/components/page-container";

export const dynamic = "force-dynamic";

export default async function CupomCheckinPage() {
  const supabase = await createClient();

  const { data: settingsRow } = await supabase
    .from("checkin_coupon_settings")
    .select("*")
    .eq("clinic_id", DEV_CLINIC_ID)
    .maybeSingle();

  const settings = couponSettingsFromRow(settingsRow as CheckinCouponSettingsRow | null);

  return (
    <>
      <div className="flex flex-1 flex-col overflow-y-auto">
        <PageHeader
          axisLabel="Configurações"
          title="Cupom de Check-in"
          description="Impressão automática do roteiro do dia do paciente na chegada, em cupom não-fiscal 80mm/58mm."
        />
        <PageContainer>
          <CupomManager settings={settings} />
        </PageContainer>
      </div>
    </>
  );
}
