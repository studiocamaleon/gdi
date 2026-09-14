"use client";
import { useMemo } from "react";
import Link from "next/link";
import { Chip, Tooltip } from "@heroui/react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { WalletCards } from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { useDesignScope } from "@/components/design-system/appearance";
import theme from "@/components/design-system/theme.module.css";
import type {
  PanelGeneralData,
  PanelGeneralEntrega,
} from "@/lib/panel-general-api";
import { PanelCard, Empty } from "./panel-admin-card";
import s from "./panel-admin-view.module.css";

function Trabajo({ entrega }: { entrega: PanelGeneralEntrega }) {
  const scope = useDesignScope();
  if (entrega.productos.length < 2) return <strong>{entrega.producto}</strong>;
  return (
    <Tooltip>
      <ActionButton
        variant="ghost"
        className={s.producto}
        aria-label={`${entrega.producto}. Ver avance de cada producto`}
      >
        {entrega.producto}
      </ActionButton>
      <Tooltip.Content {...scope} className={theme.theme}>
        <ul className="grid gap-2 p-1">
          {entrega.productos.map((p) => (
            <li key={p.id}>
              {p.nombre} ·{" "}
              {p.progresoPct == null ? "Sin ruta" : `${p.progresoPct}%`}
            </li>
          ))}
        </ul>
      </Tooltip.Content>
    </Tooltip>
  );
}

function Avance({ entrega: e }: { entrega: PanelGeneralEntrega }) {
  const scope = useDesignScope();
  const pct = e.progreso ? e.progreso.porcentaje : e.progresoPct;
  const texto = pct == null ? "—" : `${pct}%`;
  const explicacion =
    e.progreso?.explicacion ??
    (pct == null ? "Sin avance calculable" : "Avance del trabajo previsto");
  return (
    <div className={s.avance}>
      <div
        role="progressbar"
        aria-label={`Avance de ${e.numero}`}
        aria-valuenow={pct ?? undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={explicacion}
        className={s.track}
      >
        <div style={{ width: `${pct ?? 0}%` }} />
      </div>
      <Tooltip>
        <ActionButton
          variant="ghost"
          className={s.progressValue}
          aria-label={`${texto}. ${explicacion}`}
        >
          {texto}
        </ActionButton>
        <Tooltip.Content {...scope} className={theme.theme}>
          {explicacion}
        </Tooltip.Content>
      </Tooltip>
    </div>
  );
}

export function Entregas({
  data,
  abrir,
}: {
  data: PanelGeneralData;
  abrir: (href: string) => void;
}) {
  "use no memo";
  const columnas = useMemo<ColumnDef<PanelGeneralEntrega>[]>(
    () => [
      {
        id: "orden",
        header: "Orden",
        cell: ({ row: { original: e } }) => (
          <>
            <Link className={s.orden} href={e.href}>
              {e.numero}
            </Link>
            <small>{e.cliente}</small>
          </>
        ),
      },
      {
        id: "trabajo",
        header: "Trabajo",
        cell: ({ row }) => <Trabajo entrega={row.original} />,
      },
      {
        id: "etapa",
        header: "Etapa actual",
        cell: ({ row: { original: e } }) => (
          <>
            {e.pasoActual ?? "Lista para retirar"}
            <small>{e.estacionActual ?? "—"}</small>
          </>
        ),
      },
      {
        id: "fecha",
        header: "Entrega",
        cell: ({ row }) => (
          <time dateTime={row.original.fechaEntrega}>
            {row.original.fechaEntrega
              .slice(0, 10)
              .split("-")
              .reverse()
              .slice(0, 2)
              .join("/")}
          </time>
        ),
      },
      {
        id: "estado",
        header: "Estado",
        cell: ({ row }) => (
          <Chip
            size="sm"
            variant="soft"
            className={s.riesgo}
            data-risk={row.original.riesgo}
          >
            {row.original.riesgo === "atrasada"
              ? "Atrasada"
              : row.original.riesgo === "hoy"
                ? "Hoy"
                : "Próxima"}
          </Chip>
        ),
      },
      {
        id: "avance",
        header: "Avance",
        cell: ({ row }) => <Avance entrega={row.original} />,
      },
    ],
    [],
  );
  // eslint-disable-next-line react-hooks/incompatible-library -- Instancia mutable de v8 fuera de React Compiler.
  const tabla = useReactTable({
    data: data.proximasEntregas,
    columns: columnas,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });
  return (
    <PanelCard
      titulo="Próximas entregas"
      descripcion="Atrasadas primero · próximos siete días"
      icono={WalletCards}
      accion={
        <ActionButton
          variant="outline"
          onPress={() => abrir("/produccion/ordenes")}
        >
          Ver todas
        </ActionButton>
      }
    >
      {!data.proximasEntregas.length ? (
        <Empty titulo="Sin entregas próximas">
          No hay órdenes comprometidas para los próximos siete días.
        </Empty>
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table} aria-label="Próximas entregas">
            <thead>
              {tabla.getHeaderGroups().map((group) => (
                <tr key={group.id}>
                  {group.headers.map((h) => (
                    <th key={h.id} scope="col">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {tabla.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PanelCard>
  );
}
