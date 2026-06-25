import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, MessageCircle, Copy, RefreshCw } from "lucide-react";

export function WhatsAppConnection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    phone_number: "",
    phone_number_id: "",
    is_active: false,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("whatsapp_settings" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const settingsData = data as any;
        setSettings({
          phone_number: settingsData.phone_number || "",
          phone_number_id: settingsData.phone_number_id || "",
          is_active: settingsData.is_active || false,
        });
      }
    } catch (error) {
      console.error("Error loading WhatsApp settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkNumber = async () => {
    if (!settings.phone_number) {
      toast({ title: "Erro", description: "Insira o seu número de telemóvel.", variant: "destructive" });
      return;
    }

    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/whatsapp/link-number", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ phoneNumber: settings.phone_number })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Falha ao ligar número.");
      }

      setSettings(prev => ({
        ...prev,
        phone_number_id: data.phone_number_id,
        is_active: true
      }));

      toast({
        title: "Sucesso",
        description: "Número ligado ao WhatsApp com sucesso!",
      });
    } catch (error: any) {
      console.error("Error linking WhatsApp number:", error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (checked: boolean) => {
    try {
      if (!settings.phone_number_id && checked) {
        toast({ title: "Erro", description: "Por favor ligue o seu número primeiro.", variant: "destructive" });
        return;
      }

      setSettings(prev => ({ ...prev, is_active: checked }));
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from("whatsapp_settings" as any)
        .update({ is_active: checked })
        .eq("user_id", user.id);

      toast({ title: checked ? "Ativado" : "Desativado", description: "Estado do WhatsApp atualizado." });
    } catch (error) {
      console.error(error);
    }
  };

  const generateVerifyToken = () => {
    const newToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    setSettings(prev => ({ ...prev, verify_token: newToken }));
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: `${label} copiado para a área de transferência.` });
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  const webhookUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/whatsapp/webhook`;

  return (
    <div className="space-y-6">
      <div className={`flex items-center space-x-3 p-4 rounded-lg border ${
        settings.is_active && settings.phone_number_id ? "bg-green-50 border-green-200" : "bg-slate-50 border-slate-200"
      }`}>
        {settings.is_active && settings.phone_number_id ? (
          <>
            <CheckCircle2 className="h-6 w-6 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-900">Integração Ativa ({settings.phone_number})</p>
              <p className="text-xs text-green-700">O seu número está ligado ao Agente IA e pronto a usar</p>
            </div>
          </>
        ) : (
          <>
            <MessageCircle className="h-6 w-6 text-slate-400" />
            <div>
              <p className="text-sm font-medium text-slate-700">Integração Inativa</p>
              <p className="text-xs text-slate-500">Adicione o seu número abaixo para ativar</p>
            </div>
          </>
        )}
      </div>

      <div className="space-y-4">
        <div className="grid gap-4 bg-slate-50 p-4 border rounded-md">
          <h3 className="font-medium text-sm text-slate-800">Ligar o seu Número</h3>
          <p className="text-xs text-slate-500">
            Insira o seu número de WhatsApp associado à conta corporativa. O sistema irá automaticamente localizá-lo e conectá-arlo à sua conta.
          </p>
          
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-2">
              <Label>Número de Telemóvel</Label>
              <Input 
                placeholder="Ex: +351 912 345 678" 
                value={settings.phone_number}
                onChange={(e) => setSettings(prev => ({ ...prev, phone_number: e.target.value }))}
              />
            </div>
            <Button onClick={handleLinkNumber} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ligar Número
            </Button>
          </div>
        </div>

        {settings.phone_number_id && (
          <div className="flex items-center justify-between border rounded-md p-4 bg-white">
            <div className="space-y-0.5">
              <Label className="text-base">Ativar WhatsApp Agente IA</Label>
              <p className="text-sm text-slate-500">
                Permite o envio e receção de mensagens automáticas com a IA
              </p>
            </div>
            <Switch 
              checked={settings.is_active} 
              onCheckedChange={handleToggleActive} 
            />
          </div>
        )}
      </div>
    </div>
  );
}