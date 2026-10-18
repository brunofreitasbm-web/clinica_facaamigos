# Métricas da landing /site (SEO, GEO, AEO, SXO)

Tudo carrega só na landing (`app/site`), nunca no sistema interno. Cada ferramenta só liga se a variável existir na Vercel.

## Variáveis (Vercel > Settings > Environment Variables)

| Variável | Onde pegar | Para quê |
|---|---|---|
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | GA4 > Admin > Fluxos de dados | eventos e funil |
| `NEXT_PUBLIC_GTM_ID` | GTM > ID do contêiner | use GA4 direto **ou** GTM |
| `NEXT_PUBLIC_CLARITY_ID` | clarity.microsoft.com > Settings | mapa de calor e gravação (SXO). Mascaramento em **Strict** |
| `NEXT_PUBLIC_META_PIXEL_ID` | Gerenciador de Eventos | anúncios |
| `GOOGLE_SITE_VERIFICATION` / `BING_SITE_VERIFICATION` | Search Console / Bing Webmaster | dados de busca |

## Eventos enviados (`engagement.tsx`, `analytics-client.ts`)

| Evento | Parâmetros | Serve para |
|---|---|---|
| `traffic_class` | `traffic_class`: ia, busca, social, email, direto, outro | GEO/AEO × SEO: quanto vem de ChatGPT, Perplexity, Gemini, Claude, Copilot |
| `web_vitals` | `metric_name` (LCP, INP, CLS, FCP, TTFB), `metric_value`, `metric_rating` | SEO técnico / SXO (CLS em milésimos) |
| `scroll_depth` | `percent` 25/50/75/90 | SXO |
| `section_view` | `section_id` | funil de leitura |
| `nav_click` / `outbound_click` | `target` / `link_url` | SXO, saída para mapeamento e guias |
| `faq_open` | `question` | AEO: as perguntas que o visitante realmente quer responder |
| `form_start` | `form_id` | abandono de formulário (compare com `generate_lead`) |
| `generate_lead`, `contact` | já existiam | conversão |

Nenhum evento envia o que a pessoa digita.

## Configurar no GA4 (uma vez)

1. Admin > Definições personalizadas: criar dimensões de evento `traffic_class`, `section_id`, `question`, `form_id`, `metric_name`, `percent`; métrica `metric_value`.
2. Marcar `generate_lead` e `contact` como eventos-chave.
3. Explorações: funil `section_view (servicos)` → `form_start` → `generate_lead`; comparação `traffic_class = ia` × `busca`.

## Indexação

Desde 18/10/2026 a landing mora no hub, em `institutofacaamigos.com.br/clinica`, e o sistema segue sem indexação:

- O projeto do hub (`facaamigos-site`) faz rewrite de `/clinica` e `/clinica-static/*` para este deploy (`vercel.json` do hub). Aqui o `proxy.ts` reescreve `/clinica` para `/site`; JS/CSS e o otimizador de imagens saem sob `/clinica-static` (`assetPrefix` e `images.path` em `next.config.ts`).
- Canonical, Open Graph e JSON-LD apontam para `https://institutofacaamigos.com.br/clinica` (`CLINIC_PUBLIC_URL` em `lib/clinic-identity.ts`). O sitemap é o do hub.
- `clinica.institutofacaamigos.com.br` virou host legado: `/` redireciona (301) para `/clinica`, `/site/*` para `/clinica-static/site/*`, o resto (308) para `sistema.…`. Mantenha o domínio apontado para este projeto, senão os redirects somem.
- No `sistema.…`, `/clinica` e `/site` respondem 404 (a landing não existe lá). Todo o sistema responde com `X-Robots-Tag: noindex` (posto em `proxy.ts`) e o `robots.txt` do host bloqueia tudo.
- A landing não linka mais para o login (`Área Restrita` saiu do topo e do menu mobile).

Depois do deploy: cadastrar a propriedade `institutofacaamigos.com.br` no Search Console e no Bing Webmaster (se ainda não houver), reenviar o sitemap do hub e pedir a indexação de `/clinica`. Manter a propriedade antiga `clinica.…` para acompanhar os 301. Não existe "Mudança de endereço" para subdomínio → pasta; o que transfere o ranking são os 301.
