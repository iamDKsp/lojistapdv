# Arquitetura e Operação em Produção — Railway + PostgreSQL

Este documento descreve a arquitetura publicada do **PDV Lojista** no **Railway** utilizando **PostgreSQL**, os procedimentos de migração, provisionamento multi-tenant, backup/restauração e configuração segura do primeiro administrador.

---

## 1. Arquitetura Publicada

- ** Aplicação Unificada (Mesma Origem HTTPS)**:
  - **URL Pública**: `https://pdv-lojista-production.up.railway.app`
  - O container de produção (construído via [`sistema/Dockerfile`](../Dockerfile)) compila o frontend React/Vite (`frontend/dist`) e o backend NestJS (`backend/dist`).
  - O servidor NestJS escuta em `0.0.0.0:${PORT}` (padrão `3530`), expõe a API REST em `/api/*`, o endpoint de prontidão com verificação ativa do PostgreSQL em `GET /api/health` e serve os arquivos estáticos do frontend com fallback SPA (`index.html`) para rotas como `/login`, `/pos`, `/dashboard/returns` e `/sys-init`.
- **Banco de Dados Multi-Tenant (PostgreSQL)**:
  - **Isolamento Físico por Banco de Dados**:
    - **Banco Central (`heart`)**: Armazena o cadastro de lojas (`tenants`), usuários globais (`users`), grupos de franquias (`tenant_groups`), galeria binária global de imagens (`images`, tipo `BYTEA`), catálogo mestre (`master_products`) e integrações (`tenant_integrations`).
    - **Bancos por Loja (`<databaseName>`)**: Cada loja provisionada recebe um banco de dados PostgreSQL isolado na mesma instância (`CREATE DATABASE "<databaseName>" ENCODING 'UTF8'`), com esquema completo gerenciado por [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma).
  - **Resolução de Contexto Segura**:
    - O contexto do tenant (`TenantContextService`) é extraído exclusivamente do JWT autenticado (`req.user.tenantId`) validado pelo `JwtStrategy`. Cabeçalhos externos não autenticados não definem o banco da loja.
    - O `TenantConnectionManager` mantém pools Prisma isolados por `tenantId` com limite configurável (`TENANT_DB_CONNECTION_LIMIT=5`) e desconexão automática de clientes ociosos.
  - **Controle de Concorrência e Atomicidade no PostgreSQL**:
    - Serialização de numeração sequencial e operações críticas por loja via `INSERT INTO tenant_settings (id) VALUES ('singleton') ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id`.
    - Bloqueio pessimista de linhas (`SELECT ... FOR UPDATE`) em produtos/variações (`lockProducts`), vendas (`sales`) e contas recorrentes (`payables`).
    - Advisory locks nativos do PostgreSQL (`pg_try_advisory_lock(hashtext(...))` / `pg_advisory_unlock(hashtext(...))`) para migrações do banco Heart, atualização aditiva de schemas de lojas (`upgradeTenantSchema`) e manutenção de imagens.

---

## 2. Serviços e Variáveis de Ambiente

### Serviços no Projeto Railway (`pdv-lojista`)
1. **`Postgres`**: Serviço oficial PostgreSQL 18 com volume persistente (`postgres-volume` em `/var/lib/postgresql/data`).
2. **`pdv-lojista`**: Serviço da aplicação (API NestJS + SPA React/Vite) com volume persistente em `/data` para backups SQL e arquivos fiscais.

### Variáveis de Ambiente do Serviço `pdv-lojista`

| Variável | Descrição | Exemplo / Referência (Sem Segredos) |
|---|---|---|
| `DATABASE_URL_HEART` | URL de conexão PostgreSQL do banco central (Heart) via rede privada do Railway | `${{Postgres.DATABASE_URL}}` |
| `DATABASE_URL_TENANT` | URL padrão utilizada pelo Prisma CLI em operações de schema | `${{Postgres.DATABASE_URL}}` |
| `JWT_SECRET` | Segredo criptográfico para assinatura de tokens JWT de usuários e operadores | `<segredo-aleatorio-256-bits>` |
| `SETUP_PIN` | PIN administrativo exigido no cabeçalho `x-setup-pin` do painel `/sys-init` | `<pin-forte-exclusivo>` |
| `SQL_PIN` | PIN exigido no cabeçalho `x-sql-pin` para o console SQL do `/sys-init` | `<pin-forte-exclusivo>` |
| `PORT` | Porta HTTP onde o NestJS escuta (`0.0.0.0`) | `3530` |
| `NODE_ENV` | Ambiente de execução Node.js | `production` |
| `APP_MODE` | Modo operacional do sistema | `retail` |
| `TENANT_DB_CONNECTION_LIMIT` | Limite de conexões Prisma por pool de loja | `5` |
| `FRONTEND_DIST_PATH` | Caminho para o build estático do frontend | `/app/frontend/dist` |
| `BACKUP_STORAGE_PATH` | Diretório persistente para dumps `pg_dump` | `/data/backups` |
| `FISCAL_STORAGE_PATH` | Diretório persistente para armazenamento de XMLs fiscais | `/data/fiscal` |
| `NFCE_SERVICE_URL` | *(Opcional)* URL do microsserviço PHP de transmissão SEFAZ quando emissão NFC-e estiver habilitada | `http://nfce-service:80` |

> **Importante**: Nunca armazene segredos em variáveis `VITE_*` nem faça commit de arquivos `.env` no repositório.

---

## 3. Processo de Migração e Provisionamento de Lojas

### Histórico de Migrações PostgreSQL
- Migração inicial dos bancos das lojas (Tenant): [`backend/prisma/migrations/20261101000000_init_postgresql/migration.sql`](../backend/prisma/migrations/20261101000000_init_postgresql/migration.sql)
- Migração inicial do banco central (Heart): [`backend/prisma/heart-migrations/20261101000000_init_postgresql/migration.sql`](../backend/prisma/heart-migrations/20261101000000_init_postgresql/migration.sql)

### Inicialização e atualização do Heart
O boot do container (`backend/entrypoint.sh`) inicia a API sem chamar `migrate-heart.cjs` nem executar Prisma. As atualizações de esquema são aplicadas pelo operador via Sys-Init, conforme `AGENTS.md`. O script operacional [`backend/scripts/migrate-heart.cjs`](../backend/scripts/migrate-heart.cjs) não deve ser adicionado ao boot ou executado automaticamente contra bancos de clientes.

A rotina aditiva existente do `HeartPrismaService` mantém seu comportamento anterior. A investigação da falha de 01/11/2026, os testes locais e os limites da recuperação estão em [RECUPERACAO-HEART-2026-11-01.md](RECUPERACAO-HEART-2026-11-01.md).

### Provisionamento de Novas Lojas
Ao criar uma loja pelo painel `/sys-init` (`POST /api/tenants/provision`) ou pelo script `bootstrap-initial-store.cjs`:
1. O nome do banco é sanitizado (`^[a-z][a-z0-9_]{0,62}$`) e validado contra nomes reservados.
2. O backend verifica `pg_database` e executa `CREATE DATABASE "<sanitizedDbName>" ENCODING 'UTF8'`.
3. O backend aplica as migrações PostgreSQL no novo banco (`npx prisma migrate deploy --schema=prisma/schema.prisma`).
4. O registro do `Tenant` e o usuário `admin` (com senha hash bcrypt) são criados no banco Heart.
5. As categorias padrão de vestuário/varejo (`Camisetas`, `Calçados`, `Bonés`, `Relógios`, `Acessórios`) e os grupos tributários base são criados de forma idempotente.

### Atualização de Lojas Existentes
- Executada pelo painel `/sys-init` (botão **Atualizar Bancos** → `POST /api/tenants/setup/migrate`).
- Para cada loja selecionada, `upgradeTenantSchema` adquire um advisory lock exclusivo por banco (`pg_try_advisory_lock(hashtext('pdv-schema-' + sha256(dbName)))`), verifica pré-requisitos aditivos sem perda de dados e aplica o schema atualizado.

---

## 4. Comandos de Build e Publicação

### Verificação e Build Local
```bash
# 1. Validar paleta roxa/branca e gerar build de produção do frontend
npm --prefix frontend run check:brand
npm --prefix frontend run build

# 2. Gerar clientes Prisma (Tenant e Heart) e compilar o backend
npm --prefix backend run prisma:generate
npm --prefix backend run build
```

### Deploy no Railway via CLI
A partir da pasta `sistema/`:
```bash
# Verificar status do projeto e serviço vinculado
railway status

# Publicar nova versão acompanhando build e logs de inicialização
railway up --service pdv-lojista --ci

# Consultar logs em tempo real
railway logs --service pdv-lojista
```

---

## 5. Procedimento de Backup, Restauração e Recuperação

### Backup e Restauração pelo Painel `/sys-init`
- O módulo `BackupsService` (`backend/src/backups/backups.service.ts`) utiliza `pg_dump` (`--no-owner --no-acl --clean --if-exists`) e `psql` (`-v ON_ERROR_STOP=1`), armazenando os arquivos `.sql` em `BACKUP_STORAGE_PATH` (`/data/backups`).
- Pelo painel `/sys-init` → **Backups**, é possível:
  - Gerar backup imediato do banco `heart`, de uma loja específica ou de todos os bancos (`POST /api/sys-init/backups/create`).
  - Baixar arquivos `.sql` individuais ou um pacote `.zip` consolidado.
  - Restaurar qualquer backup selecionado (`POST /api/sys-init/backups/restore/:folder/:filename`).
  - Configurar agendamento diário automático.

### Recuperação em Caso de Falha de Migração
1. Como `upgradeTenantSchema` utiliza advisory locks do PostgreSQL e recusa operações destrutivas, uma falha interrompe a execução antes de remover tabelas ou colunas.
2. Caso um índice único falhe por dados duplicados pré-existentes, a mensagem de erro informa a tabela afetada sem apagar registros.
3. Para restaurar um banco manualmente via CLI:
   ```bash
   psql "$DATABASE_URL_ALVO" -v ON_ERROR_STOP=1 -f backup_arquivo.sql
   ```

---

## 6. Como Acessar e Configurar o Primeiro Administrador e a Primeira Loja

### Opção A — Via Interface Web (`/sys-init`)
1. Acesse `https://pdv-lojista-production.up.railway.app/sys-init`.
2. Informe o `SETUP_PIN` configurado nas variáveis de ambiente do serviço `pdv-lojista` no Railway.
3. Clique em **Nova Empresa**, preencha o nome da loja, o e-mail e a senha forte do administrador e clique em **Provisionar**.
4. Acesse `https://pdv-lojista-production.up.railway.app/login` com o e-mail e a senha cadastrados.
5. Em **Equipe / Operadores**, cadastre ou atualize o operador de caixa com um PIN numérico para abertura de caixa e fechamento de vendas no PDV.

### Opção B — Via Script Repetível (`bootstrap-initial-store.cjs`)
Execute o script fornecendo os dados exclusivamente por variáveis de ambiente:
```bash
API_BASE_URL="https://pdv-lojista-production.up.railway.app/api" \
SETUP_PIN="<SEU_SETUP_PIN>" \
BOOTSTRAP_TENANT_NAME="Minha Loja Matriz" \
BOOTSTRAP_DB_NAME="minha_loja_matriz" \
BOOTSTRAP_ADMIN_NAME="Administrador" \
BOOTSTRAP_ADMIN_EMAIL="admin@minhaloja.com.br" \
BOOTSTRAP_ADMIN_PASSWORD="<SENHA_FORTE>" \
node backend/scripts/bootstrap-initial-store.cjs
```
