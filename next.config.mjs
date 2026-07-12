/** @type {import('next').NextConfig} */
import { createRequire } from "module";

// Check if element-tagger is available
function isElementTaggerAvailable() {
  try {
    const require = createRequire(import.meta.url);
    require.resolve("@softgenai/element-tagger");
    return true;
  } catch {
    return false;
  }
}

// Build turbo rules only if tagger is available
function getTurboRules() {
  if (!isElementTaggerAvailable()) {
    console.log(
      "[Softgen] Element tagger not found, skipping loader configuration"
    );
    return {};
  }

  return {
    "*.tsx": ["@softgenai/element-tagger"],
    "*.jsx": ["@softgenai/element-tagger"],
  };
}

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    turbo: {
      rules: getTurboRules(),
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  allowedDevOrigins: ["*.daytona.work", "*.softgen.dev"],
  // Cabeçalhos de segurança aplicados a todas as rotas. Não inclui CSP
  // (Content-Security-Policy) de propósito: a app carrega recursos de vários
  // domínios (Supabase, Google, Meta, Stripe) e uma CSP mal afinada partiria
  // funcionalidades — deve ser adicionada e testada num passo dedicado.
  // Câmara/microfone não são restringidos (usados nas notas de voz).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Força HTTPS no browser durante 1 ano (só tem efeito sobre HTTPS).
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          // Impede o browser de "adivinhar" o tipo de conteúdo (anti-MIME-sniffing).
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Impede que o site seja embebido noutros sites (clickjacking).
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Não vaza o URL completo como referer para outros sites.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Desliga APIs sensíveis que a app não usa.
          { key: "Permissions-Policy", value: "geolocation=(), browsing-topics=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
