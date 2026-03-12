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

export function MovimientosKardexPanel({ materiasPrimas }: HistorialPanelProps) {
  const variantes = React.useMemo(
    () =>
      materiasPrimas.flatMap((materiaPrima) =>
        materiaPrima.variantes.map((variante) => ({
          id: variante.id,
          label: getMateriaPrimaVarianteLabel(materiaPrima, variante, { maxDimensiones: 5 }),
        })),
      ),
    [materiasPrimas],
  );

  const [varianteId, setVarianteId] = React.useState(variantes[0]?.id ?? "");
  const [kardex, setKardex] = React.useState<KardexResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const isRequestInFlightRef = React.useRef(false);

  const fetchKardex = React.useCallback(async (options?: { silent?: boolean; showError?: boolean }) => {
    const silent = options?.silent ?? false;
    const showError = options?.showError ?? true;

    if (!varianteId) {
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
      const result = await getKardex({ varianteId, page: 1, pageSize: 200 });
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
    if (!varianteId) {
      setKardex(null);
      return;
    }
    void fetchKardex({ silent: false, showError: true });
  }, [fetchKardex, varianteId]);

  React.useEffect(() => {
    if (!varianteId) return;

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
          <select
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            value={varianteId}
            onChange={(e) => setVarianteId(e.target.value)}
          >
            <option value="">Seleccionar variante</option>
            {variantes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <Button variant="outline" onClick={handleConsultar} disabled={isLoading || !varianteId}>
            {isLoading ? "Consultando..." : "Consultar"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead>Ubicación interna</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
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
                  <TableCell>{item.tipo}</TableCell>
                  <TableCell>{item.origen}</TableCell>
                  <TableCell>{item.ubicacionNombre ?? item.ubicacionId}</TableCell>
                  <TableCell className="text-right">{item.cantidad.toFixed(4)}</TableCell>
                  <TableCell className="text-right">{item.saldoPosterior.toFixed(4)}</TableCell>
                  <TableCell className="text-right">{item.costoPromedioPost.toFixed(6)}</TableCell>
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
