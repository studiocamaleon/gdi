import { afterEach, expect, it, vi } from "vitest";
import { apiRequest } from "./api";
import {
  itemDesdeTrabajoMedida,
  persistirTrabajoMedida,
  type CalculoMedida,
} from "./trabajos-medida-api";
import { itemHipoteticoDesdeCotizacion } from "./eta-cotizacion";
vi.mock("./api", () => ({ apiRequest: vi.fn() }));
const calculo = () =>
  ({
    huellaCalculo: "revision-a",
    resumen: {
      estimacionParcial: false,
      neto: 200000,
      impuestos: 42000,
      total: 242000,
      costoTotal: 150000,
      margen: 50000,
      contribucion: 110000,
    },
    result: {
      exitoso: true,
      errores: [],
      cotizacion: {
        trabajoMedida: {
          nombre: "Proyecto ficticio",
          descripcion: "Armar exhibidor",
          cantidad: 3,
          unidad: "unidad",
          precio: 242000,
          tipoPrecio: "FINAL",
          basePrecio: "TOTAL",
          categoriaFiscal: "general",
          costos: { materiales: 90000, otros: [] },
          produccion: true,
          operaciones: [],
        },
        costos: { total: 150000 },
        tipoCambio: { id: "cambio" },
        pasos: [
          {
            rutaPasoId: "diseno",
            familiaCodigo: "trabajo_manual",
            nombreVisible: "Diseño",
            activado: true,
            tiempo: { totalMin: 60, centroCostoId: "centro" },
          },
          {
            rutaPasoId: "armado",
            familiaCodigo: "trabajo_manual",
            nombreVisible: "Armado",
            activado: true,
            tiempo: { totalMin: 120, centroCostoId: "centro" },
          },
        ],
        desglosePrecio: { precioNetoTotal: 200000, precioBrutoTotal: 242000 },
      },
    },
  }) as unknown as CalculoMedida;
afterEach(() => vi.resetAllMocks());
it("conserva importe del trabajo completo, instrucciones y horas ordenadas para ETA", () => {
  const c = calculo(),
    item = itemDesdeTrabajoMedida(c);
  expect(item.total).toBe(242000);
  expect(item.precioUnitario * 3).toBe(242000);
  expect(item.notaProduccion).toBe("Armar exhibidor");
  const eta = itemHipoteticoDesdeCotizacion(item.id, item.cotizacion);
  expect(eta.pasos.map((p) => p.duracionMin)).toEqual([60, 120]);
  expect(eta.pasos[1].predecesoras).toEqual([eta.pasos[0].clave]);
  c.result.cotizacion.pasos.forEach((p) => (p.soloCosto = true));
  expect(
    itemHipoteticoDesdeCotizacion(item.id, c.result.cotizacion).pasos,
  ).toHaveLength(0);
});
it("editar invalida el snapshot anterior pero conserva fecha y adjuntos", () => {
  const original = {
    ...itemDesdeTrabajoMedida(calculo()),
    cotizacionItemId: "historico",
    fechaEntrega: "2099-12-20",
    archivosPendientes: [],
  };
  const editado = itemDesdeTrabajoMedida(calculo(), original);
  expect(editado.cotizacionItemId).toBeUndefined();
  expect(editado.id).toBe(original.id);
  expect(editado.fechaEntrega).toBe("2099-12-20");
  expect(editado.archivosPendientes).toBe(original.archivosPendientes);
});
it("rechaza una tarifa cambiada antes de guardar", async () => {
  const item = itemDesdeTrabajoMedida(calculo());
  vi.mocked(apiRequest).mockRejectedValue(new Error("Los datos, tarifas o impuestos cambiaron."));
  await expect(persistirTrabajoMedida(item, {})).rejects.toThrow("cambiaron");
  expect(apiRequest).toHaveBeenCalledTimes(1);
});
it("una versión recuperada también exige revisar si cambian los importes", async () => {
  const item = {
    ...itemDesdeTrabajoMedida(calculo()),
    trabajoMedidaHuella: undefined,
  };
  const c = calculo();
  c.resumen.costoTotal = 160000;
  vi.mocked(apiRequest).mockResolvedValue(c);
  await expect(persistirTrabajoMedida(item, {})).rejects.toThrow("cambió");
  expect(apiRequest).toHaveBeenCalledTimes(1);
});
it("encadena cotización, cliente y la revisión verificada al guardar", async () => {
  vi.mocked(apiRequest).mockResolvedValue(calculo());
  await persistirTrabajoMedida(itemDesdeTrabajoMedida(calculo()), {
    cotizacionId: "documento",
    clienteId: "cliente",
  });
  expect(apiRequest).toHaveBeenLastCalledWith(
    "/trabajos-medida/guardar",
    expect.objectContaining({ method: "POST", body: expect.any(String) }),
  );
  expect(apiRequest).toHaveBeenCalledTimes(1);
  const body = JSON.parse(
    vi.mocked(apiRequest).mock.calls[0][1]!.body as string,
  );
  expect(body).toMatchObject({
    cotizacionId: "documento",
    clienteId: "cliente",
    tipoCambioId: "cambio",
    huellaCalculo: "revision-a",
  });
});
