import { useEffect, useState, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Mail, CheckCircle2, XCircle, RefreshCw } from "lucide-react";

interface AutomatedEmailLogRow {
  id: string;
  lead_id: string | null;
  lead_name: string | null;
  source: string;
  to_email: string;
  subject: string;
  status: string;
  error_message: string | null;
  imap_saved: boolean;
  created_at: string;
}

const SOURCE_LABELS: Record<string, string> = {
  lead_reactivation: "Reativação de Leads",
  contact_alerts: "Alerta de Contacto/Oportunidade",
  property_matcher: "Property Matcher",
  workflow_automation: "Automação (Workflow)",
};

const PAGE_SIZE = 30;

export default function AutomatedEmailsPage() {
  const [rows, setRows] = useState<AutomatedEmailLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const fetchPage = useCallback(async (offset: number, append: boolean) => {
    if (append) setLoadingMore(true); else setLoading(true);

    try {
      // NOTA: "automated_email_log" só existe depois de correr a migração
      // supabase/migrations/20260701170020_*.sql e regenerar
      // database.types.ts. Até lá, usamos "as any" no nome da tabela — o
      // mesmo padrão já usado no resto do código para tabelas recentes.
      let query = (supabase
        .from("automated_email_log" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1) as any);

      if (sourceFilter !== "all") {
        query = query.eq("source", sourceFilter);
      }
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (search.trim()) {
        const term = `%${search.trim()}%`;
        query = query.or(`lead_name.ilike.${term},to_email.ilike.${term},subject.ilike.${term}`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const newRows = (data || []) as AutomatedEmailLogRow[];
      setRows((prev) => (append ? [...prev, ...newRows] : newRows));
      setHasMore(newRows.length === PAGE_SIZE);
    } catch (err) {
      console.error("Error fetching automated email log:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [sourceFilter, statusFilter, search]);

  useEffect(() => {
    fetchPage(0, false);
  }, [fetchPage]);

  return (
    <ProtectedRoute>
      <Layout>
        <div className="container mx-auto py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Emails Automáticos</h1>
              <p className="text-muted-foreground mt-2">
                Registo de todos os emails que a plataforma enviou automaticamente a leads/clientes
                — sem ação manual direta sua — incluindo os que falharam. Emails que enviou você
                próprio (Email IA, mensagens em massa) não aparecem aqui, pois já são visíveis na
                cronologia de cada lead.
              </p>
            </div>
            <Button variant="outline" onClick={() => fetchPage(0, false)} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
              <CardDescription>Filtre por origem, estado ou pesquise por lead/email/assunto.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="Pesquisar por lead, email ou assunto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="sm:max-w-xs"
              />
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="sm:w-56">
                  <SelectValue placeholder="Origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as origens</SelectItem>
                  {Object.entries(SOURCE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="sm:w-44">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os estados</SelectItem>
                  <SelectItem value="sent">Enviado</SelectItem>
                  <SelectItem value="failed">Falhou</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Para</TableHead>
                    <TableHead>Assunto</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-center">IMAP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        A carregar...
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        <Mail className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                        Ainda não há registos de emails automáticos.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {new Date(row.created_at).toLocaleString("pt-PT")}
                        </TableCell>
                        <TableCell className="font-medium">
                          {row.lead_name || "—"}
                        </TableCell>
                        <TableCell className="text-sm">{row.to_email}</TableCell>
                        <TableCell className="text-sm max-w-xs truncate" title={row.subject}>
                          {row.subject}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{SOURCE_LABELS[row.source] || row.source}</Badge>
                        </TableCell>
                        <TableCell>
                          {row.status === "sent" ? (
                            <Badge className="bg-green-100 text-green-700 border-green-200" variant="outline">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Enviado
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 border-red-200" variant="outline" title={row.error_message || undefined}>
                              <XCircle className="h-3 w-3 mr-1" /> Falhou
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.imap_saved ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {!loading && hasMore && (
                <div className="flex justify-center mt-4">
                  <Button
                    variant="outline"
                    onClick={() => fetchPage(rows.length, true)}
                    disabled={loadingMore}
                  >
                    {loadingMore ? "A carregar..." : "Carregar mais"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
