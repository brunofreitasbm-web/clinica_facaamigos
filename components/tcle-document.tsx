"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import {
  BLANK,
  TCLE_VERSION,
  fmtCityAndLongDate,
  fmtDate,
  fmtDateTime,
  type TcleContext,
} from "@/lib/tcle";

/**
 * Folha A4 do TCLE (Termo de Consentimento Livre e Esclarecido) para clínica
 * de desenvolvimento infantil — último passo da 1ª avaliação/acolhimento.
 *
 * O termo é assinado em papel: o que o sistema sabe já sai preenchido, o que
 * ele não sabe sai como linha para preencher à caneta (ver `BLANK` em
 * lib/tcle.ts). As autorizações do bloco V saem SEM marcação de propósito —
 * quem marca é o responsável, no papel; marcar por ele descaracterizaria o
 * consentimento.
 *
 * A impressão segue o mesmo padrão de app/recepcao/documentos: esconde o
 * layout do sistema e deixa visível só `#tcle-printable`.
 */

/** Linha "Rótulo: valor" com sublinhado contínuo até a margem, como formulário. */
function Field({ label, value, className = "" }: { label: string; value?: string | null; className?: string }) {
  return (
    <p className={`m-0 leading-[1.9] ${className}`}>
      <span className="font-semibold text-gray-950">{label}:</span>{" "}
      {value ? (
        <span className="text-gray-900">{value}</span>
      ) : (
        <span className="text-gray-400">{BLANK}</span>
      )}
    </p>
  );
}

/** Caixa vazia para o responsável marcar à caneta. */
function Box() {
  return <span className="mr-1.5 inline-block h-[11px] w-[11px] translate-y-px border border-gray-900 align-middle" />;
}

function Clause({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 break-inside-avoid">
      <p className="m-0 text-[12.5px] font-bold uppercase tracking-wide text-gray-950">
        {n}. {title}
      </p>
      <div className="mt-1 space-y-2 text-justify text-[12.5px] leading-[1.75] text-gray-800">{children}</div>
    </div>
  );
}

function SignatureLine({ caption, sub }: { caption: string; sub?: string | null }) {
  return (
    <div className="mt-10 break-inside-avoid text-center">
      <div className="mx-auto w-[85%] border-t border-gray-900" />
      <p className="m-0 mt-1 text-[11.5px] font-semibold text-gray-950">{caption}</p>
      {sub && <p className="m-0 text-[10.5px] text-gray-600">{sub}</p>}
    </div>
  );
}

export function TcleDocument({ ctx, backHref }: { ctx: TcleContext; backHref: string }) {
  const [printing, setPrinting] = useState(false);
  const { clinic, patient, guardians, anamnese, reassessmentCycleMonths, professional } = ctx;
  const signer = guardians[0] ?? null;
  const cosigner = guardians[1] ?? null;
  const cycle = reassessmentCycleMonths;

  function handlePrint() {
    if (printing) return;
    setPrinting(true);
    window.print();
    // window.print() bloqueia até o diálogo fechar, mas os navegadores variam —
    // solta o guard logo depois para um diálogo travado não prender o botão.
    setTimeout(() => setPrinting(false), 1000);
  }

  return (
    <div className="flex flex-1 flex-col bg-[var(--color-bg)]">
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #tcle-printable,
          #tcle-printable * {
            visibility: visible;
          }
          #tcle-printable {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          @page {
            size: A4 portrait;
            margin: 16mm 15mm;
          }
        }
      `}</style>

      <div className="mx-auto flex w-full max-w-[860px] flex-col gap-6 px-4 py-8 print:p-0">
        <div className="flex flex-col gap-4 rounded-2xl border border-black/5 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div>
            <h1 className="m-0 text-lg font-bold tracking-tight text-gray-900">
              Termo de Consentimento Livre e Esclarecido
            </h1>
            <p className="m-0 mt-1 text-sm text-gray-500">
              Último passo da 1ª avaliação e do acolhimento. Imprima, colha a assinatura do responsável e arquive a
              via física no prontuário da clínica.
            </p>
            {guardians.length === 0 && (
              <p className="m-0 mt-2 text-sm font-medium text-red-700">
                Nenhum responsável cadastrado para {patient.fullName} — o termo sai com os campos do responsável em
                branco para preencher à mão.
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={backHref}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 no-underline hover:bg-gray-50"
            >
              Voltar
            </a>
            <button
              type="button"
              onClick={handlePrint}
              className="flex cursor-pointer items-center gap-2 rounded-xl bg-pink-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-pink-700 active:scale-95"
            >
              <Printer className="h-4 w-4" />
              {printing ? "Gerando..." : "Imprimir (A4) — 2 vias"}
            </button>
          </div>
        </div>

        {/* ---------- Folha A4 ---------- */}
        <div
          id="tcle-printable"
          className="w-full rounded-2xl border border-gray-200/80 bg-white p-10 text-gray-900 shadow-xl sm:p-14 print:rounded-none print:border-0 print:p-0 print:shadow-none"
        >
          {/* Timbre */}
          <div className="flex items-start justify-between gap-6 border-b-2 border-pink-600 pb-5">
            <div className="flex items-center gap-4">
              {/* Marca vetorizada: o SVG `horizontal` já traz o wordmark e a
                  assinatura "Centro de Terapia Comportamental" — não repita
                  nenhum dos dois como texto ao lado. */}
              <Logo variant="horizontal" height={44} className="shrink-0" />
              <div className="text-[10.5px] leading-relaxed text-gray-500">
                {clinic.razaoSocial && clinic.razaoSocial !== clinic.nomeFantasia && <p className="m-0">{clinic.razaoSocial}</p>}
                {clinic.cnpj && <p className="m-0">CNPJ: {clinic.cnpj}</p>}
                {clinic.responsavel && <p className="m-0">Responsável Técnico(a): {clinic.responsavel}</p>}
              </div>
            </div>
            <div className="text-right text-[10.5px] font-medium leading-relaxed text-gray-600">
              {clinic.endereco && <p className="m-0 font-semibold text-gray-800">{clinic.endereco}</p>}
              {clinic.telefone && <p className="m-0">Tel: {clinic.telefone}</p>}
              {clinic.whatsapp && <p className="m-0">WhatsApp: {clinic.whatsapp}</p>}
              {clinic.email && <p className="m-0">{clinic.email}</p>}
              {clinic.site && <p className="m-0">{clinic.site}</p>}
            </div>
          </div>

          {/* Título */}
          <div className="mt-8 text-center">
            <h2 className="m-0 text-[15px] font-bold uppercase tracking-[0.18em] text-gray-950">
              Termo de Consentimento Livre e Esclarecido
            </h2>
            <p className="m-0 mt-1 text-[11px] uppercase tracking-widest text-gray-500">
              Avaliação e intervenção em desenvolvimento infantil
            </p>
          </div>

          {/* I — Criança */}
          <div className="mt-7 break-inside-avoid rounded-lg border border-gray-200 bg-gray-50/70 p-4 text-[12px]">
            <p className="m-0 mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-600">
              I. Identificação da criança / adolescente
            </p>
            <Field label="Nome completo" value={patient.fullName} />
            <div className="grid gap-x-8 sm:grid-cols-2">
              <Field label="Data de nascimento" value={fmtDate(patient.birthDate)} />
              <Field label="Idade" value={patient.ageLabel} />
              <Field label="Sexo" value={patient.sexo} />
              <Field label="Naturalidade" value={patient.naturalidade} />
              <Field label="CPF" value={patient.cpf} />
              <Field label="Hipótese diagnóstica / CID" value={patient.cid} />
            </div>
            <Field label="Endereço" value={patient.endereco} />
          </div>

          {/* II — Responsáveis */}
          <div className="mt-4 break-inside-avoid rounded-lg border border-gray-200 bg-gray-50/70 p-4 text-[12px]">
            <p className="m-0 mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-600">
              II. Identificação do(s) responsável(is) legal(is)
            </p>
            <Field label="Responsável legal" value={signer?.fullName} />
            <div className="grid gap-x-8 sm:grid-cols-2">
              <Field label="Grau de parentesco" value={signer?.relationship} />
              <Field label="CPF" value={signer?.cpf} />
              <Field label="RG" value={signer?.rg} />
              <Field label="Telefone" value={signer?.phone} />
            </div>
            <Field label="E-mail" value={signer?.email} />
            {cosigner && (
              <div className="mt-3 border-t border-dashed border-gray-300 pt-2">
                <Field label="Segundo responsável" value={cosigner.fullName} />
                <div className="grid gap-x-8 sm:grid-cols-2">
                  <Field label="Grau de parentesco" value={cosigner.relationship} />
                  <Field label="CPF" value={cosigner.cpf} />
                </div>
              </div>
            )}
          </div>

          {/* III — Cláusulas */}
          <p className="mt-7 text-justify text-[12.5px] leading-[1.75] text-gray-800">
            Eu, responsável legal acima qualificado, no exercício do poder familiar de que tratam o art. 1.634 do
            Código Civil e o art. 22 do Estatuto da Criança e do Adolescente (Lei nº 8.069/1990), declaro que fui
            recebido(a) em acolhimento e entrevista de anamnese ampliada por profissional habilitado(a) da{" "}
            <strong className="font-bold text-gray-950">{clinic.nomeFantasia}</strong>, tive oportunidade de fazer
            perguntas e de recebê-las respondidas em linguagem acessível, e declaro estar ciente e de acordo com o que
            segue.
          </p>

          <Clause n={1} title="Natureza e finalidade do serviço">
            <p className="m-0">
              A clínica presta serviços de avaliação e intervenção interdisciplinar em desenvolvimento infantil, com
              equipe que pode envolver, conforme a necessidade da criança, as áreas de psicologia, análise do
              comportamento aplicada (ABA), fonoaudiologia, terapia ocupacional, psicopedagogia, fisioterapia e
              nutrição. O objetivo é avaliar o repertório atual da criança, identificar necessidades de apoio e
              construir um plano terapêutico singular voltado ao desenvolvimento da comunicação, da autonomia, das
              habilidades sociais, acadêmicas e de vida diária.
            </p>
            <p className="m-0">
              O serviço prestado é de natureza terapêutica e educacional. <strong>Não constitui tratamento médico,
              não substitui acompanhamento médico ou psiquiátrico e não emite diagnóstico médico</strong> — quando
              indicado, a família é orientada a buscar o profissional médico competente.
            </p>
          </Clause>

          <Clause n={2} title="Etapas do processo">
            <p className="m-0">
              O acompanhamento se organiza nas seguintes etapas: (a) acolhimento e 1ª avaliação (anamnese ampliada)
              com o responsável; (b) avaliações por área, com uso de instrumentos e protocolos padronizados e/ou
              observação direta em ambiente clínico e natural; (c) reunião técnica interdisciplinar; (d) construção
              do Plano Terapêutico Singular (PTS); (e) devolutiva à família; (f) execução das sessões e reavaliações
              periódicas a cada {cycle} {cycle === 1 ? "mês" : "meses"}, com nova devolutiva.
            </p>
          </Clause>

          <Clause n={3} title="Procedimentos, duração e frequência">
            <p className="m-0">
              Os atendimentos ocorrem em sessões individuais e/ou em grupo, com duração e frequência definidas no
              plano terapêutico e formalizadas no contrato de prestação de serviços. Os procedimentos incluem
              aplicação de protocolos e instrumentos de avaliação, ensino estruturado e naturalístico, treino de
              habilidades, registro sistemático de dados de desempenho, orientação parental e articulação com a
              escola e com outros profissionais que acompanham a criança, mediante autorização do responsável.
            </p>
          </Clause>

          <Clause n={4} title="Riscos, desconfortos e benefícios esperados">
            <p className="m-0">
              Os procedimentos são de risco mínimo. Podem ocorrer desconfortos previsíveis, como cansaço, choro,
              recusa, irritabilidade ou estranhamento diante de pessoas, ambientes e demandas novas, especialmente no
              período de adaptação, bem como mobilização emocional do responsável ao relatar a história da criança.
              Diante de qualquer desconforto, a equipe adota manejo ético e individualizado, podendo interromper a
              atividade. Os benefícios esperados são o melhor entendimento do perfil de desenvolvimento da criança e
              o ganho de habilidades funcionais — <strong>sem garantia de resultado específico, de cura ou de prazo
              determinado</strong>, uma vez que a evolução depende de múltiplos fatores, entre eles a assiduidade e a
              participação da família.
            </p>
          </Clause>

          <Clause n={5} title="Corresponsabilidade da família">
            <p className="m-0">
              O responsável compromete-se a prestar informações verdadeiras e completas sobre a saúde, o histórico e
              a rotina da criança, a comunicar alterações relevantes (medicações, intercorrências clínicas, crises,
              mudanças escolares ou familiares), a comparecer às orientações parentais e devolutivas, a cumprir a
              política de faltas, atrasos e cancelamentos prevista no contrato e a dar continuidade, em casa, às
              orientações recebidas.
            </p>
          </Clause>

          <Clause n={6} title="Sigilo profissional e prontuário">
            <p className="m-0">
              Todas as informações compartilhadas são protegidas por sigilo profissional, nos termos dos códigos de
              ética das profissões envolvidas. Os registros compõem prontuário único da criança, de guarda e
              responsabilidade da clínica, arquivado pelo prazo mínimo previsto na legislação e nas resoluções dos
              conselhos profissionais. O prontuário poderá ser acessado pela equipe técnica responsável pelo caso e,
              em supervisão, pelos supervisores clínicos, sempre em contexto profissional. O responsável tem direito
              a solicitar documento de sua criança (relatório, declaração ou laudo, conforme a competência de cada
              profissional). A quebra de sigilo somente ocorrerá nas hipóteses legais — determinação judicial ou
              risco à vida e à integridade da criança ou de terceiros, incluída a comunicação obrigatória de suspeita
              de maus-tratos ao Conselho Tutelar (art. 13 do ECA).
            </p>
          </Clause>

          <Clause n={7} title="Proteção de dados pessoais (LGPD)">
            <p className="m-0">
              Os dados pessoais e os dados pessoais sensíveis de saúde da criança e dos responsáveis são tratados
              pela clínica, na qualidade de controladora, para as finalidades de prestação do serviço, tutela da
              saúde, gestão de agenda, faturamento e cumprimento de obrigações legais e regulatórias, nos termos da
              Lei nº 13.709/2018 (LGPD), em especial dos seus arts. 7º, 11 e 14 — este último exigindo o
              consentimento específico e em destaque de ao menos um dos pais ou do responsável legal para o
              tratamento de dados de crianças. É assegurado ao titular e ao responsável o exercício dos direitos do
              art. 18 da LGPD (confirmação, acesso, correção, anonimização, portabilidade, informação sobre
              compartilhamento e revogação do consentimento), mediante solicitação aos canais de contato desta
              clínica indicados no timbre deste documento.
            </p>
          </Clause>

          <Clause n={8} title="Comunicação por meios digitais">
            <p className="m-0">
              A clínica poderá utilizar WhatsApp, ligações, SMS e e-mail para confirmações de agenda, avisos
              operacionais e orientações, ciente o responsável de que tais canais são de terceiros e não são
              adequados para o tratamento de assuntos clínicos sigilosos, que devem ser tratados presencialmente ou
              em atendimento reservado.
            </p>
          </Clause>

          <Clause n={9} title="Voluntariedade e revogação">
            <p className="m-0">
              A participação é voluntária. O responsável pode recusar procedimentos, solicitar esclarecimentos a
              qualquer momento e revogar este consentimento a qualquer tempo, por manifestação escrita dirigida à
              clínica, sem qualquer prejuízo ao atendimento já prestado e sem necessidade de justificativa. A
              revogação produz efeitos a partir do recebimento e não desconstitui os tratamentos de dados já
              realizados, nem afasta a guarda do prontuário exigida por lei. Este termo não substitui o contrato de
              prestação de serviços, que trata das condições comerciais, de valores e de agenda.
            </p>
          </Clause>

          {/* IV — Autorizações específicas */}
          <div className="mt-6 break-inside-avoid rounded-lg border border-gray-300 p-4">
            <p className="m-0 text-[12.5px] font-bold uppercase tracking-wide text-gray-950">
              10. Autorizações específicas — marque uma opção em cada item
            </p>
            <p className="m-0 mt-1 text-[11px] italic text-gray-600">
              As autorizações abaixo são independentes entre si e da adesão ao atendimento: recusar qualquer uma
              delas não impede nem prejudica o acompanhamento da criança.
            </p>

            <div className="mt-3 space-y-3 text-[12px] leading-[1.7] text-gray-800">
              <div>
                <p className="m-0 font-semibold text-gray-950">
                  a) Registro de imagem, áudio e vídeo para uso clínico interno
                </p>
                <p className="m-0 text-[11.5px]">
                  Filmagens e fotos das sessões usadas exclusivamente para análise de dados, supervisão da equipe e
                  ilustração de devolutivas à própria família, com acesso restrito à equipe técnica.
                </p>
                <p className="m-0 mt-1">
                  <Box />
                  Autorizo &nbsp;&nbsp;&nbsp; <Box />
                  Não autorizo
                </p>
              </div>

              <div>
                <p className="m-0 font-semibold text-gray-950">
                  b) Uso de imagem em divulgação institucional
                </p>
                <p className="m-0 text-[11.5px]">
                  Publicação de fotos ou vídeos da criança em redes sociais, site e materiais institucionais da
                  clínica, sem finalidade comercial de terceiros e sem exposição de dados clínicos.
                </p>
                <p className="m-0 mt-1">
                  <Box />
                  Autorizo &nbsp;&nbsp;&nbsp; <Box />
                  Não autorizo
                </p>
              </div>

              <div>
                <p className="m-0 font-semibold text-gray-950">
                  c) Uso de dados anonimizados para fins técnicos e científicos
                </p>
                <p className="m-0 text-[11.5px]">
                  Utilização de dados sem qualquer elemento de identificação em estudos de caso, formação de equipe e
                  produção técnico-científica.
                </p>
                <p className="m-0 mt-1">
                  <Box />
                  Autorizo &nbsp;&nbsp;&nbsp; <Box />
                  Não autorizo
                </p>
              </div>

              <div>
                <p className="m-0 font-semibold text-gray-950">
                  d) Articulação com escola e demais profissionais
                </p>
                <p className="m-0 text-[11.5px]">
                  Troca de informações estritamente necessárias com a escola e com os profissionais externos que
                  acompanham a criança, visando alinhamento do plano terapêutico.
                </p>
                <p className="m-0 mt-1">
                  <Box />
                  Autorizo &nbsp;&nbsp;&nbsp; <Box />
                  Não autorizo
                </p>
              </div>
            </div>
          </div>

          {/* V — Declaração e assinaturas */}
          <div className="mt-6 break-inside-avoid">
            <p className="m-0 text-[12.5px] font-bold uppercase tracking-wide text-gray-950">11. Declaração</p>
            <p className="m-0 mt-1 text-justify text-[12.5px] leading-[1.75] text-gray-800">
              Declaro que li integralmente este termo, que as informações me foram explicadas em linguagem clara,
              que tive minhas dúvidas esclarecidas e que consinto, de forma livre, informada e inequívoca, com a
              avaliação e o acompanhamento de{" "}
              <strong className="font-bold text-gray-950">{patient.fullName}</strong> nesta clínica, bem como com o
              tratamento dos dados pessoais nos termos acima. Declaro ter recebido uma via deste documento, ficando
              a outra arquivada no prontuário da clínica.
            </p>

            <p className="m-0 mt-6 text-right text-[12.5px] text-gray-800">
              {fmtCityAndLongDate(clinic.cidade, ctx.issuedAt)}
            </p>

            <div className="grid gap-x-10 sm:grid-cols-2">
              <SignatureLine
                caption={signer?.fullName ?? "Responsável legal"}
                sub={
                  signer?.cpf
                    ? `Responsável legal · CPF ${signer.cpf}`
                    : "Responsável legal · CPF ________________"
                }
              />
              <SignatureLine
                caption={professional?.fullName ?? "Profissional responsável pelo acolhimento"}
                sub={
                  professional
                    ? `${professional.role ?? "Profissional"} · Registro no conselho ____________`
                    : "Nome, registro no conselho e assinatura"
                }
              />
            </div>

            {cosigner && (
              <div className="grid gap-x-10 sm:grid-cols-2">
                <SignatureLine
                  caption={cosigner.fullName}
                  sub={cosigner.cpf ? `Segundo responsável · CPF ${cosigner.cpf}` : "Segundo responsável"}
                />
                <SignatureLine caption="Assentimento da criança / adolescente" sub="Quando houver condição de compreensão" />
              </div>
            )}
          </div>

          {/* Rodapé */}
          <div className="mt-10 border-t border-gray-200 pt-2 text-[9.5px] leading-relaxed text-gray-500">
            <p className="m-0">
              TCLE versão {TCLE_VERSION} · Emitido em {fmtDateTime(ctx.issuedAt)} · Paciente {patient.fullName}
              {anamnese && (
                <>
                  {" "}
                  · 1ª avaliação (anamnese ampliada) realizada em {fmtDateTime(anamnese.conductedAt)}
                  {anamnese.conductedByName ? ` por ${anamnese.conductedByName}` : ""}
                </>
              )}
            </p>
            <p className="m-0">
              Documento emitido em 2 vias de igual teor — uma via para o responsável, uma via para arquivo da clínica.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
