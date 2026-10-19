"""Read-only declared histogram versus primary-array storage comparison; no repair."""
from pathlib import Path
import hashlib,json
import numpy as np
base=Path('data/research-sources');out=[]
for stamp in ('0035398319','0035398320'):
 p=base/f'elara-pds4-raw-lor_{stamp}_0x630_eng.fit'; b=p.read_bytes(); label=p.with_suffix('.lblx').read_bytes()
 a=np.frombuffer(b,dtype='>i2',count=1024*1028,offset=31680).astype(np.int64)
 h=np.frombuffer(b,dtype='>i4',count=32,offset=2142720).astype(np.int64)+2147483648
 assert np.all((a>=0)&(a<=4095)); primary=np.bincount(a//128,minlength=32)
 without=np.bincount(a[34:]//128,minlength=32)
 out.append({'path':str(p),'sha256':hashlib.sha256(b).hexdigest(),'labelSha256':hashlib.sha256(label).hexdigest(),'primarySampleCount':len(a),'declaredOffsetAppliedHistogram':h.tolist(),'histogramSum':int(h.sum()),'primary128DnBins':primary.tolist(),'differenceDeclaredMinusPrimary':(h-primary).tolist(),'equalAllPrimaryBins':bool(np.array_equal(h,primary)),'primaryExcludingFirst34Bins':without.tolist(),'equalExcludingFirst34Bins':bool(np.array_equal(h,without))})
r={'status':'Quiet research preparation only; no production or source mutation.','method':'Original raw primary 1024x1028 SignedMSB2 samples, floor division by 128 into 32 bins; compare original lowrate histogram SignedMSB4 plus declared 2147483648 offset. Also report explicitly hypothetical exclusion of first34 samples, without modifying any array.','products':out,'limits':['Lowrate histogram and primary-array discrepancy does not establish corruption, dropped telemetry, missing pixels, target identity or calibration.','No general flight accumulation rule, timing scope, saturation handling or lowrate/highrate product association independently verified.','Excluding first34 is a comparison only, not a valid mask or repair prescription.','No crop, resampling, physical raster/angular calculation, image export, embedding or dossier adoption.']}
(base/'elara-raw-histogram-comparison-preparation-2026-10-19.json').write_text(json.dumps(r,indent=2)+'\n')
print(json.dumps([{'path':x['path'],'primarySamples':x['primarySampleCount'],'histogramSum':x['histogramSum'],'equal':x['equalAllPrimaryBins'],'equalWithoutFirst34':x['equalExcludingFirst34Bins']} for x in out]))
