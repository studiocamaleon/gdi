import type { LightboxParameters } from "./types";
import { organicRelief, type OrganicReliefParameters } from "./organic-relief";
import type { ProfileLevel } from "./profile-sweep";

export const LIGHTBOX_SIDE_PROFILES = {
  smooth: "Liso", zigzag: "Zigzag", waves: "Ondas", belly: "Barriga",
  pedestal: "Pedestal · curva S", bumper: "Bumper", bubble: "Burbuja", stack: "Frisos",
} as const;

/** El diámetro nominal y el interior cilíndrico se conservan. El relieve
 * pertenece sólo a la franja libre entre los faldones, con margen a ambos lados. */
export function lightboxSideProfile(p:LightboxParameters) {
  const from=p.rimOverlap+p.sideMargin,to=p.depth-from,span=to-from;
  const flat:ProfileLevel[]=[{z:from,offset:0},{z:to,offset:0}];
  if(p.sideProfile==="smooth"||span<8)return {from,to,span:Math.max(0,span),levels:flat,peak:0};
  const angle=(45+45*p.sideShape/100)*Math.PI/180;
  const params:OrganicReliefParameters={
    organicProfile:p.sideProfile,
    organicAmplitude:p.sideRelief,organicPeriod:p.sidePeriod,
    organicWaveAmplitude:p.sideRelief,organicWavePeriod:p.sidePeriod,organicWaveShape:p.sideShape,
    organicBelly:p.sideRelief,organicExpansion:p.sideRelief,organicCurvature:p.sideShape,
    organicBumper:p.sideRelief,organicFoot:p.sideFoot,organicCloseBase:true,
    organicBubble:p.sideShape,organicRadius:p.sideRelief/(1-Math.cos(angle)),
    organicCount:p.sideCount,organicStackAdvance:p.sideRelief,organicStackGap:p.sideGap,
    organicSlant:0,organicAngle:45,
  };
  const cycles=p.sideProfile==="stack"?p.sideCount:Math.max(1,Math.round(span/p.sidePeriod));
  const count=Math.min(256,Math.max(64,cycles*24));
  const samples=new Set([0,span]);
  for(let i=0;i<=count;i++)samples.add(span*i/count);
  // Conservar los vértices de los patrones angulares incluso si no caen
  // sobre una muestra uniforme. Evita suavizar las puntas por accidente.
  if(p.sideProfile==="zigzag")for(let i=0;i<=cycles*2;i++)samples.add(span*i/(cycles*2));
  if(p.sideProfile==="bumper")for(const z of [p.sideRelief,p.sideRelief+p.sideFoot,2*p.sideRelief+p.sideFoot])
    if(z>0&&z<span)samples.add(z);
  const levels=[...samples].sort((a,b)=>a-b).map(z=>({
    z,offset:Math.min(p.sideRelief,z,span-z,Math.max(0,organicRelief(params,z,0,span)-(p.sideProfile==="stack"?.8:0))),
  }));
  // Limitar pendientes en ambas direcciones y llegar a los extremos a cero.
  // Se agrega material por fuera: nunca se rebaja la pared ni el encastre.
  for(let i=1;i<levels.length;i++)levels[i].offset=Math.min(levels[i].offset,levels[i-1].offset+levels[i].z-levels[i-1].z);
  for(let i=levels.length-2;i>=0;i--)levels[i].offset=Math.min(levels[i].offset,levels[i+1].offset+levels[i+1].z-levels[i].z);
  const oriented=p.sideReverse?[...levels].reverse().map(l=>({z:span-l.z,offset:l.offset})):levels;
  return {from,to,span,levels:oriented.map(l=>({...l,z:l.z+from})),peak:Math.max(...levels.map(l=>l.offset))};
}
