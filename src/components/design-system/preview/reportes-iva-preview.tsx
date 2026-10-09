"use client";
import { ChartNoAxesCombinedIcon, ReceiptTextIcon } from "lucide-react";
import { useState } from "react";
import { ResumenEjecutivo } from "@/components/panel/resumen-ejecutivo";
import { ReporteComercial } from "@/components/panel/reporte-comercial";
import { DesignSystemProvider } from "../appearance";
import { SegmentedControl } from "../choice-controls";
import type { ResumenData, ComercialPanel } from "@/lib/panel-api";
import brand from "../brand-workspace-theme.module.css";
import layout from "../list-page.module.css";
const datos: ResumenData = {
  meta: {
    fuente: "Órdenes emitidas · muestra ficticia",
    limites: ["Costos estimados del trabajo."],
    sinComparativa: true,
    rango: { desde: "2026-10-01", hasta: "2026-10-09" },
    rangoAnterior: { desde: "2026-09-22", hasta: "2026-09-30" },
    granularidad: "dia",
  },
  rentabilidad: {
    ventas: 100000,
    ventasConIva: 116500,
    ventasDeltaPct: null,
    margenBruto: 50000,
    margenBrutoPct: 50,
    contribucion: 65000,
    contribucionPct: 65,
    puntoEquilibrio: 76923.08,
    avancePct: 130,
    costoTotal: 50000,
    costosFijos: 50000,
  },
  produccion: {
    otdPct: 95,
    utilizacionPct: 75,
    trabajosEnCola: 8,
    diasDeCarga: 2,
  },
  serie: [
    { fecha: "2026-10-01", monto: 40000, montoConIva: 48400, costo: 20000 },
    { fecha: "2026-10-05", monto: 60000, montoConIva: 68100, costo: 30000 },
  ],
  topClientes: [
    {
      id: "muestra",
      nombre: "Cliente de muestra",
      ordenes: 2,
      facturado: 100000,
      facturadoConIva: 116500,
    },
  ],
  topProductos: [
    {
      nombre: "Vinilos de muestra",
      ventas: 100000,
      ventasConIva: 116500,
      margenPct: 50,
      items: 2,
    },
  ],
  alertas: [],
};
const comercial: ComercialPanel = {
  kpis: {
    ventas: 100000,
    ventasConIva: 116500,
    ventasDeltaPct: null,
    ventasDeltaAnualPct: null,
    ordenes: 2,
    ordenesDeltaPct: null,
    ticketPromedio: 50000,
    ticketPromedioConIva: 58250,
    itemsPorOrden: 1,
    nuevosClientes: 1,
    clientesDormidos: 0,
  },
  serie: datos.serie,
  serieTicket: [],
  granularidad: "dia",
  estacionalidad: [],
  rankingClientes: datos.topClientes,
  rankingVendedores: [],
  mixCategoria: [
    { nombre: "Gran formato", monto: 100000, montoConIva: 116500, pct: 100 },
  ],
  mixTecnologia: [],
  dormidos: [],
};
/** Sólo desarrollo: no consulta cuentas ni dispara integraciones. */
export function ReportesIvaPreview() {
  const [vista, setVista] = useState("resumen");
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <main
        data-ui="heroui"
        data-appearance="light"
        className={`${brand.theme} ${layout.page}`}
      >
        <h1>Centro de análisis · Muestra local</h1>
        <SegmentedControl
          aria-label="Vista de muestra"
          value={vista}
          onChange={setVista}
          options={[
            {
              value: "resumen",
              label: "Resumen",
              icon: <ChartNoAxesCombinedIcon />,
            },
            {
              value: "comercial",
              label: "Comercial",
              icon: <ReceiptTextIcon />,
            },
          ]}
        />
        <section data-reporte-cuerpo>
          {vista === "resumen" ? (
            <ResumenEjecutivo d={datos} />
          ) : (
            <ReporteComercial d={{ ...comercial, meta: datos.meta }} />
          )}
        </section>
      </main>
    </DesignSystemProvider>
  );
}
