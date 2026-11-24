// Matemática pura para gráficos de superfície e ridgelines em SVG.
import type { Pt } from "./ops";
export type SurfaceFn="gaussian"|"saddle"|"bowl"|"wave"|"ripple";
export const SURFACE_FNS:SurfaceFn[]=["gaussian","saddle","bowl","wave","ripple"];
const clamp=(v:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,v));
export function surfaceZ(fn:SurfaceFn|undefined,x:number,y:number):number{
 switch(fn){case "saddle":return clamp(.5+.5*(x*x-y*y),0,1);case "bowl":return clamp((x*x+y*y)/2,0,1);case "wave":return clamp(.5+.25*Math.sin(3*x)+.25*Math.cos(3*y),0,1);case "ripple":{const r=Math.hypot(x,y);return clamp(.5+.5*Math.cos(7*r)*Math.exp(-2*r*r),0,1);}default:return clamp(Math.exp(-3*(x*x+y*y)),0,1);}
}
export type Vec3=[number,number,number]; export const ELEVATION=.62;
export function project(p:Vec3,az:number):Vec3{const [x,y,z]=p,ca=Math.cos(az),sa=Math.sin(az),X=x*ca-y*sa,Y=x*sa+y*ca;return [X,-Y*Math.sin(ELEVATION)-z*Math.cos(ELEVATION),Y];}
export function fitScale(w:number,h:number){const halfW=Math.SQRT2,top=-(Math.SQRT2*Math.sin(ELEVATION))-Math.cos(ELEVATION),bottom=Math.SQRT2*Math.sin(ELEVATION),scale=Math.min(w/(2*halfW),h/(bottom-top));return {scale,ox:w/2,oy:-top*scale};}
export type Quad={pts:[Pt,Pt,Pt,Pt];depth:number;z:number};
export function surfaceQuads(fn:SurfaceFn|undefined,az:number,w:number,h:number,n=12):Quad[]{
 const {scale,ox,oy}=fitScale(w,h),at=(i:number,j:number):Vec3=>{const x=-1+2*i/n,y=-1+2*j/n;return [x,y,surfaceZ(fn,x,y)];};
 const screen=(p:Vec3):[Pt,number]=>{const q=project(p,az);return [[ox+q[0]*scale,oy+q[1]*scale],q[2]];};
 const out:Quad[]=[];for(let i=0;i<n;i++)for(let j=0;j<n;j++){const c=[at(i,j),at(i+1,j),at(i+1,j+1),at(i,j+1)],s=c.map(screen);out.push({pts:[s[0][0],s[1][0],s[2][0],s[3][0]],depth:(s[0][1]+s[1][1]+s[2][1]+s[3][1])/4,z:(c[0][2]+c[1][2]+c[2][2]+c[3][2])/4});}return out.sort((a,b)=>b.depth-a.depth);
}
export function surfacePath(fn:SurfaceFn|undefined,path:Pt[],az:number,w:number,h:number):Pt[]{const {scale,ox,oy}=fitScale(w,h);return path.map(([x,y])=>{const q=project([clamp(x,-1,1),clamp(y,-1,1),surfaceZ(fn,clamp(x,-1,1),clamp(y,-1,1))+.02],az);return [ox+q[0]*scale,oy+q[1]*scale] as Pt;});}
const SQRT_2PI=Math.sqrt(2*Math.PI),phi=(z:number)=>Math.exp(-.5*z*z)/SQRT_2PI,bigPhi=(z:number)=>1/(1+Math.exp(-1.702*z));
export function density(x:number,mean:number,spread:number,skew=0){const s=Math.max(1e-6,spread),z=(x-mean)/s;return (2/s)*phi(z)*bigPhi(skew*z)*(skew?1:.5);}
export type Ridge={baseline:Pt[];outline:Pt[];median:[Pt,Pt];labelAt:Pt};
export function ridgelines(groups:{mean:number;spread:number;skew?:number}[],w:number,h:number,samples=48):Ridge[]{
 if(!groups.length)return [];const lo=Math.min(...groups.map(g=>g.mean-3*Math.abs(g.spread))),hi=Math.max(...groups.map(g=>g.mean+3*Math.abs(g.spread)));
 const span=Math.max(1e-9,hi-lo),xs=Array.from({length:samples},(_,i)=>lo+span*i/(samples-1)),peaks=groups.map(g=>Math.max(...xs.map(x=>density(x,g.mean,g.spread,g.skew??0)))),top=Math.max(...peaks,1e-9),plotW=w*.8,curveH=h*.36,out:Ridge[]=[];
 for(let k=0;k<groups.length;k++){const g=groups[k],t=groups.length>1?k/(groups.length-1):1,x0=w*.16*t,y0=h*.46+h*.48*t,px=(x:number)=>x0+(x-lo)/span*plotW,py=(d:number)=>y0-d/top*curveH,outline=xs.map(x=>[px(x),py(density(x,g.mean,g.spread,g.skew??0))] as Pt),baseline:Pt[]=[[px(lo),y0],[px(hi),y0]],peak=density(g.mean,g.mean,g.spread,g.skew??0),mx=px(g.mean);out.push({baseline,outline,median:[[mx,y0],[mx,py(Math.max(peak,0))]],labelAt:[px(hi)+1,y0-1]});}return out;
}
export function mix(a:string,b:string,t:number){const pa=parseInt(a.slice(1),16),pb=parseInt(b.slice(1),16),ch=(s:number)=>Math.round(((pa>>s)&255)*(1-t)+((pb>>s)&255)*t);return "#"+[16,8,0].map(s=>ch(s).toString(16).padStart(2,"0")).join("");}
