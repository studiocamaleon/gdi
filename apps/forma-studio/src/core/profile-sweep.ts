import type { CrossSection, Manifold, ManifoldToplevel } from "manifold-3d";
import type { Contours, Point } from "./types";
export type Keeper = <T extends { delete(): void }>(v: T) => T;
export type ProfileLevel = { z: number; offset: number };
const area = (p: Point[]) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0) / 2;
function ordered(polys: Contours): Contours {
  return polys
    .map((poly) => {
      let start = 0;
      for (let i = 1; i < poly.length; i++)
        if (
          poly[i][0] < poly[start][0] - 1e-5 ||
          (Math.abs(poly[i][0] - poly[start][0]) < 1e-5 &&
            poly[i][1] < poly[start][1])
        )
          start = i;
      return [...poly.slice(start), ...poly.slice(0, start)];
    })
    .sort(
      (a, b) =>
        Math.sign(area(b)) - Math.sign(area(a)) ||
        Math.abs(area(b)) - Math.abs(area(a)),
    );
}
function parameterize(poly: Point[]) {
  const lengths = [0];
  for (let i = 0; i < poly.length; i++)
    lengths.push(
      lengths[i] +
        Math.hypot(
          poly[(i + 1) % poly.length][0] - poly[i][0],
          poly[(i + 1) % poly.length][1] - poly[i][1],
        ),
    );
  const total = lengths.at(-1)!;
  return {
    poly,
    knots: lengths.slice(0, -1).map((x) => x / total),
    total,
    lengths,
  };
}
/** Closed loft through actual 2D offsets. Caps keep holes; no bounding-box hulls. */
export function sweepOffsets(
  wasm: ManifoldToplevel,
  keep: Keeper,
  section: CrossSection,
  levels: ProfileLevel[],
): Manifold {
  const off = (d: number) => keep(section.offset(d, "Miter", 2, 48));
  const rows = levels.map((l) => ordered(off(l.offset).toPolygons()));
  if (rows.every((row) => !row.length)) return keep(wasm.Manifold.union([]));
  if (
    rows.some(
      (r) =>
        r.length !== rows[0].length ||
        r.some((p, i) => Math.sign(area(p)) !== Math.sign(area(rows[0][i]))),
    )
  )
    return sweepChangingTopology(wasm, keep, section, levels, rows);
  return loftRows(wasm, keep, rows, levels);
}

/** Secciona el barrido cuando un hueco nace, se cierra o divide un contorno.
 * A ambos lados se conserva el loft normal. La transición se localiza a
 * 0,001 mm de offset y se une con una banda cerrada de esa misma sección;
 * nunca se conectan por índice vértices de contornos que ya no corresponden.
 */
function sweepChangingTopology(
  wasm: ManifoldToplevel,
  keep: Keeper,
  section: CrossSection,
  levels: ProfileLevel[],
  rows: Contours[],
): Manifold {
  type Row = { level: ProfileLevel; polygons: Contours };
  const same = (a: Contours, b: Contours) =>
    a.length === b.length &&
    a.every((p, i) => Math.sign(area(p)) === Math.sign(area(b[i])));
  const samples: Row[] = [{ level: levels[0], polygons: rows[0] }];
  function transition(a: Row, b: Row, depth = 0) {
    if (
      same(a.polygons, b.polygons) ||
      Math.abs(a.level.offset - b.level.offset) <= 0.001 ||
      depth === 32
    ) {
      samples.push(b);
      return;
    }
    const level = {
      z: (a.level.z + b.level.z) / 2,
      offset: (a.level.offset + b.level.offset) / 2,
    };
    const middle = {
      level,
      polygons: ordered(
        keep(section.offset(level.offset, "Miter", 2, 48)).toPolygons(),
      ),
    };
    transition(a, middle, depth + 1);
    transition(middle, b, depth + 1);
  }
  for (let i = 1; i < rows.length; i++)
    transition(
      { level: levels[i - 1], polygons: rows[i - 1] },
      { level: levels[i], polygons: rows[i] },
    );
  const pieces: Manifold[] = [];
  let run: Row[] = [samples[0]];
  function finishRun() {
    if (
      run.length > 1 &&
      run[0].polygons.length &&
      run.at(-1)!.level.z > run[0].level.z
    )
      pieces.push(
        loftRows(
          wasm,
          keep,
          run.map((r) => r.polygons),
          run.map((r) => r.level),
        ),
      );
  }
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1],
      b = samples[i];
    if (same(a.polygons, b.polygons)) {
      run.push(b);
      continue;
    }
    finishRun();
    const bridge = keep(
      wasm.CrossSection.union([
        keep(new wasm.CrossSection(a.polygons)),
        keep(new wasm.CrossSection(b.polygons)),
      ]),
    );
    // Solapar los extremos elimina membranas entre planos Float32 y dobles.
    pieces.push(
      keep(
        keep(bridge.extrude(b.level.z - a.level.z + 0.002)).translate([
          0,
          0,
          a.level.z - 0.001,
        ]),
      ),
    );
    run = [b];
  }
  finishRun();
  return keep(wasm.Manifold.union(pieces));
}

function loftRows(
  wasm: ManifoldToplevel,
  keep: Keeper,
  rows: Contours[],
  levels: ProfileLevel[],
): Manifold {
  const vertices: number[] = [],
    triangles: number[] = [],
    starts: number[][] = [];
  rows.forEach((loops, j) => {
    const row: number[] = [];
    loops.forEach((poly) => {
      row.push(vertices.length / 3);
      poly.forEach(([x, y]) => vertices.push(x, y, levels[j].z));
    });
    starts.push(row);
  });
  for (let j = 0; j < rows.length - 1; j++)
    for (let k = 0; k < rows[j].length; k++) {
      const a = rows[j][k],
        b = rows[j + 1][k],
        ao = starts[j][k],
        bo = starts[j + 1][k];
      if (a.length === b.length) {
        for (let i = 0; i < a.length; i++) {
          const n = (i + 1) % a.length;
          triangles.push(ao + i, ao + n, bo + n, ao + i, bo + n, bo + i);
        }
        continue;
      }
      const pa = parameterize(a),
        pb = parameterize(b);
      let i = 0,
        l = 0;
      while (i < a.length || l < b.length) {
        const na =
          i < a.length ? (i + 1 === a.length ? 1 : pa.knots[i + 1]) : Infinity;
        const nb =
          l < b.length ? (l + 1 === b.length ? 1 : pb.knots[l + 1]) : Infinity;
        if (na <= nb) {
          triangles.push(
            ao + (i % a.length),
            ao + ((i + 1) % a.length),
            bo + (l % b.length),
          );
          i++;
        } else {
          triangles.push(
            ao + (i % a.length),
            bo + ((l + 1) % b.length),
            bo + (l % b.length),
          );
          l++;
        }
      }
    }
  for (const t of wasm.triangulate(rows[0], 1e-7, false))
    triangles.push(t[2], t[1], t[0]);
  const topOffset = starts.at(-1)![0];
  for (const t of wasm.triangulate(rows.at(-1)!, 1e-7, false))
    triangles.push(...t.map((i) => i + topOffset));
  const mesh = new wasm.Mesh({
    numProp: 3,
    vertProperties: new Float32Array(vertices),
    triVerts: new Uint32Array(triangles),
  });
  mesh.merge();
  const solid = keep(new wasm.Manifold(mesh));
  if (solid.status() !== "NoError")
    throw new Error(
      "No se pudo cerrar este perfil. Revisá el espesor y las dimensiones.",
    );
  return solid;
}
