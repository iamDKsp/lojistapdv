import { Client } from 'pg';
import { createHash } from 'crypto';
import { ImagePackageStore } from './product-image-package';

export const safeDatabase = (name: string) => {
  if (!/^[a-zA-Z0-9_]{1,64}$/.test(name)) throw Error('INVALID_DATABASE_NAME');
  return '"' + name + '"';
};
export const assertImageId = (id: string) => {
  if (
    typeof id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  )
    throw Error('INVALID_ID');
};

export interface ImageTenantClients {
  heartClient: Client;
  tenantClient: Client;
  databaseName: string;
  heartName: string;
  end: () => Promise<void>;
}

/** Exact tenant from Heart, same PostgreSQL instance, no schema updates or application startup. */
export async function connectImageTenant(
  tenantId: string,
): Promise<ImageTenantClients> {
  assertImageId(tenantId);
  if (!process.env.DATABASE_URL_HEART)
    throw Error('DATABASE_URL_HEART_REQUIRED');
  const url = new URL(process.env.DATABASE_URL_HEART);
  const heartName = decodeURIComponent(url.pathname.slice(1));
  safeDatabase(heartName);

  const heartClient = new Client({
    connectionString: process.env.DATABASE_URL_HEART,
    connectionTimeoutMillis: 5000,
    statement_timeout: 8000,
    lock_timeout: 5000,
  });
  await heartClient.connect();
  let tenantClient: Client | null = null;
  try {
    const { rows } = await heartClient.query<{
      id: string;
      database_name: string;
      database_url: string;
    }>('SELECT id, database_name, database_url FROM tenants WHERE id = $1', [
      tenantId,
    ]);
    if (rows.length !== 1) throw Error('TENANT_NOT_FOUND');
    const tenant = rows[0];
    const tenantUrl = new URL(tenant.database_url);
    safeDatabase(tenant.database_name);
    if (
      tenantUrl.hostname !== url.hostname ||
      Number(tenantUrl.port || 5432) !== Number(url.port || 5432) ||
      decodeURIComponent(tenantUrl.pathname.slice(1)) !== tenant.database_name
    ) {
      throw Error('CROSS_SERVER_OR_DATABASE_MISMATCH');
    }

    tenantClient = new Client({
      connectionString: tenant.database_url,
      connectionTimeoutMillis: 5000,
      statement_timeout: 8000,
      lock_timeout: 5000,
    });
    await tenantClient.connect();

    const [heartTable, tenantTable] = await Promise.all([
      heartClient.query(
        "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'images'",
      ),
      tenantClient.query(
        "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products'",
      ),
    ]);
    if (heartTable.rows.length !== 1 || tenantTable.rows.length !== 1) {
      throw Error('TRANSACTIONAL_TABLES_REQUIRED');
    }

    return {
      heartClient,
      tenantClient,
      databaseName: tenant.database_name,
      heartName,
      end: async () => {
        await Promise.allSettled([tenantClient?.end(), heartClient.end()]);
      },
    };
  } catch (error) {
    await Promise.allSettled([tenantClient?.end(), heartClient.end()]);
    throw error;
  }
}

export function mysqlImageStore(
  db: ImageTenantClients,
  dryRun: boolean,
): ImagePackageStore {
  return {
    begin: async () => {
      const cmd = dryRun ? 'BEGIN READ ONLY' : 'BEGIN';
      await db.heartClient.query(cmd);
      await db.tenantClient.query(cmd);
    },
    commit: async () => {
      await db.tenantClient.query('COMMIT');
      await db.heartClient.query('COMMIT');
    },
    rollback: async () => {
      await Promise.allSettled([
        db.tenantClient.query('ROLLBACK'),
        db.heartClient.query('ROLLBACK'),
      ]);
    },
    productImage: async (id) => {
      const { rows } = await db.tenantClient.query<{ imageUrl: string | null }>(
        `SELECT "imageUrl" FROM products WHERE id = $1${dryRun ? '' : ' FOR UPDATE'}`,
        [id],
      );
      return rows[0]?.imageUrl ?? undefined;
    },
    imageInfo: async (id) => {
      const { rows } = await db.heartClient.query<{
        data: Buffer;
        bytes: number;
      }>(
        `SELECT data, OCTET_LENGTH(data) AS bytes FROM images WHERE id = $1${dryRun ? '' : ' FOR SHARE'}`,
        [id],
      );
      const row = rows[0];
      if (!row) return undefined;
      const hash = createHash('sha256').update(row.data).digest('hex');
      return { hash, bytes: Number(row.bytes) };
    },
    insertImage: async (id, data) => {
      if (dryRun) throw Error('READ_ONLY_RUN');
      await db.heartClient.query(
        'INSERT INTO images (id, data, "mimeType", "createdAt") VALUES ($1, $2, \'image/webp\', CURRENT_TIMESTAMP)',
        [id, data],
      );
    },
    compareAndSwap: async (id, expected, replacement) => {
      if (dryRun) throw Error('READ_ONLY_RUN');
      const result = await db.tenantClient.query(
        'UPDATE products SET "imageUrl" = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2 AND "imageUrl" = $3',
        [replacement, id, expected],
      );
      return result.rowCount === 1;
    },
  };
}
