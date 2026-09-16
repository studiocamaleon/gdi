"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRightIcon,
  MailIcon,
  MapPinIcon,
  ChevronDownIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  PencilIcon,
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
import {
  Card,
  Checkbox,
  Chip,
  Dropdown,
  Label,
  Modal,
  SearchField,
  Switch,
} from "@heroui/react";
import { ChevronLeftIcon, ChevronRightIcon, TruckIcon } from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { ActionLink } from "@/components/design-system/action-link";
import { FormDialog } from "@/components/design-system/form-dialog";
import { ListMetric } from "@/components/design-system/list-metric";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import {
  useDesignScope,
  useDesignTheme,
} from "@/components/design-system/appearance";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import brand from "@/components/crm/contactos-workspace.module.css";
import listPage from "@/components/design-system/list-page.module.css";
import focus from "@/components/design-system/field-focus.module.css";
import styles from "./proveedores.module.css";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
        .join(",")
    )
    .join("\n")}`;
}

export function ProveedoresTable({
  initialResponse,
  canManage,
}: ProveedoresTableProps) {
  const scope = useDesignScope();
  const theme = useDesignTheme();
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
              : "No se pudo actualizar la lista."
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
    selected.has(proveedor.id)
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
          !proveedor.activo
        );
        if (!verInactivos && !actualizado.activo) {
          await refreshCurrentPage();
        } else {
          setResponse((current) => ({
            ...current,
            data: current.data.map((item) =>
              item.id === actualizado.id ? actualizado : item
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
            : `${actualizado.nombre} quedó inhabilitado.`
        );
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "No se pudo cambiar el estado."
        );
      }
    });
  };

  const confirmarEliminarSeleccion = () => {
    setConfirmandoEliminar(false);
    startDeleteTransition(async () => {
      const resultados = await Promise.allSettled(
        selectedRows.map((proveedor) => deleteProveedor(proveedor.id))
      );
      const borrados = resultados.filter(
        (resultado) => resultado.status === "fulfilled"
      ).length;
      const error = resultados.find(
        (resultado): resultado is PromiseRejectedResult =>
          resultado.status === "rejected"
      );
      await refreshCurrentPage();
      if (borrados > 0)
        toast.success(`${borrados} proveedor(es) eliminado(s).`);
      if (error) {
        toast.error(
          error.reason instanceof Error
            ? error.reason.message
            : "No se pudo eliminar un proveedor."
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
          `No se importó el archivo. Fila ${
            invalid.rowNumber
          }: ${invalid.errors.join(" ")}`
        );
        return;
      }
      const payloads = parsed.rows.flatMap((row) =>
        row.payload ? [row.payload] : []
      );
      try {
        const result = await importarProveedores(payloads);
        await refreshCurrentPage();
        toast.success(`Se importaron ${result.total} proveedor(es).`);
      } catch (error) {
        toast.error(
          `No se importó ninguna fila. ${
            error instanceof Error ? error.message : "Revisá el archivo."
          }`
        );
      }
    });
  };

  const pages = Math.ceil(response.total / response.limit);

  return (
    <section
      data-visual="brand"
      {...scope}
      className={`${theme} ${listPage.page} ${brand.workspace} ${styles.page}`}
    >
      <header className={listPage.header}>
        <div>
          <p className={brand.eyebrow}>Registros · Relaciones comerciales</p>
          <h1>
            Proveedores<span className={brand.titleDot}>.</span>
          </h1>
          <p className={listPage.subtitle}>
            Administrá los datos comerciales, fiscales y de pago de tus
            proveedores.
          </p>
        </div>
        <div className={styles.actions}>
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
          <Dropdown>
            <ActionButton variant="outline">
              {isImporting && <GdiSpinner />}
              {selectedRows.length > 0
                ? `Acciones (${selectedRows.length})`
                : "Acciones"}
              <ChevronDownIcon />
            </ActionButton>
            <Dropdown.Popover
              {...scope}
              className={`${theme} ${styles.menu}`}
              placement="bottom end"
            >
              <Dropdown.Menu aria-label="Acciones de proveedores">
                {canManage && (
                  <Dropdown.Item
                    id="plantilla"
                    textValue="Descargar plantilla"
                    onAction={() =>
                      downloadContactImportTemplate("proveedores")
                    }
                  >
                    <FileSpreadsheetIcon />
                    Descargar plantilla
                  </Dropdown.Item>
                )}
                {canManage && (
                  <Dropdown.Item
                    id="importar"
                    textValue="Importar proveedores"
                    isDisabled={isImporting}
                    onAction={() => fileInputRef.current?.click()}
                  >
                    <UploadIcon />
                    {isImporting ? "Importando…" : "Importar proveedores"}
                  </Dropdown.Item>
                )}
                {canManage && (
                  <Dropdown.Item
                    id="editar"
                    textValue="Editar selección"
                    isDisabled={selectedRows.length !== 1}
                    onAction={handleEditSelection}
                  >
                    <PencilIcon />
                    Editar selección
                  </Dropdown.Item>
                )}
                <Dropdown.Item
                  id="exportar"
                  textValue="Exportar selección"
                  isDisabled={selectedRows.length === 0}
                  onAction={handleExportSelection}
                >
                  <DownloadIcon />
                  Exportar selección
                </Dropdown.Item>
                {canManage && (
                  <Dropdown.Item
                    id="eliminar"
                    textValue="Eliminar selección"
                    variant="danger"
                    isDisabled={selectedRows.length === 0 || isDeleting}
                    onAction={() => setConfirmandoEliminar(true)}
                  >
                    <Trash2Icon />
                    Eliminar selección
                  </Dropdown.Item>
                )}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
          {canManage && (
            <ActionLink href="/proveedores/nuevo">
              Nuevo proveedor
              <ArrowUpRightIcon />
            </ActionLink>
          )}
        </div>
      </header>

      <div className={brand.metrics} aria-label="Resumen del listado">
        <ListMetric
          label="Proveedores"
          value={response.total}
          hint={
            debouncedSearch
              ? "Coinciden con la búsqueda"
              : verInactivos
              ? "Incluye inhabilitados"
              : "Activos en el directorio"
          }
          icon={TruckIcon}
        />
        <ListMetric
          label="Con email"
          value={proveedores.filter((item) => item.email.trim()).length}
          hint="En esta página"
          icon={MailIcon}
        />
        <ListMetric
          label="Con ubicación"
          value={proveedores.filter((item) => item.ciudad.trim()).length}
          hint="En esta página"
          icon={MapPinIcon}
        />
      </div>
      <Card className={listPage.results}>
        <Card.Header className={brand.directoryHeader}>
          <div className={brand.directoryTitle}>
            <span className={brand.directoryIcon} aria-hidden>
              <TruckIcon />
            </span>
            <div>
              <Card.Title className={brand.directoryHeading}>
                Directorio de proveedores
              </Card.Title>
              <Card.Description>
                Datos, contactos y estado de cada proveedor.
              </Card.Description>
            </div>
          </div>
        </Card.Header>
        <div className={listPage.toolbar}>
          <SearchField
            aria-label="Buscar proveedores"
            value={search}
            onChange={setSearch}
            className={styles.search}
          >
            <SearchField.Group
              className={`${listPage.searchGroup} ${focus.singleBorder}`}
            >
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Nombre, CUIT, teléfono, email o ciudad" />
              <SearchField.ClearButton aria-label="Limpiar búsqueda" />
            </SearchField.Group>
          </SearchField>
          <div className={styles.toolbarEnd}>
            <span className={styles.resultCount} role="status">
              {isLoading ? (
                <>
                  <GdiSpinner />
                  Actualizando…
                </>
              ) : (
                <>
                  <TruckIcon size={15} />
                  {response.total}{" "}
                  {response.total === 1 ? "proveedor" : "proveedores"}
                </>
              )}
            </span>
            <Switch
              size="sm"
              isSelected={verInactivos}
              onChange={(checked) => {
                setVerInactivos(checked);
                setPage(1);
              }}
            >
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                <Label>Ver inhabilitados</Label>
              </Switch.Content>
            </Switch>
          </div>
        </div>
        {selectedRows.length > 0 && (
          <div className={styles.selection}>
            <span>{selectedRows.length} proveedor(es) seleccionado(s)</span>
            <ActionButton
              variant="ghost"
              onPress={() => setSelected(new Set())}
            >
              Limpiar selección
            </ActionButton>
          </div>
        )}
        <div aria-busy={isLoading}>
          {proveedores.length === 0 ? (
            <Empty className={brand.empty}>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchXIcon />
                </EmptyMedia>
                <EmptyTitle>No encontramos proveedores</EmptyTitle>
                <EmptyDescription>
                  {debouncedSearch
                    ? "Probá con otro nombre, documento, teléfono o ciudad."
                    : "Todavía no hay proveedores para mostrar con este filtro."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table
              className={`${styles.table} ${brand.table} ${styles.providersTable}`}
            >
              <TableHeader>
                <TableRow>
                  <TableHead className={styles.checkCell}>
                    <Checkbox
                      aria-label="Seleccionar todos los proveedores de esta página"
                      isSelected={allSelected}
                      isIndeterminate={!allSelected && selectedRows.length > 0}
                      onChange={(checked) =>
                        setSelected(
                          checked
                            ? new Set(
                                proveedores.map((proveedor) => proveedor.id)
                              )
                            : new Set()
                        )
                      }
                    >
                      <Checkbox.Content>
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                      </Checkbox.Content>
                    </Checkbox>
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
                      <TableCell className={styles.checkCell}>
                        <Checkbox
                          aria-label={`Seleccionar a ${proveedor.nombre}`}
                          isSelected={isSelected}
                          onChange={(checked) =>
                            handleSelect(proveedor.id, checked)
                          }
                        >
                          <Checkbox.Content>
                            <Checkbox.Control>
                              <Checkbox.Indicator />
                            </Checkbox.Control>
                          </Checkbox.Content>
                        </Checkbox>
                      </TableCell>
                      <TableCell>
                        <NavLink
                          href={`/proveedores/${proveedor.id}`}
                          className={styles.providerName}
                        >
                          <span
                            className={brand.identityIcon}
                            aria-hidden="true"
                          >
                            <TruckIcon />
                          </span>
                          <strong>{proveedor.nombre}</strong>
                          <ArrowUpRightIcon
                            className={brand.rowArrow}
                            aria-hidden
                          />
                        </NavLink>
                      </TableCell>
                      <TableCell>{proveedor.cuit || "—"}</TableCell>
                      <TableCell>{proveedor.contacto || "—"}</TableCell>
                      <TableCell>
                        <span className={brand.contactText}>
                          {proveedor.email && <MailIcon aria-hidden />}
                          {proveedor.email || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={brand.contactText}>
                          {proveedor.ciudad && <MapPinIcon aria-hidden />}
                          {proveedor.ciudad || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="sm"
                          color={
                            proveedor.datosPagoCompletos ? "success" : "warning"
                          }
                          variant="soft"
                        >
                          {proveedor.datosPagoCompletos
                            ? "Completos"
                            : "Incompletos"}
                        </Chip>
                      </TableCell>
                      <TableCell>
                        <div className={styles.rowActions}>
                          <Chip
                            size="sm"
                            color={proveedor.activo ? "success" : "default"}
                            variant={proveedor.activo ? "soft" : "secondary"}
                          >
                            <span className={styles.statusDot} />
                            {proveedor.activo ? "Activo" : "Inhabilitado"}
                          </Chip>
                          {canManage && (
                            <ActionButton
                              variant="ghost"
                              isDisabled={isDeleting}
                              onPress={() => cambiarEstado(proveedor)}
                            >
                              {proveedor.activo ? "Inhabilitar" : "Habilitar"}
                            </ActionButton>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
        {pages > 1 && (
          <footer className={listPage.pager}>
            <span>
              {(response.page - 1) * response.limit + 1}–
              {Math.min(response.page * response.limit, response.total)} de{" "}
              {response.total}
            </span>
            <div className={styles.actions}>
              <ActionButton
                variant="outline"
                isIconOnly
                aria-label="Página anterior"
                isDisabled={response.page <= 1}
                onPress={() => setPage(response.page - 1)}
              >
                <ChevronLeftIcon />
              </ActionButton>
              <span>
                {response.page} / {pages}
              </span>
              <ActionButton
                variant="outline"
                isIconOnly
                aria-label="Página siguiente"
                isDisabled={response.page >= pages}
                onPress={() => setPage(response.page + 1)}
              >
                <ChevronRightIcon />
              </ActionButton>
            </div>
          </footer>
        )}
      </Card>
      <FormDialog
        className={brand.dialog}
        isOpen={confirmandoEliminar}
        onOpenChange={setConfirmandoEliminar}
        title="Eliminar proveedores"
        description={`Se eliminarán ${selectedRows.length} proveedor(es) sin historial. Los que tengan actividad deben inhabilitarse.`}
      >
        <Modal.Footer className={styles.dialogFooter}>
          <ActionButton
            variant="outline"
            onPress={() => setConfirmandoEliminar(false)}
          >
            Cancelar
          </ActionButton>
          <ActionButton variant="danger" onPress={confirmarEliminarSeleccion}>
            <Trash2Icon />
            Eliminar
          </ActionButton>
        </Modal.Footer>
      </FormDialog>
    </section>
  );
}
