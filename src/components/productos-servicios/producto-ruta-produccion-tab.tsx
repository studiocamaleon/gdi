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
import { MaterialesEditorSheet } from "@/components/productos-servicios/materiales-editor-sheet";
import { PasoEditorSheet } from "@/components/productos-servicios/paso-editor-sheet";
import { RutaAssignerCard } from "@/components/productos-servicios/ruta-assigner-card";
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
import { moveProcesoOperacion } from "@/lib/procesos-api";
import {
  getRutaCompletaPorProducto,
  getRutaCompletaPorVariante,
  type RutaCompleta,
  type RutaCompletaOperacion,
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
  const [matEditorState, setMatEditorState] = React.useState<{
    operacionId: string;
    operacionNombre: string;
  } | null>(null);
  const [pasoEditorState, setPasoEditorState] = React.useState<RutaCompletaOperacion | null>(
    null,
  );
  const [movingId, setMovingId] = React.useState<string | null>(null);
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

  const handleMove = React.useCallback(
    async (operacionId: string, direction: "up" | "down") => {
      setMovingId(operacionId);
      try {
        await moveProcesoOperacion(operacionId, direction);
        await load();
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : "No se pudo mover el paso.");
      } finally {
        setMovingId(null);
      }
    },
    [load],
  );

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
      <div className="flex flex-col gap-4">
        <RutaAssignerCard
          productoId={productoId}
          currentProcesoDefinicionId={null}
          currentProcesoNombre={null}
          onChanged={async () => {
            await load();
            props.refreshProducto?.();
          }}
        />
      </div>
    );
  }

  const totalPasos = ruta.operaciones.length;
  const pasosObligatorios = ruta.operaciones.filter((op) => !op.esOpcional).length;

  return (
    <div className="flex flex-col gap-4">
      <RutaAssignerCard
        productoId={productoId}
        currentProcesoDefinicionId={ruta.procesoDefinicionId}
        currentProcesoNombre={ruta.procesoNombre}
        onChanged={async () => {
          await load();
          props.refreshProducto?.();
        }}
      />

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Pasos — {ruta.procesoNombre ?? "sin nombre"}</CardTitle>
              <CardDescription>
                {totalPasos} {totalPasos === 1 ? "paso" : "pasos"} · {pasosObligatorios} obligatorios ·{" "}
                {totalPasos - pasosObligatorios} opcionales
              </CardDescription>
            </div>
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
                <TableHead>Opciones</TableHead>
                <TableHead>Activación</TableHead>
                <TableHead className="w-36 text-right">Acciones</TableHead>
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
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={movingId !== null || op.orden === 1}
                          title="Mover arriba"
                          onClick={() => handleMove(op.id, "up")}
                        >
                          ↑
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={movingId !== null || op.orden === ruta.operaciones.length}
                          title="Mover abajo"
                          onClick={() => handleMove(op.id, "down")}
                        >
                          ↓
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPasoEditorState(op)}
                        >
                          Editar
                        </Button>
                      </div>
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
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Materiales declarativos</CardTitle>
              <CardDescription>
                Consumos declarados en <code>ProcesoOperacionMaterial</code>. Si un paso no tiene
                materiales, el super motor usa plantillas imperativas como fallback.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {ruta.operaciones.map((op) => (
              <div key={op.id}>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-medium">
                    Paso {op.orden}: {op.nombre}
                    <Badge
                      variant={op.materialesConsumidos.length > 0 ? "secondary" : "outline"}
                      className="ml-2"
                    >
                      {op.materialesConsumidos.length}{" "}
                      {op.materialesConsumidos.length === 1 ? "material" : "materiales"}
                    </Badge>
                  </h4>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setMatEditorState({ operacionId: op.id, operacionNombre: op.nombre })
                    }
                  >
                    Gestionar materiales
                  </Button>
                </div>
                {op.materialesConsumidos.length > 0 ? (
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
                        .slice()
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
                ) : (
                  <p className="text-xs text-muted-foreground pl-4">
                    — sin materiales declarativos (se aplica la plantilla imperativa de la
                    familia) —
                  </p>
                )}
              </div>
            ))}
          </div>
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

      {matEditorState ? (
        <MaterialesEditorSheet
          open={matEditorState !== null}
          onOpenChange={(open) => {
            if (!open) setMatEditorState(null);
          }}
          operacionId={matEditorState.operacionId}
          operacionNombre={matEditorState.operacionNombre}
          onChanged={load}
        />
      ) : null}

      {pasoEditorState ? (
        <PasoEditorSheet
          open={pasoEditorState !== null}
          onOpenChange={(open) => {
            if (!open) setPasoEditorState(null);
          }}
          operacion={pasoEditorState}
          onSaved={load}
        />
      ) : null}
    </div>
  );
}
