# Exibição Universal de Fotos de Operadores e Mercadorias em Estoque — 15/11/2026

Auditoria completa de ponta a ponta (Backend + Frontend) no **PDV Lojista** para garantir que, em **todos os pontos do sistema**:
1. Sempre que aparecer o **nome de um operador, vendedor, colaborador ou gestor** que realizou uma ação ou está vinculado a um registro, apareça também a **foto cadastrada dele** (com fallback elegante de iniciais/ícone na paleta aprovada quando não houver foto).
2. Sempre que aparecer um **item de estoque, produto, variação (tamanho/cor), grupo de grade, item de venda, troca, pedido de compra, nota XML, balanço ou catálogo**, apareça também a **foto cadastrada dele** (respeitando o compartilhamento de foto do grupo via fallback `product.imageUrl || retailGroup.imageUrl`).

---

## 1. Arquitetura de Resolução no Backend (Zero Migração de Banco)

Nenhuma alteração destrutiva de schema (`prisma migrate` / `prisma db push`) foi executada. Toda a hidratação ocorre em memória de forma segura, preservando o isolamento multi-tenant (`Heart` vs banco de cada loja) e o histórico imutável de itens e preços das vendas.

### `EntityPhotoResolverService` (`backend/src/prisma/entity-photo-resolver.service.ts`)
Serviço global exportado pelo `PrismaModule` responsável por:
- **Resolução cruzada de fotos de operadores e usuários (`buildTenantActorPhotoLookup`)**: cruza registros de `Operator` (banco da loja) com `User` (banco Heart do `tenantId`) por ID exato, `email` normalizado e `name` normalizado sem acentos. Assim, se a foto tiver sido enviada no cadastro de Equipe (`User.imageUrl`) ou no perfil do Operador (`Operator.imageUrl`), ambos os lados recebem `imageUrl` automaticamente.
- **Sanitização de segredos**: remove campos sensíveis (`pin`, `password`) ao serializar operadores/usuários hidratados.
- **Coalescência de fotos de mercadorias (`coalesceProductImage` / `enrichProductRecord`)**: resolve `product.imageUrl || product.retailGroup?.imageUrl || null` em produtos, variações de cor/tamanho e itens históricos (`SaleItem`, `SaleReturnItem`, `PurchaseOrderItem`, `StorefrontOrderItem`, `FiscalImportItem`).

### Módulos de Backend Atualizados (28 arquivos)
- **Infraestrutura e Autenticação**:
  - `backend/src/prisma/entity-photo-resolver.service.ts` e `backend/src/prisma/prisma.module.ts`
  - `backend/src/auth/auth.service.ts` (retorna `imageUrl` no login JWT, login de operador, PIN de gerente e listagem de equipe com cruzamento `User` ↔ `Operator`)
  - `backend/src/operators/operators.service.ts` (hidrata `imageUrl` cruzada na listagem e atualização de operadores)
  - `backend/src/tenants/tenants.service.ts`, `tenants.controller.ts` e `tenants.controller.spec.ts` (retorna `imageUrl` nos usuários de cada loja e admin principal no Sys-Init)
- **Caixa, Vendas, Clientes, Crediário e Relatórios**:
  - `backend/src/cash-registers/cash-registers.service.ts` (`operator.imageUrl` em turnos abertos/fechados, sangrias/suprimentos, estatísticas por vendedor no fechamento cego e itens vendidos com `imageUrl`)
  - `backend/src/sales/sales.service.ts` (`operatorName`, `operatorImageUrl` e `items[].imageUrl` com fallback `retailGroup.imageUrl` nas listagens e recibos)
  - `backend/src/dashboard/dashboard.service.ts` (`operatorImageUrl` e `imageUrl` dos itens nas vendas recentes, ranking de produtos e visão executiva)
  - `backend/src/customers/customers.service.ts` (`operatorImageUrl` e fotos dos itens no histórico 360° de compras e trocas do cliente)
  - `backend/src/crediario/crediario.service.ts` (`operatorImageUrl` nos títulos e baixas/recebimentos de parcelas + `imageUrl` nos itens da compra financiada)
- **Varejo, Catálogo, Trocas, Inteligência, Vitrine e Loja Virtual**:
  - `backend/src/retail/retail-catalog.service.ts`, `retail-overview.service.ts`, `retail-returns.service.ts`, `retail-intelligence.service.ts` (fotos de operadores em trocas/devoluções, insights, calendário diário, auditoria de vendas do vendedor e fotos de mercadorias/grupos)
  - `backend/src/products/products.service.ts`, `backend/src/master-products/master-products.service.ts`, `backend/src/categories/categories.service.spec.ts` (`retailGroup.imageUrl` coalescido em todas as consultas de estoque, alertas de validade/ruptura e balanço)
  - `backend/src/vitrine/vitrine.service.ts` (`publishedByImageUrl` do responsável pela publicação e fotos dos produtos em destaque)
  - `backend/src/storefront/storefront-admin.service.ts`, `storefront-orders.service.ts`, `storefront-public.service.ts` (`publishedByImageUrl`, `confirmedByImageUrl`, `cancelledByImageUrl`, `sale.operatorImageUrl` e fotos das peças nos pedidos online)
- **Compras, Fornecedores, Fiscal e Rede Multi-Loja**:
  - `backend/src/purchase-orders/purchase-orders.service.ts` (`product.imageUrl` / `retailGroup.imageUrl` nos itens de pedidos de compra e sugestões de reposição)
  - `backend/src/suppliers/suppliers.service.ts` (fotos dos produtos vinculados ao catálogo de cada fornecedor)
  - `backend/src/fiscal/import/fiscal-import.service.ts` e `backend/src/fiscal/audit/fiscal-audit.controller.ts` (fotos dos produtos vinculados na importação de NF-e XML e itens das notas emitidas na gestão fiscal)
  - `backend/src/groups/groups.service.ts` (`operatorImageUrl` e `itemsPreview[].imageUrl` nas vendas recentes das filiais, `imageUrl` nos estoques consolidados, previsão de compra, catálogo da rede, sincronização de produtos e `getGroupUsers`)

---

## 2. Primitivas Visuais e Cobertura no Frontend

### `EntityPhotos.tsx` (`frontend/src/components/EntityPhotos.tsx`)
Componentes padronizados construídos exclusivamente com os tokens semânticos da identidade aprovada (`bg-page`, `bg-surface`, `bg-support`, `bg-brand`, `text-ink`, `text-muted`, `text-brand`, `text-on-brand`, `border-line`, `border-brand`):
- **`useResolvedOperatorPhoto`**: hook com cache em memória de 60s por loja (`/operators` + sessão `useAuthStore` + turno `useShift` + `usePinAuthStore`) que resolve automaticamente a foto do operador por `operatorId` ou nome normalizado mesmo em registros offline ou históricos.
- **`<OperatorAvatarThumb>`**: avatar circular com `getFullUrl`, tratamento automático de erro (`onError`) e fallback para iniciais ou ícone na paleta roxa/neutra.
- **`<OperatorInlineBadge>`**: selo compacto combinando `<OperatorAvatarThumb>` + rótulo opcional + nome do operador/responsável.
- **`<StockItemThumb>`** & **`resolveStockItemImageUrl`**: miniatura padronizada de item em estoque com resolução em cascata (`imageUrl` direto → `product.imageUrl` → `product.retailGroup.imageUrl` → `saleItem.product.imageUrl`) e fallback com ícone `Package`.

### Estados Globais e Persistência Offline
- `frontend/src/store/auth.ts` + `frontend/src/components/UserModal.tsx`: sincronização imediata de `user.imageUrl` (`setUserImage`) ao atualizar foto na gestão de equipe.
- `frontend/src/contexts/ShiftContext.tsx` e `frontend/src/store/pinAuth.ts`: preservação de `imageUrl` no operador do caixa e autorizações por PIN.
- `frontend/src/lib/db.ts`: enriquecimento do snapshot offline (`IndexedDB`) com `operatorName`, `operatorImageUrl` e `items[].imageUrl` para exibição completa na fila de contingência mesmo sem internet.

### Telas, Gavetas e Modais Atualizados (40 arquivos)
1. **Navegação, Cabeçalhos e Caixa**:
   - `RetailLayout.tsx`, `OpenShiftModal.tsx`, `CashMovementModal.tsx`, `CloseRegisterModal.tsx`, `EditPaymentModal.tsx`, `ReemitNfceModal.tsx`, `DemoLeadModal.tsx`
2. **Frente de Caixa (PDV), Checkout, Alertas Online e Contingência**:
   - `RetailPosPage.tsx`, `RetailCheckoutModal.tsx`, `PosDeliveryAlertBar.tsx`, `RetailOperationsPage.tsx`
3. **Catálogo, Trocas/Devoluções, Clientes 360°, Crediário e Inteligência Comercial**:
   - `RetailCatalogPage.tsx`, `RetailReturnsPage.tsx`, `RetailCustomersPage.tsx`, `RetailCrediarioPage.tsx`, `RetailIntelligencePage.tsx`
4. **Vitrine Digital (TV) e Loja Virtual (Admin + Público)**:
   - `RetailVitrinePage.tsx`, `RetailVitrineTvPage.tsx`, `RetailStorefrontPage.tsx`, `PublicStorefrontApp.tsx`, `StorefrontCartDrawer.tsx`
5. **Relatórios Executivos, Turnos de Caixa e Gestão Fiscal**:
   - `app/dashboard/page.tsx`, `app/dashboard/registers/page.tsx`, `app/dashboard/fiscal/gestao/page.tsx`
6. **Estoque, Entrada Rápida, Balanço, Importação XML, Pedidos de Compra e Atacado SP**:
   - `app/dashboard/inventory/stock-entry/page.tsx`, `app/dashboard/inventory/stock-count/page.tsx`, `app/dashboard/inventory/purchases/imports/page.tsx`, `app/dashboard/purchase-orders/page.tsx`, `app/dashboard/suppliers/page.tsx`, `components/suppliers/SpWholesaleMapHub.tsx`
7. **Equipe, Operadores, Portal Multi-Lojas e Sys-Init**:
   - `app/dashboard/users/page.tsx`, `components/OperatorsManagementModal.tsx`, `pages/GroupPortalPage.tsx`, `app/sys-init/page.tsx`

---

## 3. Validações Executadas

- **Identidade Visual (`node frontend/scripts/check-brand.cjs`)**: aprovado em 109 arquivos verificados, 0 cores externas à paleta roxa/branca/neutra.
- **Frontend Build (`npm --prefix frontend run build`)**: `tsc --noEmit` + `vite build` concluídos com 0 erros.
- **Backend Build (`npm --prefix backend run build`)**: `nest build` concluído com 0 erros.
- **Suíte Automatizada (`npm --prefix backend test`)**: 41 suítes aprovadas (`197 passed, 197 total`).
