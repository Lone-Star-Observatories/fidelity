"""Read-only source/preparation fixity checks; not calibration reproduction."""
import hashlib,json
from pathlib import Path
from pypdf import PdfReader
p=Path('docs/research/elara-lorri-ssr-report-assessment-2026-10-19.json')
a=json.loads(p.read_text());s=a['source'];b=Path(s['path']).read_bytes()
assert len(b)==s['bytes']
assert hashlib.sha256(b).hexdigest()==s['sha256']
assert hashlib.md5(b).hexdigest()==s['md5']
assert len(PdfReader(s['path']).pages)==33
assert hashlib.sha256(Path(s['textPath']).read_bytes()).hexdigest()==s['textSha256']
seen=set()
for x in a['inspection']['preparations']:
 raw=Path(x['path']).read_bytes()
 assert len(raw)==x['bytes'] and hashlib.sha256(raw).hexdigest()==x['sha256']
 v=json.loads(raw)
 seen.update(v.get('visuallyInspectedThisPass',v.get('visuallyInspectedPages',[])))
assert seen==set(range(1,34))
assert len(a['authors'])==16
print(json.dumps({'originalPdfAndTextFixity':True,'visualPageInventory':len(seen),'authors':len(a['authors']),'productionAdoption':False}))
