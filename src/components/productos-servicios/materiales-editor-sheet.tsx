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
import { Checkbox } from "@/components/ui/checkbox";
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
import { getLongitudMm } from "@/lib/units";
import {
  createProcesoOperacionMaterial,
  deleteProcesoOperacionMaterial,
  listProcesoOperacionMateriales,
  MATERIAL_FORMULAS,
  updateProcesoOperacionMaterial,
  type MaterialFormula,
  type ProcesoOperacionMaterial,
} from "@/lib/procesos-api";
import {
  getProductosServicios,
  getProductoVariantes,
} from "@/lib/productos-servicios-api";
import type { ProductoServicio, ProductoVariante } from "@/lib/productos-servicios";

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
  materiaPrimaId: string;
  materiaPrimaNombre: string;
  precioReferencia: number | null;
  /** atributosVarianteJson — para rollos: { ancho: m, largo: m }; para pliegos:
   * { anchoMm, altoMm }; para tintas/otros: shape libre. */
  atributosVariante: Record<string, unknown> | null;
};

type MateriaPrimaOption = {
  id: string;
  nombre: string;
  variantesCount: number;
};

type DraftKind = "stock" | "subProducto";

type DraftForm = {
  id: string | null;
  kind: DraftKind;
  nombre: string;
  // Stock fields:
  materiaPrimaId: string; // NONE => material genérico sin variante
  materiaPrimaVarianteId: string; // NONE => aún no elegida dentro de la MP
  // Sub-producto fields:
  productoComponenteId: string; // NONE => no elegido
  varianteComponenteId: string; // NONE => usar default del producto componente
  // Shared:
  formula: MaterialFormula;
  cantidadPorUnidad: string;
  unidad: string;
  precioManual: string; // "" => null
  aplicaMultiCaras: boolean;
  // SM.1.d — Sustrato del nesting + variantes habilitadas
  esSustratoNesting: boolean;
  variantesHabilitadasIds: string[];
  orden: number;
};

const emptyDraft: DraftForm = {
  id: null,
  kind: "stock",
  nombre: "",
  materiaPrimaId: NONE,
  materiaPrimaVarianteId: NONE,
  productoComponenteId: NONE,
  varianteComponenteId: NONE,
  formula: "por_unidad_productiva",
  cantidadPorUnidad: "1",
  unidad: "unidad",
  precioManual: "",
  aplicaMultiCaras: false,
  esSustratoNesting: false,
  variantesHabilitadasIds: [],
  orden: 0,
};

/** SM.1.d — Familias del modelo universal que producen nesting y soportan
 * sustrato multi-variante. Espejo de FAMILIAS_PASO en el backend. */
const FAMILIAS_PRODUCEN_NESTING = new Set([
  "impresion_por_hoja",
  "impresion_por_area",
  "impresion_por_pieza",
]);

/** Formatea precio como `$ 237.753` con separador de miles ARS. */
function formatPrecio(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$ ${new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n)}`;
}

/**
 * SM.1.d + Fase B — Build user-friendly chips de los atributos de variante
 * para mostrarlos en el multi-select de variantes habilitadas. Usa el
 * helper `getLongitudMm` para entender la unidad declarada en el sufijo
 * de la clave (anchoMm / anchoCm / anchoM / ancho-legacy-en-m), evitando
 * la ambigüedad de "número desnudo".
 *
 * Mostrado en cm cuando es chico (<2 m) y en m cuando es grande (rollo).
 */
function describeVarianteAtributos(
  attrs: Record<string, unknown> | null | undefined,
): string[] {
  if (!attrs) return [];
  const chips: string[] = [];

  const anchoMm = getLongitudMm(attrs, "ancho");
  const altoMm = getLongitudMm(attrs, "alto");
  const largoMm = getLongitudMm(attrs, "largo");

  // Helper para elegir cm vs m según magnitud (cm bajo 2 m, m sobre).
  const fmtMm = (mm: number): string =>
    mm >= 2000
      ? `${(mm / 1000).toFixed(2).replace(/\.00$/, "")} m`
      : `${(mm / 10).toFixed(1).replace(/\.0$/, "")} cm`;

  if (anchoMm != null && altoMm != null) {
    chips.push(`${fmtMm(anchoMm)} × ${fmtMm(altoMm)}`);
  } else if (anchoMm != null && largoMm != null) {
    // Caso típico de rollo: ancho (chico) × largo (grande).
    chips.push(`${fmtMm(anchoMm)} × ${fmtMm(largoMm)}`);
  } else {
    if (anchoMm != null) chips.push(fmtMm(anchoMm));
    if (altoMm != null) chips.push(`× ${fmtMm(altoMm)}`);
    if (largoMm != null) chips.push(`× ${fmtMm(largoMm)}`);
  }

  // Otros atributos que aporten contexto (gramaje, color, acabado, etc.)
  for (const key of [
    "gramaje",
    "color",
    "acabado",
    "material",
    "calibre",
    "espesorMm",
    "tipo",
  ] as const) {
    const v = (attrs as Record<string, unknown>)[key];
    if (v != null && v !== "") {
      chips.push(`${key}: ${v}`);
    }
  }
  return chips;
}

export function MaterialesEditorSheet({
  open,
  onOpenChange,
  operacionId,
  operacionNombre,
  familiaV2,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operacionId: string;
  operacionNombre: string;
  /** SM.1.d — Familia del paso. Habilita el toggle "Sustrato del nesting"
   * solo cuando la familia produce nesting (impresion_por_*). */
  familiaV2?: string | null;
  onChanged?: () => void;
}) {
  const familiaProduceNesting =
    !!familiaV2 && FAMILIAS_PRODUCEN_NESTING.has(familiaV2);
  const [materiales, setMateriales] = React.useState<ProcesoOperacionMaterial[]>([]);
  const [variantesOptions, setVariantesOptions] = React.useState<VarianteOption[]>([]);
  const [materiaPrimaOptions, setMateriaPrimaOptions] = React.useState<MateriaPrimaOption[]>([]);
  const [productos, setProductos] = React.useState<ProductoServicio[]>([]);
  const [variantesPorProducto, setVariantesPorProducto] = React.useState<
    Record<string, ProductoVariante[]>
  >({});
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [draft, setDraft] = React.useState<DraftForm>(emptyDraft);
  const [showForm, setShowForm] = React.useState(false);

  const reload = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [mats, primas, prods] = await Promise.all([
        listProcesoOperacionMateriales(operacionId),
        getMateriasPrimas(),
        getProductosServicios(),
      ]);
      setMateriales(mats);
      setProductos((prods ?? []).filter((p) => p.activo));
      const options: VarianteOption[] = [];
      const mps: MateriaPrimaOption[] = [];
      for (const mp of primas as MateriaPrima[]) {
        const variantesActivas = ((mp.variantes ?? []) as MateriaPrimaVariante[]).filter(
          (v) => v.activo,
        );
        for (const v of variantesActivas) {
          options.push({
            id: v.id,
            sku: v.sku,
            nombreVariante: v.nombreVariante ?? null,
            materiaPrimaId: mp.id,
            materiaPrimaNombre: mp.nombre,
            precioReferencia:
              v.precioReferencia != null ? Number(v.precioReferencia) : null,
            atributosVariante:
              (v.atributosVariante as Record<string, unknown> | null) ?? null,
          });
        }
        if (variantesActivas.length > 0) {
          mps.push({
            id: mp.id,
            nombre: mp.nombre,
            variantesCount: variantesActivas.length,
          });
        }
      }
      options.sort((a, b) => {
        const byMp = a.materiaPrimaNombre.localeCompare(b.materiaPrimaNombre);
        if (byMp !== 0) return byMp;
        return a.sku.localeCompare(b.sku);
      });
      mps.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setVariantesOptions(options);
      setMateriaPrimaOptions(mps);
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
    const kind: DraftKind = m.productoComponenteId ? "subProducto" : "stock";
    // Si el material tiene una variante asignada, derivar su materia prima
    // desde el catálogo para que el Select se muestre con la MP correcta.
    const varianteActual = m.materiaPrimaVarianteId
      ? variantesOptions.find((v) => v.id === m.materiaPrimaVarianteId) ?? null
      : null;
    // SM.1.d — Si es sustrato, derivar la materia prima desde la primera
    // variante habilitada (todas comparten la misma MP por validación backend).
    const habilitadasIds = m.variantesHabilitadas
      .filter((v) => v.activo)
      .map((v) => v.materiaPrimaVarianteId);
    const mpFromHabilitadas =
      habilitadasIds.length > 0
        ? variantesOptions.find((v) => v.id === habilitadasIds[0])?.materiaPrimaId ?? NONE
        : NONE;
    setDraft({
      id: m.id,
      kind,
      nombre: m.nombre,
      materiaPrimaId:
        m.esSustratoNesting && mpFromHabilitadas !== NONE
          ? mpFromHabilitadas
          : varianteActual?.materiaPrimaId ?? NONE,
      materiaPrimaVarianteId: m.materiaPrimaVarianteId ?? NONE,
      productoComponenteId: m.productoComponenteId ?? NONE,
      varianteComponenteId: m.varianteComponenteId ?? NONE,
      formula: m.formula,
      cantidadPorUnidad: String(m.cantidadPorUnidad),
      unidad: m.unidad,
      precioManual: m.precioManual != null ? String(m.precioManual) : "",
      aplicaMultiCaras: m.aplicaMultiCaras,
      esSustratoNesting: m.esSustratoNesting,
      variantesHabilitadasIds: habilitadasIds,
      orden: m.orden,
    });
    if (kind === "subProducto" && m.productoComponenteId) {
      void loadVariantesDeProducto(m.productoComponenteId);
    }
    setShowForm(true);
  }

  const loadVariantesDeProducto = React.useCallback(async (productoId: string) => {
    if (variantesPorProducto[productoId]) return;
    try {
      const vs = await getProductoVariantes(productoId);
      setVariantesPorProducto((prev) => ({ ...prev, [productoId]: vs }));
    } catch (err) {
      console.error(err);
    }
  }, [variantesPorProducto]);

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

    if (draft.kind === "subProducto" && draft.productoComponenteId === NONE) {
      toast.error("Seleccioná el producto componente.");
      return;
    }

    // SM.1.d — Validaciones de sustrato (paralelo al backend, mensajes amigables)
    if (draft.esSustratoNesting) {
      if (draft.kind === "subProducto") {
        toast.error("Un sub-producto no puede ser sustrato del nesting.");
        return;
      }
      if (draft.materiaPrimaId === NONE) {
        toast.error("Seleccioná la materia prima del sustrato.");
        return;
      }
      if (draft.variantesHabilitadasIds.length === 0) {
        toast.error("Marcá al menos una variante habilitada.");
        return;
      }
    }

    const payload = {
      nombre: draft.nombre.trim(),
      materiaPrimaVarianteId:
        draft.kind === "stock" && draft.materiaPrimaVarianteId !== NONE
          ? draft.materiaPrimaVarianteId
          : null,
      productoComponenteId:
        draft.kind === "subProducto" && draft.productoComponenteId !== NONE
          ? draft.productoComponenteId
          : null,
      varianteComponenteId:
        draft.kind === "subProducto" && draft.varianteComponenteId !== NONE
          ? draft.varianteComponenteId
          : null,
      formula: draft.formula,
      cantidadPorUnidad: cantidad,
      unidad: draft.unidad.trim(),
      precioManual,
      aplicaMultiCaras: draft.aplicaMultiCaras,
      // SM.1.d — Sustrato + variantes habilitadas. Solo se persisten si el
      // toggle está ON; si OFF se mandan false + array vacío.
      esSustratoNesting: draft.esSustratoNesting,
      variantesHabilitadas: draft.esSustratoNesting
        ? draft.variantesHabilitadasIds.map((id, idx) => ({
            materiaPrimaVarianteId: id,
            orden: idx,
          }))
        : [],
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
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-medium">{m.nombre}</div>
                            {m.esSustratoNesting && (
                              <Badge variant="default" className="text-[10px]">
                                ⚡ sustrato
                              </Badge>
                            )}
                          </div>
                          {m.productoComponente ? (
                            <div className="mt-0.5 flex items-center gap-1 text-xs">
                              <Badge variant="outline" className="text-[10px]">
                                sub-producto
                              </Badge>
                              <span className="text-muted-foreground">
                                {m.productoComponente.nombre}
                                {m.varianteComponente
                                  ? ` · ${m.varianteComponente.nombre}`
                                  : " · (variante default)"}
                              </span>
                            </div>
                          ) : m.esSustratoNesting && m.variantesHabilitadas.length > 0 ? (
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {m.variantesHabilitadas.length} variante
                              {m.variantesHabilitadas.length === 1 ? "" : "s"} habilitada
                              {m.variantesHabilitadas.length === 1 ? "" : "s"}:{" "}
                              {m.variantesHabilitadas
                                .map((v) => v.materiaPrimaVariante?.sku ?? "—")
                                .join(", ")}
                            </div>
                          ) : m.materiaPrimaVariante ? (
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

                  {/* Toggle entre material de stock y sub-producto. El sub-producto
                      se cotiza recursivamente con su propia ruta; el stock consume
                      directamente una MateriaPrimaVariante. */}
                  <div className="grid gap-2">
                    <Label>Tipo de insumo</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={draft.kind === "stock" ? "default" : "outline"}
                        onClick={() => setDraft((d) => ({ ...d, kind: "stock" }))}
                      >
                        Material de stock
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={draft.kind === "subProducto" ? "default" : "outline"}
                        onClick={() => setDraft((d) => ({ ...d, kind: "subProducto" }))}
                      >
                        Sub-producto
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Un <strong>sub-producto</strong> es otro producto del catálogo que este paso
                      consume como insumo — se cotiza recursivamente con su propia ruta (ej: una
                      tapa dura que el libro consume en el paso "ensamble").
                    </p>
                  </div>

                  {draft.kind === "subProducto" ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="grid gap-2">
                        <Label>Producto componente</Label>
                        <Select
                          value={draft.productoComponenteId}
                          onValueChange={(v) => {
                            const next = v ?? NONE;
                            setDraft((d) => ({
                              ...d,
                              productoComponenteId: next,
                              varianteComponenteId: NONE,
                            }));
                            if (next !== NONE) void loadVariantesDeProducto(next);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue>
                              {draft.productoComponenteId === NONE
                                ? "Seleccioná un producto"
                                : productos.find((p) => p.id === draft.productoComponenteId)
                                    ?.nombre ?? "—"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>— seleccionar —</SelectItem>
                            {productos.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.nombre} <code className="text-xs text-muted-foreground">({p.codigo})</code>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Variante (opcional)</Label>
                        <Select
                          value={draft.varianteComponenteId}
                          onValueChange={(v) =>
                            setDraft((d) => ({ ...d, varianteComponenteId: v ?? NONE }))
                          }
                          disabled={draft.productoComponenteId === NONE}
                        >
                          <SelectTrigger>
                            <SelectValue>
                              {draft.varianteComponenteId === NONE
                                ? "— usar default del producto —"
                                : (variantesPorProducto[draft.productoComponenteId] ?? []).find(
                                    (v) => v.id === draft.varianteComponenteId,
                                  )?.nombre ?? "—"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>— usar default del producto —</SelectItem>
                            {(variantesPorProducto[draft.productoComponenteId] ?? []).map((v) => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : (
                  <>
                    {/* SM.1.d — Toggle "Sustrato del nesting" — solo visible si la
                        familia del paso produce nesting. */}
                    {familiaProduceNesting && (
                      <div className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary/[0.03] px-3 py-2.5">
                        <Switch
                          id="esSustratoNesting"
                          checked={draft.esSustratoNesting}
                          onCheckedChange={(v) =>
                            setDraft((d) => ({
                              ...d,
                              esSustratoNesting: v,
                              // Al activar, limpiar la variante única (pasa a multi)
                              materiaPrimaVarianteId: v ? NONE : d.materiaPrimaVarianteId,
                              // Al desactivar, limpiar las variantes habilitadas
                              variantesHabilitadasIds: v ? d.variantesHabilitadasIds : [],
                            }))
                          }
                        />
                        <div className="flex-1">
                          <Label htmlFor="esSustratoNesting" className="cursor-pointer">
                            Sustrato del nesting
                          </Label>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Marcá este material si define las dimensiones del nesting
                            (ej: rollo de vinilo, pliego de papel). El motor evaluará{" "}
                            <strong>todas las variantes habilitadas</strong> y elegirá la
                            mejor por el criterio configurado en la sección Nesting del paso.
                            Solo un material por paso puede ser sustrato.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="grid gap-2">
                        <Label>Materia prima</Label>
                        <Select
                          value={draft.materiaPrimaId}
                          onValueChange={(v) =>
                            setDraft((d) => ({
                              ...d,
                              materiaPrimaId: v ?? NONE,
                              // Al cambiar la MP, se resetea la variante: el usuario
                              // tiene que elegir una válida dentro del nuevo catálogo.
                              materiaPrimaVarianteId: NONE,
                              // Y se limpian las variantes habilitadas (pertenecen a otra MP).
                              variantesHabilitadasIds: [],
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue>
                              {draft.materiaPrimaId === NONE
                                ? "Material genérico (sin MP)"
                                : materiaPrimaOptions.find((mp) => mp.id === draft.materiaPrimaId)
                                    ?.nombre ?? "—"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {!draft.esSustratoNesting && (
                              <SelectItem value={NONE}>Material genérico (sin MP)</SelectItem>
                            )}
                            {materiaPrimaOptions.map((mp) => (
                              <SelectItem key={mp.id} value={mp.id}>
                                {mp.nombre} ({mp.variantesCount} variante
                                {mp.variantesCount === 1 ? "" : "s"})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {draft.esSustratoNesting ? (
                        <div className="grid gap-2">
                          <Label>Variantes habilitadas</Label>
                          <p className="text-xs text-muted-foreground">
                            Marcá las variantes que el motor debe evaluar.
                          </p>
                        </div>
                      ) : (
                        <div className="grid gap-2">
                          <Label>Variante</Label>
                          <Select
                            value={draft.materiaPrimaVarianteId}
                            onValueChange={(v) =>
                              setDraft((d) => ({ ...d, materiaPrimaVarianteId: v ?? NONE }))
                            }
                            disabled={draft.materiaPrimaId === NONE}
                          >
                            <SelectTrigger>
                              <SelectValue>
                                {draft.materiaPrimaId === NONE
                                  ? "— sin MP —"
                                  : draft.materiaPrimaVarianteId === NONE
                                    ? "Seleccioná una variante"
                                    : varianteElegida
                                      ? `${varianteElegida.sku}${varianteElegida.nombreVariante ? ` — ${varianteElegida.nombreVariante}` : ""}`
                                      : "—"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE}>— seleccionar —</SelectItem>
                              {variantesOptions
                                .filter((v) => v.materiaPrimaId === draft.materiaPrimaId)
                                .map((v) => (
                                  <SelectItem key={v.id} value={v.id}>
                                    {v.sku}
                                    {v.nombreVariante ? ` — ${v.nombreVariante}` : ""}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    {/* SM.1.d — Multi-checkbox de variantes habilitadas */}
                    {draft.esSustratoNesting && (
                      <div className="rounded-md border bg-background p-3">
                        {draft.materiaPrimaId === NONE ? (
                          <p className="text-sm text-muted-foreground">
                            Seleccioná primero una materia prima para habilitar sus variantes.
                          </p>
                        ) : (
                          (() => {
                            const candidatas = variantesOptions.filter(
                              (v) => v.materiaPrimaId === draft.materiaPrimaId,
                            );
                            if (candidatas.length === 0) {
                              return (
                                <p className="text-sm text-muted-foreground">
                                  Esta materia prima no tiene variantes activas.{" "}
                                  <a
                                    href="/inventario/materias-primas"
                                    className="underline"
                                  >
                                    Cargá variantes en Inventario
                                  </a>{" "}
                                  y volvé.
                                </p>
                              );
                            }
                            return (
                              <div className="space-y-2">
                                {candidatas.map((v) => {
                                  const checked = draft.variantesHabilitadasIds.includes(v.id);
                                  const chips = describeVarianteAtributos(v.atributosVariante);
                                  // Título legible: nombre custom si hay, sino la
                                  // descripción derivada de atributos (ej. "1060 mm × 50 m");
                                  // como último recurso, el SKU.
                                  const titulo =
                                    v.nombreVariante?.trim() ||
                                    chips.join(" ").trim() ||
                                    v.sku;
                                  return (
                                    <label
                                      key={v.id}
                                      className="flex items-start gap-3 rounded border p-2.5 text-sm transition-colors hover:bg-muted/30"
                                    >
                                      <Checkbox
                                        checked={checked}
                                        onCheckedChange={(next) => {
                                          setDraft((d) => ({
                                            ...d,
                                            variantesHabilitadasIds:
                                              next === true
                                                ? Array.from(
                                                    new Set([...d.variantesHabilitadasIds, v.id]),
                                                  )
                                                : d.variantesHabilitadasIds.filter(
                                                    (id) => id !== v.id,
                                                  ),
                                          }));
                                        }}
                                      />
                                      <div className="flex-1 space-y-1">
                                        <div className="font-medium">{titulo}</div>
                                        {chips.length > 0 && titulo !== chips.join(" ").trim() && (
                                          <div className="flex flex-wrap gap-1">
                                            {chips.map((c, i) => (
                                              <span
                                                key={i}
                                                className="rounded border border-border/60 bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground"
                                              >
                                                {c}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                        {v.precioReferencia != null && (
                                          <div className="text-xs text-muted-foreground">
                                            {formatPrecio(v.precioReferencia)}
                                          </div>
                                        )}
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            );
                          })()
                        )}
                      </div>
                    )}
                  </>
                  )}
                  {draft.kind === "stock" && (
                    <p className="text-xs text-muted-foreground">
                      Si elegís <strong>material genérico</strong>, se usa el{" "}
                      <strong>precio manual</strong>. Útil para conceptos que no tienen stock
                      (ej: clics, toner, tinta UV por ml).
                    </p>
                  )}

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
