import pathlib,re,base64,hashlib,struct,zlib,json,collections
class Bits:
 def __init__(self,b):self.b=b;self.p=0
 def get(self,n):
  v=0
  for j in range(n):
   assert self.p<len(self.b)*8
   v|=((self.b[self.p//8]>>(self.p%8))&1)<<j;self.p+=1
  return v
 def align(self):self.p=(self.p+7)//8*8

def tree(lengths):
 counts=collections.Counter(lengths);counts[0]=0;code=0;starts={}
 for n in range(1,16):code=(code+counts[n-1])<<1;starts[n]=code
 table={}
 for sym,n in enumerate(lengths):
  if n:
   c=starts[n];starts[n]+=1;rev=int(format(c,'0'+str(n)+'b')[::-1],2);table[(rev,n)]=sym
 return table

def symbol(r,t):
 v=0
 for n in range(1,16):
  v|=r.get(1)<<(n-1)
  if (v,n) in t:return t[(v,n)]
 raise ValueError('invalid Huffman code')
LB=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258]
LE=[0]*8+[1]*4+[2]*4+[3]*4+[4]*4+[5]*4+[0]
DB=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577]
DE=[0]*4+[n for n in range(1,14) for _ in range(2)]
ORDER=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15]
class Writer:
 def __init__(self):self.b=bytearray();self.p=0
 def put(self,value,n):
  for j in range(n):
   if self.p//8==len(self.b):self.b.append(0)
   self.b[self.p//8]|=((value>>j)&1)<<(self.p%8);self.p+=1
 def raw(self,source,start,end):
  for j in range(start,end):self.put((source[j//8]>>(j%8))&1,1)
 def sym(self,table,sym):
  inverse={v:k for k,v in table.items()};v,n=inverse[sym];self.put(v,n)

def inspect(z):
 assert (z[0]*256+z[1])%31==0 and z[0]&15==8 and not z[1]&32
 r=Bits(z[2:-4]);out=bytearray();blocks=[];writer=Writer()
 while True:
  start=r.p;final=r.get(1);typ=r.get(2);lit=0;matches=0;copied=0;hist=collections.Counter()
  if typ==0:
   r.align();n=r.get(16);nn=r.get(16);assert n^nn==65535
   for _ in range(n):out.append(r.get(8))
   lit=n;writer.raw(r.b,start,r.p)
  else:
   assert typ in (1,2)
   if typ==1:
    lt=tree([8]*144+[9]*112+[7]*24+[8]*8);dt=tree([5]*32)
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
    assert len(lengths)==nl+nd
    lt=tree(lengths[:nl]);dt=tree(lengths[nl:])
   writer.raw(r.b,start,r.p)
   li={v:k for k,v in lt.items()};di={v:k for k,v in dt.items()}
   while True:
    s=symbol(r,lt);v,bits=li[s];writer.put(v,bits)
    if s<256:out.append(s);lit+=1
    elif s==256:break
    else:
     assert 257<=s<=285
     extra=r.get(LE[s-257]);writer.put(extra,LE[s-257]);n=LB[s-257]+extra;ds=symbol(r,dt);assert ds<30
     v,bits=di[ds];writer.put(v,bits)
     extra=r.get(DE[ds]);writer.put(extra,DE[ds]);distance=DB[ds]+extra;assert 0<distance<=len(out)
     for _ in range(n):out.append(out[-distance])
     matches+=1;copied+=n;hist[ds]+=1
  blocks.append({'type':typ,'final':bool(final),'startBit':start,'endBit':r.p,'literalBytes':lit,'matchTokens':matches,'copiedBytes':copied,'distanceCodeHistogram':dict(sorted(hist.items()))})
  if final:break
 writer.raw(r.b,r.p,len(r.b)*8)
 assert bytes(writer.b)==r.b
 assert z[:2]+bytes(writer.b)+z[-4:]==z
 assert bytes(out)==zlib.decompress(z)
 assert zlib.adler32(out)==int.from_bytes(z[-4:],'big')
 return {'blocks':blocks,'parsedBits':r.p,'trailingPaddingBits':len(r.b)*8-r.p,'exactInflatedByteEquality':True,'exactOriginalDeflateBitstreamReconstruction':True,'inflatedBytes':len(out)}
s=pathlib.Path('standalone/snapshot.json').read_bytes();seen=set();assets=[]
for m in re.finditer(rb'data:image/png;base64,([A-Za-z0-9+/=]+)',s):
 b=base64.b64decode(m[1]);h=hashlib.sha256(b).hexdigest()
 if h in seen:continue
 seen.add(h);p=8;idat=b''
 while p<len(b):
  n=struct.unpack('>I',b[p:p+4])[0]
  if b[p+4:p+8]==b'IDAT':idat+=b[p+8:p+8+n]
  p+=n+12
 assets.append({'sourceSha256':h,'sourceBytes':len(b),'idatSha256':hashlib.sha256(idat).hexdigest(),'idatBytes':len(idat),**inspect(idat)})
report={'date':'2026-10-14','status':'Research preparation: original Huffman symbol codes and extra bits rewritten with unchanged block headers/padding; exact original compressed bits verified. No compression trial or production adoption.','snapshotSha256':hashlib.sha256(s).hexdigest(),'assets':assets,'limits':['Parsing checks compressed stream structure and exact inflated predictor bytes only, not scientific calibration or visible colour.','Source IDAT/chunks and native bytes remain unchanged. No image unfiltering, editing, resampling or re-encoding.','Exact compressed-bit reconstruction verified in Python only. No token-packing size, headroom savings, bundled JavaScript/browser decoder or production integration claim. Original block headers and padding retained unchanged.']}
pathlib.Path('data/research-sources/standalone-png-deflate-reconstruction-preparation-2026-10-14.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'assets':len(assets),'blocks':sum(len(x['blocks']) for x in assets),'inflatedEquality':all(x['exactInflatedByteEquality'] for x in assets)}))
