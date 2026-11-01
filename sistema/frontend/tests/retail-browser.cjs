/* Validação de interface com API simulada. Não acessa bancos nem serviços da adega. */
const fs=require('fs');const path=require('path');const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/DKS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {spawn}=require('node:child_process');
const baseURL='http://127.0.0.1:3533';
let testServer;
let testPage;
const out=path.resolve(__dirname,'../../docs/validacao');fs.mkdirSync(out,{recursive:true});
const tenant='tenant-test-only';const operator={id:'operator-test',name:'Operador de teste',role:'operator',jobTitle:'Caixa',isManager:true};
const jwt=payload=>`test.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.test`;
const user={id:'user-test',name:'Admin de teste',tenant,role:'admin',termsAccepted:true};
const group={id:'group-test',name:'Camiseta Peruana',categoryId:'cat-test',category:{id:'cat-test',name:'Camisetas'},priceSell:49.9,priceCost:20,imageUrl:null,active:true,version:1,stock:12,variants:[]};
const products=[['M','Preta',5,'code-m'],['G','Branca',7,'code-g']].map(([size,color,stock,id])=>({id,name:`Camiseta Peruana · ${size} · ${color}`,size,color,stock,barcode:id,shortCode:id,retailGroupId:group.id,retailGroup:group,categoryId:group.categoryId,category:group.category,priceSell:49.9,priceCost:20,unit:'UN',imageUrl:null,active:true,grupoTributacao:null}));group.variants=products.map(({retailGroup,...rest})=>rest);
const customer={id:'customer-test',name:'Cliente de teste',phone:'11999999999'};
let salePayload=null,groupPayload=null,returnPayload=null;const consoleErrors=[];const requests=[];
async function main(){
 testServer=spawn(process.execPath,[path.resolve(__dirname,'../node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','3533','--strictPort'],{cwd:path.resolve(__dirname,'..'),windowsHide:true,stdio:'pipe'});
 for(let attempt=0;attempt<40;attempt++){try{const response=await fetch(baseURL);if(response.ok)break;}catch{}if(attempt===39)throw new Error('Servidor local de teste indisponível.');await new Promise(resolve=>setTimeout(resolve,250));}
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
 const page=await context.newPage();testPage=page;page.on('pageerror',error=>consoleErrors.push(String(error)));
 await page.route('**/api/**',async route=>{
  const req=route.request(),url=new URL(req.url()),p=url.pathname.replace(/^\/api/,'');const method=req.method();requests.push(`${method} ${p}`);let body;
  if(p==='/auth/login')body={access_token:jwt({tenantId:tenant,sub:user.id,role:'admin'}),user};
  else if(p==='/auth/operator-login')body={...operator,operatorToken:jwt({type:'op',tenantId:tenant,opId:operator.id,context:'cashier'})};
  else if(p==='/operators')body=[{...operator,active:true,hasOpenRegister:true}];
  else if(p.startsWith('/operators/'))body={...operator,active:true};
  else if(p==='/cash-registers/current')body={id:'register-test',status:'open',operatorId:operator.id};
  else if(p==='/tenants/me')body={id:tenant,nomeFantasia:'Loja de teste',modulos:{estoque:true,nfce:false},nfceAtivo:false};
  else if(p==='/auth/tenant-status')body={status:'active',diasAtraso:0};
  else if(p==='/categories')body=[group.category];
  else if(p==='/tributacao')body=[];
  else if(p==='/products/settings')body={allowNegativeStock:false};
  else if(p==='/products')body={data:products,meta:{page:1,lastPage:1,total:2}};
  else if(p==='/payment-methods')body=[];
  else if(p==='/customers')body=[customer];
  else if(p.startsWith('/retail/credits/'))body=[{id:'credit-test',customerId:customer.id,balance:20,createdAt:new Date().toISOString()}];
  else if(p==='/sales/checkout') {salePayload=req.postDataJSON();body={id:'sale-test',code:12,total:49.9,emitirNfce:false};}
  else if(p==='/retail/groups'&&method==='GET')body={data:[group],meta:{total:1,lastPage:1,page:1}};
  else if(p==='/retail/groups'&&method==='POST'){groupPayload=req.postDataJSON();body={...group,...groupPayload};}
  else if(p==='/retail/ungrouped')body=[];
  else if(p==='/retail/overview')body={revenue:149.7,returns:49.9,netMerchandise:99.8,transactions:3,pieces:3,outstandingCredits:20,openRegisters:1,topGroups:[{id:'group-test',name:'Camiseta Peruana',quantity:3}]};
  else if(p==='/retail/returns'&&method==='GET')body=[];
  else if(p.startsWith('/retail/returns/sale/'))body={id:'sale-original',code:10,status:'completed',customerId:customer.id,customer,items:[{id:'item-test',productName:'Camiseta Peruana · M · Preta',quantity:1,priceUnit:49.9,retailReturnItems:[]}]};
  else if(p==='/retail/returns'&&method==='POST'){returnPayload=req.postDataJSON();body={id:'return-test',total:49.9,credit:{balance:49.9}};}
  else if(p==='/'||p==='/telemetry/batch'||p==='/telemetry')body={ok:true};
  else {await route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({message:`API de teste sem fixture: ${p}`})});return;}
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.goto(baseURL+'/login');
 await page.getByRole('heading',{name:'Bem-vindo de volta'}).waitFor();
 await page.screenshot({path:path.join(out,'login.png'),fullPage:true});
 await page.getByLabel('E-mail',{exact:true}).fill('teste@example.invalid');await page.getByLabel('Senha',{exact:true}).fill('teste-local');await page.getByRole('button',{name:'Entrar',exact:true}).click();
 await page.getByRole('button',{name:/Operador de teste/}).click();
 const password=page.locator('input[type=password]');await password.fill('1234');await page.getByRole('button',{name:/Entrar|Acessar|Confirmar/i}).last().click();
 await page.getByRole('button',{name:/Camiseta Peruana 2 variações/}).waitFor();
 await page.getByRole('button',{name:/Camiseta Peruana 2 variações/}).click();
 await page.getByRole('button',{name:/M · Preta/}).click();
 await page.getByRole('button',{name:'Finalizar venda · F2',exact:true}).waitFor({state:'visible'});
 await page.locator('[data-sonner-toaster]').evaluate(el=>el.style.display='none').catch(()=>{});await page.screenshot({path:path.join(out,'caixa.png'),fullPage:true});
 const brand=await page.getByRole('button',{name:'Finalizar venda · F2',exact:true}).evaluate(el=>({bg:getComputedStyle(el).backgroundColor,text:getComputedStyle(el).color}));
 assert.equal(brand.bg,'rgb(124, 58, 237)');assert.equal(brand.text,'rgb(255, 255, 255)');
 await page.getByRole('button',{name:'Finalizar venda · F2',exact:true}).click();
 await page.getByLabel('Cliente',{exact:true}).click();await page.getByRole('option',{name:/Cliente de teste/}).click();
 await page.getByRole('button',{name:'Crédito na loja',exact:true}).click();
 await page.getByLabel('Crédito disponível').click();await page.getByRole('option',{name:/20,00/}).click();
 await page.getByLabel('Valor do pagamento',{exact:true}).fill('20');await page.getByRole('button',{name:'Adicionar',exact:true}).click();
 await page.getByRole('button',{name:'Pix',exact:true}).click();await page.getByRole('button',{name:'Adicionar',exact:true}).click();
 await page.getByRole('button',{name:'Confirmar venda',exact:true}).click();
 await page.getByRole('heading',{name:'Venda concluída',exact:true}).waitFor();
 assert.equal(salePayload.customerId,customer.id);assert.equal(salePayload.items[0].productId,'code-m');assert.equal(salePayload.payments[0].creditId,'credit-test');assert.equal(salePayload.payments.reduce((n,p)=>n+p.value,0),49.9);assert.ok(salePayload.idempotencyKey);
 await page.getByRole('button',{name:'Voltar ao caixa',exact:true}).click();
 // Simula F5 depois do commit, antes da limpeza do rascunho, mantendo o registro durável.
 await page.evaluate(async({tenant,op,id})=>{const {useCartStore}=await import('/src/store/cart.ts');useCartStore.getState().selectScope(tenant,op);useCartStore.setState({cartOperationId:id,items:[{id:'code-m',name:'Camiseta Peruana',priceSell:49.9,effectivePriceSell:49.9,stock:5,barcode:'code-m',shortCode:'code-m',cartKey:'code-m',quantity:1,subtotal:49.9}],total:49.9});},{tenant,op:operator.id,id:salePayload.idempotencyKey});
 await page.reload();await page.getByText('Operador: Operador de teste',{exact:true}).waitFor();
 await page.waitForFunction(async(id)=>{const {useCartStore}=await import('/src/store/cart.ts');return useCartStore.getState().items.length===0&&useCartStore.getState().cartOperationId!==id;},salePayload.idempotencyKey);
 await page.goto(baseURL+'/dashboard/inventory');await page.getByRole('heading',{name:'Mercadorias e grades',exact:true}).waitFor();
 await page.getByRole('button',{name:'Novo grupo',exact:true}).click();await page.getByLabel('Nome do grupo',{exact:true}).fill('Boné aba curva');await page.getByLabel('Categoria',{exact:true}).click();await page.getByRole('option',{name:'Camisetas'}).click();await page.getByLabel('Preço de venda compartilhado (R$)',{exact:true}).fill('39.90');
 await page.getByRole('button',{name:'Gerar combinações',exact:true}).click();assert.equal(await page.getByRole('textbox',{name:/Tamanho da variação/}).count(),8);
 await page.getByRole('button',{name:'Salvar grupo e grade',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(groupPayload.name,'Boné aba curva');assert.equal(groupPayload.variants.length,8);
 await page.screenshot({path:path.join(out,'catalogo.png'),fullPage:true});
 await page.getByRole('link',{name:'Trocas e créditos',exact:true}).click();await page.getByRole('textbox',{name:'Número ou identificador da venda'}).fill('10');await page.getByRole('button',{name:'Localizar venda',exact:true}).click();await page.getByRole('heading',{name:'Venda #10'}).waitFor();
 await page.getByRole('spinbutton',{name:/Quantidade a trocar/}).fill('1');await page.getByLabel('Motivo da troca',{exact:true}).fill('Troca de tamanho');await page.getByRole('button',{name:'Registrar troca e emitir crédito',exact:true}).click();await page.getByRole('status').filter({hasText:'Crédito de'}).waitFor();assert.equal(returnPayload.items[0].quantity,1);assert.equal(returnPayload.items[0].restock,true);assert.equal(returnPayload.customerId,customer.id);
 await page.goto(baseURL+'/dashboard');await page.getByRole('heading',{name:'Grupos com mais peças vendidas',exact:true}).waitFor();assert.match(await page.locator('article').filter({hasText:'Vendas menos trocas'}).innerText(),/99,80/);await page.screenshot({path:path.join(out,'resumo.png'),fullPage:true});
 const scoped=await page.evaluate(async()=>{const {updateProductsCache,getCachedProducts}=await import('/src/lib/db.ts');await updateProductsCache([{id:'same-id',name:'Produto A',priceSell:10,stock:1,active:true}], 'tenant-A');await updateProductsCache([{id:'same-id',name:'Produto B',priceSell:20,stock:2,active:true}], 'tenant-B');return [(await getCachedProducts('tenant-A'))[0].name,(await getCachedProducts('tenant-B'))[0].name];});assert.deepEqual(scoped,['Produto A','Produto B']);
 await page.setViewportSize({width:390,height:844});await page.goto(baseURL+'/dashboard/inventory');await page.getByRole('heading',{name:'Mercadorias e grades',exact:true}).waitFor();await page.getByRole('button',{name:'Editar Camiseta Peruana'}).waitFor();const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);await page.screenshot({path:path.join(out,'catalogo-mobile.png'),fullPage:true});
 assert.deepEqual(consoleErrors,[]);
 fs.writeFileSync(path.join(out,'browser-result.json'),JSON.stringify({mode:'API simulada; sem banco real',passed:['login','operador por PIN','agrupamento no caixa','tamanho e cor','cores do botão principal','pagamento misto com crédito','identificação idempotente','retomada após F5 sem remontar venda confirmada','cadastro de grade com oito combinações','troca e emissão de crédito','resumo com vendas menos trocas','cache isolado entre dois tenants com mesmo ID de produto','layout móvel sem overflow'],consoleErrors,requests},null,2));
 await browser.close();testServer.kill();console.log('13 verificações de interface passaram com API simulada.');
}
main().catch(async error=>{if(testPage){await testPage.screenshot({path:path.join(out,'falha.png'),fullPage:true}).catch(()=>{});console.error((await testPage.locator('body').innerText().catch(()=>'' )).slice(-4000));}testServer?.kill();console.error(error);process.exit(1)});
