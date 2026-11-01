const fs=require('fs');const path=require('path');
const root=path.resolve(__dirname,'../sistema/frontend');
const ts=require(path.join(root,'node_modules/typescript'));
const palette=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../identidade/roxo-branco/paleta.json'),'utf8')).colors;
const neutral=/^(zinc|slate|gray|grey|neutral|stone)-/;
const utility=/\b(bg|text|border(?:-[trblxy])?|ring(?:-offset)?|outline|decoration|divide|fill|stroke|shadow|accent|caret|from|to|via)-(white|black|(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|grey|zinc|neutral|stone)-\d{2,3})(?:\/(\d{1,3}))?/g;
const mapUtility=(all,prefix,color,alpha)=>{
 const n=Number(color.split('-').pop());const muted=neutral.test(color);const lowAlpha=alpha!==undefined&&Number(alpha)<=40;
 if(prefix==='text')return `${prefix}-${color==='white'?'ink':color==='black'?'ink':muted?'muted':'brand'}`;
 if(prefix==='bg'){
  if(color==='white')return 'bg-surface';if(color==='black')return alpha?`bg-ink/${alpha}`:'bg-ink';
  if(muted)return 'bg-'+(n>=900?'page':n>=800?'surface':n>=600?'support':n>=300?'line':'page')+(alpha&&Number(alpha)>40?`/${alpha}`:'');
  return `bg-${lowAlpha||n<400?'support':'brand'}`;
 }
 if(prefix.startsWith('border')||prefix==='divide')return `${prefix}-${muted||['white','black'].includes(color)?'line':'brand'}`;
 if(prefix==='ring-offset')return 'ring-offset-surface';
 if(prefix==='shadow')return 'shadow-line';
 if(['from','via','to'].includes(prefix))return `${prefix}-brand`;
 return `${prefix}-${muted||['white','black'].includes(color)?'muted':'brand'}`;
};
function convert(value){
 let result=value.replace(utility,mapUtility);
 const hasSolid=/(?:^|[\s"'`])bg-(?:brand|ink)(?:\s|["'`]|$)/.test(result);
 if(hasSolid){result=result.replace(/\btext-(?:ink|muted|brand)\b/g,'text-on-brand');if(!/\btext-on-brand\b/.test(result))result+=' text-on-brand';}
 if(/\bhover:bg-brand\b/.test(result)&&!result.includes('hover:text-on-brand'))result+=' hover:text-on-brand';
 return result;
}
function colorFor(hex){
 const value=hex.slice(1);let [r,g,b]=value.length===3?value.split('').map(c=>parseInt(c+c,16)):[value.slice(0,2),value.slice(2,4),value.slice(4,6)].map(c=>parseInt(c,16));
 if(Math.max(r,g,b)-Math.min(r,g,b)<25){const avg=(r+g+b)/3;return avg>245?palette.white:avg>210?palette.border:avg>120?palette.textSecondary:palette.text;}
 return palette.primary;
}
let files=0;let utilities=0;
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,item.name);if(item.isDirectory()){if(item.name!=='retail')walk(p);}else if(/\.(tsx?|css)$/.test(p)&&!p.endsWith('globals.css')&&!p.endsWith('brand-tokens.css')){
 let source=fs.readFileSync(p,'utf8');const before=source;
 if(/\.tsx?$/.test(p)){
  const sf=ts.createSourceFile(p,source,ts.ScriptTarget.Latest,true,p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);const changes=[];
  function visit(node){
   if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)||node.kind===ts.SyntaxKind.TemplateHead||node.kind===ts.SyntaxKind.TemplateMiddle||node.kind===ts.SyntaxKind.TemplateTail){
    const start=node.getStart(sf),end=node.getEnd();const raw=source.slice(start,end);
    const suffixLength=[ts.SyntaxKind.TemplateHead,ts.SyntaxKind.TemplateMiddle].includes(node.kind)?2:1;
    const prefix=raw.slice(0,1),suffix=raw.slice(-suffixLength);let next=convert(raw.slice(1,-suffixLength));
    next=next.replace(/#[\da-fA-F]{6}\b|#[\da-fA-F]{3}\b/g,hex=>Object.values(palette).some(v=>v.toLowerCase()===hex.toLowerCase())?hex:colorFor(hex));
    next=next.replace(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/g,(_m,r,g,b,a)=>{const h='#'+[r,g,b].map(v=>Math.round(Number(v)).toString(16).padStart(2,'0')).join('');return a?`color-mix(in srgb, ${colorFor(h)} ${Math.round(Number(a)*100)}%, transparent)`:colorFor(h);});
    next=prefix+next+suffix;
    if(next!==raw){changes.push({start,end,next});utilities++;}
   }
   ts.forEachChild(node,visit);
  }visit(sf);
  for(const change of changes.sort((a,b)=>b.start-a.start))source=source.slice(0,change.start)+change.next+source.slice(change.end);
 }
 if(source!==before){fs.writeFileSync(p,source);files++;}
}}}walk(path.join(root,'src'));
const css=`@import "tailwindcss";
@import "../brand-tokens.css";
@theme inline {
  --color-*: initial;
  --color-brand: var(--pdv-primary);
  --color-brand-hover: var(--pdv-primary-hover);
  --color-surface: var(--pdv-white);
  --color-on-brand: var(--pdv-white);
  --color-page: var(--pdv-background);
  --color-support: var(--pdv-support);
  --color-ink: var(--pdv-text);
  --color-muted: var(--pdv-text-secondary);
  --color-line: var(--pdv-border);
}
@keyframes retail-fade {from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.animate-in{animation:retail-fade .2s ease-out}.custom-scrollbar::-webkit-scrollbar{width:6px;height:6px}.custom-scrollbar::-webkit-scrollbar-thumb{background:var(--pdv-border);border-radius:8px}.custom-scrollbar::-webkit-scrollbar-track{background:transparent}
.numpad-btn{display:flex;align-items:center;justify-content:center;min-height:52px;border-radius:10px;background:var(--pdv-white);border:1px solid var(--pdv-border);color:var(--pdv-text);font-size:20px;font-weight:600}.numpad-btn-action{background:var(--pdv-primary);color:var(--pdv-white)}.numpad-btn-danger{background:var(--pdv-support);color:var(--pdv-primary)}
.pb-safe{padding-bottom:max(env(safe-area-inset-bottom,0px),12px)}.pt-safe{padding-top:max(env(safe-area-inset-top,0px),16px)}.safe-area-bottom{padding-bottom:env(safe-area-inset-bottom,0px)}
@media print{body *{visibility:hidden}.retail-receipt,.retail-receipt *{visibility:visible}.retail-receipt{position:absolute;left:0;top:0;width:78mm;padding:4mm;background:var(--pdv-white);color:var(--pdv-text)}.retail-receipt .retail-logo{width:40mm}.retail-dialog{max-height:none;overflow:visible}.retail-modal-overlay{position:absolute;background:var(--pdv-white);padding:0;display:block}.retail-dialog-body{padding:0}}
`;
fs.writeFileSync(path.join(root,'src/app/globals.css'),css);
console.log(JSON.stringify({files,convertedLiterals:utilities,colors:Object.values(palette)}));
