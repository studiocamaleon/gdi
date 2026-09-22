"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@heroui/react";
import { apiRequest } from "@/lib/api";
import {
  recuperarContratacionPlataforma,
  type ContratacionPlataforma,
  type PaginaContrataciones,
  type HistorialContratacion,
  type ResultadoRecuperacionContratacion,
} from "@/lib/plataforma-suscripciones-api";
import { ActionButton } from "@/components/design-system/action-button";
import { FormDialog } from "@/components/design-system/form-dialog";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import fieldFocus from "@/components/design-system/field-focus.module.css";
import theme from "@/components/design-system/brand-workspace-theme.module.css";
import styles from "./empresas.module.css";

const estados: Record<string, string> = {
  preparada: "Sin confirmar",
  enviando: "Enviando solicitud",
  checkout: "Esperando pago",
  verificar: "Resultado por verificar",
  aplicada: "Aplicada",
  rechazada: "Cerrada sin aplicar",
};
const resultados: Record<string, string> = {
  aplicada: "Contrato recuperado",
  cancelada: "Cancelación confirmada",
  checkout: "Pago localizado",
  sin_resultado: "Sin evidencia suficiente",
  no_coincide: "Requiere revisión",
  fallida: "Consulta sin resultado",
  finalizada: "Intento finalizado",
  en_curso: "Consulta registrada",
};
const pendiente = (estado: string) =>
  ["enviando", "verificar", "checkout"].includes(estado);
const fecha = (v: string) =>
  new Date(v).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });

function useDatos<T>(url: string, version: number) {
  const [intento, setIntento] = useState(0);
  const clave = `${url}:${version}:${intento}`;
  const [r, setR] = useState<{ clave: string; datos?: T; error?: string }>();
  useEffect(() => {
    let vigente = true;
    apiRequest<T>(url, { cache: "no-store" })
      .then((datos) => {
        if (vigente) setR({ clave, datos });
      })
      .catch((e) => {
        if (vigente)
          setR({
            clave,
            error: e instanceof Error ? e.message : "No se pudo consultar.",
          });
      });
    return () => {
      vigente = false;
    };
  }, [clave, url]);
  return {
    datos: r?.clave === clave ? r.datos : undefined,
    error: r?.clave === clave ? r.error : undefined,
    actualizar: () => setIntento((v) => v + 1),
  };
}
function Cargando({
  error,
  actualizar,
}: {
  error?: string;
  actualizar: () => void;
}) {
  return error ? (
    <Alert variant="destructive">
      <AlertTitle>No se pudo cargar</AlertTitle>
      <AlertDescription>
        {error}
        <ActionButton variant="outline" onPress={actualizar}>
          Reintentar
        </ActionButton>
      </AlertDescription>
    </Alert>
  ) : (
    <Skeleton aria-label="Cargando contrataciones" className="h-24 w-full" />
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
  cambiar: (n: number) => void;
}) {
  return (
    <div className={styles.pagination}>
      <span>
        {total} registros · Página {pagina}
      </span>
      <div>
        <ActionButton
          size="sm"
          variant="outline"
          isDisabled={pagina <= 1}
          onPress={() => cambiar(pagina - 1)}
        >
          Anterior
        </ActionButton>
        <ActionButton
          size="sm"
          variant="outline"
          isDisabled={pagina * limite >= total}
          onPress={() => cambiar(pagina + 1)}
        >
          Siguiente
        </ActionButton>
      </div>
    </div>
  );
}

export function ContratacionesPanel({
  id,
  esAdmin,
  version,
  actualizado,
}: {
  id: string;
  esAdmin: boolean;
  version: number;
  actualizado: () => void;
}) {
  const [pagina, setPagina] = useState(1);
  const [seleccion, setSeleccion] = useState<ContratacionPlataforma | null>(
    null,
  );
  const { datos, error, actualizar } = useDatos<PaginaContrataciones>(
    `/plataforma/suscripciones/${id}/contrataciones?pagina=${pagina}&limite=15`,
    version,
  );
  return (
    <section className={styles.panel} aria-label="Contrataciones de planes">
      <div className={styles.panelHeader}>
        <div>
          <h3>Contrataciones y cambios de plan</h3>
          <p>Revisiones, pagos pendientes y resultados recuperados.</p>
        </div>
        <ActionButton variant="outline" onPress={actualizar}>
          Actualizar contrataciones
        </ActionButton>
      </div>
      <div className={styles.panelBody}>
        {!datos ? (
          <Cargando error={error} actualizar={actualizar} />
        ) : (
          <>
            {datos.contrataciones.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan solicitado</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Iniciada</TableHead>
                    <TableHead>Referencia</TableHead>
                    <TableHead>
                      <span className="sr-only">Acciones</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datos.contrataciones.map((op) => (
                    <TableRow key={op.id}>
                      <TableCell>
                        {op.plan}
                        <small className={styles.secondary}>
                          {op.ciclo === "anual" ? "Anual" : "Mensual"} ·{" "}
                          {op.adicionales} usuarios adicionales
                        </small>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            op.estado === "verificar" ? "outline" : "secondary"
                          }
                        >
                          {estados[op.estado] ?? op.estado}
                        </Badge>
                      </TableCell>
                      <TableCell>{fecha(op.creadaEl)}</TableCell>
                      <TableCell className={styles.explanation}>
                        {op.transaccionId ??
                          op.referencia ??
                          "Sin referencia registrada"}
                        <small className={styles.secondary}>
                          {op.entorno === "production"
                            ? "Producción"
                            : "Sandbox"}
                        </small>
                      </TableCell>
                      <TableCell>
                        <ActionButton
                          size="sm"
                          variant="outline"
                          onPress={() => setSeleccion(op)}
                        >
                          Revisar
                        </ActionButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Sin contrataciones registradas</EmptyTitle>
                  <EmptyDescription>
                    Las revisiones y cambios solicitados desde la cuenta de la
                    empresa aparecerán acá.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
            {datos.total > datos.limite && (
              <Paginas {...datos} cambiar={setPagina} />
            )}
          </>
        )}
      </div>
      {seleccion && (
        <RecuperarContratacionDialog
          id={id}
          op={seleccion}
          esAdmin={esAdmin}
          cerrar={() => {
            setSeleccion(null);
            actualizar();
            actualizado();
          }}
        />
      )}
    </section>
  );
}

export function RecuperarContratacionDialog({
  id,
  op,
  esAdmin,
  cerrar,
}: {
  id: string;
  op: ContratacionPlataforma;
  esAdmin: boolean;
  cerrar: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [referencia, setReferencia] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] =
    useState<ResultadoRecuperacionContratacion | null>(null);
  const envio = useRef<{
    solicitudId: string;
    motivo: string;
    transaccionId?: string;
  } | null>(null);
  const enviando = useRef(false);
  const [version, setVersion] = useState(0),
    [pagina, setPagina] = useState(1);
  const historial = useDatos<HistorialContratacion>(
    `/plataforma/suscripciones/${id}/contrataciones/${op.id}/historial?pagina=${pagina}&limite=10`,
    version,
  );
  const editable = esAdmin && pendiente(resultado?.estado ?? op.estado);
  const refValida =
    !referencia.trim() || /^txn_[a-z0-9]{26}$/.test(referencia.trim());
  return (
    <FormDialog
      isOpen
      title="Revisar contratación"
      description={op.plan}
      className={theme.theme}
      isDismissable={!busy}
      onOpenChange={(open) => {
        if (!open && !busy) cerrar();
      }}
    >
      <form
        className={styles.modalForm}
        data-ui="heroui"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            enviando.current ||
            !editable ||
            resultado ||
            motivo.trim().length < 5 ||
            !refValida
          )
            return;
          enviando.current = true;
          setBusy(true);
          setError("");
          envio.current ??= {
            solicitudId: crypto.randomUUID(),
            motivo: motivo.trim(),
            ...(referencia.trim() ? { transaccionId: referencia.trim() } : {}),
          };
          try {
            setResultado(
              await recuperarContratacionPlataforma(id, op.id, envio.current),
            );
            setVersion((v) => v + 1);
          } catch (e) {
            setError(
              e instanceof Error
                ? e.message
                : "No se pudo confirmar la consulta. Revisá el historial.",
            );
          } finally {
            enviando.current = false;
            setBusy(false);
          }
        }}
      >
        <div>
          <FieldGroup>
            <div>
              <Badge variant="secondary">
                {estados[resultado?.estado ?? op.estado] ?? op.estado}
              </Badge>
              <p className={styles.note}>
                {op.tipo === "checkout"
                  ? "Alta de suscripción"
                  : "Cambio de plan o usuarios"}{" "}
                · {op.entorno === "production" ? "Producción" : "Sandbox"}
              </p>
              <p className={styles.note}>Intento: {op.id}</p>
              {(resultado?.transaccionId ??
                op.transaccionId ??
                op.referencia) && (
                <p className={styles.note}>
                  {resultado?.transaccionId ??
                    op.transaccionId ??
                    op.referencia}
                </p>
              )}
            </div>
            {resultado && (
              <Alert
                variant={
                  resultado.resultado === "fallida" ||
                  resultado.resultado === "no_coincide"
                    ? "destructive"
                    : "default"
                }
              >
                <AlertTitle>
                  {resultados[resultado.resultado] ??
                    "Resultado de la consulta"}
                </AlertTitle>
                <AlertDescription>{resultado.detalle}</AlertDescription>
              </Alert>
            )}
            {editable && !resultado && (
              <>
                <p>
                  Consultaremos Paddle y actualizaremos Grafo con el resultado
                  comprobado. Esta acción no vuelve a enviar la solicitud de
                  cobro.
                </p>
                {op.tipo === "checkout" && !op.transaccionId && (
                  <Field data-invalid={!refValida}>
                    <FieldLabel htmlFor="transaccion-recuperacion">
                      Referencia de transacción (opcional)
                    </FieldLabel>
                    <Input
                      id="transaccion-recuperacion"
                      className={fieldFocus.singleBorder}
                      fullWidth
                      value={referencia}
                      disabled={busy || !!envio.current}
                      onChange={(e) => setReferencia(e.target.value)}
                      aria-invalid={!refValida}
                      maxLength={30}
                      placeholder="txn_…"
                    />
                    <FieldDescription>
                      Copiala desde Paddle si la búsqueda automática no encontró
                      el pago. Grafo comprobará la empresa y el intento.
                    </FieldDescription>
                  </Field>
                )}
                <Field>
                  <FieldLabel htmlFor="motivo-recuperacion">
                    Motivo de la consulta
                  </FieldLabel>
                  <Input
                    id="motivo-recuperacion"
                    className={fieldFocus.singleBorder}
                    fullWidth
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    disabled={busy || !!envio.current}
                    minLength={5}
                    maxLength={300}
                    required
                    placeholder="El cliente pagó y el plan todavía no se actualizó"
                  />
                </Field>
              </>
            )}
            {!esAdmin && (
              <p>
                Soporte puede revisar el historial. Para consultar Paddle y
                recuperar el resultado se necesita una sesión de administración
                con MFA.
              </p>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertTitle>No se confirmó la consulta</AlertTitle>
                <AlertDescription>
                  {error} Reintentar conserva la misma solicitud.
                </AlertDescription>
              </Alert>
            )}
            <section aria-label="Historial de recuperación">
              <h3>Historial de consultas</h3>
              {!historial.datos ? (
                <Cargando
                  error={historial.error}
                  actualizar={historial.actualizar}
                />
              ) : (
                <>
                  {historial.datos.eventos.length ? (
                    <ul className={styles.timeline}>
                      {historial.datos.eventos.map((e) => (
                        <li key={e.id}>
                          <strong>
                            {e.actor} · {fecha(e.fecha)}
                          </strong>
                          <p>{e.descripcion}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.note}>
                      Todavía no se registraron consultas de Plataforma para
                      este intento.
                    </p>
                  )}
                  {historial.datos.total > historial.datos.limite && (
                    <Paginas {...historial.datos} cambiar={setPagina} />
                  )}
                </>
              )}
              <ActionButton
                type="button"
                size="sm"
                variant="outline"
                onPress={historial.actualizar}
              >
                Actualizar historial
              </ActionButton>
            </section>
          </FieldGroup>
        </div>
        <div className={styles.modalFooter}>
          <ActionButton
            type="button"
            variant="outline"
            isDisabled={busy}
            onPress={cerrar}
          >
            Cerrar
          </ActionButton>
          {editable &&
            (resultado ? (
              <ActionButton
                type="button"
                variant="outline"
                onPress={() => {
                  envio.current = null;
                  setResultado(null);
                  setError("");
                }}
              >
                Nueva consulta
              </ActionButton>
            ) : (
              <ActionButton
                type="submit"
                isDisabled={busy || motivo.trim().length < 5 || !refValida}
              >
                {busy
                  ? "Consultando…"
                  : error
                    ? "Reintentar consulta"
                    : "Consultar y recuperar"}
              </ActionButton>
            ))}
        </div>
      </form>
    </FormDialog>
  );
}
