# Módulo Entrega Loja Virtual — 99 Entregas (2026-11-15)

Este documento descreve a arquitetura, regras de negócio, segurança multi-tenant, alertas na frente de caixa e experiência animada do cliente para o módulo **`modulos.entregaLojaVirtual` (99 Entregas)** no **PDV Lojista**.

---

## 1. Visão Geral da Operação (Modo Híbrido Inteligente + API 99 Empresas)

O módulo `entregaLojaVirtual` (ativado individualmente por loja no `/sys-init`) conecta a **Loja Virtual (`/loja/:slug`)**, o **Painel Administrativo (`/loja-virtual/entregas`)** e a **Frente de Caixa (`/` — `RetailPosPage`)** em uma operação expressa sem exigir migração destrutiva de banco de dados:

1. **Modo Híbrido Inteligente (Portal 99 Empresas — Padrão imediato)**:
   - Calcula automaticamente a distância rodoviária estimada entre o CEP de origem da loja e o CEP do cliente (`BrasilAPI v2` -> `ViaCEP` -> fallback determinístico regional/setorial com cache em memória de 12h).
   - Permite configurar **taxa base**, **km inclusos**, **valor por km excedente**, **raio máximo de cobertura (km)**, **pedido mínimo**, **gatilho de frete grátis**, **tempo estimado de separação** e **regras fixas por bairro**.
   - Suporta duas modalidades: **99Entrega Moto** (pacotes compactos) e **99Entrega Carro** (sacolas maiores/caixas, com adicional configurável).
   - No despacho, oferece cópia em 1 clique do endereço de coleta e destino, atalho direto para `https://empresas.99app.com`, geração automática de **PIN de Segurança de 4 dígitos**, registro de motorista/placa/link de rastreio e disparo instantâneo no WhatsApp do cliente.
2. **Modo Corporativo API 99 Empresas**:
   - Permite cadastrar `corporateAccountId`, `corporateToken` e ambiente (`sandbox` / `production`).
   - O `corporateToken` é **sempre mascarado** nas respostas administrativas (`corporateTokenMasked`, ex.: `tok_••••3456`) e **jamais** é incluído em respostas públicas (`GET /api/storefront/public/:slug` remove integralmente `apiIntegration` e `theme.expressDelivery`).

---

## 2. Alterações no Backend (`sistema/backend`)

### 2.1. Novo Serviço `StorefrontDeliveryService` (`src/storefront/storefront-delivery.service.ts`)
- **Extração e Sanitização**: Lê e grava a configuração em `draftThemeJson.expressDelivery` / `publishedThemeJson.expressDelivery` de `StorefrontSettings` (com seed automático do CEP e endereço cadastrados no `Tenant`).
- **Motor de Cotação (`calculateDeliveryQuote`)**:
  - Valida `moduleEnabled`, `config.enabled`, `minOrderAmount` e `maxRadiusKm`.
  - Prioriza overrides por bairro (`NEIGHBORHOOD_OVERRIDE`), cálculo por distância Haversine × `routeFactor` (`DISTANCE_KM`) ou taxa fixa (`FIXED`).
  - Aplica `carSurcharge` para `CARRO` e zera o frete quando `subtotal >= freeShippingAbove`.
- **Despacho & Segurança**:
  - Gera `confirmationPin` numérico criptograficamente aleatório de 4 dígitos (`crypto.randomInt(1000, 10000)`).
  - Constrói link `https://wa.me/...` formatado com etapa da entrega, modalidade (`99Entrega Moto` / `99Entrega Carro`), nome do entregador, placa, PIN de segurança e URL de rastreio da corrida.

### 2.2. Pedidos, Alertas PDV e Conversão em Venda com Frete
- **`StorefrontOrdersService` (`src/storefront/storefront-orders.service.ts`)**:
  - **`createPublicOrder`**: Pré-aquece o cache de CEP fora da transação SQL, calcula o frete oficial no servidor dentro do checkout público, persiste `quote` e `dispatch` inicial em `deliveryAddressJson`, soma `deliveryFee` ao `order.total` e inclui subtotal, frete, modalidade 99 e PIN na mensagem de WhatsApp.
  - **`dispatchExpressOrder` (`PUT /api/storefront/admin/orders/:id/dispatch-99`)**: Atualiza `status` (`WAITING` | `REQUESTED` | `DISPATCHED` | `DELIVERED`), sincroniza automaticamente `fulfillmentStatus` (`PREPARING` / `OUT_FOR_DELIVERY` / `DELIVERED`), registra auditoria `EXPRESS_99_UPDATED` em `StorefrontOrderEvent` e retorna `customerTrackingWhatsappUrl`.
  - **`getPosAlerts` (`GET /api/storefront/admin/pos-alerts`)**: Retorna contagem e fila priorizada de pedidos acionáveis para a Frente de Caixa (`AWAITING_CONFIRMATION` + `DELIVERY` no topo).
  - **`convertOrderToSale`**: Repassa `addition: orderDeliveryFee` para `SalesService.checkout` e usa `order.total` (subtotal + frete) no pagamento automático, garantindo conciliação exata de caixa.
- **`SalesService` (`src/sales/sales.service.ts`)**:
  - Ajustado `checkout()` para considerar `data.addition` explícito no cálculo de `total` antes da validação de `paymentsTotal` e na gravação de `Sale`, preservando 100% da integridade transacional e idempotência.

### 2.3. Novos Endpoints HTTP
- **Público**:
  - `POST /api/storefront/public/:slug/delivery/quote` — Simula frete por CEP, bairro, subtotal da sacola e veículo (`MOTO` / `CARRO`).
- **Administrativo / Operador PDV**:
  - `PUT /api/storefront/admin/delivery-settings` — Salva regras de frete, endereço de coleta, bairros e credenciais 99 Empresas.
  - `POST /api/storefront/admin/delivery/simulate` — Simulador ao vivo de rota/frete dentro do painel administrativo.
  - `GET /api/storefront/admin/pos-alerts` — Polling leve da Frente de Caixa.
  - `PUT /api/storefront/admin/orders/:id/dispatch-99` — Atualiza etapa da corrida 99, motorista, placa, link de rastreio e gera link WhatsApp para o cliente.

---

## 3. Alterações no Frontend (`sistema/frontend`)

Todas as telas seguem rigorosamente a paleta aprovada (`#7C3AED`, `#6D28D9`, `#FFFFFF`, `#F8F7FC`, `#F3E8FF`, `#272321`, `#665F70`, `#E5E1ED`) validada por `npm --prefix frontend run check:brand`, comunicando estados sempre com texto + ícones.

1. **Aba dedicada `/loja-virtual/entregas` (`src/retail/StorefrontExpressDeliveryTab.tsx`, `src/retail/RetailStorefrontPage.tsx`, `src/retail/RetailLayout.tsx`)**:
   - Configuração completa do ponto de coleta (busca automática por CEP), fórmula de km, raio máximo, `99Entrega Moto` e `99Entrega Carro`, pedido mínimo, frete grátis, tabela de bairros com preço fixo, simulador em tempo real e credenciais API 99 Empresas.
   - Componente **`StorefrontOrderExpressDispatchCard`** embutido nos detalhes de qualquer pedido `DELIVERY` na aba **Pedidos**.
2. **Notificação Sonora + Gaveta Rápida na Frente de Caixa (`src/retail/PosDeliveryAlertBar.tsx` e `src/retail/RetailPosPage.tsx`)**:
   - Polling a cada 10s quando online, acorde sonoro suave via Web Audio API (com botão de silenciar persistido localmente), barra pulsante no topo do caixa quando há entregas pendentes, contador no sino (`Bell`) e gaveta lateral **Central de Entregas no Caixa** para confirmar pedido, despachar 99, enviar rastreio no WhatsApp ou converter direto em venda no caixa aberto.
3. **Radar de Rota & Animação ao Vivo na Loja Virtual Pública (`src/storefront/components/StorefrontDeliveryAnimation.tsx` e `src/storefront/PublicStorefrontApp.tsx`)**:
   - No checkout (`/loja/:slug/finalizar`): barra de progresso de **Frete Grátis**, **Radar de Rota 99** animado calculando distância/tempo ao digitar o CEP e seletor interativo **99Entrega Moto** vs. **99Entrega Carro** somando o frete ao total.
   - No acompanhamento do pedido (`/loja/:slug/pedido/:referencia`): **Cena Animada de Rua 99** com polling silencioso a cada 10s, exibindo a loja, a casa do cliente, veículo vetorial animado (`Moto 99` ou `Carro 99`) percorrendo a pista em tempo real conforme o status avança (`Na Loja` -> `Chamando 99` -> `99 a Caminho` -> `Entregue`), cartão de **PIN de Segurança de 4 dígitos** e botão **Acompanhar corrida na 99**.
