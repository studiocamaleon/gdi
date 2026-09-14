"use client";

import * as React from "react";
import Link from "next/link";
import { Chip } from "@heroui/react";
import { ActionButton as Button } from "@/components/design-system/action-button";
import {
  Upload,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronRight,
  Eye,
  Package,
  Plus,
  Star,
  Trash2,
  Zap,
} from "lucide-react";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import {
  formatCurrency,
  formatUnidad,
  formatUnitPrice,
  type PropuestaItem,
} from "@/lib/propuestas";
import {
  formatCantidadItem,
  getItemOrderVisibleAmounts,
} from "@/lib/orden-productos-presentacion";
import { useOrdenProductosTable } from "./use-orden-productos-table";
import s from "./orden-productos-table.module.css";

type Props = {
  items: PropuestaItem[];
  sinComprobante: boolean;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  recotizandoIds: Set<string>;
  onAdd?: () => void;
  onPrint?: () => void;
  getTomo: (item: PropuestaItem) => {
    id: string | null;
    nombre: string | null;
  };
  getActions: (item: PropuestaItem) => {
    onRemove?: () => void;
    onVerPrecios?: () => void;
  };
  renderDetail: (item: PropuestaItem, index: number) => React.ReactNode;
  rowRef: (id: string, node: HTMLElement | null) => void;
};

export function OrdenProductosTable({
  items,
  sinComprobante,
  expandedIds,
  onToggle,
  recotizandoIds,
  onAdd,
  onPrint,
  getTomo,
  getActions,
  renderDetail,
  rowRef,
}: Props) {
  "use no memo"; // TanStack Table v8 expone una instancia mutable.
  const { moneda } = useConfigRegional();
  const table = useOrdenProductosTable(items, sinComprobante);
  const rows = table.getRowModel().rows;
  const tableId = React.useId();
  const fmt = (n: number) => formatCurrency(n, moneda);
  return (
    <section className={s.card} aria-label="Productos de la orden">
      {(onPrint || onAdd) && (
        <header className={s.header}>
          <div className={s.tools}>
            {onPrint && (
              <Button
                variant="ghost"
                className={s.print}
                onPress={onPrint}
                title="Impresiones rápidas (C)"
              >
                <Zap />
                Impresiones rápidas
              </Button>
            )}
            {onAdd && (
              <Button
                tone="neutral"
                onPress={onAdd}
                title="Agregar producto (P)"
              >
                <Plus />
                Agregar producto
              </Button>
            )}
          </div>
        </header>
      )}
      {recotizandoIds.size > 0 && (
        <p
          role="status"
          className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent-soft-foreground"
        >
          Recotizando {recotizandoIds.size}{" "}
          {recotizandoIds.size === 1 ? "producto" : "productos"} con los precios
          del cliente seleccionado…
        </p>
      )}
      {items.length === 0 ? (
        <div className={s.empty}>
          <span className={s.emptyIcon}>
            <Package aria-hidden />
          </span>
          <div className={s.emptyCopy}>
            <h3>Tu orden empieza con un producto</h3>
            <p>Agregá un producto o un trabajo para comenzar.</p>
          </div>
          {onAdd && (
            <div className={s.emptyActions}>
              <Button variant="primary" size="sm" onPress={onAdd}>
                <Plus />
                Agregar primer producto
              </Button>
              <Link className={s.linkButton} href="/comercial/presupuestos">
                <Upload aria-hidden />
                Desde un presupuesto
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className={s.scroller}>
          <table className={s.table}>
            <caption className="sr-only">
              Productos de la orden. Ordenar no modifica los importes ni el
              orden guardado.
            </caption>
            <thead>
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id}>
                  {group.headers.map((header) => {
                    const sorted = header.column.getIsSorted();
                    return (
                      <th
                        key={header.id}
                        scope="col"
                        aria-sort={
                          sorted
                            ? sorted === "asc"
                              ? "ascending"
                              : "descending"
                            : undefined
                        }
                      >
                        {header.column.getCanSort() ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className={s.sort}
                            onPress={() => header.column.toggleSorting()}
                            aria-label={`Ordenar por ${header.column.columnDef.header}`}
                          >
                            {String(header.column.columnDef.header)}
                            {sorted === "asc" ? (
                              <ArrowUp />
                            ) : sorted === "desc" ? (
                              <ArrowDown />
                            ) : (
                              <ArrowUpDown />
                            )}
                          </Button>
                        ) : header.id === "acciones" ? (
                          <span className="sr-only">Acciones</span>
                        ) : (
                          String(header.column.columnDef.header)
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {rows.map((row) => {
                const item = row.original;
                const amount = getItemOrderVisibleAmounts(item);
                const total = sinComprobante ? amount.subtotal : amount.total;
                const pending = item.precioUnitario === 0 && item.total === 0;
                const special =
                  !!item.cotizacion.desglosePrecio?.precioEspecialCliente;
                const discount = item.cotizacion.desglosePrecio?.descuento;
                const open = expandedIds.has(item.id);
                const actions = getActions(item);
                const tomo = getTomo(item);
                const detailId = `${tableId}-${item.id}`;
                return (
                  <React.Fragment key={row.id}>
                    <tr
                      ref={(node) => rowRef(item.id, node)}
                      data-expanded={open}
                      aria-busy={recotizandoIds.has(item.id) || undefined}
                    >
                      <td>
                        <div className="flex items-start gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            isIconOnly
                            onPress={() => onToggle(item.id)}
                            aria-expanded={open}
                            aria-controls={detailId}
                            aria-label={`${open ? "Ocultar" : "Ver"} detalle de ${item.productoNombre}`}
                          >
                            <ChevronRight
                              className={open ? "rotate-90" : undefined}
                            />
                          </Button>
                          <div className="flex min-w-0 flex-col gap-1 py-1">
                            <button
                              type="button"
                              className={s.product}
                              onClick={() => onToggle(item.id)}
                              aria-expanded={open}
                              aria-controls={detailId}
                            >
                              {item.productoNombre}
                              {item.varianteNombre && (
                                <span className="font-normal text-muted-foreground">
                                  {" "}
                                  · {item.varianteNombre}
                                </span>
                              )}
                            </button>
                            <span className="text-xs text-muted-foreground">
                              {[
                                item.categoriaComercialNombre,
                                item.subcategoriaComercialNombre,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                            {tomo.id && (
                              <span className="text-xs text-accent-soft-foreground">
                                Tomo anillado
                                {tomo.nombre ? ` · ${tomo.nombre}` : ""}
                              </span>
                            )}
                            {special && (
                              <Chip size="sm" color="success" variant="soft">
                                <Star className="size-3" />
                                Precio especial
                              </Chip>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="font-medium">
                          {formatCantidadItem(item)}
                        </span>
                        <span className="ml-1 text-muted-foreground">
                          {formatUnidad(item.unidadMedida)}
                        </span>
                      </td>
                      <td>
                        {pending ? (
                          "A cotizar"
                        ) : (
                          <div className="flex flex-col items-end gap-1">
                            {discount?.aplicado && (
                              <span className="text-xs text-muted-foreground line-through">
                                {fmt(
                                  amount.subtotal +
                                    Math.round(discount.montoTotal),
                                )}
                              </span>
                            )}
                            <span>{fmt(amount.subtotal)}</span>
                            {discount?.aplicado && (
                              <span className="text-xs text-success">
                                −
                                {item.descuentoInput?.tipo === "PORCENTAJE"
                                  ? `${item.descuentoInput.valor}%`
                                  : fmt(discount.montoTotal)}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      {!sinComprobante && (
                        <td>{pending ? "—" : fmt(amount.impuestos)}</td>
                      )}
                      <td>
                        {pending || item.cantidad <= 0 ? (
                          "—"
                        ) : (
                          <>
                            <span>
                              {formatUnitPrice(total / item.cantidad, moneda)}
                            </span>
                            <span className="ml-1 text-xs text-muted-foreground">
                              /{formatUnidad(item.unidadMedida)}
                            </span>
                          </>
                        )}
                      </td>
                      <td className="font-semibold">
                        {pending ? "Pendiente" : fmt(total)}
                      </td>
                      <td>
                        <div className="flex justify-end gap-1">
                          {actions.onVerPrecios && (
                            <Button
                              variant="ghost"
                              size="sm"
                              isIconOnly
                              onPress={actions.onVerPrecios}
                              aria-label={`Ver precios de ${item.productoNombre}`}
                            >
                              <Eye />
                            </Button>
                          )}
                          {actions.onRemove && (
                            <Button
                              variant="ghost"
                              size="sm"
                              isIconOnly
                              onPress={actions.onRemove}
                              aria-label={`Quitar ${item.productoNombre}`}
                            >
                              <Trash2 />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                    <tr hidden={!open} className={s.detail}>
                      <td colSpan={table.getVisibleLeafColumns().length}>
                        <div id={detailId}>{renderDetail(item, row.index)}</div>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
