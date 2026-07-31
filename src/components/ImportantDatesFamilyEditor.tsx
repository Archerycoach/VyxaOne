import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Gift, Plus, Trash2, Users, CalendarHeart } from "lucide-react";

/** Dados de família estruturados (cônjuge, filhos, casamento). */
export interface FamilyData {
  spouse_name?: string;
  spouse_birthday?: string;      // YYYY-MM-DD
  wedding_anniversary?: string;  // YYYY-MM-DD
  children?: { name: string; birth_date: string }[];
}

export interface ImportantDate {
  label: string;
  date: string;        // YYYY-MM-DD
  recurring?: boolean; // repete todos os anos (default true)
}

export interface ImportantDatesValue {
  birthday?: string;        // aniversário do próprio (YYYY-MM-DD)
  family: FamilyData;
  importantDates: ImportantDate[];
  enabled: boolean;         // felicitação automática ligada
}

interface Props {
  value: ImportantDatesValue;
  onChange: (value: ImportantDatesValue) => void;
  /** Mostrar o campo de aniversário do próprio (falso quando a ficha já o tem). */
  showBirthday?: boolean;
}

export function ImportantDatesFamilyEditor({ value, onChange, showBirthday = true }: Props) {
  const family = value.family || {};
  const children = family.children || [];
  const dates = value.importantDates || [];

  const patch = (p: Partial<ImportantDatesValue>) => onChange({ ...value, ...p });
  const patchFamily = (p: Partial<FamilyData>) => patch({ family: { ...family, ...p } });

  const setChild = (i: number, p: Partial<{ name: string; birth_date: string }>) => {
    const next = children.map((c, idx) => (idx === i ? { ...c, ...p } : c));
    patchFamily({ children: next });
  };
  const addChild = () => patchFamily({ children: [...children, { name: "", birth_date: "" }] });
  const removeChild = (i: number) => patchFamily({ children: children.filter((_, idx) => idx !== i) });

  const setDate = (i: number, p: Partial<ImportantDate>) => {
    const next = dates.map((d, idx) => (idx === i ? { ...d, ...p } : d));
    patch({ importantDates: next });
  };
  const addDate = () => patch({ importantDates: [...dates, { label: "", date: "", recurring: true }] });
  const removeDate = (i: number) => patch({ importantDates: dates.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-5 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium">
          <CalendarHeart className="h-4 w-4 text-rose-600" /> Datas importantes e família
        </div>
      </div>

      {/* Aniversário do próprio */}
      {showBirthday && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm flex items-center gap-1.5"><Gift className="h-3.5 w-3.5" /> Aniversário</Label>
            <Input type="date" value={value.birthday || ""} onChange={(e) => patch({ birthday: e.target.value })} />
          </div>
        </div>
      )}

      {/* Família */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-600"><Users className="h-4 w-4" /> Família</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm">Nome do/a cônjuge</Label>
            <Input value={family.spouse_name || ""} onChange={(e) => patchFamily({ spouse_name: e.target.value })} placeholder="Nome" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Aniversário do/a cônjuge</Label>
            <Input type="date" value={family.spouse_birthday || ""} onChange={(e) => patchFamily({ spouse_birthday: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Aniversário de casamento</Label>
            <Input type="date" value={family.wedding_anniversary || ""} onChange={(e) => patchFamily({ wedding_anniversary: e.target.value })} />
          </div>
        </div>

        {/* Filhos */}
        <div className="space-y-2">
          <Label className="text-sm">Filhos</Label>
          {children.map((c, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input value={c.name} onChange={(e) => setChild(i, { name: e.target.value })} placeholder="Nome do/a filho/a" className="flex-1" />
              <Input type="date" value={c.birth_date} onChange={(e) => setChild(i, { birth_date: e.target.value })} className="w-44" />
              <Button type="button" variant="ghost" size="icon" onClick={() => removeChild(i)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addChild}><Plus className="h-4 w-4 mr-1" /> Adicionar filho/a</Button>
        </div>
      </div>

      {/* Datas personalizadas */}
      <div className="space-y-2">
        <Label className="text-sm">Outras datas importantes</Label>
        {dates.map((d, i) => (
          <div key={i} className="flex gap-2 items-center flex-wrap">
            <Input value={d.label} onChange={(e) => setDate(i, { label: e.target.value })} placeholder="Ex.: Escritura, Santo, etc." className="flex-1 min-w-[160px]" />
            <Input type="date" value={d.date} onChange={(e) => setDate(i, { date: e.target.value })} className="w-44" />
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <Switch checked={d.recurring !== false} onCheckedChange={(v) => setDate(i, { recurring: v })} /> anual
            </label>
            <Button type="button" variant="ghost" size="icon" onClick={() => removeDate(i)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addDate}><Plus className="h-4 w-4 mr-1" /> Adicionar data</Button>
      </div>

      {/* Toggle de felicitação automática */}
      <div className="flex items-center justify-between rounded-md bg-rose-50/60 border border-rose-100 p-3">
        <div>
          <Label className="text-sm font-medium">Felicitação automática nestas datas</Label>
          <p className="text-xs text-slate-500">Envia um email de parabéns pela sua caixa, no dia. Respeita opt-out.</p>
        </div>
        <Switch checked={value.enabled} onCheckedChange={(v) => patch({ enabled: v })} />
      </div>
    </div>
  );
}

/** Constrói o objeto `family` já limpo (remove filhos vazios). */
export function cleanFamily(family: FamilyData): FamilyData {
  return {
    spouse_name: family.spouse_name?.trim() || undefined,
    spouse_birthday: family.spouse_birthday || undefined,
    wedding_anniversary: family.wedding_anniversary || undefined,
    children: (family.children || []).filter((c) => c.name?.trim() && c.birth_date),
  };
}

/** Limpa a lista de datas (remove entradas incompletas). */
export function cleanImportantDates(dates: ImportantDate[]): ImportantDate[] {
  return (dates || [])
    .filter((d) => d.label?.trim() && d.date)
    .map((d) => ({ label: d.label.trim(), date: d.date, recurring: d.recurring !== false }));
}
