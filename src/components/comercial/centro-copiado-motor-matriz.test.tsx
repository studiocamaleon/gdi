// @vitest-environment jsdom
import { act, useState, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { SimulacionTarifario } from "./centro-copiado-tarifarios-simulacion";
import { EditorMatriz } from "./centro-copiado-tarifarios-matriz";
import { PermisosProvider } from "@/components/navigation/permisos-provider";
import { contenidoInicial } from "@/lib/centro-copiado-tarifarios-editor";
import {
  simularCeldasTarifario,
  type ContenidoTarifario,
} from "@/lib/centro-copiado-tarifarios-api";
import type { ResultadoCeldaSimulacion } from "../../../apps/api/src/centro-copiado/tarifarios/simulacion-tarifario.types";
vi.mock("@/lib/centro-copiado-tarifarios-api", () => ({
  simularCeldasTarifario: vi.fn(),
}));
let el: HTMLDivElement,
  root: Root,
  inicial: ContenidoTarifario,
  ultimo: ContenidoTarifario;
function App({
  permisos = ["finanzas.ver_margenes"],
  consulta = false,
  revisionCostos = "1",
  preparacionHojas = false,
}: {
  permisos?: string[];
  consulta?: boolean;
  revisionCostos?: string;
  preparacionHojas?: boolean;
}) {
  const [c, setC] = useState(inicial);
  useEffect(() => {
    ultimo = c;
  }, [c]);
  return (
    <PermisosProvider permisos={permisos}>
      <SimulacionTarifario
        tarifarioId="tarifa-ficticia"
        revision={1}
        revisionCostos={revisionCostos}
        preparacionHojas={preparacionHojas}
        contenido={c}
        guardado={inicial}
        nombres={{ papel: "Obra de prueba" }}
        perfiles={[]}
        disabled={false}
        onChange={consulta ? undefined : setC}
      >
        {(motor) => (
          <EditorMatriz
            motor={motor}
            matriz={c.hojas!}
            nombres={{ papel: "Obra de prueba" }}
            disabled={consulta}
            onGenerar={() => {}}
            onChange={(hojas) =>
              setC({
                ...c,
                hojas: hojas as NonNullable<ContenidoTarifario["hojas"]>,
              })
            }
          />
        )}
      </SimulacionTarifario>
    </PermisosProvider>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
  inicial = contenidoInicial("ARS");
  inicial.composicion.iva = "MAS_IVA";
  inicial.margen = { minimoPorcentaje: "20", anteInsuficiente: "AUTORIZACION" };
  inicial.hojas!.reglas.cobertura = "DIFERENCIADA";
  inicial.hojas!.rangosGenerales = [1, 100];
  inicial.hojas!.filas = (
    [
      ["COLOR", 1],
      ["COLOR", 2],
      ["BN", 1],
    ] as const
  ).map(([color, faz], i) => ({
    combinacion: {
      papelMateriaPrimaId: "papel",
      gramaje: 75,
      tamano: "A4",
      color,
      faz,
      cobertura: "normal",
    },
    precios: [1, 100].map((desdeCantidad, j) => ({
      desdeCantidad,
      precioUnitario: i === 0 ? (j === 0 ? "0" : "123") : null,
    })),
  }));
  vi.mocked(simularCeldasTarifario).mockImplementation(async (_id, s) => ({
    resultados: s.celdas.map((celda) => {
      const cantidad = String(inicial.hojas!.rangosGenerales[celda.tramo]);
      const resultado = {
        celda,
        escenarios: [
          {
            estado: "CALCULADO",
            cobertura: "normal",
            calculadoEl: "2026-10-11T15:00:00Z",
            costoTotal: String(700 * Number(cantidad)),
            costoUnitario: "700",
            cantidadReferencia: cantidad,
            cantidadFacturable: cantidad,
            unidad: "HOJA",
            referencia: "Pedido ficticio",
            grupos: [
              {
                fila: celda.fila,
                desdeCantidad: cantidad,
                cantidadFacturable: cantidad,
              },
            ],
            ivaPorcentaje: "21",
            decimalesPrecio: 2,
            trazas: [],
            avisos: [],
            comercial: {
              cargas: [],
              ventaMotorNeta: null,
              metodosMotor: [],
              motivo: null,
            },
          },
        ],
      } as ResultadoCeldaSimulacion;
      resultado.rangoCostos = {
        abierto: celda.tramo === 1,
        puntos: (["INICIO", "FIN"] as const).map((extremo) => {
          const n =
            extremo === "INICIO"
              ? cantidad
              : celda.tramo === 0
                ? "99"
                : (celda.hastaReferencia ?? "200");
          return {
            extremo,
            cantidadObjetivo: n,
            escenarios: resultado.escenarios.map((e) =>
              e.estado === "CALCULADO"
                ? {
                    ...e,
                    cantidadReferencia: n,
                    cantidadFacturable: n,
                    costoUnitario: extremo === "INICIO" ? "700" : "500",
                    costoTotal: String(
                      Number(n) * (extremo === "INICIO" ? 700 : 500),
                    ),
                    grupos: e.grupos.map((g) => ({
                      ...g,
                      cantidadFacturable: n,
                    })),
                  }
                : e,
            ),
          };
        }),
      };
      return resultado;
    }),
  }));
});
afterEach(async () => {
  await act(async () => root.unmount());
  el.remove();
});
function boton(texto: string) {
  const b = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent?.trim() === texto,
  );
  expect(b, `Botón ${texto}`).toBeTruthy();
  return b!;
}
async function click(texto: string) {
  await act(async () => boton(texto).click());
}
async function opcion(texto: string) {
  const b = [
    ...el.querySelectorAll<HTMLElement>('[role="radio"],[role="tab"]'),
  ].find(
    (b) =>
      b.textContent === texto ||
      b.getAttribute("aria-label") === texto ||
      b.getAttribute("aria-label")?.startsWith(`${texto} `) ||
      b.textContent?.startsWith(`${texto} · `),
  );
  expect(b).toBeTruthy();
  await act(async () => b!.click());
}
function campo(label: string) {
  const l = [...document.querySelectorAll("label")].find(
    (l) => l.textContent === label,
  );
  return document.getElementById(l!.htmlFor) as HTMLInputElement;
}
async function escribir(input: HTMLInputElement, v: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, v);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function abrir(props: Parameters<typeof App>[0] = {}) {
  await act(async () => root.render(<App {...props} />));
  await click("Calcular precios con el motor");
}
it("calcula en la matriz, revisa sin escribir y completa sólo vacíos preservando ceros", async () => {
  await abrir();
  await click("Calcular 4 precios");
  expect(simularCeldasTarifario).toHaveBeenCalledTimes(1);
  expect(ultimo).toEqual(inicial);
  expect(el.textContent).toContain("Sugerido");
  await click("Revisar 2 precios");
  expect(el.textContent).toContain("Por aplicar");
  expect(ultimo).toEqual(inicial);
  await click("Aplicar 2 precios al borrador");
  expect(ultimo.hojas!.filas[0].precios.map((p) => p.precioUnitario)).toEqual([
    "0",
    "123",
  ]);
  expect(ultimo.hojas!.filas[1].precios.map((p) => p.precioUnitario)).toEqual([
    "1000",
    "1000",
  ]);
  expect(
    ultimo.hojas!.filas[2].precios.every((p) => p.precioUnitario === null),
  ).toBe(true);
});
it("margen, redondeo y edición manual actualizan la tabla sin consultar nuevamente el motor", async () => {
  await abrir();
  await click("Calcular 4 precios");
  await escribir(campo("1–99 hojas (%)"), "40");
  await escribir(campo("Redondear hacia arriba a"), "100");
  await click("Revisar 2 precios");
  await click("Aplicar 2 precios al borrador");
  expect(ultimo.hojas!.filas[1].precios[0].precioUnitario).toBe("1200");
  expect(ultimo.hojas!.filas[1].precios[1].precioUnitario).toBe("1000");
  expect(ultimo.hojas!.objetivosContribucion).toEqual(["40", "30"]);
  expect(ultimo.margen).toEqual(inicial.margen);
  const precio = el.querySelector<HTMLInputElement>(
    'input[aria-label*="Doble faz"][aria-label*="desde 1,"]',
  )!;
  await escribir(precio, "1400");
  expect(precio.closest("td")!.textContent).toContain("50.00%");
  expect(simularCeldasTarifario).toHaveBeenCalledTimes(1);
});
it("toda la matriz incluye otros colores; cambiar la revisión exige revisarla de nuevo", async () => {
  await abrir();
  await opcion("Toda la matriz");
  await click("Calcular 6 precios");
  expect(simularCeldasTarifario).toHaveBeenCalledTimes(2);
  await opcion("También cargados");
  await click("Revisar 6 precios");
  await escribir(campo("Redondear hacia arriba a"), "300");
  expect(boton("Aplicar 6 precios al borrador").disabled).toBe(true);
  await click("Revisar 6 precios");
  await opcion("Blanco y negro · K");
  expect(boton("Aplicar 6 precios al borrador").disabled).toBe(false);
  await click("Aplicar 6 precios al borrador");
  expect(
    ultimo
      .hojas!.filas.flatMap((f) => f.precios)
      .every((p) => p.precioUnitario === "1200"),
  ).toBe(true);
});
it("un error parcial queda en su celda y no reemplaza el precio con una sugerencia incompleta", async () => {
  const original = vi.mocked(simularCeldasTarifario).getMockImplementation()!;
  vi.mocked(simularCeldasTarifario).mockImplementation(async (...args) => {
    const r = await original(...args);
    r.resultados[2].escenarios = [
      {
        estado: "ERROR",
        cobertura: "normal",
        calculadoEl: "2026-10-11T15:00:00Z",
        motivo: "Papel no disponible",
      },
    ];
    return r;
  });
  await abrir();
  await click("Calcular 4 precios");
  expect(el.textContent).toContain("Error de cálculo");
  expect(boton("Revisar 0 precios").disabled).toBe(true);
  expect(ultimo.hojas!.filas[1].precios.map((p) => p.precioUnitario)).toEqual([
    null,
    null,
  ]);
});
it("la consulta puede calcular pero no aplicar, y perder permiso retira costos de la matriz", async () => {
  await abrir({ consulta: true });
  await click("Calcular 4 precios");
  expect(boton("Revisar 2 precios").disabled).toBe(true);
  expect(boton("Limpiar valores").disabled).toBe(true);
  expect(campo("1–99 hojas (%)").disabled).toBe(true);
  await act(async () => root.render(<App permisos={[]} />));
  expect(el.textContent).not.toContain("Contribución actual");
  expect(el.textContent).not.toContain("Calcular precios con el motor");
  expect(ultimo).toEqual(inicial);
});
it("recupera objetivos guardados, los comparte entre colores y descarta propuestas cuando cambian", async () => {
  inicial.hojas!.objetivosContribucion = ["50", "30"];
  await abrir();
  expect(campo("1–99 hojas (%)").value).toBe("50");
  await opcion("Toda la matriz");
  await click("Calcular 6 precios");
  await opcion("También cargados");
  await click("Revisar 6 precios");
  await escribir(campo("1–99 hojas (%)"), "40");
  expect(boton("Aplicar 6 precios al borrador").disabled).toBe(true);
  await escribir(campo("100+ hojas (%)"), "100");
  expect(el.textContent).toContain("menor que 100%");
  expect(boton("Recalcular 6 precios").disabled).toBe(true);
  await escribir(campo("100+ hojas (%)"), "30");
  await click("Revisar 6 precios");
  await click("Aplicar 6 precios al borrador");
  expect(
    ultimo.hojas!.filas.map((f) => f.precios.map((p) => p.precioUnitario)),
  ).toEqual([
    ["1166.66666667", "1000"],
    ["1166.66666667", "1000"],
    ["1166.66666667", "1000"],
  ]);
  expect(simularCeldasTarifario).toHaveBeenCalledTimes(2);
  await click("Editar rangos generales");
  await escribir(campo("Inicios de los tramos"), "1; 50; 100");
  await click("Aplicar rangos");
  expect(ultimo.hojas!.objetivosContribucion).toEqual(["40", "40", "30"]);
});
it("un cambio estructural invalida resultados y bloquea otra simulación hasta guardar", async () => {
  await abrir();
  await click("Calcular 4 precios");
  await act(async () => boton("Editar rangos generales").click());
  await escribir(campo("Inicios de los tramos"), "1; 50; 100");
  await click("Aplicar rangos");
  expect(el.textContent).not.toContain("Sugerido");
  expect(el.textContent).toContain("Guardá las combinaciones");
  expect(boton("Calcular 6 precios").disabled).toBe(true);
});

it("el detalle permite ajustar la referencia y recalcular sólo esa celda", async () => {
  await abrir();
  await click("Calcular 4 precios");
  const abrirDetalle = () =>
    act(async () =>
      el
        .querySelector<HTMLButtonElement>(
          'button[aria-label^="Ver costo y contribución"]',
        )!
        .click(),
    );
  await abrirDetalle();
  expect(document.body.textContent).toContain(
    "Costo y contribución del precio actual",
  );
  await click("Ajustar referencia");
  await escribir(campo("Cantidad de referencia"), "20");
  await click("Guardar referencia");
  await abrirDetalle();
  await click("Calcular esta celda");
  expect(
    vi.mocked(simularCeldasTarifario).mock.calls.at(-1)![1].celdas,
  ).toEqual([
    { seccion: "hojas", fila: 0, tramo: 0, cantidadReferencia: "20" },
  ]);
});

it("muestra mínimo, máximo y promedio de los extremos sin usar el promedio para sugerir", async () => {
  await abrir();
  await click("Calcular 4 precios");
  expect(vi.mocked(simularCeldasTarifario).mock.calls[0][1].analizarRango).toBe(
    true,
  );
  const celda = el
    .querySelector('input[aria-label*="Doble faz"][aria-label*="desde 1,"]')!
    .closest("td")!;
  for (const [label, importe] of [
    ["Costo mín.", "500,00"],
    ["Costo máx.", "700,00"],
    ["Promedio", "600,00"],
  ]) {
    const fila = [...celda.querySelectorAll("span")].find(
      (s) => s.textContent === label,
    )!.parentElement!;
    expect(fila.textContent).toContain(importe);
  }
  expect(celda.textContent).toContain("Comparación: 1–99 hojas");
  expect(celda.textContent).toContain("1.000,00");
  expect(ultimo).toEqual(inicial);
});

it("permite ajustar sólo el tope de muestra del tramo abierto y exige recalcular", async () => {
  await abrir();
  await click("Calcular 4 precios");
  const detalle = () =>
    act(async () =>
      el
        .querySelector<HTMLButtonElement>(
          'button[aria-label^="Ver costo y contribución"][aria-label$="desde 100"]',
        )!
        .click(),
    );
  await detalle();
  await click("Ajustar referencia");
  await escribir(campo("Simular el tramo abierto hasta"), "350");
  await click("Guardar referencia");
  expect(el.textContent).toContain("Sin calcular");
  await detalle();
  await click("Calcular esta celda");
  expect(
    vi.mocked(simularCeldasTarifario).mock.calls.at(-1)![1].celdas[0]
      .hastaReferencia,
  ).toBe("350");
  expect(document.body.textContent).toContain("Muestra: 100–350 hojas");
  expect(ultimo.hojas!.rangosGenerales).toEqual([1, 100]);
});

it("limpia sólo la vista, incluidos ceros, cancela, deshace y regenera sin precios ni costos anteriores", async () => {
  inicial.hojas!.filas[2].precios[0].precioUnitario = "999";
  await abrir();
  await click("Calcular 4 precios");
  await click("Limpiar valores");
  await click("Cancelar");
  expect(ultimo).toEqual(inicial);
  await click("Limpiar valores");
  await click("Limpiar y dejar pendientes");
  expect(
    ultimo
      .hojas!.filas.slice(0, 2)
      .flatMap((f) => f.precios)
      .every((p) => p.precioUnitario === null),
  ).toBe(true);
  expect(ultimo.hojas!.filas[2]).toEqual(inicial.hojas!.filas[2]);
  expect(ultimo.hojas!.rangosGenerales).toEqual(inicial.hojas!.rangosGenerales);
  expect(el.textContent).not.toContain("Sugerido");
  await click("Deshacer limpieza");
  expect(ultimo).toEqual(inicial);
  expect(el.textContent).not.toContain("Sugerido");
  await click("Limpiar valores");
  await click("Limpiar y dejar pendientes");
  await click("Calcular 4 precios");
  expect(simularCeldasTarifario).toHaveBeenCalledTimes(2);
  await click("Revisar 4 precios");
  await click("Aplicar 4 precios al borrador");
  expect(
    ultimo
      .hojas!.filas.slice(0, 2)
      .flatMap((f) => f.precios)
      .every((p) => p.precioUnitario === "1000"),
  ).toBe(true);
  expect(el.textContent).not.toContain("Deshacer limpieza");
});
it("limpia toda la matriz cuando se elige ese alcance", async () => {
  inicial.hojas!.filas[2].precios[0].precioUnitario = "999";
  await abrir();
  await click("Limpiar valores");
  const opciones = [
    ...document.querySelectorAll<HTMLElement>('[role="dialog"] [role="radio"]'),
  ];
  await act(async () =>
    opciones.find((o) => o.textContent === "Toda la matriz")!.click(),
  );
  await click("Limpiar y dejar pendientes");
  expect(
    ultimo
      .hojas!.filas.flatMap((f) => f.precios)
      .every((p) => p.precioUnitario === null),
  ).toBe(true);
});
it("cambiar setup o la versión de costos invalida las sugerencias aunque no cambie la matriz", async () => {
  await abrir({ preparacionHojas: true });
  await click("Calcular 4 precios");
  expect(el.textContent).toContain("Sugerido");
  await act(async () => root.render(<App preparacionHojas={false} />));
  expect(el.textContent).not.toContain("Sugerido");
  expect(el.textContent).toContain("productivas: desactivadas");
  await click("Calcular 4 precios");
  await act(async () => root.render(<App revisionCostos="2" />));
  expect(el.textContent).not.toContain("Sugerido");
  expect(ultimo).toEqual(inicial);
});
it("descarta respuestas en vuelo de una configuración anterior y bloquea limpieza mientras calcula", async () => {
  const original = vi.mocked(simularCeldasTarifario).getMockImplementation()!;
  let completar!: () => void;
  const pendiente = new Promise<void>((resolve) => {
    completar = resolve;
  });
  vi.mocked(simularCeldasTarifario).mockImplementation(async (...args) => {
    await pendiente;
    return original(...args);
  });
  await abrir({ preparacionHojas: true });
  await click("Calcular 4 precios");
  expect(boton("Limpiar valores").disabled).toBe(true);
  await act(async () =>
    root.render(<App preparacionHojas={false} revisionCostos="2" />),
  );
  await act(async () => completar());
  expect(el.textContent).not.toContain("Sugerido");
  expect(boton("Limpiar valores").disabled).toBe(false);
  expect(ultimo).toEqual(inicial);
});
