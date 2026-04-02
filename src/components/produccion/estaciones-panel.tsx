"use client";

import * as React from "react";
import {
  PencilIcon,
  PlusIcon,
  SearchIcon,
  ToggleLeftIcon,
} from "lucide-react";
import { toast } from "sonner";

import type { Estacion, EstacionPayload } from "@/lib/estaciones";
import {
  getEstaciones,
  createEstacion,
  updateEstacion,
  toggleEstacion,
} from "@/lib/estaciones-api";
import { createEmptyEstacion } from "@/lib/estaciones";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function EstacionesPanel({
  initialEstaciones,
}: {
  initialEstaciones: Estacion[];
}) {
  const [estaciones, setEstaciones] = React.useState(initialEstaciones);
  const [search, setSearch] = React.useState("");
  const [showInactive, setShowInactive] = React.useState(false);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<EstacionPayload>(
    createEmptyEstacion(),
  );
  const [saving, startSaving] = React.useTransition();

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return estaciones.filter((e) => {
      if (!showInactive && !e.activo) return false;
      if (!q) return true;
      return (
        e.nombre.toLowerCase().includes(q) ||
        e.descripcion.toLowerCase().includes(q)
      );
    });
  }, [estaciones, search, showInactive]);

  const reload = React.useCallback(async () => {
    try {
      const data = await getEstaciones();
      setEstaciones(data);
    } catch {
      // keep current
    }
  }, []);

  const openCreate = React.useCallback(() => {
    setEditingId(null);
    setForm(createEmptyEstacion());
    setSheetOpen(true);
  }, []);

  const openEdit = React.useCallback((e: Estacion) => {
    setEditingId(e.id);
    setForm({
      nombre: e.nombre,
      descripcion: e.descripcion,
      activo: e.activo,
    });
    setSheetOpen(true);
  }, []);

  const handleSave = () => {
    if (!form.nombre.trim()) {
      toast.error("El nombre es obligatorio.");
      return;
    }
    startSaving(async () => {
      try {
        if (editingId) {
          await updateEstacion(editingId, form);
          toast.success("Estacion actualizada.");
        } else {
          await createEstacion(form);
          toast.success("Estacion creada.");
        }
        await reload();
        setSheetOpen(false);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Error al guardar.",
        );
      }
    });
  };

  const handleToggle = React.useCallback(
    async (id: string) => {
      try {
        await toggleEstacion(id);
        await reload();
        toast.success("Estado actualizado.");
      } catch {
        toast.error("Error al cambiar estado.");
      }
    },
    [reload],
  );

  return (
    <div className="flex flex-1 flex-col p-4 md:p-6">
      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardHeader className="gap-4 border-b border-border/70">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>Estaciones</CardTitle>
              <CardDescription>
                Areas o puestos de trabajo donde se realizan los pasos
                productivos.
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="max-w-xs pl-8"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={showInactive}
                  onCheckedChange={setShowInactive}
                />
                <span className="text-sm text-muted-foreground">
                  Inactivas
                </span>
              </div>
              <Button size="sm" onClick={openCreate}>
                <PlusIcon />
                Nueva estacion
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Nombre</TableHead>
                <TableHead>Descripcion</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[200px] pr-4 text-right">
                  Acciones
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-12 text-center text-muted-foreground"
                  >
                    {estaciones.length === 0
                      ? "No hay estaciones creadas."
                      : "Sin resultados."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="pl-4 font-medium">
                      {e.nombre}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {e.descripcion || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={e.activo ? "default" : "secondary"}>
                        {e.activo ? "Activa" : "Inactiva"}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="sidebar"
                          size="sm"
                          onClick={() => openEdit(e)}
                        >
                          <PencilIcon />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggle(e.id)}
                        >
                          <ToggleLeftIcon />
                          {e.activo ? "Desactivar" : "Activar"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Sheet: crear/editar */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="flex flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {editingId ? "Editar estacion" : "Nueva estacion"}
            </SheetTitle>
            <SheetDescription>
              {editingId
                ? "Modifica los datos de la estacion."
                : "Crea una nueva estacion de trabajo."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Nombre *
              </label>
              <Input
                value={form.nombre}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nombre: e.target.value }))
                }
                placeholder="Ej: Mesa de corte 1"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Descripcion
              </label>
              <Input
                value={form.descripcion ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, descripcion: e.target.value }))
                }
                placeholder="Descripcion opcional"
              />
            </div>

            <Separator />

            <div className="flex items-center gap-3">
              <Switch
                checked={form.activo}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, activo: checked }))
                }
              />
              <span className="text-sm">Activa</span>
            </div>
          </div>

          <SheetFooter className="flex-row justify-end gap-2 border-t pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSheetOpen(false)}
            >
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {editingId ? "Guardar" : "Crear"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
