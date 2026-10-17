"""Read-only image-index/content diagnostics; run from repository root with Pillow/numpy."""
from pathlib import Path
import hashlib
import json
import numpy as np
from PIL import Image

root = Path('data/research-sources')
assessment = json.loads(Path('docs/research/dimorphos-browse-association-assessment-2026-10-17.json').read_text())
for source in assessment['sources']:
    data = Path(source['path']).read_bytes()
    assert len(data) == source['bytes']
    assert hashlib.sha256(data).hexdigest() == source['sha256']

native = Image.open(root / 'dimorphos-surface-native.png').convert('L')
browse = np.asarray(Image.open(root / 'dimorphos-dart_0401930049_43695_02_iof.png'))
patch = Image.fromarray(browse[135:647, 336:848])
results = []
for size in (128, 256, 512):
    for name, mode in [('nearest', Image.Resampling.NEAREST), ('bilinear', Image.Resampling.BILINEAR), ('bicubic', Image.Resampling.BICUBIC)]:
        target = np.asarray(native.resize((size, size), mode), dtype=float)
        source = np.asarray(patch.resize((size, size), mode), dtype=float)
        variants = []
        for turns in range(4):
            for reflect in (False, True):
                candidate = np.rot90(source, turns)
                if reflect:
                    candidate = np.fliplr(candidate)
                variants.append((float(np.corrcoef(candidate.ravel(), target.ravel())[0, 1]), turns, reflect))
        variants.sort(reverse=True)
        assert variants[0][1:] == (2, True)
        results.append({'grid': size, 'resampler': name, 'bestCorrelation': variants[0][0]})

raw = (root / 'dimorphos-dart_0401930049_43695_02_iof.fits').read_bytes()
values = np.frombuffer(raw, dtype='>f4', count=1024 * 1024, offset=23040).reshape(1024, 1024)
values = np.flipud(values)
mask = np.isfinite(values) & (values >= 0) & (values < np.float32(1e8)) & (values != np.float32(-1e10))
x = values[mask].astype(float)
y = browse[mask].astype(float)
decreases = int(np.count_nonzero(np.diff(y[np.argsort(x, kind='stable')]) < 0))
assert len(x) == 262144 and decreases == 0
print(json.dumps({'contentComparisons': results, 'selectedStoredSamples': len(x), 'strictDecreases': decreases, 'storedIntensityCorrelation': float(np.corrcoef(x, y)[0, 1]), 'limits': 'Content and stored-value diagnostics only; no physical scale, photometric accuracy, exact publisher lineage or geographic registration.'}, indent=2))
