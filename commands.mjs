import{commandBridge}from'./.ink-commands/command-bridge.js';
async function ready(){if(!globalThis.PixelateActions)await new Promise(resolve=>addEventListener('pixelate-ready',resolve,{once:true}));return globalThis.PixelateActions;}
commandBridge({origin:new URLSearchParams(location.search).get('desktopOrigin')||location.origin,handlers:{pixelate:async input=>(await ready()).open(input),presets:async()=>(await ready()).presets(),history:async()=>(await ready()).history()}});
