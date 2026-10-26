const phases=['山院全景','主殿与建筑','人物与行走','招式与护持','多人同场交战','暮色与灯火'];
const subtitles=['前庭、侧院与松溪河桥','木构、瓦脊与石阶投影','同一人物的连续动作','剑气、飞剑、灵壁与雷印','30 人同场 · 范围预警','日照转暗 · 灯火渐明'];
const names=['青岚剑','飞剑','灵壁','雷印','回风','凝霜','踏云','引灵','破阵','解缚','归元','凝神'];
export function drawHUD(ctx,w,h,{style,t,phase,cd}) {
  ctx.clearRect(0,0,w,h);ctx.save();ctx.scale(w/1600,h/900);
  const text=(s,x,y,size=18,c='#eae4d3')=>{ctx.fillStyle=c;ctx.font=`${size}px Yunxiu`;ctx.fillText(s,x,y);};
  const rect=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h);};
  const panel=(x,y,w,h)=>{ctx.fillStyle='#0d1d22d9';ctx.strokeStyle='#af956f88';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(x,y,w,h,4);ctx.fill();ctx.stroke();};
  panel(28,26,292,102);text('云岫山院',46,60,25,'#d8bd85');text(style==='pixel'?'高清像素 · 实机样板':'D · 国风 3D · 实机样板',46,93,19);text('THREE.JS',237,116,10,'#99adae');
  panel(1184,26,388,101);text(`${String(phase+1).padStart(2,'0')} / 06   ${phases[phase]}`,1204,59,22,'#d8bd85');text(subtitles[phase],1204,89,15);for(let i=0;i<6;i++)rect(1205+i*57,112,48,2,i<=phase?'#ceb582':'#3b4a4b');
  rect(0,897,1600,3,'#1a282dcc');rect(0,897,1600*t/72,3,'#cfb681');
  text(`自动演示   ${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')} / 01:12`,30,879,15);
  if(phase===3||phase===4){
    panel(28,742,246,125);text('掌门',45,771,22,'#d8bd85');text('亲控',221,771,13,'#a5d4b7');
    text('生命',45,800,13);rect(89,790,162,7,'#293e36');rect(89,790,154,7,'#80ae85');text('灵力',45,828,13);rect(89,818,162,7,'#253c49');rect(89,818,117+Math.sin(t)*15,7,'#80b9cf');text('自动施放 · 演示数值',45,854,12,'#a7b9b5');
    panel(482,720,637,149);
    for(let i=0;i<12;i++){
      const x=492+i%6*104,y=730+Math.floor(i/6)*67;rect(x,y,94,58,'#173238e6');ctx.strokeStyle='#70908799';ctx.strokeRect(x,y,94,58);
      ctx.save();ctx.translate(x+25,y+24);ctx.strokeStyle=i%3===2?'#dabd80':'#a3d6cb';ctx.lineWidth=2;ctx.beginPath();
      if(i%4===0){ctx.moveTo(-11,13);ctx.lineTo(11,-14);ctx.moveTo(-12,4);ctx.lineTo(-3,13);}else if(i%4===1){for(let j=0;j<3;j++){ctx.moveTo(-10+j*7,12);ctx.lineTo(-5+j*7,-12);}}else if(i%4===2){ctx.arc(0,0,15,0,Math.PI*2);ctx.moveTo(9,0);ctx.arc(0,0,9,0,Math.PI*2);}else{ctx.moveTo(4,-16);ctx.lineTo(-8,1);ctx.lineTo(7,0);ctx.lineTo(-4,16);}ctx.stroke();ctx.restore();
      text(i<6?`${i+1}`:`⇧${i-5}`,x+62,y+24,12,'#b9c6b9');text(names[i],x+14,y+51,14);
      if(cd[i]>0){rect(x,y,94,58,'#09171ede');text(cd[i].toFixed(1),x+28,y+38,26);}
    }
    panel(1140,787,229,82);text('法宝        丹药',1156,811,14,'#d8bd85');text('F   G        R   T',1156,849,20);text(t<43?'2 人演武':'30 人同场',1430,862,16);
  }
  ctx.restore();
}
