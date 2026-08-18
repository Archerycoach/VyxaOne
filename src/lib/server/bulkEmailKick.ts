/**
 * Dispara (ou continua) o processamento da fila de envio em massa.
 *
 * NÃO usar `void fetch(...)` para isto: numa função serverless da Vercel, mal
 * a resposta é devolvida a invocação é CONGELADA — um pedido "fire-and-forget"
 * ainda em voo morre antes de sair, o arranque perdia-se, e a campanha ficava
 * à espera do cron de recuperação (até 5 minutos parada; nas listas grandes,
 * cada elo do auto-encadeamento perdia-se da mesma forma e o envio avançava
 * só ~45s a cada 5 minutos).
 *
 * Aqui ESPERAMOS o suficiente para o pedido sair (a invocação seguinte, uma
 * vez recebida pela plataforma, corre até ao fim sozinha) — com um teto curto
 * para não atrasar a resposta a quem chamou. Falhas ficam para o cron.
 */
export async function kickBulkEmailProcess(appUrl: string, campaignId?: string): Promise<void> {
  try {
    await fetch(`${appUrl}/api/bulk-email/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.CRON_SECRET}` },
      body: JSON.stringify({ campaignId }),
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // AbortError é o caminho normal (não esperamos a resposta completa);
    // qualquer falha real é coberta pelo cron de recuperação.
  }
}
