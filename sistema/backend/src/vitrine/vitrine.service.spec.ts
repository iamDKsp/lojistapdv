import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { VitrineService } from './vitrine.service';

describe('VitrineService', () => {
  let service: VitrineService;
  let heartPrisma: any;
  let tenantManager: any;
  let tenantContext: any;
  let tenantClient: any;

  beforeEach(() => {
    tenantClient = {
      vitrineConfig: {
        findFirst: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      retailGroup: {
        findMany: jest.fn(),
      },
      product: {
        findMany: jest.fn(),
      },
      category: {
        findMany: jest.fn(),
      },
    };

    heartPrisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tenant-1',
          name: 'Loja Centro',
          nomeFantasia: 'Boutique Centro',
          tvPublicId: 'TVLOJA01',
          status: 'active',
          logoUrl: '/api/tenants/uploads/logos/logo1.png',
          databaseUrl: 'postgresql://local/tenant1',
          modulos: { vitrineDigital: true, estoque: true },
        }),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    tenantManager = {
      getTenantClient: jest.fn().mockResolvedValue(tenantClient),
    };

    tenantContext = {
      get: jest.fn().mockReturnValue({
        tenantId: 'tenant-1',
        databaseUrl: 'postgresql://local/tenant1',
        userId: 'user-1',
      }),
    };

    service = new VitrineService(heartPrisma, tenantManager, tenantContext);
  });

  it('recusa acesso quando o módulo vitrineDigital está desabilitado para a loja', async () => {
    heartPrisma.tenant.findUnique.mockResolvedValueOnce({
      id: 'tenant-1',
      name: 'Loja Centro',
      status: 'active',
      modulos: { vitrineDigital: false },
    });

    await expect(service.getConfig()).rejects.toThrow(ForbiddenException);
  });

  it('orienta atualizar bancos no /sys-init se a tabela vitrine_config não existir (P2021)', async () => {
    tenantClient.vitrineConfig.findFirst.mockRejectedValueOnce({
      code: 'P2021',
      message: 'The table `public.vitrine_config` does not exist',
    });

    await expect(service.getConfig()).rejects.toThrow(BadRequestException);
  });

  it('desempacota logoPosition, instagramHandle, gridSlideDuration e storeTagline com segurança', () => {
    const raw = JSON.stringify({
      position: 'top-right',
      instagram: '@boutiquecentro',
      gridSlideDuration: 20,
      storeTagline: 'Moda Masculina & Calçados',
    });
    const parsed = service.parseLogoPosition(raw);
    expect(parsed).toEqual({
      position: 'top-right',
      instagram: '@boutiquecentro',
      gridSlideDuration: 20,
      storeTagline: 'Moda Masculina & Calçados',
    });
  });

  it('unifica RetailGroup (com tamanhos/cores ordenados) e Product avulso no catálogo da vitrine', async () => {
    tenantClient.retailGroup.findMany.mockResolvedValueOnce([
      {
        id: 'grp-1',
        name: 'Camiseta Peruana Pima',
        categoryId: 'cat-1',
        category: { id: 'cat-1', name: 'Camisetas' },
        imageUrl: '/foto-camiseta.png',
        priceSell: 89.9,
        variants: [
          { size: 'GG', color: 'Preta', stock: 3, active: true },
          { size: 'P', color: 'Branca', stock: 5, active: true },
          { size: 'M', color: 'Preta', stock: 2, active: true },
          { size: 'G', color: 'Sortida', stock: 0, active: true },
        ],
      },
    ]);
    tenantClient.product.findMany.mockResolvedValueOnce([
      {
        id: 'prod-avulso',
        name: 'Cinto Couro Legítimo',
        categoryId: 'cat-2',
        category: { id: 'cat-2', name: 'Acessórios' },
        imageUrl: '/foto-cinto.png',
        priceSell: 59.9,
        stock: 4,
        size: 'Único',
        color: 'Café',
      },
    ]);
    tenantClient.category.findMany.mockResolvedValueOnce([
      { id: 'cat-1', name: 'Camisetas' },
      { id: 'cat-2', name: 'Acessórios' },
    ]);

    const catalog = await service.getCatalog();
    expect(catalog.items).toHaveLength(2);

    const groupItem = catalog.items.find((i) => i.kind === 'group')!;
    expect(groupItem.name).toBe('Camiseta Peruana Pima');
    expect(groupItem.sizesAvailable).toEqual(['P', 'M', 'GG']);
    expect(groupItem.colorsAvailable).toEqual(['Preta', 'Branca']);
    expect(groupItem.stock).toBe(10);
  });

  it('salva rascunho e publica incrementando a versão monotonicamente', async () => {
    const existingRow = {
      id: 'singleton',
      active: false,
      version: 2,
      theme: 'dark_premium',
      showLogo: true,
      logoPosition: JSON.stringify({
        position: 'top-left',
        instagram: '@loja',
        gridSlideDuration: 15,
      }),
      slideDuration: 8,
      draftSlides: [
        {
          slideType: 'single',
          productId: 'group:grp-1',
          productName: 'Camiseta Peruana Pima',
          imageUrl: '/foto.png',
          priceSell: 89.9,
          promoPrice: 69.9,
          badge: 'OFERTA',
          sizesAvailable: ['P', 'M', 'G'],
          order: 1,
        },
      ],
      publishedSlides: [],
    };

    tenantClient.vitrineConfig.findFirst.mockResolvedValue(existingRow);
    tenantClient.vitrineConfig.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...existingRow, ...data }),
    );

    const published = await service.publish({
      userId: 'user-1',
      userName: 'Maria Admin',
    });

    expect(published.active).toBe(true);
    expect(published.version).toBe(3);
    expect(published.publishedByName).toBe('Maria Admin');
    expect(published.publishedSlides).toHaveLength(1);
    expect(published.publishedSlides[0].promoPrice).toBe(69.9);
  });

  it('retorna playlist pública pelo tvPublicId quando ativa e lança 404 para código inexistente', async () => {
    heartPrisma.tenant.findFirst.mockResolvedValueOnce({
      id: 'tenant-1',
      name: 'Boutique Centro',
      nomeFantasia: 'Boutique Centro',
      databaseUrl: 'postgresql://local/tenant1',
      status: 'active',
      tvPublicId: 'TVLOJA01',
      logoUrl: '/logo.png',
      modulos: { vitrineDigital: true },
    });

    tenantClient.vitrineConfig.findFirst.mockResolvedValueOnce({
      id: 'singleton',
      active: true,
      version: 5,
      theme: 'purple_luxury',
      customBgUrl: null,
      showLogo: true,
      logoPosition: JSON.stringify({
        position: 'top-left',
        instagram: '@boutiquecentro',
        gridSlideDuration: 18,
        storeTagline: 'Moda & Estilo',
      }),
      slideDuration: 10,
      publishedSlides: [
        {
          slideType: 'single',
          productId: 'group:1',
          productName: 'Tênis Casual Urbano',
          imageUrl: '/tenis.png',
          priceSell: 199.9,
          promoPrice: 159.9,
          badge: 'OFERTA',
          sizesAvailable: ['38', '39', '40', '41', '42'],
          order: 1,
        },
      ],
    });

    const playlist = await service.getPublicPlaylist('tvloja01');
    expect(playlist.active).toBe(true);
    expect(playlist.version).toBe(5);
    expect(playlist.storeName).toBe('Boutique Centro');
    expect(playlist.instagramHandle).toBe('@boutiquecentro');
    expect(playlist.gridSlideDuration).toBe(18);
    expect(playlist.slides).toHaveLength(1);

    heartPrisma.tenant.findFirst.mockResolvedValueOnce(null);
    await expect(service.getPublicPlaylist('NAOEXISTE')).rejects.toThrow(
      NotFoundException,
    );
  });
});
