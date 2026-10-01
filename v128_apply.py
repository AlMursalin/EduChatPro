from pathlib import Path
import re
R=Path('.')

p=R/'pubspec.yaml';s=p.read_text();s=re.sub(r'^version:.*$','version: 1.2.8+27',s,flags=re.M);p.write_text(s)

p=R/'android/app/src/main/kotlin/com/nextechdigitalacademy/educhat_pro/MainActivity.kt';s=p.read_text()
s=s.replace('const val MESSAGE_CHANNEL="ecp_messages_v2"','const val MESSAGE_CHANNEL="ecp_messages_v4"')
s=s.replace('const val CALL_CHANNEL="ecp_calls_v2"','const val CALL_CHANNEL="ecp_calls_v4"')
p.write_text(s)

p=R/'android/app/src/main/kotlin/com/nextechdigitalacademy/educhat_pro/IncomingCalls.kt';s=p.read_text()
s=s.replace('const val CHANNEL="ecp_incoming_calls_v2"','const val CHANNEL="ecp_incoming_calls_v4"')
start=s.index('object BackgroundMessages {');end=s.index('class IncomingCallActivity:Activity(){')
replacement=r'''object BackgroundMessages {
 fun show(context:Context,id:String,title:String,body:String=""){
  if(Build.VERSION.SDK_INT>=33&&context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return
  val nm=context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
  if(Build.VERSION.SDK_INT>=26){
   val ch=NotificationChannel(MainActivity.MESSAGE_CHANNEL,"Messages and updates",NotificationManager.IMPORTANCE_HIGH).apply{
    description="Chat messages, forum announcements and Edu Chat Pro updates"
    enableVibration(true)
    setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build())
    lockscreenVisibility=Notification.VISIBILITY_PRIVATE
   }
   nm.createNotificationChannel(ch)
  }
  val intent=Intent(context,MainActivity::class.java).apply{flags=Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP;putExtra("ec_notification_id",id)}
  val tap=PendingIntent.getActivity(context,id.hashCode(),intent,PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  val b=if(Build.VERSION.SDK_INT>=26)Notification.Builder(context,MainActivity.MESSAGE_CHANNEL)else Notification.Builder(context)
  b.setSmallIcon(R.drawable.ic_notification).setContentTitle(title.ifBlank{"Edu Chat Pro"}).setContentText(body.ifBlank{title}).setStyle(Notification.BigTextStyle().bigText(body.ifBlank{title})).setContentIntent(tap).setAutoCancel(true).setOnlyAlertOnce(false).setVisibility(Notification.VISIBILITY_PRIVATE).setCategory(Notification.CATEGORY_MESSAGE)
  if(Build.VERSION.SDK_INT<26)b.setPriority(Notification.PRIORITY_MAX).setDefaults(Notification.DEFAULT_ALL)
  nm.notify(id,0,b.build())
 }
}
object NativePushRouter {
 fun handle(context:Context,message:RemoteMessage):Boolean {
  val d=message.data;val id=d["notification_id"]?:return false;val kind=d["kind"]?:""
  if(kind=="call_cancel"){IncomingCalls.cancel(context,d["call_notification_id"]?:d["resource_id"]?:id);return true}
  if(kind in listOf("direct_call_audio","direct_call_video","group_call")){
   val expiry=d["expires_at_ms"]?.toLongOrNull()?:message.sentTime+60000
   IncomingCalls.show(context,id,d["resource_id"]?:id,d["title"]?:"Incoming call",expiry);return true
  }
  BackgroundMessages.show(context,id,d["title"]?:"Edu Chat Pro",d["body"]?:"");return true
 }
}
class EduPushReceiver:io.flutter.plugins.firebase.messaging.FlutterFirebaseMessagingReceiver(){
 override fun onReceive(context:Context,intent:Intent){
  try{val extras=intent.extras;if(extras!=null&&NativePushRouter.handle(context,RemoteMessage(extras)))return}catch(_:Throwable){}
  super.onReceive(context,intent)
 }
}
class EduMessagingService:FlutterFirebaseMessagingService(){
 override fun onMessageReceived(message:RemoteMessage){
  try{if(NativePushRouter.handle(this,message))return}catch(_:Throwable){}
  super.onMessageReceived(message)
 }
 override fun onNewToken(token:String){super.onNewToken(token)}
}
'''
s=s[:start]+replacement+s[end:];p.write_text(s)

p=R/'android/app/src/main/AndroidManifest.xml';s=p.read_text()
if 'android.permission.WAKE_LOCK' not in s:s=s.replace('<uses-permission android:name="android.permission.VIBRATE" />','<uses-permission android:name="android.permission.VIBRATE" />\n<uses-permission android:name="android.permission.WAKE_LOCK" />')
s=s.replace('android:value="ecp_messages_v2"','android:value="ecp_messages_v4"');p.write_text(s)

p=R/'lib/services/notification_service.dart';s=p.read_text()
s=s.replace("'title': m.notification?.body ?? 'New Edu Chat Pro update',","'title': m.data['title'] ?? m.notification?.title ?? 'Edu Chat Pro',\n        'body': m.data['body'] ?? m.notification?.body ?? 'New update',")
s=s.replace("'body': row['title']?.toString() ?? 'New update',","'body': row['body']?.toString() ?? row['title']?.toString() ?? 'New update',")
s=s.replace("await save(t);\n        token = t;","await _replaceToken(t);\n        token = t;")
s=s.replace("await save(value);\n      token = value;","await _replaceToken(value);\n      token = value;")
marker='  Future<void> save(String value) async {'
insert='''  Future<void> _replaceToken(String value) async {
    final old = token;
    if (old != null && old.isNotEmpty && old != value) {
      try { await repo.client.from('device_tokens').delete().eq('user_id', ownerId).eq('token', old); } catch (_) {}
    }
    await save(value);
  }

'''
if '_replaceToken(String value)' not in s:s=s.replace(marker,insert+marker)
s=s.replace('const Duration(seconds: 30), () => retryRegistration(force: true)','const Duration(seconds: 12), () => retryRegistration(force: true)')
p.write_text(s)

p=R/'lib/features/home/home_shell.dart';s=p.read_text()
s=s.replace('timer = Timer.periodic(Duration(seconds: 30), (_) => checkSession());',"timer = Timer.periodic(const Duration(seconds: 30), (_) {\n      unawaited(checkSession());\n      unawaited(notifications.retryRegistration());\n    });")
p.write_text(s)

p=R/'lib/features/home/mobile_web_workspace.dart';s=p.read_text()
s=s.replace('if(c==null||!ready)return false;',"if(c==null)return false;\n    if(!ready){\n      for(var i=0;i<6&&!ready;i++) await Future<void>.delayed(const Duration(milliseconds:80));\n      if(!ready)return true;\n    }")
p.write_text(s)

p=R/'assets/webapp/native-mobile-patch.js';s=p.read_text()
block=re.compile(r"\n\n  const isSendButton=el=>.*?document\.addEventListener\('submit',e=>\{\n    if\(!e\.target\?\.matches\?\('#ws-send,#dm-form,#chat-form'\)\)return;const input=composerInput\(\);\n    for\(const ms of \[0,25,80,160\]\)setTimeout\(\(\)=>\{if\(input\?\.isConnected\)\{try\{input\.focus\(\{preventScroll:true\}\)\}catch\{input\.focus\(\)\}scrollChatBottom\(true\);\}\},ms\);\n  \},true\);",re.S)
s,_=block.subn("\n\n  // Single Messenger-style send path is installed later to avoid duplicate work.\n",s,count=1)
s=s.replace("new MutationObserver(()=>{\n    const input=composerInput();\n    if(input&&document.activeElement===input)settleBottom();\n  }).observe(document.documentElement,{subtree:true,childList:true});","let mutationRaf=0;\n  new MutationObserver(()=>{\n    const input=composerInput();if(!input||document.activeElement!==input)return;\n    cancelAnimationFrame(mutationRaf);mutationRaf=requestAnimationFrame(()=>scrollChatBottom(true));\n  }).observe(document.documentElement,{subtree:true,childList:true});")
needle="  document.addEventListener('click',e=>{\n    if(Date.now()-ecpSendTouchAt<700&&e.target.closest?.(ecpSendSelector)){e.preventDefault();e.stopImmediatePropagation();}\n  },true);"
if needle in s and "for(const ms of [0,24,70])" not in s:
 s=s.replace(needle,needle+"\n  document.addEventListener('submit',e=>{\n    if(!e.target?.matches?.('#ws-send,#dm-form,#chat-form'))return;const input=composerInput();\n    for(const ms of [0,24,70])setTimeout(()=>{if(input?.isConnected){try{input.focus({preventScroll:true})}catch{input.focus()}scrollChatBottom(true);}},ms);\n  },true);",1)
p.write_text(s)

p=R/'backend/supabase/functions/push-dispatch/index.ts';s=p.read_text()
s=s.replace("channel_id:'ecp_messages_v2'","channel_id:'ecp_messages_v4'").replace("channel_id:'ecp_messages_v3'","channel_id:'ecp_messages_v4'")
p.write_text(s)

print('Applied EduChatPro v1.2.8 client hardening')
