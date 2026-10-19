"""Read-only PDS4 window table/header storage crosswalk; no repair or calibration."""
from pathlib import Path
import xml.etree.ElementTree as E
import hashlib,json,struct
base=Path('data/research-sources')
def local(e): return e.tag.split('}')[-1]
def val(e,k): return next(x.text.strip() for x in e if local(x)==k)
products=[]
for n in ('0035398319','0035398320'):
 p=base/f'elara-pds4-raw-lor_{n}_0x630_eng.fit'; b=p.read_bytes(); label=p.with_suffix('.lblx'); root=E.fromstring(label.read_bytes())
 table=next(e for e in root.iter() if local(e)=='Table_Binary'); off=int(val(table,'offset')); count=int(val(table,'records')); rec=next(e for e in table if local(e)=='Record_Binary'); size=int(val(rec,'record_length'))
 cards=[]
 for i in range(0,len(b),80):
  c=b[i:i+80].decode('ascii')
  if c[:8].strip()=='END': break
  cards.append(c)
 headers={}
 for c in cards:
  if c[8:10]!='= ':continue
  field=c[10:].lstrip()
  headers[c[:8].strip()]=field.split(chr(39))[1].strip() if field.startswith(chr(39)) else field.split('/')[0].strip()
 rows=[]
 for j in range(count):
  fields={}; spans=[]
  for f in rec:
   if local(f)!='Field_Binary':continue
   name=val(f,'name'); start=int(val(f,'field_location'))-1; length=int(val(f,'field_length')); typ=val(f,'data_type'); raw=b[off+j*size+start:off+j*size+start+length]; assert len(raw)==length
   value=struct.unpack({'SignedMSB4':'>i','IEEE754MSBSingle':'>f'}[typ],raw)[0] if typ!='ASCII_String' else raw.decode('ascii')
   fields[name]={'value':value,'rawHex':raw.hex(),'type':typ}; spans.extend(range(start,start+length))
  assert sorted(spans)==list(range(size));rows.append(fields)
 assert count==1 and size==57
 row=rows[0]
 assert [row[k]['value'] for k in ('MMNAXIS1OFFSET','MMNAXIS2OFFSET','DELTA')]==[-999,-999,0]
 for key in ('WINDOWX','WINDOWY','WINDOWW','WINDOWH'):assert row[key]['value']==int(headers[key])
 assert row['APID']['value']==headers['APID']
 assert row['ARCHDATE']['value'].rstrip(chr(0))==headers['ARCHDATE']
 assert row['GRT']['value']==struct.unpack('>f',struct.pack('>f',float(headers['GRT'])))[0]
 products.append({'path':str(p),'sha256':hashlib.sha256(b).hexdigest(),'labelSha256':hashlib.sha256(label.read_bytes()).hexdigest(),'offset':off,'recordLength':size,'rows':rows,'headerTableChecksPass':True})
result={'products':products,'limits':['Exact stored-byte/header agreement only; not packet completeness, image reconstruction, calibration or target registration.','Sentinel offsets -999/delta zero are documented bookkeeping, not by themselves merge anomalies.','WINDOWH zero remains unexplained; no empty-image inference or repair.','GRT float32 rounding and NUL-padded ARCHDATE comparison do not validate observation times.','All original FITS and labels unchanged; no production change.']}
p=base/'elara-pds4-window-crosswalk-recheck-preparation-2026-10-18.json';p.write_text(json.dumps(result,indent=2)+'\n');print('Both 57-byte records parsed with complete nonoverlapping field coverage; header/table checks pass.')
