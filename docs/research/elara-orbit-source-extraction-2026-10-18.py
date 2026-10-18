from html.parser import HTMLParser
from pathlib import Path
import json,hashlib
class Rows(HTMLParser):
 def __init__(self):super().__init__();self.rows=[];self.row=None;self.cell=None
 def handle_starttag(self,t,a):
  if t=='tr':self.row=[]
  if t in ('td','th') and self.row is not None:self.cell=''
 def handle_data(self,s):
  if self.cell is not None:self.cell+=s
 def handle_endtag(self,t):
  if t in ('td','th') and self.cell is not None:self.row.append(' '.join(self.cell.split()));self.cell=None
  if t=='tr' and self.row is not None:self.rows.append(self.row);self.row=None
out={}
for kind in ['physical','elements']:
 p=Path('data/research-sources/elara-'+kind+'-2026-10-18.html');b=p.read_bytes();parser=Rows();parser.feed(b.decode());matches=[row for row in parser.rows if 'Elara' in row];out[kind]={'source':{'path':str(p),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'url':'https://ssd.jpl.nasa.gov/sats/'+('phys_par/' if kind=='physical' else 'elem/')},'elaraRows':matches,'parsedRowCount':len(parser.rows)}
assert not out['physical']['elaraRows'];assert len(out['elements']['elaraRows'])==1
Path('data/research-sources/elara-orbit-source-extraction-2026-10-18.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out))
