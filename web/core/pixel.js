// Pure pixel conversion: works in a browser or Node. No model calls, random noise,
// automatic cropping, frame recentering, or independently chosen frame palettes.
export const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const dist=(a,b)=>2*(a[0]-b[0])**2+3*(a[1]-b[1])**2+(a[2]-b[2])**2;
export function convertPixels(data,sw,sh,width,height,{palette,mode='clusters',outline=false,features=[13,14,16,17]}={}){
 const colours=palette.map(rgb),labels=new Int16Array(width*height).fill(-1),confidence=new Float32Array(width*height),coverage=new Float32Array(width*height),cache=new Map();
 const nearest=(r,g,b)=>{const key=(r<<16)|(g<<8)|b;if(cache.has(key))return cache.get(key);let best=0,score=Infinity;for(let i=0;i<colours.length;i++){const d=dist([r,g,b],colours[i]);if(d<score){score=d;best=i}}cache.set(key,best);return best;};
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const index=y*width+x,votes=new Float64Array(colours.length);let alpha=0,count=0;
  if(mode==='nearest'){
   const p=(Math.min(sh-1,Math.floor((y+.5)*sh/height))*sw+Math.min(sw-1,Math.floor((x+.5)*sw/width)))*4;
   coverage[index]=data[p+3]/255;confidence[index]=1;if(data[p+3]>=128)labels[index]=nearest(data[p],data[p+1],data[p+2]);continue;
  }
  for(let yy=Math.floor(y*sh/height);yy<Math.floor((y+1)*sh/height);yy++)for(let xx=Math.floor(x*sw/width);xx<Math.floor((x+1)*sw/width);xx++){
   const p=(yy*sw+xx)*4,a=data[p+3]/255;alpha+=a;count++;
   if(a>.08){const k=nearest(data[p],data[p+1],data[p+2]);votes[k]+=a*(features.includes(k)?1.25:1);}
  }
  coverage[index]=alpha/count;if(coverage[index]<.48)continue;
  let best=0,total=0;for(let k=0;k<votes.length;k++){total+=votes[k];if(votes[k]>votes[best])best=k}
  labels[index]=best;confidence[index]=votes[best]/Math.max(.001,total);
 }
 if(mode==='clusters'){
  const copy=labels.slice();
  for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
   const i=y*width+x,c=copy[i];if(c<0||features.includes(c)||confidence[i]>.78)continue;
   const n=[copy[i-1],copy[i+1],copy[i-width],copy[i+width]];
   for(const v of n)if(v>=0&&v!==c&&n.filter(k=>k===v).length>=3&&dist(colours[v],colours[c])<20000){labels[i]=v;break;}
  }
 }
 if(outline){const copy=labels.slice();for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){const i=y*width+x;if(copy[i]<0&&[copy[i-1],copy[i+1],copy[i-width],copy[i+width]].some(k=>k>=0))labels[i]=0;}}
 return {width,height,labels,confidence,coverage,palette};
}
export function stabiliseLoop(frames,{features=[13,14,16,17]}={}){
 // Symmetric, cyclic correction only for uncertain one-frame colour flashes.
 // Moving silhouettes and high-confidence details are never frozen or smeared.
 return frames.map((frame,i)=>{
  const colours=frame.palette.map(rgb),labels=frame.labels.slice(),before=frames[(i+frames.length-1)%frames.length],after=frames[(i+1)%frames.length];
  for(let p=0;p<labels.length;p++)if(labels[p]>=0&&!features.includes(labels[p])&&frame.confidence[p]<.52&&before.labels[p]===after.labels[p]&&before.labels[p]>=0&&before.confidence[p]>.6&&after.confidence[p]>.6&&dist(colours[labels[p]],colours[before.labels[p]])<7000)labels[p]=before.labels[p];
  return {...frame,labels};
 });
}
export function rgbaOf(frame){const colours=frame.palette.map(rgb),out=new Uint8ClampedArray(frame.width*frame.height*4);frame.labels.forEach((k,i)=>{if(k>=0){out.set(colours[k],i*4);out[i*4+3]=255;}});return out;}
export function shadeClusters(frame){
 // A small relief pass turns large flat blue regions into deliberate light/shade
 // clusters. The palette indices are supplied by this preset, never sampled per frame.
 const {width:w,height:h}=frame,base=frame.labels,labels=base.slice(),d=new Float32Array(base.length);
 for(let i=0;i<d.length;i++)d[i]=base[i]<0?0:100;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(base[i]<0)continue;d[i]=Math.min(d[i],x?d[i-1]+1:1,y?d[i-w]+1:1);}
 for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const i=y*w+x;if(base[i]<0)continue;d[i]=Math.min(d[i],x<w-1?d[i+1]+1:1,y<h-1?d[i+w]+1:1);}
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
  const i=y*w+x,c=base[i],gx=d[i+1]-d[i-1],gy=d[i+w]-d[i-w],n=Math.hypot(gx,gy),light=n?(.6*gx+.8*gy)/n:0;
  if(c===3){if(light>.82)labels[i]=d[i]<3?4:21;else if(light>.25)labels[i]=21;else if(light<-.55)labels[i]=24;}
  if(c===0&&d[i]<=1&&light>.25){const adjacent=[base[i-1],base[i+1],base[i-w],base[i+w]];if(adjacent.some(k=>[2,3,4,5].includes(k)))labels[i]=2;}
 }
 return {...frame,labels};
}
export function metrics(frames){
 const area=frames.map(f=>f.labels.reduce((n,k)=>n+(k>=0),0));const mean=area.reduce((a,b)=>a+b,0)/area.length;
 const changes=frames.map((f,i)=>{const n=frames[(i+1)%frames.length];let count=0;for(let p=0;p<f.labels.length;p++)count+=f.labels[p]!==n.labels[p];return count;});
 return {width:frames[0].width,height:frames[0].height,frames:frames.length,colours:new Set(frames.flatMap(f=>[...f.labels].filter(k=>k>=0))).size,areaRange:[Math.min(...area),Math.max(...area)],areaVariation:Math.sqrt(area.reduce((n,a)=>n+(a-mean)**2,0)/area.length)/mean,cyclicFrameChanges:changes,edgeClipped:frames.some(f=>{for(let x=0;x<f.width;x++)if(f.labels[x]>=0||f.labels[(f.height-1)*f.width+x]>=0)return true;for(let y=0;y<f.height;y++)if(f.labels[y*f.width]>=0||f.labels[y*f.width+f.width-1]>=0)return true;return false;})};
}

export function crispContours(frame,{ink=0,litInk=25}={}){
 // Build the contour on the native grid, after colour conversion. This keeps
 // the outer line exactly one occupied cell thick instead of sampling a
 // fractional-width SVG stroke. Geometry and camera stay in the authored frame.
 const {width:w,height:h}=frame,base=frame.labels,labels=base.slice(),inside=(x,y)=>x>=0&&x<w&&y>=0&&y<h&&base[y*w+x]>=0;
 const edge=new Uint8Array(base.length);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(base[i]>=0)edge[i]=!inside(x-1,y)||!inside(x+1,y)||!inside(x,y-1)||!inside(x,y+1);}
 // Replace the old dark stroke just inside the new contour with its nearest
 // cloth fill. High-contrast face and skull details remain untouched.
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
  const i=y*w+x;if(base[i]!==ink||edge[i])continue;
  const ns=[i-1,i+1,i-w,i+w];if(!ns.some(n=>edge[n]))continue;
  let nearBone=false;for(let yy=-2;yy<=2;yy++)for(let xx=-2;xx<=2;xx++)if([11,12,13,14].includes(base[(y+yy)*w+x+xx]))nearBone=true;if(nearBone)continue;
  const fills=ns.map(n=>base[n]).filter(k=>[2,3,4,21,22,23,24,25,26,27,28,29,30,31,32].includes(k));
  if(fills.length>=2)labels[i]=fills.sort((a,b)=>fills.filter(k=>k===b).length-fills.filter(k=>k===a).length)[0];
 }
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=y*w+x;if(!edge[i])continue;
  const blue=[2,3,4,5,21,22,23,24,25,26,27,28,29,30,31,32].includes(base[i])||[base[i-1],base[i+1],base[i-w],base[i+w]].some(k=>[3,4,26,27,28,29,30].includes(k));
  const lit=!inside(x,y-1)||!inside(x-1,y);labels[i]=blue&&lit?litInk:ink;
 }
 return {...frame,labels};
}
