"""Read-only instrument overview fixity and full-text audit; no calibration."""
import hashlib, json
from pathlib import Path
from pypdf import PdfReader
root=Path(__file__).resolve().parents[2]
a=json.loads((root/'docs/research/elara-instrument-overview-assessment-2026-10-19.json').read_text())
for s in a['labelAndFixity']['sources']:
    raw=(root/s['path']).read_bytes()
    assert len(raw)==s['bytes']
    assert hashlib.sha256(raw).hexdigest()==s['sha256']
    assert hashlib.md5(raw).hexdigest()==s['md5']
    assert s['publisherIndexRow'] in (root/a['labelAndFixity']['publisherIndex']['path']).read_text()
r=PdfReader(root/a['source']['path'])
assert len(r.pages)==5
raw=(root/a['fullTextPath']).read_bytes()
assert len(raw)==a['fullTextBytes'] and hashlib.sha256(raw).hexdigest()==a['fullTextSha256']
assert a['visuallyInspectedPages']==list(range(1,6))
print(json.dumps({'originalPdfAndLabelFixity':True,'pages':len(r.pages),'retainedFullTextExact':True,'calibrationAdopted':False}))
