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
} from "@/lib/productos-servicios-api";
import type { DimensionOpcionProductiva, ValorOpcionProductiva } from "@/lib/productos-servicios";

// ── Types ──────────────────────────────────────────────────────────

type TipoCopiaValor = "copia_simple" | "duplicado" | "triplicado" | "cuadruplicado";

const TIPO_COPIA_LABELS: Record<TipoCopiaValor, string> = {
  copia_simple: "Simple",
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
      </CardContent>
    </Card>
  );
}
