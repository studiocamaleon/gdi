"use client";

import { Card, Input, TextArea, Modal, SearchField } from "@heroui/react";
import { ActionButton } from "@/components/design-system/action-button";
import { SelectField } from "@/components/design-system/select-field";
import { CampanaDialog } from "./campana-dialog";
import focus from "@/components/design-system/field-focus.module.css";
import form from "./campana-form.module.css";

import { ProgresoValor } from "@/components/produccion/progreso-produccion";
import * as React from "react";
import Link from "next/link";
import { ActionLink } from "@/components/design-system/action-link";
import { useRouter } from "next/navigation";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  PlusIcon,
  MegaphoneIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  SearchIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { ClienteDetalle } from "@/lib/clientes";
import type { EmpleadoOpcion } from "@/lib/empleados";
import {
  crearCampana,
  listarCampanas,
  type CampanaEstado,
  type CampanaPrioridad,
  type CampanasListado,
} from "@/lib/campanas-api";
import styles from "./campanas.module.css";
import layout from "@/components/design-system/list-page.module.css";
import theme from "@/components/design-system/theme.module.css";
import { useDesignScope } from "@/components/design-system/appearance";
import { ListMetric } from "@/components/design-system/list-metric";
import { IdentityAvatar } from "@/components/design-system/identity-avatar";

const ESTADOS: Array<{ value: CampanaEstado; label: string }> = [
  { value: "borrador", label: "Borrador" },
  { value: "activo", label: "Activa" },
  { value: "pausado", label: "Pausada" },
  { value: "completado", label: "Completada" },
  { value: "cancelado", label: "Cancelada" },
];

const PRIORIDADES: Array<{ value: CampanaPrioridad; label: string }> = [
  { value: "normal", label: "Normal" },
  { value: "baja", label: "Baja" },
  { value: "alta", label: "Alta" },
  { value: "critica", label: "Crítica" },
];

function fechaCorta(value: string | null) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function CampanasView({
  initial,
  clientes,
  empleados,
  canManage,
  initialClienteId = "",
}: {
  initial: CampanasListado;
  clientes: ClienteDetalle[];
  empleados: EmpleadoOpcion[];
  canManage: boolean;
  initialClienteId?: string;
}) {
  const scope = useDesignScope();
  const router = useRouter();
  const [listado, setListado] = React.useState(initial);
  const [q, setQ] = React.useState("");
  const [estado, setEstado] = React.useState<CampanaEstado | "">("");
  const [clienteId, setClienteId] = React.useState(initialClienteId);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [guardando, setGuardando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const buscar = React.useCallback(async () => {
    setLoading(true);
    try {
      setListado(
        await listarCampanas({
          q: q.trim() || undefined,
          estado: estado || undefined,
          clienteId: clienteId || undefined,
          limit: 100,
        }),
      );
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "No se pudieron cargar las campañas.",
      );
    } finally {
      setLoading(false);
    }
  }, [clienteId, estado, q]);

  async function crear(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGuardando(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    try {
      const nueva = await crearCampana({
        clienteId: String(data.get("clienteId")),
        nombre: String(data.get("nombre")),
        tipo: String(data.get("tipo") || "") || undefined,
        prioridad: String(
          data.get("prioridad") || "normal",
        ) as CampanaPrioridad,
        fechaInicio: String(data.get("fechaInicio") || "") || undefined,
        fechaObjetivo: String(data.get("fechaObjetivo") || "") || undefined,
        responsableEmpleadoId:
          String(data.get("responsableEmpleadoId") || "") || undefined,
        descripcion: String(data.get("descripcion") || "") || undefined,
      });
      toast.success(`${nueva.codigo} creada.`);
      setOpen(false);
      router.push(`/comercial/campanas/${nueva.id}`);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo crear la campaña.",
      );
    } finally {
      setGuardando(false);
    }
  }

  const activas = listado.stats.porEstado.activo ?? 0;
  const completadas = listado.stats.porEstado.completado ?? 0;

  return (
    <main {...scope} className={`${theme.theme} ${layout.page}`}>
      <header className={layout.header}>
        <div>
          <h1>Campañas</h1>
          <p className={layout.subtitle}>
            Una lectura consolidada de presupuestos, órdenes, hitos y entregas,
            sin alterar el flujo operativo de cada documento.
          </p>
        </div>
        {canManage ? (
          <ActionButton onPress={() => setOpen(true)}>
            <PlusIcon data-icon="inline-start" /> Nueva campaña
          </ActionButton>
        ) : null}
      </header>

      <section className={styles.kpis} aria-label="Resumen de campañas">
        <ListMetric
          label="Campañas activas"
          value={activas}
          hint={`${listado.total} campañas en el registro`}
          icon={MegaphoneIcon}
          tone="brand"
        />
        <ListMetric
          label="En riesgo"
          value={listado.stats.enRiesgo}
          hint="Fecha o hito vencido"
          icon={AlertTriangleIcon}
          tone={listado.stats.enRiesgo > 0 ? "danger" : "neutral"}
        />
        <ListMetric
          label="Próximas 7 días"
          value={listado.stats.proximasAVencer}
          hint="Con compromiso cercano"
          icon={CalendarClockIcon}
        />
        <ListMetric
          label="Completadas"
          value={completadas}
          hint="Cierre explícito y auditado"
          icon={CheckCircle2Icon}
        />
      </section>

      <Card className={layout.results}>
        <div className={styles.toolbar}>
          <SearchField
            aria-label="Buscar campañas"
            value={q}
            onChange={setQ}
            className={styles.search}
          >
            <SearchField.Group
              className={`${layout.searchGroup} ${focus.singleBorder}`}
            >
              <SearchField.SearchIcon />
              <SearchField.Input
                onKeyDown={(e) => e.key === "Enter" && void buscar()}
                placeholder="Código, campaña, tipo o cliente"
              />
            </SearchField.Group>
          </SearchField>
          <SelectField
            className={form.select}
            value={estado}
            onChange={(value) => setEstado(value as CampanaEstado | "")}
            aria-label="Filtrar por estado"
            options={[
              { value: "", label: "Todos los estados" },
              ...ESTADOS.map((item) => ({
                value: item.value,
                label: item.label,
              })),
            ]}
          />
          <div className={styles.clientFilter}>
            <SelectField
              className={form.select}
              value={clienteId}
              onChange={(value) => setClienteId(value)}
              aria-label="Filtrar por cliente"
              options={[
                { value: "", label: "Todos los clientes" },
                ...clientes.map((cliente) => ({
                  value: cliente.id,
                  label: cliente.nombre,
                })),
              ]}
            />
            <ActionButton
              variant="outline"
              onPress={() => void buscar()}
              isPending={loading}
              aria-label="Aplicar filtros"
              title="Aplicar filtros"
              isIconOnly
            >
              <SearchIcon />
            </ActionButton>
          </div>
        </div>

        {listado.data.length ? (
          <div
            className={styles.tableScroll}
            tabIndex={0}
            role="region"
            aria-label="Listado de campañas"
          >
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Campaña</th>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th>Responsable</th>
                  <th>Compromiso</th>
                  <th>Avance</th>
                  <th>Documentos</th>
                  <th>
                    <span className="sr-only">Abrir</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {listado.data.map((campana) => (
                  <tr key={campana.id}>
                    <td>
                      <span className={styles.code}>{campana.codigo}</span>
                      <Link
                        className={styles.name}
                        href={`/comercial/campanas/${campana.id}`}
                      >
                        {campana.nombre}
                      </Link>
                      <span className={styles.secondary}>
                        {campana.tipo ?? "Sin tipo"}
                      </span>
                    </td>
                    <td>{campana.cliente.nombre}</td>
                    <td>
                      <span
                        className={styles.status}
                        data-status={campana.estado}
                      >
                        {campana.estado}
                      </span>
                      {campana.riesgo ? (
                        <span className={`${styles.secondary} ${styles.risk}`}>
                          <AlertTriangleIcon className="mr-1 inline size-3" />{" "}
                          En riesgo
                        </span>
                      ) : null}
                    </td>
                    <td>
                      {campana.responsable ? (
                        <span className={layout.seller}>
                          <IdentityAvatar name={campana.responsable.nombre} />
                          <span>{campana.responsable.nombre}</span>
                        </span>
                      ) : (
                        <span className={styles.secondary}>Sin asignar</span>
                      )}
                    </td>
                    <td className={styles.number}>
                      {fechaCorta(campana.fechaObjetivo)}
                    </td>
                    <td>
                      <span className={styles.number}>
                        <ProgresoValor
                          progreso={campana.progreso}
                          valor={campana.avancePct}
                        />
                      </span>
                      <div className={styles.progressTrack} aria-hidden="true">
                        <div
                          className={styles.progressBar}
                          style={{ width: `${campana.avancePct ?? 0}%` }}
                        />
                      </div>
                    </td>
                    <td className={styles.number}>
                      {campana.cantidad.cotizaciones} PRES ·{" "}
                      {campana.cantidad.ordenes} OT
                    </td>
                    <td>
                      <ActionLink
                        variant="ghost"
                        href={`/comercial/campanas/${campana.id}`}
                        className="w-8 px-0"
                        aria-label={`Abrir ${campana.nombre}`}
                      >
                        <ArrowRightIcon size={15} aria-hidden />
                      </ActionLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={layout.empty}>
            <strong>No hay campañas con estos filtros.</strong>
            <p className="mt-2 text-sm">
              Probá ampliar la búsqueda o creá la primera campaña.
            </p>
          </div>
        )}
      </Card>

      <CampanaDialog
        isOpen={open}
        onOpenChange={setOpen}
        title={<>Nueva campaña</>}
        description={
          <>
            Creá la unidad de coordinación. Los presupuestos y OTs se pueden
            vincular después.
          </>
        }
      >
        <form onSubmit={crear}>
          <div className={form.body}>
            <div className={form.grid}>
              <div className={form.span2}>
                <label className={form.label} htmlFor="camp-cliente">
                  Cliente <span className={form.required}>*</span>
                </label>
                <SelectField
                  id="camp-cliente"
                  name="clienteId"
                  className={form.select}
                  required
                  defaultValue=""
                  aria-label="Cliente"
                  options={[
                    { value: "", label: "Seleccionar cliente", disabled: true },
                    ...clientes.map((cliente) => ({
                      value: cliente.id,
                      label: cliente.nombre,
                    })),
                  ]}
                />
              </div>
              <div className={form.span2}>
                <label className={form.label} htmlFor="camp-nombre">
                  Nombre <span className={form.required}>*</span>
                </label>
                <Input
                  id="camp-nombre"
                  name="nombre"
                  className={`${form.input} ${focus.singleBorder}`}
                  required
                  maxLength={180}
                  placeholder="Carrefour — Vuelta a Clases 2027"
                />
              </div>
              <div>
                <label className={form.label} htmlFor="camp-tipo">
                  Tipo
                </label>
                <Input
                  id="camp-tipo"
                  name="tipo"
                  className={`${form.input} ${focus.singleBorder}`}
                  maxLength={80}
                  placeholder="Lanzamiento, temporada…"
                />
              </div>
              <div>
                <label className={form.label} htmlFor="camp-prioridad">
                  Prioridad
                </label>
                <SelectField
                  id="camp-prioridad"
                  name="prioridad"
                  className={form.select}
                  defaultValue="normal"
                  aria-label="Prioridad"
                  options={[
                    ...PRIORIDADES.map((item) => ({
                      value: item.value,
                      label: item.label,
                    })),
                  ]}
                />
              </div>
              <div>
                <label className={form.label} htmlFor="camp-inicio">
                  Fecha de inicio
                </label>
                <Input
                  id="camp-inicio"
                  name="fechaInicio"
                  type="date"
                  className={`${form.input} ${focus.singleBorder}`}
                />
              </div>
              <div>
                <label className={form.label} htmlFor="camp-objetivo">
                  Fecha objetivo
                </label>
                <Input
                  id="camp-objetivo"
                  name="fechaObjetivo"
                  type="date"
                  className={`${form.input} ${focus.singleBorder}`}
                />
              </div>
              <div className={form.span2}>
                <label className={form.label} htmlFor="camp-responsable">
                  Responsable
                </label>
                <SelectField
                  id="camp-responsable"
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
                <label className={form.label} htmlFor="camp-descripcion">
                  Descripción
                </label>
                <TextArea
                  id="camp-descripcion"
                  name="descripcion"
                  className={`${form.textarea} ${focus.singleBorder}`}
                  maxLength={2000}
                  placeholder="Alcance y contexto que debe conservar el equipo."
                />
              </div>
            </div>
            {error ? (
              <p className={form.error} role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <Modal.Footer className={form.footer}>
            <ActionButton
              type="button"
              variant="outline"
              onPress={() => setOpen(false)}
            >
              Cancelar
            </ActionButton>
            <ActionButton type="submit" isPending={guardando}>
              <PlusIcon data-icon="inline-start" /> Crear campaña
            </ActionButton>
          </Modal.Footer>
        </form>
      </CampanaDialog>
    </main>
  );
}
