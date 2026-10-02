(()=>{
'use strict';
if(window.__ECP_V152_RUNTIME)return;window.__ECP_V152_RUNTIME=true;
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const st=()=>{try{return typeof S!=='undefined'?S:null}catch{return null}};
const isAdmin=()=>['super_admin','assistant_admin','admin'].includes(String(st()?.role||''));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast=(m,t='error')=>window.EduUI?.toast?.(m,t);
const go=page=>{if(typeof window.navigate!=='function')return false;const nav=window.__ECP_NAV||(window.__ECP_NAV={stack:[],ready:true,suppress:false});nav.suppress=true;window.navigate(page);return true};

// Exact Android Back contract requested for v1.5.2.
// Conversation/Group/Inbox -> Chat List; Saved/Alerts/Call list -> Chat List; Chat List -> Home; Home -> Exit.
window.EduMobileBack=()=>{
  try{
    const active=document.activeElement;
    if(active&&/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)){active.blur();return true;}
    const modal=q('#modal-root .modal-backdrop,dialog[open],.modal:not(.hidden),.ecp152-sheet,.ecp152-modal');
    if(modal){
      if(modal.classList?.contains('ecp152-sheet')||modal.classList?.contains('ecp152-modal'))modal.remove();
      else {window.EduUI?.closeModal?.();if(modal.tagName==='DIALOG'&&modal.open)modal.close();}
      return true;
    }
    const root=q('#page'),current=root?.dataset?.page||st()?.page||'';
    if(root?.classList.contains('details-open')&&q('#close-details')){q('#close-details').click();return true;}
    if(root?.classList.contains('conversation-open')){
      const b=q('#back-chats',root);if(b){b.click();return true;}
      return go('chats');
    }
    if(root?.classList.contains('direct-workspace')||root?.classList.contains('chat-workspace')){
      const b=q('#dm-back,#back-groups',root);if(b){b.click();return true;}
      return go('chats');
    }
    if(['saved','notifications','meetings'].includes(current))return go('chats');
    if(['chats','groups','people'].includes(current))return go('forum');
    if(current==='forum')return false;
    if(current)return go('forum');
    return false;
  }catch(err){console.warn('v1.5.2 back',err);return false;}
};
window.EduMobileBackSafe=window.EduMobileBack;

// Poll state for the currently open group.
let pollGroupId='',pollChannel=null,polls=[],pollVotes=[],pollCreators={};
const currentGroup=()=>st()?.group;
const canCreatePoll=()=>!!currentGroup()&&(isAdmin()||!!currentGroup().allow_member_messaging);
const canVotePoll=()=>!!currentGroup();

function avatarHtml(person){
  const name=person?.full_name||'Member',path=person?.avatar_path;
  return '<span class="ws-avatar ecp152-poll-avatar">'+(path?'<img alt="'+esc(name)+'" data-photo="'+esc(path)+'" data-bucket="avatars" loading="lazy" decoding="async">':esc(name.trim().slice(0,1).toUpperCase()))+'</span>';
}
function pollTime(v){try{return new Date(v).toLocaleString()}catch{return''}}

function ensurePollStream(){
  const g=currentGroup(),log=q('#message-log'),content=q('#message-content');
  if(!g?.id||!log||!content)return null;
  let box=q('#ecp152-poll-stream',log);
  if(!box){box=document.createElement('section');box.id='ecp152-poll-stream';box.className='ecp152-poll-stream';content.after(box);}
  return box;
}
function renderPolls(){
  const box=ensurePollStream();if(!box)return;
  const me=st()?.user?.id;
  box.innerHTML=polls.length?polls.map(p=>{
    const opts=Array.isArray(p.options)?p.options:[],pv=pollVotes.filter(v=>v.poll_id===p.id),mine=pv.find(v=>v.user_id===me)?.choice,total=pv.length,person=pollCreators[p.created_by]||{full_name:'Member'};
    return '<article class="ecp152-poll-card" data-poll-card="'+p.id+'">'+
      '<header>'+avatarHtml(person)+'<div><b>'+esc(person.full_name||'Member')+'</b><small>'+esc(pollTime(p.created_at))+'</small></div>'+(isAdmin()?'<button type="button" class="text-btn" data-poll-close="'+p.id+'">'+(p.closed_at?'Reopen':'Close')+'</button>':'')+'</header>'+
      '<h4>'+esc(p.question)+'</h4>'+
      '<div class="ecp152-poll-options">'+opts.map((o,i)=>{const count=pv.filter(v=>Number(v.choice)===i).length,pct=total?Math.round(count*100/total):0,selected=Number(mine)===i;return '<button type="button" '+(p.closed_at?'disabled':'')+' class="'+(selected?'selected':'')+'" data-poll-vote="'+p.id+'" data-choice="'+i+'"><span>'+esc(o)+'</span><b>'+count+' · '+pct+'%</b><i style="width:'+pct+'%"></i></button>';}).join('')+'</div>'+
      '<footer><span>'+total+' vote'+(total===1?'':'s')+'</span><span>'+(p.closed_at?'Closed':'Open')+'</span></footer>'+
    '</article>';
  }).join(''):'';
  window.EduWorkspace?.photos?.(box,sb);
  qa('[data-poll-vote]',box).forEach(b=>b.onclick=async()=>{
    if(!canVotePoll())return;
    const poll_id=b.dataset.pollVote,choice=Number(b.dataset.choice),me=st()?.user?.id;
    const before=pollVotes.map(v=>({...v}));
    pollVotes=pollVotes.filter(v=>!(v.poll_id===poll_id&&v.user_id===me));
    pollVotes.push({poll_id,user_id:me,choice});renderPolls();
    const r=await sb.from('group_poll_votes').upsert({poll_id,user_id:me,choice},{onConflict:'poll_id,user_id'});
    if(r.error){pollVotes=before;renderPolls();toast(r.error.message||'Could not save vote');}
  });
  qa('[data-poll-close]',box).forEach(b=>b.onclick=async()=>{
    if(!isAdmin())return;
    const p=polls.find(x=>x.id===b.dataset.pollClose);if(!p)return;
    const r=await sb.from('group_polls').update({closed_at:p.closed_at?null:new Date().toISOString()}).eq('id',p.id);
    if(r.error)toast(r.error.message||'Could not update poll');else loadPolls();
  });
}
async function loadPolls(){
  const g=currentGroup();if(!g?.id||typeof sb==='undefined')return;
  pollGroupId=g.id;
  const pr=await sb.from('group_polls').select('id,group_id,created_by,question,options,created_at,closed_at').eq('group_id',g.id).order('created_at',{ascending:true});
  if(pr.error){console.warn('poll load',pr.error);return}
  polls=pr.data||[];
  const ids=polls.map(p=>p.id),creators=[...new Set(polls.map(p=>p.created_by).filter(Boolean))];
  pollVotes=ids.length?((await sb.from('group_poll_votes').select('poll_id,user_id,choice,created_at').in('poll_id',ids)).data||[]):[];
  pollCreators={};
  if(creators.length){const rr=await sb.from('profiles').select('id,full_name,avatar_path').in('id',creators);for(const p of rr.data||[])pollCreators[p.id]=p;}
  renderPolls();
  if(pollChannel)try{await sb.removeChannel(pollChannel)}catch{}
  pollChannel=sb.channel('ecp152-polls-'+g.id)
    .on('postgres_changes',{event:'*',schema:'public',table:'group_polls',filter:'group_id=eq.'+g.id},loadPolls)
    .on('postgres_changes',{event:'*',schema:'public',table:'group_poll_votes'},loadPolls)
    .subscribe();
}

function closeSheet(){q('.ecp152-sheet')?.remove()}
function showAttachMenu(){
  closeSheet();
  const g=currentGroup();if(!g?.id)return;
  const allowed=isAdmin()||!!g.allow_member_messaging;
  const sheet=document.createElement('div');sheet.className='ecp152-sheet';
  sheet.innerHTML='<div class="ecp152-sheet-card"><div class="ecp152-sheet-handle"></div><h3>Attach</h3>'+
    '<button type="button" data-ecp152-attach="photo"><span>🖼️</span><b>Photo</b></button>'+
    '<button type="button" data-ecp152-attach="video"><span>🎥</span><b>Video</b></button>'+
    '<button type="button" data-ecp152-attach="poll" class="'+(canCreatePoll()?'':'locked')+'"><span>📊</span><b>Poll</b><small>'+(canCreatePoll()?'Create a poll':'Poll creation is not allowed while member messaging is disabled.')+'</small></button>'+
    '<button type="button" class="ecp152-cancel">Cancel</button></div>';
  document.body.append(sheet);
  sheet.addEventListener('click',e=>{if(e.target===sheet||e.target.closest('.ecp152-cancel'))closeSheet()});
  qa('[data-ecp152-attach]',sheet).forEach(b=>b.onclick=e=>{
    e.stopPropagation();const action=b.dataset.ecp152Attach;
    if(action==='poll'){
      closeSheet();if(!canCreatePoll()){toast('Poll creation is not allowed while member messaging is disabled.');return}openPollComposer();return;
    }
    if(!allowed){toast('Messaging is not allowed for members in this group.');return}
    closeSheet();const file=q('#chat-file');if(!file)return;
    file.accept=action==='photo'?'image/*':'video/*';file.click();
  });
}
function optionRow(value=''){
  const d=document.createElement('div');d.className='ecp152-option-row';
  d.innerHTML='<input class="input" maxlength="200" placeholder="Poll option" value="'+esc(value)+'"><button type="button" class="text-btn ecp152-remove-option">Remove</button>';
  q('.ecp152-remove-option',d).onclick=()=>{const box=d.parentElement;if(box?.children.length<=2){toast('A poll needs at least two options.');return}d.remove();};
  return d;
}
function openPollComposer(){
  if(!canCreatePoll()){toast('Poll creation is not allowed while member messaging is disabled.');return}
  q('.ecp152-modal')?.remove();
  const modal=document.createElement('div');modal.className='ecp152-modal';
  modal.innerHTML='<div class="ecp152-modal-card"><header><h3>Create Poll</h3><button type="button" class="text-btn ecp152-close">✕</button></header><label>Poll Question<input id="ecp152-poll-question" class="input" maxlength="300" placeholder="Ask a question"></label><div id="ecp152-options"></div><button type="button" class="btn ghost" id="ecp152-add-option">+ Add Option</button><footer><button type="button" class="btn ghost ecp152-close">Cancel</button><button type="button" class="btn primary" id="ecp152-publish">Create Poll</button></footer></div>';
  document.body.append(modal);
  const opts=q('#ecp152-options',modal);opts.append(optionRow(''),optionRow(''));
  qa('.ecp152-close',modal).forEach(b=>b.onclick=()=>modal.remove());
  q('#ecp152-add-option',modal).onclick=()=>{if(opts.children.length>=6){toast('Maximum 6 options.');return}opts.append(optionRow(''));q('input',opts.lastElementChild)?.focus()};
  q('#ecp152-publish',modal).onclick=async()=>{
    if(!canCreatePoll()){toast('Poll creation is not allowed while member messaging is disabled.');return}
    const g=currentGroup(),question=q('#ecp152-poll-question',modal).value.trim(),options=qa('#ecp152-options input',modal).map(i=>i.value.trim()).filter(Boolean);
    if(!question||options.length<2){toast('Add a question and at least two options.');return}
    const btn=q('#ecp152-publish',modal);btn.disabled=true;
    const r=await sb.from('group_polls').insert({group_id:g.id,created_by:st().user.id,question,options});
    btn.disabled=false;
    if(r.error){toast(r.error.message||'Could not create poll');return}
    modal.remove();toast('Poll created.','ok');loadPolls();
  };
}

// Only Group Chat gets the + menu. Direct-chat attachment behavior stays unchanged.
document.addEventListener('click',e=>{
  const button=e.target.closest?.('#attach-file');if(!button||!currentGroup()?.id)return;
  e.preventDefault();e.stopImmediatePropagation();showAttachMenu();
},true);

// Call screen should return to Chat List after the native meeting/call closes.
// v152_apply also moves the underlying web page to Chats immediately after opening the native call.
document.addEventListener('click',e=>{if(e.target.closest?.('#chat-video,#chat-audio'))sessionStorage.setItem('ecp152-call-origin','chat')},true);

let raf=0,lastGroup='';
new MutationObserver(()=>{
  cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{
    const g=currentGroup();
    if(g?.id&&q('#message-log')){
      if(lastGroup!==g.id){lastGroup=g.id;loadPolls().catch(()=>{})}
      else renderPolls();
    }else{lastGroup='';q('#ecp152-poll-stream')?.remove()}
  });
}).observe(document.body,{subtree:true,childList:true});
setTimeout(()=>{const g=currentGroup();if(g?.id&&q('#message-log')){lastGroup=g.id;loadPolls().catch(()=>{})}},0);

const style=document.createElement('style');style.id='ecp152-style';style.textContent=`
.ecp152-sheet,.ecp152-modal{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.35);display:flex;align-items:flex-end;justify-content:center;padding:0}
.ecp152-sheet-card{width:min(100%,520px);background:var(--ws-bg,#fff);border-radius:20px 20px 0 0;padding:8px 12px max(12px,env(safe-area-inset-bottom));box-shadow:0 -10px 30px rgba(0,0,0,.18)}
.ecp152-sheet-handle{width:42px;height:4px;border-radius:4px;background:#b7bcc2;margin:2px auto 10px}.ecp152-sheet-card h3{margin:4px 4px 8px}
.ecp152-sheet-card>button{width:100%;display:grid;grid-template-columns:36px 1fr;gap:2px 10px;align-items:center;border:0;background:transparent;color:inherit;text-align:left;padding:11px 8px;border-radius:12px;font-size:14px}
.ecp152-sheet-card>button span{grid-row:1/3;font-size:22px}.ecp152-sheet-card>button b{font-size:14px}.ecp152-sheet-card>button small{font-size:11px;color:var(--ws-muted,#65676b)}.ecp152-sheet-card>button:active{background:var(--ws-soft,#f0f2f5)}.ecp152-sheet-card>button.locked{opacity:.62}.ecp152-sheet-card>.ecp152-cancel{display:block;text-align:center;margin-top:5px;border-top:1px solid var(--ws-line,#ddd)}
.ecp152-modal{align-items:center;padding:14px}.ecp152-modal-card{width:min(100%,520px);max-height:88dvh;overflow:auto;background:var(--ws-bg,#fff);border-radius:18px;padding:14px}.ecp152-modal-card>header,.ecp152-modal-card>footer{display:flex;align-items:center;justify-content:space-between;gap:8px}.ecp152-modal-card h3{margin:0}.ecp152-modal-card label{display:grid;gap:6px;font-size:12px;font-weight:700;margin:12px 0}.ecp152-option-row{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;margin:8px 0}.ecp152-modal-card>footer{justify-content:flex-end;margin-top:14px}
.ecp152-poll-stream{display:grid;gap:10px;padding:8px 10px 14px}.ecp152-poll-card{border:1px solid var(--ws-line,#ddd);border-radius:16px;background:var(--ws-bg,#fff);padding:11px;box-shadow:0 1px 2px rgba(0,0,0,.04)}.ecp152-poll-card header{display:flex;align-items:center;gap:8px}.ecp152-poll-card header>div{display:grid;gap:1px;min-width:0}.ecp152-poll-card header small{font-size:10px;color:var(--ws-muted,#65676b)}.ecp152-poll-card header .text-btn{margin-left:auto}.ecp152-poll-avatar{width:34px!important;height:34px!important;flex:0 0 34px}.ecp152-poll-card h4{margin:11px 0 8px;font-size:15px}.ecp152-poll-options{display:grid;gap:6px}.ecp152-poll-options button{position:relative;isolation:isolate;overflow:hidden;width:100%;display:flex;justify-content:space-between;gap:10px;padding:9px 10px;border:1px solid var(--ws-line,#ddd);border-radius:11px;background:transparent;color:inherit;text-align:left}.ecp152-poll-options button i{position:absolute;z-index:-1;left:0;top:0;bottom:0;background:rgba(24,119,242,.13)}.ecp152-poll-options button.selected{border-color:#1877f2}.ecp152-poll-options button:disabled{opacity:.72}.ecp152-poll-card footer{display:flex;justify-content:space-between;color:var(--ws-muted,#65676b);font-size:11px;margin-top:8px}
@media(max-width:600px){.ecp152-modal{padding:8px}.ecp152-modal-card{max-height:94dvh}.ecp152-poll-stream{padding-left:6px;padding-right:6px}}
`;document.head.append(style);
})();