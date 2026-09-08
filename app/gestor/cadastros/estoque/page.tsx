import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { CadastrosSidebar } from "../cadastros-sidebar";
import { Package, AlertTriangle, ArrowUpRight } from "lucide-react";
import { NewItemDialog } from "./new-item-dialog";
import { MovementDialog } from "./movement-dialog";

export const dynamic = "force-dynamic";

function formatCurrency(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const CATEGORY_LABEL: Record<string, string> = {
  teste_psicologico: "Teste Psicológico",
  brinquedo_pedagogico: "Brinquedo Pedagógico",
  material_consumo: "Material de Consumo",
  equipamento: "Equipamento",
  outros: "Outros",
};

export default async function EstoquePage() {
  const supabase = await createClient();

  const { data: itemRows } = await supabase
    .from("inventory_items")
    .select("id, name, category, quantity_available, min_quantity, unit_cost, location")
    .eq("clinic_id", DEV_CLINIC_ID)
    .order("name", { ascending: true });

  const items = itemRows ?? [];
  const lowStockCount = items.filter((i) => i.quantity_available <= i.min_quantity).length;
  const totalValue = items.reduce((sum, i) => sum + i.quantity_available * Number(i.unit_cost ?? 0), 0);

  return (
    <div className="flex flex-1">
      <CadastrosSidebar active="estoque" />
      <div className="flex-1 p-8">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1">
              Gestão de Recursos & Logística
            </h6>
            <h1 className="m-0">Estoque e Almoxarifado Terapêutico</h1>
          </div>
          <div className="flex gap-3">
            <MovementDialog items={items.map((i) => ({ id: i.id, name: i.name, quantity_available: i.quantity_available }))} />
            <NewItemDialog />
          </div>
        </div>

        <section className="grid grid-cols-1 gap-6 sm:grid-cols-3 mb-8">
          <div className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-faint mb-2">
              <Package size={18} className="text-blue-600" /> Total de Itens Cadastrados
            </div>
            <div className="tabular-figure text-3xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
              {items.length} tipos de materiais
            </div>
            <span className="text-xs text-ink-faint mt-1 block">Testes, brinquedos e insumos operacionais</span>
          </div>

          <div className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-faint mb-2">
              <AlertTriangle size={18} className="text-amber-500" /> Itens em Nível Crítico
            </div>
            <div
              className="tabular-figure text-3xl font-bold"
              style={{ fontFamily: "var(--font-heading)", color: lowStockCount > 0 ? "var(--status-falta)" : "var(--status-realizada)" }}
            >
              {lowStockCount} itens necessitando reposição
            </div>
            <span className="text-xs text-ink-faint mt-1 block">Abaixo da quantidade mínima cadastrada</span>
          </div>

          <div className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-faint mb-2">
              <ArrowUpRight size={18} className="text-emerald-500" /> Patrimônio em Material Clínico
            </div>
            <div className="tabular-figure text-3xl font-bold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-accent-2-600)" }}>
              {formatCurrency(totalValue)}
            </div>
            <span className="text-xs text-ink-faint mt-1 block">Custo total estocado na clínica</span>
          </div>
        </section>

        <section className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
          <h3 className="mb-4">Catálogo de Materiais e Protocolos</h3>

          {items.length === 0 ? (
            <p className="text-sm text-ink-faint">Nenhum item cadastrado ainda.</p>
          ) : (
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Item / Material Clínico</th>
                  <th>Categoria</th>
                  <th>Localização</th>
                  <th>Qtd Disponível</th>
                  <th>Qtd Mínima</th>
                  <th>Custo Unitário</th>
                  <th>Status Estoque</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isCritical = item.quantity_available <= item.min_quantity;
                  return (
                    <tr key={item.id}>
                      <td className="font-semibold">{item.name}</td>
                      <td className="text-xs text-ink-soft">{CATEGORY_LABEL[item.category] ?? item.category}</td>
                      <td className="text-xs text-ink-faint">{item.location || "Almoxarifado Central"}</td>
                      <td className="tabular-figure font-bold text-sm">{item.quantity_available}</td>
                      <td className="tabular-figure text-xs text-ink-faint">{item.min_quantity}</td>
                      <td className="tabular-figure text-xs">{formatCurrency(Number(item.unit_cost ?? 0))}</td>
                      <td>
                        <span className={`tag-status ${isCritical ? "st-falta" : "st-realizada"}`}>
                          {isCritical ? "Reposição Urgente" : "Estoque Regular"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
