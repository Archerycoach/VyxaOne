import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Loader2, FileSpreadsheet, AlertTriangle, CheckCircle2, CalendarClock } from "lucide-react";

/**
 * Importação de leads a partir de exportações de outros CRMs.
 *
 * Duas fases: o ficheiro é analisado e mostrado o resumo; só depois de o
 * consultor confirmar é que se grava. Importar centenas de leads sem
 * pré-visualização seria difícil de desfazer.
 */

interface Preview {
  format: string;
  totalRows: number;
  toCreate: number;
  toUpdate: number;
  skipped: number;
  skippedReasons?: Record<string, number>;
  activities: number;
  /** Leads já existentes cuja data de criação vai ser corrigida para a real. */
  datesCorrected?: number;
  sample?: Array<{ name: string; email: string | null; created_at: string | null; activities: number }>;
}

const FORMAT_LABELS: Record<string, string> = {
  leads_maxwork: "Leads (MaxWork)",
  oportunidades: "Oportunidades",
};

interface ImportLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export function ImportLeadsDialog({ open, onOpenChange, onImported }: ImportLeadsDialogProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileData, setFileData] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);

  const reset = () => {
    setFileName(null);
    setFileData(null);
    setPreview(null);
  };

  const call = async (base64: string, apply: boolean) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Sessão expirada. Volta a entrar.");

    const response = await fetch("/api/gpt/leads/import-spreadsheet", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ fileBase64: base64, apply }),
    });
    const data = await response.json();
    if (!response.ok) {
      // Quando o formato não é reconhecido, o servidor devolve as colunas que
      // encontrou. Mostrá-las evita ter de pedir o ficheiro para diagnosticar.
      if (data.columnsFound?.length) {
        throw new Error(
          `${data.error}\n\nColunas encontradas: ${data.columnsFound.join(" · ")}` +
            (data.sheets?.length > 1 ? `\nFolhas: ${data.sheets.join(", ")}` : "")
        );
      }
      throw new Error(data.error || "Erro ao processar o ficheiro.");
    }
    return data;
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      toast({
        title: "Ficheiro demasiado grande",
        description: "O limite é 20 MB.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setFileName(file.name);
      setFileData(base64);
      setPreview(null);
      setAnalysing(true);
      try {
        setPreview(await call(base64, false));
      } catch (error) {
        toast({
          title: "Não foi possível ler",
          description: error instanceof Error ? error.message : "Tenta outro ficheiro.",
          variant: "destructive",
          duration: 20000, // as colunas encontradas são longas: dá tempo de ler/copiar
        });
        reset();
      } finally {
        setAnalysing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleImport = async () => {
    if (!fileData) return;
    setImporting(true);
    try {
      const result = await call(fileData, true);
      toast({
        title: "Importação concluída",
        description:
          `${result.created} criada(s), ${result.updated} atualizada(s)` +
          (result.datesCorrected ? `, ${result.datesCorrected} com data corrigida` : "") +
          (result.interactions ? `, ${result.interactions} interações` : "") + ".",
      });
      onImported();
      onOpenChange(false);
      reset();
    } catch (error) {
      toast({
        title: "Erro na importação",
        description: error instanceof Error ? error.message : "Tenta novamente.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar leads de outro CRM</DialogTitle>
          <DialogDescription>
            Aceita as exportações de <strong>Leads (MaxWork)</strong> e de{" "}
            <strong>Oportunidades</strong>, em Excel. O formato é reconhecido automaticamente.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={handleFile}
        />

        {!preview && (
          <Button
            variant="outline"
            className="h-28 border-dashed"
            onClick={() => inputRef.current?.click()}
            disabled={analysing}
          >
            {analysing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                A analisar {fileName}…
              </>
            ) : (
              <>
                <Upload className="mr-2 h-5 w-5" />
                Escolher ficheiro
              </>
            )}
          </Button>
        )}

        {preview && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              <span className="truncate font-medium">{fileName}</span>
              <Badge variant="outline">{FORMAT_LABELS[preview.format] || preview.format}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Stat label="Leads novas" value={preview.toCreate} tone="green" />
              <Stat label="A atualizar" value={preview.toUpdate} tone="blue" />
              <Stat label="Interações de histórico" value={preview.activities} tone="purple" />
              <Stat label="Ignoradas" value={preview.skipped} tone="gray" />
            </div>

            {!!preview.datesCorrected && preview.datesCorrected > 0 && (
              <div className="flex gap-2 rounded-md border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900">
                <CalendarClock className="h-4 w-4 shrink-0" />
                <span>
                  <strong>{preview.datesCorrected}</strong> lead(s) já existentes vão ter a data de
                  criação corrigida para a data real de origem. Passam a ocupar o lugar certo na
                  lista e voltam a entrar na reativação de leads frias.
                </span>
              </div>
            )}

            {preview.skipped > 0 && preview.skippedReasons && (
              <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <div>
                  {Object.entries(preview.skippedReasons).map(([reason, count]) => (
                    <div key={reason}>
                      {count} × {reason}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-md border p-3 text-sm">
              <p className="mb-2 flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Como vai ser importado
              </p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• As leads entram com a <strong>data original</strong>, no seu lugar na lista.</li>
                <li>• Leads que já existam são atualizadas <strong>só nos campos vazios</strong>, mas a <strong>data de criação é corrigida</strong> se a do ficheiro for anterior.</li>
                <li>• O histórico entra como interações, sem duplicar se repetires.</li>
              </ul>
            </div>

            {preview.sample && preview.sample.length > 0 && (
              <div className="divide-y rounded-md border text-sm">
                {preview.sample.map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="truncate">
                      {s.name}
                      {s.email && <span className="text-muted-foreground"> · {s.email}</span>}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {s.created_at ? new Date(s.created_at).toLocaleDateString("pt-PT") : "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            Cancelar
          </Button>
          {preview && (
            <>
              <Button variant="outline" onClick={reset} disabled={importing}>
                Outro ficheiro
              </Button>
              <Button onClick={handleImport} disabled={importing || preview.toCreate + preview.toUpdate === 0}>
                {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Importar {preview.toCreate + preview.toUpdate} lead(s)
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  const tones: Record<string, string> = {
    green: "bg-green-50 text-green-800 border-green-200",
    blue: "bg-blue-50 text-blue-800 border-blue-200",
    purple: "bg-purple-50 text-purple-800 border-purple-200",
    gray: "bg-gray-50 text-gray-700 border-gray-200",
  };
  return (
    <div className={`rounded-md border p-3 ${tones[tone] || tones.gray}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs">{label}</div>
    </div>
  );
}
