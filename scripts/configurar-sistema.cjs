const fs=require('fs');const path=require('path');
const root=path.resolve(__dirname,'../sistema');
function read(p){return fs.readFileSync(path.join(root,p),'utf8').replace(/\r\n/g,'\n');}
function write(p,s){fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),s);}
// O módulo de backup de código não é uma pasta de backups de dados.
fs.cpSync('C:/Users/DKS/Documents/antigravity/joyful-meitner/backend/src/backups',path.join(root,'backend/src/backups'),{recursive:true});
let jwt=read('backend/src/auth/jwt.strategy.ts');const begin=jwt.indexOf("    if (payload.type === 'station-session')"),end=jwt.indexOf('    // RFC 8725',begin);if(begin>=0)jwt=jwt.slice(0,begin)+jwt.slice(end);write('backend/src/auth/jwt.strategy.ts',jwt);
let integrations=read('backend/src/integrations/integrations.service.ts');const integrationStart=integrations.indexOf('  async syncProductStock(');integrations=integrations.slice(0,integrationStart)+`  async syncProductStock(_tenantId: string, _productIds: string[], _throwOnError = false): Promise<void> {
    // Compatibilidade com os serviços reutilizados. Integrações de delivery não são executadas.
  }
}
`;write('backend/src/integrations/integrations.service.ts',integrations);
let db=read('frontend/src/lib/db.ts');
db="import { useAuthStore } from '@/store/auth';\n"+db;
db=db.replace('export interface CachedProduct {','export interface CachedProduct {\n  tenantId?: string;');
db=db.replaceAll("products_cache: 'id, name, barcode, shortCode'","products_cache: '[tenantId+id], tenantId, name, barcode, shortCode'");
db=db.replace('products_cache!:   Table<CachedProduct, string>;','products_cache!:   Table<CachedProduct, [string, string]>;');
const cacheStart=db.indexOf('export async function updateProductsCache(');
db=db.slice(0,cacheStart)+`export async function updateProductsCache(products: CachedProduct[], tenantId = useAuthStore.getState().user?.tenant): Promise<void> {
  if (!tenantId) throw new Error('Loja obrigatória para salvar o catálogo.');
  await db.transaction('rw', db.products_cache, async () => {
    await db.products_cache.where('tenantId').equals(tenantId).delete();
    await db.products_cache.bulkPut(products.map(product => ({ ...product, tenantId })));
  });
}
export async function getCachedProducts(tenantId = useAuthStore.getState().user?.tenant): Promise<CachedProduct[]> {
  if (!tenantId) return [];
  return db.products_cache.where('tenantId').equals(tenantId).toArray();
}
`;write('frontend/src/lib/db.ts',db);
let auth=read('backend/src/auth/auth.service.ts');auth=auth.replace('tenant: user.tenant.name,','tenant: user.tenant.id,\n        tenantName: user.tenant.name,');write('backend/src/auth/auth.service.ts',auth);
write('frontend/src/main.tsx',`import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import './app/globals.css';
import './retail/retail.css';
const updateSW = registerSW({ onNeedRefresh() { updateSW(true); } });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void updateSW(); });
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
`);
const brand=path.resolve(__dirname,'../identidade/roxo-branco');const publicDir=path.join(root,'frontend/public');
fs.mkdirSync(path.join(publicDir,'brand'),{recursive:true});
for(const name of ['logo-principal.svg','logo-sobre-roxo.svg','simbolo.svg'])fs.copyFileSync(path.join(brand,name),path.join(publicDir,'brand',name));
for(const name of ['favicon.svg','favicon.ico'])fs.copyFileSync(path.join(brand,name),path.join(publicDir,name));
for(const size of [16,32,48])fs.copyFileSync(path.join(brand,`icone-${size}.png`),path.join(publicDir,`favicon-${size}x${size}.png`));
fs.copyFileSync(path.join(brand,'icone-180.png'),path.join(publicDir,'apple-touch-icon.png'));
fs.mkdirSync(path.join(publicDir,'icons'),{recursive:true});for(const size of [192,512])fs.copyFileSync(path.join(brand,`icone-${size}.png`),path.join(publicDir,`icons/icon-${size}x${size}.png`));
const palette=JSON.parse(fs.readFileSync(path.join(brand,'paleta.json'),'utf8')).colors;
write('frontend/src/brand-tokens.css',`:root {\n${Object.entries(palette).map(([key,value])=>`  --pdv-${key.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())}: ${value};`).join('\n')}\n}\n`);
write('frontend/public/manifest.webmanifest',JSON.stringify({name:'PDV Lojista',short_name:'Lojista',description:'Vendas, mercadorias e gestão para sua loja.',start_url:'/',scope:'/',display:'standalone',theme_color:palette.primary,background_color:palette.white,lang:'pt-BR',icons:[192,512].map(size=>({src:`/icons/icon-${size}x${size}.png`,sizes:`${size}x${size}`,type:'image/png',purpose:'any'}))},null,2));
let vite=read('frontend/vite.config.ts');vite=vite.replace("name: 'PDV — Ponto de Venda'","name: 'PDV Lojista'").replace("short_name: 'PDV'","short_name: 'Lojista'").replace("theme_color: '#0a0a0a'","theme_color: '#7C3AED'").replace("background_color: '#09090b'","background_color: '#FFFFFF'");
const unsafeCache=vite.indexOf("          {\n            urlPattern: ({ url }) =>");const unsafeEnd=vite.indexOf('        // ── Stale-While-Revalidate',unsafeCache);if(unsafeCache>=0&&unsafeEnd>=0)vite=vite.slice(0,unsafeCache)+`          // JSON autenticado não é cacheado por URL; IndexedDB isola catálogos por tenant.\n\n`+vite.slice(unsafeEnd);
write('frontend/vite.config.ts',vite);
let html=read('frontend/index.html').replaceAll('#0a0a0a','#7C3AED').replace('<title>PDV — Ponto de Venda</title>','<title>PDV Lojista</title>').replace('content="PDV"','content="PDV Lojista"').replace('content="black-translucent"','content="default"');write('frontend/index.html',html);
const sysInit='frontend/src/app/sys-init/page.tsx';let sys=read(sysInit);sys=sys.split('\n').filter(line=>!/^\s*(kds|carvoaria|comandas|restaurante):\s*\{/.test(line)&&!/^\s*\{ id: '(comandas|kds|carvoaria|restaurante)'/.test(line)).join('\n');write(sysInit,sys);
// Desabilita atalhos operacionais mesmo que um tenant antigo ainda guarde flags de restaurante.
write('frontend/src/hooks/useKdsEnabled.ts',`export function useKdsEnabled() { return false; }
export function useKdsConfig() { return { enabled: false, carvoariaEnabled: false, isLoading: false }; }
`);
const operator='frontend/src/components/OperatorLoginModal.tsx';write(operator,read(operator).replace('if (parsed?.restaurante === true)', 'if (false)'));
// Identidade de armazenamento independente do produto de origem.
function namespace(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,item.name);if(item.isDirectory())namespace(p);else if(/\.(ts|tsx)$/.test(p)){let s=fs.readFileSync(p,'utf8');s=s.replaceAll("'currentOperator'","'lojista-currentOperator'").replaceAll('pdvpro_cached_register_','lojista-cached-register-').replaceAll('7bar_sysinit_pin','lojista-sysinit-pin').replaceAll('7bar_sql_history','lojista-sql-history');fs.writeFileSync(p,s);}}}namespace(path.join(root,'frontend/src'));
console.log('Rotas, marca, PWA e isolamento do cache configurados.');
