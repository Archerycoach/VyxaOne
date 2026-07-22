import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, X, FileText, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const BUCKET = "documents";
const MAX_SIZE = 10 * 1024 * 1024;

interface DocumentAssetUploadProps {
  label: string;
  description: string;
  /** "pdf" para capa/contracapa, "image" para a faixa de rodapé. */
  kind: "pdf" | "image";
  /** Caminho atual no storage, ou null. */
  value: string | null;
  /** Coluna do perfil onde o caminho é guardado. */
  column: string;
  onChange: (path: string | null) => void;
}

/**
 * Carregamento de um ficheiro de identidade visual (capa, contracapa, rodapé).
 *
 * Grava no storage e guarda apenas o caminho no perfil. Substituir apaga o
 * anterior — estes ficheiros não têm histórico e acumulá-los só ocuparia
 * espaço sem ninguém lhes voltar a tocar.
 */
export function DocumentAssetUpload({
  label,
  description,
  kind,
  value,
  column,
  onChange,
}: DocumentAssetUploadProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const accept = kind === "pdf" ? "application/pdf" : "image/png,image/jpeg";

  const persist = async (path: string | null, previousPath: string | null) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sessão expirada.");

    const { error } = await supabase
      .from("profiles")
      .update({ [column]: path } as any)
      .eq("id", user.id);

    if (error) throw error;

    // Só depois de a referência estar gravada é que o ficheiro antigo sai —
    // ao contrário, uma falha a meio deixaria o perfil a apontar para um
    // ficheiro que já não existe.
    if (previousPath && previousPath !== path) {
      await supabase.storage.from(BUCKET).remove([previousPath]);
    }
  };

  const handleFile = async (file: File) => {
    if (file.size > MAX_SIZE) {
      toast({
        title: "Ficheiro demasiado grande",
        description: "O limite é 10 MB.",
        variant: "destructive",
      });
      return;
    }

    // A faixa de rodapé ocupa a largura da página. Uma imagem quase quadrada
    // fica desproporcionada — vale a pena dizê-lo ANTES de o consultor gerar
    // um documento e ver o resultado.
    if (kind === "image") {
      const ratio = await new Promise<number | null>((resolve) => {
        const image = new Image();
        image.onload = () => resolve(image.width / image.height);
        image.onerror = () => resolve(null);
        image.src = URL.createObjectURL(file);
      });

      if (ratio !== null && ratio < 6) {
        toast({
          title: "Proporções pouco adequadas",
          description:
            "Para o rodapé, use uma imagem larga e baixa (ex.: 1600×140 px). " +
            "Esta é demasiado alta e vai aparecer comprimida.",
        });
      }
    }

    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada.");

      const extension = file.name.split(".").pop() || (kind === "pdf" ? "pdf" : "png");
      const path = `${user.id}/branding/${column}-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      await persist(path, value);
      onChange(path);
      toast({ title: "✅ Ficheiro carregado" });
    } catch (error: any) {
      toast({
        title: "Erro ao carregar",
        description: error?.message || "Não foi possível carregar o ficheiro.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    try {
      await persist(null, value);
      onChange(null);
      toast({ title: "Ficheiro removido" });
    } catch (error: any) {
      toast({
        title: "Erro ao remover",
        description: error?.message || "Não foi possível remover.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const Icon = kind === "pdf" ? FileText : ImageIcon;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground">{description}</p>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {value ? (
        <div className="flex items-center gap-2 rounded-md border bg-gray-50 px-3 py-2">
          <Icon className="h-4 w-4 text-gray-500 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-sm">
            {value.split("/").pop()}
          </span>
          <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
            Substituir
          </Button>
          <Button variant="ghost" size="sm" onClick={handleRemove} disabled={busy}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          Carregar {kind === "pdf" ? "PDF" : "imagem"}
        </Button>
      )}
    </div>
  );
}
