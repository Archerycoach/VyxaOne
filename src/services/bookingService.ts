import { supabase } from "@/integrations/supabase/client";

/**
 * Gera um token aleatório e seguro (32 bytes, hex) — mesmo padrão usado no
 * Portal do Cliente (ver src/services/portalService.ts).
 */
function generateSecureToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Devolve o URL completo da página pública de agendamento do consultor —
 * gera e grava um novo token na primeira vez que for pedido; nas vezes
 * seguintes, devolve sempre o mesmo link.
 */
export async function getOrCreateBookingLink(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: profile, error } = await (supabase
    .from("profiles")
    .select("booking_token")
    .eq("id", user.id)
    .single() as any);

  if (error) throw error;

  let token = profile?.booking_token as string | null | undefined;

  if (!token) {
    token = generateSecureToken();
    const { error: updateError } = await (supabase
      .from("profiles")
      .update({ booking_token: token } as any)
      .eq("id", user.id) as any);
    if (updateError) throw updateError;
  }

  return `${window.location.origin}/agendar/${token}`;
}

/**
 * Cria um bloco de 30 min marcado como disponível para reserva.
 */
export async function createBookableSlot(startTime: Date): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

  const { error } = await (supabase.from("calendar_events") as any).insert({
    user_id: user.id,
    title: "Disponível para reserva",
    event_type: "meeting",
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    is_bookable: true,
  });

  if (error) throw error;
}
