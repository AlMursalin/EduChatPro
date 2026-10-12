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

widgets=R/'lib/shared/widgets.dart'
s=widgets.read_text()
if 'class ChatReplyParts' not in s:
    marker="void notice(BuildContext context, Object message) {"
    i=s.find(marker)
    if i<0: raise SystemExit('widgets.dart notice marker missing')
    helpers='''/// Stored as readable text so older app/web versions can still show replies.\nclass ChatReplyParts {\n  const ChatReplyParts({required this.body, this.quote});\n  final String body;\n  final String? quote;\n}\n\nString replyMessage(String name, String quoted, String body) {\n  final clean = quoted.replaceAll(RegExp(r'\\s+'), ' ').trim();\n  final clipped = clean.substring(0, clean.length > 240 ? 240 : clean.length);\n  return '↪ $name: $clipped\\n\\n$body';\n}\n\nChatReplyParts splitReplyMessage(String value) {\n  if (!value.startsWith('↪ ')) return ChatReplyParts(body: value);\n  final cut = value.indexOf('\\n\\n');\n  if (cut < 0) return ChatReplyParts(body: value);\n  return ChatReplyParts(body: value.substring(cut + 2), quote: value.substring(2, cut));\n}\n\n'''
    s=s[:i]+helpers+s[i:]
    widgets.write_text(s)
    print('Restored chat reply helpers for historical CI base')

print('Applied v1.5.30 chat-head/background/CI compatibility hotfix')
