import {beforeAll,afterEach,describe,it,expect} from "vitest";
import Module,{type ManifoldToplevel} from "manifold-3d";
import {unzipSync} from "fflate";
import {newProject} from "../src/core/project";
import {createLightbox} from "../src/core/lightbox-geometry";
import {lightboxSideProfile} from "../src/core/lightbox-side";
import {mountHoles} from "../src/core/lightbox-mount";
import {buildModel} from "../src/core/engine";
import {lightboxProject,lightboxMotion} from "../src/core/lightbox";
import {releasedSnapPositions} from "../src/core/lightbox-snap";
import {parseProject} from "../src/core/storage";
import {bundle,costs,printingPart,packParts,quoteEnvelope,stl,placedPart} from "../src/core/output";
import type {Part,Project} from "../src/core/types";
let w:ManifoldToplevel;
beforeAll(async()=>{w=await Module();w.setup();});
// Manifold calcula en WASM sin ceder el hilo. Permitir que Vitest procese
// su comunicación entre casos evita acumular timeouts de onTaskUpdate.
afterEach(()=>new Promise<void>(resolve=>setImmediate(resolve)));
// La batería base también verifica la variante con nervadura central.
const wholeProject=()=>{const p=lightboxProject(newProject());p.lightbox.mountStyle="classic";return p;};
const project=()=>{const p=wholeProject();p.lightbox.segments=4;p.lightbox.rimClosure="screws";return p;};
const build=(p:Project)=>buildModel(w,{project:p,mode:p.mode,shapes:[]});
const solid=(p:Part)=>new w.Manifold(new w.Mesh({numProp:3,vertProperties:p.positions,triVerts:p.indices}));
function audit(p:Project,steps=[0]){
  const m=build(p),sources=m.parts.map(solid);
  try{
    for(let i=0;i<sources.length;i++){
      expect(sources[i].status(),m.parts[i].id).toBe("NoError");
      const islands=sources[i].decompose();
      expect(islands.length,`${m.parts[i].id}: pieza fragmentada`).toBe(1);
      islands.forEach(x=>x.delete());
    }
    for(const step of steps){
      const moved=sources.map((s,i)=>{
        const part=m.parts[i];
        if(!part.snapTabs)return s.translate(lightboxMotion(part,step));
        const released=solid({...part,positions:releasedSnapPositions(part,step)});
        const moved=released.translate(lightboxMotion(part,step));released.delete();return moved;
      });
      try{
        const boxes=moved.map(s=>s.boundingBox());
        for(let i=0;i<moved.length;i++)for(let j=i+1;j<moved.length;j++){
          if([0,1,2].some(a=>boxes[i].max[a]<=boxes[j].min[a]||boxes[j].max[a]<=boxes[i].min[a]))continue;
          const hit=moved[i].intersect(moved[j]);
          const volume=hit.volume();hit.delete();
          expect(volume,`${step}%: ${m.parts[i].id} / ${m.parts[j].id}`).toBeLessThan(.06);
        }
      }finally{moved.forEach(x=>x.delete());}
    }
    return m;
  }finally{sources.forEach(s=>s.delete());}
}
describe("Banderola: sólidos y montaje",()=>{
  it("400 mm: piezas conectadas, sin interferencias y recorrido completo de mantenimiento",()=>{
    const p=project(),m=audit(p,[0,5,15,20,25,35,40,45,55,60,65,75,80,85,95,100]);
    expect(m.parts.filter(p=>p.material==="acrylic")).toHaveLength(2);
    expect(m.parts.filter(p=>p.layer==="wallMount")).toHaveLength(1);
    expect(m.lightbox!.lighting).toBe("unconfigured");
    expect(m.lightbox!.ledCount).toBe(0);
  },30000);
  it.each([4,6,8,12] as const)("%i sectores: caras y uniones compatibles",segments=>{
    const p=project();p.lightbox.segments=segments;
    p.lightbox.lightRows=1;
    const m=audit(p,[0,50,100]);
    expect(m.parts.filter(p=>p.layer==="boxBody")).toHaveLength(segments);
  },30000);
  it("dos acrílicos distintos y juntas flexibles sin intersección",()=>{
    const p=project();Object.assign(p.lightbox,{acrylicA:5,acrylicB:2,sealThickness:1});
    const m=audit(p,[0,60,100]);
    const a=m.parts.find(p=>p.id==="acrylic-a")!,b=m.parts.find(p=>p.id==="acrylic-b")!;
    expect(a.bounds.max[2]-a.bounds.min[2]).toBeCloseTo(5);
    expect(b.bounds.max[2]-b.bounds.min[2]).toBeCloseTo(2);
    expect(m.parts.filter(p=>p.material==="flexible")).toHaveLength(8);
    expect(a.contours).toHaveLength(1);expect(b.contours).toHaveLength(1);
  },30000);
  it.each([250,600])("diámetro %i mm",diameter=>{
    const p=project();Object.assign(p.lightbox,{diameter,lightRows:1,armSpacing:diameter*.3,segments:8});
    audit(p,[0,100]);
  },30000);
});
it("400 mm dividido en cuatro sectores entra por pieza en una cama de 220 × 220 × 250",()=>{
  const p=project(),m=build(p),layout=packParts(m.parts.filter(p=>p.material==="filament"),p);
  expect(layout.oversized.map(p=>p.id)).toEqual([]);
  for(const part of m.parts.filter(p=>p.material==="filament")){
    const prepared=printingPart(part),s=solid(prepared);
    expect(s.status()).toBe("NoError");
    expect(s.volume()).toBeCloseTo(part.volume,0);s.delete();
    const bytes=stl([part],true),v=new DataView(bytes);
    expect(v.getUint32(80,true)).toBe(part.indices.length/3);
    let min=Infinity;
    for(let i=84;i<bytes.byteLength;i+=50)for(let k=0;k<3;k++)min=Math.min(min,v.getFloat32(i+12+k*12+8,true));
    expect(min).toBeCloseTo(0,3);
  }
  p.production.bedDepth=50;
  expect(packParts(m.parts.filter(p=>p.layer==="boxBody"),p).oversized).toHaveLength(4);
});
it("exporta acrílicos separados, flexible STL, piezas, montaje y contrato v3",()=>{
  const p=project();p.lightbox.sealThickness=1;
  const m=build(p),files=unzipSync(bundle(p,m)),names=Object.keys(files);
  expect(names).toContain("corte/acrylic/acrylic-a.dxf");
  expect(names).toContain("corte/acrylic/acrylic-b.dxf");
  expect(names).toContain("impresion/flexible/seal-a-0.stl");
  expect(names).not.toContain("impresion/acrylic-a.stl");
  expect(names).toContain("corte/plantillas/banderola-anclajes-pared.dxf");
  expect(names).toContain("MONTAJE-BANDEROLA.txt");
  expect(quoteEnvelope(p,m).version).toBe(3);
  expect(quoteEnvelope(p,m).design.style).toBe("circular-double-face");
  const c=costs(p,m);
  expect(c.flexibleMass).toBeGreaterThan(0);
  expect(c.acrylicArea).toBeCloseTo(2*Math.PI*((200-6-.8)/1000)**2,4);
});
it("mantiene el cuerpo al modificar sólo la gráfica y conserva proyectos anteriores",()=>{
  const p=project(),m=build(p);
  const restored=parseProject(JSON.parse(JSON.stringify(p)));
  expect(restored.lightbox).toEqual(p.lightbox);
  const old:any=newProject();delete old.lightbox;delete old.faceArtwork;delete old.production.bedDepth;
  expect(parseProject(old).mode).toBe("letters");
  expect(parseProject(old).lightbox.diameter).toBe(400);
  p.faceArtwork={a:"data:image/png;base64,iVBORw0KGgo=",b:""};
  expect(new Uint8Array(stl(build(p).parts))).toEqual(new Uint8Array(stl(m.parts)));
});
it("omite soportes opcionales y valida límites antes de construir",()=>{
  const p=project();p.lightbox.lights=false;p.lightbox.mount=false;
  const m=build(p);
  expect(m.parts.some(p=>p.layer==="wallMount"||p.layer==="lightRails")).toBe(false);
  expect(m.lightbox!.ledCount).toBe(0);
  for(const patch of [{wall:2},{diameter:100},{segments:3},{acrylicA:0},{jointClearance:0},{moduleWidth:80},{wallDistance:900}])
    expect(()=>build({...p,lightbox:{...p.lightbox,...patch} as Project["lightbox"]})).toThrow();
});


it("mantiene todos los apoyos internos dentro de la circunferencia",()=>{
  const p=project();p.lightbox.mount=false;
  const m=build(p);
  for(const part of m.parts.filter(p=>p.layer==="boxBody"))
    for(let i=0;i<part.positions.length;i+=3)
      expect(Math.hypot(part.positions[i],part.positions[i+1]),part.id).toBeLessThanOrEqual(p.lightbox.diameter/2+.001);
});
it("cierre lateral: frente liso, pestaña exterior y pilotos ciegos alineados",()=>{
  const p=project();p.lightbox.depth=100;
  const m=audit(p,[0,40,45,50,55,60,65,70,75,80,90,100]);
  expect(m.parts.some(p=>p.layer==="clips"||p.id.startsWith("lock-"))).toBe(false);
  const live:InstanceType<typeof w.Manifold>[]=[];
  const hold=<T extends InstanceType<typeof w.Manifold>>(x:T)=>{live.push(x);return x;};
  const volume=(a:InstanceType<typeof w.Manifold>,b:InstanceType<typeof w.Manifold>)=>hold(a.intersect(b)).volume();
  const body=hold(w.Manifold.union(m.parts.filter(p=>p.layer==="boxBody").map(p=>hold(solid(p)))));
  const R=200,H=100,v=p.lightbox;
  const drill=(x:number,z:number,r:number,length:number,angle:number,side:number)=>{
    let s=hold(hold(hold(hold(w.Manifold.cylinder(length,r,r,32)).rotate([0,90,0])).translate([x,0,z])).rotate([0,0,angle]));
    if(side<0)s=hold(hold(s.rotate([180,0,0])).translate([0,0,H]));
    return s;
  };
  try{
    for(const side of [1,-1]){
      const rim=hold(w.Manifold.union(m.parts.filter(p=>p.layer===(side===1?"rimA":"rimB")).map(p=>hold(solid(p)))));
      for(let i=0;i<v.segments*2;i++){
        const angle=(i+.5)*180/v.segments,z=H-v.rimOverlap/2;
        // Conductos coaxiales libres, sin perforar la cara frontal.
        expect(volume(rim,drill(R,z,v.rimScrewHole/2-.08,10,angle,side))).toBeLessThan(.01);
        expect(volume(body,drill(R-v.rimScrewDepth+.1,z,v.rimPilotHole/2-.08,v.rimScrewDepth+.2,angle,side))).toBeLessThan(.01);
        const bottom=drill(R-v.rimScrewDepth-.6,z,.3,.3,angle,side);
        expect(volume(body,bottom)).toBeCloseTo(bottom.volume(),3);
        const front=drill(R-4,H+v.sealThickness+v.rimThickness/2,.25,.5,angle,side);
        expect(volume(rim,front)).toBeCloseTo(front.volume(),3);
      }
      // Muestrear dentro del sector, lejos de su junta desplazada.
      const skirt=drill(R+v.rimClearance+.5,H-v.rimOverlap+2,.25,.5,90/v.segments,side);
      expect(volume(rim,skirt)).toBeCloseTo(skirt.volume(),3);
    }
    const contract=quoteEnvelope(p,m);
    expect(contract.purchasedComponents!.rimScrews.quantity).toBe(16);
    expect(contract.purchasedComponents!.rimScrews.includedInEstimate).toBe(false);
    const files=unzipSync(bundle(p,m));
    expect(Object.keys(files).some(k=>k.includes("clip-")||k.includes("lock-"))).toBe(false);
    expect(JSON.parse(new TextDecoder().decode(files["componentes-comerciales.json"])).rimScrews.quantity).toBe(16);
  }finally{live.reverse().forEach(s=>s.delete());}
},30000);
it("los STL individuales y rotados en mesa se reimportan como sólidos cerrados",()=>{
  const p=project(),m=build(p);
  for(const part of m.parts.filter(p=>p.material==="filament")){
    const print=printingPart(part);
    const placed=placedPart({part:print,x:7,y:11,width:100,height:100,rotated:true,bed:0});
    for(const bytes of [stl([part],true),stl([placed])]){
      const v=new DataView(bytes),n=v.getUint32(80,true);
      const verts=new Float32Array(n*9),ids=new Uint32Array(n*3);
      for(let i=0;i<n;i++)for(let j=0;j<9;j++)verts[i*9+j]=v.getFloat32(84+i*50+12+j*4,true);
      for(let i=0;i<ids.length;i++)ids[i]=i;
      const mesh=new w.Mesh({numProp:3,vertProperties:verts,triVerts:ids});mesh.merge();
      const s=new w.Manifold(mesh);
      expect(s.status(),part.id).toBe("NoError");
      // La rotación y traslado del STL redondean a Float32. Acotar el
      // error relativo de volumen, como en la prueba de anillos enteros.
      expect(Math.abs(s.volume()-part.volume)/part.volume,part.id).toBeLessThan(1e-6);s.delete();
    }
  }
});
it("migra proyectos con presillas sin perder las medidas del cartel",()=>{
  const p:any=project();p.lightbox.depth=100;
  for(const key of ["rimOverlap","rimSkirtThickness","rimClearance","rimScrewHole","rimPilotHole","rimScrewDepth"])delete p.lightbox[key];
  p.hidden=["clips"];
  const restored=parseProject(p);
  expect(restored.lightbox.depth).toBe(100);
  expect(restored.lightbox.rimOverlap).toBe(18);
  expect(build(restored).parts.some(p=>p.layer==="clips")).toBe(false);
  for(const patch of [{rimScrewDepth:6},{rimPilotHole:4},{rimOverlap:35},{rimClearance:0}])
    expect(()=>build({...restored,lightbox:{...restored.lightbox,...patch}})).toThrow();
});


it("por defecto genera cuerpo y aros enteros, continuos y sin llaves de sectores",()=>{
  const p=wholeProject();p.lightbox.sealThickness=1;
  expect(p.lightbox.segments).toBe(1);
  const m=audit(p,[0,40,45,50,55,60,65,75,80,90,100]);
  for(const layer of ["boxBody","rimA","rimB"]){
    expect(m.parts.filter(p=>p.layer===layer)).toHaveLength(1);
    expect(m.parts.find(p=>p.layer===layer)!.id).toContain("whole");
  }
  expect(m.parts.filter(p=>p.layer==="seals")).toHaveLength(2);
  expect(m.parts.some(p=>p.id.startsWith("box-key-"))).toBe(false);
  // Secciones anulares completas en las zonas lisas, sin cortes radiales.
  for(const [id,z] of [["body-whole",20],["rim-a-whole",p.lightbox.depth+1.5]] as const){
    const part=m.parts.find(p=>p.id===id)!;
    const s=solid(part),section=s.slice(z),rings=section.toPolygons();
    expect(rings,id).toHaveLength(2);
    const outer=w.CrossSection.circle(id==="body-whole"?200:200+p.lightbox.rimClearance+p.lightbox.rimSkirtThickness,192);
    const inner=w.CrossSection.circle(200-(id==="body-whole"?p.lightbox.wall:p.lightbox.rimWidth),192);
    const expected=outer.subtract(inner);
    // El motor cuantiza a 0,001 mm antes del STL. Admitir 0,002 mm
    // alrededor del perfil ideal, pero ningún corte radial en el anillo.
    const envelope=expected.offset(.002,"Miter"),core=expected.offset(-.002,"Miter");
    const missing=core.subtract(section),extra=section.subtract(envelope);
    expect(missing.area()+extra.area(),id).toBeLessThan(.001);
    [outer,inner,expected,envelope,core,missing,extra].forEach(p=>p.delete());
    section.delete();s.delete();
  }
  expect(m.lightbox!.rimFasteners.quantity).toBe(0);
  expect(m.lightbox!.assembly[0]).toContain("piezas enteras");
},30000);
it("exporta un STL por anillo entero sin dividirlo para hacerlo entrar en la cama",()=>{
  const p=wholeProject(),m=build(p);
  const rings=m.parts.filter(p=>["boxBody","rimA","rimB"].includes(p.layer));
  expect(packParts(rings,p).oversized).toHaveLength(3);
  expect(p.lightbox.segments).toBe(1);
  const files=unzipSync(bundle(p,m)),names=Object.keys(files);
  expect(names).toContain("impresion/body-whole.stl");
  expect(names).toContain("impresion/rim-a-whole.stl");
  expect(names).toContain("impresion/rim-b-whole.stl");
  expect(names.some(p=>p.includes("body-sector")||p.includes("box-key"))).toBe(false);
  for(const part of rings){
    const data=files[`impresion/${part.id}.stl`];
    const v=new DataView(data.buffer,data.byteOffset,data.byteLength),n=v.getUint32(80,true);
    const verts=new Float32Array(n*9),ids=new Uint32Array(n*3);
    for(let i=0;i<n;i++)for(let j=0;j<9;j++)verts[i*9+j]=v.getFloat32(84+i*50+12+j*4,true);
    for(let i=0;i<ids.length;i++)ids[i]=i;
    const mesh=new w.Mesh({numProp:3,vertProperties:verts,triVerts:ids});mesh.merge();
    const s=new w.Manifold(mesh),pieces=s.decompose();
    expect(s.status(),part.id).toBe("NoError");expect(pieces,part.id).toHaveLength(1);
    // El STL usa Float32 y se traslada a Z=0; comparar error relativo en
    // piezas de más de un millón de mm³, no centésimas absolutas de mm³.
    expect(Math.abs(s.volume()-part.volume)/part.volume).toBeLessThan(1e-6);
    pieces.forEach(p=>p.delete());s.delete();
  }
  p.production.bedWidth=500;p.production.bedHeight=500;
  expect(packParts(rings,p).oversized).toHaveLength(0);
  const restored=parseProject(JSON.parse(JSON.stringify(p)));
  expect(restored.lightbox.segments).toBe(1);
  expect(build(restored).parts.filter(p=>p.layer==="boxBody")).toHaveLength(1);
},30000);

it.each([1,4,6,8,12] as const)("click con %i piezas por anillo: conectado y liberable sin atravesar el cuerpo",segments=>{
  const p=wholeProject();Object.assign(p.lightbox,{segments,depth:100});
  const m=audit(p,[0,20,25,30,35,40,40.1,40.5,41,42,45,50,60,80,100]);
  expect(m.lightbox!.rimFasteners.quantity).toBe(0);
  expect(m.lightbox!.snapTabsPerFace).toBe(segments===1?4:segments*2);
  expect(m.parts.some(p=>p.id.startsWith("led-")||p.layer==="lightRails")).toBe(false);
},30000);

it("los dientes click retienen ambos aros; sólo salen al liberar sus pestañas",()=>{
  const p=wholeProject();p.lightbox.depth=100;p.lightbox.mount=false;
  const m=build(p),body=solid(m.parts.find(p=>p.layer==="boxBody")!);
  try{
    for(const part of m.parts.filter(p=>p.snapTabs)){
      const direction=part.snapTabs!.side;
      const rest=solid(part),locked=rest.translate([0,0,direction*2]),collision=body.intersect(locked);
      expect(collision.volume(),part.id).toBeGreaterThan(5);
      collision.delete();locked.delete();rest.delete();
      const original=part.positions.slice();
      const released=solid({...part,positions:releasedSnapPositions(part,40)});
      expect(released.status()).toBe("NoError");
      const islands=released.decompose();expect(islands).toHaveLength(1);islands.forEach(s=>s.delete());
      for(const distance of [0,.2,1,2,3,5,10,18,22]){
        const moved=released.translate([0,0,direction*distance]),hit=body.intersect(moved);
        expect(hit.volume(),`${part.id} / ${distance} mm`).toBeLessThan(.06);
        hit.delete();moved.delete();
      }
      released.delete();
      expect(part.positions).toEqual(original);
      expect(releasedSnapPositions(part,0)).toBe(part.positions);
    }
    const contract=quoteEnvelope(p,m);
    expect(contract.purchasedComponents!.rimScrews.quantity).toBe(0);
    const files=unzipSync(bundle(p,m));
    const purchases=JSON.parse(new TextDecoder().decode(files["componentes-comerciales.json"]));
    expect(purchases.lighting.status).toBe("unconfigured");
    expect(purchases.remotePowerSupply).toBeNull();
    expect(new TextDecoder().decode(files["MONTAJE-BANDEROLA.txt"])).toContain("uñeros");
  }finally{body.delete();}
});

it.each([
  {diameter:200,depth:60,mount:false,armSpacing:80,segments:12 as const,snapWidth:18,snapThickness:.8,snapEngagement:1.2,rimClearance:1},
  {diameter:800,depth:240,mount:false,rimOverlap:35,snapWidth:18,snapThickness:2,snapEngagement:1.2,rimClearance:.15,sealThickness:1.5},
])("click en extremos de tamaño y tolerancias: %j",patch=>{
  const p=wholeProject();Object.assign(p.lightbox,patch);
  audit(p,[0,30,40,40.1,41,45,100]);
},30000);

it("abre proyectos anteriores con tornillos y retira todos los apoyos LED",()=>{
  const old:any=wholeProject();delete old.lightbox.rimClosure;old.lightbox.lights=true;
  old.hidden=["lightRails"];
  const restored=parseProject(old);
  expect(restored.lightbox.rimClosure).toBe("screws");expect(restored.lightbox.lights).toBe(false);
  const p=wholeProject();p.lightbox.lights=true;p.lightbox.mount=false;p.lightbox.drainage=false;
  const m=build(p),body=solid(m.parts.find(p=>p.layer==="boxBody")!),section=body.slice(p.lightbox.depth/2);
  expect(section.toPolygons()).toHaveLength(2);
  expect(section.area()).toBeCloseTo(192/2*Math.sin(2*Math.PI/192)*(200**2-194**2),0);
  // Los antiguos flags y medidas LED no agregan barras, asientos ni taladros internos.
  expect(m.parts).toHaveLength(5);
  section.delete();body.delete();
  expect(()=>parseProject({...p,lightbox:{...p.lightbox,rimClosure:"unknown"}})).toThrow();
  for(const patch of [{snapThickness:.4},{snapWidth:25},{snapEngagement:2},{rimOverlap:12}])
    expect(()=>build({...p,lightbox:{...p.lightbox,...patch}})).toThrow();
});

const sideProfiles=["zigzag","waves","belly","pedestal","bumper","bubble","stack"] as const;
it.each(sideProfiles)("lateral %s: cuerpo continuo, encastres intactos y montaje libre",sideProfile=>{
  const p=wholeProject();Object.assign(p.lightbox,{depth:100,sideProfile,sideRelief:6});
  const m=audit(p,[0,20,30,40,40.1,41,45,60,80,100]);
  const base=build({...p,lightbox:{...p.lightbox,sideProfile:"smooth"}});
  const part=m.parts.find(p=>p.layer==="boxBody")!,original=base.parts.find(p=>p.layer==="boxBody")!;
  // Comparar la receta antes de redondear a 0,001 mm: nuevas triangulaciones
  // de una misma cara generan láminas numéricas al restar dos STL redondeados.
  const owned=new Set<{delete():void}>();
  const keep=<T extends {delete():void}>(s:T)=>{owned.add(s);return s;};
  const body=createLightbox(w,keep,p).parts.find(p=>p.layer==="boxBody")!.solid;
  const plain=createLightbox(w,keep,{...p,lightbox:{...p.lightbox,sideProfile:"smooth"}}).parts.find(p=>p.layer==="boxBody")!.solid;
  const removed=keep(plain.subtract(body)),added=keep(body.subtract(plain));
  try{
    expect(removed.volume(),"No debe rebajar la pared cilíndrica").toBeLessThan(.001);
    expect(added.volume()).toBeGreaterThan(100);
    expect(part.volume).toBeGreaterThan(original.volume);
    // La resta booleana puede conservar caras coincidentes de volumen cero.
    // Medir material en las franjas protegidas, no sus vértices residuales.
    const protectedDepth=p.lightbox.rimOverlap+p.lightbox.sideMargin-.002;
    for(const z of [0,p.lightbox.depth-protectedDepth]){
      const guard=keep(keep(w.Manifold.cube([1000,1000,protectedDepth])).translate([-500,-500,z]));
      expect(keep(added.intersect(guard)).volume(),"No debe agregar material bajo los aros").toBeLessThan(.001);
    }
    for(const part of m.parts.filter(p=>p.layer!=="boxBody")){
      const previous=base.parts.find(p=>p.id===part.id)!;
      expect(part.positions,part.id).toEqual(previous.positions);
      expect(part.indices,part.id).toEqual(previous.indices);
    }
    expect(costs(p,m).mass).toBeGreaterThan(costs(p,base).mass);
    expect(quoteEnvelope(p,m).design.lightbox!.sideProfile.kind).toBe(sideProfile);
  }finally{owned.forEach(s=>s.delete());}
},60000);

it.each(sideProfiles)("lateral %s dividido: piezas conectadas y aros con tornillos compatibles",sideProfile=>{
  const p=project();Object.assign(p.lightbox,{sideProfile,sideRelief:15,sidePeriod:8,sideCount:6,sideReverse:true});
  const m=audit(p,[0,20,45,100]);
  expect(m.parts.filter(p=>p.layer==="boxBody")).toHaveLength(4);
},60000);

it("conserva el interior y atraviesa el relieve con los drenajes",()=>{
  const p=wholeProject();Object.assign(p.lightbox,{sideProfile:"belly",sideRelief:15,mount:false});
  const m=build(p),body=solid(m.parts.find(p=>p.layer==="boxBody")!);
  try{
    const bore=w.Manifold.cylinder(p.lightbox.depth-2*(p.lightbox.rimOverlap+2),193.9,193.9,192);
    const cavity=bore.translate([0,0,p.lightbox.rimOverlap+2]),inside=body.intersect(cavity);
    expect(inside.volume()).toBeLessThan(.05);
    [bore,cavity,inside].forEach(s=>s.delete());
    for(const z of [p.lightbox.depth*.25,p.lightbox.depth*.75]){
      const drill=w.Manifold.cylinder(40,1.4,1.4,32),rot=drill.rotate([90,0,0]);
      const moved=rot.translate([8,-190,z]),hit=body.intersect(moved);
      expect(hit.volume()).toBeLessThan(.05);
      [drill,rot,moved,hit].forEach(s=>s.delete());
    }
    const printed=printingPart(m.parts.find(p=>p.layer==="boxBody")!);
    expect(printed.bounds.max[1]-printed.bounds.min[1]).toBeGreaterThan(420);
    p.production.bedWidth=410;p.production.bedHeight=410;
    expect(packParts([m.parts.find(p=>p.layer==="boxBody")!],p).oversized).toHaveLength(1);
  }finally{body.delete();}
},30000);

it("migra laterales lisos y guarda todos los parámetros orgánicos independientes de las letras",()=>{
  const old:any=wholeProject();
  for(const key of Object.keys(old.lightbox).filter(k=>k.startsWith("side")))delete old.lightbox[key];
  const migrated=parseProject(old);expect(migrated.lightbox.sideProfile).toBe("smooth");
  Object.assign(migrated.lightbox,{sideProfile:"waves",sideRelief:7.5,sidePeriod:15,sideShape:70,sideReverse:true});
  const restored=parseProject(JSON.parse(JSON.stringify(migrated)));
  expect(restored.lightbox).toEqual(migrated.lightbox);
  const originalLetters=structuredClone(restored.params);
  const m=build(restored),files=unzipSync(bundle(restored,m));
  expect(restored.params).toEqual(originalLetters);
  const exported=parseProject(JSON.parse(new TextDecoder().decode(files["proyecto.forma.json"])));
  expect(exported.lightbox.sideProfile).toBe("waves");
  expect(exported.lightbox.sideRelief).toBe(7.5);
  for(const patch of [{sideProfile:"snap"},{sideRelief:30},{sideMargin:0},{sidePeriod:0},{sideCount:1.5},{depth:60,rimOverlap:26,mount:false}])
    expect(()=>build({...restored,lightbox:{...restored.lightbox,...patch} as Project["lightbox"]})).toThrow();
},30000);


it("el lateral se adapta al espacio libre y conserva el perfil al invertirlo",()=>{
  const p=wholeProject().lightbox;
  for(const sideProfile of sideProfiles){
    const profile=lightboxSideProfile({...p,sideProfile,sideRelief:15});
    const reversed=lightboxSideProfile({...p,sideProfile,sideRelief:15,sideReverse:true});
    expect(profile.levels[0].offset).toBe(0);expect(profile.levels.at(-1)!.offset).toBe(0);
    for(let i=0;i<profile.levels.length;i++){
      const a=profile.levels[i],b=reversed.levels[profile.levels.length-1-i];
      expect(a.z+b.z).toBeCloseTo(p.depth,6);expect(a.offset).toBe(b.offset);
      if(i)expect(Math.abs(a.offset-profile.levels[i-1].offset)).toBeLessThanOrEqual(a.z-profile.levels[i-1].z+1e-8);
    }
    const deeper=lightboxSideProfile({...p,sideProfile,rimOverlap:30});
    expect(deeper.from).toBe(32);expect(deeper.to).toBe(p.depth-32);
  }
});
it.each(["waves","stack"] as const)("STL del lateral %s: una pieza cerrada y relieve conservado",sideProfile=>{
  const p=wholeProject();Object.assign(p.lightbox,{sideProfile,sideRelief:12});
  const m=build(p),part=m.parts.find(p=>p.layer==="boxBody")!,bytes=stl([part],true);
  const v=new DataView(bytes),n=v.getUint32(80,true),verts=new Float32Array(n*9),ids=new Uint32Array(n*3);
  for(let i=0;i<n;i++)for(let j=0;j<9;j++)verts[i*9+j]=v.getFloat32(84+i*50+12+j*4,true);
  for(let i=0;i<ids.length;i++)ids[i]=i;
  const mesh=new w.Mesh({numProp:3,vertProperties:verts,triVerts:ids});mesh.merge();
  const solid=new w.Manifold(mesh),islands=solid.decompose();
  try{
    expect(solid.status()).toBe("NoError");expect(islands).toHaveLength(1);
    expect(Math.abs(solid.volume()-part.volume)/part.volume).toBeLessThan(1e-6);
    expect(solid.boundingBox().max[1]).toBeGreaterThan(410);
  }finally{islands.forEach(p=>p.delete());solid.delete();}
},30000);

it("los frisos de poco relieve conservan sus valles",()=>{
  const p=wholeProject().lightbox;
  const profile=lightboxSideProfile({...p,sideProfile:"stack",sideRelief:.5,sideCount:4,sideGap:3});
  expect(profile.peak).toBeCloseTo(.5);
  const inner=profile.levels.filter(l=>l.z>profile.from+5&&l.z<profile.to-5);
  expect(inner.some(l=>l.offset===0)).toBe(true);
  expect(inner.some(l=>l.offset>.4)).toBe(true);
});

describe("Brazo central y fijación oculta",()=>{
  it.each(["straight","arch","classic"] as const)("%s: un brazo separado, cuerpo limpio y despiece desde el interior",mountStyle=>{
    const p=lightboxProject(newProject());Object.assign(p.lightbox,{mountStyle,depth:100});
    const m=audit(p,[0,20,40,50,60,70,80,81,90,100]);
    expect(m.parts).toHaveLength(6);
    expect(m.parts.filter(p=>p.layer==="wallMount")).toHaveLength(1);
    expect(m.parts.filter(p=>p.layer==="keys")).toHaveLength(0);
    const body=m.parts.find(p=>p.layer==="boxBody")!;
    for(let i=0;i<body.positions.length;i+=3)expect(Math.hypot(body.positions[i],body.positions[i+1])).toBeLessThanOrEqual(200.001);
    const arm=m.parts.find(p=>p.layer==="wallMount")!;
    expect(Math.hypot(...lightboxMotion(arm,79))).toBe(0);
    expect(lightboxMotion(arm,100)[0]).toBeLessThan(0);
    const prepared=printingPart(arm),mesh=solid(prepared);
    expect(mesh.status()).toBe("NoError");expect(mesh.volume()).toBeCloseTo(arm.volume,0);mesh.delete();
    const bytes=stl([arm],true),view=new DataView(bytes);let min=Infinity;
    for(let i=84;i<bytes.byteLength;i+=50)for(let j=0;j<3;j++)min=Math.min(min,view.getFloat32(i+12+j*12+8,true));
    expect(min).toBeCloseTo(0,3);
    expect(m.lightbox!.mount).toMatchObject({armCount:1,fastening:"inside-inserts",bodyScrews:{quantity:4,direction:"inside-out",nuts:0,washers:4},inserts:{quantity:4}});
    expect(m.lightbox!.assembly.join(" ")).toContain("DESDE EL INTERIOR");
  },30000);
  it.each(["straight","arch","classic"] as const)("%s: frisos y 12 sectores sin invadir el brazo central",mountStyle=>{
    const p=lightboxProject(newProject());Object.assign(p.lightbox,{mountStyle,segments:12,sideProfile:"stack",sideRelief:15});
    audit(p,[0,20,50,80,90,100]);
  },30000);
  it("los tres estilos comparten cuerpo, fijaciones y plantilla de pared",()=>{
    const p=lightboxProject(newProject()),a=build(p);
    for(const style of ["arch","classic"] as const){
      p.lightbox.mountStyle=style;const b=build(p);
      expect(a.parts.find(p=>p.layer==="boxBody")!.positions).toEqual(b.parts.find(p=>p.layer==="boxBody")!.positions);
      expect(a.cutTemplates).toEqual(b.cutTemplates);
      expect(a.parts.find(p=>p.layer==="wallMount")!.volume).not.toEqual(b.parts.find(p=>p.layer==="wallMount")!.volume);
    }
  });
  it.each(["straight","arch","classic"] as const)("%s: insertos ciegos, exterior cerrado y acceso al tornillo sólo desde adentro",mountStyle=>{
    const p=lightboxProject(newProject());p.lightbox.mountStyle=mountStyle;
    const m=build(p),v=p.lightbox,R=v.diameter/2;
    const arm=solid(m.parts.find(p=>p.layer==="wallMount")!),body=solid(m.parts.find(p=>p.layer==="boxBody")!);
    const probes:InstanceType<typeof w.Manifold>[]=[];
    const hold=(s:InstanceType<typeof w.Manifold>)=>{probes.push(s);return s;};
    const axis=(r:number,from:number,length:number,angle:number,z:number)=>hold(hold(hold(hold(w.Manifold.cylinder(length,r,r,32)).rotate([0,90,0])).translate([from,0,z])).rotate([0,0,angle*180/Math.PI]));
    try{
      for(const {angle,z} of mountHoles(v)){
        const inside=axis(4.8,R-v.wall-25,25.59,angle,z);
        expect(hold(body.intersect(inside)).volume(),"acceso interior bloqueado").toBeLessThan(.01);
        const pass=axis(2.15,R-v.wall-1,v.wall+2,angle,z);
        expect(hold(body.intersect(pass)).volume(),"pasante de cuerpo bloqueado").toBeLessThan(.01);
        const insert=axis(v.mountInsertDiameter/2-.1,R+v.jointClearance-.5,v.mountInsertDepth+.4,angle,z);
        expect(hold(arm.intersect(insert)).volume(),"alojamiento del inserto bloqueado").toBeLessThan(.01);
        const floor=axis(2,R+v.jointClearance+v.mountInsertDepth+.2,.5,angle,z);
        expect(hold(arm.intersect(floor)).volume(),"fondo ciego perforado").toBeCloseTo(floor.volume(),3);
        const outer=axis(2,R+v.jointClearance+v.mountShoeThickness-.7,.3,angle,z);
        expect(hold(arm.intersect(outer)).volume(),"tornillo visible por afuera").toBeCloseTo(outer.volume(),3);
      }
      const channel=hold(hold(w.Manifold.cylinder(v.wallDistance+v.wall+3,v.cableDiameter/2-.1,v.cableDiameter/2-.1,32)).rotate([0,90,0]));
      const placed=hold(channel.translate([-R-v.wallDistance-1,0,v.depth/2]));
      expect(hold(body.intersect(placed)).volume()+hold(arm.intersect(placed)).volume()).toBeLessThan(.01);
    }finally{probes.reverse().forEach(s=>s.delete());body.delete();arm.delete();}
  });
  it.each([200,800])("extremo Ø%i: brazo central con variación de medidas",diameter=>{
    const p=lightboxProject(newProject());Object.assign(p.lightbox,{mountStyle:"arch",diameter,depth:100,wall:5,armWidth:28,armHeight:30,plateThickness:18,wallDistance:45,mountShoeThickness:12});
    audit(p,[0,80,90,100]);
  },30000);
  it("migra el soporte doble a central y conserva las medidas del cartel",()=>{
    const old:any=wholeProject();old.lightbox.mountShoeThickness=6;old.lightbox.armWidth=24;
    delete old.lightbox.mountInsertDepth;delete old.lightbox.mountInsertDiameter;
    const migrated=parseProject(old);
    expect(migrated.lightbox.mountStyle).toBe("classic");expect(migrated.lightbox.mountShoeThickness).toBe(12);
    expect(migrated.lightbox.armWidth).toBe(28);
    expect(migrated.lightbox.diameter).toBe(old.lightbox.diameter);expect(migrated.lightbox.depth).toBe(old.lightbox.depth);
    expect(build(migrated).parts.filter(p=>p.layer==="wallMount")).toHaveLength(1);
    expect(parseProject(JSON.parse(JSON.stringify(migrated))).lightbox).toEqual(migrated.lightbox);
    const p=lightboxProject(newProject());
    expect(()=>parseProject({...p,lightbox:{...p.lightbox,mountStyle:"unknown"}})).toThrow();
    for(const patch of [{mountShoeThickness:10},{mountInsertDiameter:2},{mountInsertDepth:15},{armWidth:24}])
      expect(()=>build({...p,lightbox:{...p.lightbox,...patch}})).toThrow();
    Object.assign(p.lightbox,{diameter:200,segments:12});
    expect(()=>build(p)).toThrow(/unión de sectores/);
    p.lightbox.segments=4;expect(()=>build(p)).not.toThrow();
  });
  it("exporta un STL del brazo y cuatro insertos, sin tornillos ni tuercas exteriores",()=>{
    const p=lightboxProject(newProject()),m=build(p),contract=quoteEnvelope(p,m),files=unzipSync(new Uint8Array(bundle(p,m)));
    expect(contract.purchasedComponents!.mountScrews).toMatchObject({quantity:4,nuts:0,washers:4,direction:"inside-out",includedInEstimate:false});
    expect(contract.purchasedComponents!.mountInserts).toMatchObject({quantity:4,installation:"heat-set",includedInEstimate:false});
    expect(contract.purchasedComponents!.wallAnchors.quantity).toBe(4);
    const bought=JSON.parse(new TextDecoder().decode(files["componentes-comerciales.json"]));
    expect(bought.mountInserts.quantity).toBe(4);expect(bought.mountScrews.quantity).toBe(4);
    expect(Object.keys(files).filter(name=>name.endsWith(".stl"))).toHaveLength(4);
    expect(Object.keys(files)).toContain("impresion/wall-arm-central.stl");
    expect(m.cutTemplates).toHaveLength(1);
    // Un contorno de placa con cuatro perforaciones de anclaje.
    expect(m.cutTemplates![0].contours).toHaveLength(5);
    p.lightbox.mount=false;const off=build(p);
    expect(off.lightbox!.mount.armCount).toBe(0);expect(off.lightbox!.mount.inserts.quantity).toBe(0);expect(off.lightbox!.mount.wallAnchors).toBe(0);
    expect(off.lightbox!.assembly.join(" ")).not.toContain("DESDE EL INTERIOR");
  });
});
