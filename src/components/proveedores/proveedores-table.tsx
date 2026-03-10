"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDownIcon,
  DownloadIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";

import { deleteProveedor } from "@/lib/proveedores-api";
import { ProveedorDetalle } from "@/lib/proveedores";
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

type ProveedoresTableProps = {
  initialProveedores: ProveedorDetalle[];
};

function buildCsv(proveedores: ProveedorDetalle[]) {
  const rows = [
    ["Nombre", "Razon social", "Contacto", "Email", "Ciudad"],
    ...proveedores.map((proveedor) => [
      proveedor.nombre,
      proveedor.razonSocial,
      proveedor.contacto,
      proveedor.email,
      proveedor.ciudad,
    ]),
  ];

  return rows
    .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
    .join("\n");
}

export function ProveedoresTable({ initialProveedores }: ProveedoresTableProps) {
  const router = useRouter();
  const [proveedores, setProveedores] = React.useState(initialProveedores);
  const [selectedProveedores, setSelectedProveedores] = React.useState<Set<string>>(
    new Set(),
  );
  const [isDeleting, startDeleteTransition] = React.useTransition();

  const selectedCount = selectedProveedores.size;
  const allSelected = proveedores.length > 0 && selectedCount === proveedores.length;
  const selectedRows = proveedores.filter((proveedor) => selectedProveedores.has(proveedor.id));

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProveedores(new Set(proveedores.map((proveedor) => proveedor.id)));
      return;
    }

    setSelectedProveedores(new Set());
  };

  const handleSelectProveedor = (proveedorId: string, checked: boolean) => {
    const nextSelection = new Set(selectedProveedores);

    if (checked) {
      nextSelection.add(proveedorId);
    } else {
      nextSelection.delete(proveedorId);
    }

    setSelectedProveedores(nextSelection);
  };

  const handleEditSelection = () => {
    if (selectedRows.length !== 1) {
      return;
    }

    router.push(`/proveedores/${selectedRows[0].id}`);
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
    link.download = "proveedores-seleccion.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteSelection = () => {
    if (selectedRows.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      `Se eliminaran ${selectedRows.length} proveedor(s). Esta accion no se puede deshacer.`,
    );

    if (!confirmed) {
      return;
    }

    startDeleteTransition(async () => {
      await Promise.all(selectedRows.map((proveedor) => deleteProveedor(proveedor.id)));
      setProveedores((current) =>
        current.filter((proveedor) => !selectedProveedores.has(proveedor.id)),
      );
      setSelectedProveedores(new Set());
      router.refresh();
    });
  };

  return (
    <div className="flex flex-1 flex-col p-4 md:p-6">
      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardHeader className="gap-4 border-b border-border/70">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <CardTitle>Proveedores</CardTitle>
              <CardDescription>
                Administra la base de proveedores del sistema y prepara la
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
                render={<Link href="/proveedores/nuevo" />}
              >
                <PlusIcon data-icon="inline-start" />
                Nuevo proveedor
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
                    aria-label="Seleccionar todos los proveedores"
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Razon social</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Ciudad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proveedores.map((proveedor) => {
                const isSelected = selectedProveedores.has(proveedor.id);

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
                          handleSelectProveedor(proveedor.id, checked === true)
                        }
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/proveedores/${proveedor.id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {proveedor.nombre}
                      </Link>
                    </TableCell>
                    <TableCell>{proveedor.razonSocial}</TableCell>
                    <TableCell>{proveedor.contacto}</TableCell>
                    <TableCell>{proveedor.email}</TableCell>
                    <TableCell>{proveedor.ciudad}</TableCell>
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
