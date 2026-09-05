import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionData, patientName } = body;

    // Simulação do assistente de inteligência artificial voltado a clínicas ABA
    // Processa os dados comportamentais (ABC) e tentativas para gerar síntese evolutiva e sugestões no PEI.
    const mockAnalysis = {
      synthesizedEvolution: `Durante a sessão de hoje, o paciente ${patientName || "atendido"} apresentou boa engajamento nas atividades estruturadas. Foram registradas 12 tentativas com taxa de acerto de 83%. Houve 1 episódio de comportamento de esquiva com duração de 2 minutos, manejado com redirecionamento de estímulo e reforço positivo contingente.`,
      peiSuggestions: [
        {
          target: "Comunicação Funcional - Mandos com Apoio Visual",
          status: "Em evolução constante",
          recommendation: "Manter critério de aprendizado atual (80% em 3 sessões consecutivas). Progredir para diminuição da dica física na próxima semana.",
        },
        {
          target: "Tolerância à Frustração em Troca de Atividades",
          status: "Atenção necessária",
          recommendation: "Introduzir cronômetro visual de 2 minutos como antecipação antes de transicionar de tarefa.",
        },
      ],
      aiConfidence: 0.94,
    };

    return NextResponse.json({
      success: true,
      analysis: mockAnalysis,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 400 });
  }
}
