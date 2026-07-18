import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FileScan, Loader2, AlertTriangle } from "lucide-react";

/**
 * Lê caderneta predial / certificado energético / CPCV e propõe os campos
 * extraídos para a ficha do imóvel.
 *
 * O consultor revê SEMPRE antes de aplicar: um OCR mal lido num documento
 * legal é pior do que um campo vazio.
 */

type DocumentKind = "auto" | "caderneta" | "energia" | "cpcv";

const KIND_LABELS: Record<DocumentKind, string> = {
  auto: "Detetar automaticamente",
  caderneta: "Caderneta predial",
  energia: "Certificado energético",
  cpcv: "CPCV",
};

const FIELD_LABELS: Record<string, string> = {
  address: "Morada",
  city: "Concelho",
  district: "Distrito",
  postal_code: "Código postal",
  property_type: "Tipo de imóvel",
  typology: "Tipologia",
  area: "Área (m²)",
  bedrooms: "Quartos",
  bathrooms: "Casas de banho",
  energy_rating: "Classe energética",
  price: "Preço",
  year_built: "Ano de construção",
  matrix_article: "Artigo matricial",
  taxable_value: "Valor patrimonial",
};

const CONFIDENCE_META: Record<string, { label: string; className: string }> = {
  alta: { label: "Leitura fiável", className: "bg-green-100 text-green-800" },
  media: { label: "Confirma os valores", className: "bg-amber-100 text-amber-800" },
  baixa: { label: "Leitura duvidosa", className: "bg-red-100 text-red-800" },
};

interface PropertyDocumentScannerProps {
  /** Recebe os campos confirmados pelo consultor para preencher o formulário. */
  onApply: (fields: Record<string, unknown>) => void;
}

export function PropertyDocumentScanner({ onApply }: PropertyDocumentScannerProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<DocumentKind>("auto");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState<Record<string, unknown> | null>(null);
  const [confidence, setConfidence] = useState<string>("baixa");
  const [documentType, setDocumentType] = useState<string>("");
  const [notes, setNotes] = useState<string | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Ficheiro inválido",
        description: "Envia uma fotografia ou imagem do documento.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => extract(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const extract = async (imageBase64: string) => {
    setOpen(true);
    setLoading(true);
    setFields(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/gpt/properties/extract-from-document", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ imageBase64, kind }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setFields(data.fields);
      setConfidence(data.confidence);
      setDocumentType(data.documentType);
      setNotes(data.notes);
    } catch (err: any) {
      toast({ title: "Não foi possível ler", description: err.message, variant: "destructive" });
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const apply = () => {
    if (!fields) return;
    onApply(fields);
    setOpen(false);
    setFields(null);
    toast({
      title: "Campos preenchidos",
      description: "Confirma os valores antes de guardar o imóvel.",
    });
  };

  const confidenceMeta = CONFIDENCE_META[confidence] || CONFIDENCE_META.baixa;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={kind} onValueChange={(v) => setKind(v as DocumentKind)}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(KIND_LABELS) as DocumentKind[]).map((k) => (
              <SelectItem key={k} value={k}>{KIND_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
          <FileScan className="mr-2 h-4 w-4" />
          Ler documento
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Dados lidos do documento</DialogTitle>
            <DialogDescription>
              Confirma os valores antes de os aplicar à ficha do imóvel. A IA pode ler mal
              números e moradas em fotografias.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              A ler o documento…
            </div>
          ) : fields ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {documentType && documentType !== "desconhecido" && (
                  <Badge variant="outline">
                    {KIND_LABELS[documentType as DocumentKind] || documentType}
                  </Badge>
                )}
                <Badge className={confidenceMeta.className} variant="outline">
                  {confidenceMeta.label}
                </Badge>
              </div>

              {confidence === "baixa" && (
                <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    A imagem não estava clara. Verifica cada valor com atenção — ou repete
                    com uma foto melhor.
                  </span>
                </div>
              )}

              <div className="divide-y rounded-md border">
                {Object.entries(fields).map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-4 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">{FIELD_LABELS[key] || key}</span>
                    <span className="font-medium text-right">{String(value)}</span>
                  </div>
                ))}
              </div>

              {notes && <p className="text-xs text-muted-foreground">{notes}</p>}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={apply} disabled={!fields || loading}>
              Preencher ficha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
