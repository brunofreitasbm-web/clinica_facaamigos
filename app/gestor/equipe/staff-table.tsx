"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Pencil, Ban, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { toggleStaffActive } from "./actions";
import { ROLES, ROLE_LABEL } from "@/lib/roles";
import { StaffDialog } from "./staff-dialog";
import { useToast } from "@/components/toast-provider";
import type { StaffRow } from "./types";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
const DEFAULT_PAGE_SIZE = 20;

export function StaffTable({ staff }: { staff: StaffRow[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<StaffRow | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const limitParam = Number(searchParams.get("limit") ?? String(DEFAULT_PAGE_SIZE));
  const limit = PAGE_SIZE_OPTIONS.includes(limitParam as (typeof PAGE_SIZE_OPTIONS)[number])
    ? limitParam
    : DEFAULT_PAGE_SIZE;

  const updateQuery = (next: { page?: number; limit?: number }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next.page !== undefined) params.set("page", String(next.page));
    if (next.limit !== undefined) params.set("limit", String(next.limit));
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const filtered = staff.filter((s) => {
    const matchesSearch =
      s.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (s.councilType ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || s.role === roleFilter;
    const matchesStatus =
      statusFilter === "all" || (statusFilter === "active" ? s.active : !s.active);
    return matchesSearch && matchesRole && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * limit, currentPage * limit);

  // Se os filtros reduzirem o total de páginas, volta para uma página válida.
  useEffect(() => {
    if (page > totalPages) updateQuery({ page: totalPages });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  const handleFilterChange = () => {
    if (page !== 1) updateQuery({ page: 1 });
  };

  const handleConfirmToggle = () => {
    if (!confirmTarget) return;
    const target = confirmTarget;
    startTransition(async () => {
      const result = await toggleStaffActive(target.id, !target.active);
      if (!result.success) toast(result.error, "error");
      setConfirmTarget(null);
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
            onChange={(e) => {
              setSearch(e.target.value);
              handleFilterChange();
            }}
          />
          <select
            className="input cursor-pointer"
            style={{ minWidth: 190 }}
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              handleFilterChange();
            }}
          >
            <option value="all">Todos os papéis</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </select>
          <select
            className="input cursor-pointer"
            style={{ minWidth: 170 }}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              handleFilterChange();
            }}
          >
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
          className="btn btn-primary"
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
            {paginated.map((s) => (
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
                  <div className="flex justify-end items-center gap-1">
                    <button
                      onClick={() => {
                        setEditing(s);
                        setIsDialogOpen(true);
                      }}
                      title="Editar colaborador"
                      aria-label={`Editar ${s.fullName}`}
                      className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-soft hover:bg-neutral-100 hover:text-accent transition-colors"
                    >
                      <Pencil size={18} />
                    </button>
                    <button
                      onClick={() => setConfirmTarget(s)}
                      disabled={isPending}
                      title={s.active ? "Inativar acesso" : "Reativar acesso"}
                      aria-label={`${s.active ? "Inativar" : "Reativar"} acesso de ${s.fullName}`}
                      className={`flex h-11 w-11 items-center justify-center rounded-lg transition-colors disabled:opacity-50 ${
                        s.active ? "text-rose-600 hover:bg-rose-50" : "text-emerald-600 hover:bg-emerald-50"
                      }`}
                    >
                      {s.active ? <Ban size={18} /> : <CheckCircle2 size={18} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {paginated.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-ink-faint text-sm">
                  Nenhum colaborador encontrado com os filtros selecionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-paper-line px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-ink-faint">
            <span>Itens por página</span>
            <select
              className="input cursor-pointer"
              style={{ minWidth: 72 }}
              value={limit}
              onChange={(e) => updateQuery({ limit: Number(e.target.value), page: 1 })}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 text-xs text-ink-faint">
            <span>
              Página {currentPage} de {totalPages} · {filtered.length} colaborador{filtered.length === 1 ? "" : "es"}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => updateQuery({ page: currentPage - 1 })}
                disabled={currentPage <= 1}
                aria-label="Página anterior"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-paper-line text-ink-soft hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => updateQuery({ page: currentPage + 1 })}
                disabled={currentPage >= totalPages}
                aria-label="Próxima página"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-paper-line text-ink-soft hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <StaffDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} staffToEdit={editing} />

      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-paper-line bg-paper-panel p-6 shadow-xl">
            <h2 className="text-base font-semibold text-ink-strong">
              {confirmTarget.active ? "Inativar colaborador?" : "Reativar colaborador?"}
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              {confirmTarget.active
                ? `Tem certeza que deseja inativar o acesso de ${confirmTarget.fullName}? O usuário perderá acesso ao sistema imediatamente.`
                : `Tem certeza que deseja reativar o acesso de ${confirmTarget.fullName}?`}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                disabled={isPending}
                className="btn btn-secondary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmToggle}
                disabled={isPending}
                className={
                  confirmTarget.active
                    ? "btn text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-700"
                    : "btn btn-primary"
                }
              >
                {isPending ? "Salvando…" : confirmTarget.active ? "Inativar" : "Reativar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
