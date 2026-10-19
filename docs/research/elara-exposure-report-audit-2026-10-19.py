"""Read-only report fixity/text checks; not flight timing or calibration reproduction."""
import pathlib,json,hashlib
from pypdf import PdfReader
root=pathlib.Path(__file__).resolve().parents[2]
rec=json.loads((root/'data/research-sources/elara-exposure-offset-acquisition-preparation-2026-10-19.json').read_text())
source=root/rec['path'];data=source.read_bytes()
assert len(data)==rec['bytes'] and hashlib.sha256(data).hexdigest()==rec['sha256']
assert hashlib.md5(data).hexdigest()==rec['publisherMd5Row'].split()[0]
reader=PdfReader(source);assert len(reader.pages)==7
pages=[' '.join(p.extract_text().split()) for p in reader.pages]
for page,words in [(0,['John Spencer','Hal Weaver','February 2020']),(3,['34966574','34966577','0.59','0.58']),(4,['35029094','35029097','0.59']),(5,['+0.6','pipeline','EXPTIME']),(6,['12.384','11.546','0.616'])]:
 for word in words:assert word in pages[page],(page+1,word)
assert all('35398319' not in p and '35398320' not in p for p in pages)
text='\n\n'.join(f'PAGE {i+1}\n'+p.extract_text() for i,p in enumerate(reader.pages))
assert hashlib.sha256(text.encode()).hexdigest()==rec['textSha256']
print(json.dumps({'pages':7,'originalBytes':len(data),'originalSha256':rec['sha256'],'publisherMd5Match':True,'fullTextHashMatch':True,'reportIoMetIdentifiersDistinctFromRetainedElara':True,'flightTimingOrPipelineReproduced':False,'productionChange':False}))
