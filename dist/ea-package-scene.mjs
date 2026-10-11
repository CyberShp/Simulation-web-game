/** Painted chapter on the formal game canvas; the shared simulation owns the choice. */
export function createPackageScene({choose}) {
  const canvas=document.createElement('canvas');
  canvas.setAttribute('aria-label','母亲留下的包裹：五道封印，选择一卷传承');
  canvas.tabIndex=0;
  Object.assign(canvas.style,{position:'fixed',inset:'0',width:'100vw',height:'100vh',zIndex:'10000',display:'none',touchAction:'none'});
  document.body.append(canvas);
  const ink=canvas.getContext('2d');
  const wideScroll=new Image(),portraitScroll=new Image();
  const wideRain=new Image(),portraitRain=new Image();
  wideScroll.src=new URL('./assets/opening-scroll-wide.png',import.meta.url).href;
  portraitScroll.src=new URL('./assets/opening-scroll-portrait.png',import.meta.url).href;
  wideRain.src=new URL('./assets/opening-rain-wide.png',import.meta.url).href;
  portraitRain.src=new URL('./assets/opening-rain-portrait.png',import.meta.url).href;
  wideScroll.onload=portraitScroll.onload=wideRain.onload=portraitRain.onload=()=>draw();
  if(window.FontFace){const font=new FontFace('OpeningSerif',`url(${new URL('./assets/opening-serif.ttf',import.meta.url).href})`);font.load().then(loaded=>{document.fonts.add(loaded);draw();}).catch(()=>{});}
  const sealColors={qinglan:'#58a58d',chiyang:'#c46748',hanquan:'#65a7c7',houttu:'#c19c59',jinfeng:'#d4c59d'};
  let view=null,selected=0,error='',portrait=false,scaleX=1,scaleY=1;
  function line(copy,x,y,size,color){ink.font=`${size}px "OpeningSerif","Noto Serif SC","Songti SC",serif`;ink.textAlign='left';ink.fillStyle=color;ink.fillText(copy,x,y);}
  function stroke(x,y,w,h,color='#5b3c28',thickness=2){ink.strokeStyle=color;ink.lineWidth=thickness;ink.strokeRect(x,y,w,h);}
  function seal(x,y,option,chosen,radius){
    ink.fillStyle='#09070666';ink.beginPath();ink.arc(x+3,y+5,radius+5,0,Math.PI*2);ink.fill();
    ink.fillStyle=sealColors[option.id]||'#a88c65';ink.beginPath();ink.arc(x,y,radius-4,0,Math.PI*2);ink.fill();
    ink.strokeStyle=chosen?'#ffda82':'#e4c895';ink.lineWidth=chosen?4:2;ink.beginPath();ink.arc(x,y,chosen?radius+15:radius-9,0,Math.PI*2);ink.stroke();
    line(option.name,x-radius*.55,y+radius*.24,Math.round(radius*.60),'#f8dfae');
  }
  function manuscript(x,y,mark,name){ink.fillStyle='#703c2a';ink.beginPath();ink.arc(x+22,y-18,24,0,Math.PI*2);ink.fill();line(mark,x+8,y-7,23,'#f8dfae');line(name,x+66,y,27,'#392b1e');}
  function ribbon(x,y,w=360,h=74){
    ink.fillStyle='#593022';ink.beginPath();ink.moveTo(x,y);ink.lineTo(x+w,y);ink.lineTo(x+w-17,y+h/2);ink.lineTo(x+w,y+h);ink.lineTo(x,y+h);ink.lineTo(x+17,y+h/2);ink.closePath();ink.fill();stroke(x+5,y+5,w-10,h-10,'#c99b57',2);line('启封此卷',x+w*.29,y+h*.68,28,'#f4dfaa');
  }
  function draw(){
    if(view?.status!=='pending')return;
    const dpr=Math.min(window.devicePixelRatio||1,2),width=window.innerWidth,height=window.innerHeight;
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    ink.setTransform(dpr,0,0,dpr,0,0);
    ink.fillStyle='#07101c';ink.fillRect(0,0,width,height);
    portrait=width<height*.9;
    const rain=portrait?portraitRain:wideRain;
    if(rain.complete&&rain.naturalWidth)ink.drawImage(rain,0,0,width,height);
    ink.fillStyle='#03051038';ink.fillRect(0,0,width,height);
    const option=view.options[selected]||{};
    if(portrait){
      scaleX=width/1024;scaleY=height/1536;
      ink.scale(scaleX,scaleY);
      if(portraitScroll.complete&&portraitScroll.naturalWidth)ink.drawImage(portraitScroll,0,0,1024,1536);
      line('母亲留下的包裹',205,212,47,'#392b1e');line('旧布结里，五道封印尚未拆开。',205,261,24,'#45301f');
      view.options.forEach((item,index)=>seal(211+index*152,367,item,index===selected,56));
      line(`${option.name} · ${option.element}行`,191,570,44,'#392b1e');line(option.flavor||'',191,630,25,'#45301f');
      manuscript(204,742,'心',option.heartName||'');manuscript(204,860,'攻',option.attackName||'');manuscript(204,978,'守',option.guardName||'');
      ink.strokeStyle='#765639';ink.beginPath();ink.moveTo(184,1030);ink.lineTo(824,1030);ink.stroke();
      line('余下封印的去处，仍可循墨记追寻。',192,1080,23,'#45301f');ribbon(332,1193,360,82);
      if(error)line(error,192,1340,21,'#912f26');
    }else{
      scaleX=width/1536;scaleY=height/1024;ink.scale(scaleX,scaleY);
      if(wideScroll.complete&&wideScroll.naturalWidth)ink.drawImage(wideScroll,0,0,1536,1024);
      view.options.forEach((item,index)=>seal(247,211+index*143,item,index===selected,48));
      line('母亲留下的包裹',480,221,44,'#392b1e');ink.strokeStyle='#765639';ink.beginPath();ink.moveTo(475,247);ink.lineTo(1284,247);ink.stroke();
      line('旧布结里，五道封印尚未拆开。',480,284,25,'#45301f');line(`${option.name} · ${option.element}行`,492,378,37,'#392b1e');line(option.flavor||'',492,428,25,'#45301f');
      manuscript(504,515,'心',option.heartName||'');manuscript(504,601,'攻',option.attackName||'');manuscript(504,687,'守',option.guardName||'');
      ink.strokeStyle='#765639';ink.beginPath();ink.moveTo(480,735);ink.lineTo(1240,735);ink.stroke();
      line('余下封印的去处，仍可循墨记追寻。',492,770,23,'#45301f');ribbon(845,804);
      if(error)line(error,492,878,18,'#912f26');
    }
  }
  function update(next){const entering=view?.status!=='pending'&&next?.status==='pending';view=next;if(next?.status==='pending'){if(entering){selected=0;error='';}canvas.style.display='block';draw();if(entering)canvas.focus({preventScroll:true});}else{canvas.style.display='none';}}
  function activate(){const result=choose(view.options[selected].id);if(result===null){error='择卷未成，请再试。';draw();}}
  canvas.addEventListener('click',event=>{
    if(view?.status!=='pending')return;
    const x=event.clientX/scaleX,y=event.clientY/scaleY;
    if(portrait){const index=Math.round((x-211)/152);if(index>=0&&index<view.options.length&&x>=144+index*152&&x<=279+index*152&&y>=296&&y<=441){selected=index;error='';draw();return;}if(x>=332&&x<=692&&y>=1193&&y<=1275)activate();}
    else{const index=Math.round((y-211)/143);if(index>=0&&index<view.options.length&&x>=176&&x<=318&&y>=140+index*143&&y<=280+index*143){selected=index;error='';draw();return;}if(x>=845&&x<=1205&&y>=804&&y<=878)activate();}
  });
  canvas.addEventListener('keydown',event=>{if(view?.status!=='pending')return;if(['ArrowLeft','ArrowUp','ArrowRight','ArrowDown'].includes(event.key)){selected=(selected+(['ArrowLeft','ArrowUp'].includes(event.key)?view.options.length-1:1))%view.options.length;draw();event.preventDefault();}else if(event.key==='Enter'){activate();event.preventDefault();}});
  window.addEventListener('resize',draw);document.fonts?.ready.then(draw);
  return {update};
}
