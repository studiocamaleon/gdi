"use client";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Printer,
  RefreshCw,
  Settings2,
  Minus,
  FileText,
  Check,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { ActionButton } from "@/components/design-system/action-button";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import { FormDialog } from "@/components/design-system/form-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { usePuede } from "@/components/navigation/permisos-provider";
import {
  getDocumentosOrden,
  confirmarDocumentosImpresos,
  registrarEstadoDocumento,
  type EnvioDocumento,
  type EstadoDocumento,
  type VistaDocumentos,
} from "@/lib/impresion-api";
import { leerImpresora, type ImpresoraPuesto } from "@/lib/impresora-puesto";
import {
  escucharImpresora,
  imprimirDocumentoOrden,
  type EscuchaImpresora,
} from "@/lib/qz-impresion";
import { eventoImpresora } from "@/lib/qz-eventos";
import {
  estadoDocumentoQz,
  estadoDocumentoSiguiente,
  textoEstadoDocumento,
} from "@/lib/impresion-documentos";
import { ImpresoraPuestoForm } from "./impresora-puesto-form";
import s from "./documentos-impresion.module.css";
import { ORIENTACION_PDF_LABELS } from "@/lib/orientacion-pdf";

type Contexto = {
  tenantId: string;
  abrir: (id: string, enviar?: boolean) => void;
};
const Contexto = createContext<Contexto>({ tenantId: "", abrir: () => {} });
export const useImpresionDocumentos = () => useContext(Contexto);
type Seguimiento = { ordenId: string; envio: EnvioDocumento };

/** Vive en el dashboard: minimizar/cambiar de pantalla no interrumpe la cola. */
export function DocumentosImpresionProvider({
  tenantId,
  children,
}: {
  tenantId: string;
  children: ReactNode;
}) {
  const comercial = usePuede("comercial.gestionar");
  const produccion = usePuede("produccion.ejecutar");
  const puedeImprimir = comercial || produccion;
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState<VistaDocumentos | null>(null);
  const vistaRef = useRef<VistaDocumentos | null>(null);
  const [config, setConfig] = useState<ImpresoraPuesto | null>(null);
  const [configurando, setConfigurando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const ocupadoRef = useRef(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [guardadoError, setGuardadoError] = useState("");
  const [avance, setAvance] = useState("");
  const [conectado, setConectado] = useState(false);
  const [avisoImpresora, setAvisoImpresora] = useState("");
  const [reimprimir, setReimprimir] = useState<EnvioDocumento | null>(null);
  const trabajos = useRef(new Map<string, Seguimiento>());
  const escucha = useRef<{ destino: string; handle: EscuchaImpresora } | null>(
    null,
  );
  const vivos = useRef(true);
  const escrituras = useRef(Promise.resolve());
  const carga = useRef(0);
  const ordenesPendientes = useRef<string[]>([]);

  useEffect(() => {
    vivos.current = true;
    return () => {
      vivos.current = false;
      escucha.current?.handle.cerrar();
    };
  }, []);
  function mostrar(v: VistaDocumentos) {
    vistaRef.current = v;
    setVista(v);
  }
  function actualizarEnvio(ordenId: string, envio: EnvioDocumento) {
    const anterior = vistaRef.current;
    if (anterior?.ordenId === ordenId)
      mostrar({
        ...anterior,
        historial: [
          envio,
          ...anterior.historial.filter((e) => e.id !== envio.id),
        ].sort((a, b) => b.fecha.localeCompare(a.fecha)),
      });
  }
  function registrar(
    jobName: string,
    estado: EstadoDocumento,
    detalle: string,
  ) {
    const track = trabajos.current.get(jobName);
    if (!track) return;
    if (
      track.envio.eventos.at(-1)?.estado === estado &&
      track.envio.eventos.at(-1)?.detalle === detalle
    )
      return;
    const fecha = new Date().toISOString();
    track.envio = {
      ...track.envio,
      estado: estadoDocumentoSiguiente(track.envio.estado, estado),
      actualizadoEl: fecha,
      eventos: [...track.envio.eventos.slice(-39), { estado, detalle, fecha }],
    };
    actualizarEnvio(track.ordenId, track.envio);
    // Ordena los mensajes del navegador: un ACK tardío no pisa PRINTING/COMPLETE.
    escrituras.current = escrituras.current.then(async () => {
      try {
        await registrarEstadoDocumento(
          track.ordenId,
          track.envio.id,
          estado,
          detalle,
        );
      } catch {
        if (vivos.current)
          setGuardadoError(
            "No se pudo guardar una actualización. El estado visible sigue en esta pestaña; revisá la cola antes de reimprimir.",
          );
      }
    });
  }
  async function conectar(destino: ImpresoraPuesto) {
    const clave = `${destino.host}:${destino.impresora}`;
    if (escucha.current?.destino === clave) return;
    escucha.current?.handle.cerrar();
    escucha.current = null;
    setConectado(false);
    const handle = await escucharImpresora(
      tenantId,
      destino,
      (dato) => {
        const evento = eventoImpresora(
          dato,
          destino.impresora,
          new Set(trabajos.current.keys()),
        );
        if (!evento || !vivos.current) return;
        if (evento.tipo === "PRINTER") {
          setAvisoImpresora(evento.estado === "OK" ? "" : evento.detalle);
        } else {
          const estado = estadoDocumentoQz(evento.estado);
          if (estado) registrar(evento.jobName, estado, evento.detalle);
        }
      },
      () => {
        escucha.current = null;
        if (vivos.current) {
          setConectado(false);
          setAvisoImpresora(
            "Se perdió la conexión. Windows puede seguir imprimiendo; los envíos no se repiten.",
          );
        }
      },
    );
    if (!vivos.current) {
      handle.cerrar();
      return;
    }
    escucha.current = { destino: clave, handle };
    setConectado(true);
  }
  async function enviar(
    v: VistaDocumentos,
    destino: ImpresoraPuesto,
    ids: string[],
    anterior?: EnvioDocumento,
  ) {
    if (ocupadoRef.current || !puedeImprimir || !ids.length) return;
    ocupadoRef.current = true;
    setOcupado(true);
    setError("");
    setReimprimir(null);
    try {
      setAvance("Conectando con el equipo de impresión…");
      await conectar(destino);
      for (const [indice, id] of ids.entries()) {
        if (!vivos.current) break;
        const doc = v.documentos.find((d) => d.itemId === id)!;
        setAvance(`Enviando ${indice + 1} de ${ids.length} · ${doc.nombre}`);
        let preparado: EnvioDocumento | null = null;
        try {
          const enviado = await imprimirDocumentoOrden(
            tenantId,
            destino,
            v.ordenId,
            id,
            crypto.randomUUID(),
            anterior?.id,
            (envio) => {
              preparado = envio;
              trabajos.current.set(envio.jobName, {
                ordenId: v.ordenId,
                envio,
              });
              actualizarEnvio(v.ordenId, envio);
            },
          );
          registrar(
            enviado.jobName,
            "ENVIADO",
            "QZ confirmó el envío a Windows.",
          );
        } catch (e) {
          // Incluso una respuesta HTTP perdida puede haber reservado el intento.
          const incierto = preparado as EnvioDocumento | null;
          if (incierto)
            registrar(
              incierto.jobName,
              "SIN_CONFIRMAR",
              "No se pudo confirmar el envío. Revisar la cola antes de reimprimir.",
            );
          throw e;
        }
      }
      setAvance(
        "Envíos terminados. Esperando los estados de la cola de Windows.",
      );
    } catch (e) {
      setAvance("");
      setError(
        `${e instanceof Error ? e.message : "No se pudo enviar."} La OT está guardada. Revisá la cola antes de reintentar; los documentos restantes no se enviaron.`,
      );
      await escrituras.current;
      try {
        mostrar(await getDocumentosOrden(v.ordenId));
      } catch {
        /* conservar vista y error */
      }
    } finally {
      ocupadoRef.current = false;
      if (vivos.current) setOcupado(false);
      const siguiente = ordenesPendientes.current.shift();
      if (siguiente && vivos.current) void abrir(siguiente, true);
    }
  }
  async function abrir(id: string, autoEnviar = false) {
    setAbierto(true);
    if (ocupadoRef.current) {
      if (autoEnviar && id !== vistaRef.current?.ordenId) {
        if (!ordenesPendientes.current.includes(id))
          ordenesPendientes.current.push(id);
        toast.info(
          "La OT está guardada. Sus documentos se enviarán cuando termine el envío actual.",
        );
        return;
      }
      toast.info("Esperá a que termine el envío actual para abrir otra orden.");
      return;
    }
    const revision = ++carga.current;
    if (vistaRef.current?.ordenId !== id) {
      vistaRef.current = null;
      setVista(null);
      setConfig(null);
    }
    setCargando(true);
    setError("");
    setReimprimir(null);
    setAvance("");
    try {
      const v = await getDocumentosOrden(id);
      if (revision !== carga.current || !vivos.current) return;
      const destino = leerImpresora(tenantId, "documentos");
      mostrar(v);
      setConfig(destino);
      setConfigurando(!destino.impresora);
      if (autoEnviar && destino.impresora)
        await enviar(
          v,
          destino,
          v.documentos
            .filter(
              (d) =>
                !d.motivo && !v.historial.some((e) => e.itemId === d.itemId),
            )
            .map((d) => d.itemId),
        );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo cargar la impresión.",
      );
    } finally {
      if (revision === carga.current) setCargando(false);
    }
  }
  async function actualizar() {
    const v = vistaRef.current;
    if (!v || ocupadoRef.current) return;
    setError("");
    setCargando(true);
    const revision = ++carga.current;
    try {
      await escrituras.current;
      const actual = await getDocumentosOrden(v.ordenId);
      if (revision === carga.current && vivos.current) mostrar(actual);
    } catch (e) {
      if (revision === carga.current)
        setError(e instanceof Error ? e.message : "No se pudo actualizar.");
    } finally {
      if (revision === carga.current) setCargando(false);
    }
  }
  async function reconectar() {
    if (!config || !vista || ocupadoRef.current) return;
    setError("");
    setCargando(true);
    for (const envio of vista.historial)
      if (envio.host === config.host && envio.impresora === config.impresora)
        trabajos.current.set(envio.jobName, { ordenId: vista.ordenId, envio });
    try {
      await conectar(config);
      await escucha.current?.handle.consultar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo conectar.");
    } finally {
      setCargando(false);
    }
  }
  async function confirmarImpresion() {
    const v = vistaRef.current;
    if (!v || ocupadoRef.current || cargando || !puedeImprimir) return;
    const ultimos = v.documentos.map((d) =>
      v.historial.find((e) => e.itemId === d.itemId),
    );
    if (!ultimos.length || ultimos.some((e) => !e)) return;
    ocupadoRef.current = true;
    setConfirmando(true);
    setError("");
    try {
      await escrituras.current;
      await confirmarDocumentosImpresos(
        v.ordenId,
        ultimos.map((e) => e!.id),
      );
      // Finaliza sólo el seguimiento de esta OT; otras órdenes conservan su cola.
      for (const [jobName, track] of trabajos.current)
        if (track.ordenId === v.ordenId) trabajos.current.delete(jobName);
      if (!trabajos.current.size) {
        escucha.current?.handle.cerrar();
        escucha.current = null;
        setConectado(false);
      }
      ++carga.current;
      vistaRef.current = null;
      setVista(null);
      setAbierto(false);
      setReimprimir(null);
      setAvance("");
      setAvisoImpresora("");
      setGuardadoError("");
      toast.success(`Impresión confirmada · ${v.numero}`);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudo guardar la confirmación. Volvé a intentarlo.",
      );
    } finally {
      ocupadoRef.current = false;
      if (vivos.current) setConfirmando(false);
      const siguiente = ordenesPendientes.current.shift();
      if (siguiente && vivos.current) void abrir(siguiente, true);
    }
  }
  const pendientes =
    vista?.documentos.filter(
      (d) => !d.motivo && !vista.historial.some((e) => e.itemId === d.itemId),
    ) ?? [];
  const ultimos =
    vista?.documentos.map((d) =>
      vista.historial.find((e) => e.itemId === d.itemId),
    ) ?? [];
  const todosEnviados = ultimos.length > 0 && ultimos.every(Boolean);
  const todosConfirmados =
    todosEnviados && ultimos.every((e) => e?.confirmacion);
  const bloqueado = ocupado || confirmando;
  // Los eventos de la cola no deben volver a renderizar toda la ficha comercial.
  const abrirRef = useRef(abrir);
  useEffect(() => {
    abrirRef.current = abrir;
  });
  const contexto = useMemo(
    () => ({
      tenantId,
      abrir: (id: string, enviar?: boolean) =>
        void abrirRef.current(id, enviar),
    }),
    [tenantId],
  );
  return (
    <Contexto.Provider value={contexto}>
      {children}
      <DesignSystemProvider theme="brand" appearance="light">
        {vista && !abierto && (
          <div className={s.widget} data-ui="heroui" data-appearance="light">
            <ActionButton
              size="md"
              tone="neutral"
              className={s.widgetButton}
              onPress={() => setAbierto(true)}
            >
              <Printer data-icon="inline-start" />
              {ocupado
                ? "Enviando documentos…"
                : error || avisoImpresora || guardadoError
                  ? `Revisar impresión · ${vista.numero}`
                  : `Impresión · ${vista.numero}`}
              <ArrowUpRight data-icon="inline-end" />
            </ActionButton>
          </div>
        )}
        <FormDialog
          isOpen={abierto}
          onOpenChange={setAbierto}
          isDismissable={!confirmando}
          title="Impresión de documentos"
          description={
            vista
              ? `${vista.numero} · A4 · Blanco y negro`
              : "Cargando los documentos de la orden…"
          }
          className={s.dialog}
        >
          <div className={s.body}>
            {cargando && !vista && <p role="status">Cargando documentos…</p>}
            {config && configurando && (
              <ImpresoraPuestoForm
                uso="documentos"
                tenantId={tenantId}
                inicial={config}
                disabled={bloqueado || !puedeImprimir}
                onGuardar={(c) => {
                  setConfig(c);
                  setConfigurando(false);
                }}
              />
            )}
            {config?.impresora && !configurando && (
              <div className={s.destino}>
                <div>
                  <strong>{config.impresora}</strong>
                  <p>
                    {config.host} ·{" "}
                    {conectado &&
                    escucha.current?.destino ===
                      `${config.host}:${config.impresora}`
                      ? "Seguimiento conectado"
                      : "Último estado registrado"}
                  </p>
                </div>
                <ActionButton
                  variant="tertiary"
                  isDisabled={bloqueado}
                  onPress={() => setConfigurando(true)}
                >
                  <Settings2 data-icon="inline-start" />
                  Cambiar
                </ActionButton>
              </div>
            )}
            {avisoImpresora && (
              <Alert>
                <AlertDescription>{avisoImpresora}</AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {guardadoError && (
              <Alert variant="destructive">
                <AlertDescription>{guardadoError}</AlertDescription>
              </Alert>
            )}
            {avance && (
              <p role="status" className={s.avance}>
                {avance}
              </p>
            )}
            {vista && !vista.documentos.length && (
              <p>No hay documentos de centro de copiado en esta orden.</p>
            )}
            <div className={s.lista}>
              {vista?.documentos.map((doc) => {
                const envios = vista.historial.filter(
                  (e) => e.itemId === doc.itemId,
                );
                const ultimo = envios[0];
                const orientacion = ultimo?.orientacion ?? doc.orientacion;
                return (
                  <article className={s.documento} key={doc.itemId}>
                    <div className={s.titulo}>
                      <FileText aria-hidden="true" />
                      <strong>{doc.nombre}</strong>
                    </div>
                    <p>
                      {doc.paginas} páginas · {doc.copias}{" "}
                      {doc.documentos > 1
                        ? doc.copias === 1
                          ? "juego"
                          : "juegos"
                        : doc.copias === 1
                          ? "copia"
                          : "copias"}{" "}
                      ·{" "}
                      {doc.faz === 2 ? "Doble faz · borde largo" : "Simple faz"}{" "}
                      · {doc.hojas} hojas ·{" "}
                      {orientacion
                        ? ORIENTACION_PDF_LABELS[orientacion]
                        : "Orientación automática"}
                    </p>
                    {doc.seleccionPaginas?.map((seleccion, i) => (
                      <p key={i}>
                        {doc.documentos > 1 ? `${seleccion.nombre} · ` : ""}
                        Páginas {seleccion.rango} de{" "}
                        {seleccion.paginasOriginales}
                      </p>
                    ))}
                    <div className={s.acciones}>
                      <Badge
                        variant={
                          !ultimo?.confirmacion &&
                          (doc.motivo ||
                            (ultimo &&
                              ["ERROR", "SIN_CONFIRMAR", "PREPARADO"].includes(
                                ultimo.estado,
                              )))
                            ? "outline"
                            : "secondary"
                        }
                      >
                        {ultimo?.confirmacion
                          ? "Impresión verificada"
                          : ultimo
                            ? textoEstadoDocumento[ultimo.estado]
                            : doc.motivo
                              ? "Impresión pendiente"
                              : "Listo para enviar"}
                      </Badge>
                      {ultimo && !doc.motivo && puedeImprimir && (
                        <ActionButton
                          variant="tertiary"
                          isDisabled={
                            bloqueado ||
                            cargando ||
                            !config?.impresora ||
                            configurando
                          }
                          onPress={() => setReimprimir(ultimo)}
                        >
                          Reimprimir
                        </ActionButton>
                      )}
                    </div>
                    {doc.motivo && <p className={s.motivo}>{doc.motivo}</p>}
                    {envios.length > 0 && (
                      <details className={s.historial}>
                        <summary>
                          {envios.length} envío{envios.length > 1 ? "s" : ""} ·
                          Ver historial
                        </summary>
                        {envios.map((e) => (
                          <section key={e.id}>
                            <strong>{textoEstadoDocumento[e.estado]}</strong>
                            <p>
                              {new Date(e.fecha).toLocaleString()} · {e.usuario}
                              <br />
                              {e.impresora} · {e.copias} copias
                            </p>
                            {e.eventos.map((ev, i) => (
                              <p key={i}>
                                {new Date(ev.fecha).toLocaleTimeString()} ·{" "}
                                {ev.detalle}
                              </p>
                            ))}
                            {e.confirmacion && (
                              <p>
                                Impresión verificada por{" "}
                                {e.confirmacion.usuario} ·{" "}
                                {new Date(
                                  e.confirmacion.fecha,
                                ).toLocaleString()}
                              </p>
                            )}
                          </section>
                        ))}
                      </details>
                    )}
                  </article>
                );
              })}
            </div>
            {reimprimir && (
              <Alert>
                <AlertDescription>
                  <p>
                    Se enviarán nuevamente las {reimprimir.copias} copias de{" "}
                    <strong>{reimprimir.nombre}</strong>. Revisá la salida y la
                    cola para evitar duplicados.
                  </p>
                  <div className={s.acciones}>
                    <ActionButton
                      variant="outline"
                      isDisabled={bloqueado}
                      onPress={() => setReimprimir(null)}
                    >
                      Volver
                    </ActionButton>
                    <ActionButton
                      isDisabled={bloqueado || !config}
                      onPress={() => {
                        if (vista && config)
                          void enviar(
                            vista,
                            config,
                            [reimprimir.itemId],
                            reimprimir,
                          );
                      }}
                    >
                      Confirmar reimpresión
                    </ActionButton>
                  </div>
                </AlertDescription>
              </Alert>
            )}
            <p className={s.nota}>
              La cola informa lo que reporta Windows. La salida física depende
              de la impresora. Podés minimizar y seguir trabajando; si cerrás o
              recargás esta pestaña se interrumpe el seguimiento, pero se
              conserva el historial. La producción se completa desde el tablero.
            </p>
          </div>
          <div className={s.herramientas}>
            <ActionButton
              variant="tertiary"
              isDisabled={bloqueado || cargando}
              onPress={() => void actualizar()}
            >
              <RefreshCw data-icon="inline-start" />
              Actualizar
            </ActionButton>
            {!conectado && config?.impresora && puedeImprimir && (
              <ActionButton
                variant="outline"
                isDisabled={bloqueado || cargando}
                onPress={() => void reconectar()}
              >
                Conectar seguimiento
              </ActionButton>
            )}
            {conectado && (
              <ActionButton
                variant="tertiary"
                isDisabled={bloqueado}
                onPress={() => {
                  escucha.current?.handle.cerrar();
                  escucha.current = null;
                  setConectado(false);
                  setAvisoImpresora(
                    "Seguimiento detenido. Los trabajos enviados siguen en Windows.",
                  );
                }}
              >
                Desconectar seguimiento
              </ActionButton>
            )}
          </div>
          <div className={s.footer}>
            {vista && ultimos.length > 0 && (
              <p className={s.confirmacionNota}>
                {todosConfirmados
                  ? "La impresión ya fue verificada. Podés cerrar este panel."
                  : todosEnviados
                    ? "Cuando revises todas las copias, confirmá la impresión para guardar el registro y cerrar."
                    : "Completá los documentos sin enviar antes de confirmar toda la impresión."}
              </p>
            )}
            <ActionButton
              variant="outline"
              isDisabled={confirmando}
              onPress={() => setAbierto(false)}
            >
              <Minus data-icon="inline-start" />
              Minimizar
            </ActionButton>
            {puedeImprimir && (pendientes.length > 0 || ocupado) && (
              <ActionButton
                isDisabled={
                  !pendientes.length ||
                  bloqueado ||
                  cargando ||
                  !config?.impresora ||
                  configurando ||
                  !vista ||
                  ["borrador", "cancelada"].includes(vista.estado)
                }
                onPress={() => {
                  if (vista && config)
                    void enviar(
                      vista,
                      config,
                      pendientes.map((d) => d.itemId),
                    );
                }}
              >
                <Printer data-icon="inline-start" />
                {ocupado
                  ? "Enviando…"
                  : `Enviar pendientes${pendientes.length ? ` (${pendientes.length})` : ""}`}
              </ActionButton>
            )}
            {puedeImprimir && (
              <ActionButton
                isDisabled={
                  !todosEnviados ||
                  bloqueado ||
                  cargando ||
                  !!reimprimir ||
                  !vista ||
                  ["borrador", "cancelada"].includes(vista.estado)
                }
                onPress={() => void confirmarImpresion()}
              >
                <Check data-icon="inline-start" />
                {confirmando
                  ? "Guardando confirmación…"
                  : todosConfirmados
                    ? "Cerrar impresión"
                    : "Todo impreso correctamente"}
              </ActionButton>
            )}
          </div>
        </FormDialog>
      </DesignSystemProvider>
    </Contexto.Provider>
  );
}
