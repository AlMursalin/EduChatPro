(()=>{
'use strict';
if(!window.EduNative)return;
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cacheKey=(kind,id)=>'ecp-v131:'+String(S?.user?.id||'guest')+':'+kind+':'+(id||'main');
const read=(kind,id,max=604800000)=>{try{const x=JSON.parse(localStorage.getItem(cacheKey(kind,id))||'null');return x&&Date.now()-Number(x.t||0)<max?x:null}catch{return null}};
const write=(kind,id,data)=>{try{localStorage.setItem(cacheKey(kind,id),JSON.stringify({t:Date.now(),...data}))}catch{}};
const currentThread=()=>S?.direct?['direct',S.direct]:S?.group?.id?['group',S.group.id]:null;

function restoreConversationCache(){
 const dm=q('#dm-log'),gm=q('#chat-log');
 if(dm&&!dm.children.length&&S?.direct){const c=read('chat',S.direct);if(c?.html){dm.innerHTML=c.html;window.hydrateAvatars?.(dm);window.hydrateMedia?.(dm);requestAnimationFrame(()=>dm.scrollTop=dm.scrollHeight)}}
 if(gm&&!gm.children.length&&S?.group?.id){const c=read('group',S.group.id);if(c?.html){gm.innerHTML=c.html;window.hydrateAvatars?.(gm);window.hydrateMedia?.(gm);requestAnimationFrame(()=>gm.scrollTop=gm.scrollHeight)}}
 const rail=q('#conversation-rows');if(rail&&!rail.children.length){const c=read('rail','main');if(c?.html)rail.innerHTML=c.html}
}
function saveConversationCache(){
 const t=currentThread(),log=q('#dm-log')||q('#chat-log');
 if(t&&log?.children.length){const clone=log.cloneNode(true);qa('.typing-indicator,.sending,.chat-reactions',clone).forEach(n=>n.remove());qa('[data-avatar-path]',clone).forEach(n=>{delete n.dataset.avatarLoaded;delete n.dataset.avatarPending;const img=n.querySelector('img');if(img&&String(img.src).startsWith('blob:'))img.remove()});qa('[data-photo]',clone).forEach(img=>{if(String(img.src).startsWith('blob:'))img.removeAttribute('src')});write(t[0]==='direct'?'chat':'group',t[1],{html:clone.innerHTML.slice(-240000)})}
 const rail=q('#conversation-rows');if(rail?.children.length)write('rail','main',{html:rail.innerHTML.slice(0,180000)});
}

function ensureTyping(id,label='Typing…'){
 const log=q(id==='#dm-typing'?'#dm-log':'#chat-log');if(!log)return null;
 let el=q(id);if(!el){el=document.createElement('div');el.id=id.slice(1);el.className='typing-indicator';el.hidden=true;el.innerHTML='<span class="typing-dots"><i></i><i></i><i></i></span><span class="typing-label">'+esc(label)+'</span>';log.after(el)}return el;
}
let typingChannel=null,typingThread='',typingTimer;
async function bindTyping(){
 const input=q('#dm-text')||q('#chat-input');if(!input||!S?.user||!sb)return;
 const direct=!!q('#dm-text'),thread=direct?S.direct:S.group?.id;if(!thread)return;
 const key=(direct?'direct:':'group:')+thread;if(key===typingThread)return;
 typingThread=key;if(typingChannel)try{await sb.removeChannel(typingChannel)}catch{}
 const name=direct?'dm-'+[S.user.id,thread].sort().join('-'):'group-chat-'+thread;
 typingChannel=sb.channel(name,{config:{broadcast:{self:false}}}).on('broadcast',{event:'typing'},({payload})=>{
   if(payload?.user_id===S.user.id)return;
   if(direct&&payload?.user_id!==thread)return;
   const el=ensureTyping(direct?'#dm-typing':'#group-typing');
   if(!el)return;el.hidden=!payload?.typing;el.querySelector('.typing-label').textContent=direct?'Typing…':(payload?.name||'Someone')+' is typing…';
   clearTimeout(el._hide);if(payload?.typing)el._hide=setTimeout(()=>el.hidden=true,1800);
 }).subscribe();
 const sendTyping=typing=>typingChannel?.send({type:'broadcast',event:'typing',payload:{user_id:S.user.id,name:S.profile?.full_name||'Member',typing}});
 input.addEventListener('input',()=>{sendTyping(true);clearTimeout(typingTimer);typingTimer=setTimeout(()=>sendTyping(false),900)});
 input.addEventListener('blur',()=>sendTyping(false));
}
function optimisticSend(form,input,log){
 if(form.dataset.v131Optimistic)return;form.dataset.v131Optimistic='1';
 form.addEventListener('submit',()=>{
   const body=input.value.trim();if(!body)return;
   const row=document.createElement('div');row.className='message-row mine sending';row.dataset.optimistic=body;
   row.innerHTML='<span class="avatar">'+esc((S.profile?.full_name||'Y').slice(0,1))+'</span><div class="message mine"><div class="meta"><strong>You</strong> <small>Sending…</small></div><div class="bodytext">'+esc(body)+'</div></div>';
   log.append(row);requestAnimationFrame(()=>log.scrollTop=log.scrollHeight);
   for(const ms of [0,20,55,110])setTimeout(()=>{try{input.focus({preventScroll:true})}catch{input.focus()}log.scrollTop=log.scrollHeight},ms);
   setTimeout(()=>{if(row.isConnected)row.remove()},5000);
 },true);
}
function bindChatSpeed(){
 const dm=q('#dm-form'),di=q('#dm-text'),dl=q('#dm-log');if(dm&&di&&dl)optimisticSend(dm,di,dl);
 const gf=q('#chat-form'),gi=q('#chat-input'),gl=q('#chat-log');if(gf&&gi&&gl)optimisticSend(gf,gi,gl);
 bindTyping().catch(()=>{});
}

function polishComments(){
 const modal=qa('#modal-root .modal').find(m=>/comments|discussion/i.test(m.querySelector('h2')?.textContent||''));if(!modal||modal.dataset.v131)return;
 modal.dataset.v131='1';modal.classList.add('v131-comments');
 const body=q('.modal-body',modal),list=q('#ws-comments',modal),form=q('#comment-form',modal),input=q('#comment-body',modal);
 if(list)list.classList.add('v131-comments-list');
 if(form)form.classList.add('v131-comment-composer');
 if(input){input.rows=1;input.placeholder='Write a comment…';const resize=()=>{input.style.height='auto';input.style.height=Math.min(110,input.scrollHeight)+'px'};input.addEventListener('input',resize);resize()}
 qa('.ws-comment',modal).forEach(c=>c.classList.add('v131-comment'));
}
function facebookShare(){
 document.addEventListener('click',async e=>{
   const b=e.target.closest?.('[data-share]');if(!b||b.closest('.meeting-shell'))return;
   if(!navigator.share)return;
   e.preventDefault();e.stopImmediatePropagation();
   const url=new URL(CFG.PUBLIC_WEB_URL||location.origin);url.searchParams.set('post',b.dataset.share);
   try{await navigator.share({title:'Edu Chat Pro post',url:url.href});try{await sb.from('forum_shares').upsert({post_id:b.dataset.share,user_id:S.user.id})}catch{}}
   catch(err){if(err?.name!=='AbortError')try{await navigator.clipboard.writeText(url.href)}catch{}}
 },true);
}

function groupToggle(){
 const info=q('.group-info');if(!info||info.querySelector('.v131-group-toggle')||!S?.group)return;
 const g=S.group,wrap=document.createElement('label');wrap.className='v131-group-toggle';
 if(S.role==='super_admin'){
   wrap.innerHTML='<span><b>Member messaging</b><small>Student text, file & voice</small></span><input type="checkbox" '+(g.allow_member_messaging?'checked':'')+'><i></i>';
   wrap.querySelector('input').onchange=async e=>{const next=e.target.checked;e.target.disabled=true;const r=await sb.from('groups').update({allow_member_messaging:next}).eq('id',g.id);e.target.disabled=false;if(r.error){e.target.checked=!next;window.EduUI?.toast(r.error.message,'error')}else{g.allow_member_messaging=next;window.EduUI?.toast(next?'Member messaging enabled':'Read-only for students','ok')}};
 }else wrap.innerHTML='<span><b>'+ (g.allow_member_messaging?'Members can send messages':'Read-only for students') +'</b><small>Only Super Admin can change this</small></span>';
 const p=info.querySelector('p');(p?.parentNode||info).insertBefore(wrap,p?.nextSibling||info.firstChild);
}

function backHandler(){
 window.EduMobileBack=()=>{
  try{
   const active=document.activeElement,input=q('#message-input,#dm-text,#chat-input');
   if(active&&input&&active===input){active.blur();return true}
   const modal=q('#modal-root .modal-backdrop,dialog[open]');if(modal){window.EduUI?.closeModal?.();if(modal.tagName==='DIALOG'&&modal.open)modal.close();return true}
   const current=(typeof S!=='undefined'&&S.page)||q('#page')?.dataset?.page||'';
   const nav=window.__ECP_NAV||(window.__ECP_NAV={stack:[],ready:true,suppress:false});
   const go=p=>{if(!p||p===current||typeof window.navigate!=='function')return false;nav.suppress=true;window.navigate(p);return true};
   if((S?.direct||S?.group)&&current!=='forum')return go('chats');
   while(nav.stack?.length){const p=nav.stack.pop();if(p&&p!==current&&go(p))return true}
   if(['notifications','saved','meetings'].includes(current))return go('chats');
   if(['chats','groups','people','profile','admin'].includes(current))return go('forum');
   if(current==='forum')return false;
   return current?go('forum'):true;
  }catch(err){console.warn('v1.3.1 back',err);return true}
 };
 window.EduMobileBackSafe=window.EduMobileBack;
}

const css=document.createElement('style');css.textContent=`
.v131-comments{position:fixed!important;inset:auto 0 0!important;width:100%!important;max-width:none!important;height:94dvh!important;border-radius:20px 20px 0 0!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;padding:0!important}
.v131-comments>h2{padding:14px 18px!important;margin:0!important;text-align:center;border-bottom:1px solid var(--ws-line)}
.v131-comments>.modal-body{display:flex;flex-direction:column;min-height:0;overflow:hidden;padding:0!important}.v131-comments>.modal-actions{display:none!important}
.v131-comments-list{flex:1;overflow:auto;padding:10px 12px}.v131-comment{display:flex!important;align-items:flex-start!important;gap:8px!important;padding:4px 0!important;border:0!important}.v131-comment.reply{margin-left:28px!important;border-left:0!important}
.v131-comment>.ws-avatar{width:36px!important;height:36px!important;flex:0 0 36px}.v131-comment>div>p{display:inline-block!important;background:var(--ws-soft)!important;border-radius:18px!important;padding:8px 11px!important;margin:3px 0!important}.v131-comment .text-btn{font-size:11px;font-weight:700}
.v131-comment-composer{position:sticky!important;bottom:0;background:var(--ws-bg)!important;border-top:1px solid var(--ws-line)!important;padding:8px 10px max(8px,env(safe-area-inset-bottom))!important}.v131-comment-composer textarea{min-height:40px!important;max-height:110px!important;border-radius:22px!important;resize:none!important}
.typing-indicator{display:flex;align-items:center;gap:7px;min-height:24px;padding:2px 12px;color:var(--ws-muted);font-size:12px}.typing-indicator[hidden]{display:none!important}.typing-dots{display:inline-flex;gap:3px}.typing-dots i{width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.35;animation:v131typing 1s infinite}.typing-dots i:nth-child(2){animation-delay:.13s}.typing-dots i:nth-child(3){animation-delay:.26s}@keyframes v131typing{0%,60%,100%{transform:translateY(0);opacity:.3}30%{transform:translateY(-4px);opacity:1}}.sending{opacity:.65}
.v131-group-toggle{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;margin:9px 0;border:1px solid var(--ws-line);border-radius:15px;background:var(--ws-soft)}.v131-group-toggle span{display:grid;gap:2px}.v131-group-toggle small{color:var(--ws-muted)}.v131-group-toggle input{display:none}.v131-group-toggle i{width:46px;height:26px;border-radius:999px;background:#9ba3ad;position:relative}.v131-group-toggle i:after{content:"";position:absolute;width:20px;height:20px;left:3px;top:3px;border-radius:50%;background:#fff;transition:.15s}.v131-group-toggle input:checked+i{background:#1877f2}.v131-group-toggle input:checked+i:after{transform:translateX(20px)}
html.ecp-keyboard-open .composer,html.ecp-keyboard-open .ws-composer{transition:none!important;animation:none!important}
`;document.head.appendChild(css);

facebookShare();backHandler();
let raf=0;new MutationObserver(()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{restoreConversationCache();saveConversationCache();bindChatSpeed();polishComments();groupToggle()})}).observe(document.body,{subtree:true,childList:true});
window.addEventListener('pagehide',saveConversationCache);setTimeout(()=>{restoreConversationCache();bindChatSpeed();polishComments();groupToggle()},0);
})();