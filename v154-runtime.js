(()=>{
'use strict';
if(window.__ECP_V154_RUNTIME)return;window.__ECP_V154_RUNTIME=true;
const q=(s,r=document)=>r.querySelector(s);
const qa=(s,r=document)=>[...r.querySelectorAll(s)];
const state=()=>{try{return typeof S!=='undefined'?S:null}catch{return null}};
const isAdmin=()=>['super_admin','assistant_admin','admin'].includes(String(state()?.role||''));
const toast=(message,type='error')=>window.EduUI?.toast?.(message,type);
const addFileAction=()=>{
  const card=q('.ecp152-sheet-card');
  if(!card||q('[data-ecp154-attach-file]',card))return;
  const button=document.createElement('button');
  button.type='button';button.dataset.ecp154AttachFile='1';
  button.innerHTML='<span>📄</span><b>File</b><small>Document, PDF, archive or other file</small>';
  q('.ecp152-cancel',card)?.before(button);
  button.onclick=()=>{
    const g=state()?.group;
    if(!g?.id)return;
    if(!isAdmin()&&!g.allow_member_messaging){toast('Messaging is not allowed for members in this group.');return;}
    q('.ecp152-sheet')?.remove();
    const input=q('#chat-file');if(!input)return;
    input.accept='';input.click();
  };
};
new MutationObserver(addFileAction).observe(document.body,{childList:true,subtree:true});
function installIndependentPermissions(){
  const s=state(),g=s?.group,bar=q('#ecp-v150-group-control');
  if(!g?.id||!bar||!isAdmin())return;
  const signature=g.id+':'+String(g.allow_member_messaging)+':'+String(g.allow_member_calls);
  if(bar.dataset.ecp154Signature===signature)return;
  bar.dataset.ecp154Signature=signature;
  const messageOn=!!g.allow_member_messaging,callOn=g.allow_member_calls!==false;
  bar.innerHTML='<div class="ecp154-permission-copy"><b>Member permissions</b><small>Messaging and call creation are controlled separately.</small></div><label class="ecp-switch"><span>Text & files</span><input data-ecp154-messages type="checkbox" '+(messageOn?'checked':'')+'><i></i></label><label class="ecp-switch"><span>Start calls</span><input data-ecp154-calls type="checkbox" '+(callOn?'checked':'')+'><i></i></label>';
  const persist=async()=>{
    const messageInput=q('[data-ecp154-messages]',bar),callInput=q('[data-ecp154-calls]',bar);
    messageInput.disabled=callInput.disabled=true;
    const r=await sb.rpc('set_group_member_permissions',{group_input:g.id,messaging_enabled:messageInput.checked,calls_enabled:callInput.checked});
    messageInput.disabled=callInput.disabled=false;
    if(r.error){messageInput.checked=!!g.allow_member_messaging;callInput.checked=g.allow_member_calls!==false;toast(r.error.message||'Could not update permissions');return;}
    g.allow_member_messaging=messageInput.checked;g.allow_member_calls=callInput.checked;toast('Member permissions updated.','ok');
  };
  q('[data-ecp154-messages]',bar).onchange=persist;
  q('[data-ecp154-calls]',bar).onchange=persist;
}
let queued=false;
new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;installIndependentPermissions();});}).observe(document.body,{childList:true,subtree:true});
let avatarRefreshTimer;
const watch=()=>{
  const user=state()?.user?.id;if(!user||typeof sb==='undefined'||window.__ecp154ProfileChannel)return;
  window.__ecp154ProfileChannel=sb.channel('ecp154-avatar-refresh-'+user).on('postgres_changes',{event:'UPDATE',schema:'public',table:'profiles'},()=>{
    clearTimeout(avatarRefreshTimer);avatarRefreshTimer=setTimeout(()=>qa('img[data-photo]').forEach(img=>{const src=img.src;if(src){img.src='';img.src=src;}}),120);
  }).subscribe();
};
setInterval(watch,1200);watch();
const style=document.createElement('style');style.textContent='.ecp154-permission-copy{display:grid;gap:2px;flex:1}.ecp-group-control .ecp-switch{display:flex;align-items:center;gap:7px;margin-left:8px;font-size:12px;white-space:nowrap}.ecp-group-control{flex-wrap:wrap}';document.head.append(style);
})();