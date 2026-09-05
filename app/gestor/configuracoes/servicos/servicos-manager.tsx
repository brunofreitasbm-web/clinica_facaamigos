"use client";

import { useMemo, useState } from "react";
import { DeleteServicePriceButton } from "./delete-service-price-button";
import { NewInsurerDialog } from "./new-insurer-dialog";
import { ServicePriceDialog } from "./service-price-dialog";
import type { InsurerOption, ServicePriceRow } from "./types";

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function ServicosManager({ services, insurers }: { services: ServicePriceRow[]; insurers: InsurerOption[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return services;
    return services.filter((s) => s.procedureName.toLowerCase().includes(term) || s.insurerName.toLowerCase().includes(term));
  }, [services, search]);

  return (
    <div className="flex flex-col gap-6 p-6 sm:p-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <input
            type="search"
            className="input"
            style={{ maxWidth: 280 }}
            placeholder="Buscar"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <NewInsurerDialog />
        </div>
        <ServicePriceDialog insurers={insurers} />
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Serviço</th>
            <th></th>
            <th>Custo</th>
            <th>Preço</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((s) => (
            <tr key={s.id}>
              <td className="font-semibold">
                {s.procedureName}
                <div className="mt-0.5 text-xs font-normal text-ink-faint">{s.insurerName}</div>
              </td>
              <td>
                <ServicePriceDialog
                  insurers={insurers}
                  prefill={{ procedureCode: s.procedureCode, procedureName: s.procedureName }}
                  trigger={<span className="tag tag-outline cursor-pointer">+ Adicionar convênio</span>}
                />
              </td>
              <td className="tabular-figure">{s.cost != null ? currencyFormatter.format(s.cost) : "-"}</td>
              <td className="tabular-figure">{currencyFormatter.format(s.price)}</td>
              <td className="text-right">
                <div className="flex justify-end gap-1">
                  <ServicePriceDialog insurers={insurers} servicePrice={s} />
                  <DeleteServicePriceButton id={s.id} name={s.procedureName} />
                </div>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={5} className="text-ink-faint">
                {services.length === 0 ? "Nenhum serviço cadastrado ainda." : "Nenhum resultado para essa busca."}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <p className="text-xs text-ink-faint">
        {filtered.length} de {services.length} serviços
      </p>
    </div>
  );
}
