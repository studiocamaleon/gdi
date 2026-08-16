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
  deleteCliente,
  importarClientes,
  listClientes,
  setClienteActivo,
  type ClientesListResponse,
} from "@/lib/clientes-api";
import { type ClienteDetalle } from "@/lib/clientes";
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

type ClientesTableProps = {
  initialResponse: ClientesListResponse;
  canManage: boolean;
};

function safeSpreadsheetCell(value: string) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function buildCsv(clientes: ClienteDetalle[]) {
  const rows = [
    ["Nombre", "Razón social", "Contacto", "Email", "Ciudad"],
    ...clientes.map((cliente) => [
      cliente.nombre,
      cliente.razonSocial,
      cliente.contacto,
      cliente.email,
      cliente.ciudad,
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

export function ClientesTable({
  initialResponse,
  canManage,
}: ClientesTableProps) {
  const router = useRouter();
  const { startNavigation } = useNavigationFeedback();
  const [response, setResponse] = React.useState(initialResponse);
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(initialResponse.page);
  const [verInactivos, setVerInactivos] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [confirmandoEliminar, setConfirmandoEliminar] = React.useState(false);
  const [selectedClientes, setSelectedClientes] = React.useState<Set<string>>(
    new Set(),
  );
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
    listClientes({
      q: debouncedSearch,
      page,
      limit: initialResponse.limit,
      incluirInactivos: verInactivos,
    })
      .then((next) => {
        if (!active) return;
        setResponse(next);
        setSelectedClientes(new Set());
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

  const clientes = response.data;
  const selectedRows = clientes.filter((cliente) =>
    selectedClientes.has(cliente.id),
  );
  const allSelected =
    clientes.length > 0 &&
    clientes.every((cliente) => selectedClientes.has(cliente.id));

  const handleSelectAll = (checked: boolean) => {
    setSelectedClientes(
      checked ? new Set(clientes.map((cliente) => cliente.id)) : new Set(),
    );
  };

  const handleSelectCliente = (clienteId: string, checked: boolean) => {
    setSelectedClientes((current) => {
      const next = new Set(current);
      if (checked) next.add(clienteId);
      else next.delete(clienteId);
      return next;
    });
  };

  const refreshCurrentPage = React.useCallback(async () => {
    const next = await listClientes({
      q: debouncedSearch,
      page,
      limit: initialResponse.limit,
      incluirInactivos: verInactivos,
    });
    setResponse(next);
    setSelectedClientes(new Set());
  }, [debouncedSearch, initialResponse.limit, page, verInactivos]);

  const handleEditSelection = () => {
    if (selectedRows.length !== 1) return;
    const href = `/clientes/${selectedRows[0].id}`;
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
    link.download = "clientes-seleccion.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const cambiarEstado = (cliente: ClienteDetalle) => {
    startDeleteTransition(async () => {
      try {
        const actualizado = await setClienteActivo(cliente.id, !cliente.activo);
        if (!verInactivos && !actualizado.activo) {
          await refreshCurrentPage();
        } else {
          setResponse((current) => ({
            ...current,
            data: current.data.map((item) =>
              item.id === actualizado.id ? actualizado : item,
            ),
          }));
          setSelectedClientes((current) => {
            const next = new Set(current);
            next.delete(cliente.id);
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
        selectedRows.map((cliente) => deleteCliente(cliente.id)),
      );
      const borrados = resultados.filter(
        (resultado) => resultado.status === "fulfilled",
      ).length;
      const errores = resultados
        .filter(
          (resultado): resultado is PromiseRejectedResult =>
            resultado.status === "rejected",
        )
        .map((resultado) =>
          resultado.reason instanceof Error
            ? resultado.reason.message
            : "No se pudo eliminar un cliente.",
        );
      await refreshCurrentPage();
      if (borrados > 0) toast.success(`${borrados} cliente(s) eliminado(s).`);
      if (errores.length > 0) toast.error(errores[0]);
    });
  };

  const handleImportFile = (file: File | undefined) => {
    if (!file) return;
    startImportTransition(async () => {
      const parsed = parseContactImportCsv(await file.text(), "clientes");
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
        const result = await importarClientes(payloads);
        await refreshCurrentPage();
        toast.success(`Se importaron ${result.total} cliente(s).`);
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
                Clientes
              </CardTitle>
              <CardDescription>
                Administrá los datos comerciales, fiscales y de contacto de tus
                clientes.
              </CardDescription>
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <Field className="min-w-0 lg:w-80">
                <FieldLabel htmlFor="clientes-search" className="sr-only">
                  Buscar clientes
                </FieldLabel>
                <Input
                  id="clientes-search"
                  placeholder="Nombre, DNI, CUIT, teléfono, email o ciudad"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </Field>
              <Field orientation="horizontal" className="w-auto">
                <Switch
                  id="clientes-inactivos"
                  aria-label="Mostrar también clientes inhabilitados"
                  checked={verInactivos}
                  onCheckedChange={(checked) => {
                    setVerInactivos(checked);
                    setPage(1);
                  }}
                />
                <FieldLabel
                  htmlFor="clientes-inactivos"
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
                            downloadContactImportTemplate("clientes")
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
                          {isImporting ? "Importando…" : "Importar clientes"}
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
                    render={<NavLink href="/clientes/nuevo" />}
                  >
                    <PlusIcon data-icon="inline-start" />
                    Nuevo cliente
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-0" aria-busy={isLoading}>
          {clientes.length === 0 ? (
            <Empty className="min-h-72 border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchXIcon />
                </EmptyMedia>
                <EmptyTitle>No encontramos clientes</EmptyTitle>
                <EmptyDescription>
                  {debouncedSearch
                    ? "Probá con otro nombre, documento, teléfono o ciudad."
                    : "Todavía no hay clientes para mostrar con este filtro."}
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
                        aria-label="Seleccionar todos los clientes de esta página"
                        checked={allSelected}
                        onCheckedChange={(checked) =>
                          handleSelectAll(checked === true)
                        }
                      />
                    </TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Razón social</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Ciudad</TableHead>
                    <TableHead className="text-right">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientes.map((cliente) => {
                    const selected = selectedClientes.has(cliente.id);
                    return (
                      <TableRow
                        key={cliente.id}
                        data-state={selected ? "selected" : undefined}
                      >
                        <TableCell className="px-4">
                          <Checkbox
                            aria-label={`Seleccionar a ${cliente.nombre}`}
                            checked={selected}
                            onCheckedChange={(checked) =>
                              handleSelectCliente(cliente.id, checked === true)
                            }
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <NavLink
                            href={`/clientes/${cliente.id}`}
                            className="underline-offset-4 hover:underline"
                          >
                            {cliente.nombre}
                          </NavLink>
                          {!cliente.activo ? (
                            <Badge variant="outline" className="ml-2">
                              Inhabilitado
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell>{cliente.razonSocial || "—"}</TableCell>
                        <TableCell>{cliente.contacto || "—"}</TableCell>
                        <TableCell>{cliente.email || "—"}</TableCell>
                        <TableCell>{cliente.ciudad || "—"}</TableCell>
                        <TableCell className="text-right">
                          {canManage ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={isDeleting}
                              onClick={() => cambiarEstado(cliente)}
                            >
                              {cliente.activo ? "Inhabilitar" : "Habilitar"}
                            </Button>
                          ) : (
                            <Badge
                              variant={cliente.activo ? "secondary" : "outline"}
                            >
                              {cliente.activo ? "Activo" : "Inhabilitado"}
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
        titulo="Eliminar clientes"
        descripcion={`Se eliminarán ${selectedRows.length} cliente(s) sin historial. Esta acción no se puede deshacer.`}
        requiereTipear={false}
        accionLabel="Eliminar"
        onConfirmar={confirmarEliminarSeleccion}
      />
    </div>
  );
}
