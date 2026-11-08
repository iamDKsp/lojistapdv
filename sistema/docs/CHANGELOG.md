# Histórico — PDV Lojista

## 2026-11-08 — Módulo Exclusivo de Inteligência Comercial & Ranking de Vendedores (`/inteligencia-comercial`)

- **Feature Flag Independente no `/sys-init` (`modulos.inteligenciaComercial` em `frontend/src/app/sys-init/page.tsx`, `frontend/src/retail/RetailLayout.tsx`, `backend/src/tenants/tenants.service.ts` e `scripts/demo-local.cjs`)**:
  - Módulo habilitado separadamente por loja (`modulos.inteligenciaComercial`), exibindo o selo *Inteligência* na listagem de tenants e a chave de ativação dedicada na aba *Módulos* do `/sys-init` (já habilitado por padrão na Loja Demonstração).
- **Motor Backend de Inteligência de Vendedores (`backend/src/retail/retail-intelligence.service.ts`, `backend/src/retail/retail.controller.ts` e `backend/src/retail/retail-intelligence.service.spec.ts`)**:
  - Novos endpoints `GET /api/retail/intelligence` e `PUT /api/retail/intelligence/goals` com agregação no fuso `America/Sao_Paulo` cruzando operadores (`Operator`), fotos sincronizadas do Heart (`operator_profiles` / `users`), vendas (`Sale` + `SaleItem` com custo congelado `priceCost`) e devoluções/trocas (`RetailReturn`).
  - **Atribuição Fiel de Trocas ao Vendedor de Origem**: cada troca (`RetailReturn`) é contabilizada na carteira do vendedor que realizou a **venda original** (`return.sale.operatorId`), calculando taxa de troca (`%` sobre o bruto vendido), valor trocado, peças devolvidas e principais motivos de devolução por vendedor.
  - **Auditoria de Descontos**: cálculo do índice de desconto (`%` sobre o subtotal original antes do desconto), total concedido em R$, frequência de vendas com desconto e alerta configurável de teto saudável.
  - **Persistência Zero-Migration de Metas e Comissões**: metas mensais da loja, cotas individuais, alíquota base, bônus de 1º lugar e gatilho de supermeta persistidos em `TenantSettings.paymentMethodsConfig._commercialIntelligenceConfig`, sem exigir migração de schema em bancos de clientes.
- **Interface Gamificada de Ranking, Pódio Top 3, Calendário de Vendas e Raio-X 360º (`frontend/src/retail/RetailIntelligencePage.tsx` e `frontend/src/retail/retail.css`)**:
  - **Aba 1 — Ranking e Pódio (`/inteligencia-comercial`)**: palco escuro de alto contraste inspirado no layout de referência (*UI Design Ranking*), com seletor estilo `Challenges v` para reordenar o pódio e a lista em tempo real por 7 critérios (*Faturamento Líquido*, *Faturamento Bruto*, *Dias em 1º Lugar / Vitórias*, *Volume de Peças*, *PA — Peças por Atendimento*, *Ticket Médio* e *Fidelização de Clientes*), Pódio Top 3 (`#2` à esquerda, `#1` ao centro com coroa/escudo e `#3` à direita) e leaderboard numerado com foto, `Win(%)`, PA, índice de desconto, taxa de trocas, melhor dia e vendas líquidas.
  - **Aba 2 — Calendário de Vendas (`/inteligencia-comercial/calendario`)**: grade mensal interativa exibindo faturamento líquido diário, quantidade de vendas/peças, barra térmica e o **Campeão do Dia (`#1`)** em cada data; ao clicar em qualquer dia, exibe o ranking dos vendedores naquela data e a auditoria completa de todas as vendas realizadas (horário, código, vendedor, cliente, itens com tamanho/cor, pagamentos, desconto e se houve troca posterior).
  - **Aba 3 — Descontos, Trocas e Metas (`/inteligencia-comercial/auditoria-e-metas`)**: matriz comparativa de desconto vs. taxa de troca com principais motivos por vendedor e simulador/configurador de metas mensais e comissões líquidas.
  - **Modal Raio-X 360º do Vendedor**: aberto ao clicar em qualquer vendedor no pódio ou no leaderboard, detalhando progresso de meta, comissão estimada, margem bruta deixada na loja, dia recorde, melhor dia da semana, horário de pico, mix de categorias/produtos mais vendidos, motivos de troca e histórico de vendas do período.

## 2026-11-08 — Correção de Sobreposição (`z-index` / Stacking Context) nos Menus Flutuantes do Cabeçalho

- **Camada de Empilhamento dos Menus do Cabeçalho (`frontend/src/retail/retail.css`, `frontend/src/retail/RetailPosPage.tsx` e `frontend/src/retail/RetailLayout.tsx`)**:
  - Definido `position: relative; z-index: 30` em `.retail-canvas-header` (e `z-index: 100` em `.retail-canvas-header:has(.retail-floating-menu)`, `.retail-profile-dropdown-wrap:has(.retail-floating-menu)` e `.retail-floating-menu`), garantindo que os menus de notificações, controle do caixa e perfil fiquem sempre acima da barra de busca (`Buscar produto ou código · F3`), da grade de produtos e do painel `Detalhes da Transação`.
  - Substituído `animation-fill-mode: both` por `backwards` nas animações de entrada de palco/catálogo/pedido e movida a animação de título do PDV para `.retail-pos-stage .retail-canvas-title-wrap`, evitando a criação permanente de contextos de empilhamento por `transform` após o término da animação.
  - Adicionado fechamento automático dos menus flutuantes ao clicar fora de `.retail-profile-dropdown-wrap` ou pressionar `Escape`.

## 2026-11-08 — Remoção da Sobreposição Roxa em Tela Cheia ao Trocar de Módulo

- **Troca Instantânea de Módulos (`frontend/src/retail/RetailLayout.tsx` e `frontend/src/pages/GroupPortalPage.tsx`)**:
  - Removido o disparo de `triggerSessionEntryTransition` ao alternar entre módulos, mantendo apenas as transições rápidas de palco/aba e preservando integralmente os atalhos de setas (`↑`/`↓` para módulos e `←`/`→` para abas).

## 2026-11-08 — Auto-Publicação Inicial da Loja Virtual (`/loja/:slug`), Reconciliação de Slug no Heart e Curadoria Automática Inicial

- **Auto-Publicação na Primeira Inicialização (`backend/src/storefront/storefront-admin.service.ts` e `backend/src/storefront/storefront-public.service.ts`)**:
  - Ao habilitar o módulo `lojaVirtual` para uma loja, `ensureSettingsInitialized` e `resolvePublishedStore` inicializam e promovem automaticamente o registro inicial (`publishedVersion: 1`, `isPublished: true`) no tenant e no `StorefrontRegistry` do Heart, evitando retorno `404` ao abrir `/loja/:slug` logo após ativar o módulo (preservando o bloqueio `404` caso o lojista clique explicitamente em *Despublicar*).
  - Removido o bloqueio que impedia clicar em *Publicar loja* antes de preencher o WhatsApp na aba *Configurações*, e sincronizado o salvamento automático de `settingsForm` ao clicar em *Publicar loja* em `RetailStorefrontPage.tsx`.
  - No primeiro sincronismo do catálogo da loja (`ensureProductsSynced`), todos os grupos de mercadorias ativos (`RetailGroup`) já iniciam visíveis na vitrine (`visible: true`, com os 8 primeiros em destaque).

## 2026-11-02 — Correção da Migração do Banco Heart (`operator_profiles` e `storefront_registry`) e Auto-DDL da Loja Virtual

- **Mapeamento de `OperatorProfile` no Schema do Heart (`backend/prisma/heart.schema.prisma`)**:
  - Adicionado o modelo `OperatorProfile` (`@@map("operator_profiles")`) ao `heart.schema.prisma` para que `npx prisma db push --schema="prisma/heart.schema.prisma"` reconheça a tabela criada por `ensureHeartColumnsAndTables()` e não aborte a migração no `/sys-init` com alerta de perda de dados (`You are about to drop the operator_profiles table`).
- **Auto-DDL Idempotente da Loja Virtual no Heart e no Tenant (`backend/src/prisma/heart-prisma.service.ts`, `backend/src/prisma/tenant-prisma.service.ts` e `backend/src/tenants/tenants.service.ts`)**:
  - Incluída a criação idempotente (`CREATE TABLE IF NOT EXISTS`) de `storefront_registry` em `HeartPrismaService.ensureHeartColumnsAndTables()` e das 8 tabelas da Loja Virtual (`storefront_settings`, `storefront_revisions`, `storefront_categories`, `storefront_products`, `storefront_orders`, `storefront_order_items`, `stock_reservations` e `storefront_order_events`) no bloco PL/pgSQL `ensureTenantRuntimeSchema()` e na ativação do módulo em `TenantsService.updateTenant`.

## 2026-11-01 — Correção de Injeção de Dependência (`SalesService`) no `StorefrontModule` e Feedback de Erro 5xx no `/sys-init`

- **Exportação de `SalesService` no `SalesModule` (`backend/src/sales/sales.module.ts`)**:
  - Adicionado `exports: [SalesService]` ao `SalesModule` para resolver a dependência do `StorefrontOrdersService` dentro do `StorefrontModule`, eliminando o `UnknownDependenciesException` que impedia a inicialização do container em produção (HTTP 502).
- **Tratamento de Indisponibilidade Temporária no Login do `/sys-init` (`frontend/src/app/sys-init/page.tsx`)**:
  - Diferenciado erro de rede/gateway (`HTTP 5xx` ou falha de conexão) de erro de senha inválida (`HTTP 401/403`) em `handleValidatePin`, preservando os dígitos digitados e exibindo mensagem clara de indisponibilidade temporária do servidor.

## 2026-11-01 — Experiência Mobile Nativa (PWA Standalone), Bloqueio de Zoom/Overscroll e Balão Inferior Glassmorphism com Auto-Hide

- **Comportamento Nativo de Aplicativo Salvo na Tela Inicial (`frontend/index.html`, `frontend/public/manifest.webmanifest`, `frontend/vite.config.ts`, `frontend/src/main.tsx`, `frontend/src/app/globals.css` e `frontend/src/App.tsx`)**:
  - Configurado `<meta name="viewport">` com `minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content` e unificado `theme-color` / `background_color` do PWA em `#F8F7FC` (`--pdv-background`), eliminando faixas escuras no topo e na base ao abrir o app salvo na tela inicial.
  - Adicionados bloqueios nativos em `main.tsx` contra *pinch-to-zoom* (`gesturestart`/`gesturechange`/`gestureend` e `touchmove` multitoque), *double-tap zoom* (`touchend` rápido `< 280ms`) e zoom via `ctrlKey + wheel`, além de `font-size: 16px` global em todos os campos (`input`, `select`, `textarea`) no mobile para impedir auto-zoom do iOS ao focar.
  - Travado o *rubber-band overscroll* (arrasto elástico além das bordas) com `overscroll-behavior: none` e `overflow: hidden` em `html, body, #root, .retail-shell`, mantendo `.retail-canvas` como único container de rolagem de borda infinita.
- **Respiro Superior para iPhone (Notch / Dynamic Island) e Base sem Borda Preta (`frontend/src/retail/retail.css`)**:
  - Removido o fundo escuro `var(--pdv-text)` que vazava na base do `.retail-shell` no mobile e a barra escura artificial `.retail-mlogin-homebar` no login mobile (`RetailMobileLogin`), aplicando `var(--pdv-background)` de ponta a ponta.
  - Adicionado respiro superior dedicado (`padding-top: max(14px, env(safe-area-inset-top, 0px))`) no `.retail-shell`, no `.retail-mlogin-phone`, nas gavetas e no `<Toaster>`, além de respiro inferior amplo (`calc(118px + env(safe-area-inset-bottom, 0px))` e `calc(148px + env(safe-area-inset-bottom, 0px))` no PDV) para que nenhum card ou botão fique cortado na parte inferior.
- **Menu Inferior em Balão Glassmorphism Transparente com Ocultação ao Rolar (`frontend/src/retail/RetailLayout.tsx` e `frontend/src/retail/retail.css`)**:
  - `.retail-mobile-tabbar` redesenhado como uma cápsula flutuante (`border-radius: 999px`, `max-width: 420px`) com efeito *glassmorphism* translúcido (`backdrop-filter: blur(22px) saturate(190%)`), brilho especular superior e itens em formato de pílula usando exclusivamente os tokens aprovados da paleta roxa, branca e neutra.
  - Detecção inteligente de direção de rolagem (`handleCanvasScrollCapture` e gestos de toque em `RetailLayout.tsx`): ao rolar para baixo o balão desliza suavemente para fora da tela (`.is-hidden`), liberando 100% da área de leitura; ao rolar para cima, tocar perto do topo ou trocar de rota, o balão reaparece imediatamente.
  - Barra flutuante da sacola no PDV (`.retail-mobile-bag-bar`) convertida para cápsula *glassmorphism* que permanece oculta quando a sacola está vazia (`.is-empty`) e acompanha dinamicamente a posição do balão inferior quando há itens (`.has-items`).

## 2026-11-01 — Estúdio de Categorias em 2 Colunas, Ativação/Desativação no PDV e Catálogo Completo de 28 Categorias com 10+ Grupos

- **Ativação / Desativação de Categorias (`active: boolean`) e Ações em Lote (`backend/prisma/schema.prisma`, `backend/src/prisma/tenant-prisma.service.ts`, `backend/src/categories/categories.service.ts` e `backend/src/categories/categories.controller.ts`)**:
  - Adicionado o campo `active Boolean @default(true)` ao modelo `Category` (com auto-DDL idempotente em `ensureTenantRuntimeSchema`), além do retorno de `_count: { retailGroups, products }` em `GET /api/categories`.
  - Novos endpoints `POST /api/categories/bulk-status` (para ativar ou pausar múltiplas categorias em 1 clique) e `POST /api/categories/populate-showcase` (para criar as 28 categorias oficiais e completar cada uma com no mínimo 10 grupos de mercadorias com variações de tamanho/cor, lotes de estoque e histórico de movimentação), com invalidação imediata do cache de produtos da loja.
- **Estúdio de Categorias Expandido em 2 Colunas (`/estoque/categorias` em `frontend/src/app/dashboard/inventory/categories/page.tsx` e `frontend/src/components/CategoryIcons.tsx`)**:
  - Tela de gestão `/estoque/categorias` reformulada com cards de indicadores KPI (*Total Cadastradas*, *Ativas no PDV*, *Inativas / Ocultas* e *Mercadorias Vinculadas*), barra de sugestões rápidas das categorias restantes, busca textual, filtros por status/grupo e chave deslizante (*switch*) de 1 clique por linha (`Ativa no PDV` / `Inativa`) com feedback textual e visual na paleta roxa, branca e neutra aprovada.
  - Modal de criação/edição expandido em formato de **Estúdio em 2 Colunas (`max-w-5xl`)** com barra superior de preenchimento em 1 clique para os 28 modelos oficiais, seletor de disponibilidade no PDV (*Ativa* vs *Inativa / Oculta*), opção de criação em sequência (*Salvar e Criar Próxima*), busca de ícones por palavra-chave e simulação dupla em tempo real (Card de Mercadoria + Pílula de Filtro do PDV).
- **Filtro Dinâmico no PDV (`frontend/src/retail/RetailPosPage.tsx`) e Catálogo Mostruário Completo (`backend/src/categories/showcase-catalog.data.ts`)**:
  - O Ponto de Venda (`/`) oculta automaticamente da barra de filtros e da grade de vendas as categorias marcadas como inativas (`active === false`).
  - Alimentado o catálogo com todas as **28 categorias** (18 categorias da loja + 10 categorias de ícones bônus) e no mínimo **10 grupos de mercadorias por categoria** (280+ grupos no total, todos com grade de tamanho/cor, preço, custo e estoque).

## 2026-11-01 — Transição Roxa em Tela Cheia por Módulo e Navegação por Setas (Módulos e Abas)

- **Transição Tela Cheia (`mode="transition"`, `once`) Exclusiva na Troca de Módulo (`frontend/src/retail/RetailLayout.tsx`, `frontend/src/App.tsx`, `frontend/src/components/PdvLojistaLoader.tsx` e `frontend/src/lib/routes.ts`)**:
  - Toda troca entre módulos distintos (via barra lateral `aside.retail-rail`, gaveta mobile, atalhos do cabeçalho ou teclas `↑`/`↓`) dispara 1 ciclo completo da transição que cobre a tela em roxo (`triggerSessionEntryTransition` com rótulo contextual do módulo).
  - Trocas entre abas de um mesmo módulo (`.retail-subnav-bar`, sub-abas internas de Empresa/Contas a Pagar/XML e pílulas de categoria do PDV) preservam a transição rápida de aba (`tab-forward` / `tab-backward`), sem disparar a sobreposição de tela cheia.
- **Comandos de Teclado com Setas para Módulos e Abas (`frontend/src/retail/RetailLayout.tsx`, `frontend/src/retail/RetailPosPage.tsx`, `frontend/src/pages/GroupPortalPage.tsx` e `frontend/src/lib/routes.ts`)**:
  - `ArrowUp` (`↑`) e `ArrowDown` (`↓`): alternam ciclicamente entre os módulos ativos do menu lateral (disparando o ciclo da transição roxa).
  - `ArrowLeft` (`←`) e `ArrowRight` (`→`): alternam ciclicamente entre as abas horizontais do módulo atual (`.retail-subnav-bar` nas telas de gestão e filtros de categoria no Ponto de Venda `/`), mantendo a animação normal de aba (`Shift + ←/→` alterna sub-abas internas em páginas que possuem segundo nível de abas).
  - Proteção automática (`shouldIgnoreArrowNavigation`) para não interferir na digitação dentro de campos com texto, `<textarea>`, `<select>`, seletores abertos ou modais ativos, além de `Escape` para desfocar rapidamente um campo de busca.

## 2026-11-01 — Módulo Independente de Vitrine Digital & TV (`/vitrine` e `/tv/:tvPublicId`)

- **Backend Multi-Tenant e Catálogo de Grades (`backend/src/vitrine/vitrine.module.ts`, `vitrine.service.ts`, `vitrine.controller.ts` e `vitrine.service.spec.ts`)**:
  - Adaptado do módulo legado de TV para PostgreSQL multi-tenant (`HeartPrismaService` + `TenantPrismaService`), respeitando a flag `modulos.vitrineDigital` (habilitável por loja no `/sys-init`) e gerando automaticamente o código curto `tvPublicId` (8 caracteres) no registro do tenant quando ausente.
  - Novo endpoint `GET /api/vitrine/catalog` que consolida grupos de mercadorias (`RetailGroup`) e produtos avulsos (`Product`) ativos, agregando automaticamente os tamanhos (`sizesAvailable`) e cores (`colorsAvailable`) que possuem estoque disponível (`stock > 0`), além de resolver imagens em banco (`ProductImage`), URLs locais e SVGs da Loja Demonstração.
  - Endpoints administrativos autenticados (`GET /api/vitrine/config`, `PUT /api/vitrine/draft`, `POST /api/vitrine/publish`, `PATCH /api/vitrine/active`, `POST /api/vitrine/upload-logo`, `POST /api/vitrine/upload-bg`) e endpoint público de alta eficiência para Smart TVs (`GET /api/vitrine/public/:tvPublicId`) com suporte a `If-None-Match` / `ETag` (`304 Not Modified`) e enriquecimento em tempo real das grades de tamanhos/cores disponíveis.
- **Reprodutor Público 16:9 para Smart TV e Monitores (`frontend/src/retail/RetailVitrineTvPage.tsx`)**:
  - Rotas públicas `/tv/:tvPublicId` e `/vitrine/:tvPublicId` acessíveis sem login em qualquer Smart TV, TV Box ou segundo monitor conectado ao caixa.
  - 6 temas visuais construídos exclusivamente com os 8 tokens oficiais da paleta roxa, branca e neutra (`Noite Imperial`, `Editorial Roxo`, `Vitrine Clara`, `Palco Urbano`, `Vidro Fumê` e `Grafite Puro`), exibindo preço promocional, percentual de desconto, pílulas de tamanhos/cores disponíveis na loja, carrossel de próximos destaques e grades de coleção de 2 a 6 peças.
- **Estúdio Administrativo com Simulador 16:9 ao Vivo (`frontend/src/retail/RetailVitrinePage.tsx`, `RetailLayout.tsx`, `App.tsx` e `routes.ts`)**:
  - Integrado ao menu lateral e mobile (`Vitrine e TV`) com duas sub-abas semânticas: `/vitrine` (*Programação e slides*) e `/vitrine/aparencia` (*Aparência e link da TV*).
  - Adição rápida de grupos/produtos, construtor de **Grade de Coleção (2 a 6 peças)** com preenchimento automático por categoria em 1 clique, edição inline de preço promocional e selos de campanha, simulador Mini-TV 16:9 em tempo real e publicação instantânea.
- **Loja Demonstração Pré-Configurada (`backend/src/tenants/demo-store.seed.ts`, `tenants.service.ts` e `scripts/demo-local.cjs`)**:
  - A Loja Demonstração (`tvPublicId: 'DEMOLOJA'`) já inicia com programação publicada no ar contendo slides individuais com grades de tamanhos/cores e grade de coleção de 4 peças.

## 2026-11-01 — Correção de Concorrência, Auto-DDL de Schema e Cards KPI no Módulo de Crediário (`/crediario`)

- **Auto-DDL Idempotente em Bloco PL/pgSQL (`backend/src/prisma/tenant-prisma.service.ts`)**:
  - Substituída a execução múltipla de `ALTER TABLE` separada por `;` (que falhava silenciosamente no protocolo *extended query* do PostgreSQL) por um bloco único `DO $crediario_schema$ BEGIN ... END $crediario_schema$;` em `ensureTenantRuntimeSchema`, garantindo de forma idempotente as colunas de `customers`/`categories` e as 5 tabelas do módulo (`customer_receivables`, `customer_receivable_payments`, `crediario_settings`, `whatsapp_auth_states` e `crediario_notification_logs`), índices, chaves estrangeiras e o registro padrão `'singleton'` (`ON CONFLICT DO NOTHING`).
- **Eliminação de Race Condition (`P2002`) e Recuperação Automática (`backend/src/crediario/crediario.service.ts`, `crediario-cron.service.ts`, `whatsapp-baileys.service.ts` e `crediario.controller.ts`)**:
  - Corrigida a condição de corrida em `getOrCreateSettings()` quando `/crediario/overview` e `/crediario/customers` eram chamados em paralelo no primeiro acesso (que disparava `P2002 Unique constraint failed on the fields: (id)` no `upsert` concorrente de `'singleton'`, gerando `500 Internal server error` em uma das chamadas).
  - Adicionado `runWithSchemaRecovery` nos métodos do `CrediarioService` para auto-reparo transparente caso um banco de tenant ainda não tenha recebido todas as tabelas.
- **Estilização dos Indicadores KPI e Busca sem Perda de Foco (`frontend/src/retail/retail.css` e `frontend/src/retail/RetailCrediarioPage.tsx`)**:
  - Adicionadas as classes `.retail-kpis` e `.retail-kpi` em `retail.css` seguindo a paleta roxa, branca e neutra aprovada.
  - Desacoplados os `useEffect` de busca de clientes e parcelas do carregamento inicial em `RetailCrediarioPage.tsx`, evitando desmontar o campo de busca a cada tecla digitada.

## 2026-11-01 — Biblioteca Completa de Ícones de Categorias + Ícones Bônus + Seletor com Preview ao Vivo

- **Biblioteca Vetorial de 28 Ícones (`frontend/src/components/CategoryIcons.tsx`)**:
  - Criados os ícones vetoriais das categorias restantes do varejo (**18 categorias da loja**: `Camisetas & Polos`, `Camisas & Blusas`, `Calças & Jeans`, `Bermudas & Shorts`, `Jaquetas & Moletons`, `Vestidos & Macacões`, `Saias & Conjuntos`, `Calçados & Tênis`, `Bonés & Chapelaria`, `Relógios & Smartwatches`, `Óculos & Armações`, `Carteiras & Cintos`, `Bolsas & Mochilas`, `Joias & Semijoias`, `Perfumaria & Beleza`, `Moda Íntima & Meias`, `Moda Praia & Fitness` e `Moda Infantil & Bebê`) e **10 ícones bônus** (`Cabide`, `Sacola Boutique`, `Estrela / Destaques`, `Diamante / Premium`, `Etiqueta / Promoções`, `Presente / Kits`, `Raio / Lançamentos`, `Coração / Favoritos`, `Coroa / VIP` e `Inverno & Tricô`), exclusivamente com os tokens aprovados da paleta roxa, branca e neutra.
- **Seletor Interativo com Preview em Tempo Real (`CategoryIconPicker`)**:
  - Integrado na criação/edição de categoria em `/estoque/categorias` (`frontend/src/app/dashboard/inventory/categories/page.tsx`) e na criação rápida de categoria dentro do modal de Grupo de Mercadorias (`frontend/src/retail/RetailGroupEditor.tsx`), exibindo em tempo real como o botão de filtro do PDV e o card de produto sem foto ficam com o ícone escolhido ou no modo automático pelo nome.
- **Exibição no PDV, Catálogo e Persistência (`RetailPosPage.tsx`, `RetailCatalogPage.tsx`, `categories.service.ts` e `demo-local.cjs`)**:
  - Pílulas de filtro de categorias no PDV e listagem do catálogo exibem o ícone da categoria, e produtos sem foto exibem a ilustração correspondente.
  - Suporte ao campo opcional `icon` no modelo `Category` (`schema.prisma`, `tenant-prisma.service.ts`, `categories.service.ts` e `demo-local.cjs`) com fallback resiliente.

## 2026-11-01 — Tela de Login Exclusiva do `/sys-init` (Padrão Teltech Ledger)

- **Seletor Rápido dos Dois Sócios e Senha Única (`frontend/src/components/sys-init/SysInitLogin.tsx` e `frontend/src/app/sys-init/page.tsx`)**:
  - Implementada no passo de autenticação do `/sys-init` a mesma tela de login do **Teltech Ledger** (`ParticlesBackground` + `CRMBackground` em canvas + cartão glassmórfico), adaptada aos tokens aprovados da paleta roxa, branca e neutra.
  - Seleção rápida entre os 2 perfis de sócios (**Tarcísio** `TS` e **Lucas** `LM`) com saudação dinâmica (`E aí!? {nome}`), tagline individual, opção `Lembrar-me neste dispositivo` e campo único de senha compartilhada (`SETUP_PIN` validado via `/tenants/setup/validate-pin`).
  - Exibição do sócio autenticado no cabeçalho do `/sys-init` ao lado do botão `Bloquear Sessão`.

## 2026-11-01 — Arquitetura Semântica de URLs por Módulo e Aba (`/:modulo/:aba`)

- **Mapa Central de Rotas e Redirecionamento Retrocompatível (`frontend/src/lib/routes.ts` e `frontend/src/App.tsx`)**:
  - Criado o dicionário central `ROUTES` e a tabela declarativa `LEGACY_AND_ALIAS_REDIRECTS` (com preservação de query string via `PreserveSearchRedirect`), padronizando todas as URLs em português por módulo e aba:
    - **Início (`/inicio`)**: `/inicio` (Visão geral), `/inicio/historico-de-caixas` (com alias `/inicio/historicodecaixas`), `/inicio/relatorios` e `/inicio/operacoes`.
    - **Estoque (`/estoque`)**: `/estoque` (Mercadorias e grades), `/estoque/contagem`, `/estoque/categorias`, `/estoque/entrada-manual` e `/estoque/entrada-xml` (com sub-abas `/estoque/entrada-xml/pendentes` e `/estoque/entrada-xml/historico`).
    - **Financeiro e Compras (`/financeiro`)**: `/financeiro/contas-a-pagar` (com sub-abas `/financeiro/contas-a-pagar/fixas` e `/financeiro/contas-a-pagar/variaveis`), `/financeiro/pedidos-de-compra` e `/financeiro/fornecedores`.
    - **Equipe (`/equipe`)**: `/equipe`.
    - **Clientes e Pós-Venda (`/clientes`)**: `/clientes` (Clientes e insights) e `/clientes/trocas` (Trocas e créditos).
    - **Crediário (`/crediario`)**: `/crediario`, `/crediario/parcelas` e `/crediario/whatsapp`.
    - **Configurações e Fiscal (`/configuracoes`)**: `/configuracoes/empresa` (com sub-abas `/configuracoes/empresa/dados`, `/configuracoes/empresa/endereco`, `/configuracoes/empresa/nfce` e `/configuracoes/empresa/certificado`), `/configuracoes/pagamentos`, `/configuracoes/tributacao` e `/configuracoes/nfce`.
    - **Portal do Grupo (`/grupo-portal`)**: `/grupo-portal/visao-geral`, `/grupo-portal/previsao`, `/grupo-portal/estoque`, `/grupo-portal/produtos`, `/grupo-portal/produtos/criar` e `/grupo-portal/transferencias`.
  - Mantidos redirecionamentos automáticos (`<Navigate replace />`) para todas as rotas legadas `/dashboard/*` e variações sem hífen.
- **Sincronização de Abas de Layout e Abas Internas (`frontend/src/retail/RetailLayout.tsx`, `EmpresaConfigPage`, `PayablesPage`, `XmlImportPage` e `GroupPortalPage`)**:
  - Atualizados `railGroups`, `subNavTabs`, `retail-mobile-tabbar` e todos os links internos para navegar diretamente para as novas URLs semânticas.

## 2026-11-01 — Módulo de Crediário (Fiado / Contas de Clientes) + Cobrança Automática via WhatsApp (Baileys)

- **Modelagem Multi-Tenant e Regras de Negócio (`backend/prisma/schema.prisma` e `backend/src/crediario/crediario.rules.ts`)**:
  - Estendido o modelo `Customer` com limite de crédito (`creditLimit`), bloqueio de crediário (`creditBlocked`), dia preferencial de vencimento (`preferredDueDay`), opt-in de WhatsApp (`whatsappOptIn`) e observações de crédito (`creditNotes`).
  - Criados os modelos isolados por tenant: `CustomerReceivable` (`customer_receivables`), `CustomerReceivablePayment` (`customer_receivable_payments`), `CrediarioSettings` (`crediario_settings`), `WhatsappAuthState` (`whatsapp_auth_states`) e `CrediarioNotificationLog` (`crediario_notification_logs`).
  - Implementadas regras puras e determinísticas de parcelamento em centavos (com absorção de diferença na última parcela), amortização FIFO entre títulos em aberto/vencidos, interpolação de variáveis nos templates de mensagens e avaliação da régua de cobrança (`BEFORE_DUE`, `ON_DUE_DATE` e `OVERDUE`).
- **Sessão Multi-Tenant do WhatsApp via Baileys (`backend/src/crediario/whatsapp-baileys.service.ts`)**:
  - Gerenciador de sessões isoladas por loja (`Map<tenantId, SessionState>`) usando `@whiskeysockets/baileys` com persistência de credenciais e chaves Signal diretamente no PostgreSQL do tenant (`whatsapp_auth_states`), geração de QR Code em DataURL na paleta aprovada (`#272321` / `#FFFFFF`), reconexão automática e desconexão com limpeza de estado.
- **Serviço de Crediário, Integração no Checkout do PDV e Régua Automática (`backend/src/crediario/crediario.service.ts`, `backend/src/crediario/crediario-cron.service.ts` e `backend/src/sales/sales.service.ts`)**:
  - Integração transacional com `SalesService.checkout` usando lock pessimista (`SELECT ... FOR UPDATE`) no cliente para validar bloqueio, inadimplência acima da tolerância e limite de crédito disponível sob concorrência, gerando automaticamente as parcelas (`1..N`) vinculadas à venda e disparando comprovante imediato no WhatsApp após o commit (`ON_SALE`).
  - Estorno automático de títulos não pagos no cancelamento de venda (`cancelSale`) e bloqueio contra redução abaixo do saldo já amortizado.
  - Baixa parcial, integral ou amortização FIFO na conta do cliente com registro opcional de entrada (`CashMovement` `IN`) no caixa aberto e envio de recibo automático via WhatsApp (`ON_PAYMENT`).
  - Agendador (`@Cron(CronExpression.EVERY_10_MINUTES)`) e disparo manual sob demanda com idempotência diária via `CrediarioNotificationLog`.
- **Feature Flag no `/sys-init`, Checkout do PDV e Painel Administrativo (`frontend/src/app/sys-init/page.tsx`, `frontend/src/retail/RetailCheckoutModal.tsx`, `frontend/src/retail/RetailCrediarioPage.tsx`, `frontend/src/retail/RetailLayout.tsx` e `frontend/src/App.tsx`)**:
  - Adicionada flag `crediario` no `/sys-init` (badge na listagem de tenants e chave seletora na aba `Módulos`).
  - No modal de recebimento do PDV (`RetailCheckoutModal`), exibida a forma **Fiado / Crediário** (quando o módulo está ativo), com consulta instantânea de limite/saldo do cliente, seletor de parcelas (`1x..Nx`) e data do 1º vencimento.
  - Nova página `/dashboard/crediario` (`RetailCrediarioPage`) com 3 sub-abas (`Contas de clientes`, `Parcelas e vencimentos` e `WhatsApp e régua`), pareamento via QR Code em tempo real, configuração de chave PIX e mensagens, baixa/amortização, ajuste de limite, lançamento avulso e extrato completo com disparo de WhatsApp em 1 clique, 100% dentro da paleta roxa, branca e neutra aprovada.

## 2026-11-01 — Replanejamento Completo da Experiência Mobile Pós-Login (iPhone iOS & Android `<= 768px`)

- **Navegação Inferior Fixa (`Bottom Tab Bar`) e Gaveta `Menu` (`frontend/src/retail/RetailLayout.tsx` e `frontend/src/retail/retail.css`)**:
  - Adicionada barra inferior fixa (`.retail-mobile-tabbar`) com suporte a `env(safe-area-inset-bottom)` para o *Home Indicator* do iPhone e barra de gestos do Android, permitindo alternar com uma mão entre **Balcão (`/`)**, **Resumo (`/dashboard`)**, **Estoque (`/dashboard/inventory`)**, **Trocas (`/dashboard/returns`)** e a gaveta **Menu** (`.retail-mobile-drawer`).
  - A gaveta deslizante **Menu** organiza os módulos administrativos (*Financeiro/Contas a pagar*, *Histórico de caixas*, *Equipe*, *Clientes*, *Gestão de NFC-e*, *Empresa*), troca para *Modo Somente Caixa* e *Sair da loja* em formato *Bottom Sheet*.
- **Frente de Caixa Mobile com Sacola Flutuante e Bottom Sheet (`frontend/src/retail/RetailPosPage.tsx` e `frontend/src/retail/retail.css`)**:
  - Reestruturado o PDV em telas `<= 768px` para priorizar busca rápida, filtro horizontal de categorias por toque e catálogo em grade de 2 colunas.
  - Adicionada **Barra Flutuante da Sacola** (`.retail-mobile-bag-bar`) acima da navegação inferior exibindo quantidade de peças, valor total e botão direto **Receber**, além de expandir o painel **Detalhes da Transação** (`.retail-order.is-mobile-open`) como um *Bottom Sheet* deslizante.
  - Desativado o foco automático forçado na barra de busca após clicar em produtos em telas móveis (`<= 768px`), evitando abertura indesejada do teclado virtual do iOS/Android durante a seleção de peças.
- **Modais em Bottom Sheet e Prevenção de Auto-Zoom no iPhone (`frontend/src/retail/RetailDialog.tsx`, `frontend/src/components/OperatorLoginModal.tsx`, `frontend/src/components/OpenShiftModal.tsx`, `frontend/src/components/CashMovementModal.tsx` e `frontend/src/retail/retail.css`)**:
  - Todos os diálogos (`RetailDialog`, seleção de operador por PIN, abertura de turno, sangria/suprimento e checkout) ancoram na base da tela com alça superior (`.retail-sheet-handle`) e bordas arredondadas superiores (`24px`) em viewports `<= 768px`.
  - Aplicado `font-size: 16px` nos campos de formulário no mobile para impedir o zoom automático do iOS Safari ao focar inputs.
- **Tabelas Convertidas em Cartões Mobile Sem Scroll Horizontal (`frontend/src/retail/RetailCatalogPage.tsx`, `frontend/src/retail/RetailGroupEditor.tsx`, `frontend/src/retail/RetailReturnsPage.tsx`, `frontend/src/retail/RetailCustomersPage.tsx` e `frontend/src/retail/retail.css`)**:
  - As tabelas de catálogo de grupos, matriz de variações (tamanho/cor/código/saldo/entrada), carteira de clientes e itens de troca/devolução passam a renderizar como cartões estruturados em 2 colunas com rótulos `data-label` no mobile (`<= 768px`), mantendo 100% da semântica `<table>` e `aria-label`s para acessibilidade e testes automatizados, com zero overflow horizontal (`scrollWidth <= innerWidth`).

## 2026-11-01 — Módulo de Clientes e Inteligência Comercial (`CRM Lojista`) com Raio-X 360º

- **Navegação Integrada Pós-Venda (`frontend/src/retail/RetailLayout.tsx` e `frontend/src/App.tsx`)**:
  - Integrada a rota `/dashboard/customers` (`Clientes e insights`) ao lado de `/dashboard/returns` (`Trocas e créditos`) nas sub-abas de pós-venda e no menu lateral/mobile (`Clientes e trocas`).
- **API de Inteligência Comercial e Perfil 360º (`backend/src/customers/customers.service.ts` e `backend/src/customers/customers.controller.ts`)**:
  - `GET /api/customers/insights`: calcula KPIs executivos da carteira (total de clientes, ativos nos últimos 30 dias, clientes VIP, clientes sumidos há 60+ dias, comparativo de ticket médio identificado vs. avulso e saldo total de créditos em aberto), ranking dos Top 5 Clientes VIP, radar de reativação/créditos parados e listagem filtrável e ordenável com DNA rápido (tamanho e cor favoritos).
  - `GET /api/customers/:id/profile`: retorna o Raio-X 360º do cliente com histórico de compras, itens detalhados, elegibilidade para troca, histórico de trocas, extrato de créditos em loja (`StoreCredit` e `StoreCreditUse`), DNA de tamanhos, cores, grupos/mercadorias, categorias, formas de pagamento preferidas e operadores que realizaram os atendimentos.
  - `POST /api/customers` e `PUT /api/customers/:id`: validação e normalização de nome, telefone (com verificação de unicidade por tenant), CPF/CNPJ, endereço e observações/preferências (`reference`), sem exigir alterações de schema nos bancos dos clientes.
- **Interface Administrativa e Fluxo de Troca em 1 Clique (`frontend/src/retail/RetailCustomersPage.tsx`, `frontend/src/retail/RetailReturnsPage.tsx` e `frontend/src/retail/retail.css`)**:
  - Painéis de KPIs da base, Top Clientes VIP, Radar de Reativação com botão de WhatsApp contextualizado, filtros por pílulas de segmento (`Todos`, `Clientes VIP`, `Ativos (30d)`, `Sumidos (+60d)`, `Com crédito em loja`, `Sem compras`), modal de cadastro/edição completo e modal de Raio-X 360º.
  - Atalho direto **Iniciar troca** no histórico de compras do cliente dentro do Raio-X 360º, redirecionando para `/dashboard/returns?sale=<codigo>` com carregamento automático da venda.

## 2026-11-01 — Captura de Leads na Loja Demonstração, Aba `Leads` no `/sys-init` e Auto-Reset Completo

- **Modal Interativo de 2 Etapas para Acesso à Loja Demonstração (`frontend/src/retail/DemoLeadModal.tsx`, `frontend/src/retail/RetailLoginPage.tsx`, `frontend/src/retail/RetailMobileLogin.tsx` e `frontend/src/retail/retail.css`)**:
  - Ao clicar em **Loja Demonstração** ou **Experimente agora** na tela de login (desktop ou mobile), abre-se o modal harmonizado na paleta roxa, branca e neutra em 2 etapas:
    1. **Etapa 1**: pergunta *"Qual seu nome?"* e avança ao clicar em **Continuar**.
    2. **Etapa 2**: pergunta *"Qual seu WhatsApp?"* com máscara `(DD) 9XXXX-XXXX` (10 ou 11 dígitos) e, ao clicar em **Continuar**, registra o lead, restaura o estado habitual da loja de demonstração e autentica automaticamente no PDV com operador gerente e caixa já abertos.
- **Deduplicação por WhatsApp e Reacesso Livre (`backend/prisma/heart.schema.prisma`, `backend/src/prisma/heart-prisma.service.ts` e `backend/src/tenants/tenants.service.ts`)**:
  - Adicionado índice único `whatsapp` (`leads_whatsapp_key`), contador de acessos (`accessCount`) e data/hora do último acesso (`lastAccessAt`) na tabela `leads` do banco `heart` (provisionada de forma idempotente em `ensureHeartColumnsAndTables()`).
  - Não permite duplicar o cadastro para o mesmo número de WhatsApp: caso o mesmo número refaça o processo no modal, o lead existente é atualizado (`name`, `accessCount + 1`, `lastAccessAt`) e o visitante entra normalmente quantas vezes desejar.
- **Aba `Leads` no Painel Central `/sys-init` (`frontend/src/components/sys-init/LeadsPanel.tsx`, `frontend/src/app/sys-init/page.tsx` e `backend/src/tenants/tenants.controller.ts`)**:
  - Nova aba **Leads** no `/sys-init` com cartões de indicadores (*Leads Únicos*, *Acessos Hoje*, *Retornaram (2+ acessos)* e *Convertidos*), busca instantânea, filtros por estágio comercial (`NOVO`, `EM_DEMO`, `CONTATADO`, `CONVERTIDO`, `DESCARTADO`), edição de anotações comerciais, botão de 1 clique **Chamar no WhatsApp**, exclusão e botão **Resetar Loja Demo**.
  - A Loja Demonstração (`lojista_demonstracao`) permanece isolada da lista principal de Tenants do `/sys-init`, do cálculo de MRR e da sincronização com o Teltech Leadger.
- **Loja Demonstração Completa com Fotos, Caixa, Financeiro e Auto-Reset (`backend/src/tenants/demo-store.seed.ts`, `backend/src/auth/auth.service.ts`, `frontend/src/store/auth.ts`, `frontend/src/App.tsx` e `scripts/demo-local.cjs`)**:
  - Todos os módulos liberados (`estoque`, `nfce`, `dashboardMobile`, `importacaoXml`, `vitrineDigital`, `digitalSignage`).
  - Estado habitual pré-alimentado a cada sessão: 8 grupos de mercadorias com grades de tamanho/cor, estoque nos lotes e **fotos vetoriais de estúdio nos produtos**, fornecedores, pedidos de compra recebidos/pendentes, contas a pagar (`Payable`) pagas e pendentes no módulo financeiro, clientes, histórico de vendas, troca com vale-crédito ativo e caixa aberto (`Caixa #2`) com suprimento e sangria.
  - Sempre que o usuário sai da loja (`logout`), fecha a aba (`pagehide` / `sendBeacon('/api/auth/demo-reset')`) ou outro visitante entra na demonstração (`POST /api/auth/demo-login`), a loja retorna automaticamente ao seu estado habitual.

## 2026-11-01 — Replanejamento Completo da Experiência Mobile Pós-Login (iPhone iOS & Android `<= 768px`)

- **Navegação Inferior Fixa (`Bottom Tab Bar`) e Gaveta `Menu` (`frontend/src/retail/RetailLayout.tsx` e `frontend/src/retail/retail.css`)**:
  - Adicionada barra inferior fixa (`.retail-mobile-tabbar`) com suporte a `env(safe-area-inset-bottom)` para o *Home Indicator* do iPhone e barra de gestos do Android, permitindo alternar com uma mão entre **Balcão (`/`)**, **Resumo (`/dashboard`)**, **Estoque (`/dashboard/inventory`)**, **Trocas (`/dashboard/returns`)** e a gaveta **Menu** (`.retail-mobile-drawer`).
  - A gaveta deslizante **Menu** organiza os módulos administrativos (*Financeiro/Contas a pagar*, *Histórico de caixas*, *Equipe*, *Gestão de NFC-e*, *Empresa*), troca para *Modo Somente Caixa* e *Sair da loja* em formato *Bottom Sheet*.
- **Frente de Caixa Mobile com Sacola Flutuante e Bottom Sheet (`frontend/src/retail/RetailPosPage.tsx` e `frontend/src/retail/retail.css`)**:
  - Reestruturado o PDV em telas `<= 768px` para priorizar busca rápida, filtro horizontal de categorias por toque e catálogo em grade de 2 colunas.
  - Adicionada **Barra Flutuante da Sacola** (`.retail-mobile-bag-bar`) acima da navegação inferior exibindo quantidade de peças, valor total e botão direto **Receber**, além de expandir o painel **Detalhes da Transação** (`.retail-order.is-mobile-open`) como um *Bottom Sheet* deslizante.
  - Desativado o foco automático forçado na barra de busca após clicar em produtos em telas móveis (`<= 768px`), evitando abertura indesejada do teclado virtual do iOS/Android durante a seleção de peças.
- **Modais em Bottom Sheet e Prevenção de Auto-Zoom no iPhone (`frontend/src/retail/RetailDialog.tsx`, `frontend/src/components/OperatorLoginModal.tsx`, `frontend/src/components/OpenShiftModal.tsx`, `frontend/src/components/CashMovementModal.tsx` e `frontend/src/retail/retail.css`)**:
  - Todos os diálogos (`RetailDialog`, seleção de operador por PIN, abertura de turno, sangria/suprimento e checkout) ancoram na base da tela com alça superior (`.retail-sheet-handle`) e bordas arredondadas superiores (`24px`) em viewports `<= 768px`.
  - Aplicado `font-size: 16px` nos campos de formulário no mobile para impedir o zoom automático do iOS Safari ao focar inputs.
- **Tabelas Convertidas em Cartões Mobile Sem Scroll Horizontal (`frontend/src/retail/RetailCatalogPage.tsx`, `frontend/src/retail/RetailGroupEditor.tsx`, `frontend/src/retail/RetailReturnsPage.tsx` e `frontend/src/retail/retail.css`)**:
  - As tabelas de catálogo de grupos, matriz de variações (tamanho/cor/código/saldo/entrada) e itens de troca/devolução passam a renderizar como cartões estruturados em 2 colunas com rótulos `data-label` no mobile (`<= 768px`), mantendo 100% da semântica `<table>` e `aria-label`s para acessibilidade e testes automatizados, com zero overflow horizontal (`scrollWidth <= innerWidth`).

## 2026-11-01 — Fotos de Funcionários, Ícones da Equipe no Topo, Troca Rápida em 1 Clique e Caixa Compartilhado

- **Cadastro e Sincronização de Foto de Funcionários (`backend/prisma/heart.schema.prisma`, `backend/src/prisma/heart-prisma.service.ts`, `backend/src/users/users.service.ts`, `backend/src/operators/operators.service.ts`, `frontend/src/components/UserModal.tsx`, `frontend/src/components/OperatorsManagementModal.tsx` e `frontend/src/app/dashboard/users/page.tsx`)**:
  - Adicionado suporte a foto (`imageUrl`) no cadastro e na edição de funcionários/colaboradores tanto em `Gestão de Equipe` (`/dashboard/equipe` -> `UserModal`) quanto em `Operadores do PDV` (`OperatorsManagementModal`).
  - Persistência da foto em `users.imageUrl` e `operator_profiles` no banco `heart` (auto-provisionado por `HeartPrismaService.ensureHeartColumnsAndTables()`), com sincronização bidirecional entre contas de usuário e operadores do caixa sem exigir migração prévia nos bancos de clientes.
  - Removida a trava antiga de máximo de 2 usuários por loja para permitir equipes com 5 ou mais funcionários.
- **Ícones da Equipe no Topo do PDV e Troca Rápida em 1 Clique (`frontend/src/retail/RetailLayout.tsx`, `frontend/src/retail/retail.css`, `frontend/src/contexts/ShiftContext.tsx`, `frontend/src/store/cart.ts` e `backend/src/auth/auth.service.ts`)**:
  - Os ícones circulares no canto superior direito (`RetailTeamAvatars`) passam a renderizar dinamicamente 1 ícone para cada funcionário ativo do tenant (ex.: 5 funcionários = 5 ícones no topo).
  - Quando o funcionário possui foto cadastrada, sua foto real é exibida no ícone circular (e no avatar do operador ativo ao lado do nome); quando não possui foto, o ícone vetorial estilizado padrão é exibido automaticamente.
  - Ao clicar na foto/ícone de qualquer funcionário no topo, o PDV executa a troca instantânea (`POST /api/auth/operator-switch` -> `quickSwitchOperator`) para o perfil daquele funcionário, destacando o funcionário ativo com anel roxo e indicador e preservando integralmente os itens já adicionados ao carrinho caso a troca ocorra no meio de uma venda.
- **Caixa Compartilhado entre Funcionários do Turno (`backend/src/cash-registers/cash-registers.service.ts`, `backend/src/sales/sales.service.ts` e `frontend/src/components/CloseRegisterModal.tsx`)**:
  - A abertura de caixa (`openRegister` / `getCurrentRegister`) passa a operar em regime de gaveta compartilhada da loja: quando o primeiro funcionário abre o caixa e informa o fundo de troco inicial, todos os demais funcionários utilizam automaticamente esse mesmo caixa aberto ao alternar de perfil no topo, sem precisar abrir outro caixa nem duplicar valores de abertura.
  - Cada venda realizada registra individualmente o `operatorId` do funcionário ativo no momento da conclusão (`Sale.operatorId`), e o modal de conferência/fechamento (`CloseRegisterModal`) passa a exibir o resumo `Vendas por Funcionário neste Turno` (`salesByOperator`) além da identificação do vendedor em cada operação individual.

## 2026-11-01 — Fundo Translúcido com Blur Suave nos Modais do PDV e Escolha de Tamanho/Cor

- **Sobreposição Translúcida com Blur Leve (`frontend/src/retail/retail.css`, `frontend/src/components/OperatorLoginModal.tsx`, `frontend/src/components/OpenShiftModal.tsx`, `frontend/src/components/CashMovementModal.tsx` e `frontend/src/components/CloseRegisterModal.tsx`)**:
  - `.retail-modal-overlay` passou de fundo 100% opaco (`var(--pdv-text)`) para véu translúcido suave (`color-mix(in srgb, var(--pdv-text) 28%, transparent)`) combinado com `backdrop-filter: blur(6px)`, mantendo o Ponto de Venda visível e levemente desfocado atrás do modal de escolha de tamanhos/cores (`RetailDialog`) e dos demais diálogos do sistema.
  - Adicionada sombra de elevação suave e borda sutil em `.retail-dialog` para destacar o cartão sobre o fundo desfocado.

## 2026-11-01 — Foto do Tenant no Menu Lateral e Upload na Criação pelo `/sys-init`

- **Menu Lateral (`frontend/src/retail/RetailLayout.tsx` e `frontend/src/retail/retail.css`)**:
  - O botão circular superior do menu lateral (`.retail-rail-logo`) passa a exibir a foto/logo escolhida para o tenant (`logoUrl`), mantendo recorte circular (`border-radius: 999px`, `object-fit: cover`) e retornando ao símbolo vetorial padrão caso nenhuma imagem tenha sido definida ou haja falha de carregamento.
  - Sincronização imediata de `logoUrl` no estado de autenticação (`frontend/src/store/auth.ts`) a partir do login, do acesso 1-clique (`impersonate`) e de `GET /api/tenants/me`.
- **Criação e Edição de Tenant no `/sys-init` (`frontend/src/app/sys-init/page.tsx`)**:
  - Adicionado seletor de foto/logo da loja já na tela de criação do tenant (`Provisionar Nova Loja`), com pré-visualização circular idêntica ao menu lateral e envio automático para `/api/tenants/setup/:id/logo` logo após o provisionamento.
  - Atualizada a aba `Identidade` na edição de tenants com pré-visualização circular e sincronização imediata da foto na sessão ativa.

## 2026-11-01 — Sistema de Coreografia, Transições Direcionais de Abas e Animações por Módulo

- **Orquestrador de Transições por Módulo e Direção de Aba (`frontend/src/retail/RetailLayout.tsx` e `frontend/src/retail/retail.css`)**:
  - **Barra de Progresso de Rota (`.retail-route-progress`)**: varredura luminosa roxa no topo do quadro principal a cada troca de módulo ou sub-aba (`retailRouteProgressSweep`).
  - **Detecção Direcional de Abas (`tab-forward` / `tab-backward`)**: ao alternar entre sub-abas horizontais de um mesmo módulo (`Mercadorias e grades` ↔ `Contagem de estoque` ↔ `Categorias` ↔ `Entrada manual` ↔ `Entrada por XML`, `Visão geral` ↔ `Histórico de caixas` ↔ `Relatórios de vendas` ↔ `Operações locais`, `Contas a pagar` ↔ `Pedidos de compra` ↔ `Fornecedores`, `Empresa` ↔ `Pagamentos` ↔ `Tributação` ↔ `Gestão de NFC-e`), o palco desliza na direção natural do movimento com curva elástica (`cubic-bezier(0.22, 1, 0.36, 1)`).
  - **Animações Específicas por Módulo (`data-module-kind`)**:
    - `pos` (*Ponto de Venda*): entrada *Split-Stage* onde o catálogo desliza pela esquerda (`posCatalogGlideIn`), o painel `Detalhes da Transação` desliza pela direita (`posOrderGlideIn`) e o cabeçalho desce suavemente.
    - `overview` (*Visão Geral e Relatórios*): elevação escalonada dos cartões de indicadores (`moduleEnterOverview`) e preenchimento progressivo das barras de ranking (`overviewBarGrow`).
    - `inventory` (*Catálogo e Estoque*): abertura em perspectiva 3D de prateleira (`moduleEnterInventory`).
    - `finance` (*Compras e Financeiro*): revelação diagonal de livro-caixa (`moduleEnterFinance`).
    - `registers` (*Histórico de Caixas e Operações*): cascata cronológica de cima para baixo (`moduleEnterRegisters`).
    - `team` (*Equipe*): entrada com mola elástica (`moduleEnterTeam`).
    - `returns` (*Trocas e Créditos*): deslizamento em fluxo reverso (`moduleEnterReturns`).
    - `settings` (*Fiscal e Configurações*): transição de precisão com zoom suave (`moduleEnterSettings`).
  - **Micro-animações Exclusivas nos Ícones do Menu Lateral (`data-icon-kind`)**: cada ícone da barra ADM possui sua própria animação física ao passar o mouse ou ativar (`railHomePop`, `railPosTilt`, `railBoxPop`, `railCashWave`, `railHistorySweep`, `railTeamSpring`, `railReturnsSpin`, `railShieldPulse`, `railSettingsNod`), acompanhada de indicador vertical ativo na borda esquerda.
- **Coreografia Interativa e Previews de Fotos em Tela Cheia no Ponto de Venda (`frontend/src/retail/RetailPosPage.tsx` e `frontend/src/retail/retail.css`)**:
  - **Previews de Fotos Sem Corte (`object-fit: contain` + Fundo de Estúdio Desfocado)**: substituído o recorte horizontal (`object-fit: cover` em faixa baixa de `146px`) por um palco fotográfico em proporção `4:3` (`205px–250px` de altura) com fundo ambiente suavemente desfocado (`.retail-card-photo-ambient`) e imagem principal completa (`object-fit: contain` em `.retail-card-photo-main`), garantindo visualização integral de fotos verticais, quadradas ou horizontais tanto nos cartões do PDV quanto nas miniaturas do carrinho, na tabela de mercadorias e no cabeçalho de escolha de tamanho/cor (`.retail-choice-hero`).
  - **Contraste Reforçado para Monitores de Alto Brilho**: bordas e contadores com contraste calibrado via `color-mix` dentro dos tokens da marca para nitidez imediata em qualquer tela.
  - **Onda Direcional de Produtos por Categoria (`posCardWaveForward` / `posCardWaveBackward`)**: trocar entre `Todos os Produtos`, `Calçados`, `Roupas`, `Acessórios` anima os cartões em cascata (`--card-idx`) na direção da aba clicada.
  - **Carrinho e Pagamento Vivos**: entrada elástica ao adicionar itens (`posOrderItemEnter`), pulso numérico ao alterar quantidade (`posValuePop`) ou total da venda, e giro vertical estilo *split-flap* ao alternar método de pagamento (`posMethodFlip`).

## 2026-11-01 — Nova Interface Unificada em Tela Única (Visão ADM com Menu Lateral e Visão Caixa Direta)

- **Casca Visual Unificada em Tela Única (`frontend/src/App.tsx` e `frontend/src/retail/RetailLayout.tsx`)**:
  - Unificadas as rotas de Ponto de Venda (`/`) e de Gestão (`/dashboard/*`) dentro do mesmo contêiner principal (`RetailLayout`), eliminando trocas de estrutura entre telas e mantendo toda a operação em uma única superfície contínua.
  - Moldura externa escura (`var(--pdv-text)` `#272321`) envolvendo o painel branco arredondado (`var(--pdv-white)` `#FFFFFF`, `border-radius: 26px`).
  - **Menu Lateral Exclusivo para ADM**: barra vertical compacta de ícones (`aside.retail-rail`) organizada em grupos (`Visão geral`, `Frente de caixa`, `Mercadorias e grades`, `Contas a pagar` · `Histórico de caixas`, `Equipe`, `Trocas e créditos` · `Gestão de NFC-e / Auditoria`, `Empresa` · `Sair`) exibida apenas para perfis administrativos (`admin`/`superadmin`, e `stockist` no escopo de estoque).
  - **Visão Caixa Sem Menu Lateral**: quando autenticado como operador de caixa (`role === "operator"`) ou com o Modo Caixa ativo, o menu lateral é ocultado e o Ponto de Venda ocupa 100% do quadro principal.
  - **Sub-navegação Contextual (`.retail-subnav-bar`)**: pílulas horizontais no topo das rotas de gestão para alternar entre sub-módulos (Mercadorias, Categorias, Entrada por Lote, Importação XML, Contagem, Financeiro, Fornecedores, Pedidos, Fiscal e Configurações) sem sair da tela única.
- **Ponto de Venda Redesenho Completo (`frontend/src/retail/RetailPosPage.tsx`, `frontend/src/retail/RetailCheckoutModal.tsx` e `frontend/src/retail/retail.css`)**:
  - Cabeçalho `Criar Transação` com subtítulo do operador/loja, botões circulares de notificações/sincronização e configurações rápidas, avatares sobrepostos da equipe (`RetailTeamAvatars`), botão pílula `+ Novo Acesso` e seletor de perfil com avatar de iniciais (`RetailOperatorAvatar`).
  - Barra de filtros por categoria em pílulas com contadores (`Todos os Produtos`, categorias dinâmicas) e busca rápida por nome/código (`F3`) alinhada à direita.
  - Grade de produtos em 3 colunas dentro de quadro arredondado com selo escuro de saldo (`XX em Estoque`), foto ou ilustração vetorial de estúdio (`ProductCardIllustration`), descrição em duas linhas, preço em destaque e botão pílula `+ Adicionar ao Carrinho`.
  - Painel lateral direito `Detalhes da Transação` com botão `Limpar Pedido`, cartões brancos de itens com miniatura, botão circular roxo de exclusão, pílulas de tamanho (`Tam. X`) e cor com ponto colorido, seletor circular `-` / `+` de quantidade, bloco de resumo com barra `Promoção / Desconto (0%)` e pílula preenchida `Alterar Desconto`, linhas de `Subtotal`, `Impostos (Est.)`, `Desconto` e `Total do Pagamento`, seletor rápido de forma de pagamento (`Cartão de Crédito` / `Pix Instantâneo` / `Dinheiro` / `Cartão de Débito` com `Trocar Método ›` integrado ao modal de checkout) e botão principal `Continuar` (`F2`).
  - **Conformidade de Identidade**: 100% construído com os tokens oficiais da paleta roxa, branca e neutra (`brand-tokens.css`), validado por `npm run check:brand`.

## 2026-11-01 — Evolução Completa da Arquitetura Multi-Tenant e Painel `/sys-init`

- **Banco Mestre (`backend/prisma/heart.schema.prisma` e `backend/src/prisma/heart-prisma.service.ts`)**:
  - Adicionados modelos `TenantInvoice` (`tenant_invoices`) para controle de faturas mensais por competência (`YYYY-MM`) e `WebhookOutbox` (`webhook_outbox`) para fila durável de sincronização financeira.
  - Expandido o modelo `Tenant` com identificadores permanentes de conciliação (`clientExternalId`, `baseExternalId`, `clientVersion`, `baseVersion`, `leadgerSyncEnabled`).
  - Expandido o modelo `PaymentLog` com vínculo a fatura (`invoiceId`), meio de pagamento (`paymentMethod`), tipo de lançamento (`payment`, `refund`, `manual_adjustment`, `correction`) e controle de estorno (`estornado`, `estornadoEm`).
  - Adicionada rotina idempotente `ensureHeartColumnsAndTables()` na inicialização do `HeartPrismaService` e migração SQL incremental `backend/prisma/heart-migrations/20261101120000_leadger_invoices_outbox/migration.sql` para garantir compatibilidade imediata do banco `heart` tanto em runtime quanto no deploy (`migrate-heart.cjs`).
- **Bloqueio de Inadimplência em Tempo Real e Cache de Conexões (`tenant-context.service.ts` e `auth.service.ts`)**:
  - Bloqueio automático de login e de requisições autenticadas (`403 Forbidden`) quando a loja estiver com status `suspended` ou `inactive`.
  - Invalidação imediata de cache (`evictTenantCache`) ao alterar status ou excluir um tenant pelo `/sys-init`.
- **Acesso 1-Clique / Impersonation (`POST /api/tenants/setup/:id/impersonate` e `SysInitReturnPill` em `App.tsx`)**:
  - Permite entrar diretamente no painel administrativo ou frente de caixa de qualquer loja (ou como qualquer usuário específico da loja) a partir do `/sys-init`, emitindo token JWT válido sem necessidade de digitar credenciais.
  - Botão flutuante discreto `Voltar ao /sys-init` exibido durante a sessão de impersonation para retornar em 1 clique ao painel central.
- **Provisionamento Completo com PIN Inicial `1234` (`tenants.service.ts`)**:
  - Na criação de uma nova loja, o usuário admin e o operador inicial de caixa já são provisionados com PIN `1234` (`TenantSettings.cashierPin` e `discountPin` + `Operator` gerente), deixando o PDV pronto para abrir caixa imediatamente.
- **Raio-X Operacional do Banco PostgreSQL (`GET /api/tenants/setup/:id/stats` e `TenantXrayPanel.tsx`)**:
  - Inspeciona em tempo real o tamanho físico do banco PostgreSQL (`pg_database_size`) e contadores de produtos ativos, grupos/grades, categorias, clientes, fornecedores, operadores, caixas abertos, vendas hoje/total, faturamento hoje/total, NFC-e emitidas e última venda.
- **Gestão Completa de Faturas Mensais e Estornos (`TenantInvoicesManager.tsx`)**:
  - Geração/antecipação de faturas por competência (`YYYY-MM`), edição de valor/vencimento com trilha de auditoria (`correction`), quitação com seleção de meio de pagamento (`pix`, `boleto`, `credit_card`, `bank_transfer`, `cash`) e **estorno de pagamentos** (`refund`) com reversão automática da fatura para `pending` e recuo de 1 mês no vencimento da assinatura.
- **Integração Financeira Teltech Leadger Webhook v1 (`leadger-webhook.service.ts` e `LeadgerIntegrationPanel.tsx`)**:
  - Implementação completa do contrato `Teltech Leadger Webhook v1` com assinatura `HMAC-SHA256`, eventos `base.upsert`, `client.upsert` e `invoice.upsert`, fila `WebhookOutbox` com worker periódico automático (60s) e retentativas manuais (`dispatch_due`, `retry_event`, `rebuild_blocked_event`), sincronização individual/em lote e exportação de conciliação em CSV e JSON.
- **Gestão Completa de Equipe e Reformulação do `/sys-init` (`frontend/src/app/sys-init/page.tsx`)**:
  - Criação de usuários já com PIN de caixa opcional, alteração de cargo (`admin`, `operator`, `stockist`), bloqueio/reativação, exclusão de usuário, troca de senha/PIN e login 1-clique por usuário.
  - Filtros rápidos por chips (`Todos`, `Ativos`, `Atrasados`, `Vence em 5 dias`, `Suspensos/Inativos`, `Sem vencimento`), ações em lote (`Ativar` / `Suspender`), botão `Bloquear Sessão`, atalho direto para WhatsApp e cópia formatada de credenciais pós-provisionamento.
  - Remoção de código legado de iFood e Leads de demonstração do projeto anterior, mantendo 100% de conformidade com a paleta roxa, branca e neutra (`check:brand`).

## 2026-11-01 — Nova Tela de Login Exclusiva para Versão Mobile

- **Experiência Mobile de Login (`frontend/src/retail/RetailMobileLogin.tsx` e `frontend/src/retail/retail.css`)**:
  - Criado fluxo exclusivo para telas móveis (`<= 768px`) preservando integralmente o layout de PC (`> 768px`) em [`RetailLoginPage.tsx`](../frontend/src/retail/RetailLoginPage.tsx).
  - **Carrossel de Apresentação Mobile**: 3 etapas interativas com suporte a toque/swipe, indicadores de paginação e botão circular de avanço (`>`):
    1. *Mosaico Bento do Comércio Local* ("Abra o Balcão e Venda Agora.") com micro-animações contínuas nos balões de atendimento e na chave seletora.
    2. *Controle de Grades e Equipe* ("Controle Grades com Facilidade.") com ilustração vetorial arquitetônica de numeração/cor e giro de estoque.
    3. *Caixa por PIN e Giro Seguro* ("Caixa por PIN e Giro Seguro.") com vitrine lojista e proteção de sessão por atendente.
  - **Tela de Acesso Mobile ("Entrar.")**: cabeçalho com botão de retorno (`<`) e assinatura `PDV lojista`, título editorial `Entrar.`, ilustração hero vetorial com rampa listrada roxa, envelope de credencial e selo de confirmação (`✓`), campos de `E-mail` (com ícone de envelope) e `Senha` (com ícone de cadeado/visibilidade), botão principal `ENTRAR` e atalhos para `Loja Demonstração` e `Caixa por PIN`.
  - **Transição de Submissão e Confirmação ("Acesso Liberado!")**: expansão do botão principal preenchendo a tela em roxo, spinner circular em arco branco que se fecha em anel, revelação circular em íris branca e tela final `Acesso Liberado!` com ilustração de confirmação e botão `ABRIR BALCÃO`.
  - **Conformidade de Identidade**: 100% construído com os tokens oficiais da paleta roxa, branca e neutra (`brand-tokens.css`), validado por `npm run check:brand`.

## 2026-11-01 — Correção de Login e Redirecionamento no `/sys-init`

- **Interceptor de autenticação (`frontend/src/lib/api.ts`)**: incluídas as rotas administrativas `/tenants/setup`, `/groups/setup`, `/sys-init`, `/integrations/setup` e a rota `/sys-init` nas exceções do redirecionamento automático de `401` para `/login`, impedindo que o painel central redirecione para a tela de login da loja.
- **Campo de senha do `/sys-init` (`frontend/src/app/sys-init/page.tsx`)**: substituídas as 10 caixas fragmentadas de 1 caractere (onde colar a senha disparava `onChange` sem `preventDefault()` e truncava o valor) por um campo único de senha com alternância de visibilidade e contraste aprovado na paleta.
- **API de demonstração local (`scripts/demo-local.cjs`)**: adicionadas as rotas `/tenants/setup/*`, `/groups/setup/*` e `/sys-init/backups*` com suporte ao PIN `teltech352` (`SETUP_PIN`).

## 2026-11-01 — Limpeza Definitiva de Arquivos Legados da Adega

- **Remoção de páginas, componentes e assets mortos do frontend (`frontend/src` e `frontend/public`)**:
  - Removidas telas e layouts antigos da Adega sem uso no roteamento do Lojista (`PosPage`, `LoginPage`, `GarcomPage`, `KdsPage`, `StationAccessPage`, `VitrineTvPage`, `DemoRegisterPage`, `ComandasPage`, `InventoryPage` legado, `VitrinePage`, `BulkImagesPage`, `DashboardLayout` legado e páginas órfãs em `app/`).
  - Removidos componentes exclusivos de bar/adega/restaurante/carvoaria (`CapitaoGelada`, `CapitaoCart`, `ComandaWorkspaceModal`, `CompositeModifierModal`, `KdsReadyOrders`, `ServiceRounds`, `AssetPicker`, `StationAccessLinks`, `ProductPreparationFields`, `OperationalRoute`, `PaymentModal` legado, `DemoBanner`, `AddProductModal`, `EditProductModal`) e stores/hooks/libs associadas (`demoGuide`, `demoMissions`, `useComandasBackup`, `useKdsEnabled`, `comanda-cart`, `comandas-offline`, `kds`, `operatorAccess`, `bulk-images`).
  - Removidas imagens/logos antigas (`7bar-logo.png`, `teltech-logo.png`, `instagram-icon.png`) de `frontend/public`.
  - Removidas referências residuais a `StationAccessLinks`, `useDemoMissionsStore` e `Modo Garçom` nos componentes administrativos ativos.
- **Remoção de módulos, seeds e scripts legados da Adega no backend (`backend/`)**:
  - Removidos diretórios `src/comandas/`, `src/demo/` e `src/vitrine/` e desacopladas importações residuais em `app.module.ts` e `sales.service.ts`.
  - Removidos seeds e scripts de bebidas/narguilaria/adega (`src/prisma/seed-tenant.ts`, `prisma/seed-fiscal.*`, `prisma/migrate-legacy.js`, `scripts/etl/`, `scripts/narguilaria-local.mjs`, `scripts/event-*`).

## 2026-11-01 — Conversão para PostgreSQL e Publicação em Produção no Railway

- **Banco de Dados e Prisma convertidos para PostgreSQL**:
  - `backend/prisma/schema.prisma` (Tenant) e `backend/prisma/heart.schema.prisma` (Heart) atualizados para `provider = "postgresql"`, substituindo tipos específicos do MySQL (`@db.LongBlob` → `Bytes`, `@db.LongText` → `@db.Text`).
  - Criado histórico de migrações PostgreSQL em `backend/prisma/migrations/20261101000000_init_postgresql/` e `backend/prisma/heart-migrations/20261101000000_init_postgresql/`.
- **Consultas SQL, Bloqueios Transacionais e Concorrência**:
  - Substituído `ON DUPLICATE KEY UPDATE` por `ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id` em vendas, catálogo lojista e trocas/devoluções.
  - Convertido bloqueio de contas recorrentes (`"recurrenceId"`) e geração de `shortCode` (`CAST("shortCode" AS BIGINT)`, regex `~ '^[0-9]+$'`) para PostgreSQL.
  - Adicionado `mode: 'insensitive'` aos filtros `contains` do Prisma no catálogo lojista, produtos, vendas e tributação.
  - Convertido `upgradeTenantSchema` (`backend/src/tenants/tenant-schema-upgrade.ts`) e manutenção de imagens (`product-image-store.ts`, `image-maintenance.service.ts`) de `mysql2` + `GET_LOCK` para `pg` + `pg_try_advisory_lock(hashtext(...))`.
  - Convertido provisionamento e exclusão de bancos por loja (`CREATE DATABASE ... ENCODING 'UTF8'`, desconexão de pool + `pg_terminate_backend` antes de `DROP DATABASE`) em `tenants.service.ts`.
  - Convertido módulo de backups (`backups.service.ts`) de `mysqldump`/`mysql` para `pg_dump`/`psql`, removendo comandos `ALTER USER 'root'@'%'`.
- **Segurança e Produção**:
  - Removido PIN SQL fixo de código no backend (`tenants.controller.ts`) e no frontend (`sys-init/page.tsx`), exigindo `SQL_PIN`/`SETUP_PIN` via variáveis de ambiente e protegendo `POST /api/tenants/trigger-sync`.
  - Adicionado endpoint de prontidão `GET /api/health` com verificação ativa de conexão ao PostgreSQL (`SELECT 1`) e `enableShutdownHooks()` no NestJS.
  - Configurada entrega unificada em mesma origem (API `/api/*` + SPA estática `frontend/dist` com fallback de rotas) e container multi-stage de produção (`sistema/Dockerfile`, `railway.json`).
  - Criados scripts operacionais `backend/scripts/migrate-heart.cjs` e `backend/scripts/bootstrap-initial-store.cjs` e documentação completa em `docs/DEPLOY-RAILWAY-POSTGRESQL.md`.

## 2026-11-01 — Base lojista a partir do PDV Adega

- Criada cópia separada em `sistema/`, sem alterar o projeto original ou importar dados/credenciais.
- Mantida arquitetura NestJS/React/Vite com banco por tenant.
- Adicionados grupos de mercadorias e grade por tamanho/cor, com preço/foto compartilhados e estoque por variação.
- Adicionados caixa lojista, leitura de código, trocas, crédito por cliente e resumo comercial com valores de trocas.
- Preservados lotes, caixa, persistência durável, fornecedores, compras, financeiro e base fiscal para homologação.
- Retirados do fluxo os módulos de cozinha, bar, carvoaria, garçom, comandas e mesas. Mantida compatibilidade de tabelas antigas, sem remoção destrutiva de esquema.
- Retirados catálogo e perfis fiscais padrão de bebidas do provisionamento.
- Aplicada identidade roxa e branca, incluindo logo/favicon/PWA e guarda automática da paleta.
- Isolados sessão, rascunho, catálogo e cache offline do produto anterior, inclusive por tenant.
- Corrigida a recuperação após F5 para não reconstruir carrinho de uma operação já confirmada.
- Reforçadas permissões de manutenção de tenants e conferência do crédito na transação da venda.
