"""Read-only fixed-byte and CSV crosscheck of the retained original PDS3 index."""
import collections
import csv
import hashlib
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[2]
label = root / 'data/research-sources/pasiphae-lorri-index-label-2026-10-19.txt'
table = root / 'data/research-sources/pasiphae-lorri-index-table-2026-10-19.txt'
text = label.read_text()
columns = []
for block in re.findall(r'OBJECT\s*=\s*COLUMN\b(.*?)END_OBJECT\s*=\s*COLUMN', text, re.S):
    columns.append({key: re.search(r'^\s*'+key+r'\s*=\s*([^\r\n]+)', block, re.M).group(1).strip().strip('"') for key in ['NAME','START_BYTE','BYTES']})
raw = table.read_bytes()
records = raw.splitlines(keepends=True)
assert len(columns) == 16 and len(records) == 1118
assert all(len(line) == 400 and line.endswith(b'\r\n') for line in records)
rows = []
for line in records:
    row = {c['NAME']: line[int(c['START_BYTE'])-1:int(c['START_BYTE'])-1+int(c['BYTES'])].decode('ascii').strip() for c in columns}
    assert [row[c['NAME']] for c in columns] == [x.strip() for x in next(csv.reader([line.decode('ascii')]))]
    rows.append(row)
counts = dict(collections.Counter(row['TARGET_NAME'] for row in rows))
assert sum(counts.values()) == 1118
result = {
    'sourceTableSha256': hashlib.sha256(raw).hexdigest(),
    'sourceTableBytes': len(raw), 'records': len(records), 'bytesPerRecordIncludingCrLf': 400,
    'columns': columns, 'fixedByteAndCsvEveryFieldEqual': True,
    'targetNameCounts': counts,
    'exactPasiphaeAliasRows': {alias: sum(row['TARGET_NAME'].upper() == alias for row in rows) for alias in ['PASIPHAE','J8 PASIPHAE']},
    'caseInsensitivePasiphaeSubstringRows': sum('PASIPHAE' in row['TARGET_NAME'].upper() for row in rows),
    'uniqueProductIds': len({row['PRODUCT_ID'] for row in rows}),
    'uniqueLabelPaths': len({row['PATH_NAME']+row['FILE_NAME'] for row in rows}),
    'rowProductCreationCounts': dict(collections.Counter(row['PRODUCT_CREATION_TIME'] for row in rows)),
    'aggregateEarliestStart': min(row['START_TIME'] for row in rows),
    'aggregateLatestStop': max(row['STOP_TIME'] for row in rows),
    'limits': 'Bounded index-field result only, not absence of Pasiphae in every image footprint, all LORRI products, other instruments/archives or the sky. No FITS fetched or pixels/PSF/pointing/calibration/target registration inspected. No Pasiphae acquisition or native image licence inferred.'
}
assert result['caseInsensitivePasiphaeSubstringRows'] == 0
out = root / 'data/research-sources/pasiphae-lorri-index-crosscheck-2026-10-19.json'
out.write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps(result))
