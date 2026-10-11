"""Research-only standard-library XZ/LZMA2 exact-byte screen; run accompanying mjs first."""
import hashlib,json,lzma,gzip
from pathlib import Path
raw=Path('/tmp/fidelity-lzma-screen.bin').read_bytes()
record=json.loads(Path('/tmp/fidelity-lzma-baseline.json').read_text())
record['results']=[]
for preset in (6,9 | lzma.PRESET_EXTREME):
    compressed=lzma.compress(raw,format=lzma.FORMAT_XZ,preset=preset)
    restored=lzma.decompress(compressed,format=lzma.FORMAT_XZ)
    assert restored==raw
    record['results'].append({'preset':preset,'xzBytes':len(compressed),'outerGzipBytes':len(gzip.compress(compressed,compresslevel=9,mtime=0)),'exactBinaryInverse':True,'restoredBinarySha256':hashlib.sha256(restored).hexdigest()})
record['status']='Research-only algorithm screen; no runtime decoder, production adoption, candidate full HTML or browser claim.'
record['limitations']=['XZ size excludes a prospective versioned wrapper and JavaScript decoder/notices. Existing Brotli baseline includes FIDBRT01 wrapper; this is a screen, not net HTML savings.','Complete original FIDNUM02 bytes preserved; no numeric conversion, rounding, field pruning or native asset transformation.','Python inverse verifies bytes; browser compatibility and decoder overhead unassessed.']
Path('docs/research/standalone-lzma-assessment-2026-10-11.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record))
