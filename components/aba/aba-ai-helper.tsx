"use client";

import { useState } from "react";

interface AbaAiHelperProps {
  patientName?: string;
  onApplyEvolution?: (text: string) => void;
}

export function AbaAiHelper({ patientName = "Paciente", onApplyEvolution }: AbaAiHelperProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    synthesizedEvolution: string;
    peiSuggestions: Array<{ target: string; status: string; recommendation: string }>;
  } | null>(null);

  const handleGenerateAnalysis = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/aba/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientName, sessionData: {} }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.analysis);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-[#cfc8b4] bg-[#faf8f3] p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">✨</span>
          <h4 className="text-xs font-bold text-[#1c2530]" style={{ fontFamily: "var(--font-heading)" }}>
            Assistente de IA ABA · Síntese Evolutiva & PEI
          </h4>
        </div>
        <button
          type="button"
          onClick={handleGenerateAnalysis}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#0f5c7d] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#0a4a5f] transition-colors disabled:opacity-50"
        >
          {isLoading ? "⚡ Gerando Análise..." : "🪄 Gerar Síntese & Sugestões PEI"}
        </button>
      </div>

      {result && (
        <div className="space-y-3 pt-2 border-t border-[#e4dfd2] text-xs">
          <div className="space-y-1">
            <span className="font-semibold text-[#0f5c7d] uppercase text-[10px]">Minuta de Evolução Sugerida:</span>
            <p className="bg-white p-3 rounded border border-[#e4dfd2] text-[#1c2530] leading-relaxed">
              {result.synthesizedEvolution}
            </p>
            {onApplyEvolution && (
              <button
                type="button"
                onClick={() => onApplyEvolution(result.synthesizedEvolution)}
                className="text-[11px] font-semibold text-[#1b8a6b] hover:underline"
              >
                + Inserir esta síntese na evolução clínica
              </button>
            )}
          </div>

          <div className="space-y-2">
            <span className="font-semibold text-[#0f5c7d] uppercase text-[10px]">Recomendações no PEI:</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {result.peiSuggestions.map((item, idx) => (
                <div key={idx} className="bg-white p-2.5 rounded border border-[#e4dfd2] space-y-1">
                  <div className="font-bold text-[#1c2530]">{item.target}</div>
                  <div className="text-[10px] text-[#c97c1f] font-semibold">{item.status}</div>
                  <p className="text-[11px] text-[#57606b]">{item.recommendation}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
