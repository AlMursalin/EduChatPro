from pathlib import Path
import hashlib

ROOT = Path(__file__).resolve().parent
PARTS = ROOT / "v1530_parts"
data = "".join((PARTS / f"part_{i:02d}").read_text() for i in range(22))
if not data.endswith("\n"):
    data += "\n"

expected_len = 320444
expected_sha256 = "c53404c23a6bb2570987a83965048933c02e8bdd9594c3a7e5fe34dcf6ac5f6b"
actual_sha256 = hashlib.sha256(data.encode()).hexdigest()
if len(data) != expected_len:
    raise SystemExit(f"v1.5.30 snapshot length mismatch: {len(data)} != {expected_len}")
if actual_sha256 != expected_sha256:
    raise SystemExit(f"v1.5.30 snapshot SHA256 mismatch: {actual_sha256}")

out = ROOT / "v1530_apply_build.py"
out.write_text(data)
print(f"assembled {out.name}: {len(data)} bytes, sha256={actual_sha256}")
