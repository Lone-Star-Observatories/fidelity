"""Read-only FITS/PDS4 layout cross-check; no calibration, masking or output image."""
from pathlib import Path
import hashlib,json,xml.etree.ElementTree as ET
import numpy as np
root=Path('data/research-sources')
def h(b):return hashlib.sha256(b).hexdigest()
def local(x):return x.tag.rsplit('}',1)[-1]
def child(x,name):return next(y for y in x if local(y)==name)
def txt(x,name):return child(x,name).text.strip()
def header(b,start):
 cards=[];n=start
 while True:
  c=b[n:n+80].decode('ascii');cards.append(c);n+=80
  if c[:8].strip()=='END':break
  assert n<len(b)
 end=((n+2879)//2880)*2880
 vals={}
 for c in cards:
  if c[8:10]=='= ':vals[c[:8].strip()]=c[10:].split('/')[0].strip().strip("'").strip()
 return vals,end
out=[]
for stem in ['lor_0035398319_0x630_sci','lor_0035398320_0x630_sci']:
 fit=root/('elara-pds4-'+stem+'.fit');label=root/('elara-pds4-'+stem+'.lblx');b=fit.read_bytes();xml=ET.fromstring(label.read_bytes());area=next(x for x in xml if local(x)=='File_Area_Observational');arrays=[];head=None
 for obj in area:
  if local(obj)=='Header':
   off=int(txt(obj,'offset'));length=int(txt(obj,'object_length'));vals,end=header(b,off);assert end-off==length;head=(vals,end)
  elif local(obj)=='Array_2D_Image':
   vals,end=head;off=int(txt(obj,'offset'));assert off==end
   bit=int(vals['BITPIX']);axes=sorted([x for x in obj if local(x)=='Axis_Array'],key=lambda x:int(txt(x,'sequence_number')))
   sizes=[int(txt(x,'elements')) for x in axes];assert sizes==[int(vals['NAXIS2']),int(vals['NAXIS1'])]==[1024,1024]
   el=child(obj,'Element_Array');typ=txt(el,'data_type');dtype={'IEEE754MSBSingle':'>f4','SignedMSB2':'>i2'}[typ];assert np.dtype(dtype).itemsize==abs(bit)//8
   count=int(np.prod(sizes));raw=b[off:off+count*abs(bit)//8];assert len(raw)==count*abs(bit)//8
   a=np.frombuffer(raw,dtype=dtype);scale=float(vals.get('BSCALE','1'));offset=float(vals.get('BZERO','0'));xmlOffset=next((float(x.text) for x in el if local(x)=='value_offset'),0.);assert offset==xmlOffset;assert scale==1
   d=dict(id=txt(obj,'local_identifier'),header=vals,offset=off,storedType=typ,shape=sizes,rawPayloadSha256=h(raw),storedSamples=count,finite=int(np.isfinite(a).sum()),storedMinimum=float(a.min()),storedMaximum=float(a.max()),fitsScale=scale,fitsZero=offset,pds4ValueOffset=xmlOffset)
   if bit==16:
    shifted=a.astype(np.int32)+int(offset);values,counts=np.unique(shifted,return_counts=True);d['offsetAppliedValueCounts']={str(int(v)):int(c) for v,c in zip(values,counts)};d['note']='Stored signed16 plus32768 agrees FITS BZERO/PDS4 value_offset. Counts only; no flag meanings applied, mask repaired, photometric reliability or geographic completeness inferred.'
   arrays.append(d)
 definitions={txt(x,'flag_value'):txt(x,'flag_meaning') for x in xml.iter() if local(x)=='Quality_Flag_Definition'}
 oldLabel=root/('elara-'+stem+'.lbl');oldText=oldLabel.read_text();qualityText=oldText.split('OBJECT                          = EXTENSION_CALIB_QUALITY_IMAGE')[1].split('END_OBJECT')[0]
 assert '32 => Bad pixel not in any of above categories' in qualityText
 assert definitions['32']=='Missing Level 1 data (assume fill value of 0)'
 q=arrays[-1];a=np.frombuffer(b[q['offset']:q['offset']+2097152],dtype='>i2').astype(np.int32)+32768;positions=np.flatnonzero(a);assert len(positions)==34;assert np.all(a[positions]==32)
 q['nonzeroStoredFlatIndicesZeroBased']=positions.tolist();q['pds4FlagDefinitions']=definitions;q['pds3QualityDescription']=qualityText.strip();q['pds3Label']=dict(path=str(oldLabel),bytes=oldLabel.stat().st_size,sha256=h(oldLabel.read_bytes()))
 out.append(dict(product=stem,fit=dict(path=str(fit),bytes=len(b),sha256=h(b)),label=dict(path=str(label),bytes=label.stat().st_size,sha256=h(label.read_bytes())),arrays=arrays))
result=dict(status='Quiet preparation only; no production/source modification, integration, calibrated photometry, independent image/shape accuracy or schema validation claim.',products=out)
p=root/'elara-pds4-quality-assessment-results-2026-10-18.json';p.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps([dict(product=x['product'],arrays=[{k:y[k] for k in ['id','offset','storedSamples','finite','storedMinimum','storedMaximum']} for y in x['arrays']]) for x in out]))
