const fs=require('fs');
const path=require('path');
const sharp=require('C:/Users/DKS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const out=path.resolve(__dirname,'../identidade/estudo-03-loja');
fs.mkdirSync(out,{recursive:true});
const orange='#C2410C',ink='#272321',cream='#FAF7F2';
function shop(bg,fg){
 return `<g transform="translate(30 12) scale(.96)">
 <path d="M3 12H21V23H3Z" fill="${fg}"/>
 <path d="M6 23V16Q6 15 7 15H10Q11 15 11 16V23Z" fill="${bg}"/>
 <rect x="14" y="15" width="4" height="5" rx=".7" fill="${bg}"/>
 <path d="M4 2H9L8 9C7.5 12 0 12 1 9Z M10 2H14L15 9C16 12 8 12 9 9Z M15 2H20L23 9C24 12 16.5 12 16 9Z" fill="${fg}"/>
 </g>`;
}
function symbol(bg=orange,fg='#FFFFFF'){
 return `<rect width="64" height="64" rx="16" fill="${bg}"/><path d="M16 15H26V39H48V49H16Z" fill="${fg}"/>${shop(bg,fg)}`;
}
function lockup(text=ink,bg=orange){return `<g transform="translate(8 8) scale(2)">${symbol(bg)}</g><text x="163" y="50" font-family="Segoe UI,Arial,sans-serif" font-size="25" font-weight="600" letter-spacing="5" fill="${text}">PDV</text><text x="159" y="113" font-family="Segoe UI,Arial,sans-serif" font-size="65" font-weight="600" letter-spacing="-2" fill="${text}">lojista</text>`;}
function svg(content,w,h,label){return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">${content}</svg>`;}
async function main(){
 const primary=svg(lockup(),416,144,'PDV Lojista: L com fachada de loja');
 const icon=svg(symbol(),64,64,'Símbolo L com fachada de loja e toldo');
 const files={'logo-principal.svg':primary,'logo-reversa.svg':svg(lockup('#FFFFFF'),416,144,'PDV Lojista em fundo escuro'),'logo-monocromatica.svg':svg(lockup(ink,ink),416,144,'PDV Lojista em uma cor'),'favicon.svg':icon};
 for(const [name,content] of Object.entries(files))fs.writeFileSync(path.join(out,name),content);
 await sharp(Buffer.from(primary)).png().toFile(path.join(out,'logo-principal.png'));
 const icoImages=[];
 for(const size of [16,32,48,64,180,192,512]){
  const buffer=await sharp(Buffer.from(icon)).resize(size,size).png().toBuffer();
  fs.writeFileSync(path.join(out,`icone-${size}.png`),buffer);
  if([16,32,48].includes(size))icoImages.push({size,buffer});
 }
 const header=Buffer.alloc(6+icoImages.length*16);header.writeUInt16LE(1,2);header.writeUInt16LE(icoImages.length,4);
 let offset=header.length;
 icoImages.forEach(({size,buffer},i)=>{const p=6+i*16;header[p]=size;header[p+1]=size;header.writeUInt16LE(1,p+4);header.writeUInt16LE(32,p+6);header.writeUInt32LE(buffer.length,p+8);header.writeUInt32LE(offset,p+12);offset+=buffer.length;});
 fs.writeFileSync(path.join(out,'favicon.ico'),Buffer.concat([header,...icoImages.map(x=>x.buffer)]));
 const content=`<rect width="1120" height="730" fill="${cream}"/>
 <g font-family="Segoe UI,Arial,sans-serif" fill="${ink}">
 <text x="48" y="48" font-size="15" font-weight="600" letter-spacing="2">PDV LOJISTA / L + FACHADA DE LOJA</text>
 <text x="48" y="80" font-size="16">O toldo, a porta e a vitrine ocupam o lugar do P.</text>
 <g transform="translate(48 127) scale(4.1)">${symbol()}</g>
 <g transform="translate(425 181) scale(1.3)">${lockup()}</g>
 <text x="48" y="438" font-size="13" font-weight="600" letter-spacing="1">VERSÃO SOBRE FUNDO ESCURO</text>
 <rect x="48" y="460" width="590" height="213" rx="14" fill="${ink}"/>
 <g transform="translate(83 505) scale(.86)">${lockup('#FFFFFF')}</g>
 <text x="700" y="438" font-size="13" font-weight="600" letter-spacing="1">SÍMBOLO / FAVICON</text>
 <g transform="translate(700 479)">${symbol()}</g>
 <g transform="translate(822 511) scale(.5)">${symbol()}</g>
 <g transform="translate(914 527) scale(.25)">${symbol()}</g>
 <text x="700" y="572" font-size="13">64 px</text><text x="822" y="572" font-size="13">32 px</text><text x="914" y="572" font-size="13">16 px</text>
 <text x="700" y="631" font-size="15">Mesma paleta e tipografia.</text>
 <text x="700" y="657" font-size="15">Fachada simplificada a partir da referência.</text>
 </g>`;
 const board=svg(content,1120,730,'Logo PDV Lojista com um L e uma pequena fachada de loja acima do braço horizontal');
 fs.writeFileSync(path.join(out,'painel-loja.svg'),board);
 await sharp(Buffer.from(board)).png().toFile(path.join(out,'painel-loja.png'));
 console.log(`Proposta gerada em ${out}`);
}
main().catch(e=>{console.error(e);process.exit(1)});
