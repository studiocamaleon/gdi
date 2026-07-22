"use client";

import * as React from "react";
import { HardDriveIcon, Trash2Icon } from "lucide-react";

import { formatBytes, type ArchivoScope } from "@/lib/archivos";
import {
  getUsoAlmacenamiento,
  type UsoAlmacenamiento,
} from "@/lib/archivos-api";

const ETIQUETA_SCOPE: Record<ArchivoScope, string> = {
  TENANT_BRANDING: "Identidad visual",
  CLIENTE: "Clientes",
  ORDEN: "Órdenes",
  ORDEN_ITEM: "Arte de producción",
  COTIZACION: "Presupuestos",
  COMPROBANTE: "Comprobantes",
  COBRO: "Cobros",
  PRODUCTO: "Productos",
  PROVEEDOR: "Proveedores",
};

/**
 * Cuánto espacio ocupa el tenant y en qué.
 *
 * Sin esto la cuota sólo se manifestaba como un error repentino a mitad de una
 * subida, sin ninguna forma de anticiparlo ni de saber qué la está llenando.
 */
export function UsoAlmacenamientoCard() {
  const [uso, setUso] = React.useState<UsoAlmacenamiento | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    let vivo = true;
    getUsoAlmacenamiento()
      .then((r) => {
        if (vivo) setUso(r);
      })
      .catch(() => {
        if (vivo) setError(true);
      });
    return () => {
      vivo = false;
    };
  }, []);

  if (error) {
    return <div className="arch-vacio">No se pudo leer el uso de espacio.</div>;
  }
  if (!uso) return <div className="arch-vacio">Cargando…</div>;

  const alerta = uso.porcentaje !== null && uso.porcentaje >= 85;

  return (
    <div className="arch-uso">
      <div className="arch-uso-head">
        <span className="ico">
          <HardDriveIcon />
        </span>
        <div className="tot">
          <b>{formatBytes(uso.bytes)}</b>
          <span>
            {uso.cuotaBytes
              ? `de ${formatBytes(uso.cuotaBytes)}`
              : "sin límite configurado"}
          </span>
        </div>
        {uso.papelera.cantidad > 0 ? (
          <div className="pap" title="Ya no ocupa cuota; se purga a los 30 días">
            <Trash2Icon />
            {formatBytes(uso.papelera.bytes)} en papelera
          </div>
        ) : null}
      </div>

      {uso.porcentaje !== null ? (
        <div className={`arch-uso-bar${alerta ? " alerta" : ""}`}>
          <i style={{ width: `${Math.max(2, uso.porcentaje)}%` }} />
        </div>
      ) : null}

      {alerta ? (
        <div className="arch-uso-alerta">
          Estás usando el {uso.porcentaje}% del espacio. Cuando se llene, las
          subidas se rechazan: liberá archivos o pedí más espacio.
        </div>
      ) : null}

      {uso.porScope.length > 0 ? (
        <div className="arch-uso-detalle">
          {uso.porScope.map((s) => (
            <div key={s.scope} className="fila">
              <span className="k">{ETIQUETA_SCOPE[s.scope] ?? s.scope}</span>
              <span className="c">{s.cantidad}</span>
              <span className="v">{formatBytes(s.bytes)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="arch-vacio">Todavía no hay archivos guardados.</div>
      )}
    </div>
  );
}
