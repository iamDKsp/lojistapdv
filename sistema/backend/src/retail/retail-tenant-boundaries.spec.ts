import { TenantContextService } from '../prisma/tenant-context.service';
import { RetailController } from './retail.controller';
import { TenantsController } from '../tenants/tenants.controller';

describe('fronteiras de acesso da versão lojista', () => {
  it('mantém dois contextos de tenant separados durante trabalho assíncrono', async () => {
    const ctx = new TenantContextService();
    const results = await Promise.all(
      ['A', 'B'].map((tenantId) =>
        ctx.run(
          { tenantId, databaseUrl: `mysql://${tenantId}`, userId: 'user' },
          async () => {
            await new Promise((resolve) =>
              setTimeout(resolve, tenantId === 'A' ? 5 : 1),
            );
            return ctx.get();
          },
        ),
      ),
    );
    expect(results.map((result) => result.databaseUrl)).toEqual([
      'mysql://A',
      'mysql://B',
    ]);
    expect(() => ctx.get()).toThrow();
  });
  it('estoquista pode editar a grade mas não emitir crédito', () => {
    const catalog: any = { save: jest.fn() };
    const returns: any = { create: jest.fn() };
    const controller = new RetailController(catalog, returns, {} as any);
    controller.create({ user: { role: 'stockist' } }, {});
    expect(catalog.save).toHaveBeenCalled();
    expect(() =>
      controller.createReturn({ user: { role: 'stockist' } }, {}),
    ).toThrow('permissão');
    expect(returns.create).not.toHaveBeenCalled();
  });
  it('usuário de loja não pode listar todos os clientes SaaS', () => {
    const service: any = { findAll: jest.fn() };
    const controller = new TenantsController(service, {} as any);
    expect(() =>
      controller.findAll({ user: { role: 'admin', tenantId: 'A' } }),
    ).toThrow();
    expect(service.findAll).not.toHaveBeenCalled();
  });
  it('admin da loja não altera nem troca a logo de outro tenant', () => {
    const service: any = { updateTenant: jest.fn() };
    const controller = new TenantsController(service, {} as any);
    expect(() =>
      controller.updateTenant(
        { user: { role: 'admin', tenantId: 'A' } },
        'B',
        {},
      ),
    ).toThrow();
    expect(service.updateTenant).not.toHaveBeenCalled();
    controller.updateTenant(
      { user: { role: 'admin', tenantId: 'A' } },
      'A',
      {},
    );
    expect(service.updateTenant).toHaveBeenCalledWith('A', {});
  });
});
