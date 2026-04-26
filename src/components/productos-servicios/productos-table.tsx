"use client";

import * as React from "react";
import Link from "next/link";
import {
  BoxesIcon,
  ExternalLinkIcon,
  GitBranchIcon,
  PackageIcon,
  PlusIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { TableFilters, type FiltroSelect } from "@/components/ui/table-filters";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProductoListItem } from "@/lib/productos-servicios";
import {
  getLabel,
  modoMedidasLabels,
  unidadComercialLabels,
} from "@/lib/labels-humanos";

export function ProductosServiciosTable({
  initialProductos,
}: {
  initialProductos: ProductoListItem[];
}) {
  const productos = initialProductos;
  const [search, setSearch] = React.useState("");
  const [filtroUnidad, setFiltroUnidad] = React.useState("");
  const [filtroEstado, setFiltroEstado] = React.useState("");

  const productosFiltrados = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return productos.filter((p) => {
      if (term) {
        const haystack = `${p.codigo} ${p.nombre} ${p.descripcion ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (filtroUnidad && p.unidadComercial !== filtroUnidad) return false;
      if (filtroEstado === "activo" && !p.activo) return false;
      if (filtroEstado === "inactivo" && p.activo) return false;
      return true;
    });
  }, [productos, search, filtroUnidad, filtroEstado]);

  const filtros: FiltroSelect[] = [
    {
      id: "unidad",
      label: "Unidad",
      value: filtroUnidad,
      onChange: setFiltroUnidad,
      opciones: [
        { value: "unidad", label: getLabel(unidadComercialLabels, "unidad").label },
        { value: "m2", label: getLabel(unidadComercialLabels, "m2").label },
        { value: "metro_lineal", label: getLabel(unidadComercialLabels, "metro_lineal").label },
      ],
    },
    {
      id: "estado",
      label: "Estado",
      value: filtroEstado,
      onChange: setFiltroEstado,
      opciones: [
        { value: "activo", label: "Activos" },
        { value: "inactivo", label: "Inactivos" },
      ],
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Catálogo de productos</h1>
          <p className="text-muted-foreground text-sm">
            {productos.length} productos cargados en el modelo universal por pasos.
          </p>
        </div>
        <Link href="/productos-servicios/nuevo">
          <Button>
            <PlusIcon className="mr-2 size-4" />
            Nuevo producto
          </Button>
        </Link>
      </div>

      {productos.length === 0 ? (
        <EstadoVacio
          icon={<PackageIcon />}
          titulo="Sin productos cargados"
          descripcion="Empezá creando tu primer producto desde el wizard, o ejecutá el seed para cargar los productos validados de fase E (Tarjetas, Vinilo, Talonarios, Rígidos)."
          cta={{ label: "Crear producto", href: "/productos-servicios/nuevo", icon: PlusIcon }}
        />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BoxesIcon className="size-5" />
                <CardTitle>Productos</CardTitle>
              </div>
            </div>
            <TableFilters
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Buscar por código, nombre o descripción..."
              filtros={filtros}
              resumen={`${productosFiltrados.length} de ${productos.length}`}
            />
          </CardHeader>
          <CardContent>
            {productosFiltrados.length === 0 ? (
              <EstadoVacio
                variant="compacto"
                titulo="No hay productos que coincidan"
                descripcion="Probá ajustar la búsqueda o limpiar los filtros."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>¿Cómo se cobra?</TableHead>
                    <TableHead>Manejo de medidas</TableHead>
                    <TableHead>Rutas</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productosFiltrados.map((p) => {
                    const lblUnidad = getLabel(unidadComercialLabels, p.unidadComercial);
                    const lblMedidas = getLabel(modoMedidasLabels, p.modoMedidas);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs">{p.codigo}</TableCell>
                        <TableCell>
                          <div className="font-medium">{p.nombre}</div>
                          {p.descripcion && (
                            <div className="text-muted-foreground text-xs">{p.descripcion}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" title={lblUnidad.descripcion}>
                            {lblUnidad.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={p.modoMedidas === "FIJA" ? "secondary" : "default"}
                            title={lblMedidas.descripcion}
                          >
                            {lblMedidas.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {p.rutasAlternativas.map((ra) => (
                              <Badge
                                key={ra.id}
                                variant={ra.esPreferida ? "default" : "outline"}
                                className="gap-1"
                              >
                                <GitBranchIcon className="size-3" />
                                {ra.nombre}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={p.activo ? "default" : "secondary"}>
                            {p.activo ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={`/productos-servicios/${p.id}`}
                            className="text-primary inline-flex items-center text-sm hover:underline"
                          >
                            Ver detalle
                            <ExternalLinkIcon className="ml-1 size-3" />
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
