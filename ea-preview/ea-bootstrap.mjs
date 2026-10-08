// A failed module graph must offer recovery instead of an endless loading page.
let finished=false;
function failed(message){
 const root=document.querySelector('#game');if(!root)return;
 const box=document.createElement('section');box.className='boot-screen';
 const heading=document.createElement('h2');heading.textContent='画卷暂未展开';
 const detail=document.createElement('p');detail.textContent=message;
 const button=document.createElement('button');button.type='button';button.className='primary';button.textContent='重新加载';button.addEventListener('click',()=>location.reload());
 const note=document.createElement('p');note.textContent='本机存档仍保留。重新加载后，从世界列表继续修行。';
 box.append(heading,detail,button,note);root.replaceChildren(box);
}
const timer=setTimeout(()=>{if(!finished&&document.querySelector('#game>.boot-screen'))failed('游戏内容加载较慢，请检查网络后重试。');},20000);
import('./ea-game.mjs?v=ea-160-courtyard-20261008-r17').then(()=>{finished=true;clearTimeout(timer);}).catch(error=>{finished=true;clearTimeout(timer);console.error('仙府启动失败',error);failed('游戏内容未能载入：'+(error?.message||'请重新加载。'));});
