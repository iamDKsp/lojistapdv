# Hub de Fornecedores & Atacado SP (Brás, 25 de Março & Bom Retiro)

O módulo comercial **Hub de Fornecedores & Atacado SP** (`fornecedores` — **R\$ 49,90/mês**) oferece aos lojistas um mapa interativo exclusivo dos principais polos atacadistas de São Paulo (**Brás**, **Feirinha da Madrugada**, **25 de Março** e **Bom Retiro**), além da gestão de fornecedores locais da loja.

---

## 1. Experiência do Lojista (`/dashboard/suppliers`)

Ao acessar **Fornecedores** no menu principal, o lojista conta com duas visões integradas:

1. **Mapa Atacado SP (Brás & 25 de Março)**:
   - **Mapa Personalizado de São Paulo**: Cartografia vetorial dos polos atacadistas (*Rua Oriente*, *Rua Miller*, *Rua Barão de Ladário*, *Circuito de Compras / Feirinha da Madrugada*, *Rua 25 de Março*, *Ladeira Porto Geral* e *Rua José Paulino no Bom Retiro*), com estações de metrô/CPTM de referência (*Estação Brás*, *Metrô São Bento*, *Metrô Luz*).
   - **Marcadores com Preview de Foto**: Cada loja homologada aparece no mapa com a foto de capa da peça principal, nome curto, polo comercial e o menor preço de atacado (ex.: *a partir de R\$ 13,50*).
   - **Filtros por Tipo de Peça e Polo Comercial**:
     - Peças: *Todas as Peças*, *Camisetas*, *Jeans & Calças*, *Bermudas*, *Bonés*, *Relógios* e *Óculos & Acessórios*.
     - Polos: *Todos os Polos SP*, *Brás*, *Feirinha da Madrugada*, *25 de Março* e *Bom Retiro*.
   - **Painel Lateral Direito (Preview Rápido da Loja)**:
     - Ao clicar em qualquer marcador do mapa, o painel lateral direito exibe o endereço completo da loja/galeria em São Paulo, horário de atendimento, pedido mínimo, selo de **Entrega Garantida**, botão direto para **Chamar no WhatsApp** e **Salvar Fornecedor**.
     - **Grade 3x2 (6 Itens em 2 Fileiras de 3)**: Exibe imediatamente 6 peças da loja com foto e valor unitário no atacado para que o lojista entenda o mix vendido antes de abrir a loja completa.
   - **Botão "Ver Fornecedor" (Vitrine Expandida & Pedido com Segurança Garantida)**:
     - Abre a loja completa do fabricante/importador com todas as peças expandidas, comparativo entre **Custo Atacado SP** e **Venda Sugerida na Loja** (com cálculo automático da margem bruta sugerida), seletor de grades/pacotes e botão **"Solicitar Entrega com Segurança Garantida"** (Ônibus de Excursão no Brás, Transportadora Segurada ou Retirada).
     - Ao confirmar a solicitação, o sistema vincula automaticamente o fornecedor à base local da loja (`suppliers`), registra o pedido em `purchase_orders` com protocolo `ATK-SP-...` e gera o link de envio imediato para o WhatsApp do fornecedor.

2. **Meus Fornecedores Locais**:
   - Cadastro tradicional de fornecedores próprios da loja e vínculo de produtos do estoque ao catálogo de cada fornecedor.

---

## 2. Cadastro e Curadoria pelos Administradores (`/sys-init`)

O cadastro e a manutenção das lojas do mapa de São Paulo são centralizados no banco master (`Heart`) e gerenciados exclusivamente pelos administradores em **`/sys-init` → aba `Atacado SP (Brás & 25 de Março)`**:

- **Posicionamento Visual no Mapa**: O administrador pode clicar diretamente em qualquer rua do mapa de São Paulo para definir as coordenadas (`lat` / `lng`) do pino da loja.
- **Gestão Completa da Loja**: Nome, polo comercial (`BRAS`, `FEIRINHA_MADRUGADA`, `VINTE_CINCO_MARCO`, `BOM_RETIRO`), galeria, endereço completo, WhatsApp, foto do marcador, categorias atendidas, pedido mínimo e métodos de envio.
- **Gestão das Peças e Seleção da Grade 3x2**: Adição e edição das peças de atacado com foto, preço de atacado, preço sugerido de varejo, grade de tamanhos/cores e marcação das **6 peças de destaque (`isPreviewSix`)** exibidas nas 2 fileiras de 3 do painel lateral.

---

## 3. Arquitetura Técnica

- **Banco Central (`Heart`)**:
  - Tabelas `wholesale_suppliers` e `wholesale_supplier_items` declaradas em `backend/prisma/heart.schema.prisma` e provisionadas de forma idempotente em `HeartPrismaService.ensureHeartColumnsAndTables()`.
  - Seed inicial automático com 6 fornecedores curados do Brás, Feirinha da Madrugada, 25 de Março e Bom Retiro em `backend/src/suppliers/sp-wholesale.seed.ts`.
- **Rotas da API (`SuppliersController`)**:
  - `GET /suppliers/sp-hub` (JWT lojista) — Lista fornecedores ativos e suas peças.
  - `POST /suppliers/sp-hub/:id/import` (JWT lojista) — Importa o fornecedor do Hub SP para a tabela `suppliers` do tenant.
  - `POST /suppliers/sp-hub/:id/order-request` (JWT lojista) — Gera pedido de compra (`PurchaseOrder`) e protocolo de entrega garantida.
  - `GET / POST / PATCH / DELETE /suppliers/setup/sp-hub*` (`x-setup-pin`) — CRUD administrativo usado pelo `/sys-init`.
