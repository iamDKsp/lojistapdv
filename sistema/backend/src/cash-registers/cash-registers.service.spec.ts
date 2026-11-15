import { Test, TestingModule } from '@nestjs/testing';
import { CashRegistersService } from './cash-registers.service';
import { TenantConnectionManager } from '../prisma/tenant-prisma.service';
import { TenantContextService } from '../prisma/tenant-context.service';
import { JwtService } from '@nestjs/jwt';

describe('CashRegistersService', () => {
  let service: CashRegistersService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      cashRegister: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CashRegistersService,
        {
          provide: TenantConnectionManager,
          useValue: { getTenantClient: jest.fn().mockResolvedValue(mockPrisma) },
        },
        {
          provide: TenantContextService,
          useValue: {
            get: () => ({ tenantId: 'tenant-1', databaseUrl: 'postgres://t1' }),
          },
        },
        { provide: JwtService, useValue: {} },
      ],
    }).compile();

    service = module.get<CashRegistersService>(CashRegistersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('calcula expectedCash e diffCash com precisão decimal na listagem de caixas', async () => {
    mockPrisma.cashRegister.findMany.mockResolvedValue([
      {
        id: 'reg-1',
        code: 10,
        status: 'closed',
        openingValue: 100,
        closingValue: 175.5,
        closingDetails: null,
        sales: [
          {
            total: 120.5,
            payments: [
              { method: 'dinheiro', value: 80.5 },
              { method: 'pix', value: 40 },
            ],
          },
        ],
        movements: [
          { type: 'IN', value: 20 },
          { type: 'OUT', value: 15 },
        ],
      },
      {
        id: 'reg-2',
        code: 11,
        status: 'open',
        openingValue: 50,
        closingValue: null,
        closingDetails: null,
        sales: [],
        movements: [],
      },
    ]);

    const list = await service.findAll();
    expect(list[0]).toMatchObject({
      id: 'reg-1',
      totalSales: 120.5,
      salesCount: 1,
      totalCashSales: 80.5,
      totalDigitalSales: 40,
      totalSuprimentos: 20,
      totalSangrias: 15,
      expectedCash: 185.5,
      diffCash: -10,
    });
    expect(list[1]).toMatchObject({
      id: 'reg-2',
      expectedCash: 50,
      diffCash: null,
    });
  });
});
