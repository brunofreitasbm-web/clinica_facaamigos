# MODELO EM STAND-BY — NÃO USAR SEM REVISÃO DE ADVOGADO

> Modelo de trabalho. Os trechos `{{assim}}` são variáveis preenchidas pelo sistema (ver `mapa-campos-sistema.md`). Trechos `[PREENCHER]` e `[CONFIRMAR COM ADVOGADO]` ficam pendentes. Os comentários internos (`<!-- ... -->`) são notas para o advogado e o gestor e devem ser removidos da versão final entregue à família.

# CONTRATO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS TERAPÊUTICOS — PACOTE MENSAL

**Contrato nº {{contrato_numero}}**

## Quadro-resumo

| Item | Combinado |
|---|---|
| Plano | {{plano_nome}} |
| Sessões por ciclo mensal | {{sessoes_mes}} sessões |
| Valor do ciclo | R$ {{valor_mensal}} ({{valor_mensal_extenso}}) |
| Pagamento | Antecipado, até o dia {{dia_vencimento}} de cada mês |
| Início do ciclo mensal | Dia {{dia_inicio_ciclo}} de cada mês |
| Duração de cada sessão | {{duracao_sessao_min}} minutos (bloco de Treino ABA: 3 sessões seguidas) |
| Aviso para faltar ou remarcar | Mínimo de {{aviso_falta_horas}} horas |
| Aviso para encerrar o contrato | {{aviso_rescisao_dias}} dias |
| Início da vigência | {{data_inicio}} |

<!-- NOTA INTERNA — nome comercial do plano ("Passo Firme") é provisório e parametrizado em {{plano_nome}}. Atenção: a base do chatbot ainda lista "Primeiro Passo" como o plano de 4 sessões a R$ 720; resolver o conflito de nomes antes de publicar. -->

## 1. Das partes

**1.1. CONTRATADA:** {{clinica_razao_social}}, nome de fantasia FaçaAmigos – Centro de Terapia Comportamental, inscrita no CNPJ sob o nº {{clinica_cnpj}}, com sede e atendimento na {{clinica_endereco}}, representada por {{clinica_representante_nome}}, {{clinica_representante_qualificacao}} [PREENCHER], e-mail institutofacaamigos@gmail.com, WhatsApp {{clinica_whatsapp}}.

**1.2. CONTRATANTE:** {{responsavel_nome}}, {{responsavel_nacionalidade_estado_civil}} [PREENCHER], portador(a) do RG nº {{responsavel_rg}} e do CPF nº {{responsavel_cpf}}, residente em {{responsavel_endereco}}, telefone {{responsavel_telefone}}, e-mail {{responsavel_email}}, na qualidade de {{responsavel_parentesco}} e responsável legal do paciente indicado abaixo.

**1.3. PACIENTE:** {{paciente_nome}}, nascido(a) em {{paciente_nascimento}}, menor de idade, que receberá os atendimentos. O CONTRATANTE declara ter poderes para contratar em nome do paciente e responder pelo pagamento.

**1.4.** Se houver mais de um responsável legal (por exemplo, pais separados), o CONTRATANTE declara que a contratação é do conhecimento do outro responsável, sem oposição, e que informará a CONTRATADA caso haja decisão judicial ou acordo que limite quem pode decidir sobre o tratamento. [CONFIRMAR COM ADVOGADO]

## 2. Do objeto

**2.1.** A CONTRATADA prestará ao paciente sessões terapêuticas individuais, em suas instalações, nas especialidades disponíveis na clínica e indicadas pela equipe no Plano Terapêutico Singular (PTS), dentro do pacote descrito neste contrato.

**2.2.** Este contrato é de atendimento particular, sem intermediação de plano de saúde. A CONTRATADA não é operadora de plano de saúde.

**2.3.** As sessões são agendadas conforme a disponibilidade de agenda da clínica e dos profissionais, combinada com a família. A CONTRATADA pode substituir o profissional responsável por outro com a mesma qualificação, avisando a família.

<!-- NOTA INTERNA — a base do chatbot mostra perfis de "estagiário" na equipe. Se houver atendimento por estagiário supervisionado, informar isto aqui de forma expressa. [CONFIRMAR COM ADVOGADO] -->

## 3. Da composição do pacote

**3.1.** O pacote dá direito a **{{sessoes_mes}} sessões por ciclo mensal**, de **qualquer especialidade** oferecida pela clínica, que a família pode **combinar** (exemplo: 3 de Fonoaudiologia e 3 de Terapia Ocupacional), conforme a indicação da equipe.

**3.2.** Contagem das sessões dentro do pacote:

- a **avaliação inicial** conta como **1 sessão**;
- cada **bloco de Treino ABA** (3 sessões seguidas de 40 minutos, 120 minutos no total) conta como **3 sessões**;
- cada uma das demais sessões conta como **1 sessão**.

**3.3.** Cada ciclo mensal tem direito apenas às sessões do próprio ciclo. **As sessões não usadas não se acumulam para o ciclo seguinte**, ressalvada a reposição prevista na cláusula 8.

**3.4.** A avaliação neuropsicológica e outros serviços que a clínica indicar como fora do pacote são contratados e cobrados à parte, com valor informado antes da contratação.

**3.5.** Sessões além do número do pacote só são feitas se a família aceitar, antes, o valor da sessão avulsa vigente.

<!-- NOTA INTERNA — valor de referência por sessão ({{valor_sessao_ref}}) é apenas informativo (valor do ciclo ÷ sessões) e não é cobrado por sessão. Confirmar com o dono se o Treino ABA em bloco único de 3 sessões é a única forma de contratar ABA. -->

## 4. Do valor e da forma de pagamento

**4.1.** O valor de cada ciclo mensal é de **R$ {{valor_mensal}} ({{valor_mensal_extenso}})**, que cobre todas as sessões do pacote, sem diferença de preço entre as especialidades.

**4.2.** O pagamento é feito **por Pix, boleto ou outro meio de pagamento indicado pela CONTRATADA**. A CONTRATADA informará à família, antes do vencimento, o meio e os dados para pagamento de cada ciclo.

**4.3.** A CONTRATADA emitirá recibo de cada pagamento, enviado ao CONTRATANTE por WhatsApp ou e-mail. [CONFIRMAR COM ADVOGADO/CONTADOR se também é obrigatória nota fiscal de serviço.]

**4.4.** O valor do ciclo é único. Ele não muda se o paciente usar menos sessões do que o pacote permite, salvo o que está previsto na cláusula 8.

<!-- NOTA INTERNA — a base do chatbot informa "parcelamento em até 3x no cartão". Este modelo prevê só Pix/boleto, conforme decisão do dono. Definir se o cartão fica fora do contrato e atualizar o chatbot. -->

## 5. Do ciclo mensal e do vencimento antecipado

**5.1.** Cada ciclo mensal começa no dia {{dia_inicio_ciclo}} e termina no dia anterior ao início do ciclo seguinte.

**5.2.** O pagamento deve ser feito **antes do início do ciclo**, até o dia {{dia_vencimento}} de cada mês. O pagamento antecipado é condição para que as sessões do ciclo fiquem reservadas na agenda.

**5.3.** No primeiro ciclo, que pode começar no meio do mês, o valor e o número de sessões são {{regra_primeiro_ciclo}} [PREENCHER: integral ou proporcional aos dias restantes].

## 6. Da inadimplência

**6.1.** Se o pagamento não for feito até o vencimento, o valor devido será acrescido de:

- **multa moratória de {{multa_mora_pct}}% (dois por cento)** sobre o valor em atraso;
- **juros de mora de {{juros_mora_pct_am}}% (um por cento) ao mês**, calculados por dia de atraso, sem capitalização;
- correção monetária pelo índice previsto na cláusula 10, se o atraso passar de 30 dias.

[CONFIRMAR COM ADVOGADO — limites: multa de até 2% (CDC, art. 52, § 1º) e juros de até 1% ao mês.]

**6.2.** A cobrança será feita de forma respeitosa, por mensagem ou ligação em horário comercial, sem exposição da dívida a terceiros.

**6.3.** Se o atraso passar de {{dias_atraso_rescisao}} dias, a CONTRATADA poderá encerrar o contrato, sem prejuízo da cobrança do que estiver em aberto. [CONFIRMAR COM ADVOGADO]

## 7. Da suspensão da agenda por falta de pagamento

**7.1.** Sem a confirmação do pagamento do ciclo, **a agenda daquele ciclo fica bloqueada**: as sessões não são confirmadas e podem ser oferecidas a outras famílias.

**7.2.** Confirmado o pagamento, a CONTRATADA reabre a agenda conforme a disponibilidade existente. Não há garantia de que o mesmo dia e horário fixos continuem livres.

**7.3.** O bloqueio da agenda não cancela a dívida do ciclo já vencido e não impede a CONTRATADA de fornecer ao responsável, se pedido, relatório e informações necessárias para a continuidade do cuidado em outro serviço.

<!-- NOTA INTERNA — risco: bloqueio de atendimento contínuo de criança por atraso. Advogado deve avaliar a redação, e o dono deve decidir se haverá tolerância de poucos dias antes do bloqueio. -->

## 8. Das faltas, da reposição e do cancelamento de sessão

**8.1. Aviso prévio.** Para remarcar ou cancelar uma sessão, a família deve avisar a recepção com no mínimo **{{aviso_falta_horas}} horas** de antecedência, por WhatsApp ou pelo portal da família.

<!-- SUGESTÃO — aviso de 24 horas é o que o chatbot e a política atual da clínica já informam. 48 horas dá mais folga para reaproveitar o horário, mas é mais rígido para a família. Decisão do dono. -->

**8.2. Falta justificada com aviso.** Avisada dentro do prazo da cláusula 8.1, a sessão é **reposta**, sem custo adicional, dentro do mesmo ciclo ou, se o ciclo terminar antes, em até **{{prazo_reposicao_dias}} dias** após o fim dele, conforme horários disponíveis. A reposição é o reagendamento da mesma sessão e não gera crédito acumulável.

**8.3. Falta sem aviso ou fora do prazo.** A sessão é considerada realizada e consumida do pacote, sem reposição. Excepcionalmente, a CONTRATADA pode repor a sessão por doença súbita do paciente comprovada ou outro motivo de força maior, a critério da equipe.

**8.4.** Duas faltas consecutivas sem justificativa liberam o horário fixo do paciente, que volta a ser agendado conforme a disponibilidade.

**8.5. Bloco de Treino ABA.** A falta ou o cancelamento do bloco segue as mesmas regras, valendo pelas 3 sessões do bloco.

**8.6. Cancelamento pela CONTRATADA.** Se a CONTRATADA cancelar uma sessão (ausência do profissional, problema na clínica ou outro motivo seu), ela será reposta sem custo. Se não for possível repor no prazo da cláusula 8.2, o valor proporcional da sessão será devolvido ou abatido do ciclo seguinte, à escolha do CONTRATANTE.

**8.7. Atrasos.** Se o paciente chegar atrasado, a sessão termina no horário previsto, para não prejudicar os atendimentos seguintes.

<!-- NOTA INTERNA — a regra de reposição (8.2) é proposta nova; ela suaviza o fato de as sessões não acumularem. Sem ela, o risco de a cláusula ser vista como abusiva (CDC, art. 51) aumenta. [CONFIRMAR COM ADVOGADO] -->

## 9. Da vigência e da rescisão

**9.1.** O contrato vale a partir de {{data_inicio}} e se renova **automaticamente a cada ciclo mensal**, por prazo indeterminado, enquanto o pagamento de cada ciclo for feito.

**9.2.** O CONTRATANTE pode encerrar o contrato **a qualquer momento, sem multa**, avisando por escrito (WhatsApp, e-mail ou portal) com **{{aviso_rescisao_dias}} dias** de antecedência. O ciclo já pago e em andamento pode ser usado até o fim.

**9.3.** A CONTRATADA também pode encerrar o contrato, sem multa, com o mesmo aviso, garantindo as sessões do ciclo já pago e, se pedido, o relatório necessário para a continuidade do cuidado em outro serviço.

**9.4.** O encerramento não apaga valores vencidos e não pagos.

**9.5. Direito de arrependimento.** Se o contrato for fechado de forma remota (por WhatsApp, telefone ou internet), o CONTRATANTE pode desistir em até 7 dias da assinatura, com devolução do que pagou, descontadas as sessões já realizadas. [CONFIRMAR COM ADVOGADO — CDC, art. 49.]

<!-- ALTERNATIVA COM FIDELIDADE (desativada por padrão; só usar com decisão expressa do dono e validação do advogado):
**9.2-A.** O contrato tem fidelidade mínima de {{fidelidade_meses}} meses, com {{beneficio_fidelidade}} em troca. A rescisão antes do prazo gera multa de {{multa_fidelidade}}, proporcional ao tempo que falta, nunca superior ao benefício recebido.
Risco: multa por saída antecipada em serviço de saúde para criança costuma ser questionada como abusiva. O modelo sem fidelidade é o mais seguro. -->

## 10. Do reajuste

**10.1.** O valor do ciclo poderá ser reajustado **uma vez a cada 12 meses**, no mês de {{mes_reajuste}} ou na data de aniversário do contrato, pela variação acumulada do **{{indice_reajuste}}** (sugestão: IPCA/IBGE) nos 12 meses anteriores. [CONFIRMAR COM ADVOGADO]

**10.2.** A CONTRATADA avisará o novo valor com pelo menos 30 dias de antecedência. Se a família não concordar, pode encerrar o contrato conforme a cláusula 9.2, mantendo o valor antigo até o fim do prazo de aviso.

**10.3.** Mudanças no pacote ou no valor, fora do reajuste anual, só valem com concordância do CONTRATANTE.

## 11. Da natureza do serviço

**11.1.** A obrigação da CONTRATADA é de **meio**, não de resultado. A CONTRATADA se compromete a aplicar, com cuidado e técnica, os recursos terapêuticos adequados ao caso, conforme as normas éticas de cada profissão.

**11.2.** **A CONTRATADA não promete nem garante qualquer resultado clínico**, como cura, prazo de melhora, aquisição de habilidades, alta ou desempenho escolar. A evolução depende de muitos fatores, entre eles a participação da família e as características de cada criança.

**11.3.** As sessões não substituem consulta médica, diagnóstico ou acompanhamento de outros profissionais. O diagnóstico é feito por profissional habilitado para isso, quando for o caso.

**11.4.** A equipe orientará a família sobre objetivos, frequência e evolução no PTS e nas devolutivas. A família se compromete a participar das orientações e a seguir as combinações feitas com a equipe.

## 12. Dos compromissos da família

**12.1.** O CONTRATANTE se compromete a: manter seus dados e os do paciente atualizados; informar à equipe condições de saúde, medicamentos e mudanças relevantes; chegar no horário; avisar sobre doenças contagiosas, para proteger as demais crianças; e acompanhar a criança conforme combinado.

**12.2.** A criança deve estar acompanhada de um adulto responsável nas dependências da clínica, salvo combinação diferente por escrito.

## 13. Do sigilo e da proteção de dados pessoais (LGPD)

**13.1. Dados tratados.** Para prestar o serviço, a CONTRATADA trata dados pessoais do responsável (identificação, contato, financeiro) e dados pessoais **sensíveis de saúde** do paciente, que é criança (histórico, avaliações, laudos, evolução, prontuário).

**13.2. Finalidades.** Os dados são usados para: avaliar e acompanhar o paciente; montar e revisar o PTS; manter o prontuário; agendar, cobrar e emitir recibos; cumprir obrigações legais e éticas; e comunicar-se com a família.

**13.3. Base legal.** O tratamento dos dados da criança se baseia no **consentimento específico e em destaque de pelo menos um dos pais ou responsável legal** (LGPD, art. 14, § 1º), dado no **Anexo I**, e nas hipóteses para dados de saúde previstas no art. 11 da LGPD, entre elas a tutela da saúde em procedimento realizado por profissionais de saúde. [CONFIRMAR COM ADVOGADO o enquadramento exato das bases legais.]

**13.4. Compartilhamento.** Os dados da criança são acessados apenas pela equipe envolvida no cuidado (terapeutas, supervisores e recepção, na medida do necessário). Só são enviados a terceiros, como escola, médico ou outros profissionais, com **autorização do responsável**, ou quando a lei exigir. A CONTRATADA pode usar prestadores de tecnologia (hospedagem do sistema, envio de mensagens) que tratam dados apenas para os serviços da clínica e com dever de segurança. [CONFIRMAR COM ADVOGADO — operadores e eventual transferência internacional de dados, LGPD art. 33.]

**13.5. Sigilo profissional.** Todos os profissionais e colaboradores da clínica têm dever de sigilo sobre o que souber do paciente e da família, conforme as normas éticas de cada profissão.

**13.6. Guarda do prontuário.** O prontuário é guardado pela CONTRATADA pelo prazo mínimo de {{retencao_prontuario_anos}} anos [CONFIRMAR COM ADVOGADO — prazo por profissão e por norma do conselho], contados do último registro. Depois, os dados são eliminados ou anonimizados, salvo obrigação legal de guarda maior.

**13.7. Direitos do responsável.** O responsável pode, a qualquer tempo, pedir confirmação do tratamento, acesso, correção dos dados, informações sobre o compartilhamento e **revogar o consentimento** (LGPD, art. 18), pelo contato do encarregado: {{encarregado_dados_contato}} [PREENCHER]. A revogação não apaga dados que a clínica precise guardar por obrigação legal, como o prontuário, e pode impedir a continuidade de parte do atendimento.

**13.8.** Ao completar 18 anos, o paciente passa a exercer sozinho os direitos sobre seus dados.

## 14. Do uso de imagem

**14.1.** **A CONTRATADA NÃO usa fotos, vídeos ou áudios do paciente** em redes sociais, site, materiais de divulgação, eventos ou aulas, **salvo autorização expressa e separada do responsável**, dada no **Anexo II (opcional)**.

**14.2.** Registros feitos para fins clínicos dentro da sessão (por exemplo, vídeo para análise da equipe) só são feitos com avisos à família e ficam no prontuário, sob sigilo, sem divulgação.

**14.3.** Recusar o Anexo II não altera o contrato, o preço ou a qualidade do atendimento.

<!-- NOTA INTERNA — no sistema, guardians.image_consent tem DEFAULT true. Isso contradiz esta cláusula. Antes de usar o contrato, ajustar o sistema para default false / valor explícito, ou não mapear essa coluna ao aceite do Anexo II. -->

## 15. Do pedido de reembolso a plano de saúde

**15.1.** Se a família quiser pedir reembolso ao seu plano de saúde, a CONTRATADA emitirá **recibo** e, se solicitado, relatório do atendimento realizado, dentro das regras éticas e de sigilo.

**15.2.** **A CONTRATADA não garante o reembolso.** A decisão, o valor e o prazo dependem apenas do plano de saúde, e a negativa ou o reembolso parcial não alteram a obrigação de pagar este contrato.

**15.3.** A CONTRATADA não faz o pedido de reembolso em nome da família, salvo combinação em outro instrumento.

## 16. Das comunicações e da assinatura eletrônica

**16.1.** As comunicações entre as partes podem ser feitas por WhatsApp, e-mail ou portal da família, nos contatos informados neste contrato. O CONTRATANTE deve avisar sobre qualquer mudança.

**16.2.** As partes concordam em assinar este contrato por **meio eletrônico**, com aceite por código de verificação enviado ao telefone ou e-mail do CONTRATANTE, ou por outra plataforma de assinatura indicada pela CONTRATADA. Reconhecem que o registro do aceite (data, hora, identificação e IP) vale como assinatura e prova da concordância. [CONFIRMAR COM ADVOGADO — Lei 14.063/2020 e MP 2.200-2/2001.]

**16.3.** O CONTRATANTE declara ter lido o contrato, recebido uma cópia e tido a chance de tirar dúvidas antes de aceitar.

## 17. Das disposições gerais e do foro

**17.1.** Se uma cláusula for considerada inválida, as demais continuam valendo.

**17.2.** Qualquer alteração deste contrato só vale se feita por escrito e aceita pelas partes, inclusive por meio eletrônico.

**17.3.** Fica eleito o foro da comarca de **Belém, Estado do Pará**, para resolver conflitos deste contrato. Se o CONTRATANTE morar em outro município, ele pode também propor a ação no foro do seu domicílio. [CONFIRMAR COM ADVOGADO — CDC, art. 101, I.]

<!-- NOTA INTERNA — antes de assinar, as partes tentam resolver por conversa direta (WhatsApp ou reunião com a coordenação). -->

Belém/PA, {{data_assinatura}}.

**CONTRATADA:** {{clinica_razao_social}} — {{clinica_representante_nome}}

**CONTRATANTE (responsável legal):** {{responsavel_nome}} — CPF {{responsavel_cpf}}

**Paciente:** {{paciente_nome}}

Testemunhas (opcional): {{testemunha_1}} / {{testemunha_2}}

---

## ANEXO I — Termo de consentimento para tratamento de dados pessoais da criança (LGPD, art. 14 e art. 11)

Eu, {{responsavel_nome}}, CPF {{responsavel_cpf}}, responsável legal de {{paciente_nome}}, declaro que li e entendi a cláusula 13 do contrato e **consinto de forma específica e em destaque** que a {{clinica_razao_social}} trate os dados pessoais e os dados sensíveis de saúde do paciente para as finalidades abaixo:

- realizar avaliações e acompanhar o desenvolvimento do paciente, e manter o prontuário;
- compartilhar os dados com a equipe da clínica envolvida no cuidado;
- me comunicar por WhatsApp, e-mail e portal da família sobre agenda, cobrança, relatórios e orientações.

O compartilhamento com escola, médicos ou outros profissionais só ocorre com minha autorização específica. Sei que posso revogar este consentimento a qualquer momento, nos termos da cláusula 13.7.

( ) Concordo (aceite obrigatório para a prestação do serviço)

Data e aceite eletrônico: {{data_assinatura}}

---

## ANEXO II — Autorização de uso de imagem (OPCIONAL)

Este anexo é opcional. Se não for assinado, **a imagem do paciente não será usada**.

Eu, {{responsavel_nome}}, CPF {{responsavel_cpf}}, responsável legal de {{paciente_nome}}:

( ) **NÃO autorizo** o uso de fotos, vídeos ou áudios do paciente (opção padrão).

( ) **Autorizo** o uso de fotos e vídeos do paciente, sem identificar o sobrenome, para: ( ) redes sociais da clínica ( ) site ( ) materiais impressos ( ) uso interno em treinamento da equipe.

Prazo: {{imagem_prazo}} [PREENCHER]. Posso revogar esta autorização a qualquer momento, por escrito, e a clínica deixará de usar as imagens nos novos materiais, retirando as já publicadas em até {{imagem_prazo_retirada_dias}} dias.

Data e aceite eletrônico: {{data_assinatura_imagem}}

<!-- NOTA INTERNA — imagem de criança exige cuidado reforçado (ECA, art. 17 e 18; LGPD art. 14). [CONFIRMAR COM ADVOGADO] -->
