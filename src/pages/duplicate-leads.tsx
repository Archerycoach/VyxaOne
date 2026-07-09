import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import {
  findDuplicateLeadGroups,
  mergeLeads,
  type DuplicateLeadGroup,
} from "@/services/duplicateLeadsService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, Merge, Users2 } from "lucide-react";

export default function DuplicateLeadsPage() {
  const router = useRouter();
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<DuplicateLeadGroup[]>([]);
  const [selectedPrimary, setSelectedPrimary] = useState<Record<string, string>>({});
  const [mergingKey, setMergingKey] = useState<string | null>(null);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile && (profile.role === "admin" || profile.role === "broker" || profile.role === "team_lead")) {
        setHasAccess(true);
        await loadGroups();
      } else {
        router.push("/leads");
      }
    } catch (error) {
      console.error("[DuplicateLeads] Error checking access:", error);
      router.push("/leads");
    } finally {
      setLoading(false);
    }
  };

  const loadGroups = async () => {
    setLoading(true);
    try {
      const found = await findDuplicateLeadGroups();
      setGroups(found);
      const defaults: Record<string, string> = {};
      found.forEach((group) => {
        defaults[group.key] = group.leads[0].id;
      });
      setSelectedPrimary(defaults);
    } catch (error) {
      console.error("[DuplicateLeads] Error loading duplicate groups:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMerge = async (group: DuplicateLeadGroup) => {
    const primaryId = selectedPrimary[group.key];
    if (!primaryId) return;

    const duplicateIds = group.leads.map((l) => l.id).filter((id) => id !== primaryId);
    if (duplicateIds.length === 0) return;

    if (!confirm(
      `Vais fundir ${duplicateIds.length} lead(s) na lead selecionada. O histórico (notas, interações, tarefas, documentos, negócios) passa todo para ela; as restantes ficam arquivadas, não são apagadas. Continuar?`
    )) {
      return;
    }

    setMergingKey(group.key);
    try {
      for (const duplicateId of duplicateIds) {
        await mergeLeads(primaryId, duplicateId);
      }
      await loadGroups();
    } catch (error: any) {
      console.error("[DuplicateLeads] Error merging leads:", error);
      alert(`Erro ao fundir leads: ${error.message || error}`);
    } finally {
      setMergingKey(null);
    }
  };

  if (loading) {
    return (
      <Layout title="Leads Duplicadas">
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </Layout>
    );
  }

  if (!hasAccess) return null;

  return (
    <Layout title="Leads Duplicadas">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Leads Duplicadas</h1>
            <p className="text-gray-600 mt-1">
              Leads com o mesmo telefone ou email. Escolhe qual manter e funde as restantes — nada é apagado, ficam arquivadas.
            </p>
          </div>

          {groups.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <Users2 className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                Não foram encontradas leads duplicadas.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {groups.map((group) => (
                <Card key={group.key}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Badge variant="secondary">{group.leads.length} leads</Badge>
                      Possível duplicado
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RadioGroup
                      value={selectedPrimary[group.key]}
                      onValueChange={(value) =>
                        setSelectedPrimary((prev) => ({ ...prev, [group.key]: value }))
                      }
                      className="space-y-3"
                    >
                      {group.leads.map((lead) => (
                        <div key={lead.id} className="flex items-start gap-3 border rounded-lg p-3">
                          <RadioGroupItem value={lead.id} id={`${group.key}-${lead.id}`} className="mt-1" />
                          <Label htmlFor={`${group.key}-${lead.id}`} className="flex-1 cursor-pointer">
                            <div className="font-medium text-gray-900">{lead.name}</div>
                            <div className="text-sm text-gray-500 flex flex-wrap gap-x-4">
                              {lead.phone && <span>📞 {lead.phone}</span>}
                              {lead.email && <span>✉️ {lead.email}</span>}
                              {lead.created_at && (
                                <span>Criada em {new Date(lead.created_at).toLocaleDateString("pt-PT")}</span>
                              )}
                              {(lead as any).assigned_user?.full_name && (
                                <span>Consultor: {(lead as any).assigned_user.full_name}</span>
                              )}
                            </div>
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>

                    <div className="mt-4 flex justify-end">
                      <Button
                        onClick={() => handleMerge(group)}
                        disabled={mergingKey === group.key}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {mergingKey === group.key ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            A fundir...
                          </>
                        ) : (
                          <>
                            <Merge className="h-4 w-4 mr-2" />
                            Fundir nesta lead
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
