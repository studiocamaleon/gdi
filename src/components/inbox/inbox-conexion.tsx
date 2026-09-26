"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import {
  metaConexionApi,
  type EstadoConexionMeta,
  type MetaConexionApi,
  type PreparacionMeta,
} from "@/lib/meta-conexion-api";
import {
  cargarMetaSdk,
  iniciarAltaMeta,
  type MetaSdk,
  type PasoAltaMeta,
} from "@/lib/meta-signup-sdk";
import type { InboxIdentidad } from "@/lib/meta-inbox-api";

export function EstadoImportacion({
  canal,
}: {
  canal: NonNullable<EstadoConexionMeta["canal"]>;
}) {
  const imp = canal.importacion;
  const detenido =
    canal.estado !== "VERIFICADO" ||
    canal.credencialVencida ||
    ["REVISION", "PAUSADA"].includes(canal.alta?.estado ?? "") ||
    canal.revisiones > 0 ||
    imp?.necesitaRevision;
  const aceptadas = canal.alta?.estado === "SOLICITUDES_COMPLETADAS";
  return (
    <div className="grid w-full gap-4 text-left">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{canal.numero}</p>
        <Badge variant="secondary">
          {detenido
            ? "Requiere revisión"
            : aceptadas
              ? "Esperando datos de Meta"
              : "Preparando conexión"}
        </Badge>
      </div>
      {detenido ? (
        <Alert>
          <ShieldCheck />
          <AlertTitle>Revisemos la conexión</AlertTitle>
          <AlertDescription>
            El proceso se detuvo y necesita una revisión. No vuelvas a dar de
            alta el número para intentar recuperar el historial.
          </AlertDescription>
        </Alert>
      ) : (
        <p className="text-sm text-muted-foreground">
          {aceptadas
            ? "Meta aceptó las solicitudes de contactos e historial. Los datos llegan por partes; podés cerrar esta pestaña."
            : "Grafo está preparando la recepción de mensajes y solicitando los datos que autorizaste compartir."}
        </p>
      )}
      {imp?.historialRechazado ? (
        <Alert>
          <AlertTitle>Historial no compartido</AlertTitle>
          <AlertDescription>
            No se importarán las conversaciones anteriores que no autorizaste
            compartir.
          </AlertDescription>
        </Alert>
      ) : (
        imp && (
          <>
            <Progress value={imp.progresoInformado}>
              <ProgressLabel>Progreso informado por Meta</ProgressLabel>
              <ProgressValue />
            </Progress>
            <p className="text-sm text-muted-foreground">
              {imp.finInformadoEl
                ? "Meta informó el fin del envío. Grafo todavía debe comprobar que todos los bloques estén procesados."
                : "Recibiendo las conversaciones que Meta tenga disponibles."}
              {canal.pendientes > 0
                ? ` Quedan ${canal.pendientes} eventos por procesar.`
                : ""}
            </p>
          </>
        )
      )}
      <p className="text-xs text-muted-foreground">
        La importación inicial y la disponibilidad para enviar mensajes se
        verifican por separado.
      </p>
    </div>
  );
}

export function InboxConexion({
  identidad,
  api = metaConexionApi,
}: {
  identidad: InboxIdentidad;
  api?: MetaConexionApi;
}) {
  const [estado, setEstado] = useState<EstadoConexionMeta | null>(null);
  const [error, setError] = useState(false);
  const [paso, setPaso] = useState<
    PasoAltaMeta | "reposo" | "preparando" | "listo"
  >("reposo");
  const [preparado, setPreparado] = useState<{
    intento: PreparacionMeta;
    sdk: MetaSdk;
  } | null>(null);
  const [revision, setRevision] = useState(0);
  const [https, setHttps] = useState(false);
  const vivo = useRef(false);
  const cancelar = useRef<(() => void) | null>(null);
  const pendiente = useRef<PreparacionMeta | null>(null);
  const ocupado = useRef(false);
  const operacion = useRef(0);
  useEffect(() => {
    vivo.current = true;
    setHttps(window.location.protocol === "https:");
    return () => {
      vivo.current = false;
      // Es un contador de peticiones; invalidar su valor actual al desmontar.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      operacion.current++;
      cancelar.current?.();
      if (pendiente.current)
        void api.cancelar(pendiente.current).catch(() => undefined);
      pendiente.current = null;
    };
  }, [api]);
  useEffect(() => {
    const controller = new AbortController();
    let cerrado = false;
    let timer: ReturnType<typeof setTimeout>;
    async function cargar() {
      try {
        const result = await api.estado(
          AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        );
        if (cerrado) return;
        if (
          result.empresaId !== identidad.empresaId ||
          result.usuarioId !== identidad.usuarioId
        )
          throw new Error("IDENTIDAD_CAMBIO");
        setEstado(result);
        setError(false);
        if (result.canal) timer = setTimeout(() => void cargar(), 5000);
      } catch {
        if (!cerrado) {
          setEstado(null);
          setError(true);
        }
      }
    }
    void cargar();
    return () => {
      cerrado = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [api, identidad.empresaId, identidad.usuarioId, revision]);
  async function preparar() {
    if (ocupado.current || !estado?.disponible || !https) return;
    const generacion = ++operacion.current;
    ocupado.current = true;
    setPaso("preparando");
    setError(false);
    try {
      const intento = await api.preparar();
      if (!vivo.current || generacion !== operacion.current) {
        void api.cancelar(intento).catch(() => undefined);
        return;
      }
      pendiente.current = intento;
      const sdk = await cargarMetaSdk(intento);
      if (!vivo.current || generacion !== operacion.current) return;
      setPreparado({ intento, sdk });
      setPaso("listo");
    } catch {
      if (generacion !== operacion.current) return;
      if (pendiente.current)
        void api.cancelar(pendiente.current).catch(() => undefined);
      pendiente.current = null;
      if (vivo.current) setPaso("error");
    } finally {
      if (generacion === operacion.current) ocupado.current = false;
    }
  }
  function abrir() {
    if (!preparado || ocupado.current) return;
    if (Date.parse(preparado.intento.venceEl) <= Date.now()) {
      cancelarPreparacion();
      setPaso("error");
      return;
    }
    const generacion = operacion.current;
    ocupado.current = true;
    pendiente.current = null;
    cancelar.current = iniciarAltaMeta({
      sdk: preparado.sdk,
      preparacion: preparado.intento,
      api,
      cambiar: (nuevo) => {
        if (!vivo.current || generacion !== operacion.current) return;
        setPaso(nuevo);
        if (["completado", "cancelado", "error"].includes(nuevo)) {
          ocupado.current = false;
          setPreparado(null);
          setRevision((n) => n + 1);
        }
      },
    });
  }
  function cancelarPreparacion() {
    operacion.current++;
    if (pendiente.current)
      void api.cancelar(pendiente.current).catch(() => undefined);
    pendiente.current = null;
    cancelar.current?.();
    cancelar.current = null;
    setPreparado(null);
    setPaso("reposo");
    ocupado.current = false;
  }
  const trabajando = ["preparando", "esperando_meta", "verificando"].includes(
    paso,
  );
  const sandbox = estado?.modo === "SANDBOX";
  const pasos = sandbox
    ? ["Autorizá en Meta", "Elegí la cuenta de prueba", "Revisá el resultado"]
    : ["Autorizá en Meta", "Compartí tu historial", "Continuá en Grafo"];
  return (
    <Card className="w-full max-w-2xl">
      <CardContent className="grid gap-5 pt-6">
        {estado?.canal ? (
          <EstadoImportacion canal={estado.canal} />
        ) : (
          <>
            <ol
              className="grid gap-4 text-left sm:grid-cols-3"
              aria-label="Pasos para conectar WhatsApp"
            >
              {pasos.map((texto, i) => (
                <li key={texto} className="grid gap-2 text-sm">
                  <span className="flex size-7 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground">
                    {i + 1}
                  </span>
                  <span>{texto}</span>
                </li>
              ))}
            </ol>
            {sandbox && (
              <Alert>
                <ShieldCheck />
                <AlertTitle>Prueba de autorización</AlertTitle>
                <AlertDescription>
                  Elegí la cuenta sandbox de Meta. Este ensayo comprueba el
                  acceso. No permite enviar mensajes ni importar conversaciones
                  reales.
                </AlertDescription>
              </Alert>
            )}
            {estado?.sandboxVerificadoEl && (
              <Alert>
                <Check />
                <AlertTitle>Autorización de prueba verificada</AlertTitle>
                <AlertDescription>
                  El recorrido de acceso funcionó. Todavía no hay un número
                  operativo conectado a Grafo.
                </AlertDescription>
              </Alert>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {paso === "listo" ? (
                <Button size="lg" onClick={abrir}>
                  Continuar con Meta
                  <ArrowRight data-icon="inline-end" />
                </Button>
              ) : (
                <Button
                  size="lg"
                  disabled={!estado?.disponible || !https || trabajando}
                  onClick={() => void preparar()}
                >
                  {trabajando ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <MessageCircle data-icon="inline-start" />
                  )}
                  {paso === "preparando"
                    ? "Preparando…"
                    : paso === "esperando_meta"
                      ? "Completá el paso en Meta"
                      : paso === "verificando"
                        ? "Comprobando autorización…"
                        : sandbox
                          ? "Probar autorización"
                          : "Conectar WhatsApp"}
                </Button>
              )}
              {(trabajando || paso === "listo") && (
                <Button variant="ghost" onClick={cancelarPreparacion}>
                  Cancelar
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground" role="status">
              {paso === "cancelado"
                ? "Cancelaste el intento. Podés comenzar otro cuando quieras."
                : paso === "error"
                  ? "No pudimos completar el intento. Actualizá el estado antes de volver a empezar."
                  : !estado && !error
                    ? "Comprobando disponibilidad…"
                    : !estado?.disponible
                      ? "La conexión de números estará disponible próximamente."
                      : !https
                        ? "La prueba de conexión se realiza desde el entorno seguro de staging."
                        : paso === "listo"
                          ? "Se abrirá la ventana de Meta para que revises y autorices el acceso."
                          : "La autorización se completa en Meta. Grafo nunca te pedirá la contraseña de Facebook."}
            </p>
          </>
        )}
        {(error || paso === "error" || estado?.canal) && (
          <div className="grid justify-items-center gap-2">
            {error && (
              <p role="alert" className="text-sm text-muted-foreground">
                No pudimos consultar el estado de la conexión.
              </p>
            )}
            <Button variant="outline" onClick={() => setRevision((n) => n + 1)}>
              <RefreshCw data-icon="inline-start" />
              Actualizar estado
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
