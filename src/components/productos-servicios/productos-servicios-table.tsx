"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { createProductoServicio } from "@/lib/productos-servicios-api";
import type {
  EstadoProductoServicio,
  FamiliaProducto,
  MotorCostoCatalogItem,
  ProductoServicio,
  SubfamiliaProducto,
} from "@/lib/productos-servicios";
import {
  estadoProductoServicioItems,
} from "@/lib/productos-servicios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type ProductosServiciosTableProps = {
  initialProductos: ProductoServicio[];
  familias: FamiliaProducto[];
  subfamilias: SubfamiliaProducto[];
  motores: MotorCostoCatalogItem[];
};

type ProductoFormState = {
  nombre: string;
  descripcion: string;
  familiaProductoId: string;
  subfamiliaProductoId: string;
  motorCodigo: string;
  motorVersion: number;
};

function createEmptyProductoForm(
  familias: FamiliaProducto[],
  motores: MotorCostoCatalogItem[],
): ProductoFormState {
  const motor = motores[0];
  return {
    nombre: "",
    descripcion: "",
    familiaProductoId: familias[0]?.id ?? "",
    subfamiliaProductoId: "",
    motorCodigo: motor?.code ?? "impresion_digital_laser",
    motorVersion: motor?.version ?? 1,
  };
}

function getEstadoLabel(value: EstadoProductoServicio) {
  return (
    estadoProductoServicioItems.find((item) => item.value === value)?.label ??
    value
  );
}

export function ProductosServiciosTable({
  initialProductos,
  familias,
  subfamilias,
  motores,
}: ProductosServiciosTableProps) {
  const router = useRouter();
  const [productos, setProductos] = React.useState(initialProductos);
  const [openCreate, setOpenCreate] = React.useState(false);
  const [isSaving, startSaving] = React.useTransition();
  const [form, setForm] = React.useState<ProductoFormState>(() =>
    createEmptyProductoForm(familias, motores),
  );

  const filteredSubfamilias = React.useMemo(
    () =>
      subfamilias.filter((item) => item.familiaProductoId === form.familiaProductoId),
    [subfamilias, form.familiaProductoId],
  );

  const familiaSeleccionada = React.useMemo(
    () => familias.find((item) => item.id === form.familiaProductoId) ?? null,
    [familias, form.familiaProductoId],
  );

  const subfamiliaSeleccionada = React.useMemo(
    () =>
      filteredSubfamilias.find((item) => item.id === form.subfamiliaProductoId) ??
      null,
    [filteredSubfamilias, form.subfamiliaProductoId],
  );

  const familiaLabel = React.useMemo(() => {
    if (!familiaSeleccionada) {
      return "";
    }
    return familiaSeleccionada.nombre;
  }, [familiaSeleccionada]);

  const subfamiliaLabel = React.useMemo(() => {
    if (!subfamiliaSeleccionada) {
      return "";
    }
    return subfamiliaSeleccionada.nombre;
  }, [subfamiliaSeleccionada]);

  const openCreateSheet = () => {
    setForm(createEmptyProductoForm(familias, motores));
    setOpenCreate(true);
  };

  const motorCostoValue = `${form.motorCodigo}@${form.motorVersion}`;
  const motorCostoLabel = React.useMemo(
    () =>
      motores.find((item) => `${item.code}@${item.version}` === motorCostoValue)?.label ??
      "Seleccionar motor de costo",
    [motores, motorCostoValue],
  );

  const handleCreate = () => {
    if (!form.nombre.trim() || !form.familiaProductoId) {
      toast.error("Completa nombre y familia para continuar.");
      return;
    }

    startSaving(async () => {
      try {
        const created = await createProductoServicio({
          descripcion: form.descripcion.trim() || undefined,
          nombre: form.nombre.trim(),
          motorCodigo: form.motorCodigo,
          motorVersion: form.motorVersion,
          familiaProductoId: form.familiaProductoId,
          subfamiliaProductoId: form.subfamiliaProductoId || undefined,
          activo: true,
          estado: "activo",
        });

        setProductos((prev) => [...prev, created].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        setOpenCreate(false);
        toast.success("Producto creado.");
        router.push(`/costos/productos-servicios/${created.id}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo crear el registro.");
      }
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Catalogo de productos</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/costos/productos-servicios/familias")}
            >
              Editar familias
            </Button>
            <Button type="button" onClick={openCreateSheet}>
              <PlusIcon data-icon="inline-start" />
              Crear producto
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Codigo</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Familia</TableHead>
                <TableHead>Subfamilia</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productos.map((item) => (
                <TableRow
                  key={item.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/costos/productos-servicios/${item.id}`)}
                >
                  <TableCell>{item.codigo}</TableCell>
                  <TableCell className="font-medium">{item.nombre}</TableCell>
                  <TableCell>{item.familiaProductoNombre}</TableCell>
                  <TableCell>{item.subfamiliaProductoNombre || "Sin subfamilia"}</TableCell>
                  <TableCell>
                    <Badge variant={item.estado === "activo" ? "default" : "secondary"}>
                      {getEstadoLabel(item.estado)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={openCreate} onOpenChange={setOpenCreate}>
        <SheetContent side="right" className="w-full overflow-y-auto px-6 sm:max-w-3xl sm:px-8">
          <SheetHeader>
            <SheetTitle>Crear producto</SheetTitle>
            <SheetDescription>
              Crea el producto base para el catalogo.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 flex flex-col gap-4 pr-1">
            <Field>
              <FieldLabel>Nombre</FieldLabel>
              <Input
                value={form.nombre}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, nombre: event.target.value }))
                }
                placeholder="Ej: Tarjetas personales 9x5"
              />
            </Field>

            <Field>
              <FieldLabel>Familia</FieldLabel>
              <Select
                value={form.familiaProductoId}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    familiaProductoId: value ?? "",
                    subfamiliaProductoId: "",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      familias.length > 0 ? "Seleccionar familia" : "Sin familias cargadas"
                    }
                  >
                    {familiaLabel}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {familias.length === 0 ? (
                    <SelectItem value="__no_familias__" disabled>
                      No hay familias cargadas
                    </SelectItem>
                  ) : (
                    familias.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.codigo} · {item.nombre}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>Subfamilia</FieldLabel>
              <Select
                value={form.subfamiliaProductoId || "__none__"}
                disabled={!form.familiaProductoId || filteredSubfamilias.length === 0}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    subfamiliaProductoId: !value || value === "__none__" ? "" : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !form.familiaProductoId
                        ? "Primero selecciona familia"
                        : filteredSubfamilias.length === 0
                          ? "Sin subfamilias disponibles"
                          : "Sin subfamilia"
                    }
                  >
                    {subfamiliaLabel}
                  </SelectValue>
                </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin subfamilia</SelectItem>
                    {filteredSubfamilias.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.codigo} · {item.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              <p className="text-xs text-muted-foreground">
                {subfamiliaSeleccionada
                  ? `Seleccionada: ${subfamiliaSeleccionada.codigo} · ${subfamiliaSeleccionada.nombre}`
                  : filteredSubfamilias.length === 0
                    ? "La familia actual no tiene subfamilias cargadas."
                    : "No hay subfamilia seleccionada."}
              </p>
            </Field>

            <Field>
              <FieldLabel>Descripcion</FieldLabel>
              <Textarea
                value={form.descripcion}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, descripcion: event.target.value }))
                }
                placeholder="Opcional"
                className="min-h-40"
              />
            </Field>

            <Field>
              <FieldLabel>Motor de costo</FieldLabel>
              <Select
                value={motorCostoValue}
                onValueChange={(value) =>
                  setForm((prev) => {
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
                  <SelectValue placeholder="Seleccionar motor de costo">{motorCostoLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {motores.map((item) => (
                    <SelectItem key={`${item.code}@${item.version}`} value={`${item.code}@${item.version}`}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <SheetFooter className="mt-6 flex flex-col gap-2 sm:flex-col">
            <Button type="button" onClick={handleCreate} disabled={isSaving} className="w-full">
              {isSaving ? "Creando..." : "Crear producto"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpenCreate(false)}
              className="w-full"
            >
              Cancelar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
