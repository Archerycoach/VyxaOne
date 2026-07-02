import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  FolderOpen,
  Upload,
  Search,
  MoreVertical,
  Download,
  Trash2,
  Eye,
  File,
  Loader2,
  Paperclip,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  type DocumentRecord,
  getDocuments,
  uploadDocument,
  getDocumentDownloadUrl,
  deleteDocument,
} from "@/services/documentsService";

const CATEGORY_TAGS = [
  { value: "all", label: "Todos os Ficheiros", icon: FolderOpen },
  { value: "contrato", label: "Contratos", icon: FileText },
  { value: "escritura", label: "Escrituras", icon: FileText },
  { value: "documento-id", label: "Documentos ID", icon: FileText },
];

interface LeadOption {
  id: string;
  name: string;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-PT");
}

export default function DocumentsPage() {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedTag, setSelectedTag] = useState<string>("contrato");
  const [selectedLeadId, setSelectedLeadId] = useState<string>("none");
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [uploading, setUploading] = useState(false);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    const data = await getDocuments({ search: searchQuery || undefined });
    setDocuments(data);
    setLoading(false);
  }, [searchQuery]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    const loadLeads = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("leads")
        .select("id, name")
        .eq("user_id", user.id)
        .order("name", { ascending: true })
        .limit(200);
      setLeads((data || []) as LeadOption[]);
    };
    loadLeads();
  }, []);

  const filteredDocs = documents.filter((doc) =>
    selectedCategory === "all" ? true : (doc.tags || []).includes(selectedCategory)
  );

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({ title: "Escolha um ficheiro primeiro", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const result = await uploadDocument(selectedFile, {
        leadId: selectedLeadId === "none" ? null : selectedLeadId,
        tags: [selectedTag],
      });
      if (!result.success) throw new Error(result.error);

      toast({ title: "✅ Documento enviado" });
      setUploadDialogOpen(false);
      setSelectedFile(null);
      setSelectedLeadId("none");
      loadDocuments();
    } catch (error: any) {
      toast({ title: "Erro ao enviar documento", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleView = async (doc: DocumentRecord) => {
    const url = await getDocumentDownloadUrl(doc.file_path);
    if (url) window.open(url, "_blank");
    else toast({ title: "Erro ao abrir documento", variant: "destructive" });
  };

  const handleDownload = async (doc: DocumentRecord) => {
    const url = await getDocumentDownloadUrl(doc.file_path);
    if (!url) {
      toast({ title: "Erro ao gerar link de download", variant: "destructive" });
      return;
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.name;
    a.click();
  };

  const handleDelete = async (doc: DocumentRecord) => {
    if (!confirm(`Apagar "${doc.name}"? Esta ação não pode ser desfeita.`)) return;
    const result = await deleteDocument(doc.id, doc.file_path);
    if (result.success) {
      toast({ title: "Documento apagado" });
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } else {
      toast({ title: "Erro ao apagar", description: result.error, variant: "destructive" });
    }
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="p-8 bg-slate-50 min-h-screen">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Documentos 📁</h1>
              <p className="text-gray-500 mt-2">Gestão de arquivos e contratos</p>
            </div>
            <Button className="gap-2" onClick={() => setUploadDialogOpen(true)}>
              <Upload className="h-4 w-4" />
              Novo Documento
            </Button>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {/* Sidebar Filter */}
            <div className="col-span-12 md:col-span-3">
              <Card>
                <CardContent className="p-4 space-y-2">
                  {CATEGORY_TAGS.map((cat) => (
                    <Button
                      key={cat.value}
                      variant={selectedCategory === cat.value ? "secondary" : "ghost"}
                      className="w-full justify-start"
                      onClick={() => setSelectedCategory(cat.value)}
                    >
                      <cat.icon className="h-4 w-4 mr-2" />
                      {cat.label}
                    </Button>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Main Content */}
            <div className="col-span-12 md:col-span-9">
              <Card className="mb-6">
                <CardContent className="p-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Pesquisar documentos..."
                      className="pl-10"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : filteredDocs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
                  <File className="h-10 w-10 mb-2" />
                  <p className="text-sm">Nenhum documento encontrado.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredDocs.map((doc) => (
                    <Card key={doc.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="p-2 bg-blue-50 rounded-lg">
                            <File className="h-8 w-8 text-blue-600" />
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleView(doc)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Visualizar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDownload(doc)}>
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(doc)}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <h3 className="font-medium mt-4 truncate" title={doc.name}>
                          {doc.name}
                        </h3>

                        <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
                          <span>{formatFileSize(doc.file_size)}</span>
                          <span>{formatDate(doc.created_at)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Documento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Ficheiro</Label>
                <label
                  htmlFor="document-file-input"
                  className="flex items-center gap-2 border-2 border-dashed rounded-lg p-4 cursor-pointer hover:bg-gray-50 text-sm text-gray-600"
                >
                  <Paperclip className="h-4 w-4 shrink-0" />
                  {selectedFile ? selectedFile.name : "Clique para escolher um ficheiro (PDF, Word, JPEG, PNG — máx. 15MB)"}
                </label>
                <input
                  id="document-file-input"
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
              </div>

              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={selectedTag} onValueChange={setSelectedTag}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contrato">Contrato</SelectItem>
                    <SelectItem value="escritura">Escritura</SelectItem>
                    <SelectItem value="documento-id">Documento de Identificação</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Associar a uma Lead (opcional)</Label>
                <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem associação</SelectItem>
                    {leads.map((lead) => (
                      <SelectItem key={lead.id} value={lead.id}>{lead.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadDialogOpen(false)} disabled={uploading}>
                Cancelar
              </Button>
              <Button onClick={handleUpload} disabled={uploading || !selectedFile}>
                {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Enviar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Layout>
    </ProtectedRoute>
  );
}
