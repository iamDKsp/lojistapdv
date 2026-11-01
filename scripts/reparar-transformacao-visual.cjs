const fs=require('fs');const path=require('path');
const root=path.resolve(__dirname,'../sistema/frontend/src');
const source='C:/Users/DKS/Documents/antigravity/joyful-meitner/frontend/src';
for(const directory of ['app','pages','components','layouts']){
 fs.cpSync(path.join(source,directory),path.join(root,directory),{recursive:true});
}
// Reaplica as duas adaptações funcionais feitas nessas pastas antes da conversão visual.
const sysPath=path.join(root,'app/sys-init/page.tsx');let sys=fs.readFileSync(sysPath,'utf8');sys=sys.split('\n').filter(line=>!/^\s*(kds|carvoaria|comandas|restaurante):\s*\{/.test(line)&&!/^\s*\{ id: '(comandas|kds|carvoaria|restaurante)'/.test(line)).join('\n').replaceAll('7bar_sysinit_pin','lojista-sysinit-pin').replaceAll('7bar_sql_history','lojista-sql-history');fs.writeFileSync(sysPath,sys);
const opPath=path.join(root,'components/OperatorLoginModal.tsx');fs.writeFileSync(opPath,fs.readFileSync(opPath,'utf8').replace('if (parsed?.restaurante === true)', 'if (false)'));
// Alguns helpers de classe também ficam em lib.
const ts=require(path.resolve(root,'../node_modules/typescript'));
function repairSyntax(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,item.name);if(item.isDirectory())repairSyntax(p);else if(/\.tsx?$/.test(p)){const s=fs.readFileSync(p,'utf8'),sf=ts.createSourceFile(p,s,ts.ScriptTarget.Latest,true);if(sf.parseDiagnostics.length){const original=path.join(source,path.relative(root,p));if(!fs.existsSync(original))throw new Error('Erro de sintaxe em arquivo novo: '+p);fs.copyFileSync(original,p);console.log('Helper recuperado: '+path.relative(root,p));}}}}
repairSyntax(path.join(root,'lib'));
