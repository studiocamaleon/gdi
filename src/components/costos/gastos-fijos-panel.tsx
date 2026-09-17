"use client";

import * as React from "react";
import {
  Card,
  Chip,
  Input,
  Modal,
  SearchField,
  Tabs,
  TextArea,
} from "@heroui/react";
import {
  ArrowUpRightIcon,
  CalendarDaysIcon,
  CheckIcon,
  CirclePauseIcon,
  FileTextIcon,
  InfinityIcon,
  LayersIcon,
  ListFilterIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  RefreshCwIcon,
  Repeat2Icon,
  SearchXIcon,
  Settings2Icon,
  ShapesIcon,
  Trash2Icon,
  WalletIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  createGastoFijo,
  eliminarGastoFijo,
  FRECUENCIAS_GASTO_FIJO,
  FRECUENCIA_LABEL,
  getGastosFijos,
  toggleGastoFijo,
  updateGastoFijo,
  type FrecuenciaGastoFijo,
  type GastoFijo,
} from "@/lib/gastos-fijos-api";
import { getProveedores } from "@/lib/proveedores-api";
import { getCategoriasEgreso } from "@/lib/egresos-api";
import type { CategoriaEgreso } from "@/lib/egresos";
import { getMetodosPago } from "@/lib/administracion-api";
import { formatearMoneda, parsearMonto } from "@/lib/moneda";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import {
  useDesignScope,
  useDesignTheme,
} from "@/components/design-system/appearance";
import { ActionButton } from "@/components/design-system/action-button";
import { FormSheet } from "@/components/design-system/form-sheet";
import { FormDialog } from "@/components/design-system/form-dialog";
import { ListMetric } from "@/components/design-system/list-metric";
import { NavigationTabList } from "@/components/design-system/navigation-tab-list";
import { SegmentedControl } from "@/components/design-system/choice-controls";
import { SelectField } from "@/components/design-system/select-field";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import { MoneyInput } from "@/components/ui/money-input";
import {
  Field,
  FieldLabel,
  FieldGroup,
  FieldDescription,
} from "@/components/ui/field";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  calcularVigenteHasta,
  CUOTAS_POR_ANIO,
  desdeGasto,
  formularioVacio,
  payloadGastoFijo,
  periodoActual,
  vigenteEnMes,
  type FormularioGastoFijo,
} from "./gastos-fijos-form";
import listPage from "@/components/design-system/list-page.module.css";
import focus from "@/components/design-system/field-focus.module.css";
import s from "./gastos-fijos.module.css";

type Estado = "todos" | "activos" | "inactivos";
const ESTADOS = [
  { value: "todos", label: "Todos", icon: <ListFilterIcon /> },
  { value: "activos", label: "Activos", icon: <CheckIcon /> },
  { value: "inactivos", label: "Inactivos", icon: <CirclePauseIcon /> },
];
const FINES = [
  { value: "nunca", label: "Sin fin", icon: <InfinityIcon /> },
  { value: "en", label: "En un mes", icon: <CalendarDaysIcon /> },
  { value: "despues", label: "Por períodos", icon: <Repeat2Icon /> },
];
function mesLabel(mes: string) {
  if (!mes) return "—";
  const [anio, numero] = mes.split("-").map(Number);
  return new Intl.DateTimeFormat("es", {
    month: "short",
    year: "numeric",
  }).format(new Date(anio, numero - 1, 1));
}

export function GastosFijosPanel({
  initialGastos,
}: {
  initialGastos: GastoFijo[];
}) {
  const { moneda } = useConfigRegional();
  const scope = useDesignScope();
  const theme = useDesignTheme();
  const fmt = (v: number) =>
    formatearMoneda(v, moneda, { decimales: moneda.decimales });
  const [gastos, setGastos] = React.useState(initialGastos);
  const [busqueda, setBusqueda] = React.useState("");
  const [estado, setEstado] = React.useState<Estado>("todos");
  const [fichaAbierta, setFichaAbierta] = React.useState(false);
  const [editando, setEditando] = React.useState<GastoFijo | null>(null);
  const [aEliminar, setAEliminar] = React.useState<GastoFijo | null>(null);
  const [form, setForm] = React.useState<FormularioGastoFijo>(() =>
    formularioVacio(),
  );
  const [tab, setTab] = React.useState<"datos" | "clasificacion">("datos");
  const [guardando, setGuardando] = React.useState(false);
  const [cambiando, setCambiando] = React.useState<string | null>(null);
  const [sucio, setSucio] = React.useState(false);
  const [confirmandoSalida, setConfirmandoSalida] = React.useState(false);
  const [errorForm, setErrorForm] = React.useState<string | null>(null);
  const errorRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (errorForm) errorRef.current?.scrollIntoView({ block: "nearest" });
  }, [errorForm]);
  const [proveedores, setProveedores] = React.useState<
    Array<{ id: string; nombre: string }>
  >([]);
  const [metodos, setMetodos] = React.useState<
    Array<{ id: string; nombre: string }>
  >([]);
  const [categorias, setCategorias] = React.useState<CategoriaEgreso[]>([]);
  const [catalogosListos, setCatalogosListos] = React.useState(false);
  const [cargandoCatalogos, setCargandoCatalogos] = React.useState(false);
  const [errorCatalogos, setErrorCatalogos] = React.useState(false);

  const cargarCatalogos = async () => {
    if (catalogosListos || cargandoCatalogos) return;
    setCargandoCatalogos(true);
    setErrorCatalogos(false);
    try {
      const [ps, ms, cs] = await Promise.all([
        getProveedores(),
        getMetodosPago(),
        getCategoriasEgreso(),
      ]);
      const estructura = cs.filter(
        (c) => c.activo && c.naturaleza === "GASTO_ESTRUCTURA",
      );
      setProveedores(ps.map((p) => ({ id: p.id, nombre: p.nombre })));
      setMetodos(ms.map((m) => ({ id: m.id, nombre: m.nombre })));
      setCategorias(estructura);
      setCatalogosListos(true);
      setForm((f) =>
        f.categoriaEgresoId
          ? f
          : {
              ...f,
              categoriaEgresoId:
                estructura.find((c) => c.codigo === "otros_gastos")?.id ??
                estructura[0]?.id ??
                "",
            },
      );
    } catch {
      setErrorCatalogos(true);
    } finally {
      setCargandoCatalogos(false);
    }
  };

  const recargar = async () => {
    try {
      setGastos(await getGastosFijos());
    } catch {
      toast.error(
        "No se pudo actualizar la lista. Recargá la página para ver los cambios.",
      );
    }
  };
  const filtrados = React.useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase();
    return gastos.filter((g) => {
      if (estado === "activos" && !g.activo) return false;
      if (estado === "inactivos" && g.activo) return false;
      return (
        !termino ||
        `${g.nombre} ${g.proveedorNombre ?? ""} ${g.categoriaNombre}`
          .toLocaleLowerCase()
          .includes(termino)
      );
    });
  }, [gastos, busqueda, estado]);
  const mes = periodoActual();
  const vigentes = gastos.filter((g) => vigenteEnMes(g, mes));
  const activos = gastos.filter((g) => g.activo);
  const mensualVigente = vigentes.reduce((acc, g) => acc + g.importeMensual, 0);
  const totalVisible = filtrados
    .filter((g) => vigenteEnMes(g, mes))
    .reduce((acc, g) => acc + g.importeMensual, 0);

  const alternarActivo = async (g: GastoFijo) => {
    if (cambiando) return;
    setCambiando(g.id);
    try {
      await toggleGastoFijo(g.id);
      toast.success(g.activo ? "Gasto desactivado." : "Gasto activado.");
      await recargar();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo cambiar el estado.",
      );
    } finally {
      setCambiando(null);
    }
  };
  const abrir = (g: GastoFijo | null) => {
    setEditando(g);
    setForm(
      g
        ? desdeGasto(g, moneda)
        : formularioVacio(
            categorias.find((c) => c.codigo === "otros_gastos")?.id ??
              categorias[0]?.id,
          ),
    );
    setTab("datos");
    setSucio(false);
    setErrorForm(null);
    setFichaAbierta(true);
    void cargarCatalogos();
  };
  const editar = <K extends keyof FormularioGastoFijo>(
    campo: K,
    valor: FormularioGastoFijo[K],
  ) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    setSucio(true);
    setErrorForm(null);
  };
  const guardar = async () => {
    if (guardando || !catalogosListos) return;
    let payload;
    try {
      payload = payloadGastoFijo(form, moneda, editando?.activo ?? true);
    } catch (error) {
      setErrorForm(
        error instanceof Error ? error.message : "Revisá los datos del gasto.",
      );
      setTab(form.categoriaEgresoId ? "datos" : "clasificacion");
      return;
    }
    setGuardando(true);
    try {
      if (editando) await updateGastoFijo(editando.id, payload);
      else await createGastoFijo(payload);
      setSucio(false);
      setFichaAbierta(false);
      toast.success(editando ? "Gasto guardado." : "Gasto creado.");
      await recargar();
    } catch (error) {
      setErrorForm(
        error instanceof Error ? error.message : "No se pudo guardar el gasto.",
      );
    } finally {
      setGuardando(false);
    }
  };
  const pedirCierre = () => {
    if (guardando) return;
    if (sucio) setConfirmandoSalida(true);
    else setFichaAbierta(false);
  };
  const mensualDelForm =
    ((parsearMonto(form.valor, moneda) ?? 0) *
      CUOTAS_POR_ANIO[form.frecuencia]) /
    12;
  const hasta = calcularVigenteHasta(form);
  // Una categoría archivada se conserva al editar; no desaparece del valor elegido.
  const opcionesCategoria = categorias.map((c) => ({
    value: c.id,
    label: c.nombre,
  }));
  if (
    editando &&
    !opcionesCategoria.some((c) => c.value === editando.categoriaEgresoId)
  ) {
    opcionesCategoria.unshift({
      value: editando.categoriaEgresoId,
      label: editando.categoriaNombre,
    });
  }

  return (
    <section {...scope} className={`${theme} ${listPage.page} ${s.page}`}>
      <header className={listPage.header}>
        <div>
          <p className={s.eyebrow}>Administración · Estructura</p>
          <h1>
            Gastos fijos<span className={s.dot}>.</span>
          </h1>
          <p className={listPage.subtitle}>
            Lo que cuesta sostener tu operación. La base para calcular el punto
            de equilibrio.
          </p>
        </div>
        <ActionButton onPress={() => abrir(null)}>
          <PlusIcon aria-hidden /> Añadir gasto fijo
        </ActionButton>
      </header>
      <div className={s.metrics} aria-label="Resumen de gastos fijos">
        <div className={s.totalMetric}>
          <ListMetric
            label="Estructura mensual vigente"
            value={fmt(mensualVigente)}
            icon={WalletIcon}
            hint={`${mesLabel(mes)} · ${vigentes.length} gastos incluidos por su vigencia.`}
          />
        </div>
        <ListMetric
          label="Gastos activos"
          value={activos.length}
          icon={Repeat2Icon}
          hint={`${gastos.length - activos.length} inactivos · ${activos.length - vigentes.length} fuera de la vigencia actual.`}
        />
        <ListMetric
          label="Categorías de estructura"
          value={new Set(activos.map((g) => g.categoriaEgresoId)).size}
          icon={ShapesIcon}
          hint="Categorías utilizadas por los gastos activos."
        />
      </div>
      <Card className={s.results}>
        <Card.Header className={s.sectionHeader}>
          <span className={s.sectionIcon}>
            <LayersIcon aria-hidden />
          </span>
          <div>
            <Card.Title>Gastos de estructura</Card.Title>
            <Card.Description>
              Importes por período, vigencias y su equivalente mensual.
            </Card.Description>
          </div>
          <span className={s.count}>
            {filtrados.length} de {gastos.length} gastos
          </span>
        </Card.Header>
        <div className={s.toolbar}>
          <SearchField
            aria-label="Buscar gasto fijo"
            value={busqueda}
            onChange={setBusqueda}
            className={s.search}
          >
            <SearchField.Group className={focus.group}>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Buscar gasto, categoría o proveedor…" />
              <SearchField.ClearButton aria-label="Limpiar búsqueda" />
            </SearchField.Group>
          </SearchField>
          <SegmentedControl
            aria-label="Estado de los gastos"
            options={ESTADOS}
            value={estado}
            onChange={(v) => setEstado(v as Estado)}
          />
        </div>
        {filtrados.length === 0 ? (
          <Empty className={s.empty}>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                {gastos.length ? <SearchXIcon /> : <LayersIcon />}
              </EmptyMedia>
              <EmptyTitle>
                {gastos.length
                  ? "No encontramos gastos con estos filtros"
                  : "Tu estructura empieza acá"}
              </EmptyTitle>
              <EmptyDescription>
                {gastos.length
                  ? "Probá otra búsqueda o consultá todos los estados."
                  : "Sumá alquileres, servicios y otros gastos para conocer el costo mensual de tu operación."}
              </EmptyDescription>
            </EmptyHeader>
            <ActionButton
              variant="outline"
              onPress={() =>
                gastos.length
                  ? (setBusqueda(""), setEstado("todos"))
                  : abrir(null)
              }
            >
              {gastos.length ? "Limpiar filtros" : "Añadir el primer gasto"}
            </ActionButton>
          </Empty>
        ) : (
          <Table className={s.table}>
            <TableHeader>
              <TableRow>
                <TableHead>Gasto / categoría</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Vigencia</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className={s.number}>Importe por período</TableHead>
                <TableHead className={s.number}>Equivalente mensual</TableHead>
                <TableHead>
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((g) => (
                <TableRow key={g.id} data-inactive={!g.activo || undefined}>
                  <TableCell className={s.descriptionCell}>
                    <button
                      type="button"
                      className={s.detailLink}
                      onClick={() => abrir(g)}
                    >
                      {g.nombre}
                      <ArrowUpRightIcon aria-hidden />
                    </button>
                    <span className={s.category}>{g.categoriaNombre}</span>
                  </TableCell>
                  <TableCell className={s.provider}>
                    {g.proveedorNombre ?? (
                      <span className={s.muted}>Sin asignar</span>
                    )}
                  </TableCell>
                  <TableCell className={s.validity}>
                    <span>
                      {mesLabel(g.vigenteDesde)}
                      {g.vigenteHasta
                        ? ` → ${mesLabel(g.vigenteHasta)}`
                        : " → sin fin"}
                    </span>
                    <small>
                      {g.vigenteDesde > mes
                        ? "Comienza próximamente"
                        : g.vigenteHasta && g.vigenteHasta < mes
                          ? "Vigencia finalizada"
                          : "Vigente este mes"}
                    </small>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="sm"
                      variant="soft"
                      className={s.status}
                      data-active={g.activo}
                    >
                      <i aria-hidden />
                      {g.activo ? "Activo" : "Inactivo"}
                    </Chip>
                  </TableCell>
                  <TableCell className={s.number}>
                    {fmt(g.valor)}
                    <small>
                      Por {FRECUENCIA_LABEL[g.frecuencia].toLowerCase()}
                    </small>
                  </TableCell>
                  <TableCell className={`${s.number} ${s.monthly}`}>
                    {fmt(g.importeMensual)}
                    <small>/ mes</small>
                  </TableCell>
                  <TableCell>
                    <div className={s.actions}>
                      <ActionButton
                        variant="ghost"
                        tone="neutral"
                        isIconOnly
                        title={g.activo ? "Desactivar gasto" : "Activar gasto"}
                        aria-label={`${g.activo ? "Desactivar" : "Activar"} ${g.nombre}`}
                        isDisabled={!!cambiando}
                        isPending={cambiando === g.id}
                        onPress={() => void alternarActivo(g)}
                      >
                        {g.activo ? <PauseIcon /> : <PlayIcon />}
                      </ActionButton>
                      <ActionButton
                        variant="outline"
                        tone="neutral"
                        isIconOnly
                        title="Editar gasto"
                        aria-label={`Editar ${g.nombre}`}
                        isDisabled={!!cambiando}
                        onPress={() => abrir(g)}
                      >
                        <PencilIcon />
                      </ActionButton>
                      <ActionButton
                        variant="ghost"
                        tone="neutral"
                        isIconOnly
                        title="Eliminar gasto"
                        aria-label={`Eliminar ${g.nombre}`}
                        isDisabled={!!cambiando}
                        onPress={() => setAEliminar(g)}
                      >
                        <Trash2Icon />
                      </ActionButton>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <footer className={s.tableFooter}>
          <span>
            Mensual vigente de los gastos visibles{" "}
            <small>{mesLabel(mes)} · Solo activos dentro de su vigencia.</small>
          </span>
          <strong>{fmt(totalVisible)}</strong>
        </footer>
      </Card>
      <p className={s.caption}>
        <CalendarDaysIcon aria-hidden />
        La vigencia indica cuándo un gasto cuenta para el punto de equilibrio.
        Las facturas y los pagos se registran en Egresos.
      </p>

      {fichaAbierta && (
        <FormSheet
          className={s.sheet}
          title={
            <>
              <span className={s.eyebrow}>Administración · Estructura</span>
              {editando ? "Editar gasto fijo" : "Nuevo gasto fijo"}
              <span className={s.dot}>.</span>
            </>
          }
          description="Definí el importe por período, su clasificación y desde cuándo forma parte de tu estructura."
          onClose={pedirCierre}
          busy={guardando}
          footer={
            <>
              <span className={s.footerNote}>
                {editando?.activo === false
                  ? "Gasto inactivo"
                  : "Gasto de estructura"}
              </span>
              <ActionButton
                variant="outline"
                onPress={pedirCierre}
                isDisabled={guardando}
              >
                Cancelar
              </ActionButton>
              <ActionButton
                onPress={() => void guardar()}
                isPending={guardando}
                isDisabled={guardando || !catalogosListos}
              >
                <CheckIcon aria-hidden />
                {guardando ? "Guardando…" : "Guardar gasto"}
              </ActionButton>
            </>
          }
        >
          <div className={s.formContent}>
            {errorCatalogos && (
              <Alert variant="destructive">
                <AlertTitle>No pudimos cargar las opciones</AlertTitle>
                <AlertDescription>
                  Tu borrador sigue disponible.
                  <ActionButton
                    variant="outline"
                    onPress={() => void cargarCatalogos()}
                  >
                    <RefreshCwIcon />
                    Reintentar
                  </ActionButton>
                </AlertDescription>
              </Alert>
            )}
            {errorForm && (
              <Alert ref={errorRef} variant="destructive">
                <AlertTitle>Revisá el gasto</AlertTitle>
                <AlertDescription>{errorForm}</AlertDescription>
              </Alert>
            )}
            <Tabs
              selectedKey={tab}
              onSelectionChange={(v) => setTab(v as typeof tab)}
              className={s.formTabs}
            >
              <NavigationTabList
                label="Ficha del gasto fijo"
                variant="detailed"
                tone="graphite"
                className={s.navigation}
                items={[
                  {
                    id: "datos",
                    label: "Datos del gasto",
                    description: "Importe y vigencia",
                    icon: <Settings2Icon />,
                  },
                  {
                    id: "clasificacion",
                    label: "Clasificación",
                    description: "Categoría y referencia",
                    icon: <ShapesIcon />,
                  },
                ]}
              />
              <Tabs.Panel id="datos" className={s.formPanel}>
                <fieldset disabled={guardando} className={s.formSection}>
                  <legend>El gasto</legend>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="gf-nombre">
                        Descripción <span aria-hidden>*</span>
                      </FieldLabel>
                      <Input
                        id="gf-nombre"
                        value={form.nombre}
                        onChange={(e) => editar("nombre", e.target.value)}
                        placeholder="Ej. Alquiler del local"
                        autoFocus
                        className={focus.singleBorder}
                      />
                    </Field>
                    <div className={s.formGrid}>
                      <Field>
                        <FieldLabel>
                          Importe por período <span aria-hidden>*</span>
                        </FieldLabel>
                        <MoneyInput
                          value={form.valor}
                          onValueChange={(texto) => editar("valor", texto)}
                          moneda={moneda}
                          ariaLabel="Importe por período"
                          placeholder="0"
                          className={s.moneyInput}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="gf-frecuencia">
                          Período <span aria-hidden>*</span>
                        </FieldLabel>
                        <SelectField
                          id="gf-frecuencia"
                          aria-label="Período"
                          value={form.frecuencia}
                          onChange={(v) =>
                            editar("frecuencia", v as FrecuenciaGastoFijo)
                          }
                          disabled={guardando}
                          options={FRECUENCIAS_GASTO_FIJO}
                        />
                      </Field>
                    </div>
                    <div className={s.monthlyPreview}>
                      <span className={s.previewIcon}>
                        <WalletIcon aria-hidden />
                      </span>
                      <div>
                        <span>Equivalente mensual</span>
                        <small>
                          Importe repartido entre los meses del período.
                        </small>
                      </div>
                      <strong>{fmt(mensualDelForm)}</strong>
                    </div>
                    <div className={s.formGrid}>
                      <Field>
                        <FieldLabel htmlFor="gf-proveedor">
                          Proveedor
                        </FieldLabel>
                        <SelectField
                          id="gf-proveedor"
                          aria-label="Proveedor"
                          value={form.proveedorId}
                          onChange={(v) => editar("proveedorId", v)}
                          disabled={guardando || cargandoCatalogos}
                          options={[
                            { value: "", label: "Sin proveedor asignado" },
                            ...proveedores.map((p) => ({
                              value: p.id,
                              label: p.nombre,
                            })),
                          ]}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="gf-metodo">
                          Forma de pago
                        </FieldLabel>
                        <SelectField
                          id="gf-metodo"
                          aria-label="Forma de pago"
                          value={form.metodoPagoId}
                          onChange={(v) => editar("metodoPagoId", v)}
                          disabled={guardando || cargandoCatalogos}
                          options={[
                            { value: "", label: "Sin forma de pago" },
                            ...metodos.map((m) => ({
                              value: m.id,
                              label: m.nombre,
                            })),
                          ]}
                        />
                      </Field>
                    </div>
                    <Field>
                      <FieldLabel htmlFor="gf-notas">Observaciones</FieldLabel>
                      <TextArea
                        id="gf-notas"
                        value={form.notas}
                        onChange={(e) => editar("notas", e.target.value)}
                        rows={2}
                        placeholder="Información adicional sobre este gasto…"
                        className={focus.singleBorder}
                      />
                    </Field>
                  </FieldGroup>
                </fieldset>
                <fieldset disabled={guardando} className={s.formSection}>
                  <legend>Vigencia</legend>
                  <p className={s.sectionDescription}>
                    Meses en los que este gasto se incluye en el punto de
                    equilibrio.
                  </p>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="gf-desde">Desde</FieldLabel>
                      <Input
                        id="gf-desde"
                        type="month"
                        value={form.vigenteDesde}
                        onChange={(e) => editar("vigenteDesde", e.target.value)}
                        className={focus.singleBorder}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Finaliza</FieldLabel>
                      <SegmentedControl
                        aria-label="Fin de la vigencia"
                        value={form.fin}
                        options={FINES}
                        onChange={(v) =>
                          editar("fin", v as FormularioGastoFijo["fin"])
                        }
                        isDisabled={guardando}
                      />
                    </Field>
                    {form.fin === "en" && (
                      <Field>
                        <FieldLabel htmlFor="gf-hasta">
                          Hasta, inclusive
                        </FieldLabel>
                        <Input
                          id="gf-hasta"
                          type="month"
                          min={form.vigenteDesde}
                          value={form.vigenteHasta}
                          onChange={(e) =>
                            editar("vigenteHasta", e.target.value)
                          }
                          className={focus.singleBorder}
                        />
                      </Field>
                    )}
                    {form.fin === "despues" && (
                      <Field>
                        <FieldLabel htmlFor="gf-repeticiones">
                          Cantidad de períodos
                        </FieldLabel>
                        <Input
                          id="gf-repeticiones"
                          type="number"
                          min={1}
                          step={1}
                          value={form.repeticiones}
                          onChange={(e) =>
                            editar("repeticiones", e.target.value)
                          }
                          placeholder="Ej. 12"
                          className={focus.singleBorder}
                        />
                        <FieldDescription>
                          Cada período corresponde a un{" "}
                          {FRECUENCIA_LABEL[form.frecuencia].toLowerCase()}.
                        </FieldDescription>
                      </Field>
                    )}
                    <p className={s.vigenciaPreview}>
                      <CalendarDaysIcon aria-hidden />
                      {form.vigenteDesde
                        ? `Desde ${mesLabel(form.vigenteDesde)}`
                        : "Elegí el mes de inicio"}
                      {form.fin === "nunca"
                        ? ", sin fecha de fin."
                        : hasta
                          ? ` hasta ${mesLabel(hasta)}, inclusive.`
                          : ". Completá cuándo finaliza."}
                    </p>
                  </FieldGroup>
                </fieldset>
              </Tabs.Panel>
              <Tabs.Panel id="clasificacion" className={s.formPanel}>
                <fieldset disabled={guardando} className={s.formSection}>
                  <legend>Clasificación del gasto</legend>
                  <p className={s.sectionDescription}>
                    Agrupá este gasto dentro del presupuesto de estructura.
                  </p>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="gf-categoria">
                        Categoría <span aria-hidden>*</span>
                      </FieldLabel>
                      <SelectField
                        id="gf-categoria"
                        aria-label="Categoría del gasto"
                        value={form.categoriaEgresoId}
                        onChange={(v) => editar("categoriaEgresoId", v)}
                        disabled={guardando || cargandoCatalogos}
                        required
                        options={[
                          {
                            value: "",
                            label: cargandoCatalogos
                              ? "Cargando categorías…"
                              : "Elegir categoría",
                          },
                          ...opcionesCategoria,
                        ]}
                      />
                      <FieldDescription>
                        Solo se muestran categorías de gastos de estructura.
                      </FieldDescription>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="gf-documento">
                        Documento de referencia
                      </FieldLabel>
                      <Input
                        id="gf-documento"
                        value={form.documento}
                        onChange={(e) => editar("documento", e.target.value)}
                        placeholder="Ej. Contrato de alquiler o número de factura"
                        className={focus.singleBorder}
                      />
                      <FieldDescription>
                        Una referencia para identificar el gasto. No registra
                        una factura ni un pago.
                      </FieldDescription>
                    </Field>
                  </FieldGroup>
                </fieldset>
                <div className={s.referenceNote}>
                  <FileTextIcon aria-hidden />
                  <p>
                    El importe y la vigencia definen cuánto aporta este gasto a
                    la estructura mensual.
                  </p>
                </div>
              </Tabs.Panel>
            </Tabs>
          </div>
        </FormSheet>
      )}
      <FormDialog
        isOpen={confirmandoSalida}
        onOpenChange={setConfirmandoSalida}
        title="Cambios sin guardar"
        description="Tenés cambios en este gasto. Podés guardarlos, descartarlos o seguir editando."
      >
        <Modal.Footer className={s.confirmFooter}>
          <ActionButton
            variant="outline"
            onPress={() => setConfirmandoSalida(false)}
          >
            Seguir editando
          </ActionButton>
          <ActionButton
            variant="danger-soft"
            onPress={() => {
              setConfirmandoSalida(false);
              setFichaAbierta(false);
              setSucio(false);
            }}
          >
            Descartar cambios
          </ActionButton>
          <ActionButton
            isDisabled={!catalogosListos}
            onPress={() => {
              setConfirmandoSalida(false);
              void guardar();
            }}
          >
            Guardar y salir
          </ActionButton>
        </Modal.Footer>
      </FormDialog>
      <ConfirmacionDestructiva
        apariencia="heroui"
        open={!!aEliminar}
        onOpenChange={(open) => {
          if (!open) setAEliminar(null);
        }}
        titulo="Eliminar gasto fijo"
        descripcion="El gasto dejará de formar parte del presupuesto de estructura, incluidos los períodos anteriores."
        nombreItem={aEliminar?.nombre}
        requiereTipear={false}
        accionLabel="Eliminar gasto"
        onConfirmar={async () => {
          if (!aEliminar) return;
          try {
            await eliminarGastoFijo(aEliminar.id);
            setAEliminar(null);
            toast.success("Gasto eliminado.");
            await recargar();
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "No se pudo eliminar el gasto.",
            );
          }
        }}
      />
    </section>
  );
}
