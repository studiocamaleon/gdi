"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UsersRoundIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  PencilIcon,
  ArrowUpRightIcon,
  BriefcaseBusinessIcon,
  MailIcon,
  MapPinIcon,
  ShieldCheckIcon,
  UserRoundIcon,
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
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { ActionButton } from "@/components/design-system/action-button";
import { ActionLink } from "@/components/design-system/action-link";
import { FormDialog } from "@/components/design-system/form-dialog";
import { ListMetric } from "@/components/design-system/list-metric";
import {
  useDesignScope,
  useDesignTheme,
} from "@/components/design-system/appearance";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import brand from "@/components/crm/contactos-workspace.module.css";
import listPage from "@/components/design-system/list-page.module.css";
import focus from "@/components/design-system/field-focus.module.css";
import styles from "./empleados.module.css";

type EmpleadosTableProps = {
  initialResponse: EmpleadosListResponse;
  canManage: boolean;
};

function safeSpreadsheetCell(value: string) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function buildCsv(empleados: EmpleadoResumen[]) {
  const rows = [
    [
      "Nombre completo",
      "Sector",
      "Ocupación",
      "Email",
      "Ciudad",
      "Acceso",
      "Estado",
    ],
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

  const empleados = response.data;
  const pages = Math.max(1, Math.ceil(response.total / response.limit));
  const selectedRows = empleados.filter((empleado) =>
    selected.has(empleado.id),
  );
  const allSelected =
    empleados.length > 0 &&
    empleados.every((empleado) => selected.has(empleado.id));

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
        toast.error(
          error instanceof Error
            ? error.message
            : "No se pudo cambiar el estado.",
        );
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
          throw new Error(
            `Fila ${invalid.rowNumber}: ${invalid.errors.join(" ")}`,
          );
        }
        const payloads = parsed.rows.flatMap((row) =>
          row.payload ? [row.payload] : [],
        );
        if (payloads.length === 0)
          throw new Error("No hay empleados válidos para importar.");
        const result = await importarEmpleados(payloads);
        await refresh();
        router.refresh();
        toast.success(`Se importaron ${result.total} empleado(s).`);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "No se pudo importar el archivo.",
        );
      }
    });
  };

  return (
    <section
      {...scope}
      data-visual="brand"
      className={`${theme} ${listPage.page} ${styles.page}`}
    >
      <header className={listPage.header}>
        <div>
          <p className={brand.eyebrow}>Registros · Personas y equipo</p>
          <h1>
            Empleados<span className={brand.titleDot}>.</span>
          </h1>
          <p className={listPage.subtitle}>
            El equipo detrás de cada trabajo. Legajos, contacto y datos
            laborales en un solo lugar.
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
              {selected.size > 0 ? `Acciones (${selected.size})` : "Acciones"}
              <ChevronDownIcon />
            </ActionButton>
            <Dropdown.Popover
              {...scope}
              className={`${theme} ${styles.menu}`}
              placement="bottom end"
            >
              <Dropdown.Menu aria-label="Acciones de empleados">
                {canManage && (
                  <Dropdown.Item
                    id="plantilla"
                    textValue="Descargar plantilla"
                    onAction={downloadEmpleadosImportTemplate}
                  >
                    <FileSpreadsheetIcon /> Descargar plantilla
                  </Dropdown.Item>
                )}
                {canManage && (
                  <Dropdown.Item
                    id="importar"
                    textValue="Importar empleados"
                    isDisabled={isImporting}
                    onAction={() => fileInputRef.current?.click()}
                  >
                    <UploadIcon />{" "}
                    {isImporting ? "Importando…" : "Importar empleados"}
                  </Dropdown.Item>
                )}
                <Dropdown.Item
                  id="editar"
                  textValue={canManage ? "Editar selección" : "Ver ficha"}
                  isDisabled={selectedRows.length !== 1}
                  onAction={handleOpenSelection}
                >
                  <PencilIcon /> {canManage ? "Editar selección" : "Ver ficha"}
                </Dropdown.Item>
                <Dropdown.Item
                  id="exportar"
                  textValue="Exportar selección"
                  isDisabled={selectedRows.length === 0}
                  onAction={handleExport}
                >
                  <DownloadIcon /> Exportar selección
                </Dropdown.Item>
                {canManage &&
                  selectedRows.length > 0 &&
                  (selectedRows.every((item) => !item.activo) ? (
                    <Dropdown.Item
                      id="reactivar"
                      textValue="Reactivar selección"
                      isDisabled={isChangingState}
                      onAction={() =>
                        cambiarEstado(
                          selectedRows.map((item) => item.id),
                          true,
                        )
                      }
                    >
                      <UserCheckIcon /> Reactivar selección
                    </Dropdown.Item>
                  ) : (
                    <Dropdown.Item
                      id="baja"
                      textValue="Dar de baja selección"
                      variant="danger"
                      isDisabled={isChangingState}
                      onAction={() => setConfirmandoBaja(true)}
                    >
                      <UserMinusIcon /> Dar de baja selección
                    </Dropdown.Item>
                  ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
          {canManage && (
            <ActionLink href="/empleados/nuevo">
              <ArrowUpRightIcon /> Nuevo empleado
            </ActionLink>
          )}
        </div>
      </header>
      <div className={brand.metrics} aria-label="Resumen del listado">
        <ListMetric
          label="Legajos"
          value={response.total}
          hint={
            verInactivos ? "Incluye activos y bajas" : "Activos en el listado"
          }
          icon={UsersRoundIcon}
        />
        <ListMetric
          label="Sectores"
          value={
            new Set(empleados.map((item) => item.sector).filter(Boolean)).size
          }
          hint="En esta página"
          icon={BriefcaseBusinessIcon}
        />
        <ListMetric
          label="Con acceso"
          value={empleados.filter((item) => item.usuarioSistema).length}
          hint="En esta página"
          icon={ShieldCheckIcon}
        />
      </div>
      <Card className={listPage.results}>
        <Card.Header className={brand.directoryHeader}>
          <div className={brand.directoryTitle}>
            <span className={brand.directoryIcon} aria-hidden="true">
              <UsersRoundIcon />
            </span>
            <div>
              <Card.Title className={brand.directoryHeading}>
                Directorio del equipo
              </Card.Title>
              <Card.Description>
                Consultá cada legajo y su estado. Las bajas conservan el
                historial.
              </Card.Description>
            </div>
          </div>
        </Card.Header>
        <div className={listPage.toolbar}>
          <SearchField
            aria-label="Buscar empleados"
            value={search}
            onChange={setSearch}
            className={styles.search}
          >
            <SearchField.Group
              className={`${listPage.searchGroup} ${focus.singleBorder}`}
            >
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Nombre, sector, email o ciudad" />
              <SearchField.ClearButton aria-label="Limpiar búsqueda" />
            </SearchField.Group>
          </SearchField>
          <div className={styles.toolbarEnd}>
            <span className={styles.resultCount} role="status">
              {isLoading ? (
                <>
                  <GdiSpinner /> Actualizando…
                </>
              ) : (
                <>
                  <UsersRoundIcon size={15} />
                  {response.total}{" "}
                  {response.total === 1 ? "empleado" : "empleados"}
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
                <Label>Mostrar bajas</Label>
              </Switch.Content>
            </Switch>
          </div>
        </div>
        {selectedRows.length > 0 && (
          <div className={styles.selection}>
            <span>{selectedRows.length} empleado(s) seleccionado(s)</span>
            <ActionButton
              variant="ghost"
              onPress={() => setSelected(new Set())}
            >
              Limpiar selección
            </ActionButton>
          </div>
        )}
        <div aria-busy={isLoading}>
          {empleados.length === 0 ? (
            <Empty className={brand.empty}>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchXIcon />
                </EmptyMedia>
                <EmptyTitle>No encontramos empleados</EmptyTitle>
                <EmptyDescription>
                  {search || verInactivos
                    ? "Probá otra búsqueda o cambiá el filtro de bajas."
                    : "Creá el primer legajo para asignarlo a ventas o producción."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table
              className={`${styles.table} ${brand.table} ${styles.employeesTable}`}
            >
              <TableHeader>
                <TableRow>
                  <TableHead className={styles.checkCell}>
                    <Checkbox
                      aria-label="Seleccionar todos los empleados visibles"
                      isSelected={allSelected}
                      isIndeterminate={!allSelected && selectedRows.length > 0}
                      onChange={(checked) =>
                        setSelected(
                          checked
                            ? new Set(empleados.map((item) => item.id))
                            : new Set(),
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
                  <TableHead>Empleado</TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead>Ocupación</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Ciudad</TableHead>
                  <TableHead>Acceso</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {empleados.map((empleado) => (
                  <TableRow
                    key={empleado.id}
                    data-state={
                      selected.has(empleado.id) ? "selected" : undefined
                    }
                  >
                    <TableCell className={styles.checkCell}>
                      <Checkbox
                        aria-label={`Seleccionar a ${empleado.nombreCompleto}`}
                        isSelected={selected.has(empleado.id)}
                        onChange={(checked) =>
                          handleSelect(empleado.id, checked)
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
                        href={`/empleados/${empleado.id}`}
                        className={styles.employeeName}
                      >
                        <span className={brand.identityIcon} aria-hidden="true">
                          <UserRoundIcon />
                        </span>
                        <strong>{empleado.nombreCompleto}</strong>
                        <ArrowUpRightIcon
                          className={brand.rowArrow}
                          aria-hidden="true"
                        />
                      </NavLink>
                    </TableCell>
                    <TableCell>{empleado.sector}</TableCell>
                    <TableCell>{empleado.ocupacion || "-"}</TableCell>
                    <TableCell>
                      <span className={brand.contactText}>
                        <MailIcon aria-hidden="true" />
                        {empleado.email}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={brand.contactText}>
                        {empleado.ciudad && <MapPinIcon aria-hidden="true" />}
                        {empleado.ciudad || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="sm"
                        color={empleado.usuarioSistema ? "success" : "default"}
                        variant={empleado.usuarioSistema ? "soft" : "secondary"}
                      >
                        {empleado.usuarioSistema ? "Habilitado" : "Sin acceso"}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="sm"
                        color={empleado.activo ? "success" : "danger"}
                        variant="soft"
                      >
                        <span className={styles.statusDot} />
                        {empleado.activo ? "Activo" : "Baja"}
                      </Chip>
                    </TableCell>
                  </TableRow>
                ))}
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
        isOpen={confirmandoBaja}
        onOpenChange={(open) => !open && setConfirmandoBaja(false)}
        title="Dar de baja empleados"
        description={`Se darán de baja ${selectedRows.filter((item) => item.activo).length} empleado(s). Sus ventas, trabajos y egresos se conservarán; si tenían acceso, se revocará.`}
      >
        <Modal.Footer className={styles.dialogFooter}>
          <ActionButton
            variant="outline"
            onPress={() => setConfirmandoBaja(false)}
          >
            Cancelar
          </ActionButton>
          <ActionButton
            variant="danger"
            onPress={() => {
              setConfirmandoBaja(false);
              cambiarEstado(
                selectedRows
                  .filter((item) => item.activo)
                  .map((item) => item.id),
                false,
              );
            }}
          >
            <UserMinusIcon /> Dar de baja
          </ActionButton>
        </Modal.Footer>
      </FormDialog>
    </section>
  );
}
