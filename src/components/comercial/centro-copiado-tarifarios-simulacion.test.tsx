// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SimulacionTarifario } from "./centro-copiado-tarifarios-simulacion";
import { PermisosProvider } from "@/components/navigation/permisos-provider";
import {
  contenidoInicial,
  filasOferta,
} from "@/lib/centro-copiado-tarifarios-editor";
import { configTarifarios } from "@/lib/__fixtures__/tarifarios";
import {
  simularCeldasTarifario,
  type ContenidoTarifario,
} from "@/lib/centro-copiado-tarifarios-api";
import type { SolicitudSimulacion } from "../../../apps/api/src/centro-copiado/tarifarios/simulacion-tarifario.types";
vi.mock("@/lib/centro-copiado-tarifarios-api", () => ({
  simularCeldasTarifario: vi.fn(),
}));
vi.mock("./centro-copiado-tarifarios-controles", async (original) => ({
  ...(await original<object>()),
  Elegir: ({
    etiqueta,
    valor,
    opciones,
    onChange,
  }: {
    etiqueta: string;
    valor: string;
    opciones: { value: string; label: string }[];
    onChange: (v: string) => void;
  }) => (
    <label>
      {etiqueta}
      <select value={valor} onChange={(e) => onChange(e.target.value)}>
        {opciones.map((o) => (
          <option value={o.value} key={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  ),
}));
let root: Root;
let el: HTMLDivElement;
let contenido: ContenidoTarifario;
function respuesta(s: SolicitudSimulacion) {
  return {
    resultados: s.celdas.map((celda) => ({
      celda,
      escenarios: [
        {
          estado: "CALCULADO" as const,
          cobertura: "normal" as const,
          calculadoEl: "2026-10-10T15:00:00Z",
          costoTotal: "60",
          costoUnitario: "60",
          cantidadReferencia: "1",
          cantidadFacturable: "1",
          unidad: "HOJA" as const,
          referencia: "1 hoja de prueba",
          grupos: [
            {
              fila: celda.fila,
              desdeCantidad: String(
                contenido.hojas!.rangosGenerales[celda.tramo],
              ),
              cantidadFacturable: "1",
            },
          ],
          ivaPorcentaje: "21",
          decimalesPrecio: 2,
          trazas: [],
          avisos: [],
        },
      ],
    })),
  };
}
function App({
  permisos = ["finanzas.ver_margenes"],
}: {
  permisos?: string[];
}) {
  const [edicion, setEdicion] = useState(contenido);
  return (
    <PermisosProvider permisos={permisos}>
      <button
        onClick={() =>
          setEdicion({
            ...edicion,
            hojas: {
              ...edicion.hojas!,
              reglas: { ...edicion.hojas!.reglas, unidad: "CARILLA" },
            },
          })
        }
      >
        Cambiar unidad de prueba
      </button>
      <SimulacionTarifario
        tarifarioId="tarifario-ficticio"
        revision={1}
        contenido={edicion}
        guardado={contenido}
        nombres={{}}
        perfiles={[]}
        disabled={false}
        onChange={setEdicion}
      />
    </PermisosProvider>
  );
}
beforeEach(() => {
  vi.stubGlobal("PointerEvent", MouseEvent);
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  contenido = contenidoInicial("ARS");
  contenido.hojas!.filas = filasOferta(
    configTarifarios,
    contenido.hojas!,
  ).slice(0, 2);
  for (const fila of contenido.hojas!.filas)
    for (const p of fila.precios) p.precioUnitario = "121";
  vi.mocked(simularCeldasTarifario).mockImplementation(async (_id, s) =>
    respuesta(s),
  );
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
});
afterEach(async () => {
  await act(async () => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});
const montar = async (permisos?: string[]) => {
  await act(async () => root.render(<App permisos={permisos} />));
};
const boton = (texto: string) =>
  [...document.querySelectorAll("button")].find(
    (b) => b.textContent === texto,
  )!;
const click = async (texto: string) => {
  await act(async () => boton(texto).click());
};
async function escribir(input: HTMLInputElement, valor: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, valor);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it("recorre todas las celdas en lotes, compara sin IVA y actualiza el precio sin recostear", async () => {
  await montar();
  await click("Simular matriz (6)");
  expect(simularCeldasTarifario).toHaveBeenCalledTimes(2);
  expect(el.textContent).toContain("6 de 6 celdas procesadas");
  expect(el.textContent).toContain("40.00%");
  const precio = [...el.querySelectorAll("input")].find(
    (i) => i.value === "121",
  )!;
  await escribir(precio, "242");
  expect(el.textContent).toContain("70.00%");
  expect(simularCeldasTarifario).toHaveBeenCalledTimes(2);
});

it("cambiar condiciones de producción oculta los márgenes anteriores y exige guardar", async () => {
  await montar();
  await click("Simular matriz (6)");
  await click("Cambiar unidad de prueba");
  expect(el.textContent).not.toContain("40.00%");
  expect(el.textContent).toContain("La referencia cambió");
  expect(boton("Simular matriz (6)").disabled).toBe(true);
});

it("sólo muestra costos a quien puede ver márgenes", async () => {
  await montar(["configuracion.copiado.ver"]);
  expect(el.textContent).not.toContain("Simular costos");
  expect(simularCeldasTarifario).not.toHaveBeenCalled();
});

it("detener conserva resultados parciales sin marcarlos como matriz completa", async () => {
  let resolver!: (r: ReturnType<typeof respuesta>) => void;
  vi.mocked(simularCeldasTarifario).mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolver = r;
      }),
  );
  await montar();
  await click("Simular matriz (6)");
  await click("Detener al terminar el lote");
  await act(async () =>
    resolver(respuesta(vi.mocked(simularCeldasTarifario).mock.calls[0][1])),
  );
  expect(el.textContent).toContain("Simulación parcial: 5 de 6");
  expect(simularCeldasTarifario).toHaveBeenCalledTimes(1);
});

it("errores del motor quedan visibles sin fabricar un costo o margen", async () => {
  vi.mocked(simularCeldasTarifario).mockImplementation(async (_id, s) => ({
    resultados: s.celdas.map((celda) => ({
      celda,
      escenarios: [
        {
          estado: "ERROR",
          cobertura: "alta",
          calculadoEl: "2026-10-10T15:00:00Z",
          motivo: "Falta tarifa de máquina",
        },
      ],
    })),
  }));
  await montar();
  await click("Simular matriz (6)");
  expect(el.textContent).toContain("6 escenarios con error");
  expect(el.textContent).toContain("Falta tarifa de máquina");
  expect(el.textContent).not.toContain("40.00%");
});

it("selección explícita envía sólo la celda elegida y su cantidad ajustada", async () => {
  await montar();
  await act(async () =>
    el.querySelector<HTMLButtonElement>('[role="checkbox"]')!.click(),
  );
  await click("Ajustar referencia");
  const label = [...document.querySelectorAll("label")].find(
    (l) => l.textContent === "Cantidad de referencia",
  )!;
  await escribir(
    document.getElementById(label.htmlFor) as HTMLInputElement,
    "50",
  );
  await click("Guardar referencia");
  await click("Simular selección (1)");
  expect(vi.mocked(simularCeldasTarifario).mock.calls[0][1].celdas).toEqual([
    { seccion: "hojas", fila: 0, tramo: 0, cantidadReferencia: "50" },
  ]);
});
