import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Radar, Loader2, PhoneCall } from "lucide-react";
import {
  getRadarItemFor, addToRadar, getRadarDefaultCadence, registerRadarContact, resolveRadarItem,
  type RadarEntityType, type RadarItem,
} from "@/services/radarService";

interface Props {
  entityType: RadarEntityType;
  entityId: string;
  entityName?: string;
  size?: "sm" | "default";
}

const CADENCE_OPTIONS = [2, 3, 7, 14];

export function RadarToggleButton({ entityType, entityId, entityName, size = "sm" }: Props) {
  const { toast } = useToast();
  const [item, setItem] = useState<RadarItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [cadence, setCadence] = useState(3);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setItem(await getRadarItemFor(entityType, entityId));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (entityId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, entityType]);

  const openDialog = async () => {
    if (!item) setCadence(await getRadarDefaultCadence());
    setOpen(true);
  };

  const handleAdd = async () => {
    setSaving(true);
    try {
      await addToRadar({ entityType, entityId, cadenceDays: cadence, note: note.trim() || undefined });
      toast({ title: "Adicionado ao Radar", description: `${entityName || "Cliente"} está agora em acompanhamento ativo.` });
      setOpen(false);
      setNote("");
      await load();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message || "Não foi possível adicionar ao Radar.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRegister = async () => {
    if (!item) return;
    setSaving(true);
    try {
      await registerRadarContact(item.id);
      toast({ title: "Contacto registado", description: "Relógio do Radar reposto." });
      setOpen(false);
      await load();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message || "Não foi possível registar.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!item) return;
    setSaving(true);
    try {
      await resolveRadarItem(item.id, "other");
      toast({ title: "Retirado do Radar", description: `${entityName || "Cliente"} deixou de estar em acompanhamento.` });
      setOpen(false);
      await load();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message || "Não foi possível retirar.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const onRadar = !!item;

  return (
    <>
      <Button
        variant={onRadar ? "default" : "outline"}
        size={size}
        onClick={openDialog}
        disabled={loading}
        className={onRadar ? "bg-indigo-600 hover:bg-indigo-700" : ""}
        title={onRadar ? "Está no Radar" : "Marcar no Radar"}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4 mr-1.5" />}
        {onRadar ? "No Radar" : "Marcar no Radar"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          {onRadar ? (
            <>
              <DialogHeader>
                <DialogTitle>No Radar</DialogTitle>
                <DialogDescription>
                  {entityName ? `${entityName} está` : "Está"} em acompanhamento ativo (cadência {item?.cadence_days} dias).
                  {item?.note ? ` Nota: ${item.note}` : ""}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:justify-between">
                <Button variant="outline" onClick={handleRegister} disabled={saving}>
                  <PhoneCall className="h-4 w-4 mr-1.5 text-green-600" />
                  Registar contacto
                </Button>
                <Button variant="destructive" onClick={handleRemove} disabled={saving}>
                  Retirar do Radar
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Marcar no Radar</DialogTitle>
                <DialogDescription>
                  Avisamos se {entityName || "este cliente"} ficar sem contacto durante o período escolhido, até resolver.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm">Avisar se ficar sem contacto durante</Label>
                  <div className="flex gap-2 mt-1.5">
                    {CADENCE_OPTIONS.map((d) => (
                      <Button
                        key={d}
                        type="button"
                        size="sm"
                        variant={cadence === d ? "default" : "outline"}
                        onClick={() => setCadence(d)}
                      >
                        {d} dias
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label htmlFor="radar-note" className="text-sm">Nota (opcional)</Label>
                  <Input
                    id="radar-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ex.: proposta enviada, decide esta semana"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={handleAdd} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
                  {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Radar className="h-4 w-4 mr-1.5" />}
                  Adicionar ao Radar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
