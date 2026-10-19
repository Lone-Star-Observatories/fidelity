from pathlib import Path
import hashlib,json,struct,xml.etree.ElementTree as ET
p=Path('data/research-sources'); ns={'p':'http://pds.nasa.gov/pds4/pds/v1'}; rows=[]
for stem in ['lor_0035398319_0x630_eng','lor_0035398320_0x630_eng']:
 f=p/f'elara-pds4-raw-{stem}.fit'; label=p/f'elara-pds4-raw-{stem}.lblx'; b=f.read_bytes(); x=ET.fromstring(label.read_bytes())
 primary=x.find('.//p:Array_2D_Image',ns); off=int(primary.findtext('p:offset',namespaces=ns)); a=x.find('.//p:Array_1D[p:local_identifier="ext_first34"]',ns); hkoff=int(a.findtext('p:offset',namespaces=ns)); raw=b[hkoff:hkoff+51]
 samples=list(struct.unpack_from('>34h',b,off)); packed=[]
 for i in range(0,51,3):
  v=int.from_bytes(raw[i:i+3],'big');packed.extend([v>>12,v&4095])
 assert all(0<=v<=4095 for v in samples)
 repacked=b''.join(((samples[i]<<12)|samples[i+1]).to_bytes(3,'big') for i in range(0,34,2))
 assert repacked==raw
 rows.append({'path':str(f),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'label':{'path':str(label),'bytes':len(label.read_bytes()),'sha256':hashlib.sha256(label.read_bytes()).hexdigest()},'primaryOffset':off,'primaryFirst34StoredSigned16':samples,'housekeepingOffset':hkoff,'housekeeping51BytesSha256':hashlib.sha256(raw).hexdigest(),'hypotheticalContiguous12bitMsbUnpack':packed,'hypotheticalUnpackEqualsPrimaryFirst34':packed==samples,'all34StoredSamplesWithin12bitUnsignedRange':True,'independentAdjacentSampleRepackEqualsAll51HousekeepingBytes':repacked==raw})
result={'status':'read-only preparation, hypothetical packing comparison only','products':rows,'limits':['Publisher describes encoded header as normally overlaying first34pixels; this comparison is not a verified bit-packing prescription or product reconstruction.','No masking, replacement, timing correction, calibrated measurement, target identification, source alteration or embedding.','Signed16 primary array storage remains distinct from hypothetical12-bit MSB grouping.']}
(p/'elara-first34-storage-preparation-2026-10-19.json').write_text(json.dumps(result,indent=2)+'\n');print([(r['hypotheticalUnpackEqualsPrimaryFirst34'],r['primaryFirst34StoredSigned16'][:6],r['hypotheticalContiguous12bitMsbUnpack'][:6]) for r in rows])
