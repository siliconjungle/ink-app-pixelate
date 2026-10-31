// The source grid is authored, so never estimate it or move individual frames.
import {labOf,hexOfLab,colourDistance} from './colour.js';
import {createRampPlan,remapFrame,rampRegion} from './ramps.js';
const hex=rgb=>'#'+rgb.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
const distance=(a,b)=>colourDistance(a,b);
function clusters(points,count,iterations=10){
 if(!points.length)return [];
 // Stable farthest-point initialisation. No random seeds or per-frame fitting.
 let seeds=[points.reduce((a,b)=>a.weight>b.weight?a:b).lab.slice()];
 while(seeds.length<Math.min(count,points.length)){
  let chosen=null,best=1e-8;
  for(const p of points){const d=Math.min(...seeds.map(s=>distance(p.lab,s)));const score=d*Math.sqrt(p.weight);if(score>best){best=score;chosen=p;}}
  if(!chosen)break;seeds.push(chosen.lab.slice());
 }
 for(let pass=0;pass<iterations;pass++){
  const sums=seeds.map(()=>[0,0,0,0]);
  for(const p of points){let k=0,d=Infinity;seeds.forEach((s,i)=>{const v=distance(p.lab,s);if(v<d){d=v;k=i;}});for(let c=0;c<3;c++)sums[k][c]+=p.lab[c]*p.weight;sums[k][3]+=p.weight;}
  let delta=0;seeds=seeds.map((s,i)=>{if(!sums[i][3])return s;const n=sums[i].slice(0,3).map(v=>v/sums[i][3]);delta+=distance(n,s);return n;});if(delta<1e-10)break;
 }
 return seeds;
}
export function fitStructure(rasters,count=24){
 const hist=new Map();
 for(const r of rasters)for(let i=0;i<r.data.length;i+=4){const a=r.data[i+3]/255;if(a<.5)continue;const rgb=[r.data[i],r.data[i+1],r.data[i+2]],key=rgb.map(v=>v>>3).join(',');let p=hist.get(key);if(!p){p={rgb:[0,0,0],weight:0};hist.set(key,p);}p.weight+=a;rgb.forEach((v,c)=>p.rgb[c]+=v*a);}
 const points=[...hist.values()].map(p=>({...p,lab:labOf(hex(p.rgb.map(v=>v/p.weight)))}));
 return clusters(points,count);
}
export function reconstructRaster(data,sw,sh,width,height,{structure,method='structure',alphaThreshold=.5}={}){
 const labels=new Int16Array(width*height).fill(-1),confidence=new Float32Array(labels.length),coverage=new Float32Array(labels.length),palette=[],lookup=new Map(),colourCache=new Map();
 function describe(r,g,b){const key=(r<<16)|(g<<8)|b;if(colourCache.has(key))return colourCache.get(key);const lab=labOf(hex([r,g,b]));let label=0,dist=Infinity;if(structure)structure.forEach((s,i)=>{const d=distance(s,lab);if(d<dist){dist=d;label=i;}});const p={lab,label};colourCache.set(key,p);return p;}
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const points=[],x0=x*sw/width,x1=(x+1)*sw/width,y0=y*sh/height,y1=(y+1)*sh/height;let alpha=0,area=0;
  // Fractional footprint areas matter for non-integer SVG output sizes.
  for(let yy=Math.floor(y0);yy<Math.ceil(y1);yy++)for(let xx=Math.floor(x0);xx<Math.ceil(x1);xx++){
   const overlap=(Math.min(xx+1,x1)-Math.max(xx,x0))*(Math.min(yy+1,y1)-Math.max(yy,y0));if(overlap<=0)continue;
   const i=(yy*sw+xx)*4,a=data[i+3]/255;area+=overlap;alpha+=a*overlap;if(a<.08)continue;
   const rgb=[data[i],data[i+1],data[i+2]],p=describe(...rgb);
   const dx=((xx+.5)-(x0+x1)/2)/(x1-x0),dy=((yy+.5)-(y0+y1)/2)/(y1-y0);
   const center=method==='structure'?Math.exp(-3*(dx*dx+dy*dy)):1;
   points.push({...p,rgb,weight:overlap*a*center});
  }
  const index=y*width+x;coverage[index]=alpha/Math.max(area,1e-6);if(coverage[index]<alphaThreshold||!points.length)continue;
  let local=structure;if(method==='kcentroid')local=clusters(points,2,6);
  const groups=new Map();let total=0;
  for(const p of points){let key=p.label;if(method==='kcentroid'){key=0;let best=Infinity;local.forEach((s,k)=>{const d=distance(p.lab,s);if(d<best){best=d;key=k;}});}let g=groups.get(key);if(!g){g={weight:0,rgb:[0,0,0]};groups.set(key,g);}g.weight+=p.weight;total+=p.weight;p.rgb.forEach((v,c)=>g.rgb[c]+=v*p.weight);}
  const winner=[...groups.values()].reduce((a,b)=>a.weight>=b.weight?a:b);const value=hex(winner.rgb.map(v=>v/winner.weight));
  if(!lookup.has(value)){lookup.set(value,palette.length);palette.push(value);}labels[index]=lookup.get(value);confidence[index]=winner.weight/total;
 }
 return {width,height,labels,confidence,coverage,palette};
}
export function adoptOrphans(frame){
 // Conservative Adopt Pixels-inspired pass: only low-confidence, low-contrast,
 // same-hue isolated pixels. Eyes, sockets, silhouettes and 1px lines survive.
 const {width:w,height:h,palette}=frame,labels=frame.labels.slice(),labs=palette.map(labOf),regions=palette.map(rampRegion);let changes=0;
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
  const i=y*w+x,c=frame.labels[i];if(c<0||frame.confidence[i]>.72)continue;
  const neighbors=[i-1,i+1,i-w,i+w].map(j=>frame.labels[j]);if(neighbors.some(k=>k<0)||neighbors.includes(c))continue;
  const votes=new Map();neighbors.forEach(k=>votes.set(k,(votes.get(k)||0)+1));
  for(const [k,n] of votes)if(n>=3&&regions[k]===regions[c]&&distance(labs[k],labs[c])<.004){labels[i]=k;changes++;break;}
 }
 return {...frame,labels,adopted:changes};
}
export function convertSequence(rasters,width,height,{method='structure',maxShades=3,fixed=true,cleanup=true}={}){
 const structure=method==='structure'?fitStructure(rasters):null;
 const sampled=rasters.map(r=>reconstructRaster(r.data,r.width,r.height,width,height,{structure,method}));
 const plan=fixed?createRampPlan(sampled,maxShades,undefined,{preserveRange:true}):null;
 let frames;
 if(plan)frames=sampled.map(f=>remapFrame(f,plan));
 else {
  const counts=new Map();for(const f of sampled)for(const k of f.labels)if(k>=0){const h=f.palette[k];counts.set(h,(counts.get(h)||0)+1);}
  const points=[...counts].map(([hex,weight])=>({hex,weight,lab:labOf(hex)}));
  const centers=clusters(points,24),palette=centers.map(c=>hexOfLab(c)||points.reduce((a,b)=>distance(a.lab,c)<distance(b.lab,c)?a:b).hex);
  const mapping=new Map(points.map(p=>{let k=0,d=Infinity;centers.forEach((c,i)=>{const v=distance(p.lab,c);if(v<d){d=v;k=i;}});return [p.hex,k];}));
  frames=sampled.map(f=>({...f,palette,labels:Int16Array.from(f.labels,k=>k<0?-1:mapping.get(f.palette[k]))}));
 }
 if(cleanup&&plan)frames=frames.map(adoptOrphans);
 return {frames,plan,structure};
}
