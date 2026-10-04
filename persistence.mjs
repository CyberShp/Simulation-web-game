export const SAVE_KEY='xianfu:simulation-web-game:save';
export const BACKUP_KEY=SAVE_KEY+':backup';
export function createPersistence(getStorage,validate){
 let known=null,blocked=false,status='尚未保存',savedAt=null;
 function decode(raw){const data=JSON.parse(raw);if(data.format!==1||typeof data.savedAt!=='number'||!Number.isFinite(data.savedAt))throw Error('存档格式异常');return{state:validate(data.state),savedAt:data.savedAt};}
 function load(){try{const storage=getStorage();known=storage.getItem(SAVE_KEY);if(!known){status='自动存档已就绪';return null;}const saved=decode(known);savedAt=saved.savedAt;status='已恢复本机存档';return saved.state;}catch{blocked=true;status='存档不可用，请导出备份';try{const raw=getStorage().getItem(BACKUP_KEY);if(raw){const b=decode(raw);savedAt=b.savedAt;status='已恢复备份，请导出存档';return b.state;}}catch{}return null;}}
 function save(state,{replace=false}={}){if(blocked&&!replace)return false;try{const storage=getStorage(),current=storage.getItem(SAVE_KEY);if(!replace&&current!==known){blocked=true;status='另一窗口已更新，请刷新续玩';return false;}const valid=validate(state),next=JSON.stringify({format:1,savedAt:Date.now(),state:valid});if(current){try{decode(current);storage.setItem(BACKUP_KEY,current);}catch(err){if(err?.name==='QuotaExceededError')throw err;}}storage.setItem(SAVE_KEY,next);known=next;blocked=false;savedAt=JSON.parse(next).savedAt;status='本机已自动保存';return true;}catch{status='自动保存失败，请导出备份';return false;}}
 return{load,save,get status(){return status;},get savedAt(){return savedAt;},get blocked(){return blocked;}};
}
