"use client";

import { useState, useTransition } from "react";
import { PageHeader } from "@/components/page-header";
import { QuickActionsBar } from "@/components/quick-actions-bar";
import { ConfigSidebar } from "../config-sidebar";
import { toggleSystemUserActive } from "./actions";
import { UserDialog } from "./user-dialog";
import type { SystemUserRow, UserRole } from "./types";

interface UsuariosManagerProps {
  users: SystemUserRow[];
}

export function UsuariosManager({ users }: UsuariosManagerProps) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUserRow | null>(null);

  const [isPending, startTransition] = useTransition();

  const handleCreate = () => {
    setEditingUser(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (user: SystemUserRow) => {
    setEditingUser(user);
    setIsDialogOpen(true);
  };

  const handleToggleStatus = (user: SystemUserRow) => {
    const actionText = user.active ? "inativar" : "ativar";
    if (confirm(`Deseja realmente ${actionText} o acesso do usuário ${user.name}?`)) {
      startTransition(async () => {
        await toggleSystemUserActive(user.id, !user.active);
      });
    }
  };

  const handleResetPassword = (user: SystemUserRow) => {
    alert(`Link de redefinição de senha enviado para o e-mail ${user.email}`);
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.discipline && u.discipline.toLowerCase().includes(search.toLowerCase()));

    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && u.active) ||
      (statusFilter === "inactive" && !u.active);

    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <>
      <ConfigSidebar active="usuarios" />
      <div className="flex flex-1 flex-col overflow-y-auto">
        <PageHeader
          axisLabel="Configurações"
          title="Usuários do Sistema"
          description="Gestão de credenciais, perfis de acesso (RBAC) e permissões dos profissionais e colaboradores da clínica."
        />

        <div className="flex flex-col gap-6 p-6 sm:p-10">
          {/* Top Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="search"
                className="input"
                style={{ maxWidth: 280 }}
                placeholder="Buscar por nome ou e-mail..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <select
                className="input cursor-pointer"
                style={{ maxWidth: 180 }}
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="all">Todos os perfis</option>
                <option value="gestor">Gestor</option>
                <option value="recepcao">Recepção</option>
                <option value="terapeuta">Terapeuta</option>
                <option value="financeiro">Financeiro</option>
                <option value="admin">Administrador</option>
              </select>

              <select
                className="input cursor-pointer"
                style={{ maxWidth: 150 }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Todos os status</option>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
              </select>
            </div>

            <button onClick={handleCreate} className="button button-primary">
              + Novo Usuário
            </button>
          </div>

          {/* Users Table */}
          <div className="rounded-xl border border-paper-line bg-paper-panel overflow-hidden shadow-sm">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Perfil de Acesso</th>
                  <th>Conselho / Especialidade</th>
                  <th>Data de Cadastro</th>
                  <th>Status</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td className="font-semibold">
                      <div className="flex flex-col">
                        <span className="text-ink-strong">{u.name}</span>
                        <span className="text-xs text-ink-faint font-normal">{u.email}</span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`tag text-[11px] font-medium ${
                          u.role === "admin" || u.role === "gestor"
                            ? "bg-purple-100 text-purple-700"
                            : u.role === "financeiro"
                            ? "bg-amber-100 text-amber-800"
                            : u.role === "recepcao"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {u.roleLabel}
                      </span>
                    </td>
                    <td>{u.discipline || "—"}</td>
                    <td>{u.createdAt}</td>
                    <td>
                      <span className={`tag-status ${u.active ? "st-realizada" : "st-cancelada"}`}>
                        {u.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end items-center gap-2">
                        <button
                          onClick={() => handleEdit(u)}
                          className="text-xs text-accent font-medium hover:underline px-2 py-1"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleResetPassword(u)}
                          className="text-xs text-ink-soft hover:text-ink-strong font-medium px-2 py-1"
                          title="Enviar link de redefinição de senha"
                        >
                          Resetar Senha
                        </button>
                        <button
                          onClick={() => handleToggleStatus(u)}
                          disabled={isPending}
                          className={`text-xs font-medium px-2 py-1 rounded ${
                            u.active
                              ? "text-rose-600 hover:bg-rose-50"
                              : "text-emerald-600 hover:bg-emerald-50"
                          }`}
                        >
                          {u.active ? "Inativar" : "Ativar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-ink-faint text-sm">
                      Nenhum usuário encontrado com os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Dialog */}
        <UserDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          userToEdit={editingUser}
        />
      </div>
    </>
  );
}
