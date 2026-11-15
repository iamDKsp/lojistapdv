# Simulação Operacional de 12 Meses pelo `/sys-init`

## Objetivo

Permitir alimentar qualquer loja demonstrativa ou vitrine comercial (como o tenant `teltech`) diretamente pelo painel administrativo `/sys-init` (protegido por PIN), gerando **12 meses de operação realista** com a própria mercadoria, fotos, grades, equipe e Loja Virtual já cadastradas no banco isolado da loja — sem jamais executar scripts diretos fora do fluxo oficial do `Sys-Init`.

## O que é Preservado Integralmente

- **Catálogo e Preços**: 100% de `Category`, `RetailGroup` e `Product` (nomes, fotos, códigos, NCM, variações de tamanho/cor, `priceSell` e `priceCost`). Apenas `stock` e `salesCount` são sincronizados com os lotes e vendas gerados.
- **Loja Virtual e Vitrine TV**: `StorefrontSettings`, `StorefrontRevision`, `StorefrontCategory`, `StorefrontProduct` e `VitrineConfig` permanecem intactos (temas, banners, coleções e status de publicação).
- **Segurança Fiscal**: Vendas com NFC-e autorizada (`nfceStatus = 'autorizada'` ou `nfceXml != null`), numeração fiscal (`NumeracaoNfce`) e logs de importação XML (`IMPORT_XML` / `IMPORT_DFE`) nunca são apagados. Quando existem notas autorizadas, a numeração sequencial (`Sale.code` e `CashRegister.code`) prossegue a partir do maior código existente.
- **Equipe, Clientes e Fornecedores**: Todos os cadastros existentes são mantidos; retratos padrão (`operatorProfile` no banco `Heart`) só são preenchidos para operadores que ainda não possuem foto.

## O que é Gerado (Ciclo de 12 Meses)

1. **Vendas e Sazonalidade Realista (`Sale`, `SaleItem`, `Payment`)**:
   - Curva sazonal brasileira (Dia das Mães, Namorados/Inverno, Dia dos Pais, Black Friday e Natal), crescimento orgânico progressivo ao longo dos 12 meses, ritmo por dia da semana (picos sexta/sábado) e reforço nos dias 5–10 e 20–25.
   - Calibração automática ao ticket médio real das mercadorias cadastradas na loja:
     - `compact`: ~R$ 20 mil a R$ 32 mil/mês (~85–130 vendas/mês)
     - `medium` *(padrão)*: ~R$ 35 mil a R$ 65 mil/mês (~155–225 vendas/mês)
     - `busy`: ~R$ 75 mil a R$ 110 mil/mês (~265–380 vendas/mês)
   - Mix de pagamentos realista (`Pix`, `Cartão de Crédito`, `Cartão de Débito`, `Dinheiro`, `Crediário da Loja` e `Vale-Troca`).
2. **Equipe e Inteligência Comercial (`Operator`, `TenantSettings`)**:
   - Se a opção de complementar equipe estiver ativa e houver menos de 4 operadores ativos, cria consultores adicionais (PIN inicial `1234`) com distribuição distinta de desempenho para alimentar o **Ranking / Pódio**, calendário de metas e indicadores de comissão.
3. **Turnos de Caixa e Auditoria (`CashRegister`, `CashMovement`, `CashRegisterConferenceRevision`)**:
   - Turnos diários fechados nos dias anteriores com suprimentos, sangrias e `closingDetails` assinados com `dataVersion` determinística (`SHA-256`).
   - 1 caixa **aberto hoje** com vendas realizadas até o horário atual (`America/Sao_Paulo`), deixando o PDV pronto para operar imediatamente.
4. **Compras, Lotes PEPS/FIFO e Estoque (`Supplier`, `PurchaseOrder`, `StockLot`, `StockLotConsumption`, `InventoryLog`)**:
   - Reposições quinzenais concluídas (`COMPLETED`) ao longo dos 12 meses + 1 pedido `SENT` recente aguardando entrega, consumo FIFO consistente por item vendido e saldo final positivo (incluindo alguns itens em faixa de reposição para demonstrar os alertas de estoque baixo).
5. **Contas a Pagar (`Payable`)**:
   - 12 competências mensais de despesas fixas recorrentes (Aluguel, Energia, Internet, Contabilidade, DAS Simples Nacional e Folha/Comissões) + boletos variáveis de fornecedores (`PAID` no passado e `PENDING` para vencimentos futuros, incluindo alerta de curto prazo no Dashboard).
6. **Crediário, Trocas e Loja Virtual (`CustomerReceivable`, `RetailReturn`, `StoreCredit`, `StorefrontOrder`)**:
   - Carteira recorrente de clientes com parcelas quitadas, parciais, a vencer e demonstrativos em atraso.
   - Histórico de trocas com resgate em vendas posteriores e vales-troca ativos disponíveis.
   - ~14% das vendas integradas como pedidos concluídos da **Loja Virtual** + 2 pedidos recentes ativos na fila (`AWAITING_CONFIRMATION` e `CONFIRMED` com reserva ativa de estoque).

## Como Executar no `/sys-init`

1. Acesse `/sys-init` e informe o PIN administrativo.
2. Na aba **Tenants**, localize o cliente desejado (ex.: **`teltech`**).
3. Clique no botão **`12 Meses`** no cartão do tenant (ou abra **`Raio-X`** -> **`Alimentar 12 Meses`**).
4. Confirme as opções (**12 meses**, **Porte Médio**, substituir movimentações de teste anteriores e completar equipe) e clique em **`Alimentar 12 Meses Agora`**.

## Arquivos Principais

- `backend/src/tenants/tenant-history-seed.ts`
- `backend/src/tenants/tenant-history-seed.spec.ts`
- `backend/src/tenants/tenants.service.ts` (`populateTenantHistory` e correção de case-sensitivity no `getTenantStats`)
- `backend/src/tenants/tenants.controller.ts` (`POST /api/tenants/setup/:id/populate-history`)
- `frontend/src/components/sys-init/TenantPopulateHistoryModal.tsx`
- `frontend/src/components/sys-init/TenantXrayPanel.tsx`
- `frontend/src/app/sys-init/page.tsx`
