import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {loadCraftModel,disposeModel} from '../views/system/models.js';
// Small, independently rotatable model inspection in surface-site cards.
export function modelPreview(id){
 const host=document.createElement('div');host.style.cssText='height:260px;position:relative';
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setSize(320,260);renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.domElement.style.cssText='width:100%;height:100%;touch-action:none';host.append(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,320/260,.01,100);camera.position.set(2,1.6,3);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;
 scene.add(new THREE.HemisphereLight(0xffffff,0x555577,3));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(3,5,4);scene.add(light);
 const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(room).texture;scene.environment=environment;room.dispose();pmrem.dispose();
 let object=null,started=false,closed=false;
 loadCraftModel(id).then(m=>{if(closed){if(m)disposeModel(m);return;}object=m;if(m)scene.add(m);}).catch(()=>{host.textContent='Model unavailable';});
 function frame(){if(closed)return;if(host.isConnected)started=true;else if(started){closed=true;controls.dispose();if(object)disposeModel(object);environment.dispose();renderer.dispose();return;}controls.update();const w=host.clientWidth||320;if(renderer.domElement.width!==w*renderer.getPixelRatio()){renderer.setSize(w,260,false);camera.aspect=w/260;camera.updateProjectionMatrix();}renderer.render(scene,camera);requestAnimationFrame(frame);}requestAnimationFrame(frame);
 return host;
}
export function siteModelId(site){
 const id=site.id;
 if(id.startsWith('curiosity'))return 'curiosity';if(id.startsWith('perseverance'))return 'perseverance';
 if(id.startsWith('spirit'))return 'spirit';if(id.startsWith('opportunity'))return 'opportunity';
 if(id==='pathfinder')return 'sojourner';if(id.startsWith('lunokhod1'))return 'lunokhod-1';if(id.startsWith('lunokhod2'))return 'lunokhod-2';if(id.startsWith('zhurong'))return 'zhurong';return null;
}
