import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { FaqManager, type FaqRow } from "./faq-manager";

export const dynamic = "force-dynamic";

export default async function FaqConfigPage() {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("clinic_faq")
    .select("id, question, answer, keywords, category, active")
    .eq("clinic_id", DEV_CLINIC_ID)
    .order("sort_order", { ascending: true });

  const faqs: FaqRow[] = (rows ?? []).map((r) => ({
    id: r.id,
    question: r.question,
    answer: r.answer,
    keywords: r.keywords ?? [],
    category: r.category,
    active: r.active,
  }));

  return <FaqManager faqs={faqs} />;
}
