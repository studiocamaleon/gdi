import type { Manifold, ManifoldToplevel, Vec3 } from "manifold-3d";
import type { Keeper } from "./profile-sweep";
import type { Contours, LightboxParameters, Point } from "./types";
import type { LightboxSolid } from "./lightbox-geometry";
import { LIGHTBOX_MOUNT_STYLES, mountFootHeight, mountHoles, mountShoeHeight } from "./lightbox-mount";

/** Un brazo central. Cabezas dentro del cartel e insertos en alojamientos
 * ciegos del apoyo: no hay pasos ni ventanas de fijación en su cara exterior. */
export function createSeparateMount(w: ManifoldToplevel, keep: Keeper, p: LightboxParameters) {
  const { Manifold: M, CrossSection: CS } = w;
  const R = p.diameter / 2, H = p.depth, mid = H / 2, c = p.jointClearance;
  const parts: LightboxSolid[] = [], cuts: Manifold[] = [];
  const ex = (s: InstanceType<typeof CS>, height: number, z: number) => keep(keep(s.extrude(height)).translate([0, 0, z]));
  const circle = (r: number) => keep(CS.circle(r, 192));
  const rect = (x: number, y: number, dx: number, dy: number) => keep(keep(CS.square([dx, dy])).translate([x, y]));
  const section = (points: Contours) => keep(new CS(points, "EvenOdd"));
  const sub = (a: Manifold, b: Manifold) => keep(a.subtract(b));
  const cylinder = (r: number, length: number, at: Vec3, rotation: Vec3) => keep(keep(keep(M.cylinder(length, r, r, 48)).rotate(rotation)).translate(at));
  const radial = (angle: number, z: number, r: number, from: number, length: number) =>
    keep(cylinder(r, length, [from, 0, z], [0, 90, 0]).rotate([0, 0, angle * 180 / Math.PI]));
  const wallX = -R - p.wallDistance, foot = mountFootHeight(p), shoeHeight = mountShoeHeight(p);
  const outerR = R + c + p.mountShoeThickness;
  const shoeSection = keep(keep(circle(outerR).subtract(circle(R + c))).intersect(rect(-outerR - 1, -shoeHeight / 2, outerR + 1, shoeHeight)));
  const shoe = ex(shoeSection, p.armWidth, mid - p.armWidth / 2);
  const start = wallX + p.plateThickness - 2, end = -(R + c + 1), length = end - start;
  let beam = rect(start, -p.armHeight / 2, length, p.armHeight);
  if (p.mountStyle === "arch") {
    // Perfil cóncavo simétrico: cuello central y ensanche hacia ambos apoyos.
    const top: Point[] = Array.from({ length: 65 }, (_, i) => {
      const t = i / 64;
      const extra = t < .5 ? (foot / 2 - 4 - p.armHeight / 2) * (1 - 2 * t) ** 2
        : (shoeHeight / 2 - 3 - p.armHeight / 2) * (2 * t - 1) ** 2;
      return [start + length * t, p.armHeight / 2 + extra];
    });
    beam = section([[...top, ...[...top].reverse().map(([x, y]) => [x, -y] as Point)]]);
  } else if (p.mountStyle === "classic") {
    const rib = section([[[start, -p.armHeight / 2 - 16], [end, -p.armHeight / 2], [start, -p.armHeight / 2]]]);
    beam = keep(beam.add(rib));
  }
  const plate = keep(rect(wallX + 2, -foot / 2 + 2, p.plateThickness - 4, foot - 4).offset(2, "Round", 2, 24));
  let arm = keep(M.union([shoe, ex(beam, p.armWidth, mid - p.armWidth / 2), ex(plate, p.armWidth, mid - p.armWidth / 2)]));
  arm = sub(arm, ex(circle(R + c), H + 2, -1));
  for (const { angle, z } of mountHoles(p)) {
    // Pasante únicamente en el cuerpo. La arandela/cabeza se asienta dentro.
    cuts.push(radial(angle, z, 2.25, R - p.wall - 2, p.wall + 3));
    cuts.push(radial(angle, z, 5, R - p.wall - 2, 2.6));
    // Se instalan los insertos desde la cara de contacto del brazo, antes de
    // presentar el cuerpo. El fondo se conserva incluso bajo el lateral liso.
    arm = sub(arm, radial(angle, z, p.mountInsertDiameter / 2, R + c - 1, p.mountInsertDepth + 1));
  }
  let footprint = rect(-foot / 2, -p.armWidth / 2, foot, p.armWidth);
  for (const dy of [-foot / 2 + 10, foot / 2 - 10]) for (const dz of [-p.armWidth / 2 + 7, p.armWidth / 2 - 7]) {
    arm = sub(arm, cylinder(p.anchorDiameter / 2, p.plateThickness + 2, [wallX - 1, dy, mid + dz], [0, 90, 0]));
    footprint = keep(footprint.subtract(keep(circle(p.anchorDiameter / 2).translate([dy, dz]))));
  }
  const cable = cylinder(p.cableDiameter / 2, -wallX + 1, [wallX - 1, 0, mid], [0, 90, 0]);
  arm = sub(arm, cable); cuts.push(cable);
  parts.push({ solid: arm, id: "wall-arm-central", name: `Brazo central ${LIGHTBOX_MOUNT_STYLES[p.mountStyle].label.toLowerCase()} · fijación interior`, layer: "wallMount", printRotation: [0, 0, 0], motion: { vector: [-1, 0, 0], start: 80, travel: p.wallDistance + 45 } });
  return { parts, cuts, template: { name: "banderola-anclajes-pared", contours: footprint.toPolygons() } };
}
