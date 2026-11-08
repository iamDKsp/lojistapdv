# Módulos Comercializáveis e Precificação — PDV Lojista

Este documento define o modelo comercial **SaaS Modular (Plano Padrão + 9 Módulos Adicionais + Desconto por Filial Conectada)** implementado em [`frontend/src/lib/modular-pricing.ts`](../frontend/src/lib/modular-pricing.ts), [`frontend/src/app/sys-init/page.tsx`](../frontend/src/app/sys-init/page.tsx) e [`backend/src/tenants/tenants.service.ts`](../backend/src/tenants/tenants.service.ts).

---

## 1. Plano Padrão (Base Obrigatória)

- **Loja Padrão / Matriz**: **R$ 149,90 / mês** (`BASE_PLAN_PRICE = 149.90`)
- **Filial Conectada Multi-Empresa (`modulos.filialMultiEmpresa = true`)**: **R$ 99,90 / mês** (`BRANCH_PLAN_PRICE = 99.90`, desconto automático de **R$ 50,00** no Plano Padrão para cada loja adicional conectada ao mesmo grupo).

### Recursos Nativos do Plano Padrão (Sempre Inclusos)
1. **Frente de Caixa (PDV)** + Grade Tamanho/Cor + Abertura/Fechamento de Turno
2. **Estoque Completo** (`estoque: true`) — Mercadorias, Grades, Categorias, Balanço/Contagem e Entrada Manual
3. **Compras e Financeiro** — Contas a Pagar (fixas e variáveis) e Pedidos de Compra
4. **Clientes, Trocas e Vale-Crédito** — Cadastro de clientes e fluxo de devolução/crédito na loja
5. **Gestão Mobile e Relatórios** (`dashboardMobile: true`) — Visão geral, histórico de caixas, relatórios de vendas e acesso mobile

---

## 2. Os 9 Módulos Adicionais de Venda (Add-ons)

| Chave (`modulos.<id>`) | Nome Comercial | Valor Mensal | Recursos Liberados |
| :--- | :--- | :---: | :--- |
| `nfce` *(+ `importacaoXml`)* | **Módulo Fiscal (NFC-e + Entrada XML)** | **+ R$ 49,90** | Emissão de NFC-e, certificado digital A1, CSC, tributação e entrada de notas por arquivo XML. |
| `lojaVirtual` | **Módulo Loja Virtual** | **+ R$ 39,90** | Catálogo público `/loja/:slug`, carrinho, reserva de estoque e pedidos via WhatsApp. |
| `entregaLojaVirtual` | **Módulo Entrega Loja Virtual (99 Entregas)** | **+ R$ 24,90** | Cálculo de frete local no checkout da Loja Virtual e solicitação de entrega com 99 Entregas. |
| `crediario` | **Módulo Crediário & Cobrança WhatsApp** | **+ R$ 39,90** | Contas de clientes com limite, carnê/parcelas e régua automática de cobrança no WhatsApp. |
| `fornecedores` | **Módulo Fornecedores & Atacado SP** | **+ R$ 49,90** | Gestão completa de fornecedores, pedidos automáticos e catálogo exclusivo de atacadistas de São Paulo com entrega garantida. |
| `vendedores` | **Módulo Vendedores & Equipe** | **+ R$ 29,90** | Gestão de múltiplos vendedores/operadores (`/equipe`), troca rápida no PDV e comissões. |
| `inteligenciaComercial` | **Módulo Inteligência Comercial** | **+ R$ 29,90** | Pódio gamificado de vendedores, calendário diário de vendas, auditoria de descontos/trocas, metas e CRM 360º (`/inteligencia-comercial`). |
| `vitrineDigital` | **Módulo Vitrine Digital & TV** | **+ R$ 19,90** | Programação de slides de ofertas e reprodutor público `/tv/:tvPublicId` para Smart TVs. |
| `multiEmpresa` | **Módulo Central Multi-Empresa** | **+ R$ 59,90** | Habilita o Portal do Grupo (`/grupo-portal`), unificando vendas da rede, catálogo mestre e transferências de estoque entre filiais. |

---

## 3. Cálculo Automático no `/sys-init`

- Na criação de uma nova loja (`Provisionar Nova Loja`) e na aba **Módulos** da edição de tenant em `/sys-init`, a calculadora soma automaticamente a **Base da Loja** (`R$ 149,90` ou `R$ 99,90` para filial) com os **Módulos Ativos** e sincroniza o campo `mensalidadeValor`.
- O administrador do `/sys-init` pode alternar entre cálculo automático (`Auto: ON`) e valor manual caso deseje aplicar uma condição comercial personalizada.
