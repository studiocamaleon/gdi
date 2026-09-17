"use client";

import * as React from "react";
import Link from "next/link";
import { HardDriveIcon, Trash2Icon } from "lucide-react";

import { formatBytes, type ArchivoScope } from "@/lib/archivos";
import {
  getUsoAlmacenamiento,
  type UsoAlmacenamiento,
} from "@/lib/archivos-api";

const ETIQUETA_SCOPE: Record<ArchivoScope, string> = {
  TENANT_BRANDING: "Identidad visual",
  CAMPANA: "Campañas",
  CLIENTE: "Clientes",
  ORDEN: "Órdenes",
  ORDEN_ITEM: "Arte de producción",
  COTIZACION: "Presupuestos",
  COMPROBANTE: "Comprobantes",
  COBRO: "Cobros",
  EGRESO: "Facturas de compra",
  PRODUCTO: "Productos",
  PROVEEDOR: "Proveedores",
};

/**
 * El TOPE, que es un número redondo elegido por alguien ("5 GB"), no una
 * medición. `formatBytes` fuerza dos decimales porque sirve para tamaños de
 * archivo reales; acá eso convierte el plan en "500.00 GB".
 */
function formatCuota(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  if (gb < 1) return formatBytes(bytes);
  return `${Number(gb.toFixed(2))} GB`;
}

/** De dónde sale el tope, dicho en criollo. */
function textoDeCuota(uso: UsoAlmacenamiento): string {
  if (uso.cuotaOrigen === "plan") {
    return `de ${formatCuota(uso.cuotaBytes!)} de tu plan${uso.plan ? ` ${uso.plan.nombre}` : ""}`;
  }
  if (uso.cuotaOrigen === "ajuste") {
    return `de ${formatCuota(uso.cuotaBytes!)} asignados a tu cuenta`;
  }
  return "sin límite asignado";
}

/**
 * Cuánto espacio ocupa el tenant, en qué, y cuánto le queda.
 *
 * Vivía como una tarjeta perdida dentro de Datos fiscales. Ahora es su propia
 * pantalla porque el espacio es del plan, no de la facturación: cuando se
 * llena, las subidas se rechazan y hay que saber qué lo está llenando.
 */
export function AlmacenamientoView() {
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

  const alerta = uso?.porcentaje != null && uso.porcentaje >= 85;

  return (
    <div
      style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "32px 28px 80px" }}
    >
      <div className="apm-wrap">
        <div className="apm-head">
          <div>
            <h1>Almacenamiento</h1>
            <div className="sub">
              El espacio que ocupan los archivos de tu cuenta y cuánto te queda.
              Cuando se llena, las subidas se rechazan.
            </div>
          </div>
        </div>

        <div className="arc-page" style={{ display: "block" }}>
          <div className="arc-card">
            <div className="arc-card-sec">
              {error ? (
                <div className="arch-vacio">
                  No se pudo leer el uso de espacio.
                </div>
              ) : !uso ? (
                <div className="arch-vacio">Cargando…</div>
              ) : (
                <div className="arch-uso">
                  <div className="arch-uso-head">
                    <span className="ico">
                      <HardDriveIcon />
                    </span>
                    <div className="tot">
                      <b>{formatBytes(uso.bytes)}</b>
                      <span>{textoDeCuota(uso)}</span>
                    </div>
                    {uso.papelera.cantidad > 0 ? (
                      <div
                        className="pap"
                        title="Ya no ocupa cuota; se purga a los 30 días"
                      >
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

                  {uso.restanteBytes !== null ? (
                    <div className="arch-uso-restante">
                      Te quedan <b>{formatCuota(uso.restanteBytes)}</b> libres ·{" "}
                      {uso.porcentaje}% usado
                    </div>
                  ) : (
                    <div className="arch-uso-restante">
                      Tu plan no declara un tope de espacio, así que no hay
                      límite que frene las subidas.
                    </div>
                  )}

                  {alerta ? (
                    <div className="arch-uso-alerta">
                      Estás usando el {uso.porcentaje}% del espacio. Cuando se
                      llene, las subidas se rechazan: liberá archivos
                      {uso.cuotaOrigen === "plan"
                        ? " o pasate a un plan con más espacio."
                        : " o pedí que te amplíen el espacio."}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {uso && !error ? (
              <div className="arc-card-sec">
                <div className="arc-sec-t">En qué se va</div>
                {uso.porScope.length > 0 ? (
                  <div className="arch-uso-detalle">
                    {uso.porScope.map((s) => (
                      <div key={s.scope} className="fila">
                        <span className="k">
                          {ETIQUETA_SCOPE[s.scope] ?? s.scope}
                        </span>
                        <span className="c">{s.cantidad}</span>
                        <span className="v">{formatBytes(s.bytes)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="arch-vacio">
                    Todavía no hay archivos guardados.
                  </div>
                )}
              </div>
            ) : null}

            {uso?.cuotaOrigen === "plan" ? (
              <div className="arc-card-sec">
                <div className="arc-sec-t">Tu plan</div>
                <div className="arch-uso-plan">
                  <span>
                    {uso.plan?.nombre} · {formatCuota(uso.cuotaBytes!)} de
                    archivos
                  </span>
                  <Link href="/suscripcion" className="btn ghost">
                    Ver planes
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
