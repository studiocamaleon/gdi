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
}: {
  permisos?: string[];
  consulta?: boolean;
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
  ].find((b) => b.textContent === texto);
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
  await escribir(campo("Margen objetivo (%)"), "40");
  await escribir(campo("Redondear hacia arriba a"), "100");
  await click("Revisar 2 precios");
  await click("Aplicar 2 precios al borrador");
  expect(ultimo.hojas!.filas[1].precios[0].precioUnitario).toBe("1200");
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
  await click("Revisar 1 precio");
  await click("Aplicar 1 precio al borrador");
  expect(ultimo.hojas!.filas[1].precios.map((p) => p.precioUnitario)).toEqual([
    null,
    "1000",
  ]);
});
it("la consulta puede calcular pero no aplicar, y perder permiso retira costos de la matriz", async () => {
  await abrir({ consulta: true });
  await click("Calcular 4 precios");
  expect(boton("Revisar 2 precios").disabled).toBe(true);
  await act(async () => root.render(<App permisos={[]} />));
  expect(el.textContent).not.toContain("Margen actual");
  expect(el.textContent).not.toContain("Calcular precios con el motor");
  expect(ultimo).toEqual(inicial);
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
          'button[aria-label^="Ver costo y margen"]',
        )!
        .click(),
    );
  await abrirDetalle();
  expect(document.body.textContent).toContain(
    "Costo y margen del precio actual",
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
          'button[aria-label^="Ver costo y margen"][aria-label$="desde 100"]',
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
