(()=>{
'use strict';
if(window.__ECP_V156_RUNTIME)return;window.__ECP_V156_RUNTIME=true;
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const st=()=>{try{return typeof S!=='undefined'?S:null}catch{return null}};
const isAdmin=()=>['super_admin','assistant_admin','admin'].includes(String(st()?.role||''));
const toast=(m,t='error')=>window.EduUI?.toast?.(m,t);

const H=window.__ECP156_HISTORY||(window.__ECP156_HISTORY={stack:[],suppress:false});
const route=()=>{const root=q('#page'),s=st();if(root?.classList.contains('conversation-open')){if(s?.group?.id)return 'chat:group:'+s.group.id;if(s?.direct)return 'chat:direct:'+s.direct;}return 'page:'+(root?.dataset?.page||s?.page||'forum')};
const remember=r=>{if(!r)return;const a=H.stack;if(a[a.length-1]!==r)a.push(r);if(a.length>80)a.shift()};
const rawNavigate=window.navigate;
if(typeof rawNavigate==='function'&&!rawNavigate.__ecp156){
  const tracked=function(target,...args){if(!H.suppress){const from=route(),to='page:'+target;if(from!==to)remember(from)}H.suppress=false;const old=window.__ECP_NAV;if(old)old.ignore=true;return rawNavigate(target,...args)};
  tracked.__ecp156=true;window.navigate=tracked;
}
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-thread]');if(!b)return;const cur=route();if(cur.startsWith('page:'))remember(cur)},true);
const restore=token=>{if(!token)return false;if(token.startsWith('chat:')){const [,kind,id]=token.split(':');window.EduWorkspace.pending={kind,id};H.suppress=true;window.navigate?.('chats');return true}if(token.startsWith('page:')){H.suppress=true;window.navigate?.(token.slice(5));return true}return false};
window.EduMobileBack=()=>{try{
  const active=document.activeElement;if(active&&/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)){active.blur();return true}
  const overlay=q('.ecp152-sheet,.ecp152-modal,dialog[open],#modal-root .modal-backdrop,.modal:not(.hidden)');if(overlay){if(overlay.classList?.contains('ecp152-sheet')||overlay.classList?.contains('ecp152-modal'))overlay.remove();else{window.EduUI?.closeModal?.();overlay.close?.()}return true}
  const root=q('#page');if(root?.classList.contains('details-open')){q('#close-details')?.click();return true}
  const current=route();
  if(current.startsWith('chat:')){const prev=H.stack.pop();if(prev&&restore(prev))return true;H.suppress=true;window.navigate?.('chats');return true}
  while(H.stack.length){const prev=H.stack.pop();if(prev!==current&&restore(prev))return true}
  const page=current.slice(5);if(page!=='forum'){H.suppress=true;window.navigate?.('forum');return true}
  return false;
}catch(e){console.warn('v1.5.6 back',e);return false}};
window.EduMobileBackSafe=window.EduMobileBack;

function installPollButton(){
  const s=st(),row=q('.ws-conversation .ws-composer-row');if(!row)return;
  const old=q('#ecp156-poll-button',row);
  if(!s?.group?.id||!isAdmin()){old?.remove();return}
  if(old)return;
  const b=document.createElement('button');b.type='button';b.id='ecp156-poll-button';b.className='ecp156-poll-button';b.title='Create poll';b.setAttribute('aria-label','Create poll');b.innerHTML='<span>📊</span><em>Poll</em>';
  q('#attach-file',row)?.after(b);
  b.onclick=()=>{if(window.EduPollUI?.open)window.EduPollUI.open();else{q('#attach-file')?.click();setTimeout(()=>q('[data-ecp152-attach="poll"]')?.click(),0)}};
}
function removeInlinePermission(){q('#ecp-v150-group-control')?.remove()}

let raf=0;new MutationObserver(()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{installPollButton();removeInlinePermission()})}).observe(document.body,{childList:true,subtree:true});
setTimeout(()=>{installPollButton();removeInlinePermission()},0);
const style=document.createElement('style');style.id='ecp156-style';style.textContent=`
.ecp156-poll-button{height:38px;min-width:58px;border:0;border-radius:18px;background:var(--ws-soft,#eef2f7);color:inherit;display:flex;align-items:center;justify-content:center;gap:5px;padding:0 10px;font-weight:700;cursor:pointer}.ecp156-poll-button span{font-size:17px}.ecp156-poll-button em{font-style:normal;font-size:12px}.ecp156-poll-button:active{transform:scale(.97)}
.ecp156-group-permission{margin-top:14px;padding:12px;border:1px solid var(--ws-line,#dfe3e8);border-radius:14px;background:var(--ws-soft,#f7f8fa)}.ecp156-group-permission>b{display:block;margin-bottom:6px}
@media(max-width:520px){.ecp156-poll-button{min-width:42px;padding:0 8px}.ecp156-poll-button em{display:none}}
`;document.head.append(style);
})();