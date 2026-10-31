import {labOf,colourDistance,hueRegion,HUE_NAMES,rgbOf} from './colour.js';
import {MASTER_PALETTE,PALETTE_NAME} from './palette-128.js';
export const rampRegion=hex=>{
 const lab=labOf(hex),[r,g,b]=rgbOf(hex),v=Math.max(r,g,b),lo=Math.min(r,g,b),d=v-lo;
 if(lab[0]<.6&&Math.hypot(lab[1],lab[2])<.065)return 12;
 const hue=d?(((v===r?(g-b)/d:v===g?(b-r)/d+2:(r-g)/d+4)*60+360)%360):0;
 if(hue>=35&&hue<85&&d/v>.5&&v>.6)return 2;
 const region=hueRegion(hex);return region===7?8:region;
};
// Choose once for the union of views and frames. Never choose colours per frame.
export function createRampPlan(frames,maxShades=3,master=MASTER_PALETTE,{preserveRange=false}={}){
 if(!Number.isInteger(maxShades)||maxShades<1||maxShades>8)throw Error('Shades per hue must be 1–8');
 const counts=new Map();for(const f of frames)for(const k of f.labels)if(k>=0){const hex=f.palette[k];counts.set(hex,(counts.get(hex)||0)+1);}
 const source=[...counts].map(([hex,n])=>({hex,n,lab:labOf(hex),region:rampRegion(hex)})),dest=master.map((hex,index)=>({hex,index,lab:labOf(hex),region:rampRegion(hex)})),mapping=new Map(),ramps=[];
 for(let region=0;region<HUE_NAMES.length;region++){
  const values=source.filter(c=>c.region===region);if(!values.length)continue;const candidates=dest.filter(c=>c.region===region);if(!candidates.length)throw Error('Master palette has no '+HUE_NAMES[region]+' coverage');
  // Exhaustive combinations are small (typically 8–12 candidates, three shades).
  // Weighted perceptual error chooses a fixed ramp, without dithering.
  const limit=Math.min(maxShades,values.length,candidates.length);let best=[],bestCost=Infinity;
  const score=selected=>values.reduce((sum,s)=>sum+(preserveRange?Math.sqrt(s.n):s.n)*Math.min(...selected.map(d=>colourDistance(s.lab,d.lab))),0);
  function search(start,picked){if(picked.length===limit){const cost=score(picked);if(cost<bestCost){bestCost=cost;best=[...picked];}return;}for(let i=start;i<=candidates.length-(limit-picked.length);i++)search(i+1,[...picked,candidates[i]]);}
  if(limit<=4&&candidates.length<=24)search(0,[]);else {while(best.length<limit){let chosen,scoreValue=Infinity;for(const d of candidates){if(best.includes(d))continue;const cost=score([...best,d]);if(cost<scoreValue){scoreValue=cost;chosen=d;}}best.push(chosen);}}
  best.sort((a,b)=>a.lab[0]-b.lab[0]);for(const s of values){let nearest=best[0];for(const d of best)if(colourDistance(s.lab,d.lab)<colourDistance(s.lab,nearest.lab))nearest=d;mapping.set(s.hex,nearest.index);}
  ramps.push({name:HUE_NAMES[region],region,indices:best.map(c=>c.index),colours:best.map(c=>c.hex)});
 }
 return {name:PALETTE_NAME,maxShades,master,mapping,ramps};
}
export function remapFrame(frame,plan){return {...frame,palette:plan.master,labels:Int16Array.from(frame.labels,k=>k<0?-1:plan.mapping.get(frame.palette[k]))};}
export function rampUsage(frames){const used=new Set(frames.flatMap(f=>[...f.labels].filter(k=>k>=0).map(k=>f.palette[k]))),regions={};for(const hex of used){const name=HUE_NAMES[rampRegion(hex)];(regions[name]??=[]).push(hex);}return {total:used.size,regions};}
