"""Read-only reproduction; storage correspondence does not establish calibration."""
from pathlib import Path
import hashlib
import json
import struct
import xml.etree.ElementTree as ET

root = Path('data/research-sources')
ns = {'p': 'http://pds.nasa.gov/pds4/pds/v1'}
result = []
for stem in ['lor_0035398319_0x630_eng', 'lor_0035398320_0x630_eng']:
    path = root / f'elara-pds4-raw-{stem}.fit'
    label = root / f'elara-pds4-raw-{stem}.lblx'
    data = path.read_bytes()
    xml = ET.fromstring(label.read_bytes())
    arrays = xml.findall('.//p:File_Area_Observational/p:Array_1D', ns)
    candidates = [a for a in arrays if a.findtext('p:Axis_Array/p:elements', namespaces=ns) == '51']
    assert len(candidates) == 1
    offset = int(candidates[0].findtext('p:offset', namespaces=ns))
    original = data[offset:offset+51]
    header = {}
    for position in range(0, 31680, 80):
        card = data[position:position+80].decode('ascii')
        if card[8:10] == '= ':
            # Only numeric keys below are consumed; quoted date strings are unused.
            header[card[:8].strip()] = card[10:].split('/')[0].strip()
    values = {'MET_HK': struct.unpack_from('>I', original, 0)[0]}
    values.update({f'LVPS_{i:02}': struct.unpack_from('>H', original, 4+2*i)[0] for i in range(16)})
    values.update({f'FPU_{i}': struct.unpack_from('>H', original, 36+2*i)[0] for i in range(4)})
    values.update(EXPOSURE=struct.unpack_from('>H', original, 44)[0], CLMP2=original[46], CLMP1=original[47])
    flags = original[49]
    flag_values = {'TEMPCVRT': (flags >> 7) & 1, 'CLMP2PE': (flags >> 6) & 1,
                   'CLMP1PE': (flags >> 5) & 1, 'SOURCE': (flags >> 2) & 7,
                   'FORMAT': (flags >> 1) & 1, 'EXPMODE': flags & 1}
    for key, value in {**values, **flag_values}.items():
        assert int(header[key]) == value, (stem, key)
    result.append({'path': str(path), 'sha256': hashlib.sha256(data).hexdigest(),
                   'offset': offset, 'originalHex': original.hex(), 'scalarValues': values,
                   'msbFirstFlagValues': flag_values, 'imageMET': int(header['MET']),
                   'housekeepingMET': values['MET_HK'], 'spareBytes': [original[48], original[50]]})
assert sum(len(x['scalarValues']) for x in result) == 48
assert sum(len(x['msbFirstFlagValues']) for x in result) == 12
out = root / 'elara-housekeeping-crosswalk-recheck-preparation-2026-10-19.json'
out.write_text(json.dumps({'products': result, 'limits': [
    'Storage/header correspondence for two files only, not flight-software version validation.',
    'Uncalibrated ADC values, flags and housekeeping time tags remain distinct from physical measurements and image times.',
    'No UTC conversion, timing repair, temperature conversion, image masking, reconstruction, embedding or production change.'
]}, indent=2) + '\n')
print('48 scalar and 12 interpreted flag comparisons match original headers.')
