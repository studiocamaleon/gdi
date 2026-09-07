import { beforeAll, it, expect } from "vitest";
import Module, { type ManifoldToplevel } from "manifold-3d";
import { sweepOffsets } from "../src/core/profile-sweep";
let w: ManifoldToplevel;
beforeAll(async () => {
  w = await Module();
  w.setup();
});
for (const [offset, volume] of [
  [0, 13600],
  [-1, 13100],
  [3, 15100],
])
  it(`cierra el perfil de offset ${offset} sin perder el agujero ni volumen`, () => {
    const owned = new Set<{ delete(): void }>();
    const keep = <T extends { delete(): void }>(x: T): T => {
      owned.add(x);
      return x;
    };
    try {
      const cs = keep(
        new w.CrossSection([
          [
            [0, 0],
            [100, 0],
            [100, 80],
            [0, 80],
          ],
          [
            [30, 25],
            [30, 55],
            [70, 55],
            [70, 25],
          ],
        ]),
      );
      const solid = sweepOffsets(w, keep, cs, [
        { z: 0, offset: 0 },
        { z: 1, offset },
        { z: 2, offset: 0 },
      ]);
      const slice = keep(solid.slice(1));
      expect(slice.toPolygons()).toHaveLength(2);
      expect(solid.volume()).toBeCloseTo(volume, 3);
      const mesh = solid.getMesh(),
        roundtrip = keep(
          new w.Manifold(
            new w.Mesh({
              numProp: 3,
              vertProperties: mesh.vertProperties,
              triVerts: mesh.triVerts,
            }),
          ),
        );
      expect(roundtrip.status()).toBe("NoError");
      expect(roundtrip.volume()).toBeCloseTo(volume, 3);
    } finally {
      [...owned].reverse().forEach((x) => x.delete());
    }
  });

for (const offsets of [
  [0, 12],
  [12, 0],
  [0, 12, 0],
])
  it(`cierra y reabre el hueco sin túneles al barrer ${offsets.join(" → ")}`, () => {
    const owned = new Set<{ delete(): void }>();
    const keep = <T extends { delete(): void }>(v: T): T => {
      owned.add(v);
      return v;
    };
    try {
      const section = keep(
        new w.CrossSection([
          [
            [0, 0],
            [100, 0],
            [100, 80],
            [0, 80],
          ],
          [
            [40, 30],
            [40, 50],
            [60, 50],
            [60, 30],
          ],
        ]),
      );
      const model = sweepOffsets(
        w,
        keep,
        section,
        offsets.map((offset, z) => ({ z, offset })),
      );
      expect(model.status()).toBe("NoError");
      // Integral exacta de (100+2d)(80+2d) − max(20−2d,0)².
      const exact = (offsets.length - 1) * (10352 - 1000 / 9);
      expect(Math.abs(model.volume() - exact) / exact).toBeLessThan(0.000001);
      const closingSlice = offsets[0] === 12 ? 0.1 : 0.9;
      expect(keep(model.slice(closingSlice)).toPolygons()).toHaveLength(1);
      expect(
        keep(model.slice(offsets[0] === 12 ? 0.9 : 0.1)).toPolygons(),
      ).toHaveLength(2);
    } finally {
      [...owned].reverse().forEach((v) => v.delete());
    }
  });

it("conserva el hueco nuevo al cerrarse la boca de una C", () => {
  const owned = new Set<{ delete(): void }>();
  const keep = <T extends { delete(): void }>(v: T): T => {
    owned.add(v);
    return v;
  };
  try {
    const section = keep(
      new w.CrossSection([
        [
          [0, 0],
          [100, 0],
          [100, 38],
          [70, 38],
          [70, 20],
          [20, 20],
          [20, 60],
          [70, 60],
          [70, 42],
          [100, 42],
          [100, 80],
          [0, 80],
        ],
      ]),
    );
    const model = sweepOffsets(w, keep, section, [
      { z: 0, offset: 0 },
      { z: 1, offset: 3 },
    ]);
    expect(model.status()).toBe("NoError");
    expect(keep(model.slice(0.1)).toPolygons()).toHaveLength(1);
    expect(keep(model.slice(0.9)).toPolygons()).toHaveLength(2);
    // Integral analítica de la C abierta hasta d=2 y del anillo después.
    const exact = 6768 + 2 / 9;
    expect(Math.abs(model.volume() - exact) / exact).toBeLessThan(0.000001);
  } finally {
    [...owned].reverse().forEach((v) => v.delete());
  }
});
