"""Read-only retained XML/CSV crosscheck; no network, repair or production writes."""
import csv, hashlib, io, json, pathlib, xml.etree.ElementTree as ET
root=pathlib.Path(__file__).resolve().parents[2]/'data/research-sources'
ns={'p':'http://pds.nasa.gov/pds4/pds/v1'}
def xml(name): return ET.fromstring((root/name).read_bytes())
def identification(tree):
 area=tree.find('p:Identification_Area',ns)
 return area.findtext('p:logical_identifier',namespaces=ns),area.findtext('p:version_id',namespaces=ns)
doc=xml('elara-nh-lorri-ssr-label-preparation-2026-10-19.lblx');lid,version=identification(doc)
collections=[]
for label,inventory in [('elara-lorri-collection-collection-lblx-preparation-2026-10-19.txt','elara-lorri-collection-inventory-csv-preparation-2026-10-19.txt'),('elara-ralph-collection-label-preparation-2026-10-19.lblx','elara-ralph-inventory-preparation-2026-10-19.csv')]:
 tree=xml(label);rows=list(csv.reader(io.StringIO((root/inventory).read_text())))
 assert len(rows)==int(tree.findtext('.//p:Inventory/p:records',namespaces=ns))
 assert all(len(r)==2 and r[0]=='P' for r in rows)
 assert len(set(r[1] for r in rows))==len(rows)
 collections.append({'lidvid':'::'.join(identification(tree)),'rows':len(rows),'documentMatches':[r for r in rows if r[1]==lid+'::'+version],'referencedRalphLidMatches':[r for r in rows if r[1].split('::')[0]=='urn:nasa:pds:nh_documents:ralph:lorri_ssr']})
references=[]
for stamp in ['0035398319','0035398320']:
 for name in [f'elara-pds4-raw-lor_{stamp}_0x630_eng.lblx',f'elara-pds4-lor_{stamp}_0x630_sci.lblx']:
  tree=xml(name);refs=[r.findtext('p:lid_reference',namespaces=ns) for r in tree.findall('.//p:Internal_Reference',ns) if r.findtext('p:reference_type',namespaces=ns)=='data_to_document'];matches=[r for r in refs if r and r.endswith(':lorri_ssr')]
  assert matches==['urn:nasa:pds:nh_documents:ralph:lorri_ssr']
  references.append({'path':str(root/name),'sha256':hashlib.sha256((root/name).read_bytes()).hexdigest(),'reference':matches[0],'matchesRetainedDocument':matches[0]==lid})
assert len(collections[0]['documentMatches'])==1 and not collections[1]['documentMatches']
print(json.dumps({'status':'Retained-file crosscheck only; not exhaustive registry resolution or cause diagnosis.','documentLidvid':lid+'::'+version,'collections':collections,'references':references,'productionChanges':False},indent=2))
