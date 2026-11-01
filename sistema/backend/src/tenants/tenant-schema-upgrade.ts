import { Client } from 'pg';
import { createHash } from 'crypto';

/** Executado somente pelo atualizador Sys-Init. Nunca remove ou reescreve registros. */
export async function upgradeTenantSchema<T>(
  databaseUrl: string,
  pushSchema: () => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  let locked = false;
  let lockName = '';
  try {
    const database = await client.query<{ name: string }>(
      'SELECT current_database() AS name',
    );
    lockName =
      'pdv-schema-' +
      createHash('sha256')
        .update(database.rows[0].name)
        .digest('hex')
        .slice(0, 40);
    const lock = await client.query<{ acquired: boolean | number | null }>(
      'SELECT pg_try_advisory_lock(hashtext($1)) AS acquired',
      [lockName],
    );
    const acquiredVal = lock.rows[0]?.acquired;
    locked = acquiredVal === true || Number(acquiredVal) === 1;
    if (!locked) {
      throw new Error(
        'Este banco já está sendo atualizado. Aguarde a conclusão antes de tentar novamente.',
      );
    }

    const columns = await client.query<{ name: string }>(
      "SELECT column_name AS name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payables'",
    );
    if (columns.rows.length) {
      const names = new Set(columns.rows.map((column) => column.name));
      const indexes = await client.query<{
        name: string;
        nonUnique: number;
        columnName: string | null;
        prefixLength: number | null;
      }>(
        `SELECT
          i.relname AS name,
          CASE WHEN ix.indisunique THEN 0 ELSE 1 END AS "nonUnique",
          a.attname AS "columnName",
          CASE WHEN ix.indexprs IS NOT NULL THEN 1 ELSE NULL END AS "prefixLength"
        FROM pg_class t
        JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_index ix ON ix.indrelid = t.oid
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN unnest(ix.indkey) WITH ORDINALITY AS k(attnum, ord) ON true
        LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
        WHERE n.nspname = 'public' AND t.relname = 'payables'
        ORDER BY i.relname, k.ord`,
      );
      const target = indexes.rows.filter(
        (index) => index.name === 'payables_recurrenceId_recurrenceMonth_key',
      );
      if (
        target.length &&
        !(
          target.length === 2 &&
          target.every(
            (index) =>
              Number(index.nonUnique) === 0 && index.prefixLength == null,
          ) &&
          target[0].columnName === 'recurrenceId' &&
          target[1].columnName === 'recurrenceMonth'
        )
      ) {
        throw new Error(
          'Índice de recorrência com definição inesperada. Nenhum índice foi removido; é necessária revisão deste banco.',
        );
      }
      if (!target.length) {
        if (names.has('recurrenceId') && names.has('recurrenceMonth')) {
          const duplicates = await client.query(
            'SELECT 1 AS duplicate FROM "payables" WHERE "recurrenceId" IS NOT NULL AND "recurrenceMonth" IS NOT NULL GROUP BY "recurrenceId", "recurrenceMonth" HAVING COUNT(*) > 1 LIMIT 1',
          );
          if (duplicates.rows.length) {
            throw new Error(
              'Existem contas a pagar duplicadas para a mesma recorrência e mês. Nenhuma conta foi apagada ou alterada. Revise as duplicidades deste banco antes de atualizar.',
            );
          }
        }
        const additions: string[] = [];
        if (!names.has('recurrenceId'))
          additions.push('ADD COLUMN "recurrenceId" VARCHAR(36) NULL');
        if (!names.has('recurrenceMonth'))
          additions.push('ADD COLUMN "recurrenceMonth" VARCHAR(7) NULL');
        if (additions.length) {
          await client.query(
            'ALTER TABLE "payables" ' + additions.join(', '),
          );
        }
        await client.query(
          'CREATE UNIQUE INDEX "payables_recurrenceId_recurrenceMonth_key" ON "payables" ("recurrenceId", "recurrenceMonth")',
        );
      }
    }
    // Mantém a recusa do Prisma a outros avisos de perda de dados.
    return await pushSchema();
  } finally {
    try {
      if (locked) {
        await client.query('SELECT pg_advisory_unlock(hashtext($1))', [
          lockName,
        ]);
      }
    } finally {
      await client.end();
    }
  }
}
