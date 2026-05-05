import { useState } from "react";
import { Building2, CalendarDays, Edit, Euro, MapPin, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { deleteDevelopment } from "@/services/developmentsService";
import type { Development, DevelopmentStatus } from "@/types";

interface DevelopmentsListProps {
  developments: Development[];
  onEdit: (development: Development) => void;
  onRefresh: () => void | Promise<void>;
}

const currencyFormatter = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function getStatusLabel(status: DevelopmentStatus) {
  switch (status) {
    case "draft":
      return "Rascunho";
    case "published":
      return "Publicado";
    case "under_construction":
      return "Em construção";
    case "completed":
      return "Concluído";
    case "sold_out":
      return "Esgotado";
    default:
      return status;
  }
}

function getStatusClass(status: DevelopmentStatus) {
  switch (status) {
    case "draft":
      return "bg-slate-100 text-slate-800";
    case "published":
      return "bg-emerald-100 text-emerald-800";
    case "under_construction":
      return "bg-amber-100 text-amber-800";
    case "completed":
      return "bg-blue-100 text-blue-800";
    case "sold_out":
      return "bg-rose-100 text-rose-800";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function isRecentDevelopment(publishedAt?: string | null) {
  if (!publishedAt) return false;
  const publishedTime = new Date(publishedAt).getTime();
  const maxAge = 30 * 24 * 60 * 60 * 1000;
  return Date.now() - publishedTime <= maxAge;
}

function formatLocation(development: Development) {
  return [development.city, development.district].filter(Boolean).join(" • ") || development.address || "Localização por definir";
}

function formatPriceRange(development: Development) {
  if (development.price_from != null && development.price_to != null) {
    if (development.price_from === development.price_to) {
      return currencyFormatter.format(development.price_from);
    }
    return currencyFormatter.format(development.price_from) + " – " + currencyFormatter.format(development.price_to);
  }

  if (development.price_from != null) {
    return "Desde " + currencyFormatter.format(development.price_from);
  }

  if (development.price_to != null) {
    return "Até " + currencyFormatter.format(development.price_to);
  }

  return "Preço sob consulta";
}

export function DevelopmentsList({ developments, onEdit, onRefresh }: DevelopmentsListProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filteredDevelopments = developments.filter((development) => {
    const searchableText = [
      development.name,
      development.city,
      development.district,
      development.developer_name,
      development.reference_code,
      development.description,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesSearch = searchableText.includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || development.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const handleDelete = async (id: string) => {
    if (!confirm("Tem a certeza que deseja eliminar este empreendimento?")) return;

    try {
      await deleteDevelopment(id);
      toast({
        title: "Sucesso",
        description: "Empreendimento eliminado com sucesso.",
      });
      await onRefresh();
    } catch (error) {
      console.error("Error deleting development:", error);
      toast({
        title: "Erro",
        description: "Não foi possível eliminar o empreendimento.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 md:max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar empreendimentos..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full md:w-[220px]">
            <SelectValue placeholder="Filtrar estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os estados</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="published">Publicado</SelectItem>
            <SelectItem value="under_construction">Em construção</SelectItem>
            <SelectItem value="completed">Concluído</SelectItem>
            <SelectItem value="sold_out">Esgotado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredDevelopments.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Nenhum empreendimento encontrado.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filteredDevelopments.map((development) => (
            <Card key={development.id} className="overflow-hidden">
              <div className="space-y-4 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">{development.name}</h3>
                      {isRecentDevelopment(development.published_at) ? (
                        <Badge className="bg-indigo-100 text-indigo-800">Novo 30d</Badge>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>{formatLocation(development)}</span>
                    </div>
                  </div>

                  <Badge className={getStatusClass(development.status)}>
                    {getStatusLabel(development.status)}
                  </Badge>
                </div>

                <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <Euro className="h-4 w-4" />
                    <span>{formatPriceRange(development)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <span>
                      {development.available_units ?? "—"} / {development.total_units ?? "—"} unidades disponíveis
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    <span>
                      Publicado: {development.published_at ? new Date(development.published_at).toLocaleDateString("pt-PT") : "Sem data"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    <span>
                      Entrega: {development.delivery_date ? new Date(development.delivery_date).toLocaleDateString("pt-PT") : "Por definir"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(development.typologies ?? []).length > 0 ? (
                    development.typologies?.map((typology) => (
                      <Badge key={typology} variant="outline">
                        {typology}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="outline">Sem tipologias definidas</Badge>
                  )}
                </div>

                {development.developer_name ? (
                  <p className="text-sm text-muted-foreground">
                    Promotor: <span className="font-medium text-foreground">{development.developer_name}</span>
                  </p>
                ) : null}

                {development.description ? (
                  <p className="line-clamp-3 text-sm text-muted-foreground">{development.description}</p>
                ) : null}

                <div className="flex justify-end gap-2 border-t pt-4">
                  <Button variant="outline" size="sm" onClick={() => onEdit(development)}>
                    <Edit className="mr-1 h-4 w-4" />
                    Editar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(development.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}