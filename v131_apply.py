from pathlib import Path
import re

R=Path('.')

# Version
p=R/'pubspec.yaml'
s=p.read_text()
s=re.sub(r'^version:.*$', 'version: 1.4.1+40', s, flags=re.M)
p.write_text(s)

# Inject persistent photo cache + final mobile runtime after all app functions exist.
p=R/'assets/webapp/index.html'
s=p.read_text()
marker='<script src="native-mobile-patch.js"></script>'
inject='<script src="v131-photos.js"></script><script src="v131-runtime.js"></script>'
if inject not in s:
    if marker not in s:
        raise SystemExit('native mobile patch marker missing')
    s=s.replace(marker,inject+marker,1)
p.write_text(s)

# Copy runtime files into bundled web assets.
for name in ('v131-photos.js','v131-runtime.js'):
    src=Path(__file__).resolve().parent/name
    if not src.exists():
        raise SystemExit(name+' missing in repository root')
    (R/'assets/webapp'/name).write_bytes(src.read_bytes())

# Android screen sharing: serialize permission/session transitions and clean up foreground mode.
p=R/'lib/features/meetings/meeting_room_page.dart'
s=p.read_text()
if 'bool _screenShareBusy = false;' not in s:
    if 'bool screenShareTransition=false;' in s:
        s=s.replace('bool screenShareTransition=false;','bool screenShareTransition=false;\n  bool _screenShareBusy = false;',1)
    elif 'bool expandedVideo=false;' in s:
        s=s.replace('bool expandedVideo=false;','bool expandedVideo=false;\n  bool _screenShareBusy = false;',1)
    else:
        raise SystemExit('meeting state marker missing')

start=s.find('  Future<void> toggleScreen() async {')
end=s.find('\n  Future<void> togglePointer()',start)
if start<0 or end<0:
    raise SystemExit('toggleScreen block missing')
replacement='''  Future<void> toggleScreen() async {
    if (_screenShareBusy) return;
    _screenShareBusy = true;
    if (mounted) setState(() {});
    final enable = !backend.screenEnabled;
    try {
      if (enable && !kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
        final initialized = await FlutterBackground.initialize(
          androidConfig: const FlutterBackgroundAndroidConfig(
            notificationTitle: 'Edu Chat Pro',
            notificationText: 'Screen sharing is active',
            notificationImportance: AndroidNotificationImportance.normal,
          ),
        );
        if (!initialized) {
          throw StateError('Android screen-share service could not start.');
        }
        final allowed = await rtc.Helper.requestCapturePermission();
        if (!allowed) return;
        final background = await FlutterBackground.enableBackgroundExecution();
        if (!background) {
          throw StateError('Screen-share foreground service could not start.');
        }
      }

      await backend.shareScreen(enable).timeout(const Duration(seconds: 12));

      if (!enable &&
          !kIsWeb &&
          defaultTargetPlatform == TargetPlatform.android &&
          FlutterBackground.isBackgroundExecutionEnabled) {
        await FlutterBackground.disableBackgroundExecution();
      }
    } catch (_) {
      if (enable &&
          !kIsWeb &&
          defaultTargetPlatform == TargetPlatform.android &&
          FlutterBackground.isBackgroundExecutionEnabled) {
        await FlutterBackground.disableBackgroundExecution();
      }
      rethrow;
    } finally {
      _screenShareBusy = false;
      if (mounted) setState(() {});
    }
  }
'''
s=s[:start]+replacement+s[end:]
p.write_text(s)

print('Applied EduChatPro v1.4.1 polls/group-call/cache/history/comment/link patch')
