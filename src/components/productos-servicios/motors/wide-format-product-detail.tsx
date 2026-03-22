"use client";

import * as React from "react";
import Link from "next/link";
import { SaveIcon } from "lucide-react";
import { toast } from "sonner";

import { GdiSpinner } from "@/components/brand/gdi-spinner";
import type { DigitalProductDetailProps } from "@/components/productos-servicios/motors/digital-product-detail";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { MateriaPrima } from "@/lib/materias-primas";
import { getVarianteOptionChips } from "@/lib/materias-primas-variantes-display";
import {
  getMaquinaGeometriasCompatibles,
  getMaquinaTecnologia,
  tecnologiaMaquinaItems,
  type Maquina,
} from "@/lib/maquinaria";
import {
  assignProductoMotor,
  getGranFormatoConfig,
  updateGranFormatoConfig,
  updateProductoServicio,
} from "@/lib/productos-servicios-api";
import {
  estadoProductoServicioItems,
  tipoProductoServicioItems,
  type TipoVentaGranFormato,
} from "@/lib/productos-servicios";

const wideFormatTabs = [
  { value: "general", label: "General" },
  { value: "tecnologias", label: "Tecnologías" },
  { value: "produccion", label: "Ruta base" },
  { value: "checklist", label: "Ruta de opcionales" },
  { value: "cotizador", label: "Costos" },
  { value: "precio", label: "Precio" },
  { value: "simulacion-comercial", label: "Simulación comercial" },
] as const;

const tipoVentaItems: Array<{ value: TipoVentaGranFormato; label: string }> = [
  { value: "m2", label: "Metro cuadrado" },
  { value: "metro_lineal", label: "Metro lineal" },
];
const EMPTY_MATERIAL_BASE_VALUE = "__empty_material_base__";

const technologyOrder = tecnologiaMaquinaItems.map((item) => item.value);

const technologyLabels: Record<string, string> = Object.fromEntries(
  tecnologiaMaquinaItems.map((item) => [item.value, item.label]),
);

function PlaceholderTab({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
          Esta sección queda abierta para definir la lógica específica del motor de gran formato.
        </div>
      </CardContent>
    </Card>
  );
}

function isWideFormatMachine(maquina: Maquina) {
  return (
    maquina.activo &&
    getMaquinaGeometriasCompatibles(maquina).includes("rollo") &&
    Boolean(getMaquinaTecnologia(maquina))
  );
}

function toggleInArray(items: string[], value: string, checked: boolean) {
  if (checked) {
    return Array.from(new Set([...items, value]));
  }
  return items.filter((item) => item !== value);
}

export function WideFormatProductDetail({
  producto,
  familias,
  subfamilias,
  motores,
  maquinas,
  materiasPrimas,
}: DigitalProductDetailProps) {
  const [activeTab, setActiveTab] = React.useState("general");
  const [productoState, setProductoState] = React.useState(producto);
  const [isSavingGeneral, startSavingGeneral] = React.useTransition();
  const [isSavingConfig, startSavingConfig] = React.useTransition();
  const [isLoadingConfig, setIsLoadingConfig] = React.useState(true);
  const [generalForm, setGeneralForm] = React.useState({
    nombre: producto.nombre,
    descripcion: producto.descripcion ?? "",
    familiaProductoId: producto.familiaProductoId,
    subfamiliaProductoId: producto.subfamiliaProductoId ?? "",
    motorCodigo: producto.motorCodigo,
    motorVersion: producto.motorVersion,
  });
  const [tipoVenta, setTipoVenta] = React.useState<TipoVentaGranFormato>("m2");
  const [savedTipoVenta, setSavedTipoVenta] = React.useState<TipoVentaGranFormato>("m2");
  const [tecnologiasCompatibles, setTecnologiasCompatibles] = React.useState<string[]>([]);
  const [savedTecnologiasCompatibles, setSavedTecnologiasCompatibles] = React.useState<string[]>([]);
  const [maquinasCompatiblesIds, setMaquinasCompatiblesIds] = React.useState<string[]>([]);
  const [savedMaquinasCompatiblesIds, setSavedMaquinasCompatiblesIds] = React.useState<string[]>([]);
  const [perfilesCompatiblesIds, setPerfilesCompatiblesIds] = React.useState<string[]>([]);
  const [savedPerfilesCompatiblesIds, setSavedPerfilesCompatiblesIds] = React.useState<string[]>([]);
  const [materialBaseId, setMaterialBaseId] = React.useState<string>("");
  const [savedMaterialBaseId, setSavedMaterialBaseId] = React.useState<string>("");
  const [materialesCompatiblesIds, setMaterialesCompatiblesIds] = React.useState<string[]>([]);
  const [savedMaterialesCompatiblesIds, setSavedMaterialesCompatiblesIds] = React.useState<string[]>([]);

  const loadGranFormatoConfig = React.useCallback(async () => {
    setIsLoadingConfig(true);
    try {
      const config = await getGranFormatoConfig(productoState.id);
      setTipoVenta(config.tipoVenta);
      setSavedTipoVenta(config.tipoVenta);
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
      toast.error(error instanceof Error ? error.message : "No se pudo cargar la configuración de gran formato.");
    } finally {
      setIsLoadingConfig(false);
    }
  }, [productoState.id]);

  React.useEffect(() => {
    void loadGranFormatoConfig();
  }, [loadGranFormatoConfig]);

  const estadoProductoLabel = React.useMemo(
    () => estadoProductoServicioItems.find((item) => item.value === productoState.estado)?.label ?? productoState.estado,
    [productoState.estado],
  );
  const tipoProductoLabel = React.useMemo(
    () => tipoProductoServicioItems.find((item) => item.value === productoState.tipo)?.label ?? productoState.tipo,
    [productoState.tipo],
  );
  const subfamiliasFiltradasGeneral = React.useMemo(
    () => subfamilias.filter((item) => item.familiaProductoId === generalForm.familiaProductoId),
    [subfamilias, generalForm.familiaProductoId],
  );
  const familiaGeneralLabel = React.useMemo(
    () => familias.find((item) => item.id === generalForm.familiaProductoId)?.nombre ?? "Seleccionar familia",
    [familias, generalForm.familiaProductoId],
  );
  const subfamiliaGeneralLabel = React.useMemo(() => {
    if (!generalForm.subfamiliaProductoId) {
      return "Sin subfamilia";
    }
    return (
      subfamiliasFiltradasGeneral.find((item) => item.id === generalForm.subfamiliaProductoId)?.nombre ??
      "Sin subfamilia"
    );
  }, [generalForm.subfamiliaProductoId, subfamiliasFiltradasGeneral]);
  const motorCostoValue = `${generalForm.motorCodigo}@${generalForm.motorVersion}`;
  const motorCostoLabel = React.useMemo(
    () =>
      motores.find((item) => `${item.code}@${item.version}` === motorCostoValue)?.label ??
      "Selecciona motor de costo",
    [motores, motorCostoValue],
  );
  const isGeneralDirty =
    generalForm.nombre.trim() !== (productoState.nombre ?? "").trim() ||
    generalForm.descripcion.trim() !== (productoState.descripcion ?? "").trim() ||
    generalForm.familiaProductoId !== productoState.familiaProductoId ||
    (generalForm.subfamiliaProductoId || "") !== (productoState.subfamiliaProductoId || "") ||
    generalForm.motorCodigo !== productoState.motorCodigo ||
    generalForm.motorVersion !== productoState.motorVersion;

  const availableMachines = React.useMemo(() => maquinas.filter((item) => isWideFormatMachine(item)), [maquinas]);
  const availableTechnologyItems = React.useMemo(() => {
    const available = new Set<string>();
    for (const machine of availableMachines) {
      const tecnologia = getMaquinaTecnologia(machine);
      if (tecnologia) {
        available.add(tecnologia);
      }
    }
    return technologyOrder
      .filter((value) => available.has(value))
      .map((value) => ({
        value,
        label: technologyLabels[value],
      }));
  }, [availableMachines]);

  const filteredMachines = React.useMemo(() => {
    if (tecnologiasCompatibles.length === 0) {
      return [] as Maquina[];
    }
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
      for (const profile of group.profiles) {
        ids.add(profile.id);
      }
    }
    return ids;
  }, [groupedProfiles]);

  const availableBaseMaterials = React.useMemo(
    () =>
      materiasPrimas.filter(
        (item) => item.activo && item.subfamilia === "sustrato_rollo_flexible" && item.variantes.some((variant) => variant.activo),
      ),
    [materiasPrimas],
  );

  const selectedBaseMaterial = React.useMemo(
    () => availableBaseMaterials.find((item) => item.id === materialBaseId) ?? null,
    [availableBaseMaterials, materialBaseId],
  );
  const tipoVentaLabel = React.useMemo(
    () => tipoVentaItems.find((item) => item.value === tipoVenta)?.label ?? "Seleccionar tipo de venta",
    [tipoVenta],
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
    setMaquinasCompatiblesIds((prev) => prev.filter((id) => filteredMachineIds.has(id)));
  }, [filteredMachineIds]);

  React.useEffect(() => {
    setPerfilesCompatiblesIds((prev) => prev.filter((id) => validProfileIds.has(id)));
  }, [validProfileIds]);

  React.useEffect(() => {
    setMaterialesCompatiblesIds((prev) => prev.filter((id) => validMaterialVariantIds.has(id)));
  }, [validMaterialVariantIds]);

  const isConfigDirty =
    tipoVenta !== savedTipoVenta ||
    JSON.stringify([...tecnologiasCompatibles].sort()) !== JSON.stringify([...savedTecnologiasCompatibles].sort()) ||
    JSON.stringify([...maquinasCompatiblesIds].sort()) !== JSON.stringify([...savedMaquinasCompatiblesIds].sort()) ||
    JSON.stringify([...perfilesCompatiblesIds].sort()) !== JSON.stringify([...savedPerfilesCompatiblesIds].sort()) ||
    materialBaseId !== savedMaterialBaseId ||
    JSON.stringify([...materialesCompatiblesIds].sort()) !== JSON.stringify([...savedMaterialesCompatiblesIds].sort());

  const handleSaveGeneral = () => {
    if (!generalForm.nombre.trim()) {
      toast.error("El nombre del producto es obligatorio.");
      return;
    }

    startSavingGeneral(async () => {
      try {
        const updated = await updateProductoServicio(productoState.id, {
          codigo: productoState.codigo,
          nombre: generalForm.nombre.trim(),
          descripcion: generalForm.descripcion.trim(),
          familiaProductoId: generalForm.familiaProductoId,
          subfamiliaProductoId: generalForm.subfamiliaProductoId || undefined,
          motorCodigo: generalForm.motorCodigo,
          motorVersion: generalForm.motorVersion,
          estado: productoState.estado,
          activo: productoState.activo,
        });
        const motorChanged =
          updated.motorCodigo !== generalForm.motorCodigo ||
          updated.motorVersion !== generalForm.motorVersion;
        const withMotor = motorChanged
          ? await assignProductoMotor(updated.id, {
              motorCodigo: generalForm.motorCodigo,
              motorVersion: generalForm.motorVersion,
            })
          : updated;
        setProductoState(withMotor);
        setGeneralForm({
          nombre: withMotor.nombre,
          descripcion: withMotor.descripcion ?? "",
          familiaProductoId: withMotor.familiaProductoId,
          subfamiliaProductoId: withMotor.subfamiliaProductoId ?? "",
          motorCodigo: withMotor.motorCodigo,
          motorVersion: withMotor.motorVersion,
        });
        toast.success("Datos generales actualizados.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo actualizar el producto.");
      }
    });
  };

  const handleSaveTecnologias = () => {
    startSavingConfig(async () => {
      try {
        const updated = await updateGranFormatoConfig(productoState.id, {
          tipoVenta,
          tecnologiasCompatibles,
          maquinasCompatibles: maquinasCompatiblesIds,
          perfilesCompatibles: perfilesCompatiblesIds,
          materialBaseId: materialBaseId || null,
          materialesCompatibles: materialesCompatiblesIds,
        });
        setTipoVenta(updated.tipoVenta);
        setSavedTipoVenta(updated.tipoVenta);
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
        toast.success("Tecnologías compatibles actualizadas.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo guardar la configuración técnica.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link
            href="/costos/productos-servicios"
            className={cn(buttonVariants({ variant: "ghost" }), "-ml-3")}
          >
            Volver a catalogo de productos
          </Link>
          <h1 className="text-xl font-semibold">{productoState.nombre}</h1>
          <p className="text-sm text-muted-foreground">
            {productoState.codigo} · {productoState.familiaProductoNombre}
            {productoState.subfamiliaProductoNombre ? ` · ${productoState.subfamiliaProductoNombre}` : ""}
          </p>
        </div>
        <Badge variant={productoState.estado === "activo" ? "default" : "secondary"}>{estadoProductoLabel}</Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col gap-4">
        <TabsList className="h-auto gap-1 rounded-lg bg-muted/70 p-1.5">
          {wideFormatTabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="cursor-pointer rounded-md px-4 py-2.5 text-sm font-medium transition-transform duration-150 hover:scale-[1.02] data-active:scale-100 data-active:bg-orange-600 data-active:text-white data-active:font-bold data-active:hover:bg-orange-600 data-active:hover:text-white"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General</CardTitle>
              <CardDescription>Identidad comercial y motor de costo del producto.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Nombre</p>
                <Input
                  value={generalForm.nombre}
                  onChange={(e) => setGeneralForm((prev) => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Nombre del producto"
                />
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Código</p>
                <p className="font-medium">{productoState.codigo}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Clase</p>
                <p className="font-medium">{tipoProductoLabel}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Estado</p>
                <p className="font-medium">{estadoProductoLabel}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Familia</p>
                <Select
                  value={generalForm.familiaProductoId}
                  onValueChange={(value) =>
                    setGeneralForm((prev) => ({
                      ...prev,
                      familiaProductoId: value ?? "",
                      subfamiliaProductoId: "",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar familia">{familiaGeneralLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {familias.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Subfamilia</p>
                <Select
                  value={generalForm.subfamiliaProductoId || "__none__"}
                  onValueChange={(value) =>
                    setGeneralForm((prev) => ({
                      ...prev,
                      subfamiliaProductoId: !value || value === "__none__" ? "" : value,
                    }))
                  }
                  disabled={subfamiliasFiltradasGeneral.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin subfamilia">{subfamiliaGeneralLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin subfamilia</SelectItem>
                    {subfamiliasFiltradasGeneral.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-lg border p-3 md:col-span-2">
                <p className="text-xs text-muted-foreground">Descripción</p>
                <textarea
                  value={generalForm.descripcion}
                  onChange={(e) => setGeneralForm((prev) => ({ ...prev, descripcion: e.target.value }))}
                  placeholder="Descripción del producto"
                  className="min-h-[96px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="rounded-lg border p-3 md:col-span-2">
                <p className="text-xs text-muted-foreground">Motor de costo</p>
                <Select
                  value={motorCostoValue}
                  onValueChange={(value) =>
                    setGeneralForm((prev) => {
                      const [motorCodigo, motorVersionRaw] = String(value ?? "").split("@");
                      const parsedVersion = Number(motorVersionRaw ?? "1");
                      return {
                        ...prev,
                        motorCodigo: motorCodigo || prev.motorCodigo,
                        motorVersion: Number.isFinite(parsedVersion) ? parsedVersion : prev.motorVersion,
                      };
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona motor de costo">{motorCostoLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {motores.map((item) => (
                      <SelectItem key={`${item.code}@${item.version}`} value={`${item.code}@${item.version}`}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground md:col-span-2">
                Este producto funciona como plantilla de trabajo para gran formato. La compatibilidad técnica se define
                en el tab Tecnologías.
              </div>
              <div className="md:col-span-2">
                <Button type="button" onClick={handleSaveGeneral} disabled={isSavingGeneral || !isGeneralDirty}>
                  {isSavingGeneral ? <GdiSpinner className="size-4" /> : <SaveIcon />}
                  Guardar datos generales
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tecnologias" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tecnologías</CardTitle>
              <CardDescription>
                Definí tecnologías, equipos, perfiles y material base compatibles para este producto.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-4 rounded-lg border p-4 md:flex-row md:items-end md:justify-between">
                <div className="w-full max-w-sm">
                  <p className="mb-2 text-xs text-muted-foreground">Tipo de venta</p>
                  <Select value={tipoVenta} onValueChange={(value) => setTipoVenta(value as TipoVentaGranFormato)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo de venta">{tipoVentaLabel}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {tipoVentaItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" onClick={handleSaveTecnologias} disabled={isSavingConfig || isLoadingConfig || !isConfigDirty}>
                  {isSavingConfig ? <GdiSpinner className="size-4" /> : <SaveIcon />}
                  Guardar tecnologías
                </Button>
              </div>

              {isLoadingConfig ? (
                <div className="flex items-center gap-2 rounded-lg border p-4 text-sm text-muted-foreground">
                  <GdiSpinner className="size-4" />
                  Cargando configuración de gran formato...
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-3">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Tecnologías compatibles</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {availableTechnologyItems.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No hay tecnologías compatibles configuradas.</p>
                      ) : (
                        availableTechnologyItems.map((item) => (
                          <label key={item.value} className="flex items-center gap-3 text-sm">
                            <Checkbox
                              checked={tecnologiasCompatibles.includes(item.value)}
                              onCheckedChange={(checked) =>
                                setTecnologiasCompatibles((prev) => toggleInArray(prev, item.value, checked === true))
                              }
                            />
                            <span>{item.label}</span>
                          </label>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Equipos compatibles</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {filteredMachines.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Seleccioná al menos una tecnología para habilitar equipos.
                        </p>
                      ) : (
                        filteredMachines.map((machine) => (
                          <label key={machine.id} className="flex items-center gap-3 text-sm">
                            <Checkbox
                              checked={maquinasCompatiblesIds.includes(machine.id)}
                              onCheckedChange={(checked) =>
                                setMaquinasCompatiblesIds((prev) => toggleInArray(prev, machine.id, checked === true))
                              }
                            />
                            <div>
                              <div>{machine.nombre}</div>
                              <div className="text-xs text-muted-foreground">{machine.codigo}</div>
                            </div>
                          </label>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Calidades</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {groupedProfiles.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Seleccioná al menos un equipo para habilitar perfiles.
                        </p>
                      ) : (
                        groupedProfiles.map((group) => (
                          <div key={group.machine.id} className="space-y-2">
                            <p className="text-sm font-medium">{group.machine.nombre}</p>
                            <div className="space-y-2">
                              {group.profiles.map((profile) => (
                                <label key={profile.id} className="flex items-center gap-3 text-sm">
                                  <Checkbox
                                    checked={perfilesCompatiblesIds.includes(profile.id)}
                                    onCheckedChange={(checked) =>
                                      setPerfilesCompatiblesIds((prev) =>
                                        toggleInArray(prev, profile.id, checked === true),
                                      )
                                    }
                                  />
                                  <span>{profile.nombre}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Material base</CardTitle>
                    <CardDescription>Seleccioná un único material base principal para este producto.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Select
                      value={materialBaseId || EMPTY_MATERIAL_BASE_VALUE}
                      onValueChange={(value) => {
                        const nextValue =
                          String(value ?? "") === EMPTY_MATERIAL_BASE_VALUE ? "" : String(value ?? "");
                        setMaterialBaseId(nextValue);
                        if (!nextValue) {
                          setMaterialesCompatiblesIds([]);
                          return;
                        }
                        const nextMaterial = availableBaseMaterials.find((item) => item.id === nextValue) ?? null;
                        const nextVariantIds = (nextMaterial?.variantes ?? [])
                          .filter((variant) => variant.activo)
                          .map((variant) => variant.id);
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
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Variantes de material compatibles</CardTitle>
                    <CardDescription>
                      Elegí anchos de rollo u otras variantes activas del material base seleccionado.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!selectedBaseMaterial ? (
                      <p className="text-sm text-muted-foreground">
                        Seleccioná un material base para habilitar sus variantes compatibles.
                      </p>
                    ) : availableMaterialVariants.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        El material base seleccionado no tiene variantes activas.
                      </p>
                    ) : (
                      availableMaterialVariants.map((variant) => (
                        <label
                          key={variant.id}
                          className="flex items-start gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/20"
                        >
                          <Checkbox
                            checked={materialesCompatiblesIds.includes(variant.id)}
                            onCheckedChange={(checked) =>
                              setMaterialesCompatiblesIds((prev) => toggleInArray(prev, variant.id, checked === true))
                            }
                          />
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-1">
                              {getVarianteOptionChips(selectedBaseMaterial, variant).map((chip) => (
                                <span
                                  key={`${variant.id}-${chip.key}`}
                                  className="rounded border px-2 py-0.5 text-xs"
                                >
                                  {chip.label}: {chip.value}
                                </span>
                              ))}
                            </div>
                          </div>
                        </label>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="produccion">
          <PlaceholderTab
            title="Ruta base"
            description="Acá definiremos los pasos base de producción y su relación con las tecnologías compatibles."
          />
        </TabsContent>

        <TabsContent value="checklist">
          <PlaceholderTab
            title="Ruta de opcionales"
            description="Acá definiremos opcionales como diseño, laminado, corte, instalación y otras terminaciones."
          />
        </TabsContent>

        <TabsContent value="cotizador">
          <PlaceholderTab
            title="Costos"
            description="Acá definiremos el cálculo técnico del trabajo según material, ancho útil, desperdicio y equipo."
          />
        </TabsContent>

        <TabsContent value="precio">
          <PlaceholderTab
            title="Precio"
            description="Acá definiremos la capa comercial sobre el costo técnico del trabajo de gran formato."
          />
        </TabsContent>

        <TabsContent value="simulacion-comercial">
          <PlaceholderTab
            title="Simulación comercial"
            description="Acá compararemos costo técnico, precio final y margen para trabajos de gran formato."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
