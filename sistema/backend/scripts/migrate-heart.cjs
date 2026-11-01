#!/usr/bin/env node
/**
 * Aplica de forma idempotente e protegida por advisory lock a estrutura do banco Heart (PostgreSQL).
 * Nunca utiliza migrate reset nem --accept-data-loss.
 */
const { Client } = require('pg');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function applySqlMigrationsIdempotently(client) {
  const heartMigrationsDir = path.resolve(
    __dirname,
    '..',
    'prisma',
    'heart-migrations',
  );
  if (!fs.existsSync(heartMigrationsDir)) return;

  // Check if "tenants" table already exists
  const tableCheck = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenants'`,
  );
  const tenantsTableExists = tableCheck.rowCount > 0;

  const folders = fs
    .readdirSync(heartMigrationsDir)
    .filter((f) =>
      fs.statSync(path.join(heartMigrationsDir, f)).isDirectory(),
    )
    .sort();

  for (const folder of folders) {
    // Skip the initial full-table creation if "tenants" already exists
    if (folder.startsWith('20261101000000_') && tenantsTableExists) {
      continue;
    }
    const sqlPath = path.join(heartMigrationsDir, folder, 'migration.sql');
    if (fs.existsSync(sqlPath)) {
      const sql = fs.readFileSync(sqlPath, 'utf8');
      console.log(`[migrate-heart] Aplicando migração incremental: ${folder}`);
      try {
        await client.query(sql);
      } catch (err) {
        console.warn(
          `[migrate-heart] Aviso na migração incremental (${folder}):`,
          err.message || err,
        );
      }
    }
  }
}

async function main() {
  const dbUrl = process.env.DATABASE_URL_HEART;
  if (!dbUrl) {
    console.error('[migrate-heart] ERRO: DATABASE_URL_HEART não definida.');
    process.exit(1);
  }

  const client = new Client({
    connectionString: dbUrl,
    connectionTimeoutMillis: 10000,
  });

  await client.connect();
  const lockKey = 'pdv-heart-migration-lock-v1';
  let locked = false;

  try {
    for (let attempt = 1; attempt <= 15; attempt++) {
      const res = await client.query(
        'SELECT pg_try_advisory_lock(hashtext($1)) AS acquired',
        [lockKey],
      );
      if (res.rows[0]?.acquired === true) {
        locked = true;
        break;
      }
      console.log(
        `[migrate-heart] Aguardando lock de migração do Heart (tentativa ${attempt}/15)...`,
      );
      await new Promise((r) => setTimeout(r, 2000));
    }

    if (!locked) {
      throw new Error(
        'Não foi possível adquirir o lock de migração do banco Heart após 30s.',
      );
    }

    // 1. Aplica migrações SQL incrementais idempotentes (IF NOT EXISTS) antes do db push
    await applySqlMigrationsIdempotently(client);

    // 2. Sincroniza qualquer diferença restante via prisma db push (sem --accept-data-loss)
    const schemaPath = path.resolve(
      __dirname,
      '..',
      'prisma',
      'heart.schema.prisma',
    );
    console.log('[migrate-heart] Sincronizando schema do banco Heart...');
    execSync(`npx prisma db push --schema="${schemaPath}" --skip-generate`, {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL_HEART: dbUrl },
    });
    console.log('[migrate-heart] Banco Heart pronto.');
  } finally {
    try {
      if (locked) {
        await client.query('SELECT pg_advisory_unlock(hashtext($1))', [
          lockKey,
        ]);
      }
    } finally {
      await client.end();
    }
  }
}

main().catch((err) => {
  console.error('[migrate-heart] Falha:', err.message || err);
  process.exit(1);
});
