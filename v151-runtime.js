(()=>{
'use strict';
if(window.__ECP_V151_RUNTIME)return;window.__ECP_V151_RUNTIME=true;
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const state=()=>{try{return typeof S!=='undefined'?S:null}catch{return null}};

// Final Android Back handler: keyboard -> details -> conversation -> true visited-page history -> home/forum -> exit.
window.EduMobileBack=()=>{
  try{
    const active=document.activeElement;
    if(active&&/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)){active.blur();return true;}
    const modal=q('#modal-root .modal-backdrop,dialog[open],.modal:not(.hidden)');
    if(modal){window.EduUI?.closeModal?.();if(modal.tagName==='DIALOG'&&modal.open)modal.close();return true;}
    const root=q('#page'),current=root?.dataset?.page||state()?.page||'';
    if(root?.classList.contains('details-open')&&q('#close-details')){q('#close-details').click();return true;}
    if(root?.classList.contains('conversation-open')&&q('#back-chats')){q('#back-chats').click();return true;}
    const nav=window.__ECP_NAV||(window.__ECP_NAV={stack:[],ready:true,suppress:false});
    while(nav.stack?.length){
      const target=nav.stack.pop();
      if(target&&target!==current&&typeof window.navigate==='function'){
        nav.suppress=true;window.navigate(target);return true;
      }
    }
    if(current&&current!=='forum'&&typeof window.navigate==='function'){
      nav.suppress=true;window.navigate('forum');return true;
    }
    return false;
  }catch(err){console.warn('v1.5.1 back',err);return false;}
};
window.EduMobileBackSafe=window.EduMobileBack;

// Robust realtime typing indicator for the current direct/group conversation.
let typingChannel=null,typingKey='',typingStop=null;
async function bindTyping(){
  const st=state(),input=q('#message-input');if(!st?.user||!input||typeof sb==='undefined')return;
  const kind=st.group?.id?'group':st.direct?'direct':null;if(!kind)return;
  const id=kind==='group'?st.group.id:[st.user.id,st.direct].sort().join('-'),key=kind+':'+id;
  if(input.dataset.ecpTypingKey===key)return;
  input.dataset.ecpTypingKey=key;
  if(key!==typingKey){
    typingKey=key;
    if(typingChannel)try{await sb.removeChannel(typingChannel)}catch{}
    typingChannel=sb.channel('ecp-typing-'+key,{config:{broadcast:{self:false}}})
      .on('broadcast',{event:'typing'},({payload})=>{
        if(payload?.user_id===st.user.id)return;
        let el=q('#ecp-v151-typing');
        if(!el){el=document.createElement('div');el.id='ecp-v151-typing';el.className='ecp-v151-typing';q('#ws-send')?.before(el);}
        if(!el)return;
        el.innerHTML='<span><i></i><i></i><i></i></span> '+String(payload?.name||'Someone').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))+' is typing…';
        el.hidden=!payload?.typing;
        clearTimeout(el._hide);if(payload?.typing)el._hide=setTimeout(()=>el.hidden=true,1700);
      }).subscribe();
  }
  const send=v=>typingChannel?.send({type:'broadcast',event:'typing',payload:{user_id:st.user.id,name:st.profile?.full_name||'Member',typing:v}});
  input.addEventListener('input',()=>{send(true);clearTimeout(typingStop);typingStop=setTimeout(()=>send(false),700)},{passive:true});
  input.addEventListener('blur',()=>send(false),{passive:true});
}

// Keep keyboard interaction and newest message smooth without rebuilding the page.
const vv=window.visualViewport;
const keepBottom=()=>{const input=q('#message-input'),log=q('#message-log');if(document.activeElement===input&&log)requestAnimationFrame(()=>{log.scrollTop=log.scrollHeight;});};
vv?.addEventListener('resize',keepBottom,{passive:true});
vv?.addEventListener('scroll',keepBottom,{passive:true});
document.addEventListener('focusin',e=>{if(e.target?.id==='message-input')keepBottom();},true);
document.addEventListener('submit',e=>{
  if(!e.target?.matches?.('#ws-send'))return;
  const input=q('#message-input');
  for(const ms of [0,18,45,90])setTimeout(()=>{try{input?.focus({preventScroll:true})}catch{input?.focus()}keepBottom();},ms);
},true);

// Cache snapshots for Chat List and Forum so reopening never starts visually empty.
// Live render replaces the snapshot when fresh/delta data arrives.
function snapshotKey(page){const uid=state()?.user?.id||'guest';return 'ecp-page-snapshot-v151:'+uid+':'+page;}
function saveSnapshots(){
  const root=q('#page'),page=root?.dataset?.page||state()?.page;
  if(!root||!page||!['chats','groups','people','forum'].includes(page))return;
  if(page==='forum'&&!q('.ws-post',root))return;
  if(page!=='forum'&&!q('#thread-list [data-thread],#conversation-rows [data-open-id]',root))return;
  const clone=root.cloneNode(true);
  qa('script,dialog,.modal-backdrop,.ecp-v151-typing',clone).forEach(n=>n.remove());
  try{localStorage.setItem(snapshotKey(page),clone.innerHTML.slice(0,700000));}catch{}
}
function restoreSnapshot(){
  const root=q('#page'),page=root?.dataset?.page||state()?.page;if(!root||!page)return;
  const loading=root.children.length===1&&root.firstElementChild?.classList.contains('loading');
  if(!loading)return;
  try{
    const html=localStorage.getItem(snapshotKey(page));
    if(html){root.innerHTML='<div class="ecp-cache-preview" aria-hidden="true">'+html+'</div>';}
  }catch{}
}

// Re-run targeted enhancers after real DOM changes.
let raf=0;
new MutationObserver(()=>{
  cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{restoreSnapshot();saveSnapshots();bindTyping().catch(()=>{});});
}).observe(document.body,{subtree:true,childList:true});
window.addEventListener('pagehide',saveSnapshots);
setTimeout(()=>{restoreSnapshot();bindTyping().catch(()=>{});},0);

const style=document.createElement('style');style.id='ecp-v151-style';style.textContent=`
.ecp-v151-typing{min-height:22px;padding:2px 14px 4px;color:var(--ws-muted,#65676b);font-size:12px;display:flex;align-items:center;gap:6px}.ecp-v151-typing[hidden]{display:none}.ecp-v151-typing span{display:inline-flex;gap:3px}.ecp-v151-typing i{width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.3;animation:ecp151dot 1s infinite}.ecp-v151-typing i:nth-child(2){animation-delay:.13s}.ecp-v151-typing i:nth-child(3){animation-delay:.26s}@keyframes ecp151dot{0%,60%,100%{transform:translateY(0);opacity:.3}30%{transform:translateY(-4px);opacity:1}}
.ecp-cache-preview{opacity:.98;pointer-events:none;min-height:100%}
.ws-group-permission{margin-top:14px;padding:12px;border:1px solid var(--ws-line,#ddd);border-radius:14px;background:var(--ws-soft,#f5f6f7)}.ws-group-permission h3{margin:0 0 8px}.ws-group-permission .hint{margin:8px 0 0}
html.ecp-keyboard-open .ws-conversation,html.ecp-keyboard-open .ws-composer{transition:none!important;animation:none!important}
`;document.head.append(style);
})();