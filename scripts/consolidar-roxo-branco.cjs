const fs=require('fs');
const path=require('path');
const sharp=require('C:/Users/DKS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const base=path.resolve(__dirname,'../identidade');
const out=path.join(base,'roxo-branco');
fs.mkdirSync(out,{recursive:true});
const colors={primary:'#7C3AED',primaryHover:'#6D28D9',white:'#FFFFFF',background:'#F8F7FC',support:'#F3E8FF',text:'#272321',textSecondary:'#665F70',border:'#E5E1ED'};
const source=fs.readFileSync(path.join(base,'estudo-03-loja/logo-principal.svg'),'utf8');
const originalIcon=fs.readFileSync(path.join(base,'estudo-03-loja/favicon.svg'),'utf8');
const recolor=s=>s.replaceAll('#C2410C',colors.primary);
const primary=recolor(source);
const icon=recolor(originalIcon);
const negative=source.replaceAll('#C2410C','__BACKGROUND__').replaceAll('#FFFFFF',colors.primary).replaceAll('__BACKGROUND__','#FFFFFF').replaceAll('#272321','#FFFFFF');
const strip=s=>s.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');
const write=(name,data)=>fs.writeFileSync(path.join(out,name),data);
write('logo-principal.svg',primary);
write('logo-sobre-roxo.svg',negative);
write('simbolo.svg',icon);
write('favicon.svg',icon);
write('paleta.json',JSON.stringify({product:'PDV Lojista',direction:'Roxo e branco',colors},null,2)+'\n');
write('tokens.css',`:root {\n${Object.entries(colors).map(([k,v])=>`  --pdv-${k.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())}: ${v};`).join('\n')}\n}\n`);
const board=`<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="860" viewBox="0 0 1120 860" role="img" aria-label="Identidade PDV Lojista em roxo e branco, com logo, paleta, favicon e exemplo visual do caixa">
<rect width="1120" height="860" fill="${colors.white}"/>
<g font-family="Segoe UI,Arial,sans-serif" fill="${colors.text}">
<text x="48" y="47" font-size="15" font-weight="600" letter-spacing="2">PDV LOJISTA / ROXO E BRANCO</text>
<g transform="translate(48 104) scale(1.2)">${strip(primary)}</g>
<rect x="710" y="92" width="362" height="204" rx="16" fill="${colors.primary}"/>
<g transform="translate(740 140) scale(.72)">${strip(negative)}</g>
<text x="48" y="316" font-size="18">L + fachada de loja · simples, confiável e fácil de usar.</text>
<text x="48" y="380" font-size="13" font-weight="600" letter-spacing="1.5">PALETA</text>
${[['Roxo',colors.primary],['Branco',colors.white],['Fundo',colors.background],['Apoio',colors.support],['Texto',colors.text]].map(([name,color],i)=>{const x=48+i*208;return `<rect x="${x}" y="402" width="192" height="52" rx="8" fill="${color}" stroke="${color==='#FFFFFF'?colors.border:color}"/><text x="${x}" y="480" font-size="14" font-weight="600">${name}</text><text x="${x}" y="503" font-size="13">${color}</text>`;}).join('')}
<text x="48" y="562" font-size="13" font-weight="600" letter-spacing="1.5">APLICAÇÃO VISUAL NO CAIXA</text>
<rect x="48" y="584" width="648" height="228" rx="14" fill="${colors.background}" stroke="${colors.border}"/>
<text x="72" y="622" font-size="18" font-weight="600">Nova venda</text><text x="672" y="622" font-size="14" text-anchor="end" fill="${colors.textSecondary}">Caixa 01</text>
<path d="M72 638H672" stroke="${colors.border}"/>
<text x="72" y="670" font-size="15">Camiseta básica + boné</text><text x="672" y="670" font-size="15" text-anchor="end">2 itens</text>
<text x="72" y="715" font-size="17">Total</text><text x="672" y="718" font-size="28" font-weight="600" text-anchor="end">R$ 89,80</text>
<rect x="72" y="741" width="600" height="49" rx="8" fill="${colors.primary}"/><text x="372" y="773" text-anchor="middle" font-size="17" font-weight="600" fill="${colors.white}">Finalizar venda · F2</text>
<text x="744" y="562" font-size="13" font-weight="600" letter-spacing="1.5">SÍMBOLO / FAVICON</text>
<g transform="translate(744 594)">${strip(icon)}</g>
<g transform="translate(864 626) scale(.5)">${strip(icon)}</g>
<g transform="translate(954 642) scale(.25)">${strip(icon)}</g>
<text x="744" y="689" font-size="13">64 px</text><text x="864" y="689" font-size="13">32 px</text><text x="954" y="689" font-size="13">16 px</text>
<text x="744" y="754" font-size="15">Roxo nos destaques.</text><text x="744" y="781" font-size="15">Branco nas superfícies.</text>
</g></svg>`;
write('painel-identidade.svg',board);
function luminance(hex){const rgb=hex.match(/[a-f\d]{2}/gi).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
const contrast=Number((1.05/(luminance(colors.primary)+.05)).toFixed(2));
if(contrast<4.5)throw new Error('Contraste insuficiente no botão principal');
async function main(){
 await sharp(Buffer.from(primary)).resize({width:1248}).png().toFile(path.join(out,'logo-principal.png'));
 await sharp(Buffer.from(negative)).resize({width:1248}).png().toFile(path.join(out,'logo-sobre-roxo.png'));
 await sharp(Buffer.from(board)).png().toFile(path.join(out,'painel-identidade.png'));
 const icoImages=[];
 for(const size of [16,32,48,64,180,192,512]){
  const buffer=await sharp(Buffer.from(icon)).resize(size,size).png().toBuffer();
  write(`icone-${size}.png`,buffer);
  if([16,32,48].includes(size))icoImages.push({size,buffer});
 }
 const header=Buffer.alloc(6+icoImages.length*16);header.writeUInt16LE(1,2);header.writeUInt16LE(icoImages.length,4);
 let offset=header.length;
 icoImages.forEach(({size,buffer},i)=>{const p=6+i*16;header[p]=size;header[p+1]=size;header.writeUInt16LE(1,p+4);header.writeUInt16LE(32,p+6);header.writeUInt32LE(buffer.length,p+8);header.writeUInt32LE(offset,p+12);offset+=buffer.length;});
 write('favicon.ico',Buffer.concat([header,...icoImages.map(x=>x.buffer)]));
 write('verificacao.json',JSON.stringify({whiteOnPrimaryContrast:contrast,icons:[16,32,48,64,180,192,512],previousStudiesPreserved:true},null,2)+'\n');
 console.log(JSON.stringify({directory:out,whiteOnPrimaryContrast:contrast,files:fs.readdirSync(out).length}));
}
main().catch(e=>{console.error(e);process.exit(1)});
