"""Read-only raw FITS storage check. No calibration, crop, masking or image export."""
from pathlib import Path
import xml.etree.ElementTree as E,json,hashlib
import numpy as np
base=Path('data/research-sources')
def local(e):return e.tag.split('}')[-1]
def text(e,k):return next(x.text.strip() for x in e if local(x)==k)
def header(b,off):
 cards=[];i=off
 while True:
  c=b[i:i+80].decode('ascii');assert len(c)==80;cards.append(c);i+=80
  if c[:8].strip()=='END':break
 values={}
 for c in cards:
  if c[8:10]!='= ':continue
  field=c[10:].lstrip()
  values[c[:8].strip()]=field.split(chr(39))[1].strip() if field.startswith(chr(39)) else field.split('/')[0].strip()
 return values,((i+2879)//2880)*2880
out=[]
for n in ('0035398319','0035398320'):
 p=base/f'elara-pds4-raw-lor_{n}_0x630_eng.fit';b=p.read_bytes();r=E.parse(p.with_suffix('.lblx')).getroot();area=next(x for x in r if local(x)=='File_Area_Observational');objects=[];head=None
 for o in area:
  t=local(o)
  if t=='Header':
   off=int(text(o,'offset'));v,end=header(b,off);assert end-off==int(text(o,'object_length'));head=v,end
   objects.append({'kind':t,'offset':off,'end':end,'header':v})
  elif t.startswith('Array_'):
   v,end=head;off=int(text(o,'offset'));assert off==end
   axes=sorted([x for x in o if local(x)=='Axis_Array'],key=lambda x:int(text(x,'sequence_number')));shape=[int(text(x,'elements')) for x in axes]
   assert shape==[int(v['NAXIS'+str(i)]) for i in range(int(v['NAXIS']),0,-1)]
   elem=next(x for x in o if local(x)=='Element_Array');typ=text(elem,'data_type');dtype={'SignedMSB2':'>i2','SignedMSB4':'>i4','UnsignedByte':'u1'}[typ];count=int(np.prod(shape));size=count*np.dtype(dtype).itemsize;raw=b[off:off+size];assert len(raw)==size
   a=np.frombuffer(raw,dtype=dtype)
   zero=int(v.get('BZERO','0'));scale=int(v.get('BSCALE','1'));xmlzero=next((int(x.text) for x in elem if local(x)=='value_offset'),0);assert zero==xmlzero;assert scale==1
   shifted=a.astype(np.int64)*scale+zero
   objects.append({'kind':t,'name':text(o,'name'),'offset':off,'shape':shape,'type':typ,'samples':count,'storedMinimum':int(a.min()),'storedMaximum':int(a.max()),'offsetAppliedMinimum':int(shifted.min()),'offsetAppliedMaximum':int(shifted.max()),'pds4ValueOffset':xmlzero,'payloadSha256':hashlib.sha256(raw).hexdigest(),'fitsZero':v.get('BZERO','0'),'fitsScale':v.get('BSCALE','1')})
 out.append({'path':str(p),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'objects':objects})
result={'status':'Research storage diagnostics only; no independent calibration or image registration.','products':out,'limits':['Raw 1024x1028 declarations checked against FITS headers; not a physical-resolution or crop prescription.','Stored signed histogram values require declared +2147483648 offset; offset-applied range is a storage diagnostic, not independent telemetry completeness or calibrated photometry.','Housekeeping and histogram payloads retained unchanged; no quality semantics or missing telemetry inferred.','Window-mismatch tables not interpreted by this array-only check.','No processed/raw pixel mapping, timing correction, calibration pipeline, mask, embedding or production change.']}
(base/'elara-pds4-raw-storage-preparation-2026-10-18.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps([{'path':p['path'],'arrays':[{'name':x['name'],'shape':x['shape'],'storedMinimum':x['storedMinimum'],'storedMaximum':x['storedMaximum'],'offsetAppliedMinimum':x['offsetAppliedMinimum'],'offsetAppliedMaximum':x['offsetAppliedMaximum']} for x in p['objects'] if 'shape' in x]} for p in out]))
