# Histórico — PDV Lojista

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
