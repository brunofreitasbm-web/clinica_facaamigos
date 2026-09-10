"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateClinicIdentity } from "./actions";

export type ClinicRow = {
  name: string;
  razao_social: string;
  cnpj: string;
  endereco_logradouro: string;
  endereco_numero: string;
  endereco_complemento: string;
  endereco_bairro: string;
  endereco_cidade: string;
  endereco_uf: string;
  endereco_cep: string;
  telefone: string;
  whatsapp: string;
  email: string;
  site: string;
  responsavel_tecnico: string;
  responsavel_tecnico_conselho: string;
};

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  type = "text",
  required,
  className,
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 text-xs font-semibold text-ink-faint ${className ?? ""}`}>
      {label}
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className="input"
      />
    </label>
  );
}

export function DadosClinicaForm({ initial }: { initial: ClinicRow }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);
    const res = await updateClinicIdentity(new FormData(e.currentTarget));
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      <section className="flex flex-col gap-3 rounded-lg border p-4" style={{ borderColor: "var(--color-neutral-200)" }}>
        <h3 className="text-sm font-semibold">Identificação</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Nome fantasia" name="name" defaultValue={initial.name} placeholder="FaçaAmigos" required />
          <Field
            label="Razão social"
            name="razao_social"
            defaultValue={initial.razao_social}
            placeholder="Ex.: FaçaAmigos Terapias Ltda"
          />
          <Field label="CNPJ" name="cnpj" defaultValue={initial.cnpj} placeholder="12.345.678/0001-90" />
          <Field label="Site" name="site" defaultValue={initial.site} placeholder="https://institutofacaamigos.com.br" />
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border p-4" style={{ borderColor: "var(--color-neutral-200)" }}>
        <h3 className="text-sm font-semibold">Endereço</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Field
            label="Logradouro"
            name="endereco_logradouro"
            defaultValue={initial.endereco_logradouro}
            placeholder="Av. Paulista"
            className="sm:col-span-2"
          />
          <Field label="Número" name="endereco_numero" defaultValue={initial.endereco_numero} placeholder="1000" />
          <Field
            label="Complemento"
            name="endereco_complemento"
            defaultValue={initial.endereco_complemento}
            placeholder="Cj. 501"
          />
          <Field label="Bairro" name="endereco_bairro" defaultValue={initial.endereco_bairro} placeholder="Bela Vista" />
          <Field label="Cidade" name="endereco_cidade" defaultValue={initial.endereco_cidade} placeholder="Belém" />
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
            UF
            <select name="endereco_uf" defaultValue={initial.endereco_uf} className="input">
              <option value="">—</option>
              {UFS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </label>
          <Field label="CEP" name="endereco_cep" defaultValue={initial.endereco_cep} placeholder="66015-000" />
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border p-4" style={{ borderColor: "var(--color-neutral-200)" }}>
        <h3 className="text-sm font-semibold">Contato</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Telefone" name="telefone" defaultValue={initial.telefone} placeholder="(11) 98765-4321" />
          <Field label="WhatsApp" name="whatsapp" defaultValue={initial.whatsapp} placeholder="(11) 98765-4321" />
          <Field
            label="E-mail"
            name="email"
            type="email"
            defaultValue={initial.email}
            placeholder="contato@clinicafacaamigos.com.br"
          />
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border p-4" style={{ borderColor: "var(--color-neutral-200)" }}>
        <h3 className="text-sm font-semibold">Responsável Técnico</h3>
        <p className="text-xs text-ink-faint">Sai impresso no rodapé de documentos clínicos (ex.: laudos, relatórios).</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            label="Nome"
            name="responsavel_tecnico"
            defaultValue={initial.responsavel_tecnico}
            placeholder="Fulana de Tal"
          />
          <Field
            label="Registro no conselho"
            name="responsavel_tecnico_conselho"
            defaultValue={initial.responsavel_tecnico_conselho}
            placeholder="CRP 06/12345"
          />
        </div>
      </section>

      {error && (
        <p className="text-xs" style={{ color: "var(--status-falta)" }}>
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="text-xs" style={{ color: "var(--status-realizada)" }}>
          Dados salvos.
        </p>
      )}

      <div className="flex justify-end">
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Salvando…" : "Salvar Dados da Clínica"}
        </button>
      </div>
    </form>
  );
}
