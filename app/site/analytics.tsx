import Script from "next/script";

/**
 * Tags de rastreio da landing (app/site) — GA4, Google Tag Manager e Meta
 * Pixel. Cada uma só carrega se a variável de ambiente correspondente
 * estiver preenchida (ver .env.local.example); sem isso, o componente não
 * renderiza script nenhum. De propósito ficam plugadas só aqui, não em
 * app/layout.tsx: o resto do sistema (prontuário, faturamento, agenda) é
 * uso interno da clínica com dado de saúde de criança — não faz sentido, e
 * seria um risco de privacidade, mandar esse tráfego para Google/Meta.
 *
 * `strategy="afterInteractive"`: carrega depois da hidratação, sem
 * disputar prioridade com o conteúdo da página (ver guia
 * node_modules/next/dist/docs/01-app/02-guides/scripts.md).
 */

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

export function SiteAnalytics() {
  return (
    <>
      {GTM_ID && (
        <Script id="gtm-init" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
            var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
            j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
            f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','${GTM_ID}');`}
        </Script>
      )}

      {GA_ID && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}');`}
          </Script>
        </>
      )}

      {META_PIXEL_ID && (
        <Script id="meta-pixel-init" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${META_PIXEL_ID}');
            fbq('track', 'PageView');`}
        </Script>
      )}
    </>
  );
}

/**
 * Fallback sem JavaScript do GTM e do Meta Pixel (pageview). Precisa ficar
 * logo no início do `<body>` para ser fiel ao snippet oficial — como
 * app/layout.tsx é quem controla o `<body>`, este componente entra no topo
 * do layout de app/site (ver app/site/layout.tsx), o mais perto disso que
 * um layout aninhado consegue chegar.
 */
export function SiteAnalyticsNoScript() {
  if (!GTM_ID && !META_PIXEL_ID) return null;
  return (
    <>
      {GTM_ID && (
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
            title="Google Tag Manager"
          />
        </noscript>
      )}
      {META_PIXEL_ID && (
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element -- pixel de rastreio, não conteúdo: next/image não se aplica. */}
          <img
            height={1}
            width={1}
            style={{ display: "none" }}
            src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
            alt=""
          />
        </noscript>
      )}
    </>
  );
}
