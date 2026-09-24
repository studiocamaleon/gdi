import type { CrossSection, ManifoldToplevel } from "manifold-3d";
import type { Parameters, StyleId } from "./types";
import type { LetterParts } from "./letter-models";
import { fitAssembly } from "./fit-assembly";
import { sweepOffsets, type Keeper, type ProfileLevel } from "./profile-sweep";
import { createPerforation } from "./perforation";

/** Perfil exterior. La cavidad prismática usa el menor contorno del perfil:
 * ningún relieve puede estrechar el recorrido de entrada de una placa rígida. */
export function fitWallLevels(p: Parameters): ProfileLevel[] {
  const H = p.height;
  if (p.fitWallProfile === "straight")
    return [
      { z: 0, offset: 0 },
      { z: H, offset: 0 },
    ];
  const from = p.fitProfileTop,
    to = H - p.fitProfileBottom;
  if (from < 0 || to <= from || p.fitProfileAngle < 0 || p.fitProfileAngle > 60)
    throw new Error(
      "Revisá los tramos rectos y el ángulo del perfil de pared.",
    );
  const sign = p.fitProfileDirection === "inward" ? -1 : 1;
  const amplitude =
    (Math.tan((p.fitProfileAngle * Math.PI) / 180) * (to - from)) /
    (p.fitWallProfile === "bevel"
      ? 1
      : p.fitWallProfile === "curved"
        ? Math.PI
        : 2);
  const levels: ProfileLevel[] = [{ z: 0, offset: 0 }];
  if (from > 0) levels.push({ z: from, offset: 0 });
  const count = p.fitWallProfile === "curved" ? 24 : 2;
  for (let i = 1; i <= count; i++) {
    const t = i / count;
    const f =
      p.fitWallProfile === "bevel"
        ? t
        : p.fitWallProfile === "curved"
          ? Math.sin(t * Math.PI)
          : 1 - Math.abs(2 * t - 1);
    levels.push({ z: from + t * (to - from), offset: sign * amplitude * f });
  }
  if (to < H) levels.push({ z: H, offset: levels.at(-1)!.offset });
  return levels;
}

/** Recetas de bases desmontables; el frente se fabrica en Z mínimo. */
export function createFitBaseLetter(
  wasm: ManifoldToplevel,
  keep: Keeper,
  s: CrossSection,
  style: StyleId,
  p: Parameters,
): LetterParts {
  const { Manifold: M } = wasm;
  const off = (c: CrossSection, d: number) => keep(c.offset(d, "Miter", 2, 48));
  const diff = (a: CrossSection, b: CrossSection) => keep(a.subtract(b));
  const ring = (c: CrossSection, width: number) => diff(c, off(c, -width));
  const ex = (c: CrossSection, h: number, z = 0) =>
    keep(keep(c.extrude(h)).translate([0, 0, z]));
  const union = (...parts: LetterParts["body"][]) => keep(M.union(parts));
  const a = fitAssembly(style, p),
    H = p.height,
    type = p.fitBaseType;
  const lock = type === "pvc-lock",
    framed = type === "ring-pvc";
  const acrylic = style === "acrylic-fit";
  const perforated = style === "perforated";
  if (perforated && type === "legacy")
    throw new Error("Elegí una de las seis bases del frente calado.");
  if (
    p.wall < 0.5 ||
    p.innerWall < 0.5 ||
    p.traySheet < 0.5 ||
    p.clearance < 0 ||
    p.cutClearance < 0 ||
    (perforated && p.acrylic <= 0) ||
    (!acrylic && p.base < 0.5) ||
    (acrylic &&
      (p.borderWidth <= p.cutClearance ||
        p.acrylic <= 0 ||
        p.borderThickness < 0.5))
  )
    throw new Error(
      "Revisá los espesores y las holguras: el acrílico debe conservar apoyo continuo.",
    );
  if (
    a.bodyHeight <= a.front ||
    (!lock &&
      (a.baseHeight < a.baseMin - 1e-6 || a.baseHeight > a.baseMax + 1e-6))
  )
    throw new Error(
      "La base desmontable no entra en el cuerpo. Revisá altura, fondo y paredes.",
    );
  if ((lock || framed) && (p.pvc <= 0 || p.pvcClearance < 0))
    throw new Error("Revisá el espesor y la holgura del fondo de PVC.");
  const levels = lock
    ? fitWallLevels(p)
    : [
        { z: 0, offset: 0 },
        { z: a.bodyHeight, offset: 0 },
      ];
  const minOffset = Math.min(...levels.map((l) => l.offset));
  const cavity = off(s, minOffset - p.wall);
  const frontOpening = lock ? off(cavity, -p.fitLockDepth) : cavity;
  const cap = off(cavity, -p.clearance),
    inside = off(cap, -p.innerWall);
  if (cavity.isEmpty() || frontOpening.isEmpty() || (!lock && inside.isEmpty()))
    throw new Error(
      "El trazo es demasiado estrecho para esta base y sus paredes. Aumentá la letra o reducí los espesores.",
    );
  const envelope = lock
    ? sweepOffsets(wasm, keep, s, levels)
    : ex(s, a.bodyHeight);
  let body = keep(envelope.subtract(ex(cavity, a.bodyHeight + 0.02, -0.01)));
  if (acrylic)
    body = union(
      body,
      ex(diff(s, off(frontOpening, -p.borderWidth)), p.borderThickness),
    );
  else body = union(body, ex(s, p.base));
  const diffuser = off(frontOpening, -p.cutClearance);
  const face =
    acrylic || perforated
      ? ex(diffuser, p.acrylic, perforated ? p.base : p.borderThickness)
      : undefined;
  let perforation: LetterParts["perforation"];
  if (perforated) {
    const pattern = createPerforation(wasm, keep, s, diffuser, p);
    if (pattern.count)
      body = keep(body.subtract(ex(pattern.holes, p.base + 0.02, -0.01)));
    perforation = {
      holes: pattern.count,
      openArea: pattern.area,
      frontArea: pattern.frontArea,
    };
  }

  if (lock) {
    const seat = H - p.pvc - p.fitLockOffset,
      start = seat - p.fitLockHeight;
    if (
      p.fitLockDepth <= 0 ||
      p.fitLockHeight < 0.5 ||
      p.fitLockDepth * 0.6 <= p.pvcClearance ||
      start <= a.front
    )
      throw new Error(
        "La traba necesita espacio entre el frente y el PVC, y un apoyo mayor que la holgura.",
      );
    if (p.fitWallProfile !== "straight" && p.fitProfileTop < a.front)
      throw new Error(
        "El tramo recto frontal debe contener el frente y su apoyo.",
      );
    // Trapezoide unido a la pared; su cara posterior detiene el PVC. No
    // invade el alojamiento del PVC. El acrílico atraviesa su sección mínima.
    const voidLevels = [
      { z: start - 0.01, offset: 0 },
      { z: start, offset: 0 },
      { z: start + p.fitLockHeight * 0.25, offset: -p.fitLockDepth },
      { z: start + p.fitLockHeight * 0.75, offset: -p.fitLockDepth },
      { z: seat, offset: -p.fitLockDepth * 0.6 },
      { z: seat + 0.01, offset: -p.fitLockDepth * 0.6 },
    ];
    // Solapar 0,01 mm con la pared evita contactos tangenciales al convertir
    // las curvas del loft a Float32; no cambia el paso libre ni el asiento.
    body = union(
      body,
      keep(
        ex(off(cavity, 0.01), p.fitLockHeight, start).subtract(
          sweepOffsets(wasm, keep, cavity, voidLevels),
        ),
      ),
    );
    return {
      body,
      face,
      faceMaterial: "acrylic",
      pvc: ex(off(cavity, -p.pvcClearance), p.pvc, seat),
      cavity,
      perforation,
    };
  }

  const baseZ = H - a.baseHeight,
    floorZ = H - p.traySheet;
  let back = ex(ring(cap, p.innerWall), a.baseHeight, baseZ);
  let pvc: LetterParts["pvc"];
  if (framed) {
    if (p.fitRingWidth <= p.pvcClearance)
      throw new Error("El apoyo del marco debe superar la holgura del PVC.");
    const opening = off(inside, -p.fitRingWidth);
    if (opening.isEmpty())
      throw new Error("El trazo no deja espacio para el anillo y el PVC.");
    back = union(back, ex(diff(s, opening), p.traySheet, floorZ));
    pvc = ex(off(inside, -p.pvcClearance), p.pvc, floorZ - p.pvc);
  } else {
    const floor =
      type === "inset"
        ? cap
        : type === "rim"
          ? off(s, p.clearance + p.fitRimWall)
          : s;
    back = union(back, ex(floor, p.traySheet, floorZ));
  }
  if (type === "rim") {
    if (p.fitRimWall < 0.5 || p.fitRimHeight <= 0)
      throw new Error("El reborde necesita pared y altura positivas.");
    back = union(
      back,
      ex(
        diff(off(s, p.clearance + p.fitRimWall), off(s, p.clearance)),
        p.fitRimHeight,
        floorZ - p.fitRimHeight,
      ),
    );
  }
  if (type === "double-channel") {
    if (
      p.fitChannelGap <= 0 ||
      p.fitChannelFloor <= 0 ||
      p.fitChannelHeight <= 0 ||
      p.secondInnerWall < 0.5
    )
      throw new Error(
        "Revisá la separación, el suelo del canal y la segunda pared.",
      );
    const second = off(inside, -p.fitChannelGap);
    if (off(second, -p.secondInnerWall).isEmpty())
      throw new Error("El trazo no deja espacio para el doble canal.");
    back = union(
      back,
      ex(inside, p.fitChannelFloor, floorZ - p.fitChannelFloor),
      ex(
        ring(second, p.secondInnerWall),
        p.fitChannelHeight,
        floorZ - p.fitChannelFloor - p.fitChannelHeight,
      ),
    );
  }
  return {
    body,
    face,
    faceMaterial: "acrylic",
    back,
    pvc,
    backMaterial: "filament",
    cavity,
    perforation,
  };
}
