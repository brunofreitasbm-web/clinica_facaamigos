"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { ConfigSidebar } from "../config-sidebar";

interface TemplateItem {
  id: string;
  title: string;
  category: "evolucao" | "laudo" | "contrato";
  discipline?: string;
  description: string;
  tags: string[];
  updatedAt: string;
}

const INITIAL_TEMPLATES: TemplateItem[] = [
  {
    id: "tpl-1",
    title: "Evolução Rápida ABA (Padrão 2 min)",
    category: "evolucao",
    discipline: "Psicologia ABA",
    description: "Template otimizado para registro em 2 minutos: engajamento, nível de ajuda e ocorrência de comportamentos-alvo.",
    tags: ["{nivel_ajuda}", "{engajamento}", "{comportamento_barreira}"],
    updatedAt: "2026-09-01",
  },
  {
    id: "tpl-2",
    title: "Evolução Fonoaudiologia",
    category: "evolucao",
    discipline: "Fonoaudiologia",
    description: "Foco em expressividade, pragmática, motricidade orofacial e intenção comunicativa.",
    tags: ["{intencao_comunicativa}", "{articulacao}", "{reforçador}"],
    updatedAt: "2026-08-28",
  },
  {
    id: "tpl-3",
    title: "Evolução Terapia Ocupacional / Integração Sensorial",
    category: "evolucao",
    discipline: "Terapia Ocupacional",
    description: "Foco em modulação sensorial, planejamento motor e autonomia em AVDs.",
    tags: ["{perfil_sensorial}", "{autonomia_avd}", "{regulacao}"],
    updatedAt: "2026-08-20",
  },
  {
    id: "tpl-4",
    title: "Laudo Multidisciplinar Semestral para Convênio",
    category: "laudo",
    description: "Minuta de relatório para renovação de guias de autorização TISS.",
    tags: ["{nome_paciente}", "{cid}", "{horas_prescritas}", "{resumo_metas}"],
    updatedAt: "2026-09-03",
  },
  {
    id: "tpl-5",
    title: "Contrato de Prestação de Serviços Clínicos",
    category: "contrato",
    description: "Minuta padrão de prestação de serviços com o responsável legal do paciente.",
    tags: ["{nome_paciente}", "{cpf_responsavel}", "{valor_mensalidaded}"],
    updatedAt: "2026-07-15",
  },
];

export function ModelosManager() {
  const [templates, setTemplates] = useState<TemplateItem[]>(INITIAL_TEMPLATES);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = templates.filter((t) => {
    const matchesCategory = filterCategory === "all" || t.category === filterCategory;
    const matchesSearch =
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      (t.discipline && t.discipline.toLowerCase().includes(search.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <>
      <ConfigSidebar active="modelos" />
      <div className="flex flex-1 flex-col overflow-y-auto">
        <PageHeader
          axisLabel="Configurações"
          title="Modelos"
          description="Modelos de evolução rápida por disciplina, minutas de laudos e contratos com variáveis dinâmicas."
        />

        <div className="flex flex-col gap-6 p-6 sm:p-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <input
                type="search"
                className="input"
                style={{ maxWidth: 280 }}
                placeholder="Buscar modelo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="input cursor-pointer"
                style={{ maxWidth: 200 }}
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="all">Todas as categorias</option>
                <option value="evolucao">Evoluções Clínicas</option>
                <option value="laudo">Laudos & Relatórios</option>
                <option value="contrato">Contratos & Termos</option>
              </select>
            </div>

            <button
              onClick={() => alert("Janela de criação de novo modelo pronta para salvar no Supabase.")}
              className="button button-primary"
            >
              + Novo Modelo
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((tpl) => (
              <div
                key={tpl.id}
                className="flex flex-col justify-between rounded-xl border border-paper-line bg-paper-panel p-5 shadow-sm hover:border-paper-line-strong transition-colors"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-ink-strong">{tpl.title}</span>
                    <span className="tag tag-outline text-[11px] capitalize">
                      {tpl.category === "evolucao" ? "Evolução" : tpl.category === "laudo" ? "Laudo" : "Contrato"}
                    </span>
                  </div>
                  {tpl.discipline && (
                    <span className="text-xs font-medium text-accent">{tpl.discipline}</span>
                  )}
                  <p className="text-xs text-ink-faint leading-relaxed">{tpl.description}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-paper-line flex items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1">
                    {tpl.tags.map((tag) => (
                      <span key={tag} className="text-[10px] bg-paper-line/50 text-ink-faint rounded px-1.5 py-0.5 font-mono">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => alert(`Editando modelo: ${tpl.title}`)}
                    className="text-xs font-medium text-accent hover:underline shrink-0"
                  >
                    Editar
                  </button>
                </div>
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="col-span-full p-8 text-center text-sm text-ink-faint border border-dashed border-paper-line rounded-xl">
                Nenhum modelo encontrado para os filtros selecionados.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
