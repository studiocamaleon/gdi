"use client";

/**
 * P1.5 — Editor de paso (ProcesoOperacion) desde el tab "Ruta de producción".
 *
 * Permite editar los campos más usados sin ir al tab legacy:
 * - Nombre, activación (obligatorio / opcional / condicional).
 * - Familia V2 + unidad productiva.
 * - Centro de costo, máquina + perfil operativo.
 * - Tiempos (setup, cleanup, fijo) y productividad base.
 *
 * Los campos avanzados (configNestingV2, leeDelTrabajoV2, etc.) siguen
 * viviendo en el tab legacy — esta UI cubre ~90% del uso diario.
 */
import * as React from "react";
import { toast } from "sonner";

import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { Button } from "@/components/ui/button";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { getCentrosCosto } from "@/lib/costos-api";
import type { CentroCosto } from "@/lib/costos";
import { getMaquinas } from "@/lib/maquinaria-api";
import type { Maquina } from "@/lib/maquinaria";
import {
  updateProcesoOperacion,
  type UpdateProcesoOperacionPayload,
} from "@/lib/procesos-api";
import type { RutaCompletaOperacion } from "@/lib/productos-servicios-api";
import { CondicionBuilder } from "@/components/productos-servicios/condicion-builder";

const NONE = "__none__";

/**
 * Las 23 familias del modelo universal. Lista espejo de
 * `apps/api/src/productos-servicios/pasos/familias.ts` — mantener en sync si
 * se agregan/eliminan familias.
 */
const FAMILIAS_V2 = [
  { codigo: "impresion_por_hoja", label: "Impresión por hoja" },
  { codigo: "impresion_por_area", label: "Impresión por área" },
  { codigo: "impresion_por_pieza", label: "Impresión por pieza" },
  { codigo: "aplicacion_transfer", label: "Aplicación de transfer" },
  { codigo: "corte", label: "Corte" },
  { codigo: "corte_volumetrico", label: "Corte volumétrico" },
  { codigo: "grabado", label: "Grabado" },
  { codigo: "plegado", label: "Plegado" },
  { codigo: "perforado", label: "Perforado" },
  { codigo: "troquelado", label: "Troquelado" },
  { codigo: "laminado", label: "Laminado" },
  { codigo: "acabado_decorativo", label: "Acabado decorativo" },
  { codigo: "pintura_superficial", label: "Pintura superficial" },
  { codigo: "encuadernado", label: "Encuadernado" },
  { codigo: "soldadura_herreria", label: "Soldadura / herrería" },
  { codigo: "ensamble_estructural", label: "Ensamble estructural" },
  { codigo: "instalacion_electrica", label: "Instalación eléctrica" },
  { codigo: "pre_prensa", label: "Pre-prensa" },
  { codigo: "diseno_grafico", label: "Diseño gráfico" },
  { codigo: "toma_medidas", label: "Toma de medidas (in situ)" },
  { codigo: "colocacion_in_situ", label: "Colocación in situ" },
  { codigo: "operacion_manual", label: "Operación manual" },
  { codigo: "insumo_externo_gestion", label: "Insumo externo (gestión)" },
] as const;

type DraftForm = {
  nombre: string;
  esOpcional: boolean;
  activacionV2: "OBLIGATORIO" | "OPCIONAL" | "CONDICIONAL";
  familiaV2: string; // "" = no familia
  unidadProductivaV2: string;
  centroCostoId: string;
  maquinaId: string; // NONE = sin máquina
  perfilOperativoId: string; // NONE = sin perfil
  setupMin: string;
  cleanupMin: string;
  tiempoFijoMin: string;
  productividadBase: string;
  // null = sin condición declarada. Solo relevante cuando activacionV2=CONDICIONAL.
  condicionV2: Record<string, unknown> | null;
  // Config completa actual del paso. Mantengo el objeto entero para no
  // perder campos avanzados que la UI no expone (ej. panelizado.distribution).
  configNestingV2: Record<string, unknown> | null;
};

// ──────────────── Algoritmos de nesting ────────────────

const FAMILIAS_PRODUCEN_NESTING = new Set([
  "impresion_por_hoja",
  "impresion_por_area",
  "impresion_por_pieza",
]);

type CriterioHoja =
  | "menor_cantidad_pliegos"
  | "mayor_aprovechamiento"
  | "mayor_piezas_por_pliego";

type PliegoCandidato = {
  codigo?: string;
  nombre?: string;
  anchoMm: number;
  altoMm: number;
};

function toDraft(op: RutaCompletaOperacion): DraftForm {
  return {
    nombre: op.nombre,
    esOpcional: op.esOpcional,
    activacionV2:
      (op.activacionV2 as DraftForm["activacionV2"]) ??
      (op.esOpcional ? "OPCIONAL" : "OBLIGATORIO"),
    familiaV2: op.familiaV2 ?? "",
    unidadProductivaV2: op.unidadProductivaV2 ?? "",
    centroCostoId: op.centroCosto?.id ?? "",
    maquinaId: op.maquina?.id ?? NONE,
    perfilOperativoId: op.perfilOperativo?.id ?? NONE,
    setupMin: op.setupMin != null ? String(op.setupMin) : "",
    cleanupMin: op.cleanupMin != null ? String(op.cleanupMin) : "",
    tiempoFijoMin: op.tiempoFijoMin != null ? String(op.tiempoFijoMin) : "",
    productividadBase:
      op.productividadBase != null ? String(op.productividadBase) : "",
    condicionV2: op.condicionV2 ?? null,
    configNestingV2:
      (op.configNestingV2 as Record<string, unknown> | null | undefined) ??
      null,
  };
}

function parseOptionalNumber(s: string): number | undefined {
  if (s.trim() === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Conversión cm ↔ mm. El motor guarda todo en mm; los forms muestran cm para
 * matchear la convención del editor de maquinaria. Round a 4 decimales para
 * limpiar ruido de floating point al dividir por 10.
 */
function mmToCmStr(mm: number | undefined | null): string {
  if (mm == null || !Number.isFinite(mm)) return "";
  return String(Number((mm / 10).toFixed(4)));
}
function cmInputToMm(cmStr: string): number | undefined {
  if (cmStr.trim() === "") return undefined;
  const n = Number(cmStr);
  if (!Number.isFinite(n)) return undefined;
  return Number((n * 10).toFixed(4));
}

// ──────────────── Helpers de configNestingV2 ────────────────

function getCfgNumber(
  cfg: Record<string, unknown> | null,
  key: string,
): string {
  if (!cfg) return "";
  const v = cfg[key];
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function getCfgBool(
  cfg: Record<string, unknown> | null,
  key: string,
  fallback: boolean,
): boolean {
  if (!cfg) return fallback;
  const v = cfg[key];
  if (typeof v === "boolean") return v;
  return fallback;
}

function getCfgString(
  cfg: Record<string, unknown> | null,
  key: string,
): string {
  if (!cfg) return "";
  const v = cfg[key];
  return typeof v === "string" ? v : "";
}

function getCfgArray<T = unknown>(
  cfg: Record<string, unknown> | null,
  key: string,
): T[] {
  if (!cfg) return [];
  const v = cfg[key];
  return Array.isArray(v) ? (v as T[]) : [];
}

function getCfgObject(
  cfg: Record<string, unknown> | null,
  key: string,
): Record<string, unknown> {
  if (!cfg) return {};
  const v = cfg[key];
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

/** Setea una key del config en un nuevo objeto. `undefined` la elimina. */
function setCfgKey(
  cfg: Record<string, unknown> | null,
  key: string,
  value: unknown,
): Record<string, unknown> | null {
  const next = { ...(cfg ?? {}) };
  if (value === undefined) {
    delete next[key];
  } else {
    next[key] = value;
  }
  return Object.keys(next).length === 0 ? null : next;
}

/** Setea panelizado.{key} preservando el resto del sub-objeto. */
function setPanelizadoKey(
  cfg: Record<string, unknown> | null,
  key: string,
  value: unknown,
): Record<string, unknown> | null {
  const panelizado = { ...getCfgObject(cfg, "panelizado") };
  if (value === undefined) {
    delete panelizado[key];
  } else {
    panelizado[key] = value;
  }
  if (Object.keys(panelizado).length === 0) {
    return setCfgKey(cfg, "panelizado", undefined);
  }
  return setCfgKey(cfg, "panelizado", panelizado);
}

export function PasoEditorSheet({
  open,
  onOpenChange,
  operacion,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operacion: RutaCompletaOperacion;
  onSaved?: () => void;
}) {
  const [draft, setDraft] = React.useState<DraftForm>(() => toDraft(operacion));
  const [centros, setCentros] = React.useState<CentroCosto[]>([]);
  const [maquinas, setMaquinas] = React.useState<Maquina[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setDraft(toDraft(operacion));
      setIsLoading(true);
      Promise.all([getCentrosCosto(), getMaquinas()])
        .then(([cc, maqs]) => {
          setCentros(cc.filter((c) => c.activo));
          setMaquinas(maqs.filter((m) => m.activo));
        })
        .catch((err) => {
          console.error(err);
          toast.error(
            err instanceof Error ? err.message : "No se pudieron cargar los catálogos.",
          );
        })
        .finally(() => setIsLoading(false));
    }
  }, [open, operacion]);

  const maquinaElegida = React.useMemo(
    () => maquinas.find((m) => m.id === draft.maquinaId) ?? null,
    [maquinas, draft.maquinaId],
  );
  const perfilesDisponibles = maquinaElegida?.perfilesOperativos ?? [];

  async function save() {
    if (draft.nombre.trim().length === 0) {
      toast.error("El nombre del paso es obligatorio.");
      return;
    }
    if (!draft.centroCostoId) {
      toast.error("El centro de costo es obligatorio.");
      return;
    }

    const payload: UpdateProcesoOperacionPayload = {
      nombre: draft.nombre.trim(),
      esOpcional: draft.activacionV2 === "OPCIONAL",
      activacionV2: draft.activacionV2,
      familiaV2: draft.familiaV2.trim(),
      unidadProductivaV2: draft.unidadProductivaV2.trim(),
      centroCostoId: draft.centroCostoId,
      maquinaId: draft.maquinaId === NONE ? null : draft.maquinaId,
      perfilOperativoId:
        draft.maquinaId === NONE || draft.perfilOperativoId === NONE
          ? null
          : draft.perfilOperativoId,
    };
    const setupMin = parseOptionalNumber(draft.setupMin);
    if (setupMin !== undefined) payload.setupMin = setupMin;
    const cleanupMin = parseOptionalNumber(draft.cleanupMin);
    if (cleanupMin !== undefined) payload.cleanupMin = cleanupMin;
    const tiempoFijoMin = parseOptionalNumber(draft.tiempoFijoMin);
    if (tiempoFijoMin !== undefined) payload.tiempoFijoMin = tiempoFijoMin;
    const productividadBase = parseOptionalNumber(draft.productividadBase);
    if (productividadBase !== undefined) payload.productividadBase = productividadBase;

    // condicionV2 solo tiene sentido cuando activacionV2=CONDICIONAL; en otros
    // modos se limpia automáticamente para evitar datos huérfanos.
    payload.condicionV2 =
      draft.activacionV2 === "CONDICIONAL" ? draft.condicionV2 : null;

    // configNestingV2 solo aplica si la familia produce nesting; en otros
    // casos la limpiamos para evitar datos huérfanos.
    payload.configNestingV2 = FAMILIAS_PRODUCEN_NESTING.has(draft.familiaV2)
      ? draft.configNestingV2
      : null;

    setIsSaving(true);
    try {
      await updateProcesoOperacion(operacion.id, payload);
      toast.success("Paso actualizado.");
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el paso.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-screen max-w-none overflow-y-auto data-[side=right]:w-[94vw] data-[side=right]:sm:max-w-[94vw] xl:data-[side=right]:w-[1120px] xl:data-[side=right]:sm:max-w-[1120px]"
      >
        <SheetHeader className="px-6 pt-6">
          <SheetTitle>Editar paso "{operacion.nombre}"</SheetTitle>
          <SheetDescription>
            Identidad, activación (obligatorio / opcional / condicional con
            reglas), familia, centro de costo, máquina, tiempos y productividad.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4 px-6 pb-6">
          {isLoading ? (
            <div className="flex justify-center p-6">
              <GdiSpinner className="size-6" />
            </div>
          ) : (
            <>
              <div className="grid gap-2">
                <Label>Nombre</Label>
                <Input
                  value={draft.nombre}
                  onChange={(e) => setDraft((d) => ({ ...d, nombre: e.target.value }))}
                  maxLength={120}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Activación</Label>
                  <Select
                    value={draft.activacionV2}
                    onValueChange={(v) =>
                      setDraft((d) => ({
                        ...d,
                        activacionV2: (v ?? "OBLIGATORIO") as DraftForm["activacionV2"],
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {draft.activacionV2 === "OBLIGATORIO" && "Obligatorio"}
                        {draft.activacionV2 === "OPCIONAL" && "Opcional"}
                        {draft.activacionV2 === "CONDICIONAL" && "Condicional"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OBLIGATORIO">Obligatorio</SelectItem>
                      <SelectItem value="OPCIONAL">Opcional</SelectItem>
                      <SelectItem value="CONDICIONAL">Condicional</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    <strong>Opcional</strong> sólo se ejecuta si el cliente lo
                    marca. <strong>Condicional</strong> se ejecuta automáticamente
                    cuando la condición de abajo es verdadera.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label>Familia del paso</Label>
                  <Select
                    value={draft.familiaV2 || NONE}
                    onValueChange={(v) =>
                      setDraft((d) => ({ ...d, familiaV2: v === NONE ? "" : (v ?? "") }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {draft.familiaV2
                          ? FAMILIAS_V2.find((f) => f.codigo === draft.familiaV2)?.label ??
                            draft.familiaV2
                          : "— sin familia —"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>— sin familia —</SelectItem>
                      {FAMILIAS_V2.map((f) => (
                        <SelectItem key={f.codigo} value={f.codigo}>
                          {f.label}{" "}
                          <span className="text-xs text-muted-foreground">({f.codigo})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {draft.activacionV2 === "CONDICIONAL" && (
                <div className="grid gap-2">
                  <Label>Condición de activación</Label>
                  <p className="text-xs text-muted-foreground">
                    El paso se ejecuta automáticamente cuando todas (o
                    cualquiera, según elijas) las condiciones se cumplen al
                    cotizar.
                  </p>
                  <CondicionBuilder
                    value={draft.condicionV2}
                    onChange={(expr) =>
                      setDraft((d) => ({ ...d, condicionV2: expr }))
                    }
                  />
                </div>
              )}

              <div className="grid gap-2">
                <Label>Unidad productiva</Label>
                <Select
                  value={draft.unidadProductivaV2 || NONE}
                  onValueChange={(v) =>
                    setDraft((d) => ({
                      ...d,
                      unidadProductivaV2: v === NONE ? "" : v ?? "",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue>
                      {draft.unidadProductivaV2 || "— derivar de la familia —"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>— derivar de la familia —</SelectItem>
                    <SelectItem value="hojas">hojas</SelectItem>
                    <SelectItem value="pliegos">pliegos</SelectItem>
                    <SelectItem value="placas">placas</SelectItem>
                    <SelectItem value="piezas">piezas</SelectItem>
                    <SelectItem value="m2">m²</SelectItem>
                    <SelectItem value="metros_lineales">metros lineales</SelectItem>
                    <SelectItem value="letras">letras</SelectItem>
                    <SelectItem value="modulos">módulos</SelectItem>
                    <SelectItem value="unidades">unidades</SelectItem>
                    <SelectItem value="corridas">corridas</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Sobre qué cantidad opera el paso. Si dejás "derivar de la familia",
                  el motor la infiere de familiaV2 (ej: impresion_por_hoja → pliegos).
                </p>
              </div>

              <div className="grid gap-2">
                <Label>Centro de costo</Label>
                <Select
                  value={draft.centroCostoId}
                  onValueChange={(v) =>
                    setDraft((d) => ({ ...d, centroCostoId: v ?? "" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccioná un centro de costo">
                      {centros.find((c) => c.id === draft.centroCostoId)?.nombre ??
                        "Seleccioná un centro de costo"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {centros.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Máquina (opcional)</Label>
                  <Select
                    value={draft.maquinaId}
                    onValueChange={(v) =>
                      setDraft((d) => ({
                        ...d,
                        maquinaId: v ?? NONE,
                        perfilOperativoId: NONE,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {draft.maquinaId === NONE
                          ? "— sin máquina —"
                          : maquinaElegida?.nombre ?? "—"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>— sin máquina —</SelectItem>
                      {maquinas.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Perfil operativo (opcional)</Label>
                  <Select
                    value={draft.perfilOperativoId}
                    onValueChange={(v) =>
                      setDraft((d) => ({ ...d, perfilOperativoId: v ?? NONE }))
                    }
                    disabled={draft.maquinaId === NONE}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {draft.perfilOperativoId === NONE
                          ? "— sin perfil —"
                          : perfilesDisponibles.find((p) => p.id === draft.perfilOperativoId)
                              ?.nombre ?? "—"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>— sin perfil —</SelectItem>
                      {perfilesDisponibles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div className="grid gap-2">
                  <Label>Setup (min)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.1"
                    value={draft.setupMin}
                    onChange={(e) => setDraft((d) => ({ ...d, setupMin: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Cleanup (min)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.1"
                    value={draft.cleanupMin}
                    onChange={(e) => setDraft((d) => ({ ...d, cleanupMin: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Fijo (min)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.1"
                    value={draft.tiempoFijoMin}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, tiempoFijoMin: e.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Productividad</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft.productividadBase}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, productividadBase: e.target.value }))
                    }
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Productividad en la <strong>unidad productiva</strong> por hora. Si el perfil
                operativo tiene su propio valor, el motor lo prioriza sobre este.
              </p>

              <NestingSection
                familia={draft.familiaV2}
                config={draft.configNestingV2}
                onChange={(next) =>
                  setDraft((d) => ({ ...d, configNestingV2: next }))
                }
                maquina={maquinaElegida}
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  disabled={isSaving}
                >
                  Cancelar
                </Button>
                <Button size="sm" onClick={save} disabled={isSaving}>
                  {isSaving ? <GdiSpinner className="size-4" /> : "Guardar"}
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ──────────────── Sección Nesting ────────────────

function NestingSection({
  familia,
  config,
  onChange,
  maquina,
}: {
  familia: string;
  config: Record<string, unknown> | null;
  onChange: (next: Record<string, unknown> | null) => void;
  maquina: Maquina | null;
}) {
  const algoritmo = (() => {
    switch (familia) {
      case "impresion_por_hoja":
        return { code: "nesting-hoja", label: "Nesting por hoja (pliegos)" };
      case "impresion_por_area":
        return { code: "nesting-rollo", label: "Nesting por área (rollo)" };
      case "impresion_por_pieza":
        return {
          code: "nesting-placa-rigida",
          label: "Nesting por pieza (placa rígida)",
        };
      default:
        return null;
    }
  })();

  return (
    <div className="rounded-md border bg-muted/30 p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <Label className="text-sm">Nesting</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Configura cómo el motor distribuye las piezas en el material para
            este paso.
          </p>
        </div>
        {algoritmo && (
          <span className="rounded-sm border border-input px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
            {algoritmo.code}
          </span>
        )}
      </div>

      {!algoritmo ? (
        <div className="rounded border border-dashed border-input bg-background px-3 py-2.5 text-xs text-muted-foreground">
          {familia ? (
            <>
              La familia <code className="font-mono">{familia}</code> no produce
              nesting. Solo las familias{" "}
              <code className="font-mono">impresion_por_hoja</code>,{" "}
              <code className="font-mono">impresion_por_area</code> y{" "}
              <code className="font-mono">impresion_por_pieza</code> ejecutan
              algoritmo. Este paso consume el layout del paso anterior, o no
              participa.
            </>
          ) : (
            <>
              Asigná una familia arriba para configurar el nesting. Solo las 3
              familias <code className="font-mono">impresion_por_*</code> lo
              soportan.
            </>
          )}
        </div>
      ) : familia === "impresion_por_hoja" ? (
        <NestingHojaForm config={config} onChange={onChange} />
      ) : familia === "impresion_por_area" ? (
        <NestingRolloForm
          config={config}
          onChange={onChange}
          maquina={maquina}
        />
      ) : (
        <NestingPlacaForm config={config} onChange={onChange} />
      )}
    </div>
  );
}

function NestingHojaForm({
  config,
  onChange,
}: {
  config: Record<string, unknown> | null;
  onChange: (next: Record<string, unknown> | null) => void;
}) {
  const pliegos = getCfgArray<PliegoCandidato>(config, "pliegos");
  const criterio = (getCfgString(config, "criterio") || "menor_cantidad_pliegos") as CriterioHoja;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <NumberField
          label="Margen (cm)"
          value={mmToCmStr(parseOptionalNumber(getCfgNumber(config, "margenMm")))}
          placeholder="0"
          onChange={(s) =>
            onChange(setCfgKey(config, "margenMm", cmInputToMm(s)))
          }
        />
        <NumberField
          label="Sep. horizontal (cm)"
          value={mmToCmStr(parseOptionalNumber(getCfgNumber(config, "separacionHMm")))}
          placeholder="0"
          onChange={(s) =>
            onChange(setCfgKey(config, "separacionHMm", cmInputToMm(s)))
          }
        />
        <NumberField
          label="Sep. vertical (cm)"
          value={mmToCmStr(parseOptionalNumber(getCfgNumber(config, "separacionVMm")))}
          placeholder="0"
          onChange={(s) =>
            onChange(setCfgKey(config, "separacionVMm", cmInputToMm(s)))
          }
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label className="text-xs">Criterio de selección</Label>
          <Select
            value={criterio}
            onValueChange={(v) => {
              if (!v) return;
              onChange(setCfgKey(config, "criterio", v));
            }}
          >
            <SelectTrigger>
              <SelectValue>
                {criterio === "menor_cantidad_pliegos" && "Menor cantidad de pliegos"}
                {criterio === "mayor_aprovechamiento" && "Mayor aprovechamiento"}
                {criterio === "mayor_piezas_por_pliego" && "Más piezas por pliego"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="menor_cantidad_pliegos">
                Menor cantidad de pliegos
              </SelectItem>
              <SelectItem value="mayor_aprovechamiento">
                Mayor aprovechamiento
              </SelectItem>
              <SelectItem value="mayor_piezas_por_pliego">
                Más piezas por pliego
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between gap-2 pt-6">
          <Label htmlFor="hoja-rotacion" className="text-xs">
            Permitir rotación 90° de piezas
          </Label>
          <Switch
            id="hoja-rotacion"
            checked={getCfgBool(config, "permitirRotacion", true)}
            onCheckedChange={(v) =>
              onChange(setCfgKey(config, "permitirRotacion", v))
            }
          />
        </div>
      </div>

      <PliegosListEditor
        pliegos={pliegos}
        onChange={(next) =>
          onChange(setCfgKey(config, "pliegos", next.length === 0 ? undefined : next))
        }
      />
    </div>
  );
}

function NestingRolloForm({
  config,
  onChange,
  maquina,
}: {
  config: Record<string, unknown> | null;
  onChange: (next: Record<string, unknown> | null) => void;
  maquina: Maquina | null;
}) {
  // Defaults visibles desde la máquina (solo placeholder, no se guardan).
  // Las plantillas de máquina guardan en CENTÍMETROS — el form también muestra
  // cm. Internamente la config se guarda en mm para no romper el motor.
  const params = (maquina?.parametrosTecnicos ?? null) as Record<
    string,
    unknown
  > | null;
  // Todos los campos dimensionales en `parametrosTecnicos` se guardan en cm
  // (ver `maquinaria-templates.ts`, `unit: "cm"`). Hay 2 convenciones de
  // naming según el tipo de máquina; aceptamos ambas como cm raw.
  const cmRaw = (v: unknown): number | null => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const anchoTotalCm =
    cmRaw(params?.anchoImprimibleMaximo) ??
    cmRaw(params?.anchoBoca) ??
    cmRaw(params?.anchoCama) ??
    cmRaw(params?.anchoMaxHoja);
  const margenIzqCm =
    cmRaw(params?.margenLateralIzquierdoNoImprimible) ??
    cmRaw(params?.margenIzquierdo);
  const margenDerCm =
    cmRaw(params?.margenLateralDerechoNoImprimible) ??
    cmRaw(params?.margenDerecho);
  const margenInicioCm =
    cmRaw(params?.margenInicioNoImprimible) ?? cmRaw(params?.margenSuperior);
  const margenFinCm =
    cmRaw(params?.margenFinalNoImprimible) ?? cmRaw(params?.margenInferior);

  // El ancho imprimible es el ancho total menos los márgenes laterales.
  const anchoImprimibleCm =
    anchoTotalCm != null
      ? Math.max(
          0,
          anchoTotalCm - (margenIzqCm ?? 0) - (margenDerCm ?? 0),
        )
      : null;

  const fmt = (n: number | null): string =>
    n != null ? `auto: ${Number(n.toFixed(4))}` : "auto";
  const phPrintable = fmt(anchoImprimibleCm);
  const phMargenIzq = fmt(margenIzqCm);
  const phMargenDer = fmt(margenDerCm);
  const phMargenSup = fmt(margenInicioCm);
  const phMargenInf = fmt(margenFinCm);

  const panelizado = getCfgObject(config, "panelizado");
  const panelizadoActivo =
    typeof panelizado.activo === "boolean" ? panelizado.activo : false;

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs text-muted-foreground">
          Las dimensiones imprimibles y márgenes se toman de la máquina si los
          dejás vacíos. Cargá un valor para overridearlos solo en este paso. Si
          overrideás los márgenes laterales, el motor recalcula el ancho
          imprimible como{" "}
          <code className="font-mono">
            ancho total − margen izquierdo − margen derecho
          </code>
          .
        </p>
        <div className="mb-3">
          <NumberField
            label="Ancho imprimible (cm)"
            value={mmToCmStr(parseOptionalNumber(getCfgNumber(config, "printableWidthMm")))}
            placeholder={phPrintable}
            onChange={(s) =>
              onChange(setCfgKey(config, "printableWidthMm", cmInputToMm(s)))
            }
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField
            label="Margen izquierdo (cm)"
            value={mmToCmStr(parseOptionalNumber(getCfgNumber(config, "marginLeftMm")))}
            placeholder={phMargenIzq}
            onChange={(s) =>
              onChange(setCfgKey(config, "marginLeftMm", cmInputToMm(s)))
            }
          />
          <NumberField
            label="Margen derecho (cm)"
            value={mmToCmStr(parseOptionalNumber(getCfgNumber(config, "marginRightMm")))}
            placeholder={phMargenDer}
            onChange={(s) =>
              onChange(setCfgKey(config, "marginRightMm", cmInputToMm(s)))
            }
          />
          <NumberField
            label="Margen inicio (cm)"
            value={mmToCmStr(parseOptionalNumber(getCfgNumber(config, "marginStartMm")))}
            placeholder={phMargenSup}
            onChange={(s) =>
              onChange(setCfgKey(config, "marginStartMm", cmInputToMm(s)))
            }
          />
          <NumberField
            label="Margen fin (cm)"
            value={mmToCmStr(parseOptionalNumber(getCfgNumber(config, "marginEndMm")))}
            placeholder={phMargenInf}
            onChange={(s) =>
              onChange(setCfgKey(config, "marginEndMm", cmInputToMm(s)))
            }
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <NumberField
          label="Sep. horizontal (cm)"
          value={mmToCmStr(parseOptionalNumber(getCfgNumber(config, "separacionHorizontalMm")))}
          placeholder="0"
          onChange={(s) =>
            onChange(setCfgKey(config, "separacionHorizontalMm", cmInputToMm(s)))
          }
        />
        <NumberField
          label="Sep. vertical (cm)"
          value={mmToCmStr(parseOptionalNumber(getCfgNumber(config, "separacionVerticalMm")))}
          placeholder="0"
          onChange={(s) =>
            onChange(setCfgKey(config, "separacionVerticalMm", cmInputToMm(s)))
          }
        />
        <div className="flex items-center justify-between gap-2 pt-6">
          <Label htmlFor="rollo-rotacion" className="text-xs">
            Permitir rotación
          </Label>
          <Switch
            id="rollo-rotacion"
            checked={getCfgBool(config, "permitirRotacion", true)}
            onCheckedChange={(v) =>
              onChange(setCfgKey(config, "permitirRotacion", v))
            }
          />
        </div>
      </div>

      {/* SM.1.d — Criterio para elegir variante ganadora cuando el paso
          tiene un material con esSustratoNesting=true. */}
      <div className="grid gap-2">
        <Label className="text-xs">Criterio para elegir variante</Label>
        <Select
          value={(getCfgString(config, "criterioSeleccionMaterial") ||
            "mayor_aprovechamiento") as string}
          onValueChange={(v) => {
            if (!v) return;
            onChange(
              setCfgKey(
                config,
                "criterioSeleccionMaterial",
                v === "mayor_aprovechamiento" ? undefined : v,
              ),
            );
          }}
        >
          <SelectTrigger>
            <SelectValue>
              {(() => {
                const c = getCfgString(config, "criterioSeleccionMaterial") ||
                  "mayor_aprovechamiento";
                if (c === "menor_costo_total") return "Menor costo total";
                if (c === "menor_largo_consumido") return "Menor largo consumido";
                return "Mayor aprovechamiento";
              })()}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mayor_aprovechamiento">
              Mayor aprovechamiento
            </SelectItem>
            <SelectItem value="menor_largo_consumido">
              Menor largo consumido
            </SelectItem>
            <SelectItem value="menor_costo_total">Menor costo total</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">
          Aplica cuando el paso tiene un material declarado como{" "}
          <strong>sustrato del nesting</strong> con varias variantes habilitadas
          (ej: rollo de 1060mm vs 1370mm). Si no hay sustrato, este criterio se ignora.
          <br />
          <em>Menor costo</em> requiere que las variantes tengan precio referencia y largo
          de rollo cargados.
        </p>
      </div>

      <div className="rounded border border-input bg-background p-3">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <Label className="text-xs">Panelizado</Label>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Para piezas más anchas que el material — divide la pieza en
              paneles que se imprimen por separado.
            </p>
          </div>
          <Switch
            id="rollo-panelizado-activo"
            checked={panelizadoActivo}
            onCheckedChange={(v) =>
              onChange(setPanelizadoKey(config, "activo", v ? true : undefined))
            }
          />
        </div>
        {panelizadoActivo && (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label className="text-xs">Modo</Label>
              <Select
                value={getCfgString(panelizado, "mode") || "auto"}
                onValueChange={(v) => {
                  if (!v) return;
                  onChange(
                    setPanelizadoKey(config, "mode", v === "auto" ? undefined : v),
                  );
                }}
              >
                <SelectTrigger>
                  <SelectValue>
                    {getCfgString(panelizado, "mode") || "auto"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">auto</SelectItem>
                  <SelectItem value="igual_ancho">igual ancho</SelectItem>
                  <SelectItem value="manual">manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <NumberField
              label="Overlap (cm)"
              value={mmToCmStr(parseOptionalNumber(getCfgNumber(panelizado, "overlapMm")))}
              placeholder="0"
              onChange={(s) =>
                onChange(
                  setPanelizadoKey(
                    config,
                    "overlapMm",
                    cmInputToMm(s),
                  ),
                )
              }
            />
            <NumberField
              label="Ancho máx panel (cm)"
              value={mmToCmStr(parseOptionalNumber(getCfgNumber(panelizado, "maxPanelWidthMm")))}
              placeholder="auto"
              onChange={(s) =>
                onChange(
                  setPanelizadoKey(
                    config,
                    "maxPanelWidthMm",
                    cmInputToMm(s),
                  ),
                )
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}

function NestingPlacaForm({
  config,
  onChange,
}: {
  config: Record<string, unknown> | null;
  onChange: (next: Record<string, unknown> | null) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField
          label="Placa ancho (cm)"
          value={mmToCmStr(parseOptionalNumber(getCfgNumber(config, "placaAnchoMm")))}
          placeholder="ej: 122"
          onChange={(s) =>
            onChange(setCfgKey(config, "placaAnchoMm", cmInputToMm(s)))
          }
        />
        <NumberField
          label="Placa alto (cm)"
          value={mmToCmStr(parseOptionalNumber(getCfgNumber(config, "placaAltoMm")))}
          placeholder="ej: 244"
          onChange={(s) =>
            onChange(setCfgKey(config, "placaAltoMm", cmInputToMm(s)))
          }
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <NumberField
          label="Margen (cm)"
          value={mmToCmStr(parseOptionalNumber(getCfgNumber(config, "margenMm")))}
          placeholder="0"
          onChange={(s) =>
            onChange(setCfgKey(config, "margenMm", cmInputToMm(s)))
          }
        />
        <NumberField
          label="Sep. horizontal (cm)"
          value={mmToCmStr(parseOptionalNumber(getCfgNumber(config, "separacionHMm")))}
          placeholder="0"
          onChange={(s) =>
            onChange(setCfgKey(config, "separacionHMm", cmInputToMm(s)))
          }
        />
        <NumberField
          label="Sep. vertical (cm)"
          value={mmToCmStr(parseOptionalNumber(getCfgNumber(config, "separacionVMm")))}
          placeholder="0"
          onChange={(s) =>
            onChange(setCfgKey(config, "separacionVMm", cmInputToMm(s)))
          }
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="placa-rotacion" className="text-xs">
          Permitir rotación 90° de piezas
        </Label>
        <Switch
          id="placa-rotacion"
          checked={getCfgBool(config, "permitirRotacion", true)}
          onCheckedChange={(v) =>
            onChange(setCfgKey(config, "permitirRotacion", v))
          }
        />
      </div>
      <div className="rounded border border-dashed border-input bg-background p-3 text-xs text-muted-foreground">
        ⚠️ <strong>Pricing escalonado / m² / largo consumido</strong> — los
        modos de cálculo de costo de placas rígidas (heredados del motor
        anterior) todavía no están disponibles. Próxima fase.
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (s: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        min={0}
        step="0.1"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function PliegosListEditor({
  pliegos,
  onChange,
}: {
  pliegos: PliegoCandidato[];
  onChange: (next: PliegoCandidato[]) => void;
}) {
  const updateAt = (idx: number, patch: Partial<PliegoCandidato>) => {
    const next = pliegos.slice();
    next[idx] = { ...next[idx], ...patch } as PliegoCandidato;
    onChange(next);
  };
  const removeAt = (idx: number) => {
    onChange(pliegos.filter((_, i) => i !== idx));
  };
  const addRow = () => {
    onChange([...pliegos, { anchoMm: 0, altoMm: 0 }]);
  };

  return (
    <div className="rounded border border-input bg-background p-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <Label className="text-xs">Pliegos candidatos</Label>
          <p className="mt-1 text-[11px] text-muted-foreground">
            El motor evalúa cada pliego y elige el mejor según el criterio.
            Vacío = sin restricción de pliego (usa default del motor).
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          + Agregar pliego
        </Button>
      </div>
      {pliegos.length === 0 ? (
        <p className="py-2 text-center text-xs text-muted-foreground">
          Sin pliegos candidatos.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {pliegos.map((p, idx) => (
            <div
              key={idx}
              className="grid grid-cols-[1fr_1.4fr_0.7fr_0.7fr_28px] items-center gap-2"
            >
              <Input
                value={p.codigo ?? ""}
                placeholder="código"
                onChange={(e) =>
                  updateAt(idx, { codigo: e.target.value || undefined })
                }
                className="text-xs"
              />
              <Input
                value={p.nombre ?? ""}
                placeholder="nombre"
                onChange={(e) =>
                  updateAt(idx, { nombre: e.target.value || undefined })
                }
                className="text-xs"
              />
              <Input
                type="number"
                value={p.anchoMm ? String(Number((p.anchoMm / 10).toFixed(4))) : ""}
                placeholder="ancho cm"
                step="0.1"
                onChange={(e) =>
                  updateAt(idx, {
                    anchoMm: Number((Number(e.target.value) * 10).toFixed(4)) || 0,
                  })
                }
                className="text-xs"
              />
              <Input
                type="number"
                value={p.altoMm ? String(Number((p.altoMm / 10).toFixed(4))) : ""}
                placeholder="alto cm"
                step="0.1"
                onChange={(e) =>
                  updateAt(idx, {
                    altoMm: Number((Number(e.target.value) * 10).toFixed(4)) || 0,
                  })
                }
                className="text-xs"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="size-7 p-0"
                onClick={() => removeAt(idx)}
                title="Quitar"
              >
                ×
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
