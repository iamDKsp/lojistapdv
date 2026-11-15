// API de demonstração local. Não usa Prisma, MySQL, certificados ou bancos de clientes.
const http=require('node:http');const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const dir=path.resolve(__dirname,'../.local');const file=path.join(dir,'demonstracao.json');
const rules=require('../backend/dist/retail/retail.rules.js');
const sfRules=require('../backend/dist/storefront/storefront.rules.js');
let DEFAULT_SP_WHOLESALE_SUPPLIERS=[];try{DEFAULT_SP_WHOLESALE_SUPPLIERS=require('../backend/dist/suppliers/sp-wholesale.seed.js').DEFAULT_SP_WHOLESALE_SUPPLIERS||[];}catch{}
function buildDefaultSpHub(){return DEFAULT_SP_WHOLESALE_SUPPLIERS.map((s,idx)=>({...s,id:s.id||`sp-hub-${idx+1}`,active:true,items:(s.items||[]).map((it,i)=>({...it,id:it.id||`${s.id}-item-${i+1}`,supplierId:s.id||`sp-hub-${idx+1}`,active:true}))}));}
const EMAIL='demo@lojista.local',PASSWORD='Lojista123!',PIN='1234',SETUP_PIN=process.env.SETUP_PIN||'teltech352',SQL_PIN=process.env.SQL_PIN||SETUP_PIN,tenant='lojista-demo-local';
const stamp=()=>new Date().toISOString();const id=()=>crypto.randomUUID();const money=n=>Math.round(Number(n)*100)/100;
const jwt=payload=>[Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({...payload,exp:Math.floor(Date.now()/1000)+86400*7})).toString('base64url'),'demo-local'].join('.');
const DEMO_SVGS={
 'camiseta-peruana':`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 460" fill="none"><path d="M126 74 L168 52 H252 L294 74 L356 138 L314 176 L284 146 V396 H136 V146 L106 176 L64 138 Z" fill="#7C3AED" stroke="#272321" stroke-width="5" stroke-linejoin="round"/><path d="M168 52 C182 76, 238 76, 252 52" stroke="#272321" stroke-width="5"/></svg>`,
 'camiseta-branca':`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 460" fill="none"><path d="M124 72 L170 48 H270 L316 72 L382 142 L336 182 L302 150 V404 H138 V150 L104 182 L58 142 Z" fill="#FFFFFF" stroke="#272321" stroke-width="4.5" stroke-linejoin="round"/><path d="M170 48 C188 78, 252 78, 270 48" stroke="#272321" stroke-width="4"/><line x1="152" y1="382" x2="288" y2="382" stroke="#E5E1ED" stroke-width="3" stroke-dasharray="6 6"/><rect x="196" y="132" width="48" height="22" rx="4" fill="#F3E8FF" stroke="#7C3AED" stroke-width="2"/></svg>`,
 'camiseta-basica':`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 460" fill="none"><path d="M126 74 L168 52 H252 L294 74 L356 138 L314 176 L284 146 V396 H136 V146 L106 176 L64 138 Z" fill="#272321" stroke="#272321" stroke-width="5" stroke-linejoin="round"/><path d="M168 52 C182 76, 238 76, 252 52" stroke="#F3E8FF" stroke-width="4"/></svg>`,
 'oculos-largo':`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 840 240" fill="none"><path d="M24 96 H356 C374 96, 390 112, 420 112 C450 112, 466 96, 484 96 H816" stroke="#272321" stroke-width="14" stroke-linecap="round"/><rect x="52" y="54" width="312" height="136" rx="34" fill="#272321" stroke="#7C3AED" stroke-width="8"/><rect x="476" y="54" width="312" height="136" rx="34" fill="#272321" stroke="#7C3AED" stroke-width="8"/><path d="M96 86 L152 158" stroke="#F3E8FF" stroke-width="8" stroke-linecap="round"/><path d="M520 86 L576 158" stroke="#F3E8FF" stroke-width="8" stroke-linecap="round"/></svg>`,
 'calca-cargo':`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 780" fill="none"><path d="M64 36 H236 L262 738 H178 L150 264 L122 738 H38 Z" fill="#272321" stroke="#272321" stroke-width="6" stroke-linejoin="round"/><rect x="64" y="36" width="172" height="36" fill="#665F70" stroke="#272321" stroke-width="4"/><rect x="44" y="330" width="46" height="96" rx="8" fill="#7C3AED" stroke="#FFFFFF" stroke-width="3"/><rect x="210" y="330" width="46" height="96" rx="8" fill="#7C3AED" stroke="#FFFFFF" stroke-width="3"/></svg>`,
 'tenis-casual':`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 380" fill="none"><path d="M68 244 C68 194, 118 176, 174 166 L268 92 L322 108 L382 184 L536 204 C574 210, 592 238, 592 268 V288 H56 V256 Z" fill="#FFFFFF" stroke="#272321" stroke-width="6" stroke-linejoin="round"/><path d="M188 188 L354 226" stroke="#7C3AED" stroke-width="16" stroke-linecap="round"/><rect x="50" y="284" width="548" height="38" rx="16" fill="#7C3AED" stroke="#272321" stroke-width="6"/></svg>`,
 'bone-aba-curva':`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 360" fill="none"><path d="M98 238 C98 118, 172 64, 278 64 C382 64, 446 122, 450 238 Z" fill="#7C3AED" stroke="#272321" stroke-width="6" stroke-linejoin="round"/><path d="M88 238 H464 C506 238, 534 260, 542 282 H214 C148 282, 98 262, 88 238 Z" fill="#272321"/><circle cx="276" cy="58" r="12" fill="#272321"/></svg>`,
 'jaqueta-street':`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" fill="none"><path d="M148 58 L192 40 H288 L332 58 L424 176 L374 214 L336 164 V420 H144 V164 L106 214 L56 176 Z" fill="#F3E8FF" stroke="#272321" stroke-width="5" stroke-linejoin="round"/><line x1="240" y1="44" x2="240" y2="420" stroke="#7C3AED" stroke-width="6"/></svg>`,
 'relogio-casual':`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 620" fill="none"><rect x="116" y="38" width="88" height="544" rx="22" fill="#272321"/><circle cx="160" cy="310" r="106" fill="#FFFFFF" stroke="#7C3AED" stroke-width="12"/><path d="M160 242 V310 L208 342" stroke="#272321" stroke-width="10" stroke-linecap="round"/></svg>`,
 'carteira-slim':`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 360" fill="none"><rect x="64" y="68" width="356" height="228" rx="28" fill="#272321" stroke="#272321" stroke-width="6"/><path d="M312 138 H436 V226 H312 C284 226, 268 208, 268 182 C268 156, 284 138, 312 138 Z" fill="#7C3AED" stroke="#FFFFFF" stroke-width="4"/></svg>`,
 'campanha-street-desktop':`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 540" fill="none"><rect width="1280" height="540" fill="#272321"/><circle cx="940" cy="250" r="240" fill="#7C3AED"/><circle cx="1060" cy="140" r="110" fill="#6D28D9"/><path d="M840 130 L890 104 H990 L1040 130 L1110 210 L1060 250 L1026 212 V442 H854 V212 L820 250 L770 210 Z" fill="#FFFFFF" stroke="#272321" stroke-width="8" stroke-linejoin="round"/><rect x="72" y="72" width="1136" height="396" rx="28" stroke="#665F70" stroke-width="2"/></svg>`,
 'campanha-street-mobile':`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 880" fill="none"><rect width="720" height="880" fill="#272321"/><circle cx="360" cy="360" r="220" fill="#7C3AED"/><path d="M260 210 L310 184 H410 L460 210 L530 290 L480 330 L446 292 V540 H274 V292 L240 330 L190 290 Z" fill="#FFFFFF" stroke="#272321" stroke-width="8" stroke-linejoin="round"/></svg>`
};
const PHOTOS={
 'Camiseta Peruana':'/api/products/uploads/images/camiseta-peruana',
 'Camiseta Oversized Branca':'/api/products/uploads/images/camiseta-branca',
 'Camiseta básica':'/api/products/uploads/images/camiseta-basica',
 'Óculos Retrô Largo':'/api/products/uploads/images/oculos-largo',
 'Calça Cargo Longa':'/api/products/uploads/images/calca-cargo',
 'Tênis casual':'/api/products/uploads/images/tenis-casual',
 'Boné aba curva':'/api/products/uploads/images/bone-aba-curva',
 'Jaqueta Corta-Vento':'/api/products/uploads/images/jaqueta-street',
 'Relógio casual':'/api/products/uploads/images/relogio-casual',
 'Carteira':'/api/products/uploads/images/carteira-slim'
};
function buildInitialStorefront(state){
 const legacyTheme={
  template:'editorial_roxo',
  primaryColor:'#7C3AED',
  accentColor:'#6D28D9',
  surfaceColor:'#F8F7FC',
  textColor:'#272321',
  heroTitle:'Streetwear & Essenciais Urbanos',
  heroSubtitle:'Escolha suas peças com grade atualizada em tempo real e finalize pelo WhatsApp.',
  heroCtaLabel:'Explorar peças',
  announcementText:'Retirada rápida na loja física ou entrega expressa no mesmo dia',
  banners:[{id:'bnr-legacy-1',title:'Semana Streetwear',subtitle:'Peças selecionadas com retirada rápida no balcão',imageUrl:'/api/products/uploads/images/campanha-street-desktop',ctaLabel:'Conferir destaques',linkType:'featured',active:true}],
  sections:[
   {id:'sec-header',type:'header',enabled:true,title:'Cabeçalho'},
   {id:'sec-hero',type:'hero',enabled:true,title:'Capa de destaque'},
   {id:'sec-categories',type:'categories',enabled:true,title:'Categorias'},
   {id:'sec-featured',type:'featured',enabled:true,title:'Destaques da loja'},
   {id:'sec-collection',type:'collection',enabled:true,title:'Catálogo completo'},
   {id:'sec-fulfillment',type:'fulfillment_info',enabled:true,title:'Retirada e Entrega'},
   {id:'sec-footer',type:'footer',enabled:true,title:'Rodapé e Contato'}
  ]
 };
 return {
  settings:{
   id:'singleton',
   publicId:'pub-loja-demo-local',
   slug:'loja-demonstracao',
   storeName:'Loja Demonstração Streetwear',
   tagline:'Moda urbana, calçados e acessórios',
   description:'Curadoria de vestuário, calçados e acessórios com estoque integrado ao PDV.',
   logoUrl:null,
   coverUrl:'/api/products/uploads/images/campanha-street-desktop',
   whatsappPhone:'5511999998888',
   whatsappMessageIntro:'Olá! Fiz um pedido pela vitrine online da *Loja Demonstração Streetwear*.',
   pickupEnabled:true,
   pickupInstructions:'Retire no balcão após a confirmação da separação pelo WhatsApp.',
   deliveryEnabled:true,
   deliveryInstructions:'Entregamos em toda a região com confirmação pelo WhatsApp.',
   deliveryFeeNote:'Frete a combinar pelo WhatsApp',
   confirmReservationMinutes:15,
   confirmedHoldHours:24,
   draftThemeJson:JSON.parse(JSON.stringify(legacyTheme)),
   publishedThemeJson:JSON.parse(JSON.stringify(legacyTheme)),
   publishedVersion:1,
   isPublished:true,
   publishedAt:stamp(),
   publishedByUserId:'admin-demo',
   publishedByName:'Administrador de demonstração',
   updatedAt:stamp()
  },
  categories:(state.categories||[]).map((c,idx)=>({
   id:`sc-${idx+1}`,
   categoryId:c.id,
   slug:sfRules.normalizeStorefrontSlug(c.name)||`cat-${idx+1}`,
   displayName:c.name,
   description:'',
   visible:true,
   featured:idx<4,
   sortOrder:(idx+1)*10
  })),
  products:(state.groups||[]).map((g,idx)=>({
   id:`sp-${idx+1}`,
   retailGroupId:g.id,
   publicSlug:sfRules.buildProductPublicSlug(g.name,g.id),
   visible:true,
   featured:idx<9,
   sortOrder:(idx+1)*10,
   commercialTitle:g.name,
   commercialDescription:'Peça com acabamento revisado e grade integrada ao estoque da loja.',
   badgeLabel:idx===0?'Destaque':null,
   galleryUrlsJson:g.imageUrl?[g.imageUrl]:[]
  })),
  orders:[],
  uploadedSvgs:{}
 };
}
function initial(existingLeads=[]){
 const state={mode:'demo-local',version:1,leads:existingLeads,groups:[],products:[],categories:[],suppliers:[{id:'forn-1',name:'Têxtil Sul Confecções Ltda',tradeName:'Têxtil Sul',document:'12345678000190',phone:'11988887777',email:'comercial@textilsul.com.br',active:true}],purchaseOrders:[{id:'po-1',supplierId:'forn-1',status:'RECEIVED',totalCost:1840,notes:'Reposição quinzenal de camisetas e calçados',createdAt:stamp()}],payables:[{id:'pay-1',description:'Aluguel do Ponto Comercial',category:'Ocupação',supplierId:null,amount:2850,dueDate:new Date(Date.now()+4*86400000).toISOString(),paidAt:null,status:'PENDING',paymentMethod:'pix',isFixed:true,createdAt:stamp()},{id:'pay-2',description:'Reposição Grade Camisetas — Têxtil Sul',category:'Fornecedores',supplierId:'forn-1',amount:1840,dueDate:new Date(Date.now()-2*86400000).toISOString(),paidAt:new Date(Date.now()-2*86400000).toISOString(),status:'PAID',paymentMethod:'pix',isFixed:false,createdAt:stamp()},{id:'pay-3',description:'Energia Elétrica e Iluminação da Vitrine',category:'Utilidades',supplierId:null,amount:468.9,dueDate:new Date(Date.now()+2*86400000).toISOString(),paidAt:null,status:'PENDING',paymentMethod:'boleto',isFixed:true,createdAt:stamp()}],customers:[{id:'cliente-exemplo',name:'Cliente Exemplo',phone:'11900000000'},{id:'cliente-2',name:'Mariana Costa',phone:'11987654321'}],operators:[{id:'operador-exemplo',name:'Operador de demonstração',pin:PIN,isManager:true,jobTitle:'Gerente de Loja',active:true}],registers:[{id:'caixa-exemplo',code:1,status:'open',operatorId:'operador-exemplo',openingTime:stamp(),openingValue:250}],sales:[],returns:[],credits:[],methods:[],movements:[{id:'mov-1',cashRegisterId:'caixa-exemplo',type:'IN',value:80,reason:'Reforço de moedas e notas de troco',createdAt:stamp()}],users:[],settings:{allowNegativeStock:false,enableExpiryControl:false,expiryAlertDays:30,lowStockAlertDefault:3}};
 const catalogSeed=[
  ['Camiseta Oversized Branca','Camisetas',69.9,28,['P','M','G','GG'],['Branca','Off-White']],
  ['Camiseta Peruana','Camisetas',49.9,22,['P','M','G','GG'],['Preta','Roxa']],
  ['Óculos Retrô Largo','Óculos',119.9,45,['Único'],['Preto','Tartaruga']],
  ['Calça Cargo Longa','Calças',159.9,72,['38','40','42','44'],['Preta','Grafite']],
  ['Tênis casual','Calçados',129.9,65,['38','39','40','41'],['Branco','Preto']],
  ['Boné aba curva','Bonés',39.9,15,['Único'],['Roxo','Preto']],
  ['Jaqueta Corta-Vento','Jaquetas',189.9,84,['M','G','GG'],['Lavanda','Preta']],
  ['Camiseta básica','Camisetas',39.9,16,['P','M','G','GG'],['Preta']],
  ['Relógio casual','Relógios',89.9,35,['Único'],['Prata','Preto']],
  ['Carteira','Acessórios',29.9,12,['Único'],['Preta']]
 ];
 for(const [name,category,price,cost,sizes,colors] of catalogSeed){
  let cat=state.categories.find(c=>c.name===category);if(!cat){cat={id:id(),name:category};state.categories.push(cat);}
  const photo=PHOTOS[name]||null;
  const group={id:id(),name,categoryId:cat.id,imageUrl:photo,priceSell:price,priceCost:cost,active:true,version:1,ncm:null,cest:null,origem:0,grupoTributacaoId:null,createdAt:stamp(),updatedAt:stamp()};state.groups.push(group);
  for(const size of sizes)for(const color of colors){const code=String(1000+state.products.length);state.products.push({id:id(),retailGroupId:group.id,name:`${name} · ${size} · ${color}`,size,color,barcode:code,shortCode:code,priceSell:price,priceCost:cost,stock:10,minStock:3,active:true,unit:'UN',categoryId:cat.id,imageUrl:photo,salesCount:0});}
 }
 const p=state.products.find(p=>p.size==='M');p.stock-=2;
 state.sales.push({id:id(),code:1,status:'completed',source:'pdv',customerId:state.customers[0].id,operatorId:'operador-exemplo',cashRegisterId:'caixa-exemplo',subtotal:99.8,discount:0,total:99.8,createdAt:stamp(),emitirNfce:false,nfceStatus:null,items:[{id:id(),productId:p.id,productName:p.name,unit:'UN',quantity:2,priceUnit:49.9,subtotal:99.8,priceCost:p.priceCost,retailReturnItems:[]}],payments:[{method:'pix',label:'Pix',value:99.8,troco:0}]});
 const g0=state.groups[0],g2=state.groups[2],g3=state.groups[3],g4=state.groups[4];
 const initSlides=[
  g0&&{slideType:'single',productId:state.products.find(x=>x.retailGroupId===g0.id)?.id||g0.id,retailGroupId:g0.id,productName:g0.name,categoryName:'Camisetas',imageUrl:g0.imageUrl,priceSell:g0.priceSell,promoPrice:59.9,badge:'OFERTA DA SEMANA',showSizes:true,sizesAvailable:['P','M','G','GG'],colorsAvailable:['Branca','Off-White'],order:0},
  g2&&{slideType:'single',productId:state.products.find(x=>x.retailGroupId===g2.id)?.id||g2.id,retailGroupId:g2.id,productName:g2.name,categoryName:'Óculos',imageUrl:g2.imageUrl,priceSell:g2.priceSell,promoPrice:99.9,badge:'LANÇAMENTO',showSizes:true,sizesAvailable:['Único'],colorsAvailable:['Preto','Tartaruga'],order:1},
  (g0&&g2&&g3&&g4)&&{slideType:'grid',gridId:'grid-demo-1',order:2,gridTitle:'Destaques da Estação',gridSubtitle:'Peças selecionadas com grade imediata',gridBadge:'COLEÇÃO',gridProducts:[g0,g2,g3,g4].map(g=>({productId:state.products.find(x=>x.retailGroupId===g.id)?.id||g.id,retailGroupId:g.id,productName:g.name,imageUrl:g.imageUrl,priceSell:g.priceSell,promoPrice:null,sizesAvailable:[...new Set(state.products.filter(x=>x.retailGroupId===g.id).map(x=>x.size).filter(Boolean))]}) )}
 ].filter(Boolean);
 state.vitrineConfig={id:'singleton',active:true,theme:'dark_premium',customBgUrl:null,showLogo:true,logoPosition:'top-right',logoUrl:null,instagramHandle:'@lojademonstracao',storeTagline:'Moda, Calçados e Acessórios · Consulte tamanhos no balcão',slideDuration:8,gridSlideDuration:14,draftSlides:initSlides,publishedSlides:initSlides,publishedVersion:1,publishedAt:stamp(),tvPublicId:'DEMOLOJA'};
 state.storefront=buildInitialStorefront(state);
 return state;
}
fs.mkdirSync(dir,{recursive:true});let state=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):initial();
if(state.mode!=='demo-local')throw new Error('Arquivo não pertence à demonstração local.');
if(!Array.isArray(state.leads))state.leads=[];
if(!Array.isArray(state.payables))state.payables=initial(state.leads).payables;
if(!Array.isArray(state.suppliers))state.suppliers=initial(state.leads).suppliers;
if(!Array.isArray(state.purchaseOrders))state.purchaseOrders=initial(state.leads).purchaseOrders;
for(const g of state.groups||[]){if((!g.imageUrl||String(g.imageUrl).startsWith('data:'))&&PHOTOS[g.name])g.imageUrl=PHOTOS[g.name];}
for(const p of state.products||[]){const g=(state.groups||[]).find(x=>x.id===p.retailGroupId);if(g?.imageUrl&&(!p.imageUrl||String(p.imageUrl).startsWith('data:')))p.imageUrl=g.imageUrl;}
function resetDemoLocalState(){const preserved={leads:state.leads||[],tenants:state.tenants,tenantGroups:state.tenantGroups,paymentLogs:state.paymentLogs,tenantInvoices:state.tenantInvoices,webhookOutbox:state.webhookOutbox,backupSchedule:state.backupSchedule};state=Object.assign(initial(preserved.leads),preserved);save();return state;}
if(!Array.isArray(state.tenants)||!state.tenants.length)state.tenants=[{id:tenant,name:'Loja Demonstração',nomeFantasia:'Loja Demonstração',razaoSocial:'Loja Demonstração — dados fictícios',cnpj:'00000000000191',databaseName:'lojista_demo_local',status:'active',tvPublicId:'DEMOLOJA',mensalidadeValor:149.9,mensalidadeVencimento:new Date(Date.now()+7*86400000).toISOString(),modulos:{estoque:true,nfce:false,dashboardMobile:true,vitrineDigital:true,lojaVirtual:true,entregaLojaVirtual:true,inteligenciaComercial:true,fornecedores:true,multiEmpresa:true},users:[{id:'admin-demo',name:'Administrador de demonstração',email:EMAIL,role:'admin',active:true,createdAt:stamp()}],tenantIntegrations:[]}];
for(const t of state.tenants){if(!t.tvPublicId)t.tvPublicId='DEMOLOJA';if(t.modulos&&typeof t.modulos==='object'){if(t.modulos.vitrineDigital===undefined)t.modulos.vitrineDigital=true;if(t.modulos.lojaVirtual===undefined)t.modulos.lojaVirtual=true;if(t.modulos.entregaLojaVirtual===undefined)t.modulos.entregaLojaVirtual=true;if(t.modulos.inteligenciaComercial===undefined)t.modulos.inteligenciaComercial=true;if(t.modulos.fornecedores===undefined)t.modulos.fornecedores=true;if(t.modulos.multiEmpresa===undefined)t.modulos.multiEmpresa=true;}}
if(!Array.isArray(state.spHubSuppliers)||!state.spHubSuppliers.length)state.spHubSuppliers=buildDefaultSpHub();
if(!state.vitrineConfig)state.vitrineConfig=initial(state.leads).vitrineConfig;
if(!state.storefront||(state.groups||[]).length<8){const fresh=initial(state.leads);if((state.groups||[]).length<8){state.categories=fresh.categories;state.groups=fresh.groups;state.products=fresh.products;}state.storefront=buildInitialStorefront(state);}
if(!Array.isArray(state.tenantGroups)||!state.tenantGroups.length)state.tenantGroups=[{id:'group-demo-local',name:'Rede Loja Demonstração',members:[{id:'gm-demo-1',tenantId:state.tenants[0].id,alias:state.tenants[0].nomeFantasia||state.tenants[0].name||'Loja Demonstração',tenant:state.tenants[0]}],users:[],createdAt:stamp()}];
if(!Array.isArray(state.paymentLogs))state.paymentLogs=[];
if(!Array.isArray(state.tenantInvoices))state.tenantInvoices=[{id:'inv-demo-1',externalId:`inv-${tenant}-${stamp().slice(0,7)}`,tenantId:tenant,referenceMonth:stamp().slice(0,7),dueDate:new Date(Date.now()+7*86400000).toISOString(),amount:14990,status:'pending',paidAt:null,paymentMethod:null,description:`Mensalidade ${stamp().slice(0,7)}`,notes:null,version:1,createdAt:stamp(),updatedAt:stamp()}];
if(!Array.isArray(state.webhookOutbox))state.webhookOutbox=[];
if(!state.backupSchedule)state.backupSchedule={enabled:false,time:'02:00'};
function checkSetupPin(req,pin){const candidate=String(pin||req.headers['x-setup-pin']||'').trim();if(candidate!==SETUP_PIN&&candidate!==SQL_PIN)fail('PIN inválido.',401);}
function save(){const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify(state,null,2));fs.renameSync(temp,file);}save();
function fail(message,status=400){throw Object.assign(new Error(message),{status});}
function decorateProduct(p){return {...p,category:state.categories.find(c=>c.id===p.categoryId),retailGroup:state.groups.find(g=>g.id===p.retailGroupId)||null,grupoTributacao:null};}
function decorateGroup(g){const variants=state.products.filter(p=>p.retailGroupId===g.id);return {...g,variants,category:state.categories.find(c=>c.id===g.categoryId),stock:variants.filter(v=>v.active).reduce((n,v)=>n+v.stock,0)};}
function decorateSale(s){return {...s,customer:state.customers.find(c=>c.id===s.customerId)||null,operator:state.operators.find(o=>o.id===s.operatorId),items:s.items.map(i=>({...i,product:state.products.find(p=>p.id===i.productId),retailReturnItems:state.returns.flatMap(r=>r.items).filter(r=>r.saleItemId===i.id)}))};}
function fingerprint(body){const copy={...body};for(const k of ['offlineContingency','offlineCreatedAt','localId','total','subtotal'])delete copy[k];return crypto.createHash('sha256').update(JSON.stringify(copy)).digest('hex');}
function listPage(rows,url){const page=Math.max(1,Number(url.searchParams.get('page'))||1),limit=Math.min(2000,Math.max(1,Number(url.searchParams.get('limit'))||50));return {data:rows.slice((page-1)*limit,page*limit),meta:{page,total:rows.length,lastPage:Math.ceil(rows.length/limit)}};}
async function handle(req,url,b){const p=url.pathname.replace(/^\/api/,'').replace(/\/$/,'')||'/';const method=req.method;
 if(p==='/'||p==='/health')return {status:'ok',mode:'demo-local',database:'JSON local de demonstração; sem MySQL'};
 if(p==='/auth/login'){if(b.email!==EMAIL||b.password!==PASSWORD)fail('Use as credenciais da demonstração local.',401);resetDemoLocalState();const t0=state.tenants.find(x=>x.id===tenant)||state.tenants[0];return {access_token:jwt({sub:'admin-demo',tenantId:tenant,role:'admin'}),user:{id:'admin-demo',email:EMAIL,name:'Administrador de demonstração',role:'admin',tenant,tenantName:t0?.nomeFantasia||t0?.name||'Loja Demonstração',logoUrl:t0?.logoUrl||null,termsAccepted:true,isDemo:true}};}
 if(p==='/auth/demo-login'&&method==='POST'){
  const cleanName=String(b.name||'').trim();let cleanPhone=String(b.whatsapp||'').replace(/\D/g,'');if(cleanPhone.startsWith('55')&&cleanPhone.length>=12)cleanPhone=cleanPhone.slice(2);
  if(cleanName.length<2)fail('Informe seu nome para continuar.');if(cleanPhone.length<10||cleanPhone.length>11)fail('Informe um WhatsApp válido com DDD.');
  let lead=state.leads.find(l=>l.whatsapp===cleanPhone);
  if(lead){lead.name=cleanName;lead.accessCount=(lead.accessCount||1)+1;lead.lastAccessAt=stamp();lead.updatedAt=stamp();}
  else{lead={id:id(),name:cleanName,whatsapp:cleanPhone,status:'EM_DEMO',notes:null,accessCount:1,lastAccessAt:stamp(),createdAt:stamp(),updatedAt:stamp()};state.leads.unshift(lead);}
  resetDemoLocalState();
  const op=state.operators[0];const reg=state.registers.find(r=>r.status==='open')||state.registers[0];
  const t0=state.tenants.find(x=>x.id===tenant)||state.tenants[0];
  return {access_token:jwt({sub:'admin-demo',tenantId:tenant,role:'admin'}),user:{id:'admin-demo',email:EMAIL,name:cleanName,role:'admin',tenant,tenantName:t0?.nomeFantasia||t0?.name||'Loja Demonstração',logoUrl:t0?.logoUrl||null,termsAccepted:true,isDemo:true},operator:{...op,pin:undefined,role:op.jobTitle||'Gerente de Loja',operatorToken:jwt({type:'op',opId:op.id,tenantId:tenant,context:'cashier'})},cashRegister:reg,lead};
 }
 if(p==='/auth/demo-reset'&&method==='POST'){resetDemoLocalState();return {reset:true};}
 if(p==='/tenants/setup/leads'&&method==='GET'){checkSetupPin(req,url.searchParams.get('pin'));return state.leads;}
 if(p.startsWith('/tenants/setup/leads/')&&method==='PATCH'){checkSetupPin(req);const lid=p.split('/')[4],ld=state.leads.find(x=>x.id===lid);if(!ld)fail('Lead não encontrado.',404);if(b.status!==undefined)ld.status=b.status;if(b.notes!==undefined)ld.notes=b.notes;if(b.name!==undefined)ld.name=b.name;ld.updatedAt=stamp();save();return ld;}
 if(p.startsWith('/tenants/setup/leads/')&&method==='DELETE'){checkSetupPin(req);const lid=p.split('/')[4];state.leads=state.leads.filter(x=>x.id!==lid);save();return {deleted:true};}
 if(p==='/tenants/setup/demo-reset'&&method==='POST'){checkSetupPin(req);resetDemoLocalState();return {reset:true};}
 if(p==='/auth/tenant-status')return {status:'active',diasAtraso:-1,vencimento:null};
 if(p==='/auth/accept-terms')return {success:true};
 if(p==='/auth/operator-login'){const op=state.operators.find(o=>o.id===b.operatorId&&o.active&&o.pin===b.pin);if(!op)fail('PIN de demonstração incorreto.',401);return {...op,pin:undefined,role:'operator',operatorToken:jwt({type:'op',opId:op.id,tenantId:tenant,context:'cashier'})};}
 if(p==='/auth/operator-switch'){const op=state.operators.find(o=>o.id===b.operatorId&&o.active);if(!op)fail('Colaborador não encontrado ou inativo.',404);return {...op,pin:undefined,role:'operator',operatorToken:jwt({type:'op',opId:op.id,tenantId:tenant,context:'cashier'})};}
 if(p.startsWith('/telemetry'))return {ok:true};
 if(p==='/tenants/setup/validate-pin'&&method==='POST'){checkSetupPin(req,b.pin);return {valid:true};}
 if(p==='/tenants/setup/list'&&method==='GET'){checkSetupPin(req,url.searchParams.get('pin'));return state.tenants;}
 if(p==='/tenants/setup'&&method==='POST'){checkSetupPin(req,b.pin);const newTenant={id:id(),name:b.tenantName,nomeFantasia:b.tenantName,razaoSocial:b.tenantName,databaseName:b.dbName||'loja_demo',status:'active',mensalidadeValor:Number(b.mensalidadeValor)||0,mensalidadeVencimento:b.mensalidadeVencimento||null,modulos:{estoque:true,nfce:false,dashboardMobile:true},users:[{id:id(),name:b.adminName,email:b.adminEmail,role:'admin',active:true,createdAt:stamp()}],tenantIntegrations:[]};state.tenants.push(newTenant);save();return {message:`Tenant "${b.tenantName}" provisionado com sucesso!`,tenant:{id:newTenant.id,name:newTenant.name,databaseName:newTenant.databaseName,admin:newTenant.users[0]}};}
 if(p==='/tenants/setup/migrate'&&method==='POST'){checkSetupPin(req);const out=[];if(b.includeHeart)out.push({tenantId:'__heart__',name:'🫀 Banco Heart (master)',databaseName:'heart',status:'success',output:'Schema Heart validado (modo demonstração local).'});for(const tid of b.tenantIds||[]){const t=state.tenants.find(x=>x.id===tid);out.push({tenantId:tid,name:t?.name||'Tenant',databaseName:t?.databaseName||'demo',status:'success',output:'Schema validado (modo demonstração local).'});}return out;}
 if(p==='/tenants/setup/sql'&&method==='POST'){checkSetupPin(req);const sqlPin=String(req.headers['x-sql-pin']||'').trim();if(sqlPin!==SQL_PIN&&sqlPin!==SETUP_PIN)fail('PIN do SQL editor inválido.',401);if(/pg_tables/i.test(b.sql||''))return {type:'query',columns:['tablename'],rows:[['tenants'],['users'],['products'],['retail_groups'],['sales'],['cash_registers']]};return {type:'query',columns:['id','name','databaseName','status'],rows:state.tenants.map(t=>[t.id,t.name,t.databaseName,t.status]),rowCount:state.tenants.length,durationMs:1};}
 if(p==='/tenants/setup/leadger'&&method==='GET'){checkSetupPin(req);return {config:{source:'pdv_lojista',endpointUrl:'https://leadger.teltech.com.br/api/webhooks/inbound/pdv_lojista',publicBaseUrl:'http://127.0.0.1:3531',configured:false,secretPreview:null},counts:{pending:0,delivering:0,delivered:state.webhookOutbox.length,retry_scheduled:0,failed:0,blocked:0},tenants:state.tenants.map(t=>({...t,clientExternalId:t.clientExternalId||`cli-${t.id}`,baseExternalId:t.baseExternalId||`base-${t.id}`,clientVersion:t.clientVersion||1,baseVersion:t.baseVersion||1,leadgerSyncEnabled:t.leadgerSyncEnabled!==false,_count:{invoices:state.tenantInvoices.filter(i=>i.tenantId===t.id).length,webhookOutboxEvents:state.webhookOutbox.filter(e=>e.tenantId===t.id).length}})),events:state.webhookOutbox};}
 if(p==='/tenants/setup/leadger'&&method==='POST'){checkSetupPin(req,b.pin);if(b.action==='export_reconciliation')return {exportedAt:stamp(),source:'pdv_lojista',totalTenants:state.tenants.length,items:state.tenants.map(t=>({tenantId:t.id,databaseName:t.databaseName,clientExternalId:t.clientExternalId||`cli-${t.id}`,baseExternalId:t.baseExternalId||`base-${t.id}`,name:t.razaoSocial||t.name,tradeName:t.nomeFantasia||t.name,document:t.cnpj||null,email:t.emailContato||t.users?.[0]?.email||null,phone:t.telefone||null,amountCents:Math.round(Number(t.mensalidadeValor||0)*100),nextDueDate:t.mensalidadeVencimento?String(t.mensalidadeVencimento).slice(0,10):null,status:t.status==='active'?'active':'paused',clientVersion:1,baseVersion:1,invoices:state.tenantInvoices.filter(i=>i.tenantId===t.id)}))};if(b.action==='sync_batch')return {totalEligible:state.tenants.length,offset:0,limit:10,processedInBatch:state.tenants.length,nextOffset:state.tenants.length,hasMore:false,delivered:state.tenants.length,blocked:0,results:[]};return {processed:0,delivered:0,valid:true,results:[]};}
 if(p.startsWith('/tenants/setup/')){
  checkSetupPin(req,b.pin);const parts=p.split('/'),tid=parts[3],sub=parts[4],t=state.tenants.find(x=>x.id===tid);if(!t)fail('Empresa não encontrada.',404);
  if(!sub&&method==='PATCH'){Object.assign(t,b);save();return t;}
  if(!sub&&method==='DELETE'){state.tenants=state.tenants.filter(x=>x.id!==tid);save();return {success:true};}
  if(sub==='impersonate'&&method==='POST'){const u=(b.userId&&(t.users||[]).find(x=>x.id===b.userId))||(t.users||[])[0]||{id:'admin-demo',name:'Admin',email:EMAIL,role:'admin'};return {access_token:jwt({sub:u.id,tenantId:t.id,role:u.role||'admin'}),user:{id:u.id,name:u.name,email:u.email,role:u.role||'admin',tenant:t.id,tenantName:t.nomeFantasia||t.name,logoUrl:t.logoUrl||null,termsAccepted:true}};}
  if(sub==='stats'&&method==='GET'){const sales=state.sales.filter(s=>s.status!=='CANCELED');const rev=sales.reduce((n,s)=>n+Number(s.total||0),0);return {tenantId:t.id,databaseName:t.databaseName,dbSizeBytes:14581760,totalProducts:state.products.filter(x=>x.active).length,totalRetailGroups:state.groups.filter(x=>x.active).length,totalCategories:state.categories.length,totalCustomers:state.customers.length,totalSuppliers:0,totalOperators:state.operators.filter(x=>x.active).length,openRegisters:state.registers.filter(x=>x.status==='open').length,totalSales:sales.length,totalSalesToday:sales.length,totalRevenue:rev,revenueToday:rev,totalNfceEmitidas:0,lastSaleAt:sales[sales.length-1]?.createdAt||null,lastSaleTotal:sales[sales.length-1]?.total||null,checkedAt:stamp()};}
  if(sub==='invoices'&&method==='GET')return {invoices:state.tenantInvoices.filter(i=>i.tenantId===tid),paymentHistory:state.paymentLogs.filter(l=>l.tenantId===tid)};
  if(sub==='invoices'&&method==='POST'){const ref=b.referenceMonth||stamp().slice(0,7);const cents=b.amountReais?Math.round(Number(b.amountReais)*100):Math.round(Number(t.mensalidadeValor||0)*100);let inv=state.tenantInvoices.find(i=>i.tenantId===tid&&i.referenceMonth===ref);if(inv){Object.assign(inv,{dueDate:b.dueDate||inv.dueDate,amount:cents,status:b.status||inv.status,description:b.description||inv.description,notes:b.notes||inv.notes,version:(inv.version||1)+1,updatedAt:stamp()});}else{inv={id:id(),externalId:`inv-${tid}-${ref}`,tenantId:tid,referenceMonth:ref,dueDate:b.dueDate||new Date().toISOString(),amount:cents,status:b.status||'pending',paidAt:b.status==='paid'?stamp():null,paymentMethod:b.status==='paid'?(b.paymentMethod||'pix'):null,description:b.description||`Mensalidade ${ref}`,notes:b.notes||null,version:1,createdAt:stamp(),updatedAt:stamp()};state.tenantInvoices.unshift(inv);}save();return {invoice:inv};}
  if(sub==='invoices'&&method==='PATCH'){const inv=state.tenantInvoices.find(i=>i.id===b.invoiceId&&i.tenantId===tid);if(!inv)fail('Fatura não encontrada.',404);if(b.action==='cancel')inv.status='cancelled';else if(b.action==='reopen'){inv.status='pending';inv.paidAt=null;}else{if(b.dueDate)inv.dueDate=b.dueDate;if(b.amountReais!==undefined)inv.amount=Math.round(Number(b.amountReais)*100);if(b.description!==undefined)inv.description=b.description;if(b.notes!==undefined)inv.notes=b.notes;}inv.version=(inv.version||1)+1;inv.updatedAt=stamp();save();return {invoice:inv};}
  if(sub==='users'&&method==='GET')return t.users||[];
  if(sub==='users'&&method==='POST'){const u={id:id(),name:b.name,email:b.email,role:String(b.role||'operator').toLowerCase(),pin:b.pin||null,active:true,createdAt:stamp()};t.users=(t.users||[]).concat(u);save();return u;}
  if(sub==='users'&&parts[5]&&!parts[6]&&method==='PATCH'){const u=(t.users||[]).find(x=>x.id===parts[5]);if(!u)fail('Usuário não encontrado.',404);if(b.name!==undefined)u.name=b.name;if(b.email!==undefined)u.email=b.email;if(b.role!==undefined)u.role=String(b.role).toLowerCase();if(b.active!==undefined)u.active=Boolean(b.active);if(b.pin!==undefined)u.pin=b.pin||null;save();return u;}
  if(sub==='users'&&parts[5]&&!parts[6]&&method==='DELETE'){if((t.users||[]).length<=1)fail('Não é possível excluir o único usuário da empresa.');t.users=(t.users||[]).filter(x=>x.id!==parts[5]);save();return {success:true};}
  if(sub==='users'&&(parts[6]==='password'||parts[6]==='pin'))return {success:true};
  if(sub==='registrar-pagamento'&&method==='POST'){if(b.action==='refund'){const lg=state.paymentLogs.find(l=>l.id===b.paymentLogId&&l.tenantId===tid);if(!lg)fail('Pagamento não encontrado.',404);lg.estornado=true;lg.estornadoEm=stamp();t.mensalidadeVencimento=lg.vencimentoAntes;if(lg.invoiceId){const inv=state.tenantInvoices.find(i=>i.id===lg.invoiceId);if(inv){inv.status='pending';inv.paidAt=null;}}state.paymentLogs.unshift({id:id(),tenantId:tid,invoiceId:lg.invoiceId||null,valor:-Math.abs(Number(lg.valor||0)),paymentMethod:lg.paymentMethod||'pix',tipo:'refund',vencimentoAntes:lg.vencimentoApos,vencimentoApos:lg.vencimentoAntes,observacao:`ESTORNO: ${b.observacao||'Estorno manual'}`,createdAt:stamp()});save();return t;}const base=t.mensalidadeVencimento?new Date(t.mensalidadeVencimento):new Date();const next=new Date(base);next.setMonth(next.getMonth()+1);const val=b.valorPago!==undefined?Number(b.valorPago):(Number(t.mensalidadeValor)||0);const pm=b.paymentMethod||'pix';let inv=b.invoiceId?state.tenantInvoices.find(i=>i.id===b.invoiceId):state.tenantInvoices.find(i=>i.tenantId===tid&&i.status==='pending');if(inv){inv.status='paid';inv.paidAt=stamp();inv.paymentMethod=pm;}const log={id:id(),tenantId:tid,invoiceId:inv?.id||null,valor:val,paymentMethod:pm,tipo:'payment',estornado:false,vencimentoAntes:base.toISOString(),vencimentoApos:next.toISOString(),observacao:b.observacao||`Pagamento confirmado (${pm.toUpperCase()})`,createdAt:stamp()};state.paymentLogs.unshift(log);t.mensalidadeVencimento=next.toISOString();t.status='active';save();return t;}
  if(sub==='payment-history'&&method==='GET')return state.paymentLogs.filter(l=>l.tenantId===tid);
  if(sub==='categories'&&method==='GET')return state.categories;
 }
 if(p==='/groups/setup/list'&&method==='GET'){checkSetupPin(req);return state.tenantGroups;}
 if(p==='/groups/setup/create'&&method==='POST'){checkSetupPin(req);const g={id:id(),name:b.name,members:[],users:[],createdAt:stamp()};state.tenantGroups.push(g);save();return g;}
 if(p.startsWith('/groups/setup/')){checkSetupPin(req);const parts=p.split('/'),gid=parts[3],sub=parts[4],itemId=parts[5],g=state.tenantGroups.find(x=>x.id===gid);if(!g)fail('Grupo não encontrado.',404);if(!sub&&method==='PATCH'){if(b.name)g.name=String(b.name).trim();save();return g;}if(!sub&&method==='DELETE'){state.tenantGroups=state.tenantGroups.filter(x=>x.id!==gid);save();return {success:true};}if(sub==='users'&&method==='GET')return g.users||[];if(sub==='users'&&!itemId&&method==='POST'){const u={id:id(),name:b.name,email:b.email,createdAt:stamp()};g.users=(g.users||[]).concat(u);save();return u;}if(sub==='users'&&itemId&&method==='DELETE'){g.users=(g.users||[]).filter(u=>u.id!==itemId);save();return {success:true};}if(sub==='members'&&!itemId&&method==='POST'){for(const og of state.tenantGroups)og.members=(og.members||[]).filter(m=>m.tenantId!==b.tenantId);const tObj=state.tenants.find(x=>x.id===b.tenantId);const m={id:id(),tenantId:b.tenantId,alias:b.alias||tObj?.nomeFantasia||tObj?.name||'',tenant:tObj};g.members=(g.members||[]).concat(m);save();return m;}if(sub==='members'&&itemId&&method==='DELETE'){g.members=(g.members||[]).filter(m=>m.tenantId!==itemId);save();return {success:true};}}
 if(p.startsWith('/groups/my/')){
  let curTid=tenant;try{const tok=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').split('.')[1];if(tok){const pl=JSON.parse(Buffer.from(tok,'base64url').toString('utf8'));if(pl?.tenantId)curTid=pl.tenantId;}}catch{}
  let grp=state.tenantGroups.find(g=>(g.members||[]).some(m=>m.tenantId===curTid))||state.tenantGroups[0];
  if(!grp){const t0=state.tenants.find(x=>x.id===curTid)||state.tenants[0];grp={id:'group-demo-local',name:`Rede ${t0?.nomeFantasia||t0?.name||'Demonstração'}`,members:[{id:id(),tenantId:t0.id,alias:t0.nomeFantasia||t0.name,tenant:t0}],users:[],createdAt:stamp()};state.tenantGroups.push(grp);save();}
  const members=(grp.members||[]).map(m=>{const tObj=state.tenants.find(x=>x.id===m.tenantId)||m.tenant||state.tenants[0];return {...m,tenant:tObj,label:m.alias||tObj?.nomeFantasia||tObj?.name||'Loja'};});
  const tenantLabels=Object.fromEntries(members.map(m=>[m.tenantId,m.label]));
  if(p==='/groups/my/context'&&method==='GET')return {hasGroup:true,groupId:grp.id,groupName:grp.name,currentTenantId:curTid,members:members.map(m=>({tenantId:m.tenantId,alias:m.label,name:m.tenant?.nomeFantasia||m.tenant?.name||'Loja',razaoSocial:m.tenant?.razaoSocial||null,logoUrl:m.tenant?.logoUrl||null,status:m.tenant?.status||'active',isCurrent:m.tenantId===curTid}))};
  if(p==='/groups/my/switch-tenant'&&method==='POST'){const target=members.find(m=>m.tenantId===b.tenantId);if(!target)fail('Loja não pertence à rede.',403);return {access_token:jwt({sub:'admin-demo',tenantId:target.tenantId,role:'admin',groupId:grp.id}),user:{id:'admin-demo',email:EMAIL,name:'Administrador de demonstração',role:'admin',groupId:grp.id,tenant:target.tenantId,tenantName:target.label,logoUrl:target.tenant?.logoUrl||null,termsAccepted:true,isDemo:true}};}
  if(p==='/groups/my/link-store'&&method==='POST'){const found=state.tenants.find(t=>(t.users||[]).some(u=>String(u.email||'').toLowerCase()===String(b.email||'').trim().toLowerCase()));if(!found)fail('Credenciais inválidas para a filial informada.');if(!(grp.members||[]).some(m=>m.tenantId===found.id)){grp.members.push({id:id(),tenantId:found.id,alias:b.alias||found.nomeFantasia||found.name,tenant:found});save();}return {hasGroup:true,groupId:grp.id,groupName:grp.name,currentTenantId:curTid,members:grp.members};}
  if(p==='/groups/my/settings'&&method==='PATCH'){if(b.name)grp.name=String(b.name).trim();if(Array.isArray(b.memberAliases)){for(const ma of b.memberAliases){const mm=(grp.members||[]).find(m=>m.tenantId===ma.tenantId);if(mm&&ma.alias)mm.alias=String(ma.alias).trim();}}save();return {hasGroup:true,groupId:grp.id,groupName:grp.name};}
  if(p.startsWith('/groups/my/members/')&&method==='DELETE'){const rmTid=p.split('/')[4];if((grp.members||[]).length<=1)fail('A rede precisa manter pelo menos uma loja ativa.');grp.members=(grp.members||[]).filter(m=>m.tenantId!==rmTid);save();return {hasGroup:true,groupId:grp.id,groupName:grp.name};}
  if(p==='/groups/my/dashboard'&&method==='GET'){
   const sales=state.sales.filter(s=>s.status!=='CANCELED'&&s.status!=='cancelled');const todayKey=stamp().slice(0,10);
   const totalMonth=money(sales.reduce((n,s)=>n+Number(s.total||0),0));const salesTodayArr=sales.filter(s=>String(s.createdAt||'').slice(0,10)===todayKey);const totalToday=money(salesTodayArr.reduce((n,s)=>n+Number(s.total||0),0));
   const topMap=new Map();for(const s of sales)for(const it of s.items||[]){const pr=state.products.find(x=>x.id===it.productId);const nm=pr?.name||it.productName||'Mercadoria';const cur=topMap.get(nm)||{productId:it.productId,name:nm,imageUrl:pr?.imageUrl||null,totalQty:0};cur.totalQty+=Number(it.quantity||0);topMap.set(nm,cur);}
   const topProducts=[...topMap.values()].sort((a,b)=>b.totalQty-a.totalQty).slice(0,10);
   const byDate=new Map(),byHour=new Map(),payMap=new Map();
   for(const s of sales){const d=String(s.createdAt||stamp()).slice(0,10);byDate.set(d,money((byDate.get(d)||0)+Number(s.total||0)));const hr=`${String(new Date(s.createdAt||stamp()).getHours()).padStart(2,'0')}:00`;byHour.set(hr,money((byHour.get(hr)||0)+Number(s.total||0)));for(const pm of s.payments||[]){const k=pm.label||pm.method||'Pix';payMap.set(k,money((payMap.get(k)||0)+Number(pm.value||0)));}}
   return {groupId:grp.id,groupName:grp.name,tenants:members.map((m,idx)=>({tenantId:m.tenantId,alias:m.label,salesToday:idx===0?totalToday:0,salesMonth:idx===0?totalMonth:0,countToday:idx===0?sales.length:0,topProducts:idx===0?topProducts:[]})),salesByDate:[...byDate.entries()].map(([date,total])=>({date,total})),salesByHour:[...byHour.entries()].map(([hour,total])=>({hour,total})),salesByDayOfWeek:[],salesByWeek:[],salesByMonth:[],payments:[...payMap.entries()].map(([method,total])=>({method,total}))};
  }
  if(p.startsWith('/groups/my/tenant-detail/')&&method==='GET'){const detTid=p.split('/')[4],m=members.find(x=>x.tenantId===detTid)||members[0];const sales=state.sales.slice(-8).reverse();return {tenantId:detTid,alias:m?.label||'Loja',recentSales:sales.map(s=>({id:s.id,total:Number(s.total||0),createdAt:s.createdAt,itemsCount:(s.items||[]).length,firstItems:(s.items||[]).slice(0,3).map(i=>state.products.find(pr=>pr.id===i.productId)?.name||i.productName||'Mercadoria'),payments:s.payments||[]})),criticalStock:state.products.filter(pr=>pr.active&&pr.stock<3).slice(0,10).map(pr=>({id:pr.id,name:pr.name,stock:pr.stock,unit:pr.unit||'UN'}))};}
  if(p==='/groups/my/stock'&&method==='GET'){const rows=state.products.filter(pr=>pr.active).map(pr=>({name:pr.name,groupName:state.groups.find(g=>g.id===pr.retailGroupId)?.name||null,size:pr.size||null,color:pr.color||null,imageUrl:pr.imageUrl||null,tenants:Object.fromEntries(members.map((m,idx)=>[m.tenantId,{qty:idx===0?Number(pr.stock||0):0,reservedQty:0,availableQty:idx===0?Number(pr.stock||0):0,productId:pr.id,unit:pr.unit||'UN',barcode:pr.barcode||null}]))}));return {groupId:grp.id,groupName:grp.name,tenantLabels,rows};}
  if(p==='/groups/my/stock-adjust'&&method==='POST'){const pr=state.products.find(x=>x.id===b.productId);if(!pr)fail('Mercadoria não encontrada.',404);pr.stock=Math.max(0,Number(b.newStock)||0);save();return {success:true,newStock:pr.stock};}
  if(p==='/groups/my/stock-transfer'&&method==='POST'){const pr=state.products.find(x=>x.id===b.productId);if(!pr)fail('Mercadoria não encontrada.',404);const q=Number(b.quantity)||0;if(q<=0||pr.stock<q)fail('Estoque insuficiente na loja de origem.');pr.stock=Number((pr.stock-q).toFixed(3));save();return {success:true,fromNewStock:pr.stock,toNewStock:q};}
  if(p==='/groups/my/products-catalog'&&method==='GET'){const rows=(state.groups||[]).filter(g=>g.active).map(rg=>{const vars=state.products.filter(pr=>pr.retailGroupId===rg.id&&pr.active);const cat=state.categories.find(c=>c.id===rg.categoryId);const sizes=[...new Set(vars.map(v=>v.size).filter(Boolean))],colors=[...new Set(vars.map(v=>v.color).filter(Boolean))];return {name:rg.name,tenants:Object.fromEntries(members.map(m=>[m.tenantId,{id:rg.id,isRetailGroup:true,priceSell:Number(rg.priceSell||0),priceCost:Number(rg.priceCost||0),stock:vars.reduce((n,v)=>n+Number(v.stock||0),0),variantsCount:vars.length,gradeSummary:`${sizes.join(', ')||'Único'} · ${colors.join(', ')||'Padrão'}`,unit:vars[0]?.unit||'UN',ncm:rg.ncm||null,categoryName:cat?.name||'Geral',imageUrl:rg.imageUrl||null}]))};});return {groupId:grp.id,groupName:grp.name,tenantLabels,rows};}
  if(p==='/groups/my/products/price-per-tenant'&&method==='PATCH'){const rg=(state.groups||[]).find(g=>g.name.toLowerCase()===String(b.productName||'').trim().toLowerCase());if(rg&&Array.isArray(b.updates)&&b.updates[0]){const nextP=Number(b.updates[0].priceSell)||0;rg.priceSell=nextP;for(const v of state.products.filter(pr=>pr.retailGroupId===rg.id))v.priceSell=nextP;save();}return {groupId:grp.id,results:(b.updates||[]).map(u=>({tenantId:u.tenantId,success:true}))};}
  if(p==='/groups/my/products/create-in-tenants'&&method==='POST'){let cat=state.categories.find(c=>c.name.toLowerCase()===String(b.categoryName||'Geral').toLowerCase());if(!cat){cat={id:id(),name:b.categoryName||'Geral',active:true};state.categories.push(cat);}const pSell=Number(b.tenantPrices?.[0]?.priceSell)||0,pCost=Number(b.priceCost)||0;const rg={id:id(),name:String(b.name||'').trim(),categoryId:cat.id,imageUrl:null,priceSell:pSell,priceCost:pCost,active:true,version:1,ncm:b.ncm||null,cest:null,origem:0,grupoTributacaoId:null,createdAt:stamp(),updatedAt:stamp()};state.groups.push(rg);const sizes=String(b.sizes||'Único').split(',').map(s=>s.trim()).filter(Boolean);const colors=String(b.colors||'Padrão').split(',').map(s=>s.trim()).filter(Boolean);for(const sz of (sizes.length?sizes:['Único']))for(const cl of (colors.length?colors:['Padrão']))state.products.push({id:id(),retailGroupId:rg.id,categoryId:cat.id,name:`${rg.name} · ${sz} · ${cl}`,size:sz,color:cl,variantKey:rules.variantIdentity(sz,cl),barcode:null,unit:b.unit||'UN',imageUrl:null,priceSell:pSell,priceCost:pCost,stock:0,active:true});save();return {groupId:grp.id,results:(b.tenantPrices||[]).map(tp=>({tenantId:tp.tenantId,success:true,retailGroupId:rg.id}))};}
  if(p==='/groups/my/products/sync-status'&&method==='GET')return {groupId:grp.id,tenantLabels,hasDifferences:false,missingProducts:[]};
  if(p==='/groups/my/products/sync'&&method==='POST')return {groupId:grp.id,results:[]};
  if(p==='/groups/my/purchase-forecast'&&method==='GET'){const days=Math.max(1,Number(url.searchParams.get('daysToForecast'))||15);const soldMap=new Map();for(const s of state.sales)for(const it of s.items||[])soldMap.set(it.productId,(soldMap.get(it.productId)||0)+Number(it.quantity||0));return state.products.filter(pr=>pr.active).map(pr=>{const sold=soldMap.get(pr.id)||0,avg=Number((sold/30).toFixed(2)),st=Number(pr.stock||0),aut=avg>0?Number((st/avg).toFixed(1)):999,sug=Math.max(0,Math.ceil(avg*days-st));return {productId:pr.id,name:pr.name,totalStock:st,avgDailySales:avg,autonomyDays:aut,suggestion:sug};}).sort((a,b)=>b.suggestion-a.suggestion);}
 }
 if(p==='/sys-init/backups'&&method==='GET'){checkSetupPin(req);return [];}
 if(p==='/sys-init/backups/schedule'){checkSetupPin(req);if(method==='POST'){Object.assign(state.backupSchedule,b);save();}return state.backupSchedule;}
 if(p==='/sys-init/backups/create'&&method==='POST'){checkSetupPin(req);return {message:'Backup local demonstrativo concluído.'};}
 if(p==='/leads')return [];
 if(p==='/tenants/me'){let tid=tenant;try{const tok=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').split('.')[1];if(tok){const pl=JSON.parse(Buffer.from(tok,'base64url').toString('utf8'));if(pl?.tenantId)tid=pl.tenantId;}}catch{}const tCur=state.tenants.find(x=>x.id===tid)||state.tenants[0];const grp=(state.tenantGroups||[]).find(g=>(g.members||[]).some(m=>m.tenantId===(tCur?.id||tid)))||state.tenantGroups?.[0]||null;return {id:tCur?.id||tenant,name:tCur?.name||'Loja Demonstração',nomeFantasia:tCur?.nomeFantasia||tCur?.name||'Loja Demonstração',razaoSocial:tCur?.razaoSocial||'Loja Demonstração — dados fictícios',logoUrl:tCur?.logoUrl||null,status:tCur?.status||'active',tvPublicId:tCur?.tvPublicId||'DEMOLOJA',modulos:tCur?.modulos||{estoque:true,nfce:false,importacaoXml:false,vitrineDigital:true,multiEmpresa:true},nfceAtivo:false,groupId:grp?.id||null,groupName:grp?.name||null,groupMembers:grp?(grp.members||[]).map(m=>{const mt=state.tenants.find(x=>x.id===m.tenantId)||m.tenant;return {tenantId:m.tenantId,alias:m.alias||mt?.nomeFantasia||mt?.name||'Loja',name:mt?.nomeFantasia||mt?.name||'Loja',logoUrl:mt?.logoUrl||null,status:mt?.status||'active'};}):[]};}
 if(p.startsWith('/tenants/me/verify-')){if(b.pin!==PIN)fail('O PIN da demonstração é 1234.');return {valid:true,pinAuthToken:jwt({type:'pin-auth',registerId:b.registerId})};}
 if(p==='/operators'&&method==='GET')return state.operators.map(o=>({...o,pin:undefined,hasOpenRegister:state.registers.some(r=>r.status==='open')}));
 if(p==='/operators'&&method==='POST'){if(!b.name||!/^\d{4,6}$/.test(b.pin))fail('Informe nome e PIN de 4 a 6 dígitos.');const op={id:id(),name:b.name,pin:b.pin,jobTitle:b.jobTitle||'Caixa',imageUrl:b.imageUrl||null,isManager:!!b.isManager,active:true};state.operators.push(op);save();return {...op,pin:undefined};}
 if(p.startsWith('/operators/')){const op=state.operators.find(o=>o.id===p.split('/')[2]);if(!op)fail('Operador não encontrado.',404);if(method==='PATCH'){Object.assign(op,b);save();}return {...op,pin:undefined};}
 if(p==='/categories'){if(method==='POST'){const cat={id:id(),name:rules.retailLabel(b.name,'Categoria',120),icon:b.icon||null,active:b.active!==false,grupoTributacaoId:b.grupoTributacaoId||null};if(state.categories.some(c=>c.name.toLowerCase()===cat.name.toLowerCase()))fail('Categoria já existe.');state.categories.push(cat);save();return {...cat,_count:{retailGroups:0,products:0}};}return state.categories.map(c=>({...c,active:c.active!==false,_count:{retailGroups:(state.groups||[]).filter(g=>g.categoryId===c.id).length,products:(state.products||[]).filter(pr=>pr.categoryId===c.id).length}}));}
 if(p==='/categories/bulk-status'&&method==='POST'){const ids=Array.isArray(b.ids)?b.ids:[];const act=Boolean(b.active);let n=0;for(const c of state.categories){if(!ids.length||ids.includes(c.id)){c.active=act;n++;}}save();return {updatedCount:n,active:act};}
 if(p.startsWith('/categories/')){const cid=p.split('/')[2],cat=state.categories.find(c=>c.id===cid);if(!cat)fail('Categoria não encontrada.',404);if(method==='PATCH'){if(b.name!==undefined)cat.name=rules.retailLabel(b.name,'Categoria',120);if(b.icon!==undefined)cat.icon=b.icon||null;if(b.active!==undefined)cat.active=Boolean(b.active);if(b.grupoTributacaoId!==undefined)cat.grupoTributacaoId=b.grupoTributacaoId||null;save();return {...cat,active:cat.active!==false,_count:{retailGroups:(state.groups||[]).filter(g=>g.categoryId===cat.id).length,products:(state.products||[]).filter(pr=>pr.categoryId===cat.id).length}};}if(method==='DELETE'){if(state.products.some(pr=>pr.categoryId===cid)||state.groups.some(gr=>gr.categoryId===cid))fail('Não é possível excluir uma categoria que possui produtos vinculados.');state.categories=state.categories.filter(c=>c.id!==cid);save();return {deleted:true};}return cat;}
 if(p==='/tributacao')return [];
 if(p==='/products/settings'){if(method==='PATCH'){Object.assign(state.settings,b);save();}return state.settings;}
 if(p==='/products'){let products=state.products.filter(p=>p.active&&state.groups.find(g=>g.id===p.retailGroupId)?.active!==false);const term=(url.searchParams.get('search')||'').toLowerCase();if(term)products=products.filter(p=>`${p.name} ${p.barcode}`.toLowerCase().includes(term));return listPage(products.map(decorateProduct),url);}
 if(p==='/retail/ungrouped')return state.products.filter(p=>!p.retailGroupId&&p.active);
 if(p==='/retail/groups'&&method==='GET'){let rows=state.groups.filter(g=>url.searchParams.get('inactive')==='true'||g.active);const term=(url.searchParams.get('search')||'').toLowerCase();if(term)rows=rows.filter(g=>`${g.name} ${state.products.filter(p=>p.retailGroupId===g.id).map(p=>`${p.size} ${p.color} ${p.barcode}`).join(' ')}`.toLowerCase().includes(term));return listPage(rows.map(decorateGroup),url);}
 if((p==='/retail/groups'&&method==='POST')||(p.startsWith('/retail/groups/')&&method==='PUT')){
  const groupId=method==='PUT'?p.split('/')[3]:id(),old=state.groups.find(g=>g.id===groupId);if(method==='PUT'&&!old)fail('Grupo não encontrado.',404);if(old&&old.version!==b.version)fail('Reabra o grupo: a versão foi alterada.',409);
  const name=rules.retailLabel(b.name,'Nome',120),priceSell=money(rules.retailNumber(b.priceSell,'Preço')),priceCost=rules.retailNumber(b.priceCost||0,'Custo');if(!state.categories.some(c=>c.id===b.categoryId))fail('Categoria inválida.');if(!b.variants?.length)fail('Cadastre a grade.');
  if(state.groups.some(g=>g.id!==groupId&&g.name.toLowerCase()===name.toLowerCase()))fail('Nome de grupo já cadastrado.');
  const keys=new Set();const pending=[];for(const v of b.variants){const size=rules.retailLabel(v.size,'Tamanho',40),color=rules.retailLabel(v.color,'Cor',60),key=rules.variantIdentity(size,color);if(keys.has(key))fail('Tamanho e cor repetidos.');keys.add(key);const previous=v.id?state.products.find(p=>p.id===v.id&&p.retailGroupId===groupId):null;if(v.id&&!previous)fail('Variação inválida.');const barcode=v.barcode?.trim()||null;if(barcode&&state.products.some(p=>p.id!==v.id&&p.barcode===barcode))fail('Código já cadastrado.');const addition=rules.retailNumber(v.stockToAdd||0,'Entrada',true);pending.push({...previous,id:previous?.id||id(),name:`${name} · ${size} · ${color}`,retailGroupId:groupId,size,color,barcode,shortCode:previous?.shortCode||null,categoryId:b.categoryId,priceSell,priceCost,imageUrl:b.imageUrl||null,unit:'UN',active:v.active!==false,stock:(previous?.stock||0)+addition,salesCount:previous?.salesCount||0});}
  const group={...old,id:groupId,name,categoryId:b.categoryId,imageUrl:b.imageUrl||null,priceSell,priceCost,ncm:b.ncm||null,cest:b.cest||null,origem:b.origem||0,grupoTributacaoId:b.grupoTributacaoId||null,active:b.active!==false,version:(old?.version||0)+1,createdAt:old?.createdAt||stamp(),updatedAt:stamp()};
  state.groups=state.groups.filter(g=>g.id!==groupId).concat(group);state.products=state.products.filter(p=>p.retailGroupId!==groupId).concat(pending);save();return decorateGroup(group);
 }
 if(p.startsWith('/retail/groups/')){const group=state.groups.find(g=>g.id===p.split('/')[3]);if(!group)fail('Grupo não encontrado.',404);return decorateGroup(group);}
 if(p==='/customers'){if(method==='POST'){if(!b.name||!b.phone)fail('Informe nome e telefone.');if(state.customers.some(c=>c.phone===b.phone))fail('Telefone já cadastrado.');const c={id:id(),name:b.name,phone:b.phone};state.customers.push(c);save();return c;}return state.customers;}
 if(p==='/payment-methods/settings')return {dinheiro:{emitirNfce:false},pix:{emitirNfce:false},credito:{emitirNfce:false},debito:{emitirNfce:false},credito_loja:{emitirNfce:false}};
 if(p==='/payment-methods')return state.methods;
 if(p.startsWith('/retail/credits/'))return state.credits.filter(c=>c.customerId===p.split('/')[3]&&c.balance>0);
 if(p==='/sales/checkout'){
  const key=b.idempotencyKey||b.localId;if(!key)fail('Operação sem identificação.');const hash=fingerprint(b),existing=state.sales.find(s=>s.id===key);if(existing){if(existing.fingerprint!==hash)fail('Operação já existe com outro conteúdo.',409);return decorateSale(existing);}
  if(!state.registers.some(r=>r.id===b.cashRegisterId&&r.status==='open'))fail('Abra o caixa.');const items=[];let subtotal=0;const demand=new Map();for(const row of b.items||[]){const p=state.products.find(p=>p.id===row.productId&&p.active);const qty=Number(row.quantity);if(!p||!Number.isInteger(qty)||qty<=0)fail('Item inválido.');demand.set(p.id,(demand.get(p.id)||0)+qty);if(!state.settings.allowNegativeStock&&demand.get(p.id)>p.stock)fail(`Saldo insuficiente: ${p.name}`);const price=Number(row.priceUnit);if(!Number.isFinite(price)||price<0)fail('Preço inválido.');subtotal=money(subtotal+price*qty);items.push({id:id(),productId:p.id,productName:p.name,unit:'UN',quantity:qty,priceUnit:price,priceCost:p.priceCost,subtotal:money(price*qty),retailReturnItems:[]});}
  const total=money(subtotal-Number(b.discount||0));if(!items.length||total<=0||Math.abs(total-money((b.payments||[]).reduce((n,p)=>n+Number(p.value),0)))>.009)fail('Confira os itens e pagamentos.');const creditDemand=new Map();for(const pay of b.payments){if(Number(pay.value)<=0)fail('Pagamento inválido.');if(pay.method==='credito_loja'){const credit=state.credits.find(c=>c.id===pay.creditId&&c.customerId===b.customerId);const value=money((creditDemand.get(pay.creditId)||0)+Number(pay.value));if(!credit||credit.balance<value)fail('Crédito indisponível ou saldo insuficiente.');creditDemand.set(credit.id,value);}}
  for(const [pid,quantity]of demand){const p=state.products.find(p=>p.id===pid);p.stock-=quantity;p.salesCount+=quantity;}for(const [cid,amount]of creditDemand)state.credits.find(c=>c.id===cid).balance=money(state.credits.find(c=>c.id===cid).balance-amount);
  const sale={id:key,fingerprint:hash,code:Math.max(0,...state.sales.map(s=>s.code))+1,customerId:b.customerId||null,operatorId:b.operatorId,cashRegisterId:b.cashRegisterId,subtotal,discount:Number(b.discount||0),total,items,payments:b.payments,status:'completed',source:'pdv',emitirNfce:false,nfceStatus:null,createdAt:stamp()};state.sales.push(sale);save();return decorateSale(sale);
 }
 if(p.startsWith('/retail/returns/sale/')){const ref=decodeURIComponent(p.split('/').pop());const sale=state.sales.find(s=>s.id===ref||String(s.code)===ref);if(!sale)fail('Venda não encontrada.',404);return decorateSale(sale);}
 if(p==='/retail/returns'&&method==='POST'){
  const existing=state.returns.find(r=>r.requestKey===b.requestKey);if(existing)return {...existing,credit:state.credits.find(c=>c.returnId===existing.id)};const sale=state.sales.find(s=>s.id===b.saleId&&s.status==='completed');if(!sale)fail('Venda não encontrada.');if(!state.customers.some(c=>c.id===b.customerId)||sale.customerId&&sale.customerId!==b.customerId)fail('Cliente inválido.');if(!b.reason?.trim()||!b.items?.length)fail('Informe motivo e itens.');const alloc=rules.allocateReturnCents(sale.items,sale.total),rows=[];let total=0;for(const row of b.items){const item=sale.items.find(i=>i.id===row.saleItemId);if(!item||rows.some(i=>i.saleItemId===item.id))fail('Item inválido.');const previous=state.returns.flatMap(r=>r.items).filter(i=>i.saleItemId===item.id).reduce((n,i)=>n+i.quantity,0);const value=rules.partialReturnCents(alloc.get(item.id),item.quantity,previous,Number(row.quantity))/100;rows.push({saleItemId:item.id,productId:item.productId,quantity:Number(row.quantity),restock:row.restock===true,value});total=money(total+value);}if(total<=0)fail('Nenhum valor para crédito.');
  const result={id:id(),requestKey:b.requestKey,saleId:sale.id,customerId:b.customerId,reason:b.reason,total,items:rows,createdAt:stamp()};const credit={id:id(),returnId:result.id,customerId:b.customerId,amount:total,balance:total,createdAt:stamp()};state.returns.push(result);state.credits.push(credit);for(const row of rows)if(row.restock)state.products.find(p=>p.id===row.productId).stock+=row.quantity;save();return {...result,credit};
 }
 if(p==='/retail/returns')return state.returns.map(r=>({...r,customer:state.customers.find(c=>c.id===r.customerId),sale:state.sales.find(s=>s.id===r.saleId),credit:state.credits.find(c=>c.returnId===r.id)})).reverse();
 if(p==='/retail/overview'){const start=url.searchParams.get('startDate'),end=url.searchParams.get('endDate');const inRange=date=>(!start||date.slice(0,10)>=start)&&(!end||date.slice(0,10)<=end);const sales=state.sales.filter(s=>s.status==='completed'&&inRange(s.createdAt)),returns=state.returns.filter(r=>inRange(r.createdAt));const revenue=money(sales.reduce((n,s)=>n+s.total,0)),returned=money(returns.reduce((n,r)=>n+r.total,0));const groups=new Map();for(const s of sales)for(const i of s.items){const product=state.products.find(p=>p.id===i.productId),group=state.groups.find(g=>g.id===product?.retailGroupId);const key=group?.id||i.productId;if(!groups.has(key))groups.set(key,{id:key,name:group?.name||i.productName,quantity:0});groups.get(key).quantity+=i.quantity;}return {revenue,returns:returned,netMerchandise:money(revenue-returned),transactions:sales.length,pieces:sales.flatMap(s=>s.items).reduce((n,i)=>n+i.quantity,0),openRegisters:state.registers.filter(r=>r.status==='open').length,outstandingCredits:money(state.credits.reduce((n,c)=>n+c.balance,0)),topGroups:[...groups.values()].sort((a,b)=>b.quantity-a.quantity).slice(0,10)};}
 if(p==='/retail/intelligence/goals'&&method==='PUT'){state.intelligenceGoals=Object.assign(state.intelligenceGoals||{storeMonthlyGoal:25000,defaultSellerGoal:8000,defaultCommissionPct:3,commissionBasis:'net',maxHealthyDiscountPct:8,maxHealthyReturnPct:10,sellerOverrides:{}},b);save();return state.intelligenceGoals;}
 if(p==='/retail/intelligence'&&method==='GET'){const start=url.searchParams.get('startDate')||stamp().slice(0,8)+'01',end=url.searchParams.get('endDate')||stamp().slice(0,10);const inRange=date=>(!start||date.slice(0,10)>=start)&&(!end||date.slice(0,10)<=end);const sales=state.sales.filter(s=>s.status==='completed'&&inRange(s.createdAt)),returns=state.returns.filter(r=>inRange(r.createdAt));const goalsConfig=state.intelligenceGoals||{storeMonthlyGoal:25000,defaultSellerGoal:8000,defaultCommissionPct:3,commissionBasis:'net',maxHealthyDiscountPct:8,maxHealthyReturnPct:10,sellerOverrides:{}};const sellers=(state.operators||[]).map(op=>{const opSales=sales.filter(s=>s.operatorId===op.id);const opRets=returns.filter(r=>{const sl=state.sales.find(x=>x.id===r.saleId);return (sl?.operatorId||r.operatorId)===op.id;});const gross=money(opSales.reduce((n,s)=>n+Number(s.total||0),0)),retAmt=money(opRets.reduce((n,r)=>n+Number(r.total||0),0)),net=money(gross-retAmt),disc=money(opSales.reduce((n,s)=>n+Number(s.discount||0),0)),sub=money(opSales.reduce((n,s)=>n+Number(s.subtotal||s.total||0),0)),pcs=opSales.flatMap(s=>s.items||[]).reduce((n,i)=>n+Number(i.quantity||0),0);return {operatorId:op.id,name:op.name,jobTitle:op.jobTitle||'Consultor(a)',isManager:!!op.isManager,active:op.active!==false,imageUrl:op.imageUrl||null,grossRevenue:gross,returnsAmount:retAmt,returnsCount:opRets.length,returnedPieces:opRets.flatMap(r=>r.items||[]).reduce((n,i)=>n+Number(i.quantity||0),0),netRevenue:net,sharePct:100,netSharePct:100,salesCount:opSales.length,piecesCount:pcs,pa:opSales.length?money(pcs/opSales.length):0,multiItemSalesCount:opSales.length,multiItemRatePct:100,avgTicket:opSales.length?money(gross/opSales.length):0,avgPiecePrice:pcs?money(gross/pcs):0,subtotalBeforeDiscount:sub,discountTotal:disc,discountRatePct:sub?money(disc/sub*100):0,discountedSalesCount:opSales.filter(s=>Number(s.discount||0)>0).length,discountedSalesRatePct:0,returnRatePct:gross?money(retAmt/gross*100):0,returnPiecesRatePct:0,returnReasons:[],estimatedMargin:money(gross*0.5),marginRatePct:50,identifiedSalesCount:opSales.filter(s=>s.customerId).length,identifiedRatePct:100,uniqueCustomersCount:1,activeDaysCount:1,dailyWinsCount:1,winRatePct:100,top25DaysCount:1,bestDay:opSales.length?{date:opSales[0].createdAt.slice(0,10),revenue:gross,netRevenue:net,salesCount:opSales.length,piecesCount:pcs}:null,bestWeekday:null,peakHour:null,goal:goalsConfig.defaultSellerGoal,goalProgressPct:money(net/goalsConfig.defaultSellerGoal*100),commissionPct:goalsConfig.defaultCommissionPct,estimatedCommission:money(net*goalsConfig.defaultCommissionPct/100),topCategories:[],topGroups:[],dailyHistory:[],recentSales:[],recentReturns:[]};});const grossTotal=money(sellers.reduce((n,s)=>n+s.grossRevenue,0)),retTotal=money(sellers.reduce((n,s)=>n+s.returnsAmount,0)),netTotal=money(grossTotal-retTotal);return {startDate:start,endDate:end,summary:{grossRevenue:grossTotal,returnsTotal:retTotal,returnsCount:returns.length,returnedPieces:0,netRevenue:netTotal,totalDiscounts:0,discountRatePct:0,discountedSalesCount:0,returnRatePct:0,totalSales:sales.length,totalPieces:sellers.reduce((n,s)=>n+s.piecesCount,0),pa:2,multiItemRatePct:100,avgTicket:grossTotal,identifiedCustomerRatePct:100,estimatedGrossMargin:money(grossTotal*0.5),marginRatePct:50,activeSellersCount:sellers.length,totalSellersCount:sellers.length,activeDaysCount:1,storeGoal:goalsConfig.storeMonthlyGoal,storeGoalProgressPct:money(netTotal/goalsConfig.storeMonthlyGoal*100),totalEstimatedCommission:money(netTotal*0.03),bestDay:null,topSeller:sellers[0]||null},goalsConfig,sellers,calendar:{days:[{date:end,weekday:0,weekdayLabel:'Domingo',hasSales:sales.length>0,revenue:grossTotal,netRevenue:netTotal,discountTotal:0,discountRatePct:0,returnsTotal:retTotal,returnsCount:returns.length,salesCount:sales.length,piecesCount:sellers.reduce((n,s)=>n+s.piecesCount,0),pa:2,avgTicket:grossTotal,champion:sellers[0]?{operatorId:sellers[0].operatorId,name:sellers[0].name,jobTitle:sellers[0].jobTitle,imageUrl:sellers[0].imageUrl,revenue:sellers[0].grossRevenue,netRevenue:sellers[0].netRevenue,salesCount:sellers[0].salesCount,piecesCount:sellers[0].piecesCount,shareOfDayPct:100}:null,sellerBreakdown:[],sales:[]}]},insights:[]};}
 if(p==='/cash-registers/current')return state.registers.find(r=>r.status==='open'&&r.operatorId===url.searchParams.get('operatorId'))||state.registers.find(r=>r.status==='open')||null;
 if(p==='/cash-registers/open'){const existing=state.registers.find(r=>r.status==='open');if(existing)return existing;const register={id:id(),code:state.registers.length+1,status:'open',operatorId:b.operatorId,openingValue:Number(b.openingValue||0),openingTime:stamp()};state.registers.push(register);save();return register;}
 if(/^\/cash-registers\/[^/]+\/report$/.test(p)){const regId=p.split('/')[2],reg=state.registers.find(r=>r.id===regId);if(!reg)fail('Caixa não encontrado.',404);const regSales=state.sales.filter(s=>s.cashRegisterId===regId),activeSales=regSales.filter(s=>s.status==='completed'),movs=state.movements.filter(m=>m.cashRegisterId===regId);const sumMethod=m=>money(activeSales.flatMap(s=>s.payments||[]).filter(pay=>pay.method===m).reduce((n,pay)=>n+Number(pay.value||0),0));const totalDinheiro=sumMethod('dinheiro'),totalCredito=sumMethod('credito'),totalDebito=sumMethod('debito'),totalPix=sumMethod('pix'),totalSuprimentos=money(movs.filter(m=>m.type==='IN').reduce((n,m)=>n+Number(m.value||0),0)),totalSangrias=money(movs.filter(m=>m.type==='OUT').reduce((n,m)=>n+Number(m.value||0),0));const byOp=new Map();for(const s of activeSales){const op=state.operators.find(o=>o.id===s.operatorId);const k=s.operatorId||'sem-operador';const prev=byOp.get(k)||{operatorId:k,operatorName:op?.name||'Operador',countSales:0,totalSales:0};prev.countSales+=1;prev.totalSales=money(prev.totalSales+Number(s.total||0));byOp.set(k,prev);}return {register:{...reg,operator:state.operators.find(o=>o.id===reg.operatorId)},report:{countSales:activeSales.length,totalVendas:money(activeSales.reduce((n,s)=>n+Number(s.total||0),0)),totalDinheiro,totalCredito,totalDebito,totalPix,totalSuprimentos,totalSangrias,expectedDinheiro:money(Number(reg.openingValue||0)+totalDinheiro+totalSuprimentos-totalSangrias),movements:movs,customMethods:[],salesByOperator:[...byOp.values()],salesDetails:regSales.map(decorateSale).reverse()}};}
 if(/^\/cash-registers\/[^/]+\/close$/.test(p)){const reg=state.registers.find(r=>r.id===p.split('/')[2]);if(!reg)fail('Caixa não encontrado.',404);reg.status='closed';reg.closingTime=stamp();reg.closingValue=b.closingValue;reg.closingDetails=b.closingDetails;save();return reg;}
 if(/^\/cash-registers\/[^/]+\/(conference|audit)$/.test(p)){const reg=state.registers.find(r=>r.id===p.split('/')[2]);if(!reg)fail('Caixa não encontrado.',404);if(b.closingValue!==undefined)reg.closingValue=b.closingValue;if(b.closingDetails)reg.closingDetails=b.closingDetails;if(b.conferenceDetails)reg.conferenceDetails=b.conferenceDetails;save();return reg;}
 if(p==='/cash-registers')return {data:state.registers.map(r=>({...r,operator:state.operators.find(o=>o.id===r.operatorId)})),meta:{page:1,total:state.registers.length,lastPage:1}};
 if(/^\/cash-registers\/[^/]+\/movement$/.test(p)){const movement={id:id(),cashRegisterId:p.split('/')[2],type:b.type,value:Number(b.value),reason:b.reason,createdAt:stamp()};state.movements.push(movement);save();return movement;}
 if(p==='/users')return [{id:'admin-demo',name:'Administrador de demonstração',email:EMAIL,role:'admin',active:true}];
 if(p==='/suppliers/setup/sp-hub'&&method==='GET'){checkSetupPin(req,url.searchParams.get('pin'));return state.spHubSuppliers||[];}
 if(p==='/suppliers/setup/sp-hub/seed'&&method==='POST'){checkSetupPin(req,b.pin);state.spHubSuppliers=buildDefaultSpHub();save();return state.spHubSuppliers;}
 if(p==='/suppliers/setup/sp-hub'&&method==='POST'){checkSetupPin(req,b.pin);const sid=id();const sup={...b,id:sid,active:b.active!==false,items:(b.items||[]).map((it,idx)=>({...it,id:it.id||`${sid}-item-${idx+1}`,supplierId:sid,active:it.active!==false}))};state.spHubSuppliers=(state.spHubSuppliers||[]).concat(sup);save();return sup;}
 if(p.startsWith('/suppliers/setup/sp-hub/')&&method==='PATCH'){checkSetupPin(req,b.pin);const sid=p.split('/')[4],sup=(state.spHubSuppliers||[]).find(x=>x.id===sid);if(!sup)fail('Fornecedor SP não encontrado.',404);Object.assign(sup,b);if(Array.isArray(b.items))sup.items=b.items.map((it,idx)=>({...it,id:it.id||`${sid}-item-${idx+1}`,supplierId:sid,active:it.active!==false}));save();return sup;}
 if(p.startsWith('/suppliers/setup/sp-hub/')&&method==='DELETE'){checkSetupPin(req);const sid=p.split('/')[4];state.spHubSuppliers=(state.spHubSuppliers||[]).filter(x=>x.id!==sid);save();return {deleted:true,id:sid};}
 if(p==='/suppliers/sp-hub'&&method==='GET')return (state.spHubSuppliers||[]).filter(s=>s.active!==false);
 if(p.startsWith('/suppliers/sp-hub/')&&p.endsWith('/import')&&method==='POST'){const sid=p.split('/')[3],hub=(state.spHubSuppliers||[]).find(x=>x.id===sid);if(!hub)fail('Fornecedor SP não encontrado.',404);let loc=(state.suppliers||[]).find(s=>s.name===hub.name);if(!loc){loc={id:id(),name:hub.name,whatsapp:hub.whatsapp,logradouro:hub.address,numero:hub.galleryName||'S/N',bairro:hub.region||'Brás',municipio:'São Paulo',uf:'SP',active:true,createdAt:stamp()};state.suppliers.push(loc);save();return {imported:true,alreadyExisted:false,supplier:loc};}return {imported:true,alreadyExisted:true,supplier:loc};}
 if(p.startsWith('/suppliers/sp-hub/')&&p.endsWith('/order-request')&&method==='POST'){const sid=p.split('/')[3],hub=(state.spHubSuppliers||[]).find(x=>x.id===sid);if(!hub)fail('Fornecedor SP não encontrado.',404);const reqItems=(b.items||[]).filter(i=>Number(i.quantity)>0);if(!reqItems.length)fail('Selecione ao menos 1 peça/grade.');const lines=reqItems.map(ri=>{const ci=(hub.items||[]).find(x=>x.id===ri.itemId)||hub.items[0];const qty=Math.max(Number(ri.quantity)||ci.minPackQty,ci.minPackQty);const lineWholesaleTotal=money(qty*Number(ci.wholesalePrice));const lineSuggestedRevenue=money(qty*Number(ci.suggestedRetailPrice||ci.wholesalePrice*2.2));return {itemId:ci.id,name:ci.name,category:ci.category,quantity:qty,wholesalePrice:Number(ci.wholesalePrice),suggestedRetailPrice:Number(ci.suggestedRetailPrice||0),minPackQty:ci.minPackQty,sizesLabel:ci.sizesLabel,lineWholesaleTotal,lineSuggestedRevenue};});const totalWholesale=money(lines.reduce((n,l)=>n+l.lineWholesaleTotal,0));const totalSuggestedRevenue=money(lines.reduce((n,l)=>n+l.lineSuggestedRevenue,0));let loc=(state.suppliers||[]).find(s=>s.name===hub.name);if(!loc){loc={id:id(),name:hub.name,whatsapp:hub.whatsapp,logradouro:hub.address,numero:hub.galleryName||'S/N',bairro:hub.region||'Brás',municipio:'São Paulo',uf:'SP',active:true,createdAt:stamp()};state.suppliers.push(loc);}const po={id:id(),supplierId:loc.id,status:'SENT',totalEstimated:totalWholesale,totalReal:0,createdAt:stamp()};state.purchaseOrders.unshift(po);save();const protocolCode=`ATK-SP-${po.id.slice(0,6).toUpperCase()}`;const cleanPhone=String(hub.whatsapp||'').replace(/\D/g,'');const wp=cleanPhone.startsWith('55')?cleanPhone:`55${cleanPhone}`;return {protocolCode,purchaseOrderId:po.id,supplierId:loc.id,supplierName:hub.name,deliveryMode:b.deliveryMode||'GUARANTEED_DELIVERY',deliveryLabel:'Entrega Garantida PDV Lojista',totalWholesale,totalSuggestedRevenue,estimatedProfit:money(totalSuggestedRevenue-totalWholesale),items:lines,whatsappUrl:`https://wa.me/${wp}?text=${encodeURIComponent(`Pedido ${protocolCode} - ${hub.name} - Total R$ ${totalWholesale.toFixed(2)}`)}`};}
 if(p==='/suppliers'&&method==='GET')return state.suppliers||[];
 if(p==='/suppliers'&&method==='POST'){const s={id:id(),name:b.name,tradeName:b.tradeName||b.name,document:b.document||null,phone:b.phone||null,email:b.email||null,active:true,createdAt:stamp()};state.suppliers.push(s);save();return s;}
 if(p==='/purchase-orders'&&method==='GET')return (state.purchaseOrders||[]).map(po=>({...po,supplier:(state.suppliers||[]).find(s=>s.id===po.supplierId)||null}));
 if(p==='/payables'&&method==='GET')return {data:(state.payables||[]).map(pay=>({...pay,supplier:(state.suppliers||[]).find(s=>s.id===pay.supplierId)||null})),meta:{page:1,lastPage:1,total:(state.payables||[]).length}};
 if(p==='/payables'&&method==='POST'){const pay={id:id(),description:b.description,category:b.category||'Geral',supplierId:b.supplierId||null,amount:Number(b.amount||0),dueDate:b.dueDate||stamp(),paidAt:b.status==='PAID'?stamp():null,status:b.status||'PENDING',paymentMethod:b.paymentMethod||'pix',isFixed:Boolean(b.isFixed),createdAt:stamp()};state.payables.unshift(pay);save();return pay;}
 if(p.startsWith('/payables/')&&method==='PATCH'){const pid=p.split('/')[2],pay=(state.payables||[]).find(x=>x.id===pid);if(!pay)fail('Conta não encontrada.',404);Object.assign(pay,b);if(b.status==='PAID'&&!pay.paidAt)pay.paidAt=stamp();save();return pay;}
 if(p.startsWith('/payables/')&&method==='DELETE'){const pid=p.split('/')[2];state.payables=(state.payables||[]).filter(x=>x.id!==pid);save();return {deleted:true};}
 if(p==='/sales'||p==='/sales/today')return listPage(state.sales.map(decorateSale).reverse(),url);
 if(p==='/vitrine/themes')return [{slug:'dark_premium',name:'Noite Imperial'},{slug:'purple_luxury',name:'Editorial Roxo'},{slug:'light_clean',name:'Vitrine Clara'},{slug:'neon_night',name:'Palco Urbano'},{slug:'dark_glass',name:'Vidro Fumê'},{slug:'carbon_fiber',name:'Grafite Puro'}];
 if(p==='/vitrine/config'&&method==='GET'){const tCur=state.tenants[0];return {...state.vitrineConfig,tvPublicId:tCur?.tvPublicId||'DEMOLOJA',storeName:tCur?.nomeFantasia||tCur?.name||'Loja Demonstração',tenantLogoUrl:tCur?.logoUrl||null};}
 if(p==='/vitrine/catalog'&&method==='GET'){
  const items=(state.groups||[]).filter(g=>g.active).map(g=>{const vars=(state.products||[]).filter(pr=>pr.retailGroupId===g.id&&pr.active);const cat=(state.categories||[]).find(c=>c.id===g.categoryId);return {id:`group:${g.id}`,productId:vars[0]?.id||g.id,retailGroupId:g.id,name:g.name,categoryId:g.categoryId,categoryName:cat?.name||null,priceSell:g.priceSell,imageUrl:g.imageUrl,sizesAvailable:[...new Set(vars.filter(v=>v.stock>0).map(v=>v.size).filter(Boolean))],colorsAvailable:[...new Set(vars.filter(v=>v.stock>0).map(v=>v.color).filter(Boolean))],stockTotal:vars.reduce((n,v)=>n+(v.stock||0),0)};});
  return {items};
 }
 if(p==='/vitrine/draft'&&method==='PUT'){Object.assign(state.vitrineConfig,{draftSlides:Array.isArray(b.slides)?b.slides:state.vitrineConfig.draftSlides,theme:b.theme||state.vitrineConfig.theme,customBgUrl:b.customBgUrl!==undefined?b.customBgUrl:state.vitrineConfig.customBgUrl,showLogo:b.showLogo!==undefined?Boolean(b.showLogo):state.vitrineConfig.showLogo,logoPosition:b.logoPosition||state.vitrineConfig.logoPosition,instagramHandle:b.instagramHandle!==undefined?b.instagramHandle:state.vitrineConfig.instagramHandle,storeTagline:b.storeTagline!==undefined?b.storeTagline:state.vitrineConfig.storeTagline,slideDuration:Number(b.slideDuration)||state.vitrineConfig.slideDuration,gridSlideDuration:Number(b.gridSlideDuration)||state.vitrineConfig.gridSlideDuration});save();return {ok:true,draftSlides:state.vitrineConfig.draftSlides};}
 if(p==='/vitrine/publish'&&method==='POST'){state.vitrineConfig.publishedSlides=[...(state.vitrineConfig.draftSlides||[])];state.vitrineConfig.publishedVersion=(state.vitrineConfig.publishedVersion||0)+1;state.vitrineConfig.publishedAt=stamp();state.vitrineConfig.active=true;save();return {ok:true,version:state.vitrineConfig.publishedVersion,publishedAt:state.vitrineConfig.publishedAt,slidesCount:state.vitrineConfig.publishedSlides.length};}
 if(p==='/vitrine/active'&&method==='PATCH'){state.vitrineConfig.active=Boolean(b.active);save();return {ok:true,active:state.vitrineConfig.active};}
 if(p.startsWith('/vitrine/public/')&&method==='GET'){const code=decodeURIComponent(p.split('/')[3]||'').toUpperCase();const tCur=state.tenants.find(t=>String(t.tvPublicId||'DEMOLOJA').toUpperCase()===code)||state.tenants[0];if(!tCur||code!=='DEMOLOJA'&&String(tCur.tvPublicId||'').toUpperCase()!==code)fail('Vitrine não encontrada.',404);const vc=state.vitrineConfig;return {active:Boolean(vc.active),version:vc.publishedVersion||1,storeName:tCur.nomeFantasia||tCur.name||'Loja Demonstração',storeTagline:vc.storeTagline,theme:vc.theme||'dark_premium',customBgUrl:vc.customBgUrl||null,showLogo:vc.showLogo!==false,logoPosition:vc.logoPosition||'top-right',logoUrl:vc.logoUrl||tCur.logoUrl||null,instagramHandle:vc.instagramHandle||null,slideDuration:vc.slideDuration||8,gridSlideDuration:vc.gridSlideDuration||14,slides:vc.publishedSlides||[]};}
 if(p.startsWith('/storefront/')){
  if(!state.storefront)state.storefront=buildInitialStorefront(state);
  const sf=state.storefront;
  const syncSfCatalog=()=>{
   for(const c of state.categories||[]){if(!sf.categories.some(sc=>sc.categoryId===c.id))sf.categories.push({id:`sc-${sf.categories.length+1}`,categoryId:c.id,slug:sfRules.normalizeStorefrontSlug(c.name)||`cat-${sf.categories.length+1}`,displayName:c.name,description:'',visible:true,featured:false,sortOrder:(sf.categories.length+1)*10});}
   for(const g of state.groups||[]){if(!sf.products.some(sp=>sp.retailGroupId===g.id))sf.products.push({id:`sp-${sf.products.length+1}`,retailGroupId:g.id,publicSlug:sfRules.buildProductPublicSlug(g.name,g.id),visible:true,featured:false,sortOrder:(sf.products.length+1)*10,commercialTitle:g.name,commercialDescription:'',badgeLabel:null,galleryUrlsJson:g.imageUrl?[g.imageUrl]:[]});}
  };
  syncSfCatalog();
  const formatSfSettings=()=>{
   const s=sf.settings;
   const draftTheme=sfRules.validateAndSanitizeTheme(s.draftThemeJson,s.storeName);
   const publishedTheme=sfRules.validateAndSanitizeTheme(s.publishedThemeJson,s.storeName);
   const pubVer=Number(s.publishedVersion||0);
   const isPub=Boolean(s.isPublished);
   const diff=sfRules.summarizeThemeChanges(draftTheme,pubVer>0?publishedTheme:null,isPub);
   return {
    publicId:s.publicId,slug:s.slug,publicPath:`/loja/${s.slug}`,storeName:s.storeName,tagline:s.tagline||'',description:s.description||'',logoUrl:s.logoUrl||null,coverUrl:s.coverUrl||null,whatsappPhone:s.whatsappPhone||'',whatsappMessageIntro:s.whatsappMessageIntro||'',pickupEnabled:Boolean(s.pickupEnabled),pickupInstructions:s.pickupInstructions||'',deliveryEnabled:Boolean(s.deliveryEnabled),deliveryInstructions:s.deliveryInstructions||'',deliveryNotes:s.deliveryInstructions||'',deliveryFeeNote:s.deliveryFeeNote||'',deliveryFeeDefault:0,expressDeliveryModuleEnabled:true,expressDelivery:{enabled:false,effectivelyActive:false,baseFee:8.9,baseIncludedKm:2,feePerAdditionalKm:2.5,maxRadiusKm:15,motoEnabled:true,carEnabled:true,carSurcharge:6,minOrderAmount:0,freeShippingAbove:200,estimatedPrepMinutes:15,neighborhoodOverrides:[],apiIntegration:{mode:'MANUAL_APP_99',environment:'sandbox',autoRequestOnConfirm:false,hasCorporateToken:false,corporateTokenMasked:null}},confirmReservationMinutes:Number(s.confirmReservationMinutes||15),reservationTtlMinutes:Number(s.confirmReservationMinutes||15),confirmedHoldHours:Number(s.confirmedHoldHours||24),draftTheme,publishedTheme,publishedVersion:pubVer,isPublished:isPub,status:isPub?'PUBLISHED':pubVer>0?'PAUSED':'DRAFT',hasUnpublishedChanges:diff.hasChanges,pendingChanges:diff.items,effectivelyOnline:isPub,publishedAt:s.publishedAt||null,publishedByUserId:s.publishedByUserId||'admin-demo',publishedByName:s.publishedByName||'Administrador de demonstração',publishedByImageUrl:null,updatedAt:s.updatedAt||stamp()
   };
  };
  const buildAdminProductDto=(sp)=>{
   const rg=(state.groups||[]).find(g=>g.id===sp.retailGroupId);if(!rg||!rg.active)return null;
   const cat=(state.categories||[]).find(c=>c.id===rg.categoryId);
   const vars=(state.products||[]).filter(pr=>pr.retailGroupId===rg.id&&pr.active!==false);
   const totalStock=vars.reduce((n,v)=>n+Math.max(0,Math.floor(Number(v.stock||0))),0);
   const gallery=Array.isArray(sp.galleryUrlsJson)?sp.galleryUrlsJson:[];
   return {
    retailGroupId:rg.id,storefrontProductId:sp.id,publicSlug:sp.publicSlug,name:rg.name,commercialTitle:sp.commercialTitle||rg.name,commercialDescription:sp.commercialDescription||'',badgeLabel:sp.badgeLabel||'',visible:Boolean(sp.visible),featured:Boolean(sp.featured),sortOrder:Number(sp.sortOrder||0),categoryId:rg.categoryId,categoryName:cat?.name||'Geral',priceSell:Number(rg.priceSell||0),imageUrl:rg.imageUrl||gallery[0]||null,galleryUrls:gallery,physicalStock:totalStock,reservedStock:0,availableStock:totalStock,variantsCount:vars.length,sizes:[...new Set(vars.map(v=>v.size).filter(Boolean))],colors:[...new Set(vars.map(v=>v.color).filter(Boolean))],variants:vars.map(v=>({id:v.id,size:v.size||null,color:v.color||null,barcode:v.barcode||null,physicalStock:Math.max(0,Math.floor(Number(v.stock||0))),reservedStock:0,availableStock:Math.max(0,Math.floor(Number(v.stock||0))),priceSell:Number(rg.priceSell||v.priceSell||0)}))
   };
  };
  const buildPublicProductsList=()=>{
   return (sf.products||[]).filter(sp=>sp.visible).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0)).map(sp=>{
    const rg=(state.groups||[]).find(g=>g.id===sp.retailGroupId);if(!rg||!rg.active)return null;
    const cat=(state.categories||[]).find(c=>c.id===rg.categoryId);
    const vars=(state.products||[]).filter(pr=>pr.retailGroupId===rg.id&&pr.active!==false);
    return sfRules.toPublicProductDto({...sp,retailGroup:{...rg,category:cat,variants:vars}},new Map());
   }).filter(Boolean);
  };
  if(p==='/storefront/admin/pos-alerts'&&method==='GET')return {enabled:true,pendingDeliveryCount:0,activeExpressCount:0,alerts:[]};
  if(p==='/storefront/admin/overview'&&method==='GET'){
   const cfg=formatSfSettings();
   const adminProds=sf.products.map(buildAdminProductDto).filter(Boolean);
   const visCount=adminProds.filter(x=>x.visible).length;
   const featCount=adminProds.filter(x=>x.visible&&x.featured).length;
   const stats={totalRetailGroups:adminProds.length,totalProductsCount:adminProds.length,publishedProductsCount:visCount,visibleProductsCount:visCount,unpublishedProductsCount:Math.max(0,adminProds.length-visCount),featuredProductsCount:featCount,visibleCategoriesCount:sf.categories.filter(c=>c.visible).length,awaitingOrdersCount:0,awaitingConfirmationCount:0,confirmedOrdersCount:0,completedOrdersCount:0,convertedOrdersCount:0,convertedRevenue:0,conflictOrdersCount:0,activeReservationsCount:0,activeReservedUnits:0};
   return {moduleEnabled:true,schemaCompatible:true,missingTables:[],publicPath:`/loja/${sf.settings.slug}`,settings:cfg,config:cfg,stats,metrics:stats,readinessChecklist:[{key:'whatsapp',label:'WhatsApp comercial configurado',done:Boolean(sf.settings.whatsappPhone)},{key:'fulfillment',label:'Modalidade de entrega ou retirada ativa',done:Boolean(sf.settings.pickupEnabled||sf.settings.deliveryEnabled)},{key:'products',label:'Pelo menos 1 produto visível na vitrine',done:visCount>0},{key:'branding',label:'Identidade visual configurada (nome e tema)',done:true}]};
  }
  if(p==='/storefront/admin/settings'&&method==='GET')return formatSfSettings();
  if(p==='/storefront/admin/settings'&&method==='PUT'){
   const s=sf.settings;
   if(b.slug!==undefined&&String(b.slug).trim())s.slug=sfRules.assertValidStorefrontSlug(b.slug);
   if(b.storeName!==undefined&&String(b.storeName).trim())s.storeName=sfRules.sanitizePlainText(b.storeName,140,'Nome da loja');
   if(b.tagline!==undefined)s.tagline=sfRules.sanitizePlainText(b.tagline,240);
   if(b.description!==undefined)s.description=sfRules.sanitizePlainText(b.description,2000);
   if(b.logoUrl!==undefined)s.logoUrl=sfRules.sanitizeSafeImageUrl(b.logoUrl);
   if(b.coverUrl!==undefined)s.coverUrl=sfRules.sanitizeSafeImageUrl(b.coverUrl);
   if(b.whatsappPhone!==undefined)s.whatsappPhone=String(b.whatsappPhone||'').trim()?sfRules.normalizeWhatsappPhone(b.whatsappPhone):null;
   if(b.whatsappMessageIntro!==undefined)s.whatsappMessageIntro=sfRules.sanitizePlainText(b.whatsappMessageIntro,300);
   if(b.pickupEnabled!==undefined)s.pickupEnabled=Boolean(b.pickupEnabled);
   if(b.pickupInstructions!==undefined)s.pickupInstructions=sfRules.sanitizePlainText(b.pickupInstructions,600);
   if(b.deliveryEnabled!==undefined)s.deliveryEnabled=Boolean(b.deliveryEnabled);
   const delivInstr=b.deliveryInstructions!==undefined?b.deliveryInstructions:b.deliveryNotes;
   if(delivInstr!==undefined)s.deliveryInstructions=sfRules.sanitizePlainText(delivInstr,600);
   if(b.deliveryFeeNote!==undefined)s.deliveryFeeNote=sfRules.sanitizePlainText(b.deliveryFeeNote,240);
   if(b.confirmReservationMinutes!==undefined)s.confirmReservationMinutes=Number(b.confirmReservationMinutes)||15;
   else if(b.reservationTtlMinutes!==undefined)s.confirmReservationMinutes=Number(b.reservationTtlMinutes)||15;
   if(b.confirmedHoldHours!==undefined)s.confirmedHoldHours=Number(b.confirmedHoldHours)||24;
   if(!s.pickupEnabled&&!s.deliveryEnabled)fail('Habilite pelo menos Retirada ou Entrega.');
   s.updatedAt=stamp();save();return formatSfSettings();
  }
  if(p==='/storefront/admin/appearance/draft'&&method==='PUT'){
   const s=sf.settings;
   const rawCandidate=b?.theme??b?.draftTheme??(b&&(b.template||b.sections||b.primaryColor)?b:s.draftThemeJson);
   if(b?.storeName!==undefined&&String(b.storeName).trim())s.storeName=sfRules.sanitizePlainText(b.storeName,140);
   if(b?.logoUrl!==undefined)s.logoUrl=sfRules.sanitizeSafeImageUrl(b.logoUrl);
   if(b?.coverUrl!==undefined)s.coverUrl=sfRules.sanitizeSafeImageUrl(b.coverUrl);
   s.draftThemeJson=sfRules.validateAndSanitizeTheme(rawCandidate,s.storeName);
   s.updatedAt=stamp();save();return formatSfSettings();
  }
  if(p==='/storefront/admin/appearance/publish'&&method==='POST'){
   const s=sf.settings;
   if(b?.settings&&typeof b.settings==='object'){
    if(b.settings.storeName)s.storeName=sfRules.sanitizePlainText(b.settings.storeName,140);
    if(b.settings.slug)s.slug=sfRules.assertValidStorefrontSlug(b.settings.slug);
    if(b.settings.whatsappPhone!==undefined)s.whatsappPhone=String(b.settings.whatsappPhone||'').trim()?sfRules.normalizeWhatsappPhone(b.settings.whatsappPhone):null;
   }
   if(b?.draftTheme&&typeof b.draftTheme==='object')s.draftThemeJson=sfRules.validateAndSanitizeTheme(b.draftTheme,s.storeName);
   if(!s.whatsappPhone)fail('Configure o número de WhatsApp comercial antes de publicar.');
   const validated=sfRules.validateAndSanitizeTheme(s.draftThemeJson,s.storeName);
   s.draftThemeJson=validated;s.publishedThemeJson=JSON.parse(JSON.stringify(validated));
   s.publishedVersion=Number(s.publishedVersion||0)+1;s.isPublished=true;s.publishedAt=stamp();s.updatedAt=stamp();
   save();return formatSfSettings();
  }
  if(p==='/storefront/admin/appearance/unpublish'&&method==='POST'){sf.settings.isPublished=false;sf.settings.updatedAt=stamp();save();return formatSfSettings();}
  if(p==='/storefront/admin/appearance/reactivate'&&method==='POST'){if(Number(sf.settings.publishedVersion||0)<=0)fail('Publique a vitrine pela primeira vez antes de reativá-la.');sf.settings.isPublished=true;sf.settings.updatedAt=stamp();save();return formatSfSettings();}
  if(p==='/storefront/admin/categories'&&method==='GET'){
   return sf.categories.sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0)).map(sc=>{const cat=state.categories.find(c=>c.id===sc.categoryId)||{};const cnt=(state.groups||[]).filter(g=>g.categoryId===sc.categoryId&&g.active).length;return {...sc,name:cat.name||sc.displayName||'Categoria',categoryName:cat.name||'Categoria',productsCount:cnt,activeGroupsCount:cnt};});
  }
  if(p==='/storefront/admin/categories'&&method==='PUT'){
   const list=Array.isArray(b?.categories)?b.categories:(Array.isArray(b)?b:[]);
   list.forEach((item,idx)=>{const sc=sf.categories.find(x=>x.categoryId===item.categoryId||x.id===item.id);if(sc){if(item.displayName!==undefined)sc.displayName=sfRules.sanitizePlainText(item.displayName,120);if(item.description!==undefined)sc.description=sfRules.sanitizePlainText(item.description,300);if(item.visible!==undefined)sc.visible=Boolean(item.visible);if(item.featured!==undefined)sc.featured=Boolean(item.featured);sc.sortOrder=item.sortOrder!==undefined?Number(item.sortOrder):(idx+1)*10;}});
   save();return sf.categories.sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0)).map(sc=>{const cat=state.categories.find(c=>c.id===sc.categoryId)||{};const cnt=(state.groups||[]).filter(g=>g.categoryId===sc.categoryId&&g.active).length;return {...sc,name:cat.name||sc.displayName||'Categoria',categoryName:cat.name||'Categoria',productsCount:cnt,activeGroupsCount:cnt};});
  }
  if(p==='/storefront/admin/categories'&&method==='POST'){
   const nm=rules.retailLabel(b.name,'Categoria',120);const cat={id:id(),name:nm,active:true};state.categories.push(cat);
   const sc={id:`sc-${sf.categories.length+1}`,categoryId:cat.id,slug:sfRules.normalizeStorefrontSlug(nm),displayName:b.displayName||nm,description:b.description||'',visible:b.visible!==false,featured:Boolean(b.featured),sortOrder:(sf.categories.length+1)*10};sf.categories.push(sc);save();return {...sc,name:nm,categoryName:nm,productsCount:0,activeGroupsCount:0};
  }
  if(p==='/storefront/admin/products'&&method==='GET'){
   let rows=sf.products.map(buildAdminProductDto).filter(Boolean);
   const term=(url.searchParams.get('search')||'').trim().toLowerCase();
   const catId=url.searchParams.get('categoryId')||'';
   const vis=url.searchParams.get('visibility')||'all';
   const feat=url.searchParams.get('featured');
   if(term)rows=rows.filter(r=>`${r.name} ${r.commercialTitle} ${r.categoryName}`.toLowerCase().includes(term));
   if(catId)rows=rows.filter(r=>r.categoryId===catId);
   if(vis==='visible')rows=rows.filter(r=>r.visible);
   if(vis==='hidden')rows=rows.filter(r=>!r.visible);
   if(feat==='true')rows=rows.filter(r=>r.featured);
   rows.sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));
   return rows;
  }
  if(p==='/storefront/admin/products/batch'&&method==='POST'){
   const ids=Array.isArray(b.retailGroupIds)?b.retailGroupIds:[];let updatedCount=0;
   for(const sp of sf.products){if(ids.includes(sp.retailGroupId)){if(b.visible!==undefined)sp.visible=Boolean(b.visible);if(b.featured!==undefined)sp.featured=Boolean(b.featured);updatedCount++;}}
   save();return {updatedCount};
  }
  if(p.startsWith('/storefront/admin/products/')&&method==='PUT'){
   const rgId=p.split('/')[4];const sp=sf.products.find(x=>x.retailGroupId===rgId);if(!sp)fail('Produto não encontrado.',404);
   if(b.visible!==undefined)sp.visible=Boolean(b.visible);
   if(b.featured!==undefined)sp.featured=Boolean(b.featured);
   if(b.sortOrder!==undefined)sp.sortOrder=Number(b.sortOrder)||0;
   if(b.commercialTitle!==undefined)sp.commercialTitle=sfRules.sanitizePlainText(b.commercialTitle,160);
   if(b.commercialDescription!==undefined)sp.commercialDescription=sfRules.sanitizePlainText(b.commercialDescription,2000);
   if(b.badgeLabel!==undefined)sp.badgeLabel=sfRules.sanitizePlainText(b.badgeLabel,60)||null;
   if(Array.isArray(b.galleryUrls))sp.galleryUrlsJson=b.galleryUrls.map(u=>sfRules.sanitizeSafeImageUrl(u)).filter(Boolean);
   save();return buildAdminProductDto(sp);
  }
  if(p==='/storefront/admin/orders'&&method==='GET')return {data:sf.orders||[],meta:{total:(sf.orders||[]).length,page:1,limit:30,lastPage:1}};
  if(p==='/storefront/admin/delivery-settings'&&method==='PUT')return formatSfSettings();
  if(p==='/storefront/admin/delivery/simulate'&&method==='POST')return {available:true,provider:'99_ENTREGAS',vehicleType:'MOTO',label:'99Entrega Moto',fee:9.9,distanceKm:3.2,estimatedMinutes:22,freeShippingApplied:false};
  if(p.startsWith('/storefront/public/')){
   const parts=p.split('/'),pubSlug=decodeURIComponent(parts[3]||''),sub=parts[4],sub2=parts[5];
   if(sfRules.normalizeStorefrontSlug(pubSlug)!==sf.settings.slug)fail('Loja virtual não encontrada.',404);
   if(!sf.settings.isPublished&&sub!=='orders')fail('Esta vitrine está temporariamente indisponível.',404);
   const pubTheme=sfRules.validateAndSanitizeTheme(sf.settings.publishedThemeJson,sf.settings.storeName);
   const allPubProds=buildPublicProductsList();
   const byGrp=new Map(allPubProds.map(pr=>[pr.retailGroupId,pr]));
   const resolvedCols=(pubTheme.collections||[]).filter(c=>c.enabled!==false).map(col=>{
    const prods=(col.productIds||[]).map(pid=>byGrp.get(pid)).filter(Boolean);
    return {id:col.id,slug:col.slug,kind:col.kind,title:col.title,subtitle:col.subtitle||null,description:col.description||null,coverUrl:col.coverUrl||null,focalX:col.focalX??50,focalY:col.focalY??50,productIds:col.productIds||[],totalConfiguredCount:(col.productIds||[]).length,availableCount:prods.filter(x=>x.inStock).length,products:prods};
   });
   if(!sub&&method==='GET'){
    const pubCats=sf.categories.filter(c=>c.visible).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0)).map(sc=>sfRules.toPublicCategoryDto({...sc,category:state.categories.find(c=>c.id===sc.categoryId)}));
    const prices=allPubProds.map(x=>x.priceSell).filter(n=>n>0);
    return {publicId:sf.settings.publicId,slug:sf.settings.slug,storeName:sf.settings.storeName,tagline:sf.settings.tagline||null,description:sf.settings.description||null,logoUrl:sf.settings.logoUrl||null,coverUrl:sf.settings.coverUrl||null,publishedVersion:Number(sf.settings.publishedVersion||1),pickupEnabled:Boolean(sf.settings.pickupEnabled),pickupInstructions:sf.settings.pickupInstructions||null,deliveryEnabled:Boolean(sf.settings.deliveryEnabled),deliveryInstructions:sf.settings.deliveryInstructions||null,deliveryFeeNote:sf.settings.deliveryFeeNote||null,confirmReservationMinutes:Number(sf.settings.confirmReservationMinutes||15),whatsappConfigured:Boolean(sf.settings.whatsappPhone),expressDelivery:{enabled:false},theme:pubTheme,categories:pubCats,collections:resolvedCols,featuredProducts:allPubProds.filter(x=>x.featured).slice(0,48),initialProducts:allPubProds,facets:{sizes:[...new Set(allPubProds.flatMap(x=>x.sizes))].sort(),colors:[...new Set(allPubProds.flatMap(x=>x.colors))].sort(),minPrice:prices.length?Math.min(...prices):0,maxPrice:prices.length?Math.max(...prices):0,totalPublishedProducts:allPubProds.length}};
   }
   if(sub==='collections'&&sub2&&method==='GET'){
    const colSlug=sfRules.normalizeStorefrontSlug(decodeURIComponent(sub2));
    const found=resolvedCols.find(c=>c.slug===colSlug||c.id===decodeURIComponent(sub2));
    if(!found)fail('Coleção não encontrada.',404);
    return {collection:found,products:found.products};
   }
   if(sub==='products'&&!sub2&&method==='GET'){
    let items=[...allPubProds];
    const catSlug=url.searchParams.get('categorySlug')||'';const catId=url.searchParams.get('categoryId')||'';
    const colSlug=url.searchParams.get('collectionSlug')||'';const selId=url.searchParams.get('selectionId')||'';
    let manualMap=null;
    if(catSlug){const sc=sf.categories.find(c=>c.slug===sfRules.normalizeStorefrontSlug(catSlug));if(sc)items=items.filter(x=>x.categoryId===sc.categoryId);}
    else if(catId)items=items.filter(x=>x.categoryId===catId);
    if(colSlug){const col=resolvedCols.find(c=>c.slug===sfRules.normalizeStorefrontSlug(colSlug)||c.id===colSlug);manualMap=new Map((col?.productIds||[]).map((pid,i)=>[pid,i]));items=items.filter(x=>manualMap.has(x.retailGroupId));}
    else if(selId){const sec=(pubTheme.sections||[]).find(s=>s.id===selId&&s.enabled!==false);if(sec){if(sec.sourceType==='collection'&&sec.collectionId){const col=resolvedCols.find(c=>c.id===sec.collectionId);manualMap=new Map((col?.productIds||[]).map((pid,i)=>[pid,i]));items=items.filter(x=>manualMap.has(x.retailGroupId));}else if(sec.sourceType==='featured'||(sec.type==='featured'&&!sec.sourceType)){items=items.filter(x=>x.featured);}else{manualMap=new Map((sec.productIds||[]).map((pid,i)=>[pid,i]));items=items.filter(x=>manualMap.has(x.retailGroupId));}}}
    const q=(url.searchParams.get('search')||'').trim().toLowerCase();
    if(q)items=items.filter(x=>`${x.title} ${x.description||''} ${x.categoryName||''}`.toLowerCase().includes(q));
    if(url.searchParams.get('featured')==='true')items=items.filter(x=>x.featured);
    if(url.searchParams.get('inStockOnly')==='true')items=items.filter(x=>x.inStock);
    const sort=(url.searchParams.get('sort')||(manualMap?'manual':'featured')).toLowerCase();
    items.sort((a,b)=>{if(sort==='price_asc')return a.priceSell-b.priceSell;if(sort==='price_desc')return b.priceSell-a.priceSell;if(sort==='name_asc')return a.title.localeCompare(b.title);if(manualMap&&sort==='manual')return (manualMap.get(a.retailGroupId)??999)-(manualMap.get(b.retailGroupId)??999);if(a.featured!==b.featured)return a.featured?-1:1;return (a.sortOrder||0)-(b.sortOrder||0);});
    return listPage(items,url);
   }
   if(sub==='products'&&sub2&&method==='GET'){
    const prod=allPubProds.find(x=>x.slug===sfRules.normalizeStorefrontSlug(decodeURIComponent(sub2)));
    if(!prod)fail('Mercadoria não encontrada.',404);
    return {product:prod,relatedProducts:allPubProds.filter(x=>x.categoryId===prod.categoryId&&x.id!==prod.id).slice(0,4)};
   }
   if(sub==='cart'&&sub2==='validate'&&method==='POST'){
    const rawItems=Array.isArray(b.items)?b.items:[];
    const validated=rawItems.map(it=>{
     const pr=state.products.find(x=>x.id===it.productId&&x.active!==false);
     const rg=pr?state.groups.find(g=>g.id===pr.retailGroupId):null;
     const sp=rg?sf.products.find(s=>s.retailGroupId===rg.id&&s.visible):null;
     const avail=pr&&sp?Math.max(0,Math.floor(Number(pr.stock||0))):0;
     const reqQty=Math.max(1,Math.floor(Number(it.quantity||1)));
     const price=Number(rg?.priceSell||pr?.priceSell||0);
     return {productId:it.productId,valid:Boolean(pr&&sp&&avail>=reqQty),availableStock:avail,requestedQuantity:reqQty,acceptedQuantity:Math.min(avail,reqQty),currentPriceUnit:price,productName:sp?.commercialTitle||rg?.name||pr?.name||'Item',size:pr?.size||null,color:pr?.color||null,imageUrl:rg?.imageUrl||pr?.imageUrl||null};
    });
    return {valid:validated.every(v=>v.valid),hasStockShortage:validated.some(v=>v.availableStock<v.requestedQuantity),items:validated,subtotal:money(validated.reduce((n,v)=>n+v.acceptedQuantity*v.currentPriceUnit,0))};
   }
  }
 }
 fail('Este recurso precisa do backend MySQL. A demonstração local cobre catálogo, grade, venda, troca e crédito.',503);
}
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1');
 if(req.method==='GET'&&url.pathname.startsWith('/api/products/uploads/images/')){
  const imgKey=decodeURIComponent(url.pathname.split('/').pop()||'');
  const svg=DEMO_SVGS[imgKey]||state.storefront?.uploadedSvgs?.[imgKey]||DEMO_SVGS['camiseta-peruana'];
  res.writeHead(200,{'Content-Type':'image/svg+xml; charset=utf-8','Cache-Control':'public, max-age=3600'});
  res.end(svg);
  return;
 }
 if(req.method==='POST'&&(url.pathname==='/api/products/upload-image'||url.pathname==='/api/storefront/admin/media/upload')){
  for await(const _chunk of req){}
  const upKey=`upload-${Date.now()}`;
  if(!state.storefront)state.storefront=buildInitialStorefront(state);
  if(!state.storefront.uploadedSvgs)state.storefront.uploadedSvgs={};
  state.storefront.uploadedSvgs[upKey]=DEMO_SVGS['campanha-street-desktop'];
  save();
  res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});
  res.end(JSON.stringify({imageUrl:`/api/products/uploads/images/${upKey}`,width:1280,height:540,bytes:2048}));
  return;
 }
 let text='';for await(const chunk of req){text+=chunk;if(text.length>2*1024*1024)fail('Requisição muito grande.',413);}let body={};if(text){try{body=JSON.parse(text);}catch{fail('Esta demonstração aceita cadastro em JSON; upload de foto requer a API real.');}}const result=await handle(req,url,body);res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(result));}catch(error){res.writeHead(error.status||error.getStatus?.()||500,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({message:error.message,mode:'demo-local'}));}});
server.listen(3530,()=>console.log('Demonstração local: http://localhost:3530/api — somente dados fictícios.'));
