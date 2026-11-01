const fs=require('fs');
const path=require('path');
const sharp=require('C:/Users/DKS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const out=path.resolve(__dirname,'../identidade/estudo-04-cores');
fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync(path.resolve(__dirname,'../identidade/estudo-03-loja/logo-principal.svg'),'utf8');
const strip=s=>s.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');
const options=[
 {id:'laranja-atual',name:'Laranja queimado',hex:'#C2410C',label:'COR ATUAL',line:'Mais sóbrio e terroso.'},
 {id:'laranja-vivo',name:'Laranja vivo',hex:'#EA580C',label:'ALTERNATIVA',line:'Mais luminoso e chamativo.'},
 {id:'violeta',name:'Violeta',hex:'#7C3AED',label:'ALTERNATIVA',line:'Minha preferência para esta marca.'}
];
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="620" viewBox="0 0 1200 620" role="img" aria-label="A mesma logo PDV Lojista em laranja queimado, laranja vivo e violeta">
<rect width="1200" height="620" fill="#F6F6F6"/>
<g font-family="Segoe UI,Arial,sans-serif" fill="#272321">
<text x="42" y="43" font-size="15" font-weight="600" letter-spacing="2">PDV LOJISTA / COMPARAÇÃO DE CORES</text>
<text x="42" y="74" font-size="16">Mesmo símbolo, mesma tipografia e mesmos fundos nas três opções.</text>
${options.map((o,i)=>{
 const x=42+i*394;
 const logo=source.replaceAll('#C2410C',o.hex);
 fs.writeFileSync(path.join(out,`${o.id}.svg`),logo);
 return `<text x="${x}" y="129" font-size="12" letter-spacing="1.5">${o.label}</text>
 <text x="${x}" y="161" font-size="23" font-weight="600">${o.name}</text>
 <rect x="${x}" y="185" width="328" height="169" rx="12" fill="#FFFFFF"/>
 <g transform="translate(${x+17} 216) scale(.7)">${strip(logo)}</g>
 <rect x="${x}" y="373" width="328" height="141" rx="12" fill="#272321"/>
 <g transform="translate(${x+17} 393) scale(.7)">${strip(logo.replaceAll('fill="#272321"','fill="#FFFFFF"'))}</g>
 <rect x="${x}" y="539" width="26" height="26" rx="6" fill="${o.hex}"/>
 <text x="${x+38}" y="558" font-size="16" font-weight="600">${o.hex}</text>
 <text x="${x}" y="590" font-size="15">${o.line}</text>`;
}).join('')}
</g></svg>`;
fs.writeFileSync(path.join(out,'comparacao-cores.svg'),svg);
async function main(){
 await sharp(Buffer.from(svg)).png().toFile(path.join(out,'comparacao-cores.png'));
 for(const o of options){
  await sharp(Buffer.from(source.replaceAll('#C2410C',o.hex))).png().toFile(path.join(out,`${o.id}.png`));
 }
 console.log(`Comparação salva em ${out}`);
}
main().catch(e=>{console.error(e);process.exit(1)});
