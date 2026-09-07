import type { LightboxParameters, Project, Part } from "./types";
import { LIGHTBOX_MOUNT_STYLES, validateSeparateMount } from "./lightbox-mount";

export const DEFAULT_LIGHTBOX: LightboxParameters = {
  diameter: 400, depth: 160, wall: 6, segments: 1, jointClearance: 0.25,
  sideProfile: "smooth", sideRelief: 4, sidePeriod: 12, sideShape: 50,
  sideCount: 4, sideGap: 3, sideFoot: 12, sideMargin: 2, sideReverse: false,
  acrylicA: 3, acrylicB: 3, acrylicClearance: 0.8,
  seatWidth: 10, seatThickness: 3, rimWidth: 16, rimThickness: 4,
  rimOverlap: 18, rimSkirtThickness: 3, rimClearance: 0.35,
  rimClosure: "snap", snapThickness: 1.2, snapWidth: 10, snapEngagement: 0.6,
  rimScrewHole: 3.4, rimPilotHole: 2.4, rimScrewDepth: 4,
  clipWidth: 14, clipThickness: 3, sealThickness: 0,
  drainage: true, lights: false, railWidth: 22, railThickness: 3,
  lightRows: 3, moduleLength: 40, moduleWidth: 14, moduleSpacing: 12,
  modulePower: 0.72, voltage: 12,
  mount: true, mountStyle: "straight", mountShoeThickness: 12, mountInsertDiameter: 5.6, mountInsertDepth: 9.1, wallDistance: 70, armSpacing: 130, armHeight: 18,
  armWidth: 30, plateThickness: 10, anchorDiameter: 6, cableDiameter: 5,
};
export const LIGHTBOX_LAYERS = {
  boxBody: "Cuerpo", faceA: "Acrílico A", faceB: "Acrílico B",
  rimA: "Aro envolvente A", rimB: "Aro envolvente B", keys: "Llaves de unión del cuerpo",
  wallMount: "Brazo y placa de pared", seals: "Juntas flexibles",
};
export const rimScrewsPerFace = (p: Pick<LightboxParameters,"segments">) => Math.max(4,p.segments)*2;
export const snapTabsPerFace = (p: Pick<LightboxParameters,"segments">) => p.segments===1?4:p.segments*2;
export const lightboxAssembly = (p: Pick<LightboxParameters,"segments"|"rimClosure"|"mount"|"mountStyle">) => [
  p.segments===1
    ? "El cuerpo y cada aro se fabrican como piezas enteras independientes. No hay juntas de sectores ni llaves de unión del cuerpo."
    : "Unir los sectores del cuerpo e introducir las llaves de doble cola de milano desde la cara A.",
  ...(!p.mount ? [] : [
    `Soporte ${LIGHTBOX_MOUNT_STYLES[p.mountStyle].label.toLowerCase()}: imprimir el cuerpo y el único brazo central por separado. La placa de pared y el apoyo curvo forman parte del mismo brazo.`,
    "Instalar los cuatro insertos roscados M4 por calor en los alojamientos ciegos de la cara del brazo que toca el cuerpo. Ajustar alojamiento, temperatura y procedimiento a la ficha del inserto y al filamento. Dejar enfriar y comprobar la rosca antes de presentar el cuerpo.",
    "Con los acrílicos retirados, alinear el cuerpo con el apoyo curvo del brazo. Colocar cuatro tornillos M4 con arandelas DESDE EL INTERIOR del cuerpo HACIA AFUERA, roscando en los insertos. Las cabezas quedan dentro y no hay agujeros de fijación en la cara exterior del apoyo.",
    "Verificar el largo de tornillo con el inserto y la arandela reales: debe roscar lo suficiente sin tocar el fondo ciego ni atravesarlo. Insertos, tornillos y arandelas son comerciales y quedan fuera del costo local.",
    "Para separar el brazo, abrir primero los aros y retirar los acrílicos; luego acceder a los tornillos interiores. La vista de montaje aparta el brazo después de liberar las caras.",
  ]),
  "Interior libre de soportes LED. El sistema de iluminación, su fijación y alimentación quedan pendientes de definir.",
  `Asentar cada acrílico, colocar su junta si está habilitada y deslizar ${p.segments===1?"el aro entero":"los sectores del aro"} por su cara hasta que la pestaña envuelva el cuerpo.`,
  p.rimClosure==="snap"
    ? "Cierre click: las rampas de las pestañas flexionan hacia afuera al entrar y sus dientes encastran en la ranura exterior del cuerpo. Verificar que todos hayan trabado. Probar ajuste y flexión en una muestra del filamento elegido."
    : "Alinear los agujeros laterales del aro con los pilotos ciegos del cuerpo. Fijar con tornillos comerciales adecuados para plástico, probando diámetro y largo en una muestra; no sobrepasar la profundidad del piloto.",
  p.rimClosure==="snap"
    ? "Para abrir: levantar hacia afuera los uñeros del faldón, mantener liberadas las pestañas y extraer el aro hacia su cara. Después retirar junta y acrílico. La vista de montaje ilustra la liberación antes de desplazar el aro; no simula fuerzas ni fatiga."
    : `Para abrir: retirar los tornillos laterales y extraer ${p.segments===1?"el aro entero":"los sectores del aro"} hacia su propia cara; después retirar junta y acrílico. Los tornillos no están modelados ni se imprimen.`,
  "Ensayar ajuste de fijaciones, cierres y soporte en banco. No hay una carga admisible ni aptitud exterior certificada.",
];
export function resolveLightbox(saved: Partial<LightboxParameters>): LightboxParameters {
  const p = { ...DEFAULT_LIGHTBOX, ...saved, lights: false };
  if (!("mountInsertDepth" in saved)) {
    p.mountShoeThickness = Math.max(p.mountShoeThickness, DEFAULT_LIGHTBOX.mountShoeThickness);
    p.armWidth = Math.max(p.armWidth, 28);
  }
  return p;
}
export function lightboxProject(p: Project): Project {
  return { ...p, mode: "lightbox", lightbox: resolveLightbox(p.lightbox) };
}
export function validateLightbox(p: LightboxParameters) {
  for (const [key, value] of Object.entries(p)) {
    if (typeof value === "number" && (!Number.isFinite(value) || value < 0 || value > 3000))
      throw new Error(`Medida de banderola inválida: ${key}.`);
  }
  const require = (ok: boolean, message: string) => { if (!ok) throw new Error(message); };
  require(p.diameter >= 200 && p.diameter <= 800, "El diámetro de este prototipo debe estar entre 200 y 800 mm.");
  require(p.depth >= 60 && p.depth <= 240, "La profundidad debe estar entre 60 y 240 mm.");
  require([1, 4, 6, 8, 12].includes(p.segments), "Elegí piezas enteras o una división en 4, 6, 8 o 12 sectores.");
  require(["screws","snap"].includes(p.rimClosure), "Elegí cierre click o tornillos laterales.");
  require(["classic","straight","arch"].includes(p.mountStyle), "Elegí un tipo de soporte válido.");
  require(p.mountShoeThickness >= 6 && p.mountShoeThickness <= 20, "El apoyo curvo debe tener entre 6 y 20 mm de espesor.");
  require(p.mountInsertDiameter >= 4.5 && p.mountInsertDiameter <= 7 && p.mountInsertDepth >= 3.5 && p.mountInsertDepth <= 12, "Revisá el alojamiento M4: diámetro entre 4,5 y 7 mm y profundidad entre 3,5 y 12 mm.");
  require(["smooth","zigzag","waves","belly","pedestal","bumper","bubble","stack"].includes(p.sideProfile), "Elegí un perfil válido para el lateral del cuerpo.");
  require(p.sideRelief >= .5 && p.sideRelief <= 15, "El relieve del lateral debe estar entre 0,5 y 15 mm hacia afuera.");
  require(p.sidePeriod >= 4 && p.sidePeriod <= 40 && p.sideShape >= 0 && p.sideShape <= 100, "Revisá el paso (4–40 mm) y la forma (0–100 %) del relieve.");
  require(Number.isInteger(p.sideCount) && p.sideCount >= 1 && p.sideCount <= 12 && p.sideGap >= 0 && p.sideGap <= 10 && p.sideFoot >= 0 && p.sideFoot <= 60, "Revisá la cantidad de frisos, su separación y el tramo recto del perfil.");
  require(p.sideMargin >= 2 && p.sideMargin <= 15, "El margen del relieve junto a los aros debe estar entre 2 y 15 mm.");
  require(p.sideProfile === "smooth" || p.depth-2*(p.rimOverlap+p.sideMargin) >= 8, "No queda espacio para el perfil entre los aros. Reducí su solape o el margen del relieve, o aumentá la profundidad.");
  require(p.wall >= 5 && p.wall <= 12, "La pared debe tener entre 5 y 12 mm para alojar los cierres.");
  require(p.jointClearance >= 0.1 && p.jointClearance <= 0.6, "La holgura de unión debe estar entre 0,1 y 0,6 mm por lado.");
  require(p.acrylicA >= 2 && p.acrylicA <= 8 && p.acrylicB >= 2 && p.acrylicB <= 8, "Los acrílicos deben tener entre 2 y 8 mm.");
  require(p.acrylicClearance >= 0.2 && p.acrylicClearance <= 3, "La holgura radial del acrílico debe estar entre 0,2 y 3 mm.");
  require(p.seatWidth >= p.acrylicClearance + 4 && p.seatWidth <= 20 && p.seatThickness >= 2 && p.seatThickness <= 6, "Revisá el apoyo: ancho útil mínimo de 4 mm y espesor entre 2 y 6 mm.");
  require(p.rimWidth >= p.wall + p.acrylicClearance + 4 && p.rimWidth <= 35 && p.rimThickness >= 3 && p.rimThickness <= 8, "El aro debe cubrir al menos 4 mm de acrílico y tener de 3 a 8 mm de espesor.");
  require(p.rimOverlap >= 8 && p.rimOverlap <= 35 && 2*p.rimOverlap+4 <= p.depth, "La pestaña del aro debe abrazar entre 8 y 35 mm y dejar espacio entre ambas caras.");
  require(!p.mount || 2*p.rimOverlap+p.armWidth+12 <= p.depth, "La pestaña del aro alcanza el apoyo del brazo central. Reducí su solape o aumentá la profundidad del cuerpo.");
  require(p.rimSkirtThickness >= 2 && p.rimSkirtThickness <= 6 && p.rimClearance >= 0.15 && p.rimClearance <= 1, "Revisá la pestaña lateral: espesor 2–6 mm y holgura radial 0,15–1 mm.");
  if(p.rimClosure==="screws"){
    require(p.rimScrewHole >= 2.5 && p.rimScrewHole <= 5.5 && p.rimOverlap >= p.rimScrewHole+4, "El agujero lateral debe tener entre 2,5 y 5,5 mm y dejar al menos 2 mm hasta el borde de la pestaña.");
    require(p.rimPilotHole >= 1.5 && p.rimPilotHole < p.rimScrewHole && p.rimScrewDepth >= 2 && p.rimScrewDepth <= p.wall-1, "El piloto debe ser menor que el paso del tornillo y conservar al menos 1 mm de fondo en la pared.");
  } else {
    require(p.rimOverlap >= 18, "El cierre click necesita al menos 18 mm de solape para sus pestañas flexibles.");
    require(p.snapThickness>=.8&&p.snapThickness<=2&&p.snapThickness<=p.rimSkirtThickness, "La pestaña flexible debe tener entre 0,8 y 2 mm de espesor.");
    require(p.snapWidth>=8&&p.snapWidth<=18, "El ancho de pestaña click debe estar entre 8 y 18 mm.");
    require(p.snapEngagement>=.3&&p.snapEngagement<=1.2, "La retención del diente debe estar entre 0,3 y 1,2 mm.");
    require(Math.PI*p.diameter/snapTabsPerFace(p)>p.snapWidth+6, "Las pestañas click no entran en los sectores. Reducí su ancho o la cantidad de sectores.");
  }
  require(p.sealThickness <= 1.5, "La junta debe tener hasta 1,5 mm de espesor.");
  require(Number.isInteger(p.lightRows) && p.lightRows >= 1 && p.lightRows <= 5, "Elegí entre 1 y 5 filas de soportes LED.");
  require(p.railWidth >= 16 && p.railWidth <= 35 && p.railThickness >= 2 && p.railThickness <= 6, "Revisá ancho y espesor de los soportes LED.");
  require(p.moduleLength >= 15 && p.moduleLength <= 80 && p.moduleWidth >= 5 && p.moduleWidth <= p.railWidth - 4 && p.moduleSpacing >= 6 && p.moduleSpacing <= 40, "El módulo LED debe entrar en el soporte y dejar al menos 6 mm entre módulos.");
  require(p.voltage >= 5 && p.voltage <= 48 && p.modulePower > 0 && p.modulePower <= 10, "Revisá tensión y potencia nominal del módulo LED.");
  require(p.wallDistance >= 45 && p.wallDistance <= 150, "Revisá la separación de pared (45–150 mm).");
  require(p.armHeight >= 14 && p.armHeight <= 30 && p.armWidth >= 24 && p.armWidth <= 45 && p.plateThickness >= 8 && p.plateThickness <= 18, "Revisá las medidas de brazos y placa de pared.");
  require(p.anchorDiameter >= 4 && p.anchorDiameter <= 10 && p.cableDiameter >= 3 && p.cableDiameter <= p.armHeight - 8, "Revisá el diámetro del anclaje y el canal de cable.");
  validateSeparateMount(p);
}
/** Extraer los aros después de liberar sus pestañas o retirar los tornillos. */
export function lightboxMotion(part: Part, progress: number): [number, number, number] {
  const m = part.motion;
  if (!m) return [0, 0, 0];
  const distance = Math.max(0, Math.min(1, (progress - m.start) / 20)) * m.travel;
  return m.vector.map(v => v * distance) as [number, number, number];
}
