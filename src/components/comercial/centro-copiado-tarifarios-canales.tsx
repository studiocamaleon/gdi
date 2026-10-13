"use client";
import styles from "./centro-copiado-tarifarios.module.css";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
  CardFooter,
  AvisoCopiado,
  EstadoCopiado,
} from "./centro-copiado-ui";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  Store,
  MessageCircle,
  Mail,
  Globe,
  Smartphone,
  ArrowRight,
  Info,
  Clock3,
  Route,
} from "lucide-react";

import { FieldGroup } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmacionSalida } from "@/components/ui/confirmacion-salida";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import * as api from "@/lib/centro-copiado-tarifarios-api";
import {
  Elegir,
  ErrorTarifa,
  mensajeErrorTarifa,
  useAvisoCambios,
} from "./centro-copiado-tarifarios-controles";

const canales = [
  { value: "mostrador", label: "Mostrador", icon: Store },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "email", label: "Email", icon: Mail },
  { value: "web", label: "Web", icon: Globe },
  { value: "app_movil", label: "App móvil", icon: Smartphone },
] as const;
const pendientes = {
  SIN_VERSION_VIGENTE: "Sin versión vigente",
  TARIFARIO_NO_DISPONIBLE: "Tarifario no disponible",
  MONEDA_INCOMPATIBLE: "Moneda incompatible",
};
type Asignacion = api.PoliticaPrecios["canales"][api.CanalCopiado];
function valorAsignacion(a: Asignacion) {
  return a.modalidad === "TARIFARIO" ? a.tarifarioId : a.modalidad;
}
function desdeSeleccion(s: string): Asignacion {
  return s === "HEREDAR" || s === "MOTOR"
    ? { modalidad: s }
    : { modalidad: "TARIFARIO", tarifarioId: s };
}
export function CentroCopiadoCanales({
  puedeGestionar,
  revisionTarifarios,
  activo,
}: {
  puedeGestionar: boolean;
  revisionTarifarios: number;
  activo: boolean;
}) {
  const { zonaHoraria } = useConfigRegional();
  const [base, setBase] = useState<api.BorradorPolitica | null>(null);
  const [contenido, setContenido] = useState<api.PoliticaPrecios | null>(null);
  const [lista, setLista] = useState<api.ResumenTarifario[]>([]);
  const [preview, setPreview] = useState<api.VistaCanales | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [descartar, setDescartar] = useState(false);
  const bloqueo = useRef(false);
  const cambios =
    !!contenido &&
    JSON.stringify(contenido) !== JSON.stringify(base?.contenido);
  const cambiosRef = useRef(cambios);
  const interacciones = useRef(0);
  function editar(c: api.PoliticaPrecios) {
    interacciones.current++;
    setContenido(c);
  }
  useEffect(() => {
    cambiosRef.current = cambios;
  }, [cambios]);
  useAvisoCambios(cambios);
  useEffect(() => {
    if (!activo) return;
    let viva = true;
    const interaccionInicial = interacciones.current;
    api
      .listarTarifarios()
      .then((l) => {
        if (viva) setLista(l);
      })
      .catch((e) => {
        if (viva) setError(mensajeErrorTarifa(e));
      });
    // Actualiza la vista previa al volver a Canales; nunca reemplaza una edición en curso.
    api
      .previsualizarCanales()
      .then((p) => {
        if (
          viva &&
          interaccionInicial === interacciones.current &&
          !bloqueo.current &&
          !cambiosRef.current
        ) {
          setBase(p.borrador);
          setContenido(p.borrador.contenido);
          setPreview(p);
        }
      })
      .catch((e) => {
        if (viva) setError(mensajeErrorTarifa(e));
      })
      .finally(() => {
        if (viva) setCargando(false);
      });
    return () => {
      viva = false;
    };
  }, [revisionTarifarios, activo]);
  async function recargar() {
    if (bloqueo.current) return;
    interacciones.current++;
    bloqueo.current = true;
    setOcupado(true);
    setError(null);
    try {
      const [p, l] = await Promise.all([
        api.previsualizarCanales(),
        api.listarTarifarios(),
      ]);
      setBase(p.borrador);
      setContenido(p.borrador.contenido);
      setPreview(p);
      setLista(l);
    } catch (e) {
      setError(mensajeErrorTarifa(e));
    } finally {
      bloqueo.current = false;
      setOcupado(false);
      setCargando(false);
    }
  }
  async function guardar() {
    if (!base || !contenido || !puedeGestionar || bloqueo.current) return false;
    interacciones.current++;
    bloqueo.current = true;
    setOcupado(true);
    setError(null);
    let guardado = false;
    try {
      const b = await api.guardarPoliticaTarifarios(base.revision, contenido);
      setBase(b);
      setContenido(b.contenido);
      setPreview(null);
      guardado = true;
      toast.success("Asignación por canal guardada en preparación.");
      try {
        setPreview(await api.previsualizarCanales());
      } catch {
        setError(
          "La asignación se guardó, pero no se pudo actualizar la vista previa. Usá Actualizar vista previa.",
        );
      }
    } catch (e) {
      setError(mensajeErrorTarifa(e));
    } finally {
      bloqueo.current = false;
      setOcupado(false);
    }
    return guardado;
  }
  const opciones = (a: Asignacion, heredar: boolean) => [
    ...(heredar
      ? [{ value: "HEREDAR", label: "Heredar política general" }]
      : []),
    { value: "MOTOR", label: "Motor de cotización" },
    ...lista.map((t) => ({ value: t.id, label: t.nombre })),
    ...(a.modalidad === "TARIFARIO" &&
    !lista.some((t) => t.id === a.tarifarioId)
      ? [
          {
            value: a.tarifarioId,
            label: "Tarifario asignado no disponible en el listado",
          },
        ]
      : []),
  ];
  const previewActual =
    !cambios && preview && preview.borrador.revision === base?.revision;
  return (
    <div className="grid gap-4">
      <ErrorTarifa error={error} />
      <Card>
        <CardHeader>
          <CardTitle>Precios por canal de venta</CardTitle>
          <CardDescription>
            Definí una política general y sólo las excepciones que necesites.
            Varios canales pueden compartir un tarifario. Guardá y revisá esta
            asignación antes de activarla en pedidos; los presupuestos emitidos
            conservan sus precios.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <ol className={styles.workflow}>
            <li>
              <span>01</span> Elegí la política general
            </li>
            <li>
              <span>02</span> Guardá las excepciones
            </li>
            <li>
              <span>03</span> Revisá y activá en pedidos
            </li>
          </ol>
          {cargando ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            contenido && (
              <>
                <FieldGroup>
                  <Elegir
                    etiqueta="Política general"
                    valor={valorAsignacion(contenido.general)}
                    opciones={opciones(contenido.general, false)}
                    disabled={!puedeGestionar || ocupado}
                    onChange={(v) => {
                      const general = desdeSeleccion(v);
                      if (general.modalidad !== "HEREDAR")
                        editar({ ...contenido, general });
                    }}
                    ayuda="Los canales sin excepción heredan esta elección."
                  />
                </FieldGroup>
                <FieldGroup className={styles.channelList}>
                  {canales.map((c) => (
                    <div key={c.value} className={styles.channelRow}>
                      <div>
                        <strong>{c.label}</strong>
                        <p>
                          {contenido.canales[c.value].modalidad === "HEREDAR"
                            ? `Usa la política general: ${contenido.general.modalidad === "MOTOR" ? "Motor de cotización" : (lista.find((t) => t.id === valorAsignacion(contenido.general))?.nombre ?? "Tarifario no disponible")}`
                            : "Precio específico para este canal"}
                        </p>
                      </div>
                      <Elegir
                        etiqueta={c.label}
                        valor={valorAsignacion(contenido.canales[c.value])}
                        opciones={opciones(contenido.canales[c.value], true)}
                        disabled={!puedeGestionar || ocupado}
                        onChange={(v) =>
                          editar({
                            ...contenido,
                            canales: {
                              ...contenido.canales,
                              [c.value]: desdeSeleccion(v),
                            },
                          })
                        }
                      />
                    </div>
                  ))}
                </FieldGroup>
              </>
            )
          )}
          <div className="flex flex-wrap items-center gap-3">
            <EstadoCopiado>
              {base?.activaRevision === base?.revision
                ? "Asignación activa"
                : base?.operativa
                  ? "Cambios pendientes de activar"
                  : "En preparación"}
            </EstadoCopiado>
            {cambios && (
              <EstadoCopiado tono="warning">Cambios sin guardar</EstadoCopiado>
            )}
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              <Button
                variant="outline"
                disabled={ocupado}
                onClick={() => {
                  if (cambios) setDescartar(true);
                  else void recargar();
                }}
              >
                {cambios
                  ? "Recargar asignación guardada"
                  : "Actualizar vista previa"}
              </Button>
              {puedeGestionar && (
                <Button
                  variant="outline"
                  disabled={
                    ocupado ||
                    cambios ||
                    !base?.revision ||
                    base.activaRevision === base.revision ||
                    !previewActual ||
                    preview.canales.some((c) => c.estado === "PENDIENTE")
                  }
                  onClick={async () => {
                    if (!base || bloqueo.current) return;
                    bloqueo.current = true;
                    setOcupado(true);
                    setError(null);
                    try {
                      const nueva = await api.activarPoliticaTarifarios(
                        base.revision,
                      );
                      setBase(nueva);
                      toast.success(
                        "Política activada. Los borradores deberán revisar sus precios antes de emitir.",
                      );
                    } catch (e) {
                      setError(mensajeErrorTarifa(e));
                    } finally {
                      bloqueo.current = false;
                      setOcupado(false);
                    }
                  }}
                >
                  Activar asignación en pedidos
                </Button>
              )}
              {puedeGestionar && (
                <Button
                  loading={ocupado}
                  disabled={!cambios || ocupado}
                  onClick={() => void guardar()}
                >
                  Guardar canales
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Vista previa de la asignación guardada</CardTitle>
          <CardDescription>
            {cambios
              ? "Guardá los cambios para comprobar qué versión resolvería cada canal."
              : previewActual
                ? "Así se resolverían los precios de cada canal con la asignación guardada."
                : "Actualizá la vista previa para comprobar la asignación."}
          </CardDescription>
          {previewActual && (
            <CardAction>
              <EstadoCopiado
                tono={
                  preview.canales.some((c) => c.estado === "PENDIENTE")
                    ? "warning"
                    : "neutral"
                }
              >
                {preview.canales.length} canales · {preview.monedaCodigo}
              </EstadoCopiado>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          {previewActual ? (
            <ol
              className={styles.channelPreview}
              aria-label="Precios resueltos por canal"
            >
              {canales.flatMap((canal) => {
                const c = preview.canales.find(
                  (p) => p.canalVenta === canal.value,
                );
                if (!c) return [];
                const Icono = canal.icon;
                return [
                  <li
                    className={styles.channelResolution}
                    key={c.canalVenta}
                    data-pending={c.estado === "PENDIENTE" || undefined}
                  >
                    <div className={styles.channelIdentity}>
                      <span className={styles.channelIcon}>
                        <Icono aria-hidden />
                      </span>
                      <div>
                        <h4>{canal.label}</h4>
                        <p>
                          {c.origen === "GENERAL"
                            ? "Hereda la política general"
                            : "Excepción del canal"}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className={styles.channelArrow} aria-hidden />
                    <div className={styles.channelSelection}>
                      <strong>
                        {c.estado === "MOTOR"
                          ? "Motor de cotización"
                          : c.estado === "PENDIENTE"
                            ? pendientes[c.motivo]
                            : c.version.nombre}
                      </strong>
                      <span>
                        {c.estado === "MOTOR"
                          ? "Calcula el precio para cada pedido"
                          : c.estado === "PENDIENTE"
                            ? "Resolvé este pendiente antes de activar"
                            : `Versión ${c.version.numero} · desde ${new Intl.DateTimeFormat("es-AR", { timeZone: zonaHoraria, dateStyle: "short", timeStyle: "short" }).format(new Date(c.version.vigenteDesde))}`}
                      </span>
                    </div>
                    <EstadoCopiado
                      tono={
                        c.estado === "PENDIENTE"
                          ? "warning"
                          : c.estado === "TARIFARIO"
                            ? "brand"
                            : "neutral"
                      }
                    >
                      {c.estado === "MOTOR"
                        ? "Motor"
                        : c.estado === "PENDIENTE"
                          ? "Pendiente"
                          : "Tarifario"}
                    </EstadoCopiado>
                  </li>,
                ];
              })}
            </ol>
          ) : (
            <AvisoCopiado
              icono={<Route />}
              titulo={
                cambios
                  ? "Hay una nueva asignación por revisar"
                  : "Sin vista previa actualizada"
              }
            >
              {cambios
                ? "Guardá los canales para ver los precios que usaría cada uno."
                : "Actualizá la vista previa desde las acciones de arriba."}
            </AvisoCopiado>
          )}
        </CardContent>
        <CardFooter className={styles.previewFooter}>
          {previewActual && (
            <p>
              <Clock3 aria-hidden />
              Evaluada el{" "}
              {new Intl.DateTimeFormat("es-AR", {
                timeZone: zonaHoraria,
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(preview.evaluadoEl))}{" "}
              · {zonaHoraria}
            </p>
          )}
          <p>
            <Info aria-hidden />
            Esta vista comprueba la selección de tarifario y versión; no
            verifica que cada combinación tenga precio ni activa el cálculo de
            pedidos.
          </p>
        </CardFooter>
      </Card>
      <ConfirmacionSalida
        open={descartar}
        cambios={1}
        donde="la asignación por canal"
        guardando={ocupado}
        onSeguirEditando={() => setDescartar(false)}
        onDescartarYSalir={() => {
          setDescartar(false);
          void recargar();
        }}
        onGuardarYSalir={async () => {
          if (await guardar()) setDescartar(false);
        }}
      />
    </div>
  );
}
