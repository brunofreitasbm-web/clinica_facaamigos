# Texto exato para a KB do chatbot (usar SOMENTE na ativação do plano de 6 sessões)

Não aplicar antes da ativação (vazaria o plano). Nome comercial provisório: **Passo Firme** (trocar pelo nome final).
Valor por sessão: R$ 1.080 / 6 = R$ 180,00.

## A. `chatbot-base-conhecimento.md`, seção 4 (linha inteira que começa com "Valor único por plano")

```
Valor único por plano (não varia por terapia), lido de `insurer_price_tables` do convênio "Particular" (códigos `PART-PLANO-*` e `PART-AVAL-NEURO`): Encontro (sessão avulsa) R$ 190 · Primeiro Passo (4 sessões/mês) R$ 720 · Passo Firme (6) R$ 1.080 · Laço (8) R$ 1.400 · Vínculo (12) R$ 1.990 · Turma (16) R$ 2.580 · Abraço (20) R$ 3.120 · Voo Livre (24) R$ 3.640 · Avaliação Neuropsicológica R$ 2.500 (valor fechado, fora dos planos). As linhas por terapia (R$ 190 cada) existem só para o faturamento e não entram no prompt.
```

## B. Pergunta "Como funcionam os planos mensais?" (versão do `chatbot-base-conhecimento.md`, linha **R:**)

```
Planos mensais pagos no início do mês, com sessões de qualquer especialidade, combináveis (ex.: 4 de Fono + 4 de TO): *Primeiro Passo* 4 sessões R$ 720 · *Passo Firme* 6 sessões R$ 1.080 · *Laço* 8 sessões R$ 1.400 · *Vínculo* 12 sessões R$ 1.990 · *Turma* 16 sessões R$ 2.580 · *Abraço* 20 sessões R$ 3.120 · *Voo Livre* 24 sessões R$ 3.640 (cerca de R$ 151,67 por sessão). A avaliação inicial conta como 1 sessão do plano; cada bloco de Treino ABA (3 sessões seguidas) conta como 3. Parcelamos em até 3x no cartão. Avaliação neuropsicológica: R$ 2.500, fora dos planos.
```

## C. Resposta VIVA em `clinic_faq` (id `9efc1399-bdfb-4908-81aa-6e6df2cafdda`)

ATENÇÃO: o banco hoje tem uma redação diferente da do `.md` (o `.md` está defasado) e diz
"São seis pacotes, de 4 a 24 sessões por mês". Com o novo plano passa a ser **sete** pacotes.
Texto novo (mantém a estrutura atual do banco, valores continuam na arte):

```
Nossos planos são mensais, pagos no início do mês, com sessões de qualquer especialidade, que podem ser combinadas (ex.: 4 de Fono + 4 de TO). São sete pacotes, de 4 a 24 sessões por mês: *Primeiro Passo*, *Passo Firme*, *Laço*, *Vínculo*, *Turma*, *Abraço* e *Voo Livre*. 🧩

A *avaliação inicial conta como 1 sessão* do plano escolhido, e cada bloco de Treino ABA (3 sessões seguidas) conta como 3 sessões. Parcelamos em até 3x no cartão. ✨

Os valores vão na arte dos pacotes, que o sistema envia por aqui quando a pessoa pergunta, e a equipe conversa para montar a melhor opção para cada criança. A avaliação neuropsicológica tem valor fechado, fora dos planos: a equipe informa.
```

SQL (rodar só na ativação; acrescentar também `"passo firme"` às keywords):

```sql
update clinic_faq
   set answer = $faq$<texto C acima>$faq$,
       keywords = array_append(keywords, 'passo firme')
 where id = '9efc1399-bdfb-4908-81aa-6e6df2cafdda'
   and not ('passo firme' = any(keywords));
```

Reversão da FAQ: guardar o `answer`/`keywords` atuais (select antes) e restaurar.
