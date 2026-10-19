const fs=require('fs'),vt=require('vscode-textmate'),on=require('vscode-oniguruma');
const wasm=fs.readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm')).buffer;
const lib=on.loadWASM(wasm).then(()=>({createOnigScanner:p=>new on.OnigScanner(p),createOnigString:s=>new on.OnigString(s)}));
const D=require('path').join(__dirname,'..','syntaxes')+'/';
const reg=new vt.Registry({onigLib:lib,loadGrammar:async s=>{const f={'source.nhl-m68k':'nhl-m68k','source.nhl-65816':'nhl-65816'}[s];return vt.parseRawGrammar(fs.readFileSync(D+f+'.tmLanguage.json','utf8'),f+'.json')}});
(async()=>{
for(const [sc,lines] of [['source.nhl-m68k',[
"Begin\t\t\t\t\t\t\t\t;cold start $FF00FF",
"\tmove.w\t#$FF00FF,(PalMode).w\t;x",
".0\tclr.l\t(a0)+",
"\tcmpa.w\t#(fm_track_slots+(8*6)-M68K_RAM),a0",
"passbits\t\t\trs.w\t5",
"Foo\tequ\t$10",
"\tIF REV>=1",
"\tdc.w\tSPAhook,%1010,12",
"* star comment"]],
['source.nhl-65816',[
"checkcheck:\t\t;x #ff0000",
"\tlda.w #$FF00FF",
"\tsta.b [a0],y",
".save:",
"SPA = $0DFF ; cur",
"\tincsrc \"a.asm\"",
"macro Player(name, w1)",
"\tdb \"<name>\",<w1>>>8",
"?l: dw ?e-?l",
"\tinc a",
"\tjsl.l .cc"]]]){
 const g=await reg.loadGrammar(sc);let st=vt.INITIAL;
 for(const l of lines){const r=g.tokenizeLine(l,st);st=r.ruleStack;console.log(JSON.stringify(l));
  console.log('  '+r.tokens.filter(t=>l.slice(t.startIndex,t.endIndex).trim()).map(t=>l.slice(t.startIndex,t.endIndex).trim()+'→'+t.scopes.slice(1).join('/').replace(/\.nhl-\w+/g,'')).join(' | '));}}
})();
