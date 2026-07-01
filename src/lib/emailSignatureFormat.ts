/**
 * Remove blocos de parágrafo/div totalmente vazios (apenas espaços, &nbsp;
 * ou <br>) de um HTML de assinatura.
 *
 * Quando a assinatura é editada no editor de texto (Definições > Assinatura
 * de Email) e o utilizador pressiona Enter mais do que uma vez — por exemplo
 * entre "Com os meus melhores cumprimentos," e a fotografia — o editor cria
 * parágrafos vazios (`<p><br></p>`) que, em clientes de email, se traduzem
 * num espaço em branco muito maior do que o pretendido.
 *
 * Esta função remove APENAS esses blocos vazios; nunca toca em conteúdo
 * visível (texto, imagens, links), por isso a assinatura continua a ser
 * inserida tal como está, só sem o espaço em branco acidental.
 */
export function collapseEmptyBlocks(html: string): string {
  if (!html) return html;

  const emptyBlockPattern = /<(p|div)(?:\s[^>]*)?>(?:\s|&nbsp;|<br\s*\/?>)*<\/\1>/gi;

  let result = html;
  let previous: string;
  do {
    previous = result;
    result = result.replace(emptyBlockPattern, "");
  } while (result !== previous);

  return result;
}
