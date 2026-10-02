(()=>{
'use strict';
if(window.__ECP_V153_RUNTIME)return;window.__ECP_V153_RUNTIME=true;
const page=()=>document.querySelector('#page')?.dataset?.page||window.S?.page||'';
const closeOverlay=()=>{const x=document.querySelector('.ecp152-sheet,.ecp152-modal,dialog[open],#modal-root .modal-backdrop');if(!x)return false;if(x.classList?.contains('ecp152-sheet')||x.classList?.contains('ecp152-modal'))x.remove();else {window.EduUI?.closeModal?.();x.close?.()}return true};
const state=()=>{const root=document.querySelector('#page');if(root?.classList.contains('conversation-open')||root?.classList.contains('direct-workspace')||root?.classList.contains('chat-workspace'))return 'chat-conversation';return page()||'forum'};
const nav=window.__ECP_NAV||(window.__ECP_NAV={stack:[],ignore:false,last:''});
const originalNavigate=window.navigate;
if(typeof originalNavigate==='function'&&!originalNavigate.__ecp153){
  function tracked(target,...args){const from=state();if(!nav.ignore&&from&&from!==target)nav.stack.push(from);nav.ignore=false;nav.last=target;return originalNavigate(target,...args)}
  tracked.__ecp153=true;window.navigate=tracked;
}
window.EduMobileBack=()=>{
  try{
    const active=document.activeElement;if(active&&/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)){active.blur();return true}
    if(closeOverlay())return true;
    const root=document.querySelector('#page');
    if(root?.classList.contains('details-open')){document.querySelector('#close-details')?.click();return true}
    const current=state();
    const previous=nav.stack.pop();
    if(previous){
      nav.ignore=true;
      if(previous==='chat-conversation'){document.querySelector('[data-thread].selected')?.click();return true}
      window.navigate?.(previous);return true;
    }
    if(current==='chat-conversation'){document.querySelector('#back-chats,#dm-back,#back-groups')?.click();return true}
    if(current!=='forum'){nav.ignore=true;window.navigate?.('forum');return true}
    return false;
  }catch(e){console.warn('v1.5.3 history',e);return false}
};
window.EduMobileBackSafe=window.EduMobileBack;
const refreshVisiblePhotos=()=>{
  const photos=window.EduPhotos,client=window.sb;if(!photos?.get||!client)return;
  document.querySelectorAll('img[data-photo][data-bucket]').forEach(img=>{
    const key=img.dataset.bucket+'|'+img.dataset.photo;
    if(img.dataset.ecpCachePath===key&&img.src)return;
    img.dataset.ecpCachePath=key;
    Promise.resolve(photos.peek?.(img.dataset.bucket,img.dataset.photo)).then(hit=>{if(hit&&img.isConnected&&img.dataset.ecpCachePath===key)img.src=hit});
  });
};
new MutationObserver(()=>requestAnimationFrame(refreshVisiblePhotos)).observe(document.documentElement,{subtree:true,childList:true});
refreshVisiblePhotos();
})();