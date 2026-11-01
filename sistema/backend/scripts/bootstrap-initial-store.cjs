#!/usr/bin/env node
/**
 * Script seguro e repetível para provisionar a primeira loja e o primeiro administrador
 * sem senhas fixas nem usuários de demonstração no código.
 *
 * Variáveis exigidas:
 * - API_BASE_URL (opcional, padrão: http://127.0.0.1:${PORT || 3530}/api)
 * - SETUP_PIN
 * - BOOTSTRAP_TENANT_NAME
 * - BOOTSTRAP_DB_NAME
 * - BOOTSTRAP_ADMIN_NAME
 * - BOOTSTRAP_ADMIN_EMAIL
 * - BOOTSTRAP_ADMIN_PASSWORD
 */

async function main() {
  const port = process.env.PORT || '3530';
  const apiBase = (
    process.env.API_BASE_URL || `http://127.0.0.1:${port}/api`
  ).replace(/\/$/, '');
  const pin = process.env.SETUP_PIN;
  const tenantName = process.env.BOOTSTRAP_TENANT_NAME;
  const dbName = process.env.BOOTSTRAP_DB_NAME;
  const adminName = process.env.BOOTSTRAP_ADMIN_NAME;
  const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  const missing = [
    ['SETUP_PIN', pin],
    ['BOOTSTRAP_TENANT_NAME', tenantName],
    ['BOOTSTRAP_DB_NAME', dbName],
    ['BOOTSTRAP_ADMIN_NAME', adminName],
    ['BOOTSTRAP_ADMIN_EMAIL', adminEmail],
    ['BOOTSTRAP_ADMIN_PASSWORD', adminPassword],
  ]
    .filter(([, val]) => !val || !String(val).trim())
    .map(([key]) => key);

  if (missing.length > 0) {
    console.error(
      `[bootstrap-store] Variáveis obrigatórias ausentes: ${missing.join(', ')}`,
    );
    process.exit(1);
  }

  const listRes = await fetch(`${apiBase}/tenants/setup/list`, {
    headers: { 'x-setup-pin': pin },
  });
  if (!listRes.ok) {
    throw new Error(
      `Falha ao consultar lojas existentes (${listRes.status}): ${await listRes.text()}`,
    );
  }
  const tenants = await listRes.json();
  const exists = Array.isArray(tenants)
    ? tenants.find(
        (t) =>
          t.databaseName === dbName ||
          (t.name && t.name.toLowerCase() === tenantName.toLowerCase()),
      )
    : null;

  if (exists) {
    console.log(
      `[bootstrap-store] Loja "${exists.name}" (${exists.databaseName}) já existe (id=${exists.id}). Nada a alterar.`,
    );
    return;
  }

  const provRes = await fetch(`${apiBase}/tenants/provision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pin,
      tenantName,
      dbName,
      adminName,
      adminEmail,
      adminPassword,
      seedProducts: true,
    }),
  });

  const body = await provRes.json().catch(() => ({}));
  if (!provRes.ok) {
    throw new Error(
      `Falha ao provisionar loja (${provRes.status}): ${body.message || JSON.stringify(body)}`,
    );
  }

  console.log(
    `[bootstrap-store] Loja provisionada com sucesso: ${body.tenant?.name} (${body.tenant?.databaseName}) — Admin: ${body.tenant?.admin?.email}`,
  );
}

main().catch((err) => {
  console.error('[bootstrap-store] Erro:', err.message || err);
  process.exit(1);
});
