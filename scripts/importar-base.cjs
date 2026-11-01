const fs=require('fs');
const path=require('path');
const source='C:/Users/DKS/Documents/antigravity/joyful-meitner';
const target=path.resolve(__dirname,'../sistema');
if(fs.existsSync(target))throw new Error('A pasta sistema já existe; importação interrompida para preservar alterações.');
const blocked=new Set(['.git','.agents','node_modules','generated','dist','dev-dist','.next','vendor','uploads','backups','dumps','image-packages','copa','demo-assets']);
let files=0;
function copy(from,to){
 for(const entry of fs.readdirSync(from,{withFileTypes:true})){
  if(blocked.has(entry.name)||/^\.env(?!\.example$)/.test(entry.name)||/\.(pfx|p12|pem|mp4|zip|log|sql)$/i.test(entry.name))continue;
  const sourcePath=path.join(from,entry.name),dest=path.join(to,entry.name);
  if(entry.isDirectory()){fs.mkdirSync(dest,{recursive:true});copy(sourcePath,dest);}
  else if(entry.isFile()){fs.mkdirSync(to,{recursive:true});fs.copyFileSync(sourcePath,dest);files++;}
 }
}
fs.mkdirSync(target);
for(const directory of ['backend','frontend','nfce-service'])copy(path.join(source,directory),path.join(target,directory));
for(const name of ['.gitignore','.gitattributes'])if(fs.existsSync(path.join(source,name)))fs.copyFileSync(path.join(source,name),path.join(target,name));
fs.writeFileSync(path.join(target,'BASE-ORIGEM.md'),'# Base do PDV Lojista\n\nCódigo importado de uma cópia de trabalho do PDV Adega em `C:/Users/DKS/Documents/antigravity/joyful-meitner`. O projeto de origem não foi alterado.\n\nForam excluídos credenciais locais, bancos, uploads, certificados, builds, dependências, conteúdo promocional e clientes Prisma gerados.\n');
console.log(JSON.stringify({target,files}));
