import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Link as LinkIcon, Unlink, FileText, CheckCircle2, Database, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export function NotionAccountConnection() {
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [databases, setDatabases] = useState<Array<{id: string, title: string}>>([]);
  const [isLoadingDatabases, setIsLoadingDatabases] = useState(false);
  
  // Mappings
  const [leadsDbId, setLeadsDbId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    checkConnection();
  }, []);

  const loadDatabases = async (userId: string) => {
    try {
      setIsLoadingDatabases(true);
      const res = await fetch(`/api/notion/databases?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setDatabases(data.databases || []);
      }
    } catch (error) {
      console.error("Error fetching Notion databases:", error);
    } finally {
      setIsLoadingDatabases(false);
    }
  };

  const loadMappings = async (userId: string) => {
    try {
      const { data, error } = await (supabase as any)
        .from('notion_mappings')
        .select('*')
        .eq('user_id', userId);
        
      if (error) throw error;
      
      if (data && data.length > 0) {
        const leadsMapping = data.find((m: any) => m.vyxa_entity === 'leads');
        if (leadsMapping) {
          setLeadsDbId(leadsMapping.notion_database_id);
        }
      }
    } catch (error) {
      console.error("Error loading Notion mappings:", error);
    }
  };

  const checkConnection = async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await (supabase as any)
        .from('notion_integrations')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (error) throw error;

      if (data && data.access_token) {
        setIsConnected(true);
        setWorkspaceName(data.workspace_name || "Workspace");
        
        // Load additional data if connected
        await Promise.all([
          loadDatabases(session.user.id),
          loadMappings(session.user.id)
        ]);
      } else {
        setIsConnected(false);
      }
    } catch (error) {
      console.error("Error checking Notion connection:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Erro de autenticação",
          description: "Precisa de iniciar sessão primeiro.",
          variant: "destructive"
        });
        return;
      }

      // Start OAuth flow
      window.location.href = `/api/notion/auth?userId=${session.user.id}`;
    } catch (error) {
      console.error("Error connecting to Notion:", error);
      toast({
        title: "Erro de ligação",
        description: "Não foi possível iniciar a ligação ao Notion.",
        variant: "destructive"
      });
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) return;

      const { error } = await (supabase as any)
        .from('notion_integrations')
        .delete()
        .eq('user_id', session.user.id);

      if (error) throw error;

      setIsConnected(false);
      setWorkspaceName(null);
      setDatabases([]);
      setLeadsDbId("");
      
      toast({
        title: "Desligado",
        description: "A ligação ao Notion foi removida com sucesso.",
      });
    } catch (error) {
      console.error("Error disconnecting from Notion:", error);
      toast({
        title: "Erro ao desligar",
        description: "Não foi possível remover a ligação.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveMappings = async () => {
    try {
      setIsSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      if (!leadsDbId) {
        toast({
          title: "Atenção",
          description: "Selecione uma base de dados para as Leads.",
          variant: "destructive"
        });
        return;
      }

      // Check if mapping exists
      const { data: existing } = await (supabase as any)
        .from('notion_mappings')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('vyxa_entity', 'leads')
        .maybeSingle();

      if (existing) {
        // Update
        const { error } = await (supabase as any)
          .from('notion_mappings')
          .update({ notion_database_id: leadsDbId, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        // Insert
        const { error } = await (supabase as any)
          .from('notion_mappings')
          .insert({
            user_id: session.user.id,
            vyxa_entity: 'leads',
            notion_database_id: leadsDbId,
            sync_enabled: true
          });
        if (error) throw error;
      }

      toast({
        title: "Sucesso",
        description: "Mapeamento guardado com sucesso.",
      });
    } catch (error) {
      console.error("Error saving mapping:", error);
      toast({
        title: "Erro ao guardar",
        description: "Não foi possível guardar as configurações.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Integração Notion
            </CardTitle>
            <CardDescription>
              Ligue o seu workspace do Notion para sincronizar Leads e Imóveis automaticamente.
            </CardDescription>
          </div>
          {isConnected && (
            <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Ligado
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : isConnected ? (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg border flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Workspace Ligado</p>
                <p className="text-sm text-gray-500">{workspaceName}</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleDisconnect} className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200">
                <Unlink className="h-4 w-4 mr-2" />
                Desligar
              </Button>
            </div>
            
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-slate-50 p-4 border-b">
                <h3 className="font-medium text-slate-900 flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Mapeamento de Dados
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Escolha para que Bases de Dados do Notion deseja enviar a informação do Vyxa.
                </p>
              </div>
              
              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  <Label>Base de Dados para Leads (Dossier de Cliente)</Label>
                  <Select value={leadsDbId} onValueChange={setLeadsDbId} disabled={isLoadingDatabases}>
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingDatabases ? "A carregar..." : "Selecione uma base de dados"} />
                    </SelectTrigger>
                    <SelectContent>
                      {databases.map((db) => (
                        <SelectItem key={db.id} value={db.id}>{db.title}</SelectItem>
                      ))}
                      {databases.length === 0 && !isLoadingDatabases && (
                        <SelectItem value="empty" disabled>Nenhuma base de dados encontrada</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">
                    Sempre que uma lead entrar no Vyxa, será criada uma página nesta Base de Dados do Notion.
                  </p>
                </div>
                
                <Button onClick={saveMappings} disabled={isSaving || !leadsDbId} className="w-full sm:w-auto">
                  {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Guardar Configurações
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-6 flex flex-col items-center justify-center text-center space-y-4 border-2 border-dashed rounded-lg bg-gray-50">
            <div className="p-3 bg-white rounded-full shadow-sm">
              <FileText className="h-6 w-6 text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Nenhuma conta Notion ligada</p>
              <p className="text-sm text-gray-500 max-w-sm mt-1">
                Ligue a sua conta para poder sincronizar os seus clientes e criar "Dossiers de Cliente" automaticamente.
              </p>
            </div>
            <Button onClick={handleConnect} className="bg-black hover:bg-gray-800 text-white">
              <LinkIcon className="h-4 w-4 mr-2" />
              Ligar ao Notion
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}