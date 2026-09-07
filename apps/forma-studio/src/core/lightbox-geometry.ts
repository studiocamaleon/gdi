import type { Manifold, ManifoldToplevel, Vec3, CrossSection } from "manifold-3d";
import type { Layer, Part, Project, Contours } from "./types";
import type { Keeper } from "./profile-sweep";
import { resolveLightbox, lightboxAssembly, rimScrewsPerFace, snapTabsPerFace, validateLightbox } from "./lightbox";

import { createSnapRim } from "./lightbox-snap";
import { lightboxSideProfile } from "./lightbox-side";
import { lightboxSectorPhase, mountMetadata, mountShoeHeight } from "./lightbox-mount";
import { createSeparateMount } from "./lightbox-mount-geometry";

export interface LightboxSolid {
  solid: Manifold;
  id: string;
  name: string;
  layer: Layer;
  material?: Part["material"];
  motion?: Part["motion"];
  snapTabs?: Part["snapTabs"];
  printRotation?: Vec3;
}

/** Receta de prototipo. Todos los cierres y apoyos son sólidos propios,
 * independientes de los LED y anclajes comerciales. XY es el plano de cara. */
export function createLightbox(w: ManifoldToplevel, keep: Keeper, project: Project) {
  const p = resolveLightbox(project.lightbox);
  validateLightbox(p);
  const { Manifold: M, CrossSection: CS } = w;
  const R=p.diameter/2,H=p.depth,c=p.jointClearance;
  const whole=p.segments===1;
  const phase=lightboxSectorPhase(p);
  const screwsPerFace=rimScrewsPerFace(p);
  const result: LightboxSolid[]=[];
  const finalCuts: Manifold[]=[];
  const circle=(r:number)=>keep(CS.circle(r,192));
  const cs=(points:Contours)=>keep(new CS(points,"EvenOdd"));
  const sub=(a:Manifold,b:Manifold)=>keep(a.subtract(b));
  const union=(...a:Manifold[])=>keep(M.union(a));
  const ex=(a:CrossSection,h:number,z=0)=>keep(keep(a.extrude(h)).translate([0,0,z]));
  const move=(a:Manifold,v:Vec3)=>keep(a.translate(v));
  const rotate=(a:Manifold,v:Vec3)=>keep(a.rotate(v));
  const box=(x:number,y:number,z:number,dx:number,dy:number,dz:number)=>move(keep(M.cube([dx,dy,dz])),[x,y,z]);
  const ring=(outer:number,inner:number,z:number,height:number)=>ex(keep(circle(outer).subtract(circle(inner))),height,z);
  const radial=(m:Manifold,angle:number)=>rotate(m,[0,0,angle]);
  const onSide=(m:Manifold,side:1|-1)=>side===1?m:move(rotate(m,[180,0,0]),[0,0,H]);
  const motion=(vector:Vec3,start:number,travel:number)=>({vector,start,travel});
  const add=(solid:Manifold,id:string,name:string,layer:Layer,extra:Partial<LightboxSolid>={})=>result.push({solid,id,name,layer,...extra});
  const sector=(solid:Manifold,start:number,end:number,gap=c)=>{
    const a=start*Math.PI/180,b=end*Math.PI/180;
    return keep(keep(solid.trimByPlane([-Math.sin(a),Math.cos(a),0],gap/2)).trimByPlane([Math.sin(b),-Math.cos(b),0],gap/2));
  };
  let body=ring(R,R-p.wall,0,H);
  body=union(body,ring(R,R-p.wall-p.seatWidth,p.acrylicB,p.seatThickness),ring(R,R-p.wall-p.seatWidth,H-p.acrylicA-p.seatThickness,p.seatThickness));
  const keyR=R-p.wall-6;
  const keySection=cs([[[-3.5,-8],[3.5,-8],[1.8,0],[3.5,8],[-3.5,8],[-1.8,0]]]);
  const keySlot=keep(keySection.offset(c,"Miter"));
  const keyBottom=p.acrylicB+p.seatThickness+3;
  const keyTop=H-p.acrylicA-p.seatThickness-2;
  // Doble cola de milano axial. La cara A cerrada impide que la llave salga.
  for(let i=0;!whole && i<p.segments;i++){
    const a=i*360/p.segments+phase;
    body=union(body,radial(box(keyR-6,-12,keyBottom-2,R-keyR+6,24,keyTop-keyBottom+2),a));
    const slot=radial(move(ex(keySlot,H-keyBottom+1,keyBottom),[keyR,0,0]),a);
    finalCuts.push(slot);
    body=sub(body,slot);
    add(radial(move(ex(keySection,keyTop-keyBottom,keyBottom),[keyR,0,0]),a),`box-key-${i}`,`Llave de cuerpo ${i+1}`,"keys",{printRotation:[90,0,-a],motion:motion([0,0,1],80,H+25)});
  }
  const rimInner=R+p.rimClearance;
  const rimOuter=rimInner+p.rimSkirtThickness;
  // Aro en L: ala frontal lisa y pestaña exterior que abraza el cuerpo.
  // La tornillería es comercial. Sólo se generan paso lateral y piloto ciego.
  const radialHole=(x:number,z:number,r:number,length:number)=>move(rotate(keep(M.cylinder(length,r,r,32)),[0,90,0]),[x,0,z]);
  for(const side of [1,-1] as const){
    const suffix=side===1?"a":"b";
    const faceName=side===1?"A":"B";
    let rim=union(
      ring(rimOuter,R-p.rimWidth,H+p.sealThickness,p.rimThickness),
      ring(rimOuter,rimInner,H-p.rimOverlap,p.rimOverlap+p.sealThickness),
    );
    let tabs:Part["snapTabs"];
    if(p.rimClosure==="snap"){
      const click=createSnapRim(w,keep,rim,p);
      rim=click.rim;
      tabs={...click.tabs,side};
      const groove=onSide(click.groove,side);
      finalCuts.push(groove);body=sub(body,groove);
    }
    const screwZ=H-p.rimOverlap/2;
    for(let i=0;p.rimClosure==="screws" && i<screwsPerFace;i++){
      const angle=(i+0.5)*360/screwsPerFace;
      rim=sub(rim,radial(radialHole(R,screwZ,p.rimScrewHole/2,rimOuter-R+1),angle));
      const pilot=onSide(radial(radialHole(R-p.rimScrewDepth,screwZ,p.rimPilotHole/2,p.rimScrewDepth+1),angle),side);
      finalCuts.push(pilot);
      body=sub(body,pilot);
    }
    for(let i=0;i<p.segments;i++){
      // Juntas desplazadas: cada sector del aro une dos sectores del cuerpo.
      const angle=whole?0:(i+0.5)*360/p.segments+phase;
      add(onSide(whole?rim:sector(rim,angle,angle+360/p.segments),side),`rim-${suffix}-${whole?"whole":i}`,`Aro envolvente ${faceName}${whole?" · pieza entera":` · sector ${i+1}`}`,side===1?"rimA":"rimB",{
        // Imprimir el ala frontal sobre la cama y la pestaña hacia arriba.
        printRotation:[side===1?180:0,0,-angle*side],
        motion:motion([0,0,side],40,H+100),
        ...(tabs?{snapTabs:tabs}:{}),
      });
    }
    const faceR=R-p.wall-p.acrylicClearance;
    const thick=side===1?p.acrylicA:p.acrylicB;
    add(onSide(ex(circle(faceR),thick,H-thick),side),`acrylic-${suffix}`,`Acrílico ${faceName}`,side===1?"faceA":"faceB",{material:"acrylic",motion:motion([0,0,side],60,H+70)});
    if(p.sealThickness>0){
      const gasket=ring(faceR,R-p.rimWidth+0.5,H,p.sealThickness);
      for(let i=0;i<p.segments;i++){
        const a=whole?0:(i+0.5)*360/p.segments+phase;
        add(onSide(whole?gasket:sector(gasket,a,a+360/p.segments,0.05),side),`seal-${suffix}-${whole?"whole":i}`,`Junta flexible ${faceName}${whole?" · pieza entera":i+1}`,"seals",{material:"flexible",printRotation:[side===1?0:180,0,-a],motion:motion([0,0,side],60,H+75)});
      }
    }
  }
  // El sistema LED anterior se retiró: interior sin barras, apoyos ni pasadores.
  // Los refuerzos de unión de sectores también deben respetar el cilindro.
  body=keep(body.intersect(ex(circle(R),H)));
  const lateral=lightboxSideProfile(p);
  if(p.sideProfile!=="smooth"){
    const outline:Contours=[[
      [R-.05,lateral.from],
      ...lateral.levels.map(l=>[R+l.offset,l.z] as [number,number]),
      [R-.05,lateral.to],
    ]];
    let relief=keep(cs(outline).revolve(192));
    if(p.mount){
      const left=-R-p.sideRelief-1, width=mountShoeHeight(p)+4;
      relief=sub(relief,box(left,-width/2,H/2-p.armWidth/2-2,-left,width,p.armWidth+4));
    }
    body=union(body,relief);
  }
  const templates:{name:string;contours:Contours}[]=[];
  if(p.mount){
    const supports=createSeparateMount(w,keep,p);
    result.push(...supports.parts);finalCuts.push(...supports.cuts);templates.push(supports.template);
  }
  if(p.drainage){
    // Drenajes inferiores: dirección -Y en el cartel ya instalado.
    for(const z of [H*0.25,H*0.75])
      body=sub(body,move(rotate(keep(M.cylinder(p.wall+lateral.peak+8,1.5,1.5,32)),[90,0,0]),[8,-R+p.wall+4,z]));
  }
  for(const cutter of finalCuts)body=sub(body,cutter);
  for(let i=0;i<p.segments;i++){
    const angle=i*360/p.segments+phase;
    add(whole?body:sector(body,angle,angle+360/p.segments),whole?"body-whole":`body-sector-${i}`,whole?"Cuerpo · pieza entera":`Cuerpo · sector ${i+1}`,"boxBody",{printRotation:[0,0,-angle]});
  }
  return { parts:result,templates,metadata:{ledCount:0,watts:0,voltage:p.voltage,lighting:"unconfigured" as const,mount:mountMetadata(p),rimClosure:p.rimClosure,snapTabsPerFace:p.rimClosure==="snap"?snapTabsPerFace(p):0,visibleDiameter:2*(R-p.rimWidth),sideProfile:{kind:p.sideProfile,from:lateral.from,to:lateral.to,relief:lateral.peak,maxDiameter:2*(R+lateral.peak)},assembly:lightboxAssembly(p),rimFasteners:{
    quantity:p.rimClosure==="screws"?screwsPerFace*2:0,clearanceDiameter:p.rimScrewHole,pilotDiameter:p.rimPilotHole,
    pilotDepth:p.rimScrewDepth,underHeadLengthMax:p.rimSkirtThickness+p.rimClearance+p.rimScrewDepth,
  }},warnings:[
    "Prototipo de banderola: ensayar cierres, fijaciones interiores y soporte bajo carga antes de instalar. Sin carga admisible ni aptitud exterior certificada.",
    "Iluminación pendiente de definir: no se incluyen soportes LED ni se calcula su cantidad o potencia.",
    ...(p.rimClosure==="snap"?["Cierre click experimental: probar flexión, ajuste y reaperturas con una muestra impresa. La animación de liberación es esquemática."]:["La tornillería lateral de los aros es comercial y se cotiza aparte."]),
  ]};
}
