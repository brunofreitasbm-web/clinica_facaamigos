"use client";

import React, { useState, useEffect, useRef } from "react";
import { ClinicalProtocolOption, CLINICAL_DICTIONARY, searchDictionary } from "@/lib/clinical-dictionary";

export interface GoalFormData {
  discipline: string;
  domain: string;
  description: string;
  baseline?: string;
  target?: string;
  criterion?: string;
  horizon?: string;
  methodology?: string;
  strategy?: string;
}

interface GoalFormProps {
  goal: GoalFormData;
  onChange: (updatedGoal: Partial<GoalFormData>) => void;
  inputClass?: string;
  allowCreate?: boolean;
}

export function GoalForm({
  goal,
  onChange,
  inputClass = "w-full rounded-md border border-paper-line bg-paper-surface px-3 py-2 text-xs text-ink focus:border-chart focus:outline-none focus:ring-1 focus:ring-chart",
  allowCreate = true,
}: GoalFormProps) {
  const [searchTerm, setSearchTerm] = useState(goal.description || "");
  const [domainInput, setDomainInput] = useState(goal.domain || "");
  const [isOpen, setIsOpen] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState<ClinicalProtocolOption[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync internal state when goal prop updates externally
  useEffect(() => {
    setSearchTerm(goal.description || "");
    setDomainInput(goal.domain || "");
  }, [goal.description, goal.domain]);

  // Filter dictionary based on search term and discipline
  useEffect(() => {
    const results = searchDictionary(searchTerm, goal.discipline);
    setFilteredOptions(results);
  }, [searchTerm, goal.discipline]);

  // Handle clicking outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectOption = (option: ClinicalProtocolOption) => {
    setSearchTerm(option.title);
    setDomainInput(option.domain);
    setIsOpen(false);

    // Auto-fill connected fields
    onChange({
      domain: option.domain,
      description: option.title,
      criterion: goal.criterion || option.defaultCriterion,
      methodology: goal.methodology || option.defaultMethodology,
      strategy: goal.strategy || option.defaultStrategy || "",
    });
  };

  const handleDescriptionChange = (text: string) => {
    setSearchTerm(text);
    setIsOpen(true);
    onChange({ description: text });
  };

  const handleDomainChange = (text: string) => {
    setDomainInput(text);
    onChange({ domain: text });
  };

  return (
    <div className="space-y-3">
      {/* Domínio & Autocomplete Search */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-ink-soft block mb-1">
            Domínio *
          </label>
          <input
            type="text"
            value={domainInput}
            onChange={(e) => handleDomainChange(e.target.value)}
            placeholder="Ex: Mando, Tato, Autonomia…"
            className={inputClass}
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-ink-soft block mb-1">
            Dicionário de Protocolos
          </label>
          <div className="relative" ref={dropdownRef}>
            <input
              type="text"
              value={searchTerm}
              onFocus={() => setIsOpen(true)}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              placeholder="🔍 Buscar meta no VB-MAPP, ABLLS-R ou Denver…"
              className={inputClass}
            />

            {/* Dropdown Options */}
            {isOpen && (
              <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-paper-line-strong bg-white py-1 shadow-lg text-xs">
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectOption(opt)}
                      className="w-full text-left px-3 py-2 hover:bg-chart-soft/40 transition-colors flex flex-col gap-0.5 border-b border-paper-line/50 last:border-0"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-ink">{opt.title}</span>
                        <span className="shrink-0 rounded bg-chart-soft px-1.5 py-0.5 text-[10px] font-bold text-chart uppercase">
                          {opt.protocol}
                        </span>
                      </div>
                      <span className="text-[11px] text-ink-soft">
                        Domínio: <strong className="text-ink">{opt.domain}</strong> • Mastery: {opt.defaultCriterion}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-ink-faint text-center">
                    {allowCreate && searchTerm.trim() ? (
                      <button
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          onChange({ description: searchTerm });
                        }}
                        className="w-full text-left text-chart hover:underline font-semibold"
                      >
                        + Criar meta personalizada: "{searchTerm}"
                      </button>
                    ) : (
                      "Nenhum resultado no protocolo."
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Meta (Descrição SMART) */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-ink-soft block mb-1">
          Meta (Descrição SMART) *
        </label>
        <textarea
          value={goal.description}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          rows={2}
          placeholder="Descreva o objetivo específico SMART…"
          className={inputClass}
        />
      </div>
    </div>
  );
}

export default GoalForm;
