"use client";

import * as React from "react";
import { toast } from "sonner";
import type { TableroItemData } from "@/lib/tablero-produccion";
import { avanzarCompraProduccion } from "@/lib/ordenes-trabajo-api";

/**
 * Panel "Compras / Tercerizados" de una OT (F2): los pasos que se compran a un
 * proveedor (no van al tablero). Avanza el estado de compra; al llegar a
 * recibido/entregado el paso queda "hecho" y desbloquea el paso interno
 * siguiente. docs/productos-tercerizados-diseno.md §6.
 */
const ESTADOS = ["pendiente", "pedido", "recibido", "entregado"] as const;
const LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  pedido: "Pedido",
  recibido: "Recibido",
  entregado: "Entregado",
};

export function PanelComprasOt({
  items,
  onChanged,
}: {
  items: TableroItemData[];
  onChanged: () => void;
}) {
  const [saving, setSaving] = React.useState<string | null>(null);

  const compras = items.flatMap((item) =>
    item.pasos
      .filter((paso) => paso.tipoEjecucion === "tercerizado")
      .map((paso) => ({ paso, item })),
  );
  if (compras.length === 0) return null;

  const avanzar = async (pasoId: string, estado: string) => {
    setSaving(pasoId);
    try {
      await avanzarCompraProduccion(pasoId, estado);
      toast.success(`Compra: ${LABEL[estado]}`);
      onChanged();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudo actualizar la compra.",
      );
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="otd-card">
      <div className="otd-card-head">
        <span className="ttl">
          Compras / Tercerizados <span className="ct">{compras.length}</span>
        </span>
        <span className="sub">Pasos que compramos a un proveedor (fuera del tablero)</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {compras.map(({ paso, item }) => {
          const actual = paso.estadoCompra ?? "pendiente";
          const idxActual = ESTADOS.indexOf(actual as (typeof ESTADOS)[number]);
          return (
            <div
              key={paso.id}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: "12px 0",
                borderBottom: "1px solid var(--hairline)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{paso.nombre}</div>
                  <div style={{ fontSize: 12, color: "var(--muted-text)" }}>
                    {item.nombre}
                    {paso.proveedorNombre ? <> · {paso.proveedorNombre}</> : null}
                    {paso.plazoProveedorDias != null ? (
                      <> · plazo {paso.plazoProveedorDias} d</>
                    ) : null}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {ESTADOS.map((estado, i) => {
                  const activo = i <= idxActual;
                  return (
                    <button
                      key={estado}
                      type="button"
                      disabled={saving === paso.id || estado === actual}
                      onClick={() => avanzar(paso.id, estado)}
                      style={{
                        fontSize: 12,
                        padding: "5px 12px",
                        borderRadius: 6,
                        cursor: estado === actual ? "default" : "pointer",
                        border: `1px solid ${activo ? "var(--ink)" : "var(--hairline)"}`,
                        background: activo ? "var(--ink)" : "transparent",
                        color: activo ? "#fff" : "var(--muted-text)",
                        opacity: saving === paso.id ? 0.6 : 1,
                      }}
                    >
                      {LABEL[estado]}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
