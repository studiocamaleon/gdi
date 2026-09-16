"use client";

import { CheckIcon, ExternalLinkIcon, SaveIcon } from "lucide-react";
import { ActionButton as HeroButton } from "@/components/design-system/action-button";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import {
  formatCurrency,
  type PropuestaItem,
  type PropuestaCargoDirecto,
} from "@/lib/propuestas";
import {
  calcularResumenOrden,
  descuentoMontoDeItem,
  getItemOrderVisibleAmounts,
} from "@/lib/orden-productos-presentacion";
import { formatearMoneda } from "@/lib/moneda";
import resumenBar from "./resumen-financiero-bar.module.css";

export function ResumenBar({
  items,
  cargosOrden,
  sinComprobante = false,
  fidelizacionCanjeMonto = 0,
  readOnly = false,
  resumenPersistido,
  layout = "bar",
}: {
  layout?: "bar" | "sidebar";
  items: PropuestaItem[];
  cargosOrden: PropuestaCargoDirecto[];
  sinComprobante?: boolean;
  fidelizacionCanjeMonto?: number;
  readOnly?: boolean;
  resumenPersistido?: {
    subtotal: number;
    impuestos: number;
    descuentoTotal: number;
    total: number;
  };
}) {
  const { moneda } = useConfigRegional();
  const fmt = (v: number) =>
    layout === "sidebar"
      ? formatearMoneda(v, moneda)
      : formatCurrency(v, moneda);
  const resumen = calcularResumenOrden(items, cargosOrden);
  const productosVisibles = items.reduce(
    (acc, item) => {
      const amounts = getItemOrderVisibleAmounts(item);
      return {
        subtotal: acc.subtotal + amounts.subtotal,
        impuestos: acc.impuestos + amounts.impuestos,
        total: acc.total + amounts.total,
      };
    },
    { subtotal: 0, impuestos: 0, total: 0 },
  );
  // Los cargos DEL PASO ya integran el precio neto de cada producto: volver a
  // mostrarlos como sumando sería contarlos visualmente dos veces. Sólo los
  // cargos cargados a nivel ORDEN viven fuera del subtotal de los ítems.
  const subtotal = productosVisibles.subtotal;
  const impuestosVisibles = productosVisibles.impuestos;
  const cargosOrdenMostrados = sinComprobante
    ? resumen.cargosSubtotal
    : resumen.cargosTotal;
  const totalConCargos = productosVisibles.total + resumen.cargosTotal;

  // Las comisiones ya están dentro del subtotal (son parte del precio): no se
  // muestran como línea aparte ni en la barra ni en el desglose del item.
  // Descuento comercial total: suma de lo que resolvió el motor por línea. El
  // subtotal de arriba YA está descontado (el motor lo restó del neto); esta
  // línea es informativa, para que el precio de lista quede a la vista.
  const descuentoTotal = items.reduce(
    (acc, item) => acc + descuentoMontoDeItem(item),
    0,
  );
  // Sin comprobante: se oculta el IVA y el total cae al neto (§6 del cuaderno
  // de margen). Se suman el subtotal neto de productos y los cargos netos DE
  // LA ORDEN; no se usa `total − IVA`, porque arrastra redondeos.
  const impuestosMostrados = sinComprobante ? 0 : impuestosVisibles;
  const totalSinComprobante = subtotal + resumen.cargosSubtotal;
  const totalAntesCanje =
    readOnly && resumenPersistido
      ? resumenPersistido.total
      : sinComprobante
        ? totalSinComprobante
        : totalConCargos;
  // En una OT persistida `resumenPersistido.total` ya incluye el canje. En el
  // cotizador todavía hay que reflejar la simulación en esta barra.
  const canjeMostrado = readOnly ? 0 : Math.max(0, fidelizacionCanjeMonto);
  const totalMostrado = Math.max(0, totalAntesCanje - canjeMostrado);
  const descuentoMostrado =
    readOnly && resumenPersistido
      ? resumenPersistido.descuentoTotal
      : descuentoTotal;
  const subtotalMostrado =
    readOnly && resumenPersistido ? resumenPersistido.subtotal : subtotal;
  const brk = [
    {
      k: descuentoMostrado > 0 ? "Subtotal de lista" : "Subtotal",
      v: subtotalMostrado + descuentoMostrado,
    },
    ...(descuentoMostrado > 0
      ? [{ k: "Descuento", v: -descuentoMostrado }]
      : []),
    {
      k: "Impuestos",
      v:
        readOnly && resumenPersistido
          ? resumenPersistido.impuestos
          : impuestosMostrados,
    },
    ...(cargosOrdenMostrados > 0
      ? [{ k: "Cargos de la orden", v: cargosOrdenMostrados }]
      : []),
    ...(canjeMostrado > 0 ? [{ k: "Canje de puntos", v: -canjeMostrado }] : []),
  ];

  // El mismo cálculo alimenta la barra heredada y el resumen lateral.
  return (
    <footer
      data-layout={layout}
      aria-label="Resumen financiero"
      className={resumenBar.wrap}
    >
      <div className={resumenBar.in}>
        <span className={resumenBar.tot}>
          <span className={resumenBar.totK}>Total</span>
          <span className={resumenBar.totV}>{fmt(totalMostrado)}</span>
        </span>
        <span className={resumenBar.brk}>
          {brk.map((c) => (
            <span
              key={c.k}
              data-discount={c.k === "Descuento" || undefined}
              className={`${resumenBar.cell}${c.v !== 0 ? "" : ` ${resumenBar.zero}`}`}
            >
              <span className={resumenBar.cellK}>{c.k}</span>
              <span className={resumenBar.cellV}>{fmt(c.v)}</span>
            </span>
          ))}
        </span>
      </div>
    </footer>
  );
}

/** Misma validación visual de guardado en cabecera y en catálogos. */
export function OrdenSaveActions({
  tipo,
  empty,
  clienteSeleccionado,
  onEmitir,
  onEmitirPresupuesto,
  emitiendo = false,
  onGuardarBorrador,
  guardandoBorrador = false,
  operacionPendiente = false,
}: {
  tipo: "orden" | "presupuesto";
  empty: boolean;
  clienteSeleccionado: boolean;
  onEmitir?: () => void;
  onEmitirPresupuesto?: () => void;
  emitiendo?: boolean;
  onGuardarBorrador?: () => void;
  guardandoBorrador?: boolean;
  operacionPendiente?: boolean;
}) {
  return (
    <div className={resumenBar.saveActions}>
      {tipo === "orden" && (
        <HeroButton
          variant="outline"
          size="sm"
          onPress={onGuardarBorrador}
          isDisabled={
            guardandoBorrador || emitiendo || empty || operacionPendiente
          }
        >
          <SaveIcon />
          {guardandoBorrador ? "Guardando…" : "Guardar borrador"}
        </HeroButton>
      )}
      <HeroButton
        variant="primary"
        size="sm"
        isDisabled={
          emitiendo ||
          guardandoBorrador ||
          empty ||
          !clienteSeleccionado ||
          operacionPendiente
        }
        title={
          !clienteSeleccionado ? "Seleccioná un cliente para emitir" : undefined
        }
        onPress={tipo === "orden" ? onEmitir : onEmitirPresupuesto}
      >
        {tipo === "orden" ? <CheckIcon /> : <ExternalLinkIcon />}
        {emitiendo
          ? "Emitiendo…"
          : tipo === "orden"
            ? "Emitir OT"
            : "Emitir presupuesto"}
      </HeroButton>
    </div>
  );
}
