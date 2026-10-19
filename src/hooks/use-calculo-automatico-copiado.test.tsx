// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useCalculoAutomaticoCopiado } from "./use-calculo-automatico-copiado";
import { claveRevisionCopiado } from "@/lib/centro-copiado-pedidos-api";
import { itemConstruidoAPropuestaItem } from "@/lib/centro-copiado-api";
import type { PropuestaItem } from "@/lib/propuestas";

let root: Root, el: HTMLDivElement;
const calcular = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
function ejemplo() {
  return itemConstruidoAPropuestaItem({
    documentoId: "documento-ficticio",
    grupoTomoId: null,
    nombre: "Manual ficticio",
    productoId: "impresion-ficticia",
    especificaciones: {},
    jobContext: { cantidad: 10, _centroCopiado: { paginas: 10, copias: 1 } },
    cantidad: 10,
    precioUnitario: 100,
    subtotal: 1000,
    impuestoPorcentaje: 21,
    impuestoMonto: 210,
    total: 1210,
    cotizacion: null,
    error: null,
  });
}
function Fixture(props: Parameters<typeof useCalculoAutomaticoCopiado>[0]) {
  useCalculoAutomaticoCopiado(props);
  return null;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
});
afterEach(async () => {
  await act(async () => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});
async function mostrar(
  items: PropuestaItem[],
  opciones: {
    habilitado?: boolean;
    vigente?: boolean;
    ocupado?: boolean;
    canal?: string;
    cliente?: string;
    sinComprobante?: boolean;
  } = {},
) {
  await act(async () =>
    root.render(
      <StrictMode>
        <Fixture
          clave={claveRevisionCopiado(
            items,
            opciones.canal ?? "mostrador",
            opciones.cliente ?? "cliente-ficticio",
            opciones.sinComprobante ?? false,
          )}
          habilitado={opciones.habilitado ?? true}
          vigente={opciones.vigente ?? false}
          ocupado={opciones.ocupado ?? false}
          calcular={calcular}
        />
      </StrictMode>,
    ),
  );
}
it("calcula al agregar una carga y no duplica solicitudes por renders o StrictMode", async () => {
  await mostrar([], { habilitado: false });
  const item = ejemplo();
  await mostrar([item]);
  await mostrar([item]);
  expect(calcular).toHaveBeenCalledOnce();
});
it.each(["cantidad", "descuento", "tipoCambio", "canal", "cliente", "fiscal"])(
  "recalcula automáticamente un cambio de %s",
  async (campo) => {
    const item = ejemplo();
    await mostrar([item], { vigente: true });
    const nuevo = { ...item };
    const opciones: Parameters<typeof mostrar>[1] = {};
    if (campo === "cantidad")
      nuevo.jobContext = { ...item.jobContext, cantidad: 20 };
    if (campo === "descuento")
      nuevo.descuentoInput = { tipo: "PORCENTAJE", valor: 10 };
    if (campo === "tipoCambio")
      nuevo.cotizacion = {
        ...item.cotizacion,
        tipoCambio: { id: "cambio-ficticio-nuevo" },
      } as PropuestaItem["cotizacion"];
    if (campo === "canal") opciones.canal = "online";
    if (campo === "cliente") opciones.cliente = "otro-cliente-ficticio";
    if (campo === "fiscal") opciones.sinComprobante = true;
    await mostrar([nuevo], opciones);
    expect(calcular).toHaveBeenCalledOnce();
  },
);
it("recalcula cuando se agrega o quita otra carga del mismo pedido", async () => {
  const a = ejemplo(),
    b = ejemplo();
  await mostrar([a], { vigente: true });
  await mostrar([a, b]);
  await mostrar([a, b], { vigente: true });
  await mostrar([a]);
  expect(calcular).toHaveBeenCalledTimes(2);
});
it("espera el cálculo en curso y procesa sólo el último cambio pendiente", async () => {
  const item = ejemplo();
  await mostrar([item]);
  await mostrar([{ ...item, cantidad: 20 }], { ocupado: true });
  await mostrar([{ ...item, cantidad: 30 }], { ocupado: true });
  expect(calcular).toHaveBeenCalledOnce();
  await mostrar([{ ...item, cantidad: 30 }]);
  expect(calcular).toHaveBeenCalledTimes(2);
});
it("la respuesta con nuevos precios e identificadores no genera otro cálculo", async () => {
  const item = ejemplo();
  await mostrar([item]);
  await mostrar(
    [
      {
        ...item,
        cotizacionItemId: "snapshot-nuevo",
        subtotal: 800,
        total: 968,
      },
    ],
    { vigente: true },
  );
  expect(calcular).toHaveBeenCalledOnce();
});
it("un fallo no crea un bucle de reintentos; cambiar la carga sí vuelve a calcular", async () => {
  const item = ejemplo();
  await mostrar([item]);
  await mostrar([item], { ocupado: true });
  await mostrar([item]);
  await mostrar([item]);
  expect(calcular).toHaveBeenCalledOnce();
  await mostrar([{ ...item, cantidad: 20 }]);
  expect(calcular).toHaveBeenCalledTimes(2);
});
it("conserva la consulta histórica y calcula un borrador desactualizado al editarlo", async () => {
  const item = ejemplo();
  await mostrar([item], { habilitado: false });
  expect(calcular).not.toHaveBeenCalled();
  await mostrar([item]);
  expect(calcular).toHaveBeenCalledOnce();
});
it("cambiar datos sin permiso de edición no calcula", async () => {
  const item = ejemplo();
  await mostrar([item], { habilitado: false });
  await mostrar([{ ...item, cantidad: 20 }], { habilitado: false });
  expect(calcular).not.toHaveBeenCalled();
});

it("un borrador vigente y cambios de notas o fecha no recalculan precios", async () => {
  const item = ejemplo();
  await mostrar([item], { habilitado: false, vigente: true });
  await mostrar([item], { vigente: true });
  await mostrar([
    { ...item, notaProduccion: "Nota ficticia", fechaEntrega: "2026-11-02" },
  ]);
  expect(calcular).not.toHaveBeenCalled();
});
