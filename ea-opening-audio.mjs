// Ambient sound is opt-in and owns no game clock or random state.
export function createOpeningAudio({enabled,volume,visible}){
 let ctx,source,gain,token=0;
 function stop(){token++;try{source?.stop();}catch{}source?.disconnect();gain?.disconnect();source=gain=null;ctx?.suspend().catch(()=>{});}
 async function play(page){stop();if(!enabled()||!visible())return false;const request=token;
  try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return false;ctx??=new C();await ctx.resume();if(request!==token||!enabled()||!visible())return false;
   const buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),data=buffer.getChannelData(0);let smooth=0;
   for(let i=0;i<data.length;i++){smooth=(smooth+.035*(Math.random()*2-1))/1.035;data[i]=smooth*4;}
   source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;gain=ctx.createGain();gain.gain.value=(page===0?.16:page===1?.08:.035)*volume();source.connect(gain);gain.connect(ctx.destination);source.start();return true;
  }catch{stop();return false;}
 }
 return {play,stop};
}
