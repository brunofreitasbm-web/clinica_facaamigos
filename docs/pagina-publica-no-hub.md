# Página pública da Clínica (movida para o hub)

Desde 18/10/2026 a página pública da Clínica é **estática e mora no hub**: `institutofacaamigos.com.br/clinica` (arquivo `clinica.html` no repositório `langing_page_faca_amigos`). Este app não tem mais landing, rastreio de visitantes nem formulário público: o que era `app/site` foi removido. Métricas, SEO e conteúdo dela agora vivem no hub.

## Como este app trata o endereço antigo

- `clinica.institutofacaamigos.com.br/` e `/site` redirecionam (301) para o hub (query preservada); qualquer outro caminho desse host vai (308) para `sistema.institutofacaamigos.com.br`. Mantenha o domínio apontado para este projeto, senão os redirects somem.
- Nada deste app é indexável: todo o sistema responde com `X-Robots-Tag: noindex` (`proxy.ts`) e o `robots.txt` bloqueia tudo, exceto no host antigo (que libera tudo para os 301 serem seguidos).
- Sem sitemap neste app: o sitemap é o do hub.
- Visitante não autenticado em `/` vai para `/login`; o login tem o link "Voltar ao site público" para o hub.

## Pendências fora do código

- A tabela `site_leads` (gravada pelo formulário antigo) ficou sem uso; remover por migration quando não houver mais interesse nos dados.
- No Search Console: manter a propriedade `clinica.…` só para acompanhar os 301 e pedir a indexação de `/clinica` na propriedade `institutofacaamigos.com.br`.
- Na Vercel, as variáveis `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_GTM_ID`, `NEXT_PUBLIC_META_PIXEL_ID`, `NEXT_PUBLIC_CLARITY_ID`, `GOOGLE_SITE_VERIFICATION` e `BING_SITE_VERIFICATION` deste projeto não são mais lidas.
