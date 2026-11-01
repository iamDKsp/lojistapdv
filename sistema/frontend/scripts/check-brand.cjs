const fs=require('fs');const path=require('path');const ts=require('typescript');
const root=path.resolve(__dirname,'../src');
const palette=new Set(['#7C3AED','#6D28D9','#FFFFFF','#F8F7FC','#F3E8FF','#272321','#665F70','#E5E1ED'].map(s=>s.toLowerCase()));
const issues=[];let files=0;
const colors=/#[0-9a-f]{8}\b|#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi;
const forbidden=/\b(?:bg|text|border|ring|fill|stroke|from|to|via)-(?:red|orange|amber|yellow|green|emerald|teal|cyan|blue|indigo|sky|pink|rose|fuchsia|violet|purple|zinc|slate|gray|neutral|stone)-\d+\b/g;
function inspect(value,file){
 for(const raw of value.match(colors)||[]){let normalized=raw.toLowerCase();if(normalized.length===4)normalized='#'+normalized.slice(1).split('').map(c=>c+c).join('');if(normalized.length===9)normalized=normalized.slice(0,7);if(!palette.has(normalized))issues.push(`${file}: cor ${raw} fora da paleta`);}
 for(const utility of value.match(forbidden)||[])issues.push(`${file}: classe ${utility} não usa token da marca`);
}
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name),relative=path.relative(root,p);if(entry.isDirectory())walk(p);else if(/\.(ts|tsx|css)$/.test(p)){files++;const content=fs.readFileSync(p,'utf8');if(p.endsWith('.css'))inspect(content,relative);else{const sf=ts.createSourceFile(p,content,ts.ScriptTarget.Latest,true);function visit(node){if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)||[ts.SyntaxKind.TemplateHead,ts.SyntaxKind.TemplateMiddle,ts.SyntaxKind.TemplateTail].includes(node.kind))inspect(node.text,relative);ts.forEachChild(node,visit);}visit(sf);}}}}
walk(root);
if(issues.length){console.error([...new Set(issues)].join('\n'));process.exit(1);}
console.log(`Paleta aprovada: ${files} arquivos verificados. Nenhuma cor externa à identidade.`);
