"use client";

import { useState, useTransition } from "react";
import { toggleStaffActive } from "./actions";
import { ROLES, ROLE_LABEL } from "@/lib/roles";
import { StaffDialog } from "./staff-dialog";
import { useToast } from "@/components/toast-provider";
import type { StaffRow } from "./types";

export function StaffTable({ staff }: { staff: StaffRow[] }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const filtered = staff.filter((s) => {
    const matchesSearch =
      s.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (s.councilType ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || s.role === roleFilter;
    const matchesStatus =
      statusFilter === "all" || (statusFilter === "active" ? s.active : !s.active);
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleToggle = (row: StaffRow) => {
    const actionText = row.active ? "inativar" : "ativar";
    if (!confirm(`Deseja realmente ${actionText} o acesso de ${row.fullName}?`)) return;
    startTransition(async () => {
      const result = await toggleStaffActive(row.id, !row.active);
      if (!result.success) toast(result.error, "error");
    });
  };

  return (
    <div className="flex flex-col gap-6 p-6 sm:p-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            className="input"
            style={{ maxWidth: 280 }}
            placeholder="Buscar por nome ou conselho..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="input cursor-pointer" style={{ maxWidth: 180 }} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="all">Todos os papéis</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </select>
          <select className="input cursor-pointer" style={{ maxWidth: 150 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Todos os status</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setIsDialogOpen(true);
          }}
          className="button button-primary"
        >
          + Novo colaborador
        </button>
      </div>

      <div className="rounded-xl border border-paper-line bg-paper-panel overflow-hidden shadow-sm">
        <table className="table w-full">
          <thead>
            <tr>
              <th>Colaborador</th>
              <th>Papel</th>
              <th>Conselho / especialidade</th>
              <th>Cadastrado em</th>
              <th>Status</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id}>
                <td className="font-semibold text-ink-strong">{s.fullName}</td>
                <td>
                  <span className="tag text-[11px] font-medium bg-emerald-100 text-emerald-800">
                    {ROLE_LABEL[s.role]}
                  </span>
                </td>
                <td>{s.councilType || "—"}</td>
                <td>{s.createdAtLabel}</td>
                <td>
                  <span className={`tag-status ${s.active ? "st-realizada" : "st-cancelada"}`}>
                    {s.active ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="text-right">
                  <div className="flex justify-end items-center gap-2">
                    <button
                      onClick={() => {
                        setEditing(s);
                        setIsDialogOpen(true);
                      }}
                      className="text-xs text-accent font-medium hover:underline px-2 py-1"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleToggle(s)}
                      disabled={isPending}
                      className={`text-xs font-medium px-2 py-1 rounded ${s.active ? "text-rose-600 hover:bg-rose-50" : "text-emerald-600 hover:bg-emerald-50"}`}
                    >
                      {s.active ? "Inativar" : "Ativar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-ink-faint text-sm">
                  Nenhum colaborador encontrado com os filtros selecionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <StaffDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} staffToEdit={editing} />
    </div>
  );
}
