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
  UploadIcon,
  UserCheckIcon,
  UserMinusIcon,
} from "lucide-react";
import { toast } from "sonner";

import { NavLink } from "@/components/navigation/nav-link";
import { useNavigationFeedback } from "@/components/navigation/navigation-feedback";
import {
  importarEmpleados,
  listEmpleados,
  setEmpleadosActivos,
  type EmpleadosListResponse,
} from "@/lib/empleados-api";
import type { EmpleadoResumen } from "@/lib/empleados";
import {
  downloadEmpleadosImportTemplate,
  parseEmpleadosImportCsv,
} from "@/lib/empleados-importacion";
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

type EmpleadosTableProps = {
  initialResponse: EmpleadosListResponse;
  canManage: boolean;
};

function safeSpreadsheetCell(value: string) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function buildCsv(empleados: EmpleadoResumen[]) {
  const rows = [
    ["Nombre completo", "Sector", "Ocupación", "Email", "Ciudad", "Acceso", "Estado"],
    ...empleados.map((empleado) => [
      empleado.nombreCompleto,
      empleado.sector,
      empleado.ocupacion,
      empleado.email,
      empleado.ciudad,
      empleado.usuarioSistema ? "Habilitado" : "Sin acceso",
      empleado.activo ? "Activo" : "Baja",
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

export function EmpleadosTable({
  initialResponse,
  canManage,
}: EmpleadosTableProps) {
  const router = useRouter();
  const { startNavigation } = useNavigationFeedback();
  const [response, setResponse] = React.useState(initialResponse);
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(initialResponse.page);
  const [verInactivos, setVerInactivos] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [confirmandoBaja, setConfirmandoBaja] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [isChangingState, startStateTransition] = React.useTransition();
  const [isImporting, startImportTransition] = React.useTransition();

  React.useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const refresh = React.useCallback(async () => {
    const next = await listEmpleados({
      q: debouncedSearch,
      page,
      limit: initialResponse.limit,
      incluirInactivos: verInactivos,
    });
    setResponse(next);
    setSelected(new Set());
  }, [debouncedSearch, initialResponse.limit, page, verInactivos]);

  React.useEffect(() => {
    let active = true;
    setIsLoading(true);
    listEmpleados({
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
          toast.error(error instanceof Error ? error.message : "No se pudo actualizar la lista.");
        }
      })
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [debouncedSearch, initialResponse.limit, page, verInactivos]);

  const empleados = response.data;
  const selectedRows = empleados.filter((empleado) => selected.has(empleado.id));
  const allSelected =
    empleados.length > 0 && empleados.every((empleado) => selected.has(empleado.id));

  const handleSelect = (id: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleOpenSelection = () => {
    if (selectedRows.length !== 1) return;
    const href = `/empleados/${selectedRows[0].id}`;
    startNavigation(href);
    router.push(href);
  };

  const handleExport = () => {
    if (selectedRows.length === 0) return;
    const url = URL.createObjectURL(
      new Blob([buildCsv(selectedRows)], { type: "text/csv;charset=utf-8;" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "empleados-seleccion.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const cambiarEstado = (ids: string[], activo: boolean) => {
    startStateTransition(async () => {
      try {
        await setEmpleadosActivos(ids, activo);
        await refresh();
        router.refresh();
        toast.success(
          activo
            ? `${ids.length} empleado(s) reactivado(s).`
            : `${ids.length} empleado(s) dado(s) de baja.`,
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo cambiar el estado.");
      }
    });
  };

  const handleImportFile = (file: File | undefined) => {
    if (!file) return;
    startImportTransition(async () => {
      try {
        const parsed = parseEmpleadosImportCsv(await file.text());
        if (parsed.fatalError) throw new Error(parsed.fatalError);
        const invalid = parsed.rows.find((row) => row.errors.length > 0);
        if (invalid) {
          throw new Error(`Fila ${invalid.rowNumber}: ${invalid.errors.join(" ")}`);
        }
        const payloads = parsed.rows.flatMap((row) => (row.payload ? [row.payload] : []));
        if (payloads.length === 0) throw new Error("No hay empleados válidos para importar.");
        const result = await importarEmpleados(payloads);
        await refresh();
        router.refresh();
        toast.success(`Se importaron ${result.total} empleado(s).`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo importar el archivo.");
      }
    });
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardHeader className="gap-4 border-b border-border/70">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <CardTitle>Empleados</CardTitle>
              <CardDescription>
                Legajos activos e históricos. Dar de baja conserva ventas,
                producción y egresos asociados.
              </CardDescription>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                placeholder="Buscar por nombre, sector, email o ciudad..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full sm:w-80"
              />
              <Field orientation="horizontal" className="w-fit">
                <Switch
                  id="empleados-inactivos"
                  checked={verInactivos}
                  onCheckedChange={(checked) => {
                    setVerInactivos(checked);
                    setPage(1);
                  }}
                />
                <FieldLabel htmlFor="empleados-inactivos">Mostrar bajas</FieldLabel>
              </Field>
            </div>
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
                <DropdownMenuTrigger render={<Button variant="sidebar" className="w-full sm:w-auto" />}>
                  {selected.size > 0 ? `Acciones (${selected.size})` : "Acciones"}
                  <ChevronDownIcon data-icon="inline-end" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canManage ? (
                    <DropdownMenuGroup>
                      <DropdownMenuItem onClick={downloadEmpleadosImportTemplate}>
                        <FileSpreadsheetIcon />
                        Descargar plantilla
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={isImporting}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <UploadIcon />
                        {isImporting ? "Importando..." : "Importar empleados"}
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  ) : null}
                  {canManage ? <DropdownMenuSeparator /> : null}
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      disabled={selectedRows.length !== 1}
                      onClick={handleOpenSelection}
                    >
                      <PencilIcon />
                      {canManage ? "Editar selección" : "Ver ficha"}
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={selectedRows.length === 0} onClick={handleExport}>
                      <DownloadIcon />
                      Exportar selección
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  {canManage && selectedRows.length > 0 ? (
                    <>
                      <DropdownMenuSeparator />
                      {selectedRows.every((item) => !item.activo) ? (
                        <DropdownMenuItem
                          disabled={isChangingState}
                          onClick={() => cambiarEstado(selectedRows.map((item) => item.id), true)}
                        >
                          <UserCheckIcon />
                          Reactivar selección
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={isChangingState}
                          onClick={() => setConfirmandoBaja(true)}
                        >
                          <UserMinusIcon />
                          Dar de baja selección
                        </DropdownMenuItem>
                      )}
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
              {canManage ? (
                <Button
                  variant="brand"
                  className="w-full sm:w-auto"
                  nativeButton={false}
                  render={<NavLink href="/empleados/nuevo" />}
                >
                  <PlusIcon data-icon="inline-start" />
                  Nuevo empleado
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-0">
          {empleados.length === 0 ? (
            <Empty className="border-0 py-14">
              <EmptyHeader>
                <EmptyMedia variant="icon"><SearchXIcon /></EmptyMedia>
                <EmptyTitle>No encontramos empleados</EmptyTitle>
                <EmptyDescription>
                  {search || verInactivos
                    ? "Probá otra búsqueda o cambiá el filtro de bajas."
                    : "Creá el primer legajo para asignarlo a ventas o producción."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 px-4">
                    <Checkbox
                      aria-label="Seleccionar todos los empleados visibles"
                      checked={allSelected}
                      onCheckedChange={(checked) =>
                        setSelected(checked ? new Set(empleados.map((item) => item.id)) : new Set())
                      }
                    />
                  </TableHead>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead>Ocupación</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Ciudad</TableHead>
                  <TableHead>Acceso</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className={isLoading ? "opacity-60" : undefined}>
                {empleados.map((empleado) => (
                  <TableRow key={empleado.id} data-state={selected.has(empleado.id) ? "selected" : undefined}>
                    <TableCell className="px-4">
                      <Checkbox
                        aria-label={`Seleccionar a ${empleado.nombreCompleto}`}
                        checked={selected.has(empleado.id)}
                        onCheckedChange={(checked) => handleSelect(empleado.id, checked === true)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <NavLink href={`/empleados/${empleado.id}`} className="underline-offset-4 hover:underline">
                        {empleado.nombreCompleto}
                      </NavLink>
                    </TableCell>
                    <TableCell>{empleado.sector}</TableCell>
                    <TableCell>{empleado.ocupacion || "-"}</TableCell>
                    <TableCell>{empleado.email}</TableCell>
                    <TableCell>{empleado.ciudad || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={empleado.usuarioSistema ? "secondary" : "outline"}>
                        {empleado.usuarioSistema ? "Habilitado" : "Sin acceso"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={empleado.activo ? "secondary" : "destructive"}>
                        {empleado.activo ? "Activo" : "Baja"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
        open={confirmandoBaja}
        onOpenChange={(open) => !open && setConfirmandoBaja(false)}
        titulo="Dar de baja empleados"
        descripcion={`Se darán de baja ${selectedRows.filter((item) => item.activo).length} empleado(s). Sus ventas, trabajos y egresos se conservarán; si tenían acceso, se revocará.`}
        requiereTipear={false}
        accionLabel="Dar de baja"
        onConfirmar={() => {
          setConfirmandoBaja(false);
          cambiarEstado(selectedRows.filter((item) => item.activo).map((item) => item.id), false);
        }}
      />
    </div>
  );
}
