"use client";

import {
  Card,
  Input,
  TextArea,
  Modal,
  Tabs,
  Checkbox,
  Label,
} from "@heroui/react";
import { ActionButton } from "@/components/design-system/action-button";
import { SelectField } from "@/components/design-system/select-field";
import { CampanaDialog } from "./campana-dialog";
import focus from "@/components/design-system/field-focus.module.css";
import form from "./campana-form.module.css";

import {
  ProgresoValor,
  ProgresoExplicado,
} from "@/components/produccion/progreso-produccion";
import * as React from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ShoppingBagIcon,
  WalletIcon,
  ReceiptIcon,
  FolderIcon,
  LayersIcon,
  ClipboardListIcon,
  CheckCircle2Icon,
  CirclePauseIcon,
  Edit3Icon,
  FileTextIcon,
  Link2Icon,
  MilestoneIcon,
  PlayIcon,
  PlusIcon,
  UnlinkIcon,
  UsersIcon,
  XCircleIcon,
} from "lucide-react";
import { toast } from "sonner";
import { ArchivoUploader } from "@/components/archivos/archivo-uploader";
import { useCambiosSistema } from "@/components/notificaciones/notificaciones-provider";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { NavigationTabList } from "@/components/design-system/navigation-tab-list";
import type { Archivo } from "@/lib/archivos";
import {
  cambiarEstadoCampana,
  crearHitoCampana,
  desvincularDocumentoCampana,
  editarCampana,
  editarHitoCampana,
  reemplazarEquipoCampana,
  vincularDocumentoCampana,
  getCampana,
  type CampanaDetalle,
  type CampanaEstado,
} from "@/lib/campanas-api";
import type { EmpleadoOpcion } from "@/lib/empleados";
import { formatearMoneda } from "@/lib/moneda";
import {
  listarPresupuestos,
  type PresupuestoResumen,
} from "@/lib/presupuestos-api";
import { getOrdenesTrabajo } from "@/lib/ordenes-trabajo-api";
import type { OrdenTrabajoListItem } from "@/lib/ordenes-trabajo";
import styles from "./campanas.module.css";
import layout from "@/components/design-system/list-page.module.css";
import theme from "@/components/design-system/theme.module.css";
import { useDesignScope } from "@/components/design-system/appearance";
import { ListMetric } from "@/components/design-system/list-metric";
import { IdentityAvatar } from "@/components/design-system/identity-avatar";
import { DesarrolloDocumentalPanel } from "./desarrollo-documental-panel";
import type { DesarrolloDocumental } from "@/lib/desarrollo-documental-api";
import { getDesarrolloCampana } from "@/lib/desarrollo-documental-api";
import { listarArchivos } from "@/lib/archivos-api";

const SIGUIENTES: Record<CampanaEstado, CampanaEstado[]> = {
  borrador: ["activo", "cancelado"],
  activo: ["pausado", "completado", "cancelado"],
  pausado: ["activo", "completado", "cancelado"],
  completado: ["activo"],
  cancelado: [],
};

const ACCION: Record<
  CampanaEstado,
  { label: string; icon: React.ElementType }
> = {
  borrador: { label: "Volver a borrador", icon: FileTextIcon },
  activo: { label: "Activar", icon: PlayIcon },
  pausado: { label: "Pausar", icon: CirclePauseIcon },
  completado: { label: "Completar", icon: CheckCircle2Icon },
  cancelado: { label: "Cancelar", icon: XCircleIcon },
};

function fecha(value: string | null, larga = false) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: larga ? "long" : "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

function fechaHora(value: string) {
  const partes = new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "America/Argentina/Buenos_Aires",
  }).formatToParts(new Date(value));
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value ?? "";
  return `${valor("day")}/${valor("month")}/${valor("year")} · ${valor("hour")}:${valor("minute")}`;
}

export function CampanaDetalleView({
  initial,
  initialArchivos,
  empleados,
  canManage,
  initialDesarrollo,
}: {
  initial: CampanaDetalle;
  initialArchivos: Archivo[];
  empleados: EmpleadoOpcion[];
  canManage: boolean;
  initialDesarrollo: DesarrolloDocumental;
}) {
  const scope = useDesignScope();
  const { moneda } = useConfigRegional();
  const [campana, setCampana] = React.useState(initial);
  const [archivos, setArchivos] = React.useState(initialArchivos);
  const [desarrollo, setDesarrollo] = React.useState(initialDesarrollo);
  const [hitoOpen, setHitoOpen] = React.useState(false);
  const [editarOpen, setEditarOpen] = React.useState(false);
  const [equipoOpen, setEquipoOpen] = React.useState(false);
  const [vincularOpen, setVincularOpen] = React.useState(false);
  const [equipoDraft, setEquipoDraft] = React.useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        initial.equipo.map((m) => [m.empleadoId, m.funcion ?? ""]),
      ),
  );
  const [documentoTipo, setDocumentoTipo] = React.useState<
    "cotizaciones" | "ordenes"
  >("cotizaciones");
  const [documentoId, setDocumentoId] = React.useState("");
  const [presupuestosDisponibles, setPresupuestosDisponibles] = React.useState<
    PresupuestoResumen[]
  >([]);
  const [ordenesDisponibles, setOrdenesDisponibles] = React.useState<
    OrdenTrabajoListItem[]
  >([]);
  const [working, setWorking] = React.useState<string | null>(null);
  const [hitoError, setHitoError] = React.useState<string | null>(null);
  const actualizacionPendiente = React.useRef(false);
  const refrescandoEnVivo = React.useRef(false);
  const edicionActiva = Boolean(
    working || hitoOpen || editarOpen || equipoOpen || vincularOpen,
  );

  const refrescarEnVivo = React.useCallback(async () => {
    if (edicionActiva || refrescandoEnVivo.current) {
      actualizacionPendiente.current = true;
      return;
    }
    refrescandoEnVivo.current = true;
    try {
      const [siguiente, siguienteDesarrollo, siguientesArchivos] =
        await Promise.all([
          getCampana(initial.id),
          getDesarrolloCampana(initial.id),
          listarArchivos("CAMPANA", initial.id),
        ]);
      setCampana(siguiente);
      setDesarrollo(siguienteDesarrollo);
      setArchivos(siguientesArchivos);
      actualizacionPendiente.current = false;
    } catch {
      actualizacionPendiente.current = true;
    } finally {
      refrescandoEnVivo.current = false;
    }
  }, [edicionActiva, initial.id]);

  useCambiosSistema(
    (cambio) => {
      if (cambio.topicos.includes(`campana:${initial.id}`)) {
        void refrescarEnVivo();
      }
    },
    [initial.id, refrescarEnVivo],
  );

  React.useEffect(() => {
    if (!edicionActiva && actualizacionPendiente.current) {
      void refrescarEnVivo();
    }
  }, [edicionActiva, refrescarEnVivo]);

  async function cambiarEstado(estado: CampanaEstado) {
    if (
      estado === "completado" &&
      (campana.senalesCierre.ordenesAbiertas > 0 ||
        campana.senalesCierre.hitosPendientes > 0) &&
      !window.confirm(
        `Todavía hay ${campana.senalesCierre.ordenesAbiertas} OTs abiertas y ${campana.senalesCierre.hitosPendientes} hitos pendientes. ¿Completar igual?`,
      )
    )
      return;
    setWorking(estado);
    try {
      const siguiente = await cambiarEstadoCampana(
        campana.id,
        estado,
        campana.updatedAt,
      );
      setCampana(siguiente);
      toast.success(`Campaña ${estado}.`);
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "No se pudo cambiar el estado.",
      );
    } finally {
      setWorking(null);
    }
  }

  async function crearHito(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking("hito");
    setHitoError(null);
    const data = new FormData(event.currentTarget);
    try {
      const siguiente = await crearHitoCampana(campana.id, {
        titulo: String(data.get("titulo")),
        fechaObjetivo: String(data.get("fechaObjetivo") || "") || undefined,
        responsableEmpleadoId:
          String(data.get("responsableEmpleadoId") || "") || undefined,
        descripcion: String(data.get("descripcion") || "") || undefined,
        orden: campana.hitos.length,
      });
      setCampana(siguiente);
      setHitoOpen(false);
      toast.success("Hito agregado.");
    } catch (cause) {
      setHitoError(
        cause instanceof Error ? cause.message : "No se pudo agregar el hito.",
      );
    } finally {
      setWorking(null);
    }
  }

  async function guardarDatos(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking("editar");
    const data = new FormData(event.currentTarget);
    try {
      const siguiente = await editarCampana(campana.id, {
        updatedAt: campana.updatedAt,
        nombre: String(data.get("nombre")),
        tipo: String(data.get("tipo") || "") || null,
        prioridad: String(data.get("prioridad")) as CampanaDetalle["prioridad"],
        fechaInicio: String(data.get("fechaInicio") || "") || null,
        fechaObjetivo: String(data.get("fechaObjetivo") || "") || null,
        responsableEmpleadoId:
          String(data.get("responsableEmpleadoId") || "") || null,
        descripcion: String(data.get("descripcion") || "") || null,
        observaciones: String(data.get("observaciones") || "") || null,
      });
      setCampana(siguiente);
      setEditarOpen(false);
      toast.success("Datos de campaña actualizados.");
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "No se pudo actualizar la campaña.",
      );
    } finally {
      setWorking(null);
    }
  }

  async function guardarEquipo() {
    setWorking("equipo");
    try {
      const siguiente = await reemplazarEquipoCampana(
        campana.id,
        Object.entries(equipoDraft).map(([empleadoId, funcion]) => ({
          empleadoId,
          funcion: funcion.trim() || undefined,
        })),
      );
      setCampana(siguiente);
      setEquipoOpen(false);
      toast.success("Equipo actualizado.");
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "No se pudo actualizar el equipo.",
      );
    } finally {
      setWorking(null);
    }
  }

  async function avanzarHito(hito: CampanaDetalle["hitos"][number]) {
    const estado =
      hito.estado === "pendiente"
        ? "en_curso"
        : hito.estado === "en_curso"
          ? "completado"
          : "pendiente";
    setWorking(hito.id);
    try {
      setCampana(
        await editarHitoCampana(campana.id, hito.id, {
          updatedAt: hito.updatedAt,
          estado,
        }),
      );
      toast.success(`Hito ${estado.replace("_", " ")}.`);
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "No se pudo actualizar el hito.",
      );
    } finally {
      setWorking(null);
    }
  }

  async function abrirVincular() {
    setVincularOpen(true);
    setDocumentoId("");
    setWorking("cargar-documentos");
    try {
      const [presupuestos, ordenes] = await Promise.all([
        listarPresupuestos({ clienteId: campana.cliente.id, limit: 100 }),
        getOrdenesTrabajo({ clienteId: campana.cliente.id, limit: 200 }),
      ]);
      setPresupuestosDisponibles(
        presupuestos.presupuestos.filter(
          (p) => !p.proyectoCampana || p.proyectoCampana.id === campana.id,
        ),
      );
      setOrdenesDisponibles(
        ordenes.data.filter(
          (o) => !o.proyectoCampana || o.proyectoCampana.id === campana.id,
        ),
      );
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "No se pudieron cargar los documentos.",
      );
    } finally {
      setWorking(null);
    }
  }

  async function vincularDocumento() {
    if (!documentoId) return;
    setWorking("vincular");
    try {
      setCampana(
        await vincularDocumentoCampana(campana.id, documentoTipo, documentoId),
      );
      setVincularOpen(false);
      toast.success("Documento vinculado.");
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "No se pudo vincular el documento.",
      );
    } finally {
      setWorking(null);
    }
  }

  async function desvincularDocumento(
    tipo: "cotizaciones" | "ordenes",
    id: string,
    numero: string,
  ) {
    if (
      !window.confirm(
        `¿Desvincular ${numero} de esta campaña? El documento no se elimina.`,
      )
    )
      return;
    setWorking(id);
    try {
      setCampana(await desvincularDocumentoCampana(campana.id, tipo, id));
      toast.success(`${numero} desvinculado.`);
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "No se pudo desvincular.",
      );
    } finally {
      setWorking(null);
    }
  }

  const comercial = campana.dashboard.comercial;
  const money = (value: number) => formatearMoneda(value, moneda);

  return (
    <main {...scope} className={`${theme.theme} ${layout.page}`}>
      <div className={styles.breadcrumb}>
        <Link href="/comercial/campanas">
          <ArrowLeftIcon className="size-3" /> Campañas
        </Link>
        <span>/</span>
        <span className={styles.code}>{campana.codigo}</span>
      </div>
      <header className={`${layout.header} ${styles.detailHeader}`}>
        <div>
          <p className={styles.eyebrow}>{campana.cliente.nombre}</p>
          <h1>{campana.nombre}</h1>
          <div className={styles.detailMeta}>
            <span className={styles.code}>{campana.codigo}</span>
            <span className={styles.status} data-status={campana.estado}>
              {campana.estado}
            </span>
            <span className={styles.priority} data-priority={campana.prioridad}>
              {campana.prioridad}
            </span>
            {campana.tipo ? (
              <span className={styles.secondary}>{campana.tipo}</span>
            ) : null}
          </div>
        </div>
        {canManage ? (
          <div className={styles.actions}>
            <ActionButton variant="outline" onPress={() => setEditarOpen(true)}>
              <Edit3Icon data-icon="inline-start" /> Editar
            </ActionButton>
            <ActionButton
              variant="outline"
              onPress={() => {
                setEquipoDraft(
                  Object.fromEntries(
                    campana.equipo.map((m) => [m.empleadoId, m.funcion ?? ""]),
                  ),
                );
                setEquipoOpen(true);
              }}
            >
              <UsersIcon data-icon="inline-start" /> Equipo
            </ActionButton>
            <ActionButton
              variant="outline"
              onPress={() => void abrirVincular()}
            >
              <Link2Icon data-icon="inline-start" /> Vincular
            </ActionButton>
            {SIGUIENTES[campana.estado].map((estado) => {
              const Icon = ACCION[estado].icon;
              return (
                <ActionButton
                  key={estado}
                  variant={
                    estado === "cancelado"
                      ? "danger"
                      : estado === "activo" || estado === "completado"
                        ? "primary"
                        : "outline"
                  }
                  onPress={() => void cambiarEstado(estado)}
                  isPending={working === estado}
                >
                  <Icon data-icon="inline-start" /> {ACCION[estado].label}
                </ActionButton>
              );
            })}
          </div>
        ) : null}
      </header>

      <section className={styles.kpis} aria-label="Resumen comercial">
        <ListMetric
          label="Valor de órdenes"
          value={money(comercial.vendido)}
          hint="Órdenes vinculadas"
          icon={ShoppingBagIcon}
          tone="brand"
        />
        <ListMetric
          label="Presupuestado"
          value={money(comercial.presupuestado)}
          hint="Presupuestos de la campaña"
          icon={FileTextIcon}
        />
        <ListMetric
          label="Facturado"
          value={money(comercial.facturado)}
          hint="Comprobantes emitidos"
          icon={ReceiptIcon}
        />
        <ListMetric
          label="Cobrado"
          value={money(comercial.cobrado)}
          hint="Cobros registrados"
          icon={WalletIcon}
        />
      </section>

      {campana.dashboard.produccion.progreso ? (
        <ProgresoExplicado
          titulo="Avance productivo de la campaña"
          progreso={campana.dashboard.produccion.progreso}
        />
      ) : null}
      <div className={styles.detailGrid}>
        <div>
          <Card
            render={(props) => <section {...props} />}
            className={styles.panel}
          >
            <div className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>Ruta de hitos</h2>
                <p className={styles.panelNote}>
                  Compromisos configurables y responsables.
                </p>
              </div>
              {canManage ? (
                <ActionButton
                  variant="outline"
                  size="sm"
                  onPress={() => setHitoOpen(true)}
                >
                  <PlusIcon data-icon="inline-start" /> Agregar hito
                </ActionButton>
              ) : null}
            </div>
            <div className={styles.panelBody}>
              {campana.hitos.length ? (
                campana.hitos.map((hito) => (
                  <div className={styles.milestone} key={hito.id}>
                    <span
                      className={styles.milestoneNode}
                      data-status={hito.estado}
                    />
                    <div>
                      <div className={styles.milestoneTitle}>{hito.titulo}</div>
                      <span className={styles.secondary}>
                        {hito.responsable?.nombre ?? "Sin responsable"}
                        {hito.descripcion ? ` · ${hito.descripcion}` : ""}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className={styles.status} data-status={hito.estado}>
                        {hito.estado.replace("_", " ")}
                      </span>
                      <span className={styles.secondary}>
                        {fecha(hito.fechaObjetivo)}
                      </span>
                      {canManage && hito.estado !== "cancelado" ? (
                        <ActionButton
                          variant="ghost"
                          size="sm"
                          className="mt-1"
                          isPending={working === hito.id}
                          onPress={() => void avanzarHito(hito)}
                        >
                          {hito.estado === "completado" ? "Reabrir" : "Avanzar"}
                        </ActionButton>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className={layout.empty}>
                  <MilestoneIcon className="mx-auto mb-3 size-6" />
                  Todavía no se definieron hitos.
                </div>
              )}
            </div>
          </Card>

          <Card
            render={(props) => <section {...props} />}
            className={styles.panel}
          >
            <Tabs defaultSelectedKey="ordenes" className={styles.tabsRoot}>
              <NavigationTabList
                label="Documentos de campaña"
                className={styles.tabsList}
                items={[
                  {
                    id: "ordenes",
                    label: "Órdenes",
                    count: campana.ordenes.length,
                    icon: <ClipboardListIcon />,
                  },
                  {
                    id: "presupuestos",
                    label: "Presupuestos",
                    count: campana.cotizaciones.length,
                    icon: <FileTextIcon />,
                  },
                  {
                    id: "archivos",
                    label: "Archivos",
                    count: archivos.length,
                    icon: <FolderIcon />,
                  },
                  {
                    id: "desarrollo",
                    label: "Desarrollo",
                    count: desarrollo.maestros.length,
                    icon: <LayersIcon />,
                  },
                ]}
              />
              <Tabs.Panel id="ordenes" className={styles.tabContent}>
                {campana.ordenes.length ? (
                  <div
                    className={styles.tableScroll}
                    tabIndex={0}
                    role="region"
                    aria-label="Documentos vinculados"
                  >
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Orden</th>
                          <th>Estado</th>
                          <th>Entrega</th>
                          <th>Avance</th>
                          <th>Total</th>
                          {canManage ? <th aria-label="Acciones" /> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {campana.ordenes.map((orden) => (
                          <tr key={orden.id}>
                            <td>
                              <Link
                                className={styles.code}
                                href={`/produccion/ordenes/${orden.id}`}
                              >
                                {orden.numero}
                              </Link>
                            </td>
                            <td>
                              <span
                                className={styles.status}
                                data-status={orden.estado}
                              >
                                {orden.estado}
                              </span>
                            </td>
                            <td>{fecha(orden.fechaEntrega)}</td>
                            <td className={styles.number}>
                              <ProgresoValor
                                progreso={orden.progreso}
                                valor={orden.progresoPct}
                              />
                            </td>
                            <td className={styles.number}>
                              {money(orden.total)}
                            </td>
                            {canManage ? (
                              <td className="text-right">
                                <ActionButton
                                  variant="ghost"
                                  size="sm"
                                  isIconOnly
                                  title="Desvincular orden"
                                  aria-label="Desvincular orden"
                                  isPending={working === orden.id}
                                  onPress={() =>
                                    void desvincularDocumento(
                                      "ordenes",
                                      orden.id,
                                      orden.numero,
                                    )
                                  }
                                >
                                  <UnlinkIcon />
                                </ActionButton>
                              </td>
                            ) : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className={layout.empty}>
                    Todavía no hay órdenes vinculadas.
                  </div>
                )}
              </Tabs.Panel>
              <Tabs.Panel id="presupuestos" className={styles.tabContent}>
                {campana.cotizaciones.length ? (
                  <div
                    className={styles.tableScroll}
                    tabIndex={0}
                    role="region"
                    aria-label="Documentos vinculados"
                  >
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Presupuesto</th>
                          <th>Estado</th>
                          <th>Emisión</th>
                          <th>Total</th>
                          {canManage ? <th aria-label="Acciones" /> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {campana.cotizaciones.map((presupuesto) => (
                          <tr key={presupuesto.id}>
                            <td>
                              <Link
                                className={styles.code}
                                href={`/comercial/presupuestos/${presupuesto.id}`}
                              >
                                {presupuesto.numero ?? "Sin emitir"}
                              </Link>
                            </td>
                            <td>
                              <span
                                className={styles.status}
                                data-status={presupuesto.estado}
                              >
                                {presupuesto.estado}
                              </span>
                            </td>
                            <td>{fecha(presupuesto.fechaEmision)}</td>
                            <td className={styles.number}>
                              {money(presupuesto.total)}
                            </td>
                            {canManage ? (
                              <td className="text-right">
                                <ActionButton
                                  variant="ghost"
                                  size="sm"
                                  isIconOnly
                                  title="Desvincular presupuesto"
                                  aria-label="Desvincular presupuesto"
                                  isPending={working === presupuesto.id}
                                  onPress={() =>
                                    void desvincularDocumento(
                                      "cotizaciones",
                                      presupuesto.id,
                                      presupuesto.numero ??
                                        "Presupuesto sin emitir",
                                    )
                                  }
                                >
                                  <UnlinkIcon />
                                </ActionButton>
                              </td>
                            ) : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className={layout.empty}>
                    Todavía no hay presupuestos vinculados.
                  </div>
                )}
              </Tabs.Panel>
              <Tabs.Panel
                id="archivos"
                className={`${styles.tabContent} ${styles.panelBody}`}
              >
                <ArchivoUploader
                  scope="CAMPANA"
                  entidadId={campana.id}
                  archivos={archivos}
                  onCambio={setArchivos}
                  soloLectura={!canManage}
                  titulo="Adjuntar brief, cronograma o documentación"
                  vacio="La campaña todavía no tiene archivos."
                  calcularHash
                />
              </Tabs.Panel>
              <Tabs.Panel id="desarrollo" className={styles.tabContent}>
                <DesarrolloDocumentalPanel
                  campanaId={campana.id}
                  initial={desarrollo}
                  archivos={archivos}
                  ordenes={campana.ordenes}
                  canManage={canManage}
                />
              </Tabs.Panel>
            </Tabs>
          </Card>
        </div>

        <aside>
          <Card
            render={(props) => <section {...props} />}
            className={styles.panel}
          >
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Coordinación</h2>
            </div>
            <div className={styles.panelBody}>
              <dl className={styles.definitionList}>
                <div className={styles.definition}>
                  <dt>Responsable</dt>
                  <dd>
                    {campana.responsable ? (
                      <span className={styles.person}>
                        <IdentityAvatar name={campana.responsable.nombre} />
                        <span>{campana.responsable.nombre}</span>
                      </span>
                    ) : (
                      "Sin asignar"
                    )}
                  </dd>
                </div>
                <div className={styles.definition}>
                  <dt>Inicio</dt>
                  <dd>{fecha(campana.fechaInicio, true)}</dd>
                </div>
                <div className={styles.definition}>
                  <dt>Objetivo</dt>
                  <dd>{fecha(campana.fechaObjetivo, true)}</dd>
                </div>
                <div className={styles.definition}>
                  <dt>Equipo</dt>
                  <dd>
                    {campana.equipo.length
                      ? campana.equipo.map((m) => m.nombre).join(", ")
                      : "Sin equipo"}
                  </dd>
                </div>
              </dl>
              {campana.descripcion ? (
                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  {campana.descripcion}
                </p>
              ) : null}
            </div>
          </Card>
          <Card
            render={(props) => <section {...props} />}
            className={styles.panel}
          >
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Disponibilidad material</h2>
            </div>
            <div className={styles.panelBody}>
              <div className={styles.callout}>
                {campana.dashboard.materiales.mensaje}
              </div>
            </div>
          </Card>
          {campana.dashboard.rentabilidad ? (
            <Card
              render={(props) => <section {...props} />}
              className={styles.panel}
            >
              <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>Rentabilidad estimada</h2>
              </div>
              <div className={styles.panelBody}>
                {campana.dashboard.rentabilidad.disponible ? (
                  <dl className={styles.definitionList}>
                    <div className={styles.definition}>
                      <dt>Costo</dt>
                      <dd className={styles.number}>
                        {money(campana.dashboard.rentabilidad.costoEstimado)}
                      </dd>
                    </div>
                    <div className={styles.definition}>
                      <dt>Margen</dt>
                      <dd className={styles.number}>
                        {money(campana.dashboard.rentabilidad.margenEstimado)}
                      </dd>
                    </div>
                    <div className={styles.definition}>
                      <dt>Margen %</dt>
                      <dd className={styles.number}>
                        {campana.dashboard.rentabilidad.margenPct == null
                          ? "—"
                          : `${campana.dashboard.rentabilidad.margenPct.toFixed(1)}%`}
                      </dd>
                    </div>
                  </dl>
                ) : null}
                <div className={`${styles.callout} mt-3`}>
                  {campana.dashboard.rentabilidad.mensaje}
                </div>
              </div>
            </Card>
          ) : null}
          <Card
            render={(props) => <section {...props} />}
            className={styles.panel}
          >
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Actividad</h2>
            </div>
            <div className={styles.panelBody}>
              <div className={styles.timeline}>
                {campana.eventos.slice(0, 20).map((evento) => (
                  <div className={styles.event} key={evento.id}>
                    <p className={styles.eventText}>{evento.descripcion}</p>
                    <div className={styles.eventMeta}>
                      {evento.actor} · {fechaHora(evento.fecha)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </aside>
      </div>

      <CampanaDialog
        isOpen={hitoOpen}
        onOpenChange={setHitoOpen}
        title={<>Agregar hito</>}
        description={<>Definí un compromiso concreto dentro de la campaña.</>}
      >
        <form onSubmit={crearHito}>
          <div className={form.body}>
            <div className={form.grid}>
              <div className={form.span2}>
                <label className={form.label} htmlFor="hito-titulo">
                  Título <span className={form.required}>*</span>
                </label>
                <Input
                  id="hito-titulo"
                  name="titulo"
                  className={`${form.input} ${focus.singleBorder}`}
                  required
                  maxLength={180}
                  placeholder="Arte final aprobado"
                />
              </div>
              <div>
                <label className={form.label} htmlFor="hito-fecha">
                  Fecha objetivo
                </label>
                <Input
                  id="hito-fecha"
                  name="fechaObjetivo"
                  type="date"
                  className={`${form.input} ${focus.singleBorder}`}
                />
              </div>
              <div>
                <label className={form.label} htmlFor="hito-responsable">
                  Responsable
                </label>
                <SelectField
                  id="hito-responsable"
                  name="responsableEmpleadoId"
                  className={form.select}
                  defaultValue=""
                  aria-label="Responsable"
                  options={[
                    { value: "", label: "Sin asignar" },
                    ...empleados.map((empleado) => ({
                      value: empleado.id,
                      label: empleado.nombreCompleto,
                    })),
                  ]}
                />
              </div>
              <div className={form.span2}>
                <label className={form.label} htmlFor="hito-descripcion">
                  Descripción
                </label>
                <TextArea
                  id="hito-descripcion"
                  name="descripcion"
                  className={`${form.textarea} ${focus.singleBorder}`}
                  maxLength={1000}
                />
              </div>
            </div>
            {hitoError ? (
              <p className={form.error} role="alert">
                {hitoError}
              </p>
            ) : null}
          </div>
          <Modal.Footer className={form.footer}>
            <ActionButton
              type="button"
              variant="outline"
              onPress={() => setHitoOpen(false)}
            >
              Cancelar
            </ActionButton>
            <ActionButton type="submit" isPending={working === "hito"}>
              <PlusIcon data-icon="inline-start" /> Agregar hito
            </ActionButton>
          </Modal.Footer>
        </form>
      </CampanaDialog>

      <CampanaDialog
        isOpen={editarOpen}
        onOpenChange={setEditarOpen}
        title={<>Editar campaña</>}
        description={
          <>Actualizá el encuadre comercial y las fechas de coordinación.</>
        }
      >
        <form onSubmit={guardarDatos}>
          <div className={form.body}>
            <div className={form.grid}>
              <div className={form.span2}>
                <label className={form.label} htmlFor="campana-nombre">
                  Nombre
                </label>
                <Input
                  id="campana-nombre"
                  name="nombre"
                  className={`${form.input} ${focus.singleBorder}`}
                  defaultValue={campana.nombre}
                  required
                  maxLength={180}
                />
              </div>
              <div>
                <label className={form.label} htmlFor="campana-tipo">
                  Tipo
                </label>
                <Input
                  id="campana-tipo"
                  name="tipo"
                  className={`${form.input} ${focus.singleBorder}`}
                  defaultValue={campana.tipo ?? ""}
                  maxLength={80}
                />
              </div>
              <div>
                <label className={form.label} htmlFor="campana-prioridad">
                  Prioridad
                </label>
                <SelectField
                  id="campana-prioridad"
                  name="prioridad"
                  className={form.select}
                  defaultValue={campana.prioridad}
                  aria-label="Prioridad"
                  options={[
                    { value: "baja", label: "Baja" },
                    { value: "normal", label: "Normal" },
                    { value: "alta", label: "Alta" },
                    { value: "critica", label: "Crítica" },
                  ]}
                />
              </div>
              <div>
                <label className={form.label} htmlFor="campana-inicio">
                  Inicio
                </label>
                <Input
                  id="campana-inicio"
                  name="fechaInicio"
                  type="date"
                  className={`${form.input} ${focus.singleBorder}`}
                  defaultValue={campana.fechaInicio?.slice(0, 10) ?? ""}
                />
              </div>
              <div>
                <label className={form.label} htmlFor="campana-objetivo">
                  Objetivo
                </label>
                <Input
                  id="campana-objetivo"
                  name="fechaObjetivo"
                  type="date"
                  className={`${form.input} ${focus.singleBorder}`}
                  defaultValue={campana.fechaObjetivo?.slice(0, 10) ?? ""}
                />
              </div>
              <div className={form.span2}>
                <label className={form.label} htmlFor="campana-responsable">
                  Responsable
                </label>
                <SelectField
                  id="campana-responsable"
                  name="responsableEmpleadoId"
                  className={form.select}
                  defaultValue={campana.responsable?.id ?? ""}
                  aria-label="Responsable"
                  options={[
                    { value: "", label: "Sin asignar" },
                    ...empleados.map((empleado) => ({
                      value: empleado.id,
                      label: empleado.nombreCompleto,
                    })),
                  ]}
                />
              </div>
              <div className={form.span2}>
                <label className={form.label} htmlFor="campana-descripcion">
                  Descripción
                </label>
                <TextArea
                  id="campana-descripcion"
                  name="descripcion"
                  className={`${form.textarea} ${focus.singleBorder}`}
                  defaultValue={campana.descripcion ?? ""}
                  maxLength={2000}
                />
              </div>
              <div className={form.span2}>
                <label className={form.label} htmlFor="campana-observaciones">
                  Observaciones
                </label>
                <TextArea
                  id="campana-observaciones"
                  name="observaciones"
                  className={`${form.textarea} ${focus.singleBorder}`}
                  defaultValue={campana.observaciones ?? ""}
                  maxLength={2000}
                />
              </div>
            </div>
          </div>
          <Modal.Footer className={form.footer}>
            <ActionButton
              type="button"
              variant="outline"
              onPress={() => setEditarOpen(false)}
            >
              Cancelar
            </ActionButton>
            <ActionButton type="submit" isPending={working === "editar"}>
              Guardar cambios
            </ActionButton>
          </Modal.Footer>
        </form>
      </CampanaDialog>

      <CampanaDialog
        isOpen={equipoOpen}
        onOpenChange={setEquipoOpen}
        title={<>Equipo de campaña</>}
        description={
          <>Seleccioná las personas que coordinan o ejecutan esta campaña.</>
        }
      >
        <div className={form.body}>
          <div className={form.teamList}>
            {empleados.map((empleado) => {
              const seleccionado = Object.hasOwn(equipoDraft, empleado.id);
              return (
                <div className={form.teamRow} key={empleado.id}>
                  <Checkbox
                    className={form.teamPerson}
                    isSelected={seleccionado}
                    onChange={(checked) =>
                      setEquipoDraft((actual) => {
                        const siguiente = { ...actual };
                        if (checked) siguiente[empleado.id] = "";
                        else delete siguiente[empleado.id];
                        return siguiente;
                      })
                    }
                  >
                    <Checkbox.Content>
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      <Label>{empleado.nombreCompleto}</Label>
                    </Checkbox.Content>
                  </Checkbox>
                  <Input
                    className={`${form.input} ${focus.singleBorder}`}
                    aria-label={`Función de ${empleado.nombreCompleto}`}
                    placeholder="Función en la campaña"
                    disabled={!seleccionado}
                    value={equipoDraft[empleado.id] ?? ""}
                    onChange={(event) =>
                      setEquipoDraft((actual) => ({
                        ...actual,
                        [empleado.id]: event.target.value,
                      }))
                    }
                  />
                </div>
              );
            })}
          </div>
        </div>
        <Modal.Footer className={form.footer}>
          <ActionButton variant="outline" onPress={() => setEquipoOpen(false)}>
            Cancelar
          </ActionButton>
          <ActionButton
            isPending={working === "equipo"}
            onPress={() => void guardarEquipo()}
          >
            Guardar equipo
          </ActionButton>
        </Modal.Footer>
      </CampanaDialog>

      <CampanaDialog
        isOpen={vincularOpen}
        onOpenChange={setVincularOpen}
        title={<>Vincular documento</>}
        description={
          <>
            Solo se muestran documentos del mismo cliente y disponibles para
            esta campaña.
          </>
        }
      >
        <div className={form.body}>
          <div className={form.grid}>
            <div>
              <label className={form.label} htmlFor="documento-tipo">
                Tipo
              </label>
              <SelectField
                id="documento-tipo"
                className={form.select}
                value={documentoTipo}
                onChange={(value) => {
                  setDocumentoTipo(value as "cotizaciones" | "ordenes");
                  setDocumentoId("");
                }}
                aria-label="Tipo de documento"
                options={[
                  { value: "cotizaciones", label: "Presupuesto" },
                  { value: "ordenes", label: "Orden de trabajo" },
                ]}
              />
            </div>
            <div>
              <label className={form.label} htmlFor="documento-id">
                Documento
              </label>
              <SelectField
                id="documento-id"
                className={form.select}
                value={documentoId}
                disabled={working === "cargar-documentos"}
                onChange={(value) => setDocumentoId(value)}
                aria-label="Documento"
                options={[
                  { value: "", label: "Seleccionar…" },
                  ...(documentoTipo === "cotizaciones"
                    ? presupuestosDisponibles.map((item) => ({
                        value: item.id,
                        label: [
                          item.numero ?? "Sin emitir",
                          " ",
                          "·",
                          " ",
                          item.estado,
                        ].join(""),
                      }))
                    : ordenesDisponibles.map((item) => ({
                        value: item.id,
                        label: [item.numero, " ", "·", " ", item.estado].join(
                          "",
                        ),
                      }))),
                ]}
              />
            </div>
          </div>
        </div>
        <Modal.Footer className={form.footer}>
          <ActionButton
            variant="outline"
            onPress={() => setVincularOpen(false)}
          >
            Cancelar
          </ActionButton>
          <ActionButton
            isDisabled={!documentoId}
            isPending={working === "vincular"}
            onPress={() => void vincularDocumento()}
          >
            <Link2Icon data-icon="inline-start" /> Vincular
          </ActionButton>
        </Modal.Footer>
      </CampanaDialog>
    </main>
  );
}
