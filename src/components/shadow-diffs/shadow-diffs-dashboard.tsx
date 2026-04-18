"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getShadowLogs,
  getShadowLogDetail,
  type ShadowLogListItem,
  type ShadowLogsSummary,
  type ShadowLogDetail,
} from "@/lib/productos-servicios-api";

type Props = {
  logs: ShadowLogListItem[];
  summary: ShadowLogsSummary;
};

function formatMoney(n: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(n);
}

function formatPct(n: number): string {
  const abs = Math.abs(n);
  return `${n >= 0 ? "+" : "-"}${abs.toFixed(2)}%`;
}

function diffBadgeVariant(diffPct: number): "default" | "secondary" | "destructive" {
  const abs = Math.abs(diffPct);
  if (abs < 0.01) return "default";
  if (abs < 10) return "secondary";
  return "destructive";
}

export function ShadowDiffsDashboard({ logs: initialLogs, summary }: Props) {
  const [logs, setLogs] = React.useState<ShadowLogListItem[]>(initialLogs);
  const [motorFiltro, setMotorFiltro] = React.useState<string>("all");
  const [minDiff, setMinDiff] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const [detalle, setDetalle] = React.useState<ShadowLogDetail | null>(null);
  const [detalleLoading, setDetalleLoading] = React.useState(false);

  const motoresDisponibles = React.useMemo(
    () => Array.from(new Set(summary.porMotor.map((m) => m.motor))).sort(),
    [summary.porMotor],
  );

  const aplicarFiltros = React.useCallback(async () => {
    setLoading(true);
    try {
      const resp = await getShadowLogs({
        motor: motorFiltro === "all" ? undefined : motorFiltro,
        minDiffPct: minDiff ? Number(minDiff) : undefined,
        limit: 100,
      });
      setLogs(resp);
    } finally {
      setLoading(false);
    }
  }, [motorFiltro, minDiff]);

  const abrirDetalle = React.useCallback(async (id: string) => {
    setDetalleLoading(true);
    try {
      const d = await getShadowLogDetail(id);
      setDetalle(d);
    } finally {
      setDetalleLoading(false);
    }
  }, []);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Shadow Diffs — v1 vs v2</h1>
        <p className="text-sm text-muted-foreground">
          Comparación de cotizaciones emitidas por motores v1 (legacy) y v2 (modelo universal)
          para productos en modo SHADOW.
        </p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Diff &lt; 0.01%</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{summary.distribucionDiff.cero}</div>
            <div className="text-xs text-muted-foreground">Coincidentes</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Diff 0.01-10%</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {summary.distribucionDiff.bajo + summary.distribucionDiff.medio}
            </div>
            <div className="text-xs text-muted-foreground">Diferencia menor/media</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Diff &gt; 10%</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">{summary.distribucionDiff.alto}</div>
            <div className="text-xs text-muted-foreground">Requiere investigación</div>
          </CardContent>
        </Card>
      </div>

      {/* Por motor */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Por motor</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Motor</TableHead>
                <TableHead className="text-right">Logs</TableHead>
                <TableHead className="text-right">Diff % promedio</TableHead>
                <TableHead className="text-right">Diff % máx</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.porMotor.map((m) => (
                <TableRow key={m.motor}>
                  <TableCell className="font-mono text-xs">{m.motor}</TableCell>
                  <TableCell className="text-right">{m.count}</TableCell>
                  <TableCell className="text-right">{formatPct(m.diffPctPromedio)}</TableCell>
                  <TableCell className="text-right">{formatPct(m.diffPctMax)}</TableCell>
                </TableRow>
              ))}
              {summary.porMotor.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Sin datos aún — activá SHADOW en algún producto para empezar a loguear.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Motor</label>
          <Select value={motorFiltro} onValueChange={(v) => setMotorFiltro(v ?? "all")}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los motores</SelectItem>
              {motoresDisponibles.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Mín diff %</label>
          <Input
            type="number"
            step="0.1"
            placeholder="0"
            value={minDiff}
            onChange={(e) => setMinDiff(e.target.value)}
            className="w-[140px]"
          />
        </div>
        <Button onClick={aplicarFiltros} disabled={loading}>
          {loading ? "Cargando..." : "Aplicar"}
        </Button>
      </div>

      {/* Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Logs recientes ({logs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Motor</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Total v1</TableHead>
                <TableHead className="text-right">Total v2</TableHead>
                <TableHead className="text-right">Diff %</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs">{new Date(log.createdAt).toLocaleString("es-AR")}</TableCell>
                  <TableCell className="font-mono text-xs">{log.motorCodigo}</TableCell>
                  <TableCell className="text-sm">{log.productoNombre ?? log.productoServicioId.slice(0, 8)}</TableCell>
                  <TableCell className="text-right text-sm">{formatMoney(log.totalV1)}</TableCell>
                  <TableCell className="text-right text-sm">{formatMoney(log.totalV2)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={diffBadgeVariant(log.diffPct)} className="font-mono text-xs">
                      {formatPct(log.diffPct)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => abrirDetalle(log.id)}>
                      Ver
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No hay logs para los filtros aplicados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detalle flotante */}
      {detalle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setDetalle(null)}
        >
          <div
            className="max-h-[85vh] w-[min(900px,90vw)] overflow-auto rounded-lg bg-background p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">Detalle shadow log</h2>
                <p className="text-xs text-muted-foreground">
                  {detalle.productoNombre} · {detalle.motorCodigo} · {new Date(detalle.createdAt).toLocaleString("es-AR")}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setDetalle(null)}>
                Cerrar
              </Button>
            </div>

            <div className="mb-4 grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-muted-foreground">Total v1</div>
                <div className="text-lg font-semibold">{formatMoney(detalle.totalV1)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Total v2</div>
                <div className="text-lg font-semibold">{formatMoney(detalle.totalV2)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Diff</div>
                <Badge variant={diffBadgeVariant(detalle.diffPct)} className="font-mono text-sm">
                  {formatPct(detalle.diffPct)} ({formatMoney(detalle.diffAbsoluto)})
                </Badge>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-4">
              <div>
                <div className="mb-1 text-sm font-medium">Subtotales v1</div>
                <pre className="overflow-auto rounded bg-muted p-3 text-xs">
                  {JSON.stringify(detalle.subtotalesV1, null, 2)}
                </pre>
              </div>
              <div>
                <div className="mb-1 text-sm font-medium">Subtotales v2</div>
                <pre className="overflow-auto rounded bg-muted p-3 text-xs">
                  {JSON.stringify(detalle.subtotalesV2, null, 2)}
                </pre>
              </div>
            </div>

            <div>
              <div className="mb-1 text-sm font-medium">Anomalías</div>
              <pre className="overflow-auto rounded bg-muted p-3 text-xs">
                {JSON.stringify(detalle.anomalias, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {detalleLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="rounded bg-background px-4 py-2 text-sm">Cargando detalle...</div>
        </div>
      )}
    </div>
  );
}
