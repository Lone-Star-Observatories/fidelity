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
for(const b of [{name:'Dysnomia',parent:'eris'},{name:"Hi'iaka",parent:'haumea'},{name:'Namaka',parent:'haumea'},{name:'S/2015 (136472) 1',parent:'makemake'}])if(!entries.has(`sol-${key(b.name)}`))entries.set(`sol-${key(b.name)}`,{id:`sol-${key(b.name)}`,...b,kind:'moon',scope:'Dwarf-planet satellite; individual source verification queued',nativeImagery:'unchecked'});
// Gonggong's satellite is outside the planetary/Pluto inventory; keep it separate from its primary dossier.
entries.set('sol-xiangliu',{id:'sol-xiangliu',name:'Xiangliu',parent:'gonggong',kind:'moon',scope:'Satellite of dwarf-planet candidate Gonggong; individual physical/reference audit open',source:'https://arxiv.org/abs/2108.08553v1',nativeImagery:'Unresolved Hubble Gonggong/Xiangliu pair retained in primary dossier; no independent globe or calibrated satellite geography. Native raw-product/point crosswalk remains open.'});
for(const p of planets.rows)entries.set(`exo-${key(p.pl_name)}`,{id:`exo-${key(p.pl_name)}`,name:p.pl_name,parent:p.hostname,kind:'exoplanet',distancePc:p.sy_dist,scope:'20 closest NASA archive planets',source:planets.source,nativeImagery:'unchecked; distinguish direct image of point source from resolved surface',archiveConstraints:p});
for(const s of stars.rows)entries.set(`star-${key(s.OBJ_NAME)}`,{id:`star-${key(s.OBJ_NAME)}`,name:s.COMMON_NAME||s.OBJ_NAME,catalogueName:s.OBJ_NAME,kind:s.OBJ_CAT==='WD'?'white dwarf':'star',distancePc:s.distancePc,scope:'20 nearest stellar components in Gaia-era 10 pc v2 snapshot; current ranking verification queued',source:stars.source,nativeImagery:'unchecked; point-source photograph does not resolve photosphere',catalogueConstraints:s});
for(const entry of entries.values()) {
 const visual=bodyVisualFor(entry);
 entry.research=visual?'initial dossier delivered; refinement open':'queued';
 const mapPending=[...MOONS,...SMALL_BODIES].find(body=>body.id===entry.bodyId)?.surfacePending;
 entry.surface=visual?.surfaceMap?'bespoke hypothetical map delivered':visual?.surfaceImage?(mapPending?'independent hypothetical terrain delivered; resolved globe remains pending':'native globe preserved; bespoke terrain detail delivered'):'native imagery assessment, then bespoke if missing';
 entry.sky=visual?.skyImage?'hypothetical image delivered; photometric calibration remains approximate':'queued';
 if(visual)entry.visualId=visual.id;
 if(visual?.statusNote)entry.discoveryStatus=visual.statusNote;
 if(visual?.contextImages?.some(asset=>asset.tier==='measured'))entry.nativeImagery=visual.nativeSurface;
}
const xiangliuEntry=entries.get('sol-xiangliu');
if(xiangliuEntry && !xiangliuEntry.visualId) xiangliuEntry.research='primary tidal initial-condition/size/spin preparation saved; individual dossier pending (xiangliu-tidal-initial-condition-assessment-2026-10-17.json)';
for(const name of ['phobos','deimos']) { const entry=entries.get(`sol-${name}`); if(!entry.visualId) { entry.research='native research preparation saved; individual dossier pending (phobos-deimos-native-preparation-2026-10-10.json)'; entry.nativeImagery='own-body NASA mosaic preserved; HiRISE native context downloaded with hashes, colour/coverage/registration audit pending'; if(name==='deimos') entry.nativeImagery+='; newer2025Hera AFC/TIRI source PNGs retained, terms and embedding audit in deimos-hera-native-assessment-2026-10-10.json'; } }
const ganymedeEntry=entries.get('sol-ganymede');
const arielEntry=entries.get('sol-ariel');
if(arielEntry && !arielEntry.visualId) {
 arielEntry.research='native provenance and2024full/2026abstract spectroscopy preparation saved; individual dossier pending (ariel-moon-preparation-2026-10-11.json)';
 arielEntry.nativeImagery='Own NASA3D globe source-byte-equal; original Voyager PIA00041 colour composite/PIA01534 clear-filter mosaic retained with full NASA/JPL credits, observation1986-01-24 and separate publication dates/hashes. Black north/coverage gaps not terrain; colour/frame/epochs/shape registration remain open. Recent disk-integrated spectroscopy is not resolved geography; substantial lossless headroom needed before embedding';
}
const callistoEntry=entries.get('sol-callisto');
if(callistoEntry && !callistoEntry.visualId) callistoEntry.nativeImagery='Own NASA3D globe byte-equal to fetched source; native Galileo PIA03455 JPEG retained unchanged, observation2001-05-25 verified in contemporary JPL newsletter, full NASA/JPL/ASU/Academic Research Lab credit supported; mono panels/strip gaps/locator annotations not seamless colour geography. Recent/product-frame audit and headroom remain open (callisto-moon-preparation-2026-10-10.json); no initial dossier yet';
if(ganymedeEntry && !ganymedeEntry.visualId) ganymedeEntry.nativeImagery='Own NASA3D globe byte-equal to fetched source; JunoCam PIA24681 and JIRAM PIA26075 retained with source hashes; preliminary seams, spectral processing, historical mosaic epochs and final-product audit remain open (ganymede-moon-preparation-2026-10-10.json); no initial dossier yet';
const out={updated:'2026-10-10',scope:'All Solar System catalogue bodies, all recognized planetary/Pluto moons from JPL, dwarf-planet satellites, 20 closest confirmed archive exoplanets, and 20 stellar components from the Gaia-era nearby snapshot. Individual material/atmosphere assumptions must be explicit. Do not invent solid surfaces for stars or gas giants.',inventoryWorkRemaining:['Refresh nearest stellar ranking from current astrometry before claiming an exhaustive present-day boundary.','Audit Gl 725 B c archive distance 6.842357 pc against the 2026 discovery-paper distance about 3.5 pc; confirmed archive ranking is not a corrected physical-distance ranking.', 'Inventory remaining satellites of asteroids and other minor planets separately.','Add further recognized dwarf planets if the IAU roster changes; candidates remain marked candidates.'],selection:{planets:planets.selection,stars:stars.selection},entries:[...entries.values()]};
out.inventoryWorkRemaining.push('Reconcile EZ Aquarii B/C LM? catalogue labels with published stellar dynamical masses; both were omitted by exact-category filtering. Historical boundary and present-day astrometry remain open (nearest-stars-audit-2026-10-10.json).');
out.inventoryWorkRemaining.push('Gl725B distance audit: direct GaiaDR3 inverse parallax3.523139pc and matching TICv8 record3.52247pc contradict archive6.842357pc; archive association cause and exhaustive boundary remain open (nearest-boundary-reconciliation-2026-10-10.json).');
out.selectionProgress = Object.fromEntries(['exoplanet', 'star', 'white dwarf', 'moon'].map(kind => {
 const selected = out.entries.filter(entry => entry.kind === kind);
 return [kind, { selected: selected.length, initialDossiers: selected.filter(entry => entry.visualId).length,
  limits: 'Initial dossier delivery does not establish calibrated raster colour, registered geography or independently confirmed archive membership.' }];
}));
await fs.writeFile(new URL('docs/research/bespoke-queue.json',root),JSON.stringify(out,null,2)+'\n');
console.log(out.entries.length,'body tasks;',Object.keys(BODY_VISUALS).length,'initial dossiers delivered');
