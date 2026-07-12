import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Globe, Copy, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getPersonalLanding,
  savePersonalLanding,
  setPersonalLandingPublished,
  getOrCreatePersonalLandingLink,
} from "@/services/landingService";

export function PersonalLandingSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [published, setPublished] = useState(false);
  const [link, setLink] = useState("");

  useEffect(() => {
    getPersonalLanding()
      .then((s) => {
        setHeadline(s.headline);
        setBio(s.bio);
        setPublished(s.published);
      })
      .catch((err) => console.error("[PersonalLanding] load:", err))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await savePersonalLanding({ headline, bio });
      toast({ title: "Textos guardados" });
    } catch (err: any) {
      toast({ title: "Erro ao guardar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async (next: boolean) => {
    setBusy(true);
    try {
      if (next && !link) setLink(await getOrCreatePersonalLandingLink());
      await setPersonalLandingPublished(next);
      setPublished(next);
      toast({ title: next ? "Página publicada" : "Página despublicada" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    try {
      const l = link || (await getOrCreatePersonalLandingLink());
      setLink(l);
      await navigator.clipboard.writeText(l);
      toast({ title: "Link copiado", description: l });
    } catch {
      toast({ title: "Erro ao copiar link", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-blue-600" />
          Landing Page Pessoal
        </CardTitle>
        <CardDescription>
          A sua página pública com foto, apresentação e os seus imóveis publicados. A foto usada é a
          Foto de Perfil (separador Perfil).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> A carregar...</div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="landing-headline">Frase de apresentação</Label>
              <Input
                id="landing-headline"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Ex: Consultor imobiliário no Grande Porto"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="landing-bio">Sobre mim</Label>
              <Textarea
                id="landing-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={5}
                placeholder="Uma breve apresentação: a sua experiência, zonas onde atua, como ajuda os clientes…"
              />
            </div>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "A guardar..." : "Guardar textos"}
            </Button>

            <div className="flex items-center justify-between border rounded-md p-4 bg-slate-50 mt-2">
              <div className="space-y-0.5 pr-4">
                <Label className="text-base">Publicar página</Label>
                <p className="text-sm text-muted-foreground">Torna a sua página pública e acessível pelo link.</p>
              </div>
              <Switch checked={published} onCheckedChange={handleTogglePublish} disabled={busy} />
            </div>
            {published && (
              <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                Copiar link
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
