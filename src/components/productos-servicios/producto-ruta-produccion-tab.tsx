"use client";

/**
 * P1 — Tab "Ruta de producción" (read-only v1).
 *
 * Muestra la ruta efectiva de la variante seleccionada:
 *   - Pasos en orden con familia, máquina, perfil, centro de costo.
 *   - Tiempos (setup/cleanup/fijo/productividad) y unidad productiva.
 *   - Materiales declarativos por paso (ProcesoOperacionMaterial).
 *   - Indicador visual de opcional/obligatorio.
 *
 * Edición se agrega en iteración P1.3+. Hoy es read-only — todo se edita
 * via SQL o scripts.
 */
import * as React from "react";
import { toast } from "sonner";

import { AlternativasEditorSheet } from "@/components/productos-servicios/alternativas-editor-sheet";
import type { ProductTabProps } from "@/components/productos-servicios/product-detail-types";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getRutaCompletaPorProducto,
  getRutaCompletaPorVariante,
  type RutaCompleta,
} from "@/lib/productos-servicios-api";

function formatMin(v: number | null): string {
  if (v == null || v === 0) return "—";
  return `${v} min`;
}

function formatProductividad(op: RutaCompleta["operaciones"][number]): string {
  const perfilVal = op.perfilOperativo?.productivityValue;
  const baseVal = op.productividadBase;
  const val = perfilVal ?? baseVal;
  if (val == null || val === 0) return "—";
  const fuente = perfilVal != null ? "perfil" : "paso";
  return `${val} ${op.unidadProductivaV2 ?? "unidad"}/h · ${fuente}`;
}

function getActivacionBadge(op: RutaCompleta["operaciones"][number]) {
  if (op.esOpcional) return { label: "Opcional", variant: "secondary" as const };
  if (op.activacionV2 === "CONDICIONAL")
    return { label: "Condicional", variant: "outline" as const };
  return { label: "Obligatorio", variant: "default" as const };
}

export function ProductoRutaProduccionTab(props: ProductTabProps) {
  const [ruta, setRuta] = React.useState<RutaCompleta | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [altEditorState, setAltEditorState] = React.useState<{
    operacionId: string;
    operacionNombre: string;
  } | null>(null);
  const selectedVariantId = props.selectedVariantId;
  const productoId = props.producto.id;

  const load = React.useCallback(() => {
    setIsLoading(true);
    // Prioridad: si hay variante seleccionada, usar ruta efectiva de la variante.
    // Si no, cargar ruta directa del producto (para productos "medida libre"
    // como MDF, gran formato por m², etc., que no tienen variantes).
    const promise = selectedVariantId
      ? getRutaCompletaPorVariante(selectedVariantId)
      : getRutaCompletaPorProducto(productoId);
    return promise
      .then((r) => setRuta(r))
      .catch((err) => {
        console.error(err);
        toast.error(err instanceof Error ? err.message : "No se pudo cargar la ruta.");
      })
      .finally(() => setIsLoading(false));
  }, [selectedVariantId, productoId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <GdiSpinner className="size-6" />
        </CardContent>
      </Card>
    );
  }

  if (!ruta || !ruta.procesoDefinicionId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ruta de producción</CardTitle>
          <CardDescription>
            La variante seleccionada todavía no tiene una <strong>ruta de producción</strong>{" "}
            asignada. Para que el super motor pueda cotizar este producto:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
            <li>
              Elegí una ruta en el tab <strong>"Ruta (legacy)"</strong> y hacé click en{" "}
              <strong>Guardar</strong> (el selector local no persiste hasta que guardás).
            </li>
            <li>
              Volvé a este tab: vas a ver los pasos de esa ruta con familia, máquina, materiales y
              el gestor de alternativas, y vas a poder cotizar con el super motor.
            </li>
          </ol>
          <p className="mt-4 text-xs text-muted-foreground">
            En próximas iteraciones (P1.4/P1.5) la ruta va a poder crearse/editarse directamente
            desde este tab sin ir a la "Ruta (legacy)".
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalPasos = ruta.operaciones.length;
  const pasosObligatorios = ruta.operaciones.filter((op) => !op.esOpcional).length;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Ruta de producción — {ruta.procesoNombre ?? "sin nombre"}</CardTitle>
              <CardDescription>
                {totalPasos} {totalPasos === 1 ? "paso" : "pasos"} · {pasosObligatorios} obligatorios ·{" "}
                {totalPasos - pasosObligatorios} opcionales
              </CardDescription>
            </div>
            <Badge variant="outline">read-only · P1</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Paso</TableHead>
                <TableHead>Familia</TableHead>
                <TableHead>Centro costo</TableHead>
                <TableHead>Máquina · Perfil</TableHead>
                <TableHead>Tiempos</TableHead>
                <TableHead>Productividad</TableHead>
                <TableHead>Alternativas</TableHead>
                <TableHead>Activación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ruta.operaciones.map((op) => {
                const act = getActivacionBadge(op);
                return (
                  <TableRow key={op.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {op.orden}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{op.nombre}</div>
                      <div className="text-xs text-muted-foreground">{op.codigo}</div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs">{op.familiaV2 ?? op.tipoOperacion.toLowerCase()}</code>
                    </TableCell>
                    <TableCell className="text-sm">
                      {op.centroCosto?.nombre ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {op.maquina ? (
                        <div>
                          <div>{op.maquina.nombre}</div>
                          {op.perfilOperativo ? (
                            <div className="text-xs text-muted-foreground">
                              {op.perfilOperativo.nombre}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>Setup: {formatMin(op.setupMin)}</div>
                      <div>Cleanup: {formatMin(op.cleanupMin)}</div>
                      <div>Fijo: {formatMin(op.tiempoFijoMin)}</div>
                    </TableCell>
                    <TableCell className="text-xs">{formatProductividad(op)}</TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-2">
                        <Badge variant={op.alternativas.length > 0 ? "secondary" : "outline"}>
                          {op.alternativas.length}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setAltEditorState({ operacionId: op.id, operacionNombre: op.nombre })
                          }
                        >
                          Gestionar
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={act.variant}>{act.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Materiales declarativos por paso */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Materiales declarativos</CardTitle>
          <CardDescription>
            Consumos declarados en <code>ProcesoOperacionMaterial</code>. Si un paso no aparece
            acá, el super motor usa plantillas imperativas como fallback.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ruta.operaciones.every((op) => op.materialesConsumidos.length === 0) ? (
            <p className="text-sm text-muted-foreground">
              Ningún paso de esta ruta tiene materiales declarativos todavía.
            </p>
          ) : (
            <div className="space-y-4">
              {ruta.operaciones
                .filter((op) => op.materialesConsumidos.length > 0)
                .map((op) => (
                  <div key={op.id}>
                    <h4 className="mb-2 text-sm font-medium">
                      Paso {op.orden}: {op.nombre}
                    </h4>
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead>Material</TableHead>
                          <TableHead>Variante</TableHead>
                          <TableHead>Fórmula</TableHead>
                          <TableHead className="text-right">Cantidad</TableHead>
                          <TableHead>Unidad</TableHead>
                          <TableHead className="text-right">Precio</TableHead>
                          <TableHead>Multi-caras</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {op.materialesConsumidos
                          .sort((a, b) => a.orden - b.orden)
                          .map((m) => (
                            <TableRow key={m.id}>
                              <TableCell className="font-medium text-sm">{m.nombre}</TableCell>
                              <TableCell className="text-xs">
                                {m.materiaPrimaVariante ? (
                                  <code>{m.materiaPrimaVariante.sku}</code>
                                ) : (
                                  <span className="text-muted-foreground">manual</span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs">
                                <code>{m.formula}</code>
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                {m.cantidadPorUnidad}
                              </TableCell>
                              <TableCell className="text-xs">{m.unidad}</TableCell>
                              <TableCell className="text-right text-sm">
                                {m.materiaPrimaVariante?.precioReferencia != null
                                  ? `$${m.materiaPrimaVariante.precioReferencia}`
                                  : m.precioManual != null
                                    ? `$${m.precioManual}`
                                    : "—"}
                              </TableCell>
                              <TableCell>
                                {m.aplicaMultiCaras ? (
                                  <Badge variant="secondary" className="text-xs">
                                    ×2 doble faz
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {altEditorState ? (
        <AlternativasEditorSheet
          open={altEditorState !== null}
          onOpenChange={(open) => {
            if (!open) setAltEditorState(null);
          }}
          operacionId={altEditorState.operacionId}
          operacionNombre={altEditorState.operacionNombre}
          onChanged={load}
        />
      ) : null}
    </div>
  );
}
