import type { Manifold, ManifoldToplevel } from "manifold-3d";
import type { Keeper } from "./profile-sweep";
import type { LightboxParameters, Part } from "./types";
import { snapTabsPerFace } from "./lightbox";

/** Pestañas integradas en el faldón, con raíz redondeada, rampa de entrada
 * y uñero exterior. Coordenadas de la cara A; la B se refleja al ensamblar. */
export function createSnapRim(w: ManifoldToplevel, keep: Keeper, source: Manifold, p: LightboxParameters) {
  const {Manifold:M,CrossSection:CS}=w;
  const R=p.diameter/2,H=p.depth,inner=R+p.rimClearance,outer=inner+p.rimSkirtThickness;
  const end=H-p.rimOverlap,root=H-2,hookTop=end+5;
  const angles=Array.from({length:snapTabsPerFace(p)},(_,i)=>(i+.5)*360/snapTabsPerFace(p));
  const box=(x:number,y:number,z:number,dx:number,dy:number,dz:number)=>keep(keep(M.cube([dx,dy,dz])).translate([x,y,z]));
  const turn=(m:Manifold,angle:number)=>keep(m.rotate([0,0,angle]));
  const circle=(r:number)=>keep(CS.circle(r,192));
  const ring=(a:number,b:number,z:number,h:number)=>keep(keep(keep(circle(a).subtract(circle(b))).extrude(h)).translate([0,0,z]));
  let rim=source;
  for(const angle of angles){
    // Aligerar sólo la lengüeta; el resto del faldón conserva su espesor.
    const thin=keep(ring(outer+2,inner+p.snapThickness,end-1,root-end+1).intersect(
      box(R-2,-p.snapWidth/2-1,end-1,p.rimSkirtThickness+p.rimClearance+6,p.snapWidth+2,root-end+1),
    ));
    rim=keep(rim.subtract(turn(thin,angle)));
    for(const sign of [-1,1]){
      const y=sign*(p.snapWidth/2+.5);
      const slot=box(R-2,y-.5,end-1,outer-R+5,1,root-end+1);
      const round=keep(keep(keep(M.cylinder(outer-R+5,.5,.5,24)).rotate([0,90,0])).translate([R-2,y,root]));
      rim=keep(rim.subtract(turn(keep(slot.add(round)),angle)));
    }
    // Sección XZ extruida tangencialmente: entrada inclinada y hombro
    // de retención recto. La ranura deja holgura radial y axial en reposo.
    const cross=keep(new CS([[
      [inner+.6,end+1],[R-p.snapEngagement,end+4],
      [R-p.snapEngagement,hookTop],[inner+.6,hookTop],
    ]],"EvenOdd"));
    const hook=keep(keep(keep(cross.extrude(p.snapWidth)).rotate([90,0,0])).translate([0,p.snapWidth/2,0]));
    const lip=box(inner+p.snapThickness-.3,-p.snapWidth/2,end,p.rimSkirtThickness-p.snapThickness+1.3,p.snapWidth,1.5);
    rim=keep(rim.add(turn(keep(hook.add(lip)),angle)));
  }
  const groove=ring(R+1,R-p.snapEngagement-.25,end+.65,4.7);
  const tabs:NonNullable<Part["snapTabs"]>={
    angles,width:p.snapWidth,rootZ:root+.5,hookTop,depth:H,side:1,release:p.snapEngagement+.25,
  };
  return {rim,groove,tabs};
}

export const snapReleaseProgress=(progress:number)=>Math.max(0,Math.min(1,(progress-20)/20));

/** Flexión esquemática exclusiva de la vista de montaje. No es un cálculo
 * de esfuerzos; los STL siempre usan la geometría original sin deformar. */
export function releasedSnapPositions(part: Pick<Part,"positions"|"snapTabs">, progress:number): Float32Array {
  const tabs=part.snapTabs,amount=snapReleaseProgress(progress);
  if(!tabs||!amount)return part.positions;
  const positions=part.positions.slice();
  const angles=tabs.angles.map(a=>a*Math.PI/180);
  for(let i=0;i<positions.length;i+=3){
    const x=positions[i],y=positions[i+1]*tabs.side;
    const z=tabs.side===1?positions[i+2]:tabs.depth-positions[i+2];
    if(z>=tabs.rootZ)continue;
    const angle=angles.find(a=>x*Math.cos(a)+y*Math.sin(a)>0&&Math.abs(-x*Math.sin(a)+y*Math.cos(a))<=tabs.width/2+.002);
    if(angle===undefined)continue;
    const t=Math.max(0,Math.min(1,(tabs.rootZ-z)/(tabs.rootZ-tabs.hookTop)));
    const displacement=amount*tabs.release*t*t*(3-2*t);
    positions[i]+=Math.cos(angle)*displacement;
    positions[i+1]+=Math.sin(angle)*displacement*tabs.side;
  }
  return positions;
}
