"use client";

import fieldFocus from "@/components/design-system/field-focus.module.css";
import { CupoSuscripcionPanel } from "./cupo-suscripcion-panel";
import { ContratacionesPanel } from "./contrataciones-panel";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, RefreshCw, Search } from "lucide-react";
import { apiRequest } from "@/lib/api";
import {
  consultarPaddlePlataforma,
  type DetalleSuscripcion,
  type HistorialConsultasPaddle,
  type IntegracionPaddle,
  type OperacionPaddle,
  type PaginaEventosSuscripcion,
  type PaginaSuscripciones,
} from "@/lib/plataforma-suscripciones-api";
import { ActionButton } from "@/components/design-system/action-button";
import { ActionLink } from "@/components/design-system/action-link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@heroui/react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FormDialog } from "@/components/design-system/form-dialog";
import { SelectField } from "@/components/design-system/select-field";
import theme from "@/components/design-system/brand-workspace-theme.module.css";
import styles from "./empresas.module.css";

const etiquetas: Record<string, string> = {
  active: "Activa",
  trialing: "En prueba",
  past_due: "Pago pendiente",
  paused: "Pausada",
  canceled: "Cancelada",
  activa: "Activa",
  suspendida: "Inactiva",
  baja: "Dada de baja",
  manual: "Manual",
  paddle: "Paddle",
  cancel: "Cancelación",
  pause: "Pausa",
  resume: "Reanudación",
  aplicado: "Aplicado",
  ignorado: "Informativo",
  sin_aplicar: "Sin aplicar",
  fallido: "Falló el procesamiento",
  pendiente: "Pendiente",
  completada: "Actualizada",
  fallida: "Consulta fallida",
  en_curso: "En curso",
  interrumpida: "Sin resultado",
  revisar: "Revisar plan",
  operativo: "Operativa",
  solo_lectura: "Solo lectura",
  bloqueado: "Bloqueada",
};
const etiqueta = (v?: string | null) =>
  v ? (etiquetas[v] ?? v) : "Sin registro";
const fecha = (v?: string | null) =>
  v
    ? new Date(v).toLocaleString("es-AR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "Sin registro";
function useConsulta<T>(url: string, version = 0) {
  const [intento, setIntento] = useState(0);
  const clave = `${url}:${version}:${intento}`;
  const [respuesta, setRespuesta] = useState<{
    clave: string;
    datos?: T;
    error?: string;
  }>();
  useEffect(() => {
    let vigente = true;
    apiRequest<T>(url, { cache: "no-store" })
      .then((datos) => {
        if (vigente) setRespuesta({ clave, datos });
      })
      .catch((e) => {
        if (vigente)
          setRespuesta({
            clave,
            error:
              e instanceof Error
                ? e.message
                : "No se pudo cargar la información.",
          });
      });
    return () => {
      vigente = false;
    };
  }, [clave, url]);
  return {
    datos: respuesta?.clave === clave ? respuesta.datos : undefined,
    error: respuesta?.clave === clave ? respuesta.error : undefined,
    reintentar: () => setIntento((v) => v + 1),
  };
}
function Carga({
  error,
  reintentar,
}: {
  error?: string;
  reintentar: () => void;
}) {
  return error ? (
    <Alert variant="destructive">
      <AlertTitle>No se pudo cargar</AlertTitle>
      <AlertDescription>
        {error}
        <ActionButton variant="outline" onPress={reintentar}>
          Reintentar
        </ActionButton>
      </AlertDescription>
    </Alert>
  ) : (
    <div
      role="status"
      aria-label="Cargando suscripciones"
      className={styles.loading}
    >
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-44 w-full" />
    </div>
  );
}
function Paginas({
  pagina,
  total,
  limite,
  cambiar,
}: {
  pagina: number;
  total: number;
  limite: number;
  cambiar: (p: number) => void;
}) {
  return (
    <div className={styles.pagination}>
      <span>
        {total} registros · Página {pagina} de{" "}
        {Math.max(1, Math.ceil(total / limite))}
      </span>
      <div>
        <ActionButton
          variant="outline"
          size="sm"
          isDisabled={pagina <= 1}
          onPress={() => cambiar(pagina - 1)}
        >
          Anterior
        </ActionButton>
        <ActionButton
          variant="outline"
          size="sm"
          isDisabled={pagina * limite >= total}
          onPress={() => cambiar(pagina + 1)}
        >
          Siguiente
        </ActionButton>
      </div>
    </div>
  );
}
function Integracion({ datos }: { datos: IntegracionPaddle }) {
  return (
    <div className={styles.toolbar} aria-label="Configuración de Paddle">
      <Badge variant="outline">
        Paddle · {datos.entorno === "produccion" ? "Producción" : "Sandbox"}
      </Badge>
      <span className={styles.secondary}>
        API {datos.apiConfigurada ? "configurada" : "sin configurar"} · Firma de
        eventos {datos.firmaConfigurada ? "configurada" : "sin configurar"}
      </span>
    </div>
  );
}
function Estado({ valor }: { valor: string }) {
  return (
    <Badge
      variant={
        ["fallida", "fallido", "bloqueado"].includes(valor)
          ? "destructive"
          : "secondary"
      }
    >
      {etiqueta(valor)}
    </Badge>
  );
}

export function SuscripcionesView({ esAdmin }: { esAdmin: boolean }) {
  const params = useSearchParams();
  const id = params.get("suscripcion");
  return (
    <div className={styles.page} data-ui="heroui">
      {id ? (
        <FichaSuscripcion key={id} id={id} esAdmin={esAdmin} />
      ) : (
        <ListadoSuscripciones />
      )}
    </div>
  );
}
function ListadoSuscripciones() {
  const params = useSearchParams();
  const router = useRouter();
  const q = params.get("q") ?? "";
  const [busqueda, setBusqueda] = useState(q);
  const pagina = Math.max(1, Number(params.get("pagina")) || 1);
  const caso = [
    "atencion",
    "mora",
    "prueba",
    "desactualizada",
    "bloqueada",
  ].includes(params.get("caso") ?? "")
    ? params.get("caso")!
    : "";
  const proveedor = ["paddle", "manual"].includes(params.get("proveedor") ?? "")
    ? params.get("proveedor")!
    : "";
  const query = new URLSearchParams({ pagina: String(pagina), limite: "25" });
  if (q) query.set("q", q);
  if (caso) query.set("caso", caso);
  if (proveedor) query.set("proveedor", proveedor);
  const { datos, error, reintentar } = useConsulta<PaginaSuscripciones>(
    `/plataforma/suscripciones?${query}`,
  );
  const cambiar = (cambios: Record<string, string>) => {
    const siguiente = new URLSearchParams(params.toString());
    siguiente.delete("pagina");
    for (const [k, v] of Object.entries(cambios)) {
      if (v) siguiente.set(k, v);
      else siguiente.delete(k);
    }
    router.push(`/plataforma?${siguiente}`);
  };
  return (
    <>
      <div className={styles.toolbar}>
        <form
          className={styles.search}
          onSubmit={(e) => {
            e.preventDefault();
            cambiar({ q: busqueda.trim() });
          }}
        >
          <Input
            className={fieldFocus.singleBorder}
            fullWidth
            aria-label="Buscar suscripción"
            placeholder="Empresa o referencia de Paddle"
            value={busqueda}
            maxLength={100}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <ActionButton variant="outline" type="submit">
            <Search data-icon="inline-start" />
            Buscar
          </ActionButton>
        </form>
        <SelectField
          aria-label="Situación de suscripción"
          className={styles.filter}
          value={caso}
          onChange={(v) => cambiar({ caso: v })}
          options={[
            { value: "", label: "Todas las situaciones" },
            { value: "atencion", label: "Requieren atención" },
            { value: "mora", label: "Pago pendiente" },
            { value: "prueba", label: "Con prueba registrada" },
            { value: "desactualizada", label: "Consulta pendiente" },
            { value: "bloqueada", label: "Bloqueo administrativo" },
          ]}
        />
        <SelectField
          aria-label="Origen de suscripción"
          value={proveedor}
          onChange={(v) => cambiar({ proveedor: v })}
          options={[
            { value: "", label: "Todos los orígenes" },
            { value: "paddle", label: "Paddle" },
            { value: "manual", label: "Manual" },
          ]}
        />
        <ActionButton variant="outline" onPress={reintentar}>
          <RefreshCw data-icon="inline-start" />
          Actualizar
        </ActionButton>
      </div>
      {!datos ? (
        <Carga error={error} reintentar={reintentar} />
      ) : (
        <>
          <Integracion datos={datos.integracion} />
          <section
            className={styles.panel}
            aria-label="Suscripciones de las empresas"
          >
            {datos.suscripciones.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa / plan</TableHead>
                    <TableHead>Suscripción</TableHead>
                    <TableHead>Acceso en Grafo</TableHead>
                    <TableHead>Próxima fecha</TableHead>
                    <TableHead>Última consulta</TableHead>
                    <TableHead>Atención</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datos.suscripciones.map((s) => {
                    const href = new URLSearchParams(params.toString());
                    href.set("suscripcion", s.id);
                    return (
                      <TableRow key={s.id}>
                        <TableCell>
                          <div className={styles.company}>
                            <div>
                              <Link href={`/plataforma?${href}`}>
                                {s.empresa.nombre}
                              </Link>
                              <small>{s.plan.nombre}</small>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {etiqueta(s.estadoProveedor ?? s.estado)}
                          <small className={styles.secondary}>
                            {etiqueta(s.proveedor)}
                          </small>
                        </TableCell>
                        <TableCell>
                          <Estado valor={s.acceso.modo} />
                        </TableCell>
                        <TableCell>
                          {fecha(
                            s.graciaHasta ??
                              s.trialHasta ??
                              s.cambioProgramadoEl ??
                              s.proximoCobro,
                          )}
                          <small className={styles.secondary}>
                            {s.graciaHasta
                              ? "Fin de gracia"
                              : s.trialHasta
                                ? "Fin de prueba"
                                : s.cambioProgramadoEl
                                  ? etiqueta(s.cambioProgramado)
                                  : s.proximoCobro
                                    ? "Próximo cobro"
                                    : ""}
                          </small>
                        </TableCell>
                        <TableCell>
                          {s.proveedor === "paddle"
                            ? fecha(s.ultimaConsulta)
                            : "No aplica"}
                        </TableCell>
                        <TableCell className={styles.explanation}>
                          {s.senales.map((x) => x.titulo).join(" · ") ||
                            "Sin señales pendientes"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Sin suscripciones para esta búsqueda</EmptyTitle>
                  <EmptyDescription>
                    Probá otro nombre o filtro. Las empresas anteriores a los
                    planes, sin suscripción asignada, se consultan en Empresas.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </section>
          <Paginas {...datos} cambiar={(p) => cambiar({ pagina: String(p) })} />
          <p className={styles.note}>
            Datos guardados en Grafo · Consultados {fecha(datos.consultadoEl)}.
            “Consulta pendiente” indica más de 30 minutos sin una lectura
            exitosa de Paddle; los eventos recibidos se muestran por separado.
          </p>
        </>
      )}
    </>
  );
}
function Dato({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className={styles.datum}>
      <dt>{titulo}</dt>
      <dd>{children}</dd>
    </div>
  );
}
function FichaSuscripcion({ id, esAdmin }: { id: string; esAdmin: boolean }) {
  const params = useSearchParams();
  const [version, setVersion] = useState(0);
  const [consulta, setConsulta] = useState(false);
  const {
    datos: s,
    error,
    reintentar,
  } = useConsulta<DetalleSuscripcion>(
    `/plataforma/suscripciones/${id}`,
    version,
  );
  const volver = new URLSearchParams(params.toString());
  volver.delete("suscripcion");
  if (!s)
    return (
      <>
        <Link href={`/plataforma?${volver}`}>
          <ArrowLeft size={16} />
          Volver a suscripciones
        </Link>
        <Carga error={error} reintentar={reintentar} />
      </>
    );
  return (
    <>
      <div className={styles.toolbar}>
        <ActionLink variant="ghost" href={`/plataforma?${volver}`}>
          <ArrowLeft size={16} /> Volver a suscripciones
        </ActionLink>
      </div>
      <div className={styles.companyHeader}>
        <div>
          <h2>{s.empresa.nombre}</h2>
          <p>
            {s.plan.nombre} · {etiqueta(s.proveedor)}
          </p>
        </div>
        <div className={styles.toolbar}>
          <ActionLink
            variant="outline"
            href={`/plataforma?vista=tenants&empresa=${s.empresa.id}`}
          >
            Ver empresa
          </ActionLink>
          <ActionButton
            variant="outline"
            onPress={() => setVersion((v) => v + 1)}
          >
            <RefreshCw data-icon="inline-start" />
            Actualizar vista
          </ActionButton>
          {esAdmin && s.puedeConsultar && (
            <ActionButton onPress={() => setConsulta(true)}>
              <RefreshCw data-icon="inline-start" />
              Consultar Paddle
            </ActionButton>
          )}
        </div>
      </div>
      <Tabs defaultValue="resumen">
        <div className={styles.tabScroll}>
          <TabsList variant="graphite" aria-label="Detalle de suscripción">
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="cupos">Usuarios y cupos</TabsTrigger>
            <TabsTrigger value="contrataciones">Contrataciones</TabsTrigger>
            <TabsTrigger value="eventos">Eventos de Paddle</TabsTrigger>
            <TabsTrigger value="consultas">Historial de consultas</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="resumen" className={styles.tabContent}>
          <Alert
            variant={s.acceso.modo === "bloqueado" ? "destructive" : "default"}
          >
            <AlertTitle>Acceso en Grafo · {etiqueta(s.acceso.modo)}</AlertTitle>
            <AlertDescription>
              {s.acceso.descripcion}
              {s.acceso.modo === "bloqueado" && (
                <p>
                  Actualizar el estado de Paddle conserva este bloqueo
                  administrativo.
                </p>
              )}
            </AlertDescription>
          </Alert>
          {s.senales.length > 0 && (
            <section className={styles.panel} aria-label="Diagnóstico">
              <div className={styles.panelHeader}>
                <h3>Qué requiere atención</h3>
              </div>
              <div className={styles.panelBody}>
                <ul className={styles.timeline}>
                  {s.senales.map((x) => (
                    <li key={x.codigo}>
                      <strong>{x.titulo}</strong>
                      <p>{x.detalle}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
          <div className={styles.columns}>
            <section
              className={styles.panel}
              aria-label="Estado de suscripción"
            >
              <div className={styles.panelHeader}>
                <h3>Suscripción</h3>
              </div>
              <div className={styles.panelBody}>
                <dl className={styles.details}>
                  <Dato titulo="Estado en Paddle">
                    {s.proveedor === "paddle"
                      ? etiqueta(s.estadoProveedor)
                      : "No aplica"}
                  </Dato>
                  <Dato titulo="Estado en Grafo">{etiqueta(s.estado)}</Dato>
                  <Dato titulo="Prueba hasta">{fecha(s.trialHasta)}</Dato>
                  <Dato titulo="Próximo cobro">{fecha(s.proximoCobro)}</Dato>
                  <Dato titulo="Pago pendiente desde">
                    {fecha(s.moraDesde)}
                  </Dato>
                  <Dato titulo="Gracia hasta">{fecha(s.graciaHasta)}</Dato>
                  <Dato titulo="Cambio programado">
                    {s.cambioProgramado
                      ? `${etiqueta(s.cambioProgramado)} · ${fecha(s.cambioProgramadoEl)}`
                      : "Ninguno registrado"}
                  </Dato>
                  <Dato titulo="Período desde">{fecha(s.periodoDesde)}</Dato>
                </dl>
              </div>
            </section>
            <section className={styles.panel} aria-label="Sincronización">
              <div className={styles.panelHeader}>
                <h3>Sincronización</h3>
              </div>
              <div className={styles.panelBody}>
                <dl className={styles.details}>
                  <Dato titulo="Última consulta exitosa">
                    {fecha(s.ultimaConsulta)}
                  </Dato>
                  <Dato titulo="Último evento aplicado">
                    {fecha(s.ultimoEvento)}
                  </Dato>
                  <Dato titulo="Versión del estado en Paddle">
                    {fecha(s.actualizadoProveedorEl)}
                  </Dato>
                  <Dato titulo="Referencia de suscripción">
                    {s.referencia ?? "Sin vínculo externo"}
                  </Dato>
                </dl>
                <p className={styles.note}>
                  {s.proveedor !== "paddle"
                    ? "Esta suscripción se administra en Grafo y no requiere consultar Paddle."
                    : !s.puedeConsultar
                      ? "Falta configurar la API o vincular una referencia de suscripción para poder consultar."
                      : "La consulta recupera el estado actual del proveedor y actualiza Grafo. No cobra, cancela ni modifica el contrato en Paddle."}
                </p>
                {!esAdmin && (
                  <p className={styles.note}>
                    Soporte puede consultar el diagnóstico. Administración puede
                    solicitar una actualización desde Paddle.
                  </p>
                )}
              </div>
            </section>
          </div>
          <Integracion datos={s.integracion} />
        </TabsContent>
        <TabsContent value="cupos" className={styles.tabContent}>
          <CupoSuscripcionPanel id={id} esAdmin={esAdmin} version={version} />
        </TabsContent>
        <TabsContent value="eventos" className={styles.tabContent}>
          <Eventos id={id} version={version} />
        </TabsContent>
        <TabsContent value="contrataciones" className={styles.tabContent}>
          <ContratacionesPanel
            id={id}
            esAdmin={esAdmin}
            version={version}
            actualizado={() => setVersion((v) => v + 1)}
          />
        </TabsContent>
        <TabsContent value="consultas" className={styles.tabContent}>
          <Historial id={id} version={version} />
        </TabsContent>
      </Tabs>
      {consulta && (
        <ConsultarPaddleDialog
          suscripcion={s}
          onClose={() => setConsulta(false)}
          onActualizado={() => setVersion((v) => v + 1)}
        />
      )}
    </>
  );
}
function Eventos({ id, version }: { id: string; version: number }) {
  const [pagina, setPagina] = useState(1);
  const { datos, error, reintentar } = useConsulta<PaginaEventosSuscripcion>(
    `/plataforma/suscripciones/${id}/eventos?pagina=${pagina}&limite=15`,
    version,
  );
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h3>Eventos recibidos de Paddle</h3>
      </div>
      <div className={styles.panelBody}>
        {!datos ? (
          <Carga error={error} reintentar={reintentar} />
        ) : (
          <>
            {datos.eventos.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evento / recibido</TableHead>
                    <TableHead>Resultado en Grafo</TableHead>
                    <TableHead>Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datos.eventos.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        {e.tipo}
                        <small className={styles.secondary}>
                          {fecha(e.recibidoEl)}
                        </small>
                      </TableCell>
                      <TableCell>
                        <Estado valor={e.resultado} />
                      </TableCell>
                      <TableCell className={styles.explanation}>
                        {e.detalle}
                        <details className={styles.note}>
                          <summary>Ver referencia y fechas</summary>
                          <p>{e.eventoId}</p>
                          <p>
                            Ocurrió {fecha(e.ocurridoEl)} · Procesado{" "}
                            {fecha(e.procesadoEl)}
                          </p>
                        </details>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>
                    Sin eventos registrados para esta suscripción
                  </EmptyTitle>
                  <EmptyDescription>
                    Una consulta exitosa puede actualizar Grafo aunque todavía
                    no haya llegado un evento.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
            <Paginas {...datos} cambiar={setPagina} />
          </>
        )}
      </div>
    </section>
  );
}
function Historial({ id, version }: { id: string; version: number }) {
  const [pagina, setPagina] = useState(1);
  const { datos, error, reintentar } = useConsulta<HistorialConsultasPaddle>(
    `/plataforma/suscripciones/${id}/historial?pagina=${pagina}&limite=10`,
    version,
  );
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h3>Consultas solicitadas por el equipo</h3>
      </div>
      <div className={styles.panelBody}>
        {!datos ? (
          <Carga error={error} reintentar={reintentar} />
        ) : (
          <>
            {datos.operaciones.length ? (
              <ul className={styles.timeline}>
                {datos.operaciones.map((o) => (
                  <li key={o.id}>
                    <div>
                      <strong>{o.actor}</strong>
                      <Estado valor={o.estado} />
                      <time>{fecha(o.creadaEl)}</time>
                    </div>
                    <p>{o.motivo}</p>
                    <p>
                      {o.estado === "interrumpida"
                        ? "No se registró un resultado a tiempo. Podés realizar una nueva consulta."
                        : (o.detalle ??
                          "Consulta en curso. Actualizá la vista para verificar el resultado.")}
                    </p>
                    {o.despuesJson && (
                      <details className={styles.note}>
                        <summary>Estado antes y después</summary>
                        <p>
                          Grafo: {etiqueta(o.antesJson?.estado as string)} →{" "}
                          {etiqueta(o.despuesJson.estado as string)}
                        </p>
                        <p>
                          Paddle:{" "}
                          {etiqueta(o.antesJson?.estadoProveedor as string)} →{" "}
                          {etiqueta(o.despuesJson.estadoProveedor as string)}
                        </p>
                        <p>
                          Próximo cobro:{" "}
                          {fecha(o.antesJson?.proximoCobro as string)} →{" "}
                          {fecha(o.despuesJson.proximoCobro as string)}
                        </p>
                        <p>Finalizó {fecha(o.finalizadaEl)}</p>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Todavía no hay consultas del equipo</EmptyTitle>
                  <EmptyDescription>
                    Acá quedan el motivo, el responsable y el resultado de cada
                    consulta manual. La última consulta automática se muestra en
                    Sincronización.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
            <Paginas {...datos} cambiar={setPagina} />
          </>
        )}
      </div>
    </section>
  );
}
export function ConsultarPaddleDialog({
  suscripcion,
  onClose,
  onActualizado,
}: {
  suscripcion: DetalleSuscripcion;
  onClose: () => void;
  onActualizado: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<OperacionPaddle>();
  const solicitud = useRef<string | null>(null);
  const motivoEnviado = useRef<string | null>(null);
  const enviando = useRef(false);
  return (
    <FormDialog
      isOpen
      onOpenChange={(open) => {
        if (!open && !busy) {
          onActualizado();
          onClose();
        }
      }}
      title="Consultar Paddle"
      description={suscripcion.empresa.nombre}
      isDismissable={!busy}
      className={theme.theme}
    >
      <form
        className={styles.modalForm}
        data-ui="heroui"
        onSubmit={async (e) => {
          e.preventDefault();
          if (enviando.current || motivo.trim().length < 5) return;
          enviando.current = true;
          setBusy(true);
          setError("");
          solicitud.current ??= crypto.randomUUID();
          motivoEnviado.current ??= motivo.trim();
          try {
            const r = await consultarPaddlePlataforma(
              suscripcion.id,
              solicitud.current,
              motivoEnviado.current,
            );
            setResultado(r);
          } catch (e) {
            setError(
              e instanceof Error
                ? e.message
                : "No se pudo confirmar el resultado. Revisá el historial o reintentá esta consulta.",
            );
          } finally {
            enviando.current = false;
            setBusy(false);
          }
        }}
      >
        <div>
          {resultado ? (
            <Alert
              variant={
                resultado.estado === "fallida" ? "destructive" : "default"
              }
            >
              <AlertTitle>{etiqueta(resultado.estado)}</AlertTitle>
              <AlertDescription>
                {resultado.detalle ??
                  "Revisá el historial para conocer el resultado de la consulta."}
              </AlertDescription>
            </Alert>
          ) : (
            <FieldGroup>
              <p>
                Grafo consultará el estado actual de esta suscripción y
                actualizará el plan, las fechas y el acceso comercial según la
                respuesta. Los bloqueos administrativos se conservan. Esta
                acción no realiza cobros ni cambios del contrato en Paddle.
              </p>
              <Field>
                <FieldLabel htmlFor="motivo-consulta-paddle">
                  Motivo de la consulta
                </FieldLabel>
                <Input
                  className={fieldFocus.singleBorder}
                  fullWidth
                  id="motivo-consulta-paddle"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  minLength={5}
                  maxLength={300}
                  required
                  disabled={busy || !!solicitud.current}
                  placeholder="Por ejemplo: el cliente informó que regularizó el pago"
                />
              </Field>
            </FieldGroup>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertTitle>No se confirmó el resultado</AlertTitle>
              <AlertDescription>
                {error} Podés revisar el historial; reintentar conserva la misma
                solicitud.
              </AlertDescription>
            </Alert>
          )}
        </div>
        <div className={styles.modalFooter}>
          <ActionButton
            type="button"
            variant="outline"
            isDisabled={busy}
            onPress={() => {
              onActualizado();
              onClose();
            }}
          >
            {resultado ? "Cerrar" : "Volver"}
          </ActionButton>
          {!resultado && (
            <ActionButton
              type="submit"
              isDisabled={busy || motivo.trim().length < 5}
            >
              {busy
                ? "Consultando…"
                : error
                  ? "Reintentar consulta"
                  : "Consultar y actualizar"}
            </ActionButton>
          )}
        </div>
      </form>
    </FormDialog>
  );
}
