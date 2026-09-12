import { describe, expect, it } from "vitest";
import {
  repartirEntregas,
  validarDistribucion,
  firmaEntregas,
  alternativaGuardable,
  huellaEntradaPlan,
  huellaFabricacionPlan,
  vinculoPlanPrevio,
  type VistaPlanEntrega,
  regenerarEntregas,
  ordenarAlternativasPorCosto,
  resumirDistribucion,
  motivoBloqueoDistribucion,
  fechaFinalDistribucion,
  fechaFinalItems,
  nombreLoteEntrega,
} from "./planificacion-entregas";
describe("distribución comercial de entregas", () => {
  it("resume la alternativa elegida con fechas solicitadas o sugeridas, sin usar otra alternativa", () => {
    const plan = {
      estado: "LISTA",
      alternativaElegidaId: "elegida",
      entregas: [
        { clave: "b", cantidad: 50, fechaSolicitada: "2026-10-04" },
        { clave: "a", cantidad: 150 },
      ],
      alternativas: [
        { id: "otra", entregas: [{ id: "a", fechaSugerida: "2026-11-01" }] },
        {
          id: "elegida",
          entregas: [
            { id: "a", fechaSugerida: "2026-10-09" },
            { id: "b", fechaSugerida: "2026-10-02" },
          ],
        },
      ],
    } as NonNullable<VistaPlanEntrega["plan"]>;
    const resumen = resumirDistribucion(plan)!;
    expect(resumen.entregas.map((e) => e.fechaSugerida)).toEqual([
      "2026-10-02",
      "2026-10-09",
    ]);
    expect(fechaFinalDistribucion(resumen)).toBe("2026-10-09");
    expect(
      fechaFinalDistribucion(
        resumirDistribucion({ ...plan, alternativaElegidaId: null }),
      ),
    ).toBeNull();
    expect(
      fechaFinalDistribucion(resumirDistribucion(plan, plan.entregas, true)),
    ).toBeNull();
    expect(
      fechaFinalDistribucion({
        ...resumen,
        entregas: [
          {
            clave: "a",
            cantidad: 200,
            fechaSolicitada: null,
            fechaSugerida: null,
          },
        ],
      }),
    ).toBeNull();
  });
  it("la OT toma la última entrega entre ítems y puede adelantarse al quitarla", () => {
    expect(
      fechaFinalItems(["2026-09-12", "2026-09-20", "2026-09-18"], "2026-10-01"),
    ).toBe("2026-09-20");
    expect(fechaFinalItems(["2026-09-12", "2026-09-18"], "2026-09-20")).toBe(
      "2026-09-18",
    );
    expect(fechaFinalItems([], "2026-09-20")).toBe("2026-09-20");
    expect([0, 1, 25, 26, 49].map(nombreLoteEntrega)).toEqual([
      "Lote A",
      "Lote B",
      "Lote Z",
      "Lote AA",
      "Lote AX",
    ]);
  });
  it("reparte 200 en 4x50 y conserva restos sin fracciones", () => {
    expect(repartirEntregas(200, 4).map((e) => e.cantidad)).toEqual([
      50, 50, 50, 50,
    ]);
    expect(repartirEntregas(203, 4).map((e) => e.cantidad)).toEqual([
      51, 51, 51, 50,
    ]);
    expect(repartirEntregas(2, 4).map((e) => e.cantidad)).toEqual([1, 1]);
    expect(repartirEntregas(200, 3).map((e) => e.cantidad)).toEqual([
      67, 67, 66,
    ]);
  });
  it("redistribuye conservando fechas y claves, incluso después de quitar una fila", () => {
    const anteriores = [
      { clave: "entrega-1", cantidad: 100, fechaSolicitada: "2026-09-20" },
      { clave: "entrega-3", cantidad: 100, fechaSolicitada: "2026-09-25" },
    ];
    const nuevas = regenerarEntregas(200, 3, anteriores);
    expect(nuevas.map((e) => e.cantidad)).toEqual([67, 67, 66]);
    expect(nuevas.map((e) => e.fechaSolicitada)).toEqual([
      "2026-09-20",
      "2026-09-25",
      undefined,
    ]);
    expect(new Set(nuevas.map((e) => e.clave)).size).toBe(3);
    expect(regenerarEntregas(200, 1, anteriores)).toEqual([
      { ...anteriores[0], cantidad: 200 },
    ]);
    expect(anteriores[0].cantidad).toBe(100);
  });
  it("ordena por costo adicional sin mutar ni interpretar datos ausentes como gratuitos", () => {
    const alternativas = [
      { id: "cara", costoAdicional: 100 },
      { id: "desconocida", costoAdicional: null },
      { id: "sin-extra", costoAdicional: 0 },
      { id: "intermedia", costoAdicional: 50 },
      { id: "ahorro", costoAdicional: -10 },
      { id: "sin-extra-2", costoAdicional: 0 },
      { id: "sin-permiso" },
    ];
    expect(ordenarAlternativasPorCosto(alternativas).map((a) => a.id)).toEqual([
      "ahorro",
      "sin-extra",
      "sin-extra-2",
      "intermedia",
      "cara",
      "desconocida",
      "sin-permiso",
    ]);
    expect(alternativas[0].id).toBe("cara");
  });
  it("rechaza cantidades faltantes o fraccionadas", () => {
    expect(validarDistribucion(200, repartirEntregas(200, 4))).toBeNull();
    expect(validarDistribucion(200, repartirEntregas(199, 4))).toContain("199");
    expect(
      validarDistribucion(200, [{ clave: "a", cantidad: 199.5 }]),
    ).toContain("entera");
  });
  it("valida fecha civil, año bisiesto y orden", () => {
    const e = (fechaSolicitada: string) => [
      { clave: "a", cantidad: 1, fechaSolicitada },
    ];
    expect(validarDistribucion(1, e("2026-02-30"))).toContain("fechas");
    expect(validarDistribucion(1, e("2028-02-29"))).toBeNull();
    expect(
      validarDistribucion(2, [
        ...e("2026-09-12"),
        { ...e("2026-09-10")[0], clave: "b" },
      ]),
    ).toContain("Ordená");
  });
  it("normaliza la ausencia de fecha al comparar lo editado", () => {
    expect(firmaEntregas([{ clave: "a", cantidad: 1 }])).toBe(
      firmaEntregas([{ clave: "a", cantidad: 1, fechaSolicitada: null }]),
    );
  });
  it("permite preferir una condicionada pero no una que incumple compromisos", () => {
    expect(alternativaGuardable("CONDICIONADA")).toBe(true);
    expect(alternativaGuardable("DESPLAZA_TRABAJOS")).toBe(false);
    expect(alternativaGuardable("FUERA_DE_FECHA")).toBe(false);
  });
  it("separa el cambio comercial de cliente de los cambios de fabricación", async () => {
    const input = {
      clienteId: "a",
      jobContext: { cantidad: 200, archivo: "vector" },
    };
    const h = await huellaEntradaPlan(input);
    expect(h).toHaveLength(64);
    expect(await huellaEntradaPlan(structuredClone(input))).toBe(h);
    expect(await huellaEntradaPlan({ ...input, clienteId: "b" })).not.toBe(h);
    const productiva = await huellaFabricacionPlan(input);
    expect(await huellaFabricacionPlan({ ...input, clienteId: "b" })).toBe(productiva);
    expect(await huellaFabricacionPlan({ ...input, clienteId: null })).toBe(productiva);
    expect(await huellaFabricacionPlan({ ...input, jobContext: { cantidad: 100, archivo: "vector" } })).not.toBe(productiva);
    expect(await huellaFabricacionPlan({ ...input, jobContext: { cantidad: 200, archivo: "otro" } })).not.toBe(productiva);
    expect(
      await huellaEntradaPlan({
        ...input,
        jobContext: { ...input.jobContext, cantidad: 100 },
      }),
    ).not.toBe(h);
    expect(
      await huellaEntradaPlan({
        ...input,
        jobContext: { ...input.jobContext, archivo: "otro" },
      }),
    ).not.toBe(h);
  });
  it("vincula la revisión calculada y no pierde ediciones locales al guardar", () => {
    const entregas = repartirEntregas(200, 4);
    const plan = {
      id: "plan",
      revisionId: "revision",
      alternativaElegidaId: "por-entrega",
      version: 3,
      estado: "LISTA",
      entregas,
    } as NonNullable<VistaPlanEntrega["plan"]>;
    expect(vinculoPlanPrevio(plan, entregas)).toEqual({
      planId: "plan",
      revisionId: "revision",
      expectedVersion: 3,
    });
    expect(() => vinculoPlanPrevio(null, entregas)).toThrow("Calculá");
    expect(() => vinculoPlanPrevio({ ...plan, alternativaElegidaId: null }, entregas)).toThrow("Guardá la distribución");
    expect(() => vinculoPlanPrevio({ ...plan, desactualizado: true }, entregas)).toThrow("Recalculá");
    expect(() => vinculoPlanPrevio(plan, entregas, 2)).toThrow("otra ventana");
    expect(() =>
      vinculoPlanPrevio(
        plan,
        entregas.map((e, i) =>
          i === 0 ? { ...e, fechaSolicitada: "2026-09-30" } : e,
        ),
      ),
    ).toThrow("últimas");
    expect(() =>
      vinculoPlanPrevio({ ...plan, estado: "CALCULANDO" }, entregas),
    ).toThrow("todavía");
    expect(() =>
      vinculoPlanPrevio({ ...plan, estado: "FALLIDA" }, entregas),
    ).toThrow("Revisá");
  });
});

describe("motivos para no confirmar una distribución", () => {
  const base = {
    calculando: false,
    editado: false,
    numeroPendiente: false,
    estado: "CONDICIONADA",
    requiereAjuste: false,
    aceptaAjuste: false,
  };
  it("permite guardar fechas orientativas y bloquea conflictos con una explicación", () => {
    expect(motivoBloqueoDistribucion(base)).toBeNull();
    expect(
      motivoBloqueoDistribucion({ ...base, estado: "DESPLAZA_TRABAJOS" }),
    ).toContain("otras órdenes");
    expect(
      motivoBloqueoDistribucion({ ...base, estado: "FUERA_DE_FECHA" }),
    ).toContain("fecha solicitada");
    expect(
      motivoBloqueoDistribucion({ ...base, estado: "SIN_ESTIMACION" }),
    ).toContain("tiempos o recursos");
  });
  it("exige aceptar cambios de layouts para la revisión actual", () => {
    expect(
      motivoBloqueoDistribucion({ ...base, requiereAjuste: true }),
    ).toContain("aceptás");
    expect(
      motivoBloqueoDistribucion({
        ...base,
        requiereAjuste: true,
        aceptaAjuste: true,
      }),
    ).toBeNull();
    expect(
      motivoBloqueoDistribucion({
        ...base,
        requiereAjuste: true,
        aceptaAjuste: true,
        editado: true,
      }),
    ).toContain("Recalculá");
  });
});
