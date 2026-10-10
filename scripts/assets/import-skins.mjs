import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
const root = new URL('../../', import.meta.url);
const dir = process.argv[2];
if (!dir) throw new Error('Supply the directory containing the generated PNG masters.');
const specs = [
 ['exoLava','3955b222','Lava world','>1000 K','Silicate/iron rock; charcoal basalt crust, orange fissures; no atmosphere or water assumed.'],
 ['exoHotRock','16a34a62','Hot rocky','400–1000 K','Dry silicate rock; grey, taupe and ochre iron oxides; craters; no atmosphere or water assumed.'],
 ['exoTemperate','fca60c18','Temperate rocky','180–400 K','Dry weathered rock and canyons; grey/tan; no oceans, life or atmosphere assumed.'],
 ['exoIce','a8c871bf','Icy rocky','<180 K','Hypothetical water ice over rock; white/blue-grey cracked ice; no liquid water or methane assumed.'],
 ['exoSubNeptune','4ae2544c','Sub-Neptune','Radius 1.6–4 Earth radii','Hypothetical H/He envelope with haze, blue-grey/cream/lavender soft cloud bands; no solid surface. Hot subclass uses a warm tint.'],
 ['exoHotJupiter','9cd5add0','Hot Jupiter','>1000 K','H/He envelope; hypothetical iron/silicate condensates; copper, ash and cream jets. No solid surface.'],
 ['exoGasGiant','721014dc','Gas giant','150–1000 K','H/He envelope; hypothetical ivory, taupe, ochre and blue-grey bands and storms. Cloud chemistry unmeasured.'],
 ['exoColdGiant','6d89deca','Cold gas giant','<150 K','H/He envelope; possible ammonia condensate upper clouds and deeper water clouds; pale ivory, grey gold and blue-grey bands.']
];
await fs.mkdir(new URL('public/textures/', root), {recursive:true});
const files=await fs.readdir(dir), assets={};
for (const [key,prefix,label,temperature,composition] of specs) {
 const name=files.find(f=>f.startsWith(`exec-${prefix}`)); if(!name)throw new Error(`Missing ${key}`);
 const source=await fs.readFile(path.join(dir,name));
 const master=await sharp(source).resize(2048,1024).jpeg({quality:85}).toBuffer();
 const preview=await sharp(source).resize(512,256).jpeg({quality:80}).toBuffer();
 const url=`/textures/${key}.jpg`,previewUrl=`/textures/${key}-preview.jpg`;
 await fs.writeFile(new URL(`public${url}`,root),master);await fs.writeFile(new URL(`public${previewUrl}`,root),preview);
 assets[key]={url,previewUrl,label,tier:'imagined',credit:'Fidelity / OpenAI image generation · IMAGINED class illustration',source:'Generated for Fidelity using OpenAI image generation',sourceFile:name,sourceSha256:createHash('sha256').update(source).digest('hex'),sha256:createHash('sha256').update(master).digest('hex'),bytes:master.length,previewBytes:preview.length,generated:'2026-10-10',observationDate:null,temperature,composition,reference:'https://science.nasa.gov/exoplanets/planet-types/',terms:'Generated asset; not an observational image. Source PNG retained in the Codex generated-images archive.',projection:'2:1 equirectangular, north up; east-positive artistic longitude, left edge −180°. No measured IAU frame.',texLon0:-180,coverage:'Full artistic globe; all features imagined. No observed coverage.',processing:'Resized to 2048×1024 JPEG master and 512×256 JPEG preview. Requested uniform albedo and continuous edges; seam continuity remains an artistic approximation.',prompt:'Flat rectangular equirectangular albedo map; north up; matching longitude edges; no directional lighting, terminator, text, stars or sphere rendering. '+composition};
 console.log(`${key}: ${master.length} bytes; preview ${preview.length}`);
}
await fs.writeFile(new URL('src/data/skins.js',root),'// Generated class illustrations. Never observational maps.\nexport const SKINS = '+JSON.stringify(assets,null,2)+';\n');
