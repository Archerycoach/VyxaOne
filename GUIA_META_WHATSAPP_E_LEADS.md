# Guia Completo: Configuração da Meta (Facebook Leads + WhatsApp API)

Este guia destina-se ao Administrador do sistema e explica, passo a passo, como configurar as integrações da Meta (Facebook Lead Ads e WhatsApp Cloud API) para funcionarem em conjunto com a plataforma Vyxa.

---

## PARTE 1: Criação da Aplicação na Meta

O primeiro passo é criar uma "App" que servirá de ponte entre o Facebook/WhatsApp e o seu CRM.

1. Aceda a [Meta for Developers](https://developers.facebook.com/) e inicie sessão com a conta de Facebook associada ao seu Meta Business Manager.
2. Clique em **"My Apps"** (As minhas aplicações) no canto superior direito.
3. Clique no botão verde **"Create App"** (Criar Aplicação).
4. No objetivo (Use Case), selecione **"Other"** (Outro) e depois escolha **"Business"** (Negócios).
5. Dê um nome à aplicação (ex: "Vyxa CRM Integration"), insira o seu email de contacto e selecione a conta do **Business Manager** da sua empresa.
6. Clique em **"Create App"**.

---

## PARTE 2: Configuração dos Formulários (Lead Ads)

Para que as leads geradas pelos anúncios do Facebook/Instagram caiam automaticamente no Vyxa, precisa de ligar os Webhooks.

### 2.1. Criar o Formulário no Facebook
1. Aceda ao **Meta Business Suite** da página da sua empresa.
2. No menu esquerdo, vá a **"Todas as ferramentas"** -> **"Formulários Instantâneos"**.
3. Clique em **"Criar formulário"**.
4. **MUITO IMPORTANTE:** Nos campos de contacto do formulário, certifique-se de pedir:
   - **Nome Completo**
   - **Email**
   - **Número de Telefone** (o Facebook formata automaticamente com o indicativo do país do cliente, o que é crucial para o WhatsApp funcionar depois).
5. Guarde e Publique o formulário.

### 2.2. Ligar o Webhook de Leads
1. Volte ao [Meta for Developers](https://developers.facebook.com/) e entre na App que criou na Parte 1.
2. No menu esquerdo, clique em **"Add Product"** (Adicionar Produto) e escolha **"Webhooks"**.
3. No painel de Webhooks, no menu dropdown (dropdown list), selecione **"Page"** (Página) e clique em **"Subscribe to this object"**.
4. Vai aparecer uma janela a pedir dois dados:
   - **Callback URL:** `https://SEU_DOMINIO/api/meta/webhook`
   - **Verify Token:** Um código à sua escolha (gere este código no menu Admin -> Integrações do Vyxa e cole-o aqui).
5. Clique em "Verify and Save".
6. Após guardar, procure na lista de permissões o campo **`leadgen`** e clique em **"Subscribe"**.

---

## PARTE 3: Configuração do WhatsApp Oficial (Cloud API)

Para usar o WhatsApp Centralizado na Vyxa, precisa de adicionar o produto WhatsApp à sua App.

### 3.1. Adicionar e Configurar o WhatsApp
1. No [Meta for Developers](https://developers.facebook.com/), dentro da sua App, vá a **"Add Product"** e selecione **"WhatsApp"** -> "Set up".
2. No menu esquerdo vai aparecer "WhatsApp". Clique em **"API Setup"** (Configuração da API).
3. Na secção "Step 1: Select phone numbers", clique em **"Add phone number"**.
4. Insira o **Número Central da sua Empresa**. Terá de validar este número através de SMS ou Chamada de voz recebida nesse mesmo momento. *(Nota: O número não pode estar atualmente a ser usado numa aplicação do WhatsApp num telemóvel. Se estiver, terá de apagar a conta do WhatsApp normal primeiro).*
5. Após o número estar validado, a Meta vai fornecer-lhe dois IDs nesta página:
   - **WhatsApp Business Account ID**
   - **Phone Number ID** (Guarde este número, vai precisar dele na Vyxa).

### 3.2. Ligar o Webhook do WhatsApp (Para receber respostas)
1. Ainda dentro de **WhatsApp -> Configuration**, procure a secção de "Webhooks" e clique em **"Edit"**.
2. Preencha os dados:
   - **Callback URL:** `https://SEU_DOMINIO/api/whatsapp/webhook`
   - **Verify Token:** O mesmo token que gerou na Vyxa.
3. Guarde. De seguida, clique em **"Manage"** (Gerir) nos Webhook fields e subscreva (subscribe) o evento **`messages`**. (Isto permite à Vyxa ler as respostas dos clientes).

### 3.3. Criar o Token Permanente (System User)
A Meta fornece um token temporário (que expira em 24h) no painel de developers, mas precisa de um permanente para a Vyxa.
1. Aceda ao [Business Manager Settings](https://business.facebook.com/settings).
2. No menu esquerdo, vá a **Users -> System Users**.
3. Adicione um novo System User (ex: "Vyxa API User") com a role **Admin**.
4. Selecione o user criado e clique em **"Add Assets"**:
   - Vá a "Apps", selecione a sua App e dê acesso total (Full Control).
5. Clique em **"Generate New Token"**:
   - Selecione a sua App.
   - Escolha as permissões: `whatsapp_business_messaging`, `whatsapp_business_management`, e (se também usar a app para leads do Facebook) `leads_retrieval`, `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`.
   - Clique em Gerar e **GUARDE ESTE TOKEN IMEDIATAMENTE** (Começa por `EAA...`). É o seu "Access Token" permanente.

---

## PARTE 4: Criação e Aprovação do Template do WhatsApp

Para a Vyxa enviar uma mensagem automaticamente quando uma lead entra, tem de usar um "Template" pré-aprovado pela Meta.

1. Aceda ao [WhatsApp Manager](https://business.facebook.com/wa/manage/message-templates/).
2. No menu esquerdo, clique em **"Message Templates"** (Modelos de Mensagem).
3. Clique no botão azul **"Create Template"** (Criar Modelo).
4. **Categoria:** Selecione "Marketing" ou "Utility" (Utilitário).
5. **Nome:** Dê um nome em letras minúsculas e underscores (ex: `ola_primeiro_contacto`). **Este é o nome exato que terá de colocar na Vyxa.**
6. **Idiomas:** Selecione "Português (Portugal)" ou o idioma dos seus clientes.
7. **Construir o Modelo:**
   - **Cabeçalho (Opcional):** Texto simples (ex: "Agradecemos o seu interesse!").
   - **Corpo (Obrigatório):** Escreva a mensagem inicial. Pode usar variáveis numéricas, ex: *"Olá! Sou o assistente virtual da [Sua Agência]. Recebemos o seu contacto. Tem disponibilidade para falar connosco hoje?"*
   - **Rodapé (Opcional):** Ex: "Para parar de receber mensagens, responda STOP".
   - **Botões (Opcional mas Recomendado):** Adicione botões de Resposta Rápida (ex: "Sim, estou disponível", "Liguem-me mais tarde").
8. Clique em **"Submit"** (Submeter).
9. O processo de aprovação demora geralmente **entre 2 a 15 minutos** (pode chegar a 24h). Assim que o status mudar para "Aprovado" (Verde), está pronto a usar.

---

## PARTE 5: Ligar Tudo na Vyxa

Agora que a Meta está toda configurada, é hora de inserir os dados na sua plataforma Vyxa.

1. Entre na plataforma Vyxa como Administrador.
2. Vá a **Admin -> Integrações**.
3. Na área global do WhatsApp, preencha os campos que obteve da Meta:
   - **WhatsApp Business Account ID:** (O número curto obtido na Parte 3.1)
   - **Phone Number ID:** (O ID do número de telefone obtido na Parte 3.1)
   - **Access Token:** (O token longo começado em `EAA...` obtido na Parte 3.3)
   - **Nome do Template:** O nome exato que aprovou (ex: `ola_primeiro_contacto`) obtido na Parte 4.
4. Ative a integração e clique em **Salvar Configurações**.
5. Finalmente, vá ao menu **Admin -> Gestão de Utilizadores** e ligue o "Módulo WhatsApp" nos perfis dos consultores que pretende que beneficiem desta automatização (Ações -> Editar -> Ligar Módulo WhatsApp).

**Parabéns! A partir deste momento:**
- As Leads caem automaticamente do Facebook para a Vyxa.
- A Vyxa dispara o Template pré-aprovado automaticamente pelo número da empresa (se configurado nos Workflows).
- Quando a Lead responde, o Agente IA do Consultor assume a conversação.