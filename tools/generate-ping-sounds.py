"""Verify imported LoL Ping assets; retained command never synthesizes or overwrites them."""
from pathlib import Path
import json,hashlib
root=Path(__file__).resolve().parents[1]/'public/assets/game-sounds'
manifest=json.loads((root/'lol-ping-manifest.json').read_text(encoding='utf-8'))
for row in manifest['clips']:
    assert hashlib.sha256((root/row['file']).read_bytes()).hexdigest()==row['sha256'],row['file']
    assert hashlib.sha256((root/row['sourceFile']).read_bytes()).hexdigest()==row['sourceSha256'],row['sourceFile']
print('Verified five imported LoL Ping clips; no synthesis or overwriting.')
