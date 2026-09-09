# Cupom de check-in (80mm/58mm) — impressão sem diálogo

O cupom de check-in (ver `/gestor/configuracoes/cupom-checkin`) imprime via
`window.print()` do navegador (`lib/print-coupon.ts`). Por padrão, isso abre
o diálogo de impressão do Chrome/Edge a cada cupom. Para a recepção não
precisar confirmar manualmente toda hora, configure a estação assim:

1. **Impressora padrão.** Defina a térmica como impressora padrão do
   Windows — o modo silencioso do navegador (`--kiosk-printing`) sempre usa a
   impressora padrão, sem perguntar qual.

2. **Papel do driver.** Nas Preferências de Impressão do driver da térmica,
   defina o tamanho do papel como **80mm × recibo/rolo** (ou 58mm, conforme a
   impressora e a configuração escolhida em Configurações). O CSS do cupom
   (`@page { size: 80mm auto }`) é só uma sugestão — se o driver não expõe um
   tamanho de rolo, o navegador cai no papel padrão (geralmente A4) e o
   cupom sai minúsculo, num canto de uma folha inteira.

3. **Uma impressão manual de calibração.** Clique em "Imprimir teste" na
   tela de configurações. No diálogo do navegador: Margens = **Nenhuma**,
   desmarque **Cabeçalhos e rodapés**, Escala = **Padrão**. O navegador
   memoriza essas escolhas por perfil, e o modo silencioso as reaproveita.

4. **Atalho dedicado com `--kiosk-printing`.** Crie um atalho do Chrome que a
   recepção use para acessar o sistema:

   ```
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing --user-data-dir="C:\ChromeRecepcao"
   ```

   O `--user-data-dir` separado evita que o modo silencioso vaze para o
   navegador pessoal de quem usa a mesma máquina — o flag vale para o
   perfil inteiro, então qualquer `window.print()` de qualquer site abriria
   sem diálogo se aplicado ao Chrome "normal". No Edge, o flag equivalente é
   o mesmo: `msedge.exe --kiosk-printing`.

5. **Sem o flag, tudo continua funcionando** — só aparece o diálogo de
   impressão, e quem está na recepção aperta Enter (ou clica Imprimir) para
   confirmar.
