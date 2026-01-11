import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Edit, Trash2, Bed, Bath, Maximize, MapPin, Euro } from "lucide-react";
import { deleteProperty } from "@/services/propertiesService";
import { useToast } from "@/hooks/use-toast";
import type { Property } from "@/types";

interface PropertiesListProps {
  properties: Property[];
  onEdit: (property: Property) => void;
  onRefresh: () => void;
}

export function PropertiesList({ properties, onEdit, onRefresh }: PropertiesListProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterTransaction, setFilterTransaction] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const handleDelete = async (id: string) => {
    if (!confirm("Tem a certeza que deseja eliminar este imóvel?")) return;

    try {
      await deleteProperty(id);
      toast({
        title: "Sucesso",
        description: "Imóvel eliminado com sucesso",
      });
      onRefresh();
    } catch (error) {
      console.error("Error deleting property:", error);
      toast({
        title: "Erro",
        description: "Não foi possível eliminar o imóvel",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-green-100 text-green-800";
      case "reserved":
        return "bg-yellow-100 text-yellow-800";
      case "sold":
        return "bg-red-100 text-red-800";
      case "rented":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "available":
        return "Disponível";
      case "reserved":
        return "Reservado";
      case "sold":
        return "Vendido";
      case "rented":
        return "Arrendado";
      default:
        return status;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "apartment":
        return "Apartamento";
      case "house":
        return "Moradia";
      case "land":
        return "Terreno";
      case "commercial":
        return "Comercial";
      case "office":
        return "Escritório";
      default:
        return type;
    }
  };

  const filteredProperties = properties.filter((property) => {
    const matchesSearch =
      property.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      property.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      property.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      property.description?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = filterType === "all" || property.property_type === filterType;
    
    let matchesTransaction = true;
    if (filterTransaction === "sale") {
      matchesTransaction = (property.price !== null && property.price > 0);
    } else if (filterTransaction === "rent") {
      matchesTransaction = (property.rental_price !== null && (property.rental_price ?? 0) > 0);
    }

    const matchesStatus = filterStatus === "all" || property.status === filterStatus;

    return matchesSearch && matchesType && matchesTransaction && matchesStatus;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar imóveis..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="apartment">Apartamento</SelectItem>
              <SelectItem value="house">Moradia</SelectItem>
              <SelectItem value="land">Terreno</SelectItem>
              <SelectItem value="commercial">Comercial</SelectItem>
              <SelectItem value="office">Escritório</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterTransaction} onValueChange={setFilterTransaction}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Transação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="sale">Venda</SelectItem>
              <SelectItem value="rent">Arrendamento</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="available">Disponível</SelectItem>
              <SelectItem value="reserved">Reservado</SelectItem>
              <SelectItem value="sold">Vendido</SelectItem>
              <SelectItem value="rented">Arrendado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredProperties.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Nenhum imóvel encontrado</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProperties.map((property) => (
            <Card key={property.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-lg line-clamp-2">{property.title}</h3>
                  <Badge className={getStatusColor(property.status)}>
                    {getStatusLabel(property.status)}
                  </Badge>
                </div>

                {property.city && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span className="truncate">{property.city}</span>
                  </div>
                )}

                <div className="flex items-center gap-4 text-sm">
                  {property.bedrooms !== null && (
                    <div className="flex items-center gap-1">
                      <Bed className="h-4 w-4 text-muted-foreground" />
                      <span>{property.bedrooms}</span>
                    </div>
                  )}
                  {property.bathrooms !== null && (
                    <div className="flex items-center gap-1">
                      <Bath className="h-4 w-4 text-muted-foreground" />
                      <span>{property.bathrooms}</span>
                    </div>
                  )}
                  {property.area !== null && (
                    <div className="flex items-center gap-1">
                      <Maximize className="h-4 w-4 text-muted-foreground" />
                      <span>{property.area}m²</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex flex-col gap-1">
                    {property.price > 0 && (
                      <div className="flex items-center gap-1">
                        <Euro className="h-4 w-4 text-green-600" />
                        <span className="font-bold text-green-600">
                          {new Intl.NumberFormat("pt-PT", {
                            style: "currency",
                            currency: "EUR",
                            minimumFractionDigits: 0,
                          }).format(property.price)}
                        </span>
                      </div>
                    )}
                    {property.rental_price && property.rental_price > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-blue-600 font-medium">
                          {new Intl.NumberFormat("pt-PT", {
                            style: "currency",
                            currency: "EUR",
                            minimumFractionDigits: 0,
                          }).format(property.rental_price)}/mês
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="outline">{getTypeLabel(property.property_type)}</Badge>
                    {property.price > 0 && <Badge variant="secondary" className="text-xs">Venda</Badge>}
                    {property.rental_price && property.rental_price > 0 && <Badge variant="secondary" className="text-xs">Arrendamento</Badge>}
                  </div>
                </div>

                {property.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {property.description}
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(property)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(property.id)}
                  >
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