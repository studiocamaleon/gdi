import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PresupuestoPublicoView } from "@/components/comercial/presupuesto-publico";
import { TrackingView } from "@/components/tracking/tracking-view";
import type { PresupuestoPublico } from "@/lib/presupuestos-api";
import type { TrackingPublico } from "@/lib/tracking";

const presupuesto: PresupuestoPublico = {
  numero: "PRES-PRUEBA",
  estado: "enviado",
  negocio: "Imprenta de prueba",
  monedaCodigo: "ARS",
  cliente: "Cliente",
  vendedor: null,
  fechaEmision: "2026-09-17",
  fechaValidez: "2099-09-30",
  observaciones: "Entregar embalado",
  senaSugeridaPct: 50,
  subtotal: 900,
  impuestos: 189,
  cargosDirectos: 0,
  total: 1069,
  descuentoTotal: 100,
  fidelizacion: {
    puntosEstimados: 10,
    canjePuntos: 2,
    canjeMonto: 20,
    condicion: "AL COBRAR",
  },
  items: [
    {
      nombre: "Tarjetas",
      cantidad: 500,
      cantidadUnidad: "u.",
      total: 1089,
      totalLista: 1210,
      descuentoMonto: 121,
      descuentoPct: 10,
      specs: [{ etiqueta: "Material", valor: "Ilustración 300 g" }],
      adicionales: ["Laminado mate"],
    },
  ],
};

describe("logo del presupuesto público", () => {
  it("carga el logo con el token del presupuesto y usa iniciales si no existe", () => {
    const conLogo = renderToStaticMarkup(
      <PresupuestoPublicoView
        token="token/prueba"
        initial={{ ...presupuesto, tieneLogo: true }}
      />,
    );
    expect(conLogo).toContain(
      'src="/api/backend/presupuestos/track/token%2Fprueba/logo"',
    );
    const sinLogo = renderToStaticMarkup(
      <PresupuestoPublicoView
        token="token/prueba"
        initial={{ ...presupuesto, tieneLogo: false }}
      />,
    );
    expect(sinLogo).not.toContain("/presupuestos/track/");
    expect(sinLogo).toContain(">ID</span>");
  });
});
const seguimiento: TrackingPublico = {
  numero: "OT-PRUEBA",
  estado: "pendiente",
  creadaEl: "2026-09-17",
  fechaEntrega: null,
  progresoPct: 0,
  fidelizacion: {
    puntos: 0,
    tipo: "GANANCIA",
    montoCanje: 0,
    estado: "PENDIENTES",
  },
  imprenta: {
    nombre: "Imprenta de prueba",
    iniciales: "IP",
    tieneLogo: false,
    contacto: {
      telefono: "+541100000000",
      whatsapp: "5491100000000",
      domicilio: null,
      horario: null,
      sitioWeb: null,
      urlPerfilGoogle: null,
    },
  },
  cliente: { nombre: "Cliente", iniciales: "C" },
  vendedor: null,
  items: [
    {
      id: "item-1",
      nombre: "Vinilo",
      specs: [{ etiqueta: "Material", valor: "Vinilo mate" }],
      progresoPct: 0,
      pasoActual: "impresion",
      estacionActual: null,
      pasos: [
        {
          indice: 1,
          nombre: "Impresión interna",
          familiaCodigo: "impresion_por_area",
          estado: "pendiente",
          completadoEl: null,
          duracionEstimadaMin: 20,
        },
      ],
      archivos: [],
    },
  ],
  archivos: [
    {
      id: "archivo-1",
      nombre: "Prueba compartida.pdf",
      bytes: 1024,
      esImagen: false,
    },
  ],
  actividad: [],
};
const renderPresupuesto = (cambios: Partial<PresupuestoPublico> = {}) =>
  renderToStaticMarkup(
    <PresupuestoPublicoView
      token="prueba"
      initial={{ ...presupuesto, ...cambios }}
    />,
  );
const renderTracking = (cambios: Partial<TrackingPublico> = {}) =>
  renderToStaticMarkup(
    <TrackingView
      token="prueba"
      initialData={{ ...seguimiento, ...cambios }}
    />,
  );

describe("contratos de las vistas públicas", () => {
  it("conserva el snapshot comercial, descuentos, canje y condiciones sin recalcular el total", () => {
    const html = renderPresupuesto();
    for (const dato of [
      "1.069",
      "1.089",
      "1.210",
      "900",
      "189",
      "10%",
      "Ilustración 300 g",
      "Laminado mate",
      "Entregar embalado",
      "50",
      "Canje",
      "20",
    ])
      expect(html).toContain(dato);
    expect(html).toContain("Aprobar presupuesto");
    expect(html).toContain("No avanzar");
    expect(html).not.toContain("Confirmar aprobación");
  });
  it.each([
    "aprobado",
    "convertido",
    "vencido",
    "rechazado",
    "borrador",
    "pendiente_aprobacion",
  ] as const)("no permite decidir un presupuesto %s", (estado) => {
    const html = renderPresupuesto({ estado });
    expect(html).not.toContain("Aprobar presupuesto");
    expect(html).not.toContain(">No avanzar<");
    expect(html).toContain("1.069");
  });
  it("conserva la moneda del presupuesto público", () => {
    const html = renderPresupuesto({ monedaCodigo: "USD" });
    expect(html).toContain("US$");
    expect(html).not.toContain("AR$");
  });
  it("muestra el estado de enlace inexistente sin acciones de decisión", () => {
    const html = renderToStaticMarkup(
      <PresupuestoPublicoView token="inexistente" initial={null} />,
    );
    expect(html).toContain("No encontramos este presupuesto");
    expect(html).not.toContain("Aprobar presupuesto");
  });
  it.each(["pendiente", "produccion", "entregada"])(
    "no ofrece el QR de retiro en estado %s",
    (estado) => {
      expect(renderTracking({ estado })).not.toContain("qr-retiro.png");
    },
  );
  it("ofrece el QR autorizado por token sólo cuando está finalizada", () => {
    expect(renderTracking({ estado: "finalizada" })).toContain(
      "/api/backend/ordenes-trabajo/track/prueba/qr-retiro.png",
    );
  });
  it("mantiene descargas por token y el contacto de la empresa, sin exponer tiempos internos", () => {
    const html = renderTracking();
    expect(html).toContain(
      "/api/backend/ordenes-trabajo/track/prueba/archivos/archivo-1",
    );
    expect(html).toContain("https://wa.me/5491100000000");
    expect(html).toContain("tel:+541100000000");
    expect(html).toContain("A confirmar");
    expect(html).toContain("Pendiente");
    expect(html).not.toContain("En curso");
    expect(html).not.toContain("Impresión interna");
    expect(html).not.toContain("20 min");
  });
});
