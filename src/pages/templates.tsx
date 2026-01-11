import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit2, Copy, Search } from "lucide-react";
import { 
  getTemplates, 
  createTemplate, 
  updateTemplate, 
  deleteTemplate 
} from "@/services/templateService";
import type { Database } from "@/integrations/supabase/types";

type Template = Database["public"]["Tables"]["templates"]["Row"];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  
  // Edit/Create state
  const [isEditing, setIsEditing] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<Partial<Template>>({
    name: "",
    subject: "",
    body: "",
    template_type: "email"
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await getTemplates();
      setTemplates(data);
    } catch (error) {
      console.error(error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os templates.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Cast state to any to check properties safely
    const data = currentTemplate as any;
    if (!data.name || !data.body) { // Use body as primary content field
      toast({
        title: "Erro",
        description: "Por favor preencha o nome e o conteúdo",
        variant: "destructive",
      });
      return;
    }

    try {
      if (data.id) {
        await updateTemplate(data.id, {
          name: data.name,
          subject: data.subject,
          body: data.body, // Use body
          template_type: data.template_type,
        } as any);
        toast({ title: "Template atualizado com sucesso" });
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await createTemplate({
          user_id: user.id,
          name: data.name,
          subject: data.subject || "",
          body: data.body, // Use body
          template_type: data.template_type || "email"
        } as any);
        toast({ title: "Template criado com sucesso" });
      }

      setIsEditing(false);
      setCurrentTemplate({ name: "", subject: "", body: "", template_type: "email" } as any); // Reset with body
      loadTemplates();
    } catch (error) {
      console.error(error);
      toast({
        title: "Erro",
        description: "Erro ao guardar template.",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem a certeza que deseja eliminar este template?")) return;
    try {
      await deleteTemplate(id);
      setTemplates(templates.filter(t => t.id !== id));
      toast({ title: "Template eliminado" });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao eliminar template.",
        variant: "destructive"
      });
    }
  };

  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.subject?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout>
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Templates</h1>
            <p className="text-slate-500 mt-1">Gerir modelos de mensagens e emails</p>
          </div>
          <Button onClick={() => {
            setCurrentTemplate({ name: "", subject: "", body: "", template_type: "email" });
            setIsEditing(true);
          }}>
            <Plus className="mr-2 h-4 w-4" /> Novo Template
          </Button>
        </div>

        {isEditing ? (
          <Card>
            <CardHeader>
              <CardTitle>{currentTemplate.id ? "Editar Template" : "Novo Template"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Template</Label>
                  <Input 
                    value={currentTemplate.name}
                    onChange={e => setCurrentTemplate({...currentTemplate, name: e.target.value})}
                    placeholder="Ex: Email de Boas-vindas"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={currentTemplate.template_type} // Fixed: type -> template_type
                    onChange={e => setCurrentTemplate({...currentTemplate, template_type: e.target.value as any})}
                  >
                    <option value="email">Email</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="sms">SMS</option>
                  </select>
                </div>
              </div>

              {currentTemplate.template_type === "email" && (
                <div className="space-y-2">
                  <Label>Assunto</Label>
                  <Input 
                    value={currentTemplate.subject || ""}
                    onChange={e => setCurrentTemplate({...currentTemplate, subject: e.target.value})}
                    placeholder="Assunto do email"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Conteúdo</Label>
                <Textarea 
                  className="min-h-[200px]"
                  value={(currentTemplate as any).body || ""} 
                  onChange={e => setCurrentTemplate({...currentTemplate, body: e.target.value} as any)}
                  placeholder="Escreva aqui o conteúdo..."
                />
                <p className="text-xs text-slate-500">
                  Variáveis disponíveis: {'{{name}}'}, {'{{email}}'}, {'{{phone}}'}
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditing(false)}>Cancelar</Button>
                <Button onClick={handleSave}>Guardar</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input 
                className="pl-10"
                placeholder="Pesquisar templates..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            <Tabs defaultValue="email">
              <TabsList>
                <TabsTrigger value="email">Emails</TabsTrigger>
                <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
                <TabsTrigger value="sms">SMS</TabsTrigger>
              </TabsList>
              
              {["email", "whatsapp", "sms"].map(type => (
                <TabsContent key={type} value={type} className="space-y-4">
                  {filteredTemplates.filter(t => t.template_type === type).length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      Nenhum template encontrado para {type}.
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredTemplates.filter(t => t.template_type === type).map(template => (
                        <Card key={template.id}>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex justify-between">
                              {template.name}
                              <div className="flex gap-1">
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => {
                                  setCurrentTemplate(template);
                                  setIsEditing(true);
                                }}>
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => handleDelete(template.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </CardTitle>
                            {template.subject && (
                              <CardDescription className="line-clamp-1">
                                {template.subject}
                              </CardDescription>
                            )}
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-slate-600 line-clamp-3 whitespace-pre-wrap">
                              {template.body}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </div>
        )}
      </div>
    </Layout>
  );
}