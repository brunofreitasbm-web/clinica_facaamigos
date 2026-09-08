import { createClient } from "@/lib/supabase/server";
import { getPtsTemplates } from "@/lib/pts-templates";
import { PtsTemplatesManager } from "./pts-templates-manager";

export const dynamic = "force-dynamic";

export default async function PtsTemplatesConfigPage() {
  const supabase = await createClient();
  const templates = await getPtsTemplates(supabase, { activeOnly: false });

  return <PtsTemplatesManager initialTemplates={templates} />;
}
