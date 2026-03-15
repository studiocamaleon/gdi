"use client";

import * as React from "react";
import { toast } from "sonner";

import { getKardex } from "@/lib/inventario-stock-api";
import type { KardexResponse } from "@/lib/inventario-stock";
import type { MateriaPrima } from "@/lib/materias-primas";
import { getMateriaPrimaVarianteLabel } from "@/lib/materias-primas-variantes-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  ingreso: { symbol: "+", className: "text-emerald-600" },
  ajuste_entrada: { symbol: "+", className: "text-emerald-600" },
  transferencia_entrada: { symbol: "+", className: "text-emerald-600" },
  egreso: { symbol: "-", className: "text-red-600" },
  ajuste_salida: { symbol: "-", className: "text-red-600" },
  transferencia_salida: { symbol: "-", className: "text-red-600" },
};

function isUuid(value: string) {
  return UUID_REGEX.test(value);
}

function normalizeVarianteFilter(value: string) {
  if (!value || value === "__all__") return "__all__";
  return isUuid(value) ? value : "__all__";
}

export function MovimientosKardexPanel({ materiasPrimas }: HistorialPanelProps) {
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
      { id: "__all__", label: "Todos", searchText: "todos historial movimientos" },
      ...variantes.map((item) => ({
        ...item,
        searchText: item.label.toLowerCase(),
      })),
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
  const [varianteQuery, setVarianteQuery] = React.useState("Todos");
  const [varianteOpen, setVarianteOpen] = React.useState(false);
  const [kardex, setKardex] = React.useState<KardexResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const isRequestInFlightRef = React.useRef(false);
  const varianteRef = React.useRef<HTMLDivElement | null>(null);

  const opcionesFiltroFiltradas = React.useMemo(() => {
    const needle = varianteQuery.trim().toLowerCase();
    if (!needle) return opcionesFiltro;
    return opcionesFiltro.filter(
      (item) => item.label.toLowerCase().includes(needle) || item.searchText.includes(needle),
    );
  }, [opcionesFiltro, varianteQuery]);

  React.useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (varianteRef.current && !varianteRef.current.contains(target)) {
        setVarianteOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

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
    } catch (error) {
      if (showError) {
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
      setVarianteQuery(normalizedVarianteId === "__all__" ? "Todos" : "");
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>Historial de movimientos</CardTitle>
          <p className="text-sm text-muted-foreground">
            Consulta cronológica de ingresos, egresos, ajustes y transferencias por variante.
          </p>
        </div>
        <div className="flex w-full max-w-md items-center gap-2">
          <div ref={varianteRef} className="relative w-full">
            <input
              className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
              value={varianteQuery}
              onFocus={() => setVarianteOpen(true)}
              onChange={(e) => {
                const nextValue = e.target.value;
                setVarianteQuery(nextValue);
                setVarianteId(nextValue.trim().length === 0 ? "__all__" : "");
                setVarianteOpen(true);
              }}
              placeholder="Buscar variante o elegir Todos"
            />
            {varianteOpen ? (
              <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-background p-1 shadow-md">
                {opcionesFiltroFiltradas.length === 0 ? (
                  <p className="px-2 py-1 text-sm text-muted-foreground">Sin resultados</p>
                ) : (
                  opcionesFiltroFiltradas.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                      onClick={() => {
                        setVarianteId(item.id);
                        setVarianteQuery(item.label);
                        setVarianteOpen(false);
                      }}
                    >
                      {item.label}
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
          <Button
            variant="outline"
            onClick={handleConsultar}
            disabled={
              isLoading ||
              (normalizeVarianteFilter(varianteId) !== "__all__" &&
                !isUuid(normalizeVarianteFilter(varianteId)))
            }
          >
            {isLoading ? "Consultando..." : "Consultar"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Materia prima / variante</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">Saldo (cantidad)</TableHead>
              <TableHead className="text-right">Costo prom.</TableHead>
              <TableHead>Ref.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!kardex || kardex.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground">
                  Sin movimientos para mostrar. Registra movimientos desde Centro de stock.
                </TableCell>
              </TableRow>
            ) : (
              kardex.items.map((item) => (
                <TableRow key={item.movimientoId}>
                  <TableCell>{new Date(item.createdAt).toLocaleString()}</TableCell>
                  <TableCell>
                    {varianteLabelById.get(item.varianteId) ??
                      (item.materiaPrimaNombre
                        ? `${item.materiaPrimaNombre} - ${item.varianteSku ?? item.varianteId}`
                        : item.varianteSku ?? item.varianteId)}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      <span className={tipoIndicators[item.tipo]?.className ?? "text-muted-foreground"}>
                        {tipoIndicators[item.tipo]?.symbol ?? "•"}
                      </span>
                      <span>{tipoLabels[item.tipo] ?? item.tipo}</span>
                    </span>
                  </TableCell>
                  <TableCell>{origenLabels[item.origen] ?? item.origen}</TableCell>
                  <TableCell className="text-right">{number2Formatter.format(item.cantidad)}</TableCell>
                  <TableCell className="text-right">{number2Formatter.format(item.saldoPosterior)}</TableCell>
                  <TableCell className="text-right">{number2Formatter.format(item.costoPromedioPost)}</TableCell>
                  <TableCell>{item.referenciaId ?? "-"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
