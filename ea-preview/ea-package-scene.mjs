/** The inheritance choice is painted over the mother's bundle; the shared simulation owns the choice. */
export function createPackageScene({choose}) {
  const canvas=document.createElement('canvas');
  canvas.setAttribute('aria-label','母亲留下的包裹：左右切换传承，再承接一条');
  canvas.tabIndex=0;
  Object.assign(canvas.style,{position:'fixed',inset:'0',width:'100vw',height:'100vh',zIndex:'10000',display:'none',touchAction:'none'});
  document.body.append(canvas);
  const ink=canvas.getContext('2d');
  const wide=new Image(),portraitImage=new Image();
  wide.src=new URL('../assets/opening-bundle-wide.png',import.meta.url).href;
  portraitImage.src=new URL('../assets/opening-bundle-portrait.png',import.meta.url).href;
  wide.onload=portraitImage.onload=()=>draw();
  if(window.FontFace){
    const font=new FontFace('OpeningSerif',`url(${new URL('../assets/opening-serif.ttf',import.meta.url).href})`);
    font.load().then(loaded=>{document.fonts.add(loaded);draw();}).catch(()=>{});
  }
  const colors={qinglan:'#73c9af',chiyang:'#f28561',hanquan:'#9fc9f4',houttu:'#e8b86d',jinfeng:'#eddfbd'};
  const warm='#f2ddb0',soft='#cbd3cc',gold='#ebbb64';
  let view=null,selected=0,error='',portrait=false,scaleX=1,scaleY=1;
  function line(copy,x,y,size,color=warm){
    ink.font=`${size}px "OpeningSerif","Noto Serif SC","Songti SC",serif`;
    ink.textAlign='left';ink.fillStyle=color;ink.fillText(copy,x,y);
  }
  function center(copy,x,y,size,color=warm){
    ink.font=`${size}px "OpeningSerif","Noto Serif SC","Songti SC",serif`;
    ink.textAlign='center';ink.fillStyle=color;ink.fillText(copy,x,y);
  }
  function rule(x1,y,x2,opacity=.28){
    ink.strokeStyle=`rgba(237,203,145,${opacity})`;ink.lineWidth=1;
    ink.beginPath();ink.moveTo(x1,y);ink.lineTo(x2,y);ink.stroke();
  }
  function switchArrow(x,y,direction){
    ink.fillStyle='rgba(26,33,36,.82)';ink.beginPath();ink.arc(x,y,34,0,Math.PI*2);ink.fill();
    ink.strokeStyle='rgba(224,179,110,.8)';ink.lineWidth=2;ink.beginPath();ink.arc(x,y,31,0,Math.PI*2);ink.stroke();
    ink.strokeStyle=gold;ink.lineWidth=3;ink.beginPath();
    ink.moveTo(x-7*direction,y-12);ink.lineTo(x+7*direction,y);ink.lineTo(x-7*direction,y+12);ink.stroke();
  }
  function artLine(label,name,x,y,endX){
    line(label,x,y,22,gold);line(name,x+88,y,27,warm);rule(x,y+18,endX,.25);
  }
  function plaque(x,y,w,h){
    ink.fillStyle='rgba(69,41,26,.94)';ink.fillRect(x,y,w,h);
    ink.strokeStyle=gold;ink.lineWidth=2;ink.strokeRect(x+3,y+3,w-6,h-6);
    rule(x+16,y+11,x+w-16,.48);center('承此传承',x+w/2,y+h*.68,31,warm);
  }
  function paintLandscape(option){
    ink.drawImage(wide,0,0,1536,1024);
    const shadow=ink.createLinearGradient(775,0,1536,0);
    shadow.addColorStop(0,'rgba(5,7,8,0)');shadow.addColorStop(1,'rgba(5,7,8,.72)');
    ink.fillStyle=shadow;ink.fillRect(775,0,761,1024);
    line('母亲留下的包裹',936,235,35);line('旧布结松开，一卷传承仍在。',936,279,22,soft);rule(936,305,1388,.4);
    switchArrow(953,371,-1);switchArrow(1390,371,1);
    line(option.name||'',1009,385,52,colors[option.id]||warm);line(`${option.element||''}行`,1170,379,27,soft);
    line(option.flavor||'',1009,430,25);line(`${selected+1} / ${view.options.length}`,1300,466,22,soft);
    artLine('心法',option.heartName||'',936,540,1388);
    artLine('攻伐',option.attackName||'',936,615,1388);
    artLine('护持',option.guardName||'',936,690,1388);
    plaque(974,783,370,79);
    if(error)line(error,936,904,21,'#ffa184');
  }
  function paintPortrait(option){
    ink.drawImage(portraitImage,0,0,1024,1536);
    const shadow=ink.createLinearGradient(0,1050,0,1536);
    shadow.addColorStop(0,'rgba(5,7,8,0)');shadow.addColorStop(1,'rgba(5,7,8,.91)');
    ink.fillStyle=shadow;ink.fillRect(0,1050,1024,486);
    line('母亲留下的包裹',88,190,50);line('旧布结松开，一卷传承仍在。',88,238,25,soft);
    switchArrow(104,1183,-1);switchArrow(920,1183,1);
    center(option.name||'',512,1200,46,colors[option.id]||warm);
    center(`${option.element||''}行  ·  ${option.flavor||''}`,512,1241,25);
    center(`${selected+1} / ${view.options.length}`,512,1150,22,soft);
    artLine('心法',option.heartName||'',93,1270,930);
    artLine('攻伐',option.attackName||'',93,1320,930);
    artLine('护持',option.guardName||'',93,1370,930);
    plaque(332,1431,360,72);
    if(error)line(error,93,1420,20,'#ffa184');
  }
  function draw(){
    if(view?.status!=='pending')return;
    const dpr=Math.min(window.devicePixelRatio||1,2),width=window.innerWidth,height=window.innerHeight;
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    ink.setTransform(dpr,0,0,dpr,0,0);
    ink.fillStyle='#070d12';ink.fillRect(0,0,width,height);
    portrait=width<height*.9;
    scaleX=width/(portrait?1024:1536);scaleY=height/(portrait?1536:1024);
    ink.scale(scaleX,scaleY);
    const image=portrait?portraitImage:wide;
    if(!image.complete||!image.naturalWidth)return;
    const option=view.options[selected]||{};
    if(portrait)paintPortrait(option);else paintLandscape(option);
  }
  function update(next){
    const entering=view?.status!=='pending'&&next?.status==='pending';view=next;
    if(next?.status==='pending'){
      if(entering){selected=0;error='';}
      canvas.style.display='block';draw();if(entering)canvas.focus({preventScroll:true});
    }else canvas.style.display='none';
  }
  function activate(){
    if(!view?.options?.[selected])return;
    const result=choose(view.options[selected].id);
    if(result===null){error='择卷未成，请再试。';draw();}
  }
  canvas.addEventListener('click',event=>{
    if(view?.status!=='pending')return;
    const x=event.clientX/scaleX,y=event.clientY/scaleY;
    const previous=portrait?x>=58&&x<=150&&y>=1137&&y<=1229:x>=909&&x<=997&&y>=327&&y<=415;
    const next=portrait?x>=874&&x<=966&&y>=1137&&y<=1229:x>=1346&&x<=1434&&y>=327&&y<=415;
    if(previous||next){selected=(selected+(previous?view.options.length-1:1))%view.options.length;error='';draw();return;}
    if(portrait?x>=332&&x<=692&&y>=1431&&y<=1503:x>=974&&x<=1344&&y>=783&&y<=862)activate();
  });
  canvas.addEventListener('keydown',event=>{
    if(view?.status!=='pending')return;
    if(['ArrowLeft','ArrowUp','ArrowRight','ArrowDown'].includes(event.key)){
      selected=(selected+(['ArrowLeft','ArrowUp'].includes(event.key)?view.options.length-1:1))%view.options.length;
      draw();event.preventDefault();
    }else if(event.key==='Enter'){activate();event.preventDefault();}
  });
  window.addEventListener('resize',draw);document.fonts?.ready.then(draw);
  return {update};
}
