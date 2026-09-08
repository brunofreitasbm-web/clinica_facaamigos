# Protocolos genéricos configuráveis — levantamento de fontes e licenciamento

Registro do levantamento jurídico feito em 2026-09-08 para decidir o que pode
ser reproduzido no módulo de protocolos (`lib/protocol-templates/`) sem
comprar licença de nenhum dos instrumentos abaixo. Cobre os 16 protocolos do
catálogo (`lib/protocol-catalog.ts`) que têm template.

## Regra geral aplicada

- **Estrutura** (domínios/áreas, níveis ou faixas etárias, número de itens
  por bloco, escala de resposta, regra de cálculo) é fato/ideia, não é
  protegida por direito autoral — pode ser reproduzida a partir de
  descrições públicas do instrumento (sites oficiais, artigos científicos,
  Wikipédia, manuais de domínio público).
- **Texto dos itens** (a redação exata de cada marco/tarefa/critério) é obra
  protegida na quase totalidade dos instrumentos pesquisados. Não foi
  reproduzido: todo item é **redação original**, escrita para este projeto,
  comportamental e observável, sem copiar ou parafrasear manual, tradução
  autorizada ou não autorizada.
- Duas exceções, onde o **texto integral dos itens** é reproduzido com
  atribuição por estarem sob **Creative Commons Attribution 4.0 (CC BY)**:
  **DEMUCA** e **Escala Labirinto — Comportamento Alimentar**.
- Cópias de manuais em Studocu/Scribd/pdfcoffee/similares circulando na
  internet são uploads não autorizados, não licenças abertas — não foram
  usadas como fonte em nenhum caso.
- Os nomes comerciais (VB-MAPP®, ABLLS-R®, AFLS™ etc.) são marcas dos
  respectivos autores/editoras. O sistema nunca usa o nome da marca como
  `display_name` do protocolo genérico — usa "estrutura tipo X, genérico".

## Por instrumento

### VB-MAPP (Sundberg) — `vbmapp`
Proprietário, AVB Press. Guia e protocolo com todos os direitos reservados;
cópia proibida mesmo para uso clínico além do previsto no manual. Sem
tradução oficial em português. Tradução acadêmica (Martone, 2017, UFSCar)
feita com autorização pontual do autor para pesquisa, não é licença aberta.
**Template**: estrutura de 3 níveis/16 domínios/170 marcos e escala 0-1-2 a
partir de descrições públicas (marksundberg.com, Wikipédia); itens 100%
originais.

### ABLLS-R (Partington) — `ablls_r`
Proprietário, Behavior Analysts Inc./CentralReach. Nenhuma reprodução
permitida sem autorização escrita. Sem tradução oficial em português.
**Template**: 25 áreas A–Y, escala 0-4, 200 itens (subconjunto representativo
dos 544 reais — completar via importador em massa); itens originais.

### Denver/ESDM Curriculum Checklist (Rogers & Dawson) — `esdm`
Proprietário, Guilford Press. Reprodução exige permissão da editora
(Copyright Clearance Center). Existe tradução portuguesa oficial (Lidel,
Portugal), produto comercial licenciado, não aberto.
**Template**: 4 níveis, 9-11 domínios por nível, 312 itens (subconjunto dos
~480 reais); itens originais.

### AFLS (Partington & Mueller) — `afls`
Proprietário, CentralReach (ex-Stimulus Publications). Mesmas restrições do
ABLLS-R. Sem edição em português.
**Template**: 6 protocolos como níveis, 51 subáreas, 204 itens; itens
originais.

### ABLA-R (Kerr, Meyerson; revisão DeWiele et al.) — `abla_r`
Manual de autoinstrução (2ª ed., 2014) disponibilizado gratuitamente pelo
St.Amant Research Centre, sem termos de licença explícitos publicados —
tratado como "gratuito, mas não confirmadamente CC". A **estrutura dos 6
níveis** está descrita em português num artigo CC BY 4.0 (Comesanha & Souza,
2021, *Psicologia: Teoria e Pesquisa*).
**Template**: 6 níveis × 3 etapas (demonstrada/guiada/independente), 18
itens; itens originais.

### IPO — Inventário Portage Operacionalizado (Williams & Aiello) — `ipo`
Proprietário, Juruá Editora; a base (Portage Guide) é proprietária do Portage
Project (EUA). Nenhuma planilha aberta encontrada.
**Template**: 6 áreas × 6 faixas etárias (0-6 anos) + estimulação infantil,
188 itens (subconjunto dos 580 reais); itens originais.

### PEP-R (Schopler et al.) — `pep_r`
Proprietário, Pro-Ed (sucedido pelo PEP-3). Sem edição comercial em
português; uso clínico no Brasil é feito com tradução não publicada.
**Template**: Escala de desenvolvimento (7 áreas, 131 itens) + Escala de
comportamento (4 áreas, 43 itens) = 174 itens; itens originais.

### IAR — Instrumento de Avaliação do Repertório Básico para Alfabetização (Leite) — `iar`
Proprietário, EDICON, mas de baixo custo e sem exigência de credencial
("instrumento sem restrições" nas lojas especializadas). Nenhuma versão
aberta encontrada.
**Template**: 13 áreas, 39 itens; itens originais.

### PCL-R — Protocolo Cognitivo-Linguístico (Capellini & Silva) — `pcl`
A edição comercial atual (Book Toy, 2022) é proprietária. A **edição
original de 2008** (Capellini & Smythe, orgs.) é publicada em acesso aberto
pela Editora Universitária/UNESP sob **CC BY-NC-ND 4.0** — a cláusula ND
(sem derivação) e NC (não comercial) impede transformar aquele PDF num
módulo digital comercial, então não foi usado como fonte de itens, só como
confirmação da estrutura de subtestes.
**Template**: 8 subtestes cognitivo-linguísticos, 40 itens; itens originais.

### TGMD-2 (Ulrich) — `tgmd2`
Proprietário, Pro-Ed (sucedido pelo TGMD-3). Sem edição licenciada em
português; validações brasileiras (Valentini et al.) são artigos científicos
abertos que descrevem a estrutura, não os critérios completos.
**Template**: 2 subtestes × 6 habilidades, 4 critérios por habilidade, 48
itens; itens originais.

### ABFW — Teste de Linguagem Infantil (Andrade, Befi-Lopes, Fernandes, Wertzner) — `abfw`
Proprietário, Pró-Fono. Reprodução proibida sem autorização escrita
explícita no próprio manual.
**Template**: 4 subtestes (fonologia, vocabulário, fluência, pragmática), 63
itens; itens originais.

### Matriz de Comunicação (Rowland) — `matriz_comunicacao`
Proprietário, Communication Matrix Foundation/OHSU. Versão para pais em
português existe no site oficial (tradução autorizada, mas ainda protegida
por copyright — não é licença aberta). Uso profissional online é pago por
avaliação.
**Template**: 7 níveis × 4 razões comunicativas, 28 itens; itens originais.

### COPM (Law et al.) — `copm`
Proprietário, COPM Inc. Termos de uso proíbem explicitamente incluir o
produto em qualquer formato digital ou produto comercial sem licença
corporativa paga.
**Template**: 3 áreas × subáreas, 9 itens, escala de desempenho 1-10; itens
originais.

### SPM/SPM-P (Dunn/WPS) — `spm`
Proprietário, Western Psychological Services. Sem adaptação brasileira
validada e publicada encontrada.
**Template**: 8 sistemas sensoriais, 48 itens, escala de frequência 1-4
(itens invertidos: maior frequência = maior dificuldade); itens originais.

### Escala Labirinto — Comportamento Alimentar (Lázaro, Siquara, Pondé) — `escala_labirinto`
**CC BY 4.0.** Lázaro, C. P.; Siquara, G. M.; Pondé, M. P. (2019). "Escala de
Avaliação do Comportamento Alimentar no Transtorno do Espectro Autista:
estudo de validação." *Jornal Brasileiro de Psiquiatria*, 68(4).
DOI: 10.1590/0047-2085000000246.
**Template**: os 26 itens em 7 fatores são **reproduzidos integralmente**
(licença permite), com atribuição obrigatória no cadastro do protocolo.

### DEMUCA — Escala de Desenvolvimento Musical de Crianças com Autismo (Freire, Martelli, Sampaio, Parizzi) — `demuca`
**CC BY 4.0.** Freire, M. H.; Martelli, J.; Sampaio, R.; Parizzi, M. B.
(2019). "Validação da Escala de Desenvolvimento Musical de Crianças com
Autismo (DEMUCA)." *Revista OPUS*, 25(3), 177-186.
DOI: 10.20504/opus2019c2508.
**Template**: os 38 (+2 condicionais) itens em 6 categorias são
**reproduzidos integralmente** a partir do Anexo do artigo (manual
explicativo), incluindo pesos ×2 e a inversão de escala da categoria
"Comportamentos restritivos", com atribuição obrigatória no cadastro.

## O que NÃO fazer com este material

- Não digitar, colar ou importar o texto de manuais licenciados (VB-MAPP,
  ABLLS-R, AFLS, ESDM/Guilford, IPO/Juruá, PEP-R/Pro-Ed, ABFW/Pró-Fono,
  COPM, SPM/WPS, PCL-R/Book Toy, TGMD-2/Pro-Ed) nos templates genéricos.
- Não usar a marca do instrumento como nome de exibição do protocolo
  genérico — usar sempre a variante "estrutura tipo X, genérico".
- Se a clínica **possui** a licença de um desses instrumentos, o fluxo
  correto continua sendo "Licenciado" (não "Estrutura genérica") em
  Cadastros → Terapias, digitando os itens reais da licença — é para isso
  que o cadastro manual e o importador de item a item continuam existindo.

## Como isso vira produto

`lib/protocol-templates/` tem um arquivo por instrumento (tipo
`ProtocolTemplate` em `types.ts`) com domínios, níveis, escala e itens.
`lib/protocol-templates/seed.ts` insere um template inteiro em
`protocol_items` ao criar um protocolo em modo genérico
(`app/gestor/cadastros/terapias/nova`). `scripts/check-protocol-templates.ts`
verifica que todo template está no catálogo, tem códigos únicos, escala
coerente e atribuição quando `contentLicense: "cc-by"`.
