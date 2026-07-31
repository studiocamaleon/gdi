import { describe, expect, it } from "vitest";

import {
  consolidarCostosOrden,
  cruzarRealVsCotizado,
  reconciliarComisionPasarela,
  tiempoFueMedido,
  tiempoRealAtipico,
} from "@/lib/costos-orden";
import type { PropuestaCargoDirecto, PropuestaItem } from "@/lib/propuestas";
import type { TableroItemData, TableroPasoData } from "@/lib/tablero-produccion";

/**
 * Item con un paso de máquina y otro manual. Los números están elegidos para
 * que las cuentas se puedan verificar a mano: neto 1000, costo 400.
 */
function item(over: Partial<PropuestaItem> = {}): PropuestaItem {
  return {
    id: "item-1",
    productoNombre: "Cartel",
    productoCodigo: "CART",
    motorCodigo: "",
    categoriaComercialCodigo: "",
    categoriaComercialNombre: "",
    subcategoriaComercialCodigo: "",
    subcategoriaComercialNombre: "",
    unidadMedida: "unidad",
    cantidad: 1,
    precioUnitario: 1210,
    subtotal: 1000,
    impuestoPorcentaje: 21,
    impuestoMonto: 210,
    total: 1210,
    especificaciones: {},
    atributosSchema: [],
    adicionales: [],
    pasos: [],
    cotizacion: {
      productoId: "p1",
      productoNombre: "Cartel",
      rutaNombre: "Ruta",
      cantidadEfectiva: 1,
      cantidadPedida: 1,
      cantidadComercialPricing: 1,
      costos: {
        tiempoTotal: 200,
        materialesTotal: 200,
        cargosDirectosTotal: 0,
        total: 400,
        unitario: 400,
      },
      desglosePrecio: {
        precioConfig: { metodoCalculo: "margen", detalle: {} },
        impuestos: [],
        comisiones: [],
        precioEspecialCliente: null,
        precioBase: 1000,
        totalComisiones: 0,
        totalImpuestos: 210,
        margenEfectivoPct: 60,
        precioNetoUnitario: 1000,
        precioBrutoUnitario: 1210,
        precioNetoTotal: 1000,
        precioBrutoTotal: 1210,
      },
      pasos: [
        {
          rutaPasoId: "rp-maquina",
          rutaPasoOrden: 1,
          familiaCodigo: "impresion_digital",
          activado: true,
          costoTotal: 150,
          tiempo: {
            totalMin: 10,
            centroCostoId: "cc-1",
            centroCostoNombre: "Impresión",
            tarifaHora: 600,
            costo: 150,
          },
        },
        {
          rutaPasoId: "rp-manual",
          rutaPasoOrden: 2,
          familiaCodigo: "trabajo_manual",
          activado: true,
          costoTotal: 50,
          tiempo: {
            totalMin: 5,
            centroCostoId: "cc-2",
            centroCostoNombre: "Taller",
            tarifaHora: 600,
            costo: 50,
          },
        },
      ],
      cargosDirectosCotizacion: [],
    } as PropuestaItem["cotizacion"],
    ...over,
  };
}

function paso(over: Partial<TableroPasoData> = {}): TableroPasoData {
  return {
    id: "p-1",
    indice: 0,
    rutaPasoId: "rp-maquina",
    nombre: "Impresión",
    familiaCodigo: "impresion_digital",
    categoriaFamilia: "",
    centroCostoId: "cc-1",
    centroCostoNombre: "Impresión",
    duracionEstimadaMin: 10,
    estado: "hecho",
    motivoBloqueo: null,
    iniciadoEl: null,
    completadoEl: null,
    modoRegistro: "cronometro",
    tiempoRealMin: 20,
    tiempoFuente: "medido",
    iniciadoPorNombre: null,
    completadoPorNombre: null,
    tramoAbierto: null,
    motivoPausa: null,
    tiempoAcumuladoMin: 0,
    mesaEsMia: false,
    mesaUsuarioNombre: null,
    tipoEjecucion: "interno",
    proveedorNombre: null,
    plazoProveedorDias: null,
    estadoCompra: null,
    ...over,
  };
}

function tablero(pasos: TableroPasoData[]): TableroItemData[] {
  return [
    {
      id: "item-1",
      ordenId: "ot-1",
      ordenNumero: "OT-1",
      ordenEstado: "produccion",
      itemIndice: 0,
      codigo: "CART",
      nombre: "Cartel",
      clienteNombre: "Cliente",
      vendedorNombre: "Vendedor",
      cantidad: 1,
      cantidadUnidad: "u.",
      specs: [],
      fechaEntrega: null,
      archivosCount: 0,
      sinRuta: false,
      pasos,
    },
  ];
}

const cargoOrden = (montoNeto: number): PropuestaCargoDirecto => ({
  id: "c1",
  cargoDirectoCatalogoId: "",
  codigoSnapshot: "flete",
  nombreSnapshot: "Flete",
  modoCalculoSnapshot: "MONTO_FIJO_PLANO",
  configSnapshot: {},
  baseCalculo: 0,
  montoNeto,
  impuestoPorcentaje: 0,
  impuestoMonto: 0,
  total: montoNeto,
  detalle: "",
  createdAt: "",
});

describe("consolidarCostosOrden", () => {
  it("suma el costo de los items separando materiales de centros", () => {
    const c = consolidarCostosOrden([item()], []);
    expect(c.costoItems).toBe(400);
    expect(c.materialesTotal).toBe(200);
    expect(c.centroCostoTotal).toBe(200);
    expect(c.margenMonto).toBe(600);
    expect(c.margenPct).toBe(60);
  });

  it("imputa los cargos de ORDEN al costo y baja el margen de la orden", () => {
    const c = consolidarCostosOrden([item()], [cargoOrden(100)]);
    // El costo del item no cambia; el de la orden sí.
    expect(c.costoItems).toBe(400);
    expect(c.cargosOrdenTotal).toBe(100);
    expect(c.costoTotal).toBe(500);
    // Éste es el punto de toda la vista: el margen por producto sigue en 600,
    // pero el de la orden baja porque el flete lo paga la orden.
    expect(c.lineas[0].desglose.margenMonto).toBe(600);
    expect(c.margenMonto).toBe(500);
    expect(c.margenPct).toBe(50);
    expect(c.contribucionMonto).toBe(700);
  });

  it("la composición del costo suma el costo total de la orden", () => {
    const c = consolidarCostosOrden([item()], [cargoOrden(100)]);
    const suma = c.composicion.reduce((acc, p) => acc + p.monto, 0);
    expect(suma).toBeCloseTo(c.costoTotal, 6);
    expect(c.composicion.reduce((acc, p) => acc + p.pct, 0)).toBeCloseTo(100, 6);
  });

  it("expone como 'Sin desglosar' el costo que el snapshot no desglosó", () => {
    const viejo = item();
    viejo.cotizacion.costos = {
      tiempoTotal: 0,
      materialesTotal: 0,
      cargosDirectosTotal: 0,
      total: 400,
      unitario: 400,
    };
    viejo.cotizacion.pasos = [];
    const c = consolidarCostosOrden([viejo], []);
    const sinDesglosar = c.composicion.find((p) => p.key === "sin-desglosar");
    expect(sinDesglosar?.monto).toBe(400);
    expect(c.costoTotal).toBe(400);
  });

  it("deja afuera de todos los totales a los items sin cotizar", () => {
    const pendiente = item({ id: "item-2", precioUnitario: 0, total: 0 });
    const c = consolidarCostosOrden([item(), pendiente], []);
    expect(c.itemsSinCostear).toBe(1);
    expect(c.costoItems).toBe(400);
    expect(c.lineas).toHaveLength(2);
  });

  it("agrupa por centro de costo cruzando los pasos de todos los items", () => {
    const c = consolidarCostosOrden([item()], []);
    expect(c.centros.map((x) => x.nombre)).toEqual(["Impresión", "Taller"]);
    expect(c.centros[0]).toMatchObject({
      costoTotal: 150,
      minutosCotizados: 10,
    });
  });
});

describe("tiempoRealAtipico", () => {
  it("descarta más de 8 horas", () => {
    expect(tiempoRealAtipico(481, 400)).toBe(true);
    expect(tiempoRealAtipico(480, 400)).toBe(false);
  });

  it("descarta más de 5× el estimado", () => {
    expect(tiempoRealAtipico(51, 10)).toBe(true);
    expect(tiempoRealAtipico(50, 10)).toBe(false);
  });

  it("sin estimado sólo aplica el techo absoluto", () => {
    expect(tiempoRealAtipico(300, null)).toBe(false);
    expect(tiempoRealAtipico(300, 0)).toBe(false);
  });
});

describe("tiempoFueMedido", () => {
  it("sólo cuenta lo que alguien midió o declaró", () => {
    expect(tiempoFueMedido("medido")).toBe(true);
    expect(tiempoFueMedido("medido_lote")).toBe(true);
    expect(tiempoFueMedido("declarado")).toBe(true);
    // El estimado lo asentó el sistema, no una medición.
    expect(tiempoFueMedido("estimado")).toBe(false);
    expect(tiempoFueMedido("invalido")).toBe(false);
    expect(tiempoFueMedido(null)).toBe(false);
  });
});

describe("cruzarRealVsCotizado", () => {
  it("empareja por rutaPasoId y reescala el costo con el tiempo real", () => {
    const r = cruzarRealVsCotizado([item()], tablero([paso()]));
    expect(r.pasosMedidos).toBe(1);
    const p = r.pasos[0];
    expect(p.minutosCotizados).toBe(10);
    expect(p.minutosReales).toBe(20);
    expect(p.costoCotizado).toBe(150);
    // El doble de tiempo a la misma tarifa: el desvío que se ve es del tiempo.
    expect(p.costoReal).toBe(300);
    expect(r.desvioMonto).toBe(150);
  });

  it("empareja por índice cuando el paso no tiene rutaPasoId (orden vieja)", () => {
    const r = cruzarRealVsCotizado(
      [item()],
      tablero([paso({ rutaPasoId: null, indice: 1, tiempoRealMin: 10 })]),
    );
    // Índice 1 entre los pasos activados = el paso manual.
    expect(r.pasos[0].costoCotizado).toBe(50);
    expect(r.pasos[0].minutosCotizados).toBe(5);
  });

  it("NO compara un paso cuyo tiempo real es el estimado copiado", () => {
    const r = cruzarRealVsCotizado(
      [item()],
      tablero([paso({ tiempoFuente: "estimado", tiempoRealMin: 10 })]),
    );
    expect(r.pasosMedidos).toBe(0);
    expect(r.pasosHechosSinMedir).toBe(1);
    // Sin esto el desvío daría 0% y la cobertura 100%: el error que la vista
    // tiene que evitar.
    expect(r.desvioPct).toBeNull();
    expect(r.costoCotizadoMedido).toBe(0);
  });

  it("descarta el tiempo atípico y lo cuenta como hecho sin medir", () => {
    const r = cruzarRealVsCotizado(
      [item()],
      tablero([paso({ tiempoRealMin: 600 })]),
    );
    expect(r.pasosAtipicos).toBe(1);
    expect(r.pasosMedidos).toBe(0);
    // Los atípicos son un SUBCONJUNTO de los hechos sin medir: la nota de la
    // vista dice "N sin medir, M de ellos por atípico" y no puede contradecirse.
    expect(r.pasosHechosSinMedir).toBe(1);
  });

  it("no cuenta como medido un paso pendiente", () => {
    const r = cruzarRealVsCotizado(
      [item()],
      tablero([paso({ estado: "pendiente", tiempoRealMin: null })]),
    );
    expect(r.pasosTotal).toBe(1);
    expect(r.pasosHechos).toBe(0);
    expect(r.pasosMedidos).toBe(0);
    expect(r.pasosHechosSinMedir).toBe(0);
  });

  it("agrega el desvío por centro sólo sobre los pasos medidos", () => {
    const r = cruzarRealVsCotizado(
      [item()],
      tablero([
        paso(),
        paso({
          id: "p-2",
          indice: 1,
          rutaPasoId: "rp-manual",
          centroCostoId: "cc-2",
          centroCostoNombre: "Taller",
          duracionEstimadaMin: 5,
          tiempoFuente: "estimado",
          tiempoRealMin: 5,
        }),
      ]),
    );
    const impresion = r.centros.find((c) => c.centroCostoId === "cc-1");
    const taller = r.centros.find((c) => c.centroCostoId === "cc-2");
    expect(impresion).toMatchObject({
      pasosMedidos: 1,
      minutosCotizadosMedidos: 10,
      minutosRealesMedidos: 20,
      desvioMin: 10,
      desvioPct: 100,
    });
    // El paso sin medir aparece en el centro pero no aporta desvío.
    expect(taller).toMatchObject({ pasos: 1, pasosMedidos: 0, desvioPct: null });
  });

  it("cuenta los pasos que no se pueden cruzar con el costeo", () => {
    const r = cruzarRealVsCotizado(
      [item()],
      tablero([paso({ rutaPasoId: "rp-inexistente", indice: 9 })]),
    );
    expect(r.pasosSinEmparejar).toBe(1);
    expect(r.pasos).toHaveLength(0);
  });
});

describe("reconciliarComisionPasarela", () => {
  const base = {
    comisionPasarelaEstimada: 80, // 8% de 1000
    margenMonto: 300,
    precioNeto: 1000,
    totalOrden: 1000,
  };

  it("pago en efectivo: comisión real 0 ⇒ el margen recupera lo estimado", () => {
    const r = reconciliarComisionPasarela({
      ...base,
      cobros: [{ montoBruto: 1000, comisionMonto: 0 }],
    });
    expect(r.real).toBe(0);
    expect(r.ahorro).toBe(80);
    expect(r.margenAjustadoMonto).toBe(380);
    expect(r.saldada).toBe(true);
  });

  it("pagó con un método más barato: ahorro parcial", () => {
    const r = reconciliarComisionPasarela({
      ...base,
      cobros: [{ montoBruto: 1000, comisionMonto: 40 }], // 4% real vs 8% estimado
    });
    expect(r.ahorro).toBe(40);
    expect(r.margenAjustadoMonto).toBe(340);
  });

  it("cobro parcial: no está saldada (reconciliación provisional)", () => {
    const r = reconciliarComisionPasarela({
      ...base,
      cobros: [{ montoBruto: 500, comisionMonto: 0 }],
    });
    expect(r.saldada).toBe(false);
    expect(r.cobros).toBe(1);
  });

  it("varios cobros: suma la comisión real y el bruto cobrado", () => {
    const r = reconciliarComisionPasarela({
      ...base,
      cobros: [
        { montoBruto: 600, comisionMonto: 30 },
        { montoBruto: 400, comisionMonto: 0 },
      ],
    });
    expect(r.real).toBe(30);
    expect(r.cobradoBruto).toBe(1000);
    expect(r.saldada).toBe(true);
    expect(r.margenAjustadoMonto).toBe(350); // 300 + (80 - 30)
  });
});
