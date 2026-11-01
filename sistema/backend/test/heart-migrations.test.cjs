// Integration regression: opt in with an explicitly local disposable PostgreSQL URL.
// Never loads .env or uses DATABASE_URL_HEART / customer databases.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const testUrl = process.env.HEART_MIGRATION_TEST_URL;
const migrationsRoot = path.join(__dirname, '..', 'prisma', 'heart-migrations');
const readMigration = (folder) => fs.readFileSync(path.join(migrationsRoot, folder, 'migration.sql'), 'utf8');
const initial = readMigration('20261101000000_init_postgresql');
const incrementals = fs.readdirSync(migrationsRoot)
  .filter((folder) => folder !== '20261101000000_init_postgresql' && fs.existsSync(path.join(migrationsRoot, folder, 'migration.sql')))
  .sort().map(readMigration);
// Snapshot of the canonical financial schema that already existed at the failed deploy.
const integration = fs.readFileSync(path.join(__dirname, 'fixtures', 'heart-financial-existing.sql'), 'utf8');

async function withDisposableSchema(run) {
  const url = new URL(testUrl);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Tests require a local disposable PostgreSQL instance');
  const { Client } = require('pg');
  const client = new Client({ connectionString: testUrl });
  const schema = `heart_migration_test_${randomUUID().replaceAll('-', '')}`;
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    await run(client, schema);
  } finally {
    try {
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      await client.end();
    }
  }
}

async function assertCanonicalColumns(client, schema) {
  const result = await client.query(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = $1 AND table_name IN ('tenant_invoices', 'webhook_outbox')`, [schema]);
  const columns = new Set(result.rows.map((row) => `${row.table_name}.${row.column_name}`));
  for (const expected of ['tenant_invoices.tenant_id', 'tenant_invoices.amount', 'tenant_invoices.created_at', 'tenant_invoices.updated_at', 'webhook_outbox.created_at', 'webhook_outbox.updated_at']) {
    assert.ok(columns.has(expected), `Missing ${expected}`);
  }
  for (const legacy of ['tenant_invoices.tenantId', 'tenant_invoices.amount_cents', 'tenant_invoices.createdAt', 'webhook_outbox.entity_external_id', 'webhook_outbox.createdAt']) {
    assert.ok(!columns.has(legacy), `Unexpected obsolete column ${legacy}`);
  }
}

test('fresh Heart applies incremental migrations repeatedly without schema conflicts', { skip: !testUrl }, async () => {
  await withDisposableSchema(async (client, schema) => {
    await client.query(initial);
    for (let attempt = 0; attempt < 2; attempt++) {
      for (const sql of incrementals) await client.query(sql);
    }
    await assertCanonicalColumns(client, schema);
  });
});

test('existing canonical Heart preserves invoice, outbox, and payment data on repeated startup migration', { skip: !testUrl }, async () => {
  await withDisposableSchema(async (client, schema) => {
    await client.query(initial);
    await client.query(integration);
    await client.query(`INSERT INTO tenants (id, database_name, database_url, "updatedAt") VALUES ('test-store', 'test_store', 'postgresql://example.invalid/test', CURRENT_TIMESTAMP)`);
    await client.query(`INSERT INTO tenant_invoices (id, external_id, tenant_id, reference_month, due_date, amount, status, notes)
      VALUES ('test-invoice', 'test-invoice-external', 'test-store', '2026-11', '2026-11-10', 19990, 'paid', 'preserve invoice')`);
    await client.query(`INSERT INTO webhook_outbox (id, event_id, event_type, tenant_id, invoice_id, payload, status, attempts)
      VALUES ('test-outbox', 'test-event', 'invoice.upsert', 'test-store', 'test-invoice', '{"amount":19990}', 'delivered', 3)`);
    await client.query(`INSERT INTO payment_logs (id, "tenantId", valor, "vencimentoAntes", "vencimentoApos", invoice_id)
      VALUES ('test-payment', 'test-store', 199.90, '2026-11-10', '2026-12-10', 'test-invoice')`);
    const snapshot = async () => {
      const rows = [];
      for (const table of ['tenant_invoices', 'webhook_outbox', 'payment_logs']) {
        rows.push((await client.query(`SELECT * FROM "${table}" ORDER BY id`)).rows);
      }
      return rows;
    };
    const before = await snapshot();
    for (let attempt = 0; attempt < 2; attempt++) {
      for (const sql of incrementals) await client.query(sql);
    }
    assert.deepEqual(await snapshot(), before);
    await assertCanonicalColumns(client, schema);
  });
});
