const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/DKS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
async function main(){
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage({serviceWorkers:'block'});const errors=[];page.on('pageerror',error=>errors.push(String(error)));
  await page.goto('http://127.0.0.1:3531/login');
  await page.getByRole('status').filter({hasText:'Demonstração local'}).waitFor();
  await page.getByLabel('E-mail',{exact:true}).fill('demo@lojista.local');
  await page.getByLabel('Senha',{exact:true}).fill('Lojista123!');
  await page.getByRole('button',{name:'Entrar na loja',exact:true}).click();
  await page.getByRole('button',{name:/Operador de demonstração/}).click();
  await page.locator('input[type=password]').fill('1234');
  await page.getByRole('button',{name:/Entrar|Acessar|Confirmar/i}).last().click();
  await page.getByRole('button',{name:/Camiseta Peruana/}).click();
  await page.getByRole('button',{name:/M · Preta/}).click();
  await page.getByRole('button',{name:'Finalizar venda · F2',exact:true}).click();
  await page.getByRole('dialog',{name:'Finalizar venda',exact:true}).waitFor();
  await page.getByRole('button',{name:'Voltar',exact:true}).click();
  await page.goto('http://127.0.0.1:3531/dashboard/inventory');
  await page.getByRole('button',{name:'Editar Camiseta Peruana',exact:true}).waitFor();
  const count=await page.locator('table tbody tr').count();assert.ok(count>=6);assert.deepEqual(errors,[]);
  console.log('Login, PIN, catálogo, grade e abertura do pagamento verificados usando a API local em execução, sem interceptação.');
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exit(1)});
