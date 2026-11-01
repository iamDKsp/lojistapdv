import { Client } from 'pg';
import { upgradeTenantSchema } from './tenant-schema-upgrade';

jest.mock('pg', () => ({ Client: jest.fn() }));

describe('Sys-Init: atualização aditiva de recorrências (PostgreSQL)', () => {
  const index = ['recurrenceId', 'recurrenceMonth'].map((columnName) => ({
    name: 'payables_recurrenceId_recurrenceMonth_key',
    columnName,
    nonUnique: 0,
    prefixLength: null,
  }));

  function fixture(
    options: {
      columns?: string[];
      indexes?: object[];
      duplicate?: boolean;
      lock?: boolean | number | null;
      ddlError?: Error;
    } = {},
  ) {
    const connect = jest.fn().mockResolvedValue(undefined);
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('SELECT current_database()'))
        return { rows: [{ name: 'test_tenant' }] };
      if (sql.includes('pg_try_advisory_lock'))
        return {
          rows: [{ acquired: options.lock === undefined ? true : options.lock }],
        };
      if (sql.includes('information_schema.columns'))
        return {
          rows: (options.columns ?? ['id']).map((name) => ({ name })),
        };
      if (sql.includes('FROM pg_class t'))
        return { rows: options.indexes ?? [] };
      if (sql.includes('HAVING COUNT'))
        return { rows: options.duplicate ? [{ duplicate: 1 }] : [] };
      if (
        (sql.startsWith('ALTER TABLE') ||
          sql.startsWith('CREATE UNIQUE INDEX')) &&
        options.ddlError
      ) {
        throw options.ddlError;
      }
      return { rows: [] };
    });
    const end = jest.fn().mockResolvedValue(undefined);
    (Client as unknown as jest.Mock).mockImplementation(() => ({
      connect,
      query,
      end,
    }));
    const push = jest.fn().mockResolvedValue({ stdout: 'ok' });
    const run = () =>
      upgradeTenantSchema('postgresql://unused/test_tenant', push);
    const ddl = () =>
      query.mock.calls
        .map(([sql]) => sql)
        .filter(
          (sql) =>
            sql.startsWith('ALTER TABLE') ||
            sql.startsWith('CREATE UNIQUE INDEX'),
        );
    return { connect, query, end, push, run, ddl };
  }

  it('adiciona colunas opcionais e índice sem reescrever contas antigas', async () => {
    const f = fixture();
    await expect(f.run()).resolves.toEqual({ stdout: 'ok' });
    expect(f.ddl()).toEqual([
      'ALTER TABLE "payables" ADD COLUMN "recurrenceId" VARCHAR(36) NULL, ADD COLUMN "recurrenceMonth" VARCHAR(7) NULL',
      'CREATE UNIQUE INDEX "payables_recurrenceId_recurrenceMonth_key" ON "payables" ("recurrenceId", "recurrenceMonth")',
    ]);
    expect(
      f.query.mock.calls.some(([sql]) =>
        /\b(DELETE|UPDATE|DROP|TRUNCATE)\b/.test(sql),
      ),
    ).toBe(false);
    expect(f.push).toHaveBeenCalledTimes(1);
    expect(f.end).toHaveBeenCalledTimes(1);
  });

  it('bloqueia duplicatas reais antes de alterar o schema ou executar Prisma', async () => {
    const f = fixture({
      columns: ['id', 'recurrenceId', 'recurrenceMonth'],
      duplicate: true,
    });
    await expect(f.run()).rejects.toThrow(
      'Nenhuma conta foi apagada ou alterada',
    );
    expect(f.ddl()).toEqual([]);
    expect(f.push).not.toHaveBeenCalled();
    expect(f.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_unlock(hashtext($1))',
      expect.any(Array),
    );
    expect(f.end).toHaveBeenCalledTimes(1);
  });

  it('valida pares preenchidos antes de adicionar somente o índice', async () => {
    const f = fixture({ columns: ['id', 'recurrenceId', 'recurrenceMonth'] });
    await f.run();
    expect(f.query).toHaveBeenCalledWith(
      expect.stringContaining(
        'WHERE "recurrenceId" IS NOT NULL AND "recurrenceMonth" IS NOT NULL',
      ),
    );
    expect(f.ddl()).toEqual([
      'CREATE UNIQUE INDEX "payables_recurrenceId_recurrenceMonth_key" ON "payables" ("recurrenceId", "recurrenceMonth")',
    ]);
    expect(f.push).toHaveBeenCalledTimes(1);
  });

  it('preserva coluna já existente em atualização parcial', async () => {
    const f = fixture({ columns: ['id', 'recurrenceId'] });
    await f.run();
    expect(f.ddl()[0]).not.toContain('ADD COLUMN "recurrenceId"');
    expect(f.ddl()[0]).toContain('ADD COLUMN "recurrenceMonth"');
  });

  it('não reaplica o índice quando já existe corretamente', async () => {
    const f = fixture({
      columns: ['id', 'recurrenceId', 'recurrenceMonth'],
      indexes: index,
    });
    await f.run();
    expect(f.ddl()).toEqual([]);
    expect(f.push).toHaveBeenCalledTimes(1);
  });

  it.each([
    index.map((row) => ({ ...row, nonUnique: 1 })),
    [...index].reverse(),
    index.map((row) => ({ ...row, prefixLength: 3 })),
  ])('recusa índice inesperado sem removê-lo (%j)', async (...rows) => {
    const f = fixture({ indexes: rows });
    await expect(f.run()).rejects.toThrow('definição inesperada');
    expect(f.ddl()).toEqual([]);
    expect(f.push).not.toHaveBeenCalled();
  });

  it.each([false, 0, null])(
    'recusa execução sem adquirir lock (%s)',
    async (lock) => {
      const f = fixture({ lock });
      await expect(f.run()).rejects.toThrow('já está sendo atualizado');
      expect(f.ddl()).toEqual([]);
      expect(f.push).not.toHaveBeenCalled();
      expect(
        f.query.mock.calls.some(([sql]) =>
          sql.includes('pg_advisory_unlock'),
        ),
      ).toBe(false);
      expect(f.end).toHaveBeenCalledTimes(1);
    },
  );

  it('propaga falha do PostgreSQL ao criar índice sem continuar a atualização', async () => {
    const error = new Error('duplicate key value violates unique constraint');
    const f = fixture({ ddlError: error });
    await expect(f.run()).rejects.toBe(error);
    expect(f.push).not.toHaveBeenCalled();
    expect(f.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_unlock(hashtext($1))',
      expect.any(Array),
    );
    expect(f.end).toHaveBeenCalledTimes(1);
  });

  it('preserva bloqueio do Prisma a outros riscos e libera conexão', async () => {
    const f = fixture();
    const error = new Error('Other data loss warning');
    f.push.mockRejectedValue(error);
    await expect(f.run()).rejects.toBe(error);
    expect(f.push).toHaveBeenCalledTimes(1);
    expect(f.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_unlock(hashtext($1))',
      expect.any(Array),
    );
    expect(f.end).toHaveBeenCalledTimes(1);
  });

  it('delega criação de tabela inexistente ao Prisma', async () => {
    const f = fixture({ columns: [] });
    await f.run();
    expect(f.ddl()).toEqual([]);
    expect(f.push).toHaveBeenCalledTimes(1);
  });
});
