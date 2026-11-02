// Concurrency, SQL migration idempotency, and runtime DDL safety checks for StorefrontModule.
// Never loads .env or connects to customer databases.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const root = path.join(__dirname, '..');
const testUrl = process.env.HEART_MIGRATION_TEST_URL;

test('storefront Heart and Tenant SQL migrations are idempotent and non-destructive', () => {
  const heartSql = fs.readFileSync(
    path.join(root, 'prisma', 'heart-migrations', '20261101180000_storefront_registry', 'migration.sql'),
    'utf8',
  );
  const tenantSql = fs.readFileSync(
    path.join(root, 'prisma', 'migrations', '20261101180000_storefront_module', 'migration.sql'),
    'utf8',
  );

  for (const [label, sql] of [['heart', heartSql], ['tenant', tenantSql]]) {
    assert.doesNotMatch(sql, /\bDROP\s+(?:TABLE|COLUMN|INDEX|SCHEMA)\b/i, `${label} migration must not drop objects`);
    assert.doesNotMatch(sql, /\bTRUNCATE\b/i, `${label} migration must not truncate tables`);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS/i, `${label} migration must use CREATE TABLE IF NOT EXISTS`);
  }

  assert.match(heartSql, /"storefront_registry"/);
  assert.match(tenantSql, /"storefront_settings"/);
  assert.match(tenantSql, /"storefront_revisions"/);
  assert.match(tenantSql, /"storefront_categories"/);
  assert.match(tenantSql, /"storefront_products"/);
  assert.match(tenantSql, /"storefront_orders"/);
  assert.match(tenantSql, /"storefront_order_items"/);
  assert.match(tenantSql, /"stock_reservations"/);
  assert.match(tenantSql, /"storefront_order_events"/);
});

test('storefront runtime services never execute DDL on boot or GET requests', () => {
  const storefrontDir = path.join(root, 'src', 'storefront');
  const files = fs.readdirSync(storefrontDir).filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'));
  const ddlPattern = /\b(?:CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE|CREATE\s+INDEX)\b/i;

  for (const file of files) {
    const content = fs.readFileSync(path.join(storefrontDir, file), 'utf8');
    assert.doesNotMatch(content, ddlPattern, `Runtime service ${file} must not execute DDL`);
  }
});

test('PostgreSQL SELECT FOR UPDATE serializes 5 concurrent reservations for 1 unit in disposable schema', { skip: !testUrl }, async () => {
  const url = new URL(testUrl);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Tests require a local disposable PostgreSQL instance');
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: testUrl, max: 6 });
  const schema = `storefront_conc_${randomUUID().replaceAll('-', '')}`;

  const setupClient = await pool.connect();
  try {
    await setupClient.query(`CREATE SCHEMA "${schema}"`);
    await setupClient.query(`
      CREATE TABLE "${schema}"."Product" (
        "id" TEXT PRIMARY KEY,
        "stock" DECIMAL(65,30) NOT NULL DEFAULT 0
      );
      CREATE TABLE "${schema}"."StockReservation" (
        "id" TEXT PRIMARY KEY,
        "productId" TEXT NOT NULL REFERENCES "${schema}"."Product"("id") ON DELETE RESTRICT,
        "quantity" INTEGER NOT NULL,
        "status" TEXT NOT NULL,
        "expiresAt" TIMESTAMPTZ NOT NULL
      );
      INSERT INTO "${schema}"."Product" ("id", "stock") VALUES ('prod-1', 1);
    `);

    const attemptReservation = async (idx) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const locked = await client.query(
          `SELECT "id", "stock" FROM "${schema}"."Product" WHERE "id" = $1 FOR UPDATE`,
          ['prod-1'],
        );
        const physicalStock = Number(locked.rows[0].stock);
        const reserved = await client.query(
          `SELECT COALESCE(SUM("quantity"), 0) AS total FROM "${schema}"."StockReservation"
           WHERE "productId" = $1 AND "status" = 'ACTIVE' AND "expiresAt" > NOW()`,
          ['prod-1'],
        );
        const activeReserved = Number(reserved.rows[0].total);
        if (physicalStock - activeReserved < 1) {
          await client.query('ROLLBACK');
          return { ok: false, idx };
        }
        await client.query(
          `INSERT INTO "${schema}"."StockReservation" ("id", "productId", "quantity", "status", "expiresAt")
           VALUES ($1, 'prod-1', 1, 'ACTIVE', NOW() + INTERVAL '30 minutes')`,
          [`res-${idx}`],
        );
        await client.query('COMMIT');
        return { ok: true, idx };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    };

    const results = await Promise.all([1, 2, 3, 4, 5].map(attemptReservation));
    const winners = results.filter((r) => r.ok);
    const losers = results.filter((r) => !r.ok);
    assert.equal(winners.length, 1, 'Exactly 1 concurrent reservation must win');
    assert.equal(losers.length, 4, 'Exactly 4 concurrent reservations must be rejected');
  } finally {
    try {
      await setupClient.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      setupClient.release();
      await pool.end();
    }
  }
});
