"""Read-only reproduction of the archived DRACO byte checks; run from repository root."""
import hashlib
import json
from pathlib import Path
import struct
import xml.etree.ElementTree as ET

record = json.loads(Path('docs/research/dimorphos-draco-backplane-assessment-2026-10-17.json').read_text())
for source in record['sources']:
    raw = Path(source['path']).read_bytes()
    assert len(raw) == source['bytes']
    assert hashlib.sha256(raw).hexdigest() == source['sha256']
geo = Path(record['sources'][1]['path']).read_bytes()
iof = Path(record['sources'][2]['path']).read_bytes()
label = ET.parse(record['sources'][0]['path'])
arrays = [e for e in label.iter() if e.tag.rsplit('}', 1)[-1] == 'Array_2D_Image']
assert len(arrays) == 16
for index, (array, plane) in enumerate(zip(arrays, record['planes'])):
    fields = {e.tag.rsplit('}', 1)[-1]: (e.text or '').strip() for e in array if len(e) == 0}
    offset = int(fields['offset'])
    assert offset == 23040 + index * 4194304 == plane['offset']
    raw = geo[offset:offset + 4194304]
    assert hashlib.sha256(raw).hexdigest() == plane['sha256']
    values = struct.iter_unpack('>f', raw)
    count = sum(v == -1e10 for (v,) in values)
    assert count == plane['exactFloat32SentinelCounts']['-10000000000.0']
assert geo[23040:4217344] == iof[23040:4217344]
assert len(geo) == 67132800 and len(geo) % 2880 == 0
assert not any(geo[67131904:])
print('Six source hashes, sixteen array payloads, fill counts, I/F equality and padding verified.')
