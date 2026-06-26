import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Play, ShieldAlert, ArchiveX, PhoneForwarded } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface ReactivationLead {
  id: string;
  name: string;
  phone: string | null;
  status: string;
  follow_up_state: string;
  archive_reason: string | null;
  created_at: string;
  has_consent?: boolean;
}

export default function ReactivationPanel() {
  const [leads, setLeads] = useState<ReactivationLead[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [reactivating, setReactivating] = useState(false);
  const { toast } = useToast();

  const fetchLeads = async () => {
    setLoading(true);
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;

    if (!userId) return;

    // Fetch old leads or archived leads to consider for reactivation
    const { data, error } = await (supabase as any)
      .from("leads")
      .select(`
        id, name, phone, status, follow_up_state, archive_reason, created_at,
        lead_consents(status)
      `)
      .in("follow_up_state", ["no_reply", "archived", "opt_out", "reengagement"])
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
    } else if (data) {
      const formatted = data.map((l: any) => ({
        ...l,
        has_consent: !l.lead_consents?.some((c: any) => c.status === 'revoked')
      }));
      setLeads(formatted);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedLeads(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleAll = (filteredLeads: ReactivationLead[]) => {
    if (selectedLeads.length === filteredLeads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(filteredLeads.map(l => l.id));
    }
  };

  const handleReactivateBatch = async () => {
    if (selectedLeads.length === 0) return;
    
    setReactivating(true);
    const { data: session } = await supabase.auth.getSession();
    
    try {
      const res = await fetch("/api/whatsapp/reactivate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.session?.access_token}`
        },
        body: JSON.stringify({
          leadIds: selectedLeads,
          templateName: "voltar_ao_radar"
        })
      });

      const data = await res.json();
      
      if (res.ok) {
        toast({
          title: "Lote processado",
          description: `${data.results.success} enviados, ${data.results.skippedNoConsent} ignorados (Sem Opt-in).`,
        });
        setSelectedLeads([]);
        fetchLeads(); // refresh
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setReactivating(false);
    }
  };

  const archivedLeads = leads.filter(l => l.follow_up_state === 'archived' || l.follow_up_state === 'opt_out');
  const candidates = leads.filter(l => l.follow_up_state !== 'archived' && l.follow_up_state !== 'opt_out' && l.has_consent);

  return (
    <ProtectedRoute>
      <Layout>
        <div className="container mx-auto py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Painel de Reativação</h1>
              <p className="text-muted-foreground mt-2">
                Reengaje leads adormecidas e gira o pipeline de arquivo seguindo regras de RGPD.
              </p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Candidatos a Reativação</CardTitle>
                <PhoneForwarded className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{candidates.length}</div>
                <p className="text-xs text-muted-foreground">Com opt-in válido</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Arquivadas / Opt-outs</CardTitle>
                <ArchiveX className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{archivedLeads.length}</div>
                <p className="text-xs text-muted-foreground">Leads paradas</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Proteção RGPD</CardTitle>
                <ShieldAlert className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-sm">Ativa</div>
                <p className="text-xs text-muted-foreground">Bloqueio automático s/ consentimento</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="candidates" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="candidates">Pipeline de Reativação</TabsTrigger>
              <TabsTrigger value="archived">Arquivo & Opt-outs</TabsTrigger>
            </TabsList>
            
            <TabsContent value="candidates">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Leads Adormecidas</CardTitle>
                    <CardDescription>Leads paradas mas com consentimento ativo.</CardDescription>
                  </div>
                  <Button 
                    onClick={handleReactivateBatch} 
                    disabled={selectedLeads.length === 0 || reactivating}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    {reactivating ? "A enviar..." : `Reativar Lote (${selectedLeads.length})`}
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox 
                            checked={candidates.length > 0 && selectedLeads.length === candidates.length}
                            onCheckedChange={() => toggleAll(candidates)}
                          />
                        </TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Estado Atual</TableHead>
                        <TableHead>Data Criação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow><TableCell colSpan={5} className="text-center">A carregar...</TableCell></TableRow>
                      ) : candidates.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma lead candidata.</TableCell></TableRow>
                      ) : (
                        candidates.map(lead => (
                          <TableRow key={lead.id}>
                            <TableCell>
                              <Checkbox 
                                checked={selectedLeads.includes(lead.id)}
                                onCheckedChange={() => toggleSelect(lead.id)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{lead.name}</TableCell>
                            <TableCell>{lead.phone || "S/ Telefone"}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{lead.follow_up_state}</Badge>
                            </TableCell>
                            <TableCell>{new Date(lead.created_at).toLocaleDateString("pt-PT")}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="archived">
              <Card>
                <CardHeader>
                  <CardTitle>Histórico de Arquivo</CardTitle>
                  <CardDescription>Leads removidas via Opt-out ou timeout da cadência.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Motivo do Arquivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {archivedLeads.length === 0 ? (
                        <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Arquivo vazio.</TableCell></TableRow>
                      ) : (
                        archivedLeads.map(lead => (
                          <TableRow key={lead.id}>
                            <TableCell className="font-medium">{lead.name}</TableCell>
                            <TableCell>
                              <Badge variant={lead.follow_up_state === 'opt_out' ? 'destructive' : 'secondary'}>
                                {lead.follow_up_state}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {lead.archive_reason || "Não especificado"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

        </div>
      </Layout>
    </ProtectedRoute>
  );
}