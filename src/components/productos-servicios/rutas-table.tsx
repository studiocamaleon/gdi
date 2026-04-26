"use client";

import * as React from "react";
import Link from "next/link";
import {
  ExternalLinkIcon,
  GitBranchIcon,
  PlusIcon,
  WorkflowIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { TableFilters } from "@/components/ui/table-filters";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FamiliaListItem, RutaListItem } from "@/lib/productos-servicios";
import { getCatalogoFamilias } from "@/lib/productos-servicios-api";

export function RutasTable({ initialRutas }: { initialRutas: RutaListItem[] }) {
  const rutas = initialRutas;
  const [familias, setFamilias] = React.useState<FamiliaListItem[]>([]);
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    getCatalogoFamilias()
      .then((cat) => setFamilias(cat.familias))
      .catch(() => setFamilias([]));
  }, []);

  const familiaLabel = React.useCallback(
    (codigo: string): string => {
      const f = familias.find((x) => x.codigo === codigo);
      return f?.nombre ?? codigo;
    },
    [familias],
  );

  const rutasFiltradas = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rutas;
    return rutas.filter((r) => {
      const nombresPasos = r.pasos.map((p) => familiaLabel(p.familiaCodigo).toLowerCase()).join(" ");
      const haystack = `${r.codigo} ${r.nombre} ${r.descripcion ?? ""} ${nombresPasos}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [rutas, search, familiaLabel]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Rutas de producción</h1>
          <p className="text-muted-foreground text-sm">
            {rutas.length} rutas reusables. Cada ruta es un esqueleto de pasos que los productos
            pueden referenciar.
          </p>
        </div>
        <Link href="/productos-servicios/rutas/nueva">
          <Button>
            <PlusIcon className="mr-2 size-4" />
            Nueva ruta
          </Button>
        </Link>
      </div>

      {rutas.length === 0 ? (
        <EstadoVacio
          icon={<WorkflowIcon />}
          titulo="Sin rutas cargadas"
          descripcion="Las rutas son los caminos de producción reusables (ej: 'Tarjeta digital', 'Vinilo eco-solvente'). Empezá creando una desde cero o ejecutá el seed."
          cta={{ label: "Crear ruta", href: "/productos-servicios/rutas/nueva", icon: PlusIcon }}
        />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <WorkflowIcon className="size-5" />
                <CardTitle>Rutas</CardTitle>
              </div>
            </div>
            <TableFilters
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Buscar por código, nombre o pasos..."
              resumen={`${rutasFiltradas.length} de ${rutas.length}`}
            />
          </CardHeader>
          <CardContent>
            {rutasFiltradas.length === 0 ? (
              <EstadoVacio
                variant="compacto"
                titulo="Ninguna ruta coincide"
                descripcion="Probá con otros términos de búsqueda."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="w-1/3">Pasos</TableHead>
                    <TableHead className="text-center">Versión</TableHead>
                    <TableHead className="text-center">Productos que la usan</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rutasFiltradas.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.codigo}</TableCell>
                      <TableCell>
                        <div className="font-medium">{r.nombre}</div>
                        {r.descripcion && (
                          <div className="text-muted-foreground text-xs">{r.descripcion}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1 text-xs">
                          {r.pasos.map((p, i) => (
                            <React.Fragment key={p.id}>
                              <Badge
                                variant="outline"
                                className="text-[10px]"
                                title={p.familiaCodigo}
                              >
                                {i + 1}. {familiaLabel(p.familiaCodigo)}
                              </Badge>
                              {i < r.pasos.length - 1 && (
                                <span className="text-muted-foreground">→</span>
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">v{r.versionActual}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="default" className="gap-1">
                          <GitBranchIcon className="size-3" />
                          {r._count.productosAlternativas}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/productos-servicios/rutas/${r.id}`}
                          className="text-primary inline-flex items-center text-sm hover:underline"
                        >
                          Ver / editar
                          <ExternalLinkIcon className="ml-1 size-3" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
