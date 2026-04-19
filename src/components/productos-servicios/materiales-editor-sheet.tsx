"use client";

/**
 * P1.4 — Editor de materiales declarativos (ProcesoOperacionMaterial) de un paso.
 *
 * El super motor usa estos registros para calcular costoMateriasPrimas. Si un
 * paso no tiene materiales declarativos, cae a plantillas imperativas
 * (material-plantillas.ts) como fallback.
 */
import * as React from "react";
import { toast } from "sonner";

import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MateriaPrima, MateriaPrimaVariante } from "@/lib/materias-primas";
import { getMateriasPrimas } from "@/lib/materias-primas-api";
import {
  createProcesoOperacionMaterial,
  deleteProcesoOperacionMaterial,
  listProcesoOperacionMateriales,
  MATERIAL_FORMULAS,
  updateProcesoOperacionMaterial,
  type MaterialFormula,
  type ProcesoOperacionMaterial,
} from "@/lib/procesos-api";

const NONE = "__none__";

const FORMULA_LABELS: Record<MaterialFormula, string> = {
  por_unidad_productiva: "por unidad productiva",
  por_m2: "por m²",
  por_pieza: "por pieza",
  por_metro_lineal: "por metro lineal",
  fijo: "fijo (no escala)",
};

type VarianteOption = {
  id: string;
  sku: string;
  nombreVariante: string | null;
  materiaPrimaNombre: string;
  precioReferencia: number | null;
};

type DraftForm = {
  id: string | null;
  nombre: string;
  materiaPrimaVarianteId: string; // NONE => null (material genérico tipo "clics")
  formula: MaterialFormula;
  cantidadPorUnidad: string;
  unidad: string;
  precioManual: string; // "" => null
  aplicaMultiCaras: boolean;
  orden: number;
};

const emptyDraft: DraftForm = {
  id: null,
  nombre: "",
  materiaPrimaVarianteId: NONE,
  formula: "por_unidad_productiva",
  cantidadPorUnidad: "1",
  unidad: "unidad",
  precioManual: "",
  aplicaMultiCaras: false,
  orden: 0,
};

export function MaterialesEditorSheet({
  open,
  onOpenChange,
  operacionId,
  operacionNombre,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operacionId: string;
  operacionNombre: string;
  onChanged?: () => void;
}) {
  const [materiales, setMateriales] = React.useState<ProcesoOperacionMaterial[]>([]);
  const [variantesOptions, setVariantesOptions] = React.useState<VarianteOption[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [draft, setDraft] = React.useState<DraftForm>(emptyDraft);
  const [showForm, setShowForm] = React.useState(false);

  const reload = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [mats, primas] = await Promise.all([
        listProcesoOperacionMateriales(operacionId),
        getMateriasPrimas(),
      ]);
      setMateriales(mats);
      const options: VarianteOption[] = [];
      for (const mp of primas as MateriaPrima[]) {
        for (const v of (mp.variantes ?? []) as MateriaPrimaVariante[]) {
          if (!v.activo) continue;
          options.push({
            id: v.id,
            sku: v.sku,
            nombreVariante: v.nombreVariante ?? null,
            materiaPrimaNombre: mp.nombre,
            precioReferencia:
              v.precioReferencia != null ? Number(v.precioReferencia) : null,
          });
        }
      }
      options.sort((a, b) => {
        const byMp = a.materiaPrimaNombre.localeCompare(b.materiaPrimaNombre);
        if (byMp !== 0) return byMp;
        return a.sku.localeCompare(b.sku);
      });
      setVariantesOptions(options);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar los materiales.");
    } finally {
      setIsLoading(false);
    }
  }, [operacionId]);

  React.useEffect(() => {
    if (open) {
      setShowForm(false);
      setDraft(emptyDraft);
      void reload();
    }
  }, [open, reload]);

  function startCreate() {
    const nextOrden = materiales.length > 0
      ? Math.max(...materiales.map((m) => m.orden)) + 1
      : 0;
    setDraft({ ...emptyDraft, orden: nextOrden });
    setShowForm(true);
  }

  function startEdit(m: ProcesoOperacionMaterial) {
    setDraft({
      id: m.id,
      nombre: m.nombre,
      materiaPrimaVarianteId: m.materiaPrimaVarianteId ?? NONE,
      formula: m.formula,
      cantidadPorUnidad: String(m.cantidadPorUnidad),
      unidad: m.unidad,
      precioManual: m.precioManual != null ? String(m.precioManual) : "",
      aplicaMultiCaras: m.aplicaMultiCaras,
      orden: m.orden,
    });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setDraft(emptyDraft);
  }

  async function save() {
    if (draft.nombre.trim().length === 0) {
      toast.error("El nombre del material es obligatorio.");
      return;
    }
    const cantidad = Number(draft.cantidadPorUnidad);
    if (!Number.isFinite(cantidad) || cantidad < 0) {
      toast.error("La cantidad debe ser un número >= 0.");
      return;
    }
    if (draft.unidad.trim().length === 0) {
      toast.error("La unidad es obligatoria.");
      return;
    }
    const precioManual = draft.precioManual.trim() === "" ? null : Number(draft.precioManual);
    if (precioManual !== null && (!Number.isFinite(precioManual) || precioManual < 0)) {
      toast.error("El precio manual debe ser un número >= 0 o quedar vacío.");
      return;
    }

    const payload = {
      nombre: draft.nombre.trim(),
      materiaPrimaVarianteId:
        draft.materiaPrimaVarianteId === NONE ? null : draft.materiaPrimaVarianteId,
      formula: draft.formula,
      cantidadPorUnidad: cantidad,
      unidad: draft.unidad.trim(),
      precioManual,
      aplicaMultiCaras: draft.aplicaMultiCaras,
      orden: draft.orden,
    };

    setIsSaving(true);
    try {
      if (draft.id) {
        await updateProcesoOperacionMaterial(operacionId, draft.id, payload);
        toast.success("Material actualizado.");
      } else {
        await createProcesoOperacionMaterial(operacionId, payload);
        toast.success("Material creado.");
      }
      cancelForm();
      await reload();
      onChanged?.();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el material.");
    } finally {
      setIsSaving(false);
    }
  }

  async function remove(m: ProcesoOperacionMaterial) {
    if (!confirm(`¿Eliminar el material "${m.nombre}"?`)) return;
    try {
      await deleteProcesoOperacionMaterial(operacionId, m.id);
      toast.success("Material eliminado.");
      await reload();
      onChanged?.();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  }

  const varianteElegida = React.useMemo(
    () =>
      variantesOptions.find((v) => v.id === draft.materiaPrimaVarianteId) ?? null,
    [variantesOptions, draft.materiaPrimaVarianteId],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-screen max-w-none overflow-y-auto data-[side=right]:w-[94vw] data-[side=right]:sm:max-w-[94vw] xl:data-[side=right]:w-[1120px] xl:data-[side=right]:sm:max-w-[1120px]"
      >
        <SheetHeader className="px-6 pt-6">
          <SheetTitle>Materiales de "{operacionNombre}"</SheetTitle>
          <SheetDescription>
            Cada fila declara un consumo. La <strong>fórmula</strong> define cómo escala la
            cantidad: por unidad productiva (pliegos, metros, piezas), fijo por corrida, etc. Si
            no ligás una <strong>variante de materia prima</strong>, el precio se toma del campo{" "}
            <code>precioManual</code> (útil para costos abstractos como "clics" de impresora).
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6 px-6 pb-6">
          {isLoading ? (
            <div className="flex justify-center p-6"><GdiSpinner className="size-6" /></div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {materiales.length} {materiales.length === 1 ? "material" : "materiales"}
                </div>
                {!showForm && (
                  <Button size="sm" onClick={startCreate}>
                    + Nuevo material
                  </Button>
                )}
              </div>

              {materiales.length === 0 && !showForm ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Este paso no tiene materiales declarativos. El super motor aplica las plantillas
                  imperativas por familia (material-plantillas.ts) como fallback.
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead>Fórmula</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead>Unidad</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead>Multi-caras</TableHead>
                      <TableHead className="w-32" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materiales.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-mono text-xs">{m.orden}</TableCell>
                        <TableCell>
                          <div className="font-medium">{m.nombre}</div>
                          {m.materiaPrimaVariante ? (
                            <div className="text-xs text-muted-foreground">
                              <code>{m.materiaPrimaVariante.sku}</code>
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">— genérico —</div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          <code>{FORMULA_LABELS[m.formula]}</code>
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
                            <Badge variant="secondary" className="text-xs">×2 doble faz</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => startEdit(m)}>
                            Editar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => remove(m)}>
                            Borrar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {showForm && (
                <div className="rounded-md border p-4 space-y-4">
                  <div className="text-sm font-medium">
                    {draft.id ? "Editar material" : "Nuevo material"}
                  </div>

                  <div className="grid gap-2">
                    <Label>Nombre</Label>
                    <Input
                      value={draft.nombre}
                      onChange={(e) => setDraft((d) => ({ ...d, nombre: e.target.value }))}
                      placeholder="Ej: Papel Opalina 250gr"
                      maxLength={120}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Variante de materia prima (opcional)</Label>
                    <Select
                      value={draft.materiaPrimaVarianteId}
                      onValueChange={(v) =>
                        setDraft((d) => ({ ...d, materiaPrimaVarianteId: v ?? NONE }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue>
                          {draft.materiaPrimaVarianteId === NONE
                            ? "Material genérico (sin variante)"
                            : varianteElegida
                              ? `${varianteElegida.materiaPrimaNombre} · ${varianteElegida.sku}`
                              : "—"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Material genérico (sin variante)</SelectItem>
                        {variantesOptions.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.materiaPrimaNombre} · {v.sku}
                            {v.nombreVariante ? ` — ${v.nombreVariante}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Si no elegís variante, se usa el <strong>precio manual</strong>. Útil para
                      conceptos que no tienen stock (ej: clics, toner, tinta UV por ml).
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="grid gap-2">
                      <Label>Fórmula</Label>
                      <Select
                        value={draft.formula}
                        onValueChange={(v) =>
                          setDraft((d) => ({ ...d, formula: (v ?? "fijo") as MaterialFormula }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue>{FORMULA_LABELS[draft.formula]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {MATERIAL_FORMULAS.map((f) => (
                            <SelectItem key={f} value={f}>
                              {FORMULA_LABELS[f]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Cantidad por unidad</Label>
                      <Input
                        type="number"
                        step="0.001"
                        min={0}
                        value={draft.cantidadPorUnidad}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, cantidadPorUnidad: e.target.value }))
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Unidad</Label>
                      <Input
                        value={draft.unidad}
                        onChange={(e) => setDraft((d) => ({ ...d, unidad: e.target.value }))}
                        placeholder="pliego, m2, ml, gramo…"
                        maxLength={40}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="grid gap-2">
                      <Label>Precio manual (opcional)</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        min={0}
                        value={draft.precioManual}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, precioManual: e.target.value }))
                        }
                        placeholder="— usa precio de la variante —"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Orden</Label>
                      <Input
                        type="number"
                        min={0}
                        value={draft.orden}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            orden: Math.max(0, parseInt(e.target.value, 10) || 0),
                          }))
                        }
                      />
                    </div>
                    <div className="flex items-end gap-3 pb-2">
                      <Switch
                        id="aplicaMultiCaras"
                        checked={draft.aplicaMultiCaras}
                        onCheckedChange={(v) => setDraft((d) => ({ ...d, aplicaMultiCaras: v }))}
                      />
                      <Label htmlFor="aplicaMultiCaras" className="cursor-pointer">
                        ×2 en doble faz
                      </Label>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={cancelForm} disabled={isSaving}>
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={save} disabled={isSaving}>
                      {isSaving ? <GdiSpinner className="size-4" /> : "Guardar"}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
