const fs=require('fs');const path=require('path');
const root=path.resolve(__dirname,'../sistema');
function edit(file,from,to){const p=path.join(root,file);const text=fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');if(text.includes(to))return;if(!text.includes(from))throw new Error('Trecho não encontrado: '+file+' '+from.slice(0,70));fs.writeFileSync(p,text.replace(from,to));}
edit('backend/src/sales/sales.service.ts',"import { Prisma } from '@prisma/client';","import { Prisma } from '@prisma/client';\nimport { redeemStoreCredits, restoreStoreCredits } from '../retail/store-credit.rules';");
edit('backend/src/sales/sales.service.ts','  async checkout(data: any) {',`  async checkout(data: any) {
    if (data.comandaId || data.consumedByOperatorId || data.items?.some((i: any) => i.modifiers?.length)) throw new BadRequestException('Esta operação de atendimento não faz parte do PDV Lojista.');
    if (!Array.isArray(data.items) || !data.items.length || !Array.isArray(data.payments) || !data.payments.length) throw new BadRequestException('Informe itens e pagamentos.');
    if (data.items.some((i: any) => !i.productId || !Number.isInteger(Number(i.quantity)) || Number(i.quantity) <= 0 || !Number.isFinite(Number(i.priceUnit)) || Number(i.priceUnit) < 0)) throw new BadRequestException('Itens ou quantidades inválidos.');
    if (data.payments.some((p: any) => !p.method || !Number.isFinite(Number(p.value)) || Number(p.value) <= 0 || Number(p.troco || 0) < 0)) throw new BadRequestException('Pagamentos inválidos.');
    if (!Number.isFinite(Number(data.discount || 0)) || Number(data.discount || 0) < 0) throw new BadRequestException('Desconto inválido.');`);
edit('backend/src/sales/sales.service.ts','      const productMap = new Map(productsInDb.map((p: any) => [p.id, p]));',`      if (productsInDb.length !== allProductIds.length || productsInDb.some((p: any) => !p.active || p.isComposite || p.requiresKitchen || p.requiresBar || p.requiresCarvoaria)) throw new BadRequestException('Um item está inativo ou não é uma mercadoria de loja.');
      const productMap = new Map(productsInDb.map((p: any) => [p.id, p]));`);
edit('backend/src/sales/sales.service.ts','      let addition = new Prisma.Decimal(0);',`      if (total.lte(0) || paymentsTotal.sub(total).abs().gt(0.01)) throw new BadRequestException('Os pagamentos devem corresponder ao total da venda após o desconto.');
      let addition = new Prisma.Decimal(0);`);
edit('backend/src/sales/sales.service.ts','      // ─── Processar itens da COMANDA',`      await redeemStoreCredits(tx, data.payments, sale.id, data.customerId);

      // ─── Processar itens da COMANDA`);
edit('backend/src/sales/sales.service.ts',"    const sale = await prisma.$transaction(async (tx: any) => {\n      const existingSale",`    const sale = await prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw\`INSERT INTO tenant_settings (id) VALUES ('singleton') ON DUPLICATE KEY UPDATE id = 'singleton'\`;
      await tx.$queryRaw\`SELECT id FROM sales WHERE id = \${saleId} FOR UPDATE\`;
      if (await tx.retailReturn.count({ where: { saleId } })) throw new BadRequestException('Esta venda já possui troca. Não é possível cancelar e devolver estoque novamente.');
      const existingSale`);
edit('backend/src/sales/sales.service.ts','      // Estornar cada item consumido de volta aos lotes e produtos',`      await lockProducts(tx, existingSale.items.map((i: any) => i.productId));
      await restoreStoreCredits(tx, saleId);
      // Estornar cada item consumido de volta aos lotes e produtos`);
edit('backend/src/sales/sales.service.ts',"  async updatePayments(saleId: string, payments: { method: string; value: number; tPag?: string }[]) {\n    const prisma = await this.getPrisma();",`  async updatePayments(saleId: string, payments: { method: string; value: number; tPag?: string }[]) {
    const prisma = await this.getPrisma();
    if (payments.some(p => p.method === 'credito_loja') || await prisma.storeCreditUse.count({ where: { saleId } })) throw new BadRequestException('Pagamentos com crédito da loja não podem ser editados. Cancele a venda para restituir o saldo.');`);
edit('backend/src/products/products.service.ts',"import { productImageOptimizer }",`import { assertRetailProduct } from '../retail/retail.rules';
import { productImageOptimizer }`);
edit('backend/src/products/products.service.ts','  async create(data: ProductCreateDto) {','  async create(data: ProductCreateDto) {\n    assertRetailProduct(data);');
edit('backend/src/products/products.service.ts','  async update(id: string, data: ProductUpdateDto) {','  async update(id: string, data: ProductUpdateDto) {\n    assertRetailProduct(data);');
edit('backend/src/products/products.service.ts',"    if (!oldProduct) throw new NotFoundException('Produto não encontrado.');",`    if (!oldProduct) throw new NotFoundException('Produto não encontrado.');
    if (oldProduct.retailGroupId && ['name', 'priceSell', 'imageUrl', 'categoryId'].some(key => data[key] !== undefined && String(data[key] ?? '') !== String(oldProduct[key] ?? ''))) throw new BadRequestException('Altere nome, foto, categoria e preço no grupo de mercadorias para manter a grade consistente.');`);
// Inclui o grupo para agrupamento no PDV e no cache offline.
edit('backend/src/products/products.service.ts','          category: true, \n          grupoTributacao: true,','          category: true,\n          retailGroup: true,\n          grupoTributacao: true,');
edit('backend/src/integrations/integrations.service.ts','  async syncProductStock(tenantId: string, productIds: string[], throwOnError = false) {','  async syncProductStock(tenantId: string, productIds: string[], throwOnError = false) {\n    // Adaptador legado preservado para os consumidores; nenhum catálogo de loja vai para o iFood.\n    return;');
edit('backend/src/integrations/integrations.module.ts','  controllers: [IntegrationsController],','  controllers: [],');
edit('backend/src/auth/jwt.strategy.ts',"    if (payload.type === 'station-session') {","    if (payload.type === 'station-session') {\n      throw new UnauthorizedException('Credenciais de cozinha e salão não são aceitas pelo PDV Lojista.');");
edit('backend/src/auth/station-access.service.ts',"if ((await this.config(user.tenantId)).isolated) {","if (true) { // Lojista: checkout e abertura sempre identificam o operador por PIN.");
// Remove o catálogo padrão de bebidas; apenas categorias genéricas, sem estoque ou NCM inventados.
const tenants=path.join(root,'backend/src/tenants/tenants.service.ts');let source=fs.readFileSync(tenants,'utf8');
const start=source.indexOf('  private async seedTenantProducts('),end=source.indexOf('  async setDiscountPin(',start);
if(start<0||end<0)throw new Error('Seed padrão não encontrado');
source=source.slice(0,start)+`  private async seedTenantProducts(databaseUrl: string) {
    const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    try {
      for (const name of ['Camisetas', 'Calçados', 'Bonés', 'Relógios', 'Acessórios']) await client.category.upsert({ where: { name }, create: { name }, update: {} });
    } finally { await client.$disconnect(); }
  }

`+source.slice(end);
source=source.replaceAll('Adega Modelo','Loja Modelo').replaceAll('demo_adega','demo_lojista').replaceAll('comandas: true','comandas: false, kds: false, restaurante: false, carvoaria: false');
source=source.replace('    const { certPfx, ...safeTenant } = tenant as any;',`    const { certPfx, certSenha, databaseUrl, ...safeTenant } = tenant as any;
    const modules = typeof safeTenant.modulos === 'string' ? JSON.parse(safeTenant.modulos) : (safeTenant.modulos || {});
    safeTenant.modulos = { ...modules, comandas: false, kds: false, restaurante: false, carvoaria: false };`);
fs.writeFileSync(tenants,source);
edit('backend/src/prisma/tenant-context.service.ts',"      return process.env.DATABASE_URL_TENANT || 'mysql://root:7bar%402025@mysql:3306/demo_adega';",`      if (process.env.APP_MODE !== 'demo' || !process.env.DATABASE_URL_TENANT) throw new UnauthorizedException('Tenant de demonstração indisponível.');
      return process.env.DATABASE_URL_TENANT;`);
// Novos namespaces impedem aproveitar sessão/carrinho/cache da adega no mesmo navegador.
for(const file of ['frontend/src/store/auth.ts','frontend/src/store/cart.ts','frontend/src/lib/db.ts','frontend/vite.config.ts']){
 const p=path.join(root,file);let s=fs.readFileSync(p,'utf8');s=s.replaceAll('7bar-auth','lojista-auth').replaceAll('7bar-cart-v2','lojista-cart-v1').replaceAll("super('7bar_pdv')","super('lojista_pdv')").replaceAll('pdvpro-','lojista-');fs.writeFileSync(p,s);
}
console.log('Adaptação inicial de módulos, catálogo e checkout aplicada.');
