import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, ExternalLink, Radio } from "lucide-react";

/**
 * Conversions API para Lead Ads — configuração opcional, por página ligada.
 *
 * NÃO afeta a receção de leads (isso já funciona sem isto). É o feedback que
 * a Meta pede para otimizar a entrega dos anúncios: avisa que um lead foi
 * recebido, com o email/telefone com hash. Sem isto configurado, os leads
 * continuam a chegar exatamente na mesma.
 */
export function MetaCapiSettings({ integrationId }: { integrationId: string }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [datasetId, setDatasetId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    void loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integrationId]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("meta_integrations" as any)
        .select("capi_dataset_id, capi_access_token")
        .eq("id", integrationId)
        .maybeSingle();

      if (error) throw error;

      setDatasetId((data as any)?.capi_dataset_id || "");
      setHasToken(!!(data as any)?.capi_access_token);
      setAccessToken(""); // nunca mostra o token guardado, só se foi definido
    } catch (error) {
      console.error("Erro ao carregar definições da Conversions API:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const patch: Record<string, any> = { capi_dataset_id: datasetId.trim() || null };
      // Só substitui o token se escreveste um novo — em branco mantém o que
      // já lá está (não obrigamos a reintroduzi-lo só para mudar o Dataset ID).
      if (accessToken.trim()) {
        patch.capi_access_token = accessToken.trim();
      }

      const { error } = await supabase
        .from("meta_integrations" as any)
        .update(patch)
        .eq("id", integrationId);

      if (error) throw error;

      toast({ title: "✅ Guardado", description: "A Conversions API vai ser usada nos próximos leads." });
      setAccessToken("");
      await loadSettings();
    } catch (error: any) {
      toast({ title: "Erro ao guardar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Radio className="h-4 w-4" />
          Conversions API (opcional)
        </CardTitle>
        <CardDescription>
          Avisa a Meta de que um lead foi recebido — ajuda a otimizar a entrega dos anúncios. Os leads
          continuam a chegar ao CRM sem isto configurado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            <div className="rounded-md border border-blue-200 bg-blue-50/50 p-2.5 text-xs text-blue-900">
              No{" "}
              <a
                href="https://business.facebook.com/events_manager2/list/dataset"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium inline-flex items-center gap-0.5"
              >
                Events Manager
                <ExternalLink className="h-3 w-3" />
              </a>{" "}
              → Fontes de Dados → Definições → Conversions API, copia o Dataset ID e gera um token de
              acesso (o de utilizador de sistema, no Business Manager, é o mais estável).
            </div>

            <div className="space-y-2">
              <Label>Dataset ID</Label>
              <Input
                value={datasetId}
                onChange={(e) => setDatasetId(e.target.value)}
                placeholder="Ex: 123456789012345"
              />
            </div>

            <div className="space-y-2">
              <Label>
                Token de acesso {hasToken && <Badge variant="outline" className="ml-1 text-[10px]">já configurado</Badge>}
              </Label>
              <Input
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder={hasToken ? "Deixa em branco para manter o atual" : "Cola aqui o token gerado"}
              />
            </div>

            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Guardar
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
