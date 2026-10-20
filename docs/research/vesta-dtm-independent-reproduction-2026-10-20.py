"""Independent research check: classic-TIFF tags, NumPy block means, Pillow PNG decoding.
Never writes the displayed DEM. Requires numpy and Pillow.
"""
from pathlib import Path
import json,struct,hashlib
import numpy as np
from PIL import Image
p=Path('data/research-sources/vesta-dtm-source-2026-10-20.tif')
with p.open('rb') as f:
 head=f.read(16);assert head[:2]==b'II' and struct.unpack_from('<H',head,2)[0]==42
 ifd=struct.unpack_from('<I',head,4)[0];f.seek(ifd);n=struct.unpack('<H',f.read(2))[0];entries=f.read(n*12);tags={}
 for i in range(n):
  tag,typ,count,value=struct.unpack_from('<HHII',entries,i*12);size={1:1,2:1,3:2,4:4}.get(typ,4)
  if count*size<=4:b=entries[i*12+8:i*12+12]
  else:f.seek(value);b=f.read(count*size)
  tags[tag]=(typ,count,b)
 def values(tag):
  typ,count,b=tags[tag];return struct.unpack('<'+{3:'H',4:'I'}[typ]*count,b[:count*{3:2,4:4}[typ]])
 W,H=values(256)[0],values(257)[0];assert (W,H)==(17280,8640)
 assert values(258)==(32,) and values(259)==(1,) and values(277)==(1,) and values(339)==(3,) and values(278)==(1,)
 offsets=values(273);assert len(offsets)==H and all(v==offsets[0]+i*W*4 for i,v in enumerate(offsets));assert p.stat().st_size==offsets[0]+W*H*4
radii=np.memmap(p,dtype='<f4',mode='r',offset=offsets[0],shape=(H,W));assert np.isfinite(radii).all();assert (radii>-1e30).all()
# Each canonical output cell contains exactly12x12 source cells for this grid.
heights=(radii.astype(np.float64)-255000).reshape(720,12,1440,12).sum(axis=3).sum(axis=1)/144
heights=heights.astype(np.float32);lo=int(np.floor(heights.min()));hi=int(np.ceil(heights.max()))
q=(1+np.floor((heights.astype(np.float64)-lo)*(65534/(hi-lo))+.5)).astype(np.uint16)
with Image.open('public/dem/vesta.png') as image:cached=np.asarray(image).astype(np.uint16)
unequal=int(np.count_nonzero(q!=cached));assert unequal==0
result=dict(method='Independent classicTIFF parsing and NumPy144-sample block mean/Float32/half-up quantization, Pillow16bitPNG decode; no production reader or rasterToGrid used.',sourceBytes=p.stat().st_size,payloadOffset=offsets[0],sourceShape=[H,W],finiteSamples=int(radii.size),sourceRadiusMinM=float(radii.min()),sourceRadiusMaxM=float(radii.max()),outputShape=list(q.shape),min=lo,max=hi,unequalSamples=unequal,totalOutputSamples=int(q.size),limit='Computational identity only, not measured coverage, physical accuracy, frame registration, per-pixel dates or photometry.')
Path('data/research-sources/vesta-dtm-independent-reproduction-2026-10-20.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
