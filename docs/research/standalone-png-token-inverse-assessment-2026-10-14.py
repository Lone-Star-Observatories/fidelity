import pathlib,json,hashlib,struct,zlib
source=pathlib.Path('docs/research/standalone-png-deflate-reconstruction-assessment-2026-10-14.py').read_text()
exec(source[:source.index("s=pathlib.Path('standalone/snapshot.json')")])
p=pathlib.Path('data/research-sources/standalone-png-token-layout-screen-preparation-2026-10-14.json');report=json.loads(p.read_text())
for asset in report['assets']:
 b=pathlib.Path(asset['tokenScreenPayloadPath']).read_bytes();assert b[:8]==b'PNGTOK01'
 size,count,nt=struct.unpack('<III',b[8:20]);zh=b[20:22];zf=b[22:26];pos=26;headers=[]
 for _ in range(count+1):
  start,n=struct.unpack('<II',b[pos:pos+8]);pos+=8;raw=b[pos:pos+(n+7)//8];pos+=(n+7)//8;headers.append((start,n,raw))
 tokens=b[pos:];assert len(tokens)==nt;tp=0;w=Writer()
 for start,n,raw in headers[:-1]:
  assert w.p==start;w.raw(raw,0,n);r=Bits(raw);final=r.get(1);typ=r.get(2);assert typ in (1,2)
  if typ==1:lt=tree([8]*144+[9]*112+[7]*24+[8]*8);dt=tree([5]*32)
  else:
   nl=r.get(5)+257;nd=r.get(5)+1;nc=r.get(4)+4;cl=[0]*19
   for j in range(nc):cl[ORDER[j]]=r.get(3)
   ct=tree(cl);lengths=[]
   while len(lengths)<nl+nd:
    sym=symbol(r,ct)
    if sym<16:lengths.append(sym)
    elif sym==16:
     assert lengths;lengths.extend([lengths[-1]]*(r.get(2)+3))
    elif sym==17:lengths.extend([0]*(r.get(3)+3))
    else:lengths.extend([0]*(r.get(7)+11))
   assert len(lengths)==nl+nd;lt=tree(lengths[:nl]);dt=tree(lengths[nl:])
  assert r.p==n;li={v:k for k,v in lt.items()};di={v:k for k,v in dt.items()}
  while True:
   s=struct.unpack('<H',tokens[tp:tp+2])[0];tp+=2;v,bits=li[s];w.put(v,bits)
   if s==256:break
   if s>=257:
    extra=tokens[tp];ds=tokens[tp+1];de=struct.unpack('<H',tokens[tp+2:tp+4])[0];tp+=4
    assert extra<(1<<LE[s-257]) and ds<30 and de<(1<<DE[ds]);w.put(extra,LE[s-257]);v,bits=di[ds];w.put(v,bits);w.put(de,DE[ds])
 start,n,raw=headers[-1];assert w.p==start;w.raw(raw,0,n);assert tp==nt
 original=zh+bytes(w.b)+zf;assert len(original)==size and hashlib.sha256(original).hexdigest()==asset['idatSha256'];assert len(zlib.decompress(original))==asset['inflatedBytes']
 asset['independentEncodedTokenInverse']={'exactOriginalIdatHash':True,'originalIdatBytes':size,'tokenPayloadSha256':hashlib.sha256(b).hexdigest(),'scope':'All 11 retained PNG streams use fixed/dynamic blocks; stored-block encoded inverse unsupported and not claimed.'}
 asset.setdefault('isolatedScreen',{})['independentPackedInverse']='Independent Python encoded-token inverse verified exact original IDAT hash. No bundled JavaScript/browser inverse.'
report['status']='Research preparation: isolated token layout rejected as larger; independent Python token inverse verifies all11 original IDAT hashes. No adoption.'
p.write_text(json.dumps(report,indent=2)+'\n');print('11 exact encoded-token IDAT inverses verified; isolated screen remains larger130261 bytes.')
