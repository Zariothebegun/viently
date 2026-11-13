// Coloração de sintaxe mínima para a janela de código do quadro.
export type TokenKind = "kw" | "num" | "str" | "com" | "fn" | "op" | "txt";
export type Token = { text: string; kind: TokenKind };
const KEYWORDS = new Set(["import","from","as","def","return","if","elif","else","for","while","in","not","and","or","is","None","True","False","lambda","class","with","try","except","finally","raise","pass","break","continue","const","let","var","function","async","await","new","null","true","false","undefined","this","of","export","default","print"]);
export const CODE_COLORS: Record<TokenKind,string> = {kw:"#a9a4ff",num:"#7fe0a1",str:"#f2c879",com:"#6f7a93",fn:"#7cc4ff",op:"#d7dcea",txt:"#e8ecf6"};
export function tokenizeLine(line:string):Token[] {
 const out:Token[]=[]; const push=(text:string,kind:TokenKind)=>{if(text)out.push({text,kind});}; let i=0;
 while(i<line.length){const ch=line[i];
  if(ch==="#"||(ch==="/"&&line[i+1]==="/")){push(line.slice(i),"com");break;}
  if(ch==='"'||ch==="'"||ch==="`"){let j=i+1;while(j<line.length&&line[j]!==ch){if(line[j]==="\\")j++;j++;}push(line.slice(i,Math.min(line.length,j+1)),"str");i=Math.min(line.length,j+1);continue;}
  if(/[0-9]/.test(ch)||(ch==="."&&/[0-9]/.test(line[i+1]??""))){let j=i+1;while(j<line.length&&/[0-9._eE]/.test(line[j]))j++;push(line.slice(i,j),"num");i=j;continue;}
  if(/[A-Za-z_]/.test(ch)){let j=i+1;while(j<line.length&&/[A-Za-z0-9_]/.test(line[j]))j++;const word=line.slice(i,j);push(word,KEYWORDS.has(word)?"kw":line[j]==="("?"fn":"txt");i=j;continue;}
  if(/\s/.test(ch)){let j=i+1;while(j<line.length&&/\s/.test(line[j]))j++;push(line.slice(i,j),"txt");i=j;continue;}
  push(ch,"op");i++;
 } return out;
}
export const CODE_CHAR_W=1.58,CODE_LINE_H=3.8,CODE_HEADER_H=5.4,CODE_GUTTER_W=5.6;
export function codeCharsPerLine(w:number){return Math.max(12,Math.floor((w-CODE_GUTTER_W-3)/CODE_CHAR_W));}
export function codeDefaultHeight(n:number){return CODE_HEADER_H+2.4+n*CODE_LINE_H;}
export function codeTotalChars(lines:string[]){return lines.reduce((s,l)=>s+l.length,0);}
export function visibleChars(lines:string[],budget:number){let left=Math.max(0,Math.floor(budget));return lines.map(line=>{const n=Math.min(line.length,left);left-=n;return n;});}
