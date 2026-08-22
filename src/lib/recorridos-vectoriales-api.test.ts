import { describe, expect, it } from "vitest";
import {
  descargaArchivoInstalacionHref,
  descargaPlantillaInstalacionHref,
} from "./recorridos-vectoriales-api";
import { resolverConfiguracionEncastresVectoriales } from "./productos-servicios-api";

describe("descargaPlantillaInstalacionHref", () => {
  it("transporta medidas y panel solicitado sin perder decimales", () => {
    const result = descargaPlantillaInstalacionHref(
      "item-1",
      {
        bordeMm: 50,
        anchoPanelMm: 1200.5,
        altoPanelMm: 600,
        solapeMm: 20.5,
      },
      2,
    );

    expect(result).toContain("anchoPanelMm=1200.5");
    expect(result).toContain("solapeMm=20.5");
    expect(result).toContain("panel=2");
  });
});

describe("descargaArchivoInstalacionHref", () => {
  it("incluye el formato operativo y conserva el panel DXF", () => {
    const result = descargaArchivoInstalacionHref(
      "item-1",
      {
        bordeMm: 50,
        anchoPanelMm: 1200,
        altoPanelMm: 600,
        solapeMm: 20,
      },
      "rigida-dxf",
      3,
    );

    expect(result).toContain("/archivos/rigida-dxf?");
    expect(result).toContain("panel=3");
  });
});

describe("resolverConfiguracionEncastresVectoriales", () => {
  it("adapta la configuración persistida de la máquina", () => {
    expect(
      resolverConfiguracionEncastresVectoriales({
        tipoUnionVectorial: "recta",
        modoCantidadEncastres: "cantidad_fija",
        cantidadFijaEncastres: 4,
        anchoEncastreMm: 45,
        profundidadEncastreMm: 20,
        kerfEncastreMm: 0.5,
      }),
    ).toMatchObject({
      tipoUnion: "recta",
      modoCantidad: "cantidad_fija",
      cantidadFija: 4,
      anchoEncastreMm: 45,
      profundidadEncastreMm: 20,
      kerfMm: 0.5,
    });
  });

  it("acepta también el snapshot resuelto guardado por el nesting", () => {
    expect(
      resolverConfiguracionEncastresVectoriales({
        tipoUnion: "cola_milano",
        modoCantidad: "por_distancia",
        distanciaMaximaMm: 80,
        cantidadMinima: 2,
        cantidadMaxima: 8,
        cantidadFija: 3,
        anchoEncastreMm: 35,
        profundidadEncastreMm: 25,
        kerfMm: 0.4,
      }),
    ).toMatchObject({
      distanciaMaximaMm: 80,
      cantidadMinima: 2,
      cantidadMaxima: 8,
      kerfMm: 0.4,
    });
  });
});
