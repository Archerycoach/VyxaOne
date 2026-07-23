import {
  Phone,
  PhoneOff,
  PhoneMissed,
  Clock,
  Mail,
  MessageCircle,
  MessageSquare,
  Users,
  Home,
  StickyNote,
} from "lucide-react";

/**
 * Última interação de uma lead, de relance: o QUÊ (chamada, email, WhatsApp)
 * e o RESULTADO (atendeu, não atendeu, deixou mensagem).
 *
 * A cor carrega o resultado — verde correu bem, vermelho falhou, âmbar ficou
 * pendente — para a lista responder à pergunta "a quem é que eu preciso de
 * voltar a ligar?" sem abrir lead a lead.
 */

export interface LastInteraction {
  interaction_type: string | null;
  interaction_date: string | null;
  outcome: string | null;
}

const TYPE_META: Record<string, { icon: typeof Phone; label: string }> = {
  call: { icon: Phone, label: "Chamada" },
  email: { icon: Mail, label: "Email" },
  whatsapp: { icon: MessageCircle, label: "WhatsApp" },
  whatsapp_outbound: { icon: MessageCircle, label: "WhatsApp" },
  sms: { icon: MessageSquare, label: "SMS" },
  meeting: { icon: Users, label: "Reunião" },
  visit: { icon: Home, label: "Visita" },
  note: { icon: StickyNote, label: "Nota" },
};

type Tone = "success" | "fail" | "pending" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-green-100 text-green-800 border-green-200",
  fail: "bg-red-100 text-red-700 border-red-200",
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  neutral: "bg-gray-100 text-gray-700 border-gray-200",
};

/**
 * O desfecho é texto livre gravado pelo diálogo de contacto rápido
 * ("Atendeu", "Não Atendeu", ...). A leitura é por conteúdo e não por
 * igualdade exata, para sobreviver a variações de escrita.
 */
function classifyOutcome(outcome: string | null): { tone: Tone; label: string | null; icon?: typeof Phone } {
  const text = (outcome || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  if (!text) return { tone: "neutral", label: null };

  // "não atendeu" contém "atendeu" — o negativo testa-se primeiro.
  if (text.includes("nao atendeu")) return { tone: "fail", label: "Não atendeu", icon: PhoneOff };
  if (text.includes("numero invalido")) return { tone: "fail", label: "N.º inválido", icon: PhoneMissed };
  if (text.includes("atendeu") || text.includes("sucesso")) return { tone: "success", label: "Atendeu" };
  if (text.includes("ligar mais tarde")) return { tone: "pending", label: "Ligar mais tarde", icon: Clock };
  if (text.includes("deixou mensagem") || text.includes("mensagem")) return { tone: "pending", label: "Deixou mensagem" };
  if (text.includes("nao quer") || text.includes("desistiu") || text.includes("recusou")) {
    return { tone: "fail", label: outcome };
  }

  return { tone: "neutral", label: outcome };
}

/** "há 3 h", "há 2 d" — curto o suficiente para caber na lista. */
function relativeTime(date: string | null): string | null {
  if (!date) return null;
  const ms = Date.now() - new Date(date).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;

  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `há ${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days} d`;
  const months = Math.floor(days / 30);
  return `há ${months} m`;
}

export function LastInteractionBadge({ interaction }: { interaction: LastInteraction | null | undefined }) {
  if (!interaction?.interaction_type) return null;

  const meta = TYPE_META[interaction.interaction_type.toLowerCase()] || {
    icon: MessageSquare,
    label: interaction.interaction_type,
  };
  const result = classifyOutcome(interaction.outcome);
  const when = relativeTime(interaction.interaction_date);

  const Icon = result.icon || meta.icon;
  const text = [result.label || meta.label, when].filter(Boolean).join(" · ");

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONE_CLASSES[result.tone]}`}
      title={`${meta.label}${interaction.outcome ? ` — ${interaction.outcome}` : ""}${when ? ` (${when})` : ""}`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {text}
    </span>
  );
}
