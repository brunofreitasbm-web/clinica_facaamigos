import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAtendimentoAccess, loadAtendimentoData } from "@/lib/atendimento/load-data";
import { MobileShell } from "./mobile-shell";
import { AddToHomeHint } from "./add-to-home-hint";

export const dynamic = "force-dynamic";

export default async function MobileAtendimentoPage() {
  const supabase = await createClient();
  const { userId, allowed } = await getAtendimentoAccess(supabase);
  if (!userId) redirect("/login");
  if (!allowed) redirect("/login");

  const { conversations, staffNames, insurerById } = await loadAtendimentoData(supabase);

  return (
    <>
      <MobileShell
        initialConversations={conversations}
        staffNames={staffNames}
        insurerById={insurerById}
        currentUserId={userId}
        initialSelectedId={null}
      />
      <AddToHomeHint />
    </>
  );
}
