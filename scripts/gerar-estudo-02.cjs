const fs=require('fs');
const path=require('path');
const sharp=require('C:/Users/DKS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const out=path.resolve(__dirname,'../identidade/estudo-02');
fs.mkdirSync(out,{recursive:true});
const orange='#C2410C',ink='#272321',cream='#FAF7F2';
const variants=[{id:'monograma-p',title:'Com P',description:'P de PDV + L de lojista'}, {id:'caixa',title:'Com caixa',description:'Caixa de venda + L de lojista'}];
function symbol(id,bg=orange,fg='#FFFFFF'){
 const detail=id==='monograma-p'
   ? `<path fill-rule="evenodd" d="M34 15H42C47 15 49 18 49 22C49 26 46 29 42 29H38V34H34ZM38 19V25H42C44 25 45 24 45 22C45 20 44 19 42 19Z" fill="${fg}"/>`
   : `<rect x="34" y="15" width="14" height="10" rx="1.5" fill="none" stroke="${fg}" stroke-width="3"/><path d="M39 25H43V28H47L50 34H32L35 28H39Z" fill="${fg}"/><path d="M36 31H46" stroke="${bg}" stroke-width="1.5"/>`;
 return `<rect width="64" height="64" rx="16" fill="${bg}"/><path d="M16 15H26V39H48V49H16Z" fill="${fg}"/>${detail}`;
}
function lockup(id,text=ink,bg=orange){return `<g transform="translate(8 8) scale(2)">${symbol(id,bg)}</g><text x="163" y="50" font-family="Segoe UI,Arial,sans-serif" font-size="25" font-weight="600" letter-spacing="5" fill="${text}">PDV</text><text x="159" y="113" font-family="Segoe UI,Arial,sans-serif" font-size="65" font-weight="600" letter-spacing="-2" fill="${text}">lojista</text>`;}
function svg(content,w,h,label){return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">${content}</svg>`;}
async function saveVariant(v){
 const dir=path.join(out,v.id);fs.mkdirSync(dir,{recursive:true});
 const icon=svg(symbol(v.id),64,64,`PDV Lojista: ${v.title}`);
 const primary=svg(lockup(v.id),416,144,`PDV Lojista: ${v.title}`);
 fs.writeFileSync(path.join(dir,'logo-principal.svg'),primary);
 fs.writeFileSync(path.join(dir,'logo-reversa.svg'),svg(lockup(v.id,'#FFFFFF'),416,144,`PDV Lojista: ${v.title}`));
 fs.writeFileSync(path.join(dir,'logo-monocromatica.svg'),svg(lockup(v.id,ink,ink),416,144,`PDV Lojista: ${v.title}`));
 fs.writeFileSync(path.join(dir,'favicon.svg'),icon);
 await sharp(Buffer.from(primary)).png().toFile(path.join(dir,'logo-principal.png'));
 const icoImages=[];
 for(const size of [16,32,48,64,180,192,512]){
  const buffer=await sharp(Buffer.from(icon)).resize(size,size).png().toBuffer();
  fs.writeFileSync(path.join(dir,`icone-${size}.png`),buffer);
  if([16,32,48].includes(size))icoImages.push({size,buffer});
 }
 const header=Buffer.alloc(6+icoImages.length*16);header.writeUInt16LE(1,2);header.writeUInt16LE(icoImages.length,4);
 let offset=header.length;
 icoImages.forEach(({size,buffer},i)=>{const p=6+i*16;header[p]=size;header[p+1]=size;header.writeUInt16LE(1,p+4);header.writeUInt16LE(32,p+6);header.writeUInt32LE(buffer.length,p+8);header.writeUInt32LE(offset,p+12);offset+=buffer.length;});
 fs.writeFileSync(path.join(dir,'favicon.ico'),Buffer.concat([header,...icoImages.map(x=>x.buffer)]));
}
async function main(){
 for(const v of variants)await saveVariant(v);
 const content=`<rect width="1120" height="710" fill="${cream}"/><g font-family="Segoe UI,Arial,sans-serif" fill="${ink}">
 <text x="48" y="47" font-size="15" font-weight="600" letter-spacing="2">PDV LOJISTA / REFINAMENTO DO SÍMBOLO</text>
 <text x="48" y="78" font-size="16">Duas alternativas com a mesma cor, tipografia e estrutura.</text>
 <path d="M560 120V654" stroke="#E4DDD5"/>
 ${variants.map((v,i)=>{const x=48+i*560;return `
 <text x="${x}" y="142" font-size="25" font-weight="600">${v.title}</text>
 <text x="${x}" y="171" font-size="16" fill="#625951">${v.description}</text>
 <g transform="translate(${x} 205)">${lockup(v.id)}</g>
 <text x="${x}" y="398" font-size="13" font-weight="600" letter-spacing="1">SÍMBOLO E REDUÇÃO</text>
 <g transform="translate(${x} 422)">${symbol(v.id)}</g>
 <g transform="translate(${x+115} 454) scale(.5)">${symbol(v.id)}</g>
 <g transform="translate(${x+200} 470) scale(.25)">${symbol(v.id)}</g>
 <text x="${x}" y="514" font-size="13">64 px</text><text x="${x+115}" y="514" font-size="13">32 px</text><text x="${x+200}" y="514" font-size="13">16 px</text>
 <rect x="${x}" y="548" width="464" height="112" rx="12" fill="${ink}"/>
 <g transform="translate(${x+22} 565) scale(.55)">${lockup(v.id,'#FFFFFF')}</g>
 `}).join('')}
 </g>`;
 const board=svg(content,1120,710,'Comparação da logo PDV Lojista com P ou caixa de venda acima do L');
 fs.writeFileSync(path.join(out,'comparacao.svg'),board);
 await sharp(Buffer.from(board)).png().toFile(path.join(out,'comparacao.png'));
 console.log(`Criadas as duas versões e o painel em ${out}`);
}
main().catch(e=>{console.error(e);process.exit(1)});
