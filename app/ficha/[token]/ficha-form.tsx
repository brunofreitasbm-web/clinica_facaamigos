"use client";

import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { submitFicha } from "./actions";

/**
 * Formulário público da ficha. Vocabulário visual do sistema (.card, .input,
 * .btn, tokens --color-*) — nada de paleta própria: quem preenche isto é a
 * família, e a tela precisa parecer da clínica.
 */

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB",
  "PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

/**
 * Nascimento em três selects, como no check-in público
 * (app/checkin/[token]/checkin-form.tsx): o teclado nativo de data varia
 * demais entre aparelhos e trava quem não usa smartphone todo dia.
 */
function CamposNascimento({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const [dia, setDia] = useState("");
  const [mes, setMes] = useState("");
  const [ano, setAno] = useState("");
  const anoAtual = new Date().getFullYear();

  function atualizar(d: string, m: string, a: string) {
    setDia(d); setMes(m); setAno(a);
    onChange(d && m && a ? `${a}-${m.padStart(2, "0")}-${d.padStart(2, "0")}` : "");
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <input type="hidden" name="data_nascimento" value={value} />
      <select className="input" value={dia} onChange={(e) => atualizar(e.target.value, mes, ano)} aria-label="Dia de nascimento">
        <option value="">Dia</option>
        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
      <select className="input" value={mes} onChange={(e) => atualizar(dia, e.target.value, ano)} aria-label="Mês de nascimento">
        <option value="">Mês</option>
        {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>
      <select className="input" value={ano} onChange={(e) => atualizar(dia, mes, e.target.value)} aria-label="Ano de nascimento">
        <option value="">Ano</option>
        {Array.from({ length: anoAtual - 1900 + 1 }, (_, i) => anoAtual - i).map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
    </div>
  );
}

function Responsavel({ n, titulo, obrigatorio }: { n: 1 | 2; titulo: string; obrigatorio?: boolean }) {
  return (
    <fieldset className="m-0 flex flex-col gap-4 border-0 p-0">
      <legend className="card-kicker mb-1">{titulo}</legend>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="field sm:col-span-2">
          <span>Nome completo {obrigatorio && "*"}</span>
          <input className="input" type="text" name={`resp${n}_nome`} required={obrigatorio} autoComplete="name" />
        </label>
        <label className="field">
          <span>WhatsApp {obrigatorio && "*"}</span>
          <input className="input" type="tel" name={`resp${n}_telefone`} required={obrigatorio} placeholder="(00) 00000-0000" autoComplete="tel" />
        </label>
        <label className="field">
          <span>Parentesco</span>
          <input className="input" type="text" name={`resp${n}_parentesco`} placeholder="Mãe, pai, avó…" />
        </label>
        <label className="field sm:col-span-2">
          <span>E-mail</span>
          <input className="input" type="email" name={`resp${n}_email`} autoComplete="email" />
        </label>
      </div>
      <p className="m-0 text-xs text-ink-soft">
        O WhatsApp é como reconhecemos o responsável já cadastrado — sem ele, esta parte não é salva.
      </p>
    </fieldset>
  );
}

export function FichaForm({ token, patientName }: { token: string; patientName: string }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);
  const [nascimento, setNascimento] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);

    const resultado = await submitFicha(token, new FormData(e.currentTarget));

    if (resultado.success) {
      setPronto(true);
    } else {
      setErro(resultado.error);
      setEnviando(false);
    }
  }

  if (pronto) {
    return (
      <div className="card items-center gap-3 p-10 text-center">
        <Logo variant="simbolo" height={56} decorative />
        <p className="card-title">Recebemos, obrigado!</p>
        <p className="card-body">
          As informações de <strong>{patientName}</strong> já estão com a nossa equipe e serão
          tratadas com sigilo. A recepção entra em contato para os próximos passos.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {erro && (
        <p
          role="alert"
          className="m-0 rounded-xl px-4 py-3 text-sm font-medium"
          style={{ background: "color-mix(in srgb, var(--color-accent) 10%, transparent)", color: "var(--color-accent-700)" }}
        >
          {erro}
        </p>
      )}

      <section className="card gap-5 p-6 sm:p-8">
        <p className="card-kicker">1 · A criança</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="field sm:col-span-2">
            <span>Data de nascimento</span>
            <CamposNascimento value={nascimento} onChange={setNascimento} />
          </div>
          <label className="field">
            <span>Sexo</span>
            <select className="input" name="sexo" defaultValue="">
              <option value="">Prefiro não informar</option>
              <option value="F">Feminino</option>
              <option value="M">Masculino</option>
            </select>
          </label>
          <label className="field">
            <span>CPF</span>
            <input className="input" type="text" name="cpf_paciente" inputMode="numeric" placeholder="000.000.000-00" />
          </label>
          <label className="field sm:col-span-2">
            <span>Naturalidade</span>
            <input className="input" type="text" name="naturalidade" placeholder="Cidade onde nasceu" />
          </label>
        </div>
      </section>

      <section className="card gap-6 p-6 sm:p-8">
        <p className="card-kicker">2 · Responsáveis</p>
        <Responsavel n={1} titulo="Responsável principal" obrigatorio />
        <hr className="m-0 border-0 border-t" style={{ borderColor: "var(--color-neutral-300)" }} />
        <Responsavel n={2} titulo="Segundo responsável (opcional)" />
      </section>

      <section className="card gap-5 p-6 sm:p-8">
        <p className="card-kicker">3 · Endereço</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
          <label className="field sm:col-span-2">
            <span>CEP</span>
            <input className="input" type="text" name="cep" inputMode="numeric" placeholder="00000-000" autoComplete="postal-code" />
          </label>
          <label className="field sm:col-span-4">
            <span>Rua / logradouro</span>
            <input className="input" type="text" name="logradouro" autoComplete="address-line1" />
          </label>
          <label className="field sm:col-span-2">
            <span>Número</span>
            <input className="input" type="text" name="numero" />
          </label>
          <label className="field sm:col-span-4">
            <span>Complemento</span>
            <input className="input" type="text" name="complemento" placeholder="Apto, bloco…" />
          </label>
          <label className="field sm:col-span-3">
            <span>Bairro</span>
            <input className="input" type="text" name="bairro" />
          </label>
          <label className="field sm:col-span-2">
            <span>Cidade</span>
            <input className="input" type="text" name="cidade" autoComplete="address-level2" />
          </label>
          <label className="field sm:col-span-1">
            <span>UF</span>
            <select className="input" name="uf" defaultValue="">
              <option value="">—</option>
              {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="card gap-4 p-6 sm:p-8">
        <p className="card-kicker">4 · O que traz vocês até aqui</p>
        <label className="field">
          <span>Motivo principal da busca pelo atendimento *</span>
          <textarea
            className="input"
            name="queixa"
            required
            rows={6}
            maxLength={2000}
            placeholder="Conte com suas palavras o que vocês têm observado e o que esperam da terapia."
          />
        </label>
      </section>

      <button type="submit" className="btn btn-primary btn-block" disabled={enviando}>
        {enviando ? "Enviando…" : "Enviar ficha"}
      </button>

      <p className="m-0 text-center text-xs text-ink-soft">
        Seus dados são usados apenas para o atendimento de {patientName} e ficam protegidos
        conforme a LGPD.
      </p>
    </form>
  );
}
