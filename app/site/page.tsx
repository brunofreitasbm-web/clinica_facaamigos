import type { Metadata } from "next";
import Image from "next/image";
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
  EMPRESA,
  QUEM_CUIDA,
  CONVENIOS_NA_ABERTURA,
  linkWhatsApp,
} from "./content";

const DESCRICAO_SEO =
  "Centro de terapia comportamental infantil no Umarizal, Belém/PA. Equipe multidisciplinar, psicóloga responsável CRP 10/4727 e convênios IASEP e PROASA. Entre na lista de espera.";

export const metadata: Metadata = {
  title: "Centro de Terapia Comportamental Infantil em Belém",
  description: DESCRICAO_SEO,
  keywords: [
    "terapia aba belém",
    "centro de terapia comportamental",
    "autismo belém",
    "clínica tea belém",
    "fonoaudiologia infantil belém",
    "terapia ocupacional infantil",
  ],
  alternates: { canonical: "/" },
  // Esta é a única página do domínio feita para ser indexada (ver app/robots.ts
  // e proxy.ts). O layout raiz declara noindex para o sistema, então o override
  // aqui é obrigatório. A landing é servida na raiz de clinica.institutofacaamigos.com.br.
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large" } },
  openGraph: {
    title: CLINIC_NAME,
    description: DESCRICAO_SEO,
    url: "/",
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
      .neq("name", "Particular") // "Particular" é opção própria do formulário, não convênio
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
      "Centro de terapia comportamental e desenvolvimento infantil, com equipe multidisciplinar, no Umarizal, em Belém/PA.",
    "@id": `${CLINIC_WEBSITE}/#clinica`,
    url: `${CLINIC_WEBSITE}/`,
    image: `${CLINIC_WEBSITE}/site/atendimento.webp`,
    legalName: EMPRESA.razaoSocial,
    taxID: EMPRESA.cnpj,
    founder: {
      "@type": "Person",
      name: EQUIPE[0]?.nome,
      jobTitle: EQUIPE[0]?.especialidade,
      identifier: EQUIPE[0]?.registro,
    },
    sameAs: CONTATO.redes.map((r) => r.url),
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "08:00",
        closes: "18:00",
      },
      { "@type": "OpeningHoursSpecification", dayOfWeek: "Saturday", opens: "08:00", closes: "12:00" },
    ],
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
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[32px] bg-white shadow-lg sm:aspect-[5/4] lg:aspect-[4/5]">
              <Image
                src={HERO.imagem.src}
                alt={HERO.imagem.alt}
                width={HERO.imagem.largura}
                height={HERO.imagem.altura}
                priority
                sizes="(min-width: 1024px) 45vw, 100vw"
                className="h-full w-full object-cover"
              />
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
          <div className="mx-auto mt-8 max-w-xl rounded-3xl bg-white p-6 text-left shadow-sm">
            <p className="m-0 text-base font-bold text-[var(--color-dark)]">{EMPATIA.sinaisTitulo}</p>
            <ul className="mt-3 flex list-none flex-col gap-2 p-0">
              {EMPATIA.sinais.map((sinal) => (
                <li key={sinal} className="flex items-start gap-2 text-[15px] text-[var(--text-secondary)]">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-teal)]" aria-hidden />
                  {sinal}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm font-semibold text-[var(--color-teal-800)]">{EMPATIA.sinaisNota}</p>
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
              O que você encontra aqui
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

          <ol className="grid gap-8 sm:grid-cols-3">
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
            <div className="flex flex-wrap gap-3">
              <a
                href={ECOSSISTEMA.cta.href}
                target="_blank"
                rel="noreferrer"
                className="btn btn-gold w-fit"
              >
                {ECOSSISTEMA.cta.rotulo}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
              <a
                href={ECOSSISTEMA.ctaSecundario.href}
                target="_blank"
                rel="noreferrer"
                className="btn w-fit border border-white/40 text-white"
              >
                {ECOSSISTEMA.ctaSecundario.rotulo}
              </a>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[32px]">
              <Image
                src={ECOSSISTEMA.imagem.src}
                alt={ECOSSISTEMA.imagem.alt}
                width={ECOSSISTEMA.imagem.largura}
                height={ECOSSISTEMA.imagem.altura}
                sizes="(min-width: 1024px) 45vw, 100vw"
                className="h-full w-full object-cover"
              />
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

      {/* ── Quem cuida ───────────────────────────────────────────────── */}
      {EQUIPE.length > 0 && (
        <section id="quem-cuida" className="bg-[var(--color-bg)]">
          <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[var(--color-teal-100)] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[var(--color-teal-800)]">
                <HeartHandshake className="h-3.5 w-3.5" aria-hidden />
                {QUEM_CUIDA.chapeu}
              </span>
              <h2 className="mt-4 text-3xl font-extrabold text-[var(--color-dark)] sm:text-4xl">{QUEM_CUIDA.titulo}</h2>
            </div>
            <div className="flex flex-col gap-10">
              {EQUIPE.map((p) => (
                <div key={p.nome} className="grid items-center gap-8 md:grid-cols-[0.8fr_1.2fr]">
                  <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-[32px] shadow-lg">
                    <Image
                      src={p.foto.src}
                      alt={p.foto.alt}
                      width={p.foto.largura}
                      height={p.foto.altura}
                      sizes="(min-width: 768px) 30vw, 90vw"
                      className="h-full w-full object-cover"
                      style={{ objectPosition: "50% 28%" }}
                    />
                  </div>
                  <div className="flex flex-col gap-3">
                    <h3 className="m-0 text-2xl font-extrabold text-[var(--color-dark)]">{p.nome}</h3>
                    <p className="m-0 text-base font-semibold text-[var(--color-pink)]">
                      {p.especialidade} · {p.registro}
                    </p>
                    <p className="m-0 text-[17px] leading-relaxed text-[var(--text-secondary)]">{p.bio}</p>
                    <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                      {p.chips.map((c) => (
                        <li key={c} className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-[var(--color-dark)] shadow-sm">
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-8 text-center text-sm text-[var(--text-secondary)]">{QUEM_CUIDA.nota}</p>
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
              <>
                <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
                  {CONVENIOS_NA_ABERTURA.map((nome) => (
                    <li
                      key={nome}
                      className="flex items-center gap-2 rounded-2xl bg-[var(--color-bg)] px-4 py-3 text-[15px] font-semibold text-[var(--color-dark)]"
                    >
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--color-teal)]" aria-hidden />
                      {nome}
                      <span className="text-xs font-medium text-[var(--text-secondary)]">{PLANOS.aberturaRotulo}</span>
                    </li>
                  ))}
                </ul>
                <p className="m-0 rounded-2xl bg-[var(--color-teal-100)] p-4 text-[15px] leading-relaxed font-medium text-[var(--color-teal-800)]">
                  {PLANOS.semLista}
                </p>
                <p className="m-0 text-[15px] leading-relaxed text-[var(--text-secondary)]">{PLANOS.reembolso}</p>
              </>
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
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{RODAPE.aviso}</p>
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
              Horário após a inauguração
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
          © {new Date().getFullYear()} {CLINIC_NAME}. Todos os direitos reservados. {EMPRESA.razaoSocial} · CNPJ {EMPRESA.cnpj}.
        </div>
      </footer>
    </div>
  );
}
