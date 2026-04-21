"use client";

/**
 * Tab "Simular costo" — único para todos los productos (P3.b).
 *
 * Consume la shape canónica del modelo universal y la renderiza de forma
 * agnóstica. El super motor universal es el único motor, así que este tab
 * reemplaza a los tabs motor-específicos v1/v2 eliminados en P3.b.1/2.
 *
 * Secciones:
 *   1. Inputs (cantidad, periodo, medidas si modoMedidas=LIBRE, opcionales)
 *   2. Resumen: total, unitario, 3 buckets (centro costo, materiales, flat)
 *   3. Tabla de pasos ejecutados
 *   4. Selector de alternativas por paso (P1.3.e)
 *   5. Trazabilidad técnica
 */

import * as React from "react";
import { toast } from "sonner";

import type { ProductTabProps } from "@/components/productos-servicios/product-detail-types";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { formatCurrency } from "@/components/productos-servicios/producto-comercial.helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { cotizarProductoVarianteV2 } from "@/lib/productos-servicios-api";
import type { CotizacionCanonica } from "@/lib/productos-servicios";
import {
  NestingPreview,
  type NestingContainer,
  type NestingPlacement,
} from "@/components/nesting-preview";

/**
 * Dado un paso canónico, si tiene datos de nesting en la trazabilidad,
 * extrae el container + placements para renderizar con <NestingPreview>.
 * Soporta los 3 algoritmos: nesting-rollo, nesting-hoja, nesting-placa-rigida.
 */
/**
 * Normaliza el shape de un placement al canónico del NestingPreview.
 * - nesting-hoja/placa-rigida emiten { x, y, anchoMm, altoMm, rotada }
 * - nesting-rollo emite { centerXMm, centerYMm, widthMm, heightMm, rotated, label, ... }
 */
function normalizePlacement(raw: Record<string, unknown>): NestingPlacement | null {
  // Shape rollo
  if (
    typeof raw.centerXMm === "number" &&
    typeof raw.centerYMm === "number" &&
    typeof raw.widthMm === "number" &&
    typeof raw.heightMm === "number"
  ) {
    const w = Number(raw.widthMm);
    const h = Number(raw.heightMm);
    return {
      x: Number(raw.centerXMm) - w / 2,
      y: Number(raw.centerYMm) - h / 2,
      anchoMm: w,
      altoMm: h,
      rotada: Boolean(raw.rotated),
      label: typeof raw.label === "string" ? raw.label : undefined,
      colorKey: typeof raw.sourcePieceId === "string" ? raw.sourcePieceId : undefined,
    };
  }
  // Shape canónico (hoja/placa-rigida)
  if (
    typeof raw.x === "number" &&
    typeof raw.y === "number" &&
    typeof raw.anchoMm === "number" &&
    typeof raw.altoMm === "number"
  ) {
    return {
      x: Number(raw.x),
      y: Number(raw.y),
      anchoMm: Number(raw.anchoMm),
      altoMm: Number(raw.altoMm),
      rotada: Boolean(raw.rotada),
      label: typeof raw.label === "string" ? raw.label : undefined,
      colorKey: typeof raw.colorKey === "string" ? raw.colorKey : undefined,
    };
  }
  return null;
}

function extractNestingPreview(
  paso: CotizacionCanonica["pasos"][number],
): { container: NestingContainer; placements: NestingPlacement[] } | null {
  const traza = (paso.trazabilidad ?? {}) as Record<string, unknown>;
  const nesting = traza.nesting as Record<string, unknown> | undefined;
  if (!nesting) return null;
  const placementsRaw = nesting.placements as unknown;
  if (!Array.isArray(placementsRaw) || placementsRaw.length === 0) return null;
  const placements = placementsRaw
    .map((p) => normalizePlacement(p as Record<string, unknown>))
    .filter((p): p is NestingPlacement => p !== null);
  if (placements.length === 0) return null;

  // Detectar algoritmo por shape.
  // 1) Rollo (gran_formato / vinilo_de_corte): hermano `materialElegido`
  //    con rolloAnchoMm + hay largoConsumidoMm en nesting.
  const materialElegido = traza.materialElegido as Record<string, unknown> | undefined;
  if (materialElegido?.rolloAnchoMm && nesting.largoConsumidoMm) {
    const rolloAnchoMm = Number(materialElegido.rolloAnchoMm);
    const consumed = Number(nesting.largoConsumidoMm);
    return {
      container: {
        type: "rollo",
        rolloAnchoTotalMm: rolloAnchoMm,
        printableWidthMm: rolloAnchoMm,
        consumedLengthMm: consumed,
      },
      placements,
    };
  }
  // 2) Pliego (digital_laser / talonario): nesting.pliegoElegido + columnas/filas.
  const pliegoElegido = nesting.pliegoElegido as Record<string, unknown> | undefined;
  if (pliegoElegido) {
    return {
      container: {
        type: "pliego",
        anchoMm: Number(pliegoElegido.anchoMm),
        altoMm: Number(pliegoElegido.altoMm),
      },
      placements,
    };
  }
  // 3) Placa (rigidos_impresos): hermano `placaElegida.dimensionesMm`.
  const placaElegida = traza.placaElegida as Record<string, unknown> | undefined;
  const dims = placaElegida?.dimensionesMm as Record<string, unknown> | undefined;
  if (placaElegida && dims?.anchoMm && dims?.altoMm) {
    return {
      container: {
        type: "placa",
        anchoMm: Number(dims.anchoMm),
        altoMm: Number(dims.altoMm),
        materialLabel: (placaElegida.nombre as string) ?? undefined,
      },
      placements,
    };
  }
  return null;
}

function buildDefaultPeriodo() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Motores que NO requieren medidas de pieza en parametros (las toman de la variante o config). */
const MOTORS_SIN_MEDIDAS = new Set(["impresion_digital_laser", "talonario"]);
/** Motores con checkbox "conLaminado". */
const MOTORS_CON_LAMINADO = new Set(["gran_formato"]);
/** Motores con filtro opcional de color (vinilos). */
const MOTORS_CON_COLOR = new Set(["vinilo_de_corte"]);
/** Motores con `numerosXTalonario`. */
const MOTORS_CON_NUMEROS_TALONARIO = new Set(["talonario"]);
/** Motores con caras + tipoImpresion. */
const MOTORS_CON_CARAS_TIPO = new Set(["impresion_digital_laser", "talonario"]);

/**
 * Renderiza un sub-producto cotizado recursivamente, con breakdown expandible.
 * Soporta recursión ilimitada (un sub-producto puede tener sus propios
 * sub-productos — ej. libro → tapa dura → cartoné).
 */
function SubProductoCard({ cotizacion }: { cotizacion: CotizacionCanonica }) {
  const [expandido, setExpandido] = React.useState(false);
  const traz = (cotizacion.trazabilidad ?? {}) as Record<string, unknown>;
  const procesoNombre = typeof traz.procesoNombre === "string" ? traz.procesoNombre : "";
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setExpandido((e) => !e)}
      >
        <div>
          <div className="text-sm font-medium">
            {procesoNombre || `Sub-producto (motor ${cotizacion.motorCodigo}@${cotizacion.motorVersion})`}
          </div>
          <div className="text-xs text-muted-foreground">
            {cotizacion.cantidad} × {formatCurrency(cotizacion.unitario)} c/u
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{formatCurrency(cotizacion.total)}</span>
          <Badge variant="outline" className="text-[10px]">
            {expandido ? "−" : "+"}
          </Badge>
        </div>
      </button>
      {expandido && (
        <div className="mt-3 space-y-2 border-t pt-3">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <div className="text-muted-foreground">Centro costo</div>
              <div className="font-medium">{formatCurrency(cotizacion.subtotales.centroCosto)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Materias primas</div>
              <div className="font-medium">{formatCurrency(cotizacion.subtotales.materiasPrimas)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Cargos flat</div>
              <div className="font-medium">{formatCurrency(cotizacion.subtotales.cargosFlat)}</div>
            </div>
          </div>
          {cotizacion.pasos.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">Pasos:</div>
              <ul className="space-y-0.5 text-xs">
                {cotizacion.pasos.map((paso) => {
                  const subtotal = paso.costoCentroCosto + paso.costoMateriasPrimas + paso.cargosFlat;
                  return (
                    <li key={paso.id} className="flex justify-between">
                      <span>{paso.nombre}</span>
                      <span className="font-mono">{formatCurrency(subtotal)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {cotizacion.subProductos.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="text-xs font-medium text-muted-foreground">
                Sub-sub-productos:
              </div>
              {cotizacion.subProductos.map((sub, i) => (
                <SubProductoCard key={i} cotizacion={sub} />
              ))}
            </div>
          )}
          {cotizacion.warnings.length > 0 && (
            <div className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
              {cotizacion.warnings.map((w, i) => (
                <div key={i}>⚠ {w}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ProductoSimularCostoTab(props: ProductTabProps) {
  const motorCodigo = props.producto.motorCodigo;
  const needsMedidas = !MOTORS_SIN_MEDIDAS.has(motorCodigo);

  const [cantidad, setCantidad] = React.useState("1");
  const [anchoMm, setAnchoMm] = React.useState("1000");
  const [altoMm, setAltoMm] = React.useState("500");
  const [conLaminado, setConLaminado] = React.useState(false);
  const [color, setColor] = React.useState("");
  const [numerosXTalonario, setNumerosXTalonario] = React.useState("50");
  const [caras, setCaras] = React.useState<"simple_faz" | "doble_faz">("simple_faz");
  const [tipoImpresion, setTipoImpresion] = React.useState<"CMYK" | "BN">("CMYK");
  const [opcionalesSeleccionados, setOpcionalesSeleccionados] = React.useState<Set<string>>(
    new Set(),
  );
  // P1.3.e — selección de alternativas por paso (Map pasoId → alternativaId).
  // Se recopila tras la primera cotización con el super motor (los pasos
  // exponen `alternativasDisponibles` en su trazabilidad).
  const [opcionesAlternativas, setOpcionesAlternativas] = React.useState<Map<string, string>>(
    new Map(),
  );
  // Post-P3.b, el super motor es el único motor; el dispatcher ya no
  // necesita forzar nada. Se mantiene por forma.
  const [periodo, setPeriodo] = React.useState(buildDefaultPeriodo());
  const [cotizacion, setCotizacion] = React.useState<CotizacionCanonica | null>(null);
  const [isCotizando, startCotizando] = React.useTransition();

  const selectedVariantId = props.selectedVariantId;

  const handleCotizar = React.useCallback(() => {
    if (!selectedVariantId) {
      toast.error("Seleccioná una variante antes de cotizar.");
      return;
    }
    startCotizando(async () => {
      try {
        const parametros: Record<string, unknown> = {};
        if (needsMedidas) {
          parametros.anchoMm = Number(anchoMm);
          parametros.altoMm = Number(altoMm);
        }
        if (MOTORS_CON_LAMINADO.has(motorCodigo)) {
          parametros.conLaminado = conLaminado;
        }
        if (MOTORS_CON_COLOR.has(motorCodigo) && color.trim()) {
          parametros.color = color.trim();
        }
        if (MOTORS_CON_NUMEROS_TALONARIO.has(motorCodigo)) {
          const n = Number(numerosXTalonario);
          if (Number.isFinite(n) && n > 0) parametros.numerosXTalonario = n;
        }
        const seleccionesBase = MOTORS_CON_CARAS_TIPO.has(motorCodigo)
          ? [
              { dimension: "caras" as const, valor: caras },
              // El DTO valida contra valores lowercase (enum ValorOpcionProductiva),
              // pero la UI/motor usan 'CMYK'/'BN' para legibilidad.
              {
                dimension: "tipo_impresion" as const,
                valor: tipoImpresion.toLowerCase() as "cmyk" | "bn",
              },
            ]
          : undefined;
        const opcionesSeleccionadas = Array.from(opcionesAlternativas.entries()).map(
          ([pasoId, alternativaId]) => ({ pasoId, alternativaId }),
        );
        const result = await cotizarProductoVarianteV2(
          selectedVariantId,
          {
            cantidad: Number(cantidad),
            periodo,
            seleccionesBase: seleccionesBase as never,
            opcionalesSeleccionados: Array.from(opcionalesSeleccionados),
            opcionesSeleccionadas: opcionesSeleccionadas.length > 0
              ? opcionesSeleccionadas
              : undefined,
            parametros,
          },
          {},
        );
        setCotizacion(result);
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "No se pudo cotizar.");
      }
    });
  }, [selectedVariantId, cantidad, periodo, anchoMm, altoMm, conLaminado, color, numerosXTalonario, caras, tipoImpresion, opcionalesSeleccionados, opcionesAlternativas, motorCodigo, needsMedidas]);

  // Opcionales disponibles viene de la cotización anterior (lista en trazabilidad).
  // Primera vez que abre el tab aún no hay cotización → se muestra al regresar.
  type OpcionalCatalogItem = { id: string; codigo: string; nombre: string; familiaV2: string | null; seleccionado: boolean };
  const opcionalesDisponibles: OpcionalCatalogItem[] = React.useMemo(() => {
    const arr = (cotizacion?.trazabilidad as { opcionalesDisponibles?: OpcionalCatalogItem[] } | undefined)?.opcionalesDisponibles;
    return Array.isArray(arr) ? arr : [];
  }, [cotizacion]);

  const toggleOpcional = (id: string) => {
    setOpcionalesSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // P1.3.e — Extraer pasos con alternativas de la trazabilidad para armar selectores.
  type PasoConAlternativas = {
    operacionId: string;
    pasoNombre: string;
    seleccionadaId: string | null;
    alternativas: Array<{ id: string; label: string; esDefault: boolean }>;
  };
  const pasosConAlternativas: PasoConAlternativas[] = React.useMemo(() => {
    if (!cotizacion) return [];
    const out: PasoConAlternativas[] = [];
    for (const paso of cotizacion.pasos) {
      const traza = (paso.trazabilidad ?? {}) as Record<string, unknown>;
      const operacionId = traza.operacionId as string | undefined;
      const alts = traza.alternativasDisponibles as
        | Array<{ id: string; label: string; esDefault: boolean }>
        | undefined;
      const sel = traza.alternativaSeleccionada as
        | { id: string; fuente: "cliente" | "default" }
        | undefined;
      if (!operacionId || !Array.isArray(alts) || alts.length === 0) continue;
      out.push({
        operacionId,
        pasoNombre: paso.nombre,
        seleccionadaId: sel?.id ?? null,
        alternativas: alts,
      });
    }
    return out;
  }, [cotizacion]);

  const setAlternativa = (pasoId: string, alternativaId: string | null) => {
    setOpcionesAlternativas((prev) => {
      const next = new Map(prev);
      if (alternativaId === null) next.delete(pasoId);
      else next.set(pasoId, alternativaId);
      return next;
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Simular costo</CardTitle>
            <CardDescription>
              Cotización sobre el super motor universal. Los costos se desglosan
              en 3 buckets: centro de costo, materias primas, cargos flat.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Inputs — motor-aware */}
        <div className="grid gap-3 md:grid-cols-5">
          <Field>
            <FieldLabel>Cantidad</FieldLabel>
            <Input
              type="number"
              value={cantidad}
              min="1"
              onChange={(e) => setCantidad(e.target.value)}
            />
          </Field>
          {needsMedidas ? (
            <>
              <Field>
                <FieldLabel>Ancho (mm)</FieldLabel>
                <Input
                  type="number"
                  value={anchoMm}
                  min="1"
                  onChange={(e) => setAnchoMm(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>Alto (mm)</FieldLabel>
                <Input
                  type="number"
                  value={altoMm}
                  min="1"
                  onChange={(e) => setAltoMm(e.target.value)}
                />
              </Field>
            </>
          ) : null}
          <Field>
            <FieldLabel>Periodo</FieldLabel>
            <Input
              type="text"
              value={periodo}
              placeholder="2026-04"
              onChange={(e) => setPeriodo(e.target.value)}
            />
          </Field>
          {MOTORS_CON_LAMINADO.has(motorCodigo) ? (
            <Field>
              <FieldLabel>Laminado UV</FieldLabel>
              <label className="flex items-center gap-2 pt-2">
                <Checkbox
                  checked={conLaminado}
                  onCheckedChange={(v) => setConLaminado(Boolean(v))}
                />
                <span className="text-sm text-muted-foreground">Con laminado</span>
              </label>
            </Field>
          ) : null}
          {MOTORS_CON_COLOR.has(motorCodigo) ? (
            <Field>
              <FieldLabel>Color (opcional)</FieldLabel>
              <Input
                type="text"
                value={color}
                placeholder="ej. Blanco, Negro..."
                onChange={(e) => setColor(e.target.value)}
              />
            </Field>
          ) : null}
          {MOTORS_CON_NUMEROS_TALONARIO.has(motorCodigo) ? (
            <Field>
              <FieldLabel>Nºs por talonario</FieldLabel>
              <Input
                type="number"
                value={numerosXTalonario}
                min="1"
                onChange={(e) => setNumerosXTalonario(e.target.value)}
              />
            </Field>
          ) : null}
          {MOTORS_CON_CARAS_TIPO.has(motorCodigo) ? (
            <>
              <Field>
                <FieldLabel>Caras</FieldLabel>
                <select
                  value={caras}
                  onChange={(e) => setCaras(e.target.value as "simple_faz" | "doble_faz")}
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                >
                  <option value="simple_faz">Simple faz</option>
                  <option value="doble_faz">Doble faz</option>
                </select>
              </Field>
              <Field>
                <FieldLabel>Tipo impresión</FieldLabel>
                <select
                  value={tipoImpresion}
                  onChange={(e) => setTipoImpresion(e.target.value as "CMYK" | "BN")}
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                >
                  <option value="CMYK">Color (CMYK)</option>
                  <option value="BN">Blanco y negro</option>
                </select>
              </Field>
            </>
          ) : null}
        </div>

        {/* Pasos opcionales — visibles tras la primera cotización */}
        {opcionalesDisponibles.length > 0 ? (
          <div className="rounded-lg border bg-muted/10 p-3">
            <p className="mb-2 text-sm font-medium">Pasos opcionales</p>
            <div className="flex flex-wrap gap-3">
              {opcionalesDisponibles.map((op) => (
                <label key={op.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={opcionalesSeleccionados.has(op.id)}
                    onCheckedChange={() => toggleOpcional(op.id)}
                  />
                  <span>{op.nombre}</span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Los pasos opcionales de la ruta del producto se suman al costo cuando los marcás.
            </p>
          </div>
        ) : null}

        {/* P1.3.e — Selector de alternativas por paso. Visible tras la primera
            cotización si algún paso declara alternativas máquina+perfil. */}
        {pasosConAlternativas.length > 0 ? (
          <div className="rounded-lg border bg-muted/10 p-3">
            <p className="mb-2 text-sm font-medium">
              Alternativas por paso (máquina · perfil)
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {pasosConAlternativas.map((p) => {
                const clienteElegida = opcionesAlternativas.get(p.operacionId);
                const value = clienteElegida ?? p.seleccionadaId ?? "";
                return (
                  <label key={p.operacionId} className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">{p.pasoNombre}</span>
                    <select
                      value={value}
                      onChange={(e) =>
                        setAlternativa(
                          p.operacionId,
                          e.target.value === "" ? null : e.target.value,
                        )
                      }
                      className="h-9 rounded-md border bg-background px-2 text-sm"
                    >
                      {p.alternativas.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                          {a.esDefault ? " · default" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Cuando un paso de la ruta declara alternativas, acá elegís cuál aplicar. Si no
              cambiás nada, se usa la marcada <strong>default</strong>.
            </p>
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-3">
          <Button type="button" onClick={handleCotizar} disabled={isCotizando || !selectedVariantId}>
            {isCotizando ? <GdiSpinner className="size-4" data-icon="inline-start" /> : null}
            Cotizar
          </Button>
        </div>

        {/* Resumen */}
        {cotizacion ? (
          <>
            <div className="grid gap-3 md:grid-cols-5">
              <div className="rounded-lg border bg-muted/20 p-4 text-center">
                <p className="text-3xl font-semibold">{formatCurrency(cotizacion.total)}</p>
                <p className="mt-1 text-sm text-muted-foreground">Total</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-4 text-center">
                <p className="text-2xl font-semibold">{formatCurrency(cotizacion.unitario)}</p>
                <p className="mt-1 text-sm text-muted-foreground">Unitario</p>
              </div>
              <div className="rounded-lg border bg-blue-50 p-4 text-center">
                <p className="text-2xl font-semibold">{formatCurrency(cotizacion.subtotales.centroCosto)}</p>
                <p className="mt-1 text-sm text-muted-foreground">Centro de costo</p>
              </div>
              <div className="rounded-lg border bg-green-50 p-4 text-center">
                <p className="text-2xl font-semibold">{formatCurrency(cotizacion.subtotales.materiasPrimas)}</p>
                <p className="mt-1 text-sm text-muted-foreground">Materias primas</p>
              </div>
              <div className="rounded-lg border bg-amber-50 p-4 text-center">
                <p className="text-2xl font-semibold">{formatCurrency(cotizacion.subtotales.cargosFlat)}</p>
                <p className="mt-1 text-sm text-muted-foreground">Cargos flat</p>
              </div>
            </div>

            {/* Tabla de pasos */}
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Paso</TableHead>
                    <TableHead>Familia</TableHead>
                    <TableHead className="text-right">Centro de costo</TableHead>
                    <TableHead className="text-right">Materias primas</TableHead>
                    <TableHead className="text-right">Cargos flat</TableHead>
                    <TableHead className="text-right">Subtotal paso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cotizacion.pasos.map((paso) => {
                    const subtotalPaso = paso.costoCentroCosto + paso.costoMateriasPrimas + paso.cargosFlat;
                    return (
                      <TableRow key={paso.id}>
                        <TableCell className="font-medium">{paso.nombre}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{paso.tipo}</TableCell>
                        <TableCell className="text-right">{formatCurrency(paso.costoCentroCosto)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(paso.costoMateriasPrimas)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(paso.cargosFlat)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(subtotalPaso)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* SM.5 — Desglose de materias primas por paso, agrupado por fuente
                (sustrato del nesting / consumibles de máquina / desgaste / auxiliares).
                Solo mostramos pasos con materiales > 0. */}
            <DesgloseMateriales pasos={cotizacion.pasos} />


            {/* Visualización del nesting — una card por paso `produce`. */}
            {(() => {
              const previews = cotizacion.pasos
                .map((paso) => ({ paso, data: extractNestingPreview(paso) }))
                .filter((x) => x.data !== null);
              if (previews.length === 0) return null;
              return (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold">Visualización del nesting</h3>
                    <p className="text-xs text-muted-foreground">
                      Cómo se acomodan las piezas en el rollo/pliego/placa según el algoritmo
                      del paso.
                    </p>
                  </div>
                  {previews.map(({ paso, data }) => (
                    <Card key={paso.id}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">{paso.nombre}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <NestingPreview
                          container={data!.container}
                          placements={data!.placements}
                          variant="compact"
                          maxHeightPx={400}
                        />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              );
            })()}

            {cotizacion.subProductos.length > 0 && (
              <div className="space-y-2">
                <div>
                  <h3 className="text-sm font-semibold">Sub-productos cotizados</h3>
                  <p className="text-xs text-muted-foreground">
                    Productos consumidos como insumos por algún paso de la ruta. Cada uno se
                    cotiza recursivamente con su propia ruta; su total entra como material
                    en el paso que lo consume.
                  </p>
                </div>
                <div className="space-y-3">
                  {cotizacion.subProductos.map((sub, i) => (
                    <SubProductoCard key={i} cotizacion={sub} />
                  ))}
                </div>
              </div>
            )}

            {cotizacion.warnings.length > 0 ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
                <p className="font-medium text-amber-900">Advertencias</p>
                <ul className="mt-1 list-inside list-disc text-xs text-amber-800">
                  {cotizacion.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <details className="rounded-lg border p-3 text-xs">
              <summary className="cursor-pointer text-sm font-medium">Trazabilidad técnica</summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs text-muted-foreground">
                {JSON.stringify(cotizacion.trazabilidad, null, 2)}
              </pre>
            </details>
          </>
        ) : (
          <div className="rounded-lg border bg-muted/10 p-6 text-center text-sm text-muted-foreground">
            Ingresá los parámetros y dale a &quot;Cotizar v2&quot; para ver el desglose.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ──────────────── SM.5 — Desglose de materias primas por paso ────────────────

type MaterialItem = {
  nombre: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  costo: number;
  fuente: string;
};

const FUENTE_GROUPS = [
  {
    key: "sustrato",
    title: "Sustrato del nesting",
    desc: "Material declarado como sustrato del paso (ej. rollo de vinilo, pliego). El motor evaluó las variantes habilitadas y eligió la mejor.",
    matchFuente: ["ProcesoOperacionMaterial.sustrato"],
    matchHeuristic: (m: MaterialItem) =>
      m.fuente === "ProcesoOperacionMaterial" &&
      (m.nombre.toLowerCase().includes("vinilo") ||
        m.nombre.toLowerCase().includes("papel") ||
        m.nombre.toLowerCase().includes("placa") ||
        m.nombre.toLowerCase().includes("rollo")),
  },
  {
    key: "consumibles",
    title: "Consumibles de máquina",
    desc: "Tintas, toner, barniz y otros consumibles absorbidos automáticamente desde la máquina + perfil del paso.",
    matchFuente: ["MaquinaConsumible"],
  },
  {
    key: "desgaste",
    title: "Desgaste / repuestos",
    desc: "Componentes de desgaste prorrateados por uso (fusor, drum, cabezal, cuchilla, etc.). Costo derivado de vida útil.",
    matchFuente: ["MaquinaDesgaste"],
  },
  {
    key: "auxiliares",
    title: "Auxiliares y manuales",
    desc: "Materiales declarados manualmente que no son sustrato (adhesivo, bolsa, encolado) o cargos genéricos.",
    matchFuente: ["ProcesoOperacionMaterial", "default", "config"],
  },
] as const;

function groupMateriales(materiales: MaterialItem[]) {
  const buckets: Record<string, MaterialItem[]> = {
    sustrato: [],
    consumibles: [],
    desgaste: [],
    auxiliares: [],
  };
  for (const m of materiales) {
    const placed = (() => {
      for (const g of FUENTE_GROUPS) {
        if ((g.matchFuente as readonly string[]).includes(m.fuente)) {
          // Para "sustrato" usamos heurística adicional dado que el backend
          // hoy emite todos los POM como `ProcesoOperacionMaterial` sin marca.
          if (g.key === "sustrato") {
            const isSustrato = (g as { matchHeuristic?: (m: MaterialItem) => boolean })
              .matchHeuristic?.(m);
            if (!isSustrato) continue;
          }
          buckets[g.key].push(m);
          return true;
        }
      }
      return false;
    })();
    if (!placed) buckets.auxiliares.push(m);
  }
  return buckets;
}

function DesgloseMateriales({
  pasos,
}: {
  pasos: Array<{ id: string; nombre: string; trazabilidad?: Record<string, unknown> }>;
}) {
  const pasosConMateriales = pasos.filter((paso) => {
    const traza = (paso.trazabilidad ?? {}) as Record<string, unknown>;
    const mats = traza.materiales;
    return Array.isArray(mats) && mats.length > 0;
  });
  if (pasosConMateriales.length === 0) return null;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Desglose de materias primas por paso</h3>
        <p className="text-xs text-muted-foreground">
          Cada paso muestra sus materiales agrupados por origen: sustrato del
          nesting, consumibles automáticos de la máquina, desgaste prorrateado y
          auxiliares manuales.
        </p>
      </div>
      <div className="space-y-3">
        {pasosConMateriales.map((paso) => {
          const traza = (paso.trazabilidad ?? {}) as Record<string, unknown>;
          const mats = (traza.materiales as Array<Record<string, unknown>>).map(
            (m) => ({
              nombre: String(m.nombre ?? "—"),
              cantidad: Number(m.cantidad ?? 0),
              unidad: String(m.unidad ?? ""),
              precioUnitario: Number(m.precioUnitario ?? 0),
              costo: Number(m.costo ?? 0),
              fuente: String(m.fuente ?? ""),
            }),
          );
          const totalPaso = mats.reduce((acc, m) => acc + m.costo, 0);
          const buckets = groupMateriales(mats);
          return (
            <Card key={paso.id}>
              <CardHeader className="pb-2">
                <div className="flex items-baseline justify-between gap-3">
                  <CardTitle className="text-sm">{paso.nombre}</CardTitle>
                  <span className="text-sm font-semibold">
                    {formatCurrency(totalPaso)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pb-4">
                {FUENTE_GROUPS.map((g) => {
                  const items = buckets[g.key];
                  if (items.length === 0) return null;
                  const subtotal = items.reduce((acc, m) => acc + m.costo, 0);
                  return (
                    <div key={g.key} className="rounded-md border bg-muted/10 p-3">
                      <div className="mb-2 flex items-baseline justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {g.title}
                          </div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {g.desc}
                          </div>
                        </div>
                        <span className="text-sm font-medium">
                          {formatCurrency(subtotal)}
                        </span>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Material</TableHead>
                            <TableHead className="text-right text-xs">Cantidad</TableHead>
                            <TableHead className="text-right text-xs">Precio unit.</TableHead>
                            <TableHead className="text-right text-xs">Costo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((m, idx) => (
                            <TableRow key={`${m.nombre}-${idx}`}>
                              <TableCell className="text-xs">{m.nombre}</TableCell>
                              <TableCell className="text-right text-xs">
                                {m.cantidad.toLocaleString("es-AR", {
                                  maximumFractionDigits: 4,
                                })}{" "}
                                {m.unidad}
                              </TableCell>
                              <TableCell className="text-right text-xs">
                                {formatCurrency(m.precioUnitario)}
                              </TableCell>
                              <TableCell className="text-right text-xs font-medium">
                                {formatCurrency(m.costo)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
