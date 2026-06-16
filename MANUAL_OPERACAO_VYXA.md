# 📖 Manual de Operação - Vyxa CRM

Bem-vindo ao manual de utilização rápida da Vyxa. Este guia foi desenhado para o ajudar a tirar o máximo partido do seu CRM no dia a dia.

---

## 🧭 Índice
1. [Primeiros Passos (Configurações)](#1-primeiros-passos-configurações)
2. [Gestão Diária de Leads](#2-gestão-diária-de-leads)
3. [Usar o Assistente de Inteligência Artificial](#3-usar-o-assistente-de-inteligência-artificial)
4. [Enviar E-mails e Anexos](#4-enviar-e-mails-e-anexos)
5. [Criar Automações (Workflows)](#5-criar-automações-workflows)

---

### 1. Primeiros Passos (Configurações)
Para que a Vyxa funcione como um motor de vendas, garanta que tem as três ligações principais ativas:
* **Ligar o E-mail (SMTP):** Vá a *Definições > Integrações > SMTP*. Coloque os dados do seu provedor (Gmail, Outlook, Hostinger). Isto permite enviar e-mails de dentro da plataforma.
* **Ligar o Facebook/Instagram:** Vá a *Definições > Integrações > Meta*. Clique em "Conectar" para que as leads dos seus anúncios caiam diretamente na plataforma.
* **Ativar a IA:** Verifique em *Definições > Integrações > OpenAI* se a sua chave API está inserida para ativar os resumos automáticos.

### 2. Gestão Diária de Leads
A sua rotina começa no separador **Leads**:
1. **Entrada:** Quando uma lead entra (ex: via Facebook), aparece no topo da lista com a etiqueta "Novo".
2. **Detalhes:** Clique no nome da lead para abrir a sua ficha completa.
3. **Cronologia:** Na aba "Cronologia", verá tudo o que já aconteceu com este cliente (quando entrou, que formulário preencheu, que emails recebeu).
4. **Notas:** Registe sempre o resumo das chamadas na aba "Notas". Estas notas são essenciais para que a Inteligência Artificial aprenda sobre o cliente.

### 3. Usar o Assistente de Inteligência Artificial
A IA é a sua melhor amiga para poupar tempo. Dentro da ficha de qualquer Lead, procure a aba **Assistente IA (com o ícone de estrelas)**.
* **O que faz:** O sistema lê todas as notas, e-mails e interações que teve com o cliente e gera um "Termómetro".
* **Como usar:** Antes de ligar a um cliente que já não contacta há semanas, abra a aba Assistente IA. Em 2 segundos saberá o sentimento dele, as objeções que teve no passado e qual o próximo passo recomendado.
* **Criar Mensagens:** No topo da ficha da lead, clique em **"E-mail IA"** ou **"WhatsApp IA"**. A IA vai escrever uma mensagem baseada na fase em que o cliente está. Pode editar antes de enviar.

### 4. Enviar E-mails e Anexos
Já não precisa de sair da Vyxa para enviar uma apresentação.
1. Abra a ficha da Lead.
2. Clique no botão **"E-mail IA"** (mesmo que não vá usar a IA, pode apagar o texto e escrever o seu).
3. Escreva o seu texto.
4. Clique em **"Adicionar Ficheiro"** para carregar um PDF (ex: brochura de um imóvel).
5. Clique em **"Enviar E-mail Agora"**. O anexo fica guardado na nuvem e o e-mail é despachado.

*Dica:* Pode criar "Templates de E-mail" na área de Administrador, com PDFs já pré-anexados, para não ter de os carregar sempre!

### 5. Criar Automações (Workflows)
Quer que uma brochura seja enviada automaticamente a todos os clientes que chegam do Facebook?
1. Vá a **Team Workflows** (ou Automações).
2. Clique em **Novo Workflow** (ou use um Template).
3. Escolha o **Gatilho**: Ex: "Lead Meta (Facebook/Instagram)".
4. Escolha a **Ação**: Ex: "Enviar Email".
5. Preencha o corpo do e-mail e clique em **Adicionar Anexo** para colocar o PDF no workflow.
6. Grave e ative. O sistema tratará de tudo sozinho 24h por dia!

---
*Em caso de dúvidas técnicas, consulte o administrador do sistema ou reveja os logs na consola do painel principal.*