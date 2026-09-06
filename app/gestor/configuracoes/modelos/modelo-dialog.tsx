"use client";

import { useState } from "react";

export interface TemplateItem {
  id: string;
  title: string;
  category: "evolucao" | "laudo" | "contrato";
  discipline?: string;
  description: string;
  tags: string[];
  content?: string;
  updatedAt: string;
}

interface ModeloDialogProps {
  isOpen: boolean;
  onClose: () => void;
  templateToEdit?: TemplateItem | null;
  onSave: (template: TemplateItem) => void;
}

const AVAILABLE_SHORTCODES = [
  "{nome_paciente}",
  "{cpf_paciente}",
  "{nome_responsavel}",
  "{cpf_responsavel}",
  "{nome_terapeuta}",
  "{conselho_terapeuta}",
  "{data_atendimento}",
  "{horario_inicio}",
  "{horario_fim}",
  "{modalidade}",
  "{cid_paciente}",
  "{valor_sessao}",
];

export function ModeloDialog({ isOpen, onClose, templateToEdit, onSave }: ModeloDialogProps) {
  const [title, setTitle] = useState(templateToEdit?.title ?? "");
  const [category, setCategory] = useState<"evolucao" | "laudo" | "contrato">(
    templateToEdit?.category ?? "evolucao"
  );
  const [discipline, setDiscipline] = useState(templateToEdit?.discipline ?? "");
  const [description, setDescription] = useState(templateToEdit?.description ?? "");
  const [content, setContent] = useState(
    templateToEdit?.content ??
      `DECLARAÇÃO DE ATENDIMENTO CLINICO

Declaramos para os devidos fins que o(a) paciente {nome_paciente}, sob responsabilidade de {nome_responsavel}, realizou sessão de atendimento clínico no dia {data_atendimento} às {horario_inicio}.

Atenciosamente,
{nome_terapeuta} ({conselho_terapeuta})`
  );

  if (!isOpen) return null;

  const insertShortcode = (code: string) => {
    setContent((prev) => prev + " " + code);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tags = content
      .match(/\{[a-zA-Z0-9_]+\}/g)
      ?.filter((v, i, a) => a.indexOf(v) === i) ?? ["{nome_paciente}"];

    const updated: TemplateItem = {
      id: templateToEdit?.id ?? `tpl-${Date.now()}`,
      title,
      category,
      discipline: discipline || undefined,
      description,
      tags,
      content,
      updatedAt: new Date().toISOString().slice(0, 10),
    };

    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-paper-line bg-paper-panel p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-paper-line pb-4 mb-4">
          <h2 className="text-lg font-semibold text-ink-strong">
            {templateToEdit ? `Editar Modelo: ${templateToEdit.title}` : "Novo Modelo de Documento"}
          </h2>
          <button
            onClick={onClose}
            className="text-ink-faint hover:text-ink-strong text-xl font-bold px-2 py-1 leading-none rounded"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-ink-strong">Título do Modelo</label>
              <input
                type="text"
                required
                className="input"
                placeholder="Ex: Minuta de Contrato Clínico Padrão"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-ink-strong">Categoria</label>
              <select
                className="input cursor-pointer"
                value={category}
                onChange={(e) => setCategory(e.target.value as "evolucao" | "laudo" | "contrato")}
              >
                <option value="evolucao">Evolução Clínica / Sessão</option>
                <option value="laudo">Laudo & Relatório</option>
                <option value="contrato">Contrato & Termo</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-ink-strong">Disciplina Aplicável (Opcional)</label>
              <input
                type="text"
                className="input"
                placeholder="Ex: Psicologia ABA, Fonoaudiologia"
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-ink-strong">Descrição Curta</label>
            <input
              type="text"
              required
              className="input"
              placeholder="Ex: Modelo otimizado para emissão de comprovantes de comparecimento."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Shortcodes Bar */}
          <div className="flex flex-col gap-1.5 pt-2">
            <label className="text-xs font-medium text-ink-strong">Variáveis Dinâmicas Disponíveis (Clique para inserir)</label>
            <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-paper-line/30 border border-paper-line">
              {AVAILABLE_SHORTCODES.map((code) => (
                <button
                  type="button"
                  key={code}
                  onClick={() => insertShortcode(code)}
                  className="text-[11px] bg-paper-panel hover:bg-accent hover:text-white text-ink-strong border border-paper-line rounded px-2 py-0.5 font-mono transition-colors"
                >
                  + {code}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-ink-strong">Conteúdo do Modelo</label>
            <textarea
              rows={8}
              required
              className="input font-mono text-xs leading-relaxed"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-paper-line mt-2">
            <button type="button" onClick={onClose} className="button button-outline">
              Cancelar
            </button>
            <button type="submit" className="button button-primary">
              Salvar Modelo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
