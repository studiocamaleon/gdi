"use client";

import fieldFocus from "@/components/design-system/field-focus.module.css";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import {
  cambiarPlanTenant,
  reactivarTenant,
  suspenderTenant,
  type AccesoEmpresa,
  type EmpresaPlataforma,
  type HistorialEmpresa,
  type PaginaEmpresas,
  type PlanCatalogo,
  type ResultadoInvitacionEmpresa,
  type UsuariosEmpresa,
} from "@/lib/plataforma-api";
import { ActionButton } from "@/components/design-system/action-button";
import { ActionLink } from "@/components/design-system/action-link";
import { Input } from "@heroui/react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { fmtBytes, TLogo } from "./kit";
import styles from "./empresas.module.css";
import { PlanAsignacionDialog } from "./plan-asignacion-dialog";
import { InvitacionEmpresaPanel } from "./invitacion-empresa-panel";

const estado = (valor?: string | null) =>
  ({
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
  })[valor ?? ""] ??
  valor ??
  "Sin registro";
const fecha = (valor: string | null | undefined) =>
  valor
    ? new Intl.DateTimeFormat("es-AR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(valor))
    : "Sin registro";

/** Conserva sólo la respuesta de la consulta vigente: navegar rápido nunca
 * muestra datos de otra empresa ni una página anterior como si fuera actual. */
function useConsulta<T>(url: string, version = 0) {
  const [intento, reintentar] = useState(0);
  const clave = `${url}:${version}:${intento}`;
  const [resultado, setResultado] = useState<{
    clave: string;
    datos?: T;
    error?: string;
  } | null>(null);
  useEffect(() => {
    let vigente = true;
    apiRequest<T>(url, { cache: "no-store" })
      .then((datos) => {
        if (vigente) setResultado({ clave, datos });
      })
      .catch((e) => {
        if (vigente)
          setResultado({
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
  }, [url, clave]);
  return {
    datos: resultado?.clave === clave ? resultado.datos : undefined,
    error: resultado?.clave === clave ? resultado.error : undefined,
    reintentar: () => reintentar((v) => v + 1),
  };
}

function Carga({
  error,
  reintentar,
}: {
  error?: string;
  reintentar: () => void;
}) {
  if (error)
    return (
      <Alert variant="destructive">
        <AlertTitle>No pudimos cargar esta vista</AlertTitle>
        <AlertDescription>
          {error}
          <ActionButton variant="outline" onPress={reintentar}>
            Reintentar
          </ActionButton>
        </AlertDescription>
      </Alert>
    );
  return (
    <div role="status" aria-label="Cargando empresa" className={styles.loading}>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-44 w-full" />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}

function AccesoBadge({ acceso }: { acceso: AccesoEmpresa }) {
  return (
    <Badge variant={acceso.modo === "bloqueado" ? "destructive" : "secondary"}>
      {acceso.modo === "operativo"
        ? "Operativa"
        : acceso.modo === "solo_lectura"
          ? "Solo lectura"
          : "Acceso bloqueado"}
    </Badge>
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
  cambiar: (pagina: number) => void;
}) {
  const paginas = Math.max(1, Math.ceil(total / limite));
  return (
    <div className={styles.pagination}>
      <span>
        {total} registros · Página {pagina} de {paginas}
      </span>
      <div>
        <ActionButton
          variant="outline"
          isDisabled={pagina <= 1}
          onPress={() => cambiar(pagina - 1)}
        >
          Anterior
        </ActionButton>
        <ActionButton
          variant="outline"
          isDisabled={pagina >= paginas}
          onPress={() => cambiar(pagina + 1)}
        >
          Siguiente
        </ActionButton>
      </div>
    </div>
  );
}

export function EmpresasView({
  esAdmin,
  planes,
  version,
  onCrear,
}: {
  esAdmin: boolean;
  planes: PlanCatalogo[];
  version: number;
  onCrear: () => void;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("empresa");
  const actualizar = (cambios: Record<string, string | null>) => {
    const siguientes = new URLSearchParams(params.toString());
    siguientes.set("vista", "tenants");
    for (const [k, v] of Object.entries(cambios)) {
      if (v) siguientes.set(k, v);
      else siguientes.delete(k);
    }
    router.push(`/plataforma?${siguientes}`, { scroll: false });
  };
  return (
    <div className={`${styles.page} ${theme.legacy}`} data-ui="heroui">
      {id ? (
        <FichaEmpresa
          key={id}
          id={id}
          esAdmin={esAdmin}
          planes={planes}
          onVolver={() => actualizar({ empresa: null })}
        />
      ) : (
        <Directorio
          key={`${params.get("q")}:${params.get("acceso")}`}
          version={version}
          esAdmin={esAdmin}
          onCrear={onCrear}
          actualizar={actualizar}
        />
      )}
    </div>
  );
}

function Directorio({
  version,
  esAdmin,
  onCrear,
  actualizar,
}: {
  version: number;
  esAdmin: boolean;
  onCrear: () => void;
  actualizar: (c: Record<string, string | null>) => void;
}) {
  const params = useSearchParams();
  const [busqueda, setBusqueda] = useState(params.get("q") ?? "");
  const pagina = Math.min(
    100000,
    Math.max(1, Number(params.get("pagina")) || 1),
  );
  const consulta = new URLSearchParams({
    pagina: String(Math.floor(pagina)),
    limite: "25",
  });
  const q = params.get("q")?.slice(0, 100);
  if (q) consulta.set("q", q);
  const acceso = params.get("acceso");
  if (acceso === "habilitado" || acceso === "bloqueado")
    consulta.set("acceso", acceso);
  const { datos, error, reintentar } = useConsulta<PaginaEmpresas>(
    `/plataforma/empresas?${consulta}`,
    version,
  );
  return (
    <>
      <div className={styles.toolbar}>
        <form
          className={styles.search}
          onSubmit={(e) => {
            e.preventDefault();
            actualizar({ q: busqueda.trim() || null, pagina: null });
          }}
        >
          <Input
            className={fieldFocus.singleBorder}
            fullWidth
            aria-label="Buscar empresas"
            placeholder="Nombre, correo del administrador o referencia…"
            maxLength={100}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <ActionButton type="submit" variant="outline">
            <Search data-icon="inline-start" />
            Buscar
          </ActionButton>
        </form>
        <SelectField
          className={styles.filter}
          aria-label="Bloqueo administrativo"
          value={acceso ?? ""}
          onChange={(v) => actualizar({ acceso: v || null, pagina: null })}
          options={[
            { value: "", label: "Todas las empresas" },
            { value: "habilitado", label: "Sin bloqueo administrativo" },
            { value: "bloqueado", label: "Con acceso bloqueado" },
          ]}
        />
        {esAdmin ? (
          <ActionButton onPress={onCrear}>
            <Building2 data-icon="inline-start" />
            Nueva empresa
          </ActionButton>
        ) : null}
      </div>
      {!datos ? (
        <Carga error={error} reintentar={reintentar} />
      ) : (
        <>
          <section className={styles.panel} aria-label="Directorio de empresas">
            {datos.empresas.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Acceso a Grafo</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Suscripción</TableHead>
                    <TableHead>Usuarios habilitados</TableHead>
                    <TableHead>
                      <span className="sr-only">Abrir ficha</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datos.empresas.map((e) => {
                    const enlace = new URLSearchParams(params.toString());
                    enlace.set("empresa", e.id);
                    enlace.set("vista", "tenants");
                    return (
                      <TableRow key={e.id}>
                        <TableCell>
                          <div className={styles.company}>
                            <TLogo nombre={e.nombre} slug={e.slug} />
                            <div>
                              <Link href={`/plataforma?${enlace}`}>
                                {e.nombre}
                              </Link>
                              <small>{e.slug}</small>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <AccesoBadge acceso={e.acceso} />
                        </TableCell>
                        <TableCell>
                          {e.plan ?? "Cuenta anterior a los planes"}
                        </TableCell>
                        <TableCell>
                          <div>
                            {e.proveedor
                              ? estado(e.estadoProveedor ?? e.estadoSuscripcion)
                              : "Sin suscripción"}
                          </div>
                          <small>
                            {e.proveedor ? estado(e.proveedor) : ""}
                          </small>
                        </TableCell>
                        <TableCell>{e.usuariosHabilitados}</TableCell>
                        <TableCell>
                          <Link
                            href={`/plataforma?${enlace}`}
                            aria-label={`Ver ficha de ${e.nombre}`}
                          >
                            <ArrowUpRight size={18} />
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Sin empresas para esta búsqueda</EmptyTitle>
                  <EmptyDescription>
                    Probá otro nombre, correo o filtro.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </section>
          <Paginas
            {...datos}
            cambiar={(p) => actualizar({ pagina: String(p) })}
          />
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

function Seccion({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.panel}>
      <header className={styles.panelHeader}>
        <h3>{titulo}</h3>
      </header>
      <div className={styles.panelBody}>{children}</div>
    </section>
  );
}

function FichaEmpresa({
  id,
  esAdmin,
  planes,
  onVolver,
}: {
  id: string;
  esAdmin: boolean;
  planes: PlanCatalogo[];
  onVolver: () => void;
}) {
  const [restaurarContrato, setRestaurarContrato] = useState(false);
  const [version, setVersion] = useState(0);
  // El enlace sólo vive en esta ficha; el detalle de la API no devuelve tokens.
  const [invitacionRenovada, setInvitacionRenovada] =
    useState<ResultadoInvitacionEmpresa | null>(null);
  const [accion, setAccion] = useState<
    "bloquear" | "reactivar" | "plan" | null
  >(null);
  const {
    datos: e,
    error,
    reintentar,
  } = useConsulta<EmpresaPlataforma>(`/plataforma/empresas/${id}`, version);
  return (
    <>
      <div className={styles.toolbar}>
        <ActionButton variant="ghost" onPress={onVolver}>
          <ArrowLeft data-icon="inline-start" />
          Empresas
        </ActionButton>
        <ActionButton variant="outline" onPress={reintentar}>
          <RefreshCw data-icon="inline-start" />
          Actualizar
        </ActionButton>
      </div>
      {!e ? (
        <Carga error={error} reintentar={reintentar} />
      ) : (
        <>
          <header className={styles.companyHeader}>
            <div className={styles.company}>
              <TLogo nombre={e.nombre} slug={e.slug} size={44} />
              <div>
                <h2>{e.nombre}</h2>
                <p>
                  {e.slug} · Alta {fecha(e.creadoEl)}
                </p>
              </div>
            </div>
            <AccesoBadge acceso={e.acceso} />
          </header>
          <Alert
            variant={e.acceso.modo === "bloqueado" ? "destructive" : "default"}
          >
            <ShieldCheck />
            <AlertTitle>
              {e.acceso.modo === "operativo"
                ? "Acceso operativo"
                : e.acceso.modo === "solo_lectura"
                  ? "Acceso en modo solo lectura"
                  : "Bloqueo administrativo"}
            </AlertTitle>
            <AlertDescription>{e.acceso.descripcion}</AlertDescription>
          </Alert>
          {e.invitacionAdministrador && (
            <InvitacionEmpresaPanel
              tenantId={e.id}
              invitacion={e.invitacionAdministrador}
              enlace={
                invitacionRenovada?.tenantId === e.id &&
                invitacionRenovada.invitacion.id ===
                  e.invitacionAdministrador.id &&
                invitacionRenovada.invitacion.venceEl ===
                  e.invitacionAdministrador.venceEl &&
                invitacionRenovada.invitacion.ultimoIntentoEl ===
                  e.invitacionAdministrador.ultimoIntentoEl
                  ? invitacionRenovada.invitacionUrl
                  : undefined
              }
              puedeEnviar={esAdmin && e.activo}
              onCambio={(resultado) => {
                setInvitacionRenovada(resultado);
                setVersion((v) => v + 1);
              }}
            />
          )}
          <Tabs defaultValue="resumen">
            <div className={styles.tabScroll}>
              <TabsList variant="graphite">
                <TabsTrigger value="resumen">Resumen</TabsTrigger>
                <TabsTrigger value="suscripcion">Suscripción</TabsTrigger>
                <TabsTrigger value="funciones">Funciones y límites</TabsTrigger>
                <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
                <TabsTrigger value="historial">Historial</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="resumen">
              <div className={styles.columns}>
                <Seccion titulo="Acceso de la empresa">
                  <dl className={styles.details}>
                    <Dato titulo="Control administrativo">
                      {e.activo ? "Sin bloqueo" : "Bloqueado"}
                    </Dato>
                    <Dato titulo="Usuarios habilitados">
                      {e.usuariosHabilitados}
                    </Dato>
                    <Dato titulo="Invitaciones pendientes">
                      {e.invitacionesPendientes}
                    </Dato>
                    <Dato titulo="Origen del alta">
                      {e.origenAlta === "registro_publico"
                        ? "Registro público"
                        : "Alta asistida"}
                    </Dato>
                    {!e.activo ? (
                      <>
                        <Dato titulo="Motivo del bloqueo">
                          {e.bloqueo.motivo ??
                            "No registrado en el bloqueo histórico"}
                        </Dato>
                        <Dato titulo="Bloqueado desde">
                          {fecha(e.bloqueo.desde)}
                        </Dato>
                      </>
                    ) : null}
                  </dl>
                  {esAdmin ? (
                    <div className={styles.action}>
                      <ActionButton
                        variant={e.activo ? "danger" : "outline"}
                        onPress={() =>
                          setAccion(e.activo ? "bloquear" : "reactivar")
                        }
                      >
                        <LockKeyhole data-icon="inline-start" />
                        {e.activo ? "Bloquear acceso" : "Levantar bloqueo"}
                      </ActionButton>
                      <p>
                        El bloqueo controla el acceso. Los cobros siguen las
                        condiciones de la suscripción.
                      </p>
                    </div>
                  ) : null}
                </Seccion>
                <Seccion titulo="Contrato y capacidad">
                  <dl className={styles.details}>
                    <Dato titulo="Plan">
                      {e.suscripcion?.planNombre ?? "Sin plan asignado"}
                    </Dato>
                    <Dato titulo="Gestión de la suscripción">
                      {e.suscripcion
                        ? estado(e.suscripcion.proveedor)
                        : "Cuenta anterior a los planes"}
                    </Dato>
                    <Dato titulo="Estado de suscripción">
                      {e.suscripcion
                        ? estado(
                            e.suscripcion.estadoProveedor ??
                              e.suscripcion.estado,
                          )
                        : "Sin suscripción"}
                    </Dato>
                    <Dato titulo="Almacenamiento usado">
                      {fmtBytes(e.storageBytes)}
                    </Dato>
                  </dl>
                  <p className={styles.note}>
                    La suscripción y el bloqueo administrativo se gestionan por
                    separado.
                  </p>
                </Seccion>
              </div>
            </TabsContent>
            <TabsContent value="suscripcion">
              <Seccion titulo="Suscripción de Grafo">
                {e.suscripcion && (
                  <div className={styles.toolbar}>
                    <ActionLink
                      variant="outline"
                      href={`/plataforma?vista=suscripciones&suscripcion=${e.suscripcion.id}`}
                    >
                      Ver diagnóstico e historial de cobros →
                    </ActionLink>
                  </div>
                )}
                {e.suscripcion ? (
                  <dl className={styles.details}>
                    <Dato titulo="Plan">{e.suscripcion.planNombre}</Dato>
                    <Dato titulo="Proveedor">
                      {estado(e.suscripcion.proveedor)}
                    </Dato>
                    <Dato titulo="Estado informado por el proveedor">
                      {e.suscripcion.proveedor === "manual"
                        ? "Gestión manual"
                        : estado(e.suscripcion.estadoProveedor)}
                    </Dato>
                    <Dato titulo="Estado local de la suscripción">
                      {estado(e.suscripcion.estado)}
                    </Dato>
                    <Dato titulo="Próximo cobro">
                      {fecha(e.suscripcion.proximoCobro)}
                    </Dato>
                    <Dato titulo="Fin de prueba">
                      {fecha(e.suscripcion.trialHasta)}
                    </Dato>
                    <Dato titulo="Pago pendiente desde">
                      {fecha(e.suscripcion.moraDesde)}
                    </Dato>
                    <Dato titulo="Fin de gracia">
                      {fecha(e.suscripcion.graciaHasta)}
                    </Dato>
                    <Dato titulo="Cambio programado">
                      {e.suscripcion.cambioProgramado
                        ? `${estado(e.suscripcion.cambioProgramado)} · ${fecha(e.suscripcion.cambioProgramadoEl)}`
                        : "Ninguno"}
                    </Dato>
                    <Dato titulo="Última consulta exitosa al proveedor">
                      {fecha(e.suscripcion.ultimaSyncProveedorEl)}
                    </Dato>
                    <Dato titulo="Último evento aplicado del proveedor">
                      {fecha(e.suscripcion.ultimoEventoProveedorEl)}
                    </Dato>
                    <Dato titulo="Referencia del proveedor">
                      {e.suscripcion.referenciaExterna ?? "Sin vinculación"}
                    </Dato>
                  </dl>
                ) : (
                  <p>
                    Esta cuenta conserva el acceso anterior a la incorporación
                    de planes.
                  </p>
                )}
                <div className={styles.action}>
                  {e.puedeAsignarPlanManual ? (
                    <>
                      <p>
                        La asignación manual cambia las funciones del plan y
                        conserva el estado y las fechas de la suscripción.
                      </p>
                      {esAdmin ? (
                        <ActionButton
                          variant="outline"
                          isDisabled={!planes.length}
                          onPress={() => setAccion("plan")}
                        >
                          Asignar plan manual
                        </ActionButton>
                      ) : null}
                    </>
                  ) : e.suscripcion?.versionId ? (
                    <Alert>
                      <AlertTitle>Versión publicada asignada</AlertTitle>
                      <AlertDescription>
                        Las funciones y los cupos se administran desde Planes →
                        Versiones. Para volver al contrato anterior, usá
                        Funciones y límites.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert>
                      <AlertTitle>
                        Contrato gestionado por{" "}
                        {estado(e.suscripcion?.proveedor)}
                      </AlertTitle>
                      <AlertDescription>
                        Los cambios comerciales se realizan desde Plan y
                        facturación de la empresa. Esta ficha conserva lo
                        informado por el proveedor.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </Seccion>
            </TabsContent>
            <TabsContent value="funciones">
              {e.suscripcion?.versionId && (
                <Seccion titulo="Versión operativa asignada">
                  <p>
                    {e.suscripcion.planNombre} · versión{" "}
                    {e.suscripcion.versionNumero}
                  </p>
                  <p>
                    Contrato comercial conservado:{" "}
                    {e.suscripcion.planComercialNombre}.
                  </p>
                  <ActionButton
                    variant="outline"
                    onPress={() => setRestaurarContrato(true)}
                  >
                    Revisar vuelta al contrato anterior
                  </ActionButton>
                </Seccion>
              )}
              <Seccion titulo="Funciones disponibles">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Función</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {e.funciones.map((f) => (
                      <TableRow key={f.clave}>
                        <TableCell>{f.nombre}</TableCell>
                        <TableCell>
                          <Badge
                            variant={f.habilitada ? "secondary" : "outline"}
                          >
                            {f.habilitada
                              ? "Habilitada"
                              : f.incluida
                                ? "Acceso restringido"
                                : "No incluida"}
                          </Badge>
                        </TableCell>
                        <TableCell className={styles.explanation}>
                          {f.motivo}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <dl className={styles.details}>
                  <Dato titulo="Usuarios del plan">
                    {e.limites.usuariosMax ?? "Sin límite"}
                  </Dato>
                  <Dato titulo="Órdenes por mes">
                    {e.limites.ordenesMesMax ?? "Sin límite"}
                  </Dato>
                  <Dato titulo="Almacenamiento del plan">
                    {e.limites.storageGb === null
                      ? "Sin límite"
                      : `${e.limites.storageGb} GB`}
                  </Dato>
                  <Dato titulo="Cuota específica de archivos">
                    {e.storageCuotaBytes === null
                      ? "Sin cuota específica"
                      : fmtBytes(e.storageCuotaBytes)}
                  </Dato>
                </dl>
              </Seccion>
            </TabsContent>
            <TabsContent value="usuarios">
              <Usuarios id={id} />
            </TabsContent>
            <TabsContent value="historial">
              <Historial key={version} id={id} />
            </TabsContent>
          </Tabs>
          {restaurarContrato && (
            <PlanAsignacionDialog
              version={null}
              empresaInicial={{ id: e.id, nombre: e.nombre }}
              esAdmin={esAdmin}
              cerrar={() => setRestaurarContrato(false)}
              completada={() => setVersion((v) => v + 1)}
            />
          )}
          {accion ? (
            <AccionEmpresa
              empresa={e}
              accion={accion}
              planes={planes}
              cerrar={() => setAccion(null)}
              completada={() => {
                setAccion(null);
                setVersion((v) => v + 1);
              }}
            />
          ) : null}
        </>
      )}
    </>
  );
}

function Usuarios({ id }: { id: string }) {
  const [pagina, setPagina] = useState(1);
  const { datos, error, reintentar } = useConsulta<UsuariosEmpresa>(
    `/plataforma/empresas/${id}/usuarios?pagina=${pagina}`,
  );
  if (!datos) return <Carga error={error} reintentar={reintentar} />;
  return (
    <Seccion titulo="Usuarios de la empresa">
      {datos.usuarios.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Rol en la empresa</TableHead>
              <TableHead>Cuenta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {datos.usuarios.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  {u.nombre ?? u.email}
                  <small className={styles.secondary}>
                    {u.nombre ? u.email : ""}
                  </small>
                </TableCell>
                <TableCell>{u.rol}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {u.habilitado ? "Habilitada" : "Deshabilitada"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p>Todavía no hay usuarios asociados.</p>
      )}
      <Paginas {...datos} cambiar={setPagina} />
      <p className={styles.note}>
        El acceso efectivo también depende del bloqueo y la suscripción de esta
        empresa.
      </p>
    </Seccion>
  );
}

function Historial({ id }: { id: string }) {
  const [pagina, setPagina] = useState(1);
  const { datos, error, reintentar } = useConsulta<HistorialEmpresa>(
    `/plataforma/empresas/${id}/historial?pagina=${pagina}`,
  );
  if (!datos) return <Carga error={error} reintentar={reintentar} />;
  return (
    <Seccion titulo="Intervenciones de Plataforma">
      {datos.eventos.length ? (
        <ol className={styles.timeline}>
          {datos.eventos.map((e) => (
            <li key={e.id}>
              <div>
                <strong>{e.staffNombre ?? e.staffEmail}</strong>
                <time dateTime={e.creadoEl}>{fecha(e.creadoEl)}</time>
              </div>
              <p>{e.descripcion}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p>Todavía no hay intervenciones registradas para esta empresa.</p>
      )}
      <Paginas {...datos} cambiar={setPagina} />
    </Seccion>
  );
}

export function AccionEmpresa({
  empresa,
  accion,
  planes,
  cerrar,
  completada,
}: {
  empresa: EmpresaPlataforma;
  accion: "bloquear" | "reactivar" | "plan";
  planes: PlanCatalogo[];
  cerrar: () => void;
  completada: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [planId, setPlanId] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titulo =
    accion === "bloquear"
      ? "Bloquear acceso"
      : accion === "reactivar"
        ? "Levantar bloqueo"
        : "Asignar plan manual";
  const efecto =
    accion === "bloquear"
      ? "Los usuarios perderán acceso a esta empresa. El cobro continúa según la suscripción. Las sesiones ya abiertas pueden tardar hasta 30 segundos en reflejarlo."
      : accion === "reactivar"
        ? "Se levantará el bloqueo administrativo. Si la suscripción está inactiva, la empresa seguirá en solo lectura."
        : "Se cambiará el plan manual. Se conservan las fechas, el estado de la suscripción y cualquier bloqueo administrativo.";
  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (ocupado || motivo.trim().length < 3 || (accion === "plan" && !planId))
      return;
    setOcupado(true);
    setError(null);
    try {
      if (accion === "bloquear")
        await suspenderTenant(empresa.id, motivo.trim());
      else if (accion === "reactivar")
        await reactivarTenant(empresa.id, motivo.trim());
      else await cambiarPlanTenant(empresa.id, planId, motivo.trim());
      toast.success("Cambio registrado en el historial de la empresa.");
      completada();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo completar el cambio.",
      );
      setOcupado(false);
    }
  };
  return (
    <FormDialog
      isOpen
      onOpenChange={(open) => {
        if (!open && !ocupado) cerrar();
      }}
      title={`${titulo} · ${empresa.nombre}`}
      description={efecto}
      isDismissable={!ocupado}
      className={`${theme.theme} ${theme.legacy}`}
    >
      <form onSubmit={enviar} className={styles.modalForm}>
        <FieldGroup>
          {accion === "plan" ? (
            <Field>
              <FieldLabel htmlFor="empresa-plan">Nuevo plan</FieldLabel>
              <SelectField
                id="empresa-plan"
                aria-label="Nuevo plan"
                required
                disabled={ocupado}
                value={planId}
                onChange={setPlanId}
                options={[
                  { value: "", label: "Elegir plan", disabled: true },
                  ...planes
                    .filter((p) => p.id !== empresa.suscripcion?.planId)
                    .map((p) => ({ value: p.id, label: p.nombre })),
                ]}
              />
            </Field>
          ) : null}
          <Field>
            <FieldLabel htmlFor="empresa-motivo">
              Motivo de la intervención
            </FieldLabel>
            <Input
              className={fieldFocus.singleBorder}
              fullWidth
              id="empresa-motivo"
              value={motivo}
              maxLength={300}
              minLength={3}
              required
              disabled={ocupado}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Explicá por qué se realiza este cambio"
              autoFocus
            />
          </Field>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </FieldGroup>
        <div className={styles.modalFooter}>
          <ActionButton
            type="button"
            variant="outline"
            isDisabled={ocupado}
            onPress={cerrar}
          >
            Cancelar
          </ActionButton>
          <ActionButton
            type="submit"
            variant={accion === "bloquear" ? "danger" : "primary"}
            isDisabled={
              ocupado ||
              motivo.trim().length < 3 ||
              (accion === "plan" && !planId)
            }
          >
            {ocupado ? "Guardando…" : titulo}
          </ActionButton>
        </div>
      </form>
    </FormDialog>
  );
}
