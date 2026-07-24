/**
 * Páginas legais canónicas — vivem no SITE institucional (WordPress), não em
 * cada instância da aplicação.
 *
 * Decisão explícita do operador: com N instâncias (uma por agência), manter
 * uma política de privacidade por instância multiplicava documentos legais a
 * rever; o site é a fonte única. A barra final importa: sem ela o WordPress
 * responde 301, e a revisão da Meta rejeita URLs com redirect.
 */
export const PRIVACY_POLICY_URL = "https://vyxa.pt/politica-de-privacidade/";
