from pathlib import Path
import csv,hashlib,json,xml.etree.ElementTree as ET
p=Path('data/research-sources'); tab=p/'elara-nh-seq_lorri_jupiter.tab'; lab=p/'elara-nh-seq_lorri_jupiter.lblx'
b=tab.read_bytes(); x=ET.fromstring(lab.read_bytes());ns={'p':'http://pds.nasa.gov/pds4/pds/v1'}
t=x.find('.//p:Table_Character',ns);n=int(t.findtext('p:records',namespaces=ns));length=int(t.findtext('.//p:record_length',namespaces=ns))
assert len(b)==n*length
fields=[(f.findtext('p:name',namespaces=ns),int(f.findtext('p:field_location',namespaces=ns))-1,int(f.findtext('p:field_length',namespaces=ns))) for f in t.findall('.//p:Field_Character',ns)]
rows=[]; csv_differences=[]
for i in range(n):
 r=b[i*length:(i+1)*length];assert r.endswith(b'\r\n')
 fixed={name:r[start:start+size].decode('ascii').strip() for name,start,size in fields}
 parsed=next(csv.reader([r.decode('ascii')]))
 if list(fixed.values())!=[v.strip() for v in parsed]:csv_differences.append({'oneBasedRow':i+1,'fixedWidth':fixed,'csvFields':[v.strip() for v in parsed]})
 rows.append(fixed)
selected=[{'oneBasedRow':i+1,**r} for i,r in enumerate(rows) if 'ELARA' in r['DESCR']]
result={'status':'read-only preparation','sources':[{'path':str(q),'bytes':len(q.read_bytes()),'sha256':hashlib.sha256(q.read_bytes()).hexdigest()} for q in (tab,lab)],'declaredRecords':n,'declaredRecordBytes':length,'allFixedWidthFieldsEqualCsvFields':not csv_differences,'csvInterpretationDifferences':csv_differences,'allRecordsCRLF':True,'elaraPlanningRows':selected,'limits':['Embedded unescaped quotation marks cause generic CSV interpretation differences; declared fixed-width fields retained unchanged, no source repair.','Sequence list explicitly unvalidated against actual spacecraft activity; rows do not guarantee observations.','No independent product/target/pointing identification, UTC conversion, calibration, reconstruction or production change.','Header text dated 2004 Apr 10 cites Table12 and specification April12,2004; chronology discrepancy retained without inferred software version.']}
(p/'elara-sequence-layout-recheck-preparation-2026-10-19.json').write_text(json.dumps(result,indent=2)+'\n'); print(json.dumps({k:v for k,v in result.items() if k not in ('sources','limits')},indent=2))
