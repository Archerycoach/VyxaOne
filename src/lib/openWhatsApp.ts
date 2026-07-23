import { formatPhoneForWhatsApp } from "@/lib/phoneFormat";

/**
 * Abre o WhatsApp do CONSULTOR com uma mensagem pronta, sem separador do
 * browser pelo caminho.
 *
 * O `wa.me` obriga a passar por uma página web antes de saltar para a
 * aplicação — ficava sempre um separador morto para trás. O protocolo
 * `whatsapp://` abre a aplicação diretamente (Windows, macOS, telemóvel).
 *
 * Fallback: se a aplicação não estiver instalada, o protocolo não faz nada —
 * detecta-se pela janela NÃO ter perdido o foco, e aí sim abre-se o wa.me,
 * que funciona em qualquer lado.
 */
export function openWhatsAppWithMessage(phone: string, text: string): void {
  const cleanPhone = formatPhoneForWhatsApp(phone);
  const encoded = encodeURIComponent(text);

  const deepLink = `whatsapp://send?phone=${cleanPhone}&text=${encoded}`;
  const webLink = `https://wa.me/${cleanPhone}?text=${encoded}`;

  let appOpened = false;
  const onBlur = () => {
    appOpened = true;
  };
  window.addEventListener("blur", onBlur);

  // Navegar para o protocolo não muda a página atual — o browser entrega o
  // pedido ao handler do WhatsApp (com uma confirmação na primeira vez).
  window.location.href = deepLink;

  setTimeout(() => {
    window.removeEventListener("blur", onBlur);
    if (!appOpened && !document.hidden) {
      window.open(webLink, "_blank");
    }
  }, 1800);
}
