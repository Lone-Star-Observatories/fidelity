"""Read-only fixity and targeted text/metadata checks; visual review is recorded separately."""
from pathlib import Path
import hashlib
import json
from pypdf import PdfReader

doc = json.loads(Path('docs/research/elara-lorri-version-comparison-assessment-2026-10-19.json').read_text())
for source in doc['sources'] + [doc['manuscriptText']]:
    data = Path(source['path']).read_bytes()
    assert len(data) == source['bytes'], source['path']
    assert hashlib.sha256(data).hexdigest() == source['sha256'], source['path']
assert len(doc['authors']) == 16
metadata = doc['publisherMetadata']['citationMetadata']
assert len([x for x in metadata if x['name'] == 'citation_author']) == 16
assert next(x['content'] for x in metadata if x['name'] == 'citation_online_date') == '2007/11/09'
assert next(x['content'] for x in metadata if x['name'] == 'citation_publication_date') == '2008/10'
reader = PdfReader('data/research-sources/elara-lorri-arxiv-v1-preparation-2026-10-19.pdf')
assert len(reader.pages) == 31
assert 'Figure 9' in reader.pages[24].extract_text()
assert 'average Pluto spectrum' in reader.pages[25].extract_text()
assert '25 frames' in reader.pages[25].extract_text()
assert 'assumed-1991-2003' in Path('data/research-sources/elara-lorri-arxiv-record-preparation-2026-10-19.html').read_text()
assert 'non-exclusive license to distribute' in Path('data/research-sources/elara-lorri-arxiv-licence-response-preparation-2026-10-19.html').read_text()
assert not next(x for x in doc['sources'] if 'final-pdf-response' in x['path'])['startsPdf']
print('Source fixity, manuscript count/targeted text, metadata and exact record licence association pass; no final-paper/calibration claim.')
