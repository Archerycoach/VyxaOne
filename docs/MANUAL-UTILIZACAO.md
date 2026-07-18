# Manual de Utilização — Vyxa

> **Nota sobre este manual:** foi escrito a partir da estrutura e do código da
> aplicação. Os conceitos, fluxos e regras de negócio estão corretos, mas
> alguns detalhes de interface (texto exato de botões, ordem de campos) podem
> diferir ligeiramente do que vês no ecrã. Ao rever, corrige o que não bater
> certo — está pensado para ser editado.

---

## Índice

1. [O que é o Vyxa](#1-o-que-é-o-vyxa)
2. [Primeiros passos](#2-primeiros-passos)
3. [O dia a dia do consultor](#3-o-dia-a-dia-do-consultor)
4. [Leads e clientes](#4-leads-e-clientes)
5. [Imóveis e angariação](#5-imóveis-e-angariação)
6. [Agenda e tarefas](#6-agenda-e-tarefas)
7. [Comunicação com clientes](#7-comunicação-com-clientes)
8. [A Inteligência Artificial](#8-a-inteligência-artificial)
9. [Análise e desempenho](#9-análise-e-desempenho)
10. [Equipa e administração](#10-equipa-e-administração)
11. [Referência rápida do menu](#11-referência-rápida-do-menu)

---

## 1. O que é o Vyxa

O Vyxa é um CRM imobiliário com inteligência artificial integrada. Foi
desenhado à volta de uma ideia simples: **o consultor deve passar o tempo a
falar com pessoas, não a introduzir dados**.

Três conceitos atravessam toda a aplicação:

- **Lead** — uma pessoa interessada em comprar ou vender. Tem uma fase no
  pipeline, uma temperatura (quente/morno/frio) e um histórico completo.
- **Imóvel** — uma propriedade da tua carteira, que pode estar ligada a uma
  lead proprietária.
- **Interação** — tudo o que acontece com uma lead: chamadas, emails,
  mensagens, notas, visitas.

A IA lê estas três coisas e trabalha a partir delas.

---

## 2. Primeiros passos

### 2.1 Configurar a conta

Vai a **Definições** e trata destes pontos por ordem:

1. **Perfil e assinatura de email** — o teu nome, contactos e a assinatura que
   sai nos emails para clientes.
2. **Chave de IA** — se o teu plano não inclui IA, tens de configurar aqui a
   tua própria chave (OpenAI, Anthropic ou Google). Sem chave, as
   funcionalidades de IA não funcionam.
3. **Fases do pipeline** — as etapas por que passam as tuas leads. Podes
   personalizá-las; a IA aprende as tuas fases e trabalha com elas.
4. **Google Calendar** — liga a tua conta para os eventos sincronizarem nos
   dois sentidos.

> **Importante sobre a chave de IA:** para a pesquisa semântica de imóveis e
> para a memória das leads é preciso uma chave **OpenAI ou Google**. A
> Anthropic não tem serviço de *embeddings* próprio, por isso quem usa só
> Anthropic não terá essas duas funcionalidades.

### 2.2 Autonomia da IA

Ainda nas **Definições**, na secção **Autonomia da IA**, decides o que a IA
pode fazer sozinha. Cada capacidade tem três níveis:

| Nível | O que acontece |
|---|---|
| **Automático** | A IA aplica de imediato. Fica registado e podes desfazer. |
| **Propor** | Fica à espera da tua aprovação no Assistente IA. |
| **Desligado** | A IA nem sequer sugere. |

Por omissão, o trabalho interno do CRM (qualificação, temperatura, fase,
tarefas) está em **Automático** e os blocos de agenda em **Propor**.

**Nada que saia para o cliente — email, SMS, WhatsApp — é alguma vez
automático.** Isso é uma regra do produto, não uma definição.

---

## 3. O dia a dia do consultor

### 3.1 O Meu Dia

É por aqui que se começa a manhã. Reúne o que interessa hoje: tarefas,
compromissos e as leads que precisam de atenção.

### 3.2 Radar

O **Radar** é o teu acompanhamento ativo. Leads e contactos quentes ficam
marcados e o sistema avisa-te até resolveres — não deixa cair nada por
esquecimento. Cada item pode ser contactado, adiado ou resolvido (ganho,
perdido, sem interesse).

### 3.3 Assistente IA

Aqui vês **tudo o que a IA fez por ti** e o que espera aprovação:

- **Por aprovar** — propostas pendentes. Aprova ou rejeita uma a uma ou todas
  de uma vez.
- **Registo** — histórico auditável de cada alteração feita pela IA, com o
  botão **Desfazer** que repõe o valor anterior.

Se alguma vez duvidares do que a IA mudou numa lead, é aqui que confirmas.

---

## 4. Leads e clientes

### 4.1 Lista de leads

A página **Leads** tem vista em **grelha** (cartões) ou **lista** (tabela com
colunas configuráveis). Podes:

- Pesquisar por nome, email ou telefone (com botão para limpar a pesquisa).
- Filtrar por tipo: todos, compradores, vendedores.
- Ver arquivadas ou transferidas.
- **Filtros avançados de qualificação** — fase, temperatura, tipo de imóvel,
  finalidade, tipologia, zona, orçamento, financiamento, imóvel para vender,
  prazo de compra.
- **Sem contacto há X dias** — encontra rapidamente quem foi esquecido.
- Ordenar e exportar.

### 4.2 Ficha da lead

Ao abrir uma lead tens separadores para cada área:

- **Informações** — dados pessoais e qualificação.
- **Assistente IA** — probabilidade de conversão, **imóveis que encaixam**
  (cruzamento semântico), qualificação sugerida e insights.
- **WhatsApp** — conversa com o cliente.
- **Imóveis** — propriedades associadas (para leads proprietárias).
- **Interações**, **Notas**, **Eventos**, **Tarefas**.
- **Portal Cliente** — o acesso privado que podes dar ao cliente.
- **Cronologia** — tudo por ordem, incluindo o que a IA alterou.

### 4.3 Notas de voz

Na ficha da lead podes gravar uma **nota de voz**. É transcrita
automaticamente para as notas e a IA analisa-a: atualiza a qualificação,
reavalia a temperatura, sugere tarefas e blocos de agenda.

É a forma mais rápida de registar o que aconteceu numa chamada — falas em vez
de escrever.

### 4.4 Duplicados

A página **Duplicados** encontra leads repetidas em duas categorias:

- **Duplicado quase certo** — partilham telefone ou email.
- **A confirmar** — nomes muito parecidos e contactos que não coincidem (a
  mesma pessoa entrada por dois portais, ou uma gralha no nome).

Escolhes qual fica como principal e fundes. **Nunca funde sozinho.**

---

## 5. Imóveis e angariação

### 5.1 Imóveis

A tua carteira. Ao criar ou editar um imóvel tens duas ajudas:

**Preencher a partir de um documento** — envia um **PDF ou fotografia** da
caderneta predial, certificado energético ou CPCV, e os campos preenchem-se
sozinhos (morada, área, tipologia, quartos, classe energética, preço).

> Em PDF a leitura é fiável. Em fotografia, confirma sempre os números —
> a aplicação avisa quando a imagem não estava clara.
> PDFs digitalizados a partir de papel não têm texto: nesse caso, fotografa o
> documento.

**Descrição gerada por IA** — cria descrições apelativas para portais a partir
das características do imóvel.

**Indexar para pesquisa IA** — botão no topo da página. Prepara a carteira
para a pesquisa semântica. Só é preciso correr uma vez: imóveis novos e
editados são indexados sozinhos, e reindexar não custa nada porque imóveis
inalterados são ignorados.

### 5.2 Particulares (FSBO)

Para angariação junto de quem vende sem mediadora.

Encontras o anúncio como sempre fizeste (Idealista, OLX, Facebook), colas o
texto aqui e a aplicação:

1. **Organiza** os dados do imóvel em campos limpos.
2. **Avisa** se o anúncio parecer ser de uma mediadora e não de um particular.
3. **Cruza com a tua carteira de compradores** e diz-te quantos e quais
   encaixam, com percentagem e motivos.

Ligas ao proprietário já a saber que tens três compradores para aquele imóvel.

> **O contacto é sempre feito por ti.** A aplicação não envia nada ao
> proprietário nem faz contactos automáticos. Esta lista é o teu caderno de
> angariação — é privada, nem a tua equipa a vê.

Cada imóvel tem estado: Por contactar → Contactado → Sem interesse /
Angariado / Descartado.

### 5.3 Empreendimentos

Para construção nova: tipologias (T0 a T4+), gamas de preço, amenidades e
estado da obra. Entram no cruzamento com as leads compradoras.

### 5.4 Avaliação e Idealista

- **Avaliação de Imóvel** — análise comparativa de mercado com IA.
- **Idealista** — pesquisa no portal a partir dos critérios de uma lead.

---

## 6. Agenda e tarefas

### 6.1 Agenda

Vistas de **Dia**, **Semana** e **Mês**.

Dia e semana têm **grelha horária** ao estilo do Google Calendar: horas à
esquerda, eventos posicionados pela hora com altura proporcional à duração,
eventos sobrepostos lado a lado e uma **barra vermelha na hora atual** que se
atualiza sozinha.

- **Arrastar** um evento muda-o de hora e de dia, mantendo a duração.
- **Clicar num espaço vazio** cria um evento àquela hora.
- **Passar o rato** sobre um evento mostra o ícone de eliminar; também há
  botão **Eliminar** ao abrir o evento.
- Botão **Hoje** volta à data atual.

Eventos sugeridos pela IA aparecem a **amarelo tracejado** com ✓ e ✕ para
confirmar ou rejeitar. Só sincronizam com o Google depois de confirmados.

**Link de Reservas** — partilha com clientes para eles marcarem diretamente
nos teus horários livres.

### 6.2 Tarefas

Cada tarefa mostra a **lead a que diz respeito**, prioridade, estado e prazo
(com aviso de atraso). Podes concluir, editar, anotar ou eliminar.

---

## 7. Comunicação com clientes

### 7.1 Mensagens em massa

Envia email ou WhatsApp a listas de leads. Podes editar os destinatários antes
de enviar e receber **uma única cópia** para o teu histórico.

### 7.2 Emails por Procura

Campanhas segmentadas por critério de procura. Selecionas imóveis (da carteira
ou por link externo) e a IA escreve o email — incluindo os links dos imóveis.

### 7.3 Portal do Cliente

Cada lead pode ter um acesso privado onde vê os imóveis que lhe apresentaste.
O endereço usa um código seguro, não o nome do cliente.

### 7.4 Reativação e automações

- **Painel de Reativação** — recupera leads frias por sequências de mensagens.
- **Workflows de Automação** — regras que disparam ações em resposta a
  acontecimentos.
- **Registo de Envios Automáticos** — o que foi enviado automaticamente e a
  quem.

> **Consentimento:** quem faz *opt-out* é excluído das listas de marketing
> automaticamente, em email e WhatsApp.

---

## 8. A Inteligência Artificial

### 8.1 O que a IA faz sozinha

Sempre que adicionas uma **nota**, registas uma **interação** ou gravas uma
**nota de voz**, a IA analisa e atualiza a lead: temperatura, fase,
qualificação em falta, tarefas de seguimento e blocos de agenda. Recebes
sempre uma notificação (🔔) com o resumo.

O mesmo acontece com as **mensagens recebidas por WhatsApp**.

### 8.2 Agente IA (conversa)

Na página **Agente IA** falas com o assistente em linguagem natural. Podes
pedir-lhe para **alterar leads** — "muda a tipologia da Ana Ferreira para T3",
"marca como quentes as leads de Matosinhos". Ele mostra o que vai fazer e
espera que confirmes.

### 8.3 Pesquisa semântica de imóveis

Na ficha da lead, em **Assistente IA → Imóveis que encaixam**, a aplicação
cruza o que está **escrito** na lead — preferências *e notas* — com a
carteira. Apanha o que os filtros nunca apanham: "luminoso", "vista
desafogada", "espaço para escritório".

Também podes escrever a procura livremente na caixa de pesquisa.

### 8.4 Outras funcionalidades de IA

- **Buyer Match** — cruzamento diário de leads compradoras com imóveis e
  empreendimentos, com alertas.
- **Coach de Performance** — análise do teu desempenho e sugestões.
- **Financiamento** — simulação de crédito.
- **Documentos** — leitura de caderneta, certificado energético e CPCV.
- **Cartões de visita** — fotografa e cria o contacto.

### 8.5 Controlo e reversibilidade

Toda a ação da IA fica registada com o valor anterior. No **Assistente IA →
Registo** vês tudo e podes **Desfazer**. As alterações a leads aparecem também
na **Cronologia** da lead, a par das edições manuais.

---

## 9. Análise e desempenho

- **Dashboard** — visão geral com métricas de atividade.
- **Pipeline** — negócios por fase, com arrastar entre fases.
- **Negócios** e **Objetivos** — acompanhamento comercial e metas.
- **Relatórios** — análises com intervalo de datas configurável.
- **Análise de Desempenho** — indicadores individuais e de equipa.

---

## 10. Equipa e administração

- **Equipa** — gestão de consultores e desempenho coletivo.
- **Team Workflows** — automações ao nível da equipa.
- **Subscrição** — plano, faturação e período experimental.

### Perfis de acesso

| Perfil | O que vê |
|---|---|
| **Consultor** | As suas leads e dados. |
| **Team lead / Gestor** | Os dados da sua equipa. |
| **Broker** | Tudo — é o perfil de gestão do negócio. |
| **Admin** | **Apenas configuração e contas.** Não vê dados de clientes. |

> A separação do **Admin** é deliberada, por proteção de dados: quem administra
> a plataforma não tem acesso à informação dos clientes.

---

## 11. Referência rápida do menu

| Menu | Para quê |
|---|---|
| O Meu Dia | O que interessa hoje |
| Agente IA | Conversar com o assistente |
| Assistente IA | Aprovar e auditar o que a IA faz |
| Dashboard | Visão geral |
| Leads | Clientes e potenciais clientes |
| Pipeline | Negócios por fase |
| Imóveis | A tua carteira |
| Particulares | Angariação a quem vende sem mediadora |
| Empreendimentos | Construção nova |
| Contactos | Agenda de contactos |
| Radar | Acompanhamento ativo |
| Agenda | Calendário |
| Tarefas | O que há para fazer |
| Idealista | Pesquisa no portal |
| Negócios / Objetivos / Relatórios | Gestão comercial |
| Mensagens | Envios em massa |
| Emails por Procura | Campanhas segmentadas |
| Financiamento / Avaliação / Documentos | Ferramentas |
| Coach de Performance | Aconselhamento de IA |
| Equipa / Subscrição / Definições | Administração |

---

## Perguntas frequentes

**A IA pode enviar mensagens aos meus clientes sozinha?**
Não. Nada que saia para o cliente é automático — é uma regra do produto.

**Como sei o que a IA alterou?**
Assistente IA → Registo. Cada alteração tem o valor anterior e botão Desfazer.

**Posso desligar a IA?**
Sim, capacidade a capacidade, em Definições → Autonomia da IA.

**A pesquisa semântica não devolve nada.**
Corre **Indexar para pesquisa IA** na página Imóveis e confirma que tens chave
OpenAI ou Google configurada.

**O meu colega vê a minha lista de Particulares?**
Não. Essa lista é estritamente privada de cada consultor.
