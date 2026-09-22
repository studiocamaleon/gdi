"use client";

import fieldFocus from "@/components/design-system/field-focus.module.css";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/api";
import {
  invitarEquipo,
  gestionarInvitacionEquipo,
  type InvitacionEquipo,
  type InvitacionesEquipo,
  type EnlaceInvitacionEquipo,
  type RolEquipo,
} from "@/lib/plataforma-equipo-api";
import { ActionButton } from "@/components/design-system/action-button";
import { Input } from "@heroui/react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { FormDialog } from "@/components/design-system/form-dialog";
import { SelectField } from "@/components/design-system/select-field";
import theme from "@/components/design-system/brand-workspace-theme.module.css";
import base from "./empresas.module.css";
import styles from "./equipo.module.css";
const fecha = (d: string) =>
  new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(d));

export function InvitacionesEquipoView({
  puedeGestionar,
  version,
}: {
  puedeGestionar: boolean;
  version: number;
}) {
  const [pagina, setPagina] = useState(1);
  const [intento, setIntento] = useState(0);
  const [r, setR] = useState<{
    clave: string;
    datos?: InvitacionesEquipo;
    error?: string;
  }>();
  const [accion, setAccion] = useState<{
    invitacion: InvitacionEquipo;
    tipo: "cancelar" | "renovar";
  }>();
  const clave = `${pagina}:${version}:${intento}`;
  useEffect(() => {
    let actual = true;
    apiRequest<InvitacionesEquipo>(
      `/plataforma/equipo/invitaciones?pagina=${pagina}&limite=25`,
      { cache: "no-store" },
    )
      .then((datos) => {
        if (actual) setR({ clave, datos });
      })
      .catch((e) => {
        if (actual)
          setR({
            clave,
            error:
              e instanceof Error ? e.message : "No se pudo cargar la lista.",
          });
      });
    return () => {
      actual = false;
    };
  }, [pagina, clave]);
  const datos = r?.clave === clave ? r.datos : undefined;
  return (
    <>
      <p className={base.secondary}>
        Los enlaces vencen en 72 horas. Renovar un enlace invalida el anterior.
        La persona obtiene acceso al aceptar y completar MFA.
      </p>
      <div className={styles.actions}>
        <ActionButton
          variant="outline"
          onPress={() => setIntento((v) => v + 1)}
        >
          <RefreshCw data-icon="inline-start" />
          Actualizar
        </ActionButton>
      </div>
      {r?.clave === clave && r.error ? (
        <Alert variant="destructive">
          <AlertTitle>No pudimos cargar las invitaciones</AlertTitle>
          <AlertDescription>{r.error}</AlertDescription>
        </Alert>
      ) : !datos ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <div className={base.panel}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Correo</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Invitada por</TableHead>
                  {puedeGestionar && (
                    <TableHead>
                      <span className="sr-only">Acciones</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {datos.invitaciones.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>{i.email}</TableCell>
                    <TableCell>
                      {i.rol === "ADMIN" ? "Administración" : "Soporte"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          i.estado === "pendiente" ? "secondary" : "outline"
                        }
                      >
                        {
                          {
                            pendiente: "Pendiente",
                            aceptada: "Aceptada",
                            cancelada: "Cancelada",
                            vencida: "Vencida",
                          }[i.estado]
                        }
                      </Badge>
                    </TableCell>
                    <TableCell>{fecha(i.venceEl)}</TableCell>
                    <TableCell>{i.invitador}</TableCell>
                    {puedeGestionar && (
                      <TableCell>
                        <div className={styles.actions}>
                          {["pendiente", "vencida"].includes(i.estado) && (
                            <>
                              <ActionButton
                                size="sm"
                                variant="outline"
                                onPress={() =>
                                  setAccion({ invitacion: i, tipo: "renovar" })
                                }
                              >
                                Renovar enlace
                              </ActionButton>
                              <ActionButton
                                size="sm"
                                variant="ghost"
                                onPress={() =>
                                  setAccion({ invitacion: i, tipo: "cancelar" })
                                }
                              >
                                Cancelar invitación
                              </ActionButton>
                            </>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!datos.total && (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Sin invitaciones</EmptyTitle>
                  <EmptyDescription>
                    Invitá a las personas que van a operar el backoffice de
                    Grafo.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>
          <div className={styles.pagination}>
            <span className={base.secondary}>
              {datos.total} invitaciones · Página {pagina}
            </span>
            <div className={styles.actions}>
              <ActionButton
                size="sm"
                variant="outline"
                isDisabled={pagina === 1}
                onPress={() => setPagina((p) => p - 1)}
              >
                Anterior
              </ActionButton>
              <ActionButton
                size="sm"
                variant="outline"
                isDisabled={pagina * 25 >= datos.total}
                onPress={() => setPagina((p) => p + 1)}
              >
                Siguiente
              </ActionButton>
            </div>
          </div>
        </>
      )}
      {accion && (
        <InvitacionEquipoDialog
          invitacion={accion.invitacion}
          accion={accion.tipo}
          onCerrar={() => setAccion(undefined)}
          onCambio={() => setIntento((v) => v + 1)}
        />
      )}
    </>
  );
}

export function InvitacionEquipoDialog({
  invitacion,
  accion = "crear",
  onCerrar,
  onCambio,
}: {
  invitacion?: InvitacionEquipo;
  accion?: "crear" | "renovar" | "cancelar";
  onCerrar: () => void;
  onCambio: () => void;
}) {
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<RolEquipo>("SOPORTE");
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [enlace, setEnlace] = useState<EnlaceInvitacionEquipo>();
  const [copiado, setCopiado] = useState(false);
  const enviando = useRef(false);
  return (
    <FormDialog
      isOpen
      className={theme.legacy}
      isDismissable={!busy}
      onOpenChange={(v) => {
        if (!v && !busy) onCerrar();
      }}
      title={
        enlace
          ? "Invitación lista"
          : accion === "crear"
            ? "Invitar al equipo"
            : accion === "renovar"
              ? "Renovar invitación"
              : "Cancelar invitación"
      }
      description={
        enlace
          ? "Copiá el enlace y compartilo de forma privada con la persona invitada."
          : accion === "crear"
            ? "La persona acepta con su cuenta o crea una nueva. MFA es obligatoria."
            : invitacion!.email
      }
    >
      {enlace ? (
        <div className={styles.modalBody}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="enlace-equipo">
                Enlace para {enlace.email}
              </FieldLabel>
              <Input
                className={fieldFocus.singleBorder}
                fullWidth
                id="enlace-equipo"
                value={enlace.url}
                readOnly
              />
              <p className={base.secondary}>
                Vence: {fecha(enlace.venceEl)}. Se muestra una sola vez; podés
                renovarlo desde Invitaciones.
              </p>
            </Field>
            {error && <p role="alert">{error}</p>}
            <div className={styles.actions}>
              <ActionButton
                onPress={async () => {
                  try {
                    await navigator.clipboard.writeText(enlace.url);
                    setCopiado(true);
                  } catch {
                    setError(
                      "No se pudo copiar. Seleccioná el enlace y copialo manualmente.",
                    );
                  }
                }}
              >
                <Copy data-icon="inline-start" />
                {copiado ? "Copiado" : "Copiar enlace"}
              </ActionButton>
              <ActionButton variant="outline" onPress={onCerrar}>
                Listo
              </ActionButton>
            </div>
          </FieldGroup>
        </div>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (enviando.current || motivo.trim().length < 5) return;
            enviando.current = true;
            setBusy(true);
            setError("");
            try {
              const r =
                accion === "crear"
                  ? await invitarEquipo(email.trim(), rol, motivo.trim())
                  : await gestionarInvitacionEquipo(
                      invitacion!.id,
                      accion,
                      motivo.trim(),
                    );
              onCambio();
              if ("url" in r) setEnlace(r);
              else {
                toast.success("Invitación cancelada.");
                onCerrar();
              }
            } catch (e) {
              setError(e instanceof Error ? e.message : "No se pudo guardar.");
            } finally {
              enviando.current = false;
              setBusy(false);
            }
          }}
        >
          <FieldGroup className={styles.modalBody}>
            {accion === "crear" && (
              <>
                <Field>
                  <FieldLabel htmlFor="invitar-email">
                    Correo electrónico
                  </FieldLabel>
                  <Input
                    className={fieldFocus.singleBorder}
                    fullWidth
                    id="invitar-email"
                    type="email"
                    required
                    maxLength={254}
                    disabled={busy}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="invitar-rol">
                    Rol de Plataforma
                  </FieldLabel>
                  <SelectField
                    id="invitar-rol"
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
              </>
            )}
            <Alert>
              <AlertTitle>
                {accion === "cancelar"
                  ? "El enlace dejará de funcionar"
                  : accion === "renovar"
                    ? "El enlace anterior dejará de funcionar"
                    : "Aceptación personal"}
              </AlertTitle>
              <AlertDescription>
                {accion === "cancelar"
                  ? "No se otorgará acceso desde esta invitación."
                  : "El enlace vence en 72 horas. Quien lo reciba deberá acreditar su cuenta y completar MFA. No se envía un correo automáticamente."}
              </AlertDescription>
            </Alert>
            <Field>
              <FieldLabel htmlFor="invitar-motivo">Motivo</FieldLabel>
              <Input
                className={fieldFocus.singleBorder}
                fullWidth
                id="invitar-motivo"
                required
                minLength={5}
                maxLength={300}
                disabled={busy}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
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
              type="button"
              variant="outline"
              isDisabled={busy}
              onPress={onCerrar}
            >
              Volver
            </ActionButton>
            <ActionButton
              type="submit"
              variant={accion === "cancelar" ? "danger" : "primary"}
              isDisabled={busy || motivo.trim().length < 5}
            >
              {busy
                ? "Guardando…"
                : accion === "cancelar"
                  ? "Cancelar invitación"
                  : "Generar enlace"}
            </ActionButton>
          </div>
        </form>
      )}
    </FormDialog>
  );
}
