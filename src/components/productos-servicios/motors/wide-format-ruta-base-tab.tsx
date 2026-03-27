"use client";

import * as React from "react";
import Link from "next/link";
import { EyeIcon, InfoIcon, MapIcon, PlusIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import type { ProductTabProps } from "@/components/productos-servicios/product-detail-types";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductoTabSection } from "@/components/productos-servicios/producto-tab-section";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Maquina } from "@/lib/maquinaria";
import { getMaquinaGeometriasCompatibles, getMaquinaTecnologia, tecnologiaMaquinaItems } from "@/lib/maquinaria";
import type { ProcesoOperacionPlantilla } from "@/lib/procesos";
import { getGranFormatoConfig, getGranFormatoRutaBase, updateGranFormatoRutaBase } from "@/lib/productos-servicios-api";

type GranFormatoRutaBaseReglaDraft = {
  id: string;
  tecnologia: string;
  maquinaId: string;
  pasoPlantillaId: string;
  perfilOperativoDefaultId: string;
};

const technologyLabels: Record<string, string> = Object.fromEntries(
  tecnologiaMaquinaItems.map((item) => [item.value, item.label]),
);

function createRutaBaseReglaDraft(): GranFormatoRutaBaseReglaDraft {
  return {
    id: crypto.randomUUID(),
    tecnologia: "",
    maquinaId: "",
    pasoPlantillaId: "",
    perfilOperativoDefaultId: "",
  };
}

function normalizeRutaBaseDraftSnapshot(procesoDefinicionId: string, reglasImpresion: GranFormatoRutaBaseReglaDraft[]) {
  return JSON.stringify({
    procesoDefinicionId: procesoDefinicionId || "",
    reglasImpresion: reglasImpresion
      .map((item) => ({
        tecnologia: item.tecnologia,
        maquinaId: item.maquinaId || "",
        pasoPlantillaId: item.pasoPlantillaId,
        perfilOperativoDefaultId: item.perfilOperativoDefaultId || "",
      }))
      .sort((a, b) => `${a.tecnologia}:${a.maquinaId}:${a.pasoPlantillaId}`.localeCompare(`${b.tecnologia}:${b.maquinaId}:${b.pasoPlantillaId}`)),
  });
}

function normalizePasoNombreBase(value: string | null | undefined) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!normalized) return "";
  const colonIndex = normalized.indexOf(":");
  if (colonIndex <= 0) return normalized;
  return normalized.slice(0, colonIndex).trim();
}

function getPasoPlantillaIdFromDetalle(value: Record<string, unknown> | null | undefined) {
  const pasoPlantillaId = value?.pasoPlantillaId;
  return typeof pasoPlantillaId === "string" && pasoPlantillaId.trim().length ? pasoPlantillaId.trim() : null;
}

function isWideFormatMachine(maquina: Maquina) {
  return maquina.activo && getMaquinaGeometriasCompatibles(maquina).includes("rollo") && Boolean(getMaquinaTecnologia(maquina));
}

export function WideFormatRutaBaseTab(props: ProductTabProps) {
  const [tecnologiasCompatibles, setTecnologiasCompatibles] = React.useState<string[]>([]);
  const [maquinasCompatiblesIds, setMaquinasCompatiblesIds] = React.useState<string[]>([]);
  const [perfilesCompatiblesIds, setPerfilesCompatiblesIds] = React.useState<string[]>([]);
  const [rutaBaseProcesoId, setRutaBaseProcesoId] = React.useState("");
  const [rutaBaseReglasImpresion, setRutaBaseReglasImpresion] = React.useState<GranFormatoRutaBaseReglaDraft[]>([]);
  const [savedRutaBaseSnapshot, setSavedRutaBaseSnapshot] = React.useState(normalizeRutaBaseDraftSnapshot("", []));
  const [isLoadingRutaBase, setIsLoadingRutaBase] = React.useState(true);
  const [isSavingRutaBase, startSavingRutaBase] = React.useTransition();

  const loadData = React.useCallback(async () => {
    setIsLoadingRutaBase(true);
    try {
      const [config, routeBase] = await Promise.all([
        getGranFormatoConfig(props.producto.id),
        getGranFormatoRutaBase(props.producto.id),
      ]);
      setTecnologiasCompatibles(config.tecnologiasCompatibles ?? []);
      setMaquinasCompatiblesIds(config.maquinasCompatibles ?? []);
      setPerfilesCompatiblesIds(config.perfilesCompatibles ?? []);
      const nextReglas = routeBase.reglasImpresion.map((item) => ({
        id: item.id || crypto.randomUUID(),
        tecnologia: item.tecnologia,
        maquinaId: item.maquinaId ?? "",
        pasoPlantillaId: item.pasoPlantillaId,
        perfilOperativoDefaultId: item.perfilOperativoDefaultId ?? "",
      }));
      setRutaBaseProcesoId(routeBase.procesoDefinicionId ?? "");
      setRutaBaseReglasImpresion(nextReglas);
      setSavedRutaBaseSnapshot(normalizeRutaBaseDraftSnapshot(routeBase.procesoDefinicionId ?? "", nextReglas));
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "No se pudo cargar la ruta base de gran formato.");
    } finally {
      setIsLoadingRutaBase(false);
    }
  }, [props.producto.id]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const availableMachines = React.useMemo(() => props.maquinas.filter((item) => isWideFormatMachine(item)), [props.maquinas]);
  const filteredMachines = React.useMemo(() => {
    if (tecnologiasCompatibles.length === 0) return [] as Maquina[];
    const selected = new Set(tecnologiasCompatibles);
    return availableMachines.filter((machine) => {
      const tecnologia = getMaquinaTecnologia(machine);
      return tecnologia ? selected.has(tecnologia) : false;
    });
  }, [availableMachines, tecnologiasCompatibles]);
  const selectedMachines = React.useMemo(
    () => filteredMachines.filter((machine) => maquinasCompatiblesIds.includes(machine.id)),
    [filteredMachines, maquinasCompatiblesIds],
  );
  const routeBasePlantillasActivas = React.useMemo(() => props.plantillasPaso.filter((item) => item.activo), [props.plantillasPaso]);
  const routeBasePlantillaById = React.useMemo(
    () => new Map(routeBasePlantillasActivas.map((item) => [item.id, item])),
    [routeBasePlantillasActivas],
  );
  const routeBaseProceso = React.useMemo(
    () => props.procesos.find((item) => item.id === rutaBaseProcesoId) ?? null,
    [props.procesos, rutaBaseProcesoId],
  );
  const machineById = React.useMemo(() => new Map(props.maquinas.map((item) => [item.id, item])), [props.maquinas]);
  const maquinasCompatiblesSet = React.useMemo(() => new Set(maquinasCompatiblesIds), [maquinasCompatiblesIds]);
  const tecnologiasCompatiblesSet = React.useMemo(() => new Set(tecnologiasCompatibles), [tecnologiasCompatibles]);
  const selectedProfilesByMachine = React.useMemo(() => {
    const next = new Map<string, typeof selectedMachines[number]["perfilesOperativos"]>();
    for (const machine of selectedMachines) {
      next.set(machine.id, machine.perfilesOperativos.filter((profile) => profile.activo && perfilesCompatiblesIds.includes(profile.id)));
    }
    return next;
  }, [perfilesCompatiblesIds, selectedMachines]);
  const rutaBasePrintingPlantillas = React.useMemo(() => {
    if (!routeBaseProceso) return [] as ProcesoOperacionPlantilla[];
    const resolvedIds = new Set(
      routeBaseProceso.operaciones
        .map((operation) => {
          const detalle = (operation.detalle ?? null) as Record<string, unknown> | null;
          const directId = getPasoPlantillaIdFromDetalle(detalle);
          if (directId) return directId;
          const nombre = operation.nombre?.trim().toLowerCase() ?? "";
          const nombreBase = normalizePasoNombreBase(operation.nombre);
          if (!nombre) return "";
          const exactWithMachine =
            routeBasePlantillasActivas.find(
              (item) => item.nombre.trim().toLowerCase() === nombre && (item.maquinaId ?? "") === (operation.maquinaId ?? ""),
            ) ?? null;
          if (exactWithMachine) return exactWithMachine.id;
          const exactWithProfile =
            routeBasePlantillasActivas.find(
              (item) =>
                Boolean(item.perfilOperativoId) &&
                item.perfilOperativoId === (operation.perfilOperativoId ?? "") &&
                (item.maquinaId ?? "") === (operation.maquinaId ?? ""),
            ) ?? null;
          if (exactWithProfile) return exactWithProfile.id;
          const baseWithMachine =
            routeBasePlantillasActivas.find(
              (item) => normalizePasoNombreBase(item.nombre) === nombreBase && (item.maquinaId ?? "") === (operation.maquinaId ?? ""),
            ) ?? null;
          if (baseWithMachine) return baseWithMachine.id;
          const exact = routeBasePlantillasActivas.find((item) => item.nombre.trim().toLowerCase() === nombre) ?? null;
          if (exact) return exact.id;
          const base = routeBasePlantillasActivas.find((item) => normalizePasoNombreBase(item.nombre) === nombreBase) ?? null;
          return base?.id ?? "";
        })
        .filter(Boolean),
    );

    return routeBasePlantillasActivas.filter((item) => {
      if (!item.maquinaId || !resolvedIds.has(item.id)) return false;
      const machine = machineById.get(item.maquinaId);
      if (!machine || !maquinasCompatiblesSet.has(machine.id)) return false;
      const tecnologia = getMaquinaTecnologia(machine);
      return Boolean(tecnologia && tecnologiasCompatiblesSet.has(tecnologia));
    });
  }, [machineById, maquinasCompatiblesSet, routeBasePlantillasActivas, routeBaseProceso, tecnologiasCompatiblesSet]);
  const currentRutaBaseSnapshot = React.useMemo(
    () => normalizeRutaBaseDraftSnapshot(rutaBaseProcesoId, rutaBaseReglasImpresion),
    [rutaBaseProcesoId, rutaBaseReglasImpresion],
  );
  const isRutaBaseDirty = currentRutaBaseSnapshot !== savedRutaBaseSnapshot;

  React.useEffect(() => {
    setRutaBaseReglasImpresion((prev) => {
      const next = prev.filter((item) => !item.tecnologia || tecnologiasCompatiblesSet.has(item.tecnologia)).map((item) => {
        const machine = item.maquinaId ? selectedMachines.find((candidate) => candidate.id === item.maquinaId) ?? null : null;
        const technology = machine ? getMaquinaTecnologia(machine) ?? item.tecnologia : item.tecnologia;
        const machineOptions = selectedMachines.filter((candidate) => getMaquinaTecnologia(candidate) === technology);
        const nextMachineId = item.maquinaId && machineOptions.some((candidate) => candidate.id === item.maquinaId) ? item.maquinaId : "";
        const printingOptions = rutaBasePrintingPlantillas.filter((plantilla) => {
          if (!plantilla.maquinaId) return false;
          const candidateMachine = machineById.get(plantilla.maquinaId);
          if (!candidateMachine) return false;
          if (getMaquinaTecnologia(candidateMachine) !== technology) return false;
          return nextMachineId ? plantilla.maquinaId === nextMachineId : true;
        });
        const pasoPlantillaId = item.pasoPlantillaId && printingOptions.some((option) => option.id === item.pasoPlantillaId) ? item.pasoPlantillaId : "";
        const plantilla = pasoPlantillaId ? routeBasePlantillaById.get(pasoPlantillaId) ?? null : null;
        const profiles = plantilla?.maquinaId ? selectedProfilesByMachine.get(plantilla.maquinaId) ?? [] : [];
        const perfilOperativoDefaultId =
          item.perfilOperativoDefaultId && profiles.some((profile) => profile.id === item.perfilOperativoDefaultId)
            ? item.perfilOperativoDefaultId
            : "";
        return {
          ...item,
          tecnologia: technology,
          maquinaId: nextMachineId,
          pasoPlantillaId,
          perfilOperativoDefaultId,
        };
      });
      const nextSnapshot = normalizeRutaBaseDraftSnapshot(rutaBaseProcesoId, next);
      return nextSnapshot === normalizeRutaBaseDraftSnapshot(rutaBaseProcesoId, prev) ? prev : next;
    });
  }, [
    machineById,
    routeBasePlantillaById,
    rutaBasePrintingPlantillas,
    rutaBaseProcesoId,
    selectedMachines,
    selectedProfilesByMachine,
    tecnologiasCompatiblesSet,
  ]);

  const handleSaveRutaBase = () => {
    startSavingRutaBase(async () => {
      try {
        const updated = await updateGranFormatoRutaBase(props.producto.id, {
          procesoDefinicionId: rutaBaseProcesoId || null,
          reglasImpresion: rutaBaseReglasImpresion
            .filter((item) => item.tecnologia && item.pasoPlantillaId)
            .map((item) => ({
              tecnologia: item.tecnologia,
              maquinaId: item.maquinaId || null,
              pasoPlantillaId: item.pasoPlantillaId,
              perfilOperativoDefaultId: item.perfilOperativoDefaultId || null,
            })),
        });
        const nextReglas = updated.reglasImpresion.map((item) => ({
          id: item.id || crypto.randomUUID(),
          tecnologia: item.tecnologia,
          maquinaId: item.maquinaId ?? "",
          pasoPlantillaId: item.pasoPlantillaId,
          perfilOperativoDefaultId: item.perfilOperativoDefaultId ?? "",
        }));
        setRutaBaseProcesoId(updated.procesoDefinicionId ?? "");
        setRutaBaseReglasImpresion(nextReglas);
        setSavedRutaBaseSnapshot(normalizeRutaBaseDraftSnapshot(updated.procesoDefinicionId ?? "", nextReglas));
        toast.success("Ruta base actualizada.");
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "No se pudo guardar la ruta base.");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ruta base</CardTitle>
        <CardDescription>
          Configurá los pasos fijos compartidos y las reglas que resuelven el paso de impresión por tecnología y máquina.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoadingRutaBase ? (
          <div className="flex items-center gap-2 rounded-lg border p-4 text-sm text-muted-foreground">
            <GdiSpinner className="size-4" />
            Cargando ruta base...
          </div>
        ) : (
          <>
            <ProductoTabSection
              title="Resumen de configuración"
              description="Lectura rápida de la ruta base, la prioridad de resolución y la cantidad de reglas activas."
              icon={InfoIcon}
              contentClassName="grid gap-3 md:grid-cols-4"
            >
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Ruta principal</p>
                <p className="mt-1 text-sm font-medium">
                  {routeBaseProceso ? `${routeBaseProceso.codigo} · ${routeBaseProceso.nombre}` : "Sin ruta"}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Prioridad</p>
                <p className="mt-1 text-sm font-medium">Máquina específica sobre tecnología</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Reglas activas</p>
                <p className="mt-1 text-sm font-medium">{rutaBaseReglasImpresion.filter((item) => item.tecnologia && item.pasoPlantillaId).length}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Estado</p>
                <p className="mt-1 text-sm font-medium">{isRutaBaseDirty ? "Hay cambios pendientes" : "Sin cambios pendientes"}</p>
              </div>
            </ProductoTabSection>

            <ProductoTabSection
              title="Ruta principal"
              description="Seleccioná la ruta base del producto y revisá sus pasos antes de definir reglas de impresión."
              icon={MapIcon}
              actions={
                <Link href="/costos/procesos" className={buttonVariants({ variant: "outline" })}>
                  Ir al módulo Rutas
                </Link>
              }
            >
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Ruta de producción</p>
                    <Select
                      value={rutaBaseProcesoId || "__none__"}
                      onValueChange={(value) => {
                        const nextValue = value === "__none__" ? "" : String(value ?? "");
                        setRutaBaseProcesoId(nextValue);
                        setRutaBaseReglasImpresion((prev) =>
                          prev.map((row) => ({
                            ...row,
                            pasoPlantillaId: "",
                            perfilOperativoDefaultId: "",
                          })),
                        );
                      }}
                    >
                      <SelectTrigger className="w-full md:min-w-[420px]">
                        <SelectValue placeholder="Seleccionar ruta">
                          {routeBaseProceso ? `${routeBaseProceso.codigo} · ${routeBaseProceso.nombre}` : "Seleccionar ruta"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="min-w-[var(--radix-select-trigger-width)] md:min-w-[420px]">
                        <SelectItem value="__none__">Seleccionar ruta</SelectItem>
                        {props.procesos.map((proceso) => (
                          <SelectItem key={proceso.id} value={proceso.id}>
                            {proceso.codigo} · {proceso.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Link href="/costos/procesos" className={buttonVariants({ variant: "outline" })}>
                    Ir al módulo Rutas
                  </Link>
                </div>

                {routeBaseProceso ? (
                  <div className="rounded-md border">
                    <div className="border-b bg-muted/30 px-3 py-2 text-sm font-medium">Pasos de la ruta seleccionada</div>
                    <div className="p-3">
                      <div className="space-y-2 text-sm">
                        {routeBaseProceso.operaciones.map((operation) => (
                          <div key={operation.id} className="flex items-center gap-2">
                            <Badge variant="outline">{operation.orden}</Badge>
                            <span>{operation.nombre}</span>
                            <span className="text-muted-foreground">· {operation.centroCostoNombre}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                    Seleccioná una ruta de producción para definir la base del producto.
                  </div>
                )}
              </div>
            </ProductoTabSection>

            <ProductoTabSection
              title="Resolución de impresión"
              description="Definí qué paso y qué perfil default se usan por tecnología y, opcionalmente, por máquina puntual."
              actions={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRutaBaseReglasImpresion((prev) => [...prev, createRutaBaseReglaDraft()])}
                  disabled={tecnologiasCompatibles.length === 0 || !rutaBaseProcesoId}
                >
                  <PlusIcon className="size-4" data-icon="inline-start" />
                  Agregar regla
                </Button>
              }
            >
              <div className="space-y-3">
                {tecnologiasCompatibles.length === 0 ? (
                  <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                    Primero seleccioná tecnologías compatibles en el tab Tecnologías.
                  </div>
                ) : !rutaBaseProcesoId ? (
                  <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                    Primero seleccioná una ruta de producción base.
                  </div>
                ) : null}
                {rutaBaseReglasImpresion.length === 0 && tecnologiasCompatibles.length > 0 && rutaBaseProcesoId ? (
                  <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                    No hay reglas de impresión configuradas.
                  </div>
                ) : null}
                {rutaBaseReglasImpresion.length > 0 ? (
                  <div className="overflow-hidden rounded-lg border">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow>
                          <TableHead className="w-[180px]">Tecnología</TableHead>
                          <TableHead className="w-[220px]">Máquina específica</TableHead>
                          <TableHead>Paso de impresión</TableHead>
                          <TableHead className="w-[240px]">Perfil default</TableHead>
                          <TableHead className="w-[64px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                {rutaBaseReglasImpresion.map((item) => {
                  const machineOptions = selectedMachines.filter((machine) => getMaquinaTecnologia(machine) === item.tecnologia);
                  const printingOptions = rutaBasePrintingPlantillas.filter((plantilla) => {
                    if (!plantilla.maquinaId) return false;
                    const machine = machineById.get(plantilla.maquinaId);
                    if (!machine) return false;
                    if (getMaquinaTecnologia(machine) !== item.tecnologia) return false;
                    return item.maquinaId ? plantilla.maquinaId === item.maquinaId : true;
                  });
                  const currentSelectedPlantilla = item.pasoPlantillaId ? routeBasePlantillaById.get(item.pasoPlantillaId) ?? null : null;
                  const printingOptionsWithSelected =
                    currentSelectedPlantilla && !printingOptions.some((option) => option.id === currentSelectedPlantilla.id)
                      ? [currentSelectedPlantilla, ...printingOptions]
                      : printingOptions;
                  const plantilla = item.pasoPlantillaId ? routeBasePlantillaById.get(item.pasoPlantillaId) ?? null : null;
                  const perfilesDisponibles = plantilla?.maquinaId ? selectedProfilesByMachine.get(plantilla.maquinaId) ?? [] : [];
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Select
                          value={item.tecnologia || "__none__"}
                          onValueChange={(value) =>
                            setRutaBaseReglasImpresion((prev) =>
                              prev.map((row) =>
                                row.id === item.id
                                  ? {
                                      ...row,
                                      tecnologia: value === "__none__" ? "" : String(value ?? ""),
                                      maquinaId: "",
                                      pasoPlantillaId: "",
                                      perfilOperativoDefaultId: "",
                                    }
                                  : row,
                              ),
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar tecnología">{technologyLabels[item.tecnologia] ?? "Seleccionar tecnología"}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Seleccionar tecnología</SelectItem>
                            {tecnologiasCompatibles.map((tech) => (
                              <SelectItem key={`${item.id}-${tech}`} value={tech}>
                                {technologyLabels[tech] ?? tech}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.maquinaId || "__none__"}
                          onValueChange={(value) =>
                            setRutaBaseReglasImpresion((prev) =>
                              prev.map((row) =>
                                row.id === item.id
                                  ? {
                                      ...row,
                                      maquinaId: value === "__none__" ? "" : String(value ?? ""),
                                      pasoPlantillaId: "",
                                      perfilOperativoDefaultId: "",
                                    }
                                  : row,
                              ),
                            )
                          }
                          disabled={!item.tecnologia}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Fallback por tecnología">
                              {machineOptions.find((machine) => machine.id === item.maquinaId)?.nombre ?? "Fallback por tecnología"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Fallback por tecnología</SelectItem>
                            {machineOptions.map((machine) => (
                              <SelectItem key={machine.id} value={machine.id}>
                                {machine.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.pasoPlantillaId || "__none__"}
                          onValueChange={(value) =>
                            setRutaBaseReglasImpresion((prev) =>
                              prev.map((row) =>
                                row.id === item.id
                                  ? {
                                      ...row,
                                      pasoPlantillaId: value === "__none__" ? "" : String(value ?? ""),
                                      perfilOperativoDefaultId: "",
                                    }
                                  : row,
                              ),
                            )
                          }
                          disabled={!item.tecnologia}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar paso de impresión">{plantilla?.nombre ?? "Seleccionar paso de impresión"}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Seleccionar paso de impresión</SelectItem>
                            {printingOptionsWithSelected.map((option) => (
                              <SelectItem key={option.id} value={option.id}>
                                {option.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.perfilOperativoDefaultId || "__none__"}
                          onValueChange={(value) =>
                            setRutaBaseReglasImpresion((prev) =>
                              prev.map((row) =>
                                row.id === item.id
                                  ? {
                                      ...row,
                                      perfilOperativoDefaultId: value === "__none__" ? "" : String(value ?? ""),
                                    }
                                  : row,
                              ),
                            )
                          }
                          disabled={!plantilla?.maquinaId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sin perfil default">
                              {perfilesDisponibles.find((profile) => profile.id === item.perfilOperativoDefaultId)?.nombre ?? "Sin perfil default"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Sin perfil default</SelectItem>
                            {perfilesDisponibles.map((profile) => (
                              <SelectItem key={profile.id} value={profile.id}>
                                {profile.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button type="button" variant="ghost" size="icon" onClick={() => setRutaBaseReglasImpresion((prev) => prev.filter((row) => row.id !== item.id))}>
                          <Trash2Icon className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                      </TableBody>
                    </Table>
                  </div>
                ) : null}
              </div>
            </ProductoTabSection>

            <ProductoTabSection
              title="Preview de ruta efectiva"
              description="Validá rápidamente qué secuencia queda armada para cada regla de impresión."
              icon={EyeIcon}
            >
              <div className="space-y-3">
                {rutaBaseReglasImpresion.length === 0 ? (
                  <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                    Agregá al menos una regla de impresión para visualizar la ruta efectiva.
                  </div>
                ) : (
                  rutaBaseReglasImpresion.map((item) => {
                    const reglaPlantilla = routeBasePlantillaById.get(item.pasoPlantillaId);
                    const machineLabel = selectedMachines.find((machine) => machine.id === item.maquinaId)?.nombre ?? "Fallback por tecnología";
                    const labels = [...(routeBaseProceso?.operaciones.map((operation) => operation.nombre) ?? []), reglaPlantilla?.nombre ?? ""].filter(Boolean);
                    return (
                      <div key={`preview-${item.id}`} className="rounded-lg border p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{(technologyLabels[item.tecnologia] ?? item.tecnologia) || "Sin tecnología"}</Badge>
                          <Badge variant="outline">{machineLabel}</Badge>
                        </div>
                        <p className="mt-3 text-sm">{labels.length > 0 ? labels.join(" -> ") : "Sin pasos configurados todavía."}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </ProductoTabSection>

            <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Acción final</p>
                <p className="text-sm text-muted-foreground">
                  Guardá todos los cambios del tab cuando termines de revisar la ruta base y sus reglas.
                </p>
              </div>
              <Button type="button" onClick={handleSaveRutaBase} disabled={isSavingRutaBase || !isRutaBaseDirty}>
                {isSavingRutaBase ? <GdiSpinner className="size-4" data-icon="inline-start" /> : <SaveIcon className="size-4" data-icon="inline-start" />}
                Guardar cambios
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
