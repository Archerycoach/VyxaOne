/**
 * Prompt do email de reativação escrito por IA.
 *
 * Cada email da sequência tem de ter um ÂNGULO diferente — o histórico dos
 * ângulos já usados vai no contexto para a IA não repetir a abordagem. Uma
 * sequência em que todos os emails dizem o mesmo é ignorada ao segundo.
 */

export const REACTIVATION_ANGLES = [
  "novidade_mercado",
  "pergunta_aberta",
  "prova_social",
  "utilidade_pratica",
  "mudanca_condicoes",
  "encerramento_suave",
] as const;

export type ReactivationAngle = (typeof REACTIVATION_ANGLES)[number];

const ANGLE_BRIEFS: Record<ReactivationAngle, string> = {
  novidade_mercado:
    "Partilha algo novo no mercado da zona que interessa a quem procura o que esta lead procurava. Concreto e útil, não promocional.",
  pergunta_aberta:
    "Uma única pergunta, curta e genuína, sobre se a procura mudou ou ficou em pausa. Sem pressão nem argumentário.",
  prova_social:
    "Conta brevemente que outros clientes com procura semelhante encontraram casa recentemente. Sem nomes nem dados de terceiros.",
  utilidade_pratica:
    "Oferece algo útil mesmo que não compre agora: avaliação, ponto de situação sobre crédito, o que mudou nos preços da zona.",
  mudanca_condicoes:
    "Refere que as condições podem ter mudado desde o último contacto (taxas, oferta, preços) e que vale a pena reavaliar.",
  encerramento_suave:
    "Último email da sequência. Diz com honestidade que vais deixar de escrever, e que a porta fica aberta se quiser retomar. Sem culpabilizar nem criar urgência falsa.",
};

interface ReactivationEmailContext {
  leadName: string;
  consultantName: string;
  /** O que a lead procurava, em texto ("apartamento T3 em Lisboa"). */
  searchSummary: string;
  /** Dias desde o último contacto. */
  daysSinceContact: number;
  /** Ângulos já usados nesta sequência. */
  anglesUsed: string[];
  /** Ângulo a usar neste email. */
  angle: ReactivationAngle;
  /** Nº deste email na sequência (1 = primeiro). */
  attemptNumber: number;
  isLastEmail: boolean;
}

export function getReactivationEmailPrompt(context: ReactivationEmailContext): string {
  const {
    leadName, consultantName, searchSummary, daysSinceContact,
    anglesUsed, angle, attemptNumber, isLastEmail,
  } = context;

  return `Escreve um email de reativação para uma lead imobiliária que não responde há ${daysSinceContact} dias.

CONTEXTO:
- Cliente: ${leadName}
- Consultor (quem assina): ${consultantName}
- O que procurava: ${searchSummary}
- Este é o email nº ${attemptNumber} da sequência${isLastEmail ? " e o ÚLTIMO" : ""}
${anglesUsed.length > 0 ? `- Abordagens JÁ usadas (NÃO repetir): ${anglesUsed.join(", ")}` : "- É o primeiro contacto desta sequência"}

ABORDAGEM DESTE EMAIL: ${ANGLE_BRIEFS[angle]}

REGRAS:
- Português de Portugal, tratamento por "você" (nunca "tu" nem "vós").
- Curto: 3 a 5 frases no corpo. Emails longos não são lidos.
- Tom humano e direto, como um profissional que se lembra da pessoa. Nada de linguagem de marketing ("oportunidade imperdível", "não perca").
- NUNCA inventes imóveis, preços, nomes de clientes ou factos de mercado. Se não tens dados concretos, fala em termos gerais.
- NÃO uses urgência artificial nem culpabilizes o silêncio ("já lhe escrevi 3 vezes...").
- Termina com UM call-to-action claro e de baixo compromisso.
${isLastEmail ? "- Sendo o último, diz explicitamente que não voltarás a escrever sobre este assunto e que a porta fica aberta." : ""}

Devolve APENAS JSON com esta estrutura:
{
  "subject": "assunto do email, máx. 60 caracteres, sem emojis",
  "preheader": "linha de pré-visualização, máx. 90 caracteres",
  "bodyHtml": "corpo em HTML simples (só <p>, <strong>, <br>). SEM assinatura, SEM saudação de fecho, SEM links — são acrescentados depois.",
  "ctaLabel": "texto do botão principal, 2 a 4 palavras"
}`;
}

/**
 * Escolhe o ângulo deste email, evitando repetir os já usados.
 * O último email da sequência usa sempre o encerramento suave.
 */
export function pickAngle(anglesUsed: string[], isLastEmail: boolean): ReactivationAngle {
  if (isLastEmail) return "encerramento_suave";

  const available = REACTIVATION_ANGLES.filter(
    (a) => a !== "encerramento_suave" && !anglesUsed.includes(a)
  );

  // Todos usados (sequência mais longa do que os ângulos): recomeça, mas
  // nunca no encerramento.
  if (available.length === 0) return "novidade_mercado";

  return available[0];
}
