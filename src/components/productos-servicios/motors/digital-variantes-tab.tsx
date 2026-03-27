"use client";

import * as React from "react";
import { PencilIcon, PlusIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import type { ProductTabProps } from "@/components/productos-servicios/product-detail-types";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getMateriaPrimaVarianteLabel } from "@/lib/materias-primas-variantes-display";
import {
  assignProductoVarianteRuta,
  createProductoVariante,
  deleteProductoVariante,
  updateProductoRutaPolicy,
  updateProductoVariante,
  updateVarianteOpcionesProductivas,
} from "@/lib/productos-servicios-api";
import type {
  DimensionOpcionProductiva,
  ProductoRutaBaseMatchingItem,
} from "@/lib/productos-servicios";

type PapelOption = {
  id: string;
  label: string;
};

type VarianteDraft = {
  nombre: string;
  anchoMm: string;
  altoMm: string;
  papelVarianteId: string;
  tipoImpresion: "bn" | "cmyk";
  caras: "simple_faz" | "doble_faz";
  opcionesTipoImpresion: Array<"bn" | "cmyk">;
  opcionesCaras: Array<"simple_faz" | "doble_faz">;
};

const tipoImpresionPermitidoSelectItems = [
  { value: "cmyk", label: "Solo CMYK", values: ["cmyk"] as Array<"bn" | "cmyk"> },
  { value: "bn", label: "Solo K", values: ["bn"] as Array<"bn" | "cmyk"> },
  { value: "cmyk_bn", label: "CMYK y K", values: ["cmyk", "bn"] as Array<"bn" | "cmyk"> },
];

const carasPermitidasSelectItems = [
  { value: "simple_faz", label: "Solo simple faz", values: ["simple_faz"] as Array<"simple_faz" | "doble_faz"> },
  { value: "doble_faz", label: "Solo doble faz", values: ["doble_faz"] as Array<"simple_faz" | "doble_faz"> },
  { value: "simple_doble", label: "Simple y doble faz", values: ["simple_faz", "doble_faz"] as Array<"simple_faz" | "doble_faz"> },
];

function createVarianteDraft(papeles: PapelOption[]): VarianteDraft {
  return {
    nombre: "",
    anchoMm: "90",
    altoMm: "50",
    papelVarianteId: papeles[0]?.id ?? "",
    tipoImpresion: "cmyk",
    caras: "simple_faz",
    opcionesTipoImpresion: ["cmyk"],
    opcionesCaras: ["simple_faz"],
  };
}

function createEditVarianteDraft(variante: ProductTabProps["variantes"][number], papeles: PapelOption[]): VarianteDraft {
  const opcionesTipoImpresion =
    variante.opcionesProductivas?.find((item) => item.dimension === "tipo_impresion")?.valores.filter(
      (value): value is "bn" | "cmyk" => value === "bn" || value === "cmyk",
    ) ?? [variante.tipoImpresion];
  const opcionesCaras =
    variante.opcionesProductivas?.find((item) => item.dimension === "caras")?.valores.filter(
      (value): value is "simple_faz" | "doble_faz" => value === "simple_faz" || value === "doble_faz",
    ) ?? [variante.caras];
  return {
    nombre: variante.nombre,
    anchoMm: String(variante.anchoMm),
    altoMm: String(variante.altoMm),
    papelVarianteId: variante.papelVarianteId ?? papeles[0]?.id ?? "",
    tipoImpresion: variante.tipoImpresion,
    caras: variante.caras,
    opcionesTipoImpresion: opcionesTipoImpresion.length ? opcionesTipoImpresion : [variante.tipoImpresion],
    opcionesCaras: opcionesCaras.length ? opcionesCaras : [variante.caras],
  };
}

function getTipoImpresionPermitidoSelectValue(values: Array<"bn" | "cmyk">) {
  const normalized = [...new Set(values)].sort().join("|");
  if (normalized === "bn") return "bn";
  if (normalized === "bn|cmyk") return "cmyk_bn";
  return "cmyk";
}

function getCarasPermitidasSelectValue(values: Array<"simple_faz" | "doble_faz">) {
  const normalized = [...new Set(values)].sort().join("|");
  if (normalized === "doble_faz") return "doble_faz";
  if (normalized === "doble_faz|simple_faz") return "simple_doble";
  return "simple_faz";
}

function buildPapelOptions(materiasPrimas: ProductTabProps["materiasPrimas"]): PapelOption[] {
  const items: PapelOption[] = [];
  for (const mp of materiasPrimas) {
    if (mp.subfamilia !== "sustrato_hoja") continue;
    for (const variante of mp.variantes) {
      items.push({
        id: variante.id,
        label: getMateriaPrimaVarianteLabel(mp, variante, { maxDimensiones: 6 }),
      });
    }
  }
  return items.sort((a, b) => a.label.localeCompare(b.label));
}

function buildMatchingCombinationKeys(
  dimensionesBaseConsumidas: DimensionOpcionProductiva[],
  draft: Pick<VarianteDraft, "opcionesTipoImpresion" | "opcionesCaras">,
) {
  const tipos = dimensionesBaseConsumidas.includes("tipo_impresion") ? draft.opcionesTipoImpresion : [null];
  const caras = dimensionesBaseConsumidas.includes("caras") ? draft.opcionesCaras : [null];
  return tipos.flatMap((tipoImpresion) =>
    caras.map((carasValue) => ({
      tipoImpresion,
      caras: carasValue,
      key: `${tipoImpresion ?? "na"}:${carasValue ?? "na"}`,
    })),
  );
}

function buildMatchingKey(item: {
  tipoImpresion?: "bn" | "cmyk" | null;
  caras?: "simple_faz" | "doble_faz" | null;
}) {
  return `${item.tipoImpresion ?? "na"}:${item.caras ?? "na"}`;
}

function getTipoImpresionPermitidoLabel(values: Array<"bn" | "cmyk">) {
  return (
    tipoImpresionPermitidoSelectItems.find((item) => item.value === getTipoImpresionPermitidoSelectValue(values))
      ?.label ?? "Solo CMYK"
  );
}

function getCarasPermitidasLabel(values: Array<"simple_faz" | "doble_faz">) {
  return (
    carasPermitidasSelectItems.find((item) => item.value === getCarasPermitidasSelectValue(values))?.label ??
    "Solo simple faz"
  );
}

export function DigitalVariantesTab(props: ProductTabProps) {
  const papeles = React.useMemo(() => buildPapelOptions(props.materiasPrimas), [props.materiasPrimas]);
  const papelLabelById = React.useMemo(() => new Map(papeles.map((item) => [item.id, item.label])), [papeles]);
  const dimensionesBaseConsumidas = props.producto.dimensionesBaseConsumidas ?? [];
  const [draft, setDraft] = React.useState<VarianteDraft>(() => createVarianteDraft(papeles));
  const [editingVarianteId, setEditingVarianteId] = React.useState("");
  const [editDraft, setEditDraft] = React.useState<VarianteDraft>(() => createVarianteDraft(papeles));
  const [isSavingVariante, startSavingVariante] = React.useTransition();
  const [isUpdatingVariante, startUpdatingVariante] = React.useTransition();
  const [isTogglingVariante, startTogglingVariante] = React.useTransition();
  const [isDeletingVariante, startDeletingVariante] = React.useTransition();

  React.useEffect(() => {
    if (!draft.papelVarianteId && papeles[0]?.id) {
      setDraft((prev) => ({ ...prev, papelVarianteId: papeles[0]?.id ?? "" }));
    }
  }, [draft.papelVarianteId, papeles]);

  const syncRutaBaseForVariant = React.useCallback(
    async (varianteId: string, varianteDraft: VarianteDraft) => {
      const dimensionesBaseConsumidas = props.producto.dimensionesBaseConsumidas ?? [];
      const productoMatching = props.producto.matchingBasePorVariante ?? [];
      const productoPasosFijos = props.producto.pasosFijosPorVariante ?? [];

      let variantesActuales = await props.refreshVariantes();
      let varianteActual = variantesActuales.find((item) => item.id === varianteId) ?? null;
      if (!varianteActual) return;

      if (!props.producto.usarRutaComunVariantes && !varianteActual.procesoDefinicionId) {
        const referenciaRuta =
          props.variantes.find((item) => item.id === props.selectedVariantId && item.id !== varianteId && item.procesoDefinicionId)?.procesoDefinicionId ??
          props.variantes.find((item) => item.id !== varianteId && item.procesoDefinicionId)?.procesoDefinicionId ??
          null;
        if (referenciaRuta) {
          await assignProductoVarianteRuta(varianteId, referenciaRuta);
          variantesActuales = await props.refreshVariantes();
          varianteActual = variantesActuales.find((item) => item.id === varianteId) ?? varianteActual;
        }
      }

      const procesoObjetivo = props.producto.usarRutaComunVariantes
        ? props.producto.procesoDefinicionDefaultId ?? null
        : varianteActual.procesoDefinicionId ?? null;

      const varianteIdsReferencia = new Set(
        variantesActuales
          .filter((item) => item.id !== varianteId)
          .filter((item) => {
            if (props.producto.usarRutaComunVariantes) return true;
            return (item.procesoDefinicionId ?? null) === procesoObjetivo;
          })
          .map((item) => item.id),
      );

      const combos = buildMatchingCombinationKeys(dimensionesBaseConsumidas, varianteDraft);
      const currentOwnMatching =
        productoMatching.find((item) => item.varianteId === varianteId)?.matching.map((item) => ({ ...item })) ?? [];
      const referenceMatchingIndex = new Map<string, ProductoRutaBaseMatchingItem>();
      for (const variantMatching of productoMatching) {
        if (!varianteIdsReferencia.has(variantMatching.varianteId)) continue;
        for (const row of variantMatching.matching) {
          const key = buildMatchingKey(row);
          if (!referenceMatchingIndex.has(key)) {
            referenceMatchingIndex.set(key, row);
          }
        }
      }
      const ownMatchingIndex = new Map(
        currentOwnMatching.map((row) => [buildMatchingKey(row), row] as const),
      );

      const nextTargetMatching = combos
        .map((combo) => {
          const source = ownMatchingIndex.get(combo.key) ?? referenceMatchingIndex.get(combo.key) ?? null;
          if (!source) return null;
          return {
            tipoImpresion: combo.tipoImpresion,
            caras: combo.caras,
            pasoPlantillaId: source.pasoPlantillaId,
            perfilOperativoId: source.perfilOperativoId,
          };
        })
        .filter(
          (
            item,
          ): item is {
            tipoImpresion: "bn" | "cmyk" | null;
            caras: "simple_faz" | "doble_faz" | null;
            pasoPlantillaId: string;
            perfilOperativoId: string;
          } => Boolean(item?.pasoPlantillaId && item?.perfilOperativoId),
        );

      const currentOwnPasos =
        productoPasosFijos.find((item) => item.varianteId === varianteId)?.pasos.map((item) => ({
          pasoPlantillaId: item.pasoPlantillaId,
          perfilOperativoId: item.perfilOperativoId,
        })) ?? [];
      let nextTargetPasos = currentOwnPasos;
      if (!nextTargetPasos.length) {
        const referenciaPasos =
          productoPasosFijos.find((item) => varianteIdsReferencia.has(item.varianteId) && item.pasos.length > 0)?.pasos ??
          [];
        nextTargetPasos = referenciaPasos.map((item) => ({
          pasoPlantillaId: item.pasoPlantillaId,
          perfilOperativoId: item.perfilOperativoId,
        }));
      }

      const matchingBasePorVariante = variantesActuales.map((item) => ({
        varianteId: item.id,
        matching:
          item.id === varianteId
            ? nextTargetMatching
            : (productoMatching.find((row) => row.varianteId === item.id)?.matching ?? []).map((row) => ({
                tipoImpresion: row.tipoImpresion ?? undefined,
                caras: row.caras ?? undefined,
                pasoPlantillaId: row.pasoPlantillaId,
                perfilOperativoId: row.perfilOperativoId,
              })),
      }));

      const pasosFijosPorVariante = variantesActuales.map((item) => ({
        varianteId: item.id,
        pasos:
          item.id === varianteId
            ? nextTargetPasos
            : (productoPasosFijos.find((row) => row.varianteId === item.id)?.pasos ?? []).map((row) => ({
                pasoPlantillaId: row.pasoPlantillaId,
                perfilOperativoId: row.perfilOperativoId,
              })),
      }));

      if (dimensionesBaseConsumidas.length || nextTargetPasos.length) {
        await updateProductoRutaPolicy(props.producto.id, {
          usarRutaComunVariantes: props.producto.usarRutaComunVariantes,
          procesoDefinicionDefaultId: props.producto.procesoDefinicionDefaultId,
          dimensionesBaseConsumidas,
          matchingBasePorVariante,
          pasosFijosPorVariante,
        });
        await props.refreshProducto();
      }

      if (dimensionesBaseConsumidas.length && nextTargetMatching.length === 0) {
        toast.warning("La variante se guardó, pero faltan filas de matching en Ruta base para completar la cotización.");
      }
    },
    [props],
  );

  const editingVariante = React.useMemo(
    () => props.variantes.find((item) => item.id === editingVarianteId) ?? null,
    [editingVarianteId, props.variantes],
  );
  const isEditingVariante = Boolean(editingVariante);
  const formDraft = isEditingVariante ? editDraft : draft;
  const setFormDraft = (updater: (prev: VarianteDraft) => VarianteDraft) => {
    if (isEditingVariante) {
      setEditDraft((prev) => updater(prev));
      return;
    }
    setDraft((prev) => updater(prev));
  };

  const handleCreateVariante = () => {
    if (!draft.nombre.trim()) {
      toast.error("El nombre de variante es obligatorio.");
      return;
    }
    startSavingVariante(async () => {
      try {
        const created = await createProductoVariante(props.producto.id, {
          nombre: draft.nombre.trim(),
          anchoMm: Number(draft.anchoMm),
          altoMm: Number(draft.altoMm),
          papelVarianteId: draft.papelVarianteId || undefined,
          tipoImpresion: draft.tipoImpresion,
          caras: draft.caras,
          activo: true,
        });
        const opciones = await updateVarianteOpcionesProductivas(created.id, {
          dimensiones: [
            { dimension: "tipo_impresion" as const, valores: draft.opcionesTipoImpresion },
            { dimension: "caras" as const, valores: draft.opcionesCaras },
          ],
        });
        await syncRutaBaseForVariant(created.id, draft);
        await props.refreshVariantes();
        props.setSelectedVariantId(created.id);
        setDraft(createVarianteDraft(papeles));
        if (!opciones) {
          return;
        }
        toast.success("Variante creada.");
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "No se pudo crear la variante.");
      }
    });
  };

  const handleStartEditVariante = (variante: ProductTabProps["variantes"][number]) => {
    setEditingVarianteId(variante.id);
    setEditDraft(createEditVarianteDraft(variante, papeles));
  };

  const handleSaveEditVariante = () => {
    if (!editingVariante) {
      toast.error("Seleccioná una variante para editar.");
      return;
    }
    if (!editDraft.nombre.trim()) {
      toast.error("El nombre de variante es obligatorio.");
      return;
    }
    startUpdatingVariante(async () => {
      try {
        const updated = await updateProductoVariante(editingVariante.id, {
          nombre: editDraft.nombre.trim(),
          anchoMm: Number(editDraft.anchoMm),
          altoMm: Number(editDraft.altoMm),
          papelVarianteId: editDraft.papelVarianteId || undefined,
          tipoImpresion: editDraft.tipoImpresion,
          caras: editDraft.caras,
        });
        await updateVarianteOpcionesProductivas(updated.id, {
          dimensiones: [
            { dimension: "tipo_impresion" as const, valores: editDraft.opcionesTipoImpresion },
            { dimension: "caras" as const, valores: editDraft.opcionesCaras },
          ],
        });
        await syncRutaBaseForVariant(updated.id, editDraft);
        await props.refreshVariantes();
        props.setSelectedVariantId(updated.id);
        setEditingVarianteId("");
        toast.success("Variante actualizada.");
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "No se pudo editar la variante.");
      }
    });
  };

  const handleCancelEditVariante = () => {
    setEditingVarianteId("");
    setEditDraft(createVarianteDraft(papeles));
  };

  const handleToggleVariante = (variante: ProductTabProps["variantes"][number], active: boolean) => {
    startTogglingVariante(async () => {
      try {
        await updateProductoVariante(variante.id, { activo: active });
        await props.refreshVariantes();
        toast.success(active ? "Variante activada." : "Variante desactivada.");
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "No se pudo actualizar la variante.");
      }
    });
  };

  const handleDeleteVariante = (variante: ProductTabProps["variantes"][number]) => {
    startDeletingVariante(async () => {
      try {
        await deleteProductoVariante(variante.id);
        const refreshed = await props.refreshVariantes();
        if (props.selectedVariantId === variante.id) {
          props.setSelectedVariantId(refreshed[0]?.id ?? "");
        }
        if (editingVarianteId === variante.id) {
          setEditingVarianteId("");
        }
        toast.success("Variante eliminada.");
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "No se pudo eliminar la variante.");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Variantes</CardTitle>
        <CardDescription>Administrá medidas, papel y opciones productivas propias de impresión digital.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Medida</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Tipo de impresión permitido</TableHead>
              <TableHead>Caras permitidas</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.variantes.map((item) => {
              const opcionesTipoImpresion =
                item.opcionesProductivas?.find((entry) => entry.dimension === "tipo_impresion")?.valores.filter(
                  (value): value is "bn" | "cmyk" => value === "bn" || value === "cmyk",
                ) ?? [item.tipoImpresion];
              const opcionesCaras =
                item.opcionesProductivas?.find((entry) => entry.dimension === "caras")?.valores.filter(
                  (value): value is "simple_faz" | "doble_faz" => value === "simple_faz" || value === "doble_faz",
                ) ?? [item.caras];
              return (
              <TableRow key={item.id}>
                <TableCell>{item.nombre}</TableCell>
                <TableCell>{item.anchoMm} × {item.altoMm} mm</TableCell>
                <TableCell>{(papelLabelById.get(item.papelVarianteId ?? "") ?? item.papelNombre) || "-"}</TableCell>
                <TableCell>{getTipoImpresionPermitidoLabel(opcionesTipoImpresion)}</TableCell>
                <TableCell>{getCarasPermitidasLabel(opcionesCaras)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch checked={item.activo} disabled={isTogglingVariante} onCheckedChange={(checked) => handleToggleVariante(item, Boolean(checked))} />
                    <span className="text-xs text-muted-foreground">{item.activo ? "Activa" : "Inactiva"}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button type="button" size="sm" variant="secondary" disabled={isUpdatingVariante} onClick={() => handleStartEditVariante(item)} aria-label={`Editar variante ${item.nombre}`}>
                      <PencilIcon className="size-4" />
                    </Button>
                    <Button type="button" size="sm" variant="destructive" disabled={isDeletingVariante || isUpdatingVariante} onClick={() => handleDeleteVariante(item)} aria-label={`Eliminar variante ${item.nombre}`}>
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )})}
            {!props.variantes.length ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  Este producto todavía no tiene variantes. Creá una para habilitar los tabs técnicos.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>

        <div className="rounded-lg border p-4">
          <p className="mb-3 text-sm font-medium">{isEditingVariante ? "Editar variante" : "Crear variante"}</p>
          <div className="grid gap-3 md:grid-cols-3">
            <Field>
              <FieldLabel>Nombre</FieldLabel>
              <Input value={formDraft.nombre} onChange={(e) => setFormDraft((prev) => ({ ...prev, nombre: e.target.value }))} placeholder="Ej: Estándar 9x5" />
            </Field>
            <Field>
              <FieldLabel>Ancho (mm)</FieldLabel>
              <Input value={formDraft.anchoMm} onChange={(e) => setFormDraft((prev) => ({ ...prev, anchoMm: e.target.value }))} />
            </Field>
            <Field>
              <FieldLabel>Alto (mm)</FieldLabel>
              <Input value={formDraft.altoMm} onChange={(e) => setFormDraft((prev) => ({ ...prev, altoMm: e.target.value }))} />
            </Field>
            <Field>
              <FieldLabel>Papel</FieldLabel>
              <Select value={formDraft.papelVarianteId} onValueChange={(value) => setFormDraft((prev) => ({ ...prev, papelVarianteId: value ?? "" }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar papel">{papelLabelById.get(formDraft.papelVarianteId) ?? ""}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {papeles.map((papel) => (
                    <SelectItem key={papel.id} value={papel.id}>
                      {papel.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Tipo de impresión permitido</FieldLabel>
              <Select
                value={getTipoImpresionPermitidoSelectValue(formDraft.opcionesTipoImpresion)}
                onValueChange={(value) =>
                  setFormDraft((prev) => {
                    const selected = tipoImpresionPermitidoSelectItems.find((item) => item.value === value) ?? tipoImpresionPermitidoSelectItems[0];
                    return {
                      ...prev,
                      opcionesTipoImpresion: selected.values,
                      tipoImpresion: selected.values.includes(prev.tipoImpresion) ? prev.tipoImpresion : selected.values[0],
                    };
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una opción">
                    {tipoImpresionPermitidoSelectItems.find((item) => item.value === getTipoImpresionPermitidoSelectValue(formDraft.opcionesTipoImpresion))?.label ?? "Selecciona una opción"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {tipoImpresionPermitidoSelectItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Caras permitidas</FieldLabel>
              <Select
                value={getCarasPermitidasSelectValue(formDraft.opcionesCaras)}
                onValueChange={(value) =>
                  setFormDraft((prev) => {
                    const selected = carasPermitidasSelectItems.find((item) => item.value === value) ?? carasPermitidasSelectItems[0];
                    return {
                      ...prev,
                      opcionesCaras: selected.values,
                      caras: selected.values.includes(prev.caras) ? prev.caras : selected.values[0],
                    };
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una opción">
                    {carasPermitidasSelectItems.find((item) => item.value === getCarasPermitidasSelectValue(formDraft.opcionesCaras))?.label ?? "Selecciona una opción"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {carasPermitidasSelectItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="mt-3 flex items-center gap-2">
            {isEditingVariante ? (
              <Button type="button" onClick={handleSaveEditVariante} disabled={isUpdatingVariante}>
                {isUpdatingVariante ? <GdiSpinner className="size-4" data-icon="inline-start" /> : <SaveIcon className="size-4" data-icon="inline-start" />}
                Guardar cambios
              </Button>
            ) : (
              <Button type="button" onClick={handleCreateVariante} disabled={isSavingVariante}>
                {isSavingVariante ? <GdiSpinner className="size-4" data-icon="inline-start" /> : <PlusIcon className="size-4" data-icon="inline-start" />}
                Crear variante
              </Button>
            )}
            {isEditingVariante ? (
              <Button type="button" variant="outline" onClick={handleCancelEditVariante} disabled={isUpdatingVariante}>
                Cancelar edición
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
