interface SellerReportContext {
  propertyTitle: string;
  referenceCode: string | null;
  price: number | null;
  interactions: any[];
  tasks: any[];
}

export function getSellerReportPrompt(context: SellerReportContext): string {
  return `És um consultor imobiliário a escrever um relatório de feedback (Sellers Report) para o proprietário do imóvel angariado.

Imóvel: ${context.propertyTitle} (${context.referenceCode || 'Sem ref'})
Preço atual: ${context.price}€

Visitas e Interações com clientes sobre este imóvel:
${JSON.stringify(context.interactions || [], null, 2)}

Tarefas realizadas sobre o imóvel:
${JSON.stringify(context.tasks || [], null, 2)}

O teu objetivo:
Cria um relatório em HTML limpo e profissional (usa h3, p, ul, li) para enviar ao proprietário.
- Faz um resumo do esforço comercial.
- Sintetiza o feedback dos clientes (o que gostaram e o que não gostaram).
- Se houver muito feedback sobre o preço alto, sugere subtilmente uma avaliação do valor.
- Mostra profissionalismo e transparência.

Responde EXCLUSIVAMENTE com o código HTML final do relatório.`;
}