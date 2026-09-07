import Module from 'manifold-3d';
import {buildModel} from '../src/core/engine';
import {newProject} from '../src/core/project';
const w=await Module();w.setup();
const p=newProject();p.mode='lightbox';
const m=buildModel(w,{project:p,mode:p.mode,shapes:[]});
console.log('model',m.parts.length,m.duration,m.lightbox);
const solids=m.parts.map(p=>new w.Manifold(new w.Mesh({numProp:3,vertProperties:p.positions,triVerts:p.indices})));
for(let i=0;i<solids.length;i++) {
 const pieces=solids[i].decompose();
 if(pieces.length!==1)console.log('ISLANDS',m.parts[i].id,pieces.map(s=>({volume:s.volume(),bounds:s.boundingBox()})));
 pieces.forEach(x=>x.delete());
 for(let j=i+1;j<solids.length;j++){
  const a=m.parts[i].bounds,b=m.parts[j].bounds;
  if([0,1,2].some(k=>a.max[k]<=b.min[k] || b.max[k]<=a.min[k]))continue;
  const hit=solids[i].intersect(solids[j]);
  if(hit.volume()>.05)console.log('COLLISION',m.parts[i].id,m.parts[j].id,hit.volume());
  hit.delete();
 }
}
solids.forEach(x=>x.delete());
