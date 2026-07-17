import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SlidersHorizontal, X } from "lucide-react";

/**
 * Filtros avançados por dados de qualificação da lead. Estado simples: um
 * campo vazio ("all" / "") = não aplicado. A filtragem em si é feita no
 * container (client-side, sobre as leads já carregadas).
 */
export interface LeadQualificationFilters {
  status: string;
  temperature: string;
  property_type: string;
  buy_purpose: string;
  typology: string;
  location: string;
  budgetMin: string;
  budgetMax: string;
  needs_financing: string; // "all" | "yes" | "no"
  has_property_to_sell: string; // "all" | "yes" | "no"
  purchase_timeline: string;
}

export const EMPTY_QUALIFICATION_FILTERS: LeadQualificationFilters = {
  status: "all",
  temperature: "all",
  property_type: "all",
  buy_purpose: "all",
  typology: "all",
  location: "",
  budgetMin: "",
  budgetMax: "",
  needs_financing: "all",
  has_property_to_sell: "all",
  purchase_timeline: "",
};

export function countActiveFilters(f: LeadQualificationFilters): number {
  let n = 0;
  if (f.status !== "all") n++;
  if (f.temperature !== "all") n++;
  if (f.property_type !== "all") n++;
  if (f.buy_purpose !== "all") n++;
  if (f.typology !== "all") n++;
  if (f.location.trim()) n++;
  if (f.budgetMin.trim()) n++;
  if (f.budgetMax.trim()) n++;
  if (f.needs_financing !== "all") n++;
  if (f.has_property_to_sell !== "all") n++;
  if (f.purchase_timeline.trim()) n++;
  return n;
}

interface Props {
  filters: LeadQualificationFilters;
  onChange: (filters: LeadQualificationFilters) => void;
}

export function LeadAdvancedFilters({ filters, onChange }: Props) {
  const active = countActiveFilters(filters);
  const set = (patch: Partial<LeadQualificationFilters>) => onChange({ ...filters, ...patch });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-9 gap-2 ${active > 0 ? "bg-amber-50 border-amber-300 text-amber-800" : "bg-white"}`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtros
          {active > 0 && <Badge className="bg-amber-600 h-5 px-1.5">{active}</Badge>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 max-h-[70vh] overflow-y-auto" align="end">
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-sm">Filtrar por qualificação</p>
          {active > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => onChange(EMPTY_QUALIFICATION_FILTERS)}>
              <X className="h-3.5 w-3.5" /> Limpar
            </Button>
          )}
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Estado</Label>
              <Select value={filters.status} onValueChange={(v) => set({ status: v })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Qualquer</SelectItem>
                  <SelectItem value="new">Novo</SelectItem>
                  <SelectItem value="contacted">Contactado</SelectItem>
                  <SelectItem value="qualified">Qualificado</SelectItem>
                  <SelectItem value="proposal">Proposta</SelectItem>
                  <SelectItem value="negotiation">Negociação</SelectItem>
                  <SelectItem value="won">Ganho</SelectItem>
                  <SelectItem value="lost">Perdido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Temperatura</Label>
              <Select value={filters.temperature} onValueChange={(v) => set({ temperature: v })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Qualquer</SelectItem>
                  <SelectItem value="hot">🔥 Quente</SelectItem>
                  <SelectItem value="warm">⚠️ Morna</SelectItem>
                  <SelectItem value="cold">❄️ Fria</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tipo de imóvel</Label>
              <Select value={filters.property_type} onValueChange={(v) => set({ property_type: v })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Qualquer</SelectItem>
                  <SelectItem value="apartment">Apartamento</SelectItem>
                  <SelectItem value="house">Moradia</SelectItem>
                  <SelectItem value="land">Terreno</SelectItem>
                  <SelectItem value="commercial">Comercial</SelectItem>
                  <SelectItem value="store">Loja</SelectItem>
                  <SelectItem value="office">Escritório</SelectItem>
                  <SelectItem value="warehouse">Armazém</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Objetivo</Label>
              <Select value={filters.buy_purpose} onValueChange={(v) => set({ buy_purpose: v })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Qualquer</SelectItem>
                  <SelectItem value="housing">Habitação própria</SelectItem>
                  <SelectItem value="investment">Investimento</SelectItem>
                  <SelectItem value="secondary">Habitação secundária</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tipologia</Label>
              <Select value={filters.typology} onValueChange={(v) => set({ typology: v })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Qualquer</SelectItem>
                  <SelectItem value="T0">T0</SelectItem>
                  <SelectItem value="T1">T1</SelectItem>
                  <SelectItem value="T2">T2</SelectItem>
                  <SelectItem value="T3">T3</SelectItem>
                  <SelectItem value="T4">T4</SelectItem>
                  <SelectItem value="T5+">T5+</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Localização</Label>
              <Input
                className="h-8"
                placeholder="Ex: Porto"
                value={filters.location}
                onChange={(e) => set({ location: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Orçamento (€)</Label>
            <div className="flex items-center gap-2">
              <Input
                className="h-8"
                type="number"
                placeholder="Mín."
                value={filters.budgetMin}
                onChange={(e) => set({ budgetMin: e.target.value })}
              />
              <span className="text-muted-foreground text-sm">–</span>
              <Input
                className="h-8"
                type="number"
                placeholder="Máx."
                value={filters.budgetMax}
                onChange={(e) => set({ budgetMax: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Financiamento</Label>
              <Select value={filters.needs_financing} onValueChange={(v) => set({ needs_financing: v })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Qualquer</SelectItem>
                  <SelectItem value="yes">Precisa</SelectItem>
                  <SelectItem value="no">Não precisa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Imóvel para vender</Label>
              <Select value={filters.has_property_to_sell} onValueChange={(v) => set({ has_property_to_sell: v })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Qualquer</SelectItem>
                  <SelectItem value="yes">Tem</SelectItem>
                  <SelectItem value="no">Não tem</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Prazo de compra (contém)</Label>
            <Input
              className="h-8"
              placeholder="Ex: 3-6 meses"
              value={filters.purchase_timeline}
              onChange={(e) => set({ purchase_timeline: e.target.value })}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Devolve true se a lead passa em todos os filtros de qualificação ativos. */
export function leadMatchesQualificationFilters(lead: any, f: LeadQualificationFilters): boolean {
  const norm = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

  if (f.status !== "all" && lead.status !== f.status) return false;
  if (f.temperature !== "all" && lead.temperature !== f.temperature) return false;
  if (f.property_type !== "all" && lead.property_type !== f.property_type) return false;
  if (f.buy_purpose !== "all" && lead.buy_purpose !== f.buy_purpose) return false;

  if (f.typology !== "all") {
    const leadTyp = lead.typology || (lead.bedrooms != null ? `T${lead.bedrooms}` : "");
    if (norm(leadTyp) !== norm(f.typology)) return false;
  }

  if (f.location.trim()) {
    if (!norm(lead.location_preference).includes(norm(f.location))) return false;
  }

  // Orçamento: usa o valor mais representativo da lead.
  const leadBudget = lead.budget_max ?? lead.budget ?? lead.budget_min ?? null;
  if (f.budgetMin.trim()) {
    const min = Number(f.budgetMin);
    if (leadBudget == null || leadBudget < min) return false;
  }
  if (f.budgetMax.trim()) {
    const max = Number(f.budgetMax);
    if (leadBudget == null || leadBudget > max) return false;
  }

  if (f.needs_financing !== "all") {
    const want = f.needs_financing === "yes";
    if (lead.needs_financing !== want) return false;
  }
  if (f.has_property_to_sell !== "all") {
    const want = f.has_property_to_sell === "yes";
    if (lead.has_property_to_sell !== want) return false;
  }

  if (f.purchase_timeline.trim()) {
    if (!norm(lead.purchase_timeline).includes(norm(f.purchase_timeline))) return false;
  }

  return true;
}
