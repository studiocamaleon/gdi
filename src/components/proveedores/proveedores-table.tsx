"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDownIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  PencilIcon,
  PlusIcon,
  SearchXIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { toast } from "sonner";

import { NavLink } from "@/components/navigation/nav-link";
import { useNavigationFeedback } from "@/components/navigation/navigation-feedback";
import {
  deleteProveedor,
  importarProveedores,
  listProveedores,
  setProveedorActivo,
  type ProveedoresListResponse,
} from "@/lib/proveedores-api";
import type { ProveedorDetalle } from "@/lib/proveedores";
import {
  downloadContactImportTemplate,
  parseContactImportCsv,
} from "@/lib/contactos-importacion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";

type ProveedoresTableProps = {
  initialResponse: ProveedoresListResponse;
  canManage: boolean;
};

function safeSpreadsheetCell(value: string) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function buildCsv(proveedores: ProveedorDetalle[]) {
  const rows = [
    ["Nombre", "Razón social", "CUIT", "Contacto", "Email", "Ciudad", "Estado"],
    ...proveedores.map((proveedor) => [
      proveedor.nombre,
      proveedor.razonSocial,
      proveedor.cuit,
      proveedor.contacto,
      proveedor.email,
      proveedor.ciudad,
      proveedor.activo ? "Activo" : "Inhabilitado",
    ]),
  ];
  return `\uFEFF${rows
    .map((row) =>
      row
        .map((cell) => `"${safeSpreadsheetCell(cell).replaceAll('"', '""')}"`)
        .join(","),
    )
    .join("\n")}`;
}

export function ProveedoresTable({
  initialResponse,
  canManage,
}: ProveedoresTableProps) {
  const router = useRouter();
  const { startNavigation } = useNavigationFeedback();
  const [response, setResponse] = React.useState(initialResponse);
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(initialResponse.page);
  const [verInactivos, setVerInactivos] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [confirmandoEliminar, setConfirmandoEliminar] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [isDeleting, startDeleteTransition] = React.useTransition();
  const [isImporting, startImportTransition] = React.useTransition();

  React.useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  React.useEffect(() => {
    let active = true;
    setIsLoading(true);
    listProveedores({
      q: debouncedSearch,
      page,
      limit: initialResponse.limit,
      incluirInactivos: verInactivos,
    })
      .then((next) => {
        if (!active) return;
        setResponse(next);
        setSelected(new Set());
      })
      .catch((error) => {
        if (active) {
          toast.error(
            error instanceof Error
              ? error.message
              : "No se pudo actualizar la lista.",
          );
        }
      })
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [debouncedSearch, initialResponse.limit, page, verInactivos]);

  const proveedores = response.data;
  const selectedRows = proveedores.filter((proveedor) =>
    selected.has(proveedor.id),
  );
  const allSelected =
    proveedores.length > 0 &&
    proveedores.every((proveedor) => selected.has(proveedor.id));

  const refreshCurrentPage = React.useCallback(async () => {
    const next = await listProveedores({
      q: debouncedSearch,
      page,
      limit: initialResponse.limit,
      incluirInactivos: verInactivos,
    });
    setResponse(next);
    setSelected(new Set());
  }, [debouncedSearch, initialResponse.limit, page, verInactivos]);

  const handleSelect = (id: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleEditSelection = () => {
    if (selectedRows.length !== 1) return;
    const href = `/proveedores/${selectedRows[0].id}`;
    startNavigation(href);
    router.push(href);
  };

  const handleExportSelection = () => {
    if (selectedRows.length === 0) return;
    const blob = new Blob([buildCsv(selectedRows)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "proveedores-seleccion.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const cambiarEstado = (proveedor: ProveedorDetalle) => {
    startDeleteTransition(async () => {
      try {
        const actualizado = await setProveedorActivo(
          proveedor.id,
          !proveedor.activo,
        );
        if (!verInactivos && !actualizado.activo) {
          await refreshCurrentPage();
        } else {
          setResponse((current) => ({
            ...current,
            data: current.data.map((item) =>
              item.id === actualizado.id ? actualizado : item,
            ),
          }));
          setSelected((current) => {
            const next = new Set(current);
            next.delete(proveedor.id);
            return next;
          });
        }
        toast.success(
          actualizado.activo
            ? `${actualizado.nombre} vuelve a estar activo.`
            : `${actualizado.nombre} quedó inhabilitado.`,
        );
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "No se pudo cambiar el estado.",
        );
      }
    });
  };

  const confirmarEliminarSeleccion = () => {
    setConfirmandoEliminar(false);
    startDeleteTransition(async () => {
      const resultados = await Promise.allSettled(
        selectedRows.map((proveedor) => deleteProveedor(proveedor.id)),
      );
      const borrados = resultados.filter(
        (resultado) => resultado.status === "fulfilled",
      ).length;
      const error = resultados.find(
        (resultado): resultado is PromiseRejectedResult =>
          resultado.status === "rejected",
      );
      await refreshCurrentPage();
      if (borrados > 0)
        toast.success(`${borrados} proveedor(es) eliminado(s).`);
      if (error) {
        toast.error(
          error.reason instanceof Error
            ? error.reason.message
            : "No se pudo eliminar un proveedor.",
        );
      }
    });
  };

  const handleImportFile = (file: File | undefined) => {
    if (!file) return;
    startImportTransition(async () => {
      const parsed = parseContactImportCsv(await file.text(), "proveedores");
      if (parsed.fatalError) {
        toast.error(parsed.fatalError);
        return;
      }
      const invalid = parsed.rows.find((row) => row.errors.length > 0);
      if (invalid) {
        toast.error(
          `No se importó el archivo. Fila ${invalid.rowNumber}: ${invalid.errors.join(" ")}`,
        );
        return;
      }
      const payloads = parsed.rows.flatMap((row) =>
        row.payload ? [row.payload] : [],
      );
      try {
        const result = await importarProveedores(payloads);
        await refreshCurrentPage();
        toast.success(`Se importaron ${result.total} proveedor(es).`);
      } catch (error) {
        toast.error(
          `No se importó ninguna fila. ${error instanceof Error ? error.message : "Revisá el archivo."}`,
        );
      }
    });
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardHeader className="gap-4 border-b border-border/70">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl">
              <CardTitle role="heading" aria-level={1}>
                Proveedores
              </CardTitle>
              <CardDescription>
                Administrá los datos comerciales, fiscales y de pago de tus
                proveedores.
              </CardDescription>
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <Field className="min-w-0 lg:w-80">
                <FieldLabel htmlFor="proveedores-search" className="sr-only">
                  Buscar proveedores
                </FieldLabel>
                <Input
                  id="proveedores-search"
                  placeholder="Nombre, CUIT, teléfono, email o ciudad"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </Field>
              <Field orientation="horizontal" className="w-auto">
                <Switch
                  id="proveedores-inactivos"
                  aria-label="Mostrar también proveedores inhabilitados"
                  checked={verInactivos}
                  onCheckedChange={(checked) => {
                    setVerInactivos(checked);
                    setPage(1);
                  }}
                />
                <FieldLabel
                  htmlFor="proveedores-inactivos"
                  className="font-normal whitespace-nowrap"
                >
                  Ver inhabilitados
                </FieldLabel>
              </Field>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    handleImportFile(file);
                  }}
                />
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="sidebar" />}>
                    {selectedRows.length > 0
                      ? `Acciones (${selectedRows.length})`
                      : "Acciones"}
                    <ChevronDownIcon data-icon="inline-end" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canManage ? (
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          onClick={() =>
                            downloadContactImportTemplate("proveedores")
                          }
                        >
                          <FileSpreadsheetIcon />
                          Descargar plantilla
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={isImporting}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <UploadIcon />
                          {isImporting ? "Importando…" : "Importar proveedores"}
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    ) : null}
                    {canManage ? <DropdownMenuSeparator /> : null}
                    <DropdownMenuGroup>
                      {canManage ? (
                        <DropdownMenuItem
                          disabled={selectedRows.length !== 1}
                          onClick={handleEditSelection}
                        >
                          <PencilIcon />
                          Editar selección
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem
                        disabled={selectedRows.length === 0}
                        onClick={handleExportSelection}
                      >
                        <DownloadIcon />
                        Exportar selección
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    {canManage ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={selectedRows.length === 0 || isDeleting}
                          onClick={() => setConfirmandoEliminar(true)}
                        >
                          <Trash2Icon />
                          Eliminar selección
                        </DropdownMenuItem>
                      </>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
                {canManage ? (
                  <Button
                    variant="brand"
                    nativeButton={false}
                    render={<NavLink href="/proveedores/nuevo" />}
                  >
                    <PlusIcon data-icon="inline-start" />
                    Nuevo proveedor
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-0" aria-busy={isLoading}>
          {proveedores.length === 0 ? (
            <Empty className="min-h-72 border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchXIcon />
                </EmptyMedia>
                <EmptyTitle>No encontramos proveedores</EmptyTitle>
                <EmptyDescription>
                  {debouncedSearch
                    ? "Probá con otro nombre, CUIT, teléfono o ciudad."
                    : "Todavía no hay proveedores para mostrar con este filtro."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 px-4">
                      <Checkbox
                        aria-label="Seleccionar todos los proveedores de esta página"
                        checked={allSelected}
                        onCheckedChange={(checked) =>
                          setSelected(
                            checked === true
                              ? new Set(
                                  proveedores.map((proveedor) => proveedor.id),
                                )
                              : new Set(),
                          )
                        }
                      />
                    </TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>CUIT</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Ciudad</TableHead>
                    <TableHead>Datos de pago</TableHead>
                    <TableHead className="text-right">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proveedores.map((proveedor) => {
                    const isSelected = selected.has(proveedor.id);
                    return (
                      <TableRow
                        key={proveedor.id}
                        data-state={isSelected ? "selected" : undefined}
                      >
                        <TableCell className="px-4">
                          <Checkbox
                            aria-label={`Seleccionar a ${proveedor.nombre}`}
                            checked={isSelected}
                            onCheckedChange={(checked) =>
                              handleSelect(proveedor.id, checked === true)
                            }
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <NavLink
                            href={`/proveedores/${proveedor.id}`}
                            className="underline-offset-4 hover:underline"
                          >
                            {proveedor.nombre}
                          </NavLink>
                          {!proveedor.activo ? (
                            <Badge variant="outline" className="ml-2">
                              Inhabilitado
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell>{proveedor.cuit || "—"}</TableCell>
                        <TableCell>{proveedor.contacto || "—"}</TableCell>
                        <TableCell>{proveedor.email || "—"}</TableCell>
                        <TableCell>{proveedor.ciudad || "—"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              proveedor.datosPagoCompletos
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {proveedor.datosPagoCompletos
                              ? "Completos"
                              : "Incompletos"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {canManage ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={isDeleting}
                              onClick={() => cambiarEstado(proveedor)}
                            >
                              {proveedor.activo ? "Inhabilitar" : "Habilitar"}
                            </Button>
                          ) : (
                            <Badge
                              variant={
                                proveedor.activo ? "secondary" : "outline"
                              }
                            >
                              {proveedor.activo ? "Activo" : "Inhabilitado"}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <TablePagination
            total={response.total}
            page={response.page}
            pageSize={response.limit}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      <ConfirmacionDestructiva
        open={confirmandoEliminar}
        onOpenChange={setConfirmandoEliminar}
        titulo="Eliminar proveedores"
        descripcion={`Se eliminarán ${selectedRows.length} proveedor(es) sin historial. Los que tengan actividad deben inhabilitarse.`}
        requiereTipear={false}
        accionLabel="Eliminar"
        onConfirmar={confirmarEliminarSeleccion}
      />
    </div>
  );
}
