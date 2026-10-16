import('./arena-main.mjs').catch(error => {
  const loading=document.getElementById('loading');
  loading.hidden=false;loading.textContent=`入院失败：${error.message}`;
  console.error('ARENA_START_FAILED',error);
});
