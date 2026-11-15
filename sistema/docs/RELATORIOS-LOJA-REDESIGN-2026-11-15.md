# Redesenho e Polimento do Módulo Relatórios da Loja — 15/11/2026

Unificação visual, correção de gráficos/cores e enriquecimento de KPIs varejistas nas quatro abas do módulo **Início / Relatórios** (`/inicio`, `/inicio/historico-de-caixas`, `/inicio/relatorios` e `/inicio/operacoes`).

## Problemas corrigidos (Auditoria Visual)

1. **Inversão de superfícies e quebra de identidade entre abas**:
   - `Visão geral` e `Operações locais` usavam painéis crus sem gráficos nem contexto visual, enquanto `Histórico de caixas` e `Relatórios de vendas` herdavam estrutura legada de tema escuro convertida mecanicamente (`bg-page` `#F8F7FC` sobre `#FFFFFF` e barras de progresso invisíveis `bg-surface/50` sobre branco).
   - Todas as quatro abas agora compartilham o mesmo cabeçalho (`StoreModuleHeader`), seletor de período (`StorePeriodFilterBar`), cards de indicadores (`StoreKpiCard`) e superfícies `#FFFFFF` com borda `#E5E1ED`, apoio `#F3E8FF` e destaque `#7C3AED` / `#6D28D9`.
2. **Gráficos quebrados e cores apagadas**:
   - **Donut de Mix de Pagamentos**: antes fixava `credito` em `#665F70` (cinza apagado) e `debito` em `#272321`, deixando 90%+ do anel cinza em lojas com predominância de cartão, além de colidir `dinheiro`/`crediario` e `pix`/`credito_loja`. Agora ordena os meios por relevância decrescente aplicando exclusivamente tokens e alfas aprovados (`#7C3AED`, `#6D28D9`, `#7C3AEDA6`, `#7C3AED66`, `#272321`, `#665F70`), exibe centro interativo com `%` e `R$` e permite clicar na fatia para filtrar os cupons.
   - **Gráfico de Barras (Ritmo de Vendas)**: removido o cursor preto sólido `cursor={{ fill: '#272321' }}` no hover (substituído por `#F3E8FF`), adicionado `maxBarSize`, linha tracejada de média (`#6D28D9`), destaque real para a barra de pico (`#6D28D9` vs `#7C3AED`), preenchimento contínuo de todos os dias do intervalo (sem pular dias sem venda no eixo X) e sincronização automática do agrupamento (`Hora` em Hoje/Ontem, `Dia` em Semana/Mês/Personalizado).
3. ** Contraste e comunicação de status**:
   - Emblemas de NFC-e (`Autorizada`, `Pendente`, `Rejeitada`, `Cancelada`) e status de caixa (`Aberto`, `Pendente de Auditoria`, `Auditado`, `Gaveta exata`, `Falta`, `Sobra`) agora combinam contraste da paleta aprovada, bordas distintas, ícones dedicados e rótulos explícitos.
   - Removido o card inoperante `"Caixa Atual: N/A — Mude para Hoje"` quando o lojista consulta `Semana`, `Este mês` ou `Personalizado`.

## Novos KPIs e recursos para o lojista

- **Visão geral (`/inicio`)**:
  - Período rápido (`Hoje`, `Ontem`, `7 dias`, `Este mês`, `Personalizado`) unificado no fuso `America/Sao_Paulo`.
  - 4 KPIs com comparativo percentual frente ao período equivalente anterior: **Faturamento Líquido (`Vendas − Trocas`)**, **Ticket Médio**, **PA (Peças por Atendimento)** e **Trocas & Vale-Trocas Ativos** (com taxa `%` de trocas).
  - Gráfico combinado **Ritmo Diário · Vendas e Trocas** + ranking **Grupos Campeões de Giro** com miniatura da foto compartilhada do grupo, receita, peças (pluralização corrigida) e participação percentual.
- **Histórico de caixas (`/inicio/historico-de-caixas`)**:
  - 4 KPIs interativos (funcionam como filtros rápidos): **Turnos Abertos Agora** (com gaveta esperada), **Pendentes de Auditoria**, **Volume Movimentado** (divisão Espécie × Digital) e **Conferência de Gaveta** (saldo líquido de sobras/faltas).
  - Busca por `#caixa` ou operador, filtro por data de abertura, exportação em Excel e coluna explícita de **Diferença de Gaveta** calculada com `Prisma.Decimal` no backend.
- **Relatórios de vendas (`/inicio/relatorios`)**:
  - 6 KPIs comerciais: **Faturamento do Período** (`% vs. período ant.`), **Volume Comercial** (`vendas` + `peças`), **Ticket Médio** (+ `Maior cupom`), **PA**, **Descontos Aplicados** (`R$` + `% do potencial`) e **Pico & Caixa Atual**.
  - Ranking **Top Mercadorias** com alternância `R$` / `Peças`, miniatura do grupo e chips de `Tamanho` e `Cor`.
  - Novo modal **Detalhes do Cupom** (itens, grade, descontos, operador, cliente/CPF, chave NFC-e, reimpressão 80mm, emissão/correção de NFC-e e cancelamento auditado).
- **Operações locais (`/inicio/operacoes`)**:
  - 4 KPIs de diagnóstico local do dispositivo: **Conectividade do Terminal**, **Fila Pendente de Envio**, **Para Conferência Manual** e **Catálogo Offline & Operador**.
  - Visibilidade gerencial para `admin`/`superadmin`/`group_owner` sobre todas as operações retidas do `tenantId` neste aparelho, preservando integralmente o bloqueio por `withSaleOperationLock` e a exigência de autenticação por PIN do operador titular para reenvio idempotente.

## Arquivos alterados

### Backend (somente leitura / agregação, sem alteração de schema Prisma)
1. `backend/src/retail/retail-overview.service.ts`
2. `backend/src/retail/retail-overview.service.spec.ts`
3. `backend/src/dashboard/dashboard.service.ts`
4. `backend/src/cash-registers/cash-registers.service.ts`
5. `backend/src/cash-registers/cash-registers.service.spec.ts`

### Frontend
1. `frontend/src/components/analytics/StoreAnalyticsUI.tsx` *(novo componente compartilhado)*
2. `frontend/src/retail/RetailDashboardPage.tsx`
3. `frontend/src/app/dashboard/registers/page.tsx`
4. `frontend/src/app/dashboard/page.tsx`
5. `frontend/src/components/PeriodReportModal.tsx`
6. `frontend/src/retail/RetailOperationsPage.tsx`
7. `frontend/src/lib/db.ts`

## Garantias preservadas

- Isolamento multi-tenant via `TenantContextService` e `TenantConnectionManager` intacto.
- Nenhuma migração, `db push` ou alteração de `schema.prisma` executada.
- Validador estrito de identidade (`npm --prefix frontend run check:brand`) aprovado com 100% dos tokens oficiais (`#7C3AED`, `#6D28D9`, `#FFFFFF`, `#F8F7FC`, `#F3E8FF`, `#272321`, `#665F70`, `#E5E1ED`).
