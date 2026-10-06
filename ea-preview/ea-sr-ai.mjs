/** SR-XF-034: opt-in expression adapter. Secrets remain in this closure, never in saves. */
const MAX_TIMEOUT=8000;
const clean=value=>String(value??'').slice(0,180);
const result=(text,reason,source='template')=>({text,reason,source});
export function createDialogueAI({fetcher=globalThis.fetch,revision=()=>0,clock=()=>Date.now()}={}) {
  let config={enabled:false,endpoint:'',model:'',budget:12,timeout:MAX_TIMEOUT},secret='',spent=0,active=null,generation=0;
  const cache=new Map(),inflight=new Map();
  function cancel(){generation++;active?.abort();active=null;inflight.clear();}
  function configure(next={}){
    cancel();
    const endpoint=String(next.endpoint??config.endpoint).trim();
    if(endpoint){const url=new URL(endpoint);if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw new Error('服务地址须为 HTTPS，或本机 HTTP 地址。');if(url.username||url.password)throw new Error('服务地址不能包含用户名或密码。');}
    if(endpoint!==config.endpoint||next.model!==undefined&&String(next.model)!==config.model)cache.clear();
    config={enabled:false,endpoint,model:String(next.model??config.model).slice(0,160),budget:Math.max(0,Math.min(100,Number(next.budget??config.budget)||0)),timeout:Math.max(100,Math.min(MAX_TIMEOUT,Number(next.timeout??config.timeout)||MAX_TIMEOUT))};
    secret=String(next.key??secret);delete config.key;config.enabled=next.enabled===true&&!!endpoint&&!!config.model;
    return status();
  }
  function status(){return {...config,keyPresent:!!secret,spent,remaining:Math.max(0,config.budget-spent),pending:!!active};}
  function clearKey(){cancel();secret='';config.enabled=false;cache.clear();}
  function packet(input){
    // Never spread input/state: author truths, balances and hidden entities cannot cross this boundary.
    const expressions=Array.isArray(input.allowedExpressions)?input.allowedExpressions.map(clean).filter(Boolean).slice(0,6):[];
    return {mode:'expression-only',packetId:clean(input.id),worldRevision:input.revision,contentVersion:clean(input.contentVersion),speakerId:clean(input.speakerId),recipientIds:[clean(input.recipientId)],authorizedClaims:(input.claims||[]).filter(c=>c.disclosed===true).slice(0,8).map(c=>({claimId:clean(c.id),text:clean(c.text)})),observedFacts:(input.facts||[]).filter(f=>f.observed===true).slice(0,8).map(f=>({factId:clean(f.id),text:clean(f.text)})),allowedExpressions:expressions,constraints:{forbidNewFacts:true,forbidCommands:true,maxCharacters:180,output:'{"expressionIndex": integer}'}};
  }
  async function express(input){
    const fallback=clean(input.template),p=packet(input),key=JSON.stringify(p);
    if(input.revision!==revision())return result(fallback,'对白许可已过期，保持当前原文。');
    if(!config.enabled||!config.endpoint||!config.model)return result(fallback,'未启用或未配置，使用本地对白。');
    if(!p.allowedExpressions.length)return result(fallback,'此句涉及关键事实，保持原文。');
    if(cache.has(key))return cache.get(key);
    if(inflight.has(key))return inflight.get(key);
    if(active)return result(fallback,'已有请求在途，使用本地对白。');
    if(spent>=config.budget)return result(fallback,'本次会话请求预算已用完，使用本地对白。');
    const token=generation,controller=new AbortController();active=controller;spent++;
    const started=clock(),timeout=setTimeout(()=>controller.abort(),config.timeout);
    const promise=(async()=>{
      try{
        const response=await fetcher(config.endpoint,{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json',...(secret?{Authorization:`Bearer ${secret}`}:{})},body:JSON.stringify({model:config.model,stream:false,max_tokens:32,messages:[{role:'system',content:'Choose one authorized expression index. Return only JSON {"expressionIndex": integer}. Do not create facts, actions, rewards or options.'},{role:'user',content:JSON.stringify(p)}]})});
        if(!response.ok)throw new Error('unavailable');
        const body=await response.json();let answer=body;
        if(body?.choices?.[0]?.message?.content!==undefined)answer=JSON.parse(body.choices[0].message.content);
        if(token!==generation||input.revision!==revision()||clock()-started>config.timeout)return result(fallback,'对白已过期，保持当前原文。');
        if(!answer||Object.keys(answer).length!==1||!Number.isInteger(answer.expressionIndex)||answer.expressionIndex<0||answer.expressionIndex>=p.allowedExpressions.length)return result(fallback,'服务输出越过授权范围，使用本地对白。');
        const accepted=result(p.allowedExpressions[answer.expressionIndex],'只改变授权措辞，不改变事实。','service');cache.set(key,accepted);return accepted;
      }catch{return result(fallback,controller.signal.aborted?'请求已取消或超时，使用本地对白。':'网络或输出异常，使用本地对白。');}
      finally{clearTimeout(timeout);if(active===controller)active=null;if(token===generation)inflight.delete(key);}
    })();inflight.set(key,promise);return promise;
  }
  return {configure,status,clearKey,cancel,express,packet};
}
