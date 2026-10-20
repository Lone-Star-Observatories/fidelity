from pathlib import Path
import json,math,hashlib
p=Path('data/research-sources/themisto-cfht-545046p-original.fits.fz');b=p.read_bytes();off=0;hdus=[]
def val(c):
 s=c[10:].split(' / ',1)[0].strip()
 if s.startswith("'"):return s.strip().strip("'").strip()
 if s in ['T','F']:return s=='T'
 try:return int(s)
 except:
  try:return float(s.replace('D','E'))
  except:return s
while off<len(b):
 start=off;cards=[]
 while True:
  c=b[off:off+80].decode('ascii');off+=80;cards.append(c)
  if c[:8].strip()=='END':break
 off=((off+2879)//2880)*2880;kv={c[:8].strip():val(c) for c in cards if c[8:10]=='= '};n=int(kv.get('NAXIS',0));size=(abs(int(kv.get('BITPIX',8)))//8)*int(kv.get('GCOUNT',1))*(int(kv.get('PCOUNT',0))+(math.prod(int(kv.get('NAXIS'+str(i),0)) for i in range(1,n+1)) if n else 0));hdus.append({'hdu':len(hdus),'headerOffset':start,'dataOffset':off,'storedDataBytes':size,'cards':cards,'fields':kv});off+=((size+2879)//2880)*2880
assert off==len(b),(off,len(b));r={'path':str(p),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'hdus':hdus,'limit':'Header/structural inventory only; compressed pixel arrays not decompressed,visually inspected,calibrated or crossmatched to Themisto.'};Path('data/research-sources/themisto-cfht-545046p-header-inventory-2026-10-20.json').write_text(json.dumps(r,indent=2)+'\n');print('HDUs',len(hdus))
for h in hdus[:2]:print({k:v for k,v in h['fields'].items() if k in ['OBJECT','DATE-OBS','UTC-OBS','EXPTIME','FILTER','OBSERVER','INSTRUME','TELESCOP','ORIGIN','PROPID','NAXIS','NAXIS1','NAXIS2','ZIMAGE','ZNAXIS1','ZNAXIS2','EXTNAME','DATE']})
