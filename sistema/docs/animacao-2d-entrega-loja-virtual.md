# Animação 2D Motion de Entrega na Loja Virtual (Zoom + Parallax Infinito)

## Visão Geral
A experiência de entrega da Loja Virtual (`entregaLojaVirtual`) utiliza a **Cena 2D Motion a 60 FPS** (`StorefrontDeliveryMotion2DCanvas`), construída em SVG vetorial com câmera de zoom dinâmico, parallax infinito de 4 camadas e física 2D na motocicleta 160cc.

Todos os elementos gráficos obedecem estritamente aos tokens da identidade **Roxo & Branco** (`#7C3AED`, `#6D28D9`, `#FFFFFF`, `#F8F7FC`, `#F3E8FF`, `#272321`, `#665F70`, `#E5E1ED`).

## As 5 Etapas da Entrega
1. **1. Encontrou (`FOUND` / `WAITING`) — Sistema encontrou motorista**:
   - Motoboy posicionado no ponto inicial com ondas concêntricas de confirmação no totem de chamada e balão de status.
2. **2. Indo à loja (`REQUESTED`) — Motorista vai até a loja**:
   - Câmera aplica **Zoom Dinâmico (`1.40x`)** focado no motoboy, que permanece dirigindo continuamente no centro do palco enquanto as **4 camadas de cenário** (nuvens, skyline urbano, calçada/árvores/postes e faixas do asfalto) correm em **efeito parallax infinito**.
3. **3. Pegou pacote (`PICKED_UP`) — Motorista pegou o pacote**:
   - A fachada oficial da loja **PDV Lojista** (com toldo de 3 gomos ondulando) desacelera atrás da moto; o pacote é bipado no balcão, a tampa articulada da bag térmica abre (`-70°`), o pacote salta em **arco parabólico** para dentro da bag com impacto na suspensão (*squash & stretch*), e a bag assume a cor `#7C3AED` com o símbolo `L` branco.
4. **4. Chegando (`DISPATCHED`) — Motorista está chegando**:
   - Câmera aplica **Zoom Dinâmico (`1.48x`)** focado no motoboy com a bag roxa carregada em loop contínuo de direção e parallax acelerado, acompanhado do código PIN de confirmação.
5. **5. Entregue (`DELIVERED`) — Motorista entregou o pacote**:
   - A casa do cliente desacelera ao lado do motoboy, a bag abre, o pacote salta em arco parabólico até a porta do cliente e surgem o selo de confirmação `✓` e partículas comemorativas na paleta roxa/lilás.

## Adaptação Desktop vs. Mobile
- **Desktop (`sm:flex`)**:
  - Palco panorâmico (`viewBox="0 0 760 332"`, altura `332px`) sem barra de título redundante no topo para dar máximo respiro visual à cena.
  - HUD flutuante integrado dentro do próprio palco e grade inferior com as 5 etapas clicáveis, botão de Loop Contínuo / Auto-Avançar e botão Repetir.
- **Mobile (`sm:hidden`)**:
  - Enquadramento vertical (`viewBox="170 54 420 278"`) no topo com pill compacta do pedido.
  - **Bottom Sheet arredondado (`rounded-t-[24px]`)** sobrepondo a base da animação com alça superior, título/descrição da etapa, 5 barras de progresso segmentadas clicáveis e card compacto do entregador + `CÓD: XXXX`.

## Arquivos Principais
- `frontend/src/storefront/components/StorefrontDeliveryAnimation.tsx`: Motor 2D (`StorefrontDeliveryMotion2DCanvas`), calculadora de rota no checkout (`StorefrontCheckoutRouteCalculator`) e cena de acompanhamento do pedido (`StorefrontOrderDeliveryScene`).
- `frontend/src/storefront/PublicStorefrontApp.tsx`: Integração na página pública do pedido (`/loja/:slug/pedido/:referencia`) e no checkout (`/loja/:slug/finalizar`).
- `frontend/src/retail/StorefrontExpressDeliveryTab.tsx`: Preview ao vivo na aba de configuração `Entrega 99` e controles de despacho em 5 etapas no painel administrativo de pedidos.
- `frontend/src/retail/PosDeliveryAlertBar.tsx`: Controles rápidos das 5 etapas na gaveta de entregas da Frente de Caixa (PDV).
- `backend/src/storefront/storefront-delivery.service.ts` e `backend/src/storefront/storefront-orders.service.ts`: Suporte aos status `WAITING`, `FOUND`, `REQUESTED`, `PICKED_UP`, `DISPATCHED` e `DELIVERED` com mensagens de rastreio para WhatsApp.
