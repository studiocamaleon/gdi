"use client";

import * as React from "react";
import { PencilIcon, SaveIcon } from "lucide-react";
import { toast } from "sonner";

import type { ProductTabProps } from "@/components/productos-servicios/product-detail-types";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createProductoVariante, updateProductoVariante } from "@/lib/productos-servicios-api";

type VarianteDraft = {
  nombre: string;
  anchoMm: string;
  altoMm: string;
  activo: boolean;
};

function createEmptyDraft(): VarianteDraft {
  return {
    nombre: "",
    anchoMm: "1000",
    altoMm: "300",
    activo: true,
  };
}

export function ProductoVariantesTab(props: ProductTabProps) {
  const [newVariante, setNewVariante] = React.useState<VarianteDraft>(createEmptyDraft);
  const [editingVarianteId, setEditingVarianteId] = React.useState<string | null>(null);
  const [editingVariante, setEditingVariante] = React.useState<VarianteDraft>(createEmptyDraft);
  const [isCreating, startCreating] = React.useTransition();
  const [isUpdating, startUpdating] = React.useTransition();

  const createVariant = () =>
    startCreating(async () => {
      try {
        const created = await createProductoVariante(props.producto.id, {
          nombre: newVariante.nombre.trim() || `Variante ${props.variantes.length + 1}`,
          anchoMm: Math.max(1, Number(newVariante.anchoMm || 0)),
          altoMm: Math.max(1, Number(newVariante.altoMm || 0)),
          tipoImpresion: "cmyk",
          caras: "simple_faz",
          activo: newVariante.activo,
        });
        const refreshed = await props.refreshVariantes();
        props.setSelectedVariantId(created.id);
        setNewVariante(createEmptyDraft());
        if (!refreshed.some((item) => item.id === created.id)) {
          props.setSelectedVariantId(created.id);
        }
        toast.success("Variante creada.");
      } catch (error) {
        console.error(error);
        toast.error("No se pudo crear la variante.");
      }
    });

  const beginEditVariant = (variantId: string) => {
    const variant = props.variantes.find((item) => item.id === variantId);
    if (!variant) return;
    setEditingVarianteId(variant.id);
    setEditingVariante({
      nombre: variant.nombre,
      anchoMm: String(variant.anchoMm),
      altoMm: String(variant.altoMm),
      activo: variant.activo,
    });
  };

  const saveVariant = () => {
    if (!editingVarianteId) return;
    startUpdating(async () => {
      try {
        await updateProductoVariante(editingVarianteId, {
          nombre: editingVariante.nombre.trim() || undefined,
          anchoMm: Math.max(1, Number(editingVariante.anchoMm || 0)),
          altoMm: Math.max(1, Number(editingVariante.altoMm || 0)),
          activo: editingVariante.activo,
        });
        await props.refreshVariantes();
        setEditingVarianteId(null);
        toast.success("Variante actualizada.");
      } catch (error) {
        console.error(error);
        toast.error("No se pudo actualizar la variante.");
      }
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Variantes</CardTitle>
          <CardDescription>Administración transversal de variantes del producto.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Field>
              <FieldLabel>Nombre</FieldLabel>
              <Input value={newVariante.nombre} onChange={(e) => setNewVariante((prev) => ({ ...prev, nombre: e.target.value }))} />
            </Field>
            <Field>
              <FieldLabel>Ancho (mm)</FieldLabel>
              <Input type="number" value={newVariante.anchoMm} onChange={(e) => setNewVariante((prev) => ({ ...prev, anchoMm: e.target.value }))} />
            </Field>
            <Field>
              <FieldLabel>Alto (mm)</FieldLabel>
              <Input type="number" value={newVariante.altoMm} onChange={(e) => setNewVariante((prev) => ({ ...prev, altoMm: e.target.value }))} />
            </Field>
            <Field>
              <FieldLabel>Activo</FieldLabel>
              <label className="flex h-10 items-center gap-3 rounded-md border px-3">
                <Checkbox checked={newVariante.activo} onCheckedChange={(checked) => setNewVariante((prev) => ({ ...prev, activo: checked === true }))} />
                <span className="text-sm">Habilitada</span>
              </label>
            </Field>
          </div>
          <Button onClick={createVariant} disabled={isCreating}>
            {isCreating ? <GdiSpinner className="mr-2 size-4" /> : <SaveIcon className="mr-2 size-4" />}
            Crear variante
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Listado</CardTitle>
        </CardHeader>
        <CardContent>
          {props.variantes.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Seleccionada</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Ancho</TableHead>
                  <TableHead>Alto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {props.variantes.map((variant) => (
                  <TableRow key={variant.id}>
                    <TableCell>
                      <Checkbox
                        checked={props.selectedVariantId === variant.id}
                        onCheckedChange={(checked) => {
                          if (checked === true) props.setSelectedVariantId(variant.id);
                        }}
                      />
                    </TableCell>
                    <TableCell>{variant.nombre}</TableCell>
                    <TableCell>{variant.anchoMm} mm</TableCell>
                    <TableCell>{variant.altoMm} mm</TableCell>
                    <TableCell>{variant.activo ? "Activa" : "Inactiva"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" onClick={() => beginEditVariant(variant.id)}>
                        <PencilIcon className="mr-2 size-4" />
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Este producto todavía no tiene variantes. Creá una para habilitar los tabs técnicos.
            </div>
          )}
        </CardContent>
      </Card>

      {editingVarianteId ? (
        <Card>
          <CardHeader>
            <CardTitle>Editar variante</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <Field>
              <FieldLabel>Nombre</FieldLabel>
              <Input value={editingVariante.nombre} onChange={(e) => setEditingVariante((prev) => ({ ...prev, nombre: e.target.value }))} />
            </Field>
            <Field>
              <FieldLabel>Ancho (mm)</FieldLabel>
              <Input type="number" value={editingVariante.anchoMm} onChange={(e) => setEditingVariante((prev) => ({ ...prev, anchoMm: e.target.value }))} />
            </Field>
            <Field>
              <FieldLabel>Alto (mm)</FieldLabel>
              <Input type="number" value={editingVariante.altoMm} onChange={(e) => setEditingVariante((prev) => ({ ...prev, altoMm: e.target.value }))} />
            </Field>
            <Field>
              <FieldLabel>Activo</FieldLabel>
              <label className="flex h-10 items-center gap-3 rounded-md border px-3">
                <Checkbox checked={editingVariante.activo} onCheckedChange={(checked) => setEditingVariante((prev) => ({ ...prev, activo: checked === true }))} />
                <span className="text-sm">Habilitada</span>
              </label>
            </Field>
            <div className="md:col-span-4 flex gap-3">
              <Button onClick={saveVariant} disabled={isUpdating}>
                {isUpdating ? <GdiSpinner className="mr-2 size-4" /> : <SaveIcon className="mr-2 size-4" />}
                Guardar variante
              </Button>
              <Button variant="outline" onClick={() => setEditingVarianteId(null)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
