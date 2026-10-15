"""Read-only stored-code audit; no calibration, repair, or image generation."""
from pathlib import Path
import collections, hashlib, json, struct
root = Path(__file__).resolve().parents[2] / 'data' / 'research-sources'
expected = {2: '50b58242c8c44291e69d10faafab1aa423f85dfe4717f92cb564757af013f9e9', 5: 'acfae3824a0bd34ecb93eb62c98f9ce51da0c8104a4f281f0ead80c9d80c2eff'}
cores = {}
records = []
for version in (2, 5):
    path = root / f'phoebe-vims-pds-v1465680977_{version}-original-2026-10-15.qub'
    raw = path.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == expected[version]
    pos = 24064
    parts = [[], [], []]
    for line in range(48):
        for band in range(352):
            parts[0].append(raw[pos:pos+96]); pos += 96
            parts[1].append(raw[pos:pos+4]); pos += 4
        parts[2].append(raw[pos:pos+784]); pos += 784
    core, side, back = map(b''.join, parts)
    assert pos == 1751296 and raw[pos:] == b' ' * 256
    # Independent offset formula, without the sequential cursor.
    independent = b''.join(raw[24064 + line*35984 + band*100:24064 + line*35984 + band*100 + 96] for line in range(48) for band in range(352))
    assert independent == core
    reconstructed = bytearray(raw[:24064])
    for line in range(48):
        for band in range(352):
            row = line*352 + band
            reconstructed.extend(core[row*96:(row+1)*96])
            reconstructed.extend(side[row*4:(row+1)*4])
        reconstructed.extend(back[line*784:(line+1)*784])
    reconstructed.extend(raw[pos:])
    assert bytes(reconstructed) == raw
    values = struct.unpack('>811008h', core)
    cores[version] = values
    counts = collections.Counter(values)
    records.append({'version': version, 'originalSha256': expected[version], 'exactRawReconstruction': True, 'independentOffsetCoreEquality': True, 'coreSha256': hashlib.sha256(core).hexdigest(), 'storedNullCodeCount': counts[-8192], 'minimumStoredCode': min(values), 'maximumStoredCode': max(values), 'sideplaneSha256': hashlib.sha256(side).hexdigest(), 'backplaneAndCornersSha256': hashlib.sha256(back).hexdigest()})
different = [(i, a, b) for i, (a, b) in enumerate(zip(cores[2], cores[5])) if a != b]
indices = collections.Counter((i//(352*48)+1, i%48+1) for i,a,b in different)
assert len(different) == 12288 and len(indices) == 48
assert all(b == -8192 for i,a,b in different)
band_counts = collections.Counter((i//48)%352+1 for i,a,b in different)
report = {'status': 'research preparation only', 'files': records, 'differentCoreCodes': len(different), 'differentLineSampleIndices': len(indices), 'allChangedCodesInVersion5EqualMinus8192': True, 'changedStoredBands': sorted(band_counts), 'changedCodeCountsPerBandHistogram': dict(collections.Counter(band_counts.values())), 'changedCodesPerLineSampleHistogram': dict(collections.Counter(indices.values())), 'limits': ['Exact storage roundtrips validate this byte partition, not science completeness, physical validity, calibrated radiance, visible colour, geographic registration, or installed ISIS executable identity.', 'Stored-code agreement with the detached missing-pixel claims does not establish the cause or scientific priority of either version.', 'No original, production asset, dossier, codec or catalogue is modified.']}
(root / 'phoebe-vims-storage-reproducer-result-preparation-2026-10-15.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps(report, indent=2))
