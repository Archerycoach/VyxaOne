import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Save } from "lucide-react";

export function LeadSourceSettings() {
  const { toast } = useToast();
  const [sources, setSources] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newSource, setNewSource] = useState("");

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "lead_sources")
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setSources(data.value as unknown as string[]);
      } else {
        setSources([
          "Facebook", 
          "Instagram", 
          "Google", 
          "Recomendação", 
          "Portal Imobiliário", 
          "Website", 
          "Outro"
        ]);
      }
    } catch (error) {
      console.error("Error fetching lead sources:", error);
      toast({
        title: "Erro ao carregar configurações",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (updatedSources: string[]) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("system_settings")
        .upsert({
          key: "lead_sources",
          value: updatedSources as unknown as any, // Cast specific for string array to Json
          updated_at: new Date().toISOString()
        }, { onConflict: "key" });

      if (error) throw error;

      setSources(updatedSources);
      toast({
        title: "Configurações guardadas",
        description: "As origens das leads foram atualizadas.",
      });
    } catch (error) {
      console.error("Error saving lead sources:", error);
      toast({
        title: "Erro ao guardar",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const addSource = () => {
    if (!newSource.trim()) return;
    const updated = [...sources, newSource.trim()];
    handleSave(updated);
    setNewSource("");
  };

  const removeSource = (index: number) => {
    const updated = [...sources];
    updated.splice(index, 1);
    handleSave(updated);
  };

  if (isLoading) {
    return <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Origens das Leads</CardTitle>
        <CardDescription>Personalize as opções de origem para novas leads</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-2">
          <Input 
            value={newSource}
            onChange={(e) => setNewSource(e.target.value)}
            placeholder="Nova origem (ex: LinkedIn)"
            onKeyDown={(e) => e.key === 'Enter' && addSource()}
          />
          <Button onClick={addSource} disabled={isSaving || !newSource.trim()}>
            <Plus className="mr-2 h-4 w-4" /> Adicionar
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {sources.map((source, index) => (
            <div key={index} className="flex items-center justify-between p-3 border rounded-md bg-muted/20">
              <span className="font-medium">{source}</span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => removeSource(index)}
                disabled={isSaving}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}