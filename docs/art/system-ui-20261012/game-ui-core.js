/* 云岫山院界面原型：页面共享绘制与交互。 */
window.GamePanels = {};
window.Game = {
  current: 'disciples',
  escape: s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  portrait(index=0,large=false) { return `<span class="portrait ${large?'portrait-large':''} portrait-${index%4}" style="--person-row:${index%2?4:0};--person-col:0"><i></i></span>`; },
  bar(label,value,max,tone='jade') {return `<div class="meter meter-${tone}"><span>${label}</span><div><i style="width:${Math.max(0,Math.min(100,value/max*100))}%"></i></div><b>${value}<small> / ${max}</small></b></div>`;},
  icon(kind) {
    const paths={
      person:'<circle cx="24" cy="12" r="6"/><path d="M14 37l3-17 7 5 7-5 3 17M17 20L9 31m22-11 8 11M19 36l-2 7m12-7 2 7"/>',
      sword:'<path d="M35 5l8 0-1 8-21 22-7-7Z"/><path d="M34 9L17 29M11 26l12 12M15 33l-8 8m-3-3 6 6"/>',
      book:'<path d="M11 7h26v34H11zM15 7v34M20 13h11M20 18h11M21 24h9M21 29h9"/><path d="M8 10v29"/>',
      scroll:'<path d="M13 8h22v29H13zM10 8h6m16 0h6M10 37h6m16 0h6M18 14h12m-12 6h12m-12 6h7"/>',
      herb:'<path d="M22 42Q27 22 21 8M24 25C8 23 6 14 8 10c11-2 18 7 16 15ZM24 32c15-1 19-10 16-16-12 0-17 7-16 16Z"/>',
      pill:'<path d="M18 8h12v6H18zM19 14c0 7-7 9-7 18 0 7 4 10 12 10s12-3 12-10c0-9-7-11-7-18"/><path d="M13 29h22M20 23h8m-6 10h4"/>',
      wood:'<path d="M10 17L31 7l8 22-22 11Z"/><ellipse cx="15" cy="29" rx="6" ry="11" transform="rotate(-20 15 29)"/><path d="M19 19l13-6m-10 14 14-6"/>',
      stone:'<path d="M6 28l8-15 17-6 12 14-6 17-21 3Z"/><path d="M14 13l10 10 19-2M24 23l-8 18m8-18 13 15"/>',
      jade:'<path d="M24 4l14 9 3 17-17 15L7 30l3-17Z"/><path d="M24 4l-7 18 7 23 7-23ZM10 13l7 9-10 8m31-17-7 9 10 8"/>',
      robe:'<path d="M17 7l7 6 7-6 12 14-8 7-4-6 4 20H13l4-20-4 6-8-7Z"/><path d="M17 7l10 21-3 14m7-35-7 16m-10 8h20"/>',
      boot:'<path d="M16 6h17l-2 23 10 6v7H9v-8l8-7Z"/><path d="M17 13h15M17 20h15M10 37h30"/>',
      ring:'<circle cx="24" cy="28" r="13"/><path d="M17 13l7-9 7 9-7 8Z"/><path d="M18 28a6 6 0 0 0 12 0"/>',
      cauldron:'<path d="M10 20h28l-2 15c-3 5-21 5-24 0ZM7 20c-8 0-3 14 5 12m26-12c8 0 3 14-5 12M17 39l-3 6m17-6 3 6M13 15h22M21 8l3-4 3 4"/><path d="M23 23l-5 6 6 6 6-6-7-6"/>',
      forge:'<path d="M7 26h34l-8 8h-7v7H13v-7H9ZM25 7l10-2 7 13-9 4Zm3 13-10 8M7 41h25"/>',
      puppet:'<circle cx="24" cy="10" r="6"/><path d="M18 20h12v15H18ZM18 22l-9 5-4-7m25 2 9 5 4-7M20 35l-8 9m16-9 8 9"/><circle cx="24" cy="26" r="3"/>',
      build:'<path d="M6 23l18-13 18 13M8 20h32M13 24v16m22-16v16M9 40h30M20 40V27h8v13M24 5v6"/>',
      mountain:'<path d="M4 39L18 14l8 11 7-19 12 33ZM11 27l7-3 5 7m7-15 4 5 4-2"/>',
      flag:'<path d="M11 44V5m1 3h26l-6 9 6 9H12"/><path d="M18 14h9m-9 6h12"/>',
      food:'<path d="M7 27h34c-2 12-7 16-17 16S9 39 7 27Zm6-7c-2-6 5-6 3-12m8 12c-2-6 5-6 3-12m8 12c-2-6 5-6 3-12"/>'
    };
    return `<svg class="game-icon icon-${kind}" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[kind]||paths.scroll}</svg>`;
  },
  toast(text) { const el=document.querySelector('#toast');el.textContent=text;el.classList.add('show');clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>el.classList.remove('show'),2600); },
  refresh() {const panel=GamePanels[this.current];if(!panel)return;const focus=document.activeElement;const field=focus?.dataset?.field;const start=focus?.selectionStart;const end=focus?.selectionEnd;const el=document.querySelector('#screen-content');this.rendering=true;el.innerHTML=panel.render();if(field){const next=el.querySelector('[data-field=\"'+field+'\"]');next?.focus({preventScroll:true});if(next?.setSelectionRange && typeof start==='number')next.setSelectionRange(start,end);}this.rendering=false;el.dataset.page=this.current;document.querySelector('#screen-title').textContent=panel.title;requestAnimationFrame(()=>this.drawTree());document.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===this.current));},
  drawTree(){const tree=document.querySelector('.arts-tree');if(!tree)return;tree.querySelector('.arts-connections')?.remove();const r=tree.getBoundingClientRect();let paths='';for(const node of tree.querySelectorAll('[data-parents]')){for(const id of node.dataset.parents.split(',').filter(Boolean)){const parent=tree.querySelector('[data-action=\"arts-node\"][data-id=\"'+id+'\"]');if(!parent)continue;const p=parent.querySelector('.icon-slot').getBoundingClientRect(),n=node.querySelector('.icon-slot').getBoundingClientRect();let d;if(Math.abs(p.x-n.x)<20){const x=p.x+p.width/2-r.x;d='M'+x+','+(p.bottom-r.y)+'V'+(n.top-r.y-6);}else{const x=p.right-r.x,y=p.y+p.height/2-r.y,nx=n.x-r.x-5,ny=n.y+n.height/2-r.y;d='M'+x+','+y+'H'+(x+nx)/2+'V'+ny+'H'+nx;}paths+='<path d=\"'+d+'\" fill=\"none\" stroke=\"#9bad84\" stroke-width=\"1.3\" marker-end=\"url(#arrow)\"/>';}}tree.insertAdjacentHTML('afterbegin','<svg class=\"arts-connections\" viewBox=\"0 0 '+r.width+' '+r.height+'\" aria-hidden=\"true\"><defs><marker id=\"arrow\" viewBox=\"0 0 10 10\" refX=\"9\" refY=\"5\" markerWidth=\"5\" markerHeight=\"5\" orient=\"auto\"><path d=\"M0 0L10 5L0 10Z\" fill=\"#9bad84\"/></marker></defs>'+paths+'</svg>');},
  open(page,params={}) {if(page==='scene'){this.current='scene';document.body.classList.remove('panel-open');document.querySelector('#game-window').hidden=true;document.querySelectorAll('[data-nav]').forEach(b=>b.classList.remove('active'));const pin=document.querySelector('#scene-pin');pin.hidden=!params.label;if(params.label)pin.textContent=params.label;return;}if(!GamePanels[page])return;this.current=page;document.body.classList.add('panel-open');document.querySelector('#game-window').hidden=false;GamePanels[page].enter?.(params);this.refresh();},
};
