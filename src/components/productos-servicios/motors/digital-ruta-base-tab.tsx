"use client";

import * as React from "react";
import { SaveIcon } from "lucide-react";
import { toast } from "sonner";

import type { ProductTabProps } from "@/components/productos-servicios/product-detail-types";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { assignProductoVarianteRuta, updateProductoRutaPolicy } from "@/lib/productos-servicios-api";

const EMPTY_SELECT_VALUE = "__none__";

function getModoProductividadLabel(value: string) {
  return value === "fija" ? "Fija" : "Variable";
}

function getUnidadProcesoLabel(value: string) {
  if (value === "copia") return "Copia";
  if (value === "hoja") return "Hoja";
  if (value === "m2") return "Metro cuadrado";
  if (value === "metro_lineal") return "Metro lineal";
  if (value === "pieza") return "Pieza";
  if (value === "unidad") return "Unidad";
  if (value === "minuto") return "Minuto";
  if (value === "hora") return "Hora";
  return value;
}

function getUnidadProductividadCompuestaLabel(unidadSalida: string, unidadTiempo: string) {
  const key = `${unidadSalida}/${unidadTiempo}`;
  const labels: Record<string, string> = {
    "copia/minuto": "Páginas por minuto (pag/min)",
    "hoja/minuto": "Hojas por minuto (hoja/min)",
    "m2/hora": "Metros cuadrados por hora (m2/h)",
    "metro_lineal/hora": "Metros lineales por hora (ml/h)",
    "pieza/hora": "Piezas por hora (pieza/h)",
    "unidad/hora": "Unidades por hora (unidad/h)",
  };
  return labels[key] ?? `${getUnidadProcesoLabel(unidadSalida)} por ${getUnidadProcesoLabel(unidadTiempo)}`;
}

export function DigitalRutaBaseTab(props: ProductTabProps) {
  const [usarRutaComunVariantes, setUsarRutaComunVariantes] = React.useState(props.producto.usarRutaComunVariantes);
  const [rutaDefaultProductoId, setRutaDefaultProductoId] = React.useState(props.producto.procesoDefinicionDefaultId ?? "");
  const [variantes, setVariantes] = React.useState(props.variantes);
  const [rutasPorVarianteDraft, setRutasPorVarianteDraft] = React.useState<Record<string, string>>(
    () => Object.fromEntries(props.variantes.map((item) => [item.id, item.procesoDefinicionId ?? ""])),
  );
  const [isSaving, startSaving] = React.useTransition();

  React.useEffect(() => {
    setUsarRutaComunVariantes(props.producto.usarRutaComunVariantes);
    setRutaDefaultProductoId(props.producto.procesoDefinicionDefaultId ?? "");
    setVariantes(props.variantes);
    setRutasPorVarianteDraft(
      Object.fromEntries(props.variantes.map((item) => [item.id, item.procesoDefinicionId ?? ""])),
    );
  }, [props.producto.usarRutaComunVariantes, props.producto.procesoDefinicionDefaultId, props.variantes]);

  const rutaLabelById = React.useMemo(
    () => new Map(props.procesos.map((item) => [item.id, `${item.codigo} · ${item.nombre}`])),
    [props.procesos],
  );
  const procesoSeleccionado = React.useMemo(
    () => props.procesos.find((item) => item.id === rutaDefaultProductoId) ?? null,
    [props.procesos, rutaDefaultProductoId],
  );

  const handleToggleRutasPorVariante = (checked: boolean) => {
    const nextUsarRutaComunVariantes = !checked;
    setUsarRutaComunVariantes(nextUsarRutaComunVariantes);
    if (nextUsarRutaComunVariantes && !rutaDefaultProductoId) {
      const fallbackId =
        props.producto.procesoDefinicionDefaultId ||
        Object.values(rutasPorVarianteDraft).find((id) => Boolean(id)) ||
        variantes.find((item) => Boolean(item.procesoDefinicionId))?.procesoDefinicionId ||
        "";
      setRutaDefaultProductoId(fallbackId);
    }
  };

  const handleSave = () =>
    startSaving(async () => {
      try {
        await updateProductoRutaPolicy(props.producto.id, {
          usarRutaComunVariantes,
          procesoDefinicionDefaultId: rutaDefaultProductoId || null,
        });

        if (!usarRutaComunVariantes) {
          await Promise.all(
            variantes.map((variante) =>
              assignProductoVarianteRuta(variante.id, (rutasPorVarianteDraft[variante.id] ?? "") || null),
            ),
          );
        }

        await props.refreshProducto();
        const refreshedVariantes = await props.refreshVariantes();
        setVariantes(refreshedVariantes);
        toast.success("Ruta de producción actualizada.");
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "No se pudo guardar la ruta de producción.");
      }
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ruta de producción</CardTitle>
        <CardDescription>
          Asigná el proceso de producción para este producto. Los pasos marcados con rol &quot;Impresión&quot; resuelven su máquina y perfil desde la configuración de cada variante.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Sección 1: Selector de ruta principal */}
        <Field>
          <FieldLabel>Proceso de producción</FieldLabel>
          <Select
            value={rutaDefaultProductoId || EMPTY_SELECT_VALUE}
            onValueChange={(value) => setRutaDefaultProductoId(!value || value === EMPTY_SELECT_VALUE ? "" : value)}
          >
            <SelectTrigger>
              <SelectValue>
                {rutaLabelById.get(rutaDefaultProductoId) ?? "Seleccionar proceso"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EMPTY_SELECT_VALUE}>Sin proceso asignado</SelectItem>
              {props.procesos
                .filter((p) => p.activo)
                .map((proceso) => (
                  <SelectItem key={proceso.id} value={proceso.id}>
                    {proceso.codigo} · {proceso.nombre}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </Field>

        {/* Sección 2: Preview de operaciones de la ruta */}
        {procesoSeleccionado ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Pasos de producción ({procesoSeleccionado.operaciones.filter((op) => op.activo).length})
            </p>
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Paso</TableHead>
                  <TableHead>Centro de costo</TableHead>
                  <TableHead>Máquina</TableHead>
                  <TableHead>Modo / Productividad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {procesoSeleccionado.operaciones
                  .filter((op) => op.activo)
                  .map((op) => (
                    <TableRow key={op.id}>
                      <TableCell className="text-muted-foreground">{op.orden}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{op.nombre}</span>
                          {op.rol === "impresion" ? (
                            <Badge variant="default" className="text-xs">Impresión</Badge>
                          ) : null}
                          {op.esOpcional ? (
                            <Badge variant="secondary" className="text-xs">Opcional</Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>{op.centroCostoNombre}</TableCell>
                      <TableCell>
                        {op.maquinaNombre || "Sin máquina"}
                        {op.rol === "impresion" ? (
                          <span className="ml-1 text-xs text-muted-foreground">(resuelve desde variante)</span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {getModoProductividadLabel(op.modoProductividad)}
                          {op.modoProductividad === "fija" && op.tiempoFijoMin
                            ? ` · ${op.tiempoFijoMin} min`
                            : null}
                          {op.modoProductividad === "variable" && op.productividadBase
                            ? ` · ${op.productividadBase} ${getUnidadProductividadCompuestaLabel(op.unidadSalida, op.unidadTiempo)}`
                            : null}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        ) : null}

        {/* Sección 3: Toggle ruta por variante */}
        <div className="flex items-center gap-3 rounded-lg border p-4">
          <Switch
            checked={!usarRutaComunVariantes}
            onCheckedChange={handleToggleRutasPorVariante}
          />
          <div>
            <p className="text-sm font-medium">Rutas por variante</p>
            <p className="text-xs text-muted-foreground">
              {usarRutaComunVariantes
                ? "Todas las variantes comparten la misma ruta de producción."
                : "Cada variante puede tener su propia ruta de producción."}
            </p>
          </div>
        </div>

        {/* Sección 4: Si ruta por variante, selector por cada una */}
        {!usarRutaComunVariantes ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Ruta por variante</p>
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Variante</TableHead>
                  <TableHead>Proceso asignado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {variantes.map((variante) => (
                  <TableRow key={variante.id}>
                    <TableCell className="font-medium">{variante.nombre}</TableCell>
                    <TableCell>
                      <Select
                        value={rutasPorVarianteDraft[variante.id] || EMPTY_SELECT_VALUE}
                        onValueChange={(value) =>
                          setRutasPorVarianteDraft((prev) => ({
                            ...prev,
                            [variante.id]: !value || value === EMPTY_SELECT_VALUE ? "" : value,
                          }))
                        }
                      >
                        <SelectTrigger className="w-80">
                          <SelectValue>
                            {rutaLabelById.get(rutasPorVarianteDraft[variante.id] ?? "") ?? "Seleccionar proceso"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={EMPTY_SELECT_VALUE}>Sin proceso</SelectItem>
                          {props.procesos
                            .filter((p) => p.activo)
                            .map((proceso) => (
                              <SelectItem key={proceso.id} value={proceso.id}>
                                {proceso.codigo} · {proceso.nombre}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}

        {/* Botón guardar */}
        <div className="flex justify-end">
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <GdiSpinner className="size-4" data-icon="inline-start" /> : <SaveIcon className="size-4" data-icon="inline-start" />}
            Guardar cambios
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
