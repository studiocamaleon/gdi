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

import { NavLink } from "@/components/navigation/nav-link";
import { useNavigationFeedback } from "@/components/navigation/navigation-feedback";
import { deleteCliente } from "@/lib/clientes-api";
import { ClienteDetalle } from "@/lib/clientes";
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

type ClientesTableProps = {
  initialClientes: ClienteDetalle[];
};

function buildCsv(clientes: ClienteDetalle[]) {
  const rows = [
    ["Nombre", "Razon social", "Contacto", "Email", "Ciudad"],
    ...clientes.map((cliente) => [
      cliente.nombre,
      cliente.razonSocial,
      cliente.contacto,
      cliente.email,
      cliente.ciudad,
    ]),
  ];

  return rows
    .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
    .join("\n");
}

export function ClientesTable({ initialClientes }: ClientesTableProps) {
  const router = useRouter();
  const { startNavigation } = useNavigationFeedback();
  const [clientes, setClientes] = React.useState(initialClientes);
  const [selectedClientes, setSelectedClientes] = React.useState<Set<string>>(
    new Set(),
  );
  const [isDeleting, startDeleteTransition] = React.useTransition();

  const selectedCount = selectedClientes.size;
  const allSelected = clientes.length > 0 && selectedCount === clientes.length;
  const selectedRows = clientes.filter((cliente) => selectedClientes.has(cliente.id));

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedClientes(new Set(clientes.map((cliente) => cliente.id)));
      return;
    }

    setSelectedClientes(new Set());
  };

  const handleSelectCliente = (clienteId: string, checked: boolean) => {
    const nextSelection = new Set(selectedClientes);

    if (checked) {
      nextSelection.add(clienteId);
    } else {
      nextSelection.delete(clienteId);
    }

    setSelectedClientes(nextSelection);
  };

  const handleEditSelection = () => {
    if (selectedRows.length !== 1) {
      return;
    }

    startNavigation(`/clientes/${selectedRows[0].id}`);
    router.push(`/clientes/${selectedRows[0].id}`);
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
    link.download = "clientes-seleccion.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteSelection = () => {
    if (selectedRows.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      `Se eliminaran ${selectedRows.length} cliente(s). Esta accion no se puede deshacer.`,
    );

    if (!confirmed) {
      return;
    }

    startDeleteTransition(async () => {
      await Promise.all(selectedRows.map((cliente) => deleteCliente(cliente.id)));
      setClientes((current) =>
        current.filter((cliente) => !selectedClientes.has(cliente.id)),
      );
      setSelectedClientes(new Set());
      router.refresh();
    });
  };

  return (
    <div className="flex flex-1 flex-col p-4 md:p-6">
      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardHeader className="gap-4 border-b border-border/70">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <CardTitle>Clientes</CardTitle>
              <CardDescription>
                Administra la base de clientes del sistema y prepara la
                estructura para futuras altas, ediciones y acciones masivas.
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
                render={<NavLink href="/clientes/nuevo" />}
              >
                <PlusIcon data-icon="inline-start" />
                Nuevo cliente
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
                    aria-label="Seleccionar todos los clientes"
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Razon social</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Ciudad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientes.map((cliente) => {
                const isSelected = selectedClientes.has(cliente.id);

                return (
                  <TableRow
                    key={cliente.id}
                    data-state={isSelected ? "selected" : undefined}
                  >
                    <TableCell className="px-4">
                      <Checkbox
                        aria-label={`Seleccionar a ${cliente.nombre}`}
                        checked={isSelected}
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
                    </TableCell>
                    <TableCell>{cliente.razonSocial}</TableCell>
                    <TableCell>{cliente.contacto}</TableCell>
                    <TableCell>{cliente.email}</TableCell>
                    <TableCell>{cliente.ciudad}</TableCell>
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
