"use client";

import * as React from "react";
import Link from "next/link";
import { BoxesIcon, ExternalLinkIcon, GitBranchIcon, PlusIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProductoListItem } from "@/lib/productos-servicios";

export function ProductosServiciosTable({
  initialProductos,
}: {
  initialProductos: ProductoListItem[];
}) {
  const productos = initialProductos;

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
        <Card>
          <CardHeader>
            <CardTitle>Sin productos cargados</CardTitle>
            <CardDescription>
              Ejecutá el seed (npx prisma db seed) para cargar los 4 productos validados de
              Fase E (Tarjetas, Vinilo, Talonarios, Rígidos).
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BoxesIcon className="size-5" />
              <CardTitle>Productos</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Unidad comercial</TableHead>
                  <TableHead>Modo medidas</TableHead>
                  <TableHead>Rutas</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.codigo}</TableCell>
                    <TableCell>
                      <div className="font-medium">{p.nombre}</div>
                      {p.descripcion && (
                        <div className="text-muted-foreground text-xs">{p.descripcion}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{p.unidadComercial}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.modoMedidas === "FIJA" ? "secondary" : "default"}>
                        {p.modoMedidas}
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
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
