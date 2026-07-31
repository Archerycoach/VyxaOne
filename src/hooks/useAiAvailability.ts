import { useEffect, useState } from "react";
import { isAiAvailableForCurrentUser } from "@/lib/ai/clientAvailability";

/**
 * Disponibilidade de IA para o utilizador atual, para gates/avisos de UI.
 * `available` = tem chave pessoal OU plano com IA integrada (ver
 * `isAiAvailableForCurrentUser`). Resultado em cache ao nível do módulo (TTL
 * curto) para não repetir as queries em cada funcionalidade de IA que monte o
 * aviso.
 */
let cache: { value: boolean; ts: number } | null = null;
const TTL = 120000; // 2 min

/** Invalida o cache (ex.: após configurar a chave ou mudar de plano). */
export function refreshAiAvailability() {
  cache = null;
}

export function useAiAvailability(): { available: boolean; loading: boolean } {
  const fresh = cache && Date.now() - cache.ts < TTL ? cache.value : null;
  const [available, setAvailable] = useState<boolean>(fresh ?? false);
  const [loading, setLoading] = useState<boolean>(fresh === null);

  useEffect(() => {
    let cancelled = false;
    if (cache && Date.now() - cache.ts < TTL) {
      setAvailable(cache.value);
      setLoading(false);
      return;
    }
    isAiAvailableForCurrentUser()
      .then((v) => {
        cache = { value: v, ts: Date.now() };
        if (!cancelled) { setAvailable(v); setLoading(false); }
      })
      .catch(() => {
        if (!cancelled) { setAvailable(false); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, []);

  return { available, loading };
}
