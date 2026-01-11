import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Plus, Upload, Download, Loader2 } from "lucide-react";
import { LeadFormContainer } from "@/features/leads/components/form";
import { LeadsListContainer } from "@/features/leads/components/LeadsListContainer";
import {
  getAllLeads,
  deleteLead,
  type LeadWithContacts,
} from "@/services/leadsService";
import { getCurrentUser } from "@/services/authService";
import { getTeamMembers } from "@/services/adminService";
import { Layout } from "@/components/Layout";
import {
  parseExcelFile,
  importLeads,
  generateLeadsTemplate,
  type ImportResult,
} from "@/services/importService";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Leads() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [leads, setLeads] = useState<LeadWithContacts[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingLead, setEditingLead] = useState<LeadWithContacts | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; full_name: string; email: string }>>([]);
  const [canAssignLeads, setCanAssignLeads] = useState(false);
  
  // Import state
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const checkAuth = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        router.push("/login");
        return;
      }
      setUser(currentUser);
      
      // Check if user can assign leads (admin or team_lead)
      const role = currentUser.role;
      setCanAssignLeads(role === "admin" || role === "team_lead");
      
      // Load team members for assignment dropdown
      if (role === "admin" || role === "team_lead") {
        const members = await getTeamMembers();
        setTeamMembers(members);
      }
    } catch (error) {
      console.error("Auth error:", error);
      router.push("/login");
    }
  };

  // Definir loadLeads ANTES de usar no useEffect
  const loadLeads = useCallback(async () => {
    console.log("[Leads Page] Loading leads...");
    
    try {
      setIsLoading(true);
      // Sempre bypassar cache para garantir dados frescos
      const data = await getAllLeads(false); 
      console.log("[Leads Page] Leads loaded successfully:", data.length);
      setLeads(data);
    } catch (error) {
      console.error("[Leads Page] Error loading leads:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      loadLeads();
    }
  }, [user, loadLeads]);

  const handleDeleteLead = async (id: string) => {
    if (!confirm("Tem certeza que deseja eliminar este lead?")) return;

    console.log("[Leads Page] Deleting lead:", id);
    
    try {
      setIsLoading(true);
      
      // Optimistic update
      setLeads(prev => prev.filter(lead => lead.id !== id));
      
      await deleteLead(id);
      console.log("[Leads Page] Lead deleted successfully");
      
      // Force fresh reload
      await loadLeads();
    } catch (error) {
      console.error("[Leads Page] Error deleting lead:", error);
      alert("Erro ao eliminar lead. Tente novamente.");
      // Reload on error
      await loadLeads();
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (lead: LeadWithContacts) => {
    console.log("[Leads Page] Editing lead:", lead.id);
    setEditingLead(lead);
    setShowForm(true);
  };

  const handleDownloadTemplate = () => {
    console.log("[Leads Page] Downloading template");
    generateLeadsTemplate();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log("[Leads Page] Importing file:", file.name);
    
    try {
      setIsImporting(true);
      setImportResult(null);

      const data = await parseExcelFile(file);
      
      if (data.length === 0) {
        alert("O ficheiro está vazio ou não contém dados válidos.");
        return;
      }

      const result = await importLeads(data);
      setImportResult(result);

      if (result.success > 0) {
        console.log("[Leads Page] Import successful, forcing refresh...");
        await loadLeads();
      }

      setShowImportDialog(true);
    } catch (error: any) {
      console.error("[Leads Page] Import error:", error);
      alert(`Erro ao importar ficheiro: ${error.message}`);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      console.log("[Leads Page] Import process complete");
    }
  };

  const handleFormSuccess = useCallback(async () => {
    console.log("[Leads Page] Form success, closing and refreshing...");
    
    setShowForm(false);
    setEditingLead(null);
    
    // Force fresh data load without cache
    await loadLeads();
  }, [loadLeads]);

  const handleFormCancel = () => {
    console.log("[Leads Page] Form cancelled");
    setShowForm(false);
    setEditingLead(null);
  };

  const handleRefresh = useCallback(async () => {
    console.log("[Leads Page] Manual refresh requested");
    await loadLeads();
  }, [loadLeads]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">A verificar autenticação...</p>
        </div>
      </div>
    );
  }

  return (
    <Layout title="Leads">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-8">
        {/* Loading Overlay - Only show during data fetching */}
        {isLoading && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-white rounded-lg p-6 shadow-xl flex items-center gap-4 pointer-events-auto">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              <p className="text-gray-700 font-medium">A atualizar dados...</p>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto">
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Leads</h1>
              <p className="text-gray-600 mt-1">Gerir potenciais clientes</p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleDownloadTemplate}
                variant="outline"
                className="border-purple-200 text-purple-600 hover:bg-purple-50"
                disabled={isImporting || isLoading}
              >
                <Download className="h-5 w-5 mr-2" />
                Template Excel
              </Button>
              
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="border-blue-200 text-blue-600 hover:bg-blue-50"
                disabled={isImporting || isLoading}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    A Importar...
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5 mr-2" />
                    Importar Excel
                  </>
                )}
              </Button>
              
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              <Button 
                onClick={() => setShowForm(true)} 
                className="bg-purple-600 hover:bg-purple-700"
                disabled={isImporting || isLoading}
              >
                <Plus className="h-5 w-5 mr-2" />
                Nova Lead
              </Button>
            </div>
          </div>

          {showForm && (
            <LeadFormContainer
              initialData={editingLead || undefined}
              onSuccess={handleFormSuccess}
              onCancel={handleFormCancel}
            />
          )}

          {!showForm && (
            <LeadsListContainer
              onEdit={handleEdit}
              canAssignLeads={canAssignLeads}
              teamMembers={teamMembers}
            />
          )}
        </div>
      </div>

      {/* Import Results Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Resultado da Importação</DialogTitle>
            <DialogDescription>
              Resumo da importação de leads
            </DialogDescription>
          </DialogHeader>

          {importResult && (
            <div className="space-y-4">
              {/* Success Summary */}
              <Alert className="border-green-200 bg-green-50">
                <AlertDescription className="text-green-800">
                  ✅ <strong>{importResult.success}</strong> de <strong>{importResult.total || 0}</strong> leads importadas com sucesso
                </AlertDescription>
              </Alert>

              {/* Errors */}
              {importResult.errors.length > 0 && (
                <div>
                  <h3 className="font-semibold text-red-600 mb-2">
                    ⚠️ {importResult.errors.length} erros encontrados:
                  </h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {importResult.errors.map((error, idx) => (
                      <Alert key={idx} className="border-red-200 bg-red-50">
                        <AlertDescription className="text-sm text-red-800">
                          <strong>Linha {error.row}:</strong> {error.error}
                          {error.data && (
                            <div className="mt-1 text-xs text-red-600">
                              Dados: {JSON.stringify(error.data, null, 2)}
                            </div>
                          )}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  onClick={() => setShowImportDialog(false)}
                  variant="outline"
                >
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}