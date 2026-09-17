import { describe, expect, it } from "vitest";
import { monedaDe } from "./monedas";
import { buildCargoOrdenSnapshot, getCargoDefaultMonto } from "./cargos-orden";
import type { CargoDirectoCatalogo } from "./productos-servicios";

const cargo: CargoDirectoCatalogo = {
  id: "envio",
  codigo: "ENVIO",
  nombre: "Envío",
  descripcion: null,
  modoCalculo: "MONTO_FIJO_PLANO",
  modosActivacionSoportados: [],
  configJson: {},
  aplicaMargen: false,
  activo: true,
};
const opciones = {
  cargo,
  monto: 100.4,
  porcentaje: 5,
  precioUnidad: 125,
  cantidadInput: 3,
  zonaCodigo: "",
  subtotalBase: 5000,
  nota: "  Coordinar entrega  ",
  moneda: monedaDe("ARS"),
};
describe("cargos de la orden al migrar el formulario", () => {
  it.each([
    ["MONTO_FIJO_PLANO", 100, 21, 121],
    ["PORCENTAJE_SOBRE_BASE", 250, 53, 303],
    ["POR_UNIDAD_INPUT", 375, 79, 454],
  ])(
    "conserva neto, impuesto y total para %s",
    (modoCalculo, neto, impuesto, total) => {
      expect(
        buildCargoOrdenSnapshot({
          ...opciones,
          cargo: { ...cargo, modoCalculo },
        }),
      ).toMatchObject({
        cargoDirectoCatalogoId: "envio",
        montoNeto: neto,
        impuestoMonto: impuesto,
        total,
        nota: "Coordinar entrega",
        baseCalculo: 5000,
      });
    },
  );
  it("usa la tarifa de la zona seleccionada y conserva su detalle", () => {
    const porZona = {
      ...cargo,
      configJson: {
        zonas: [{ codigo: "centro", nombre: "Centro", monto: 1500 }],
      },
    };
    expect(getCargoDefaultMonto(porZona)).toBe(1500);
    expect(
      buildCargoOrdenSnapshot({
        ...opciones,
        cargo: porZona,
        zonaCodigo: "centro",
      }),
    ).toMatchObject({
      montoNeto: 1500,
      impuestoMonto: 315,
      total: 1815,
      detalle: "Zona Centro",
      configSnapshot: { zonaAplicada: { codigo: "centro", monto: 1500 } },
    });
  });
});
