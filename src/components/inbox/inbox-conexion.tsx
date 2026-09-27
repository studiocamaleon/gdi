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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import s from "./inbox-bienvenida.module.css";
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
  if (canal.tipo === "PRUEBA")
    return (
      <div className="flex flex-col gap-4 text-left">
        <Badge variant="secondary">Canal de prueba de Meta</Badge>
        <p className="font-medium">{canal.numero}</p>
        <Alert>
          <ShieldCheck />
          <AlertTitle>
            {canal.credencialVencida
              ? "El acceso de prueba venció"
              : canal.estado !== "VERIFICADO" || !canal.prueba?.habilitada
                ? "Prueba deshabilitada"
                : "Prueba habilitada"}
          </AlertTitle>
          <AlertDescription>
            {canal.credencialVencida
              ? "Renová la credencial de prueba desde la configuración de staging para continuar. Las conversaciones se conservan."
              : "Los mensajes de este canal son reales y sólo se permiten con el destinatario autorizado para el ensayo."}
          </AlertDescription>
        </Alert>
        <p className="text-sm text-muted-foreground">
          Destinatario: {canal.prueba?.destinatario}
        </p>
        {canal.prueba?.venceEl && (
          <p className="text-sm text-muted-foreground">
            Vencimiento:{" "}
            {new Date(canal.prueba.venceEl).toLocaleString("es-AR")}
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          Este ensayo permite probar mensajes y estados. La conexión de tu
          WhatsApp Business y la importación de conversaciones se comprueban por
          separado.
        </p>
      </div>
    );
  const imp = canal.importacion;
  const resumen = canal.resumen;
  const suspendido = canal.estado === "SUSPENDIDO";
  const desconectado = canal.estado === "DESCONECTADO";
  const detenido =
    canal.credencialVencida ||
    ["REVISION", "PAUSADA"].includes(canal.alta?.estado ?? "") ||
    canal.revisiones > 0 ||
    imp?.necesitaRevision;
  const etiquetas = {
    PREPARANDO: "Preparando conexión",
    ESPERANDO_META: "Esperando a Meta",
    RECIBIENDO: "Recibiendo historial",
    PROCESANDO: "Procesando historial",
    RECIBIDO_PROCESADO: "Datos recibidos procesados",
    NO_COMPARTIDO: "Historial no compartido",
    REVISION: "Requiere revisión",
  };
  const explicaciones = {
    PREPARANDO:
      "Grafo está preparando la recepción y solicitando los datos que autorizaste compartir.",
    ESPERANDO_META:
      "Meta aceptó las solicitudes. Esperamos el historial; podés cerrar esta pestaña.",
    RECIBIENDO:
      "Las conversaciones llegan por partes. Todavía no recibimos la confirmación de fin de Meta.",
    PROCESANDO:
      "Grafo todavía debe comprobar y procesar los datos recibidos. Podés seguir usando la aplicación.",
    RECIBIDO_PROCESADO:
      "Meta informó el fin del envío y Grafo procesó todo el historial recibido hasta esta consulta. Si llega otra parte, el estado se actualizará.",
    NO_COMPARTIDO:
      "No se importarán las conversaciones anteriores que no autorizaste compartir.",
    REVISION:
      "El proceso necesita una revisión. No vuelvas a dar de alta el número para intentar recuperar el historial.",
  };
  const fase =
    resumen?.estado ??
    (detenido
      ? "REVISION"
      : canal.pendientes > 0
        ? "PROCESANDO"
        : "ESPERANDO_META");
  return (
    <div className="grid w-full gap-4 text-left">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{canal.numero}</p>
        <Badge variant="secondary">
          {desconectado
            ? "Desconectado"
            : suspendido
              ? "Esperando reconexión"
              : detenido
                ? "Requiere revisión"
                : etiquetas[fase]}
        </Badge>
      </div>
      {(suspendido || desconectado || canal.credencialVencida) && (
        <Alert>
          <ShieldCheck />
          <AlertTitle>
            {desconectado
              ? "WhatsApp está desconectado"
              : suspendido
                ? "Conexión pausada en WhatsApp"
                : "El acceso necesita renovarse"}
          </AlertTitle>
          <AlertDescription>
            {suspendido
              ? "Esto puede ocurrir al cambiar de celular o reinstalar WhatsApp Business. Completá el registro en el celular y conservá la conexión con Grafo. Esperaremos la confirmación de Meta; no se vuelve a solicitar el historial."
              : desconectado
                ? canal.reconexionPermitida
                  ? "Meta confirmó la desvinculación. Podés iniciar una nueva autorización cuando la conexión esté habilitada. Las conversaciones guardadas se conservan."
                  : "Grafo dejó de usar este acceso. Antes de iniciar otra alta necesitamos confirmar la desvinculación en Meta."
                : "No se reactivará automáticamente una credencial vencida. El acceso debe revisarse antes de continuar."}
          </AlertDescription>
        </Alert>
      )}
      <p className="text-sm text-muted-foreground">
        {desconectado
          ? "No se reciben mensajes con esta conexión. El historial guardado se conserva."
          : suspendido
            ? "Esperamos la reconexión. El progreso que ves corresponde a los datos recibidos antes de la pausa."
            : explicaciones[detenido ? "REVISION" : fase]}
      </p>
      {imp && !imp.historialRechazado && (
        <Progress value={imp.progresoInformado}>
          <ProgressLabel>Progreso informado por Meta</ProgressLabel>
          <ProgressValue />
        </Progress>
      )}
      {(resumen?.pendientes ?? canal.pendientes) > 0 && (
        <p className="text-sm text-muted-foreground">
          Quedan {resumen?.pendientes ?? canal.pendientes} eventos de historial
          por procesar.
        </p>
      )}
      {resumen && (
        <p className="text-sm text-muted-foreground">
          {resumen.bloquesProcesados} bloques de historial procesados.
        </p>
      )}
      {imp?.historialRechazado && (
        <Alert>
          <AlertTitle>Historial no compartido</AlertTitle>
          <AlertDescription>{explicaciones.NO_COMPARTIDO}</AlertDescription>
        </Alert>
      )}
      <p className="text-xs text-muted-foreground">
        El historial depende de lo que Meta pueda compartir. Los períodos sin
        conversaciones no envían bloques; este estado no certifica seis meses
        completos ni la descarga de todos los archivos.
      </p>
      {!desconectado && (
        <p className="text-xs text-muted-foreground">
          Para desvincular el número, abrí WhatsApp Business en el celular:
          Configuración → Cuenta → Plataforma empresarial → Desconectar cuenta.
          Grafo reflejará la confirmación de Meta.
        </p>
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
    <Card className="w-full">
      <CardHeader>
        <CardTitle>
          {estado?.canal
            ? "Tu conexión con WhatsApp"
            : "Empezá por conectar tu número"}
        </CardTitle>
        <CardDescription>
          {estado?.canal
            ? "Estado del acceso y de las conversaciones recibidas."
            : "Tres pasos para traer las conversaciones a tu espacio de trabajo."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {estado?.canal && <EstadoImportacion canal={estado.canal} />}
        {(!estado?.canal ||
          (estado.canal.reconexionPermitida && estado.disponible)) && (
          <>
            <ol className={s.steps} aria-label="Pasos para conectar WhatsApp">
              {pasos.map((texto, i) => (
                <li key={texto} className={s.step}>
                  <span className={s.number}>0{i + 1}</span>
                  <div>
                    <strong>{texto}</strong>
                    <p>
                      {
                        (sandbox
                          ? [
                              "Revisá los permisos de acceso.",
                              "Usá los activos del sandbox de Meta.",
                              "Comprobá la autorización de ensayo.",
                            ]
                          : [
                              "Elegí tu empresa y revisá los permisos.",
                              "Decidí si querés traer conversaciones anteriores.",
                              "Consultá el avance de la conexión.",
                            ])[i]
                      }
                    </p>
                  </div>
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
            <div className={s.connectAction}>
              <div className="flex flex-wrap items-center gap-2">
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
                            : estado?.canal
                              ? "Volver a conectar WhatsApp"
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
            </div>
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
