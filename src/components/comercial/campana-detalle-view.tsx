"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
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
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Archivo } from "@/lib/archivos";
import {
  cambiarEstadoCampana,
  crearHitoCampana,
  desvincularDocumentoCampana,
  editarCampana,
  editarHitoCampana,
  reemplazarEquipoCampana,
  vincularDocumentoCampana,
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

export function CampanaDetalleView({
  initial,
  initialArchivos,
  empleados,
  canManage,
}: {
  initial: CampanaDetalle;
  initialArchivos: Archivo[];
  empleados: EmpleadoOpcion[];
  canManage: boolean;
}) {
  const { moneda } = useConfigRegional();
  const [campana, setCampana] = React.useState(initial);
  const [archivos, setArchivos] = React.useState(initialArchivos);
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
    <main className={styles.page}>
      <div className={styles.breadcrumb}>
        <Link href="/comercial/campanas">
          <ArrowLeftIcon className="size-3" /> Campañas
        </Link>
        <span>/</span>
        <span className={styles.code}>{campana.codigo}</span>
      </div>
      <header className={styles.detailHeader}>
        <div>
          <p className={styles.eyebrow}>{campana.cliente.nombre}</p>
          <h1 className={styles.title}>{campana.nombre}</h1>
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
            <Button variant="outline" onClick={() => setEditarOpen(true)}>
              <Edit3Icon data-icon="inline-start" /> Editar
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setEquipoDraft(
                  Object.fromEntries(
                    campana.equipo.map((m) => [m.empleadoId, m.funcion ?? ""]),
                  ),
                );
                setEquipoOpen(true);
              }}
            >
              <UsersIcon data-icon="inline-start" /> Equipo
            </Button>
            <Button variant="outline" onClick={() => void abrirVincular()}>
              <Link2Icon data-icon="inline-start" /> Vincular
            </Button>
            {SIGUIENTES[campana.estado].map((estado) => {
              const Icon = ACCION[estado].icon;
              return (
                <Button
                  key={estado}
                  variant={
                    estado === "cancelado"
                      ? "destructive"
                      : estado === "activo" || estado === "completado"
                        ? "brand"
                        : "outline"
                  }
                  onClick={() => void cambiarEstado(estado)}
                  loading={working === estado}
                >
                  <Icon data-icon="inline-start" /> {ACCION[estado].label}
                </Button>
              );
            })}
          </div>
        ) : null}
      </header>

      <section className={styles.moneyBand} aria-label="Resumen comercial">
        <div className={styles.moneyCell}>
          <span className={styles.moneyLabel}>Valor de órdenes</span>
          <strong className={styles.moneyValue}>
            {money(comercial.vendido)}
          </strong>
        </div>
        <div className={styles.moneyCell}>
          <span className={styles.moneyLabel}>Presupuestado</span>
          <strong className={styles.moneyValue}>
            {money(comercial.presupuestado)}
          </strong>
        </div>
        <div className={styles.moneyCell}>
          <span className={styles.moneyLabel}>Facturado</span>
          <strong className={styles.moneyValue}>
            {money(comercial.facturado)}
          </strong>
        </div>
        <div className={styles.moneyCell}>
          <span className={styles.moneyLabel}>Cobrado</span>
          <strong className={styles.moneyValue}>
            {money(comercial.cobrado)}
          </strong>
        </div>
      </section>

      <div className={styles.detailGrid}>
        <div>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>Ruta de hitos</h2>
                <p className={styles.panelNote}>
                  Compromisos configurables y responsables.
                </p>
              </div>
              {canManage ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setHitoOpen(true)}
                >
                  <PlusIcon data-icon="inline-start" /> Agregar hito
                </Button>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1"
                          loading={working === hito.id}
                          onClick={() => void avanzarHito(hito)}
                        >
                          Avanzar
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.empty}>
                  <MilestoneIcon className="mx-auto mb-3 size-6" />
                  Todavía no se definieron hitos.
                </div>
              )}
            </div>
          </section>

          <section className={`${styles.panel} ${styles.tabs}`}>
            <Tabs defaultValue="ordenes">
              <TabsList variant="line" className={styles.tabsList}>
                <TabsTrigger value="ordenes">
                  Órdenes ({campana.ordenes.length})
                </TabsTrigger>
                <TabsTrigger value="presupuestos">
                  Presupuestos ({campana.cotizaciones.length})
                </TabsTrigger>
                <TabsTrigger value="archivos">
                  Archivos ({archivos.length})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="ordenes" className={styles.tabContent}>
                {campana.ordenes.length ? (
                  <Table className={styles.table}>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Orden</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Entrega</TableHead>
                        <TableHead>Avance</TableHead>
                        <TableHead>Total</TableHead>
                        {canManage ? <TableHead aria-label="Acciones" /> : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campana.ordenes.map((orden) => (
                        <TableRow key={orden.id}>
                          <TableCell>
                            <Link
                              className={styles.code}
                              href={`/produccion/ordenes/${orden.id}`}
                            >
                              {orden.numero}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <span
                              className={styles.status}
                              data-status={orden.estado}
                            >
                              {orden.estado}
                            </span>
                          </TableCell>
                          <TableCell>{fecha(orden.fechaEntrega)}</TableCell>
                          <TableCell className={styles.number}>
                            {orden.progresoPct == null
                              ? "—"
                              : `${orden.progresoPct}%`}
                          </TableCell>
                          <TableCell className={styles.number}>
                            {money(orden.total)}
                          </TableCell>
                          {canManage ? (
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                title="Desvincular orden"
                                loading={working === orden.id}
                                onClick={() =>
                                  void desvincularDocumento(
                                    "ordenes",
                                    orden.id,
                                    orden.numero,
                                  )
                                }
                              >
                                <UnlinkIcon />
                              </Button>
                            </TableCell>
                          ) : null}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className={styles.empty}>
                    Todavía no hay órdenes vinculadas.
                  </div>
                )}
              </TabsContent>
              <TabsContent value="presupuestos" className={styles.tabContent}>
                {campana.cotizaciones.length ? (
                  <Table className={styles.table}>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Presupuesto</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Emisión</TableHead>
                        <TableHead>Total</TableHead>
                        {canManage ? <TableHead aria-label="Acciones" /> : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campana.cotizaciones.map((presupuesto) => (
                        <TableRow key={presupuesto.id}>
                          <TableCell>
                            <Link
                              className={styles.code}
                              href={`/comercial/presupuestos/${presupuesto.id}`}
                            >
                              {presupuesto.numero ?? "Sin emitir"}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <span
                              className={styles.status}
                              data-status={presupuesto.estado}
                            >
                              {presupuesto.estado}
                            </span>
                          </TableCell>
                          <TableCell>
                            {fecha(presupuesto.fechaEmision)}
                          </TableCell>
                          <TableCell className={styles.number}>
                            {money(presupuesto.total)}
                          </TableCell>
                          {canManage ? (
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                title="Desvincular presupuesto"
                                loading={working === presupuesto.id}
                                onClick={() =>
                                  void desvincularDocumento(
                                    "cotizaciones",
                                    presupuesto.id,
                                    presupuesto.numero ??
                                      "Presupuesto sin emitir",
                                  )
                                }
                              >
                                <UnlinkIcon />
                              </Button>
                            </TableCell>
                          ) : null}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className={styles.empty}>
                    Todavía no hay presupuestos vinculados.
                  </div>
                )}
              </TabsContent>
              <TabsContent
                value="archivos"
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
                />
              </TabsContent>
            </Tabs>
          </section>
        </div>

        <aside>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Coordinación</h2>
            </div>
            <div className={styles.panelBody}>
              <dl className={styles.definitionList}>
                <div className={styles.definition}>
                  <dt>Responsable</dt>
                  <dd>{campana.responsable?.nombre ?? "Sin asignar"}</dd>
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
          </section>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Disponibilidad material</h2>
            </div>
            <div className={styles.panelBody}>
              <div className={styles.callout}>
                {campana.dashboard.materiales.mensaje}
              </div>
            </div>
          </section>
          {campana.dashboard.rentabilidad ? (
            <section className={styles.panel}>
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
            </section>
          ) : null}
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Actividad</h2>
            </div>
            <div className={styles.panelBody}>
              <div className={styles.timeline}>
                {campana.eventos.slice(0, 20).map((evento) => (
                  <div className={styles.event} key={evento.id}>
                    <p className={styles.eventText}>{evento.descripcion}</p>
                    <div className={styles.eventMeta}>
                      {evento.actor} ·{" "}
                      {new Intl.DateTimeFormat("es-AR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(evento.fecha))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </aside>
      </div>

      <Dialog open={hitoOpen} onOpenChange={setHitoOpen}>
        <DialogContent className={styles.dialog}>
          <DialogHeader className={styles.dialogHeader}>
            <DialogTitle>Agregar hito</DialogTitle>
            <DialogDescription>
              Definí un compromiso concreto dentro de la campaña.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={crearHito}>
            <div className={styles.dialogBody}>
              <FieldGroup className={styles.formGrid}>
                <Field className={styles.span2}>
                  <FieldLabel className={styles.label} htmlFor="hito-titulo">
                    Título <span className={styles.required}>*</span>
                  </FieldLabel>
                  <input
                    id="hito-titulo"
                    name="titulo"
                    className={styles.input}
                    required
                    maxLength={180}
                    placeholder="Arte final aprobado"
                  />
                </Field>
                <Field>
                  <FieldLabel className={styles.label} htmlFor="hito-fecha">
                    Fecha objetivo
                  </FieldLabel>
                  <input
                    id="hito-fecha"
                    name="fechaObjetivo"
                    type="date"
                    className={styles.input}
                  />
                </Field>
                <Field>
                  <FieldLabel
                    className={styles.label}
                    htmlFor="hito-responsable"
                  >
                    Responsable
                  </FieldLabel>
                  <select
                    id="hito-responsable"
                    name="responsableEmpleadoId"
                    className={styles.select}
                    defaultValue=""
                  >
                    <option value="">Sin asignar</option>
                    {empleados.map((empleado) => (
                      <option key={empleado.id} value={empleado.id}>
                        {empleado.nombreCompleto}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field className={styles.span2}>
                  <FieldLabel
                    className={styles.label}
                    htmlFor="hito-descripcion"
                  >
                    Descripción
                  </FieldLabel>
                  <textarea
                    id="hito-descripcion"
                    name="descripcion"
                    className={styles.textarea}
                    maxLength={1000}
                  />
                </Field>
              </FieldGroup>
              {hitoError ? (
                <p className={styles.error} role="alert">
                  {hitoError}
                </p>
              ) : null}
            </div>
            <DialogFooter className={styles.dialogFooter}>
              <Button
                type="button"
                variant="outline"
                onClick={() => setHitoOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className={styles.primaryButton}
                loading={working === "hito"}
                loadingText="Agregando…"
              >
                <PlusIcon data-icon="inline-start" /> Agregar hito
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editarOpen} onOpenChange={setEditarOpen}>
        <DialogContent className={styles.dialog}>
          <DialogHeader className={styles.dialogHeader}>
            <DialogTitle>Editar campaña</DialogTitle>
            <DialogDescription>
              Actualizá el encuadre comercial y las fechas de coordinación.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={guardarDatos}>
            <div className={styles.dialogBody}>
              <FieldGroup className={styles.formGrid}>
                <Field className={styles.span2}>
                  <FieldLabel className={styles.label} htmlFor="campana-nombre">
                    Nombre
                  </FieldLabel>
                  <input
                    id="campana-nombre"
                    name="nombre"
                    className={styles.input}
                    defaultValue={campana.nombre}
                    required
                    maxLength={180}
                  />
                </Field>
                <Field>
                  <FieldLabel className={styles.label} htmlFor="campana-tipo">
                    Tipo
                  </FieldLabel>
                  <input
                    id="campana-tipo"
                    name="tipo"
                    className={styles.input}
                    defaultValue={campana.tipo ?? ""}
                    maxLength={80}
                  />
                </Field>
                <Field>
                  <FieldLabel
                    className={styles.label}
                    htmlFor="campana-prioridad"
                  >
                    Prioridad
                  </FieldLabel>
                  <select
                    id="campana-prioridad"
                    name="prioridad"
                    className={styles.select}
                    defaultValue={campana.prioridad}
                  >
                    <option value="baja">Baja</option>
                    <option value="normal">Normal</option>
                    <option value="alta">Alta</option>
                    <option value="critica">Crítica</option>
                  </select>
                </Field>
                <Field>
                  <FieldLabel className={styles.label} htmlFor="campana-inicio">
                    Inicio
                  </FieldLabel>
                  <input
                    id="campana-inicio"
                    name="fechaInicio"
                    type="date"
                    className={styles.input}
                    defaultValue={campana.fechaInicio?.slice(0, 10) ?? ""}
                  />
                </Field>
                <Field>
                  <FieldLabel
                    className={styles.label}
                    htmlFor="campana-objetivo"
                  >
                    Objetivo
                  </FieldLabel>
                  <input
                    id="campana-objetivo"
                    name="fechaObjetivo"
                    type="date"
                    className={styles.input}
                    defaultValue={campana.fechaObjetivo?.slice(0, 10) ?? ""}
                  />
                </Field>
                <Field className={styles.span2}>
                  <FieldLabel
                    className={styles.label}
                    htmlFor="campana-responsable"
                  >
                    Responsable
                  </FieldLabel>
                  <select
                    id="campana-responsable"
                    name="responsableEmpleadoId"
                    className={styles.select}
                    defaultValue={campana.responsable?.id ?? ""}
                  >
                    <option value="">Sin asignar</option>
                    {empleados.map((empleado) => (
                      <option key={empleado.id} value={empleado.id}>
                        {empleado.nombreCompleto}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field className={styles.span2}>
                  <FieldLabel
                    className={styles.label}
                    htmlFor="campana-descripcion"
                  >
                    Descripción
                  </FieldLabel>
                  <textarea
                    id="campana-descripcion"
                    name="descripcion"
                    className={styles.textarea}
                    defaultValue={campana.descripcion ?? ""}
                    maxLength={2000}
                  />
                </Field>
                <Field className={styles.span2}>
                  <FieldLabel
                    className={styles.label}
                    htmlFor="campana-observaciones"
                  >
                    Observaciones
                  </FieldLabel>
                  <textarea
                    id="campana-observaciones"
                    name="observaciones"
                    className={styles.textarea}
                    defaultValue={campana.observaciones ?? ""}
                    maxLength={2000}
                  />
                </Field>
              </FieldGroup>
            </div>
            <DialogFooter className={styles.dialogFooter}>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditarOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className={styles.primaryButton}
                loading={working === "editar"}
              >
                Guardar cambios
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={equipoOpen} onOpenChange={setEquipoOpen}>
        <DialogContent className={styles.dialog}>
          <DialogHeader className={styles.dialogHeader}>
            <DialogTitle>Equipo de campaña</DialogTitle>
            <DialogDescription>
              Seleccioná las personas que coordinan o ejecutan esta campaña.
            </DialogDescription>
          </DialogHeader>
          <div className={styles.dialogBody}>
            <div className={styles.teamList}>
              {empleados.map((empleado) => {
                const seleccionado = Object.hasOwn(equipoDraft, empleado.id);
                return (
                  <div className={styles.teamRow} key={empleado.id}>
                    <label className={styles.teamPerson}>
                      <input
                        type="checkbox"
                        checked={seleccionado}
                        onChange={(event) =>
                          setEquipoDraft((actual) => {
                            const siguiente = { ...actual };
                            if (event.target.checked)
                              siguiente[empleado.id] = "";
                            else delete siguiente[empleado.id];
                            return siguiente;
                          })
                        }
                      />
                      <span>{empleado.nombreCompleto}</span>
                    </label>
                    <input
                      className={styles.input}
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
          <DialogFooter className={styles.dialogFooter}>
            <Button variant="outline" onClick={() => setEquipoOpen(false)}>
              Cancelar
            </Button>
            <Button
              className={styles.primaryButton}
              loading={working === "equipo"}
              onClick={() => void guardarEquipo()}
            >
              Guardar equipo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={vincularOpen} onOpenChange={setVincularOpen}>
        <DialogContent className={styles.dialog}>
          <DialogHeader className={styles.dialogHeader}>
            <DialogTitle>Vincular documento</DialogTitle>
            <DialogDescription>
              Solo se muestran documentos del mismo cliente y disponibles para
              esta campaña.
            </DialogDescription>
          </DialogHeader>
          <div className={styles.dialogBody}>
            <FieldGroup className={styles.formGrid}>
              <Field>
                <FieldLabel className={styles.label} htmlFor="documento-tipo">
                  Tipo
                </FieldLabel>
                <select
                  id="documento-tipo"
                  className={styles.select}
                  value={documentoTipo}
                  onChange={(event) => {
                    setDocumentoTipo(
                      event.target.value as "cotizaciones" | "ordenes",
                    );
                    setDocumentoId("");
                  }}
                >
                  <option value="cotizaciones">Presupuesto</option>
                  <option value="ordenes">Orden de trabajo</option>
                </select>
              </Field>
              <Field>
                <FieldLabel className={styles.label} htmlFor="documento-id">
                  Documento
                </FieldLabel>
                <select
                  id="documento-id"
                  className={styles.select}
                  value={documentoId}
                  disabled={working === "cargar-documentos"}
                  onChange={(event) => setDocumentoId(event.target.value)}
                >
                  <option value="">Seleccionar…</option>
                  {documentoTipo === "cotizaciones"
                    ? presupuestosDisponibles.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.numero ?? "Sin emitir"} · {item.estado}
                        </option>
                      ))
                    : ordenesDisponibles.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.numero} · {item.estado}
                        </option>
                      ))}
                </select>
              </Field>
            </FieldGroup>
          </div>
          <DialogFooter className={styles.dialogFooter}>
            <Button variant="outline" onClick={() => setVincularOpen(false)}>
              Cancelar
            </Button>
            <Button
              className={styles.primaryButton}
              disabled={!documentoId}
              loading={working === "vincular"}
              onClick={() => void vincularDocumento()}
            >
              <Link2Icon data-icon="inline-start" /> Vincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
