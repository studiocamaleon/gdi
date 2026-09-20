"use client";

import { DollarSign, History, Layers, Package, RefreshCw } from "lucide-react";
import { getResumenStockMaterial } from "@/lib/inventario-stock-api";
import { inventoryHref } from "@/lib/inventario-navigation";
import { useInventoryPage } from "./use-stock-page";
import type { MateriaPrima } from "@/lib/materias-primas";
import { getMateriaPrimaVarianteLabel } from "@/lib/materias-primas-variantes-display";
import { formatearMoneda } from "@/lib/moneda";
import {
  useConfigRegional,
  useFecha,
} from "@/components/navigation/config-regional-provider";
import { ActionButton } from "@/components/design-system/action-button";
import { ActionLink } from "@/components/design-system/action-link";
import { ListMetric } from "@/components/design-system/list-metric";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { stockUnitLabel } from "./stock-conversion-fields";
import styles from "./materiales.module.css";

const quantity = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 8 });
const movementLabels: Record<string, string> = {
  ingreso: "Ingreso",
  egreso: "Egreso",
  ajuste_entrada: "Ajuste +",
  ajuste_salida: "Ajuste −",
  transferencia_entrada: "Transferencia entrada",
  transferencia_salida: "Transferencia salida",
};

const loadMaterialStock = (
  params: { id: string; revision: string },
  signal?: AbortSignal,
) => getResumenStockMaterial(params.id, signal);

/** Recibe el material persistido: un borrador de unidades no cambia la lectura del saldo. */
export function MaterialInventarioPanel({
  material,
}: {
  material: MateriaPrima;
}) {
  const { moneda } = useConfigRegional();
  const { fechaNumerica, hora } = useFecha();
  const { result, loading, error, refresh } = useInventoryPage(
    loadMaterialStock,
    { id: material.id, revision: material.updatedAt },
  );
  const rows = result ?? [];
  const ready = !loading && !error;
  return (
    <div className="flex flex-col gap-4" aria-busy={loading}>
      <div className={styles.stockMetrics}>
        <ListMetric
          label="Variantes"
          value={ready ? rows.length : "—"}
          hint="Variantes de este material"
          icon={Layers}
        />
        <ListMetric
          label="Con existencias"
          value={ready ? rows.filter((row) => row.stockTotal > 0).length : "—"}
          hint="Variantes con saldo físico"
          icon={Package}
        />
        <ListMetric
          label="Valor del stock"
          value={
            ready
              ? formatearMoneda(
                  rows.reduce((total, row) => total + row.valorStock, 0),
                  moneda,
                  { decimales: 2 },
                )
              : "—"
          }
          hint={`Valorización en ${moneda.codigo}`}
          icon={DollarSign}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Existencias físicas por variante, en su unidad de stock.
        </p>
        <div className="flex flex-wrap gap-2">
          <ActionButton
            variant="outline"
            onPress={refresh}
            isDisabled={loading}
          >
            <RefreshCw data-icon="inline-start" />
            Actualizar
          </ActionButton>
          <ActionLink
            variant="outline"
            href={inventoryHref("stock", { materiaPrimaId: material.id })}
          >
            Ver stock por depósito
          </ActionLink>
        </div>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>No pudimos consultar el inventario</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        <div className={styles.tableFrame}>
          <Table className={styles.table} aria-label="Inventario del material">
            <TableHeader>
              <TableRow>
                <TableHead>Variante</TableHead>
                <TableHead className="text-right">Existencia física</TableHead>
                <TableHead className="text-right">Reservado</TableHead>
                <TableHead className="text-right">Libre</TableHead>
                <TableHead className="text-right">Costo promedio</TableHead>
                <TableHead className="text-right">Valor stock</TableHead>
                <TableHead className="text-right">
                  Depósitos con stock
                </TableHead>
                <TableHead>Último movimiento</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9}>Consultando inventario…</TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9}>
                    Este material todavía no tiene variantes.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const variant = material.variantes.find(
                    (item) => item.id === row.varianteId,
                  );
                  const context = {
                    materiaPrimaId: material.id,
                    varianteId: row.varianteId,
                  };
                  const movement = row.ultimoMovimiento;
                  return (
                    <TableRow key={row.varianteId}>
                      <TableCell>
                        {variant
                          ? getMateriaPrimaVarianteLabel(material, variant, {
                              maxDimensiones: 5,
                            })
                          : material.nombre}
                      </TableCell>
                      <TableCell className="text-right">
                        {quantity.format(row.stockTotal)}{" "}
                        {stockUnitLabel(row.unidadStock)}
                      </TableCell>
                      <TableCell className="text-right">
                        {quantity.format(row.cantidadReservada)}{" "}
                        {stockUnitLabel(row.unidadStock)}
                      </TableCell>
                      <TableCell className="text-right">
                        {quantity.format(row.cantidadLibre)}{" "}
                        {stockUnitLabel(row.unidadStock)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatearMoneda(row.costoPromedio, moneda, {
                          decimales: 6,
                        })}
                        <span className="block text-xs text-muted-foreground">
                          por {stockUnitLabel(row.unidadStock).toLowerCase()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatearMoneda(row.valorStock, moneda, {
                          decimales: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.almacenesConStock}
                      </TableCell>
                      <TableCell>
                        {movement ? (
                          <>
                            {movementLabels[movement.tipo] ?? movement.tipo}
                            <span className="block text-xs text-muted-foreground">
                              {fechaNumerica(movement.createdAt)} ·{" "}
                              {hora(movement.createdAt)}
                            </span>
                          </>
                        ) : (
                          "Sin movimientos"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <ActionLink
                            variant="outline"
                            href={inventoryHref("stock", context)}
                          >
                            <Package data-icon="inline-start" />
                            Stock
                          </ActionLink>
                          <ActionLink
                            variant="outline"
                            href={inventoryHref("movimientos", context)}
                          >
                            <History data-icon="inline-start" />
                            Movimientos
                          </ActionLink>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
