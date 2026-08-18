import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { AiFeatureNotice } from "@/components/ai/AiFeatureNotice";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Home, Sparkles, Loader2, Download, Send, TrendingUp, MapPin, ExternalLink, FileText, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { jsPDF } from "jspdf";
import {
  loadFooterImage, addFooterBand, footerBandHeight, mergeBrandingPages, saveMergedPdf, hasCustomCover, hasCustomAbout,
  loadProfilePhoto,
  type DocumentBranding,
} from "@/lib/documentBranding";
import {
  addCoverPage, addAboutPage, addClosingPage, addPageHeader, addPageNumbers,
  setDocumentTheme, setFooterReserve, getFooterReserve, addSectionTitle, addKeyValueTable, addValueEstimate, addComparableCard, addBodyText,
  addLocationMap, addPointsOfInterest, addNarrative, addAskingVsSoldBlock,
  buildConsultantIdentity, type ConsultantIdentity,
} from "@/lib/pdfDocument";
import { InvestmentAnalysisCard } from "@/components/valuation/InvestmentAnalysisCard";

// Os 18 concelhos da AML — fora daqui o rácio oficial de 3,3–3,8× VPT não se
// aplica (mesma lista do servidor, src/pages/api/gpt/valuation.ts).
const AML_MUNICIPALITIES = new Set([
  "alcochete", "almada", "amadora", "barreiro", "cascais", "lisboa", "loures",
  "mafra", "moita", "montijo", "odivelas", "oeiras", "palmela", "seixal",
  "sesimbra", "setubal", "sintra", "vila franca de xira",
]);

function isInAML(concelho: string): boolean {
  const normalized = concelho
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z ]+/g, "")
    .trim();
  return AML_MUNICIPALITIES.has(normalized);
}

interface Comparable {
  source: string;
  status: "sold" | "active";
  address: string;
  area: number | null;
  price: number | null;
  pricePerSqm: number | null;
  url?: string | null;
  conditionLabel?: string | null;
  thumbnail?: string | null;
  thumbnailDataUri?: string | null;
}

interface ValuationResult {
  comparables: Comparable[];
  soldAvgPricePerSqm: number | null;
  activeAvgPricePerSqm: number | null;
  suggestedMin: number | null;
  zonePricePerSqm?: number | null;
  sanityCheck?: {
    expectedMinPerSqm: number | null;
    expectedMaxPerSqm: number | null;
    verdict: "plausivel" | "provavelmente_baixa" | "provavelmente_alta" | null;
    confidence: "alta" | "media" | "baixa" | null;
    reasoning: string | null;
    divergencePct: number | null;
  } | null;
  zoneSampleSize?: number | null;
  suggestedMax: number | null;
  suggestedCentral?: number | null;
  ineRentPerSqm?: number | null;
  narrative: string;
  scenarios?: Array<{
    key: string;
    label: string;
    pricePerSqmMin: number;
    pricePerSqmMax: number;
    valueMin: number;
    valueMax: number;
  }> | null;
  vptCrossCheck?: {
    vpt: number;
    multipleMin: number;
    multipleMax: number;
    valueMin: number;
    valueMax: number;
    source: "aml" | "manual";
  } | null;
  homogenization?: {
    pricePerSqm: number | null;
    rawPricePerSqm: number | null;
    sampleSize: number;
    deltaPct: number | null;
    applied: boolean;
    sample: Array<{
      rawPricePerSqm: number;
      homogenizedPricePerSqm: number;
      totalCoefficient: number;
      lines: { label: string; coefficient: number }[];
    }>;
  } | null;
  costMethod?: { valueMin: number; valueMax: number; landValue: number; breakdown: string[] } | null;
  dependentAreas?: { total: number; lines: { label: string; value: number }[] } | null;
  incomeMethod?: { value: number; yieldRate: number; netYieldRate: number; note: string } | null;
  comparablesDiagnostic?: {
    idealistaRaw: number;
    idealistaKept: number;
    idealistaError: string | null;
    internalCount: number;
    subjectHasCoords?: boolean;
    radiusKm?: number;
    radiusStats?: {
      withCoords: number;
      nearKept: number;
      farExcluded: number;
      noCoordsTextKept: number;
      noCoordsExcluded: number;
    };
  } | null;
}

interface LinkedLead {
  id: string;
  name: string;
  email: string | null;
}

function formatCurrency(value: number | null): string {
  if (!value) return "—";
  return value.toLocaleString("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

/** Tipos de imóvel em que faz sentido perguntar a área do lote. */
const LAND_AREA_TYPES = ["house", "land"];

const PROPERTY_TYPE_PT: Record<string, string> = {
  apartment: "Apartamento",
  house: "Moradia",
  land: "Terreno",
  commercial: "Comercial",
  store: "Loja",
  office: "Escritório",
  warehouse: "Armazém",
};

export default function ValuationPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [form, setForm] = useState({
    address: "",
    city: "",
    propertyType: "apartment",
    area: "",
    bedrooms: "",
    bathrooms: "",
    condition: "",
    // Características com impacto no valor. Dois T2 iguais em área podem
    // diferir 15-20% consoante tenham elevador, garagem ou varanda.
    floor: "",
    energyRating: "",
    yearBuilt: "",
    hasElevator: false,
    hasGarage: false,
    hasBalcony: false,
    hasTerrace: false,
    hasStorage: false,
    hasAirConditioning: false,
    hasPool: false,
    hasSeaView: false,
    hasGarden: false,
    hasSolarPanels: false,
    hasHeatPump: false,
    hasOpenViews: false,
    isSingleStorey: false,
    landArea: "",
    // ÁREAS DEPENDENTES (manual, pág. 25-35): não têm valor de mercado próprio
    // — valem uma fração do €/m² da área principal (varandas) ou um valor de
    // mercado absoluto (estacionamento, arrecadação, terraço).
    balconyOpenSqm: "",
    balconyEnclosedSqm: "",
    storageSqm: "",
    storagePricePerSqm: "500",
    parkingType: "",
    parkingCount: "",
    terraceSqm: "",
    terraceLocation: "",
    // Vistas (tabela do manual, pág. 52) — substitui os booleanos genéricos.
    viewType: "",
    // Valor Patrimonial Tributário (da caderneta) — validação pelo múltiplo do VPT.
    taxableValue: "",
    // Fora da AML o rácio oficial (3,3–3,8×) não se aplica; o consultor pode
    // indicar um múltiplo próprio para a zona.
    vptMultiplierOverride: "",
    lat: "",
    lon: "",
    county: "",
    freguesia: "",
    distrito: "",
    searchRadiusKm: "2",
    // Critérios de análise. Preço/ano/classe excluem; características pontuam.
    criteriaMinPrice: "",
    criteriaMaxPrice: "",
    criteriaMinYear: "",
    criteriaMaxYear: "",
    criteriaEnergyRatings: [] as string[],
    preferredFeatures: [] as string[],
    consultantDescription: "",
  });

  // Perfil do consultor: alimenta a capa, o cabeçalho e a folha de fecho do PDF.
  const [consultant, setConsultant] = useState<ConsultantIdentity | null>(null);
  // Capa/contracapa em PDF e faixa de rodapé, carregadas pelo consultor.
  const [branding, setBranding] = useState<DocumentBranding>({});
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // `select("*")` de proposito: listar colunas uma a uma fazia a consulta
      // INTEIRA falhar quando uma delas ainda nao existia na base, e o
      // documento saia com o nome e a licenca em branco sem qualquer aviso.
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("[valuation] Perfil nao carregado:", profileError);
        toast({
          title: "Perfil nao carregado",
          description: "O documento sai sem os teus dados. Verifica as Definicoes.",
          variant: "destructive",
        });
      }

      const photoDataUri = await loadProfilePhoto((profile as any)?.avatar_url);
      setConsultant({
        ...buildConsultantIdentity(profile, user.email),
        photoDataUri,
      });
      setDocumentTheme({
        brand: (profile as any)?.document_brand_color || null,
        accent: (profile as any)?.document_accent_color || null,
      });
      setBranding({
        coverPdfPath: (profile as any)?.document_cover_pdf_path || null,
        aboutPdfPath: (profile as any)?.document_about_pdf_path || null,
        closingPdfPath: (profile as any)?.document_closing_pdf_path || null,
        footerImagePath: (profile as any)?.document_footer_image_path || null,
      });
    })();
  }, []);

  const [linkedLead, setLinkedLead] = useState<LinkedLead | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValuationResult | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showCriteria, setShowCriteria] = useState(false);

  useEffect(() => {
    const leadId = router.query.leadId;
    if (typeof leadId !== "string") return;
    supabase
      .from("leads")
      .select("id, name, email, location_preference")
      .eq("id", leadId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setLinkedLead({ id: data.id, name: data.name, email: data.email });
          if (data.location_preference) {
            setForm((prev) => ({ ...prev, city: data.location_preference as string }));
          }
        }
      });
  }, [router.query.leadId]);

  const handleGenerate = async () => {
    if (!form.address || !form.propertyType) {
      toast({ title: "Preencha pelo menos a morada e o tipo de imóvel", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);
    setEditingValues(false); // avaliação nova → o acerto manual anterior deixa de fazer sentido
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/gpt/valuation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          address: form.address,
          city: form.city || undefined,
          propertyType: form.propertyType,
          area: form.area ? Number(form.area) : undefined,
          bedrooms: form.bedrooms ? Number(form.bedrooms) : undefined,
          bathrooms: form.bathrooms ? Number(form.bathrooms) : undefined,
          condition: form.condition || undefined,
          taxableValue: form.taxableValue ? Number(form.taxableValue) : undefined,
          vptMultiplierOverride: form.vptMultiplierOverride ? Number(form.vptMultiplierOverride) : undefined,
          factors: {
            floor: form.floor ? Number(form.floor) : null,
            energyRating: form.energyRating || null,
            yearBuilt: form.yearBuilt ? Number(form.yearBuilt) : null,
            hasElevator: form.hasElevator,
            hasGarage: form.hasGarage,
            hasBalcony: form.hasBalcony,
            hasTerrace: form.hasTerrace,
            hasStorage: form.hasStorage,
            hasAirConditioning: form.hasAirConditioning,
            hasPool: form.hasPool,
            hasSeaView: form.hasSeaView,
            hasGarden: form.hasGarden,
            hasSolarPanels: form.hasSolarPanels,
            hasHeatPump: form.hasHeatPump,
            hasOpenViews: form.hasOpenViews,
            isSingleStorey: form.isSingleStorey,
            landArea: form.landArea ? Number(form.landArea) : null,
            // Vistas segundo a tabela do manual (impacto 0,70 a 1,40).
            viewType: form.viewType || null,
          },
          // Áreas dependentes: valorizadas à parte da área principal.
          dependentAreas: {
            balconyOpenSqm: form.balconyOpenSqm ? Number(form.balconyOpenSqm) : null,
            balconyEnclosedSqm: form.balconyEnclosedSqm ? Number(form.balconyEnclosedSqm) : null,
            storageSqm: form.storageSqm ? Number(form.storageSqm) : null,
            storagePricePerSqm: form.storagePricePerSqm ? Number(form.storagePricePerSqm) : null,
            parkingType: form.parkingType || null,
            parkingCount: form.parkingCount ? Number(form.parkingCount) : null,
            terraceSqm: form.terraceSqm ? Number(form.terraceSqm) : null,
            terraceLocation: form.terraceLocation || null,
          },
          // Coordenadas exatas quando o consultor escolheu da lista.
          coordinates:
            form.lat && form.lon
              ? {
                  lat: Number(form.lat),
                  lon: Number(form.lon),
                  county: form.county || form.city || null,
                  freguesia: form.freguesia || null,
                  distrito: form.distrito || null,
                  radiusKm: Number(form.searchRadiusKm) || 2,
                }
              : null,
          land: { landArea: form.landArea ? Number(form.landArea) : null },
          consultantDescription: form.consultantDescription.trim() || null,
          criteria: {
            minPrice: form.criteriaMinPrice ? Number(form.criteriaMinPrice) : null,
            maxPrice: form.criteriaMaxPrice ? Number(form.criteriaMaxPrice) : null,
            minYearBuilt: form.criteriaMinYear ? Number(form.criteriaMinYear) : null,
            maxYearBuilt: form.criteriaMaxYear ? Number(form.criteriaMaxYear) : null,
            energyRatings: form.criteriaEnergyRatings,
            preferredFeatures: form.preferredFeatures,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao gerar avaliação");
      setResult(data);
    } catch (error: any) {
      toast({ title: "Erro ao gerar avaliação", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const buildPdf = (footerDataUri: string | null = null): jsPDF | null => {
    if (!result) return null;
    const doc = new jsPDF();

    // A reserva tem de ser conhecida ANTES de escrever o conteúdo — é ela
    // que impede o texto de chegar ao fundo onde a faixa vai ser desenhada.
    setFooterReserve(footerBandHeight(doc, footerDataUri));
    const pageHeight = doc.internal.pageSize.getHeight();

    const identity: ConsultantIdentity =
      consultant || { name: "Consultor Imobiliário" };

    // Capa: a do consultor tem prioridade. Quando existe PDF próprio, a capa
    // gerada não é desenhada — seriam duas capas seguidas. A folha "Quem eu
    // sou" mantém-se, porque é conteúdo e não identidade visual.
    if (!hasCustomCover(branding)) {
      addCoverPage(doc, {
        documentTitle: "Estudo Comparativo de Mercado",
        subtitle: form.address,
        consultant: identity,
      });
    }
    // A apresentação em PDF é inserida na fusão, não desenhada aqui.
    if (!hasCustomAbout(branding)) {
      addAboutPage(doc, identity);
    }

    // --- Informações da propriedade ---
    doc.addPage();
    addPageHeader(doc, identity, "Informações da Propriedade");
    let y = 46;

    y = addSectionTitle(doc, "Detalhes da propriedade", y);
    y = addKeyValueTable(doc, [
      ["Endereço", form.address],
      ["Cidade", form.city],
      ["Tipo de propriedade", PROPERTY_TYPE_PT[form.propertyType] || form.propertyType],
      ["Quartos", form.bedrooms ? String(form.bedrooms) : null],
      ["Casas de banho", form.bathrooms ? String(form.bathrooms) : null],
      ["Área de construção", form.area ? `${form.area} m2` : null],
      ["Área do lote", form.landArea ? `${form.landArea} m2` : null],
      ["Piso", form.floor != null && form.floor !== "" ? String(form.floor) : null],
      ["Ano de construção", form.yearBuilt ? String(form.yearBuilt) : null],
      ["Classe energética", form.energyRating ? form.energyRating.toUpperCase() : null],
      ["Estado de conservação", form.condition],
    ], y);

    // Características: só as que o imóvel tem. Uma lista de "não tem" seria
    // ruído num documento que vai à frente do proprietário.
    const characteristics = [
      form.hasElevator ? "Elevador" : null,
      form.hasGarage ? "Garagem" : null,
      form.hasBalcony ? "Varanda" : null,
      form.hasTerrace ? "Terraço" : null,
      form.hasPool ? "Piscina" : null,
      form.hasStorage ? "Arrecadação" : null,
      form.hasAirConditioning ? "Ar condicionado" : null,
      form.hasSeaView ? "Vista de mar" : null,
      form.hasGarden ? "Jardim" : null,
      form.hasSolarPanels ? "Painéis solares" : null,
      form.hasHeatPump ? "Bomba de calor" : null,
    ].filter(Boolean) as string[];

    if (characteristics.length > 0) {
      y = addSectionTitle(doc, "Características", y + 4);
      y = addBodyText(doc, characteristics.join("   ·   "), y);
    }

    // --- Valor estimado ---
    doc.addPage();
    addPageHeader(doc, identity, "Valor Estimado");
    y = 46;

    y = addSectionTitle(doc, "Valor estimado", y);
    y = addBodyText(doc, form.address, y);
    y = addValueEstimate(
      doc,
      {
        min: result.suggestedMin,
        max: result.suggestedMax,
        area: form.area ? Number(form.area) : null,
      },
      y
    );

    // O ajuste do terreno é explicado: um valor acima do que os comparáveis
    // sugerem tem de ser justificado, senão parece arbitrário.
    if ((result as any).factorNote) {
      y = addBodyText(doc, (result as any).factorNote, y + 2);
    }

    if ((result as any).landAdjustmentNote) {
      y = addBodyText(doc, (result as any).landAdjustmentNote, y + 2);
    }

    // Âncora de mercado: mostra ao proprietário contra que referência o valor
    // foi aferido, além dos comparáveis listados a seguir.
    // Contraste pedido vs pago, em destaque. Vai antes das notas de texto
    // porque é o que o proprietário precisa de ver primeiro.
    const gapPct = (result as any).askingVsSoldGapPct;
    const asking = (result as any).askingPricePerSqm;
    const sold = (result as any).inePricePerSqm;
    if (typeof gapPct === "number" && asking && sold) {
      y = addAskingVsSoldBlock(
        doc,
        {
          askingPricePerSqm: asking,
          soldPricePerSqm: sold,
          gapPct,
          zoneName: (result as any).ineGeoName || form.city || null,
        },
        y + 2
      );
    }

    if ((result as any).inePricePerSqm) {
      y = addBodyText(
        doc,
        `Valor mediano de escrituras (INE${(result as any).ineGeoName ? `, ${(result as any).ineGeoName}` : ""}): ` +
          `${Math.round((result as any).inePricePerSqm).toLocaleString("pt-PT")} €/m². ` +
          `Reflete preços efetivamente pagos, e não valores pedidos.`,
        y + 2
      );
    }

    // Áreas dependentes: o cliente tem de ver o que foi somado e porquê.
    const dep = (result as any).dependentAreas;
    if (dep && dep.lines?.length > 0) {
      y = addSectionTitle(doc, "Áreas dependentes", y + 4);
      for (const line of dep.lines) {
        y = addBodyText(doc, `${line.label}: ${formatCurrency(line.value)}`, y + 1);
      }
      y = addBodyText(
        doc,
        `Total somado ao valor: ${formatCurrency(dep.total)}. As varandas valem uma fração do €/m² da ` +
          `área principal; a arrecadação e o estacionamento têm valor de mercado próprio.`,
        y + 1
      );
    }

    // Tendência homóloga e yield bruta (INE) — contexto de mercado adicional.
    const trendYoy = (result as any).ineTrendYoyPct;
    if (typeof trendYoy === "number") {
      y = addBodyText(
        doc,
        `Tendência do mercado (INE, concelho): a mediana de escrituras variou ` +
          `${trendYoy > 0 ? "+" : ""}${String(trendYoy).replace(".", ",")}% face ao período homólogo.`,
        y + 2
      );
    }
    const rentSqm = (result as any).ineRentPerSqm;
    const yieldPct = (result as any).grossYieldPct;
    if (typeof rentSqm === "number") {
      y = addBodyText(
        doc,
        `Rendas (INE): renda mediana de novos contratos no concelho de ` +
          `${rentSqm.toFixed(2).replace(".", ",")} €/m²/mês` +
          (typeof yieldPct === "number"
            ? `, equivalente a uma yield bruta estimada de ${String(yieldPct).replace(".", ",")}%/ano ao valor recomendado (antes de impostos e encargos).`
            : "."),
        y + 2
      );
    }

    if (result.zonePricePerSqm) {
      y = addBodyText(
        doc,
        `Referência de mercado na zona: ${Math.round(result.zonePricePerSqm).toLocaleString("pt-PT")} €/m² ` +
          `(valor mediano de ${result.zoneSampleSize} imóveis à venda na zona). ` +
          `A avaliação cruza esta referência com os comparáveis diretos e as características do imóvel.`,
        y + 2
      );
    }

    // Estimativa por estado de conservação: o mesmo imóvel em três cenários.
    if (result.scenarios && result.scenarios.length > 0) {
      y = addSectionTitle(doc, "Estimativa por estado de conservação", y + 4);
      for (const s of result.scenarios) {
        y = addBodyText(
          doc,
          `${s.label}: ${s.pricePerSqmMin.toLocaleString("pt-PT")}–${s.pricePerSqmMax.toLocaleString("pt-PT")} €/m²` +
            `  →  ${formatCurrency(s.valueMin)} – ${formatCurrency(s.valueMax)}`,
          y + 1
        );
      }
    }

    // Validação pelo VPT (múltiplo do valor patrimonial), quando indicado.
    if (result.vptCrossCheck) {
      y = addBodyText(
        doc,
        `Validação pelo VPT: valor patrimonial ${formatCurrency(result.vptCrossCheck.vpt)}; ` +
          `a ${result.vptCrossCheck.multipleMin}–${result.vptCrossCheck.multipleMax}× ` +
          `(${result.vptCrossCheck.source === "aml" ? "referência oficial da Área Metropolitana de Lisboa" : "múltiplo indicado pelo consultor para esta zona"}) ` +
          `dá ${formatCurrency(result.vptCrossCheck.valueMin)} – ${formatCurrency(result.vptCrossCheck.valueMax)}.`,
        y + 2
      );
    }

    // --- Envolvente (mapa + pontos de interesse) ---
    // Só existe se as fontes externas responderam; caso contrário o documento
    // segue sem esta página, sem qualquer aviso ao cliente.
    const insights = (result as any).locationInsights;
    if (insights && (insights.mapDataUri || (insights.pois || []).length > 0)) {
      doc.addPage();
      addPageHeader(doc, identity, "Envolvente");
      y = 46;
      y = addSectionTitle(doc, "Localização e envolvente", y);
      y = addLocationMap(doc, insights.mapDataUri || null, y);
      y = addPointsOfInterest(doc, insights.pois || [], y);
    }

    // --- Comparáveis ---
    doc.addPage();
    addPageHeader(doc, identity, "Comparáveis");
    y = 46;
    y = addSectionTitle(doc, "Imóveis comparáveis", y);

    result.comparables.slice(0, 12).forEach((c: any) => {
      // Cada cartão tem altura variável — verifica-se o espaço antes de o
      // desenhar, senão parte-se a meio na mudança de página.
      if (y > pageHeight - 60 - getFooterReserve()) {
        doc.addPage();
        addPageHeader(doc, identity, "Comparáveis");
        y = 46;
      }
      y = addComparableCard(doc, {
        status: c.status,
        address: c.address,
        price: c.price,
        area: c.area,
        pricePerSqm: c.pricePerSqm,
        propertyType: c.propertyType,
        energyRating: c.energyRating,
        yearBuilt: c.yearBuilt,
        daysOnMarket: c.daysOnMarket,
        conditionLabel: c.conditionLabel,
        thumbnailDataUri: c.thumbnailDataUri,
        distanceKm: c.distanceKm,
        features: c.features,
      }, y);
    });

    // --- Análise ---
    doc.addPage();
    addPageHeader(doc, identity, "Análise");
    y = 46;
    y = addSectionTitle(doc, "Análise de mercado", y);

    // A narrativa vem em HTML com títulos e listas — renderizada com essa
    // estrutura, não achatada em texto corrido.
    y = addNarrative(doc, result.narrative || "", y, () => {
      addPageHeader(doc, identity, "Análise");
      return 46;
    });

    // Com capa própria, a página 1 do documento gerado nunca foi desenhada
    // (o jsPDF cria-a sempre) — sem isto, aparecia uma página em branco a
    // seguir à apresentação.
    if (hasCustomCover(branding) && doc.getNumberOfPages() > 1) {
      doc.deletePage(1);
    }

    // Folha de fecho (só se o consultor a tiver escrito), faixa de rodapé e
    // numeração. A faixa vai antes dos números para não os tapar.
    addClosingPage(doc, identity);
    addFooterBand(doc, footerDataUri);
    // A numeração é feita na fusão (mergeBrandingPages), onde o total de
    // páginas — com capa e apresentação carregadas — é conhecido.

    return doc;
  };

  // Caderneta predial: lê o PDF e pré-preenche os campos. Reutiliza o
  // extrator dos documentos do imóvel — mesma IA, mesmo formato de resposta.
  const [extractingDoc, setExtractingDoc] = useState(false);
  // Acerto manual do intervalo recomendado antes de exportar/enviar: escreve
  // diretamente no result, por isso UI, PDF e email ficam todos coerentes.
  const [editingValues, setEditingValues] = useState(false);
  const [editMin, setEditMin] = useState("");
  const [editMax, setEditMax] = useState("");
  const cadernetaInputRef = useRef<HTMLInputElement>(null);
  // O VPT vem da caderneta por omissão (não é editável à mão) — só desbloqueia
  // escrita manual quando uma caderneta foi lida e a IA não conseguiu extrair
  // o VPT dela (ex.: documento digitalizado sem essa página legível). Não é
  // "escreve o que quiseres à partida"; é uma exceção só quando a leitura falha.
  const [vptManualUnlocked, setVptManualUnlocked] = useState(false);

  const handleCadernetaFile = async (file: File) => {
    setExtractingDoc(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Não foi possível ler o ficheiro."));
        reader.readAsDataURL(file);
      });

      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch("/api/gpt/properties/extract-from-document", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ imageBase64: base64, kind: "caderneta" }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao ler o documento");

      const fields = data.fields || {};

      // O VPT: se esta leitura o encontrou, substitui o que lá estava (é como
      // se corrige uma leitura anterior mal feita) e o campo fica bloqueado —
      // veio de um documento, não se edita à mão por cima disso. Se esta
      // leitura NÃO o encontrou, não apaga um valor já lido antes; e se também
      // não havia nenhum, desbloqueia a escrita manual — é a única forma de o
      // consultor conseguir avançar quando a caderneta não tem essa página
      // legível (ex.: PDF digitalizado).
      // Leitura encontrou VPT: bloqueia (o documento manda, por cima de
      // qualquer valor manual que lá estivesse). Leitura falhou: só desbloqueia
      // se ainda não havia nenhum valor — se já havia um (lido antes, ou
      // escrito à mão numa tentativa anterior), este segundo documento sem VPT
      // não deve trancar nem destrancar nada, só se mantém como estava.
      if (fields.taxable_value) {
        setVptManualUnlocked(false);
      } else if (!form.taxableValue) {
        setVptManualUnlocked(true);
      }

      // Para os restantes campos: só preenche o que veio com valor E ainda
      // está vazio — a caderneta completa, não substitui o que o consultor
      // já escreveu.
      setForm((prev) => ({
        ...prev,
        area: prev.area || (fields.area ? String(fields.area) : ""),
        landArea: prev.landArea || (fields.land_area ? String(fields.land_area) : ""),
        bedrooms: prev.bedrooms || (fields.bedrooms ? String(fields.bedrooms) : ""),
        taxableValue: fields.taxable_value ? String(fields.taxable_value) : prev.taxableValue,
        yearBuilt: prev.yearBuilt || (fields.year_built ? String(fields.year_built) : ""),
        energyRating: prev.energyRating || fields.energy_rating || "",
        propertyType: fields.property_type || prev.propertyType,
        city: prev.city || fields.city || "",
        address: prev.address || fields.address || "",
        // Área bruta dependente da caderneta → campo "Arrecadação": entra no
        // valor pela via conservadora (250-1000 €/m², não o €/m² da área
        // principal). A caderneta não distingue arrecadação de garagem — se
        // parte for estacionamento, o consultor reclassifica no formulário.
        storageSqm: prev.storageSqm || (fields.dependent_area ? String(fields.dependent_area) : ""),
      }));

      const filled = ["area", "dependent_area", "land_area", "bedrooms", "taxable_value", "year_built", "energy_rating"]
        .filter((key) => fields[key] != null).length;

      toast({
        title: filled > 0 ? "✅ Caderneta lida" : "Caderneta sem dados legíveis",
        description:
          filled > 0
            ? `${filled} campo${filled === 1 ? "" : "s"} preenchido${filled === 1 ? "" : "s"}. Confirma antes de gerar.`
            : "Não foi possível extrair campos com confiança. Preenche à mão.",
      });
    } catch (error: any) {
      toast({ title: "Erro ao ler a caderneta", description: error.message, variant: "destructive" });
    } finally {
      setExtractingDoc(false);
      if (cadernetaInputRef.current) cadernetaInputRef.current.value = "";
    }
  };

  const handleExportPdf = async () => {
    const footer = await loadFooterImage(branding.footerImagePath);
    const doc = buildPdf(footer);
    if (!doc) return;

    // A fusão com a capa/contracapa é feita pelo pdf-lib: o jsPDF desenha
    // páginas mas não sabe importar páginas de outro PDF.
    // A capa carregada já traz o título do consultor; a sobreposição
    // acrescenta só o que o modelo não sabe — a morada e a data.
    const bytes = await mergeBrandingPages(doc, branding, {
      title: form.address,
      date: new Date().toLocaleDateString("pt-PT"),
    });
    saveMergedPdf(bytes, `Avaliacao_${form.address.replace(/\s+/g, "_")}.pdf`);
  };

  const handleSendByEmail = async () => {
    if (!linkedLead?.email) {
      toast({ title: "Sem lead ligada com email", variant: "destructive" });
      return;
    }
    setSendingEmail(true);
    try {
      const footer = await loadFooterImage(branding.footerImagePath);
      const doc = buildPdf(footer);
      if (!doc) return;

      // O email leva exatamente o mesmo documento que a exportação.
      const merged = await mergeBrandingPages(doc, branding, {
        title: form.address,
        date: new Date().toLocaleDateString("pt-PT"),
      });
      const base64Content = Buffer.from(merged).toString("base64");
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/smtp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          to: linkedLead.email,
          subject: `Avaliação do seu imóvel — ${form.address}`,
          html: `<p>Olá ${linkedLead.name},</p><p>Em anexo enviamos a avaliação comparativa de mercado que preparámos para o seu imóvel.</p>`,
          attachments: [{ filename: `Avaliacao_${form.address.replace(/\s+/g, "_")}.pdf`, content: base64Content, encoding: "base64" }],
        }),
      });
      const responseData = await res.json();
      if (!responseData.success) throw new Error(responseData.error || "Erro ao enviar");
      toast({ title: "✅ Avaliação enviada", description: `Enviada para ${linkedLead.email}` });
    } catch (error: any) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <ProtectedRoute>
      <Layout title="Avaliação de Imóvel">
        <div className="p-6 max-w-5xl mx-auto space-y-6">
          <div className="bg-gradient-to-r from-slate-50 to-blue-50 p-6 rounded-xl border border-slate-100">
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Home className="h-6 w-6 text-blue-600" />
              Avaliação Comparativa de Mercado
            </h1>
            <p className="text-slate-600 mt-1">
              Prepare uma avaliação profissional para apresentar numa angariação — com imóveis comparáveis reais e um preço sugerido.
            </p>
            {linkedLead && (
              <Badge variant="outline" className="mt-3 bg-white">Ligada a {linkedLead.name}</Badge>
            )}
          </div>

          <AiFeatureNotice feature="A avaliação por IA" />

          <Card>
            <CardHeader><CardTitle className="text-base">Dados do Imóvel</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <input
                  ref={cadernetaInputRef}
                  type="file"
                  accept="application/pdf,image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleCadernetaFile(file);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={extractingDoc}
                  onClick={() => cadernetaInputRef.current?.click()}
                >
                  {extractingDoc ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      A ler a caderneta...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      Ler caderneta predial (PDF)
                    </>
                  )}
                </Button>
                <p className="mt-1 text-xs text-muted-foreground">
                  Preenche áreas, ano e tipologia a partir do documento oficial. Nada é gravado
                  sem confirmares.
                </p>
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label>Morada *</Label>
                {/* Escolher da lista fixa as coordenadas exatas. Sem isso, a
                    morada era geocodificada depois a partir de texto ambíguo —
                    foi assim que uma avaliação em Mafra saiu com pontos de
                    interesse do Porto. */}
                <AddressAutocomplete
                  value={form.address}
                  onChange={(value) => setForm((prev) => ({ ...prev, address: value }))}
                  onSelect={(selection) =>
                    setForm((prev) => ({
                      ...prev,
                      address: selection.label,
                      // A cidade só é preenchida se estiver vazia: uma escolha
                      // anterior do consultor não deve ser substituída.
                      city: prev.city || selection.concelho || selection.city || "",
                      lat: String(selection.lat),
                      lon: String(selection.lon),
                      county: selection.concelho || selection.city || "",
                      freguesia: selection.freguesia || "",
                      distrito: selection.distrito || "",
                    }))
                  }
                  placeholder="Ex: Longo da Vila, Mafra"
                />
                {form.lat && form.lon && (
                  <p className="flex items-center gap-1 text-xs text-green-700">
                    <MapPin className="h-3 w-3" />
                    Localização fixada — comparáveis e envolvente vão usar estas coordenadas.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Cidade / Zona</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Ex: Lisboa" />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Imóvel *</Label>
                <Select value={form.propertyType} onValueChange={(v) => setForm({ ...form, propertyType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="apartment">Apartamento</SelectItem>
                    <SelectItem value="house">Moradia</SelectItem>
                    <SelectItem value="land">Terreno</SelectItem>
                    <SelectItem value="commercial">Comercial</SelectItem>
                    <SelectItem value="office">Escritório</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Área (m²)</Label>
                <Input type="number" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="Ex: 90" />
              </div>
              {/* O lote só se pergunta onde existe. Num apartamento o campo
                  seria ruído; numa moradia é dos fatores que mais pesa. */}
              {form.propertyType === "house" && (
                <div className="space-y-2 md:col-span-2">
                  <label className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm hover:bg-muted/50 max-w-xs">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={form.isSingleStorey}
                      onChange={(e) => setForm({ ...form, isSingleStorey: e.target.checked })}
                    />
                    Moradia térrea
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Térreas têm oferta escassa e procura própria — valoriza na análise.
                  </p>
                </div>
              )}
              {LAND_AREA_TYPES.includes(form.propertyType) && (
                <div className="space-y-2">
                  <Label>Área do lote (m²)</Label>
                  <Input
                    type="number"
                    value={form.landArea}
                    onChange={(e) => setForm({ ...form, landArea: e.target.value })}
                    placeholder="Ex: 450"
                  />
                  <p className="text-xs text-muted-foreground">
                    Terreno total da propriedade, incluindo a área de implantação.
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Tipologia (quartos)</Label>
                <Input type="number" value={form.bedrooms} onChange={(e) => setForm({ ...form, bedrooms: e.target.value })} placeholder="Ex: 2" />
              </div>
              <div className="space-y-2">
                <Label>Casas de Banho</Label>
                <Input type="number" value={form.bathrooms} onChange={(e) => setForm({ ...form, bathrooms: e.target.value })} placeholder="Ex: 1" />
              </div>
              <div className="space-y-2">
                <Label>Estado de Conservação</Label>
                <Input value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} placeholder="Ex: Renovado em 2022" />
              </div>
              <div className="space-y-2">
                <Label>Andar</Label>
                <Input type="number" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} placeholder="Ex: 3 (0 = r/c)" />
              </div>
              <div className="space-y-2">
                <Label>Classe Energética</Label>
                <Input value={form.energyRating} onChange={(e) => setForm({ ...form, energyRating: e.target.value })} placeholder="Ex: B-" />
              </div>
              <div className="space-y-2">
                <Label>Ano de Construção</Label>
                <Input type="number" value={form.yearBuilt} onChange={(e) => setForm({ ...form, yearBuilt: e.target.value })} placeholder="Ex: 2008" />
              </div>
              <div className="space-y-2">
                <Label>VPT — Valor Patrimonial Tributário (€)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={form.taxableValue}
                    readOnly={!vptManualUnlocked}
                    className={vptManualUnlocked ? "" : "bg-muted cursor-default"}
                    onChange={(e) => setForm({ ...form, taxableValue: e.target.value })}
                    placeholder={
                      vptManualUnlocked
                        ? "Ex: 107642 (da nota de cobrança do IMI, por exemplo)"
                        : "Lê a caderneta acima para preencher"
                    }
                  />
                  {form.taxableValue && !vptManualUnlocked && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setForm({ ...form, taxableValue: "" })}
                      title="Limpar (não apaga a caderneta, só este valor)"
                    >
                      Limpar
                    </Button>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {vptManualUnlocked
                    ? "Não consegui ler o VPT desta caderneta (pode estar digitalizada ou sem essa página legível) — podes indicá-lo à mão, se o tiveres de outro documento (ex.: nota de cobrança do IMI)."
                    : "Opcional, e vem da caderneta predial (botão acima) — fica bloqueado enquanto a leitura tiver corrido bem, para o número se manter rastreável a um documento oficial. Sem VPT, a avaliação simplesmente não usa esta validação."}
                </p>
              </div>

              {form.taxableValue && form.county && !isInAML(form.county) && (
                <div className="space-y-2 md:col-span-2">
                  <Label>Múltiplo VPT → mercado nesta zona</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={form.vptMultiplierOverride}
                    onChange={(e) => setForm({ ...form, vptMultiplierOverride: e.target.value })}
                    placeholder="Ex: 4.2"
                  />
                  <p className="text-xs text-gray-500">
                    {form.county} não é um concelho da Área Metropolitana de Lisboa — o rácio oficial
                    de 3,3–3,8× o VPT só está validado aí, por isso não se aplica automaticamente
                    fora dela. Se souberes um múltiplo de referência para esta zona, indica-o aqui;
                    senão, deixa em branco e a validação pelo VPT simplesmente não aparece (mais
                    seguro do que um número de Lisboa disfarçado de confirmação oficial).
                  </p>
                  <div className="rounded-md border border-blue-200 bg-blue-50/50 p-2.5 text-xs text-blue-900">
                    <span className="font-medium">Onde ir buscar um valor de referência: </span>
                    o{" "}
                    <a
                      href="https://zonamentopf.portaldasfinancas.gov.pt/simulador/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-medium inline-flex items-center gap-0.5"
                    >
                      simulador de zonamento do Portal das Finanças
                      <ExternalLink className="h-3 w-3" />
                    </a>{" "}
                    dá o Coeficiente de Localização desta zona, usado no cálculo do próprio VPT.
                    <strong> Não é o mesmo número</strong> que este múltiplo, e não há um estudo que
                    converta um no outro — serve só de contexto sobre se a zona é mais ou menos
                    valorizada do que a média. O múltiplo em si tem de vir do teu conhecimento do
                    mercado local (o que os imóveis desta zona costumam vender face ao VPT).
                  </div>
                </div>
              )}

              <div className="md:col-span-2 space-y-2">
                <Label>Características</Label>
                <p className="text-xs text-muted-foreground">
                  Marca o que o imóvel tem. Estas características são consideradas na avaliação —
                  a ausência de elevador num andar alto, por exemplo, pesa no valor.
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {([
                    ["hasElevator", "Elevador"],
                    ["hasGarage", "Garagem"],
                    ["hasBalcony", "Varanda"],
                    ["hasTerrace", "Terraço"],
                    ["hasStorage", "Arrecadação"],
                    ["hasAirConditioning", "Ar condicionado"],
                    ["hasPool", "Piscina"],
                    ["hasSeaView", "Vista mar"],
                    ["hasGarden", "Jardim"],
                    ["hasSolarPanels", "Painéis solares"],
                    ["hasHeatPump", "Bomba de calor"],
                    ["hasOpenViews", "Vistas desafogadas"],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 rounded-md border p-2 text-sm cursor-pointer hover:bg-muted/50">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={form[key] as boolean}
                        onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {/* ÁREAS DEPENDENTES E VISTAS — o que o método comparativo
                  exige valorizar à parte (manual, pág. 25-35 e 52). */}
              <div className="md:col-span-2 space-y-3 rounded-lg border bg-slate-50/60 p-4">
                <div>
                  <Label className="text-base">Áreas dependentes e vistas</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    As varandas, arrecadações e garagens não entram na área principal: valem à parte.
                    Preencher melhora a precisão do valor final.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Varanda aberta (m²)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={form.balconyOpenSqm}
                      onChange={(e) => setForm({ ...form, balconyOpenSqm: e.target.value })}
                      placeholder="Ex: 6"
                    />
                    <p className="text-[11px] text-muted-foreground">Vale 50% do €/m² da área principal.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Varanda fechada (m²)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={form.balconyEnclosedSqm}
                      onChange={(e) => setForm({ ...form, balconyEnclosedSqm: e.target.value })}
                      placeholder="Ex: 4"
                    />
                    <p className="text-[11px] text-muted-foreground">Vale 100% do €/m² (bem fechada).</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Arrecadação (m²)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={form.storageSqm}
                      onChange={(e) => setForm({ ...form, storageSqm: e.target.value })}
                      placeholder="Ex: 8"
                    />
                    <p className="text-[11px] text-muted-foreground">Valorizada a 250–1000 €/m². A leitura da caderneta preenche aqui a área bruta dependente — se parte for garagem, ajusta e usa o campo de estacionamento.</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm">Valor da arrecadação (€/m²)</Label>
                    <Input
                      type="number"
                      min="250"
                      max="1000"
                      value={form.storagePricePerSqm}
                      onChange={(e) => setForm({ ...form, storagePricePerSqm: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Estacionamento</Label>
                    <select
                      className="w-full rounded-md border bg-white px-3 py-2 text-sm"
                      value={form.parkingType}
                      onChange={(e) => setForm({ ...form, parkingType: e.target.value })}
                    >
                      <option value="">Sem lugar</option>
                      <option value="individual">Individual (box/lugar) — 10.000 €</option>
                      <option value="double">Duplo lado a lado — 20.000 €</option>
                      <option value="double_row">Duplo em fila — 15.000 €</option>
                      <option value="triple_row">Triplo em fila — 22.500 €</option>
                      <option value="outdoor">Ao ar livre — 5.000 €</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Nº de lugares</Label>
                    <Input
                      type="number"
                      min="0"
                      value={form.parkingCount}
                      onChange={(e) => setForm({ ...form, parkingCount: e.target.value })}
                      placeholder="Ex: 1"
                      disabled={!form.parkingType}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm">Terraço (m²)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={form.terraceSqm}
                      onChange={(e) => setForm({ ...form, terraceSqm: e.target.value })}
                      placeholder="Ex: 20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Localização do terraço</Label>
                    <select
                      className="w-full rounded-md border bg-white px-3 py-2 text-sm"
                      value={form.terraceLocation}
                      onChange={(e) => setForm({ ...form, terraceLocation: e.target.value })}
                      disabled={!form.terraceSqm}
                    >
                      <option value="">—</option>
                      <option value="top">Último piso (vistas, privacidade)</option>
                      <option value="ground">Rés do chão</option>
                    </select>
                    <p className="text-[11px] text-muted-foreground">
                      O terraço no último piso vale muito mais do que ao nível térreo.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Tipo de vista</Label>
                    <select
                      className="w-full rounded-md border bg-white px-3 py-2 text-sm"
                      value={form.viewType}
                      onChange={(e) => setForm({ ...form, viewType: e.target.value })}
                    >
                      <option value="">Não especificada</option>
                      <option value="sea_front_close">Mar/rio frontal próximo (+30 a +40%)</option>
                      <option value="sea_front">Mar/rio frontal (+20 a +30%)</option>
                      <option value="sea_distant">Mar/rio algo distante (+10 a +20%)</option>
                      <option value="sea_far">Mar/rio distante (+5 a +10%)</option>
                      <option value="sea_side">Mar/rio lateral (+0 a +5%)</option>
                      <option value="river">Rio (+10 a +15%)</option>
                      <option value="city_panoramic">Panorâmica de cidade (+15 a +40%)</option>
                      <option value="nature">Serra / natureza (+5 a +10%)</option>
                      <option value="building">Prédio em frente (neutro)</option>
                      <option value="privacy_invaded">Devassa da intimidade (−10 a −30%)</option>
                      <option value="cemetery">Campas de cemitério (−10 a −30%)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Descrição do imóvel (opcional)</Label>
                <Textarea
                  rows={3}
                  value={form.consultantDescription}
                  onChange={(e) => setForm({ ...form, consultantDescription: e.target.value })}
                  placeholder="Ex: Lote todo ajardinado, pintada por fora recentemente, cozinha remodelada em 2023..."
                />
                <p className="text-xs text-muted-foreground">
                  O que viste no imóvel e os números não mostram. Entra na análise escrita do
                  estudo.
                </p>
              </div>

              <div className="md:col-span-2 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setShowCriteria((prev) => !prev)}
                  className="flex w-full items-center justify-between text-left font-medium"
                >
                  <span>Critérios de análise dos comparáveis</span>
                  <span className="text-xs text-muted-foreground">
                    {showCriteria ? "Ocultar" : "Mostrar"}
                  </span>
                </button>
                <p className="mt-1 text-xs text-muted-foreground">
                  Opcional. Afina que imóveis entram na comparação.
                </p>
              </div>

              {showCriteria && (
                <>
                  <div className="space-y-2">
                    <Label>Preço mín. (€)</Label>
                    <Input
                      type="number"
                      value={form.criteriaMinPrice}
                      onChange={(e) => setForm({ ...form, criteriaMinPrice: e.target.value })}
                      placeholder="Qualquer"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Preço máx. (€)</Label>
                    <Input
                      type="number"
                      value={form.criteriaMaxPrice}
                      onChange={(e) => setForm({ ...form, criteriaMaxPrice: e.target.value })}
                      placeholder="Qualquer"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ano de construção — desde</Label>
                    <Input
                      type="number"
                      value={form.criteriaMinYear}
                      onChange={(e) => setForm({ ...form, criteriaMinYear: e.target.value })}
                      placeholder="Qualquer"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ano de construção — até</Label>
                    <Input
                      type="number"
                      value={form.criteriaMaxYear}
                      onChange={(e) => setForm({ ...form, criteriaMaxYear: e.target.value })}
                      placeholder="Qualquer"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Classificação energética</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {["A+", "A", "B", "B-", "C", "D", "E", "F"].map((rating) => {
                        const selected = form.criteriaEnergyRatings.includes(rating);
                        return (
                          <button
                            key={rating}
                            type="button"
                            onClick={() =>
                              setForm((prev) => ({
                                ...prev,
                                criteriaEnergyRatings: selected
                                  ? prev.criteriaEnergyRatings.filter((r) => r !== rating)
                                  : [...prev.criteriaEnergyRatings, rating],
                              }))
                            }
                            className={`rounded-md border px-3 py-1.5 text-sm ${
                              selected
                                ? "border-blue-600 bg-blue-600 text-white"
                                : "border-gray-200 bg-white text-gray-700 hover:border-blue-300"
                            }`}
                          >
                            {rating}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Comparáveis com classe fora da seleção são excluídos. Os que não a
                      declaram continuam a entrar.
                    </p>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Características desejadas</Label>
                    <p className="text-xs text-muted-foreground">
                      Não excluem: os comparáveis que as têm aparecem primeiro, os restantes
                      continuam a contar para o valor.
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {[
                        "Varanda", "Elevador", "Garagem", "Jardim",
                        "Estacionamento", "Arrecadação", "Piscina", "Terraço",
                        "Mobilado", "Vista",
                      ].map((feature) => {
                        const selected = form.preferredFeatures.includes(feature);
                        return (
                          <label
                            key={feature}
                            className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm hover:bg-muted/50"
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={selected}
                              onChange={() =>
                                setForm((prev) => ({
                                  ...prev,
                                  preferredFeatures: selected
                                    ? prev.preferredFeatures.filter((f) => f !== feature)
                                    : [...prev.preferredFeatures, feature],
                                }))
                              }
                            />
                            {feature}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* Raio da procura. Só faz sentido com coordenadas fixadas —
                  sem elas a pesquisa é por nome de localidade e o raio não se
                  aplica. */}
              {form.lat && form.lon && (
                <div className="space-y-2">
                  <Label>Raio da procura de comparáveis</Label>
                  <Select
                    value={form.searchRadiusKm}
                    onValueChange={(value) => setForm({ ...form, searchRadiusKm: value })}
                  >
                    <SelectTrigger className="max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 km — mesma rua/bairro</SelectItem>
                      <SelectItem value="2">2 km — freguesia / envolvente (recomendado)</SelectItem>
                      <SelectItem value="4">4 km — concelho</SelectItem>
                      <SelectItem value="8">8 km — alargado</SelectItem>
                      <SelectItem value="15">15 km — muito alargado</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Raio menor dá comparáveis mais fiéis mas em menor número. Alarga se a
                    zona tiver pouca oferta.
                  </p>
                </div>
              )}

              <div className="md:col-span-2">
                <Button onClick={handleGenerate} disabled={loading} className="w-full md:w-auto">
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  Gerar Avaliação
                </Button>
              </div>
            </CardContent>
          </Card>

          {result && (
            <>
              {result.suggestedMin && result.suggestedMax ? (
                <Card className="border-emerald-200 bg-emerald-50/50">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <TrendingUp className="h-8 w-8 text-emerald-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-emerald-700 font-medium">Valor Recomendado</p>
                        {editingValues ? (
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <Input
                              type="number"
                              className="w-40 bg-white"
                              value={editMin}
                              onChange={(e) => setEditMin(e.target.value)}
                              placeholder="Mínimo (€)"
                            />
                            <span className="text-emerald-900 font-bold">—</span>
                            <Input
                              type="number"
                              className="w-40 bg-white"
                              value={editMax}
                              onChange={(e) => setEditMax(e.target.value)}
                              placeholder="Máximo (€)"
                            />
                            <Button
                              size="sm"
                              onClick={() => {
                                const min = Number(editMin);
                                const max = Number(editMax);
                                if (!min || !max || min <= 0 || max < min) {
                                  toast({ title: "Valores inválidos", description: "Indique mínimo e máximo positivos, com o máximo ≥ mínimo.", variant: "destructive" });
                                  return;
                                }
                                setResult((prev) => (prev ? { ...prev, suggestedMin: min, suggestedMax: max } : prev));
                                setEditingValues(false);
                                toast({ title: "Valores acertados", description: "O PDF e o email passam a usar este intervalo." });
                              }}
                            >
                              Aplicar
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingValues(false)}>
                              Cancelar
                            </Button>
                          </div>
                        ) : (
                          <p className="text-2xl font-bold text-emerald-900">
                            {formatCurrency(result.suggestedMin)} — {formatCurrency(result.suggestedMax)}
                          </p>
                        )}
                      </div>
                      {!editingValues && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0 text-emerald-700 hover:text-emerald-900"
                          title="Acertar manualmente o intervalo antes de exportar"
                          onClick={() => {
                            setEditMin(String(result.suggestedMin ?? ""));
                            setEditMax(String(result.suggestedMax ?? ""));
                            setEditingValues(true);
                          }}
                        >
                          <Pencil className="h-4 w-4 mr-1" /> Acertar
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-amber-200 bg-amber-50/50">
                  <CardContent className="pt-6 text-sm text-amber-800 flex flex-wrap items-center justify-between gap-3">
                    <span>
                      Não há comparáveis suficientes na zona para sugerir um valor com confiança — reveja a análise abaixo manualmente.
                    </span>
                    {editingValues ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Input type="number" className="w-36 bg-white" value={editMin} onChange={(e) => setEditMin(e.target.value)} placeholder="Mínimo (€)" />
                        <span>—</span>
                        <Input type="number" className="w-36 bg-white" value={editMax} onChange={(e) => setEditMax(e.target.value)} placeholder="Máximo (€)" />
                        <Button
                          size="sm"
                          onClick={() => {
                            const min = Number(editMin);
                            const max = Number(editMax);
                            if (!min || !max || min <= 0 || max < min) {
                              toast({ title: "Valores inválidos", description: "Indique mínimo e máximo positivos, com o máximo ≥ mínimo.", variant: "destructive" });
                              return;
                            }
                            setResult((prev) => (prev ? { ...prev, suggestedMin: min, suggestedMax: max } : prev));
                            setEditingValues(false);
                            toast({ title: "Valores definidos", description: "O PDF e o email passam a usar este intervalo." });
                          }}
                        >
                          Aplicar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingValues(false)}>Cancelar</Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditMin("");
                          setEditMax("");
                          setEditingValues(true);
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-1" /> Definir valores manualmente
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Estimativa por cenários de conservação: mostra o valor do imóvel
                  conforme o estado (a necessitar obras → conservado → remodelado),
                  ancorado ao €/m² da zona — a leitura que os relatórios de mercado dão. */}
              {result.scenarios && result.scenarios.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Estimativa por estado de conservação</CardTitle>
                    <p className="text-sm text-gray-500 mt-1">
                      O mesmo imóvel vale de forma diferente conforme o estado. O salto entre cenários é o
                      potencial de valorização por obras.
                    </p>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b">
                          <th className="py-2 pr-3 font-medium">Cenário</th>
                          <th className="py-2 px-3 font-medium">€/m²</th>
                          <th className="py-2 pl-3 font-medium text-right">Valor total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.scenarios.map((s) => (
                          <tr key={s.key} className="border-b last:border-0">
                            <td className="py-2 pr-3 font-medium">{s.label}</td>
                            <td className="py-2 px-3 text-gray-700 whitespace-nowrap">
                              {s.pricePerSqmMin.toLocaleString("pt-PT")} – {s.pricePerSqmMax.toLocaleString("pt-PT")} €/m²
                            </td>
                            <td className="py-2 pl-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                              {formatCurrency(s.valueMin)} – {formatCurrency(s.valueMax)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}

              {/* Validação pelo VPT: âncora oficial que dá credibilidade ao número. */}
              {result.vptCrossCheck && (
                <Card className="border-blue-200 bg-blue-50/50">
                  <CardContent className="pt-6 text-sm text-blue-900">
                    <span className="font-medium">Validação pelo VPT: </span>
                    o valor patrimonial tributário é {formatCurrency(result.vptCrossCheck.vpt)}.{" "}
                    {result.vptCrossCheck.source === "aml" ? (
                      <>Na Área Metropolitana de Lisboa, o valor de mercado ronda {result.vptCrossCheck.multipleMin}–{result.vptCrossCheck.multipleMax}× o VPT</>
                    ) : (
                      <>Com o múltiplo de {result.vptCrossCheck.multipleMin}× indicado para esta zona</>
                    )}
                    , o que dá{" "}
                    <strong>{formatCurrency(result.vptCrossCheck.valueMin)} – {formatCurrency(result.vptCrossCheck.valueMax)}</strong>{" "}
                    — {result.vptCrossCheck.source === "aml" ? "confirmação oficial do intervalo" : "referência indicativa"}, não o valor principal.
                  </CardContent>
                </Card>
              )}

              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" onClick={handleExportPdf}>
                  <Download className="h-4 w-4 mr-2" /> Exportar PDF
                </Button>
                {linkedLead?.email && (
                  <Button variant="outline" onClick={handleSendByEmail} disabled={sendingEmail}>
                    {sendingEmail ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    Enviar por Email
                  </Button>
                )}
              </div>

              {result.narrative && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Relatório</CardTitle></CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: result.narrative }} />
                  </CardContent>
                </Card>
              )}

              {/* Análise de investimento — motor local (src/lib/underwriting),
                  alimentado pelo valor central da avaliação e pela renda
                  mediana do INE que o CMA já devolve. */}
              <InvestmentAnalysisCard
                suggestedPrice={result.suggestedCentral ?? null}
                area={Number(form.area) || null}
                ineRentPerSqm={result.ineRentPerSqm ?? null}
              />

              <Card>
                <CardHeader><CardTitle className="text-base">Imóveis Comparáveis ({result.comparables.length})</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {/* Distingue "fonte de dados falhou/vazia" de "mercado sem
                      comparáveis": se o Idealista deu erro ou não devolveu nada,
                      o problema é a integração, não o mercado. */}
                  {/* Homogeneização: o núcleo do método comparativo. Mostra o
                      que a média simples esconderia. */}
                  {result.homogenization?.applied && result.homogenization.pricePerSqm && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
                      <p className="font-medium text-emerald-900">
                        Comparáveis homogeneizados: {Math.round(result.homogenization.pricePerSqm).toLocaleString("pt-PT")} €/m²
                      </p>
                      <p className="text-xs text-emerald-800 mt-1">
                        Cada comparável foi ajustado às condições deste imóvel (negociação, área, estado, idade,
                        piso/elevador, vistas) antes da mediana — método comparativo com homogeneização.
                        {result.homogenization.rawPricePerSqm && result.homogenization.deltaPct != null && (
                          <>
                            {" "}A média simples dos anúncios daria{" "}
                            {Math.round(result.homogenization.rawPricePerSqm).toLocaleString("pt-PT")} €/m² (
                            {result.homogenization.deltaPct > 0 ? "+" : ""}
                            {result.homogenization.deltaPct}% de diferença).
                          </>
                        )}
                      </p>
                    </div>
                  )}

                  {result.dependentAreas && result.dependentAreas.lines.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-sm">
                      <p className="font-medium text-amber-900">
                        Áreas dependentes: +{result.dependentAreas.total.toLocaleString("pt-PT")} €
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {result.dependentAreas.lines.map((l, i) => (
                          <li key={i} className="text-xs text-amber-800 flex justify-between gap-3">
                            <span>{l.label}</span>
                            <span className="font-medium shrink-0">{l.value.toLocaleString("pt-PT")} €</span>
                          </li>
                        ))}
                      </ul>
                      <p className="text-[11px] text-amber-700 mt-1.5">
                        Já somadas ao valor recomendado. Varandas valem uma fração do €/m² da área
                        principal; garagem e arrecadação têm valor de mercado próprio.
                      </p>
                    </div>
                  )}

                  {(result.costMethod || result.incomeMethod) && (
                    <div className="rounded-lg border bg-slate-50 p-3 text-sm space-y-1">
                      <p className="font-medium text-slate-700">Validação por outros métodos</p>
                      {result.costMethod && (
                        <p className="text-xs text-slate-600">
                          <span className="font-medium">Custo:</span>{" "}
                          {result.costMethod.valueMin.toLocaleString("pt-PT")} € –{" "}
                          {result.costMethod.valueMax.toLocaleString("pt-PT")} € (terreno + construção + encargos + lucro)
                        </p>
                      )}
                      {result.incomeMethod && (
                        <p className="text-xs text-slate-600">
                          <span className="font-medium">Rendimento:</span>{" "}
                          {result.incomeMethod.value.toLocaleString("pt-PT")} € — {result.incomeMethod.note}
                        </p>
                      )}
                    </div>
                  )}

                  {result.comparablesDiagnostic &&
                    (result.comparablesDiagnostic.idealistaError || result.comparablesDiagnostic.idealistaRaw === 0) && (
                      <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                        <span aria-hidden>⚠️</span>
                        <div>
                          {result.comparablesDiagnostic.idealistaError ? (
                            <>A pesquisa de comparáveis no <strong>Idealista</strong> falhou ({result.comparablesDiagnostic.idealistaError}). </>
                          ) : (
                            <>O <strong>Idealista</strong> não devolveu comparáveis para esta zona/critérios. </>
                          )}
                          Os poucos ou nenhuns comparáveis abaixo <strong>não</strong> significam que o mercado não os tem — é a
                          fonte de dados que não os trouxe. Verifica a integração Idealista (Admin › Integrações) ou alarga a
                          área/critérios. A avaliação apoiou-se na mediana de escrituras do INE.
                        </div>
                      </div>
                    )}
                  {result.comparablesDiagnostic && result.comparablesDiagnostic.subjectHasCoords === false && (
                    <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                      <span aria-hidden>📍</span>
                      <div>
                        A morada não trouxe <strong>coordenadas</strong> (não foi escolhida do autocompletar), por isso o
                        filtro por raio não pôde atuar — os comparáveis podem vir de todo o concelho. Volte a introduzir a
                        morada e <strong>selecione-a da lista de sugestões</strong> para restringir à zona.
                      </div>
                    </div>
                  )}
                  {result.comparablesDiagnostic?.radiusStats &&
                    result.comparablesDiagnostic.radiusStats.farExcluded + result.comparablesDiagnostic.radiusStats.noCoordsExcluded > 0 && (
                      <p className="text-xs text-gray-400">
                        Filtro de zona ({result.comparablesDiagnostic.radiusKm} km):{" "}
                        {result.comparablesDiagnostic.radiusStats.nearKept + result.comparablesDiagnostic.radiusStats.noCoordsTextKept} na zona,{" "}
                        {result.comparablesDiagnostic.radiusStats.farExcluded + result.comparablesDiagnostic.radiusStats.noCoordsExcluded} excluídos por estarem fora.
                      </p>
                    )}
                  {result.comparables.length === 0 ? (
                    <p className="text-sm text-gray-400">Nenhum comparável encontrado na zona.</p>
                  ) : (
                    result.comparables.map((c, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 border rounded-lg p-3">
                        {(c.thumbnailDataUri || c.thumbnail) && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.thumbnailDataUri || c.thumbnail || ""}
                            alt=""
                            className="h-14 w-20 shrink-0 rounded object-cover"
                          />
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge className={c.status === "sold" ? "bg-emerald-600" : "bg-blue-500"}>
                              {c.status === "sold" ? "Vendido" : "Ativo"}
                            </Badge>
                            <span className="text-xs text-gray-400">{c.source}</span>
                          </div>
                          <p className="text-sm mt-1 flex items-center gap-1 truncate">
                            <MapPin className="h-3 w-3 shrink-0 text-gray-400" /> {c.address}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className="font-semibold text-sm">{formatCurrency(c.price)}</p>
                            <p className="text-xs text-gray-500">{c.area ? `${c.area} m²` : ""}{c.pricePerSqm ? ` · ${Math.round(c.pricePerSqm)}€/m²` : ""}</p>
                          </div>
                          {/* Link para abrir o anúncio. Só existe nesta vista de
                              trabalho do consultor — NÃO é escrito no PDF, que
                              vai para o cliente. */}
                          {c.url && (
                            <a
                              href={c.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Abrir anúncio no Idealista"
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
