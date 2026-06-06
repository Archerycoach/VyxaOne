import { useState } from "react";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Search, Loader2, Home, MapPin, Bed, Maximize, ExternalLink, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { IdealistaProperty } from "@/services/idealistaService";
import Link from "next/link";

export default function IdealistaPage() {
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<IdealistaProperty[]>([]);
  const [searched, setSearched] = useState(false);
  const { toast } = useToast();

  const [searchParams, setSearchParams] = useState({
    operation: "sale",
    formPropertyType: "flat",
    distrito: "Lisboa",
    freguesia: "",
    minPrice: "",
    maxPrice: "",
    bedrooms: "any",
    agencyName: "",
  });

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSearched(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const locationStr = [searchParams.freguesia, searchParams.distrito].filter(Boolean).join(", ");
      const isHome = ['flat', 'chalet'].includes(searchParams.formPropertyType);
      
      const response = await fetch("/api/idealista/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          params: {
            operation: searchParams.operation,
            propertyType: isHome ? 'homes' : searchParams.formPropertyType,
            subType: searchParams.formPropertyType === 'chalet' ? 'chalet' : undefined,
            center: locationStr,
            distance: 10000,
            minPrice: searchParams.minPrice ? Number(searchParams.minPrice) : undefined,
            maxPrice: searchParams.maxPrice ? Number(searchParams.maxPrice) : undefined,
            bedrooms: searchParams.bedrooms !== "any" ? searchParams.bedrooms : undefined,
            maxItems: 20,
            agencyName: searchParams.agencyName
          }
        })
      });

      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch (e) {
        // Se falhar o parse, significa que o servidor retornou HTML (ex: 504 Gateway Timeout ou 500 Server Error)
        console.error("Resposta não-JSON do servidor:", text);
        if (text.includes("504") || text.includes("Timeout")) {
          throw new Error("A pesquisa demorou demasiado tempo. Tente ser mais específico na localização (ex: adicione a Freguesia).");
        }
        throw new Error("Erro na comunicação com o servidor. O serviço pode estar temporariamente indisponível.");
      }

      if (!response.ok) {
        throw new Error(data.error || "Erro na pesquisa");
      }

      setProperties(data.properties || []);
      
      if (data.properties?.length === 0) {
        toast({
          title: "Sem resultados",
          description: "Não foram encontrados imóveis com estes critérios.",
        });
      }
    } catch (error: any) {
      console.error("Erro na pesquisa:", error);
      toast({
        title: "Erro na pesquisa",
        description: error.message.includes("Chave") 
          ? "A chave da API do Idealista não está configurada corretamente."
          : error.message || "Ocorreu um erro ao pesquisar no Idealista.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <SEO title="Idealista | Vyxa" description="Pesquisa de imóveis no Idealista" />
      <Layout>
        <div className="p-6 max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Sparkles className="h-8 w-8 text-purple-600" />
                Idealista Search
              </h1>
              <p className="text-muted-foreground mt-1">
                Pesquise imóveis no mercado diretamente da sua plataforma.
              </p>
            </div>
            <Link href="/settings?tab=idealista">
              <Button variant="outline" className="text-purple-700 border-purple-200">
                <Settings className="w-4 h-4 mr-2" />
                Configurar API
              </Button>
            </Link>
          </div>

          <Card className="border-purple-100 shadow-sm">
            <CardContent className="pt-6">
              <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Distrito</Label>
                  <Input 
                    placeholder="Ex: Lisboa, Porto..." 
                    value={searchParams.distrito}
                    onChange={(e) => setSearchParams({...searchParams, distrito: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Freguesia (Opcional)</Label>
                  <Input 
                    placeholder="Ex: Benfica, Campanhã..." 
                    value={searchParams.freguesia}
                    onChange={(e) => setSearchParams({...searchParams, freguesia: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Agência (Opcional)</Label>
                  <Input 
                    placeholder="Ex: Remax, Century 21..." 
                    value={searchParams.agencyName}
                    onChange={(e) => setSearchParams({...searchParams, agencyName: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Negócio</Label>
                  <Select 
                    value={searchParams.operation} 
                    onValueChange={(val) => setSearchParams({...searchParams, operation: val})}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sale">Comprar</SelectItem>
                      <SelectItem value="rent">Arrendar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Imóvel</Label>
                  <Select 
                    value={searchParams.formPropertyType} 
                    onValueChange={(val) => setSearchParams({...searchParams, formPropertyType: val})}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat">Apartamento</SelectItem>
                      <SelectItem value="chalet">Moradia</SelectItem>
                      <SelectItem value="offices">Escritórios</SelectItem>
                      <SelectItem value="premises">Lojas</SelectItem>
                      <SelectItem value="garages">Garagens</SelectItem>
                      <SelectItem value="land">Terrenos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipologia</Label>
                  <Select 
                    value={searchParams.bedrooms} 
                    onValueChange={(val) => setSearchParams({...searchParams, bedrooms: val})}
                    disabled={!['flat', 'chalet'].includes(searchParams.formPropertyType)}
                  >
                    <SelectTrigger><SelectValue placeholder="Qualquer" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Qualquer</SelectItem>
                      <SelectItem value="0">T0</SelectItem>
                      <SelectItem value="1">T1</SelectItem>
                      <SelectItem value="2">T2</SelectItem>
                      <SelectItem value="3">T3</SelectItem>
                      <SelectItem value="4">T4 ou mais</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Preço Min.</Label>
                  <Input 
                    type="number" 
                    placeholder="€" 
                    value={searchParams.minPrice}
                    onChange={(e) => setSearchParams({...searchParams, minPrice: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preço Max.</Label>
                  <Input 
                    type="number" 
                    placeholder="€" 
                    value={searchParams.maxPrice}
                    onChange={(e) => setSearchParams({...searchParams, maxPrice: e.target.value})}
                  />
                </div>
                
                <div className="lg:col-span-4 flex justify-end mt-2">
                  <Button type="submit" disabled={loading} className="w-full md:w-auto bg-purple-600 hover:bg-purple-700">
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                    Pesquisar Imóveis
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Results Area */}
          <div className="mt-8">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="w-10 h-10 animate-spin text-purple-500 mb-4" />
                <p>A procurar os melhores imóveis no Idealista...</p>
              </div>
            ) : searched && properties.length === 0 ? (
              <div className="text-center py-20 bg-gray-50 rounded-lg border border-dashed">
                <Home className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-900">Sem resultados</h3>
                <p className="text-gray-500">Tente ajustar os critérios de pesquisa.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {properties.map((property) => (
                  <Card key={property.propertyCode} className="overflow-hidden hover:shadow-md transition-shadow group flex flex-col">
                    <div className="relative h-48 bg-gray-100 overflow-hidden">
                      {property.thumbnail ? (
                        <img 
                          src={property.thumbnail} 
                          alt={property.suggestedTexts?.title || "Imóvel"} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <Home className="w-12 h-12 opacity-20" />
                        </div>
                      )}
                      <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-sm font-bold text-gray-900 shadow">
                        {property.priceInfo?.price?.amount?.toLocaleString('pt-PT')} {property.priceInfo?.price?.currencySuffix || '€'}
                      </div>
                      <Badge className="absolute top-2 left-2 bg-purple-600">
                        {property.operation === "sale" ? "Venda" : "Arrendamento"}
                      </Badge>
                    </div>
                    <CardContent className="p-4 flex-1 flex flex-col">
                      <h3 className="font-semibold text-lg line-clamp-2 mb-2 group-hover:text-purple-600 transition-colors">
                        {property.suggestedTexts?.title || property.address}
                      </h3>
                      <div className="flex items-center text-gray-500 text-sm mb-3 mt-auto">
                        <MapPin className="w-4 h-4 mr-1 shrink-0" />
                        <span className="truncate">{property.municipality}, {property.province}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 py-3 border-t border-b border-gray-100 mb-4">
                        <div className="flex flex-col items-center justify-center">
                          <Bed className="w-4 h-4 text-gray-400 mb-1" />
                          <span className="text-sm font-medium">{property.rooms || '-'} Qto</span>
                        </div>
                        <div className="flex flex-col items-center justify-center border-l border-r border-gray-100">
                          <Maximize className="w-4 h-4 text-gray-400 mb-1" />
                          <span className="text-sm font-medium">{property.size || '-'} m²</span>
                        </div>
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-xs text-gray-400 mb-1">m²</span>
                          <span className="text-sm font-medium">{property.priceByArea ? `${Math.round(property.priceByArea)}€` : '-'}</span>
                        </div>
                      </div>
                      <Button 
                        variant="default" 
                        className="w-full bg-purple-600 hover:bg-purple-700" 
                        onClick={() => window.open(property.url, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Ver no Idealista
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}