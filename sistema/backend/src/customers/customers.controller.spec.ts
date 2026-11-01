import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

describe('CustomersController', () => {
  let controller: CustomersController;
  let service: Record<string, jest.Mock>;

  beforeEach(async () => {
    service = {
      findAll: jest.fn().mockResolvedValue([]),
      findByPhone: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'c1' }),
      update: jest.fn().mockResolvedValue({ id: 'c1' }),
      getInsights: jest.fn().mockResolvedValue({ summary: {}, customers: [] }),
      getProfile: jest.fn().mockResolvedValue({ customer: { id: 'c1' } }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomersController],
      providers: [{ provide: CustomersService, useValue: service }],
    }).compile();

    controller = module.get<CustomersController>(CustomersController);
  });

  it('restringe insights, perfil 360 e edição a administradores', async () => {
    expect(() =>
      controller.getInsights({ user: { role: 'operator' } }, {}),
    ).toThrow(ForbiddenException);
    expect(() =>
      controller.getProfile({ user: { role: 'stockist' } }, 'c1'),
    ).toThrow(ForbiddenException);
    expect(() =>
      controller.update({ user: { role: 'operator' } }, 'c1', {}),
    ).toThrow(ForbiddenException);

    await controller.getInsights({ user: { role: 'admin' } }, { segment: 'vip' });
    expect(service.getInsights).toHaveBeenCalledWith({ segment: 'vip' });
  });
});
