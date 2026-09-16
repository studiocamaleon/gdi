import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  crearNavegacionNesting,
  balancePiezasNesting,
} from "@/lib/nesting-vista";
import type { NestingViewerInput } from "@/lib/productos-servicios-api";
import { NestingCanvas } from "./nesting-canvas";
import { NestingViewer } from "./nesting-viewer";
vi.mock("@/hooks/use-capas-fabricacion", () => ({
  useCapasFabricacion: (result: NestingViewerInput) => ({ result }),
}));
vi.mock("@/components/navigation/config-regional-provider", () => ({
  useConfigRegional: () => ({ moneda: "ARS" }),
}));

function placa(count = 1): NestingViewerInput {
  return {
    algorithm: "grid-2d-single",
    cantidadCalculada: count,
    unidad: "pliegos",
    aprovechamientoPct: 20,
    piezasAcomodadas: count,
    substrates: [{ kind: "sheet", count, widthMm: 300, heightMm: 200 }],
    placements: [
      {
        pieceId: "cartel",
        xMm: 10,
        yMm: 20,
        widthMm: 100,
        heightMm: 50,
        rotated: false,
        meta: { label: "Cartel" },
      },
    ],
    visualConfig: {
      margins: { leftMm: 10, rightMm: 15, topMm: 20, bottomMm: 5 },
      spacing: { horizontalMm: 2, verticalMm: 3 },
      allowRotation: false,
      usableArea: { xMm: 10, yMm: 20, widthMm: 275, heightMm: 175 },
    },
  };
}

describe("navegación del visor compartido", () => {
  it("abre el detalle para una superficie y layouts para varias, independientemente del algoritmo", () => {
    expect(crearNavegacionNesting(placa()).vistaInicial).toBe("detalle");
    for (const algorithm of [
      "grid-2d-single",
      "irregular-2d-bottom-left-v1",
    ] as const) {
      const r = { ...placa(25), algorithm };
      const nav = crearNavegacionNesting(r);
      expect(nav.vistaInicial).toBe("layouts");
      expect(nav.sustratos).toHaveLength(1);
      expect(nav.sustratos[0]).toMatchObject({
        desde: 1,
        hasta: 25,
        cantidad: 25,
        layout: "A",
      });
      expect(balancePiezasNesting(r)[0].colocadas).toBe(25);
    }
  });
  it("mantiene la relación layout/sustratos aunque se ordenen los layouts por repetición", () => {
    const r = placa();
    r.substrates.push({
      kind: "sheet",
      count: 10,
      widthMm: 300,
      heightMm: 200,
    });
    r.placements.push({ ...r.placements[0], substrateIndex: 1, xMm: 50 });
    const nav = crearNavegacionNesting(r);
    expect(nav.patrones[0]).toMatchObject({
      id: "A",
      indices: [1],
      repeticiones: 10,
    });
    expect(nav.sustratos.map((s) => [s.label, s.layout])).toEqual([
      ["Pliego 1", "B"],
      ["Pliegos 2–11", "A"],
    ]);
  });
  it("conserva detalle e instrucciones en rollos y cuadernillos", () => {
    const r = placa(25);
    r.outputsCanonicos = {
      plan_imposicion: {
        paginasSolicitadas: 8,
        paginasEfectivas: 8,
        paginasBlancas: 0,
        hojasPorLibro: 2,
        librosPorJuego: 1,
        juegos: 25,
        plan: [{ hoja: 1, frente: [8, 1], dorso: [2, 7] }],
      },
    };
    expect(crearNavegacionNesting(r).vistaInicial).toBe("detalle");
    const html = renderToStaticMarkup(
      <NestingViewer result={r} archivos={<span>Descargar corte</span>} />,
    );
    expect(html).toContain("Plan de imposición");
    expect(html).toContain("Esta distribución se usa en 25 sustratos");
    expect(html).toContain("Balance de piezas");
    expect(html).toContain("Archivos");
    r.substrates = [{ kind: "roll", widthMm: 1370, lengthMm: 2000 }];
    expect(crearNavegacionNesting(r)).toMatchObject({
      vistaInicial: "detalle",
      patrones: [],
    });
  });
  it("incluye demandas sin ninguna pieza colocada en el balance", () => {
    const r = placa(2);
    r.solucionNesting = {
      problema: {
        demandas: [
          { id: "cartel", cantidad: 3 },
          { id: "faltante", cantidad: 4 },
        ],
      },
    } as NonNullable<NestingViewerInput["solucionNesting"]>;
    expect(balancePiezasNesting(r)).toEqual([
      { id: "cartel", nombre: "Cartel", colocadas: 2, solicitadas: 3 },
      { id: "faltante", nombre: "faltante", colocadas: 0, solicitadas: 4 },
    ]);
  });
});

describe("base gráfica de miniaturas y detalle", () => {
  it("dibuja las mismas coordenadas, márgenes y colores en ambas escalas de presentación", () => {
    const r = placa();
    const antes = structuredClone(r);
    const dibujo = (compact: boolean) =>
      renderToStaticMarkup(
        <NestingCanvas
          result={r}
          compact={compact}
          showLabels={false}
          maxPx={600}
        />,
      );
    const mini = dibujo(true),
      detalle = dibujo(false);
    const pieza = (html: string) =>
      html.match(/<g data-piece-id="cartel"[\s\S]*?<\/g>/)?.[0];
    expect(pieza(mini)).toEqual(pieza(detalle));
    expect(pieza(detalle)).toContain('x="54" y="74" width="200" height="100"');
    expect(mini).toContain("clipPath");
    expect(r).toEqual(antes);
  });
  it("puede destacar una pieza sin borrar las demás ni cambiar sus coordenadas", () => {
    const r = placa();
    r.placements.push({ ...r.placements[0], pieceId: "otra", xMm: 120 });
    const html = renderToStaticMarkup(
      <NestingCanvas result={r} selectedPieceId="cartel" />,
    );
    expect(html).toContain('data-piece-id="cartel" opacity="1"');
    expect(html).toContain('data-piece-id="otra" opacity="0.18"');
  });
  it("conserva solapes, giro y modificaciones físicas del resultado", () => {
    const r = placa();
    r.substrates = [{ kind: "roll", widthMm: 300, lengthMm: 500 }];
    Object.assign(r.placements[0], {
      panelIndex: 1,
      panelCount: 2,
      panelAxis: "vertical",
      overlapEndMm: 10,
      rotated: true,
    });
    const html = renderToStaticMarkup(
      <NestingCanvas
        result={r}
        modificaciones={{
          demasia: { izquierdo: 5, derecho: 5, superior: 5, inferior: 5 },
          ojales: [],
        }}
      />,
    );
    expect(html).toContain("P1/2");
    expect(html).toContain("Girada 90°");
    expect(html).toContain("#d97706");
  });
});

it("mantiene copias e instrucciones de los talonarios fuera de la galería", () => {
  const r = placa(25);
  r.talonarioGrouping = {
    talonariosEfectivos: 10,
    talonariosPedidos: 10,
    posesXPliego: 2,
    talonariosPorGrupo: 2,
    gruposCompletos: 5,
    talonariosResiduo: 0,
    pliegosXCapa: 25,
    posesDesperdicio: 0,
    numerosXTalonario: 50,
    modoIncompleto: "rellenar",
  };
  expect(crearNavegacionNesting(r)).toMatchObject({
    patrones: [],
    vistaInicial: "detalle",
  });
  const html = renderToStaticMarkup(<NestingViewer result={r} copias={3} />);
  expect(html).toContain("Talonario");
  expect(html).toContain("original + duplicado + triplicado");
});

it("una tirada de cien mil hojas no genera cien mil dibujos ni opciones", () => {
  const r = placa(100_000);
  const html = renderToStaticMarkup(<NestingViewer result={r} />);
  expect((html.match(/role="img"/g) ?? []).length).toBe(1);
  expect(html).toContain("×100000");
});

it("una copia girada conserva el color de su pieza", () => {
  const r = placa();
  r.placements.push({
    ...r.placements[0],
    rotated: true,
    widthMm: 50,
    heightMm: 100,
    xMm: 130,
  });
  const html = renderToStaticMarkup(<NestingCanvas result={r} />);
  const colores = [
    ...html.matchAll(/data-piece-id="cartel"[\s\S]*?<rect[^>]*fill="([^"]+)"/g),
  ].map((m) => m[1]);
  expect(colores).toHaveLength(2);
  expect(colores[0]).toBe(colores[1]);
});
