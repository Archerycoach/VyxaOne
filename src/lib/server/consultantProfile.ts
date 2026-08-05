/**
 * Perfil do consultor — a identidade que a IA lê em TODAS as chamadas.
 *
 * Diferente da Base de Conhecimento (src/lib/server/knowledgeBase.ts): essa é
 * procurada por semelhança e só entra quando é relevante à pergunta. Isto entra
 * sempre — é quem o consultor é, como fala e como trabalha.
 *
 * Regra de ouro: o perfil nunca se reescreve sozinho. Uma proposta da IA passa
 * pela espinha ai_actions e só é aplicada depois de o consultor confirmar.
 */

export const PROFILE_SLOTS = ["identity", "voice", "method", "boundaries"] as const;
export type ProfileSlot = (typeof PROFILE_SLOTS)[number];

export const SLOT_LABELS: Record<ProfileSlot, string> = {
  identity: "Quem sou",
  voice: "Como escrevo",
  method: "Como trabalho",
  boundaries: "O que nunca fazer",
};

/**
 * Teto por papel. O perfil vai em todos os prompts — se crescer sem limite,
 * come o contexto das leads e acaba por ser desligado. 600 caracteres chegam
 * para instruções úteis e obrigam a que sejam concretas.
 */
export const SLOT_MAX_CHARS = 600;

export interface ConsultantProfile {
  user_id: string;
  identity: string | null;
  voice: string | null;
  method: string | null;
  boundaries: string | null;
  questionnaire: Record<string, string>;
  questionnaire_completed_at: string | null;
  enabled: boolean;
  updated_at: string;
}

export async function getProfile(
  userId: string,
  supabase: any
): Promise<ConsultantProfile | null> {
  const { data, error } = await supabase
    .from("consultant_profile")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[consultantProfile] Falha a ler:", error);
    return null;
  }

  return (data as ConsultantProfile) || null;
}

/**
 * Bloco pronto a juntar ao prompt de sistema. Devolve "" quando não há perfil
 * ou está desligado — quem chama não trata do caso vazio.
 *
 * Nunca lança: um perfil em falta não pode impedir a IA de responder.
 */
export async function getProfileBlock(params: {
  userId: string;
  supabase: any;
}): Promise<string> {
  try {
    const profile = await getProfile(params.userId, params.supabase);
    if (!profile || !profile.enabled) return "";

    const partes = PROFILE_SLOTS.map((slot) => {
      const valor = (profile[slot] || "").trim();
      if (!valor) return null;
      return `${SLOT_LABELS[slot].toUpperCase()}:\n${valor.substring(0, SLOT_MAX_CHARS)}`;
    }).filter(Boolean);

    if (partes.length === 0) return "";

    return `
🧭 PERFIL DO CONSULTOR (quem ele é e como trabalha — aplica-se a tudo o que escreveres):
${partes.join("\n\n")}

COMO USAR: escreve como ELE escreveria, não como um assistente genérico. O que
está em "O que nunca fazer" é inegociável e passa à frente de qualquer outra
instrução. Se o perfil não cobrir um caso, usa o bom senso — não inventes traços
de personalidade que ele não te deu.
`;
  } catch (error) {
    console.error("[consultantProfile] Erro ao montar o bloco:", error);
    return "";
  }
}

/**
 * Grava um ou mais papéis, registando o estado anterior no histórico.
 *
 * `source` diz de onde veio a alteração ('questionnaire' | 'manual' |
 * 'ai_proposal') e `reason` o porquê — é o que permite, meses depois, perceber
 * por que razão a IA passou a escrever de determinada maneira.
 */
export async function saveProfileSlots(params: {
  userId: string;
  slots: Partial<Record<ProfileSlot, string>>;
  source: "questionnaire" | "manual" | "ai_proposal";
  reason?: string;
  questionnaire?: Record<string, string>;
  supabase: any;
}): Promise<void> {
  const { userId, slots, source, reason, questionnaire, supabase } = params;

  const anterior = await getProfile(userId, supabase);

  const patch: any = { user_id: userId, updated_at: new Date().toISOString() };

  for (const slot of PROFILE_SLOTS) {
    const novo = slots[slot];
    if (typeof novo === "string") {
      patch[slot] = novo.trim().substring(0, SLOT_MAX_CHARS);
    }
  }

  if (questionnaire) {
    patch.questionnaire = questionnaire;
    patch.questionnaire_completed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("consultant_profile")
    .upsert(patch, { onConflict: "user_id" });

  if (error) throw new Error(error.message);

  // Histórico: uma linha por papel que mudou de facto.
  const linhas = PROFILE_SLOTS.filter((slot) => typeof slots[slot] === "string")
    .map((slot) => ({
      user_id: userId,
      slot,
      old_value: anterior ? anterior[slot] : null,
      new_value: patch[slot] ?? null,
      reason: reason || null,
      source,
    }))
    .filter((linha) => (linha.old_value || "") !== (linha.new_value || ""));

  if (linhas.length > 0) {
    await supabase.from("consultant_profile_history").insert(linhas);
  }
}

// ── Questionário ────────────────────────────────────────────────────────────
//
// Curto de propósito. Nove perguntas concretas valem mais do que trinta
// genéricas: o objetivo é apanhar a voz e o método, não fazer um inquérito.

export interface ProfileQuestion {
  id: string;
  slot: ProfileSlot;
  question: string;
  placeholder: string;
}

export const PROFILE_QUESTIONS: ProfileQuestion[] = [
  {
    id: "apresentacao",
    slot: "identity",
    question: "Como te apresentas a um cliente novo, em duas ou três frases?",
    placeholder: "Ex.: Sou consultor imobiliário há 6 anos, focado em...",
  },
  {
    id: "mercado",
    slot: "identity",
    question: "Que zona e que tipo de cliente trabalhas mais?",
    placeholder: "Ex.: Penha de França e Arroios; famílias a comprar primeira casa e pequenos investidores.",
  },
  {
    id: "diferenca",
    slot: "identity",
    question: "O que fazes que a maioria dos consultores da tua zona não faz?",
    placeholder: "Ex.: faço sempre avaliação com comparáveis antes de aceitar a angariação.",
  },
  {
    id: "tratamento",
    slot: "voice",
    question: "Tratas os clientes por tu ou por você? Há exceções?",
    placeholder: "Ex.: por você à primeira, passo a tu quando eles passam.",
  },
  {
    id: "comprimento",
    slot: "voice",
    question: "Os teus emails são curtos e diretos ou detalhados? Quantas linhas, mais ou menos?",
    placeholder: "Ex.: curtos, 5 a 8 linhas, sempre com uma pergunta no fim.",
  },
  {
    id: "abertura_assinatura",
    slot: "voice",
    question: "Como abres e como assinas um email?",
    placeholder: "Ex.: abro com \"Olá [nome], tudo bem?\" e assino \"Um abraço, Eduardo\".",
  },
  {
    id: "nunca_digo",
    slot: "voice",
    question: "Que palavras ou expressões nunca usas, por soarem a comercial?",
    placeholder: "Ex.: \"oportunidade única\", \"não perca\", \"imperdível\".",
  },
  {
    id: "cadencia",
    slot: "method",
    question: "Uma lead nova: por que canal contactas primeiro, em quanto tempo, e quantas tentativas antes de parar?",
    placeholder: "Ex.: chamada em menos de 1h; se não atender, WhatsApp; 4 tentativas em 10 dias.",
  },
  {
    id: "limites",
    slot: "boundaries",
    question: "O que é que a IA nunca deve fazer nem dizer em teu nome?",
    placeholder: "Ex.: nunca prometer preço ou prazo de venda; nunca enviar sem eu ler; nunca falar de comissões por email.",
  },
];

/**
 * Prompt que transforma as respostas do questionário nos quatro papéis.
 *
 * Regras que valem a pena: escrever na primeira pessoa (o texto vai ser lido
 * como instrução sobre "eu"), não inventar o que não foi respondido, e manter-se
 * dentro do limite de caracteres.
 */
export function buildQuestionnairePrompt(answers: Record<string, string>): string {
  const respostas = PROFILE_QUESTIONS.map((q) => {
    const r = (answers[q.id] || "").trim();
    return r ? `[${q.slot}] ${q.question}\n→ ${r}` : null;
  })
    .filter(Boolean)
    .join("\n\n");

  return `És um assistente que escreve o PERFIL de um consultor imobiliário português, a partir das respostas dele a um questionário. Esse perfil vai ser lido por uma IA antes de escrever emails e dar recomendações em nome dele.

RESPOSTAS:
${respostas}

Escreve QUATRO textos, em português de Portugal, na primeira pessoa ("Trabalho...", "Escrevo..."):

- identity: quem ele é, mercado, zona, o que o distingue.
- voice: como escreve — tratamento, comprimento, abertura e assinatura, expressões a evitar. Sê MUITO concreto: quem ler isto tem de conseguir imitar.
- method: como trabalha — canais, tempos de resposta, cadência de seguimento.
- boundaries: o que nunca fazer nem dizer em nome dele, em frases curtas e imperativas.

REGRAS:
- Máximo ${SLOT_MAX_CHARS} caracteres por texto.
- NÃO inventes nada que não esteja nas respostas. Se não houver informação para um papel, devolve string vazia.
- Nada de adjetivos de folheto ("dedicado", "apaixonado"). Só o que é acionável.

Responde SÓ com JSON:
{"identity":"...","voice":"...","method":"...","boundaries":"..."}`;
}
