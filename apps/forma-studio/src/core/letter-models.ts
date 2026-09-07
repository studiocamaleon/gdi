import type { CrossSection, Manifold, ManifoldToplevel } from "manifold-3d";
import type { Parameters, Part, StyleId } from "./types";
import { sweepOffsets, type Keeper, type ProfileLevel } from "./profile-sweep";
import { fitAssembly } from "./fit-assembly";
import { createFitBaseLetter } from "./fit-base-geometry";
import { organicRelief } from "./organic-relief";

export interface LetterParts {
  body: Manifold;
  face?: Manifold;
  back?: Manifold;
  pvc?: Manifold;
  faceMaterial?: Part["material"];
  backMaterial?: Part["material"];
  cavity: CrossSection;
  perforation?: { holes: number; openArea: number; frontArea: number };
}
const rad = (a: number) => (a * Math.PI) / 180;
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export function createLetter(
  wasm: ManifoldToplevel,
  keep: Keeper,
  s: CrossSection,
  style: StyleId,
  p: Parameters,
): LetterParts {
  if (
    style === "perforated" ||
    ((style === "acrylic-fit" || style === "printed-fit") &&
      p.fitBaseType !== "legacy")
  )
    return createFitBaseLetter(wasm, keep, s, style, p);
  const { Manifold: M } = wasm;
  const off = (c: CrossSection, d: number) => keep(c.offset(d, "Miter", 2, 48));
  const sub = (a: Manifold, b: Manifold) => keep(a.subtract(b));
  const union = (...a: Manifold[]) => keep(M.union(a));
  const diff = (a: CrossSection, b: CrossSection) => keep(a.subtract(b));
  const ex = (c: CrossSection, h: number, z = 0) =>
    h <= 0 || c.isEmpty()
      ? keep(M.union([]))
      : keep(keep(c.extrude(h)).translate([0, 0, z]));
  const ring = (c: CrossSection, w: number) => diff(c, off(c, -w));
  const sweep = (c: CrossSection, levels: ProfileLevel[]) =>
    sweepOffsets(wasm, keep, c, levels);
  // Las secciones del loft pasan por Float32. Prolongar sólo el vacío en sus
  // extremos impide membranas de espesor casi cero por redondeo contra una
  // extrusión o un plano de corte calculados en doble precisión.
  const sweepVoid = (c: CrossSection, levels: ProfileLevel[]) =>
    sweep(c, [
      { ...levels[0], z: levels[0].z - 0.01 },
      ...levels,
      { ...levels.at(-1)!, z: levels.at(-1)!.z + 0.01 },
    ]);
  const cavity = off(s, -p.wall),
    shell = diff(s, cavity);
  const cutFace = off(cavity, -p.cutClearance);
  const ramp = p.ledge * Math.tan(rad(p.supportAngle));
  // The point of a double ramp projects inward; a flat support keeps its upper face horizontal.
  function support(
    c: CrossSection,
    z: number,
    inverted = false,
    envelope?: Manifold,
  ) {
    const h = Math.max(0.01, ramp),
      flat = p.flatSupport && !inverted,
      end = z + (flat ? h : 2 * h);
    const levels = flat
      ? [
          { z, offset: 0 },
          { z: end, offset: -p.ledge },
        ]
      : [
          { z, offset: 0 },
          { z: z + h, offset: -p.ledge },
          { z: end, offset: 0 },
        ];
    const inner = sweepVoid(c, levels);
    const outside = envelope
      ? keep(
          keep(envelope.trimByPlane([0, 0, 1], z)).trimByPlane(
            [0, 0, -1],
            -end,
          ),
        )
      : ex(c, end - z, z);
    let solid = sub(outside, inner);
    if (inverted && flat)
      solid = keep(keep(solid.mirror([0, 0, 1])).translate([0, 0, z + end]));
    return solid;
  }
  function straightGuide(
    solid: Manifold,
    envelope: Manifold,
    opening: CrossSection,
    from: number,
    to: number,
  ) {
    const band = keep(
      keep(envelope.trimByPlane([0, 0, 1], from)).trimByPlane([0, 0, -1], -to),
    );
    // Superar los planos del loft Float32 también por abajo evita una
    // membrana coplanar entre el refuerzo y el vacío original.
    const passage = ex(opening, to - from + 0.02, from - 0.005);
    // Recortar un hueco no rellena las zonas ensanchadas por el perfil.
    // Reconstruir la banda deja una guía prismática en todo su espesor.
    return sub(union(solid, band), passage);
  }
  let body = ex(shell, p.height),
    face: Manifold | undefined,
    back: Manifold | undefined;
  let faceMaterial: Part["material"] = "acrylic",
    backMaterial: Part["material"] = "pvc";
  const requireHeight = (h: number, min: number) => {
    if (h <= min)
      throw new Error(
        "La altura no alcanza para el frente, el fondo y sus apoyos.",
      );
  };
  if (["solid-back", "open-back", "double-led"].includes(style)) {
    const base = style === "open-back" ? 0 : p.base,
      H = base + p.height;
    requireHeight(H, base + p.acrylic + (style === "open-back" ? p.pvc : 0));
    body = union(
      ex(shell, H),
      ex(s, base),
      ex(ring(cavity, p.innerWall), H - base - p.acrylic, base),
    );
    face = ex(cutFace, p.acrylic, H - p.acrylic);
    if (style === "open-back" && p.pvc > 0)
      back = ex(off(cavity, -p.innerWall - p.cutClearance), p.pvc);
    if (style === "double-led") {
      const ledOuter = off(cavity, -p.innerWall - p.gap);
      body = union(
        body,
        ex(ring(ledOuter, p.secondInnerWall), p.height - p.acrylic, p.base),
      );
    }
  } else if (style === "double-support" || style === "single-support") {
    const bottom = style === "single-support" ? p.base : p.pvc;
    requireHeight(p.height, p.acrylic + bottom + 4 * ramp);
    const top = p.height - p.acrylic;
    const profile: ProfileLevel[] = [{ z: 0, offset: 0 }];
    if (style === "double-support")
      profile.push(
        { z: p.pvc, offset: 0 },
        { z: p.pvc + ramp, offset: -p.ledge },
        { z: p.pvc + 2 * ramp, offset: 0 },
      );
    profile.push(
      { z: top - 2 * ramp, offset: 0 },
      { z: top - ramp, offset: -p.ledge },
      { z: top, offset: 0 },
      { z: p.height, offset: 0 },
    );
    if (p.flatSupport) {
      profile.splice(
        profile.length - 4,
        3,
        { z: top - ramp, offset: 0 },
        { z: top, offset: -p.ledge },
        { z: top, offset: 0 },
      );
    }
    body = sub(ex(s, p.height), sweepVoid(cavity, profile));
    face = ex(cutFace, p.acrylic, top);
    if (style === "single-support") body = union(body, ex(s, p.base));
    else back = ex(off(cavity, -p.cutClearance), p.pvc);
  } else if (style === "back-fit") {
    requireHeight(p.height, p.pvc + p.borderThickness + p.acrylic);
    body = union(
      body,
      ex(ring(cavity, p.innerWall), p.height - p.pvc),
      ex(ring(off(cavity, -p.innerWall), p.borderWidth), p.borderThickness),
    );
    face = ex(
      off(cavity, -p.innerWall - p.cutClearance),
      p.acrylic,
      p.borderThickness,
    );
    back = ex(off(cavity, -p.cutClearance), p.pvc, p.height - p.pvc);
  } else if (style === "acrylic-fit" || style === "printed-fit") {
    const {
      front,
      bodyHeight: height,
      baseHeight: capHeight,
      baseMin,
      baseMax,
    } = fitAssembly(style, p);
    requireHeight(height, front);
    if (
      capHeight <= p.traySheet ||
      capHeight > p.height - front ||
      (p.fitBaseHeight > 0 &&
        (capHeight < baseMin - 1e-6 || capHeight > baseMax + 1e-6))
    )
      throw new Error(
        "La base desmontable no entra en el cuerpo. Revisá su altura, el espesor del fondo y la holgura del encastre.",
      );
    body = ex(shell, height);
    if (style === "printed-fit") body = union(body, ex(s, p.base));
    else {
      body = union(body, ex(ring(cavity, p.borderWidth), p.borderThickness));
      face = ex(off(cavity, -p.cutClearance), p.acrylic, p.borderThickness);
    }
    const cap = off(cavity, -p.clearance);
    back = union(
      ex(ring(cap, p.innerWall), capHeight, p.height - capHeight),
      ex(cap, p.traySheet, p.height - p.traySheet),
    );
    if (p.outerRecess > p.clearance) {
      back = union(
        back,
        ex(
          ring(s, p.wall + p.clearance + p.innerWall),
          p.outerRecess - p.clearance,
          p.height - p.outerRecess + p.clearance,
        ),
        ex(s, p.traySheet, p.height - p.traySheet),
      );
    }
    backMaterial = "filament";
  } else if (style === "halo") {
    const H = p.base + p.height;
    body = union(ex(s, p.base), ex(shell, p.height, p.base));
    if (p.doubleHalo) {
      const innerOuter = off(cavity, -p.gap),
        innerCavity = off(innerOuter, -p.innerWall);
      body = union(
        ex(s, p.base),
        ex(shell, p.outerHeight, p.base),
        ex(ring(innerOuter, p.innerWall), p.height, p.base),
      );
      const r = Math.min(p.cornerRadius, p.wall / 2, p.base, p.outerHeight / 2);
      if (p.corner !== "Miter" && r > 0) {
        const edge = (z: number, top: boolean) =>
          Array.from({ length: p.corner === "Bevel" ? 2 : 9 }, (_, i) => {
            const t = i / (p.corner === "Bevel" ? 1 : 8);
            return {
              z: z + t * r,
              offset: top
                ? -r * (1 - Math.sqrt(Math.max(0, 1 - t * t)))
                : -r * (1 - Math.sqrt(Math.max(0, 1 - (1 - t) ** 2))),
            };
          });
        const baseRound = sweep(s, [...edge(0, false), { z: H, offset: 0 }]);
        body = keep(body.intersect(baseRound));
        const outerTop = p.base + p.outerHeight;
        const rounded = sweep(s, [
          { z: 0, offset: 0 },
          ...edge(outerTop - r, true),
        ]);
        const upperInner = ex(innerOuter, p.height - p.outerHeight, outerTop);
        body = keep(body.intersect(union(rounded, upperInner)));
      }
      if (p.backTray) {
        if (innerCavity.isEmpty())
          throw new Error(
            "No queda espacio para la bandeja entre las paredes internas.",
          );
        const tray = off(innerCavity, -p.clearance),
          D = p.trayDepth,
          pressure = p.retention;
        if (D <= p.traySheet)
          throw new Error(
            "El encastre del fondo debe superar el espesor de su chapa.",
          );
        const beadZ = H - D + 0.1 * D;
        const bead = sub(
          ex(innerCavity, 0.78 * D, beadZ),
          sweepVoid(innerCavity, [
            { z: beadZ, offset: 0 },
            { z: beadZ + 0.3 * D, offset: -pressure },
            { z: beadZ + 0.78 * D, offset: 0 },
          ]),
        );
        body = union(body, bead);
        back = union(
          ex(tray, p.traySheet, H - p.traySheet),
          ex(ring(tray, p.trayWall), D, H - D),
        );
        // Clear the mating bead with its lateral tolerance, keeping both solids disjoint.
        const groove = sub(
          ex(innerCavity, 0.78 * D, beadZ),
          sweepVoid(innerCavity, [
            { z: beadZ, offset: -p.clearance },
            { z: beadZ + 0.3 * D, offset: -pressure - p.clearance },
            { z: beadZ + 0.78 * D, offset: -p.clearance },
          ]),
        );
        back = sub(back, groove);
        backMaterial = "filament";
      }
    }
  } else if (style === "neon") {
    let channel = s,
      base = off(s, p.wall);
    if (p.neonOutline) {
      base = s;
      channel = ring(off(s, -p.wall), p.neonWidth);
    }
    const lo = p.base + p.neonPosition - p.neonRetentionHeight / 2,
      hi = lo + p.neonRetentionHeight;
    const levels: ProfileLevel[] = [{ z: p.base, offset: 0 }];
    if (p.neonRetention > 0) {
      if (lo < p.base || hi > p.base + p.height)
        throw new Error(
          "La traba del neón debe quedar dentro de la altura de la pared.",
        );
      levels.push(
        { z: lo, offset: 0 },
        { z: (lo + hi) / 2, offset: -p.neonRetention },
        { z: hi, offset: 0 },
      );
    }
    levels.push({ z: p.base + p.height, offset: 0 });
    const channelVoid = keep(
      sweepVoid(channel, levels).trimByPlane([0, 0, 1], p.base),
    );
    body = sub(ex(base, p.base + p.height), channelVoid);
  } else if (style === "organic") {
    const model = organicProfile(p);
    const outer = sweep(s, model.levels);
    if (p.organicSolid) body = outer;
    else if (p.organicFit === "back") {
      const inside = sweepVoid(off(s, -p.wall), model.levels),
        c = off(s, Math.min(...model.levels.map((l) => l.offset)) - p.wall),
        H = model.levels.at(-1)!.z;
      const faceReduction =
        p.clearance +
        (p.organicBack === "pvc" && p.organicPvcSupport ? p.ledge : 0);
      requireHeight(
        H,
        p.borderThickness +
          p.clearance +
          p.acrylic +
          (p.organicBack === "printed"
            ? p.organicCapSheet + p.organicCapHeight
            : p.pvc + (p.organicPvcSupport ? 2 * ramp : 0)),
      );
      if (p.borderWidth <= faceReduction)
        throw new Error(
          "El borde frontal debe ser más ancho que la holgura y el apoyo de PVC para retener el acrílico.",
        );
      const frontBand = keep(outer.trimByPlane([0, 0, -1], -p.borderThickness));
      body = union(
        sub(outer, inside),
        sub(frontBand, ex(off(c, -p.borderWidth), p.borderThickness)),
      );
      face = ex(
        off(c, -faceReduction),
        p.acrylic,
        p.borderThickness + p.clearance,
      );
      body = sub(
        body,
        ex(
          off(c, -faceReduction + 0.005),
          H,
          p.borderThickness + p.clearance - 0.005,
        ),
      );
      body = straightGuide(
        body,
        outer,
        off(c, -(faceReduction - p.clearance)),
        p.borderThickness,
        p.borderThickness + p.clearance + p.acrylic,
      );
      if (p.organicBack === "printed") {
        const cap = off(c, -p.organicCapClearance),
          D = p.organicCapSheet + p.organicCapHeight;
        back = union(
          ex(cap, p.organicCapSheet, H - p.organicCapSheet),
          ex(ring(cap, p.organicCapWall), D, H - D),
        );
        backMaterial = "filament";
        body = straightGuide(body, outer, c, H - D, H);
      } else {
        const plate = off(c, -p.pvcClearance);
        back = ex(plate, p.pvc, H - p.pvc);
        if (p.organicPvcSupport)
          body = union(body, support(c, H - p.pvc - 2 * ramp, false, outer));
        body = straightGuide(body, outer, c, H - p.pvc, H);
      }
    } else {
      const sculptedSeat = ["bubble", "stack"].includes(p.organicProfile);
      const seatWall = sculptedSeat ? Math.max(0.8, p.wall - 0.8) : p.wall;
      let interiorLevels = model.levels;
      if (sculptedSeat) {
        const plateau = model.faceZ - (p.flatSupport ? ramp : 2 * ramp);
        const limit = (z: number) =>
          p.wall -
          seatWall -
          p.ledge +
          Math.max(0, plateau - z) / Math.tan(rad(p.supportAngle));
        const rows: ProfileLevel[] = [];
        for (let i = 0; i < model.levels.length; i++) {
          const a = model.levels[i - 1],
            b = model.levels[i];
          if (a && a.z < plateau && b.z > plateau)
            rows.push({
              z: plateau,
              offset:
                a.offset +
                ((b.offset - a.offset) * (plateau - a.z)) / (b.z - a.z),
            });
          rows.push(b);
        }
        interiorLevels = [];
        for (let i = 0; i < rows.length; i++) {
          const a = rows[i - 1],
            b = rows[i];
          if (a) {
            const da = a.offset - limit(a.z),
              db = b.offset - limit(b.z);
            if (da * db < 0) {
              const t = da / (da - db);
              interiorLevels.push({
                z: a.z + (b.z - a.z) * t,
                offset: a.offset + (b.offset - a.offset) * t,
              });
            }
          }
          interiorLevels.push({
            z: b.z,
            offset: Math.min(b.offset, limit(b.z)),
          });
        }
      }
      // En Bubble/Frisos, una rampa une el interior decorativo al asiento
      // recto. La meseta sostiene el acrílico hasta su plano de apoyo.
      const inside = sweepVoid(off(s, -p.wall), interiorLevels);
      body = sub(outer, inside);
      if (p.organicBack === "printed")
        body = union(
          body,
          keep(
            outer.intersect(
              ex(
                off(s, Math.max(...model.levels.map((l) => l.offset)) + 1),
                p.base,
              ),
            ),
          ),
        );
      const c = off(s, -seatWall),
        faceZ = model.faceZ,
        advance = p.organicFace === "printed" ? p.organicFaceAdvance : 0,
        faceDepth = p.acrylic + advance;
      requireHeight(
        faceZ,
        (p.flatSupport ? ramp : 2 * ramp) +
          (p.organicBack === "printed" ? p.base : p.pvc + 2 * ramp),
      );
      // El avance prolonga el frente hacia afuera conservando su asiento.
      // Trasladar toda la placa dejaba un hueco entre el frente y su apoyo.
      face = ex(off(c, -p.clearance), faceDepth, faceZ);
      if (p.organicFace === "printed") {
        faceMaterial = "filament";
        const profile = off(c, -p.clearance),
          r = Math.min(p.organicFaceRadius, p.acrylic - 0.05);
        if (p.organicFaceCorner !== "straight" && r > 0) {
          const zs = Array.from(
            { length: p.organicFaceCorner === "round" ? 9 : 2 },
            (_, i) => {
              const t = i / (p.organicFaceCorner === "round" ? 8 : 1);
              return {
                z: faceZ + faceDepth - r + t * r,
                offset:
                  -r *
                  (p.organicFaceCorner === "round"
                    ? 1 - Math.sqrt(Math.max(0, 1 - t * t))
                    : t),
              };
            },
          );
          face = sweep(profile, [{ z: faceZ, offset: 0 }, ...zs]);
        }
        if (p.organicShell && p.organicShellThickness < faceDepth)
          face = sub(
            face,
            ex(
              off(profile, -p.organicShellThickness),
              faceDepth - p.organicShellThickness + 0.001,
              faceZ - 0.001,
            ),
          );
      }
      if (!sculptedSeat)
        body = union(
          body,
          support(c, faceZ - (p.flatSupport ? ramp : 2 * ramp), false, outer),
        );
      if (p.organicBack === "pvc") {
        const rear = off(s, model.levels[0].offset - p.wall - p.pvcClearance);
        back = ex(rear, p.pvc);
        body = union(
          body,
          support(off(s, model.levels[0].offset - p.wall), p.pvc, true, outer),
        );
        body = straightGuide(
          body,
          outer,
          off(s, model.levels[0].offset - p.wall),
          0,
          p.pvc,
        );
      }
      body = straightGuide(body, outer, c, faceZ, model.levels.at(-1)!.z);
    }
  }
  if (
    p.lipEnabled &&
    p.lip > 0 &&
    ["solid-back", "open-back", "double-support", "single-support"].includes(
      style,
    )
  ) {
    const exterior = keep(
      new wasm.CrossSection(
        s.toPolygons().filter(
          (c) =>
            c.reduce((sum, a, i) => {
              const b = c[(i + 1) % c.length];
              return sum + a[0] * b[1] - a[1] * b[0];
            }, 0) > 0,
        ),
      ),
    );
    body = union(body, ex(diff(off(exterior, p.lip), exterior), p.lipHeight));
  }
  return { body, face, back, faceMaterial, backMaterial, cavity };
}

export function organicProfile(p: Parameters): {
  levels: ProfileLevel[];
  faceZ: number;
} {
  const slope = Math.tan(rad(p.organicAngle)),
    ramp = p.ledge * Math.tan(rad(p.supportAngle));
  const sculpted = ["bumper", "bubble", "stack"].includes(p.organicProfile);
  const bodyStart =
    sculpted && p.organicProfile !== "bubble"
      ? 0
      : (p.organicBack === "printed" ? p.base : p.pvc) + 0.3;
  const rearFit = p.organicFit === "back" && !p.organicSolid;
  const start = rearFit ? 0 : p.organicSolid ? p.base : bodyStart,
    H = p.height;
  const peak =
    p.organicProfile === "stack"
      ? p.organicStackAdvance + 0.8
      : p.organicBumper;
  const bodyEnd = start + H;
  let end = p.organicSolid
    ? bodyEnd
    : bodyEnd + 0.5 + 2 * ramp + p.acrylic + p.clearance;
  if (p.organicProfile === "bubble" || p.organicProfile === "stack")
    end = bodyEnd;
  if (rearFit)
    end =
      H +
      (p.organicBack === "printed"
        ? p.organicCapHeight + p.organicCapSheet + 0.5
        : 0);
  const faceZ = rearFit
    ? p.borderThickness + p.clearance
    : end - p.acrylic - p.clearance;
  const cycles = Math.max(
    1,
    Math.round(
      H /
        (p.organicProfile === "waves" ? p.organicWavePeriod : p.organicPeriod),
    ),
  );
  const count = Math.min(256, Math.max(64, cycles * 24));
  const value = (z:number)=>organicRelief(p,z,start,H);
  const samples = new Set([0, start, bodyEnd, end, faceZ, faceZ - 2 * ramp]);
  for (let i = 0; i <= count; i++) samples.add(start + (H * i) / count);
  if (p.organicProfile === "bumper")
    for (const z of [
      peak / slope,
      peak / slope + p.organicFoot,
      (2 * peak) / slope + p.organicFoot,
    ])
      if (z < bodyEnd) samples.add(z);
  let levels = [...samples]
    .filter((z) => z >= 0 && z <= end)
    .sort((a, b) => a - b)
    .map((z) => ({ z, offset: value(z) }));
  // Limit overhang slope without discontinuities at either end of a smooth profile.
  if (p.organicProfile !== "bubble")
    for (let i = 1; i < levels.length; i++) {
      const prev = levels[i - 1],
        l = levels[i],
        limit = (l.z - prev.z) * slope;
      l.offset = clamp(l.offset, prev.offset - limit, prev.offset + limit);
    }
  return { levels, faceZ };
}
