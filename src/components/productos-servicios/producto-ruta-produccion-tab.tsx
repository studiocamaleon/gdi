"use client";

/**
 * Tab "Ruta de producción" (re-skin Grafo).
 *
 * Layout:
 *   - RutaAssignerCard (route banner Grafo)
 *   - Metrics strip (3 KPIs reales: pasos · tiempo ciclo · setup acumulado)
 *   - Steps list unified: rows con click-to-expand. El body expandido contiene
 *     opciones (chips) + materiales declarativos (tabla mini inline). Una row
 *     expandida a la vez.
 *   - Collapsed empties row al pie listando pasos sin materiales.
 *
 * Mantiene los Sheets de edición (PasoEditor / MaterialesEditor /
 * AlternativasEditor) y los handlers (handleMove). No se introduce un savebar
 * porque la edición es por Sheet (cada Sheet guarda individualmente).
 */
import * as React from "react";
import { toast } from "sonner";

import { AlternativasEditorSheet } from "@/components/productos-servicios/alternativas-editor-sheet";
import { MaterialesEditorSheet } from "@/components/productos-servicios/materiales-editor-sheet";
import { PasoEditorSheet } from "@/components/productos-servicios/paso-editor-sheet";
import { RutaAssignerCard } from "@/components/productos-servicios/ruta-assigner-card";
import type { ProductTabProps } from "@/components/productos-servicios/product-detail-types";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { Button } from "@/components/ui/button";
import { moveProcesoOperacion } from "@/lib/procesos-api";
import {
  getRutaCompletaPorProducto,
  getRutaCompletaPorVariante,
  type RutaCompleta,
  type RutaCompletaOperacion,
} from "@/lib/productos-servicios-api";
import { cn } from "@/lib/utils";

function formatMin(v: number | null): string {
  if (v == null || v === 0) return "—";
  return `${v} min`;
}

function formatProductividad(op: RutaCompletaOperacion): {
  value: string;
  unit: string;
  empty: boolean;
} {
  const perfilVal = op.perfilOperativo?.productivityValue;
  const baseVal = op.productividadBase;
  const val = perfilVal ?? baseVal;
  if (val == null || val === 0) return { value: "—", unit: "", empty: true };
  return {
    value: String(val),
    unit: `${op.unidadProductivaV2 ?? "unidad"}/h`,
    empty: false,
  };
}

type ActivacionMeta = {
  label: string;
  tone: "mand" | "opt" | "cond";
};

function getActivacion(op: RutaCompletaOperacion): ActivacionMeta {
  if (op.esOpcional) return { label: "Opcional", tone: "opt" };
  if (op.activacionV2 === "CONDICIONAL")
    return { label: "Condicional", tone: "cond" };
  return { label: "Obligatorio", tone: "mand" };
}

type NestingMeta = {
  label: string;
  tone: "lime" | "muted" | "warn";
};

/**
 * Resuelve el algoritmo de nesting que aplica a un paso según su familia.
 * - 3 familias producen nesting (`impresion_por_*`)
 * - El resto no participa de nesting
 * - Si familiaV2 es null → diagnóstico "familia no asignada" (warn)
 */
function getNestingMeta(op: RutaCompletaOperacion): NestingMeta {
  if (!op.familiaV2) {
    return { label: "familia no asignada", tone: "warn" };
  }
  switch (op.familiaV2) {
    case "impresion_por_hoja":
      return { label: "nesting-hoja", tone: "lime" };
    case "impresion_por_area":
      return { label: "nesting-rollo", tone: "lime" };
    case "impresion_por_pieza":
      return { label: "nesting-placa-rigida", tone: "lime" };
    default:
      return { label: "sin nesting", tone: "muted" };
  }
}

function totalCicloMinutos(ops: RutaCompletaOperacion[]): number {
  return ops.reduce(
    (acc, op) =>
      acc +
      (op.setupMin ?? 0) +
      (op.cleanupMin ?? 0) +
      (op.tiempoFijoMin ?? 0),
    0,
  );
}

function totalSetupMinutos(ops: RutaCompletaOperacion[]): number {
  return ops.reduce((acc, op) => acc + (op.setupMin ?? 0), 0);
}

export function ProductoRutaProduccionTab(props: ProductTabProps) {
  const [ruta, setRuta] = React.useState<RutaCompleta | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [altEditorState, setAltEditorState] = React.useState<{
    operacionId: string;
    operacionNombre: string;
  } | null>(null);
  const [matEditorState, setMatEditorState] = React.useState<{
    operacionId: string;
    operacionNombre: string;
    familiaV2: string | null;
  } | null>(null);
  const [pasoEditorState, setPasoEditorState] =
    React.useState<RutaCompletaOperacion | null>(null);
  const [movingId, setMovingId] = React.useState<string | null>(null);
  const [showAllEmpties, setShowAllEmpties] = React.useState(false);
  const selectedVariantId = props.selectedVariantId;
  const productoId = props.producto.id;

  const load = React.useCallback(() => {
    setIsLoading(true);
    const promise = selectedVariantId
      ? getRutaCompletaPorVariante(selectedVariantId)
      : getRutaCompletaPorProducto(productoId);
    return promise
      .then((r) => setRuta(r))
      .catch((err) => {
        console.error(err);
        toast.error(
          err instanceof Error ? err.message : "No se pudo cargar la ruta.",
        );
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
        toast.error(
          err instanceof Error ? err.message : "No se pudo mover el paso.",
        );
      } finally {
        setMovingId(null);
      }
    },
    [load],
  );

  if (isLoading) {
    return (
      <div className="flex justify-center rounded-[10px] border border-line bg-bg-1 p-8">
        <GdiSpinner className="size-6" />
      </div>
    );
  }

  if (!ruta || !ruta.procesoDefinicionId) {
    return (
      <RutaAssignerCard
        productoId={productoId}
        currentProcesoDefinicionId={null}
        currentProcesoNombre={null}
        variantesCount={props.variantes.length}
        onChanged={async () => {
          await load();
          props.refreshProducto?.();
        }}
      />
    );
  }

  const operaciones = ruta.operaciones;
  const totalPasos = operaciones.length;
  const pasosObligatorios = operaciones.filter((op) => !op.esOpcional).length;
  const cicloMin = totalCicloMinutos(operaciones);
  const setupMin = totalSetupMinutos(operaciones);
  const conMateriales = operaciones.filter(
    (op) => op.materialesConsumidos.length > 0,
  );
  const sinMateriales = operaciones.filter(
    (op) => op.materialesConsumidos.length === 0,
  );

  return (
    <div className="flex flex-col gap-5">
      <RutaAssignerCard
        productoId={productoId}
        currentProcesoDefinicionId={ruta.procesoDefinicionId}
        currentProcesoNombre={ruta.procesoNombre}
        variantesCount={props.variantes.length}
        onChanged={async () => {
          await load();
          props.refreshProducto?.();
        }}
      />

      {/* METRICS STRIP — 4 KPIs reales (sin "Costo ruta" porque requiere cotización) */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[8px] border border-line bg-line lg:grid-cols-4">
        <Metric
          label="Pasos totales"
          value={String(totalPasos)}
          unit={`${pasosObligatorios} oblig. · ${totalPasos - pasosObligatorios} opc.`}
        />
        <Metric
          label="Tiempo ciclo"
          value={cicloMin > 0 ? String(cicloMin) : "—"}
          unit="min / ciclo"
        />
        <Metric
          label="Setup acumulado"
          value={setupMin > 0 ? String(setupMin) : "—"}
          unit="min"
        />
        <Metric
          label="Materiales declarados"
          value={`${conMateriales.length}`}
          unit={`/ ${totalPasos} pasos`}
          tone={
            sinMateriales.length > 0 && conMateriales.length > 0
              ? "warn"
              : undefined
          }
        />
      </div>

      {/* STEPS LIST — unified rows with click-to-expand */}
      <div className="overflow-hidden rounded-[10px] border border-line bg-line">
        {operaciones.map((op) => {
          const isExpanded = expandedId === op.id;
          const isFirst = op.orden === 1;
          const isLast = op.orden === totalPasos;
          return (
            <StepRow
              key={op.id}
              op={op}
              isExpanded={isExpanded}
              onToggle={() =>
                setExpandedId((prev) => (prev === op.id ? null : op.id))
              }
              onEdit={() => setPasoEditorState(op)}
              onManageMateriales={() =>
                setMatEditorState({
                  operacionId: op.id,
                  operacionNombre: op.nombre,
                  familiaV2: op.familiaV2,
                })
              }
              onManageAlternativas={() =>
                setAltEditorState({
                  operacionId: op.id,
                  operacionNombre: op.nombre,
                })
              }
              onMoveUp={() => handleMove(op.id, "up")}
              onMoveDown={() => handleMove(op.id, "down")}
              isMoving={movingId !== null}
              isFirst={isFirst}
              isLast={isLast}
            />
          );
        })}

        {/* Collapsed empties summary */}
        {sinMateriales.length > 0 && (
          <div className="border-t border-line bg-bg">
            <button
              type="button"
              onClick={() => setShowAllEmpties((v) => !v)}
              className="flex w-full items-center justify-between gap-4 px-5 py-2.5 text-left transition-colors hover:bg-bg-2"
            >
              <div className="flex flex-wrap items-baseline gap-2 text-xs text-ink-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em]">
                  {sinMateriales.length}{" "}
                  {sinMateriales.length === 1
                    ? "paso sin materiales declarados"
                    : "pasos sin materiales declarados"}
                </span>
                {!showAllEmpties && (
                  <span className="text-ink-4">
                    — {sinMateriales.map((op) => op.nombre).join(" · ")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-4">
                  Fallback: plantilla familia
                </span>
                <span className="font-mono text-xs text-lime">
                  {showAllEmpties ? "Ocultar ↑" : "Expandir ↓"}
                </span>
              </div>
            </button>
            {showAllEmpties && (
              <ul className="border-t border-line px-5 py-3 text-xs text-ink-2">
                {sinMateriales.map((op) => (
                  <li key={op.id} className="py-1">
                    Paso {op.orden} —{" "}
                    <span className="text-ink-0">{op.nombre}</span>{" "}
                    <span className="text-ink-4">({op.codigo})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

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
          familiaV2={matEditorState.familiaV2}
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

// ──────────────── Subcomponentes locales ────────────────

function Metric({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: "warn" | "ok";
}) {
  return (
    <div className="bg-bg-1 px-4 py-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
        {label}
      </div>
      <div className="mt-1.5 font-serif text-[28px] italic leading-[1.1] text-ink-0">
        {value}
        {unit && (
          <span
            className={cn(
              "ml-1 font-mono text-[11px] font-normal not-italic tracking-[0.04em]",
              tone === "warn" ? "text-warn" : "text-ink-3",
            )}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

function StepRow({
  op,
  isExpanded,
  onToggle,
  onEdit,
  onManageMateriales,
  onManageAlternativas,
  onMoveUp,
  onMoveDown,
  isMoving,
  isFirst,
  isLast,
}: {
  op: RutaCompletaOperacion;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onManageMateriales: () => void;
  onManageAlternativas: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isMoving: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  const activacion = getActivacion(op);
  const nesting = getNestingMeta(op);
  const productividad = formatProductividad(op);
  const idx = String(op.orden).padStart(2, "0");

  return (
    <div
      className={cn(
        "group bg-bg-1 transition-colors",
        isExpanded && "bg-bg-2 shadow-[inset_3px_0_0_var(--lime)]",
      )}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        className="grid cursor-pointer items-center gap-5 px-5 py-3.5 transition-colors hover:bg-bg-2 lg:grid-cols-[40px_1.4fr_1fr_1.2fr_1fr_0.7fr_0.7fr_auto]"
      >
        {/* Idx */}
        <div className="font-mono text-[11px] tracking-[0.04em] text-ink-3">
          <span
            className={cn(
              "mr-2 inline-block size-2 rounded-full align-middle",
              op.esOpcional
                ? "border-[1.5px] border-ink-3 bg-transparent"
                : isExpanded
                  ? "bg-lime shadow-[0_0_8px_rgba(232,255,92,0.5)]"
                  : "bg-ink-4",
            )}
          />
          {idx}
        </div>

        {/* Title */}
        <div className="min-w-0">
          <div className="text-sm font-medium tracking-[-0.005em] text-ink-0">
            {op.nombre}
          </div>
          <div className="mt-0.5 font-mono text-[10px] tracking-[0.06em] text-ink-3">
            {op.codigo} · {op.familiaV2 ?? op.tipoOperacion.toLowerCase()}
          </div>
        </div>

        {/* Familia + centro costo + nesting algoritmo.
            R5 — Si el paso no tiene centro de costo asignado, mostramos un
            warning visible (banderilla ámbar) porque el motor cotiza ese
            paso a $0 silenciosamente y eso es una mina muy fácil de pisar. */}
        <div className="font-mono text-[11px] tracking-[0.02em] text-ink-2">
          {op.familiaV2 ?? "—"}
          {op.centroCosto ? (
            <span className="mt-0.5 block text-[10px] text-ink-4">
              Centro · {op.centroCosto.nombre}
            </span>
          ) : (
            <span
              className="mt-0.5 inline-block rounded-[3px] border border-warn bg-warn/10 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] text-warn"
              title="Sin centro de costo asignado: este paso cotizará $0."
            >
              ⚠ sin centro de costo
            </span>
          )}
          <span
            className={cn(
              "mt-1.5 inline-block rounded-[3px] border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em]",
              nesting.tone === "lime" && "border-line-hi text-lime",
              nesting.tone === "muted" &&
                "border-dashed border-line-hi text-ink-4",
              nesting.tone === "warn" && "border-warn text-warn",
            )}
          >
            {nesting.label}
          </span>
        </div>

        {/* Maquina + perfil */}
        <div className="text-[13px] text-ink-1">
          {op.maquina?.nombre ?? "—"}
          <span className="mt-0.5 block font-mono text-[10px] tracking-[0.02em] text-ink-3">
            {op.perfilOperativo
              ? `perfil · ${op.perfilOperativo.nombre}`
              : "sin perfil asignado"}
          </span>
        </div>

        {/* Times */}
        <div className="grid grid-cols-3 gap-x-2.5 gap-y-1.5 font-mono text-[11px] text-ink-2">
          <TimesCell k="Setup" v={formatMin(op.setupMin)} />
          <TimesCell k="Cleanup" v={formatMin(op.cleanupMin)} />
          <TimesCell k="Fijo" v={formatMin(op.tiempoFijoMin)} />
        </div>

        {/* Productividad */}
        <div
          className={cn(
            "font-mono text-[11px]",
            productividad.empty ? "text-ink-4" : "text-ink-0",
          )}
        >
          {productividad.value}
          {productividad.unit && (
            <span className="ml-0.5 text-[10px] text-ink-3">
              {productividad.unit}
            </span>
          )}
        </div>

        {/* Activación */}
        <div>
          <span
            className={cn(
              "inline-block rounded-[3px] border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em]",
              activacion.tone === "mand" && "border-ink-2 text-ink-0",
              activacion.tone === "opt" && "border-dashed border-line-hi text-ink-3",
              activacion.tone === "cond" && "border-warn text-warn",
            )}
          >
            {activacion.label}
          </span>
        </div>

        {/* Row actions — visible on hover or expanded */}
        <div
          className={cn(
            "flex gap-1 transition-opacity",
            isExpanded
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <RowIconButton
            title="Subir"
            disabled={isMoving || isFirst}
            onClick={onMoveUp}
          >
            ↑
          </RowIconButton>
          <RowIconButton
            title="Bajar"
            disabled={isMoving || isLast}
            onClick={onMoveDown}
          >
            ↓
          </RowIconButton>
          <RowIconButton title="Editar" onClick={onEdit}>
            ✎
          </RowIconButton>
        </div>
      </div>

      {/* Expanded body */}
      {isExpanded && (
        <div className="border-t border-line bg-bg-2 px-[68px] py-0">
          {/* Opciones (alternativas) */}
          <div className="grid grid-cols-1 gap-6 border-b border-dashed border-line py-4 lg:grid-cols-[180px_1fr]">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
              Opciones
              <span className="mt-1.5 block text-[10px] normal-case tracking-normal text-ink-4">
                {op.alternativas.length === 0
                  ? "Sin alternativas configuradas."
                  : `${op.alternativas.length} alternativa${op.alternativas.length === 1 ? "" : "s"} de máquina/perfil.`}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {op.alternativas.length === 0 ? (
                <span className="text-[13px] text-ink-4">
                  Sin opciones configuradas
                </span>
              ) : (
                op.alternativas.map((alt) => (
                  <span
                    key={alt.id}
                    className="inline-flex items-center gap-2 rounded border border-line-hi px-2.5 py-1.5 font-mono text-[11px] text-ink-1"
                  >
                    <span className="text-[10px] uppercase tracking-[0.08em] text-ink-3">
                      {alt.maquina?.nombre ?? "máquina"}
                    </span>
                    {alt.label}
                    {alt.esDefault && (
                      <span className="rounded-sm bg-lime px-1 text-[9px] uppercase tracking-[0.08em] text-lime-ink">
                        default
                      </span>
                    )}
                  </span>
                ))
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={onManageAlternativas}
              >
                Gestionar opciones
              </Button>
            </div>
          </div>

          {/* R3 — Bucket Materiales unificado: declarativos + consumibles
              + desgaste, todos en una sola caja con sub-grupos. Todos
              estos ítems van al bucket Materiales en la cotización; el
              usuario los ve agrupados, no dispersos en 2 secciones. */}
          {(() => {
            const declaradosCount = op.materialesConsumidos.length;
            const consumiblesCount = op.maquina?.consumibles.length ?? 0;
            const desgasteCount = op.maquina?.componentesDesgaste.length ?? 0;
            const total = declaradosCount + consumiblesCount + desgasteCount;
            return (
              <div className="grid grid-cols-1 gap-6 py-4 lg:grid-cols-[180px_1fr]">
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
                  Materiales
                  <span className="mt-1.5 block text-[10px] normal-case tracking-normal text-ink-4">
                    {total === 0
                      ? "Sin materiales detectados."
                      : `${total} ítem${total === 1 ? "" : "s"} aportan al bucket Materiales.`}
                  </span>
                  <span className="mt-1 block text-[10px] normal-case tracking-normal text-ink-4">
                    {declaradosCount} declarado{declaradosCount === 1 ? "" : "s"}
                    {" · "}
                    {consumiblesCount} consumible{consumiblesCount === 1 ? "" : "s"}
                    {" · "}
                    {desgasteCount} desgaste{desgasteCount === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="space-y-3">
                  {/* Sub-grupo: declarados */}
                  {declaradosCount === 0 ? (
                    <div className="flex flex-wrap items-center justify-between gap-4 rounded-[6px] border border-dashed border-line-hi bg-bg-1 px-4 py-3">
                      <div className="text-[13px] text-ink-3">
                        <em className="font-serif text-[15px] italic text-ink-2">
                          Sin materiales declarativos.
                        </em>{" "}
                        Se aplica la plantilla imperativa de la familia.
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onManageMateriales}
                      >
                        Gestionar
                      </Button>
                    </div>
                  ) : (
                    <MaterialesMiniTable
                      materiales={op.materialesConsumidos}
                      onAdd={onManageMateriales}
                    />
                  )}

                  {/* Sub-grupos: consumibles + desgaste de máquina (read-only).
                      Sus acordeones internos siguen funcionando como antes;
                      ahora viven dentro del bloque "Materiales" en lugar de
                      tener su propia caja separada. */}
                  {op.maquina &&
                    (consumiblesCount > 0 || desgasteCount > 0) && (
                      <ConsumiblesMaquinaSection
                        maquina={op.maquina}
                        perfilOperativoId={op.perfilOperativo?.id ?? null}
                        perfilesDeAlternativas={op.alternativas
                          .map((a) => a.perfilOperativo)
                          .filter(
                            (p): p is { id: string; nombre: string } =>
                              p !== null,
                          )}
                      />
                    )}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

/**
 * SM.5 — Sección read-only que muestra los consumibles + desgaste configurados
 * en la máquina del paso, filtrados por su perfil operativo. El motor los
 * absorbe automáticamente al cotizar — no hace falta declararlos como POM.
 */
function ConsumiblesMaquinaSection({
  maquina,
  perfilOperativoId,
  perfilesDeAlternativas,
}: {
  maquina: NonNullable<RutaCompletaOperacion["maquina"]>;
  perfilOperativoId: string | null;
  /** Perfiles disponibles vía Alternativas del paso. Cuando el paso no tiene
   * perfil fijo, los consumibles se filtran a estos perfiles (los que el
   * cliente puede llegar a elegir al cotizar). */
  perfilesDeAlternativas: Array<{ id: string; nombre: string }>;
}) {
  const desgaste = maquina.componentesDesgaste;

  // SM.5 — Estrategia de display:
  //   1. Paso CON perfil fijo → filtra a ese perfil (+ los `null` = todos).
  //   2. Paso SIN perfil fijo PERO CON alternativas → filtra a los perfiles
  //      de las alternativas (los que el user puede elegir al cotizar).
  //   3. Sin perfil ni alternativas → muestra todos los consumibles
  //      agrupados por perfil (último recurso).
  type Consumible = NonNullable<RutaCompletaOperacion["maquina"]>["consumibles"][number];
  const perfilesAlternativaIds = new Set(perfilesDeAlternativas.map((p) => p.id));
  const perfilesAlternativaNombres = new Map(
    perfilesDeAlternativas.map((p) => [p.id, p.nombre]),
  );
  const usandoAlternativas = !perfilOperativoId && perfilesAlternativaIds.size > 0;

  const grupos: Array<{ key: string; perfilLabel: string; items: Consumible[] }> = (() => {
    if (perfilOperativoId) {
      const aplicables = maquina.consumibles.filter(
        (c) => c.perfilOperativoId === null || c.perfilOperativoId === perfilOperativoId,
      );
      return aplicables.length > 0
        ? [
            {
              key: perfilOperativoId,
              perfilLabel: "Aplicables a este paso",
              items: aplicables,
            },
          ]
        : [];
    }
    if (usandoAlternativas) {
      // Filtra a los perfiles que las alternativas del paso ofrecen + los null.
      const byPerfil = new Map<string, { nombre: string | null; items: Consumible[] }>();
      for (const c of maquina.consumibles) {
        if (
          c.perfilOperativoId !== null &&
          !perfilesAlternativaIds.has(c.perfilOperativoId)
        )
          continue;
        const k = c.perfilOperativoId ?? "__all__";
        if (!byPerfil.has(k)) {
          byPerfil.set(k, {
            nombre:
              c.perfilOperativoNombre ??
              (k !== "__all__"
                ? perfilesAlternativaNombres.get(k) ?? null
                : null),
            items: [],
          });
        }
        byPerfil.get(k)!.items.push(c);
      }
      const result: Array<{ key: string; perfilLabel: string; items: Consumible[] }> = [];
      if (byPerfil.has("__all__")) {
        result.push({
          key: "__all__",
          perfilLabel: "Todos los perfiles",
          items: byPerfil.get("__all__")!.items,
        });
        byPerfil.delete("__all__");
      }
      for (const [perfilId, g] of byPerfil) {
        result.push({
          key: perfilId,
          perfilLabel: g.nombre ?? `Perfil ${perfilId.slice(0, 8)}`,
          items: g.items,
        });
      }
      return result;
    }
    // Sin perfil fijo NI alternativas → agrupamos todos por perfilOperativoId
    const byPerfil = new Map<string, { nombre: string | null; items: Consumible[] }>();
    for (const c of maquina.consumibles) {
      const k = c.perfilOperativoId ?? "__all__";
      if (!byPerfil.has(k)) {
        byPerfil.set(k, { nombre: c.perfilOperativoNombre ?? null, items: [] });
      }
      byPerfil.get(k)!.items.push(c);
    }
    const result: Array<{ key: string; perfilLabel: string; items: Consumible[] }> = [];
    if (byPerfil.has("__all__")) {
      result.push({
        key: "__all__",
        perfilLabel: "Todos los perfiles",
        items: byPerfil.get("__all__")!.items,
      });
      byPerfil.delete("__all__");
    }
    for (const [perfilId, g] of byPerfil) {
      result.push({
        key: perfilId,
        perfilLabel: g.nombre ?? `Perfil ${perfilId.slice(0, 8)}`,
        items: g.items,
      });
    }
    return result;
  })();

  const totalConsumibles = grupos.reduce((acc, g) => acc + g.items.length, 0);
  if (totalConsumibles === 0 && desgaste.length === 0) return null;

  const sinPerfilEnPaso = !perfilOperativoId;
  // SM.5 — Default colapsado para evitar muralla de items.
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(
    () => new Set(),
  );
  const toggleGroup = (key: string) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="grid grid-cols-1 gap-6 border-t border-dashed border-line py-4 lg:grid-cols-[180px_1fr]">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
        Desde la máquina
        <span className="mt-1.5 block text-[10px] normal-case tracking-normal text-ink-4">
          Consumibles + desgaste cargados en {maquina.nombre}. Se absorben
          automáticamente al cotizar — para editarlos andá a Costos →
          Maquinaria.
        </span>
        {sinPerfilEnPaso && totalConsumibles > 0 && (
          <span className="mt-2 block text-[10px] normal-case tracking-normal text-warn">
            {usandoAlternativas
              ? perfilesDeAlternativas.length === 1
                ? `El perfil ${perfilesDeAlternativas[0].nombre} es la única alternativa — sus consumibles son los que se absorberán al cotizar.`
                : `El perfil se elige al cotizar entre ${perfilesDeAlternativas.length} alternativas — los consumibles dependen de cuál elija el cliente.`
              : "Este paso no tiene perfil fijo — el perfil se elige al cotizar y determina qué consumibles aplican."}
          </span>
        )}
      </div>
      <div className="space-y-3">
        {grupos.length > 0 && (
          <div className="overflow-hidden rounded-[6px] border border-line bg-bg-1">
            <div className="border-b border-line bg-bg px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
              Consumibles ({totalConsumibles})
            </div>
            <div className="divide-y divide-line text-[13px]">
              {grupos.map((g) => {
                const isExpanded = expandedGroups.has(g.key);
                // Si solo hay 1 grupo y el paso tiene perfil fijo, no
                // mostramos el header colapsable (no aporta info).
                const showHeader =
                  sinPerfilEnPaso || grupos.length > 1;
                return (
                  <div key={g.key}>
                    {showHeader && (
                      <button
                        type="button"
                        onClick={() => toggleGroup(g.key)}
                        className="flex w-full items-center justify-between border-b border-line bg-bg-2 px-3.5 py-1.5 text-left transition-colors hover:bg-bg-3"
                      >
                        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-2">
                          {g.perfilLabel}{" "}
                          <span className="text-ink-4">({g.items.length})</span>
                        </span>
                        <span className="font-mono text-[10px] text-ink-3">
                          {isExpanded ? "▾" : "▸"}
                        </span>
                      </button>
                    )}
                    {(isExpanded || !showHeader) &&
                      g.items.map((c) => {
                        const color = readColorFromConsumible(c);
                        const tonerLabel = colorToLabel(color);
                        return (
                          <div
                            key={c.id}
                            className="grid grid-cols-[1fr_auto_auto] items-baseline gap-3 px-3.5 py-2"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                {color && (
                                  <span
                                    className="inline-block size-2.5 rounded-sm border border-line-hi"
                                    style={{ backgroundColor: colorToHex(color) }}
                                    aria-label={tonerLabel ?? color}
                                  />
                                )}
                                <span className="text-ink-0">
                                  {tonerLabel ? `${c.nombre} · ${tonerLabel}` : c.nombre}
                                </span>
                              </div>
                              <div className="font-mono text-[10px] tracking-[0.04em] text-ink-3">
                                {c.tipo.toLowerCase()}
                                {!sinPerfilEnPaso &&
                                  (c.perfilOperativoId
                                    ? " · solo este perfil"
                                    : " · todos los perfiles")}
                              </div>
                            </div>
                            <div className="font-mono text-[11px] text-ink-1">
                              {c.consumoBase != null
                                ? `${c.consumoBase} ${c.unidad.toLowerCase()}`
                                : "—"}
                            </div>
                            <div className="font-mono text-[11px] text-ink-2">
                              {c.materiaPrimaVariante?.precioReferencia != null
                                ? `$ ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(c.materiaPrimaVariante.precioReferencia)}`
                                : "—"}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {desgaste.length > 0 && (() => {
          const desgasteKey = "__desgaste__";
          const isDesgasteExpanded = expandedGroups.has(desgasteKey);
          return (
            <div className="overflow-hidden rounded-[6px] border border-line bg-bg-1">
              <button
                type="button"
                onClick={() => toggleGroup(desgasteKey)}
                className="flex w-full items-center justify-between border-b border-line bg-bg px-3.5 py-2 text-left transition-colors hover:bg-bg-2"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
                  Desgaste / repuestos{" "}
                  <span className="text-ink-4">({desgaste.length})</span>
                </span>
                <span className="font-mono text-[10px] text-ink-3">
                  {isDesgasteExpanded ? "▾" : "▸"}
                </span>
              </button>
              {isDesgasteExpanded && (
                <div className="divide-y divide-line text-[13px]">
                  {desgaste.map((d) => (
                    <div
                      key={d.id}
                      className="grid grid-cols-[1fr_auto_auto] items-baseline gap-3 px-3.5 py-2"
                    >
                      <div>
                        <div className="text-ink-0">{d.nombre}</div>
                        <div className="font-mono text-[10px] tracking-[0.04em] text-ink-3">
                          {d.tipo.toLowerCase()}
                        </div>
                      </div>
                      <div className="font-mono text-[11px] text-ink-1">
                        {d.vidaUtilEstimada != null
                          ? `${d.vidaUtilEstimada.toLocaleString("es-AR")} ${d.unidadDesgaste.toLowerCase()}`
                          : "—"}
                      </div>
                      <div className="font-mono text-[11px] text-ink-2">
                        {d.materiaPrimaVariante?.precioReferencia != null
                          ? `$ ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(d.materiaPrimaVariante.precioReferencia)}`
                          : "—"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function TimesCell({ k, v }: { k: string; v: string }) {
  const isEmpty = v === "—";
  return (
    <div>
      <span className="block font-mono text-[9px] uppercase tracking-[0.12em] text-ink-4">
        {k}
      </span>
      <span
        className={cn(
          "font-mono text-[11px]",
          isEmpty ? "text-ink-4" : "font-medium text-ink-0",
        )}
      >
        {v}
      </span>
    </div>
  );
}

function RowIconButton({
  children,
  title,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-[26px] items-center justify-center rounded border border-line-hi bg-transparent font-mono text-xs text-ink-3 transition-colors hover:border-ink-2 hover:text-ink-0 disabled:opacity-40 disabled:hover:border-line-hi disabled:hover:text-ink-3"
    >
      {children}
    </button>
  );
}

function MaterialesMiniTable({
  materiales,
  onAdd,
}: {
  materiales: RutaCompletaOperacion["materialesConsumidos"];
  onAdd: () => void;
}) {
  const subtotal = materiales.reduce((acc, m) => {
    const precio = m.materiaPrimaVariante?.precioReferencia ?? m.precioManual;
    if (precio == null) return acc;
    return acc + precio * m.cantidadPorUnidad;
  }, 0);
  return (
    <div className="overflow-hidden rounded-[6px] border border-line bg-bg-1">
      <div className="grid grid-cols-[2fr_1fr_1.4fr_0.7fr_0.7fr_0.7fr_0.8fr] gap-4 border-b border-line bg-bg px-3.5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
        <div>Material</div>
        <div>Variante</div>
        <div>Fórmula</div>
        <div>Cantidad</div>
        <div>Unidad</div>
        <div>Precio</div>
        <div>Multi-caras</div>
      </div>
      {materiales
        .slice()
        .sort((a, b) => a.orden - b.orden)
        .map((m) => {
          const precio =
            m.materiaPrimaVariante?.precioReferencia ?? m.precioManual;
          return (
            <div
              key={m.id}
              className="grid grid-cols-[2fr_1fr_1.4fr_0.7fr_0.7fr_0.7fr_0.8fr] gap-4 border-b border-line px-3.5 py-2.5 text-[13px] last:border-b-0 hover:bg-bg-2"
            >
              <div className="font-medium text-ink-0">{m.nombre}</div>
              <div className="font-mono text-[11px] text-ink-2">
                {m.materiaPrimaVariante ? m.materiaPrimaVariante.sku : "manual"}
              </div>
              <div>
                <span className="inline-block rounded-sm bg-info/[0.08] px-1.5 py-0.5 font-mono text-[11px] text-info">
                  {m.formula}
                </span>
              </div>
              <div className="font-mono text-ink-0">{m.cantidadPorUnidad}</div>
              <div className="font-mono text-[11px] text-ink-2">{m.unidad}</div>
              <div className="font-mono text-ink-0">
                {precio != null ? `AR$ ${precio}` : "—"}
              </div>
              <div
                className={cn(
                  "font-mono text-[10px] tracking-[0.04em]",
                  m.aplicaMultiCaras ? "text-warn" : "text-ink-4",
                )}
              >
                {m.aplicaMultiCaras ? "×2 si doble faz" : "—"}
              </div>
            </div>
          );
        })}
      <div className="flex items-center justify-between border-t border-line bg-bg px-3.5 py-2.5 font-mono text-[11px] tracking-[0.04em] text-ink-3">
        <span>
          {subtotal > 0
            ? `Subtotal material · AR$ ${subtotal.toFixed(0)}`
            : "Sin precio de referencia"}
        </span>
        <button
          type="button"
          onClick={onAdd}
          className="font-mono text-lime no-underline hover:underline"
        >
          + Agregar material
        </button>
      </div>
    </div>
  );
}

// ──────────────── Helpers de color de toner/tinta ────────────────

/**
 * Lee el color del consumible desde sus distintas convenciones de almacenamiento:
 *   - detalle.color (más común para toners CMYK)
 *   - detalle.canal
 *   - materiaPrimaVariante.atributosVariante.color
 * Retorna el string crudo en lowercase, o null si no hay color reconocible.
 */
function readColorFromConsumible(c: {
  detalle: Record<string, unknown> | null;
  materiaPrimaVariante: { atributosVariante: Record<string, unknown> | null } | null;
}): string | null {
  const d = c.detalle ?? {};
  const a = c.materiaPrimaVariante?.atributosVariante ?? {};
  const raw =
    (d.color as string | undefined) ??
    (d.canal as string | undefined) ??
    (a.color as string | undefined) ??
    null;
  if (!raw) return null;
  return String(raw).trim().toLowerCase();
}

const COLOR_LABELS: Record<string, string> = {
  cyan: "Cyan",
  c: "Cyan",
  magenta: "Magenta",
  m: "Magenta",
  yellow: "Yellow",
  y: "Yellow",
  black: "Black",
  k: "Black",
  negro: "Negro",
  blanco: "Blanco",
  white: "White",
  barniz: "Barniz",
  varnish: "Barniz",
  oro: "Oro",
  plata: "Plata",
};

const COLOR_HEX: Record<string, string> = {
  cyan: "#00bcd4",
  c: "#00bcd4",
  magenta: "#e91e63",
  m: "#e91e63",
  yellow: "#ffeb3b",
  y: "#ffeb3b",
  black: "#0a0a0a",
  k: "#0a0a0a",
  negro: "#0a0a0a",
  blanco: "#f4f4f0",
  white: "#f4f4f0",
  barniz: "#7BB3FF",
  varnish: "#7BB3FF",
  oro: "#d4af37",
  plata: "#c0c0c0",
};

function colorToLabel(color: string | null): string | null {
  if (!color) return null;
  return COLOR_LABELS[color] ?? color.charAt(0).toUpperCase() + color.slice(1);
}

function colorToHex(color: string): string {
  return COLOR_HEX[color] ?? "#999999";
}
