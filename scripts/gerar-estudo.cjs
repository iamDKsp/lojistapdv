const fs = require('fs');
const path = require('path');
const sharp = require('C:/Users/DKS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const out = path.resolve(__dirname, '../identidade/estudo-01');
fs.mkdirSync(out, {recursive:true});
const orange='#C2410C', ink='#272321', cream='#FAF7F2';
function symbol(bg=orange, fg='#FFFFFF') {
  return `<rect width="64" height="64" rx="16" fill="${bg}"/><path d="M16 15H26V39H48V49H16Z" fill="${fg}"/><rect x="34" y="15" width="14" height="15" rx="3" fill="${fg}"/>`;
}
function logo(text=ink, bg=orange, fg='#FFFFFF') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="144" viewBox="0 0 640 144" role="img" aria-label="PDV Lojista, estudo inicial"><g transform="translate(8 8) scale(2)">${symbol(bg,fg)}</g><text x="163" y="50" font-family="Segoe UI,Arial,sans-serif" font-size="25" font-weight="600" letter-spacing="5" fill="${text}">PDV</text><text x="159" y="113" font-family="Segoe UI,Arial,sans-serif" font-size="65" font-weight="600" letter-spacing="-2" fill="${text}">lojista</text></svg>`;
}
const icon=`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="Símbolo experimental de PDV Lojista">${symbol()}</svg>`;
const logos={
  'logo-principal.svg':logo(),
  'logo-reversa.svg':logo('#FFFFFF'),
  'logo-monocromatica.svg':logo(ink,ink),
  'favicon.svg':icon
};
for(const [name,svg] of Object.entries(logos))fs.writeFileSync(path.join(out,name),svg);
const swatches=[['Principal',orange],['Texto',ink],['Fundo',cream],['Apoio','#FFEDD5']];
const board=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1000" viewBox="0 0 1200 1000">
<rect width="1200" height="1000" fill="${cream}"/>
<g font-family="Segoe UI,Arial,sans-serif" fill="${ink}">
<text x="56" y="48" font-size="15" font-weight="600" letter-spacing="2">PDV LOJISTA / PRIMEIRO ESTUDO</text>
<text x="1144" y="48" font-size="14" text-anchor="end">DIREÇÃO: SIMPLES E CONFIÁVEL</text>
<svg x="56" y="110" width="640" height="144" viewBox="0 0 640 144">${logo().replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'')}</svg>
<text x="62" y="307" font-size="23">Seu balcão. Sua loja. Tudo em dia.</text>
<text x="62" y="339" font-size="15" fill="#625951">Assinatura em estudo · nome e símbolo sujeitos a refinamento</text>
<rect x="824" y="105" width="320" height="238" rx="16" fill="${ink}"/>
<svg x="859" y="174" width="250" height="57" viewBox="0 0 640 144">${logo('#FFFFFF').replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'')}</svg>
<text x="56" y="406" font-size="14" font-weight="600" letter-spacing="1.5">PALETA DE BASE</text>
${swatches.map(([n,c],i)=>`<rect x="${56+i*276}" y="430" width="260" height="70" rx="9" fill="${c}" stroke="${c===cream?'#E4DDD5':c}"/><text x="${56+i*276}" y="527" font-size="15" font-weight="600">${n}</text><text x="${56+i*276}" y="550" font-size="14">${c}</text>`).join('')}
<text x="56" y="614" font-size="14" font-weight="600" letter-spacing="1.5">APLICAÇÃO NO CAIXA / EXEMPLO VISUAL</text>
<rect x="56" y="638" width="700" height="302" rx="14" fill="#FFFFFF" stroke="#E4DDD5"/>
<text x="82" y="678" font-size="19" font-weight="600">Nova venda</text>
<text x="730" y="678" font-size="14" text-anchor="end" fill="#625951">Caixa 01</text>
<path d="M82 698H730" stroke="#E4DDD5"/>
<text x="82" y="733" font-size="16">Camiseta básica · M</text><text x="730" y="733" font-size="16" text-anchor="end">R$ 49,90</text>
<text x="82" y="769" font-size="16">Boné</text><text x="730" y="769" font-size="16" text-anchor="end">R$ 39,90</text>
<text x="82" y="821" font-size="17">Total</text><text x="730" y="825" font-size="30" font-weight="600" text-anchor="end">R$ 89,80</text>
<rect x="82" y="850" width="648" height="62" rx="9" fill="${orange}"/>
<text x="406" y="889" font-size="19" text-anchor="middle" font-weight="600" fill="#FFFFFF">Finalizar venda · F2</text>
<text x="800" y="614" font-size="14" font-weight="600" letter-spacing="1.5">SÍMBOLO / FAVICON</text>
<g transform="translate(800 650) scale(1.5)">${symbol()}</g>
<g transform="translate(938 705) scale(.5)">${symbol()}</g>
<g transform="translate(1006 721) scale(.25)">${symbol()}</g>
<text x="800" y="776" font-size="14">96 px</text><text x="938" y="776" font-size="14">32 px</text><text x="1006" y="776" font-size="14">16 px</text>
<text x="800" y="832" font-size="17" font-weight="600">L + módulo de produto</text>
<text x="800" y="861" font-size="15">Forma simples, sem detalhes finos.</text>
<text x="800" y="886" font-size="15">Tipografia: Segoe UI.</text>
<text x="800" y="911" font-size="15">Cor concentrada nas ações principais.</text>
</g></svg>`;
fs.writeFileSync(path.join(out,'painel-identidade.svg'),board);
async function main(){
 await sharp(Buffer.from(board)).png().toFile(path.join(out,'painel-identidade.png'));
 await sharp(Buffer.from(logos['logo-principal.svg'])).png().toFile(path.join(out,'logo-principal.png'));
 const pngs=[];
 for(const size of [16,32,48,64,180,192,512]){
   const buffer=await sharp(Buffer.from(icon)).resize(size,size).png().toBuffer();
   fs.writeFileSync(path.join(out,`icone-${size}.png`),buffer);
   if([16,32,48].includes(size))pngs.push({size,buffer});
 }
 const ico=Buffer.alloc(6+16*pngs.length);
 ico.writeUInt16LE(1,2);ico.writeUInt16LE(pngs.length,4);
 let offset=ico.length;
 pngs.forEach(({size,buffer},i)=>{
   const pos=6+i*16;ico[pos]=size;ico[pos+1]=size;
   ico.writeUInt16LE(1,pos+4);ico.writeUInt16LE(32,pos+6);
   ico.writeUInt32LE(buffer.length,pos+8);ico.writeUInt32LE(offset,pos+12);offset+=buffer.length;
 });
 fs.writeFileSync(path.join(out,'favicon.ico'),Buffer.concat([ico,...pngs.map(x=>x.buffer)]));
 function luminance(hex){const rgb=hex.match(/[a-f\d]{2}/gi).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
 console.log(JSON.stringify({directory:out,files:fs.readdirSync(out).length,whiteOnOrangeContrast:(1.05/(luminance(orange)+.05)).toFixed(2)},null,2));
}
main().catch(e=>{console.error(e);process.exit(1)});
