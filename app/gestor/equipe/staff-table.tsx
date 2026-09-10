"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Pencil,
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  ShieldOff,
  Cake,
  Copy,
} from "lucide-react";
import { toggleStaffActive, resetStaffPassword, resetSignaturePin } from "./actions";
import { ROLES, ROLE_LABEL } from "@/lib/roles";
import { StaffDialog } from "./staff-dialog";
import { useToast } from "@/components/toast-provider";
import { formatBirthday, isBirthdayThisMonth, isBirthdayToday } from "./birthdays";
import type { StaffRow, UnitOption } from "./types";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
const DEFAULT_PAGE_SIZE = 20;

const MONTH_LABEL = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function StaffTable({ staff, units }: { staff: StaffRow[]; units: UnitOption[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [unitFilter, setUnitFilter] = useState<string>("all");
  const [birthdayOnly, setBirthdayOnly] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<StaffRow | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<StaffRow | null>(null);
  const [pinTarget, setPinTarget] = useState<StaffRow | null>(null);
  const [tempPassword, setTempPassword] = useState<{ name: string; password: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  // Uma referência de "hoje" só, criada no primeiro render: recalcular por
  // linha deixaria colunas e contador dessincronizados numa virada de dia.
  const today = useMemo(() => new Date(), []);
  const birthdaysThisMonth = staff.filter(
    (s) => s.active && isBirthdayThisMonth(s.birthDate, today),
  ).length;

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
    const term = search.toLowerCase();
    const matchesSearch =
      s.fullName.toLowerCase().includes(term) ||
      (s.councilType ?? "").toLowerCase().includes(term) ||
      (s.email ?? "").toLowerCase().includes(term);
    const matchesRole = roleFilter === "all" || s.role === roleFilter;
    const matchesStatus =
      statusFilter === "all" || (statusFilter === "active" ? s.active : !s.active);
    const matchesUnit =
      unitFilter === "all" || (unitFilter === "none" ? !s.unitId : s.unitId === unitFilter);
    const matchesBirthday = !birthdayOnly || isBirthdayThisMonth(s.birthDate, today);
    return matchesSearch && matchesRole && matchesStatus && matchesUnit && matchesBirthday;
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

  const handleResetPassword = () => {
    if (!passwordTarget) return;
    const target = passwordTarget;
    startTransition(async () => {
      const result = await resetStaffPassword(target.id);
      if (!result.success) {
        toast(result.error, "error");
        setPasswordTarget(null);
        return;
      }
      // A senha temporária só existe aqui: não fica no banco nem no audit_log,
      // então a modal fica aberta até o gestor confirmar que anotou.
      setTempPassword({ name: target.fullName, password: result.tempPassword });
      setPasswordTarget(null);
    });
  };

  const handleResetPin = () => {
    if (!pinTarget) return;
    const target = pinTarget;
    startTransition(async () => {
      const result = await resetSignaturePin(target.id);
      toast(
        result.success
          ? `PIN de assinatura de ${target.fullName} resetado. Ele cadastra um novo na próxima evolução.`
          : result.error,
        result.success ? "success" : "error",
      );
      setPinTarget(null);
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
            placeholder="Buscar por nome, e-mail ou conselho..."
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
            style={{ minWidth: 190 }}
            value={unitFilter}
            onChange={(e) => {
              setUnitFilter(e.target.value);
              handleFilterChange();
            }}
          >
            <option value="all">Todas as unidades</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
            <option value="none">Sem unidade</option>
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
          <button
            type="button"
            onClick={() => {
              setBirthdayOnly((v) => !v);
              handleFilterChange();
            }}
            aria-pressed={birthdayOnly}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
              birthdayOnly
                ? "border-accent bg-accent/10 text-accent"
                : "border-paper-line text-ink-soft hover:bg-neutral-100"
            }`}
          >
            <Cake size={15} />
            Aniversariantes de {MONTH_LABEL[today.getMonth()]}
            <span className="tag text-[11px] bg-neutral-100 text-ink-soft">{birthdaysThisMonth}</span>
          </button>
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

      <div className="rounded-xl border border-paper-line bg-paper-panel overflow-x-auto shadow-sm">
        <table className="table w-full">
          <thead>
            <tr>
              <th>Colaborador</th>
              <th>Papel</th>
              <th>Unidade</th>
              <th>Conselho / especialidade</th>
              <th>Aniversário</th>
              <th>Status</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((s) => (
              <tr key={s.id}>
                <td>
                  <div className="flex flex-col">
                    <span className="font-semibold text-ink-strong">{s.fullName}</span>
                    <span className="text-xs text-ink-faint">{s.email || "sem e-mail"}</span>
                    {s.sourceSystem === "grupo_ib" && (
                      <span className="mt-1 w-fit tag text-[10px] font-medium bg-sky-100 text-sky-800">
                        Grupo IB
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <span className="tag text-[11px] font-medium bg-emerald-100 text-emerald-800">
                    {ROLE_LABEL[s.role]}
                  </span>
                </td>
                <td className="text-sm">{s.unitName || "—"}</td>
                <td>{s.councilType || "—"}</td>
                <td>
                  <span
                    className={`inline-flex items-center gap-1.5 text-sm ${
                      isBirthdayToday(s.birthDate, today) ? "font-semibold text-accent" : ""
                    }`}
                  >
                    {isBirthdayThisMonth(s.birthDate, today) && <Cake size={14} />}
                    {formatBirthday(s.birthDate)}
                  </span>
                </td>
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
                      onClick={() => setPasswordTarget(s)}
                      disabled={isPending || !s.email}
                      title={s.email ? "Resetar senha de acesso" : "Colaborador sem e-mail de login"}
                      aria-label={`Resetar senha de ${s.fullName}`}
                      className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-soft hover:bg-neutral-100 hover:text-accent transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <KeyRound size={18} />
                    </button>
                    <button
                      onClick={() => setPinTarget(s)}
                      disabled={isPending || !s.hasSignaturePin}
                      title={
                        s.hasSignaturePin
                          ? "Resetar PIN de assinatura"
                          : "Colaborador ainda não cadastrou PIN de assinatura"
                      }
                      aria-label={`Resetar PIN de assinatura de ${s.fullName}`}
                      className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-soft hover:bg-neutral-100 hover:text-accent transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <ShieldOff size={18} />
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
                <td colSpan={7} className="text-center py-8 text-ink-faint text-sm">
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

      {/* A key remonta o diálogo a cada alvo: sem ela os campos ficariam com o
          estado inicial do primeiro colaborador aberto na sessão. */}
      <StaffDialog
        key={editing?.id ?? "novo"}
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        staffToEdit={editing}
        units={units}
      />

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

      {passwordTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-paper-line bg-paper-panel p-6 shadow-xl">
            <h2 className="text-base font-semibold text-ink-strong">Resetar senha de acesso?</h2>
            <p className="mt-2 text-sm text-ink-soft">
              {passwordTarget.fullName} vai receber uma senha temporária e será obrigado a trocá-la
              no próximo login. A senha atual deixa de funcionar imediatamente.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPasswordTarget(null)}
                disabled={isPending}
                className="btn btn-secondary"
              >
                Cancelar
              </button>
              <button type="button" onClick={handleResetPassword} disabled={isPending} className="btn btn-primary">
                {isPending ? "Gerando…" : "Gerar senha temporária"}
              </button>
            </div>
          </div>
        </div>
      )}

      {tempPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-paper-line bg-paper-panel p-6 shadow-xl">
            <h2 className="text-base font-semibold text-ink-strong">Senha temporária gerada</h2>
            <p className="mt-2 text-sm text-ink-soft">
              Entregue esta senha a {tempPassword.name} agora — ela não fica salva em lugar nenhum e
              não poderá ser consultada depois.
            </p>
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-paper-line bg-neutral-50 px-3 py-2">
              <code className="flex-1 break-all text-sm font-semibold text-ink-strong">
                {tempPassword.password}
              </code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard
                    ?.writeText(tempPassword.password)
                    .then(() => toast("Senha copiada.", "success"))
                    .catch(() => toast("Não foi possível copiar — selecione e copie manualmente.", "error"));
                }}
                aria-label="Copiar senha temporária"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft hover:bg-neutral-200"
              >
                <Copy size={16} />
              </button>
            </div>
            <div className="mt-6 flex justify-end">
              <button type="button" onClick={() => setTempPassword(null)} className="btn btn-primary">
                Já anotei, fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {pinTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-paper-line bg-paper-panel p-6 shadow-xl">
            <h2 className="text-base font-semibold text-ink-strong">Resetar PIN de assinatura?</h2>
            <p className="mt-2 text-sm text-ink-soft">
              O PIN de {pinTarget.fullName} será apagado (junto com qualquer bloqueio por tentativas
              erradas). Na próxima evolução o sistema vai pedir que ele cadastre um PIN novo — só o
              próprio terapeuta define o PIN, ninguém consulta o atual.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPinTarget(null)}
                disabled={isPending}
                className="btn btn-secondary"
              >
                Cancelar
              </button>
              <button type="button" onClick={handleResetPin} disabled={isPending} className="btn btn-primary">
                {isPending ? "Resetando…" : "Resetar PIN"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
