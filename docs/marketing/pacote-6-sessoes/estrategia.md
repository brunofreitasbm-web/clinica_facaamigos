# Plano particular de 6 sessões/mês: estratégia de venda

Clínica FaçaAmigos, Belém-PA. Elaborado em 05/11/2026 para Bruno. Documento interno: nada aqui é texto pronto para publicar sem passar pelo checklist da seção 10.

Convenções do documento:
- **[FATO]** conferido em arquivo ou fonte primária lida nesta sessão.
- **[ESTIMATIVA]** palpite meu, sem dado da clínica por trás. Serve para começar, não para decidir.
- **[NÃO CONFIRMADO]** não consegui verificar.
- Blocos de citação (`>`) são texto de peça. Eles obedecem às proibições da marca (sem "festa, aniversário, promessa, confiança, oferta", sem "melhor clínica", sem resultado clínico, sem "cura", sem depoimento, sem criança exposta) e às restrições dos conselhos descritas na seção 0.

---

## 0. O que mudou a estratégia: regras dos conselhos sobre preço

Esta seção vem primeiro porque ela decide o formato da campanha inteira. Pesquisei e li o texto de três normas. Uma quarta (COFFITO) eu não consegui abrir.

| Conselho | Fonte lida | O que diz [FATO] | Efeito na campanha |
|---|---|---|---|
| CFFa (fonoaudiologia; a sigla do regional que você usa, CREFONO, aparece no Código como "Conselho Regional de Fonoaudiologia") | Código de Ética da Fonoaudiologia, aprovado em 03/12/2021, Res. CFFa 640/2021, DOU 09/12/2021. Art. 37, I | É infração ética "anunciar preços, descontos e sorteios, exceto na divulgação de cursos, palestras, seminários e afins". Art. 39, IV exige consentimento formal para publicar imagem, vídeo e áudio de cliente. Art. 36, I exige nome, profissão e nº de inscrição no conselho em anúncios e mídias digitais | **Preço, desconto e sorteio não entram em nenhuma peça pública.** Peças com fonoaudiólogo identificado levam nome e inscrição |
| CFP (psicologia) | Cartilha de publicidade do CRP-MG, 2ª edição, 2026 (arquivo com data de modificação 08/04/2026; é orientação de um regional, não norma do CFP). Reproduz o Código de Ética Profissional do Psicólogo, art. 20, alíneas d, e, h, e a Res. CFP 03/2007, arts. 53 a 56 | O psicólogo "não utilizará o preço do serviço como forma de propaganda" e não fará "previsão taxativa de resultados". A cartilha interpreta que isso proíbe dar foco ao valor mesmo sem citar preço, incluindo "gratuidade, descontos, promoções, pacotes, cupons, sorteios". Diz que venda de pacotes pode virar "prolongamento desnecessário" do serviço. Recomenda informar valor de forma reservada, antes do início do trabalho, e não em publicidade ao público geral. Sobre depoimentos: "linha tênue com o sensacionalismo" | Mesma conclusão: **sem preço, sem foco em vantagem financeira, sem a palavra "pacote" em peça pública.** E o desenho do plano precisa se sustentar clinicamente (ver seção 4, "sem fidelidade", frequência definida na avaliação) |
| CFM (medicina) | Resolução CFM 2.336/2023, DOU 13/09/2023, em vigor 180 dias depois. Art. 9º, VI, VIII; art. 14 | Médico pode informar valores, formas de pagamento e anunciar descontos em campanhas, sem vincular a vendas casadas ou premiações. Segue vedada a indução de garantia de resultados | **Não se aplica à clínica** (o corpo clínico não é médico, até onde sei) [NÃO CONFIRMADO]. Uso só como régua: se até a medicina permite preço, o piso de restrição aqui vem de CFFa e CFP. Importa para médicos que indicam a clínica (seção 7) |
| COFFITO (terapia ocupacional) | Só fontes secundárias | A Res. COFFITO 425/2013 é o código de ética da TO e a Res. 532/2021 trata da divulgação de imagens, textos e áudios de procedimentos. Um recurso de prova da UFRJ cita o art. 10, V da 532/2021 sobre divulgar agradecimento de paciente | **[NÃO CONFIRMADO]**: não abri o texto oficial. Não sei se há regra de preço. Não sei se a 425/2013 segue vigente na forma original. Tratar TO com a restrição mais dura (a de CFFa e CFP) até o CREFITO responder |

O que eu NÃO consegui confirmar:
1. Texto oficial do COFFITO sobre preço, promoção e resultado.
2. Se as vedações de CFFa e CFP se aplicam à clínica como pessoa jurídica ou só ao profissional individual. Assumo que se aplicam a qualquer peça em que um profissional apareça ou seja o responsável técnico.
3. Se responder o preço a quem pergunta no WhatsApp 1:1 conta como "anunciar" (CFFa art. 37, I). A cartilha do CRP-MG recomenda justamente informar o valor de forma reservada antes do início, o que apoia o canal privado. O bot da clínica já faz isso hoje. Para fonoaudiologia, não há texto que diga que é permitido.
4. Nota Técnica CFP 01/2022 sobre redes sociais: aparece em resultado de busca, não li.
5. A pesquisa não encontrou nenhum texto oficial que permita "pacote" e "desconto" para psicologia. Ausência de achado não é autorização.

Fato do site hoje [FATO]: a página `/planos` (`src/data/paginas/planos.json` e `.html`) já omite os valores e diz "Valores pelo WhatsApp". Estava certo. Dois pontos dela merecem revisão com os conselhos: usa a palavra "Pacotes" no título e descrições, e o texto alternativo das imagens cita "em até 3x sem juros".

Consequência estratégica: **a alavanca de persuasão mais forte (preço) fica no WhatsApp 1:1. Em público, a campanha vende frequência, rotina, agenda e equipe.**

Pesquisa de mercado (item b): só achei estimativas de agregadores, sem ler as páginas. Cronoshare indica faixas de R$ 80 a R$ 400 por sessão de TO e R$ 60 a R$ 200 por sessão de fonoaudiologia (infantil de R$ 100 a R$ 200, chegando a R$ 300) [ESTIMATIVA de terceiro, indicativa, possivelmente desatualizada]. Não encontrei dado verificável de pacote mensal de terapia infantil/TEA em Belém. Não uso benchmark de mercado para justificar preço. R$ 180 a R$ 190 por sessão cai dentro dessas faixas, e isso é tudo que dá para dizer.

---

## 1. Tese de venda e ponto mais fraco

**Tese (5 linhas)**
1. O plano não vende preço. Vende continuidade: seis sessões por mês é a frequência entre "começar" (4) e "intensificar" (8), para a família que quer rotina sem entrar no plano de 8.
2. Compra quem acabou de receber o laudo ou está na fila de outro serviço, e quem já faz terapia mas sente que a frequência é baixa.
3. Em público a campanha fala de rotina, agenda e equipe, sem preço. O valor entra no WhatsApp, onde a clínica já responde 1:1.
4. A mecânica comercial é o degrau seguinte: do 6 para o 8, as duas sessões extras custam R$ 160 cada. O plano de 6 funciona como porta de entrada do Laço.
5. Pagamento antes do ciclo, por Pix ou boleto, com agenda liberada na confirmação. Só se comunica depois da integração do gateway.

**Ponto mais fraco (crítico)**

O plano de 6 não tem vantagem de preço que uma família informada consiga enxergar. Contas, todas [FATO] a partir da tabela atual:

| Alternativa para 6 sessões | Valor | Diferença para R$ 1.080 |
|---|---|---|
| 6 sessões avulsas (Encontro, R$ 190) | R$ 1.140 | R$ 60 (5,3%) |
| Primeiro Passo (R$ 720) + 2 avulsas (R$ 380) | R$ 1.100 | R$ 20 (1,8%) |
| Laço (8 sessões) | R$ 1.400 | o plano de 6 custa R$ 320 a menos, por 2 sessões a menos |

Quem calcula percebe que Primeiro Passo mais duas avulsas custa quase o mesmo. O valor real do plano está em coisas que o preço não mostra: horário fixo reservado, uma agenda, um pagamento por mês, equipe que combina as especialidades. **Eu não confirmei que essas regras existem na operação.** Se não existirem, o plano é um nome novo para "4 + 2 avulsas".

Segundo ponto fraco: o preço não foi validado contra margem real. A curva atual dá R$ 180 por sessão aos dois planos menores. Se o custo variável médio por sessão estiver acima de cerca de R$ 120 a R$ 130 [ESTIMATIVA, não tenho o custo], a margem do 6 é fina e a canibalização do Laço dói (seção 3).

Terceiro: a restrição de preço em público (seção 0) tira o argumento mais fácil de comparar e de medir em anúncio.

---

## 2. Personas e momento de decisão

Duas personas. Ambas são **hipóteses**: não vi dado de cadastro, atendimento ou funil da clínica. A primeira validação é perguntar às 10 últimas famílias particulares que contrataram o que as fez decidir.

### Persona A: "Saiu o laudo, e agora?"
- Mãe ou pai, 28 a 45 anos [ESTIMATIVA], filho de 2 a 8 anos com laudo ou suspeita de TEA/TDAH há menos de 12 meses.
- Renda para particular, mas sem limite de cartão para parcelar R$ 1.000 ou mais; paga por Pix ou boleto.
- **Momento de decisão:** (1) escola ou pediatra levanta a suspeita; (2) a espera pela avaliação diagnóstica; (3) o laudo sai e a pergunta vira "o que eu faço na segunda-feira?"; (4) a fila de outro serviço informa prazo de meses. A decisão cai em dias, logo depois do laudo ou da devolutiva da escola. Quer começar rápido, com um responsável claro e sem montar a rotina sozinha entre três especialistas.
- Medo principal: perder tempo. Emoção a tratar: ansiedade, sem alimentar. Tom calmo.

### Persona B: "Faz terapia, mas parece pouco"
- Família com a criança já em atendimento em convênio, rede pública ou outro particular, com frequência de uma sessão por semana ou menos, que sente que a rotina terapêutica "não engrena".
- **Momento de decisão:** retorno de consulta, reunião de escola, feriados e recessos que quebram semanas de terapia, ou fim de ano.
- Cuidado ético: a mensagem fala do que o plano oferece (frequência, equipe combinada), nunca do que o outro serviço deixa de fazer. CFP veda autopromoção em detrimento de outros profissionais (CEPP art. 20, f).
- Pergunta ao dono (seção 9): paciente atendido por convênio na clínica pode contratar o plano como complemento? Isso define se B inclui a própria base.

### Fonte mais barata e certa de clientes (não é persona nova)
Famílias particulares que hoje compram **sessões avulsas em volume de 5 a 7 por mês** ou que compram Primeiro Passo e completam com avulsas. Para elas o plano de 6 é a mesma rotina por menos burocracia, sem custo de aquisição. [HIPÓTESE: preciso do número, seção 9, item 3.]

---

## 3. Posicionamento no catálogo

### Escada de preço [FATO] (cálculo meu sobre a tabela atual)

| Plano | Sessões | Valor | Por sessão | Passo a partir do anterior |
|---|---|---|---|---|
| Encontro | 1 | R$ 190 | R$ 190,00 | |
| Primeiro Passo | 4 | R$ 720 | R$ 180,00 | |
| **NOVO** | **6** | **R$ 1.080** | **R$ 180,00** | **+R$ 360 por 2 (R$ 180 cada)** |
| Laço | 8 | R$ 1.400 | R$ 175,00 | +R$ 320 por 2 (R$ 160 cada) |
| Vínculo | 12 | R$ 1.990 | R$ 165,83 | +R$ 590 por 4 (R$ 147,50 cada) |
| Turma | 16 | R$ 2.580 | R$ 161,25 | +R$ 590 por 4 |
| Abraço | 20 | R$ 3.120 | R$ 156,00 | +R$ 540 por 4 (R$ 135 cada) |
| Voo Livre | 24 | R$ 3.640 | R$ 151,67 | +R$ 520 por 4 (R$ 130 cada) |

Leitura:
- Do Primeiro Passo para o 6 não existe desconto marginal. O 6 não "puxa" quem já está no 4 por preço. Ele captura quem entra novo, quem compra avulsas, e quem hoje está no 4 e precisa de mais por indicação da equipe.
- O degrau 6→8 é o mais barato por sessão adicional da faixa inicial (R$ 160). Isso é o que torna o Laço atraente a quem começou no 6. Esse argumento só entra no WhatsApp.

### Quem o plano deve capturar
1. Famílias novas na faixa de 5 a 7 sessões/mês indicadas após a avaliação.
2. Compradores de avulsa em volume (base atual).
3. Famílias do Primeiro Passo cuja equipe indique mais frequência.

### Quem NÃO deve capturar
1. Criança cuja avaliação indique 8 ou mais sessões. Empurrar o 6 por preço contraria o plano terapêutico e é exatamente o que a cartilha do CRP-MG chama de risco ético em pacotes. **A frequência vem da avaliação, o plano vem depois.**
2. Família que pagaria Laço sem hesitar (canibalização).
3. Família que não consegue pagar R$ 1.080 de uma vez no início do ciclo. Para ela o gargalo é o desembolso, não o nome do plano (decisão pendente D9).

### Canibalização do Laço

Conta: cada família que desce do Laço (R$ 1.400) para o 6 (R$ 1.080) deixa de pagar R$ 320 por mês e libera 2 sessões. **Só não perde dinheiro se as 2 vagas liberadas forem ocupadas por outra criança.** Se o custo variável por sessão for abaixo de R$ 160 (e deve ser, pois o preço cobrado é R$ 175 a R$ 190), a migração reduz margem total sempre que a vaga fica ociosa. [Conta aritmética; o custo real é desconhecido.]

Mitigação:
1. Não apresentar o 6 como alternativa mais barata ao Laço. Apresentar pela indicação da equipe (frequência do plano terapêutico), com o 6 como padrão apenas para quem a avaliação indicar de 5 a 7.
2. Não divulgar o plano de 6 à base atual do Laço. Campanha na base só para avulsas e Primeiro Passo.
3. Redução de frequência só no ciclo seguinte e conversada com a equipe. Aumento a qualquer momento, com diferença proporcional (decisão pendente D4).
4. Medir migração Laço para 6 todo mês (KPI 3) e definir um freio: se o share de Laço entre contratos novos cair mais de 10 pontos percentuais contra a média dos 90 dias anteriores por dois ciclos seguidos, revisar a apresentação e o preço. [ESTIMATIVA do limite.]
5. Mostrar o 6 e o 8 lado a lado no WhatsApp, com a diferença de R$ 320 por duas sessões, para o 8 aparecer como passo natural.

---

## 4. Estrutura do plano (material público não usa a palavra "oferta")

### Nome comercial: três propostas

A família atual: Encontro, Primeiro Passo, Laço, Vínculo, Turma, Abraço, Voo Livre. São substantivos curtos de relação ou movimento, sem número no nome.

| # | Nome | Lógica | Risco |
|---|---|---|---|
| 1 | **Ritmo** | Fica entre "Primeiro Passo" (começar) e "Laço" (vínculo). Seis sessões é a frequência que cria cadência entre uma sessão e outra. Carrega o benefício central (regularidade), uma palavra, combina com Musicoterapia que a clínica já oferece | "No seu ritmo" pode soar como pressa se a copy for mal escrita. Conferir marca no INPI (não consultei) |
| 2 | **Trilha** | Sequência de etapas na mesma direção. Combina com a progressão Primeiro Passo, Trilha, Laço | Comunica caminho, menos regularidade. "Trilha" é nome comum de produto em educação |
| 3 | **Ponte** | Liga a clínica, a família e a escola, e liga o 4 ao 8 | Genérico. Já existe como nome de programas de saúde. Sugere função de transição, o que alimenta a ideia de "plano provisório" |

Descartei "Compasso": em português "compasso de espera" significa estar parado esperando, o oposto do que a família em fila quer ouvir.

**Recomendo Ritmo.** É o único cujo significado é o próprio benefício do plano (a cadência) e funciona sozinho num título, sem explicação. Antes de fixar, registrar consulta de marca no INPI e checar se há plano ou clínica com o mesmo nome em Belém.

No restante do documento uso "Ritmo" como nome de trabalho. Em material público: "plano Ritmo", nunca "pacote Ritmo" (seção 0).

### O que está incluído [FATO onde indicado]
- 6 sessões por mês, de qualquer especialidade, combináveis, como nos demais planos [FATO: chatbot-base-conhecimento.md].
- A avaliação inicial conta como 1 sessão do plano; cada bloco de Treino ABA (3 sessões seguidas) conta como 3 [FATO]. Num primeiro mês com avaliação e um bloco ABA, restam 2 sessões. Isso precisa ser dito na conversa para ninguém se surpreender.
- Distribuição das sessões definida com a equipe com base no Plano Terapêutico Singular, o PTS, que o site já cita [FATO: `planos.html`].
- Acompanhamento pelo Portal da Família [FATO: existe, `/familia`].
- **A confirmar antes de publicar qualquer frase sobre isso (seção 9, item 2):** horário fixo semanal reservado, agenda única para as especialidades, comunicação entre terapeutas.

### Regra de ciclo
- Cobrança antes do ciclo. Cobrança emitida cerca de 5 dias antes, vencimento até o último dia anterior ao início do ciclo. Pix ou boleto **[DEPENDE DA INTEGRAÇÃO DO GATEWAY]**.
- Sem pagamento confirmado, a agenda do ciclo não é liberada (regra já decidida pelo dono). Em linguagem pública: "a agenda do ciclo é liberada com a confirmação do pagamento". Não usar "bloqueio" fora da operação.
- Reativação: Pix libera na hora; boleto leva dias úteis para compensar. Por isso o Pix é o método a promover.
- Definição de ciclo: **decisão pendente D3** (mês-calendário, como hoje "pago no início do mês", ou 30 dias corridos a partir do pagamento). Minha recomendação: 30 dias corridos, pois evita cobrar proporcional a quem entra no dia 18.

### Falta e reposição (proposta, para aprovação)

| Situação | Regra proposta |
|---|---|
| Aviso com 24 h ou mais (regra atual da clínica [FATO]) | Sessão remarcada, não consome. Até 2 remarcações por ciclo, dentro do ciclo, conforme vaga |
| Aviso com menos de 24 h ou ausência sem aviso | Sessão consumida |
| 2 faltas consecutivas sem justificativa | O horário fixo é liberado [FATO: regra atual] |
| Cancelamento pela clínica (terapeuta ausente etc.) | Reposição garantida. Se não houver vaga até 15 dias após o fim do ciclo, vira crédito no ciclo seguinte |
| Doença com atestado | Prazo de reposição estendido por 15 dias após o fim do ciclo |
| Saldo não usado | Não acumula (a vaga ficou reservada), exceto nos casos acima. O Portal mostra o saldo |

Por quê: família que paga adiantado e perde sessão sem entender a regra é o maior gerador de reclamação e cancelamento do modelo. A regra tem que caber em 4 linhas no WhatsApp.

### Ancoragem (só no WhatsApp 1:1)
1. **Por sessão:** R$ 190 avulsa, R$ 180 no Ritmo, R$ 175 no Laço. Diferença real para 6 avulsas: R$ 60 por mês. Dizer o número honesto; inflar a economia queima a conversa quando a família faz a conta.
2. **Por semana:** R$ 1.080 dividido por cerca de 4,3 semanas dá aproximadamente R$ 250 por semana [cálculo arredondado]. Contabilidade mental ajuda quem pensa em orçamento semanal.
3. **Degrau para o 8:** "se a equipe indicar mais frequência, as duas sessões seguintes custam R$ 160 cada".
4. Ordem de apresentação: Primeiro Passo, Ritmo (recomendado pela equipe quando a avaliação indicar 5 a 7), Laço. Três opções, não sete (paradoxo da escolha). Os planos maiores só se a pergunta vier.

### Risco reverso compatível com saúde (sem resultado prometido)
Nenhuma frase de resultado, melhora ou prazo. Os pontos abaixo reduzem risco financeiro e operacional:
1. **Sem fidelidade:** o plano vale por ciclo. Cancela até X dias antes do próximo vencimento (D5).
2. **A avaliação conta como sessão do plano:** a família não paga duas vezes pela porta de entrada.
3. **Reposição de sessão cancelada pela clínica** (tabela acima).
4. **Ajuste de frequência** conforme a equipe indicar, subindo ou descendo no ciclo seguinte.
5. Opcional (decisão D6): nos primeiros 7 dias do primeiro ciclo, a família pode cancelar e recebe de volta as sessões não realizadas. Custa pouco, reduz a barreira do pagamento adiantado, e o Código de Defesa do Consumidor pode já impor algo parecido para contratação feita fora do estabelecimento (art. 49) **[NÃO CONFIRMADO: validar com advogado antes de escrever a regra]**.

Evitar na copy pública as palavras "garantia", "garantido", "satisfação garantida", mesmo para o risco reverso financeiro: a regra da casa barra "garantimos" e "garantia de resultado" no site, e a palavra sugere resultado.

### Urgência ética
Só vale se for verdadeira e verificável:
1. **Vagas de agenda reais:** número de horários fixos abertos para novos planos, por especialidade, atualizado toda semana a partir da agenda. Peça com número só é publicada com o número conferido naquele dia e removida quando acabar.
2. **Prazo operacional real:** "a agenda do ciclo que começa em [data] fecha em [data]" é um fato (o pagamento acontece antes). Não inventar prazo de promoção, não usar contagem regressiva.
3. Nunca usar vagas como pressão sobre a decisão clínica. O tom é informar, não pressionar (CFP veda divulgação sensacionalista, CEPP art. 20, h).

---

## 5. Ganchos e ângulos de mensagem

Ordenados por força esperada **[ESTIMATIVA qualitativa, sem dado de campanha]**. "Canal" mostra onde o gancho pode aparecer: **P** público (Instagram, LP, Google), **W** WhatsApp 1:1. Risco regulatório se refere à restrição de preço e resultado da seção 0.

| # | Gancho | Público | Emoção | Prova possível | Risco | Canal |
|---|---|---|---|---|---|---|
| 1 | **Continuidade semanal:** a terapia que não perde semanas em feriado e recesso | B | Frustração que vira alívio | Regra do plano (reposição, horário fixo) quando confirmada; artigo "Rotina visual em casa" do site | Baixo | P, W |
| 2 | **Uma agenda para as especialidades:** fono, TO e psicologia combinadas num plano só | A e B | Alívio de logística | Regra do plano ("terapias combináveis" [FATO]); PTS do site | Baixo | P, W |
| 3 | **Saiu o laudo, e agora?** Como começar sem montar tudo sozinho | A | Ansiedade, direção | Páginas `/autismo`, `/tdah`, `/direitos` e o mapeamento do site; avaliação inicial | Médio: tom calmo, sem urgência clínica | P, W |
| 4 | **Quem espera vaga em outro serviço** pode começar enquanto isso | A | Espera, impotência | Vagas reais de agenda da clínica | Médio: não citar nem criticar outro serviço; não citar IASEP ou PROASA em peça pública | P, W |
| 5 | **Conveniência de pagamento:** cobrança por Pix ou boleto chegando no WhatsApp antes do ciclo | A | Previsibilidade | Integração do gateway funcionando **[DEPENDE DA INTEGRAÇÃO]** | Baixo no WhatsApp. Médio em público (CFP: foco em vantagem financeira) | W; em P só como linha de fato, sem destaque |
| 6 | **O mesmo dia e horário toda semana:** previsibilidade para a rotina da criança | A e B | Segurança | Horário fixo reservado, quando confirmado | Baixo | P, W |
| 7 | **Como a equipe define a frequência** (carrossel educativo: depende da avaliação) | A e B | Compreensão | PTS, artigo do site; profissional com nome e inscrição | Baixo | P |
| 8 | **A avaliação já conta como uma das sessões do mês** | A | Alívio de custo duplicado | Regra do plano [FATO] | Médio em público (vantagem financeira); baixo no WhatsApp | W; P só no FAQ |
| 9 | **Equipe que conversa entre si e com a família** | A e B | Pertencimento, clareza | Reunião de equipe e devolutiva (**confirmar que existem**), Portal da Família | Baixo | P, W |
| 10 | **Indicação:** "sua escola ou seu pediatra recomendou terapia, veja como começar" | A, via profissional | Orientação | Kit de uma página para o profissional | Médio: nunca pagar comissão; CFM e outros códigos tratam de vantagem por indicação | Kit, W |
| 11 | **O que fazer em casa entre uma sessão e outra** (conteúdo útil) | A e B | Participação | Artigos de `/aprender` | Baixo | P |
| 12 | **Vagas do ciclo** com número real | A | Urgência ética | Agenda verificada no dia | Médio | P e W, só com número conferido |
| 13 | **Volta às aulas:** organizar a rotina terapêutica antes de fevereiro | A e B | Antecipação | Calendário escolar (conferir datas) | Baixo | P |
| 14 | **Valor mensal fechado, sem surpresa por sessão** | A | Previsibilidade | Regra do plano | **Alto em público** (preço como propaganda segundo a cartilha do CRP-MG) | W apenas |

Os ganchos 1, 2 e 6 são a base. Os ganchos 5, 8 e 14 são de conversa, não de anúncio.

---

## 6. Banco de copy

Marcações: **[P]** pode ir a público depois do checklist; **[W]** só em conversa 1:1 (contém preço ou vantagem financeira); **[CONFIRMAR]** depende de regra de operação ainda não verificada. Sem travessão, sem exclamação, sem a palavra "pacote".

### 6.1 Cinco títulos

> 1. Seis sessões por mês, nas terapias que a avaliação indicar. **[P]**

> 2. Ritmo: um plano mensal para a terapia caber na rotina da família. **[P]**

> 3. Fonoaudiologia, terapia ocupacional e psicologia no mesmo plano. **[P] [CONFIRMAR: agenda única]**

> 4. Saiu o laudo? Veja como começar a terapia ainda este mês. **[P] [CONFIRMAR: vaga aberta na data]**

> 5. Terapia com continuidade: o mesmo horário, toda semana. **[P] [CONFIRMAR: horário fixo]**

**Recomendado: o título 1.** É específico (um número e uma condição clínica correta), passa no teste "agora você pode" (agora posso saber exatamente o que o plano é), e não depende de nenhuma regra ainda não confirmada. O título 2 serve na LP, depois do 1.

### 6.2 Cinco subtítulos

> 1. A equipe define na avaliação quais especialidades fazem sentido para a criança e como distribuir as sessões do mês. **[P]**

> 2. Você escolhe a frequência junto com a equipe e acompanha as sessões pelo Portal da Família. **[P]**

> 3. Atendimento em Belém, com fonoaudiologia, terapia ocupacional e psicologia. **[P]**

> 4. A avaliação inicial conta como uma das sessões do mês. **[P, só em FAQ] [W]**

> 5. Plano mensal sem fidelidade, com as sessões distribuídas entre as terapias do plano terapêutico da criança. **[P]**

### 6.3 Três CTAs

> 1. Falar com a equipe no WhatsApp **[P]**

> 2. Agendar a avaliação **[P]**

> 3. Ver como funciona o plano **[P]** (rola até o FAQ da LP)

Mensagem pré-preenchida do botão (uma por canal, serve como etiqueta de origem se a UTM não chegar ao sistema, seção 8):
> Oi! Vim pelo Instagram e quero saber como funciona o plano Ritmo.
> Oi! Vim pelo Google e quero saber como funciona o plano Ritmo.
> Oi! Minha escola indicou e quero saber como funciona o plano Ritmo.

### 6.4 Oito respostas a objeções (canal W; contêm preço)

**1. "Quanto custa?"** **[W]**
> O plano Ritmo tem 6 sessões por mês e custa R$ 1.080. Dá R$ 180 por sessão. Antes de contratar, a equipe faz a avaliação e indica quantas sessões fazem sentido para a sua criança. Se a indicação for diferente de 6, a gente conversa sobre o plano que se encaixa.

**2. "Só 6 sessões não é pouco?"** **[W]**
> Quem define a frequência é a equipe, depois da avaliação. Para algumas crianças 6 por mês é o indicado. Para outras, a equipe indica mais e o plano de 8 sessões é o passo seguinte, a R$ 160 por cada sessão a mais. Você não precisa decidir isso hoje.

**3. "E se eu faltar?"** **[W] [CONFIRMAR: regra aprovada, seção 4]**
> Avisando com 24 horas de antecedência, a sessão é remarcada e não conta como usada, dentro do mesmo ciclo. Se a clínica cancelar, a reposição é nossa. Em caso de doença com atestado, o prazo de reposição é maior. Faltar sem avisar consome a sessão.

**4. "Posso cancelar?"** **[W] [CONFIRMAR: regra aprovada]**
> Pode. O plano não tem fidelidade: cada ciclo é pago antes e vale por aquele ciclo. Para não ser cobrado no seguinte, é só avisar até [X] dias antes do vencimento. Se ainda for o primeiro ciclo, a gente explica as condições de devolução das sessões não realizadas.

**5. "Como eu pago?"** **[W]**
> Versão atual (antes do gateway): o pagamento é combinado com a recepção e aceita as formas já praticadas pela clínica.
> Versão após a integração **[DEPENDE DA INTEGRAÇÃO DO GATEWAY]**: você recebe a cobrança aqui no WhatsApp, por Pix ou boleto, antes do início do ciclo. Com o pagamento confirmado, a agenda do ciclo é liberada. O recibo chega por aqui também.

**6. "Qual a diferença para o Laço?"** **[W]**
> O Laço tem 8 sessões e custa R$ 1.400. O Ritmo tem 6 e custa R$ 1.080. A diferença é de R$ 320 por duas sessões. A equipe indica um ou outro conforme a avaliação, e dá para mudar no ciclo seguinte.

**7. "Precisa de laudo para começar?"** **[W ou P]**
> Não. O laudo ajuda, mas a avaliação inicial mostra o caminho. A avaliação conta como uma das sessões do plano. (Resposta já usada pelo bot, com a regra de que o laudo não é obrigatório [FATO: chatbot-base-conhecimento.md].)

**8. "Posso combinar fono, TO e psicologia? Como conta o Treino ABA?"** **[W]**
> Pode combinar as especialidades indicadas no plano terapêutico, por exemplo 3 de fonoaudiologia e 3 de terapia ocupacional. A avaliação inicial conta como 1 sessão. Cada bloco de Treino ABA, que são 3 sessões seguidas, conta como 3.

---

## 7. Funil e canais

### Funil
Descoberta (Instagram, Google, indicação) → Landing `/lp/ritmo` (noindex, sem menu, botão fixo no celular [FATO: `_LEIA-ME.md`]) → clique no WhatsApp (`whatsapp_click` no GA4 [FATO: `fa-track.js`]) → conversa com o bot → recepção humana → avaliação agendada → avaliação realizada → plano contratado → pago antes do ciclo → renovação.

Regra do projeto aplicada (AGENTS.md, item 3): campanha que reativa um número que já tem `patient_id` ou autorização em andamento não deve abrir um rascunho paralelo de "aguardando guia". Quem já é paciente e quer trocar de plano entra no fluxo de mudança de plano, não no de cadastro novo.

### Canais

**Instagram (orgânico)**
- Reels de 30 a 45 s: tema "como a equipe define a frequência da terapia", "o que fazer em casa entre as sessões" (ganchos 7 e 11). Sem criança identificável: mãos, brinquedos, ambiente, ilustração. Profissional só com autorização, nome e inscrição no conselho na legenda ou no perfil.
- Carrossel de 7 lâminas: "Seis sessões por mês: como a equipe decide a frequência" (hook 7 e 1). Sem preço.
- Stories: enquete "sua rotina de terapia tem semanas sem sessão?" (cuidado com dado: não pedir informação clínica na caixa de perguntas; CFP veda orientação que identifique o sujeito, Res. 03/2007 art. 54).
- Link na bio para `/lp/ritmo?utm_source=instagram&utm_medium=bio`.

**WhatsApp (chatbot existente)**
- Nova intenção "plano de 6 sessões" na base de conhecimento. Hoje a base lista Primeiro Passo até Voo Livre; o 6 precisa entrar em `chatbot-base-conhecimento.md` e no catálogo (`PART-PLANO-*` em `insurer_price_tables`, que `lib/particular-plans-pure.ts` lê, com a observação "6 sessões/mês; terapias combináveis" para o parser `sessionsFromNote`) [FATO sobre o parser, a parte técnica é da equipe de desenvolvimento].
- Primeira resposta do bot pergunta "como nos conheceu?" para fechar a atribuição que a UTM não fecha (seção 8).
- Disparo para a base de avulsas: só para quem consentiu receber mensagens, e só com modelo aprovado pela Meta [NÃO CONFIRMADO: regra de opt-in da clínica e status dos templates; ver `docs/migracao-whatsapp-cloud-api.md`].

**Indicação por profissionais e escolas**
- Kit de uma página (PDF) com: o que é o plano, quando a equipe o indica, como a família agenda a avaliação. Sem preço (a mesma regra), sem foto de criança.
- **Não pagar comissão, brinde ou vantagem por indicação.** Vários códigos de ética de saúde tratam isso como infração; para neuropediatras e pediatras o Código de Ética Médica tem vedações de vantagem por indicação [NÃO CONFIRMADO: não li o artigo, confirmar com o CRM e com o jurídico].
- Para escola: o kit vai à coordenação pedagógica, com apresentação de 15 minutos para a equipe, não envio em massa.

**Google**
- Anúncios de busca para intenção local: "terapia infantil Belém", "fonoaudiólogo infantil Belém", "terapia ocupacional infantil Belém", "clínica para autismo Belém". Destino: `/lp/ritmo`. Texto do anúncio sem preço e sem "pacote".
- Perfil da Empresa no Google: postagem com o tema do plano, sem preço.
- **[NÃO CONFIRMADO]** política de anúncios de saúde do Google Ads para serviços de saúde infantil (não consultei).
- Orgânico: a página `/planos` indexa; atualizar com o novo plano exige revisar o título "Seis pacotes" e os dados estruturados (`planos.json`), `llms.txt` e a FAQ de `clinica.html`, que citam "de 4 a 24 sessões" e "seis planos mensais". Esses arquivos não foram alterados por mim.

### Sequência de 14 dias de lançamento

Antes do dia 1 (portão): a campanha só começa quando os itens 1 a 4 estiverem prontos.
1. Plano cadastrado no sistema, bot atualizado, equipe da recepção treinada na tabela da seção 4.
2. Regras de ciclo, falta e cancelamento aprovadas (D3 a D6).
3. Consulta aos conselhos enviada (seção 10) e resposta sobre o que foi enviado por escrito. Enquanto não respondem, vale a regra mais dura.
4. Número de vagas reais do ciclo definido (seção 9, item 1).

| Dia | Ação | Canal | Observação |
|---|---|---|---|
| 1 | Anúncio interno à recepção e à equipe; mensagem de apresentação do plano ao bot | interno | Ensaio de 5 conversas simuladas |
| 2 | Publicar `/lp/ritmo` (noindex) e testar `whatsapp_click` com UTM de teste | LP | Conferir no GA4 em tempo real |
| 3 | Reel 1: "Como a equipe define a frequência da terapia" (gancho 7) | Instagram | Sem preço |
| 4 | Stories: enquete de rotina (gancho 1); link para a LP | Instagram | |
| 5 | Mensagem a famílias da base que compram avulsas em volume, só as que consentiram | WhatsApp | Tabela W: apresentar o Ritmo como organização, não desconto |
| 6 | Carrossel: "Seis sessões por mês: para quem faz sentido" (ganchos 1, 2 e 6) | Instagram | Revisão do profissional com inscrição |
| 7 | Ligar o anúncio de busca com orçamento mínimo; ligar o anúncio de Instagram para o gancho 3 | Google, Instagram | Duas variantes de título (teste T1) |
| 8 | Revisão da semana: conversas iniciadas, avaliações agendadas, objeções reais | interno | Ajuste das 8 respostas com o que as famílias perguntaram |
| 9 | Kit de indicação a 3 profissionais parceiros e 1 escola, em conversa | Indicação | Sem vantagem em troca |
| 10 | Reel 2: "O que fazer em casa entre uma sessão e outra" (gancho 11) | Instagram | |
| 11 | Story ou post com número real de vagas do ciclo (gancho 12), se o número estiver conferido | Instagram | Remover quando acabar |
| 12 | Segunda variante do WhatsApp: ordem de apresentação dos planos (teste T2) | WhatsApp | |
| 13 | Segundo disparo na base só para quem não respondeu e consentiu | WhatsApp | Um único lembrete, nunca dois |
| 14 | Retrospectiva com a tabela de KPIs da seção 8; decidir manter, pausar ou ajustar | interno | Registrar o que foi decidido |

### Testes A/B priorizados

Aviso: o volume de uma clínica local é baixo. Quase nenhum teste de página atinge significância estatística em 14 dias. Por isso os critérios abaixo são **direcionais e fixados antes**: tamanho mínimo, duração mínima e guarda contra efeito colateral. Teste de preço público não existe (seção 0).

| # | Hipótese | Métrica | Critério de decisão | Mínimo para decidir |
|---|---|---|---|---|
| T1 | O gancho "continuidade/rotina" gera conversa mais barata que "saiu o laudo" (criativos de Instagram e títulos de anúncio de busca) | Custo por clique no WhatsApp; % de conversas que viram avaliação agendada | Fica a variante com ao menos 30% menos custo por avaliação agendada. Se a diferença for menor, manter as duas, em públicos diferentes | 25 cliques por variante e 7 dias |
| T2 | Apresentar Ritmo como padrão indicado (3 opções) rende mais por conversa que apresentar os planos em ordem crescente | Receita do primeiro ciclo por conversa qualificada; share de Laço entre contratos novos (freio) | Vence a que gerar mais receita por conversa, e só se o share de Laço não cair mais de 10 pontos. **Decidir por receita, nunca só pelo share do Ritmo** | 20 conversas por variante, alternando por dia |
| T3 | O título "Seis sessões por mês, nas terapias que a avaliação indicar" gera mais cliques no WhatsApp que "Saiu o laudo? Veja como começar..." | `whatsapp_click` por sessão da LP | Vence a que tiver 20% a mais de cliques por sessão, com ao menos 200 sessões por variante. Sem volume, decidir por critério editorial | 200 sessões por variante |
| T4 | "Agendar a avaliação" gera mais avaliações agendadas por clique que "Falar com a equipe no WhatsApp" | Avaliações agendadas por clique | Vence a que tiver 15% mais agendamentos por clique, com 30 cliques por variante | 30 cliques por variante |
| T5 | **[Só depois do gateway]** Mencionar "Pix ou boleto" na primeira resposta aumenta o pagamento até o vencimento | % de ciclos pagos até o último dia anterior ao início | Manter a variante com 10 pontos percentuais a mais, com 15 contratos por variante | 15 contratos por variante |

---

## 8. KPIs com comparativo obrigatório e medição

Regra do projeto: todo KPI tem comparativo (AGENTS.md, item 1). Cada linha traz meta e referência. **Nada do que está em "meta" foi calibrado com dados da clínica** [ESTIMATIVA]: a primeira tarefa é levantar a linha de base dos 90 dias anteriores ao lançamento, e as metas abaixo valem só até lá. A tabela se lê assim: "meta, em comparação com a referência".

| # | KPI | Fórmula | Meta inicial [ESTIMATIVA] | Referência (comparativo) |
|---|---|---|---|---|
| 1 | Contratos novos do plano | Nº de contratos Ritmo novos no mês | 8 nos 60 primeiros dias | Mês anterior; e contratos novos de Primeiro Passo no mesmo período |
| 2 | Mix de entrada dos novos particulares | % de novos particulares em Primeiro Passo, Ritmo, Laço, outros | Ritmo entre 25% e 35% dos novos | Mix dos 90 dias anteriores ao lançamento |
| 3 | **Canibalização do Laço** | Nº de trocas de Laço para Ritmo no mês e share de Laço entre contratos novos | Trocas Laço para Ritmo abaixo de 10% da base Laço em 90 dias | Trocas de Laço para Primeiro Passo no mês anterior; share de Laço dos 90 dias anteriores |
| 4 | Degrau 6 para 8 | % dos contratos Ritmo que sobem para Laço em até 90 dias | 15% a 20% | Taxa histórica de passagem de Primeiro Passo para Laço |
| 5 | Renovação do ciclo 2 | % de contratos Ritmo pagos para o segundo ciclo | 80% ou mais | Renovação dos planos particulares existentes no mesmo mês |
| 6 | Pagamento até o vencimento | % de ciclos pagos até o último dia anterior ao início (**depende do gateway**) | 90% ou mais | Mesmo indicador do mês anterior; antes do gateway, % de pagamentos recebidos até o dia 1º |
| 7 | Agenda liberada só após pagamento | Nº de ciclos com agenda retida por falta de pagamento e tempo médio até regularizar | Menos ciclos retidos que no mês anterior; regularização em até 3 dias úteis | Mês anterior |
| 8 | Utilização do plano | Sessões realizadas ÷ 6, por contrato | 90% ou mais | Utilização de Primeiro Passo e Laço no mesmo mês |
| 9 | Conversão do funil | Cliques no WhatsApp → conversas qualificadas → avaliações agendadas → avaliações realizadas → contratos, por canal | Metas por etapa definidas após 14 dias de dado | Mesma etapa na semana anterior; e o mesmo canal antes da campanha |
| 10 | Custo de aquisição e retorno no primeiro ciclo | Gasto de mídia e horas do tempo de recepção ÷ contratos novos; receita do primeiro ciclo ÷ custo | Receita do primeiro ciclo cobre o custo de aquisição | Mês anterior; e o custo por contrato de Primeiro Passo |
| 11 | Ocupação das vagas abertas para o plano | Horários fixos preenchidos ÷ horários abertos por especialidade | Preencher 50% das vagas abertas em 30 dias | Ocupação da agenda no mês anterior |
| 12 | Reclamações sobre regra de falta, reposição ou cobrança | Nº de reclamações registradas na recepção ou no WhatsApp | Menos que 1 a cada 10 contratos | Mês anterior; contratos dos outros planos |

Margem por plano não aparece como KPI porque não tenho o custo por sessão. É o indicador mais importante que falta (seção 9, item 1).

### UTMs (formato `/lp/<slug>?utm_source=...`)

O `fa-track.js` guarda a primeira e a última origem num cookie do domínio raiz e dispara `whatsapp_click` com a origem no GA4 [FATO: lido no arquivo]. Os links internos do site não levam UTM; só anúncio e link externo levam.

Padrão:
| Parâmetro | Valores | Exemplo |
|---|---|---|
| `utm_source` | `instagram`, `google`, `indicacao`, `whatsapp_base` | `instagram` |
| `utm_medium` | `organico`, `reel`, `story`, `carrossel`, `bio`, `cpc`, `profissional`, `escola`, `base` | `reel` |
| `utm_campaign` | `ritmo-2026-11` | `ritmo-2026-11` |
| `utm_content` | gancho e variante: `g01-v1`, `g03-v2` | `g01-v1` |
| `utm_term` | só em busca paga: palavra-chave | `terapia-infantil-belem` |

Exemplos prontos:
- `/lp/ritmo?utm_source=instagram&utm_medium=reel&utm_campaign=ritmo-2026-11&utm_content=g07-v1`
- `/lp/ritmo?utm_source=google&utm_medium=cpc&utm_campaign=ritmo-2026-11&utm_content=g01-v1&utm_term=terapia-infantil-belem`
- `/lp/ritmo?utm_source=indicacao&utm_medium=profissional&utm_campaign=ritmo-2026-11&utm_content=kit-v1`

Sem dado pessoal na UTM e sem identificar o profissional que indica (isso viraria rastreio de comissão, que não recomendo).

**Lacuna que não consegui verificar:** o `fa-track.js` mede o clique no GA4. Não vi se a origem chega ao cadastro da família, ao rascunho de WhatsApp ou ao contrato no sistema da clínica. Sem isso, o KPI 9 só chega até o clique, e o KPI 10 não separa canal por contrato. Fallback: a mensagem pré-preenchida por canal (seção 6.3) e a pergunta "como nos conheceu?" do bot, registradas no cadastro.

---

## 9. Informações que preciso do dono (máximo de 8) e decisões pendentes

### Informações

1. **Custo variável médio por sessão** (por especialidade) e **quantos horários fixos livres** a agenda tem hoje para famílias novas, por especialidade. Sem isso não valido margem nem o número de vagas da urgência.
2. **O que o plano inclui na operação:** horário fixo semanal reservado? Agenda única entre as especialidades? Reunião de equipe e devolutiva periódica? Cada frase de copy que aparece como [CONFIRMAR] depende disso.
3. **Base atual:** quantas famílias particulares por plano; quantas compram avulsa em volume (5 ou mais por mês); quantas estão no Laço. Dimensiona a canibalização e a fonte sem custo.
4. **Gateway:** qual foi escolhido, previsão de integração, se oferece Pix Automático nesse gateway e se a liberação da agenda por pagamento será automática ou manual.
5. **Falta, cancelamento e reembolso:** aprovar ou ajustar a proposta da seção 4, incluindo prazo de aviso para não renovar e a regra do primeiro ciclo.
6. **Conselhos e registro:** quais profissionais e responsáveis técnicos aparecem nas peças, com qual inscrição, e se a pessoa jurídica tem registro em CRP, conselho de fonoaudiologia ou CREFITO. Define o texto obrigatório de cada peça.
7. **Convênio:** paciente da clínica atendido por convênio pode contratar o Ritmo como complemento? Isso define o tamanho da persona B.
8. **Orçamento mensal de mídia paga** e quem produz as peças (e se há autorização dos profissionais para aparecer).

### Decisões pendentes

| # | Decisão | Minha recomendação |
|---|---|---|
| D1 | Nome comercial | Ritmo, após consulta de marca |
| D2 | Validar preço contra margem real antes de divulgar | Fazer a conta com o custo da pergunta 1 antes de qualquer investimento em mídia |
| D3 | Ciclo: mês-calendário ou 30 dias corridos | 30 dias corridos |
| D4 | Redução de frequência permitida só no ciclo seguinte, aumento a qualquer momento | Sim (freia canibalização, mantém flexibilidade) |
| D5 | Aviso mínimo para não renovar | 5 dias antes do vencimento |
| D6 | Devolução das sessões não realizadas nos 7 primeiros dias | Decidir com o advogado (CDC, art. 49) |
| D7 | Tolerância para o pagamento depois do vencimento | Sem tolerância para liberar a agenda; Pix libera na hora |
| D8 | Preço permanece só em canal privado, mesmo se os conselhos responderem que é possível | Sim. A política é segura e coerente com a página `/planos` de hoje |
| D9 | Desembolso único de R$ 1.080 para famílias sem limite de cartão: aceitar ou criar divisão em duas cobranças por Pix | Aceitar no lançamento e medir desistência no momento do pagamento; reavaliar com dado |
| D10 | Data de início do primeiro ciclo | Definir depois do portão (seção 7). Dezembro tem recessos que reduzem uso; janeiro e fevereiro (volta às aulas) tendem a ser melhores [ESTIMATIVA] |
| D11 | Comissão ou vantagem para quem indica | Não oferecer |
| D12 | Revisar "Pacotes" no site (`/planos`, `clinica.html`, `llms.txt`) à luz da cartilha do CRP-MG | Sim, junto com a consulta aos conselhos |

---

## 10. Checklist de conformidade publicitária

### Para toda peça pública
- [ ] Sem preço, valor, desconto, sorteio, cupom, gratuidade ou parcelamento (CFFa, art. 37, I; CEPP, art. 20, d).
- [ ] Sem foco em vantagem financeira, mesmo sem número (interpretação da cartilha do CRP-MG).
- [ ] Sem a palavra "pacote". Usar "plano".
- [ ] Sem previsão de resultado, melhora, prazo ou "garantia" (CEPP art. 20, e; CFFa; regra da casa). Sem "cura".
- [ ] Sem as palavras da marca: festa, aniversário, promessa (mesmo em negação), confiança, oferta. O schema das landings recusa essas palavras no build.
- [ ] Sem "melhor clínica", "referência em", "a melhor".
- [ ] Sem depoimento, agradecimento ou imagem de paciente. Sem criança identificável. Sem caso clínico.
- [ ] Sem crítica a outro serviço, convênio ou profissional (CEPP art. 20, f). Sem citar IASEP ou PROASA em peça pública.
- [ ] Profissional que aparece: nome, profissão e número de inscrição no conselho (CFFa art. 36, I; Res. CFP 03/2007, art. 53). Autorização formal por escrito para a imagem (CFFa art. 39, IV).
- [ ] Sem urgência clínica ou alarme (CEPP art. 20, h; tom calmo).
- [ ] Vaga mencionada só se for verdadeira e conferida no dia.
- [ ] Pagamento por Pix ou boleto mencionado só depois da integração, e sem "sem juros", "desconto no Pix" ou "sem limite de cartão".
- [ ] Revisão por um profissional com inscrição antes de publicar. Registro do que foi publicado e da data.

### Por peça (itens além dos gerais)

| Peça | Verificações específicas |
|---|---|
| Reel | Sem criança no vídeo. Legenda com nome e inscrição de quem aparece. Música com licença. Sem texto na tela com preço |
| Carrossel | Cada lâmina passa pelo checklist. Fonte citada quando houver afirmação sobre desenvolvimento. Sem diagnóstico por sinal isolado |
| Story e caixa de perguntas | Não responder caso individual nem dar orientação clínica a quem pergunta (CFP Res. 03/2007, art. 54). Resposta convida a uma avaliação |
| Landing `/lp/ritmo` | Sem preço. CNPJ, endereço e política de privacidade no rodapé [FATO]. Sem foto de criança identificável. FAQ passa pelas proibições da marca. Rodar `npm run build && npm run check` |
| Anúncio de busca | Sem preço nem "pacote" no texto e nas extensões. Consultar a política de saúde do Google Ads [NÃO CONFIRMADO] |
| Mensagem 1:1 no WhatsApp | Preço só a quem pergunta ou depois da avaliação. Consentimento de contato. Sem promessa de resultado. Registro do que foi enviado |
| Disparo para a base | Consentimento para receber mensagens, modelo aprovado, sem preço no texto do disparo, opção de sair |
| Kit de indicação | Sem preço, sem foto de criança, sem vantagem ao profissional, texto revisado por um profissional com inscrição |
| Perfil da Empresa no Google | Sem preço no texto e no catálogo de serviços; fotos de ambiente sem pessoas |
| Página `/planos` atualizada | Revisar a palavra "pacote" e o "3x sem juros" do texto alternativo das imagens; atualizar JSON-LD, `llms.txt` e a FAQ de `clinica.html` |

### Pontos a confirmar com cada conselho (enviar por escrito e guardar a resposta)

**CFP / CRP da jurisdição (Pará)**
1. A restrição de "preço como propaganda" alcança a divulgação do plano por clínica (pessoa jurídica) sem citar valor?
2. Mencionar "plano mensal" ou "frequência de 6 sessões" configura foco em vantagem financeira?
3. É válido informar o valor em conversa 1:1 e em contrato, antes do início? (A cartilha do CRP-MG indica que sim.)
4. Um plano de sessões mensais pode configurar "prolongamento desnecessário"? Que salvaguardas o conselho espera (frequência definida na avaliação, sem fidelidade)?

**CFFa / conselho regional de fonoaudiologia (CREFONO ou CRFa)**
1. Responder o preço no WhatsApp a quem pergunta é "anunciar preços" (art. 37, I)?
2. Mencionar "plano mensal de 6 sessões" sem valor é permitido?
3. Mencionar forma de pagamento (Pix, boleto) sem valor é permitido?
4. O que o conselho exige da pessoa jurídica além do profissional individual?

**COFFITO / CREFITO da jurisdição**
1. Texto vigente sobre divulgação de valores, planos e promoções para terapia ocupacional (não consegui abrir).
2. Se a Res. 532/2021 limita imagens, textos e áudio de procedimentos em peças institucionais.
3. Obrigações de identificação do profissional em peça institucional.

**CFM / CRM (só se houver médicos no corpo clínico ou como indicadores)**
1. Forma correta de relacionamento com médicos que indicam a clínica, sem vantagem pela indicação.
2. Se alguma peça da clínica envolve um médico, aplicar a Res. 2.336/2023.

Esta lista é checagem de risco, não parecer jurídico. A decisão final sobre publicar o que está acima é do responsável técnico e do advogado da clínica.

---

## Apêndice: rascunho da landing `src/content/campanhas/ritmo.json`

Rascunho para colar quando as pendências fecharem. **Não foi criado como arquivo.** Conferido contra a lista de palavras barradas pelo schema; a imagem é opcional e foi omitida; precisa passar por `npm run build && npm run check`. `encerraEm` é a data do fim da campanha: ajustar.

```json
{
  "titulo": "Seis sessões por mês, nas terapias que a avaliação indicar",
  "subtitulo": "Plano Ritmo: fonoaudiologia, terapia ocupacional e psicologia combinadas, com acompanhamento pelo Portal da Família.",
  "descricao": "Plano mensal de 6 sessões de terapia infantil em Belém, com as especialidades indicadas na avaliação. Valores pelo WhatsApp.",
  "unidade": "clinica",
  "beneficios": [
    { "titulo": "Frequência definida pela equipe", "texto": "A avaliação indica quais especialidades fazem sentido e como distribuir as sessões do mês." },
    { "titulo": "Especialidades combináveis", "texto": "Por exemplo, 3 sessões de fonoaudiologia e 3 de terapia ocupacional, conforme o plano terapêutico." },
    { "titulo": "Acompanhamento pelo Portal da Família", "texto": "Você vê as sessões e conversa com a equipe no mesmo lugar." }
  ],
  "faq": [
    { "q": "A avaliação conta como sessão?", "a": "Sim. A avaliação inicial conta como uma das sessões do plano." },
    { "q": "Preciso de laudo para começar?", "a": "Não. O laudo ajuda, mas a avaliação inicial mostra o caminho." },
    { "q": "Os valores estão aqui?", "a": "Os valores são passados pela equipe, no WhatsApp, junto com a indicação de frequência." }
  ],
  "cta": { "rotulo": "Falar com a equipe no WhatsApp", "tipo": "whatsapp", "mensagem": "Oi! Vim pela campanha e quero saber como funciona o plano Ritmo." },
  "encerraEm": "2027-02-28"
}
```
