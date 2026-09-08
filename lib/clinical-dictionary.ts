export interface ClinicalProtocolOption {
  id: string;
  protocol: "VB-MAPP" | "ABLLS-R" | "DENVER" | "Padrão Clínica";
  discipline: "aba" | "fono" | "to" | "psico" | "fisio" | "outra";
  domain: string;
  title: string;
  defaultCriterion: string;
  defaultMethodology: string;
  defaultStrategy?: string;
}

export const CLINICAL_DICTIONARY: ClinicalProtocolOption[] = [
  // VB-MAPP
  {
    id: "vb_mando_01",
    protocol: "VB-MAPP",
    discipline: "aba",
    domain: "Mando",
    title: "Mando de itens desejados com dica gestual/verbal",
    defaultCriterion: "80% de acertos em 3 sessões consecutivas com 2 aplicadores",
    defaultMethodology: "dtt",
    defaultStrategy: "Treino de mando em ambiente natural (NET) com esvanecimento de dicas.",
  },
  {
    id: "vb_mando_02",
    protocol: "VB-MAPP",
    discipline: "aba",
    domain: "Mando",
    title: "Mando espontâneo sem necessidade de dicas",
    defaultCriterion: "90% de independência em 5 sessões consecutivas",
    defaultMethodology: "naturalistico",
    defaultStrategy: "Captação de motivação (MO) e atraso constante de resposta de 5 segundos.",
  },
  {
    id: "vb_tato_01",
    protocol: "VB-MAPP",
    discipline: "aba",
    domain: "Tato",
    title: "Nomeação de 10 objetos comuns do cotidiano",
    defaultCriterion: "80% de acertos em 3 blocos sucessivos de tentativas",
    defaultMethodology: "dtt",
    defaultStrategy: "Apresentação de estímulo tátil/visual seguido da pergunta 'O que é isso?' com reforço contingente.",
  },
  {
    id: "vb_tato_02",
    protocol: "VB-MAPP",
    discipline: "aba",
    domain: "Tato",
    title: "Nomeação de ações em figuras ou vídeos curtos",
    defaultCriterion: "85% de independência em 3 sessões consecutivas",
    defaultMethodology: "dtt",
    defaultStrategy: "Tentativas discretas com apresentação de cartões de ações e esvanecimento de modelo verbal.",
  },
  {
    id: "vb_intraverbal_01",
    protocol: "VB-MAPP",
    discipline: "aba",
    domain: "Intraverbal",
    title: "Completar canções e frases de rotina",
    defaultCriterion: "100% de precisão em 3 sessões consecutivas",
    defaultMethodology: "misto",
    defaultStrategy: "Uso de reforço social e pausa estratégica para que o paciente complete o trecho verbal.",
  },
  {
    id: "vb_intraverbal_02",
    protocol: "VB-MAPP",
    discipline: "aba",
    domain: "Intraverbal",
    title: "Responde a perguntas pessoais simples (Nome, Idade)",
    defaultCriterion: "90% de acertos independentes em 4 sessões consecutivas",
    defaultMethodology: "dtt",
    defaultStrategy: "Treino de perguntas de identificação pessoal com esvanecimento de ecoico imediato.",
  },
  {
    id: "vb_ouvinte_01",
    protocol: "VB-MAPP",
    discipline: "aba",
    domain: "Comportamento de Ouvinte",
    title: "Atender a instruções simples de um passo ('Senta', 'Vem')",
    defaultCriterion: "80% de cumprimento independente em 3 sessões seguidas",
    defaultMethodology: "misto",
    defaultStrategy: "Dica física total gradualmente esvanecida para dica leve de toque.",
  },

  // ABLLS-R
  {
    id: "ablls_vis_01",
    protocol: "ABLLS-R",
    discipline: "aba",
    domain: "Desempenho Visual",
    title: "Emparelhamento de objetos idênticos de 3D para 3D",
    defaultCriterion: "90% de acertos em 3 blocos de 10 tentativas",
    defaultMethodology: "dtt",
    defaultStrategy: "Apresentação da amostra com instrução 'Igual com igual' e reforço imediato.",
  },
  {
    id: "ablls_vis_02",
    protocol: "ABLLS-R",
    discipline: "aba",
    domain: "Desempenho Visual",
    title: "Pareamento de figuras com objetos (2D para 3D)",
    defaultCriterion: "80% de precisão em 3 sessões consecutivas",
    defaultMethodology: "dtt",
    defaultStrategy: "Treino com matriz de 3 alternativas e esvanecimento de posição.",
  },

  // DENVER (ESDM)
  {
    id: "denver_soc_01",
    protocol: "DENVER",
    discipline: "psico",
    domain: "Habilidades Sociais",
    title: "Manter contato visual espontâneo durante trocas comunicativas",
    defaultCriterion: "Pelo menos 5 trocas de olhar em atividades motivadoras de 10 minutos",
    defaultMethodology: "naturalistico",
    defaultStrategy: "Posicionamento na linha do olhar da criança durante jogos sensoriais sociais.",
  },
  {
    id: "denver_mot_01",
    protocol: "DENVER",
    discipline: "to",
    domain: "Motricidade Fina",
    title: "Preensão em pinça para encaixe de peças pequenas",
    defaultCriterion: "80% de sucesso independente em 3 sessões",
    defaultMethodology: "misto",
    defaultStrategy: "Modelagem com massinha de modelagem e blocos de encaixe de tamanho gradativo.",
  },

  // Fonoaudiologia
  {
    id: "fono_art_01",
    protocol: "Padrão Clínica",
    discipline: "fono",
    domain: "Articulação e Fonologia",
    title: "Produção adequada do fonema /r/ em posição de tepe",
    defaultCriterion: "80% de precisão em palavras isoladas e frases curtas em 3 sessões",
    defaultMethodology: "misto",
    defaultStrategy: "Pistas proprioceptivas e visuais diante do espelho.",
  },
  {
    id: "fono_ling_01",
    protocol: "Padrão Clínica",
    discipline: "fono",
    domain: "Linguagem Receptiva",
    title: "Compreensão e execução de ordens com 2 comandos associados",
    defaultCriterion: "85% de assertividade sem dicas adicionais em 4 sessões",
    defaultMethodology: "naturalistico",
    defaultStrategy: "Jogos simbólicos dirigidos com suporte de figuras e gestos facilitadores.",
  },

  // Terapia Ocupacional
  {
    id: "to_avd_01",
    protocol: "Padrão Clínica",
    discipline: "to",
    domain: "Autonomia e AVDs",
    title: "Independência na lavagem de mãos sequenciada",
    defaultCriterion: "100% dos passos executados independentemente por 5 dias seguidos",
    defaultMethodology: "misto",
    defaultStrategy: "Encadeamento para trás com suporte de rotina visual estruturada em fotos.",
  },
  {
    id: "to_sens_01",
    protocol: "Padrão Clínica",
    discipline: "to",
    domain: "Integração Sensorial",
    title: "Tolerância a texturas variadas (meios úmidos e viscosos)",
    defaultCriterion: "Engajamento contínuo por 5 minutos sem respostas de esquiva defensiva",
    defaultMethodology: "naturalistico",
    defaultStrategy: "Dessensibilização sistemática lúdica com reforço gradual.",
  }
];

export function getDictionaryDomains(discipline?: string): string[] {
  const filtered = discipline
    ? CLINICAL_DICTIONARY.filter((item) => item.discipline === discipline || item.discipline === "aba")
    : CLINICAL_DICTIONARY;
  
  const domains = Array.from(new Set(filtered.map((item) => item.domain)));
  return domains.sort();
}

export function searchDictionary(query: string, discipline?: string): ClinicalProtocolOption[] {
  const cleanQuery = query.toLowerCase().trim();
  let items = CLINICAL_DICTIONARY;
  
  if (discipline) {
    items = items.filter((i) => i.discipline === discipline || i.discipline === "aba" || i.discipline === "outra");
  }

  if (!cleanQuery) return items;

  return items.filter(
    (item) =>
      item.title.toLowerCase().includes(cleanQuery) ||
      item.domain.toLowerCase().includes(cleanQuery) ||
      item.protocol.toLowerCase().includes(cleanQuery)
  );
}
