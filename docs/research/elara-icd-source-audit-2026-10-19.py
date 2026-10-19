"""Read-only local source fixity and exact stored-card inventory, not radiometry."""
import hashlib,json
from pathlib import Path
from pypdf import PdfReader
root=Path(__file__).resolve().parents[2]
a=json.loads((root/'docs/research/elara-icd-photometry-assessment-2026-10-19.json').read_text())
for s in a['sources']+[a['fullText']]:
 b=(root/s['path']).read_bytes()
 assert len(b)==s['bytes'] and hashlib.sha256(b).hexdigest()==s['sha256']
 if 'md5' in s: assert hashlib.md5(b).hexdigest()==s['md5']
assert len(PdfReader(root/a['sources'][1]['path']).pages)==182
for s in a['retainedHeaderInventory']['products']:
 b=(root/s['path']).read_bytes(); assert hashlib.sha256(b).hexdigest()==s['sha256']
 cards=[]
 for i in range(0,len(b),80):
  c=b[i:i+80].decode('ascii'); key=c[:8].strip()
  if key=='END':break
  cards.append(c)
 for c in s['primaryHeaderCards']:assert c in cards
index=(root/a['publisherFixity']['path']).read_bytes()
assert hashlib.sha256(index).hexdigest()==a['publisherFixity']['sha256']
for source in a['sources']:assert source['publisherIndexRow'] in index.decode()
assert a['visuallyInspectedPdfPages']==[1,2,53,54,55,62]
print(json.dumps({'sourceHashesExact':True,'retainedCardsExact':True,'calibrationAdopted':False}))
