import type { LightboxParameters } from "./types";

export const LIGHTBOX_MOUNT_STYLES = {
  straight: { label: "Recto", description: "Un brazo central discreto, con apoyo curvo y fijación desde el interior." },
  arch: { label: "Curvo", description: "Un brazo de cintura curva y extremos ensanchados, inspirado en el cartel de referencia." },
  classic: { label: "Clásico", description: "Un brazo central con nervadura triangular. Conserva su estilo, con unión interior oculta." },
};
export const mountShoeHeight = (p: LightboxParameters) => p.armHeight + 28;
export const mountFootHeight = (p: LightboxParameters) => p.armHeight + 64;
/** Desplazar las juntas libera el centro del soporte y su paso de cable. */
export const lightboxSectorPhase = (p: LightboxParameters) => p.mount && p.segments > 1 ? 180 / p.segments : 0;
export function mountHoles(p: LightboxParameters) {
  return [-1, 1].flatMap(dy => [-1, 1].map(dz => {
    const y = dy * (p.armHeight / 2 + 6);
    return { angle: Math.atan2(y, -Math.sqrt((p.diameter / 2) ** 2 - y * y)), z: p.depth / 2 + dz * (p.armWidth / 2 - 8) };
  }));
}
export function mountMetadata(p: LightboxParameters) {
  const count = p.mount ? 4 : 0, gripLength = p.wall + p.jointClearance - .6;
  return {
    enabled: p.mount, style: p.mountStyle, separate: true, armCount: p.mount ? 1 : 0,
    fastening: "inside-inserts" as const,
    bodyScrews: { quantity: count, nominal: "M4", clearanceDiameter: 4.5, headSeatDiameter: 10,
      gripLength, lengthToPocketBottom: gripLength + p.mountInsertDepth,
      direction: "inside-out" as const, nuts: 0, washers: count },
    inserts: { quantity: count, nominal: "M4", installation: "heat-set" as const,
      holeDiameter: p.mountInsertDiameter, holeDepth: p.mountInsertDepth,
      outerWallMin: p.mountShoeThickness - p.mountInsertDepth - .1 },
    wallAnchors: p.mount ? 4 : 0,
  };
}
export function validateSeparateMount(p: LightboxParameters) {
  if (!p.mount) return;
  if (p.armWidth < 28) throw new Error("El brazo central necesita al menos 28 mm de ancho para separar las fijaciones interiores.");
  if (p.mountShoeThickness < p.mountInsertDepth + 2.2)
    throw new Error("El alojamiento del inserto debe conservar al menos 2,2 mm de fondo. Aumentá el espesor del apoyo o reducí su profundidad.");
  if (p.segments > 1) {
    const step = 2 * Math.PI / p.segments, phase = lightboxSectorPhase(p) * Math.PI / 180;
    for (const { angle } of [...mountHoles(p), { angle: Math.PI }]) {
      const relative = angle - phase;
      const delta = Math.abs(relative - Math.round(relative / step) * step);
      if ((p.diameter / 2 - p.wall - 12) * Math.sin(delta) < 18)
        throw new Error("La unión de sectores alcanza una fijación del brazo central. Aumentá el diámetro, reducí la altura del brazo o elegí menos sectores.");
    }
  }
}
