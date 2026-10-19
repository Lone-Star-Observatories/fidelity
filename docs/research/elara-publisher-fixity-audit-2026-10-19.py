"""Read-only reproduction of the retained current publisher checksum crosswalk."""
from pathlib import Path
import hashlib
import json

manifest = json.loads(Path('docs/research/elara-publisher-fixity-assessment-2026-10-19.json').read_text())
count = 0
for group in manifest['sources']:
    source = group['source']
    original = Path(source['path']).read_bytes()
    assert len(original) == source['bytes']
    assert hashlib.sha256(original).hexdigest() == source['sha256']
    rows = original.decode().splitlines()
    for check in group['checks']:
        data = Path(check['path']).read_bytes()
        filename = Path(check['path']).name
        # Retained local names have a provenance prefix; use the exact publisher path.
        publisher_name = check['publisherRow'].split()[-1]
        matches = [row for row in rows if row.split()[-1] == publisher_name]
        assert matches == [check['publisherRow']], publisher_name
        assert hashlib.md5(data).hexdigest() == check['localMd5'] == matches[0].split()[0]
        assert hashlib.sha256(data).hexdigest() == check['sha256']
        assert len(data) == check['bytes']
        count += 1
assert count == manifest['counts']['files'] == 18
print(json.dumps({'publisherRowsUniqueAndMatching': count, 'sources': len(manifest['sources'])}))
