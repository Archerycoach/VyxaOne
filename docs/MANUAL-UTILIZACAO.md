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
6. [Agenda, reservas e tarefas](#6-agenda-reservas-e-tarefas)
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

#### Leads que voltam a contactar

Quando alguém que **já está na tua base** preenche um novo formulário da Meta,
a lead:

- **sobe ao topo da lista**, como se fosse nova (o histórico original mantém-se);
- ganha o distintivo laranja **🔁 Voltou a contactar**;
- recebe uma nota com os dados do novo formulário e os campos vazios são preenchidos;
- gera uma notificação na campainha.

É um sinal forte de intenção — a pessoa procurou-te outra vez.

> O distintivo desaparece assim que a contactares (compara a data da nova
> submissão com o teu último contacto). Não é um prazo fixo: fica lá enquanto
> não for tratada.

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
caderneta predial, certificado energético ou CPCV, e a ficha preenche-se
sozinha: morada, concelho, distrito, código postal, tipo de imóvel, tipologia,
área, quartos, casas de banho, andar, classe energética, ano de construção,
preço, **artigo matricial** e **valor patrimonial (VPT)**.

Se o título estiver vazio, é composto a partir do documento (ex.: "T3 ·
Apartamento · Lisboa") — dá para gravar a ficha sem escrever nada.

> Em PDF a leitura é fiável, porque o texto é extraído diretamente. Em
> fotografia, confirma sempre os números — a aplicação marca a leitura como
> duvidosa quando a imagem não estava clara.
> PDFs digitalizados a partir de papel não têm texto: nesse caso, fotografa o
> documento.

**Descrição gerada por IA** — cria descrições apelativas para portais a partir
das características do imóvel.

**Indexar para pesquisa IA** — botão no topo da página. Prepara a carteira
para a pesquisa semântica. Só é preciso correr uma vez: imóveis novos e
editados são indexados sozinhos, e reindexar não custa nada porque imóveis
inalterados são ignorados.

### 5.2 Particulares (FSBO)

Para angariação junto de quem vende sem mediadora. Tem dois separadores.

#### Procurar

Pesquisa no **Idealista** por zona e intervalo de preço, e mostra apenas os
anúncios de **particulares** (o portal identifica o tipo de anunciante, por
isso a filtragem é exata — não deixa passar mediadoras).

Cada resultado mostra logo:

| Indicador | O que diz |
|---|---|
| 📞 **Contacto** | Nome e telefone publicados no anúncio, com o número clicável |
| 👥 **Compradores** | Quantos e quais dos teus clientes encaixam, com percentagem |
| 🕐 **Tempo de mercado** | Cinzento até 3 semanas · **âmbar** a partir de 21 dias · **vermelho** a partir de 60 |
| 📉 **Baixou o preço** | Se o valor desceu desde que o começaste a acompanhar |

A lista vem ordenada pelos que têm mais compradores; em igualdade, aparecem
primeiro os que estão há mais tempo no mercado — os vendedores mais recetivos.

- **Abrir** — vai ao anúncio no Idealista.
- **Guardar** — passa-o para a tua lista de acompanhamento, já com o contacto.
- **Tocar no número** — liga e **regista a chamada** (ver abaixo).

#### Registo automático de chamadas

Sempre que tocas no número — na pesquisa ou na tua lista — a chamada arranca e
o Vyxa regista-a:

- o imóvel passa a **Contactado**, com a data;
- fica uma linha no histórico (*"Chamada efetuada em 19/07/2026 14:32"*), que
  se acumula se ligares mais vezes;
- se o imóvel ainda não estava na tua lista, **é guardado nesse momento** com
  os dados do anúncio e o contacto.

> A chamada arranca sempre primeiro — o registo corre em paralelo e nunca a
> atrasa. Se a rede falhar, a chamada faz-se na mesma.
>
> **Um clique não garante uma conversa.** Se ligaste e não atenderam, o imóvel
> fica na mesma como "Contactado" — muda o estado no seletor, é um clique. O
> histórico diz "Chamada efetuada", não "Falei com o proprietário".

> **Sobre o tempo de mercado:** o Idealista não indica a data de publicação, por
> isso o Vyxa conta a partir da **primeira vez que viu o anúncio** numa
> pesquisa tua. É um mínimo garantido — o anúncio pode já existir há mais
> tempo. A precisão melhora à medida que fores pesquisando as tuas zonas com
> regularidade.
>
> **Sobre os contactos:** são apresentados tal como estão publicados no
> anúncio, para te poupar o clique. **Só ficam guardados se carregares em
> Guardar** naquele imóvel — a pesquisa não cria listas de contactos.

#### Colar anúncio

Se encontrares o anúncio noutro sítio (OLX, Facebook, jornal), colas o texto e
a aplicação organiza os dados e avisa se parecer ser de uma mediadora.

#### A minha lista

Os imóveis guardados, com estado: Por contactar → Contactado → Sem interesse /
Angariado / Descartado. O botão **Ver compradores** recalcula o cruzamento a
qualquer momento.

> **A aplicação nunca contacta o proprietário.** Não envia mensagens, emails
> nem faz chamadas — organiza a informação e cruza-a com a tua carteira; o
> contacto é sempre teu. Esta lista é **privada de cada consultor**: nem a
> equipa nem os gestores a veem.
>
> Lembra-te de que a obrigação de consultar a **Lista Nacional de Não
> Contactação** antes de uma chamada comercial não solicitada aplica-se
> na mesma, tal como numa busca manual.

### 5.3 Empreendimentos

Para construção nova: tipologias (T0 a T4+), gamas de preço, amenidades e
estado da obra. Entram no cruzamento com as leads compradoras.

### 5.4 Avaliação e Idealista

- **Avaliação de Imóvel** — análise comparativa de mercado com IA.
- **Idealista** — pesquisa no portal a partir dos critérios de uma lead.

---

## 6. Agenda, reservas e tarefas

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

**Cores dos blocos:**

| Cor | O que é |
|---|---|
| Azul | Evento sincronizado com o Google |
| Roxo | Evento local, ainda não sincronizado |
| Amarelo tracejado | Sugerido pela IA — ✓ confirmar / ✕ rejeitar |
| **Verde tracejado** | **Horário livre para reserva** (ainda não é compromisso) |

### 6.2 Link de Reservas

Partilha com os clientes para eles marcarem diretamente nos teus horários
livres.

O botão **Link de Reservas** está em três sítios — **Agenda**, **Imóveis** e
**Empreendimentos** — para o poderes copiar no momento em que estás a falar
com o cliente sobre um imóvel, sem ter de ir à Agenda. É sempre o mesmo link
(um por consultor).

#### Criar horários disponíveis

Cria um evento e liga **"Disponível para reserva"**. Esse bloco aparece na tua
agenda a verde tracejado, com o prefixo "Livre ·".

> **Um horário livre não ocupa a tua agenda.** Aparece a verde só para saberes
> que está aberto a reservas, e **não é enviado para o Google Calendar** — o
> tempo continua livre para tudo o resto. Só quando um cliente reserva é que
> passa a compromisso e sincroniza com o Google, já com o nome dele.

#### Repetir horários

Ao criar uma disponibilidade, liga **"Repetir este horário"**: escolhes a data
limite num calendário e, se quiseres, os dias da semana. Sem escolher dias,
repete no mesmo dia da semana da data de início.

Exemplo: terça, 10h–11h, repetir até 31 de dezembro → cria todas as terças
até essa data, de uma só vez.

#### Alterar ou eliminar uma série

Ao abrir uma ocorrência de uma série, a aplicação pergunta o âmbito:

| Opção | O que afeta |
|---|---|
| **Apenas esta ocorrência** | Só aquele dia |
| **Esta e as seguintes** | Desta data para a frente |
| **Toda a série** | Tudo, incluindo as ocorrências anteriores |

Ao propagar uma alteração de horas, as **datas de cada ocorrência mantêm-se** —
só muda a hora e a duração. Mudar uma terça das 10h para as 11h passa todas as
terças seguintes para as 11h, cada uma no seu dia.

> **Horários já reservados por clientes nunca são alterados nem eliminados**,
> seja qual for o âmbito escolhido. A aplicação avisa quantos preservou.

#### Conflitos

Se marcares um compromisso que se sobreponha a um horário disponível, esse
horário **deixa de aparecer ao cliente** — automaticamente, sem teres de o
apagar. A verificação é feita duas vezes: ao mostrar a lista e no momento em
que o cliente confirma.

### 6.3 Tarefas

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

### Menu principal

| Menu | Para quê |
|---|---|
| O Meu Dia | O que interessa hoje |
| Dashboard | Visão geral |
| Leads | Clientes e potenciais clientes |
| Pipeline | Negócios por fase |
| Imóveis | A tua carteira |
| Empreendimentos | Construção nova |
| Contactos | Agenda de contactos |
| Agenda | Calendário e link de reservas |
| Tarefas | O que há para fazer |

### Grupos

**Análise de Desempenho** — Negócios · Performance · Objetivos · Relatórios

**Ferramentas** — Particulares · Idealista · Mensagens · Registo de Envios
Automáticos · Financiamento · Avaliação de Imóvel · Documentos

**Inteligência Artificial** — Assistente IA · Agente IA · Emails por Procura ·
Coach de Performance

**Administração** — Equipa · Subscrição · Definições

### Onde encontrar o que não tem menu próprio

| Funcionalidade | Onde está |
|---|---|
| **Radar** | Botão na barra da página **Leads** |
| **Link de Reservas** | Agenda, Imóveis e Empreendimentos |
| **Duplicados** | A partir da lista de Leads |
| **Portal do Cliente** | Separador na ficha de cada lead |

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

**Criei horários disponíveis e não aparecem no Google Calendar.**
É propositado. Um horário livre não é um compromisso — só sincroniza quando um
cliente o reservar.

**Marquei uma visita por cima de um horário livre. Tenho de o apagar?**
Não. Deixa de ser oferecido ao cliente automaticamente.

**Liguei a um particular e não atenderam — fica como contactado?**
Fica. O registo marca a **tentativa**, não a conversa. Se quiseres voltar a
tê-lo por contactar, muda o estado no seletor.

**Cliquei no número no computador e não aconteceu nada.**
A chamada depende de teres uma aplicação de telefone associada. O registo é
feito à mesma.

**Como cancelo todos os horários de uma série?**
Abre uma ocorrência qualquer, carrega em Eliminar e escolhe **"Eliminar toda a
série"**. Os que já tiverem cliente marcado são preservados.

**Uma lead antiga apareceu no topo da lista com um distintivo laranja.**
Voltou a preencher um formulário da Meta. Vê a nota mais recente para saberes
o que ela pediu desta vez.
