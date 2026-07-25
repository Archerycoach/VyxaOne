import { useEffect, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { enablePush, disablePush, isPushSubscribed, getPushSupport } from "@/lib/pushClient";

/**
 * Botão para ativar/desativar as notificações push neste dispositivo.
 * Aparece no rodapé do centro de notificações. Some se o dispositivo não
 * suportar push ou se o utilizador já as tiver bloqueado no navegador.
 */
export function PushNotificationToggle() {
  const { toast } = useToast();
  const [support, setSupport] = useState<ReturnType<typeof getPushSupport>>("unsupported");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSupport(getPushSupport());
    isPushSubscribed().then(setSubscribed);
  }, []);

  // Não mostrar nada se o dispositivo não suporta ou se foi bloqueado.
  if (support === "unsupported" || support === "denied") return null;

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Sessão expirada. Faça login novamente.");
    return token;
  };

  const handleEnable = async () => {
    setBusy(true);
    try {
      const token = await getToken();
      await enablePush(token);
      setSubscribed(true);
      toast({ title: "Notificações ativadas", description: "Vai receber avisos neste dispositivo." });
    } catch (error: any) {
      toast({ title: "Não foi possível ativar", description: error?.message, variant: "destructive" });
    } finally {
      setBusy(false);
      setSupport(getPushSupport());
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    try {
      const token = await getToken();
      await disablePush(token);
      setSubscribed(false);
      toast({ title: "Notificações desativadas neste dispositivo" });
    } catch (error: any) {
      toast({ title: "Erro", description: error?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 p-3 border-t bg-slate-50">
      <div className="flex items-center gap-2 text-sm text-slate-700">
        <BellRing className="h-4 w-4 text-blue-600" />
        <span>Notificações neste dispositivo</span>
      </div>
      {subscribed ? (
        <Button variant="ghost" size="sm" onClick={handleDisable} disabled={busy} className="text-xs">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Desativar"}
        </Button>
      ) : (
        <Button size="sm" onClick={handleEnable} disabled={busy} className="text-xs">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Ativar"}
        </Button>
      )}
    </div>
  );
}
