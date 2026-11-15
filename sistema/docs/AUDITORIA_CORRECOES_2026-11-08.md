# Correções da Auditoria Técnica e Funcional (2026-11-08)

Este documento registra todas as correções aplicadas no **PDV Lojista** (`sistema/backend` e `sistema/frontend`) em resposta ao relatório de auditoria `auditoria-teltech-2026-11-08/RELATORIO.md` (`F01` a `F18` e apontamentos visuais das capturas de tela).

---

## 1. Rede Multi-Lojas (`F01`, `F02`)

- **Visibilidade condicional no menu lateral (`F01`)**:
  - Em `frontend/src/retail/RetailLayout.tsx`, `hasMultiStoreGroup` passou a verificar vínculo efetivo da loja com um grupo (`config?.groupId`, `user?.groupId` ou `config?.groupStores?.length > 0`), deixando de exibir o item **Rede Multi-Lojas** para lojas individuais não vinculadas a uma rede.
- **Tratamento resiliente de erro nas abas Estoque, Produtos e Transferências (`F02`)**:
  - Em `frontend/src/pages/GroupPortalPage.tsx`, as abas **Visão Consolidada**, **Estoque da Rede**, **Produtos & Preços** e **Transferências** agora validam `res.ok` antes de consumir o payload JSON e protegem o acesso a `data.rows`, `catalog.rows` e `syncStatus.missingProducts`, exibindo estado vazio informativo em vez de tela em branco quando a loja não pertence a um grupo.

---

## 2. Gestão & Relatórios NFC-e e Painel de Vendas (`F03`, `F05`, `F07`, `F11`, `F16`)

- **Balanço Fiscal — Não Declarado / SNF e Listagem de Vendas Não Emitidas (`F11`)**:
  - Em `backend/src/sales/sales.service.ts` (`getFiscalSummary`), `totalNaoDeclarado` agora considera como parcela fiscal declarada apenas notas com `nfceStatus === 'autorizada'`, somando integralmente as vendas sem emissão (`nao_emitida`, `null`, `pendente`, `rejeitada`) ao indicador **Não Declarado / SNF**.
  - Em `getFiscalSales`, o filtro `status=all` inclui todas as vendas não canceladas do período (inclusive `Não Emitida`), e foi adicionado suporte explícito ao filtro `status=nao_emitida` (**Não Emitidas / SNF**) na barra de filtros de `frontend/src/app/dashboard/fiscal/gestao/page.tsx`.
- **Segregação de Crediário (Fiado) e Cartão de Crédito (`F05`)**:
  - Em `backend/src/dashboard/dashboard.service.ts`, `backend/src/sales/sales.service.ts`, `backend/src/customers/customers.service.ts`, `frontend/src/app/dashboard/page.tsx` e `frontend/src/app/dashboard/fiscal/gestao/page.tsx`, a verificação de `crediario`/`fiado` e `credito_loja` agora precede `includes('cred')`, evitando que vendas a prazo no crediário sejam contabilizadas como Cartão de Crédito.
- **Contraste do Card de Cobertura Fiscal e Largura dos Seletores de Data (`F03` + Inspeção Visual)**:
  - Em `frontend/src/app/dashboard/fiscal/gestao/page.tsx` e `frontend/src/app/dashboard/page.tsx`, os cards que usavam fundo roxo sólido com textos `text-brand`/`text-ink` foram corrigidos para superfície clara com borda destacada (`bg-surface border-2 border-brand`), garantindo legibilidade total dentro da paleta aprovada.
  - Os seletores de data foram ampliados de `w-40` para `w-48 sm:w-52`, evitando o corte do ano (`01/11/2026`).
- **Exportação Excel com Colunas Numéricas (`F07`)**:
  - Em `frontend/src/app/dashboard/page.tsx` (`handleExportSales`), as colunas `Total (R$)` e `Desconto (R$)` são exportadas como `Number` nativo na planilha `.xlsx`.
- **Modal Próprio para Cancelamento de Venda (`F16`)**:
  - Em `frontend/src/app/dashboard/page.tsx`, o `window.prompt()` nativo foi substituído por um modal integrado ao design system com contador e validação mínima de 15 caracteres.

---

## 3. Loja Virtual e Catálogo Público (`F04`, `F08`, `F14`, `F15`)

- **Validação de WhatsApp Comercial antes da Publicação (`F04`)**:
  - Em `backend/src/storefront/storefront-admin.service.ts`, a inicialização automática só publica a loja se houver WhatsApp válido configurado, e `publishStorefront` exige WhatsApp comercial configurado antes de publicar.
  - Em `frontend/src/retail/RetailStorefrontPage.tsx`, a aba **Configurações** exibe o indicador `1 pend.` sempre que o WhatsApp comercial estiver pendente, mesmo com a loja publicada.
- **Deduplicação das Seções da Página Inicial (`F08`)**:
  - Em `frontend/src/retail/RetailStorefrontPage.tsx` (`DEFAULT_STOREFRONT_SECTIONS` e `normalizeDraftTheme`) e `backend/src/storefront/storefront.rules.ts` (`validateAndSanitizeTheme`), as seções do tema são deduplicadas por `type`, eliminando entradas duplicadas no editor de aparência.
- **Preço Unitário no Detalhe do Pedido e Função `money()` (`F14`)**:
  - Em `frontend/src/retail/types.ts`, `money()` trata valores `null`/`undefined`/`NaN` com segurança (`R$ 0,00`).
  - Em `backend/src/storefront/storefront-orders.service.ts`, `backend/src/storefront/storefront.rules.ts` e `frontend/src/retail/RetailStorefrontPage.tsx`, os itens de pedido expõem e leem `priceUnit ?? priceSaleSnapshot ?? 0`, eliminando `Unit: R$ NaN`.
- **Tela Pública de Status do Pedido Coerente com Cancelamento/Conclusão e Prazo com Data (`F15`)**:
  - Em `frontend/src/storefront/PublicStorefrontApp.tsx`, a tela `/loja/:slug/pedido/:ref` exibe o badge real do status comercial (`commInfo.label`), oculta o CTA de confirmação de reserva quando o pedido está cancelado/expirado/concluído, adapta o texto quando a loja não tem link de WhatsApp e formata o prazo de reserva com data e hora completas (`dd/mm/aaaa, hh:mm`).

---

## 4. Vitrine Digital / Modo TV (`F06`, `F17`)

- **Catálogo sem truncamento em 250 grupos (`F06`)**:
  - Em `backend/src/vitrine/vitrine.service.ts` (`getCatalog`), o limite de busca de grupos e produtos ativos foi ampliado de `250` para `2000`, e os campos `productId` e `stockTotal` foram incluídos no retorno.
- **Compatibilidade de Rota e Payload ao Salvar Rascunho (`F17`)**:
  - Em `backend/src/vitrine/vitrine.controller.ts`, foi adicionado suporte a `PUT /api/vitrine/draft` além de `PATCH /api/vitrine/draft`.
  - Em `backend/src/vitrine/vitrine.service.ts` e `frontend/src/retail/RetailVitrinePage.tsx`, `saveDraft` aceita tanto `draftSlides` quanto `slides`, e `getConfig` retorna `publishedVersion` sincronizado com `version`.

---

## 5. Hub Atacado SP, Crediário, Validação de Telefones e Contas a Pagar (`F09`, `F10`, `F12`, `F13`, `F18`)

- **Margem Bruta vs. Markup no Hub Atacado SP (`F09`)**:
  - Em `frontend/src/components/suppliers/SpWholesaleMapHub.tsx`, os cards de mercadoria exibem tanto a margem bruta sobre o preço de venda sugerido quanto o markup sobre o custo de atacado (`55% margem (+120% markup)`).
- **Crediário — Avisos de WhatsApp/Pix, Rótulos de Parcelas e Carregamento de Módulo (`F10`, `F12`)**:
  - Em `frontend/src/retail/RetailCrediarioPage.tsx`, `formatInstallmentDescription` evita duplicar o sufixo `(1/2)` quando a descrição da parcela já o contém, e o modal de **Nova conta avulsa** alerta quando o WhatsApp está desconectado ou sem chave Pix configurada.
  - Em `frontend/src/retail/RetailLayout.tsx`, a configuração de módulos do tenant é armazenada em `sessionStorage` e aguarda `configLoading` antes de exibir aviso de módulo desabilitado durante recarregamentos de página.
- **Validação de Telefones e WhatsApp (`F13`)**:
  - Em `backend/src/storefront/storefront.rules.ts`, `backend/src/customers/customers.service.ts` e `backend/src/suppliers/suppliers.service.ts`, números fictícios com dígitos repetidos (`00000000000`, `99999999999`), DDD inválido (`< 11`) ou assinante zerado são rejeitados com erro `400 Bad Request`.
- **Contas a Pagar — Separação entre Caixa Recebido e Crediário a Receber (`F18`)**:
  - Em `backend/src/payables/payables.service.ts` e `frontend/src/app/dashboard/finance/payables/page.tsx`, o resumo mensal calcula separadamente `cashSales` (vendas recebidas à vista/cartão/Pix + baixas de crediário no mês) e `crediarioSales` (vendas no fiado), exibindo o saldo efetivo de caixa nos indicadores **Vendas menos despesas** e **Ponto de Equilíbrio**.
