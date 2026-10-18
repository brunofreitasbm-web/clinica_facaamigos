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

Desde 18/10/2026 a página pública da Clínica é **estática e mora no hub** (`institutofacaamigos.com.br/clinica`, arquivo `clinica.html` no repositório `langing_page_faca_amigos`). Este app não serve mais landing:

- `clinica.institutofacaamigos.com.br/` e `/site` redirecionam (301) para o hub; qualquer outro caminho desse host vai (308) para `sistema.institutofacaamigos.com.br`. Mantenha o domínio apontado para este projeto, senão os redirects somem.
- `/site` responde 404 com `noindex` em todos os hosts. O código de `app/site` (formulário de lista de espera, `site_leads`, analytics) ficou sem rota pública e pode ser removido quando não houver mais uso.
- Todo o sistema responde com `X-Robots-Tag: noindex` (posto em `proxy.ts`) e o `robots.txt` bloqueia tudo, menos no host antigo (que libera tudo para os 301 serem seguidos).
- Sem sitemap neste app: o sitemap é o do hub.

Depois do deploy: manter a propriedade `clinica.…` no Search Console só para acompanhar os 301; pedir a indexação de `/clinica` na propriedade `institutofacaamigos.com.br`.
