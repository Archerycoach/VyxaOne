import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface AddressSelection {
  label: string;
  lat: number;
  lon: number;
  city: string | null;
  county: string | null;
  district: string | null;
  postcode: string | null;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  /** Chamado quando o utilizador ESCOLHE uma sugestão (com coordenadas). */
  onSelect: (selection: AddressSelection) => void;
  placeholder?: string;
  id?: string;
}

/**
 * Campo de morada com sugestões e coordenadas.
 *
 * Escrever a morada à mão obrigava a geocodificar texto ambíguo mais tarde —
 * foi assim que "Rua Serra do Arquitecto 15" foi parar ao Porto numa
 * avaliação em Mafra. Escolhendo da lista, ficamos com latitude e longitude
 * exatas, e a pesquisa de comparáveis pode passar a ser por raio em vez de
 * por nome de localidade.
 *
 * Continua a aceitar texto livre: quem não encontrar a morada escreve-a e a
 * avaliação segue como antes.
 */
export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  id,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressSelection[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Evita procurar a cada tecla — e evita gastar quota da Geoapify à toa.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guarda contra respostas fora de ordem: uma pesquisa lenta que chega
  // depois de uma rápida substituía sugestões já corretas.
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value || value.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const requestId = ++requestIdRef.current;
      setLoading(true);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch(
          `/api/geo/autocomplete?q=${encodeURIComponent(value.trim())}`,
          { headers: { Authorization: `Bearer ${session?.access_token}` } }
        );
        const data = await response.json();

        if (requestId !== requestIdRef.current) return;
        setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
        setOpen(true);
      } catch {
        if (requestId === requestIdRef.current) setSuggestions([]);
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  // Fechar ao clicar fora.
  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const choose = (suggestion: AddressSelection) => {
    onChange(suggestion.label);
    onSelect(suggestion);
    setOpen(false);
    setSuggestions([]);
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder || "Comece a escrever a morada..."}
        autoComplete="off"
      />

      {loading && (
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
      )}

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-white shadow-lg">
          {suggestions.map((suggestion, index) => (
            <li key={`${suggestion.lat}-${suggestion.lon}-${index}`}>
              <button
                type="button"
                onClick={() => choose(suggestion)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-blue-50"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                <span className="min-w-0">{suggestion.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
