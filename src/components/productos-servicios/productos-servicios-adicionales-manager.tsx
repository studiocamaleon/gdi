"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeftIcon, PlusIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import type { CentroCosto } from "@/lib/costos";
import type { MateriaPrima } from "@/lib/materias-primas";
import type {
  AddonEffect,
  ProductoAdicional,
  ReglaCostoAdicionalEfecto,
  TipoConsumoAdicionalMaterial,
  TipoProductoAdicionalEfecto,
  TipoProductoAdicional,
  MetodoCostoProductoAdicional,
} from "@/lib/productos-servicios";
import {
  createAdicionalEfecto,
  deleteAdicionalEfecto,
  getAdicionalServicioPricing,
  getAdicionalEfectos,
  toggleAdicionalEfecto,
  createAdicionalCatalogo,
  toggleAdicionalCatalogo,
  updateAdicionalServicioPricing,
  updateAdicionalCatalogo,
} from "@/lib/productos-servicios-api";
import { buttonVariants, Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type MaterialOption = {
  id: string;
  label: string;
};

type MaterialDraft = {
  materiaPrimaVarianteId: string;
  tipoConsumo: TipoConsumoAdicionalMaterial;
  factorConsumo: string;
  mermaPct: string;
  activo: boolean;
};

type AdicionalDraft = {
  nombre: string;
  descripcion: string;
  tipo: TipoProductoAdicional;
  metodoCosto: MetodoCostoProductoAdicional;
  centroCostoId: string;
  activo: boolean;
  materiales: MaterialDraft[];
};

type EffectDraft = {
  tipo: TipoProductoAdicionalEfecto;
  reglaCosto: ReglaCostoAdicionalEfecto;
  valorCosto: string;
  materiaPrimaVarianteId: string;
  tipoConsumo: TipoConsumoAdicionalMaterial;
  factorConsumo: string;
  mermaPct: string;
};

type ServicioNivelDraft = {
  id: string;
  nombre: string;
  orden: number;
  activo: boolean;
};

type ServicioReglaDraft = {
  id: string;
  nivelId: string;
  tiempoMin: string;
};

const tipoItems: Array<{ value: TipoProductoAdicional; label: string }> = [
  { value: "servicio", label: "Servicio" },
  { value: "acabado", label: "Acabado" },
];

const metodoItems: Array<{ value: MetodoCostoProductoAdicional; label: string }> = [
  { value: "time_only", label: "Solo tiempo de produccion" },
  { value: "time_plus_material", label: "Tiempo de produccion + materiales" },
];

const consumoItems: Array<{ value: TipoConsumoAdicionalMaterial; label: string }> = [
  { value: "por_unidad", label: "Por unidad" },
  { value: "por_pliego", label: "Por pliego" },
  { value: "por_m2", label: "Por m2" },
];

const effectTypeItems: Array<{ value: TipoProductoAdicionalEfecto; label: string }> = [
  { value: "route_effect", label: "Regla de pasos" },
  { value: "cost_effect", label: "Regla de costo" },
  { value: "material_effect", label: "Consumo de materiales" },
];

const costRuleItems: Array<{ value: ReglaCostoAdicionalEfecto; label: string }> = [
  { value: "flat", label: "Monto fijo" },
  { value: "por_unidad", label: "Por unidad" },
  { value: "por_pliego", label: "Por pliego" },
  { value: "porcentaje_sobre_total", label: "Porcentaje sobre total" },
  { value: "tiempo_extra_min", label: "Tiempo extra (min)" },
];

function buildEmptyDraft(): AdicionalDraft {
  return {
    nombre: "",
    descripcion: "",
    tipo: "servicio",
    metodoCosto: "time_only",
    centroCostoId: "",
    activo: true,
    materiales: [],
  };
}

function toDraft(item: ProductoAdicional): AdicionalDraft {
  return {
    nombre: item.nombre,
    descripcion: item.descripcion,
    tipo: item.tipo,
    metodoCosto: item.metodoCosto,
    centroCostoId: item.centroCostoId ?? "",
    activo: item.activo,
    materiales: item.materiales.map((material) => ({
      materiaPrimaVarianteId: material.materiaPrimaVarianteId,
      tipoConsumo: material.tipoConsumo,
      factorConsumo: String(material.factorConsumo),
      mermaPct: material.mermaPct === null ? "" : String(material.mermaPct),
      activo: material.activo,
    })),
  };
}

function buildEmptyEffectDraft(materialId?: string): EffectDraft {
  return {
    tipo: "cost_effect",
    reglaCosto: "flat",
    valorCosto: "0",
    materiaPrimaVarianteId: materialId ?? "",
    tipoConsumo: "por_unidad",
    factorConsumo: "0",
    mermaPct: "",
  };
}

type Props = {
  initialAdicionales: ProductoAdicional[];
  centrosCosto: CentroCosto[];
  materiasPrimas: MateriaPrima[];
};

function normalizeDraftForCompare(draft: AdicionalDraft) {
  return {
    nombre: draft.nombre.trim(),
    descripcion: draft.descripcion.trim(),
    tipo: draft.tipo,
    metodoCosto: draft.metodoCosto,
    centroCostoId: draft.centroCostoId || "",
    activo: draft.activo,
    materiales: draft.materiales.map((item) => ({
      materiaPrimaVarianteId: item.materiaPrimaVarianteId,
      tipoConsumo: item.tipoConsumo,
      factorConsumo: item.factorConsumo.trim(),
      mermaPct: item.mermaPct.trim(),
      activo: item.activo,
    })),
  };
}

export function ProductosServiciosAdicionalesManager({
  initialAdicionales,
  centrosCosto,
  materiasPrimas,
}: Props) {
  const [adicionales, setAdicionales] = React.useState(initialAdicionales);
  const [selectedId, setSelectedId] = React.useState(initialAdicionales[0]?.id ?? "new");
  const [draft, setDraft] = React.useState<AdicionalDraft>(
    initialAdicionales[0] ? toDraft(initialAdicionales[0]) : buildEmptyDraft(),
  );
  const [isSaving, startSaving] = React.useTransition();
  const [efectos, setEfectos] = React.useState<AddonEffect[]>([]);
  const [effectDraft, setEffectDraft] = React.useState<EffectDraft>(buildEmptyEffectDraft());
  const [detailTab, setDetailTab] = React.useState<"general" | "materiales" | "efectos">("general");
  const [servicioNiveles, setServicioNiveles] = React.useState<ServicioNivelDraft[]>([]);
  const [servicioReglas, setServicioReglas] = React.useState<ServicioReglaDraft[]>([]);
  const [servicioNivelSeleccionadoId, setServicioNivelSeleccionadoId] = React.useState<string>("");

  const materialOptions = React.useMemo(() => {
    const result: MaterialOption[] = [];
    for (const mp of materiasPrimas) {
      for (const variante of mp.variantes) {
        result.push({
          id: variante.id,
          label: `${mp.nombre} · ${variante.nombreVariante || variante.sku}`,
        });
      }
    }
    return result.sort((a, b) => a.label.localeCompare(b.label));
  }, [materiasPrimas]);

  const materialLabelById = React.useMemo(
    () => new Map(materialOptions.map((option) => [option.id, option.label])),
    [materialOptions],
  );
  const tipoLabelByValue = React.useMemo(
    () => new Map(tipoItems.map((item) => [item.value, item.label])),
    [],
  );
  const metodoLabelByValue = React.useMemo(
    () => new Map(metodoItems.map((item) => [item.value, item.label])),
    [],
  );
  const centroCostoLabelById = React.useMemo(
    () => new Map(centrosCosto.map((centro) => [centro.id, centro.nombre])),
    [centrosCosto],
  );

  React.useEffect(() => {
    if (selectedId === "new") {
      setDraft(buildEmptyDraft());
      return;
    }
    const item = adicionales.find((entry) => entry.id === selectedId);
    if (item) {
      setDraft(toDraft(item));
    }
  }, [selectedId, adicionales]);

  React.useEffect(() => {
    if (selectedId === "new") {
      setEfectos([]);
      setServicioNiveles([]);
      setServicioReglas([]);
      setServicioNivelSeleccionadoId("");
      return;
    }
    getAdicionalEfectos(selectedId)
      .then((rows) => setEfectos(rows))
      .catch(() => setEfectos([]));

    getAdicionalServicioPricing(selectedId)
      .then((pricing) => {
        const niveles = pricing.niveles.map((item) => ({
          id: item.id,
          nombre: item.nombre,
          orden: item.orden,
          activo: item.activo,
        }));
        const reglas = pricing.reglas.map((item) => ({
          id: item.id,
          nivelId: item.nivelId,
          tiempoMin: String(item.tiempoMin),
        }));
        setServicioNiveles(niveles);
        setServicioReglas(reglas);
        setServicioNivelSeleccionadoId((prev) => prev || niveles[0]?.id || "");
      })
      .catch(() => {
        setServicioNiveles([]);
        setServicioReglas([]);
        setServicioNivelSeleccionadoId("");
      });
  }, [selectedId]);

  React.useEffect(() => {
    setEffectDraft((prev) =>
      prev.materiaPrimaVarianteId
        ? prev
        : buildEmptyEffectDraft(materialOptions[0]?.id),
    );
  }, [materialOptions]);

  React.useEffect(() => {
    if (selectedId === "new" && detailTab === "efectos") {
      setDetailTab("general");
    }
  }, [selectedId, detailTab]);

  React.useEffect(() => {
    if (draft.tipo === "servicio" && detailTab === "materiales") {
      setDetailTab("general");
    }
  }, [draft.tipo, detailTab]);

  const handleSave = () => {
    const payload = {
      nombre: draft.nombre,
      descripcion: draft.descripcion || undefined,
      tipo: draft.tipo,
      metodoCosto: draft.tipo === "servicio" ? "time_only" as const : draft.metodoCosto,
      centroCostoId: draft.centroCostoId || undefined,
      activo: draft.activo,
      materiales: (draft.tipo === "servicio" ? [] : draft.materiales).map((item) => ({
        materiaPrimaVarianteId: item.materiaPrimaVarianteId,
        tipoConsumo: item.tipoConsumo,
        factorConsumo: Number(item.factorConsumo || 0),
        mermaPct: item.mermaPct ? Number(item.mermaPct) : undefined,
        activo: item.activo,
      })),
    };

    startSaving(async () => {
      try {
        const saved =
          selectedId === "new"
            ? await createAdicionalCatalogo(payload)
            : await updateAdicionalCatalogo(selectedId, payload);
        setAdicionales((prev) => {
          const exists = prev.some((item) => item.id === saved.id);
          if (exists) return prev.map((item) => (item.id === saved.id ? saved : item));
          return [...prev, saved].sort((a, b) => a.nombre.localeCompare(b.nombre));
        });
        setSelectedId(saved.id);
        toast.success("Adicional guardado.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo guardar el adicional.");
      }
    });
  };

  const handleToggle = (id: string) => {
    startSaving(async () => {
      try {
        const saved = await toggleAdicionalCatalogo(id);
        setAdicionales((prev) => prev.map((item) => (item.id === id ? saved : item)));
        if (selectedId === id) {
          setDraft(toDraft(saved));
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo cambiar estado.");
      }
    });
  };

  const selectedAdicional = React.useMemo(
    () => adicionales.find((item) => item.id === selectedId) ?? null,
    [adicionales, selectedId],
  );
  const isEditMode = selectedId !== "new";
  const hasEditChanges = React.useMemo(() => {
    if (!isEditMode || !selectedAdicional) return false;
    const current = normalizeDraftForCompare(draft);
    const base = normalizeDraftForCompare(toDraft(selectedAdicional));
    return JSON.stringify(current) !== JSON.stringify(base);
  }, [draft, isEditMode, selectedAdicional]);
  const hasRouteRule = React.useMemo(
    () => efectos.some((effect) => effect.tipo === "route_effect"),
    [efectos],
  );
  const hasCostRule = React.useMemo(
    () => efectos.some((effect) => effect.tipo === "cost_effect"),
    [efectos],
  );
  const selectedCentroCostoId = selectedAdicional?.centroCostoId ?? "";
  const reglaNivelSeleccionado = React.useMemo(
    () => servicioReglas.find((item) => item.nivelId === servicioNivelSeleccionadoId) ?? null,
    [servicioReglas, servicioNivelSeleccionadoId],
  );

  const upsertReglaNivelSeleccionado = (next: Partial<ServicioReglaDraft>) => {
    if (!servicioNivelSeleccionadoId) return;
    setServicioReglas((prev) => {
      const existing = prev.find((item) => item.nivelId === servicioNivelSeleccionadoId);
      if (!existing) {
        return [
          ...prev,
          {
            id: crypto.randomUUID(),
            nivelId: servicioNivelSeleccionadoId,
            tiempoMin: next.tiempoMin ?? "0",
          },
        ];
      }
      return prev.map((item) =>
        item.nivelId === servicioNivelSeleccionadoId
          ? { ...item, ...next }
          : item,
      );
    });
  };

  const handleCreateEffect = () => {
    if (!selectedAdicional) return;
    if (effectDraft.tipo === "route_effect" && hasRouteRule) {
      toast.error("Ya existe una Regla de pasos para este adicional.");
      return;
    }
    if (effectDraft.tipo === "cost_effect" && hasCostRule) {
      toast.error("Ya existe una Regla de costo para este adicional.");
      return;
    }
    if (effectDraft.tipo === "route_effect" && !selectedCentroCostoId) {
      toast.error("Define primero un Centro de costo en la pestaña General del adicional.");
      return;
    }
    startSaving(async () => {
      try {
        const payload =
          effectDraft.tipo === "route_effect"
            ? {
                tipo: "route_effect" as const,
                routeEffect: {
                  pasos: [
                    {
                      nombre: "Paso adicional",
                      centroCostoId: selectedCentroCostoId,
                      tiempoFijoMin: Number(effectDraft.valorCosto || 0),
                    },
                  ],
                },
              }
            : effectDraft.tipo === "cost_effect"
              ? {
                  tipo: "cost_effect" as const,
                  costEffect: {
                    regla: effectDraft.reglaCosto,
                    valor: Number(effectDraft.valorCosto || 0),
                    centroCostoId: selectedCentroCostoId || undefined,
                  },
                }
              : {
                  tipo: "material_effect" as const,
                  materialEffect: {
                    materiaPrimaVarianteId: effectDraft.materiaPrimaVarianteId,
                    tipoConsumo: effectDraft.tipoConsumo,
                    factorConsumo: Number(effectDraft.factorConsumo || 0),
                    mermaPct: effectDraft.mermaPct ? Number(effectDraft.mermaPct) : undefined,
                  },
                };
        if (effectDraft.tipo === "material_effect" && !effectDraft.materiaPrimaVarianteId) {
          toast.error("Selecciona una materia prima para material effect.");
          return;
        }
        const saved = await createAdicionalEfecto(selectedAdicional.id, payload);
        setEfectos((prev) => [...prev, saved]);
        setEffectDraft(buildEmptyEffectDraft(materialOptions[0]?.id));
        toast.success("Efecto creado.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo crear el efecto.");
      }
    });
  };

  const handleToggleEffect = (effectId: string) => {
    if (!selectedAdicional) return;
    startSaving(async () => {
      try {
        const saved = await toggleAdicionalEfecto(selectedAdicional.id, effectId);
        setEfectos((prev) => prev.map((item) => (item.id === saved.id ? saved : item)));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo cambiar estado del efecto.");
      }
    });
  };

  const handleDeleteEffect = (effectId: string) => {
    if (!selectedAdicional) return;
    startSaving(async () => {
      try {
        await deleteAdicionalEfecto(selectedAdicional.id, effectId);
        setEfectos((prev) => prev.filter((item) => item.id !== effectId));
        toast.success("Efecto eliminado.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo eliminar el efecto.");
      }
    });
  };

  const handleSaveServicioPricing = () => {
    if (!selectedAdicional) return;
    if (selectedAdicional.tipo !== "servicio") return;
    if (servicioNiveles.length === 0) {
      toast.error("Debes crear al menos un nivel.");
      return;
    }
    startSaving(async () => {
      try {
        const payload = {
          niveles: servicioNiveles.map((nivel, index) => ({
            id: nivel.id,
            nombre: nivel.nombre.trim() || `Nivel ${index + 1}`,
            orden: nivel.orden,
            activo: nivel.activo,
          })),
          reglas: servicioReglas
            .filter((regla) => servicioNiveles.some((nivel) => nivel.id === regla.nivelId))
            .map((regla) => ({
              nivelId: regla.nivelId,
              tiempoMin: Number(regla.tiempoMin || 0),
            })),
        };
        const saved = await updateAdicionalServicioPricing(selectedAdicional.id, payload);
        setServicioNiveles(saved.niveles.map((item) => ({
          id: item.id,
          nombre: item.nombre,
          orden: item.orden,
          activo: item.activo,
        })));
        setServicioReglas(saved.reglas.map((item) => ({
          id: item.id,
          nivelId: item.nivelId,
          tiempoMin: String(item.tiempoMin),
        })));
        toast.success("Costo del servicio actualizado.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo guardar configuración de costo.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/costos/productos-servicios" className={cn(buttonVariants({ variant: "ghost" }), "-ml-3")}>
          <ArrowLeftIcon data-icon="inline-start" />
          Volver a catalogo de productos
        </Link>
        <h1 className="text-xl font-semibold">Biblioteca de adicionales</h1>
        <p className="text-sm text-muted-foreground">Crea y mantiene servicios/acabados reutilizables para todos los productos.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Adicionales</CardTitle>
            <CardDescription>Catálogo global del tenant.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button type="button" variant="brand" className="w-full" onClick={() => setSelectedId("new")}>
              <PlusIcon data-icon="inline-start" />
              Nuevo adicional
            </Button>
            <div className="max-h-[560px] overflow-auto rounded-md border">
              {adicionales.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm hover:bg-muted/40",
                    selectedId === item.id ? "bg-accent/60" : "",
                  )}
                  onClick={() => setSelectedId(item.id)}
                >
                  <span>{item.nombre}</span>
                  <Switch
                    checked={item.activo}
                    onCheckedChange={() => handleToggle(item.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{selectedId === "new" ? "Nuevo adicional" : "Editar adicional"}</CardTitle>
            <CardDescription>Define costo base por tiempo y opcionalmente materiales.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={detailTab} onValueChange={(value) => setDetailTab(value as "general" | "materiales" | "efectos")}>
              <TabsList>
                <TabsTrigger value="general">General</TabsTrigger>
                {draft.tipo === "acabado" ? <TabsTrigger value="materiales">Materiales</TabsTrigger> : null}
                {selectedId !== "new" ? <TabsTrigger value="efectos">Costo</TabsTrigger> : null}
              </TabsList>
              <TabsContent value="general" className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <Field>
                    <FieldLabel>Nombre</FieldLabel>
                    <Input
                      placeholder="Nombre"
                      value={draft.nombre}
                      onChange={(e) => setDraft((prev) => ({ ...prev, nombre: e.target.value }))}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Tipo</FieldLabel>
                    <Select
                      value={draft.tipo}
                      onValueChange={(value) =>
                        setDraft((prev) => ({
                          ...prev,
                          tipo: value as TipoProductoAdicional,
                          metodoCosto: value === "servicio" ? "time_only" : prev.metodoCosto,
                          materiales: value === "servicio" ? [] : prev.materiales,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tipo">
                          {tipoLabelByValue.get(draft.tipo) ?? "Seleccionar tipo"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {tipoItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel>Productividad</FieldLabel>
                    <Select
                      value={draft.metodoCosto}
                      onValueChange={(value) =>
                        setDraft((prev) => ({ ...prev, metodoCosto: value as MetodoCostoProductoAdicional }))
                      }
                      disabled={draft.tipo === "servicio"}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar productividad">
                          {metodoLabelByValue.get(draft.metodoCosto) ?? "Seleccionar productividad"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {metodoItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel>Centro de costo</FieldLabel>
                    <Select
                      value={draft.centroCostoId || "none"}
                      onValueChange={(value) =>
                        setDraft((prev) => ({
                          ...prev,
                          centroCostoId: !value || value === "none" ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar centro de costo">
                          {draft.centroCostoId
                            ? (centroCostoLabelById.get(draft.centroCostoId) ?? "Seleccionar centro de costo")
                            : "Sin centro de costo"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin centro de costo</SelectItem>
                        {centrosCosto.map((centro) => (
                          <SelectItem key={centro.id} value={centro.id}>
                            {centro.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  {selectedId !== "new" ? (
                    <div className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={draft.activo}
                        onCheckedChange={(value) => setDraft((prev) => ({ ...prev, activo: value }))}
                      />
                      Activo
                    </div>
                  ) : null}
                </div>
                <Textarea
                  placeholder="Descripción"
                  value={draft.descripcion}
                  onChange={(e) => setDraft((prev) => ({ ...prev, descripcion: e.target.value }))}
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving || (isEditMode && !hasEditChanges)}
                  >
                    <SaveIcon data-icon="inline-start" />
                    {selectedId === "new" ? "Crear adicional" : "Guardar cambios"}
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="materiales" className="space-y-4">
                {draft.tipo === "acabado" ? (
                  <div className="space-y-2 rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Materiales opcionales</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            materiales: [
                              ...prev.materiales,
                              {
                                materiaPrimaVarianteId: materialOptions[0]?.id ?? "",
                                tipoConsumo: "por_unidad",
                                factorConsumo: "0",
                                mermaPct: "",
                                activo: true,
                              },
                            ],
                          }))
                        }
                      >
                        <PlusIcon data-icon="inline-start" />
                        Agregar material
                      </Button>
                    </div>
                    {draft.materiales.map((item, index) => (
                      <div key={`mat-${index}`} className="grid gap-2 rounded-md border p-2 md:grid-cols-[1.4fr_1fr_110px_110px_auto]">
                        <Select
                          value={item.materiaPrimaVarianteId}
                          onValueChange={(value) =>
                            setDraft((prev) => ({
                              ...prev,
                              materiales: prev.materiales.map((mat, idx) =>
                                idx === index
                                  ? { ...mat, materiaPrimaVarianteId: value || mat.materiaPrimaVarianteId }
                                  : mat,
                              ),
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Materia prima">
                              {materialLabelById.get(item.materiaPrimaVarianteId) ?? "Seleccionar materia prima"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {materialOptions.map((option) => (
                              <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={item.tipoConsumo}
                          onValueChange={(value) =>
                            setDraft((prev) => ({
                              ...prev,
                              materiales: prev.materiales.map((mat, idx) =>
                                idx === index
                                  ? {
                                      ...mat,
                                      tipoConsumo: (value || mat.tipoConsumo) as TipoConsumoAdicionalMaterial,
                                    }
                                  : mat,
                              ),
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Tipo consumo" />
                          </SelectTrigger>
                          <SelectContent>
                            {consumoItems.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder="Factor"
                          value={item.factorConsumo}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              materiales: prev.materiales.map((mat, idx) =>
                                idx === index ? { ...mat, factorConsumo: e.target.value } : mat,
                              ),
                            }))
                          }
                        />
                        <Input
                          placeholder="Merma %"
                          value={item.mermaPct}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              materiales: prev.materiales.map((mat, idx) =>
                                idx === index ? { ...mat, mermaPct: e.target.value } : mat,
                              ),
                            }))
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setDraft((prev) => ({
                              ...prev,
                              materiales: prev.materiales.filter((_, idx) => idx !== index),
                            }))
                          }
                        >
                          <Trash2Icon />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Los materiales aplican solo para adicionales de tipo Acabado.</p>
                )}
                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving || (isEditMode && !hasEditChanges)}
                  >
                    <SaveIcon data-icon="inline-start" />
                    {selectedId === "new" ? "Crear adicional" : "Guardar cambios"}
                  </Button>
                </div>
              </TabsContent>
              {selectedId !== "new" ? (
                <TabsContent value="efectos" className="space-y-4">
              {draft.tipo === "servicio" ? (
                <>
                  <div className="rounded-md border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-medium">Niveles del servicio</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const id = crypto.randomUUID();
                          setServicioNiveles((prev) => [
                            ...prev,
                            { id, nombre: `Nivel ${prev.length + 1}`, orden: prev.length + 1, activo: true },
                          ]);
                          setServicioNivelSeleccionadoId(id);
                        }}
                      >
                        <PlusIcon data-icon="inline-start" />
                        Agregar nivel
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {servicioNiveles.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No hay niveles configurados.</p>
                      ) : (
                        servicioNiveles.map((nivel, index) => (
                          <div key={nivel.id} className="flex items-center gap-2 rounded-md border p-2">
                            <input
                              type="radio"
                              checked={servicioNivelSeleccionadoId === nivel.id}
                              onChange={() => setServicioNivelSeleccionadoId(nivel.id)}
                            />
                            <Input
                              value={nivel.nombre}
                              onChange={(e) =>
                                setServicioNiveles((prev) =>
                                  prev.map((item) => (item.id === nivel.id ? { ...item, nombre: e.target.value } : item)),
                                )
                              }
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setServicioNiveles((prev) => prev.filter((item) => item.id !== nivel.id));
                                setServicioReglas((prev) => prev.filter((item) => item.nivelId !== nivel.id));
                                if (servicioNivelSeleccionadoId === nivel.id) {
                                  setServicioNivelSeleccionadoId(servicioNiveles.find((item) => item.id !== nivel.id)?.id ?? "");
                                }
                              }}
                              disabled={servicioNiveles.length <= 1}
                              aria-label={`Eliminar nivel ${index + 1}`}
                            >
                              <Trash2Icon />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="mb-2 text-sm font-medium">Regla de costo del nivel</p>
                    {!servicioNivelSeleccionadoId ? (
                      <p className="text-sm text-muted-foreground">Selecciona un nivel para editar su costo.</p>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        <Field>
                          <FieldLabel>Tiempo (min)</FieldLabel>
                          <Input
                            value={reglaNivelSeleccionado?.tiempoMin ?? "0"}
                            onChange={(e) => upsertReglaNivelSeleccionado({ tiempoMin: e.target.value })}
                          />
                        </Field>
                        <Field>
                          <FieldLabel>Centro de costo</FieldLabel>
                          <Input value={selectedAdicional?.centroCostoNombre || "Sin centro de costo"} disabled />
                        </Field>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <Button type="button" onClick={handleSaveServicioPricing} disabled={isSaving}>
                      <SaveIcon data-icon="inline-start" />
                      Guardar costo
                    </Button>
                  </div>
                </>
              ) : (
              <>
              <div className="grid gap-3 md:grid-cols-3">
                <Field>
                  <FieldLabel>Tipo</FieldLabel>
                    <Select
                      value={effectDraft.tipo}
                      onValueChange={(value) =>
                        setEffectDraft((prev) => ({ ...prev, tipo: value as TipoProductoAdicionalEfecto }))
                      }
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {effectTypeItems.find((item) => item.value === effectDraft.tipo)?.label ?? "Seleccionar tipo"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {effectTypeItems.map((item) => {
                        const disabled =
                          (item.value === "route_effect" && hasRouteRule && effectDraft.tipo !== "route_effect") ||
                          (item.value === "cost_effect" && hasCostRule && effectDraft.tipo !== "cost_effect");
                        return (
                          <SelectItem key={item.value} value={item.value} disabled={disabled}>
                            {item.label}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </Field>
                {(hasRouteRule || hasCostRule) ? (
                  <div className="md:col-span-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                    Ya existe {hasRouteRule ? "Regla de pasos" : ""}{hasRouteRule && hasCostRule ? " y " : ""}{hasCostRule ? "Regla de costo" : ""}. Solo puede haber una de cada tipo.
                  </div>
                ) : null}
                {effectDraft.tipo === "cost_effect" ? (
                  <>
                    <Field>
                      <FieldLabel>Regla de costo</FieldLabel>
                      <Select
                        value={effectDraft.reglaCosto}
                        onValueChange={(value) =>
                          setEffectDraft((prev) => ({ ...prev, reglaCosto: value as ReglaCostoAdicionalEfecto }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue>
                            {costRuleItems.find((item) => item.value === effectDraft.reglaCosto)?.label ?? "Seleccionar regla"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {costRuleItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel>Valor</FieldLabel>
                      <Input
                        value={effectDraft.valorCosto}
                        onChange={(e) => setEffectDraft((prev) => ({ ...prev, valorCosto: e.target.value }))}
                      />
                    </Field>
                  </>
                ) : null}
                {effectDraft.tipo === "material_effect" ? (
                  <>
                    <Field>
                      <FieldLabel>Materia prima</FieldLabel>
                      <Select
                        value={effectDraft.materiaPrimaVarianteId}
                        onValueChange={(value) =>
                          setEffectDraft((prev) => ({ ...prev, materiaPrimaVarianteId: value || prev.materiaPrimaVarianteId }))
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {materialOptions.map((option) => (
                            <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel>Tipo consumo</FieldLabel>
                      <Select
                        value={effectDraft.tipoConsumo}
                        onValueChange={(value) =>
                          setEffectDraft((prev) => ({ ...prev, tipoConsumo: value as TipoConsumoAdicionalMaterial }))
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {consumoItems.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel>Factor</FieldLabel>
                      <Input
                        value={effectDraft.factorConsumo}
                        onChange={(e) => setEffectDraft((prev) => ({ ...prev, factorConsumo: e.target.value }))}
                      />
                    </Field>
                  </>
                ) : null}
                {effectDraft.tipo === "route_effect" ? (
                  <>
                    <Field>
                      <FieldLabel>Centro de costo</FieldLabel>
                      <Input
                        value={selectedAdicional?.centroCostoNombre || "Sin centro de costo"}
                        disabled
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Tiempo fijo (min)</FieldLabel>
                      <Input
                        value={effectDraft.valorCosto}
                        onChange={(e) => setEffectDraft((prev) => ({ ...prev, valorCosto: e.target.value }))}
                      />
                    </Field>
                  </>
                ) : null}
              </div>
              <div className="flex justify-end">
                <Button type="button" onClick={handleCreateEffect} disabled={isSaving}>
                  <PlusIcon data-icon="inline-start" />
                  Crear efecto
                </Button>
              </div>
              <div className="space-y-2 rounded-md border p-3">
                {efectos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin efectos cargados.</p>
                ) : (
                  efectos.map((effect) => (
                    <div key={effect.id} className="flex items-center justify-between rounded-md border p-2">
                      <div>
                        <p className="text-sm font-medium">
                          {effectTypeItems.find((item) => item.value === effect.tipo)?.label ?? effect.tipo}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {effect.tipo === "cost_effect" ? "Aplica una regla de cálculo de costo." : null}
                          {effect.tipo === "route_effect" ? "Agrega tiempos/pasos productivos a la ruta." : null}
                          {effect.tipo === "material_effect" ? "Agrega consumo simulado de materia prima." : null}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Switch checked={effect.activo} onCheckedChange={() => handleToggleEffect(effect.id)} />
                        <Button type="button" variant="ghost" size="icon" onClick={() => handleDeleteEffect(effect.id)}>
                          <Trash2Icon />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              </>
              )}
                </TabsContent>
              ) : null}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
