"use client";

import * as React from "react";
import { toast } from "sonner";

import { useFecha } from "@/components/navigation/config-regional-provider";
import { getKardex } from "@/lib/inventario-stock-api";
import type { KardexResponse } from "@/lib/inventario-stock";
import type { MateriaPrima } from "@/lib/materias-primas";
import { getMateriaPrimaVarianteLabel } from "@/lib/materias-primas-variantes-display";
import { Autocomplete, Card, Chip, ListBox, SearchField, Spinner } from "@heroui/react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, History, Layers, PackageOpen, Search } from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { ActionLink } from "@/components/design-system/action-link";
import { useDesignScope, useDesignTheme } from "@/components/design-system/appearance";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import layout from "@/components/design-system/list-page.module.css";
import materialStyles from "./materiales.module.css";
import focus from "@/components/design-system/field-focus.module.css";
import styles from "./movimientos-kardex.module.css";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type HistorialPanelProps = {
  materiasPrimas: MateriaPrima[];
};

const AUTO_REFRESH_MS = 15000;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const number2Formatter = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
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

function isUuid(value: string) {
  return UUID_REGEX.test(value);
}

function normalizeVarianteFilter(value: string) {
  if (!value || value === "__all__") return "__all__";
  return isUuid(value) ? value : "__all__";
}

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function MovimientosKardexPanel({ materiasPrimas }: HistorialPanelProps) {
  const { fechaNumerica, hora } = useFecha();
  const themeClass = useDesignTheme();
  const scope = useDesignScope();
  const variantes = React.useMemo(
    () =>
      materiasPrimas.flatMap((materiaPrima) =>
        materiaPrima.variantes
          .filter((variante) => isUuid(variante.id))
          .map((variante) => ({
            id: variante.id,
            label: getMateriaPrimaVarianteLabel(materiaPrima, variante, { maxDimensiones: 5 }),
          })),
      ),
    [materiasPrimas],
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

  const [varianteId, setVarianteId] = React.useState("__all__");
  const [kardex, setKardex] = React.useState<KardexResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadFailed, setLoadFailed] = React.useState(false);
  const isRequestInFlightRef = React.useRef(false);
  const fetchKardex = React.useCallback(async (options?: { silent?: boolean; showError?: boolean }) => {
    const silent = options?.silent ?? false;
    const showError = options?.showError ?? true;

    const normalizedVarianteId = normalizeVarianteFilter(varianteId);
    const shouldFilterByVariante = normalizedVarianteId !== "__all__";

    if (shouldFilterByVariante && !isUuid(normalizedVarianteId)) {
      if (showError) {
        toast.error("Selecciona una variante.");
      }
      return;
    }

    if (isRequestInFlightRef.current) return;
    isRequestInFlightRef.current = true;
    if (!silent) {
      setIsLoading(true);
    }

    try {
      const result = await getKardex({
        varianteId: shouldFilterByVariante ? normalizedVarianteId : undefined,
        page: 1,
        pageSize: 200,
      });
      setKardex(result);
      setLoadFailed(false);
    } catch (error) {
      if (showError) {
        setLoadFailed(true);
        toast.error(error instanceof Error ? error.message : "No se pudo cargar el historial.");
      }
    } finally {
      isRequestInFlightRef.current = false;
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, [varianteId]);

  const handleConsultar = React.useCallback(async () => {
    await fetchKardex({ silent: false, showError: true });
  }, [fetchKardex]);

  React.useEffect(() => {
    const normalizedVarianteId = normalizeVarianteFilter(varianteId);
    if (normalizedVarianteId !== varianteId) {
      setVarianteId(normalizedVarianteId);
      return;
    }
    void fetchKardex({ silent: false, showError: true });
  }, [fetchKardex, varianteId]);

  React.useEffect(() => {
    const normalizedVarianteId = normalizeVarianteFilter(varianteId);
    if (normalizedVarianteId !== "__all__" && !isUuid(normalizedVarianteId)) return;

    const refreshSilencioso = () => {
      void fetchKardex({ silent: true, showError: false });
    };

    const onFocus = () => {
      refreshSilencioso();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshSilencioso();
      }
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshSilencioso();
      }
    }, AUTO_REFRESH_MS);

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [fetchKardex, varianteId]);

  const hasMovimientos = Boolean(kardex?.items.length);
  const filtroActivo = normalizeVarianteFilter(varianteId) !== "__all__";

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
        <ActionLink variant="outline" href="/inventario/materias-primas">
          Ver materiales <ArrowUpRight data-icon="inline-end" />
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
              <Autocomplete
                aria-labelledby="movimientos-variante-label"
                value={varianteId}
                onChange={(id) => setVarianteId(id == null ? "__all__" : String(id))}
                fullWidth
                allowsEmptyCollection
              >
                <Autocomplete.Trigger className={`${focus.singleBorder} [&>button]:absolute [&>button]:inset-0 [&>button]:rounded-field`}>
                  <Autocomplete.Value>
                    {opcionesFiltro.find((item) => item.id === varianteId)?.label ?? "Todas las variantes"}
                  </Autocomplete.Value>
                  <Autocomplete.Indicator />
                </Autocomplete.Trigger>
                <Autocomplete.Popover {...scope} className={`${themeClass} ${styles.filterPopover}`}>
                  <Autocomplete.Filter filter={(text, query) => normalizeSearch(text).includes(normalizeSearch(query))}>
                    <SearchField aria-label="Buscar variante" className={styles.filterSearch}>
                      <SearchField.Group className={focus.singleBorder}>
                        <SearchField.SearchIcon />
                        <SearchField.Input placeholder="Buscar material o variante…" />
                      </SearchField.Group>
                    </SearchField>
                    <ListBox items={opcionesFiltro} renderEmptyState={() => (
                      <p className={styles.noOptions}>No hay variantes que coincidan con la búsqueda.</p>
                    )}>
                      {(item) => (
                        <ListBox.Item id={item.id} textValue={item.label}>
                          <span className={styles.optionLabel}>{item.label}</span>
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      )}
                    </ListBox>
                  </Autocomplete.Filter>
                </Autocomplete.Popover>
              </Autocomplete>
            </div>
            <ActionButton
              variant="outline"
              onPress={handleConsultar}
              isPending={isLoading}
              isDisabled={
                isLoading ||
                (normalizeVarianteFilter(varianteId) !== "__all__" &&
                  !isUuid(normalizeVarianteFilter(varianteId)))
              }
            >
              <Search data-icon="inline-start" />
              {isLoading ? "Consultando…" : "Consultar"}
            </ActionButton>
          </div>
          <span className={styles.resultCount} role="status">
            {kardex ? `${kardex.total} ${kardex.total === 1 ? "movimiento" : "movimientos"}` : "— movimientos"}
          </span>
        </div>

        <div aria-busy={isLoading}>
          {isLoading ? (
            <div className={styles.loading} role="status">
              <Spinner size="sm" />
              <span>Consultando movimientos…</span>
            </div>
          ) : loadFailed && !kardex ? (
            <Empty className={styles.empty}>
              <EmptyHeader>
                <EmptyTitle><h3>No pudimos cargar los movimientos</h3></EmptyTitle>
                <EmptyDescription>Volvé a consultar para recuperar el historial.</EmptyDescription>
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
                        <Chip size="sm" variant="soft" className={`${styles.type} ${tipoIndicators[item.tipo]?.className ?? ""}`}>
                          <span aria-hidden>{tipoIndicators[item.tipo]?.symbol ?? "•"}</span>
                          {tipoLabels[item.tipo] ?? item.tipo}
                        </Chip>
                      </TableCell>
                      <TableCell>{origenLabels[item.origen] ?? item.origen}</TableCell>
                      <TableCell className={styles.number}>{number2Formatter.format(item.cantidad)}</TableCell>
                      <TableCell className={styles.number}>{number2Formatter.format(item.saldoPosterior)}</TableCell>
                      <TableCell className={styles.number}>{number2Formatter.format(item.costoPromedioPost)}</TableCell>
                      <TableCell><span className={styles.reference}>{item.referenciaId ?? "—"}</span></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className={styles.tableFooter}>
                Mostrando {kardex.items.length} de {kardex.total} movimientos
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
                  <h3>{filtroActivo ? "Esta variante todavía no tiene movimientos" : "Todavía no hay movimientos"}</h3>
                </EmptyTitle>
                <EmptyDescription>
                  {filtroActivo
                    ? "Cuando se registren operaciones de esta variante, vas a poder consultar aquí sus cantidades, saldos y costos."
                    : "Cuando comiences a registrar operaciones de stock, acá vas a ver el recorrido de tus materiales: cantidades, saldos y costos."}
                </EmptyDescription>
              </EmptyHeader>
              {filtroActivo ? (
                <ActionButton variant="outline" onPress={() => setVarianteId("__all__")}>
                  Ver todas las variantes <ArrowUpRight data-icon="inline-end" />
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
