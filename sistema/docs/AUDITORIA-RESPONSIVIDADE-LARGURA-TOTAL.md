# Auditoria e Padronização de Responsividade em Largura Total — PDV Lojista

**Data:** 2026-11-15  
**Escopo:** Mapeamento completo de todas as rotas, módulos, abas e sub-abas de `frontend/src/App.tsx` e `frontend/src/retail/RetailLayout.tsx`.

---

## 1. Diagnóstico da Causa Raiz ("Parede Invisível")

O shell principal do aplicativo (`frontend/src/retail/RetailLayout.tsx` + `frontend/src/retail/management.css`) já entrega uma área útil fluida de ponta a ponta (`.retail-dashboard-frame > .retail-content` com `width: 100%; min-width: 0; padding: var(--management-space)`).

Contudo, diversas páginas herdadas em `frontend/src/app/dashboard/**`, a aba de transferências da Rede Multi-Lojas (`GroupPortalPage.tsx`) e etapas internas do `/sys-init` possuíam wrappers raiz com largura fixa centralizada (`max-w-lg`, `max-w-3xl`, `max-w-4xl`, `max-w-5xl`, `max-w-6xl`, `max-w-7xl` + `mx-auto`, ou `style={{ maxWidth: '640px' }}`), criando uma "parede invisível" que impedia cards, formulários, filtros e tabelas de aproveitarem a largura disponível do monitor, além de um wrapper interno com `p-6` duplicado em `/equipe`.

---

## 2. Regra Global de Proteção no Shell Administrativo

Em `frontend/src/retail/management.css`, foi adicionada a salvaguarda estrutural:

```css
.retail-dashboard-frame .retail-content > div:not(.fixed):not([role="dialog"]) {
  width: 100%;
  max-width: none;
  min-width: 0;
}
```

Modais (`RetailDialog`, `Modal`, `ImageOptimizationPanel`), gavetas (`TenantDetailDrawer`), login e a loja pública do consumidor final (`/loja/:slug`) preservam suas larguras próprias de diálogo/leitura.

---

## 3. Mapeamento Completo do Sistema (Módulo por Módulo)

| Módulo / Rota | Abas e Sub-abas | Arquivo Principal | Diagnóstico e Ação Aplicada |
| --- | --- | --- | --- |
| **Frente de Caixa** (`/`) | Criar Transação, sacola lateral, categorias e modais | `frontend/src/retail/RetailPosPage.tsx` | Já fluido em 100% da viewport (`.retail-pos-frame`). Mantido intacto. |
| **Início & Caixa** (`/inicio/*`) | `Visão do dia`, `Histórico de caixas`, `Relatórios`, `Vendas e sangrias` | `RetailDashboardPage.tsx`, `app/dashboard/registers/page.tsx`, `app/dashboard/page.tsx`, `RetailOperationsPage.tsx` | Já fluidos em 100% de `.retail-content`. Verificados sem containers limitadores. |
| **Estoque** (`/estoque/*`) | `Mercadorias e grades` | `frontend/src/retail/RetailCatalogPage.tsx` | Já fluido em 100% da largura. |
| **Estoque** (`/estoque/contagem`) | `Contagem de estoque` (`1 Escopo`, `2 Exportar`, `3 Importar` + Histórico) | `frontend/src/app/dashboard/inventory/stock-count/page.tsx` | **Corrigido:** removido `max-w-5xl mx-auto` → `w-full min-w-0`; expandidas as grades de seleção de categorias (`sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`) e de produtos manuais (`lg:grid-cols-2 xl:grid-cols-3`). |
| **Estoque** (`/estoque/categorias`) | `Categorias` (KPIs, sugestões de ícones, filtros e tabela) | `frontend/src/app/dashboard/inventory/categories/page.tsx` | **Corrigido:** removido `max-w-6xl mx-auto` → `w-full min-w-0`; KPIs responsivos (`sm:grid-cols-2 xl:grid-cols-4`); pílulas de sugestões agora usam `flex-wrap` sem cortar itens na direita; barra de busca/filtros expandida. |
| **Estoque** (`/estoque/entrada-manual`) | `Entrada manual` (busca, lista de entrada e modal de embalagens) | `frontend/src/app/dashboard/inventory/stock-entry/page.tsx` | **Corrigido:** removido `max-w-5xl mx-auto` → `w-full min-w-0`. |
| **Estoque** (`/estoque/entrada-xml`) | `Entrada por XML` (`Fila de Importação` e `Histórico / Importadas`) | `frontend/src/app/dashboard/inventory/purchases/imports/page.tsx` | **Corrigido:** removido `max-w-7xl mx-auto` → `w-full min-w-0`; células de fornecedor expandidas em telas amplas (`lg:max-w-[360px] 2xl:max-w-[520px]`). |
| **Clientes & Crediário** (`/clientes/*`, `/crediario/*`) | `Clientes`, `Trocas e vale-troca`, `Resumo e limites`, `Parcelas e baixas`, `Cobrança WhatsApp` | `RetailCustomersPage.tsx`, `RetailReturnsPage.tsx`, `RetailCrediarioPage.tsx` | Já fluidos em 100% da largura com grids responsivos nativos. |
| **Loja Virtual & Vitrine** (`/loja-virtual/*`, `/vitrine/*`) | `Visão geral`, `Pedidos online`, `Reservas`, `Catálogo online`, `Personalizar vitrine`, `Configurações` | `RetailStorefrontPage.tsx`, `RetailVitrinePage.tsx` | Já fluidos em 100% da largura. |
| **Financeiro & Compras** (`/financeiro/*`) | `Contas a pagar`, `Pedidos de compra`, `Fornecedores` (`Meus Fornecedores` e `Polo Atacadista SP`) | `app/dashboard/finance/payables/page.tsx`, `app/dashboard/purchase-orders/page.tsx`, `app/dashboard/suppliers/page.tsx` | **Corrigido:** removido `max-w-6xl mx-auto` em Pedidos de Compra e `max-w-7xl mx-auto` em Fornecedores; painel dividido de fornecedores locais calibrado para `lg:grid-cols-12` (`3/12` lista + `9/12` catálogo). |
| **Inteligência Comercial** (`/inteligencia-comercial`, `/calendario`, `/auditoria-e-metas`) | `Ranking e pódio`, `Calendário do mês`, `Auditoria e metas` | `frontend/src/retail/RetailIntelligencePage.tsx` | Já fluido em 100% da largura. |
| **Rede Multi-Lojas** (`/grupo-portal/*`) | `Visão geral`, `Previsão de compra`, `Estoque entre lojas`, `Catálogo e preços`, `Transferências` | `frontend/src/pages/GroupPortalPage.tsx` | **Corrigido:** removido `maxWidth: '720px'` no callout de loja única e removidos `maxWidth: '620px'` / `maxWidth: '640px'` em `TabTransferencias`, substituindo por layout fluido em duas colunas (`Transferência entre Filiais` + painel vivo `Saldo por Filial na Rede`). |
| **Equipe & Acessos** (`/equipe`) | Gestão de operadores, perfis, PIN e permissões | `frontend/src/app/dashboard/users/page.tsx` | **Corrigido:** removido padding duplicado `p-6` → `w-full min-w-0 space-y-6`, alinhando as margens com todas as demais abas. |
| **Configurações** (`/configuracoes/*`) | `Dados da loja` (`identidade`, `operacao`, `contingencia`, `aparencia`), `Meios de pagamento`, `Regras fiscais`, `Notas NFC-e` | `empresa/page.tsx`, `payment-methods/page.tsx`, `tributacao/page.tsx`, `fiscal/gestao/page.tsx` | **Corrigido:** removido `max-w-3xl mx-auto` (768px) em Meios de Pagamento — organizando `Métodos Padrão` e `Métodos Customizados` lado a lado em `xl:grid-cols-2` — e removido `max-w-7xl mx-auto` em Notas NFC-e. |
| **Sys-Init** (`/sys-init`) | `Empresas`, `Atacado SP`, `Backups`, `Nova Empresa`, `Editar Empresa` (6 sub-abas), `Sucesso` | `frontend/src/app/sys-init/page.tsx` | **Corrigido:** removidos `max-w-4xl mx-auto` e `max-w-lg mx-auto` nas etapas de Backups, Nova Empresa (agora em grid responsivo de 2 colunas no desktop), Edição de Empresa e Credenciais de Sucesso. |
