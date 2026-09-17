"use client";

import { Chip } from "@heroui/react";
import Link from "next/link";
import { ArrowUpRight, Eye } from "lucide-react";
import { IdentityAvatar } from "@/components/design-system/identity-avatar";
import layout from "@/components/design-system/list-page.module.css";
import { formatearMoneda, type Moneda } from "@/lib/moneda";
import type {
  PresupuestoEstado,
  PresupuestoResumen,
} from "@/lib/presupuestos-api";
import s from "./presupuestos-view.module.css";

const ESTADO_LABEL: Record<PresupuestoEstado, string> = {
  borrador: "Borrador",
  pendiente_aprobacion: "Pend. aprobación",
  enviado: "Enviado",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  vencido: "Vencido",
  convertido: "Convertido",
};

export const fmtMoneda = (n: number, moneda: Moneda) =>
  formatearMoneda(n, moneda, { decimales: 0 });
const fmtFecha = (iso: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

function EstadoBadge({
  estado,
  visto,
}: {
  estado: PresupuestoEstado;
  visto?: boolean;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Chip size="sm" variant="soft" className={s.state} data-estado={estado}>
        <span className={s.dot} aria-hidden />
        {ESTADO_LABEL[estado]}
      </Chip>
      {estado === "enviado" && visto ? (
        <Chip
          size="sm"
          variant="soft"
          className={s.seen}
          title="El cliente abrió el presupuesto"
        >
          <Eye size={12} aria-hidden />
          Visto
        </Chip>
      ) : null}
    </span>
  );
}

/** La tabla sólo presenta datos; la vista conserva la navegación y la consulta. */
export function PresupuestosTable({
  lista,
  moneda,
  onAbrir,
}: {
  lista: PresupuestoResumen[];
  moneda: Moneda;
  onAbrir: (id: string) => void;
}) {
  return (
    <div
      className={s.scroller}
      role="region"
      aria-label="Tabla de presupuestos"
      tabIndex={0}
    >
      <table className={s.table} aria-label="Listado de presupuestos">
        <thead>
          <tr>
            <th scope="col">Número</th>
            <th scope="col">Cliente</th>
            <th scope="col">Estado</th>
            <th scope="col">Emisión</th>
            <th scope="col">Válido hasta</th>
            <th scope="col">Total</th>
            <th scope="col">Vendedor</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((p) => (
            <tr
              key={p.id}
              onClick={(event) => {
                if ((event.target as Element).closest("a, button, [tabindex]"))
                  return;
                onAbrir(p.id);
              }}
            >
              <td>
                <Link
                  className={s.number}
                  href={`/comercial/presupuestos/${p.id}`}
                >
                  {p.numero}
                  <ArrowUpRight aria-hidden />
                </Link>
              </td>
              <td className={s.client}>
                <span>{p.cliente}</span>
                <span className={s.detail}>
                  {p.items} {p.items === 1 ? "ítem" : "ítems"}
                </span>
              </td>
              <td>
                <EstadoBadge estado={p.estado} visto={p.visto} />
                {p.estado === "convertido" && p.ordenConvertida ? (
                  <span className={s.converted}>→ {p.ordenConvertida}</span>
                ) : null}
              </td>
              <td className={s.date}>{fmtFecha(p.fechaEmision)}</td>
              <td className={s.date}>{fmtFecha(p.fechaValidez)}</td>
              <td className={s.total}>{fmtMoneda(p.total, moneda)}</td>
              <td>
                <span className={layout.seller}>
                  {p.vendedor && (
                    <span aria-hidden>
                      <IdentityAvatar name={p.vendedor} />
                    </span>
                  )}
                  <span className="truncate" title={p.vendedor ?? undefined}>
                    {p.vendedor ?? "—"}
                  </span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
