"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, Camera, KeyRound, LogOut, UserRound, type LucideIcon } from "lucide-react";
import { signOut } from "@/app/login/actions";
import { uploadOwnAvatar, changeOwnPassword, getOwnProfile, saveOwnProfile, type OwnProfile } from "@/app/conta/actions";
import { formatCpfMask, formatPhoneMask } from "@/lib/masks";
import { prepareFormDataFile } from "@/lib/compress-image";
import { useBackLayers } from "@/lib/use-back-handler";
import type { CurrentUserMenu } from "@/lib/current-user-menu";

export type PersonalLink = { key: string; label: string; href: string; icon?: LucideIcon };

type Dialog = null | "avatar" | "password" | "profile";

/** Formulário "Meu cadastro": carrega os dados ao abrir e salva só campos pessoais. */
function ProfileForm({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<OwnProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    getOwnProfile().then((res) => {
      if (!alive) return;
      if (!res.success) return setError(res.error);
      setForm({ ...res.profile, cpf: formatCpfMask(res.profile.cpf), phone: formatPhoneMask(res.profile.phone) });
    });
    return () => {
      alive = false;
    };
  }, []);

  if (done) {
    return (
      <>
        <p className="text-sm text-ink-soft">Cadastro atualizado.</p>
        <div className="dialog-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </>
    );
  }
  if (!form) {
    return error ? <p className="text-xs text-status-negative-text">{error}</p> : <p className="text-sm text-ink-faint">Carregando…</p>;
  }

  const set = (k: keyof OwnProfile, v: string) => setForm({ ...form, [k]: v });

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const result = await saveOwnProfile(formData);
          if (!result.success) return setError(result.error);
          setDone(true);
        });
      }}
    >
      <label className="flex flex-col gap-1 text-xs font-semibold">
        Nome completo
        <input name="fullName" required value={form.fullName} onChange={(e) => set("fullName", e.target.value)} autoComplete="name" className="input" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold">
        CPF
        <input name="cpf" inputMode="numeric" placeholder="000.000.000-00" value={form.cpf} onChange={(e) => set("cpf", formatCpfMask(e.target.value))} className="input" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold">
        E-mail
        <input name="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" className="input" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold">
        Telefone
        <input name="phone" type="tel" inputMode="tel" placeholder="(00) 00000-0000" value={form.phone} onChange={(e) => set("phone", formatPhoneMask(e.target.value))} className="input" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold">
        Data de nascimento
        <input name="birthDate" type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} className="input" />
      </label>
      {error && <p className="text-xs text-status-negative-text">{error}</p>}
      <div className="dialog-actions">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={isPending}>
          {isPending ? "Salvando…" : "Salvar cadastro"}
        </button>
      </div>
    </form>
  );
}

function initialsOf(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

/**
 * Menu do operador na barra do módulo: nome + avatar no gatilho; no menu,
 * links pessoais do módulo (ex.: "Minha bonificação"), foto de perfil, troca
 * de senha e sair. Fica dentro do <ModuleHeader>, então aparece em todos os
 * módulos sem repetir o código.
 */
export function UserMenu({ user, personalLinks = [] }: { user: CurrentUserMenu; personalLinks?: readonly PersonalLink[] }) {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  // Fecha o menu ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function closeDialog() {
    setDialog(null);
    setError(null);
    setDone(null);
    setPreview(null);
  }

  // Botão/gesto voltar do celular fecha o diálogo em vez de sair da página.
  useBackLayers([{ active: dialog !== null, back: closeDialog }]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[44px] items-center gap-2 rounded-lg px-2 py-1 text-[13px] font-semibold transition-all duration-150 hover:opacity-90 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white cursor-pointer"
        style={{ color: "var(--color-on-accent)" }}
      >
        <span
          className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full text-xs font-semibold"
          style={{ background: "var(--color-accent-2)", color: "var(--color-accent)" }}
          aria-hidden
        >
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initialsOf(user.name)
          )}
        </span>
        <span className="hidden max-w-[160px] truncate sm:inline">{user.name}</span>
        <ChevronDown size={14} aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-60 overflow-hidden rounded-lg border bg-white py-1 text-sm text-ink shadow-lg"
          style={{ borderColor: "var(--color-neutral-200)" }}
        >
          <div className="border-b px-3 py-2" style={{ borderColor: "var(--color-neutral-200)" }}>
            <div className="truncate font-semibold">{user.name}</div>
            {user.email && <div className="truncate text-xs text-ink-faint">{user.email}</div>}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setDialog("profile");
              }}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold hover:bg-paper-line cursor-pointer"
              style={{ borderColor: "var(--color-neutral-200)" }}
            >
              <UserRound size={13} aria-hidden />
              Meu cadastro
            </button>
          </div>

          {personalLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.key}
                href={link.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2 no-underline hover:bg-paper-line"
              >
                {Icon && <Icon size={15} aria-hidden />}
                {link.label}
              </Link>
            );
          })}

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setDialog("avatar");
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-paper-line cursor-pointer"
          >
            <Camera size={15} aria-hidden />
            Foto de perfil
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setDialog("password");
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-paper-line cursor-pointer"
          >
            <KeyRound size={15} aria-hidden />
            Mudar senha
          </button>

          <div className="my-1 border-t" style={{ borderColor: "var(--color-neutral-200)" }} />

          <form action={signOut}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-status-negative-text hover:bg-paper-line cursor-pointer"
            >
              <LogOut size={15} aria-hidden />
              Sair
            </button>
          </form>
        </div>
      )}

      {dialog !== null && (
        <div className="dialog-backdrop" onClick={closeDialog}>
          <div className="dialog" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            {dialog === "profile" ? (
              <>
                <div className="dialog-title">Meu cadastro</div>
                <ProfileForm onClose={closeDialog} />
              </>
            ) : dialog === "avatar" ? (
              <>
                <div className="dialog-title">Foto de perfil</div>
                {done ? (
                  <p className="text-sm text-ink-soft">{done}</p>
                ) : (
                  <form
                    className="flex flex-col gap-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      const file = formData.get("avatar");
                      if (!(file instanceof File) || file.size === 0) {
                        setError("Selecione uma imagem.");
                        return;
                      }
                      setError(null);
                      startTransition(async () => {
                        await prepareFormDataFile(formData, "avatar", "avatar");
                        const result = await uploadOwnAvatar(formData);
                        if (!result.success) {
                          setError(result.error);
                          return;
                        }
                        setDone("Foto atualizada.");
                      });
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <span
                        className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full text-lg font-semibold"
                        style={{ background: "var(--color-accent-100)", color: "var(--color-accent-700)" }}
                        aria-hidden
                      >
                        {preview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={preview} alt="" className="h-full w-full object-cover" />
                        ) : user.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          initialsOf(user.name)
                        )}
                      </span>
                      <input
                        type="file"
                        name="avatar"
                        accept="image/jpeg,image/png,image/webp"
                        className="text-sm"
                        onChange={(e) => {
                          const f = e.currentTarget.files?.[0];
                          setPreview(f ? URL.createObjectURL(f) : null);
                        }}
                      />
                    </div>
                    {error && <p className="text-xs text-status-negative-text">{error}</p>}
                    <div className="dialog-actions">
                      <button type="button" className="btn btn-ghost" onClick={closeDialog}>
                        Cancelar
                      </button>
                      <button type="submit" className="btn btn-primary" disabled={isPending}>
                        {isPending ? "Enviando…" : "Salvar foto"}
                      </button>
                    </div>
                  </form>
                )}
              </>
            ) : (
              <>
                <div className="dialog-title">Mudar senha</div>
                {done ? (
                  <p className="text-sm text-ink-soft">{done}</p>
                ) : (
                  <form
                    className="flex flex-col gap-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      setError(null);
                      startTransition(async () => {
                        const result = await changeOwnPassword(formData);
                        if (!result.success) {
                          setError(result.error);
                          return;
                        }
                        setDone("Senha alterada com sucesso.");
                        e.currentTarget.reset();
                      });
                    }}
                  >
                    <input type="password" name="password" required placeholder="Nova senha" autoComplete="new-password" className="input" />
                    <input type="password" name="confirmPassword" required placeholder="Confirmar nova senha" autoComplete="new-password" className="input" />
                    <p className="text-xs text-ink-faint">Mínimo de 6 caracteres, uma letra maiúscula e um caractere especial.</p>
                    {error && <p className="text-xs text-status-negative-text">{error}</p>}
                    <div className="dialog-actions">
                      <button type="button" className="btn btn-ghost" onClick={closeDialog}>
                        Cancelar
                      </button>
                      <button type="submit" className="btn btn-primary" disabled={isPending}>
                        {isPending ? "Salvando…" : "Salvar senha"}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
            {done && dialog !== "profile" && (
              <div className="dialog-actions">
                <button type="button" className="btn btn-primary" onClick={closeDialog}>
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
