import { beforeEach, describe, expect, it, vi } from "vitest";
import { validarCupon, type ValidarCuponResultado } from "./cupones-api";
import { validarYAplicarCuponOrden } from "./cupones-orden";
import { productoDiseno } from "@/components/comercial/__fixtures__/orden-diseno";

vi.mock("./cupones-api", () => ({ validarCupon: vi.fn() }));
const resultado: ValidarCuponResultado = {
  cupon: {
    id: "cupon",
    codigo: "PRUEBA",
    descripcion: null,
    tipo: "PORCENTAJE",
    valor: 10,
    alcanceTipo: "ORDEN",
    alcanceRef: null,
    alcanceNombre: null,
    montoMinimo: null,
    vigenciaDesde: null,
    vigenciaHasta: null,
    usoMax: null,
    usoCount: 0,
    activo: true,
    version: 1,
    creadoPor: null,
    actualizadoPor: null,
    createdAt: "",
    updatedAt: "",
  },
  alcanzadas: ["linea"],
  plan: [{ key: "linea", tipo: "PORCENTAJE", valor: 10 }],
  montoAplicado: 4500,
};
const item = {
  ...productoDiseno("linea", "Tarjetas", 500, 45000),
  motorCodigo: "producto",
};
const aplicar = vi.fn(async () => true);
const solicitud = {
  codigo: "  PRUEBA  ",
  clienteId: "cliente",
  items: [item],
  contextoVigente: () => true,
  aplicar,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(validarCupon).mockResolvedValue(resultado);
});
describe("validar y aplicar cupón desde el resumen", () => {
  it("valida el código contra cliente/productos y aplica exactamente el plan recibido", async () => {
    await expect(validarYAplicarCuponOrden(solicitud)).resolves.toBe(true);
    expect(validarCupon).toHaveBeenCalledWith({
      codigo: "PRUEBA",
      clienteId: "cliente",
      items: [
        {
          key: "linea",
          productoId: "producto",
          productoCodigo: "linea",
          categoriaCodigo: "impresion",
          subcategoriaCodigo: "digital",
          neto: 45000,
        },
      ],
    });
    expect(aplicar).toHaveBeenCalledExactlyOnceWith(resultado);
  });
  it("no aplica descuentos si el backend rechaza el cupón", async () => {
    vi.mocked(validarCupon).mockRejectedValueOnce(
      new Error("El cupón está vencido."),
    );
    await expect(validarYAplicarCuponOrden(solicitud)).rejects.toThrow(
      "vencido",
    );
    expect(aplicar).not.toHaveBeenCalled();
  });
  it("descarta la validación si cambió el cliente o el carrito mientras esperaba", async () => {
    await expect(
      validarYAplicarCuponOrden({ ...solicitud, contextoVigente: () => false }),
    ).rejects.toThrow("La orden cambió");
    expect(aplicar).not.toHaveBeenCalled();
  });
  it("no informa éxito cuando la aplicación del plan falla", async () => {
    aplicar.mockResolvedValueOnce(false);
    await expect(validarYAplicarCuponOrden(solicitud)).resolves.toBe(false);
  });
});
