"use client";

import * as React from "react";
import {
  Building2Icon,
  FolderTreeIcon,
  PencilIcon,
  PlusIcon,
  RefreshCcwIcon,
  SparklesIcon,
} from "lucide-react";
import { toast } from "sonner";

import { GdiSpinner } from "@/components/brand/gdi-spinner";
import {
  createAreaCosto,
  createCentroCosto,
  createPlanta,
  getAreasCosto,
  getCentrosCosto,
  getPlantas,
  toggleAreaCosto,
  toggleCentroCosto,
  togglePlanta,
  updateAreaCosto,
  updateCentroCosto,
  updatePlanta,
} from "@/lib/costos-api";
import {
  categoriaGraficaItems,
  CentroCosto,
  getCategoriaGraficaLabel,
  getImputacionPreferidaLabel,
  getTipoCentroLabel,
  getUnidadBaseLabel,
  imputacionPreferidaItems,
  Planta,
  tipoCentroItems,
  unidadBaseItems,
  type AreaCosto,
  type CentroCostoPayload,
  type AreaCostoPayload,
  type PlantaPayload,
} from "@/lib/costos";
import { EmpleadoDetalle } from "@/lib/empleados";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CentroCostoConfigurator } from "@/components/costos/centro-costo-configurator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type CostosPanelProps = {
  initialPlantas: Planta[];
  initialAreas: AreaCosto[];
  initialCentros: CentroCosto[];
  empleados: EmpleadoDetalle[];
};

function createEmptyPlanta(): PlantaPayload {
  return {
    codigo: "",
    nombre: "",
    descripcion: "",
  };
}

function createEmptyArea(plantaId = ""): AreaCostoPayload {
  return {
    plantaId,
    codigo: "",
    nombre: "",
    descripcion: "",
  };
}

function createEmptyCentro(plantaId = "", areaCostoId = ""): CentroCostoPayload {
  return {
    plantaId,
    areaCostoId,
    codigo: "",
    nombre: "",
    descripcion: "",
    tipoCentro: "productivo",
    categoriaGrafica: "preprensa",
    imputacionPreferida: "directa",
    unidadBaseFutura: "ninguna",
    responsableEmpleadoId: undefined,
    activo: true,
  };
}

const EMPTY_SELECT_VALUE = "__none__";

function formatMoneyOrDash(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function getNextCentroCodigo(areaCodigo: string, centros: CentroCosto[]) {
  const prefix = `${areaCodigo.toUpperCase()}-`;
  let maxSequence = 0;

  for (const centro of centros) {
    if (!centro.codigo.startsWith(prefix)) {
      continue;
    }

    const sequence = Number.parseInt(centro.codigo.slice(prefix.length), 10);

    if (Number.isFinite(sequence)) {
      maxSequence = Math.max(maxSequence, sequence);
    }
  }

  return `${prefix}${String(maxSequence + 1).padStart(3, "0")}`;
}

export function CostosPanel({
  initialPlantas,
  initialAreas,
  initialCentros,
  empleados,
}: CostosPanelProps) {
  const [plantas, setPlantas] = React.useState(initialPlantas);
  const [areas, setAreas] = React.useState(initialAreas);
  const [centros, setCentros] = React.useState(initialCentros);
  const [activeTab, setActiveTab] = React.useState("plantas");
  const [selectedCentro, setSelectedCentro] = React.useState<CentroCosto | null>(null);
  const [isConfiguratorOpen, setIsConfiguratorOpen] = React.useState(false);
  const [editingPlantaId, setEditingPlantaId] = React.useState<string | null>(null);
  const [editingAreaId, setEditingAreaId] = React.useState<string | null>(null);
  const [editingCentroId, setEditingCentroId] = React.useState<string | null>(null);
  const [plantaForm, setPlantaForm] = React.useState<PlantaPayload>(createEmptyPlanta);
  const [areaForm, setAreaForm] = React.useState<AreaCostoPayload>(() =>
    createEmptyArea(initialPlantas[0]?.id ?? ""),
  );
  const [centroForm, setCentroForm] = React.useState<CentroCostoPayload>(() =>
    createEmptyCentro(initialPlantas[0]?.id ?? "", initialAreas[0]?.id ?? ""),
  );
  const [isReloading, startReloading] = React.useTransition();
  const [isSaving, startSaving] = React.useTransition();

  const plantaLabelById = React.useMemo(
    () => new Map(plantas.map((planta) => [planta.id, planta.nombre])),
    [plantas],
  );

  const areaLabelById = React.useMemo(
    () => new Map(areas.map((area) => [area.id, area.nombre])),
    [areas],
  );

  const empleadoLabelById = React.useMemo(
    () => new Map(empleados.map((empleado) => [empleado.id, empleado.nombreCompleto])),
    [empleados],
  );

  const areaOptions = React.useMemo(
    () => areas.filter((area) => area.plantaId === centroForm.plantaId),
    [areas, centroForm.plantaId],
  );

  React.useEffect(() => {
    if (editingAreaId || !plantas.length || areaForm.plantaId) {
      return;
    }

    setAreaForm((current) => ({
      ...current,
      plantaId: plantas[0].id,
    }));
  }, [areaForm.plantaId, editingAreaId, plantas]);

  React.useEffect(() => {
    if (editingCentroId || !plantas.length) {
      return;
    }

    const plantaId = centroForm.plantaId || plantas[0].id;
    const nextArea =
      areas.find((area) => area.id === centroForm.areaCostoId && area.plantaId === plantaId) ??
      areas.find((area) => area.plantaId === plantaId);

    setCentroForm((current) => {
      const nextCodigo =
        current.codigo ||
        (nextArea
          ? getNextCentroCodigo(
              nextArea.codigo,
              centros.filter((centro) => centro.areaCostoId === nextArea.id),
            )
          : "");

      if (
        current.plantaId === plantaId &&
        current.areaCostoId === (nextArea?.id ?? "") &&
        current.codigo === nextCodigo
      ) {
        return current;
      }

      return {
        ...current,
        plantaId,
        areaCostoId: nextArea?.id ?? "",
        codigo: nextCodigo,
      };
    });
  }, [
    areas,
    centroForm.areaCostoId,
    centroForm.codigo,
    centroForm.plantaId,
    centros,
    editingCentroId,
    plantas,
  ]);

  const reloadAll = React.useCallback(() => {
    startReloading(async () => {
      try {
        const [nextPlantas, nextAreas, nextCentros] = await Promise.all([
          getPlantas(),
          getAreasCosto(),
          getCentrosCosto(),
        ]);

        setPlantas(nextPlantas);
        setAreas(nextAreas);
        setCentros(nextCentros);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo refrescar costos.");
      }
    });
  }, []);

  const handlePlantSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    startSaving(async () => {
      try {
        if (editingPlantaId) {
          await updatePlanta(editingPlantaId, plantaForm);
          toast.success("Planta actualizada.");
        } else {
          await createPlanta(plantaForm);
          toast.success("Planta creada.");
        }

        setEditingPlantaId(null);
        setPlantaForm(createEmptyPlanta());
        reloadAll();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo guardar la planta.");
      }
    });
  };

  const handleAreaSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    startSaving(async () => {
      try {
        if (editingAreaId) {
          await updateAreaCosto(editingAreaId, areaForm);
          toast.success("Area actualizada.");
        } else {
          await createAreaCosto(areaForm);
          toast.success("Area creada.");
        }

        setEditingAreaId(null);
        setAreaForm(createEmptyArea(areaForm.plantaId));
        reloadAll();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo guardar el area.");
      }
    });
  };

  const handleCentroSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    startSaving(async () => {
      try {
        if (editingCentroId) {
          await updateCentroCosto(editingCentroId, centroForm);
          toast.success("Centro de costo actualizado.");
        } else {
          await createCentroCosto(centroForm);
          toast.success("Centro de costo creado.");
        }

        setEditingCentroId(null);
        setCentroForm(createEmptyCentro(centroForm.plantaId, ""));
        reloadAll();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "No se pudo guardar el centro de costo.",
        );
      }
    });
  };

  const handleTogglePlanta = (id: string) => {
    startSaving(async () => {
      try {
        await togglePlanta(id);
        reloadAll();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "No se pudo cambiar la planta.",
        );
      }
    });
  };

  const handleToggleArea = (id: string) => {
    startSaving(async () => {
      try {
        await toggleAreaCosto(id);
        reloadAll();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo cambiar el area.");
      }
    });
  };

  const handleToggleCentro = (id: string) => {
    startSaving(async () => {
      try {
        await toggleCentroCosto(id);
        reloadAll();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "No se pudo cambiar el centro.",
        );
      }
    });
  };

  return (
    <div className="flex flex-1 flex-col p-4 md:p-6">
      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardHeader className="gap-4 border-b border-border/70">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <CardTitle>Centros de costo</CardTitle>
              <CardDescription>
                Administra la estructura multi-tenant de plantas, areas y centros
                de costo para el costeo operativo de la grafica.
              </CardDescription>
            </div>

            <Button variant="sidebar" className="w-full sm:w-auto" onClick={reloadAll}>
              <RefreshCcwIcon className={isReloading ? "animate-spin" : undefined} />
              Refrescar
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6 h-auto max-w-full justify-start gap-1 overflow-x-auto rounded-xl border border-sidebar-border/20 bg-sidebar/8 p-1">
              <TabsTrigger value="plantas">Plantas</TabsTrigger>
              <TabsTrigger value="areas">Areas</TabsTrigger>
              <TabsTrigger value="centros">Centros</TabsTrigger>
            </TabsList>

            <TabsContent value="plantas" className="flex flex-col gap-6">
              <Card className="rounded-2xl border-border/70 shadow-none">
                <CardHeader>
                  <CardTitle className="text-lg">Plantas</CardTitle>
                  <CardDescription>
                    Una planta representa una sede o establecimiento productivo del
                    tenant actual.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="flex flex-col gap-4" onSubmit={handlePlantSubmit}>
                    <FieldGroup className="grid gap-4 lg:grid-cols-3">
                      <Field>
                        <FieldLabel htmlFor="planta-codigo">Codigo</FieldLabel>
                        <Input
                          id="planta-codigo"
                          value={plantaForm.codigo}
                          onChange={(event) =>
                            setPlantaForm((current) => ({
                              ...current,
                              codigo: event.target.value,
                            }))
                          }
                          placeholder="PLT-001"
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="planta-nombre">Nombre</FieldLabel>
                        <Input
                          id="planta-nombre"
                          value={plantaForm.nombre}
                          onChange={(event) =>
                            setPlantaForm((current) => ({
                              ...current,
                              nombre: event.target.value,
                            }))
                          }
                          placeholder="Planta principal"
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="planta-descripcion">Descripcion</FieldLabel>
                        <Input
                          id="planta-descripcion"
                          value={plantaForm.descripcion ?? ""}
                          onChange={(event) =>
                            setPlantaForm((current) => ({
                              ...current,
                              descripcion: event.target.value,
                            }))
                          }
                          placeholder="Observaciones"
                        />
                      </Field>
                    </FieldGroup>

                    <div className="flex gap-2">
                      <Button type="submit" variant="brand">
                        {isSaving ? <GdiSpinner className="size-4" /> : <PlusIcon />}
                        {editingPlantaId ? "Guardar cambios" : "Nueva planta"}
                      </Button>
                      {editingPlantaId ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setEditingPlantaId(null);
                            setPlantaForm(createEmptyPlanta());
                          }}
                        >
                          Cancelar
                        </Button>
                      ) : null}
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border/70 shadow-none">
                <CardContent className="px-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="px-4">Codigo</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="w-40">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plantas.map((planta) => (
                        <TableRow key={planta.id}>
                          <TableCell className="px-4 font-medium">{planta.codigo}</TableCell>
                          <TableCell>{planta.nombre}</TableCell>
                          <TableCell>
                            <Badge variant={planta.activa ? "secondary" : "outline"}>
                              {planta.activa ? "Activa" : "Inactiva"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingPlantaId(planta.id);
                                  setPlantaForm({
                                    codigo: planta.codigo,
                                    nombre: planta.nombre,
                                    descripcion: planta.descripcion,
                                  });
                                  setActiveTab("plantas");
                                }}
                              >
                                <PencilIcon />
                                Editar
                              </Button>
                              <Button
                                variant="sidebar"
                                size="sm"
                                onClick={() => handleTogglePlanta(planta.id)}
                              >
                                {planta.activa ? "Inactivar" : "Activar"}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="areas" className="flex flex-col gap-6">
              <Card className="rounded-2xl border-border/70 shadow-none">
                <CardHeader>
                  <CardTitle className="text-lg">Areas</CardTitle>
                  <CardDescription>
                    Cada area ordena departamentos funcionales dentro de una planta.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="flex flex-col gap-4" onSubmit={handleAreaSubmit}>
                    <FieldGroup className="grid gap-4 lg:grid-cols-4">
                      <Field>
                        <FieldLabel htmlFor="area-planta">Planta</FieldLabel>
                        <Select
                          value={areaForm.plantaId}
                          onValueChange={(value) => {
                            if (!value) {
                              return;
                            }

                            setAreaForm((current) => ({ ...current, plantaId: value }));
                          }}
                        >
                          <SelectTrigger id="area-planta" className="w-full">
                            <SelectValue placeholder="Selecciona una planta">
                              {(value) =>
                                typeof value === "string"
                                  ? plantaLabelById.get(value) ?? value
                                  : "Selecciona una planta"
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {plantas.map((planta) => (
                                <SelectItem key={planta.id} value={planta.id}>
                                  {planta.nombre}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="area-codigo">Codigo</FieldLabel>
                        <Input
                          id="area-codigo"
                          value={areaForm.codigo}
                          onChange={(event) =>
                            setAreaForm((current) => ({
                              ...current,
                              codigo: event.target.value,
                            }))
                          }
                          placeholder="PRE"
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="area-nombre">Nombre</FieldLabel>
                        <Input
                          id="area-nombre"
                          value={areaForm.nombre}
                          onChange={(event) =>
                            setAreaForm((current) => ({
                              ...current,
                              nombre: event.target.value,
                            }))
                          }
                          placeholder="Preprensa"
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="area-descripcion">Descripcion</FieldLabel>
                        <Input
                          id="area-descripcion"
                          value={areaForm.descripcion ?? ""}
                          onChange={(event) =>
                            setAreaForm((current) => ({
                              ...current,
                              descripcion: event.target.value,
                            }))
                          }
                          placeholder="Observaciones"
                        />
                      </Field>
                    </FieldGroup>

                    <div className="flex gap-2">
                      <Button type="submit" variant="brand">
                        {isSaving ? <GdiSpinner className="size-4" /> : <PlusIcon />}
                        {editingAreaId ? "Guardar cambios" : "Nueva area"}
                      </Button>
                      {editingAreaId ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setEditingAreaId(null);
                            setAreaForm(createEmptyArea(areaForm.plantaId));
                          }}
                        >
                          Cancelar
                        </Button>
                      ) : null}
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border/70 shadow-none">
                <CardContent className="px-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="px-4">Planta</TableHead>
                        <TableHead>Codigo</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="w-40">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {areas.map((area) => (
                        <TableRow key={area.id}>
                          <TableCell className="px-4">{area.plantaNombre}</TableCell>
                          <TableCell className="font-medium">{area.codigo}</TableCell>
                          <TableCell>{area.nombre}</TableCell>
                          <TableCell>
                            <Badge variant={area.activa ? "secondary" : "outline"}>
                              {area.activa ? "Activa" : "Inactiva"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingAreaId(area.id);
                                  setAreaForm({
                                    plantaId: area.plantaId,
                                    codigo: area.codigo,
                                    nombre: area.nombre,
                                    descripcion: area.descripcion,
                                  });
                                  setActiveTab("areas");
                                }}
                              >
                                <PencilIcon />
                                Editar
                              </Button>
                              <Button
                                variant="sidebar"
                                size="sm"
                                onClick={() => handleToggleArea(area.id)}
                              >
                                {area.activa ? "Inactivar" : "Activar"}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="centros" className="flex flex-col gap-6">
              <Card className="rounded-2xl border-border/70 shadow-none">
                <CardHeader>
                  <CardTitle className="text-lg">Centros de costo</CardTitle>
                  <CardDescription>
                    Define el punto real de imputacion con clasificacion grafica,
                    responsables y reglas operativas del centro.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="flex flex-col gap-4" onSubmit={handleCentroSubmit}>
                    <FieldGroup className="grid gap-4 lg:grid-cols-4">
                      <Field>
                        <FieldLabel htmlFor="centro-planta">Planta</FieldLabel>
                        <Select
                          value={centroForm.plantaId}
                          onValueChange={(value) => {
                            if (!value) {
                              return;
                            }

                            const nextArea = areas.find((area) => area.plantaId === value);

                            setCentroForm((current) => ({
                              ...current,
                              plantaId: value,
                              areaCostoId: nextArea?.id ?? "",
                              codigo:
                                editingCentroId || !nextArea
                                  ? current.codigo
                                  : getNextCentroCodigo(
                                      nextArea.codigo,
                                      centros.filter((centro) => centro.areaCostoId === nextArea.id),
                                    ),
                            }));
                          }}
                        >
                          <SelectTrigger id="centro-planta" className="w-full">
                            <SelectValue placeholder="Selecciona una planta">
                              {(value) =>
                                typeof value === "string"
                                  ? plantaLabelById.get(value) ?? value
                                  : "Selecciona una planta"
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {plantas.map((planta) => (
                                <SelectItem key={planta.id} value={planta.id}>
                                  {planta.nombre}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="centro-area">Area</FieldLabel>
                        <Select
                          value={centroForm.areaCostoId}
                          onValueChange={(value) => {
                            if (!value) {
                              return;
                            }

                            const area = areas.find((item) => item.id === value);

                            setCentroForm((current) => ({
                              ...current,
                              areaCostoId: value,
                              codigo:
                                editingCentroId && current.areaCostoId === value
                                  ? current.codigo
                                  : getNextCentroCodigo(
                                      area?.codigo ?? "AREA",
                                      centros.filter((centro) => centro.areaCostoId === value),
                                    ),
                            }));
                          }}
                        >
                          <SelectTrigger id="centro-area" className="w-full">
                            <SelectValue placeholder="Selecciona un area">
                              {(value) =>
                                typeof value === "string"
                                  ? areaLabelById.get(value) ?? value
                                  : "Selecciona un area"
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {areaOptions.map((area) => (
                                <SelectItem key={area.id} value={area.id}>
                                  {area.nombre}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="centro-codigo">Codigo</FieldLabel>
                        <Input
                          id="centro-codigo"
                          value={centroForm.codigo}
                          onChange={(event) =>
                            setCentroForm((current) => ({
                              ...current,
                              codigo: event.target.value,
                            }))
                          }
                          placeholder="AREA-001"
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="centro-nombre">Nombre</FieldLabel>
                        <Input
                          id="centro-nombre"
                          value={centroForm.nombre}
                          onChange={(event) =>
                            setCentroForm((current) => ({
                              ...current,
                              nombre: event.target.value,
                            }))
                          }
                          placeholder="CTP principal"
                        />
                      </Field>
                    </FieldGroup>

                    <FieldGroup className="grid gap-4 lg:grid-cols-4">
                      <Field>
                        <FieldLabel htmlFor="centro-tipo">Tipo</FieldLabel>
                        <Select
                          value={centroForm.tipoCentro}
                          onValueChange={(value) => {
                            if (!value) {
                              return;
                            }

                            setCentroForm((current) => ({
                              ...current,
                              tipoCentro: value as CentroCostoPayload["tipoCentro"],
                            }));
                          }}
                        >
                          <SelectTrigger id="centro-tipo" className="w-full">
                            <SelectValue placeholder="Selecciona un tipo">
                              {(value) =>
                                typeof value === "string"
                                  ? getTipoCentroLabel(
                                      value as CentroCostoPayload["tipoCentro"],
                                    )
                                  : "Selecciona un tipo"
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {tipoCentroItems.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="centro-categoria">Categoria grafica</FieldLabel>
                        <Select
                          value={centroForm.categoriaGrafica}
                          onValueChange={(value) => {
                            if (!value) {
                              return;
                            }

                            setCentroForm((current) => ({
                              ...current,
                              categoriaGrafica:
                                value as CentroCostoPayload["categoriaGrafica"],
                            }));
                          }}
                        >
                          <SelectTrigger id="centro-categoria" className="w-full">
                            <SelectValue placeholder="Selecciona una categoria">
                              {(value) =>
                                typeof value === "string"
                                  ? getCategoriaGraficaLabel(
                                      value as CentroCostoPayload["categoriaGrafica"],
                                    )
                                  : "Selecciona una categoria"
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {categoriaGraficaItems.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="centro-imputacion">Imputacion</FieldLabel>
                        <Select
                          value={centroForm.imputacionPreferida}
                          onValueChange={(value) => {
                            if (!value) {
                              return;
                            }

                            setCentroForm((current) => ({
                              ...current,
                              imputacionPreferida:
                                value as CentroCostoPayload["imputacionPreferida"],
                            }));
                          }}
                        >
                          <SelectTrigger id="centro-imputacion" className="w-full">
                            <SelectValue placeholder="Selecciona una imputacion">
                              {(value) =>
                                typeof value === "string"
                                  ? getImputacionPreferidaLabel(
                                      value as CentroCostoPayload["imputacionPreferida"],
                                    )
                                  : "Selecciona una imputacion"
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {imputacionPreferidaItems.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="centro-unidad">Unidad base futura</FieldLabel>
                        <Select
                          value={centroForm.unidadBaseFutura}
                          onValueChange={(value) => {
                            if (!value) {
                              return;
                            }

                            setCentroForm((current) => ({
                              ...current,
                              unidadBaseFutura:
                                value as CentroCostoPayload["unidadBaseFutura"],
                            }));
                          }}
                        >
                          <SelectTrigger id="centro-unidad" className="w-full">
                            <SelectValue placeholder="Selecciona una unidad">
                              {(value) =>
                                typeof value === "string"
                                  ? getUnidadBaseLabel(
                                      value as CentroCostoPayload["unidadBaseFutura"],
                                    )
                                  : "Selecciona una unidad"
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {unidadBaseItems.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                    </FieldGroup>

                    <FieldGroup className="grid gap-4 lg:grid-cols-4">
                      <Field>
                        <FieldLabel htmlFor="centro-responsable">Responsable</FieldLabel>
                        <Select
                          value={centroForm.responsableEmpleadoId ?? EMPTY_SELECT_VALUE}
                          onValueChange={(value) => {
                            if (!value) {
                              return;
                            }

                            setCentroForm((current) => ({
                              ...current,
                              responsableEmpleadoId:
                                value === EMPTY_SELECT_VALUE ? undefined : value,
                            }));
                          }}
                        >
                          <SelectTrigger id="centro-responsable" className="w-full">
                            <SelectValue placeholder="Selecciona un responsable">
                              {(value) => {
                                if (value === EMPTY_SELECT_VALUE) {
                                  return "Sin responsable";
                                }

                                return typeof value === "string"
                                  ? empleadoLabelById.get(value) ?? value
                                  : "Selecciona un responsable";
                              }}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value={EMPTY_SELECT_VALUE}>
                                Sin responsable
                              </SelectItem>
                              {empleados.map((empleado) => (
                                <SelectItem key={empleado.id} value={empleado.id}>
                                  {empleado.nombreCompleto}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field className="lg:col-span-3">
                        <FieldLabel htmlFor="centro-descripcion">Descripcion</FieldLabel>
                        <Input
                          id="centro-descripcion"
                          value={centroForm.descripcion ?? ""}
                          onChange={(event) =>
                            setCentroForm((current) => ({
                              ...current,
                              descripcion: event.target.value,
                            }))
                          }
                          placeholder="Comentarios operativos"
                        />
                      </Field>
                    </FieldGroup>

                    <Field className="max-w-xs">
                      <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">Activo</span>
                          <span className="text-xs text-muted-foreground">
                            Determina si se puede seguir imputando
                          </span>
                        </div>
                        <Switch
                          checked={centroForm.activo}
                          onCheckedChange={(checked) =>
                            setCentroForm((current) => ({
                              ...current,
                              activo: checked,
                            }))
                          }
                        />
                      </div>
                    </Field>

                    <div className="flex gap-2">
                      <Button type="submit" variant="brand">
                        {isSaving ? <GdiSpinner className="size-4" /> : <PlusIcon />}
                        {editingCentroId ? "Guardar cambios" : "Nuevo centro"}
                      </Button>
                      {editingCentroId ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setEditingCentroId(null);
                            setCentroForm(createEmptyCentro(centroForm.plantaId, ""));
                          }}
                        >
                          Cancelar
                        </Button>
                      ) : null}
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border/70 shadow-none">
                <CardContent className="px-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Centro</TableHead>
                        <TableHead>Area</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Estado costeo</TableHead>
                        <TableHead>Periodo</TableHead>
                        <TableHead>Horas productivas</TableHead>
                        <TableHead>Tarifa publicada</TableHead>
                        <TableHead>Absorbido</TableHead>
                        <TableHead>Tarifa total</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="w-56">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {centros.map((centro) => (
                        <TableRow key={centro.id}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span>{centro.nombre}</span>
                              <span className="text-xs text-muted-foreground">
                                {centro.plantaNombre} / {centro.areaCostoNombre}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{centro.areaCostoNombre}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {getTipoCentroLabel(centro.tipoCentro)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                centro.estadoConfiguracion === "publicado"
                                  ? "secondary"
                                  : "outline"
                              }
                            >
                              {centro.estadoConfiguracion === "sin_configurar"
                                ? "Sin configurar"
                                : centro.estadoConfiguracion === "borrador"
                                  ? "Borrador"
                                  : "Publicado"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {centro.ultimoPeriodoConfigurado || "Sin período"}
                          </TableCell>
                          <TableCell>
                            {typeof centro.ultimaCapacidadPractica === "number" &&
                            Number.isFinite(centro.ultimaCapacidadPractica) ? (
                              <span className="font-medium">
                                {new Intl.NumberFormat("es-AR", {
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 2,
                                }).format(centro.ultimaCapacidadPractica)}
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {formatMoneyOrDash(
                              centro.ultimaTarifaBase ?? centro.ultimaTarifaPublicada,
                            ) === null ? (
                              <span className="text-sm text-muted-foreground">
                                Sin publicar
                              </span>
                            ) : (
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {formatMoneyOrDash(
                                    centro.ultimaTarifaBase ?? centro.ultimaTarifaPublicada,
                                  )}
                                </span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {formatMoneyOrDash(centro.ultimaTarifaAbsorbida) ? (
                              <span className="font-medium">
                                {formatMoneyOrDash(centro.ultimaTarifaAbsorbida)}
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {formatMoneyOrDash(
                              centro.ultimaTarifaTotal ?? centro.ultimaTarifaPublicada,
                            ) ? (
                              <span className="font-medium">
                                {formatMoneyOrDash(
                                  centro.ultimaTarifaTotal ?? centro.ultimaTarifaPublicada,
                                )}
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={centro.activo ? "secondary" : "outline"}>
                              {centro.activo ? "Activo" : "Inactivo"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedCentro(centro);
                                  setIsConfiguratorOpen(true);
                                }}
                              >
                                <SparklesIcon />
                                Configurar costo
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingCentroId(centro.id);
                                  setCentroForm({
                                    plantaId: centro.plantaId,
                                    areaCostoId: centro.areaCostoId,
                                    codigo: centro.codigo,
                                    nombre: centro.nombre,
                                    descripcion: centro.descripcion,
                                    tipoCentro: centro.tipoCentro,
                                    categoriaGrafica: centro.categoriaGrafica,
                                    imputacionPreferida: centro.imputacionPreferida,
                                    unidadBaseFutura: centro.unidadBaseFutura,
                                    responsableEmpleadoId:
                                      centro.responsableEmpleadoId || undefined,
                                    activo: centro.activo,
                                  });
                                  setActiveTab("centros");
                                }}
                              >
                                <PencilIcon />
                                Editar
                              </Button>
                              <Button
                                variant="sidebar"
                                size="sm"
                                onClick={() => handleToggleCentro(centro.id)}
                              >
                                {centro.activo ? "Inactivar" : "Activar"}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="rounded-2xl border-border/70 shadow-none">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Building2Icon className="size-4" />
                      Plantas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-semibold">{plantas.length}</p>
                  </CardContent>
                </Card>
                <Card className="rounded-2xl border-border/70 shadow-none">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FolderTreeIcon className="size-4" />
                      Areas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-semibold">{areas.length}</p>
                  </CardContent>
                </Card>
                <Card className="rounded-2xl border-border/70 shadow-none">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FolderTreeIcon className="size-4" />
                      Centros activos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-semibold">
                      {centros.filter((item) => item.activo).length}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <CentroCostoConfigurator
        open={isConfiguratorOpen}
        onOpenChange={setIsConfiguratorOpen}
        centro={selectedCentro}
        plantas={plantas}
        areas={areas}
        empleados={empleados}
        onConfigured={async () => {
          reloadAll();
        }}
      />
    </div>
  );
}
