"""Read-only lexical inventory, not a SPICE parser, loader or geometry evaluation."""
import pathlib, hashlib, json, re
root=pathlib.Path(__file__).resolve().parents[2]/'data/research-sources'
acq=json.loads((root/'elara-instrument-document-acquisition-preparation-2026-10-19.json').read_text())
index=(root/'elara-lorri-document-checksums-preparation-2026-10-19.md5').read_text()
for rec in acq['records']:
 blob=(root/ pathlib.Path(rec['path']).name).read_bytes()
 assert len(blob)==rec['bytes'] and hashlib.sha256(blob).hexdigest()==rec['sha256']
 name=rec['url'].rsplit('/',1)[-1]
 rows=[r for r in index.splitlines() if r.split() and r.split()[-1].rsplit('/',1)[-1]==name]
 assert len(rows)==1 and rows[0].split()[0]==hashlib.md5(blob).hexdigest()
source=root/'elara-instrument-nh_lorri_v201_ti.txt-preparation-2026-10-19.txt'
data=source.read_bytes(); text=data.decode('ascii'); active=False; lines=[]; transitions=[]
for n,line in enumerate(text.splitlines(),1):
 s=line.strip()
 if s in ('\\begindata','\\begintext'):
  active=s=='\\begindata'; transitions.append({'line':n,'marker':s}); continue
 if active and s: lines.append((n,s))
assignments=[]
for n,s in lines:
 m=re.match(r'^([A-Z][A-Z0-9_-]*)\s*(\+?=)\s*(.*)$',s)
 if m: assignments.append({'line':n,'keyword':m[1],'operator':m[2],'literalLines':[m[3]]})
 else:
  assert assignments, (n,s)
  assignments[-1]['literalLines'].append(s)
selected=[a for a in assignments if any(x in a['keyword'] for x in ('FOV_','BORESIGHT','CCD_CENTER','PIXEL_SIZE','PIXEL_SAMPLES','PIXEL_LINES'))]
result={'scope':'Quiet lexical preparation only. Literal data-block text retained; no SPICE loading, numeric evaluation, angular/raster calculation, image correction or production adoption. Archived documentation label expressly disallows scientific kernel use; current mission SPICE archive and actual load history remain unaudited.', 'source':str(source),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'transitions':transitions,'assignmentCount':len(assignments),'assignments':assignments,'selectedCoordinateKeywords':selected,'limits':['Literal keyword inventory does not validate SPICE syntax, dependencies, precedence, frame rotation or dates of use.','Version 2016-03-01 is later than Elara 2007 observations; no historical pipeline identity inferred.','File publication/migration, version date and observation date remain separate.','Optical inversion and zero-based convention require complete frame/pixel crosswalk; no silent flip or offset adopted.']}
out=root/'elara-instrument-kernel-inventory-preparation-2026-10-19.json'; out.write_text(json.dumps(result,indent=2)+'\n'); print(json.dumps({'assignments':len(assignments),'markers':len(transitions),'selected':len(selected),'sourceSha256':result['sha256']}))
