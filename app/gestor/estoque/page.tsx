import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { GestorNav } from "@/components/gestor-nav";
import { Package, Plus, AlertTriangle, ArrowDownRight, ArrowUpRight, Search } from "lucide-react";

export const dynamic = "force-dynamic";

function formatCurrency(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function EstoquePage() {
  const supabase = await createClient();

  let inventoryList: any[] = [];
  try {
    const { data } = await (supabase as any)
      .from("inventory_items")
      .select("*")
      .eq("clinic_id", DEV_CLINIC_ID)
      .order("name", { ascending: true });
    if (data) inventoryList = data;
  } catch (e) {
    inventoryList = [];
  }

  // Mocks estatísticos e itens fallback
  const mockItems = [
    { id: "1", name: "Protocolo VB-MAPP (Kit de Folhas)", category: "teste_psicologico", quantity_available: 3, min_quantity: 5, unit_cost: 120.00, location: "Armário A - Prateleira 2" },
    { id: "2", name: "Escala CARS-2 (Manual + Protocolo)", category: "teste_psicologico", quantity_available: 12, min_quantity: 4, unit_cost: 250.00, location: "Armário A - Prateleira 1" },
    { id: "3", name: "Jogo de Encaixe de Madeira Terapeuta", category: "brinquedo_pedagogico", quantity_available: 8, min_quantity: 3, unit_cost: 85.00, location: "Sala TO 02" },
    { id: "4", name: "Massa de Modelar Atóxica (Caixa 12 unid)", category: "material_consumo", quantity_available: 2, min_quantity: 10, unit_cost: 24.50, location: "Almoxarifado B" },
    { id: "5", name: "Timer Visual Time Timer 60 min", category: "equipamento", quantity_available: 6, min_quantity: 2, unit_cost: 180.00, location: "Sala Integrativa" },
  ];

  const displayItems = inventoryList.length > 0 ? inventoryList : mockItems;

  const lowStockCount = displayItems.filter(i => i.quantity_available <= i.min_quantity).length;
  const totalValue = displayItems.reduce((sum, i) => sum + (i.quantity_available * Number(i.unit_cost)), 0);

  return (
    <main className="flex flex-1 flex-col pb-16" style={{ background: "var(--color-bg)" }}>
      <GestorNav active="configuracoes" />

      <div className="flex flex-col gap-8 px-10 pt-9">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1">
              Gestão de Recursos & Logística
            </h6>
            <h1 className="m-0">Estoque e Almoxarifado Terapêutico</h1>
          </div>
          <div className="flex gap-3">
            <button className="btn btn-secondary flex items-center gap-2">
              <ArrowDownRight size={16} /> Dar Baixa / Retirada
            </button>
            <button className="btn btn-primary flex items-center gap-2">
              <Plus size={16} /> Cadastrar Novo Item
            </button>
          </div>
        </div>

        {/* Métrica de Estoque */}
        <section className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-faint mb-2">
              <Package size={18} className="text-blue-600" /> Total de Itens Cadastrados
            </div>
            <div className="tabular-figure text-3xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
              {displayItems.length} tipos de materiais
            </div>
            <span className="text-xs text-ink-faint mt-1 block">Testes, brinquedos e insumos operacionais</span>
          </div>

          <div className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-faint mb-2">
              <AlertTriangle size={18} className="text-amber-500" /> Itens em Nível Crítico (Estoque Mínimo)
            </div>
            <div className="tabular-figure text-3xl font-bold" style={{ fontFamily: "var(--font-heading)", color: lowStockCount > 0 ? "var(--status-falta)" : "var(--status-realizada)" }}>
              {lowStockCount} itens necessitando reposição
            </div>
            <span className="text-xs text-ink-faint mt-1 block">Alerta emitido para compras</span>
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

        {/* Tabela de Estoque */}
        <section className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3>Catálogo de Materiais e Protocolos</h3>
            <div className="relative w-72">
              <Search className="absolute left-3 top-2.5 text-ink-faint" size={16} />
              <input type="text" placeholder="Buscar material ou teste..." className="input pl-9 text-xs" />
            </div>
          </div>

          <table className="table w-full">
            <thead>
              <tr>
                <th>Item / Material Clinico</th>
                <th>Categoria</th>
                <th>Localização</th>
                <th>Qtd Disponível</th>
                <th>Qtd Mínima</th>
                <th>Custo Unitário</th>
                <th>Status Estoque</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {displayItems.map((item: any) => {
                const isCritical = item.quantity_available <= item.min_quantity;
                return (
                  <tr key={item.id}>
                    <td className="font-semibold">{item.name}</td>
                    <td className="capitalize text-xs text-ink-soft">{item.category.replace("_", " ")}</td>
                    <td className="text-xs text-ink-faint">{item.location || "Almoxarifado Central"}</td>
                    <td className="tabular-figure font-bold text-sm">{item.quantity_available}</td>
                    <td className="tabular-figure text-xs text-ink-faint">{item.min_quantity}</td>
                    <td className="tabular-figure text-xs">{formatCurrency(item.unit_cost)}</td>
                    <td>
                      <span className={`tag-status ${isCritical ? 'st-falta' : 'st-realizada'}`}>
                        {isCritical ? 'Reposição Urgente' : 'Estoque Regular'}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-ghost text-xs">Ajustar Saldo</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
