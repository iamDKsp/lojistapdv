# Redesenho Editorial do Ranking Comercial (Inteligência Comercial) — 15/11/2026

Reformulação visual e estrutural do módulo **Inteligência Comercial** (`/inteligencia-comercial`), com foco na aba **Ranking e pódio**, eliminando ruídos visuais artificiais e alinhando a tela ao padrão executivo recém-implantado em **Relatórios da Loja** (`StorePeriodFilterBar` e `StoreKpiCard`).

## Problemas corrigidos

1. **Remoção de elementos ornamentais artificiais ("cara de IA")**:
   - Removido o antigo container de palco escuro convertido parcialmente por overrides (`.retail-intel-stage-card` / `.retail-intel-podium-grid`) e a coroa de louros vetorial (`PodiumLaurelCrownSvg`).
   - Substituído por **3 Cards Editoriais lado a lado** em superfície branca (`#FFFFFF`), reservando borda e filete superior `#7C3AED` exclusivamente para o **1º lugar**, enquanto **2º e 3º lugares** utilizam superfícies brancas com selos grafite/neutros (`#272321` / `#F8F7FC`) e barras de progresso individuais de meta.
   - Quando a loja possui menos de 3 vendedores cadastrados, os slots excedentes exibem cards discretos de posição disponível com atalho direto para `/equipe`, em vez de promover vendas sem vendedor ao pódio.

2. **Hierarquia cromática na tabela comparativa e avatares**:
   - Eliminada a repetição do mesmo emblema quadrado roxo (`#7C3AED`) em todas as posições (`1º`, `2º`, `3º`, `4º`…). Agora apenas o `1º` usa fundo `#7C3AED`; `2º` e `3º` usam destaque suave `#F3E8FF` com borda `#7C3AED`; `4º` em diante usam superfície neutra `#F8F7FC` com borda `#E5E1ED`.
   - Adicionada barra proporcional sob o nome de cada consultor comparando seu desempenho com o líder no critério selecionado.
   - Seletor de critério convertido em barra segmentada de 1 clique (`Líquido`, `Bruto`, `PA`, `Peças`, `Ticket Médio`, `Vitórias`, `Fidelização`).

3. **Unificação e separação de `"Balcão (Sem Vendedor)"`**:
   - Corrigida no backend (`RetailIntelligenceService`) a divergência onde vendas sem operador (`operatorId: null`) e devoluções autorizadas por usuários administrativos geravam duas linhas distintas de `"Balcão (Sem Vendedor)"` (uma positiva e outra negativa com `0% trocado`).
   - Agora todas as vendas e devoluções sem operador cadastrado consolidam no mesmo registro canônico `sem-vendedor` (`isUnassigned: true`), sem acumular comissão ou disputar o pódio/Campeão do Dia, sendo exibido separadamente no rodapé auditável da tabela.
   - Corrigido o cálculo de `bestDay` para considerar apenas dias com venda efetiva (`salesCount > 0 && revenue > 0`).

4. **Reorganização da coluna lateral e subida dos KPIs / filtro de datas**:
   - Subidos para o topo do módulo o filtro de período (`StorePeriodFilterBar` no fuso `America/Sao_Paulo`) e os 4 `StoreKpiCard` executivos.
   - Na coluna direita, removido o ícone `Sparkles` e eliminado o card redundante *"Recorde de Vendas por Vendedor"* (que repetia a coluna *Melhor Dia* da tabela).
   - Adicionado o painel **Meta da Loja & Comissões** (progresso percentual, saldo restante para bater a meta e comissão acumulada da equipe) seguido de **Leitura Comercial do Período** com formatação numérica e monetária 100% em `pt-BR`.

## Arquivos alterados

### Backend (somente leitura e agregação em memória, sem alteração de schema Prisma)
1. `backend/src/retail/retail-intelligence.service.ts`
2. `backend/src/retail/retail-intelligence.service.spec.ts`

### Frontend
1. `frontend/src/retail/RetailIntelligencePage.tsx`
2. `frontend/src/retail/retail.css`
3. `frontend/src/retail/management.css`

## Garantias preservadas

- Isolamento multi-tenant via `TenantContextService` e `TenantConnectionManager` intacto.
- Nenhuma migração, `db push` ou alteração de `schema.prisma` realizada.
- Validador estrito de identidade (`npm --prefix frontend run check:brand`) aprovado em 100% dos arquivos com os tokens oficiais (`#7C3AED`, `#6D28D9`, `#FFFFFF`, `#F8F7FC`, `#F3E8FF`, `#272321`, `#665F70`, `#E5E1ED`).
