/**
 * Formata um número de telefone para usar em links do WhatsApp (wa.me) ou
 * SMS. Só acrescenta o indicativo de Portugal (351) quando o número não tem
 * NENHUM indicativo — nunca sobrepõe um indicativo de outro país já
 * presente, o que antes produzia números inválidos como "351" + número
 * francês já com o seu próprio indicativo.
 */
export function formatPhoneForWhatsApp(rawPhone: string | null | undefined): string {
  if (!rawPhone) return "";
  const trimmed = rawPhone.trim();

  // Já vem com indicativo explícito ("+33...", "0033...") — respeita tal
  // como está, só remove a formatação (espaços, travessões, etc.).
  if (trimmed.startsWith("+")) {
    return trimmed.replace(/\D/g, "");
  }
  if (trimmed.startsWith("00")) {
    return trimmed.slice(2).replace(/\D/g, "");
  }

  const digitsOnly = trimmed.replace(/\D/g, "");

  // Já tem o indicativo de Portugal escrito sem o "+" (ex.: "351912345678").
  if (digitsOnly.startsWith("351") && digitsOnly.length > 9) {
    return digitsOnly;
  }

  // Exatamente 9 dígitos é o formato local de Portugal (móvel ou fixo),
  // sem indicativo nenhum — só aqui é seguro acrescentar o 351.
  if (digitsOnly.length === 9) {
    return `351${digitsOnly}`;
  }

  // Qualquer outro caso (mais dígitos, sem "+", "00" nem "351") — assume-se
  // que já inclui o indicativo de outro país, e não se mexe, para nunca
  // arriscar duplicar ou estragar um número internacional.
  return digitsOnly;
}
