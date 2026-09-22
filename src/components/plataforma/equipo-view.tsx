"use client";

import fieldFocus from "@/components/design-system/field-focus.module.css";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Search, ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import {
  agregarOperador,
  actualizarOperador,
  type EquipoPlataforma,
  type OperadorPlataforma,
  type AccionEquipo,
  type RolEquipo,
  type HistorialEquipo,
} from "@/lib/plataforma-equipo-api";
import { clearSessionToken } from "@/lib/session";
import { ActionButton } from "@/components/design-system/action-button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { FormDialog } from "@/components/design-system/form-dialog";
import { SelectField } from "@/components/design-system/select-field";
import { PerfilMfa } from "@/components/perfil-mfa";
import {
  InvitacionesEquipoView,
  InvitacionEquipoDialog,
} from "./invitaciones-equipo";
import theme from "@/components/design-system/brand-workspace-theme.module.css";
import base from "./empresas.module.css";
import styles from "./equipo.module.css";

const rolNombre = (rol: RolEquipo) =>
  rol === "ADMIN" ? "Administración" : "Soporte";
const fecha = (valor: string) =>
  new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(valor));

function useEquipoConsulta<T>(url: string, version: number) {
  const [resultado, setResultado] = useState<{
    clave: string;
    datos?: T;
    error?: string;
  }>();
  const clave = `${url}:${version}`;
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
              e instanceof Error ? e.message : "No pudimos cargar los datos.",
          });
      });
    return () => {
      vigente = false;
    };
  }, [url, clave]);
  return resultado?.clave === clave ? resultado : undefined;
}

export function EquipoView({
  esAdmin,
  esSesionPlataforma,
}: {
  esAdmin: boolean;
  esSesionPlataforma: boolean;
}) {
  const [version, setVersion] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState("");
  const [q, setQ] = useState("");
  const [seccion, setSeccion] = useState("equipo");
  const [editor, setEditor] = useState<OperadorPlataforma | "alta" | null>(
    null,
  );
  const [mfa, setMfa] = useState(false);
  const [bloqueoMfa, setBloqueoMfa] = useState(false);
  const refrescar = () => setVersion((v) => v + 1);
  const resultado = useEquipoConsulta<EquipoPlataforma>(
    `/plataforma/equipo?pagina=${pagina}&limite=25&q=${encodeURIComponent(q)}`,
    version,
  );
  const datos = resultado?.datos;
  const puedeGestionar = esAdmin && esSesionPlataforma;
  return (
    <div className={`${base.page} ${theme.legacy}`} data-ui="heroui">
      <section
        className={`${base.panel} ${styles.personal}`}
        aria-label="Seguridad de tu cuenta"
      >
        <div className={styles.personalInfo}>
          <ShieldCheck aria-hidden="true" />
          <div>
            <h2>Tu acceso a Grafo</h2>
            <p>
              Administrá MFA y tus códigos de recuperación para proteger tu
              cuenta.
            </p>
          </div>
        </div>
        <ActionButton variant="outline" onPress={() => setMfa(true)}>
          Mi seguridad
        </ActionButton>
      </section>
      {!esSesionPlataforma && esAdmin && (
        <Alert>
          <AlertTitle>Gestión desde el backoffice</AlertTitle>
          <AlertDescription>
            Para modificar el equipo, ingresá con tu cuenta en /backoffice.
          </AlertDescription>
        </Alert>
      )}
      <Tabs value={seccion} onValueChange={setSeccion}>
        <TabsList variant="graphite">
          <TabsTrigger value="equipo">Equipo</TabsTrigger>
          <TabsTrigger value="invitaciones">Invitaciones</TabsTrigger>
          <TabsTrigger value="permisos">Permisos</TabsTrigger>
          <TabsTrigger value="historial">Historial de acceso</TabsTrigger>
        </TabsList>
        <TabsContent value="equipo" className={styles.section}>
          <div className={base.toolbar}>
            <form
              className={base.search}
              onSubmit={(e) => {
                e.preventDefault();
                setPagina(1);
                setQ(busqueda.trim());
              }}
            >
              <Input
                className={fieldFocus.singleBorder}
                fullWidth
                aria-label="Buscar integrante por nombre o correo"
                placeholder="Buscar por nombre o correo"
                value={busqueda}
                maxLength={100}
                onChange={(e) => setBusqueda(e.target.value)}
              />
              <ActionButton variant="outline" type="submit">
                <Search data-icon="inline-start" />
                Buscar
              </ActionButton>
            </form>
            <ActionButton variant="outline" onPress={refrescar}>
              <RefreshCw data-icon="inline-start" />
              Actualizar
            </ActionButton>
            {puedeGestionar && (
              <ActionButton onPress={() => setEditor("alta")}>
                <UserPlus data-icon="inline-start" />
                Invitar integrante
              </ActionButton>
            )}
          </div>
          {resultado?.error ? (
            <ErrorCarga mensaje={resultado.error} reintentar={refrescar} />
          ) : !datos ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <>
              <div className={base.panel}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Integrante</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Protección</TableHead>
                      <TableHead>Sesiones de backoffice</TableHead>
                      {puedeGestionar && (
                        <TableHead>
                          <span className="sr-only">Acciones</span>
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {datos.usuarios.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <strong>{u.nombre || u.email}</strong>
                          {u.esPropio && (
                            <Badge variant="outline" className="ml-2">
                              Vos
                            </Badge>
                          )}
                          <span className={base.secondary}>{u.email}</span>
                          {!u.activo && (
                            <Badge variant="destructive">
                              Cuenta desactivada
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{rolNombre(u.rol)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={u.mfaActivo ? "secondary" : "outline"}
                          >
                            {u.mfaActivo
                              ? u.recuperacionConfirmada
                                ? "MFA activada"
                                : "Recuperación pendiente"
                              : "Sin MFA"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {u.sesionesActivas
                            ? `${u.sesionesActivas} activa${u.sesionesActivas === 1 ? "" : "s"}`
                            : "Sin sesiones activas"}
                          {u.ultimaSesionActivaEl && (
                            <span className={base.secondary}>
                              Más reciente: {fecha(u.ultimaSesionActivaEl)}
                            </span>
                          )}
                        </TableCell>
                        {puedeGestionar && (
                          <TableCell>
                            <ActionButton
                              variant="outline"
                              size="sm"
                              onPress={() => setEditor(u)}
                              aria-label={`Gestionar acceso de ${u.nombre || u.email}`}
                            >
                              Gestionar
                            </ActionButton>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {!datos.usuarios.length && (
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>No encontramos integrantes</EmptyTitle>
                      <EmptyDescription>
                        Probá con otro nombre o correo.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </div>
              <Paginacion
                pagina={pagina}
                total={datos.total}
                cambiar={setPagina}
              />
            </>
          )}
          <p className={base.secondary}>
            El equipo de Plataforma es independiente de los usuarios y roles de
            cada empresa.
          </p>
        </TabsContent>
        <TabsContent value="permisos" className={styles.section}>
          <div className={base.panel}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Permiso</TableHead>
                  <TableHead>Administración</TableHead>
                  <TableHead>Soporte</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ["Consultar empresas, planes y métricas", "Sí", "Sí"],
                  ["Consultar historial y equipo", "Sí", "Sí"],
                  ["Cambiar acceso y plan manual de empresas", "Sí", "No"],
                  ["Gestionar planes y vinculación con Paddle", "Sí", "No"],
                  [
                    "Ingresar a una empresa por soporte",
                    "Sí, con motivo y vencimiento",
                    "No",
                  ],
                  ["Gestionar integrantes y cerrar sus sesiones", "Sí", "No"],
                  [
                    "Gestionar MFA y recuperación",
                    "Sólo su propia cuenta",
                    "Sólo su propia cuenta",
                  ],
                ].map((fila) => (
                  <TableRow key={fila[0]}>
                    {fila.map((celda, i) => (
                      <TableCell key={i}>{celda}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Alert>
            <AlertTitle>Siempre debe quedar un administrador</AlertTitle>
            <AlertDescription>
              Los cambios de rol y las bajas requieren un motivo. Los códigos de
              recuperación de MFA sólo los puede generar su titular.
            </AlertDescription>
          </Alert>
        </TabsContent>
        <TabsContent value="invitaciones" className={styles.section}>
          {seccion === "invitaciones" && (
            <InvitacionesEquipoView
              puedeGestionar={puedeGestionar}
              version={version}
            />
          )}
        </TabsContent>
        <TabsContent value="historial" className={styles.section}>
          {seccion === "historial" && <Historial version={version} />}
        </TabsContent>
      </Tabs>
      {editor === "alta" && (
        <InvitacionEquipoDialog
          onCerrar={() => setEditor(null)}
          onCambio={refrescar}
        />
      )}
      {editor && editor !== "alta" && (
        <EditorEquipo
          usuario={editor}
          onCerrar={() => setEditor(null)}
          onGuardado={() => {
            setEditor(null);
            refrescar();
          }}
        />
      )}
      {mfa && (
        <FormDialog
          isOpen
          onOpenChange={(abierto) => {
            if (!abierto && !bloqueoMfa) {
              setMfa(false);
              refrescar();
            }
          }}
          isDismissable={!bloqueoMfa}
          title="Seguridad de tu cuenta"
          description="Esta protección se aplica a todos tus accesos a Grafo."
        >
          <div className={styles.modalBody}>
            <PerfilMfa onBloqueoChange={setBloqueoMfa} />
          </div>
        </FormDialog>
      )}
    </div>
  );
}

function ErrorCarga({
  mensaje,
  reintentar,
}: {
  mensaje: string;
  reintentar: () => void;
}) {
  return (
    <Alert variant="destructive">
      <AlertTitle>No pudimos cargar la información</AlertTitle>
      <AlertDescription>
        {mensaje}
        <ActionButton variant="outline" onPress={reintentar}>
          Reintentar
        </ActionButton>
      </AlertDescription>
    </Alert>
  );
}
function Paginacion({
  pagina,
  total,
  cambiar,
}: {
  pagina: number;
  total: number;
  cambiar: (p: number) => void;
}) {
  return (
    <div className={styles.pagination}>
      <span className={base.secondary}>
        {total} registros · Página {pagina}
      </span>
      <div className={styles.actions}>
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
          isDisabled={pagina * 25 >= total}
          onPress={() => cambiar(pagina + 1)}
        >
          Siguiente
        </ActionButton>
      </div>
    </div>
  );
}
function Historial({ version }: { version: number }) {
  const [pagina, setPagina] = useState(1);
  const [intento, setIntento] = useState(0);
  const r = useEquipoConsulta<HistorialEquipo>(
    `/plataforma/equipo/historial?pagina=${pagina}&limite=25`,
    version + intento,
  );
  if (r?.error)
    return (
      <ErrorCarga
        mensaje={r.error}
        reintentar={() => setIntento((v) => v + 1)}
      />
    );
  if (!r?.datos) return <Skeleton className="h-40 w-full" />;
  return (
    <>
      <div className={base.panel}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Acción y motivo</TableHead>
              <TableHead>Realizada por</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {r.datos.eventos.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{fecha(e.creadoEl)}</TableCell>
                <TableCell className={styles.event}>{e.descripcion}</TableCell>
                <TableCell>{e.actor}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!r.datos.total && (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Todavía no hay cambios registrados</EmptyTitle>
              <EmptyDescription>
                Las altas, cambios de rol, cierres de sesiones y cambios de MFA
                aparecerán aquí.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
      <Paginacion pagina={pagina} total={r.datos.total} cambiar={setPagina} />
    </>
  );
}

export function EditorEquipo({
  usuario,
  onCerrar,
  onGuardado,
}: {
  usuario: OperadorPlataforma | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<RolEquipo>(
    usuario?.rol === "SOPORTE" ? "ADMIN" : "SOPORTE",
  );
  const [accion, setAccion] = useState<AccionEquipo>("rol");
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);
  const enviando = useRef(false);
  const [error, setError] = useState<string>();
  const salir = usuario?.esPropio && accion !== "sesiones";
  return (
    <FormDialog
      isOpen
      className={theme.legacy}
      onOpenChange={(abierto) => {
        if (!abierto && !busy) onCerrar();
      }}
      isDismissable={!busy}
      title={
        usuario
          ? `Acceso de ${usuario.nombre || usuario.email}`
          : "Agregar integrante"
      }
      description={
        usuario
          ? "Los cambios quedan registrados con tu nombre y el motivo."
          : "Otorgá acceso al backoffice a una cuenta existente de Grafo."
      }
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (enviando.current || motivo.trim().length < 5) return;
          enviando.current = true;
          setBusy(true);
          setError(undefined);
          try {
            if (usuario) {
              const r = await actualizarOperador(
                usuario,
                accion,
                rol,
                motivo.trim(),
              );
              if (r.sesionActualCerrada) {
                await clearSessionToken();
                router.replace("/backoffice");
                router.refresh();
                return;
              }
            } else await agregarOperador(email.trim(), rol, motivo.trim());
            toast.success("Acceso actualizado.");
            onGuardado();
          } catch (e) {
            setError(
              e instanceof Error
                ? e.message
                : "No se pudo actualizar el acceso.",
            );
          } finally {
            enviando.current = false;
            setBusy(false);
          }
        }}
      >
        <FieldGroup className={styles.modalBody}>
          {!usuario && (
            <Field>
              <FieldLabel htmlFor="equipo-email">
                Correo de la cuenta
              </FieldLabel>
              <Input
                className={fieldFocus.singleBorder}
                fullWidth
                id="equipo-email"
                type="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
                autoComplete="off"
              />
              <p className={base.secondary}>
                Debe ser una cuenta activa con contraseña configurada. No se
                envía una invitación en este paso.
              </p>
            </Field>
          )}
          {usuario && (
            <Field>
              <FieldLabel htmlFor="equipo-accion">Acción</FieldLabel>
              <SelectField
                id="equipo-accion"
                aria-label="Acción"
                value={accion}
                disabled={busy}
                onChange={(v) => setAccion(v as AccionEquipo)}
                options={[
                  { value: "rol", label: "Cambiar rol" },
                  {
                    value: "sesiones",
                    label: usuario.esPropio
                      ? "Cerrar mis otras sesiones de Plataforma"
                      : "Cerrar sesiones de Plataforma",
                  },
                  { value: "revocar", label: "Quitar acceso a Plataforma" },
                ]}
              />
            </Field>
          )}
          {(!usuario || accion === "rol") && (
            <Field>
              <FieldLabel htmlFor="equipo-rol">Rol de Plataforma</FieldLabel>
              <SelectField
                id="equipo-rol"
                aria-label="Rol de Plataforma"
                value={rol}
                disabled={busy}
                onChange={(v) => setRol(v as RolEquipo)}
                options={[
                  { value: "SOPORTE", label: "Soporte · Sólo consulta" },
                  {
                    value: "ADMIN",
                    label: "Administración · Gestión completa",
                  },
                ]}
              />
            </Field>
          )}
          {(!usuario || accion === "rol") && (
            <p className={base.secondary}>
              {rol === "ADMIN"
                ? "Puede gestionar empresas, planes y equipo e ingresar a empresas por soporte."
                : "Puede consultar empresas, planes, métricas e historial. No puede modificar datos ni impersonar usuarios."}
            </p>
          )}
          {usuario && (
            <Alert>
              <AlertTitle>
                {accion === "revocar"
                  ? "Se quitará el acceso al backoffice"
                  : accion === "sesiones"
                    ? "Se cerrarán las sesiones de Plataforma"
                    : "Se aplicarán los permisos del nuevo rol"}
              </AlertTitle>
              <AlertDescription>
                {accion === "sesiones" && usuario.esPropio
                  ? "Tu sesión actual seguirá abierta. "
                  : "Deberá volver a iniciar sesión para entrar al backoffice. "}
                Los accesos de soporte a empresas también se cerrarán. Sus
                membresías y sesiones propias en empresas se conservan.
                {salir ? " Este cambio cerrará tu sesión actual." : ""}
              </AlertDescription>
            </Alert>
          )}
          <Field>
            <FieldLabel htmlFor="equipo-motivo">Motivo del cambio</FieldLabel>
            <Input
              className={fieldFocus.singleBorder}
              fullWidth
              id="equipo-motivo"
              required
              minLength={5}
              maxLength={300}
              value={motivo}
              disabled={busy}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Por qué realizás este cambio"
            />
          </Field>
          {error && (
            <Alert variant="destructive">
              <AlertTitle>No se guardó el cambio</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </FieldGroup>
        <div className={styles.modalFooter}>
          <ActionButton
            variant="outline"
            type="button"
            isDisabled={busy}
            onPress={onCerrar}
          >
            Cancelar
          </ActionButton>
          <ActionButton
            variant={usuario && accion === "revocar" ? "danger" : "primary"}
            type="submit"
            isDisabled={
              busy ||
              motivo.trim().length < 5 ||
              (usuario !== null && accion === "rol" && rol === usuario.rol)
            }
          >
            {busy
              ? "Guardando…"
              : !usuario
                ? "Agregar al equipo"
                : accion === "revocar"
                  ? "Quitar acceso"
                  : accion === "sesiones"
                    ? "Cerrar sesiones"
                    : "Guardar rol"}
          </ActionButton>
        </div>
      </form>
    </FormDialog>
  );
}
