import fs from 'node:fs/promises';
import { SUN, PLANETS } from '../../src/data/sol.js';
import { MOONS, SMALL_BODIES } from '../../src/data/moons.js';
import { BODY_VISUALS, bodyVisualFor } from '../../src/data/bespoke.js';
const root=new URL('../../',import.meta.url),read=async name=>JSON.parse(await fs.readFile(new URL(`docs/research/${name}.json`,root),'utf8'));
const moonInventory=await read('solar-moons'),planets=await read('nearest-exoplanets'),stars=await read('nearest-stars');
const entries=new Map(),key=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
for(const b of [SUN,...PLANETS,...MOONS,...SMALL_BODIES])entries.set(`sol-${key(b.name)}`,{id:`sol-${key(b.name)}`,bodyId:b.id,name:b.name,parent:b.parent??null,kind:b.kind??'moon',scope:'Solar System catalogue',nativeImagery:b.surfacePending?'no local native map; research native imagery':'existing texture requires provenance/coverage review'});
for(const b of moonInventory.rows){const id=`sol-${key(b.name)}`;if(!entries.has(id))entries.set(id,{id,name:b.name,parent:b.parent,kind:'moon',scope:'IAU-recognized planetary/Pluto satellite',discoveryYear:b.discoveryYear,discoveryReferences:b.discoveryReferences,source:moonInventory.source,nativeImagery:'unchecked'});}
// Satellites of minor planets are not covered by the planetary satellite table.
for(const b of [{name:'Dysnomia',parent:'eris'},{name:"Hi'iaka",parent:'haumea'},{name:'Namaka',parent:'haumea'},{name:'S/2015 (136472) 1',parent:'makemake'}])entries.set(`sol-${key(b.name)}`,{id:`sol-${key(b.name)}`,...b,kind:'moon',scope:'Dwarf-planet satellite; individual source verification queued',nativeImagery:'unchecked'});
for(const p of planets.rows)entries.set(`exo-${key(p.pl_name)}`,{id:`exo-${key(p.pl_name)}`,name:p.pl_name,parent:p.hostname,kind:'exoplanet',distancePc:p.sy_dist,scope:'20 closest NASA archive planets',source:planets.source,nativeImagery:'unchecked; distinguish direct image of point source from resolved surface',archiveConstraints:p});
for(const s of stars.rows)entries.set(`star-${key(s.OBJ_NAME)}`,{id:`star-${key(s.OBJ_NAME)}`,name:s.COMMON_NAME||s.OBJ_NAME,catalogueName:s.OBJ_NAME,kind:s.OBJ_CAT==='WD'?'white dwarf':'star',distancePc:s.distancePc,scope:'20 nearest stellar components in Gaia-era 10 pc v2 snapshot; current ranking verification queued',source:stars.source,nativeImagery:'unchecked; point-source photograph does not resolve photosphere',catalogueConstraints:s});
for(const entry of entries.values()) {
 const visual=bodyVisualFor(entry);
 entry.research=visual?'initial dossier delivered; refinement open':'queued';
 entry.surface=visual?.surfaceMap?'bespoke hypothetical map delivered':visual?.surfaceImage?'native globe preserved; bespoke terrain detail delivered':'native imagery assessment, then bespoke if missing';
 entry.sky=visual?.skyImage?'hypothetical image delivered; photometric calibration remains approximate':'queued';
 if(visual)entry.visualId=visual.id;
 if(visual?.statusNote)entry.discoveryStatus=visual.statusNote;
}
const out={updated:'2026-10-10',scope:'All Solar System catalogue bodies, all recognized planetary/Pluto moons from JPL, dwarf-planet satellites, 20 closest confirmed archive exoplanets, and 20 stellar components from the Gaia-era nearby snapshot. Individual material/atmosphere assumptions must be explicit. Do not invent solid surfaces for stars or gas giants.',inventoryWorkRemaining:['Refresh nearest stellar ranking from current astrometry before claiming an exhaustive present-day boundary.','Audit Gl 725 B c archive distance 6.842357 pc against the 2026 discovery-paper distance about 3.5 pc; confirmed archive ranking is not a corrected physical-distance ranking.', 'Inventory remaining satellites of asteroids and other minor planets separately.','Add further recognized dwarf planets if the IAU roster changes; candidates remain marked candidates.'],selection:{planets:planets.selection,stars:stars.selection},entries:[...entries.values()]};
await fs.writeFile(new URL('docs/research/bespoke-queue.json',root),JSON.stringify(out,null,2)+'\n');
console.log(out.entries.length,'body tasks;',Object.keys(BODY_VISUALS).length,'initial dossiers delivered');
