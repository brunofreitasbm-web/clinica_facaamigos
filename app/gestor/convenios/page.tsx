import Link from "next/link";
import { GestorNav } from "@/components/gestor-nav";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { InsurerForm } from "./insurer-form";

export const dynamic = "force-dynamic";

export default async function ConveniosPage() {
  const supabase = await createClient();
  const { data: insurers } = await supabase
    .from("insurers")
    .select("id, name, ans_code")
    .eq("clinic_id", DEV_CLINIC_ID)
    .order("name");

  return (
    <main className="flex flex-1 flex-col">
      <GestorNav active="cadastros" />
      <PageHeader
        axisLabel="Gestor"
        title="Convênios"
        description="Só o gestor cadastra convênio novo — recepção e faturamento usam a lista pra vincular ao paciente."
      />
      <div className="flex flex-col gap-6 p-6 sm:p-10">
        <InsurerForm />
        <ul className="flex flex-col gap-2">
          {(insurers ?? []).map((insurer) => (
            <li
              key={insurer.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-paper-line-strong bg-paper/60 px-4 py-3 text-sm"
            >
              <div>
                <span className="font-medium text-ink">{insurer.name}</span>
                {insurer.ans_code && (
                  <span className="ml-2 text-ink-faint">ANS {insurer.ans_code}</span>
                )}
              </div>
              <Link
                href={`/gestor/convenios/${insurer.id}/precos`}
                className="text-sm font-medium text-chart hover:underline"
              >
                Tabela de preços
              </Link>
            </li>
          ))}
          {(insurers ?? []).length === 0 && (
            <li className="text-sm text-ink-faint">Nenhum convênio cadastrado ainda.</li>
          )}
        </ul>
      </div>
    </main>
  );
}
