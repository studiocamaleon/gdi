"use client";

import * as React from "react";
import { CalculatorIcon, CheckCircle2Icon, CircleIcon, XCircleIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { cotizar, getProductoById, type CotizarResponse } from "@/lib/productos-servicios-api";
import type { ProductoDetalle, ProductoListItem } from "@/lib/productos-servicios";

function formatARS(n: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);
}

export function CotizadorView({ productos }: { productos: ProductoListItem[] }) {
  const [productoId, setProductoId] = React.useState<string>("");
  const [productoDetalle, setProductoDetalle] = React.useState<ProductoDetalle | null>(null);
  const [rutaAlternativaId, setRutaAlternativaId] = React.useState<string>("");
  const [cantidad, setCantidad] = React.useState<number>(100);
  const [caras, setCaras] = React.useState<1 | 2>(1);
  const [tipoCopia, setTipoCopia] = React.useState<1 | 2 | 3>(1);
  const [opcionalesActivados, setOpcionalesActivados] = React.useState<Record<string, boolean>>({});
  const [cargando, setCargando] = React.useState(false);
  const [resultado, setResultado] = React.useState<CotizarResponse | null>(null);

  // Cargar detalle del producto cuando cambia
  React.useEffect(() => {
    if (!productoId) return;
    setProductoDetalle(null);
    setResultado(null);
    setOpcionalesActivados({});
    void getProductoById(productoId).then((d) => {
      setProductoDetalle(d);
      const preferida = d.rutasAlternativas.find((r) => r.esPreferida);
      setRutaAlternativaId(preferida?.id ?? d.rutasAlternativas[0]?.id ?? "");
    });
  }, [productoId]);

  const productoSel = productos.find((p) => p.id === productoId);
  const rutaSel = productoDetalle?.rutasAlternativas.find((r) => r.id === rutaAlternativaId);
  const pasosOpcionales = rutaSel?.configPasos.filter(
    (cp) => cp.modoActivacion === "OPCIONAL",
  ) ?? [];
  const cargosOpcionales = productoDetalle?.cargosDirectosCotizacion.filter(
    (c) => c.modoActivacion === "OPCIONAL",
  ) ?? [];

  const ejecutarCotizacion = async () => {
    setCargando(true);
    setResultado(null);
    try {
      const res = await cotizar({
        productoId,
        rutaAlternativaId,
        jobContext: {
          cantidad,
          caras,
          tipoCopia,
          opcionalesActivados,
        },
        periodo: "2026-03",
      });
      setResultado(res);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cotizador</h1>
        <p className="text-muted-foreground text-sm">
          Cotizar productos del Modelo Universal. Invoca el motor backend.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* COLUMNA IZQUIERDA: Formulario */}
        <Card>
          <CardHeader>
            <CardTitle>Configuración de la cotización</CardTitle>
            <CardDescription>
              Elegí el producto, la ruta alternativa, y los inputs del trabajo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="producto">Producto</Label>
              <Select value={productoId} onValueChange={(v) => setProductoId(v ?? "")}>
                <SelectTrigger id="producto">
                  <SelectValue placeholder="Elegí un producto" />
                </SelectTrigger>
                <SelectContent>
                  {productos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {productoDetalle && productoDetalle.rutasAlternativas.length > 1 && (
              <div className="space-y-2">
                <Label htmlFor="ruta">Ruta alternativa</Label>
                <Select value={rutaAlternativaId} onValueChange={(v) => setRutaAlternativaId(v ?? "")}>
                  <SelectTrigger id="ruta">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {productoDetalle.rutasAlternativas.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.nombre} {r.esPreferida && "★"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="cantidad">Cantidad</Label>
              <Input
                id="cantidad"
                type="number"
                min={1}
                value={cantidad}
                onChange={(e) => setCantidad(Number(e.target.value))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="caras">Caras (faz)</Label>
                <Select
                  value={String(caras)}
                  onValueChange={(v) => setCaras(Number(v) as 1 | 2)}
                >
                  <SelectTrigger id="caras">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Simple faz</SelectItem>
                    <SelectItem value="2">Doble faz</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {productoSel?.codigo === "TALON-DUPL-A4" && (
                <div className="space-y-2">
                  <Label htmlFor="tipoCopia">Tipo copia</Label>
                  <Select
                    value={String(tipoCopia)}
                    onValueChange={(v) => setTipoCopia(Number(v) as 1 | 2 | 3)}
                  >
                    <SelectTrigger id="tipoCopia">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Simple (1 hoja)</SelectItem>
                      <SelectItem value="2">Duplicado (2 hojas)</SelectItem>
                      <SelectItem value="3">Triplicado (3 hojas)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Opcionales del paso */}
            {pasosOpcionales.length > 0 && (
              <div className="space-y-2">
                <Label>Pasos opcionales</Label>
                <div className="space-y-1.5">
                  {pasosOpcionales.map((cp) => (
                    <label
                      key={cp.id}
                      className="hover:bg-accent flex items-center gap-2 rounded p-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={!!opcionalesActivados[cp.id]}
                        onChange={(e) =>
                          setOpcionalesActivados((prev) => ({ ...prev, [cp.id]: e.target.checked }))
                        }
                      />
                      <span>{cp.rutaPaso.familiaCodigo}</span>
                      {cp.maquinaM1 && (
                        <span className="text-muted-foreground text-xs">
                          ({cp.maquinaM1.nombre})
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Cargos directos opcionales */}
            {cargosOpcionales.length > 0 && (
              <div className="space-y-2">
                <Label>Cargos directos opcionales</Label>
                <div className="space-y-1.5">
                  {cargosOpcionales.map((c) => (
                    <label
                      key={c.id}
                      className="hover:bg-accent flex items-center gap-2 rounded p-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={!!opcionalesActivados[c.id]}
                        onChange={(e) =>
                          setOpcionalesActivados((prev) => ({ ...prev, [c.id]: e.target.checked }))
                        }
                      />
                      <span>{c.cargoDirectoCatalogo.nombre}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={ejecutarCotizacion}
              disabled={!productoId || cargando}
              className="w-full"
              size="lg"
            >
              <CalculatorIcon className="mr-2 size-4" />
              {cargando ? "Calculando..." : "Cotizar"}
            </Button>
          </CardContent>
        </Card>

        {/* COLUMNA DERECHA: Resultado */}
        <Card>
          <CardHeader>
            <CardTitle>Resultado</CardTitle>
            <CardDescription>Costo + precio + trazabilidad por paso.</CardDescription>
          </CardHeader>
          <CardContent>
            {!resultado ? (
              <div className="text-muted-foreground py-8 text-center text-sm">
                Configurá el producto y presioná Cotizar
              </div>
            ) : !resultado.exitoso ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-600">
                  <XCircleIcon className="size-5" />
                  <span className="font-medium">Cotización falló</span>
                </div>
                <ul className="space-y-1 text-sm">
                  {resultado.errores.map((e, i) => (
                    <li key={i} className="bg-red-50 rounded p-2 text-red-900">
                      <div className="font-mono text-xs">{e.codigo}</div>
                      <div>{e.mensaje}</div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : resultado.cotizacion ? (
              <ResultadoCotizacion cotizacion={resultado.cotizacion} />
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ResultadoCotizacion({
  cotizacion,
}: {
  cotizacion: NonNullable<CotizarResponse["cotizacion"]>;
}) {
  const c = cotizacion;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle2Icon className="size-5" />
        <span className="font-medium">Cotización OK</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-muted rounded p-3">
          <div className="text-muted-foreground text-xs">Costo total</div>
          <div className="text-lg font-semibold">{formatARS(c.costos.total)}</div>
        </div>
        {c.precio && (
          <div className="bg-primary/10 rounded p-3">
            <div className="text-muted-foreground text-xs">Precio total (Tab Precio)</div>
            <div className="text-primary text-lg font-semibold">
              {formatARS(c.precio.precioTotal)}
            </div>
            {c.precio.margenAplicadoPct !== undefined && (
              <div className="text-muted-foreground mt-1 text-xs">
                margen: {c.precio.margenAplicadoPct}%
              </div>
            )}
          </div>
        )}
      </div>

      <div className="text-muted-foreground text-xs">
        Costo unitario: {formatARS(c.costos.unitario)}
        {c.precio && ` · Precio unitario: ${formatARS(c.precio.precioUnitario)}`}
      </div>

      {/* Desglose */}
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span>Tiempo total:</span>
          <span className="font-mono">{formatARS(c.costos.tiempoTotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>Materiales total:</span>
          <span className="font-mono">{formatARS(c.costos.materialesTotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>Cargos directos:</span>
          <span className="font-mono">{formatARS(c.costos.cargosDirectosTotal)}</span>
        </div>
      </div>

      {/* Trazabilidad por paso */}
      <details className="text-sm">
        <summary className="hover:bg-accent cursor-pointer rounded p-2 font-medium">
          Trazabilidad por paso ({c.pasos.length})
        </summary>
        <Table className="mt-2">
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Paso</TableHead>
              <TableHead className="text-right">Tiempo</TableHead>
              <TableHead className="text-right">Costo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {c.pasos.map((p) => (
              <TableRow key={p.rutaPasoOrden}>
                <TableCell>
                  {p.activado ? (
                    <CheckCircle2Icon className="size-4 text-green-500" />
                  ) : (
                    <CircleIcon className="size-4 text-gray-300" />
                  )}
                </TableCell>
                <TableCell>
                  <div className="font-medium">
                    {p.rutaPasoOrden}. {p.familiaCodigo}
                  </div>
                  {!p.activado && p.razonNoActivado && (
                    <div className="text-muted-foreground text-xs">{p.razonNoActivado}</div>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {p.tiempo ? `${p.tiempo.totalMin}min` : "—"}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {p.activado ? formatARS(p.costoTotal) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </details>

      {/* Cargos directos cotización */}
      {c.cargosDirectosCotizacion.length > 0 && (
        <div className="space-y-1 text-sm">
          <div className="font-medium">Cargos directos a nivel cotización</div>
          {c.cargosDirectosCotizacion.map((cd, i) => (
            <div key={i} className="flex justify-between">
              <Badge variant="outline">{cd.cargoNombre}</Badge>
              <span className="font-mono">{formatARS(cd.monto)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
