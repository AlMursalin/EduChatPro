from pathlib import Path
import re
R=Path('.')

p=R/'pubspec.yaml'
s=p.read_text()
s=re.sub(r'^version:.*$', 'version: 1.3.3+32', s, flags=re.M)
p.write_text(s)

p=R/'assets/webapp/index.html'
s=p.read_text()

s=s.replace("const cached=path&&S?.user?.id?window.EduPhotos.peek(S.user.id,bucket,path):'';",
            "let uid='';try{uid=typeof S!=='undefined'&&S&&S.user?S.user.id:''}catch{}const cached=path&&uid?window.EduPhotos.peek(uid,bucket,path):'';")
s=s.replace("const user=S?.user?.id;if(!user)return;",
            "let user='';try{user=typeof S!=='undefined'&&S&&S.user?S.user.id:''}catch{}if(!user)return;")
s=s.replace("function ecp132Key(kind,id){return `ecp132:${S.user?.id||'guest'}:${kind}:${id||'main'}`}",
            "function ecp132Key(kind,id){let uid='guest';try{uid=typeof S!=='undefined'&&S&&S.user&&S.user.id?S.user.id:'guest'}catch{}return `ecp132:${uid}:${kind}:${id||'main'}`}")
s=s.replace("S?.user?.id", "(typeof S!=='undefined'&&S&&S.user?S.user.id:null)")
s=s.replace("S?.profile?.full_name", "(typeof S!=='undefined'&&S&&S.profile?S.profile.full_name:null)")
p.write_text(s)

p=R/'assets/webapp/native-mobile-patch.js'
t=p.read_text()
t=t.replace("current=S?.page||q('#page')?.dataset?.page||''",
            "current=(typeof S!=='undefined'&&S?S.page:'')||q('#page')?.dataset?.page||''")
p.write_text(t)
print('Applied v1.3.3 startup-state guard fix')