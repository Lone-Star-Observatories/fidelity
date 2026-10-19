"""Independent standard-library recheck of retained raw histogram preparation."""
from pathlib import Path
from collections import Counter
import struct,json,hashlib
base=Path('data/research-sources')
previous=json.loads((base/'elara-raw-histogram-comparison-preparation-2026-10-19.json').read_text())
checks=[]
for index,record in enumerate(previous['products']):
 p=Path(record['path']);b=p.read_bytes();assert hashlib.sha256(b).hexdigest()==record['sha256']
 assert hashlib.sha256(p.with_suffix('.lblx').read_bytes()).hexdigest()==record['labelSha256']
 # Explicit big-endian scalar iteration, independently of numpy views/bincount.
 values=[x[0] for x in struct.iter_unpack('>h',b[31680:31680+2*1024*1028])]
 counts=Counter(v//128 for v in values);bins=[counts[i] for i in range(32)]
 stored=struct.unpack('>32i',b[2142720:2142720+128]);hist=[v+2**31 for v in stored]
 assert bins==record['primary128DnBins'];assert hist==record['declaredOffsetAppliedHistogram']
 assert sum(hist)==record['histogramSum'];assert len(values)==record['primarySampleCount']
 assert all(0<=v<=4095 for v in values)
 excluded=Counter(v//128 for v in values[34:]);assert [excluded[i] for i in range(32)]==record['primaryExcludingFirst34Bins']
 checks.append({'path':str(p),'independentExactBinAgreementWithPreparation':True,'allPrimarySampleCount':len(values),'declaredLowrateHistogramCount':sum(hist),'declaredMinusPrimaryCount':sum(hist)-len(values),'differentBinIndices':[i for i in range(32) if hist[i]!=bins[i]],'sameHistogramAsOtherProduct':hist==previous['products'][1-index]['declaredOffsetAppliedHistogram']})
result={'status':'Quiet independent read-only recheck, not a calibrated product assessment.','checks':checks,'limits':previous['limits']+['Count difference is not identified missing telemetry, detector geometry, exposure integration or a correction; publisher accumulation scope and product crosswalk remain open.','Matching histograms across two products does not establish identical images or temporal origin.']}
(base/'elara-histogram-independent-recheck-preparation-2026-10-19.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(checks))
