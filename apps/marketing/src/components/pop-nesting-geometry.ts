/** Geometría ilustrativa del exhibidor; las mismas siete piezas en las tres vistas. */
export type Point = [number, number];
type Point3 = [number, number, number];
export type PopPanel = {
  id: string;
  label: string;
  outline: Point[];
  color: string;
  world: (p: Point) => Point3;
  explode: Point3;
  flat: (p: Point) => Point;
};
const profile: Point[] = [
  [0, 0],
  [28, 0],
  [28, 38],
  [42, 38],
  [84, 210],
  [84, 252],
  [0, 252],
];
const shelf = (depth: number): Point[] => [
  [0, 5],
  [5, 0],
  [145, 0],
  [150, 5],
  [150, depth - 5],
  [145, depth],
  [5, depth],
  [0, depth - 5],
];
export const POP_PANELS: PopPanel[] = [
  {
    id: "left",
    label: "Lateral izquierdo",
    outline: profile,
    color: "#759282",
    world: ([u, v]) => [-75, 252 - v, u],
    explode: [-74, 0, 0],
    flat: ([u, v]) => [12 + u, 14 + v],
  },
  {
    id: "header",
    label: "Cabecera",
    outline: [
      [0, 60],
      [0, 18],
      [18, 0],
      [132, 0],
      [150, 18],
      [150, 60],
    ],
    color: "#f1eada",
    world: ([u, v]) => [u - 75, 252 - v, 0],
    explode: [0, 52, -14],
    flat: ([u, v]) => [378 - v, 14 + u],
  },
  {
    id: "shelf-top",
    label: "Estante superior",
    outline: shelf(40),
    color: "#ded8c8",
    world: ([u, v]) => [u - 75, 168, v],
    explode: [0, 12, 42],
    flat: ([u, v]) => [158 + u, 180 + v],
  },
  {
    id: "shelf-mid",
    label: "Estante central",
    outline: shelf(62),
    color: "#e9e2d2",
    world: ([u, v]) => [u - 75, 94, v],
    explode: [0, 0, 50],
    flat: ([u, v]) => [158 + u, 108 + v],
  },
  {
    id: "shelf-base",
    label: "Estante inferior",
    outline: shelf(84),
    color: "#f5ecda",
    world: ([u, v]) => [u - 75, 20, v],
    explode: [0, -12, 58],
    flat: ([u, v]) => [158 + u, 14 + v],
  },
  {
    id: "front",
    label: "Frente",
    outline: [
      [0, 0],
      [150, 0],
      [150, 32],
      [0, 32],
    ],
    color: "#ff784b",
    world: ([u, v]) => [u - 75, 52 - v, 84],
    explode: [0, -8, 100],
    flat: ([u, v]) => [158 + u, 232 + v],
  },
  {
    id: "right",
    label: "Lateral derecho",
    outline: profile,
    color: "#3f6554",
    world: ([u, v]) => [75, 252 - v, u],
    explode: [74, 0, 0],
    flat: ([u, v]) => [64 + 84 - u, 14 + 252 - v],
  },
];
function project([x, y, z]: Point3): Point {
  return [(x - z) * 0.866, (x + z) * 0.5 - y];
}
function worldPoint(panel: PopPanel, point: Point, exploded: boolean): Point {
  const p = panel.world(point);
  return project(
    p.map((value, i) => value + (exploded ? panel.explode[i] : 0)) as Point3,
  );
}
function fit(exploded: boolean) {
  const points = POP_PANELS.flatMap((p) =>
    p.outline.map((v) => worldPoint(p, v, exploded)),
  );
  const minX = Math.min(...points.map((p) => p[0])),
    maxX = Math.max(...points.map((p) => p[0]));
  const minY = Math.min(...points.map((p) => p[1])),
    maxY = Math.max(...points.map((p) => p[1]));
  const scale = Math.min(476 / (maxX - minX), 354 / (maxY - minY));
  return (p: Point): Point => [
    300 + (p[0] - (minX + maxX) / 2) * scale,
    228 + (p[1] - (minY + maxY) / 2) * scale,
  ];
}
const fitAssembled = fit(false),
  fitExploded = fit(true);
export function panelPoints(
  panel: PopPanel,
  points: Point[],
  stage: number,
): Point[] {
  if (stage === 2)
    return points
      .map((p) => panel.flat(p))
      .map(([x, y]) => [46 + x * 1.27, 46 + y * 1.27]);
  const transform = stage === 1 ? fitExploded : fitAssembled;
  return points.map((p) => transform(worldPoint(panel, p, stage === 1)));
}
export function polygonPath(points: Point[]) {
  return (
    points
      .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`)
      .join(" ") + " Z"
  );
}
export function panelPaths(panel: PopPanel, outline = panel.outline) {
  return [0, 1, 2].map((stage) =>
    polygonPath(panelPoints(panel, outline, stage)),
  );
}
/** Matriz SVG afín para que las marcas acompañen cada pieza, incluso al girar. */
export function panelMatrices(panel: PopPanel) {
  return [0, 1, 2].map((stage) => {
    const [o, x, y] = panelPoints(
      panel,
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      stage,
    );
    return `matrix(${x[0] - o[0]}, ${x[1] - o[1]}, ${y[0] - o[0]}, ${y[1] - o[1]}, ${o[0]}, ${o[1]})`;
  });
}
export const POP_PACKAGES = [20, 94, 168].flatMap((y, row) =>
  [-39, 14].map((x, col) => {
    const z = [40, 25, 8][row],
      w = 26,
      h = 36,
      d = 19;
    const p = (dx: number, dy: number, dz: number) =>
      fitAssembled(project([x + dx, y + dy, z + dz]));
    return {
      id: `${row}-${col}`,
      color: col ? "#bcca9f" : "#e5a47a",
      faces: [
        polygonPath([p(0, h, 0), p(w, h, 0), p(w, h, d), p(0, h, d)]),
        polygonPath([p(w, 0, 0), p(w, 0, d), p(w, h, d), p(w, h, 0)]),
        polygonPath([p(0, 0, d), p(w, 0, d), p(w, h, d), p(0, h, d)]),
      ],
    };
  }),
);
