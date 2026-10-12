from pathlib import Path
R=Path.cwd()
main=R/'android/app/src/main/kotlin/com/nextechdigitalacademy/educhat_pro/MainActivity.kt'
s=main.read_text()
old='''                        } else {\n                            val i = Intent(this, ChatHeadService::class.java).apply {'''
new='''                        } else {\n                            getSharedPreferences("ecp_chathead", MODE_PRIVATE).edit().putBoolean("enabled", true).apply()\n                            val i = Intent(this, ChatHeadService::class.java).apply {'''
if old not in s and 'getSharedPreferences("ecp_chathead"' not in s: raise SystemExit('MainActivity update marker missing')
s=s.replace(old,new,1)
old2='''                "stop" -> {\n                    stopService(Intent(this, ChatHeadService::class.java).apply { action = ChatHeadService.ACTION_STOP })'''
new2='''                "stop" -> {\n                    getSharedPreferences("ecp_chathead", MODE_PRIVATE).edit().putBoolean("enabled", false).apply()\n                    stopService(Intent(this, ChatHeadService::class.java).apply { action = ChatHeadService.ACTION_STOP })'''
if old2 not in s and 'putBoolean("enabled", false)' not in s: raise SystemExit('MainActivity stop marker missing')
s=s.replace(old2,new2,1)
main.write_text(s)

inc=R/'android/app/src/main/kotlin/com/nextechdigitalacademy/educhat_pro/IncomingCalls.kt'
s=inc.read_text()
old='''object NativePushRouter {\n fun handle(context:Context,message:RemoteMessage):Boolean {\n  val d=message.data;val id=d["notification_id"]?:return false;val kind=d["kind"]?:""'''
new='''object NativePushRouter {\n private fun maybeChatHead(context:Context,d:Map<String,String>,kind:String){\n  if(kind !in listOf("direct_message","group_messages","group_message","announcement"))return\n  if(!context.getSharedPreferences("ecp_chathead",Context.MODE_PRIVATE).getBoolean("enabled",false))return\n  if(Build.VERSION.SDK_INT>=23&&!android.provider.Settings.canDrawOverlays(context))return\n  val targetKind=d["target_kind"]?:return;val targetId=d["target_id"]?:return\n  val chatKind=when(targetKind){"direct"->"direct";"group","group_message"->"group";else->return}\n  val title=d["title"]?.take(80)?:"Chat"\n  val i=Intent(context,ChatHeadService::class.java).apply{action=ChatHeadService.ACTION_SHOW;putExtra("kind",chatKind);putExtra("chat_id",targetId);putExtra("title",title)}\n  try{if(Build.VERSION.SDK_INT>=26)context.startForegroundService(i) else context.startService(i)}catch(_:Throwable){}\n }\n fun handle(context:Context,message:RemoteMessage):Boolean {\n  val d=message.data;val id=d["notification_id"]?:return false;val kind=d["kind"]?:""\n  maybeChatHead(context,d,kind)'''
if old not in s and 'private fun maybeChatHead' not in s: raise SystemExit('IncomingCalls marker missing')
s=s.replace(old,new,1)
inc.write_text(s)
print('Applied v1.5.30 chat-head background hotfix')

# Historical CI base can carry an older shared/widgets.dart without the reply helpers
# used by the reconstructed current group/direct chat pages. Restore the helpers
# before compilation when they are absent.
widgets=R/'lib/shared/widgets.dart'
s=widgets.read_text()
if 'class ChatReplyParts' not in s:
    marker="void notice(BuildContext context, Object message) {"
    i=s.find(marker)
    if i<0: raise SystemExit('widgets.dart notice marker missing')
    # Insert helpers before notice so the symbols are top-level and available to all chat pages.
    helpers='''/// Stored as readable text so older app/web versions can still show replies.\nclass ChatReplyParts {\n  const ChatReplyParts({required this.body, this.quote});\n  final String body;\n  final String? quote;\n}\n\nString replyMessage(String name, String quoted, String body) {\n  final clean = quoted.replaceAll(RegExp(r'\\s+'), ' ').trim();\n  final clipped = clean.substring(0, clean.length > 240 ? 240 : clean.length);\n  return '↪ $name: $clipped\\n\\n$body';\n}\n\nChatReplyParts splitReplyMessage(String value) {\n  if (!value.startsWith('↪ ')) return ChatReplyParts(body: value);\n  final cut = value.indexOf('\\n\\n');\n  if (cut < 0) return ChatReplyParts(body: value);\n  return ChatReplyParts(body: value.substring(cut + 2), quote: value.substring(2, cut));\n}\n\n'''
    s=s[:i]+helpers+s[i:]
    widgets.write_text(s)
    print('Restored chat reply helpers for historical CI base')

# Fix the reconstructed startup-permissions source if the historical snapshot
# contains the missing parenthesis around the Android app-settings Intent.
sp=R/'android/app/src/main/kotlin/com/nextechdigitalacademy/educhat_pro/StartupPermissions.kt'
ss=sp.read_text()
bad='private fun openAppSettings(){try{activity.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:${activity.packageName}"))}catch(_:Exception){}}'
good='private fun openAppSettings(){try{activity.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:${activity.packageName}")))}catch(_:Exception){}}'
if bad in ss:
    ss=ss.replace(bad,good,1)
    sp.write_text(ss)
    print('Fixed StartupPermissions app-settings syntax')

# Group-picture preview: clicking a group photo in the chat list, group header,
# or legacy group-info panel opens a large preview without navigating away.
vr=R/'assets/webapp/v166-runtime.js'
js=vr.read_text()
if 'async function groupPhotoPreview' not in js:
    marker='/* ---------- Android chat head ---------- */'
    i=js.find(marker)
    if i<0: raise SystemExit('v166 group preview insertion marker missing')
    block='''/* ---------- group picture preview ---------- */
async function groupPhotoPreview(img){
 const path=img?.dataset?.photo||img?.dataset?.groupPhoto||'';if(!path)return;
 try{
  const user=state()?.user?.id;if(!user)return;
  const url=await window.EduPhotos.get(db(),user,'group-images',path);
  const d=document.createElement('dialog');d.className='ecp-avatar-preview ecp-group-photo-preview';
  d.innerHTML=`<button class="ecp-avatar-close" aria-label="Close">×</button><img src="${attr(url)}" alt="Group picture preview">`;
  document.body.append(d);d.querySelector('button').onclick=()=>d.close();
  d.addEventListener('click',e=>{if(e.target===d)d.close()});d.addEventListener('close',()=>d.remove());d.showModal();
 }catch(e){U.toast(U.errorText(e),'error')}
}
document.addEventListener('click',e=>{
 const img=e.target.closest?.('img[data-bucket="group-images"][data-photo],img[data-group-photo]');
 if(!img)return;e.preventDefault();e.stopPropagation();groupPhotoPreview(img);
},true);

'''
    js=js[:i]+block+js[i:]
    vr.write_text(js)
    print('Added group picture preview')

# Exact direct-chat mention/message deep link: keep the message id so the web
# workspace can scroll/highlight after opening the direct thread.
for rel in ['assets/webapp/index.html','assets/webapp/educhat-r4.js']:
    p=R/rel
    s=p.read_text()
    old="else if(n.target_kind==='direct'){window.EduWorkspace.pending={kind:'direct',id:n.target_id};await navigate('people');}"
    new="else if(n.target_kind==='direct'){window.EduWorkspace.pendingMessage=n.resource_id;window.EduWorkspace.pending={kind:'direct',id:n.target_id};await navigate('people');}"
    if old in s:
        p.write_text(s.replace(old,new))
        print('Added exact direct notification deep link in',rel)

# Notification-center direct mention/message routing also keeps the message id.
for rel in ['assets/webapp/index.html','assets/webapp/educhat-r4.js']:
    p=R/rel
    s=p.read_text()
    old="if(n.target_kind==='direct'){await W.openChat(c,'direct',target);return;}"
    new="if(n.target_kind==='direct'){W.pendingMessage=n.resource_id;await W.openChat(c,'direct',target);return;}"
    if old in s:
        p.write_text(s.replace(old,new))
        print('Patched notification-center direct message focus in',rel)

# Mirror exact message/comment routes in the standalone workspace runtime too.
p=R/'assets/webapp/educhat-r4.js'
s=p.read_text()
old="if(n.target_kind==='group'){await W.openChat(c,'group',target);return;}if(n.target_kind==='direct'){W.pendingMessage=n.resource_id;await W.openChat(c,'direct',target);return;}if(n.target_kind==='meeting')"
new="if(n.target_kind==='group_message'){W.pendingMessage=n.resource_id;await W.openChat(c,'group',n.target_id);return;}if(n.target_kind==='group'){await W.openChat(c,'group',target);return;}if(n.target_kind==='direct'){W.pendingMessage=n.resource_id;await W.openChat(c,'direct',target);return;}if(n.target_kind==='forum_comment'){W.pendingPost=n.target_id;W.pendingComment=n.resource_id;await c.navigate('forum');return;}if(n.target_kind==='meeting')"
if old in s:
    p.write_text(s.replace(old,new))
    print('Mirrored exact notification routes in educhat-r4.js')

# Native-page fallback for a notification whose target is a direct thread.
p=R/'lib/services/notification_router.dart'
s=p.read_text()
needle="  } else if (kind == 'direct_message') {\n"
if "targetKind == 'direct'" not in s:
    insert="""  } else if (targetKind == 'direct' && targetId != null) {\n    final thread = await repo.client\n        .from('direct_threads')\n        .select('user_a,user_b')\n        .eq('id', targetId)\n        .maybeSingle();\n    if (thread == null)\n      throw StateError('This conversation is no longer available.');\n    final other = thread['user_a'] == repo.userId\n        ? thread['user_b']\n        : thread['user_a'];\n    final p = await repo.client\n        .from('profiles')\n        .select('id,full_name,avatar_path')\n        .eq('id', other)\n        .single();\n    page = DirectChatPage(\n        repo: repo,\n        otherUserId: other,\n        otherName: p['full_name'] ?? 'User',\n        otherAvatarPath: p['avatar_path']);\n"""
    if needle not in s: raise SystemExit('notification_router direct target marker missing')
    p.write_text(s.replace(needle,insert+needle,1))
    print('Added native fallback direct-notification route')