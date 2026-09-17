import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VERSION_POLITICA_ORIENTACION_GRAFONEST } from "../../../apps/api/src/workers/colas";
import {
  resolverConfiguracionEncastresVectoriales,
  type AnalisisSvgFabricacion,
  type SolucionNestingVectorial,
} from "@/lib/productos-servicios-api";
import type { PropuestaItem } from "@/lib/propuestas";
import { analisisVectorialDesdeItem } from "./agregar-producto-sheet";
import {
  DisenoVectorialCotizador,
  type FuenteDisenoVectorial,
} from "./diseno-vectorial-cotizador";

const fuente: FuenteDisenoVectorial = {
  schemaVersion: 1,
  nombreArchivo: "cartel-polyfan.svg",
  svg: '<svg viewBox="0 0 300 200"><path d="M0 0H300L0 200Z"/></svg>',
  anchoFinalMm: 300,
  altoFinalMm: 200,
};
const configuracionEncastres = resolverConfiguracionEncastresVectoriales(null);
const contornos = [
  {
    esHueco: false,
    puntos: [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 0, y: 200 }],
  },
];

function crearAnalisis(
  motorNesting: NonNullable<AnalisisSvgFabricacion["nesting"]["motorNesting"]>,
): AnalisisSvgFabricacion {
  return {
    nombreArchivo: fuente.nombreArchivo,
    configuracionEncastres,
    geometria: {
      schemaVersion: 1,
      anchoMm: 300,
      altoMm: 200,
      areaTotalMm2: 30_000,
      perimetroTotalMm: 860.555,
      hashFuente: "polyfan-test",
      piezas: [{
        id: "pieza-1",
        anchoMm: 300,
        altoMm: 200,
        areaMm2: 30_000,
        perimetroMm: 860.555,
        contornos,
      }],
    },
    nesting: {
      algorithm: "irregular-2d-bottom-left-v1",
      motorNesting,
      // Se toma del worker para detectar un desfase en futuros cambios del motor.
      versionPoliticaOrientacion: VERSION_POLITICA_ORIENTACION_GRAFONEST,
      placas: 1,
      anchoPlacaMm: 1200,
      altoPlacaMm: 600,
      anchoUtilMm: 1180,
      altoUtilMm: 580,
      aprovechamientoPct: 4.38,
      areaPiezasMm2: 30_000,
      areaCompradaMm2: 720_000,
      estrategiaDisposicion: "nesting_optimizado",
      placements: [{
        pieceId: "pieza-1",
        copyIndex: 0,
        substrateIndex: 0,
        xMm: 10,
        yMm: 10,
        rotacion: 0,
        anchoMm: 300,
        altoMm: 200,
        contornos: contornos.map((contorno) => ({
          ...contorno,
          puntos: contorno.puntos.map(({ x, y }) => ({ x: x + 10, y: y + 10 })),
        })),
      }],
    },
    diagnosticos: [],
  };
}

function renderizar(analisis: AnalisisSvgFabricacion | null, cantidad = 1, cargandoConfiguracion = false) {
  return renderToStaticMarkup(
    <DisenoVectorialCotizador
      value={fuente}
      analisis={analisis}
      modoCotizacion="svg"
      cotizacionManual={{ placas: 1, metrosCortePorPlaca: 1 }}
      cantidad={cantidad}
      placa={{ anchoMm: 1200, altoMm: 600 }}
      margenMm={10}
      configuracionEncastres={configuracionEncastres}
      cargandoConfiguracion={cargandoConfiguracion}
      onChange={() => undefined}
      onCotizacionManualChange={() => undefined}
    />,
  );
}

describe("nesting irregular del cotizador de Polyfan", () => {
  it.each(["opennest-v1", "grafonest-baseline-v1", "grafonest-packingsolver-v1"] as const)(
    "conserva y muestra el resultado actual del worker %s",
    (motor) => {
      const html = renderizar(crearAnalisis(motor));

      expect(html).toContain('data-ready="true"');
      expect(html).toContain("Distribución en placas");
      expect(html).toContain("Regenerar nesting");
      expect(html).not.toContain(">Pendiente<");
    },
  );

  it("pide regenerar un resultado de una política anterior", () => {
    const analisis = crearAnalisis("opennest-v1");
    analisis.nesting.versionPoliticaOrientacion =
      VERSION_POLITICA_ORIENTACION_GRAFONEST - 1;

    expect(renderizar(analisis)).toContain('data-ready="false"');
  });

  it("invalida el resultado si cambia la cantidad o la placa", () => {
    const analisis = crearAnalisis("opennest-v1");
    expect(renderizar(analisis, 2)).toContain('data-ready="false"');

    analisis.nesting.anchoPlacaMm = 1000;
    expect(renderizar(analisis)).toContain('data-ready="false"');
  });

  it("mantiene pendiente un archivo que todavía no se calculó", () => {
    const html = renderizar(null);

    expect(html).toContain('data-ready="false"');
    expect(html).toContain(">Pendiente<");
    expect(html).not.toContain("Distribución en placas");
  });
});

function itemGuardado(analisis: AnalisisSvgFabricacion): PropuestaItem {
  const solucionNesting: SolucionNestingVectorial = {
    schemaVersion: 1,
    algoritmo: "irregular-2d-bottom-left",
    versionAlgoritmo: 1,
    problemaHash: "problema-guardado",
    problema: {
      schemaVersion: 1,
      superficie: { tipo: "PLACA", anchoMm: 1200, altoMm: 600 },
      demandas: analisis.geometria.piezas.map(({ id, ...geometria }) => ({
        schemaVersion: 1,
        id,
        cantidad: 1,
        geometria: { tipo: "POLIGONO", ...geometria },
      })),
      configuracion: {
        margenMm: 10,
        separacionMm: 5,
        permitirRotacion: true,
        permitirSegmentacion: true,
        preservarComposicionOriginalSiEntra: false,
        configuracionEncastres: analisis.configuracionEncastres,
      },
    },
    resultado: analisis.nesting,
    diagnosticos: analisis.diagnosticos,
  };
  // Después de recargar la OT sólo se recuperan los inputs y la trazabilidad;
  // no existen disenoVectorialAnalisis ni jobContext.geometriaVectorial.
  return JSON.parse(JSON.stringify({
    cantidad: 1,
    jobContext: {
      disenoVectorialFuente: fuente,
      disenoVectorialCacheKey: "cache-guardado",
    },
    cotizacion: {
      pasos: [{
        nestingResult: {
          algorithm: analisis.nesting.algorithm,
          substrates: [{ kind: "sheet", widthMm: 1200, heightMm: 600, count: 1 }],
          placements: [],
          solucionNesting,
        },
      }],
    },
  }));
}

describe("edición de un ítem con nesting persistido", () => {
  it("espera la configuración de corte antes de ofrecer un nuevo cálculo", () => {
    const restaurado = analisisVectorialDesdeItem(itemGuardado(crearAnalisis("opennest-v1")));
    const html = renderizar(restaurado, 1, true);

    expect(html).toContain("Cargando configuración de corte");
    expect(html).not.toContain("Generar nesting");
    expect(renderizar(restaurado, 1, false)).toContain('data-ready="true"');
  });

  it("recupera el análisis desde la trazabilidad y habilita el editor sin regenerar", () => {
    const original = crearAnalisis("opennest-v1");
    const restaurado = analisisVectorialDesdeItem(itemGuardado(original));

    expect(restaurado?.nesting).toEqual(original.nesting);
    expect(restaurado?.cacheKey).toBe("cache-guardado");
    expect(restaurado?.geometria).toMatchObject({
      anchoMm: 300,
      altoMm: 200,
      areaTotalMm2: 30_000,
      perimetroTotalMm: 860.555,
      piezas: original.geometria.piezas,
    });
    expect(renderizar(restaurado)).toContain('data-ready="true"');
  });

  it("conserva rotaciones, cortes, segmentos y encastres sin proyectarlos al visor genérico", () => {
    const original = crearAnalisis("opennest-v1");
    original.nesting.placements[0].rotacion = 270;
    original.nesting.placements[0].cortesInternos = contornos;
    original.nesting.placements[0].segmentacion = {
      piezaOrigenId: "pieza-1", indice: 0, total: 2,
      origenXmm: 0, origenYmm: 0, unionesIds: ["union-1"],
    };
    original.nesting.placements.push({
      ...original.nesting.placements[0], pieceId: "pieza-1-segmento-2", rotacion: 37,
    });
    original.nesting.piezasOriginales = 1;
    original.nesting.segmentos = 2;
    original.nesting.perimetroCorteMm = 1240;
    original.nesting.unionesFisicas = 1;
    original.nesting.uniones = [{
      id: "union-1", piezaOrigenId: "pieza-1", tipoEncastre: "recta",
      eje: "vertical", posicionMm: 150, largoMm: 200, cantidadEncastres: 2,
      anchoEncastreMm: 30, profundidadEncastreMm: 30, kerfMm: 0.3,
    }];
    original.configuracionEncastres = resolverConfiguracionEncastresVectoriales({ tipoUnion: "recta" });
    const restaurado = analisisVectorialDesdeItem(itemGuardado(original));

    expect(restaurado?.nesting).toEqual(original.nesting);
    expect(restaurado?.configuracionEncastres).toEqual(original.configuracionEncastres);
  });

  it("no acepta otra cantidad aunque el resultado guardado tenga número de segmentos", () => {
    const original = crearAnalisis("opennest-v1");
    original.nesting.piezasOriginales = 1;
    original.nesting.segmentos = 1;
    const restaurado = analisisVectorialDesdeItem(itemGuardado(original));

    expect(renderizar(restaurado)).toContain('data-ready="true"');
    expect(renderizar(restaurado, 2)).toContain('data-ready="false"');
  });

  it("mantiene los controles de versión y medidas al reabrir un cálculo", () => {
    const original = crearAnalisis("opennest-v1");
    original.nesting.versionPoliticaOrientacion = VERSION_POLITICA_ORIENTACION_GRAFONEST - 1;
    expect(renderizar(analisisVectorialDesdeItem(itemGuardado(original))))
      .toContain('data-ready="false"');

    const item = itemGuardado(crearAnalisis("opennest-v1"));
    item.cotizacion.pasos[0].nestingResult!.solucionNesting!.problema.demandas[0].geometria.anchoMm = 400;
    expect(renderizar(analisisVectorialDesdeItem(item))).toContain('data-ready="false"');
  });

  it("conserva el análisis en memoria y no inventa uno para un archivo sin cálculo", () => {
    const original = crearAnalisis("opennest-v1");
    const item = itemGuardado(original);
    item.disenoVectorialAnalisis = original;
    expect(analisisVectorialDesdeItem(item)).toBe(original);

    delete item.disenoVectorialAnalisis;
    item.cotizacion.pasos = [];
    expect(analisisVectorialDesdeItem(item)).toBeNull();
  });
});
