"use client";

import { stockUnitLabel } from "./stock-conversion-fields";

import * as React from "react";

import {
  useFecha,
  useConfigRegional,
} from "@/components/navigation/config-regional-provider";
import { getKardex } from "@/lib/inventario-stock-api";
import type { AlmacenMateriaPrima } from "@/lib/inventario-stock";
import { formatearMoneda } from "@/lib/moneda";
import { inventoryHref } from "@/lib/inventario-navigation";
import { useInventoryQuery } from "./use-inventory-query";
import { useInventoryPage } from "./use-stock-page";
import { InventoryVariantPicker } from "./inventory-variant-picker";
import { SelectField } from "@/components/design-system/select-field";
import type { MateriaPrima } from "@/lib/materias-primas";
import { getMateriaPrimaVarianteLabel } from "@/lib/materias-primas-variantes-display";
import { Card, Chip, Spinner } from "@heroui/react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  History,
  Layers,
  PackageOpen,
  Search,
} from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { ActionLink } from "@/components/design-system/action-link";
import { useDesignScope, useDesignTheme } from "@/components/design-system/appearance";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import layout from "@/components/design-system/list-page.module.css";
import materialStyles from "./materiales.module.css";
import styles from "./movimientos-kardex.module.css";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type HistorialPanelProps = {
  materiasPrimas: MateriaPrima[];
  almacenes: AlmacenMateriaPrima[];
};

const AUTO_REFRESH_MS = 15000;
const quantityFormatter = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 8,
});
const tipoLabels: Record<string, string> = {
  ingreso: "Ingreso",
  egreso: "Egreso",
  ajuste_entrada: "Ajuste +",
  ajuste_salida: "Ajuste -",
  transferencia_salida: "Transferencia salida",
  transferencia_entrada: "Transferencia entrada",
};

const origenLabels: Record<string, string> = {
  compra: "Compra",
  consumo_produccion: "Consumo producción",
  ajuste_manual: "Ajuste manual",
  transferencia: "Transferencia",
  devolucion: "Devolución",
  otro: "Otro",
};

const tipoIndicators: Record<string, { symbol: string; className: string }> = {
  ingreso: { symbol: "+", className: styles.incoming },
  ajuste_entrada: { symbol: "+", className: styles.incoming },
  transferencia_entrada: { symbol: "+", className: styles.incoming },
  egreso: { symbol: "-", className: styles.outgoing },
  ajuste_salida: { symbol: "-", className: styles.outgoing },
  transferencia_salida: { symbol: "-", className: styles.outgoing },
};

export function MovimientosKardexPanel({
  materiasPrimas,
  almacenes,
}: HistorialPanelProps) {
  const { fechaNumerica, hora } = useFecha();
  const themeClass = useDesignTheme();
  const scope = useDesignScope();
  const { moneda } = useConfigRegional();
  const query = useInventoryQuery();
  const {
    result: kardex,
    loading: isLoading,
    error,
    refresh: handleConsultar,
  } = useInventoryPage(
    getKardex,
    {
      materiaPrimaId: query.materiaPrimaId,
      varianteId: query.varianteId,
      almacenId: query.almacenId,
      ubicacionId: query.ubicacionId,
      page: query.page,
      pageSize: 50,
    },
    AUTO_REFRESH_MS,
  );
  const pages = Math.max(1, Math.ceil((kardex?.total ?? 0) / 50));
  const varianteId = query.varianteId ?? "__all__";
  const setVarianteId = (id: string) =>
    query.update({
      varianteId: id === "__all__" ? undefined : id,
      ubicacionId: undefined,
    });
  const context = {
    materiaPrimaId: query.materiaPrimaId,
    varianteId: query.varianteId,
    almacenId: query.almacenId,
    ubicacionId: query.ubicacionId,
  };
  React.useEffect(() => {
    if (!isLoading && !error && kardex && query.page > pages)
      query.update({ page: String(pages) }, false);
  }, [isLoading, error, kardex, query, pages]);
  const variantes = React.useMemo(
    () =>
      materiasPrimas
        .filter(
          (item) => !query.materiaPrimaId || item.id === query.materiaPrimaId,
        )
        .flatMap((materiaPrima) =>
          materiaPrima.variantes.map((variante) => ({
            id: variante.id,
            label: getMateriaPrimaVarianteLabel(materiaPrima, variante, { maxDimensiones: 5 }),
          })),
        ),
    [materiasPrimas, query.materiaPrimaId],
  );
  const opcionesFiltro = React.useMemo(
    () => [
      { id: "__all__", label: "Todas las variantes" },
      ...variantes,
    ],
    [variantes],
  );
  const varianteLabelById = React.useMemo(
    () =>
      new Map(
        materiasPrimas.flatMap((materiaPrima) =>
          materiaPrima.variantes.map((variante) => [
            variante.id,
            getMateriaPrimaVarianteLabel(materiaPrima, variante, { maxDimensiones: 5 }),
          ]),
        ),
      ),
    [materiasPrimas],
  );

  const hasMovimientos = Boolean(kardex?.items.length);
  const filtroActivo = Boolean(
    query.varianteId ||
    query.materiaPrimaId ||
    query.almacenId ||
    query.ubicacionId,
  );

  return (
    <section
      {...scope}
      data-visual="brand"
      className={`${themeClass} ${layout.page} ${materialStyles.page}`}
    >
      <header className={layout.header}>
        <div>
          <p className={materialStyles.eyebrow}>Inventario · Trazabilidad</p>
          <h1>Historial de movimientos<span className={materialStyles.titleDot}>.</span></h1>
          <p className={layout.subtitle}>
            Ingresos, egresos, ajustes y transferencias de tus materiales, en un solo lugar.
          </p>
        </div>
        <ActionLink variant="outline" href={inventoryHref("stock", context)}>
          Ver stock <ArrowUpRight data-icon="inline-end" />
        </ActionLink>
      </header>

      <Card className={`${layout.results} ${styles.results}`}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionTitle}>
            <span className={styles.sectionIcon}><History size={20} aria-hidden /></span>
            <div>
              <h2>Registro de inventario</h2>
              <p>Consultá el recorrido de cada variante.</p>
            </div>
          </div>
          <span className={styles.refreshNote}>
            <span aria-hidden /> Actualización automática
          </span>
        </div>
        <div className={layout.toolbar}>
          <div className={styles.filterControls}>
            <div className={styles.filter}>
              <span className={styles.filterLabel} id="movimientos-variante-label">Materia prima / variante</span>
              <InventoryVariantPicker
                label="Filtrar movimientos por variante"
                value={varianteId}
                options={opcionesFiltro}
                onChange={setVarianteId}
              />
            </div>
            <ActionButton
              variant="outline"
              onPress={handleConsultar}
              isPending={isLoading}
              isDisabled={isLoading}
            >
              <Search data-icon="inline-start" />
              {isLoading ? "Consultando…" : "Consultar"}
            </ActionButton>
          </div>
          <div className={styles.warehouseFilter}>
            <SelectField
              aria-label="Filtrar movimientos por depósito"
              value={query.almacenId ?? ""}
              options={[
                { value: "", label: "Todos los depósitos" },
                ...almacenes.map((item) => ({
                  value: item.id,
                  label: item.nombre,
                })),
              ]}
              onChange={(value) =>
                query.update({ almacenId: value, ubicacionId: undefined })
              }
            />
          </div>
          {filtroActivo && (
            <ActionButton
              variant="ghost"
              onPress={() =>
                query.update({
                  materiaPrimaId: undefined,
                  varianteId: undefined,
                  almacenId: undefined,
                  ubicacionId: undefined,
                })
              }
            >
              Quitar filtros
            </ActionButton>
          )}
          <span className={styles.resultCount} role="status">
            {kardex ? `${kardex.total} ${kardex.total === 1 ? "movimiento" : "movimientos"}` : "— movimientos"}
          </span>
        </div>

        {(query.materiaPrimaId || query.ubicacionId) && (
          <div className={styles.context}>
            {query.materiaPrimaId
              ? `Material: ${materiasPrimas.find((item) => item.id === query.materiaPrimaId)?.nombre ?? "seleccionado"}`
              : ""}
            {query.ubicacionId
              ? ` · Ubicación: ${almacenes.flatMap((item) => item.ubicaciones).find((item) => item.id === query.ubicacionId)?.nombre ?? "seleccionada"}`
              : ""}
          </div>
        )}
        <div aria-busy={isLoading}>
          {isLoading ? (
            <div className={styles.loading} role="status">
              <Spinner size="sm" />
              <span>Consultando movimientos…</span>
            </div>
          ) : error ? (
            <Empty className={styles.empty}>
              <EmptyHeader>
                <EmptyTitle>
                  <h3>No pudimos cargar los movimientos</h3>
                </EmptyTitle>
                <EmptyDescription>{error}</EmptyDescription>
              </EmptyHeader>
              <ActionButton variant="outline" onPress={handleConsultar}>Volver a consultar</ActionButton>
            </Empty>
          ) : hasMovimientos && kardex ? (
            <>
              <Table className={`${materialStyles.table} ${styles.table}`} aria-label="Historial de movimientos de inventario">
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Materia prima / variante</TableHead>
                    <TableHead>Depósito / ubicación</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Saldo (cantidad)</TableHead>
                    <TableHead className="text-right">Costo prom.</TableHead>
                    <TableHead>Referencia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kardex.items.map((item) => (
                    <TableRow key={item.movimientoId}>
                      <TableCell>
                        <div className={styles.date}>
                          <span>{fechaNumerica(item.createdAt)}</span>
                          <small>{hora(item.createdAt)}</small>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={styles.material}>
                          <span className={styles.materialIcon}><Layers size={17} aria-hidden /></span>
                          <span>
                            {varianteLabelById.get(item.varianteId) ??
                              (item.materiaPrimaNombre
                                ? `${item.materiaPrimaNombre} - ${item.varianteSku ?? item.varianteId}`
                                : item.varianteSku ?? item.varianteId)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.almacenNombre}
                        <span className={styles.location}>
                          {item.ubicacionNombre}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Chip size="sm" variant="soft" className={`${styles.type} ${tipoIndicators[item.tipo]?.className ?? ""}`}>
                          <span aria-hidden>{tipoIndicators[item.tipo]?.symbol ?? "•"}</span>
                          {tipoLabels[item.tipo] ?? item.tipo}
                        </Chip>
                      </TableCell>
                      <TableCell>
                        {origenLabels[item.origen] ?? item.origen}
                      </TableCell>
                      <TableCell className={styles.number}>
                        {quantityFormatter.format(item.cantidad)}{" "}
                        {item.conversionSnapshot
                          ? stockUnitLabel(item.conversionSnapshot.unidadStock)
                          : stockUnitLabel(item.unidadStock ?? "")}
                        {item.conversionSnapshot &&
                          item.conversionSnapshot.unidadOriginal !==
                            item.conversionSnapshot.unidadStock && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {quantityFormatter.format(
                                item.conversionSnapshot.cantidadOriginal,
                              )}{" "}
                              {stockUnitLabel(
                                item.conversionSnapshot.unidadOriginal,
                              )}{" "}
                              ·{" "}
                              {item.conversionSnapshot.origen ===
                              "recepcion_real"
                                ? "Recepción real"
                                : "Equivalencia guardada"}
                            </div>
                          )}
                      </TableCell>
                      <TableCell className={styles.number}>
                        {quantityFormatter.format(item.saldoPosterior)}{" "}
                        {item.conversionSnapshot
                          ? stockUnitLabel(item.conversionSnapshot.unidadStock)
                          : stockUnitLabel(item.unidadStock ?? "")}
                      </TableCell>
                      <TableCell className={styles.number}>
                        {formatearMoneda(item.costoPromedioPost, moneda, {
                          decimales: 6,
                        })}
                      </TableCell>
                      <TableCell>
                        <span className={styles.reference}>
                          {item.referenciaId ?? "—"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className={layout.pager}>
                <span>
                  {kardex.total} movimientos · Página {kardex.page} de {pages}
                </span>
                <div className="flex gap-2">
                  <ActionButton
                    variant="outline"
                    isDisabled={query.page <= 1}
                    onPress={() =>
                      query.update({ page: String(query.page - 1) }, false)
                    }
                  >
                    Anterior
                  </ActionButton>
                  <ActionButton
                    variant="outline"
                    isDisabled={query.page >= pages}
                    onPress={() =>
                      query.update({ page: String(query.page + 1) }, false)
                    }
                  >
                    Siguiente
                  </ActionButton>
                </div>
              </div>
            </>
          ) : (
            <Empty className={styles.empty}>
              <EmptyHeader>
                <EmptyMedia>
                  <div className={styles.emptyIllustration} aria-hidden>
                    <PackageOpen size={46} strokeWidth={1.2} />
                    <span><History size={18} strokeWidth={1.5} /></span>
                  </div>
                </EmptyMedia>
                <EmptyTitle>
                  <h3>
                    {filtroActivo
                      ? "No hay movimientos para esta selección"
                      : "Todavía no hay movimientos"}
                  </h3>
                </EmptyTitle>
                <EmptyDescription>
                  {filtroActivo
                    ? "Cuando se registren operaciones de esta variante, vas a poder consultar aquí sus cantidades, saldos y costos."
                    : "Cuando comiences a registrar operaciones de stock, acá vas a ver el recorrido de tus materiales: cantidades, saldos y costos."}
                </EmptyDescription>
              </EmptyHeader>
              {filtroActivo ? (
                <ActionButton
                  variant="outline"
                  onPress={() =>
                    query.update({
                      materiaPrimaId: undefined,
                      varianteId: undefined,
                      almacenId: undefined,
                      ubicacionId: undefined,
                    })
                  }
                >
                  Quitar filtros <ArrowUpRight data-icon="inline-end" />
                </ActionButton>
              ) : (
                <ul className={styles.movementTypes} aria-label="Tipos de movimientos del historial">
                  <li><ArrowDownLeft size={15} aria-hidden /> Ingresos</li>
                  <li><ArrowUpRight size={15} aria-hidden /> Egresos</li>
                  <li><ArrowLeftRight size={15} aria-hidden /> Ajustes y transferencias</li>
                </ul>
              )}
            </Empty>
          )}
        </div>
      </Card>
    </section>
  );
}
