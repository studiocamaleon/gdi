"use client";

import * as React from "react";
import { EyeIcon, InfoIcon, MapIcon, SaveIcon } from "lucide-react";
import { toast } from "sonner";

import type { ProductTabProps } from "@/components/productos-servicios/product-detail-types";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProductoTabSection } from "@/components/productos-servicios/producto-tab-section";
import { updateProductoRutaPolicy } from "@/lib/productos-servicios-api";

export function ProductoRutaBaseTab(props: ProductTabProps) {
  const [rutaId, setRutaId] = React.useState(props.producto.procesoDefinicionDefaultId ?? "");
  const [isSaving, startSaving] = React.useTransition();

  React.useEffect(() => {
    setRutaId(props.producto.procesoDefinicionDefaultId ?? "");
  }, [props.producto.procesoDefinicionDefaultId]);

  const procesoSeleccionado = React.useMemo(
    () => props.procesos.find((item) => item.id === rutaId) ?? null,
    [props.procesos, rutaId],
  );
  const isDirty = rutaId !== (props.producto.procesoDefinicionDefaultId ?? "");
  const variantesAfectadas = props.variantes.length;

  const handleSave = () =>
    startSaving(async () => {
      try {
        await updateProductoRutaPolicy(props.producto.id, {
          usarRutaComunVariantes: true,
          procesoDefinicionDefaultId: rutaId || null,
        });
        await props.refreshProducto();
        toast.success("Ruta base actualizada.");
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "No se pudo actualizar la ruta base.");
      }
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ruta base</CardTitle>
        <CardDescription>
          Define la ruta principal del producto desde una UI estándar del ERP. Los motores más complejos pueden extender este tab cuando haga falta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ProductoTabSection
          title="Resumen de configuración"
          description="Lectura rápida de la ruta principal y del impacto sobre el producto."
          icon={InfoIcon}
          contentClassName="grid gap-3 md:grid-cols-3"
        >
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Ruta principal actual</p>
            <p className="mt-1 text-sm font-medium">{procesoSeleccionado ? `${procesoSeleccionado.codigo} · ${procesoSeleccionado.nombre}` : "Sin ruta"}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Modo de resolución</p>
            <p className="mt-1 text-sm font-medium">Ruta única para todo el producto</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Variantes afectadas</p>
            <p className="mt-1 text-sm font-medium">{variantesAfectadas}</p>
          </div>
        </ProductoTabSection>

        <ProductoTabSection
          title="Ruta principal"
          description="Definí la ruta base del producto. Esta secuencia será la referencia para los tabs técnicos que dependan de la ruta."
          icon={MapIcon}
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
            <Field>
              <FieldLabel>Ruta principal</FieldLabel>
              <Select value={rutaId || "__none__"} onValueChange={(value) => setRutaId(value === "__none__" ? "" : value ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná una ruta">
                    {procesoSeleccionado
                      ? `${procesoSeleccionado.codigo} · ${procesoSeleccionado.nombre}`
                      : "Seleccioná una ruta"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin ruta</SelectItem>
                  {props.procesos.map((proceso) => (
                    <SelectItem key={proceso.id} value={proceso.id}>
                      {proceso.codigo} · {proceso.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Modo de resolución</FieldLabel>
              <div className="flex h-10 items-center rounded-md border px-3 text-sm text-muted-foreground">
                Ruta común del producto
              </div>
            </Field>
          </div>
        </ProductoTabSection>

        <ProductoTabSection
          title="Preview de ruta efectiva"
          description="Validá la secuencia operativa final antes de guardar."
          icon={EyeIcon}
        >
          {procesoSeleccionado ? (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[64px]">#</TableHead>
                    <TableHead>Paso</TableHead>
                    <TableHead>Centro de costo</TableHead>
                    <TableHead>Máquina</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {procesoSeleccionado.operaciones.length ? (
                    procesoSeleccionado.operaciones.map((operacion) => (
                      <TableRow key={operacion.id}>
                        <TableCell>{operacion.orden}</TableCell>
                        <TableCell>{operacion.nombre}</TableCell>
                        <TableCell>{operacion.centroCostoNombre || "-"}</TableCell>
                        <TableCell>{operacion.maquinaNombre || "-"}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                        La ruta seleccionada no tiene operaciones cargadas todavía.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Seleccioná una ruta para ver su secuencia operativa.
            </div>
          )}
        </ProductoTabSection>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Acción final</p>
            <p className="text-xs text-muted-foreground">
              Confirmá los cambios del tab cuando termines de revisar la ruta principal.
            </p>
          </div>
          <Button type="button" onClick={handleSave} disabled={isSaving || !isDirty}>
            {isSaving ? <GdiSpinner className="size-4" data-icon="inline-start" /> : <SaveIcon className="size-4" data-icon="inline-start" />}
            Guardar cambios
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
