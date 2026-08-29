"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import { toast } from "sonner";
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
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Operaciones comerciales</p>
          <h1 className={styles.title}>Campañas</h1>
          <p className={styles.subtitle}>
            Una lectura consolidada de presupuestos, órdenes, hitos y entregas,
            sin alterar el flujo operativo de cada documento.
          </p>
        </div>
        {canManage ? (
          <Button
            className={styles.primaryButton}
            onClick={() => setOpen(true)}
          >
            <PlusIcon data-icon="inline-start" /> Nueva campaña
          </Button>
        ) : null}
      </header>

      <section className={styles.kpis} aria-label="Resumen de campañas">
        <article className={styles.kpiHero}>
          <span className={styles.kpiLabel}>Campañas activas</span>
          <strong className={styles.kpiValue}>{activas}</strong>
          <span className={styles.kpiNote}>
            {listado.total} campañas en el registro
          </span>
        </article>
        <article className={styles.kpi}>
          <span className={styles.kpiLabel}>En riesgo</span>
          <strong className={styles.kpiValue}>{listado.stats.enRiesgo}</strong>
          <span className={styles.kpiNote}>Fecha o hito vencido</span>
        </article>
        <article className={styles.kpi}>
          <span className={styles.kpiLabel}>Próximas 7 días</span>
          <strong className={styles.kpiValue}>
            {listado.stats.proximasAVencer}
          </strong>
          <span className={styles.kpiNote}>Con compromiso cercano</span>
        </article>
        <article className={styles.kpi}>
          <span className={styles.kpiLabel}>Completadas</span>
          <strong className={styles.kpiValue}>{completadas}</strong>
          <span className={styles.kpiNote}>Cierre explícito y auditado</span>
        </article>
      </section>

      <section className={styles.surface}>
        <div className={styles.toolbar}>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className={styles.input}
              style={{ paddingLeft: 34 }}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void buscar()}
              placeholder="Código, campaña, tipo o cliente"
              aria-label="Buscar campañas"
            />
          </div>
          <select
            className={styles.select}
            value={estado}
            onChange={(e) => setEstado(e.target.value as CampanaEstado | "")}
            aria-label="Filtrar por estado"
          >
            <option value="">Todos los estados</option>
            {ESTADOS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <select
              className={styles.select}
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              aria-label="Filtrar por cliente"
            >
              <option value="">Todos los clientes</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nombre}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              onClick={() => void buscar()}
              loading={loading}
              aria-label="Aplicar filtros"
            >
              <SearchIcon />
            </Button>
          </div>
        </div>

        {listado.data.length ? (
          <Table className={styles.table}>
            <TableHeader>
              <TableRow>
                <TableHead>Campaña</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead>Compromiso</TableHead>
                <TableHead>Avance</TableHead>
                <TableHead>Documentos</TableHead>
                <TableHead>
                  <span className="sr-only">Abrir</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listado.data.map((campana) => (
                <TableRow key={campana.id} className={styles.row}>
                  <TableCell>
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
                  </TableCell>
                  <TableCell>{campana.cliente.nombre}</TableCell>
                  <TableCell>
                    <span
                      className={styles.status}
                      data-status={campana.estado}
                    >
                      {campana.estado}
                    </span>
                    {campana.riesgo ? (
                      <span className={`${styles.secondary} ${styles.risk}`}>
                        <AlertTriangleIcon className="mr-1 inline size-3" /> En
                        riesgo
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {campana.responsable?.nombre ?? "Sin asignar"}
                  </TableCell>
                  <TableCell className={styles.number}>
                    {fechaCorta(campana.fechaObjetivo)}
                  </TableCell>
                  <TableCell>
                    <span className={styles.number}>
                      {campana.avancePct == null
                        ? "—"
                        : `${campana.avancePct}%`}
                    </span>
                    <div className={styles.progressTrack} aria-hidden="true">
                      <div
                        className={styles.progressBar}
                        style={{ width: `${campana.avancePct ?? 0}%` }}
                      />
                    </div>
                  </TableCell>
                  <TableCell className={styles.number}>
                    {campana.cantidad.cotizaciones} PRES ·{" "}
                    {campana.cantidad.ordenes} OT
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      nativeButton={false}
                      render={
                        <Link href={`/comercial/campanas/${campana.id}`} />
                      }
                    >
                      <ArrowRightIcon />
                      <span className="sr-only">Abrir {campana.nombre}</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className={styles.empty}>
            <strong>No hay campañas con estos filtros.</strong>
            <p className="mt-2 text-sm">
              Probá ampliar la búsqueda o creá la primera campaña.
            </p>
          </div>
        )}
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={styles.dialog}>
          <DialogHeader className={styles.dialogHeader}>
            <DialogTitle>Nueva campaña</DialogTitle>
            <DialogDescription>
              Creá la unidad de coordinación. Los presupuestos y OTs se pueden
              vincular después.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={crear}>
            <div className={styles.dialogBody}>
              <FieldGroup className={styles.formGrid}>
                <Field className={styles.span2}>
                  <FieldLabel className={styles.label} htmlFor="camp-cliente">
                    Cliente <span className={styles.required}>*</span>
                  </FieldLabel>
                  <select
                    id="camp-cliente"
                    name="clienteId"
                    className={styles.select}
                    required
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Seleccionar cliente
                    </option>
                    {clientes.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.nombre}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field className={styles.span2}>
                  <FieldLabel className={styles.label} htmlFor="camp-nombre">
                    Nombre <span className={styles.required}>*</span>
                  </FieldLabel>
                  <input
                    id="camp-nombre"
                    name="nombre"
                    className={styles.input}
                    required
                    maxLength={180}
                    placeholder="Carrefour — Vuelta a Clases 2027"
                  />
                </Field>
                <Field>
                  <FieldLabel className={styles.label} htmlFor="camp-tipo">
                    Tipo
                  </FieldLabel>
                  <input
                    id="camp-tipo"
                    name="tipo"
                    className={styles.input}
                    maxLength={80}
                    placeholder="Lanzamiento, temporada…"
                  />
                </Field>
                <Field>
                  <FieldLabel className={styles.label} htmlFor="camp-prioridad">
                    Prioridad
                  </FieldLabel>
                  <select
                    id="camp-prioridad"
                    name="prioridad"
                    className={styles.select}
                    defaultValue="normal"
                  >
                    {PRIORIDADES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field>
                  <FieldLabel className={styles.label} htmlFor="camp-inicio">
                    Fecha de inicio
                  </FieldLabel>
                  <input
                    id="camp-inicio"
                    name="fechaInicio"
                    type="date"
                    className={styles.input}
                  />
                </Field>
                <Field>
                  <FieldLabel className={styles.label} htmlFor="camp-objetivo">
                    Fecha objetivo
                  </FieldLabel>
                  <input
                    id="camp-objetivo"
                    name="fechaObjetivo"
                    type="date"
                    className={styles.input}
                  />
                </Field>
                <Field className={styles.span2}>
                  <FieldLabel
                    className={styles.label}
                    htmlFor="camp-responsable"
                  >
                    Responsable
                  </FieldLabel>
                  <select
                    id="camp-responsable"
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
                    htmlFor="camp-descripcion"
                  >
                    Descripción
                  </FieldLabel>
                  <textarea
                    id="camp-descripcion"
                    name="descripcion"
                    className={styles.textarea}
                    maxLength={2000}
                    placeholder="Alcance y contexto que debe conservar el equipo."
                  />
                </Field>
              </FieldGroup>
              {error ? (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              ) : null}
            </div>
            <DialogFooter className={styles.dialogFooter}>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className={styles.primaryButton}
                loading={guardando}
                loadingText="Creando…"
              >
                <PlusIcon data-icon="inline-start" /> Crear campaña
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
