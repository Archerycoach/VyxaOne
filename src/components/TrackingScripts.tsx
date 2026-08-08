import { useEffect, useState } from "react";
import Script from "next/script";
import { frontendSettingsService } from "@/services/frontendSettingsService";

// Formato esperado de cada ID — só injeta o script se validar, para não
// arriscar quebrar a página pública com um valor mal colado no admin.
const GA_ID_PATTERN = /^G-[A-Z0-9]+$/i;
const META_PIXEL_ID_PATTERN = /^\d{10,20}$/;

/**
 * Google Analytics 4 + Meta Pixel do tráfego público — só é montado nas
 * páginas de marketing/captação (ver PUBLIC_TRACKED_PAGES em _app.tsx),
 * nunca na app autenticada. IDs configuráveis em Admin > Frontend
 * (frontend_settings, categoria "public" — leitura sem autenticação).
 */
export function TrackingScripts() {
  const [gaId, setGaId] = useState<string | null>(null);
  const [metaPixelId, setMetaPixelId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    frontendSettingsService
      .getPublicSettings()
      .then((settings) => {
        if (cancelled) return;
        const ga = (settings.tracking_ga_measurement_id || "").trim();
        const pixel = (settings.tracking_meta_pixel_id || "").trim();
        setGaId(GA_ID_PATTERN.test(ga) ? ga : null);
        setMetaPixelId(META_PIXEL_ID_PATTERN.test(pixel) ? pixel : null);
      })
      .catch(() => {
        // Falha a carregar configuração de tracking não deve afetar a página pública.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {gaId && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gaId}');`}
          </Script>
        </>
      )}
      {metaPixelId && (
        <>
          <Script id="meta-pixel-init" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${metaPixelId}');
              fbq('track', 'PageView');`}
          </Script>
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        </>
      )}
    </>
  );
}
