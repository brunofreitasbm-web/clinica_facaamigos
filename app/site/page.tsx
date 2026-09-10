import type { Metadata } from "next";
import {
  ShieldCheck,
  HeartHandshake,
  Sparkles,
  Users2,
  ClipboardList,
  ClipboardCheck,
  Puzzle,
  Building2,
  Brain,
  MessageSquareText,
  HandHelping,
  Activity,
  Music2,
  BookOpen,
  UtensilsCrossed,
  MessageCircle,
  ChevronDown,
  CheckCircle2,
  Star,
  Phone,
  Mail,
  MapPin,
  Clock,
  ArrowRight,
  Quote,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { CLINIC_NAME, CLINIC_WEBSITE } from "@/lib/clinic-identity";
import { SiteHeader } from "./site-header";
import { LeadForm } from "./lead-form";
import { PlanosForm } from "./planos-form";
import { createAdminClient } from "@/lib/supabase/admin";
import { TrackedWhatsAppLink } from "./tracked-link";
import { WaveDivider } from "./wave-divider";
import { Blob } from "./blob";
import {
  CONTEUDO_PENDENTE,
  CONTATO,
  CTA,
  HERO,
  NUMEROS,
  EMPATIA,
  DIFERENCIAIS,
  METODO,
  SERVICOS,
  ECOSSISTEMA,
  DEPOIMENTOS,
  EQUIPE,
  FAQ,
  FECHAMENTO,
  PLANOS,
  RODAPE,
  linkWhatsApp,
} from "./content";

const DESCRICAO_SEO =
  "Centro especializado em desenvolvimento infantil e autismo em Belém/PA. Equipe multidisciplinar, abordagem ABA e playground inclusivo. Agende uma avaliação.";

export const metadata: Metadata = {
  title: "Centro de Terapia Comportamental para Crianças Autistas",
  description: DESCRICAO_SEO,
  keywords: [
    "terapia aba belém",
    "centro de terapia comportamental",
    "autismo belém",
    "clínica tea belém",
    "fonoaudiologia infantil belém",
    "terapia ocupacional infantil",
  ],
  alternates: { canonical: "/site" },
  // Explícito para não depender de nenhum default herdado: esta é a única
  // página do domínio que DEVE ser indexada (ver app/robots.ts).
  robots: { index: true, follow: true },
  openGraph: {
    title: CLINIC_NAME,
    description: DESCRICAO_SEO,
    url: "/site",
    siteName: CLINIC_NAME,
    type: "website",
    locale: "pt_BR",
  },
  twitter: {
    card: "summary_large_image",
    title: CLINIC_NAME,
    description: DESCRICAO_SEO,
  },
  // Preenchidos só se a variável existir — sem o código de verificação a
  // meta tag correspondente nem é gerada. Pegue o valor em cada ferramenta:
  // Google Search Console (busca "verificação HTML"), Bing Webmaster Tools.
  verification: {
    ...(process.env.GOOGLE_SITE_VERIFICATION && { google: process.env.GOOGLE_SITE_VERIFICATION }),
    ...(process.env.BING_SITE_VERIFICATION && { other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION } }),
  },
};

// Quase tudo aqui é institucional e estático, mas a lista de convênios
// (seção "#planos") vem da tabela `insurers` — se ficasse congelada no build,
// o site prometeria plano descredenciado até o próximo deploy. ISR de 5 min
// resolve: a página segue servida de cache, e credenciar/descredenciar um
// convênio no sistema aparece aqui sozinho.
export const revalidate = 300;

/**
 * Convênios que a clínica atende HOJE — mesma consulta que o bot de WhatsApp
 * usa em `getAcceptedInsurersFormatted` (lib/twilio.ts): só os `active`, em
 * ordem alfabética. Lida com service-role porque o visitante não tem sessão;
 * o que sai daqui (nome do convênio) é exatamente o que o bot já manda por
 * WhatsApp para quem pergunta, então não expõe nada novo.
 */
async function listarConvenios(): Promise<Array<{ id: string; name: string }>> {
  try {
    const { data, error } = await createAdminClient()
      .from("insurers")
      .select("id, name")
      .eq("active", true)
      .order("name");
    if (error) {
      console.error("[site/planos] Erro ao listar convênios:", error);
      return [];
    }
    return (data ?? []).map((c) => ({ id: c.id, name: c.name.trim() }));
  } catch (err) {
    // Site fora do ar por causa da lista de convênios seria o pior desfecho:
    // a seção sabe se virar com lista vazia (cai no texto de particular).
    console.error("[site/planos] Falha ao consultar convênios:", err);
    return [];
  }
}

const ICONES_DIFERENCIAL = {
  equipe: Users2,
  plano: ClipboardList,
  playground: Puzzle,
  relatorio: ClipboardCheck,
  espaco: Building2,
  familia: HeartHandshake,
} as const;

const ICONES_SERVICO = [Brain, MessageSquareText, HandHelping, Activity, Music2, BookOpen, UtensilsCrossed];

// Rotação de cor nos badges circulares de ícone (referência de estilo:
// landing "Pallikoodam" pedida pelo usuário — círculos coloridos alternados
// em vez de todos no mesmo tom). Só os 3 acentos da marca, nunca um quarto
// tom: --color-pink/--color-teal/--color-accent-2 já são os únicos com
// contraste aprovado (ver brand/README.md) quando usados como preenchimento
// atrás de um ícone branco.
const BADGE_CORES = [
  { bg: "var(--color-pink)", fg: "#ffffff" },
  { bg: "var(--color-teal)", fg: "#ffffff" },
  { bg: "var(--color-accent-2)", fg: "#ffffff" },
] as const;

export default async function SiteLandingPage() {
  const convenios = await listarConvenios();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalBusiness",
    name: "FaçaAmigos — Centro de Terapia Comportamental",
    description:
      "Centro de terapia comportamental especializado em crianças autistas e desenvolvimento infantil, em Belém/PA.",
    url: `${CLINIC_WEBSITE}/site`,
    telephone: CONTATO.telefoneVisivel,
    email: CONTATO.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: CONTATO.endereco.linha1,
      addressLocality: "Belém",
      addressRegion: "PA",
      postalCode: CONTATO.endereco.cep,
      addressCountry: "BR",
    },
    medicalSpecialty: SERVICOS.map((s) => s.titulo),
  };

  const jsonLdFaq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.pergunta,
      acceptedAnswer: { "@type": "Answer", text: f.resposta },
    })),
  };

  return (
    <div id="inicio" className="flex flex-1 flex-col bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq).replace(/</g, "\\u003c") }}
      />

      {CONTEUDO_PENDENTE && (
        <div className="bg-[var(--color-dark)] px-4 py-2 text-center text-xs font-semibold text-white">
          Rascunho de trabalho — números e depoimentos abaixo são exemplo e precisam ser
          substituídos por dados reais antes de publicar.
        </div>
      )}

      <SiteHeader />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[var(--color-bg)]">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:py-24">
          <div className="flex flex-col gap-6">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[var(--color-teal-100)] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[var(--color-teal-800)]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {HERO.chapeu}
            </span>

            <h1 className="m-0 text-[2.5rem] leading-[1.08] font-semibold tracking-tight text-[var(--color-dark)] sm:text-5xl lg:text-[3.4rem]">
              {HERO.titulo}
            </h1>

            <p className="max-w-xl text-lg leading-relaxed text-[var(--text-secondary)]">
              {HERO.subtitulo}
            </p>

            {/* O botão primário abre a conversa direto — quem chega aqui
                quer perguntar, não se comprometer com uma agenda. O caminho
                para a consulta de convênio fica no secundário. */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <TrackedWhatsAppLink
                href={linkWhatsApp()}
                target="_blank"
                rel="noreferrer"
                local="hero"
                className="btn btn-primary justify-center text-base"
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                {CTA.principal}
              </TrackedWhatsAppLink>
              <a href="#planos" className="btn btn-secondary justify-center text-base">
                {CTA.secundario}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
            </div>
            <p className="-mt-1 text-sm font-medium text-[var(--color-teal-800)]">{CTA.principalApoio}</p>

            <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
              {HERO.selos.map((selo) => (
                <li key={selo} className="flex items-center gap-2 text-sm font-semibold text-[var(--color-dark)]">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--color-pink)]" aria-hidden />
                  {selo}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative">
            {/* Mancha orgânica atrás da foto — referência de estilo pedida:
                landing com forma solta em vez de moldura reta. */}
            {/* aspect-square, não h-[...%]: altura em % não resolve contra
                um pai de altura automática (regra do CSS para elemento
                absoluto cujo container não tem altura explícita) — a forma
                ficava com altura zero e não aparecia. Maior que o cartão e
                deslocada pra cima/direita de propósito: só assim a mancha
                aparece por fora (o cartão é opaco e pinta por cima de tudo
                que estiver embaixo dela). */}
            <Blob
              color="var(--color-accent-2)"
              className="absolute -top-8 -right-8 hidden aspect-square w-[105%] opacity-90 sm:block"
            />
            <div className="relative flex aspect-[4/5] w-full flex-col items-center justify-center gap-3 rounded-[32px] border-2 border-dashed border-[var(--color-neutral-300)] bg-white p-8 text-center shadow-lg sm:aspect-[5/4] lg:aspect-[4/5]">
              <Sparkles className="h-8 w-8 text-[var(--color-accent-2)]" aria-hidden />
              <p className="text-sm font-semibold text-[var(--color-neutral-500)]">[{HERO.imagem.slot}]</p>
              <p className="sr-only">{HERO.imagem.alt}</p>
            </div>
            <div
              aria-hidden
              className="absolute -bottom-6 -left-6 hidden h-28 w-28 rounded-full sm:block"
              style={{ background: "var(--color-teal)", opacity: 0.16 }}
            />
          </div>
        </div>
      </section>

      <WaveDivider from="var(--color-bg)" to="#ffffff" />

      {/* ── Prova social rápida ──────────────────────────────────────── */}
      {NUMEROS.length > 0 && (
        <section className="border-b border-[var(--color-paper-line)] bg-white">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-10 sm:px-8 md:grid-cols-4">
            {NUMEROS.map((n) => (
              <div key={n.rotulo} className="flex flex-col items-center gap-1 text-center">
                <span className="tabular-figure text-3xl font-extrabold text-[var(--color-pink)] sm:text-4xl">
                  {n.valor}
                </span>
                <span className="text-sm font-medium text-[var(--text-secondary)]">{n.rotulo}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Empatia ──────────────────────────────────────────────────── */}
      <section className="bg-[var(--color-bg)]">
        <div className="mx-auto max-w-3xl px-5 py-16 text-center sm:px-8 sm:py-24">
          <Quote className="mx-auto mb-4 h-8 w-8 text-[var(--color-accent-2)]" aria-hidden />
          <h2 className="text-3xl font-extrabold text-[var(--color-dark)] sm:text-4xl">{EMPATIA.titulo}</h2>
          <div className="mt-6 flex flex-col gap-4 text-left text-[17px] leading-relaxed text-[var(--text-secondary)] sm:text-center">
            {EMPATIA.paragrafos.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <a href="#servicos" className="btn btn-ghost mt-6">
            {EMPATIA.cta}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </a>
        </div>
      </section>

      {/* ── Diferenciais ─────────────────────────────────────────────── */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold text-[var(--color-dark)] sm:text-4xl">
              Por que famílias escolhem o FaçaAmigos
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {DIFERENCIAIS.map((d, i) => {
              const Icone = ICONES_DIFERENCIAL[d.icone];
              const cor = BADGE_CORES[i % BADGE_CORES.length];
              return (
                <div key={d.titulo} className="card gap-3 p-6">
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-full shadow-sm"
                    style={{ background: cor.bg }}
                  >
                    <Icone className="h-5 w-5" style={{ color: cor.fg }} aria-hidden strokeWidth={1.75} />
                  </span>
                  <p className="card-title text-lg">{d.titulo}</p>
                  <p className="card-body text-[15px]">{d.texto}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Método ───────────────────────────────────────────────────── */}
      <section className="bg-[var(--color-bg)]">
        <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold text-[var(--color-dark)] sm:text-4xl">{METODO.titulo}</h2>
            <p className="mt-3 text-[17px] text-[var(--text-secondary)]">{METODO.subtitulo}</p>
          </div>

          <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {METODO.passos.map((passo, i) => (
              <li key={passo.titulo} className="relative flex flex-col gap-2">
                <span className="tabular-figure flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-pink)] text-base font-extrabold text-white">
                  {i + 1}
                </span>
                <p className="mt-1 text-[17px] font-bold text-[var(--color-dark)]">{passo.titulo}</p>
                <p className="text-[15px] leading-relaxed text-[var(--text-secondary)]">{passo.texto}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Serviços ─────────────────────────────────────────────────── */}
      <section id="servicos" className="bg-white">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold text-[var(--color-dark)] sm:text-4xl">Especialidades</h2>
            <p className="mt-3 text-[17px] text-[var(--text-secondary)]">
              Toda a equipe sob o mesmo teto, coordenando um único plano para o seu filho.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICOS.map((s, i) => {
              const Icone = ICONES_SERVICO[i % ICONES_SERVICO.length];
              const cor = BADGE_CORES[i % BADGE_CORES.length];
              return (
                <div key={s.titulo} className="flex items-start gap-4 rounded-2xl border border-[var(--color-paper-line)] p-5">
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-sm"
                    style={{ background: cor.bg }}
                  >
                    <Icone className="h-5 w-5" style={{ color: cor.fg }} aria-hidden strokeWidth={1.75} />
                  </span>
                  <div>
                    <p className="m-0 text-base font-bold text-[var(--color-dark)]">{s.titulo}</p>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">{s.texto}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <WaveDivider from="#ffffff" to="var(--color-dark)" />

      {/* ── Ecossistema ──────────────────────────────────────────────── */}
      <section id="ecossistema" className="bg-[var(--color-dark)] text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-2 lg:items-center">
          <div className="flex flex-col gap-5 order-2 lg:order-1">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white/90">
              <Puzzle className="h-3.5 w-3.5" aria-hidden />
              {ECOSSISTEMA.chapeu}
            </span>
            <h2 className="text-3xl font-extrabold sm:text-4xl">{ECOSSISTEMA.titulo}</h2>
            <div className="flex flex-col gap-4 text-[17px] leading-relaxed text-white/85">
              {ECOSSISTEMA.paragrafos.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            <a
              href={ECOSSISTEMA.cta.href}
              target="_blank"
              rel="noreferrer"
              className="btn btn-gold w-fit"
            >
              {ECOSSISTEMA.cta.rotulo}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
          </div>
          <div className="order-1 lg:order-2">
            <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-[32px] border-2 border-dashed border-white/25 bg-white/5 p-8 text-center">
              <Puzzle className="h-8 w-8 text-white/70" aria-hidden />
              <p className="text-sm font-semibold text-white/70">[{ECOSSISTEMA.imagem.slot}]</p>
              <p className="sr-only">{ECOSSISTEMA.imagem.alt}</p>
            </div>
          </div>
        </div>
      </section>

      <WaveDivider from="var(--color-dark)" to="var(--color-bg)" flip />

      {/* ── Depoimentos ──────────────────────────────────────────────── */}
      {DEPOIMENTOS.length > 0 && (
        <section className="bg-[var(--color-bg)]">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <h2 className="text-3xl font-extrabold text-[var(--color-dark)] sm:text-4xl">
                Quem já passou por aqui
              </h2>
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              {DEPOIMENTOS.map((d) => (
                <figure key={d.autor} className="card gap-4 p-6">
                  <div className="flex gap-0.5" aria-hidden>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-[var(--color-accent-2)] text-[var(--color-accent-2)]" />
                    ))}
                  </div>
                  <blockquote className="m-0 text-[15px] leading-relaxed text-[var(--color-dark)]">
                    “{d.texto}”
                  </blockquote>
                  <figcaption className="mt-auto text-sm">
                    <span className="font-bold text-[var(--color-dark)]">{d.autor}</span>
                    <span className="text-[var(--text-secondary)]"> — {d.contexto}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Equipe ───────────────────────────────────────────────────── */}
      {EQUIPE.length > 0 && (
        <section className="bg-white">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <h2 className="text-3xl font-extrabold text-[var(--color-dark)] sm:text-4xl">Nossa equipe</h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {EQUIPE.map((p) => (
                <div key={p.nome} className="flex flex-col items-center gap-2 text-center">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-[var(--color-neutral-300)] bg-[var(--color-bg)] text-xs text-[var(--color-neutral-500)]">
                    foto
                  </div>
                  <p className="m-0 text-base font-bold text-[var(--color-dark)]">{p.nome}</p>
                  <p className="m-0 text-sm font-semibold text-[var(--color-pink)]">{p.especialidade}</p>
                  <p className="m-0 text-xs text-[var(--text-secondary)]">{p.registro}</p>
                  <p className="mt-1 text-sm italic text-[var(--text-secondary)]">“{p.frase}”</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Planos de saúde ──────────────────────────────────────────── */}
      <section id="planos" className="bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.05fr_1fr] lg:items-start">
          <div className="flex flex-col gap-4">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[var(--color-teal-100)] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[var(--color-teal-800)]">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              {PLANOS.chapeu}
            </span>
            <h2 className="m-0 text-3xl font-extrabold text-[var(--color-dark)] sm:text-4xl">{PLANOS.titulo}</h2>
            <p className="m-0 text-[17px] leading-relaxed text-[var(--text-secondary)]">{PLANOS.subtitulo}</p>

            {convenios.length > 0 ? (
              <>
                <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
                  {convenios.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center gap-2 rounded-2xl bg-[var(--color-bg)] px-4 py-3 text-[15px] font-semibold text-[var(--color-dark)]"
                    >
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--color-teal)]" aria-hidden />
                      {c.name}
                    </li>
                  ))}
                </ul>
                <p className="m-0 text-[15px] leading-relaxed text-[var(--text-secondary)]">{PLANOS.reembolso}</p>
              </>
            ) : (
              <p className="m-0 rounded-2xl bg-[var(--color-teal-100)] p-4 text-[15px] leading-relaxed font-medium text-[var(--color-teal-800)]">
                {PLANOS.semLista}
              </p>
            )}

            <TrackedWhatsAppLink
              href={linkWhatsApp()}
              target="_blank"
              rel="noreferrer"
              local="planos"
              className="btn btn-secondary w-fit"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              Prefiro perguntar no WhatsApp
            </TrackedWhatsAppLink>
          </div>

          <PlanosForm convenios={convenios} />
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section id="duvidas" className="bg-[var(--color-bg)]">
        <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold text-[var(--color-dark)] sm:text-4xl">Perguntas frequentes</h2>
          </div>
          <div className="flex flex-col gap-3">
            {FAQ.map((f) => (
              <details key={f.pergunta} className="group rounded-2xl bg-white p-5 shadow-sm open:shadow-md">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-bold text-[var(--color-dark)] marker:content-none">
                  {f.pergunta}
                  <ChevronDown className="h-5 w-5 shrink-0 text-[var(--color-pink)] transition-transform duration-200 group-open:rotate-180" aria-hidden />
                </summary>
                <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-secondary)]">{f.resposta}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ────────────────────────────────────────────────── */}
      <section id="agendar" className="bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-2 lg:items-center">
          <div className="flex flex-col gap-4">
            <h2 className="text-3xl font-extrabold text-[var(--color-dark)] sm:text-4xl">{FECHAMENTO.titulo}</h2>
            <p className="text-[17px] leading-relaxed text-[var(--text-secondary)]">{FECHAMENTO.subtitulo}</p>
            <p className="text-[15px] font-medium text-[var(--color-dark)]">{FECHAMENTO.reforco}</p>
            <p className="flex items-start gap-2 rounded-2xl bg-[var(--color-teal-100)] p-4 text-sm font-semibold text-[var(--color-teal-800)]">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              {FECHAMENTO.garantia}
            </p>
            <TrackedWhatsAppLink
              href={linkWhatsApp()}
              target="_blank"
              rel="noreferrer"
              local="cta-final"
              className="btn btn-secondary w-fit"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              Prefiro falar no WhatsApp
            </TrackedWhatsAppLink>
          </div>
          <LeadForm />
        </div>
      </section>

      {/* ── Rodapé ───────────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--color-paper-line)] bg-[var(--color-bg)]">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-3">
          <div className="flex flex-col gap-3">
            <Logo variant="horizontal" height={40} />
            <p className="text-sm text-[var(--text-secondary)]">{RODAPE.frase}</p>
            <div className="mt-1 flex gap-3">
              {CONTATO.redes.map((r) => (
                <a key={r.nome} href={r.url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-[var(--color-pink)]">
                  {r.nome}
                </a>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2.5 text-sm text-[var(--color-dark)]">
            <p className="m-0 flex items-center gap-2 font-bold">Contato</p>
            <TrackedWhatsAppLink
              href={linkWhatsApp()}
              target="_blank"
              rel="noreferrer"
              local="rodape"
              className="flex items-center gap-2 text-[var(--text-secondary)] no-underline hover:text-[var(--color-pink)]"
            >
              <Phone className="h-4 w-4 shrink-0" aria-hidden />
              {CONTATO.whatsappVisivel}
            </TrackedWhatsAppLink>
            <a href={`mailto:${CONTATO.email}`} className="flex items-center gap-2 text-[var(--text-secondary)] no-underline hover:text-[var(--color-pink)]">
              <Mail className="h-4 w-4 shrink-0" aria-hidden />
              {CONTATO.email}
            </a>
            <span className="flex items-start gap-2 text-[var(--text-secondary)]">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                {CONTATO.endereco.linha1}
                <br />
                {CONTATO.endereco.linha2} — {CONTATO.endereco.cep}
              </span>
            </span>
          </div>

          <div className="flex flex-col gap-2.5 text-sm text-[var(--color-dark)]">
            <p className="m-0 flex items-center gap-2 font-bold">
              <Clock className="h-4 w-4" aria-hidden />
              Horário de funcionamento
            </p>
            {CONTATO.horario.map((h) => (
              <p key={h.dias} className="m-0 text-[var(--text-secondary)]">
                {h.dias}: {h.horas}
              </p>
            ))}
            <iframe
              title="Mapa — localização do FaçaAmigos"
              src={`https://maps.google.com/maps?q=${encodeURIComponent(CONTATO.mapaBusca)}&output=embed`}
              className="mt-2 h-40 w-full rounded-xl border border-[var(--color-paper-line)]"
              loading="lazy"
            />
          </div>
        </div>

        <div className="border-t border-[var(--color-paper-line)] px-5 py-5 text-center text-xs text-[var(--text-secondary)] sm:px-8">
          © {new Date().getFullYear()} {CLINIC_NAME}. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}
