import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Loader2, FileSpreadsheet, AlertTriangle, CheckCircle2, CalendarClock, Download } from "lucide-react";
import {
  parseExcelFile,
  importLeads,
  generateLeadsTemplate,
  type ImportResult,
} from "@/services/importService";

/**
 * Importação de leads — um só ponto de entrada para dois casos:
 *
 * 1. Exportações de OUTRO CRM (MaxWork/Oportunidades): formato reconhecido
 *    automaticamente pelo servidor, com pré-visualização antes de gravar.
 * 2. Qualquer outro Excel: se o formato não for reconhecido, cai-se no MODELO
 *    genérico da Vyxa (mesmo template do botão "Descarregar modelo").
 *
 * Em ambos há uma fase de análise antes de gravar — importar centenas de leads
 * sem confirmação seria difícil de desfazer.
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

/** Erro do passo de análise que distingue "formato não reconhecido" dos demais. */
class ImportAnalysisError extends Error {
  formatUnrecognized: boolean;
  constructor(message: string, formatUnrecognized: boolean) {
    super(message);
    this.formatUnrecognized = formatUnrecognized;
  }
}

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
  // Caminho CRM (MaxWork/Oportunidades): pré-visualização do servidor.
  const [preview, setPreview] = useState<Preview | null>(null);
  // Caminho genérico (modelo Vyxa): linhas lidas do Excel + resultado da gravação.
  const [genericRows, setGenericRows] = useState<any[] | null>(null);
  const [genericResult, setGenericResult] = useState<ImportResult | null>(null);

  const reset = () => {
    setFileName(null);
    setFileData(null);
    setPreview(null);
    setGenericRows(null);
    setGenericResult(null);
  };

  /** Chamada ao servidor para as exportações de outro CRM (deteta o formato). */
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
      // encontrou → é o sinal para cair no modelo genérico.
      if (data.columnsFound?.length) {
        throw new ImportAnalysisError(data.error || "Formato não reconhecido.", true);
      }
      throw new ImportAnalysisError(data.error || "Erro ao processar o ficheiro.", false);
    }
    return data;
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;

    if (picked.size > 20 * 1024 * 1024) {
      toast({ title: "Ficheiro demasiado grande", description: "O limite é 20 MB.", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setFileName(picked.name);
      setFileData(base64);
      setPreview(null);
      setGenericRows(null);
      setGenericResult(null);
      setAnalysing(true);
      try {
        // 1.ª tentativa: exportação de outro CRM (MaxWork/Oportunidades).
        setPreview(await call(base64, false));
      } catch (error) {
        if (error instanceof ImportAnalysisError && error.formatUnrecognized) {
          // 2.ª tentativa: modelo genérico da Vyxa (leitura local do Excel).
          try {
            const rows = await parseExcelFile(picked);
            if (!rows.length) {
              toast({ title: "Ficheiro vazio", description: "Não contém dados válidos.", variant: "destructive" });
              reset();
            } else {
              setGenericRows(rows);
            }
          } catch (parseError) {
            toast({
              title: "Não foi possível ler",
              description: parseError instanceof Error ? parseError.message : "Tenta outro ficheiro.",
              variant: "destructive",
            });
            reset();
          }
        } else {
          toast({
            title: "Não foi possível ler",
            description: error instanceof Error ? error.message : "Tenta outro ficheiro.",
            variant: "destructive",
            duration: 20000,
          });
          reset();
        }
      } finally {
        setAnalysing(false);
      }
    };
    reader.readAsDataURL(picked);
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      if (preview && fileData) {
        // Caminho CRM.
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
      } else if (genericRows) {
        // Caminho genérico (modelo Vyxa): grava e mostra o resumo no próprio dialog.
        const result = await importLeads(genericRows);
        setGenericResult(result);
        if (result.success > 0) onImported();
      }
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

  const hasSelection = !!preview || !!genericRows || !!genericResult;

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar leads</DialogTitle>
          <DialogDescription>
            Aceita exportações de <strong>Leads (MaxWork)</strong> e <strong>Oportunidades</strong> (formato
            reconhecido automaticamente) ou qualquer Excel no <strong>modelo da Vyxa</strong>.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={handleFile}
        />

        {/* Estado inicial: escolher ficheiro + descarregar o modelo. */}
        {!hasSelection && (
          <div className="space-y-3">
            <Button
              variant="outline"
              className="h-28 w-full border-dashed"
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
            <button
              type="button"
              onClick={() => generateLeadsTemplate()}
              className="mx-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Download className="h-3.5 w-3.5" />
              Não tens um ficheiro? Descarregar o modelo Excel da Vyxa
            </button>
          </div>
        )}

        {/* Caminho CRM: pré-visualização detalhada. */}
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

        {/* Caminho genérico: confirmação simples antes de gravar. */}
        {genericRows && !genericResult && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              <span className="truncate font-medium">{fileName}</span>
              <Badge variant="outline">Modelo Vyxa</Badge>
            </div>
            <div className="rounded-md border p-3 text-sm text-muted-foreground">
              O formato não foi reconhecido como uma exportação do MaxWork/Oportunidades. Vou importar
              pelo <strong>modelo genérico da Vyxa</strong>: <strong>{genericRows.length}</strong> linha(s).
              Confirma que as colunas seguem o modelo (usa o botão de descarregar o modelo se precisares).
            </div>
          </div>
        )}

        {/* Resultado da importação genérica. */}
        {genericResult && (
          <div className="space-y-3 text-sm">
            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-green-800">
              ✅ <strong>{genericResult.success}</strong> de <strong>{genericResult.total || 0}</strong> lead(s)
              importada(s) com sucesso.
            </div>
            {genericResult.warnings && genericResult.warnings.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
                ⚠️ {genericResult.warnings.length} aviso(s):
                <ul className="mt-1 max-h-32 space-y-0.5 overflow-auto">
                  {genericResult.warnings.map((w, idx) => (<li key={idx}>• {w}</li>))}
                </ul>
              </div>
            )}
            {genericResult.errors && genericResult.errors.length > 0 && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-800">
                ⚠️ {genericResult.errors.length} erro(s):
                <ul className="mt-1 max-h-32 space-y-0.5 overflow-auto">
                  {genericResult.errors.map((err: any, idx: number) => (
                    <li key={idx}>• <strong>Linha {err.line}:</strong> {err.error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {genericResult ? (
            <Button onClick={() => { onOpenChange(false); reset(); }}>Fechar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
                Cancelar
              </Button>
              {(preview || genericRows) && (
                <>
                  <Button variant="outline" onClick={reset} disabled={importing}>
                    Outro ficheiro
                  </Button>
                  {preview ? (
                    <Button onClick={handleImport} disabled={importing || preview.toCreate + preview.toUpdate === 0}>
                      {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Importar {preview.toCreate + preview.toUpdate} lead(s)
                    </Button>
                  ) : (
                    <Button onClick={handleImport} disabled={importing || !genericRows?.length}>
                      {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Importar {genericRows?.length || 0} lead(s)
                    </Button>
                  )}
                </>
              )}
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
