"use client";

import React, { useState } from "react";
import { FixedSizeList, ListChildComponentProps } from "react-window";
import { Search, Package, CheckCircle2, AlertTriangle } from "lucide-react";

export interface ProductItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  status: "disponivel" | "baixo" | "esgotado";
  price?: number;
}

const DEFAULT_PRODUCTS: ProductItem[] = Array.from({ length: 500 }, (_, idx) => {
  const categories = ["Material Terapêutico ABA", "Equipamento TO", "Insumo Fonoaudiologia", "Papelaria & Testes"];
  const category = categories[idx % categories.length];
  const stock = (idx * 7) % 85;
  const status: ProductItem["status"] = stock > 20 ? "disponivel" : stock > 0 ? "baixo" : "esgotado";

  return {
    id: `PROD-${(idx + 1).toString().padStart(4, "0")}`,
    name: `${category} - Item Especializado #${idx + 1}`,
    category,
    stock,
    unit: "unidade(s)",
    status,
    price: 49.9 + (idx % 15) * 12.5,
  };
});

interface RowData {
  items: ProductItem[];
}

const statusTags: Record<ProductItem["status"], string> = {
  disponivel: "bg-[#e2f9ee] text-[#0e6b3f]",
  baixo: "bg-[#fde6ef] text-[#f0196b]",
  esgotado: "bg-[#fce4e4] text-[#8a1f1f]",
};

const statusLabels: Record<ProductItem["status"], string> = {
  disponivel: "Em estoque",
  baixo: "Estoque baixo",
  esgotado: "Esgotado",
};

function ProductRow({ index, style, data }: ListChildComponentProps<RowData>) {
  const item = data.items[index];
  if (!item) return null;

  return (
    <div
      style={style}
      className={`flex items-center px-4 border-b border-paper-line text-sm transition-colors hover:bg-[#fde6ef]/30 ${
        index % 2 === 0 ? "bg-white" : "bg-neutral-50/50"
      }`}
    >
      <div className="w-1/4 font-semibold text-ink truncate flex items-center gap-2">
        <Package className="w-4 h-4 text-ink-faint shrink-0" />
        <span className="truncate">{item.name}</span>
      </div>
      <div className="w-1/4 text-ink-soft truncate">{item.category}</div>
      <div className="w-1/6 text-ink-soft tabular-figure font-medium">
        {item.stock} {item.unit}
      </div>
      <div className="w-1/6">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${statusTags[item.status]}`}>
          {item.status === "disponivel" && <CheckCircle2 className="w-3 h-3" />}
          {item.status === "baixo" && <AlertTriangle className="w-3 h-3" />}
          {statusLabels[item.status]}
        </span>
      </div>
      <div className="w-1/6 text-right font-bold text-ink tabular-figure">
        {item.price ? `R$ ${item.price.toFixed(2)}` : "—"}
      </div>
    </div>
  );
}

export interface ProductListProps {
  items?: ProductItem[];
}

export function ProductList({ items = DEFAULT_PRODUCTS }: ProductListProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="card w-full p-6 shadow-sm border border-paper-line rounded-xl bg-white">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-extrabold text-ink m-0">Cadastros & Produtos da Clínica</h2>
          <p className="text-xs text-ink-faint mt-1">
            Listagem de materiais e insumos com virtualização de alta performance ({filteredItems.length} itens).
          </p>
        </div>

        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
          <input
            type="text"
            placeholder="Buscar produto ou categoria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-9 text-sm"
          />
        </div>
      </div>

      {/* Cabeçalho da Tabela */}
      <div className="flex items-center px-4 py-3 bg-neutral-100 rounded-t-lg border-b-2 border-neutral-300 font-bold text-xs uppercase tracking-wider text-ink-faint">
        <div className="w-1/4">Item / Produto</div>
        <div className="w-1/4">Categoria</div>
        <div className="w-1/6">Estoque</div>
        <div className="w-1/6">Status</div>
        <div className="w-1/6 text-right">Valor Unitário</div>
      </div>

      {/* Renderização Virtualizada via react-window FixedSizeList */}
      {filteredItems.length > 0 ? (
        <FixedSizeList
          height={600}
          itemCount={filteredItems.length}
          itemSize={50}
          width="100%"
          itemData={{ items: filteredItems }}
          className="border-b border-paper-line rounded-b-lg"
        >
          {ProductRow}
        </FixedSizeList>
      ) : (
        <div className="py-12 text-center text-sm text-ink-faint border border-dashed border-paper-line rounded-b-lg">
          Nenhum item encontrado com os filtros aplicados.
        </div>
      )}
    </div>
  );
}
