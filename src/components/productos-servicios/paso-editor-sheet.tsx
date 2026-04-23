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
  getProcesoOperacionPlantillas,
  updateProcesoOperacion,
  type UpdateProcesoOperacionPayload,
} from "@/lib/procesos-api";
import type { ProcesoOperacionPlantilla } from "@/lib/procesos";
import type { RutaCompletaOperacion } from "@/lib/productos-servicios-api";
import { CondicionBuilder } from "@/components/productos-servicios/condicion-builder";
import {
  describeNestingConfig,
  FAMILIAS_PRODUCEN_NESTING,
  NestingEditorSheet,
} from "@/components/productos-servicios/nesting-editor-sheet";

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
  // Fase D.2 — unidad de tiempo de la productividad (HORA / MINUTO / SEGUNDO).
  // El motor convierte a minutos internamente.
  unidadTiempo: string;
  // null = sin condición declarada. Solo relevante cuando activacionV2=CONDICIONAL.
  condicionV2: Record<string, unknown> | null;
  // Config completa actual del paso. Mantengo el objeto entero para no
  // perder campos avanzados que la UI no expone (ej. panelizado.distribution).
  configNestingV2: Record<string, unknown> | null;
};

// ──────────────── Componentes de layout ────────────────

/**
 * R1 — Helper visual para agrupar campos del editor en secciones nombradas.
 *
 * El editor de paso aporta a 3 buckets de cotización (centro de costo,
 * materiales, cargos flat). Esta sección aplica un encabezado consistente
 * con un color/tono por bucket para que el usuario vea de un vistazo a
 * qué bucket impacta cada bloque del paso.
 *
 * Tonos disponibles (alineados con el simulador de costo):
 *   - "neutral"   → identidad del paso (lo que define qué hace)
 *   - "tiempo"    → 🟦 Centro de costo (lo que define cuánto trabajo cuesta)
 *   - "material"  → 🟩 Materiales (lo que el paso consume)
 *   - "flat"      → 🟧 Cargos flat (lo que se cobra fijo)
 *   - "config"    → ⚙ Configuración avanzada (nesting, condiciones)
 */
/**
 * R6 — Campo read-only para mostrar valores heredados de plantilla.
 * Visualmente parece un input deshabilitado pero más liviano (sin borde
 * marcado, sin altura de Input). Usado en la sección "Identidad" cuando
 * el paso tiene plantilla origen.
 */
function ReadOnlyField({
  label,
  value,
  warn = false,
  warnTitle,
}: {
  label: string;
  value: string;
  warn?: boolean;
  warnTitle?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
        {label}
      </Label>
      <div
        className={
          warn
            ? "rounded border border-amber-500/40 bg-amber-500/5 px-2.5 py-1.5 text-[13px] text-amber-300"
            : "rounded border border-line bg-bg-2 px-2.5 py-1.5 text-[13px] text-ink-1"
        }
        title={warn ? warnTitle : undefined}
      >
        {warn && "⚠ "}
        {value}
      </div>
    </div>
  );
}

function BucketSection({
  tone,
  title,
  subtitle,
  hint,
  children,
}: {
  tone: "neutral" | "tiempo" | "material" | "flat" | "config";
  title: string;
  subtitle?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  // Tono del chip izquierdo. El borde y fondo de la card son siempre los
  // mismos para no romper la jerarquía visual del sheet.
  const chipClass = {
    neutral: "bg-bg-3 text-ink-2",
    tiempo: "bg-[color-mix(in_oklch,var(--lime)_18%,var(--bg))] text-ink-0",
    material: "bg-[color-mix(in_oklch,#7AC74F_22%,var(--bg))] text-ink-0",
    flat: "bg-[color-mix(in_oklch,#E4A93C_22%,var(--bg))] text-ink-0",
    config: "bg-bg-3 text-ink-2",
  }[tone];

  return (
    <section className="overflow-hidden rounded-[8px] border border-line bg-bg-1">
      <header className="flex items-baseline justify-between gap-3 border-b border-line bg-bg-2 px-4 py-2.5">
        <div className="flex items-baseline gap-2.5">
          <span
            className={`inline-block rounded-[3px] px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.16em] ${chipClass}`}
          >
            {tone === "tiempo"
              ? "Centro de costo"
              : tone === "material"
                ? "Materiales"
                : tone === "flat"
                  ? "Cargos flat"
                  : tone === "config"
                    ? "Configuración"
                    : "Paso"}
          </span>
          <span className="text-[13px] text-ink-0">{title}</span>
        </div>
        {subtitle && (
          <span className="font-mono text-[10px] text-ink-3">{subtitle}</span>
        )}
      </header>
      <div className="space-y-4 px-4 py-4">{children}</div>
      {hint && (
        <div className="border-t border-line bg-bg px-4 py-2 text-[11px] text-ink-3">
          {hint}
        </div>
      )}
    </section>
  );
}

function toDraft(op: RutaCompletaOperacion): DraftForm {
  // R6 — los campos de identidad usan el valor efectivo (paso → plantilla).
  // Cuando el paso tiene plantilla origen, los Selects no se muestran (son
  // read-only) pero el draft igual lleva el valor para que `save()` y la
  // lógica de "configNestingV2 solo si familia produce nesting" funcionen.
  const familiaV2Eff = op.familiaV2 ?? op.plantillaOrigen?.familiaV2 ?? "";
  const unidadProductivaV2Eff =
    op.unidadProductivaV2 ?? op.plantillaOrigen?.unidadProductivaV2 ?? "";
  const centroCostoIdEff =
    op.centroCosto?.id ?? op.plantillaOrigen?.centroCosto?.id ?? "";
  const maquinaIdEff =
    op.maquina?.id ?? op.plantillaOrigen?.maquina?.id ?? NONE;
  const perfilOperativoIdEff =
    op.perfilOperativo?.id ?? op.plantillaOrigen?.perfilOperativo?.id ?? NONE;
  return {
    nombre: op.nombre,
    esOpcional: op.esOpcional,
    activacionV2:
      (op.activacionV2 as DraftForm["activacionV2"]) ??
      (op.esOpcional ? "OPCIONAL" : "OBLIGATORIO"),
    familiaV2: familiaV2Eff,
    unidadProductivaV2: unidadProductivaV2Eff,
    centroCostoId: centroCostoIdEff,
    maquinaId: maquinaIdEff,
    perfilOperativoId: perfilOperativoIdEff,
    setupMin: op.setupMin != null ? String(op.setupMin) : "",
    cleanupMin: op.cleanupMin != null ? String(op.cleanupMin) : "",
    tiempoFijoMin: op.tiempoFijoMin != null ? String(op.tiempoFijoMin) : "",
    productividadBase:
      op.productividadBase != null ? String(op.productividadBase) : "",
    unidadTiempo: (op.unidadTiempo ?? "MINUTO").toUpperCase(),
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
// Helpers de conversión cm↔mm + manipulación de configNestingV2 viven en
// `nesting-editor-sheet.tsx` (R2). Si se necesitan acá en el futuro,
// importarlos desde allí en lugar de re-declararlos.

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
  // Fase C.7 — biblioteca de plantillas para asociar/desasociar plantilla origen.
  const [plantillas, setPlantillas] = React.useState<ProcesoOperacionPlantilla[]>(
    [],
  );
  // Fase C.7 — `plantillaOrigenId` no vive en el draft porque el backend no
  // devuelve un id (devuelve el objeto `plantillaOrigen` con datos para
  // mostrar). Mantenemos un ref del id seleccionado por el usuario.
  const [plantillaOrigenIdSel, setPlantillaOrigenIdSel] = React.useState<
    string | null | undefined
  >(undefined);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  // R2 — sheet anidado para configuración de nesting.
  const [nestingSheetOpen, setNestingSheetOpen] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setDraft(toDraft(operacion));
      setPlantillaOrigenIdSel(undefined);
      setIsLoading(true);
      Promise.all([getCentrosCosto(), getMaquinas(), getProcesoOperacionPlantillas()])
        .then(([cc, maqs, plts]) => {
          setCentros(cc.filter((c) => c.activo));
          setMaquinas(maqs.filter((m) => m.activo));
          setPlantillas(plts);
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
    // R6 — la identidad (nombre, familia, centro, máquina, perfil,
    // unidad productiva) vive en plantilla cuando hay vínculo. En modo
    // legacy (sin plantilla) se siguen exigiendo campos locales mínimos.
    const hasPlantilla = Boolean(operacion.plantillaOrigen);
    if (!hasPlantilla) {
      if (draft.nombre.trim().length === 0) {
        toast.error("El nombre del paso es obligatorio (modo legacy).");
        return;
      }
      if (!draft.centroCostoId) {
        toast.error(
          "El centro de costo es obligatorio en modo legacy. Asociá una plantilla para heredarlo.",
        );
        return;
      }
    }

    const payload: UpdateProcesoOperacionPayload = {
      esOpcional: draft.activacionV2 === "OPCIONAL",
      activacionV2: draft.activacionV2,
    };
    // R6 — solo enviamos campos de identidad cuando NO hay plantilla.
    // Cuando hay plantilla, esos campos se heredan en runtime.
    if (!hasPlantilla) {
      payload.nombre = draft.nombre.trim();
      payload.familiaV2 = draft.familiaV2.trim();
      payload.unidadProductivaV2 = draft.unidadProductivaV2.trim();
      payload.centroCostoId = draft.centroCostoId;
      payload.maquinaId = draft.maquinaId === NONE ? null : draft.maquinaId;
      payload.perfilOperativoId =
        draft.maquinaId === NONE || draft.perfilOperativoId === NONE
          ? null
          : draft.perfilOperativoId;
    }
    // Fase C — semántica de campos vacíos según herencia:
    //  - Si el usuario tipea un número → override local (manda número).
    //  - Si vacía un campo Y hay plantilla origen → limpiar override y
    //    heredar el valor de la plantilla (manda null).
    //  - Si vacía un campo Y NO hay plantilla → no tocar (undefined).
    const inheritOrUndefined = hasPlantilla ? null : undefined;
    const setupMin = parseOptionalNumber(draft.setupMin);
    payload.setupMin = setupMin !== undefined ? setupMin : inheritOrUndefined;
    const cleanupMin = parseOptionalNumber(draft.cleanupMin);
    payload.cleanupMin = cleanupMin !== undefined ? cleanupMin : inheritOrUndefined;
    const tiempoFijoMin = parseOptionalNumber(draft.tiempoFijoMin);
    payload.tiempoFijoMin =
      tiempoFijoMin !== undefined ? tiempoFijoMin : inheritOrUndefined;
    const productividadBase = parseOptionalNumber(draft.productividadBase);
    payload.productividadBase =
      productividadBase !== undefined ? productividadBase : inheritOrUndefined;
    // Fase D.2 — unidad de tiempo de la productividad.
    if (
      draft.unidadTiempo === "HORA" ||
      draft.unidadTiempo === "MINUTO" ||
      draft.unidadTiempo === "SEGUNDO"
    ) {
      payload.unidadTiempo = draft.unidadTiempo;
    }
    // Fase C.7 — vínculo a la plantilla origen. Solo si el usuario cambió
    // el selector (plantillaOrigenIdSel !== undefined). null = desvincular,
    // string = vincular.
    if (plantillaOrigenIdSel !== undefined) {
      payload.plantillaOrigenId = plantillaOrigenIdSel;
    }

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
          <SheetTitle>
            Editar paso "
            {operacion.plantillaOrigen?.nombre ?? operacion.nombre}"
          </SheetTitle>
          <SheetDescription>
            {operacion.plantillaOrigen
              ? "La identidad del paso (nombre, familia, centro de costo, máquina) viene de la plantilla. Acá se ajustan activación, tiempos y nesting para este producto."
              : "Modo legacy — sin plantilla origen. Asocialo a una plantilla para heredar la identidad."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4 px-6 pb-6">
          {isLoading ? (
            <div className="flex justify-center p-6">
              <GdiSpinner className="size-6" />
            </div>
          ) : (
            <>
              {/* ───────────── R6 — Identidad: heredada de la biblioteca ─────────────
                  Cuando el paso tiene plantilla origen, la identidad
                  (nombre, familia, unidad productiva, centro de costo,
                  máquina, perfil) se muestra como read-only. Para
                  cambiarlos, ir a la biblioteca de pasos.

                  Cuando no hay plantilla origen (paso legacy), mostramos
                  un banner fuerte + selector de plantilla. Mientras no se
                  asocie, el editor entra en modo "legacy" con todos los
                  campos editables al final del sheet. */}
              {operacion.plantillaOrigen ? (
                <BucketSection
                  tone="neutral"
                  title="Identidad"
                  subtitle="heredada de plantilla"
                  hint={
                    <span>
                      La identidad de este paso vive en la{" "}
                      <strong>biblioteca de pasos</strong>. Para cambiar el
                      nombre, familia, centro de costo o máquina, editá la
                      plantilla "{operacion.plantillaOrigen.nombre}".
                    </span>
                  }
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ReadOnlyField
                      label="Nombre"
                      value={operacion.plantillaOrigen.nombre}
                    />
                    <ReadOnlyField
                      label="Familia del paso"
                      value={
                        operacion.plantillaOrigen.familiaV2
                          ? FAMILIAS_V2.find(
                              (f) => f.codigo === operacion.plantillaOrigen!.familiaV2,
                            )?.label ?? operacion.plantillaOrigen.familiaV2
                          : "—"
                      }
                    />
                    <ReadOnlyField
                      label="Unidad productiva"
                      value={
                        operacion.plantillaOrigen.unidadProductivaV2 ||
                        "derivar de la familia"
                      }
                    />
                    <ReadOnlyField
                      label="Centro de costo"
                      value={operacion.plantillaOrigen.centroCosto?.nombre ?? "—"}
                      warn={!operacion.plantillaOrigen.centroCosto}
                      warnTitle="La plantilla no tiene centro de costo: este paso cotizará $0."
                    />
                    <ReadOnlyField
                      label="Máquina"
                      value={operacion.plantillaOrigen.maquina?.nombre ?? "sin máquina"}
                    />
                    <ReadOnlyField
                      label="Perfil operativo"
                      value={
                        operacion.plantillaOrigen.perfilOperativo?.nombre ??
                        "sin perfil"
                      }
                    />
                    <ReadOnlyField
                      label="Modo productividad"
                      value={(() => {
                        const m = operacion.plantillaOrigen.modoProductividad;
                        if (m === "TIEMPO_FIJO") {
                          const min = operacion.plantillaOrigen.tiempoFijoMin;
                          return `Tiempo fijo · ${min ?? "?"} min`;
                        }
                        if (m === "FORMULA") return "Fórmula avanzada";
                        // FIJA — productividad numérica con unidad compuesta.
                        const valor = operacion.plantillaOrigen.productividadBase;
                        const unidadTiempo = operacion.plantillaOrigen.unidadTiempo;
                        const unidadProd =
                          operacion.plantillaOrigen.unidadProductivaV2;
                        const tiempoLabel =
                          unidadTiempo === "HORA"
                            ? "h"
                            : unidadTiempo === "SEGUNDO"
                              ? "seg"
                              : "min";
                        if (valor != null && unidadProd) {
                          return `${valor} ${unidadProd}/${tiempoLabel}`;
                        }
                        if (valor != null) {
                          return `${valor} /${tiempoLabel}`;
                        }
                        return "Productividad (sin valor)";
                      })()}
                    />
                  </div>
                </BucketSection>
              ) : (
                <BucketSection
                  tone="neutral"
                  title="Paso sin plantilla"
                  subtitle="modo legacy"
                  hint={
                    <span>
                      Este paso no está vinculado a una plantilla de
                      biblioteca. Asocialo para que su identidad (nombre,
                      familia, centro de costo, máquina) se herede en lugar
                      de duplicarse acá. Mientras tanto, los campos
                      siguientes son editables localmente (modo legacy).
                    </span>
                  }
                >
                  <div className="rounded border border-amber-500/40 bg-amber-500/5 px-3 py-2.5 text-[12px] text-ink-2">
                    ⚠ <strong>Sin plantilla origen.</strong> Asociá una
                    plantilla para que el nombre, familia, centro de costo y
                    máquina se hereden de la biblioteca.
                  </div>
                  <div className="grid gap-2">
                    <Label>Plantilla origen</Label>
                    <Select
                      value={plantillaOrigenIdSel ?? NONE}
                      onValueChange={(v) => {
                        if (!v) return;
                        setPlantillaOrigenIdSel(v === NONE ? null : v);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="— Asociar a plantilla —">
                          {(() => {
                            const id = plantillaOrigenIdSel;
                            if (!id) return "— Asociar a plantilla —";
                            const p = plantillas.find((pl) => pl.id === id);
                            return p?.nombre ?? "Plantilla";
                          })()}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>
                          — Sin asociar (legacy) —
                        </SelectItem>
                        {plantillas.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </BucketSection>
              )}

              {/* ───────────── R6 — Activación del paso para este producto ─────────────
                  Lo único de "identidad" que sí es del producto: si este
                  paso es obligatorio / opcional / condicional para este
                  producto en particular. Y la condición JsonLogic si
                  aplica. */}
              <BucketSection
                tone="neutral"
                title="Activación"
                subtitle="solo para este producto"
                hint={
                  draft.activacionV2 === "OPCIONAL"
                    ? "Opcional: solo se ejecuta si el cliente lo marca al cotizar."
                    : draft.activacionV2 === "CONDICIONAL"
                      ? "Condicional: se ejecuta automáticamente cuando se cumple la condición de abajo."
                      : undefined
                }
              >
                <div className="grid gap-2 md:max-w-sm">
                  <Label>Cuándo se ejecuta</Label>
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
                </div>

                {draft.activacionV2 === "CONDICIONAL" && (
                  <div className="grid gap-2">
                    <Label>Condición de activación</Label>
                    <CondicionBuilder
                      value={draft.condicionV2}
                      onChange={(expr) =>
                        setDraft((d) => ({ ...d, condicionV2: expr }))
                      }
                    />
                  </div>
                )}
              </BucketSection>

              {/* ───────────── Bucket #1 — Tiempos: ajustes para este producto ─────────────
                  Los tiempos y la productividad son lo único del Centro de
                  costo que admite override por producto. La identidad (centro
                  de costo, máquina, perfil) está arriba en read-only.

                  Los inputs vacíos heredan de la plantilla. Si tipean un
                  número, queda como override local del paso. */}
              <BucketSection
                tone="tiempo"
                title="Tiempos · ajustes para este producto"
                subtitle="aporta al bucket Centro de costo"
                hint={
                  <span>
                    El motor calcula{" "}
                    <code className="font-mono">
                      (setup + cleanup + fijo + run) × tarifa del centro
                    </code>
                    .{" "}
                    {operacion.plantillaOrigen ? (
                      "Dejá un campo vacío para heredar el valor de la plantilla; tipeá un número para override local."
                    ) : !draft.centroCostoId ? (
                      <strong className="text-amber-400">
                        ⚠ Sin centro de costo este paso cotiza $0.
                      </strong>
                    ) : null}
                  </span>
                }
              >
                {/* Modo legacy: si no hay plantilla, mostrar selector de
                    centro/máquina/perfil acá porque no hay de dónde
                    heredarlos. Cuando se asocie a plantilla, este bloque
                    desaparece y la identidad pasa al read-only de arriba. */}
                {!operacion.plantillaOrigen && (
                  <>
                    <div className="grid gap-2">
                      <Label>Centro de costo (legacy — local)</Label>
                      <Select
                        value={draft.centroCostoId}
                        onValueChange={(v) =>
                          setDraft((d) => ({ ...d, centroCostoId: v ?? "" }))
                        }
                      >
                        <SelectTrigger
                          className={
                            !draft.centroCostoId
                              ? "border-amber-500/60 bg-amber-500/5"
                              : undefined
                          }
                        >
                          <SelectValue placeholder="Seleccioná un centro de costo">
                            {centros.find((c) => c.id === draft.centroCostoId)
                              ?.nombre ?? "Seleccioná un centro de costo"}
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
                        <Label>Máquina (legacy — local)</Label>
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
                        <Label>Perfil operativo (legacy)</Label>
                        <Select
                          value={draft.perfilOperativoId}
                          onValueChange={(v) =>
                            setDraft((d) => ({
                              ...d,
                              perfilOperativoId: v ?? NONE,
                            }))
                          }
                          disabled={draft.maquinaId === NONE}
                        >
                          <SelectTrigger>
                            <SelectValue>
                              {draft.perfilOperativoId === NONE
                                ? "— sin perfil —"
                                : perfilesDisponibles.find(
                                    (p) => p.id === draft.perfilOperativoId,
                                  )?.nombre ?? "—"}
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
                  </>
                )}

                {/* R7 — Render condicional según el modo de productividad
                    declarado en la plantilla. Cada modo expone solo los
                    campos relevantes en lugar de mostrar siempre los 5
                    inputs uniformes (que confundían al usuario). */}
                {(() => {
                  // Modo efectivo: lee de plantilla (autoritativo) o cae
                  // a un default sensato cuando no hay plantilla (legacy).
                  const modo =
                    operacion.plantillaOrigen?.modoProductividad ?? "FIJA";

                  // Setup + Cleanup son comunes a todos los modos.
                  const setupCleanupBlock = (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="grid gap-2">
                        <Label>Setup (min) · override</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.1"
                          value={draft.setupMin}
                          placeholder={
                            operacion.plantillaOrigen?.setupMin != null
                              ? `Heredado: ${operacion.plantillaOrigen.setupMin}`
                              : undefined
                          }
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              setupMin: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Cleanup (min) · override</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.1"
                          value={draft.cleanupMin}
                          placeholder={
                            operacion.plantillaOrigen?.cleanupMin != null
                              ? `Heredado: ${operacion.plantillaOrigen.cleanupMin}`
                              : undefined
                          }
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              cleanupMin: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                  );

                  if (modo === "TIEMPO_FIJO") {
                    // Plantilla declara tiempo fijo total. El producto
                    // puede overridear ese tiempo si para este caso
                    // particular toma distinto.
                    return (
                      <>
                        {setupCleanupBlock}
                        <div className="grid gap-2">
                          <Label>Tiempo total (min) · override</Label>
                          <Input
                            type="number"
                            min={0}
                            step="0.1"
                            value={draft.tiempoFijoMin}
                            placeholder={
                              operacion.plantillaOrigen?.tiempoFijoMin != null
                                ? `Heredado: ${operacion.plantillaOrigen.tiempoFijoMin} min`
                                : undefined
                            }
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                tiempoFijoMin: e.target.value,
                              }))
                            }
                          />
                          <p className="text-[11px] text-ink-3">
                            La plantilla está en modo{" "}
                            <strong>tiempo fijo total</strong>: el motor usa
                            estos minutos directamente, no calcula por
                            cantidad/productividad.
                          </p>
                        </div>
                      </>
                    );
                  }

                  if (modo === "FORMULA") {
                    return (
                      <>
                        {setupCleanupBlock}
                        <div className="rounded border border-dashed border-line bg-bg-2 px-3 py-2.5 text-[12px] text-ink-3">
                          <strong className="text-ink-2">
                            Productividad por fórmula avanzada.
                          </strong>{" "}
                          La plantilla calcula la productividad con una
                          expresión. No se overridea desde la ruta. Para
                          ajustar la fórmula, editá la plantilla en
                          biblioteca.
                        </div>
                      </>
                    );
                  }

                  // Modo FIJA — productividad numérica con unidad compuesta.
                  // Mostramos el valor heredado en el placeholder y la unidad
                  // (heredada) como display; el override es solo el valor
                  // numérico (por simplicidad, no se override la unidad).
                  const unidadProdHeredada =
                    operacion.plantillaOrigen?.unidadProductivaV2;
                  const unidadTiempoHeredada =
                    operacion.plantillaOrigen?.unidadTiempo === "HORA"
                      ? "h"
                      : operacion.plantillaOrigen?.unidadTiempo === "SEGUNDO"
                        ? "seg"
                        : "min";
                  return (
                    <>
                      {setupCleanupBlock}
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                          <Label>
                            Productividad · override
                            {unidadProdHeredada && (
                              <span className="ml-2 font-mono text-[10px] text-ink-3">
                                ({unidadProdHeredada}/{unidadTiempoHeredada})
                              </span>
                            )}
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={draft.productividadBase}
                            placeholder={
                              operacion.plantillaOrigen?.productividadBase != null
                                ? `Heredado: ${operacion.plantillaOrigen.productividadBase}`
                                : undefined
                            }
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                productividadBase: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Tiempo fijo adicional (min) · override</Label>
                          <Input
                            type="number"
                            min={0}
                            step="0.1"
                            value={draft.tiempoFijoMin}
                            placeholder={
                              operacion.plantillaOrigen?.tiempoFijoMin != null
                                ? `Heredado: ${operacion.plantillaOrigen.tiempoFijoMin}`
                                : "0"
                            }
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                tiempoFijoMin: e.target.value,
                              }))
                            }
                          />
                          <p className="text-[10px] text-ink-3">
                            Tiempo fijo adicional al cálculo de productividad
                            (ej. checks, alistamiento por trabajo).
                          </p>
                        </div>
                      </div>
                      {!operacion.plantillaOrigen && (
                        // Modo legacy: mostrar también el selector de unidad
                        // de tiempo porque no hay plantilla de donde heredar.
                        <div className="grid gap-2 md:max-w-sm">
                          <Label>Por unidad de tiempo (legacy)</Label>
                          <Select
                            value={draft.unidadTiempo}
                            onValueChange={(v) => {
                              if (!v) return;
                              setDraft((d) => ({ ...d, unidadTiempo: v }));
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="HORA">por hora</SelectItem>
                              <SelectItem value="MINUTO">por minuto</SelectItem>
                              <SelectItem value="SEGUNDO">por segundo</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </>
                  );
                })()}
              </BucketSection>

              {/* R6 — La sección "Materiales" ya NO vive en el editor de
                  paso. Se gestiona desde el botón "Gestionar" en la lista
                  de pasos del tab Ruta de producción (puerta única). El
                  editor solo se ocupa de identidad heredada, activación,
                  tiempos, nesting y cargos flat. */}

              {/* ───────────── Bucket #3 — Cargos flat ─────────────
                  Placeholder honesto. R4 implementará schema + UI para
                  royalties, mínimos, tercerizaciones, viáticos. */}
              <BucketSection
                tone="flat"
                title="Cargos flat"
                subtitle="aporta al bucket Cargos flat"
              >
                <div className="rounded border border-dashed border-line bg-bg-2 px-3 py-2 text-[12px] text-ink-3">
                  <strong className="text-ink-2">Próximamente.</strong> Cargos
                  fijos del paso (royalties, mínimos, tercerizaciones,
                  viáticos). Hoy el motor cotiza estos cargos en{" "}
                  <code className="font-mono">$0</code>.
                </div>
              </BucketSection>

              {/* ───────────── Configuración avanzada — Nesting ─────────────
                  Solo si la familia produce nesting. R2 — el editor en sí
                  vive en `nesting-editor-sheet.tsx` (vista de 4 capas:
                  pieza, máquina, sustrato, paso). Acá solo botón + resumen. */}
              {FAMILIAS_PRODUCEN_NESTING.has(draft.familiaV2) && (
                <BucketSection
                  tone="config"
                  title="Configuración del nesting"
                  subtitle="cómo se acomodan las piezas"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1.5">
                      <div className="flex flex-wrap gap-1.5">
                        {describeNestingConfig(draft.configNestingV2).map(
                          (chip, i) => (
                            <span
                              key={i}
                              className="rounded-[3px] border border-line bg-bg-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-2"
                            >
                              {chip}
                            </span>
                          ),
                        )}
                      </div>
                      <p className="text-[11px] text-ink-3">
                        El nesting combina 4 capas (pieza, máquina, sustrato y
                        paso). Abrí el editor para ver y configurar.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setNestingSheetOpen(true)}
                    >
                      Configurar nesting
                    </Button>
                  </div>
                </BucketSection>
              )}

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

      {/* Sheet anidado: editor de nesting. Se monta encima del editor de
          paso y modifica el draft.configNestingV2 en memoria. La
          persistencia ocurre cuando se guarda el paso. */}
      <NestingEditorSheet
        open={nestingSheetOpen}
        onOpenChange={setNestingSheetOpen}
        operacion={operacion}
        familia={draft.familiaV2}
        maquina={maquinaElegida}
        config={draft.configNestingV2}
        onChange={(next) =>
          setDraft((d) => ({ ...d, configNestingV2: next }))
        }
      />
    </Sheet>
  );
}
