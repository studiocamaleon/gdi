"use client";

import * as React from "react";
import { BoxesIcon, CpuIcon, InfoIcon, Layers3Icon, SaveIcon, WrenchIcon } from "lucide-react";
import { toast } from "sonner";

import type { ProductTabProps } from "@/components/productos-servicios/product-detail-types";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ProductoTabSection } from "@/components/productos-servicios/producto-tab-section";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getVarianteOptionChips } from "@/lib/materias-primas-variantes-display";
import type { Maquina } from "@/lib/maquinaria";
import { getMaquinaGeometriasCompatibles, getMaquinaTecnologia, tecnologiaMaquinaItems } from "@/lib/maquinaria";
import { getGranFormatoConfig, updateGranFormatoConfig } from "@/lib/productos-servicios-api";

const EMPTY_MATERIAL_BASE_VALUE = "__empty_material_base__";
const technologyOrder = tecnologiaMaquinaItems.map((item) => item.value);
const technologyLabels: Record<string, string> = Object.fromEntries(
  tecnologiaMaquinaItems.map((item) => [item.value, item.label]),
);

function toggleInArray(items: string[], value: string, checked: boolean) {
  if (checked) {
    return Array.from(new Set([...items, value]));
  }
  return items.filter((item) => item !== value);
}

function isWideFormatMachine(maquina: Maquina) {
  return maquina.activo && getMaquinaGeometriasCompatibles(maquina).includes("rollo") && Boolean(getMaquinaTecnologia(maquina));
}

export function WideFormatTecnologiasTab(props: ProductTabProps) {
  const [tecnologiasCompatibles, setTecnologiasCompatibles] = React.useState<string[]>([]);
  const [savedTecnologiasCompatibles, setSavedTecnologiasCompatibles] = React.useState<string[]>([]);
  const [maquinasCompatiblesIds, setMaquinasCompatiblesIds] = React.useState<string[]>([]);
  const [savedMaquinasCompatiblesIds, setSavedMaquinasCompatiblesIds] = React.useState<string[]>([]);
  const [perfilesCompatiblesIds, setPerfilesCompatiblesIds] = React.useState<string[]>([]);
  const [savedPerfilesCompatiblesIds, setSavedPerfilesCompatiblesIds] = React.useState<string[]>([]);
  const [materialBaseId, setMaterialBaseId] = React.useState("");
  const [savedMaterialBaseId, setSavedMaterialBaseId] = React.useState("");
  const [materialesCompatiblesIds, setMaterialesCompatiblesIds] = React.useState<string[]>([]);
  const [savedMaterialesCompatiblesIds, setSavedMaterialesCompatiblesIds] = React.useState<string[]>([]);
  const [isLoadingConfig, setIsLoadingConfig] = React.useState(true);
  const [isSavingConfig, startSavingConfig] = React.useTransition();

  const loadConfig = React.useCallback(async () => {
    setIsLoadingConfig(true);
    try {
      const config = await getGranFormatoConfig(props.producto.id);
      setTecnologiasCompatibles(config.tecnologiasCompatibles);
      setSavedTecnologiasCompatibles(config.tecnologiasCompatibles);
      setMaquinasCompatiblesIds(config.maquinasCompatibles);
      setSavedMaquinasCompatiblesIds(config.maquinasCompatibles);
      setPerfilesCompatiblesIds(config.perfilesCompatibles);
      setSavedPerfilesCompatiblesIds(config.perfilesCompatibles);
      setMaterialBaseId(config.materialBaseId ?? "");
      setSavedMaterialBaseId(config.materialBaseId ?? "");
      setMaterialesCompatiblesIds(config.materialesCompatibles);
      setSavedMaterialesCompatiblesIds(config.materialesCompatibles);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "No se pudo cargar la configuración de gran formato.");
    } finally {
      setIsLoadingConfig(false);
    }
  }, [props.producto.id]);

  React.useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const availableMachines = React.useMemo(() => props.maquinas.filter((item) => isWideFormatMachine(item)), [props.maquinas]);
  const availableTechnologyItems = React.useMemo(() => {
    const available = new Set<string>();
    for (const machine of availableMachines) {
      const tecnologia = getMaquinaTecnologia(machine);
      if (tecnologia) available.add(tecnologia);
    }
    return technologyOrder.filter((value) => available.has(value)).map((value) => ({ value, label: technologyLabels[value] }));
  }, [availableMachines]);
  const filteredMachines = React.useMemo(() => {
    if (tecnologiasCompatibles.length === 0) return [] as Maquina[];
    const selected = new Set(tecnologiasCompatibles);
    return availableMachines.filter((machine) => {
      const tecnologia = getMaquinaTecnologia(machine);
      return tecnologia ? selected.has(tecnologia) : false;
    });
  }, [availableMachines, tecnologiasCompatibles]);
  const filteredMachineIds = React.useMemo(() => new Set(filteredMachines.map((item) => item.id)), [filteredMachines]);
  const selectedMachines = React.useMemo(
    () => filteredMachines.filter((machine) => maquinasCompatiblesIds.includes(machine.id)),
    [filteredMachines, maquinasCompatiblesIds],
  );
  const groupedProfiles = React.useMemo(
    () =>
      selectedMachines.map((machine) => ({
        machine,
        profiles: machine.perfilesOperativos.filter((profile) => profile.activo),
      })),
    [selectedMachines],
  );
  const validProfileIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const group of groupedProfiles) {
      for (const profile of group.profiles) ids.add(profile.id);
    }
    return ids;
  }, [groupedProfiles]);
  const availableBaseMaterials = React.useMemo(
    () =>
      props.materiasPrimas.filter(
        (item) => item.activo && item.subfamilia === "sustrato_rollo_flexible" && item.variantes.some((variant) => variant.activo),
      ),
    [props.materiasPrimas],
  );
  const selectedBaseMaterial = React.useMemo(
    () => availableBaseMaterials.find((item) => item.id === materialBaseId) ?? null,
    [availableBaseMaterials, materialBaseId],
  );
  const materialBaseLabel = React.useMemo(
    () => availableBaseMaterials.find((item) => item.id === materialBaseId)?.nombre ?? "Seleccionar material base",
    [availableBaseMaterials, materialBaseId],
  );
  const availableMaterialVariants = React.useMemo(
    () => (selectedBaseMaterial?.variantes ?? []).filter((variant) => variant.activo),
    [selectedBaseMaterial],
  );
  const validMaterialVariantIds = React.useMemo(
    () => new Set(availableMaterialVariants.map((item) => item.id)),
    [availableMaterialVariants],
  );

  React.useEffect(() => {
    const next = maquinasCompatiblesIds.filter((id) => filteredMachineIds.has(id));
    if (JSON.stringify(next) !== JSON.stringify(maquinasCompatiblesIds)) {
      setMaquinasCompatiblesIds(next);
    }
  }, [filteredMachineIds, maquinasCompatiblesIds]);

  React.useEffect(() => {
    const next = perfilesCompatiblesIds.filter((id) => validProfileIds.has(id));
    if (JSON.stringify(next) !== JSON.stringify(perfilesCompatiblesIds)) {
      setPerfilesCompatiblesIds(next);
    }
  }, [perfilesCompatiblesIds, validProfileIds]);

  React.useEffect(() => {
    const next = materialesCompatiblesIds.filter((id) => validMaterialVariantIds.has(id));
    if (JSON.stringify(next) !== JSON.stringify(materialesCompatiblesIds)) {
      setMaterialesCompatiblesIds(next);
    }
  }, [materialesCompatiblesIds, validMaterialVariantIds]);

  const isConfigDirty =
    JSON.stringify([...tecnologiasCompatibles].sort()) !== JSON.stringify([...savedTecnologiasCompatibles].sort()) ||
    JSON.stringify([...maquinasCompatiblesIds].sort()) !== JSON.stringify([...savedMaquinasCompatiblesIds].sort()) ||
    JSON.stringify([...perfilesCompatiblesIds].sort()) !== JSON.stringify([...savedPerfilesCompatiblesIds].sort()) ||
    materialBaseId !== savedMaterialBaseId ||
    JSON.stringify([...materialesCompatiblesIds].sort()) !== JSON.stringify([...savedMaterialesCompatiblesIds].sort());

  const handleSaveTecnologias = () => {
    startSavingConfig(async () => {
      try {
        const updated = await updateGranFormatoConfig(props.producto.id, {
          tecnologiasCompatibles,
          maquinasCompatibles: maquinasCompatiblesIds,
          perfilesCompatibles: perfilesCompatiblesIds,
          materialBaseId: materialBaseId || null,
          materialesCompatibles: materialesCompatiblesIds,
        });
        setTecnologiasCompatibles(updated.tecnologiasCompatibles);
        setSavedTecnologiasCompatibles(updated.tecnologiasCompatibles);
        setMaquinasCompatiblesIds(updated.maquinasCompatibles);
        setSavedMaquinasCompatiblesIds(updated.maquinasCompatibles);
        setPerfilesCompatiblesIds(updated.perfilesCompatibles);
        setSavedPerfilesCompatiblesIds(updated.perfilesCompatibles);
        setMaterialBaseId(updated.materialBaseId ?? "");
        setSavedMaterialBaseId(updated.materialBaseId ?? "");
        setMaterialesCompatiblesIds(updated.materialesCompatibles);
        setSavedMaterialesCompatiblesIds(updated.materialesCompatibles);
        toast.success("Configuración técnica actualizada.");
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "No se pudo guardar la configuración técnica.");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tecnologías</CardTitle>
        <CardDescription>Definí tecnologías, equipos, perfiles y material base compatibles para este producto.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoadingConfig ? (
          <div className="flex items-center gap-2 rounded-lg border p-4 text-sm text-muted-foreground">
            <GdiSpinner className="size-4" />
            Cargando configuración de gran formato...
          </div>
        ) : (
          <>
            <ProductoTabSection
              title="Resumen de configuración"
              description="Lectura rápida de las tecnologías, equipos, perfiles y materiales actualmente habilitados para este producto."
              icon={InfoIcon}
              contentClassName="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
            >
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Tecnologías activas</p>
                <p className="mt-1 text-sm font-medium">{tecnologiasCompatibles.length}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Equipos compatibles</p>
                <p className="mt-1 text-sm font-medium">{maquinasCompatiblesIds.length}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Perfiles habilitados</p>
                <p className="mt-1 text-sm font-medium">{perfilesCompatiblesIds.length}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Estado</p>
                <p className="mt-1 text-sm font-medium">{isConfigDirty ? "Hay cambios pendientes" : "Sin cambios pendientes"}</p>
              </div>
            </ProductoTabSection>

            <ProductoTabSection
              title="Tecnologías, equipos y calidades"
              description="Primero definí las tecnologías compatibles. Eso habilita los equipos y, a partir de ellos, los perfiles operativos disponibles."
              icon={CpuIcon}
            >
              <div className="grid gap-4 xl:grid-cols-3">
                <div className="rounded-lg border bg-background p-4">
                  <div className="mb-3">
                    <p className="text-sm font-medium">Tecnologías compatibles</p>
                    <p className="text-xs text-muted-foreground">Definen el universo técnico del producto.</p>
                  </div>
                  <div className="space-y-3">
                    {availableTechnologyItems.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No hay tecnologías compatibles configuradas.</p>
                    ) : (
                      availableTechnologyItems.map((item) => (
                        <label key={item.value} className="flex items-center gap-3 text-sm">
                          <Checkbox
                            checked={tecnologiasCompatibles.includes(item.value)}
                            onCheckedChange={(checked) => setTecnologiasCompatibles((prev) => toggleInArray(prev, item.value, checked === true))}
                          />
                          <span>{item.label}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-lg border bg-background p-4">
                  <div className="mb-3">
                    <p className="text-sm font-medium">Equipos compatibles</p>
                    <p className="text-xs text-muted-foreground">Se habilitan según las tecnologías activas.</p>
                  </div>
                  <div className="space-y-3">
                    {filteredMachines.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Seleccioná al menos una tecnología para habilitar equipos.</p>
                    ) : (
                      filteredMachines.map((machine) => (
                        <label key={machine.id} className="flex items-center gap-3 text-sm">
                          <Checkbox
                            checked={maquinasCompatiblesIds.includes(machine.id)}
                            onCheckedChange={(checked) => setMaquinasCompatiblesIds((prev) => toggleInArray(prev, machine.id, checked === true))}
                          />
                          <div>
                            <div>{machine.nombre}</div>
                            <div className="text-xs text-muted-foreground">{machine.codigo}</div>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-lg border bg-background p-4">
                  <div className="mb-3">
                    <p className="text-sm font-medium">Calidades</p>
                    <p className="text-xs text-muted-foreground">Perfiles operativos disponibles en los equipos seleccionados.</p>
                  </div>
                  <div className="space-y-4">
                    {groupedProfiles.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Seleccioná al menos un equipo para habilitar perfiles.</p>
                    ) : (
                      groupedProfiles.map((group) => (
                        <div key={group.machine.id} className="space-y-2">
                          <p className="text-sm font-medium">{group.machine.nombre}</p>
                          <div className="space-y-2">
                            {group.profiles.map((profile) => (
                              <label key={profile.id} className="flex items-center gap-3 text-sm">
                                <Checkbox
                                  checked={perfilesCompatiblesIds.includes(profile.id)}
                                  onCheckedChange={(checked) => setPerfilesCompatiblesIds((prev) => toggleInArray(prev, profile.id, checked === true))}
                                />
                                <span>{profile.nombre}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </ProductoTabSection>

            <ProductoTabSection
              title="Materiales compatibles"
              description="Definí el material base principal y luego seleccioná las variantes compatibles que este producto puede usar."
              icon={BoxesIcon}
            >
              <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
                <div className="rounded-lg border bg-background p-4">
                  <div className="mb-3">
                    <p className="text-sm font-medium">Material base</p>
                    <p className="text-xs text-muted-foreground">Seleccioná un único material base principal para este producto.</p>
                  </div>
                  <Select
                    value={materialBaseId || EMPTY_MATERIAL_BASE_VALUE}
                    onValueChange={(value) => {
                      const nextValue = String(value ?? "") === EMPTY_MATERIAL_BASE_VALUE ? "" : String(value ?? "");
                      setMaterialBaseId(nextValue);
                      if (!nextValue) {
                        setMaterialesCompatiblesIds([]);
                        return;
                      }
                      const nextMaterial = availableBaseMaterials.find((item) => item.id === nextValue) ?? null;
                      const nextVariantIds = (nextMaterial?.variantes ?? []).filter((variant) => variant.activo).map((variant) => variant.id);
                      setMaterialesCompatiblesIds(nextVariantIds);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar material base">{materialBaseLabel}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={EMPTY_MATERIAL_BASE_VALUE}>Seleccionar material base</SelectItem>
                      {availableBaseMaterials.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-lg border bg-background p-4">
                  <div className="mb-3">
                    <p className="text-sm font-medium">Variantes de material compatibles</p>
                    <p className="text-xs text-muted-foreground">Elegí anchos de rollo u otras variantes activas del material base seleccionado.</p>
                  </div>
                  <div className="space-y-3">
                    {!selectedBaseMaterial ? (
                      <p className="text-sm text-muted-foreground">Seleccioná un material base para habilitar sus variantes compatibles.</p>
                    ) : availableMaterialVariants.length === 0 ? (
                      <p className="text-sm text-muted-foreground">El material base seleccionado no tiene variantes activas.</p>
                    ) : (
                      availableMaterialVariants.map((variant) => (
                        <label key={variant.id} className="flex items-start gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/20">
                          <Checkbox
                            checked={materialesCompatiblesIds.includes(variant.id)}
                            onCheckedChange={(checked) => setMaterialesCompatiblesIds((prev) => toggleInArray(prev, variant.id, checked === true))}
                          />
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-1">
                              {getVarianteOptionChips(selectedBaseMaterial, variant).map((chip) => (
                                <span key={`${variant.id}-${chip.key}`} className="rounded border px-2 py-0.5 text-xs">
                                  {chip.label}: {chip.value}
                                </span>
                              ))}
                            </div>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </ProductoTabSection>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Acción final</p>
                <p className="text-xs text-muted-foreground">
                  Confirmá los cambios del tab cuando termines de revisar tecnologías, equipos, perfiles y materiales.
                </p>
              </div>
              <Button type="button" onClick={handleSaveTecnologias} disabled={isSavingConfig || isLoadingConfig || !isConfigDirty}>
                {isSavingConfig ? <GdiSpinner className="size-4" data-icon="inline-start" /> : <SaveIcon className="size-4" data-icon="inline-start" />}
                Guardar cambios
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
