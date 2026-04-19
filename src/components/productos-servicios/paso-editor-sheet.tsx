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
  };
}

function parseOptionalNumber(s: string): number | undefined {
  if (s.trim() === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
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
            Campos avanzados (<code>configNestingV2</code>, condiciones JsonLogic) van a
            incorporarse a este editor en una iteración futura.
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
                    <strong>Opcional</strong> sólo se ejecuta si el cliente lo marca.
                    <strong> Condicional</strong> requiere editar la condición (JsonLogic)
                    — la evaluación completa es pendiente en el super motor.
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

              <div className="grid gap-2">
                <Label>Unidad productiva</Label>
                <Input
                  value={draft.unidadProductivaV2}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, unidadProductivaV2: e.target.value }))
                  }
                  placeholder="hojas, m2, piezas, letras, modulosLED…"
                  maxLength={40}
                />
                <p className="text-xs text-muted-foreground">
                  Sobre qué cantidad opera el paso (derivada del trabajo o de outputs previos).
                </p>
              </div>

              <div className="grid gap-2">
                <Label>Centro de costo</Label>
                <Select
                  value={draft.centroCostoId || undefined}
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
