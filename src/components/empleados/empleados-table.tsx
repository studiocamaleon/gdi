"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDownIcon,
  DownloadIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";

import { deleteEmpleado } from "@/lib/empleados-api";
import { EmpleadoDetalle } from "@/lib/empleados";
import { NavLink } from "@/components/navigation/nav-link";
import { useNavigationFeedback } from "@/components/navigation/navigation-feedback";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type EmpleadosTableProps = {
  initialEmpleados: EmpleadoDetalle[];
};

function buildCsv(empleados: EmpleadoDetalle[]) {
  const rows = [
    [
      "Nombre completo",
      "Sector",
      "Ocupacion",
      "Email principal",
      "Ciudad",
      "Usuario del sistema",
    ],
    ...empleados.map((empleado) => [
      empleado.nombreCompleto,
      empleado.sector,
      empleado.ocupacion,
      empleado.email,
      empleado.ciudad,
      empleado.usuarioSistema ? "Si" : "No",
    ]),
  ];

  return rows
    .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
    .join("\n");
}

export function EmpleadosTable({ initialEmpleados }: EmpleadosTableProps) {
  const router = useRouter();
  const { startNavigation } = useNavigationFeedback();
  const [empleados, setEmpleados] = React.useState(initialEmpleados);
  const [selectedEmpleados, setSelectedEmpleados] = React.useState<Set<string>>(
    new Set(),
  );
  const [isDeleting, startDeleteTransition] = React.useTransition();

  const selectedCount = selectedEmpleados.size;
  const allSelected = empleados.length > 0 && selectedCount === empleados.length;
  const selectedRows = empleados.filter((empleado) =>
    selectedEmpleados.has(empleado.id),
  );

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEmpleados(new Set(empleados.map((empleado) => empleado.id)));
      return;
    }

    setSelectedEmpleados(new Set());
  };

  const handleSelectEmpleado = (empleadoId: string, checked: boolean) => {
    const nextSelection = new Set(selectedEmpleados);

    if (checked) {
      nextSelection.add(empleadoId);
    } else {
      nextSelection.delete(empleadoId);
    }

    setSelectedEmpleados(nextSelection);
  };

  const handleEditSelection = () => {
    if (selectedRows.length !== 1) {
      return;
    }

    startNavigation(`/empleados/${selectedRows[0].id}`);
    router.push(`/empleados/${selectedRows[0].id}`);
  };

  const handleExportSelection = () => {
    if (selectedRows.length === 0) {
      return;
    }

    const blob = new Blob([buildCsv(selectedRows)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "empleados-seleccion.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteSelection = () => {
    if (selectedRows.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      `Se eliminaran ${selectedRows.length} empleado(s). Esta accion no se puede deshacer.`,
    );

    if (!confirmed) {
      return;
    }

    startDeleteTransition(async () => {
      await Promise.all(selectedRows.map((empleado) => deleteEmpleado(empleado.id)));
      setEmpleados((current) =>
        current.filter((empleado) => !selectedEmpleados.has(empleado.id)),
      );
      setSelectedEmpleados(new Set());
      router.refresh();
    });
  };

  return (
    <div className="flex flex-1 flex-col p-4 md:p-6">
      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardHeader className="gap-4 border-b border-border/70">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <CardTitle>Empleados</CardTitle>
              <CardDescription>
                Administra la base de empleados, su acceso al sistema y las
                condiciones operativas asociadas a cada ficha.
              </CardDescription>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              {selectedCount > 0 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="sidebar" className="w-full sm:w-auto" />
                    }
                  >
                    Acciones ({selectedCount})
                    <ChevronDownIcon data-icon="inline-end" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        disabled={selectedRows.length !== 1}
                        onClick={handleEditSelection}
                      >
                        <PencilIcon />
                        Editar seleccion
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleExportSelection}>
                        <DownloadIcon />
                        Exportar seleccion
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={isDeleting}
                      onClick={handleDeleteSelection}
                    >
                      <Trash2Icon />
                      Eliminar seleccion
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button variant="sidebar" className="w-full sm:w-auto" disabled>
                  Acciones
                  <ChevronDownIcon data-icon="inline-end" />
                </Button>
              )}

              <Button
                variant="brand"
                className="w-full sm:w-auto"
                nativeButton={false}
                render={<NavLink href="/empleados/nuevo" />}
              >
                <PlusIcon data-icon="inline-start" />
                Nuevo empleado
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 px-4">
                  <Checkbox
                    aria-label="Seleccionar todos los empleados"
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Empleado</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead>Ocupacion</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Ciudad</TableHead>
                <TableHead className="w-[170px]">Usuario del sistema</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {empleados.map((empleado) => {
                const isSelected = selectedEmpleados.has(empleado.id);

                return (
                  <TableRow
                    key={empleado.id}
                    data-state={isSelected ? "selected" : undefined}
                  >
                    <TableCell className="px-4">
                      <Checkbox
                        aria-label={`Seleccionar a ${empleado.nombreCompleto}`}
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          handleSelectEmpleado(empleado.id, checked === true)
                        }
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <NavLink
                        href={`/empleados/${empleado.id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {empleado.nombreCompleto}
                      </NavLink>
                    </TableCell>
                    <TableCell>{empleado.sector}</TableCell>
                    <TableCell>{empleado.ocupacion || "-"}</TableCell>
                    <TableCell>{empleado.email}</TableCell>
                    <TableCell>{empleado.ciudad || "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={empleado.usuarioSistema ? "secondary" : "outline"}
                      >
                        {empleado.usuarioSistema ? "Habilitado" : "Sin acceso"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
