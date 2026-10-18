"""Read-only original calibration storage recheck. Run from repository root."""
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET
import numpy as np

root = Path('data/research-sources')
assessment = json.loads(Path('docs/research/elara-calibration-reference-assessment-2026-10-18.json').read_text())
checkpoint = {'references': assessment['originalReferences'], 'limits': assessment['limits']}
results = []
for ref in checkpoint['references']:
    raw = Path(ref['path']).read_bytes()
    label = Path(ref['labelPath']).read_bytes()
    assert len(raw) == ref['bytes']
    assert hashlib.sha256(raw).hexdigest() == ref['sha256']
    assert hashlib.md5(raw).hexdigest() == ref['publisherMD5']
    assert hashlib.sha256(label).hexdigest() == ref['labelSHA256']
    tree = ET.fromstring(label)
    leaves = {node.tag.split('}')[-1]: node.text.strip() for node in tree.iter() if not list(node) and node.text and node.text.strip()}
    assert leaves['logical_identifier'] == ref['logicalIdentifier']
    assert leaves['version_id'] == ref['versionId']
    cards = []
    for pos in range(0, len(raw), 80):
        card = raw[pos:pos + 80].decode('ascii')
        cards.append(card)
        if card[:8].strip() == 'END':
            break
    else:
        raise AssertionError('Missing FITS END')
    fields = {card[:8].strip(): card[10:].split('/')[0].strip() for card in cards if card[8:10] == '= '}
    offset = ((len(cards) * 80 + 2879) // 2880) * 2880
    assert int(fields['NAXIS']) == 2
    shape = [int(fields['NAXIS2']), int(fields['NAXIS1'])]
    assert shape == [1024, 1024]
    ns = {'p': tree.tag.split('}')[0][1:]}
    area = tree.find('p:File_Area_Ancillary', ns)
    arr_label = area.find('p:Array_2D', ns)
    label_offset = int(arr_label.find('p:offset', ns).text)
    assert label_offset == offset
    axes = sorted(arr_label.findall('p:Axis_Array', ns), key=lambda axis: int(axis.find('p:sequence_number', ns).text))
    label_shape = [int(axis.find('p:elements', ns).text) for axis in axes]
    assert label_shape == shape
    assert arr_label.find('p:axis_index_order', ns).text == 'Last Index Fastest'
    label_type = arr_label.find('p:Element_Array/p:data_type', ns).text
    assert label_type == ('UnsignedByte' if int(fields['BITPIX']) == 8 else 'IEEE754MSBDouble')
    assert int(area.find('p:File/p:file_size', ns).text) == len(raw)
    assert area.find('p:File/p:md5_checksum', ns).text == hashlib.md5(raw).hexdigest()
    bitpix = int(fields['BITPIX'])
    dtype = {8: np.dtype('u1'), -64: np.dtype('>f8')}[bitpix]
    array = np.frombuffer(raw, dtype=dtype, count=1048576, offset=offset).reshape(shape)
    assert np.isfinite(array).all()
    row = dict(name=ref['name'], sha256=ref['sha256'], dataOffset=offset, bitpix=bitpix, shape=shape, pds4OffsetShapeTypeAndChecksumMatch=True, pds4DataType=label_type, finiteSamples=int(array.size), minimum=float(array.min()), maximum=float(array.max()), exactZeroSamples=int(np.count_nonzero(array == 0)), trailingBytes=len(raw) - offset - array.nbytes)
    if 'synthetic' in ref['name']:
        assert np.count_nonzero(array) == 0
    if ref['name'] == 'dsmear_ematrix_1024':
        rr, cc = np.indices(shape)
        assert np.all(array[rr == cc] == 1)
        assert np.all(array[rr < cc] == 1.044)
        assert np.all(array[rr > cc] == .956)
        row['storedTriangleCounts'] = {'diagonal': int(np.count_nonzero(rr == cc)), 'rowLessThanColumn': int(np.count_nonzero(rr < cc)), 'rowGreaterThanColumn': int(np.count_nonzero(rr > cc))}
    results.append(row)
output = {'status': 'Read-only checksum and stored-array recheck passed for all five original calibration references.', 'references': results, 'limits': checkpoint['limits'], 'productionChanges': False, 'pipelineApplied': False}
out = root / 'elara-calibration-storage-recheck-preparation-2026-10-18.json'
out.write_text(json.dumps(output, indent=2) + '\n')
print(json.dumps({'referencesVerified': len(results), 'originalBytesVerified': sum(ref['bytes'] for ref in checkpoint['references']), 'output': str(out)}))
