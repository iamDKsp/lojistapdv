const fs=require('fs');const path=require('path');const root=path.resolve(__dirname,'../sistema');
function edit(file,fn){const p=path.join(root,file);fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n')));}
edit('frontend/vite.config.ts',s=>s.replaceAll('localhost:3520','localhost:3530').replace('port: 3000','port: 3531'));
edit('backend/src/main.ts',s=>s.replace('?? 3520','?? 3530').replace('PDV Pro rodando','PDV Lojista rodando'));
edit('backend/src/tenants/tenants.service.ts',s=>s.replace("process.env.SETUP_PIN || 'teltech352'","process.env.SETUP_PIN").replace("process.env.SQL_PIN || '43619835'","process.env.SQL_PIN").replace('    return pin === setupPin || pin === sqlPin;', '    return Boolean((setupPin && pin === setupPin) || (sqlPin && pin === sqlPin));').replace('    // Campos permitidos (whitelist',`    if (data.modulos !== undefined) {
      let modules: any;
      try { modules = typeof data.modulos === 'string' ? JSON.parse(data.modulos) : data.modulos; } catch { throw new BadRequestException('Módulos inválidos.'); }
      data = { ...data, modulos: { ...modules, comandas: false, restaurante: false, kds: false, carvoaria: false } };
    }
    // Campos permitidos (whitelist`));
edit('backend/src/tenants/tenants.controller.ts',s=>s.replace("if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {", "if (req.user.role !== 'superadmin') {").replaceAll("if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {", "if (req.user.role !== 'superadmin' && !(req.user.role === 'admin' && req.user.tenantId === id)) {"));
edit('backend/src/auth/access-policy.ts',s=>{const start=s.indexOf('export function allowedStations('),end=s.indexOf('export function operatorAllowed(',start);return s.slice(0,start)+`export function allowedStations(_modules: Record<string, boolean>): string[] { return []; }

`+s.slice(end);});
edit('frontend/src/retail/RetailGroupEditor.tsx',s=>s.replace('15 * 1024 * 1024','8 * 1024 * 1024').replace('até 15 MB','até 8 MB'));
edit('frontend/src/retail/RetailLoginPage.tsx',s=>s.replace("navigate(res.data.user.role === 'superadmin'", "navigate(res.data.user.role === 'group_owner' || res.data.user.groupId ? '/grupo-portal' : res.data.user.role === 'superadmin'"));
edit('frontend/src/app/dashboard/configuracoes/payment-methods/page.tsx',s=>s.replace("key: 'consumo_funcionario'", "key: 'credito_loja'").replace("label: 'Consumo Colaborador'", "label: 'Crédito na loja'"));
edit('frontend/src/components/CloseRegisterModal.tsx',s=>s.replace("  consumo_funcionario:  'Consumo Colaborador',", "  credito_loja:         'Crédito na loja',"));
edit('frontend/src/components/EditPaymentModal.tsx',s=>s.replace("  consumo_funcionario:  'Consumo Colaborador',", "  credito_loja:         'Crédito na loja',"));
edit('frontend/nginx.conf',s=>s.replaceAll('3521','3531').replaceAll('3520','3530'));
for(const file of ['backend/Dockerfile','frontend/Dockerfile'])edit(file,s=>s.replaceAll('node:20-alpine','node:22-alpine').replace('EXPOSE 3520','EXPOSE 3530').replace('EXPOSE 3521','EXPOSE 3531'));
edit('backend/entrypoint.sh',()=>`#!/bin/sh
set -e
echo "PDV Lojista: schemas são atualizados manualmente pelo Sys-Init."
exec node dist/main
`);
edit('backend/package.json',s=>{const p=JSON.parse(s);p.name='pdv-lojista-api';delete p.scripts['prisma:heart:setup'];p.scripts['prisma:generate']='prisma generate --schema=prisma/schema.prisma && prisma generate --schema=prisma/heart.schema.prisma';p.scripts['start:dev']='node --env-file-if-exists=.env ./node_modules/@nestjs/cli/bin/nest.js start --watch';p.scripts['test:retail']='jest --runInBand --testPathPatterns=retail';return JSON.stringify(p,null,2)+'\n';});
edit('frontend/package.json',s=>{const p=JSON.parse(s);p.name='pdv-lojista-web';return JSON.stringify(p,null,2)+'\n';});
for(const directory of ['frontend','backend'])edit(directory+'/package-lock.json',s=>{const p=JSON.parse(s);p.name=directory==='frontend'?'pdv-lojista-web':'pdv-lojista-api';p.packages[''].name=p.name;return JSON.stringify(p,null,2)+'\n';});
edit('backend/src/prisma/seed.ts',()=>`// Não cria usuários, senhas ou tenants automaticamente.
// Provisione as lojas pelo Sys-Init e configure o acesso no ambiente próprio do Lojista.
export {};
`);
console.log('Ambiente próprio do produto configurado nas portas 3530 e 3531.');
