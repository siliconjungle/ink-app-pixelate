// Perceptual colour utilities. Conversion follows Björn Ottosson's OKLab matrices.
export const rgbOf=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
const linear=v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
const gamma=v=>v<=.0031308?12.92*v:1.055*Math.max(0,v)**(1/2.4)-.055;
export function labOf(hex){const [r,g,b]=rgbOf(hex).map(linear),l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);return [.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s];}
export function hexOfLab([L,a,b]){const l=(L+.3963377774*a+.2158037573*b)**3,m=(L-.1055613458*a-.0638541728*b)**3,s=(L-.0894841775*a-1.291485548*b)**3;const rgb=[4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.707614701*s];if(rgb.some(v=>v<0||v>1))return null;return '#'+rgb.map(v=>Math.round(gamma(v)*255).toString(16).padStart(2,'0')).join('');}
export const colourDistance=(a,b)=>(a[0]-b[0])**2*1.5+(a[1]-b[1])**2+(a[2]-b[2])**2;
export const HUE_NAMES=['red','orange','yellow','lime','green','mint','cyan','azure','blue','violet','magenta','rose','neutral'];
export function hueRegion(hex){const [r,g,b]=rgbOf(hex),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;const lab=labOf(hex);if(max<.3||Math.hypot(lab[1],lab[2])<.025||d<.055)return 12;let h=max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;h=(h*60+360)%360;return Math.floor(((h+15)%360)/30);}
