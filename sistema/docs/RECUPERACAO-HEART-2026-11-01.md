# Recuperação da inicialização do Heart — 2026-11-01

## Falha observada

O container encerrava antes de iniciar a API. O entrypoint executava
`scripts/migrate-heart.cjs`, que reaplica os arquivos SQL incrementais a cada
inicialização. A versão antiga de `20261101120000_leadger_invoices_outbox`
referenciava `tenant_invoices.tenantId`, enquanto o schema Prisma, o runtime e a
migração seguinte usam `tenant_id`. O índice falhava com PostgreSQL 42703:
`column "tenantId" does not exist`.

Durante a investigação foi observada uma atualização externa da migração para
os nomes atuais, seguida de uma implantação saudável no Railway. Essa alteração
já existente foi preservada; não foi substituída nem reaplicada em produção.

## Proteção adicional

- O entrypoint passa a iniciar a API sem chamar `migrate-heart.cjs` ou Prisma.
  A aplicação de esquemas continua sob controle do operador via Sys-Init,
  conforme `AGENTS.md`.
- O teste de segurança de startup agora também impede explicitamente uma
  chamada indireta ao script `migrate-heart.cjs`.
- Testes de integração verificam as migrações incrementais presentes em um Heart
  novo e em um Heart com fatura, evento de outbox e pagamento existentes.
  Cada migração é repetida para verificar idempotência e preservação dos dados.

Os testes não usam `.env`, `DATABASE_URL_HEART` nem bancos de clientes. Exigem
`HEART_MIGRATION_TEST_URL` explícita e recusam hosts que não sejam locais.
Criam e removem apenas seus próprios schemas com prefixo `heart_migration_test_`
em uma instância PostgreSQL descartável.

```powershell
$env:HEART_MIGRATION_TEST_URL = 'postgresql://usuario@127.0.0.1:porta/postgres'
node --test backend/test/heart-migrations.test.cjs backend/test/startup-safety.test.cjs
```

Sem essa variável, os dois testes de integração são pulados. Os três testes de
startup continuam disponíveis sem conexão a banco.

## Limites

Nenhum comando de migração, seed, restauração ou limpeza foi aplicado aos bancos
de produção nesta investigação. A proteção no entrypoint só entra no ambiente
publicado após novo deploy. A rotina aditiva existente do HeartPrismaService
permanece com seu comportamento anterior.
