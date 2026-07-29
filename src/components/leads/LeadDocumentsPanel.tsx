import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FileText, Upload, Download, Trash2, Loader2 } from "lucide-react";
import {
  getDocuments,
  uploadDocument,
  getDocumentDownloadUrl,
  deleteDocument,
  type DocumentRecord,
} from "@/services/documentsService";

/**
 * Documentos que o proprietário envia para o processo de estudo de mercado
 * (cadernetas prediais, certidões, plantas…). Reutiliza o `documentsService`
 * (bucket privado "documents", associação por `lead_id`, URLs assinadas
 * temporárias) — nada disto fica público, por serem dados sensíveis (RGPD).
 */

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function LeadDocumentsPanel({ leadId }: { leadId: string }) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setDocs(await getDocuments({ leadId }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    let ok = 0;
    for (const file of Array.from(files)) {
      const result = await uploadDocument(file, { leadId });
      if (result.success) ok++;
      else {
        toast({
          title: `Falha em "${file.name}"`,
          description: result.error,
          variant: "destructive",
        });
      }
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    if (ok > 0) {
      toast({ title: `${ok} documento(s) carregado(s).` });
      await load();
    }
  };

  const handleDownload = async (doc: DocumentRecord) => {
    setBusyId(doc.id);
    try {
      const url = await getDocumentDownloadUrl(doc.file_path);
      if (url) window.open(url, "_blank", "noopener");
      else toast({ title: "Erro", description: "Não foi possível abrir o documento.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (doc: DocumentRecord) => {
    if (!window.confirm(`Apagar "${doc.name}"? Esta ação não pode ser revertida.`)) return;
    setBusyId(doc.id);
    try {
      const result = await deleteDocument(doc.id, doc.file_path);
      if (result.success) {
        setDocs((current) => current.filter((d) => d.id !== doc.id));
        toast({ title: "Documento apagado." });
      } else {
        toast({ title: "Erro", description: result.error, variant: "destructive" });
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
        className="hidden"
        onChange={(event) => handleFiles(event.target.files)}
      />

      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-medium">Documentos</h3>
          <p className="text-sm text-gray-500">
            Cadernetas prediais, certidões e outros documentos que o proprietário enviou para o
            estudo de mercado.
          </p>
        </div>
        <Button size="sm" className="shrink-0" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          Adicionar
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg border border-dashed">
          <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">
            Ainda não há documentos. Carregue as cadernetas prediais e outros ficheiros do proprietário.
          </p>
          <p className="text-xs mt-1">PDF, Word, JPEG, PNG ou WebP · até 15 MB.</p>
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 p-3">
              <FileText className="h-5 w-5 shrink-0 text-indigo-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{doc.name}</p>
                <p className="text-xs text-gray-500">
                  {formatSize(doc.file_size)}
                  {doc.created_at ? ` · ${new Date(doc.created_at).toLocaleDateString("pt-PT")}` : ""}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                title="Descarregar"
                disabled={busyId === doc.id}
                onClick={() => handleDownload(doc)}
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Apagar"
                disabled={busyId === doc.id}
                onClick={() => handleDelete(doc)}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
