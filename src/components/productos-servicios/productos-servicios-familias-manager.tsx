"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ChevronsRightIcon,
  GripVerticalIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import type { FamiliaProducto, ProductoServicio, SubfamiliaProducto } from "@/lib/productos-servicios";
import {
  createFamiliaProducto,
  createSubfamiliaProducto,
  deleteFamiliaProducto,
  deleteSubfamiliaProducto,
  updateFamiliaProducto,
  updateSubfamiliaProducto,
} from "@/lib/productos-servicios-api";
import { buttonVariants, Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Props = {
  initialFamilias: FamiliaProducto[];
  initialSubfamilias: SubfamiliaProducto[];
  initialProductos: ProductoServicio[];
};

function buildCodigoFromNombre(nombre: string, fallbackPrefix: string) {
  void nombre;
  const short = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${fallbackPrefix}_${short}`;
}

export function ProductosServiciosFamiliasManager({
  initialFamilias,
  initialSubfamilias,
  initialProductos,
}: Props) {
  const [familias, setFamilias] = React.useState(initialFamilias);
  const [subfamilias, setSubfamilias] = React.useState(initialSubfamilias);
  const [selectedFamiliaId, setSelectedFamiliaId] = React.useState(initialFamilias[0]?.id ?? "");
  const [selectedSubfamiliaId, setSelectedSubfamiliaId] = React.useState("");

  const [familiaNueva, setFamiliaNueva] = React.useState("");
  const [subfamiliaNueva, setSubfamiliaNueva] = React.useState("");

  const [familiaDraftById, setFamiliaDraftById] = React.useState<Record<string, string>>({});
  const [subfamiliaDraftById, setSubfamiliaDraftById] = React.useState<Record<string, string>>({});

  const [isSavingFamilia, startSavingFamilia] = React.useTransition();
  const [isSavingSubfamilia, startSavingSubfamilia] = React.useTransition();

  const sortedFamilias = React.useMemo(
    () => [...familias].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [familias],
  );

  const familiaById = React.useMemo(() => new Map(familias.map((item) => [item.id, item])), [familias]);
  const subfamiliasCountByFamiliaId = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const item of subfamilias) {
      map.set(item.familiaProductoId, (map.get(item.familiaProductoId) ?? 0) + 1);
    }
    return map;
  }, [subfamilias]);
  const productosCountByFamiliaId = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const item of initialProductos) {
      if (!item.familiaProductoId) continue;
      map.set(item.familiaProductoId, (map.get(item.familiaProductoId) ?? 0) + 1);
    }
    return map;
  }, [initialProductos]);
  const productosCountBySubfamiliaId = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const item of initialProductos) {
      if (!item.subfamiliaProductoId) continue;
      map.set(item.subfamiliaProductoId, (map.get(item.subfamiliaProductoId) ?? 0) + 1);
    }
    return map;
  }, [initialProductos]);

  const subfamiliasVisibles = React.useMemo(
    () =>
      [...subfamilias]
        .filter((item) => item.familiaProductoId === selectedFamiliaId)
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [subfamilias, selectedFamiliaId],
  );
  const productosVisibles = React.useMemo(
    () =>
      [...initialProductos]
        .filter((item) => item.subfamiliaProductoId === selectedSubfamiliaId)
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [initialProductos, selectedSubfamiliaId],
  );

  React.useEffect(() => {
    if (!selectedFamiliaId && sortedFamilias[0]?.id) {
      setSelectedFamiliaId(sortedFamilias[0].id);
    }
  }, [selectedFamiliaId, sortedFamilias]);

  React.useEffect(() => {
    const firstSub = subfamiliasVisibles[0]?.id ?? "";
    setSelectedSubfamiliaId((prev) => {
      if (prev && subfamiliasVisibles.some((item) => item.id === prev)) {
        return prev;
      }
      return firstSub;
    });
  }, [subfamiliasVisibles]);

  const selectedFamilia = familiaById.get(selectedFamiliaId) ?? null;

  const handleCreateFamilia = () => {
    const nombre = familiaNueva.trim();
    if (!nombre) {
      toast.error("Ingresa un nombre de familia.");
      return;
    }

    startSavingFamilia(async () => {
      try {
        const created = await createFamiliaProducto({
          nombre,
          codigo: buildCodigoFromNombre(nombre, "FAM"),
          activo: true,
        });
        setFamilias((prev) => [...prev, created]);
        setSelectedFamiliaId(created.id);
        setFamiliaNueva("");
        toast.success("Familia creada.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo crear la familia.");
      }
    });
  };

  const handleCreateSubfamilia = () => {
    const nombre = subfamiliaNueva.trim();
    if (!selectedFamiliaId) {
      toast.error("Selecciona una familia.");
      return;
    }
    if (!nombre) {
      toast.error("Ingresa un nombre de subfamilia.");
      return;
    }

    startSavingSubfamilia(async () => {
      try {
        const created = await createSubfamiliaProducto({
          familiaProductoId: selectedFamiliaId,
          nombre,
          codigo: buildCodigoFromNombre(nombre, "SUB"),
          activo: true,
          unidadComercial: undefined,
        });
        setSubfamilias((prev) => [...prev, created]);
        setSubfamiliaNueva("");
        toast.success("Subfamilia creada.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo crear la subfamilia.");
      }
    });
  };

  const handleInlineSaveFamilia = (familiaId: string, nextNombre: string) => {
    const base = familiaById.get(familiaId);
    const draft = nextNombre.trim();
    if (!base) return;
    if (!draft || draft === base.nombre) return;
    startSavingFamilia(async () => {
      try {
        const updated = await updateFamiliaProducto(familiaId, {
          codigo: base.codigo,
          nombre: draft,
          activo: base.activo,
        });
        setFamilias((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
        toast.success("Familia guardada.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo actualizar la familia.");
        setFamiliaDraftById((prev) => ({ ...prev, [familiaId]: base.nombre }));
      }
    });
  };

  const handleInlineSaveSubfamilia = (subfamiliaId: string, nextNombre: string) => {
    const base = subfamilias.find((item) => item.id === subfamiliaId);
    const draft = nextNombre.trim();
    if (!base) return;
    if (!draft || draft === base.nombre) return;
    startSavingSubfamilia(async () => {
      try {
        const updated = await updateSubfamiliaProducto(subfamiliaId, {
          familiaProductoId: base.familiaProductoId,
          codigo: base.codigo,
          nombre: draft,
          unidadComercial: base.unidadComercial || undefined,
          activo: base.activo,
        });
        setSubfamilias((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
        toast.success("Subfamilia guardada.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo actualizar la subfamilia.");
        setSubfamiliaDraftById((prev) => ({ ...prev, [subfamiliaId]: base.nombre }));
      }
    });
  };

  const handleToggleFamiliaActiva = (familiaId: string, checked: boolean) => {
    const base = familiaById.get(familiaId);
    if (!base) return;
    startSavingFamilia(async () => {
      try {
        const updated = await updateFamiliaProducto(familiaId, {
          codigo: base.codigo,
          nombre: base.nombre,
          activo: checked,
        });
        setFamilias((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo actualizar el estado de la familia.");
      }
    });
  };

  const handleToggleSubfamiliaActiva = (subfamiliaId: string, checked: boolean) => {
    const base = subfamilias.find((item) => item.id === subfamiliaId);
    if (!base) return;
    startSavingSubfamilia(async () => {
      try {
        const updated = await updateSubfamiliaProducto(subfamiliaId, {
          familiaProductoId: base.familiaProductoId,
          codigo: base.codigo,
          nombre: base.nombre,
          unidadComercial: base.unidadComercial || undefined,
          activo: checked,
        });
        setSubfamilias((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo actualizar el estado de la subfamilia.");
      }
    });
  };

  const handleDeleteFamilia = (familiaId: string) => {
    const currentSubfamilias = subfamiliasCountByFamiliaId.get(familiaId) ?? 0;
    const currentProductos = productosCountByFamiliaId.get(familiaId) ?? 0;
    if (currentSubfamilias > 0 || currentProductos > 0) {
      toast.error("No se puede borrar la familia porque tiene subfamilias o productos asociados.");
      return;
    }
    startSavingFamilia(async () => {
      try {
        await deleteFamiliaProducto(familiaId);
        const nextFamilias = familias.filter((item) => item.id !== familiaId);
        setFamilias(nextFamilias);
        setSelectedFamiliaId((prev) =>
          prev === familiaId ? (nextFamilias[0]?.id ?? "") : prev,
        );
        toast.success("Familia eliminada.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo borrar la familia.");
      }
    });
  };

  const handleDeleteSubfamilia = (subfamiliaId: string) => {
    const currentProductos = productosCountBySubfamiliaId.get(subfamiliaId) ?? 0;
    if (currentProductos > 0) {
      toast.error("No se puede borrar la subfamilia porque tiene productos asociados.");
      return;
    }
    startSavingSubfamilia(async () => {
      try {
        await deleteSubfamiliaProducto(subfamiliaId);
        const nextSubfamilias = subfamilias.filter((item) => item.id !== subfamiliaId);
        setSubfamilias(nextSubfamilias);
        setSelectedSubfamiliaId((prev) =>
          prev === subfamiliaId
            ? (nextSubfamilias.find((item) => item.familiaProductoId === selectedFamiliaId)?.id ?? "")
            : prev,
        );
        toast.success("Subfamilia eliminada.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo borrar la subfamilia.");
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
        <h1 className="text-xl font-semibold">Familias y subfamilias</h1>
        <p className="text-sm text-muted-foreground">Agrupa productos por familia y subfamilia con edición simple por nombre.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Familias</CardTitle>
            <CardDescription>Selecciona una familia para ver sus subfamilias.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-md border bg-muted/30 p-2">
              <Input
                value={familiaNueva}
                onChange={(e) => setFamiliaNueva(e.target.value)}
                placeholder="Nueva familia"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreateFamilia();
                  }
                }}
              />
              <Button type="button" size="icon" variant="ghost" onClick={handleCreateFamilia} disabled={isSavingFamilia}>
                <PlusIcon />
              </Button>
            </div>

            <div className="overflow-hidden rounded-md border">
              <div className="grid grid-cols-[28px_1fr_auto] items-center bg-muted/50 px-2 py-2 text-xs font-medium">
                <span />
                <span>Familia</span>
                <span className="pr-2">Acciones</span>
              </div>
              <div className="max-h-[520px] overflow-y-auto">
                {sortedFamilias.map((item) => {
                  const draftNombre = familiaDraftById[item.id] ?? item.nombre;
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "grid grid-cols-[28px_1fr_auto] items-center border-t px-2 py-2",
                        selectedFamiliaId === item.id
                          ? "border-l-4 border-l-orange-500 bg-orange-50 shadow-[inset_0_0_0_1px_rgba(249,115,22,0.18)]"
                          : "bg-background",
                      )}
                    >
                      <GripVerticalIcon
                        className={cn(
                          "text-muted-foreground",
                          selectedFamiliaId === item.id ? "text-orange-600" : "",
                        )}
                      />
                      <div className="flex items-center pr-4">
                        <Input
                          value={draftNombre}
                          onChange={(e) =>
                            setFamiliaDraftById((prev) => ({ ...prev, [item.id]: e.target.value }))
                          }
                          onBlur={(e) => handleInlineSaveFamilia(item.id, e.currentTarget.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              (e.currentTarget as HTMLInputElement).blur();
                            }
                          }}
                          className={cn(
                            "h-8 w-full border-muted-foreground/20 bg-background",
                            selectedFamiliaId === item.id
                              ? "border-orange-300 bg-white ring-1 ring-orange-200"
                              : "",
                          )}
                          onClick={() => setSelectedFamiliaId(item.id)}
                        />
                      </div>
                      <div className="flex items-center gap-0.5">
                        <Switch
                          checked={item.activo}
                          onCheckedChange={(checked) => handleToggleFamiliaActiva(item.id, checked)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteFamilia(item.id)}
                          disabled={
                            isSavingFamilia ||
                            (subfamiliasCountByFamiliaId.get(item.id) ?? 0) > 0 ||
                            (productosCountByFamiliaId.get(item.id) ?? 0) > 0
                          }
                        >
                          <Trash2Icon className="size-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => setSelectedFamiliaId(item.id)}>
                          <ChevronsRightIcon />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subfamilias</CardTitle>
            <CardDescription>
              {selectedFamilia ? `Editor de subfamilias para ${selectedFamilia.nombre}.` : "Selecciona una familia."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-md border bg-muted/30 p-2">
              <Input
                value={subfamiliaNueva}
                onChange={(e) => setSubfamiliaNueva(e.target.value)}
                placeholder={selectedFamilia ? "Nueva subfamilia" : "Selecciona una familia"}
                disabled={!selectedFamiliaId}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreateSubfamilia();
                  }
                }}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={handleCreateSubfamilia}
                disabled={isSavingSubfamilia || !selectedFamiliaId}
              >
                <PlusIcon />
              </Button>
            </div>

            <div className="overflow-hidden rounded-md border">
              <div className="grid grid-cols-[28px_1fr_auto] items-center bg-muted/50 px-2 py-2 text-xs font-medium">
                <span />
                <span>Subfamilia</span>
                <span className="pr-2">Acciones</span>
              </div>
              <div className="max-h-[520px] overflow-y-auto">
                {subfamiliasVisibles.map((item) => {
                  const draftNombre = subfamiliaDraftById[item.id] ?? item.nombre;
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "grid grid-cols-[28px_1fr_auto] items-center border-t px-2 py-2",
                        selectedSubfamiliaId === item.id
                          ? "border-l-4 border-l-orange-500 bg-orange-50/80 shadow-[inset_0_0_0_1px_rgba(249,115,22,0.18)]"
                          : "bg-background",
                      )}
                    >
                      <GripVerticalIcon
                        className={cn(
                          "text-muted-foreground",
                          selectedSubfamiliaId === item.id ? "text-orange-600" : "",
                        )}
                      />
                      <div className="flex items-center pr-4">
                        <Input
                          value={draftNombre}
                          onChange={(e) =>
                            setSubfamiliaDraftById((prev) => ({ ...prev, [item.id]: e.target.value }))
                          }
                          onBlur={(e) => handleInlineSaveSubfamilia(item.id, e.currentTarget.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              (e.currentTarget as HTMLInputElement).blur();
                            }
                          }}
                          className={cn(
                            "h-8 w-full border-muted-foreground/20 bg-background",
                            selectedSubfamiliaId === item.id
                              ? "border-orange-300 bg-white ring-1 ring-orange-200"
                              : "",
                          )}
                          onClick={() => setSelectedSubfamiliaId(item.id)}
                        />
                      </div>
                      <div className="flex items-center gap-0.5">
                        <Switch
                          checked={item.activo}
                          onCheckedChange={(checked) => handleToggleSubfamiliaActiva(item.id, checked)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteSubfamilia(item.id)}
                          disabled={isSavingSubfamilia || (productosCountBySubfamiliaId.get(item.id) ?? 0) > 0}
                        >
                          <Trash2Icon className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedSubfamiliaId(item.id)}
                        >
                          <ChevronsRightIcon />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {subfamiliasVisibles.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">No hay subfamilias para la familia seleccionada.</div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Productos asociados</CardTitle>
            <CardDescription>
              {selectedSubfamiliaId
                ? `Productos vinculados a la subfamilia seleccionada.`
                : "Selecciona una subfamilia para ver productos."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="overflow-hidden rounded-md border">
              <div className="grid grid-cols-[1fr_auto] items-center bg-muted/50 px-3 py-2 text-xs font-medium">
                <span>Producto</span>
                <span>Tipo</span>
              </div>
              <div className="max-h-[520px] overflow-y-auto">
                {productosVisibles.map((item) => (
                  <div key={item.id} className="grid grid-cols-[1fr_auto] items-center border-t px-3 py-2">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{item.nombre}</span>
                      <span className="text-xs text-muted-foreground">{item.codigo}</span>
                    </div>
                    <span className="text-xs text-muted-foreground capitalize">{item.tipo}</span>
                  </div>
                ))}
                {productosVisibles.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">
                    No hay productos asociados a esta subfamilia.
                  </div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
