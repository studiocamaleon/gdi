"use client";

import * as React from "react";
import { PencilIcon, PlusIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import type { ProductTabProps } from "@/components/productos-servicios/product-detail-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  createProductoVariante,
  deleteProductoVariante,
  updateProductoVariante,
  updateVarianteOpcionesProductivas,
  getVarianteMotorOverride,
  upsertVarianteMotorOverride,
} from "@/lib/productos-servicios-api";
import { Separator } from "@/components/ui/separator";
import { Loader2Icon } from "lucide-react";
import type { DimensionOpcionProductiva, ValorOpcionProductiva } from "@/lib/productos-servicios";

// ── Types ──────────────────────────────────────────────────────────

type TipoCopiaValor = "copia_simple" | "duplicado" | "triplicado" | "cuadruplicado";

const TIPO_COPIA_LABELS: Record<TipoCopiaValor, string> = {
  copia_simple: "Solo original",
  duplicado: "Duplicado",
  triplicado: "Triplicado",
  cuadruplicado: "Cuadruplicado",
};

const TIPO_IMPRESION_LABELS: Record<string, string> = {
  bn: "K",
  cmyk: "CMYK",
};

const CARAS_LABELS: Record<string, string> = {
  simple_faz: "Simple faz",
  doble_faz: "Doble faz",
};

type TalonarioVarianteDraft = {
  nombre: string;
  anchoMm: string;
  altoMm: string;
  tipoImpresion: "bn" | "cmyk";
  caras: "simple_faz" | "doble_faz";
  tiposCopiaPermitidos: TipoCopiaValor[];
};

// ── Helpers ────────────────────────────────────────────────────────

function readConfigRecord(val: unknown): Record<string, unknown> {
  return val && typeof val === "object" && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : {};
}

/** Reads the available copy types from the motor config */
function getAvailableTiposCopia(motorParams: Record<string, unknown> | null): TipoCopiaValor[] {
  if (!motorParams) return [];
  const defs = motorParams.tipoCopiaDefiniciones;
  if (!Array.isArray(defs)) return [];
  return defs
    .map((d) => {
      const val = String(readConfigRecord(d).valor ?? "").toUpperCase();
      const mapped: Record<string, TipoCopiaValor> = {
        COPIA_SIMPLE: "copia_simple",
        DUPLICADO: "duplicado",
        TRIPLICADO: "triplicado",
        CUADRUPLICADO: "cuadruplicado",
      };
      return mapped[val] ?? null;
    })
    .filter((v): v is TipoCopiaValor => v !== null);
}

function createDraft(availableTiposCopia: TipoCopiaValor[]): TalonarioVarianteDraft {
  return {
    nombre: "",
    anchoMm: "160",
    altoMm: "210",
    tipoImpresion: "cmyk",
    caras: "simple_faz",
    tiposCopiaPermitidos: availableTiposCopia.length ? [availableTiposCopia[0]] : [],
  };
}

function createEditDraft(
  variante: ProductTabProps["variantes"][number],
  availableTiposCopia: TipoCopiaValor[],
): TalonarioVarianteDraft {
  const existingTiposCopia =
    variante.opcionesProductivas
      ?.find((entry) => entry.dimension === "tipo_copia")
      ?.valores.filter((v): v is TipoCopiaValor =>
        v === "copia_simple" || v === "duplicado" || v === "triplicado" || v === "cuadruplicado",
      ) ?? [];
  return {
    nombre: variante.nombre,
    anchoMm: String(variante.anchoMm),
    altoMm: String(variante.altoMm),
    tipoImpresion: variante.tipoImpresion,
    caras: variante.caras,
    tiposCopiaPermitidos: existingTiposCopia.length
      ? existingTiposCopia
      : availableTiposCopia.length
        ? [availableTiposCopia[0]]
        : [],
  };
}

// ── Component ──────────────────────────────────────────────────────

export function TalonarioVariantesTab(props: ProductTabProps) {
  const availableTiposCopia = React.useMemo(
    () => getAvailableTiposCopia(props.motorConfig?.parametros ?? null),
    [props.motorConfig],
  );

  const [draft, setDraft] = React.useState(() => createDraft(availableTiposCopia));
  const [editDraft, setEditDraft] = React.useState(() => createDraft(availableTiposCopia));
  const [editingVarianteId, setEditingVarianteId] = React.useState("");
  const [isSavingVariante, startSavingVariante] = React.useTransition();
  const [isUpdatingVariante, startUpdatingVariante] = React.useTransition();
  const [isDeletingVariante, startDeletingVariante] = React.useTransition();
  const [isTogglingVariante, startTogglingVariante] = React.useTransition();

  const editingVariante = React.useMemo(
    () => props.variantes.find((v) => v.id === editingVarianteId) ?? null,
    [props.variantes, editingVarianteId],
  );
  const isEditingVariante = editingVarianteId !== "" && editingVariante !== null;
  const activeDraft = isEditingVariante ? editDraft : draft;
  const setActiveDraft = isEditingVariante ? setEditDraft : setDraft;

  const buildOpcionesDimensiones = (d: TalonarioVarianteDraft) => {
    const dimensiones: Array<{ dimension: DimensionOpcionProductiva; valores: ValorOpcionProductiva[] }> = [
      { dimension: "tipo_impresion", valores: [d.tipoImpresion] },
      { dimension: "caras", valores: [d.caras] },
    ];
    if (d.tiposCopiaPermitidos.length > 0) {
      dimensiones.push({
        dimension: "tipo_copia",
        valores: d.tiposCopiaPermitidos,
      });
    }
    return dimensiones;
  };

  const handleCreateVariante = () => {
    if (!draft.nombre.trim()) {
      toast.error("El nombre de variante es obligatorio.");
      return;
    }
    if (draft.tiposCopiaPermitidos.length === 0) {
      toast.error("Debe seleccionar al menos un tipo de copia.");
      return;
    }
    startSavingVariante(async () => {
      try {
        const created = await createProductoVariante(props.producto.id, {
          nombre: draft.nombre.trim(),
          anchoMm: Number(draft.anchoMm),
          altoMm: Number(draft.altoMm),
          tipoImpresion: draft.tipoImpresion,
          caras: draft.caras,
          activo: true,
        });
        await updateVarianteOpcionesProductivas(created.id, {
          dimensiones: buildOpcionesDimensiones(draft),
        });
        await props.refreshVariantes();
        props.setSelectedVariantId(created.id);
        setDraft(createDraft(availableTiposCopia));
        toast.success("Variante creada.");
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "No se pudo crear la variante.");
      }
    });
  };

  const handleSaveEditVariante = () => {
    if (!editingVariante) return;
    if (!editDraft.nombre.trim()) {
      toast.error("El nombre de variante es obligatorio.");
      return;
    }
    startUpdatingVariante(async () => {
      try {
        await updateProductoVariante(editingVariante.id, {
          nombre: editDraft.nombre.trim(),
          anchoMm: Number(editDraft.anchoMm),
          altoMm: Number(editDraft.altoMm),
          tipoImpresion: editDraft.tipoImpresion,
          caras: editDraft.caras,
        });
        await updateVarianteOpcionesProductivas(editingVariante.id, {
          dimensiones: buildOpcionesDimensiones(editDraft),
        });
        await props.refreshVariantes();
        props.setSelectedVariantId(editingVariante.id);
        setEditingVarianteId("");
        toast.success("Variante actualizada.");
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "No se pudo editar la variante.");
      }
    });
  };

  const handleDeleteVariante = (variante: ProductTabProps["variantes"][number]) => {
    startDeletingVariante(async () => {
      try {
        await deleteProductoVariante(variante.id);
        await props.refreshVariantes();
        if (props.selectedVariantId === variante.id) {
          props.setSelectedVariantId("");
        }
        toast.success("Variante eliminada.");
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "No se pudo eliminar la variante.");
      }
    });
  };

  const handleToggleVariante = (variante: ProductTabProps["variantes"][number], active: boolean) => {
    startTogglingVariante(async () => {
      try {
        await updateProductoVariante(variante.id, { activo: active });
        await props.refreshVariantes();
        toast.success(active ? "Variante activada." : "Variante desactivada.");
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "No se pudo actualizar.");
      }
    });
  };

  const toggleTipoCopia = (d: TalonarioVarianteDraft, valor: TipoCopiaValor, checked: boolean) => {
    const next = checked
      ? [...d.tiposCopiaPermitidos.filter((v) => v !== valor), valor]
      : d.tiposCopiaPermitidos.filter((v) => v !== valor);
    return { ...d, tiposCopiaPermitidos: next };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Variantes del talonario</CardTitle>
        <CardDescription>
          Cada variante define un tamaño de talonario y qué tipos de copia soporta.
          Los papeles por capa se definen en la tab de Composición.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Medida</TableHead>
              <TableHead>Impresión</TableHead>
              <TableHead>Tipos de copia</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.variantes.map((item) => {
              const tiposCopia =
                item.opcionesProductivas
                  ?.find((entry) => entry.dimension === "tipo_copia")
                  ?.valores.filter(
                    (v): v is TipoCopiaValor =>
                      v === "copia_simple" || v === "duplicado" || v === "triplicado" || v === "cuadruplicado",
                  ) ?? [];
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.nombre}</TableCell>
                  <TableCell>{item.anchoMm} × {item.altoMm} mm</TableCell>
                  <TableCell>
                    <span className="text-xs">
                      {TIPO_IMPRESION_LABELS[item.tipoImpresion] ?? item.tipoImpresion}{" / "}
                      {CARAS_LABELS[item.caras] ?? item.caras}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {tiposCopia.length > 0
                        ? tiposCopia.map((tc) => (
                            <Badge key={tc} variant="secondary" className="text-xs">
                              {TIPO_COPIA_LABELS[tc] ?? tc}
                            </Badge>
                          ))
                        : <span className="text-xs text-muted-foreground">Sin definir</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={item.activo}
                        disabled={isTogglingVariante}
                        onCheckedChange={(checked) => handleToggleVariante(item, Boolean(checked))}
                      />
                      <span className="text-xs text-muted-foreground">{item.activo ? "Activa" : "Inactiva"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button" size="sm" variant="secondary"
                        disabled={isUpdatingVariante}
                        onClick={() => {
                          setEditingVarianteId(item.id);
                          setEditDraft(createEditDraft(item, availableTiposCopia));
                        }}
                      >
                        <PencilIcon className="size-4" />
                      </Button>
                      <Button
                        type="button" size="sm" variant="destructive"
                        disabled={isDeletingVariante || isUpdatingVariante}
                        onClick={() => handleDeleteVariante(item)}
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {!props.variantes.length && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  Este producto todavía no tiene variantes. Creá una para habilitar los tabs técnicos.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Create / Edit form */}
        <div className="rounded-lg border p-4">
          <p className="mb-3 text-sm font-medium">
            {isEditingVariante ? "Editar variante" : "Crear variante"}
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <Field>
              <FieldLabel>Nombre</FieldLabel>
              <Input
                value={activeDraft.nombre}
                onChange={(e) => setActiveDraft((prev) => ({ ...prev, nombre: e.target.value }))}
                placeholder="Ej: Factura A5"
              />
            </Field>
            <Field>
              <FieldLabel>Ancho (mm)</FieldLabel>
              <Input
                type="number"
                value={activeDraft.anchoMm}
                onChange={(e) => setActiveDraft((prev) => ({ ...prev, anchoMm: e.target.value }))}
              />
            </Field>
            <Field>
              <FieldLabel>Alto (mm)</FieldLabel>
              <Input
                type="number"
                value={activeDraft.altoMm}
                onChange={(e) => setActiveDraft((prev) => ({ ...prev, altoMm: e.target.value }))}
              />
            </Field>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Field>
              <FieldLabel>Tipo de impresión</FieldLabel>
              <Select
                value={activeDraft.tipoImpresion}
                onValueChange={(v) => v && setActiveDraft((prev) => ({ ...prev, tipoImpresion: v as "bn" | "cmyk" }))}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cmyk">CMYK (Color)</SelectItem>
                  <SelectItem value="bn">K (Escala de grises)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Caras</FieldLabel>
              <Select
                value={activeDraft.caras}
                onValueChange={(v) => v && setActiveDraft((prev) => ({ ...prev, caras: v as "simple_faz" | "doble_faz" }))}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple_faz">Simple faz</SelectItem>
                  <SelectItem value="doble_faz">Doble faz</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          {/* Tipos de copia permitidos */}
          <div className="mt-3">
            <FieldLabel>Tipos de copia permitidos</FieldLabel>
            {availableTiposCopia.length === 0 ? (
              <p className="text-xs text-muted-foreground mt-1">
                No hay tipos de copia definidos en la composición del producto.
                Configuralos primero en la tab Composición.
              </p>
            ) : (
              <div className="flex flex-wrap gap-3 mt-1">
                {availableTiposCopia.map((tc) => (
                  <label key={tc} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeDraft.tiposCopiaPermitidos.includes(tc)}
                      onChange={(e) =>
                        setActiveDraft((prev) => toggleTipoCopia(prev, tc, e.target.checked))
                      }
                      className="rounded border-input"
                    />
                    {TIPO_COPIA_LABELS[tc]}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            {isEditingVariante ? (
              <>
                <Button type="button" onClick={handleSaveEditVariante} disabled={isUpdatingVariante}>
                  <SaveIcon className="mr-2 size-4" /> Guardar cambios
                </Button>
                <Button type="button" variant="ghost" onClick={() => setEditingVarianteId("")}>
                  Cancelar
                </Button>
              </>
            ) : (
              <Button type="button" onClick={handleCreateVariante} disabled={isSavingVariante}>
                <PlusIcon className="mr-2 size-4" /> Crear variante
              </Button>
            )}
          </div>
        </div>

        {/* Composition override panel - only when editing */}
        {isEditingVariante && editingVariante && (
          <ComposicionOverridePanel varianteId={editingVariante.id} />
        )}
      </CardContent>
    </Card>
  );
}

// ── Composicion Override Panel ──────────────────────────────────────

const BORDES = [
  { value: "superior", label: "Superior" },
  { value: "inferior", label: "Inferior" },
  { value: "izquierdo", label: "Izquierdo" },
  { value: "derecho", label: "Derecho" },
];
const BORDES_LABEL = new Map(BORDES.map((b) => [b.value, b.label]));
const POSICIONES_BROCHES = [
  { value: "superior", label: "Superior" },
  { value: "lateral", label: "Lateral" },
];
const POSICIONES_BROCHES_LABEL = new Map(POSICIONES_BROCHES.map((p) => [p.value, p.label]));

type ComposicionOverride = {
  encuadernacion?: {
    tipo: "abrochado" | "emblocado";
    cantidadGrapas?: number | null;
    posicionGrapas?: string | null;
    bordeEncolar?: string | null;
  };
  puntillado?: {
    habilitado: boolean;
    tipo?: string | null;
    distanciaBordeMm?: number | null;
    borde?: string | null;
  };
  modoTalonarioIncompleto?: "aprovechar_pliego" | "pose_completa";
};

function ComposicionOverridePanel({ varianteId }: { varianteId: string }) {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [override, setOverride] = React.useState<ComposicionOverride>({});
  const [overrideFields, setOverrideFields] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getVarianteMotorOverride(varianteId)
      .then((res) => {
        if (cancelled) return;
        const params = (res.parametros ?? {}) as Record<string, unknown>;
        const fields = new Set<string>();
        const ov: ComposicionOverride = {};
        if (params.encuadernacion) { ov.encuadernacion = params.encuadernacion as ComposicionOverride["encuadernacion"]; fields.add("encuadernacion"); }
        if (params.puntillado) { ov.puntillado = params.puntillado as ComposicionOverride["puntillado"]; fields.add("puntillado"); }
        if (params.modoTalonarioIncompleto) { ov.modoTalonarioIncompleto = params.modoTalonarioIncompleto as ComposicionOverride["modoTalonarioIncompleto"]; fields.add("modoTalonarioIncompleto"); }
        setOverride(ov);
        setOverrideFields(fields);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [varianteId]);

  const toggleField = (field: string, enabled: boolean) => {
    setOverrideFields((prev) => {
      const next = new Set(prev);
      if (enabled) next.add(field); else next.delete(field);
      return next;
    });
    if (!enabled) {
      setOverride((prev) => {
        const next = { ...prev };
        delete next[field as keyof ComposicionOverride];
        return next;
      });
    } else {
      // Initialize with defaults
      if (field === "encuadernacion" && !override.encuadernacion) {
        setOverride((prev) => ({ ...prev, encuadernacion: { tipo: "abrochado", cantidadGrapas: 2, posicionGrapas: "superior", bordeEncolar: null } }));
      }
      if (field === "puntillado" && !override.puntillado) {
        setOverride((prev) => ({ ...prev, puntillado: { habilitado: false, tipo: "lateral", distanciaBordeMm: 30, borde: "superior" } }));
      }
      if (field === "modoTalonarioIncompleto" && !override.modoTalonarioIncompleto) {
        setOverride((prev) => ({ ...prev, modoTalonarioIncompleto: "pose_completa" }));
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const params: Record<string, unknown> = {};
      if (overrideFields.has("encuadernacion") && override.encuadernacion) params.encuadernacion = override.encuadernacion;
      if (overrideFields.has("puntillado") && override.puntillado) params.puntillado = override.puntillado;
      if (overrideFields.has("modoTalonarioIncompleto") && override.modoTalonarioIncompleto) params.modoTalonarioIncompleto = override.modoTalonarioIncompleto;
      await upsertVarianteMotorOverride(varianteId, params);
      toast.success("Override de composición guardado.");
    } catch {
      toast.error("Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2Icon className="size-4 animate-spin" /> Cargando override...</div>;
  }

  return (
    <div className="mt-4 space-y-3">
      <Separator />
      <p className="text-sm font-medium">Personalizar composición de esta variante</p>
      <p className="text-xs text-muted-foreground">Si no se personaliza, hereda la configuración del producto.</p>

      {/* Encuadernación */}
      <div className="rounded-lg border p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Switch checked={overrideFields.has("encuadernacion")} onCheckedChange={(v) => toggleField("encuadernacion", Boolean(v))} />
          <span className="text-sm font-medium">Encuadernación</span>
          {!overrideFields.has("encuadernacion") && <span className="text-xs text-muted-foreground">(hereda del producto)</span>}
        </div>
        {overrideFields.has("encuadernacion") && override.encuadernacion && (
          <div className="ml-8 space-y-2">
            <div className="flex items-center gap-3">
              <Select value={override.encuadernacion.tipo} onValueChange={(v) => v && setOverride((p) => ({ ...p, encuadernacion: { ...p.encuadernacion!, tipo: v as "abrochado" | "emblocado" } }))}>
                <SelectTrigger className="w-44 h-8 text-xs">
                  <SelectValue>{override.encuadernacion.tipo === "abrochado" ? "Abrochado (grapas)" : "Emblocado (cola)"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="abrochado">Abrochado (grapas)</SelectItem>
                  <SelectItem value="emblocado">Emblocado (cola)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {override.encuadernacion.tipo === "abrochado" && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Grapas</span>
                  <Input type="number" className="w-14 h-7 text-xs" value={override.encuadernacion.cantidadGrapas ?? 2}
                    onChange={(e) => setOverride((p) => ({ ...p, encuadernacion: { ...p.encuadernacion!, cantidadGrapas: parseInt(e.target.value) || 2 } }))} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Posición</span>
                  <Select value={override.encuadernacion.posicionGrapas ?? "superior"} onValueChange={(v) => v && setOverride((p) => ({ ...p, encuadernacion: { ...p.encuadernacion!, posicionGrapas: v } }))}>
                    <SelectTrigger className="w-24 h-7 text-xs"><SelectValue>{POSICIONES_BROCHES_LABEL.get(override.encuadernacion.posicionGrapas ?? "superior")}</SelectValue></SelectTrigger>
                    <SelectContent>{POSICIONES_BROCHES.map((p) => <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            )}
            {override.encuadernacion.tipo === "emblocado" && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Borde a encolar</span>
                <Select value={override.encuadernacion.bordeEncolar ?? "superior"} onValueChange={(v) => v && setOverride((p) => ({ ...p, encuadernacion: { ...p.encuadernacion!, bordeEncolar: v } }))}>
                  <SelectTrigger className="w-24 h-7 text-xs"><SelectValue>{BORDES_LABEL.get(override.encuadernacion.bordeEncolar ?? "superior")}</SelectValue></SelectTrigger>
                  <SelectContent>{BORDES.map((b) => <SelectItem key={b.value} value={b.value} className="text-xs">{b.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Puntillado */}
      <div className="rounded-lg border p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Switch checked={overrideFields.has("puntillado")} onCheckedChange={(v) => toggleField("puntillado", Boolean(v))} />
          <span className="text-sm font-medium">Puntillado</span>
          {!overrideFields.has("puntillado") && <span className="text-xs text-muted-foreground">(hereda del producto)</span>}
        </div>
        {overrideFields.has("puntillado") && override.puntillado && (
          <div className="ml-8 space-y-2">
            <div className="flex items-center gap-2">
              <Switch checked={override.puntillado.habilitado} onCheckedChange={(v) => setOverride((p) => ({ ...p, puntillado: { ...p.puntillado!, habilitado: Boolean(v) } }))} />
              <span className="text-xs">Habilitado</span>
            </div>
            {override.puntillado.habilitado && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Borde</span>
                  <Select value={override.puntillado.borde ?? "superior"} onValueChange={(v) => v && setOverride((p) => ({ ...p, puntillado: { ...p.puntillado!, borde: v } }))}>
                    <SelectTrigger className="w-24 h-7 text-xs"><SelectValue>{BORDES_LABEL.get(override.puntillado.borde ?? "superior")}</SelectValue></SelectTrigger>
                    <SelectContent>{BORDES.map((b) => <SelectItem key={b.value} value={b.value} className="text-xs">{b.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Distancia (mm)</span>
                  <Input type="number" className="w-16 h-7 text-xs" value={override.puntillado.distanciaBordeMm ?? 30}
                    onChange={(e) => setOverride((p) => ({ ...p, puntillado: { ...p.puntillado!, distanciaBordeMm: parseFloat(e.target.value) || 30 } }))} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modo incompleto */}
      <div className="rounded-lg border p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Switch checked={overrideFields.has("modoTalonarioIncompleto")} onCheckedChange={(v) => toggleField("modoTalonarioIncompleto", Boolean(v))} />
          <span className="text-sm font-medium">Modo talonario incompleto</span>
          {!overrideFields.has("modoTalonarioIncompleto") && <span className="text-xs text-muted-foreground">(hereda del producto)</span>}
        </div>
        {overrideFields.has("modoTalonarioIncompleto") && (
          <div className="ml-8">
            <Select value={override.modoTalonarioIncompleto ?? "pose_completa"} onValueChange={(v) => v && setOverride((p) => ({ ...p, modoTalonarioIncompleto: v as "aprovechar_pliego" | "pose_completa" }))}>
              <SelectTrigger className="w-56 h-7 text-xs">
                <SelectValue>{override.modoTalonarioIncompleto === "aprovechar_pliego" ? "Aprovechar pliego" : "Pose completa (desperdicio)"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pose_completa" className="text-xs">Pose completa (desperdicio)</SelectItem>
                <SelectItem value="aprovechar_pliego" className="text-xs">Aprovechar pliego (dividir)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
        {saving ? <Loader2Icon className="mr-2 size-3 animate-spin" /> : <SaveIcon className="mr-2 size-3" />}
        Guardar override de composición
      </Button>
    </div>
  );
}
