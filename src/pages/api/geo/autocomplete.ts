import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { getGeoapifyKey } from "@/lib/server/geoapifyCredentials";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

/**
 * GET /api/geo/autocomplete?q=...
 *
 * Sugestões de morada com coordenadas, via Geoapify.
 *
 * Existe do lado do servidor para a chave não chegar ao browser — e porque
 * resolve na raiz o problema que produziu uma avaliação em Mafra com pontos
 * de interesse do Porto: escrever a morada à mão obrigava a geocodificar
 * texto ambíguo depois. Escolhendo da lista, as coordenadas vêm exatas.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Invalid token" });

    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
    // Menos de 3 caracteres devolve ruído e gasta quota sem utilidade.
    if (query.length < 3) return res.status(200).json({ suggestions: [] });

    const apiKey = await getGeoapifyKey();
    if (!apiKey) {
      return res.status(200).json({ suggestions: [], notConfigured: true });
    }

    const url =
      "https://api.geoapify.com/v1/geocode/autocomplete" +
      `?text=${encodeURIComponent(query)}` +
      "&filter=countrycode:pt" +
      "&limit=6&lang=pt" +
      `&apiKey=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      console.warn("[geo/autocomplete] Geoapify devolveu", response.status);
      return res.status(200).json({ suggestions: [] });
    }

    const data = await response.json();

    const suggestions = (data.features || [])
      .map((feature: any) => {
        const p = feature.properties || {};
        if (typeof p.lat !== "number" || typeof p.lon !== "number") return null;
        return {
          label: p.formatted as string,
          lat: p.lat as number,
          lon: p.lon as number,
          // `county` é o concelho em Portugal — é o que interessa para a
          // pesquisa de comparáveis, não a freguesia nem o distrito.
          city: (p.city || p.county || p.state) ?? null,
          county: p.county ?? null,
          district: p.state ?? null,
          postcode: p.postcode ?? null,
          street: p.street ?? null,
        };
      })
      .filter(Boolean);

    return res.status(200).json({ suggestions });
  } catch (error: any) {
    console.error("[geo/autocomplete]", error);
    return res.status(200).json({ suggestions: [] });
  }
}
