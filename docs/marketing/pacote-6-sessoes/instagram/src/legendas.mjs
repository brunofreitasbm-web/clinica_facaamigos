// Gera legendas.md a partir de config.json (nome do plano, alt texts) + legendas abaixo. Chamado por render.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { PROIBIDAS } from './render-lint.mjs';

export function gerarLegendas(cfg, raiz, pecasAlt) {
  const nome = cfg.plano.nome;
  const t = (s) => s.replaceAll('{plano}', `plano ${nome}`).replaceAll('{nome}', nome);
  const cta = 'Para conversar com a equipe, toque no link na bio e chame a gente no WhatsApp.';
  const tags = '#terapiainfantil #fonoaudiologia #terapiaocupacional #psicologiainfantil #rotinafamiliar #belémdopará #clinicainfantil';
  const L = [
    { id: 'carrossel-a', titulo: 'Carrossel A: Rotina que cabe na semana', formato: 'Carrossel 1080x1350, 8 slides', legenda:
`Rotina que cabe na semana: como seis sessões por mês podem se organizar na vida da família.

Escola, trabalho, transporte, descanso. Encaixar a terapia na semana também faz parte do cuidado.

O {plano} reúne 6 sessões por mês, combinando fonoaudiologia, terapia ocupacional e psicologia conforme o plano terapêutico de cada criança. Quem indica se esse é o número que faz sentido é a equipe, na avaliação.

Os dias e horários são conversados com a família, e o acompanhamento fica no Portal da Família.

${cta}

${tags}`, slides: 'carrossel-a' },
    { id: 'carrossel-b', titulo: 'Carrossel B: Como funciona (avaliação, plano, rotina)', formato: 'Carrossel 1080x1350, 7 slides', legenda:
`Como funciona na FaçaAmigos: avaliação, plano, rotina.

1. Avaliação: a equipe conhece a criança e conversa com a família. O laudo ajuda, mas não é obrigatório para começar.
2. Plano terapêutico: a equipe monta o Plano Terapêutico Singular, com as especialidades e a quantidade de sessões por mês.
3. Rotina: as sessões entram na semana da família. Quando a indicação é de 6 sessões por mês, existe o {plano}.

A frequência vem da avaliação e pode ser revista ao longo do tempo.

${cta}

${tags}`, slides: 'carrossel-b' },
    { id: 'post-apresentacao', titulo: 'Post estático de apresentação', formato: 'Imagem 1080x1350', legenda:
`Seis sessões por mês, nas terapias que a avaliação indicar.

Apresentamos o {plano}: atendimento em Belém, com fonoaudiologia, terapia ocupacional e psicologia combinadas conforme o plano terapêutico da criança.

A equipe define na avaliação quantas sessões fazem sentido e como distribuí-las no mês. Você acompanha tudo pelo Portal da Família.

${cta}

${tags}`, slides: 'post-apresentacao' },
    { id: 'stories', titulo: 'Stories (sequência de 5)', formato: 'Stories 1080x1920', legenda:
`Stories não têm legenda. Texto de apoio e adesivos:
- Story 1 (teaser): sem adesivo. Opcional: adesivo de contagem não é usado (não há prazo promocional).
- Story 2 (como funciona): adesivo de link para a página do plano (UTM de story do calendário).
- Story 3 (caixa de perguntas): adesivo "Caixa de perguntas" com o texto "Pergunte sobre o {plano}". Responder só dúvidas gerais; casos individuais vão para o WhatsApp.
- Story 4 (lembrete): adesivo de link no espaço reservado (pílula clara), texto do adesivo: "Falar com a equipe no WhatsApp".
- Story 5 (bastidores): sem adesivo, ou enquete neutra "Sua semana tem espaço para a rotina de terapia? Sim / Estou organizando" (sem pedir dado de saúde).`, slides: 'story' },
    { id: 'reels', titulo: 'Capas de reel e destaque', formato: 'Capas 1080x1920 (área segura 4:5 central)', legenda:
`Legendas dos reels estão em roteiros-reels.md. O destaque "${nome}" fica fixado no perfil com os stories 2, 3 e 4 após a sequência de lançamento.`, slides: 'reel|destaque' }
  ];
  let md = `# Legendas, hashtags e texto alternativo\n\nGerado por src/legendas.mjs a partir de src/config.json. Não edite este arquivo à mão: edite o script ou o config e rode node src/render.mjs.\n\nRegras: gancho na primeira linha, até 2200 caracteres, CTA sempre para o link na bio / WhatsApp, sem preço, sem pacote, sem promessa. ${cfg.handle.includes('[') ? 'Handle do Instagram: ' + cfg.handle + ' (preencher).' : ''}\n\n`;
  const erros = [];
  for (const b of L) {
    const txt = t(b.legenda);
    for (const re of PROIBIDAS) if (b.id !== 'stories' && re.test(txt)) erros.push(`${b.id}: ${re}`);
    if (txt.length > 2200) erros.push(b.id + ' > 2200');
    md += `## ${b.titulo}\n\nFormato: ${b.formato}\n\n**Legenda** (${txt.length} caracteres)\n\n\`\`\`\n${txt}\n\`\`\`\n\n`;
    const alts = pecasAlt.filter((p) => new RegExp('^(' + b.slides + ')').test(p.id));
    md += `**Texto alternativo**\n\n` + alts.map((a) => `- \`${a.id}\`: ${a.alt}`).join('\n') + '\n\n';
  }
  if (erros.length) { console.error('Legendas recusadas: ' + erros.join('; ')); process.exit(4); }
  fs.writeFileSync(path.join(raiz, 'legendas.md'), md);
  console.log('legendas.md gerado');
}
