"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Minus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { ActionButton } from "@/components/design-system/action-button";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import { FormDialog } from "@/components/design-system/form-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePuede } from "@/components/navigation/permisos-provider";
import {
  claveDocumento,
  getColaImpresion,
  getDocumentosOrden,
  solicitarImpresionOrden,
  liberarLoteImpresion,
  confirmarDocumentosImpresos,
  registrarEstadoDocumento,
  type EnvioDocumento,
  type EstadoDocumento,
  type VistaDocumentos,
} from "@/lib/impresion-api";
import type { EscuchaImpresora } from "@/lib/qz-impresion";
import { eventoImpresora } from "@/lib/qz-eventos";
import {
  estadoDocumentoQz,
  estadoDocumentoSiguiente,
} from "@/lib/impresion-documentos";
import {
  trabajosDeVistas,
  maquinaTrabajo,
  siguientesEnvios,
  admiteVerificacionMultiple,
  REVISAR_ENVIO,
  type TrabajoCola,
} from "@/lib/colas-impresion";
import { revisionPerfil } from "@/lib/perfiles-impresion";
import { ColasImpresionPanel } from "./colas-impresion-panel";
import { AsistenteImpresionMinimizado } from "./asistente-impresion-minimizado";
import s from "./colas-impresion.module.css";

import { ContextoImpresion as Contexto } from "./documentos-impresion-contexto";
export { useImpresionDocumentos } from "./documentos-impresion-contexto";

/** Orquesta una conexión QZ. Los envíos se firman en serie; cada máquina imprime
 * su cola mientras se despacha a las demás. Nunca se reintenta un envío incierto. */
export function DocumentosImpresionProvider({
  tenantId,
  children,
}: {
  tenantId: string;
  children: ReactNode;
}) {
  const comercial = usePuede("comercial.gestionar"),
    produccion = usePuede("produccion.ejecutar");
  const verProduccion = usePuede("produccion.ver"),
    verComercial = usePuede("comercial.ver");
  const puedeVer = verProduccion || verComercial;
  const puedeImprimir = comercial || produccion;
  const [abierto, setAbierto] = useState(false);
  const [vistas, setVistas] = useState<VistaDocumentos[]>([]);
  const vistasRef = useRef<VistaDocumentos[]>([]);
  const foco = useRef<string | null>(null);
  const [ocupado, setOcupado] = useState(false),
    ocupadoRef = useRef(false);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [guardadoError, setGuardadoError] = useState("");
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [seleccionandoSalidas, setSeleccionandoSalidas] = useState(false);
  // La selección refiere al intento visto, nunca a un posible reenvío posterior.
  const [enviosSeleccionados, setEnviosSeleccionados] = useState<string[]>([]);
  const [reimprimir, setReimprimir] = useState<TrabajoCola | null>(null);
  const [conexiones, setConexiones] = useState<string[]>([]);
  const [avisos, setAvisos] = useState<Record<string, string>>({});
  const [siguiente, setSiguiente] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const monitor = useRef<{ clave: string; handle: EscuchaImpresora } | null>(
    null,
  );
  const seguimiento = useRef(
    new Map<string, { ordenId: string; envio: EnvioDocumento }>(),
  );
  const escrituras = useRef(Promise.resolve());
  const vivos = useRef(true);
  const abrirPendiente = useRef<string[]>([]);

  function mostrar(v: VistaDocumentos[]) {
    vistasRef.current = v;
    if (vivos.current) setVistas(v);
  }
  function incorporar(v: VistaDocumentos) {
    mostrar([...vistasRef.current.filter((x) => x.ordenId !== v.ordenId), v]);
  }
  function actualizarEnvio(ordenId: string, envio: EnvioDocumento) {
    mostrar(
      vistasRef.current.map((v) =>
        v.ordenId !== ordenId
          ? v
          : {
              ...v,
              historial: [
                envio,
                ...v.historial.filter((e) => e.id !== envio.id),
              ].sort((a, b) => b.fecha.localeCompare(a.fecha)),
            },
      ),
    );
  }
  async function cargar(desde = 0) {
    await escrituras.current;
    const cola = await getColaImpresion(desde);
    if (!vivos.current) return;
    let nuevas = desde ? [...vistasRef.current] : [];
    for (const v of cola.vistas) {
      const prev = nuevas.find((x) => x.ordenId === v.ordenId);
      nuevas = [
        ...nuevas.filter((x) => x.ordenId !== v.ordenId),
        prev
          ? {
              ...v,
              documentos: [
                ...new Map(
                  [...prev.documentos, ...v.documentos].map((d) => [
                    claveDocumento(d),
                    d,
                  ]),
                ).values(),
              ],
            }
          : v,
      ];
    }
    if (foco.current) {
      const v = await getDocumentosOrden(foco.current);
      nuevas = [...nuevas.filter((x) => x.ordenId !== v.ordenId), v];
    }
    if (!vivos.current) return;
    mostrar(nuevas);
    setTotal(cola.total);
    setSiguiente(cola.siguiente);
    for (const v of nuevas)
      for (const e of v.historial)
        if (!e.confirmacion)
          seguimiento.current.set(e.jobName, { ordenId: v.ordenId, envio: e });
  }
  function registrar(
    jobName: string,
    estado: EstadoDocumento,
    detalle: string,
  ) {
    const t = seguimiento.current.get(jobName);
    if (
      !t ||
      (t.envio.eventos.at(-1)?.estado === estado &&
        t.envio.eventos.at(-1)?.detalle === detalle)
    )
      return;
    const fecha = new Date().toISOString();
    t.envio = {
      ...t.envio,
      estado: estadoDocumentoSiguiente(t.envio.estado, estado),
      actualizadoEl: fecha,
      eventos: [...t.envio.eventos.slice(-39), { estado, detalle, fecha }],
    };
    actualizarEnvio(t.ordenId, t.envio);
    const id = t.envio.id;
    escrituras.current = escrituras.current.then(async () => {
      try {
        await registrarEstadoDocumento(t.ordenId, id, estado, detalle);
      } catch {
        if (vivos.current)
          setGuardadoError(
            "No se pudo guardar una actualización. Revisá la cola antes de reenviar; el estado visible se conserva en esta pestaña.",
          );
      }
    });
  }
  async function conectar(t: TrabajoCola) {
    const destino = maquinaTrabajo(t);
    if (!destino) throw new Error("Revisá el destino del trabajo.");
    const destinos = [
      ...new Map(
        trabajosDeVistas(vistasRef.current)
          .map(maquinaTrabajo)
          .filter((d) => d?.host === destino.host)
          .map((d) => [d!.impresora, d!]),
      ).values(),
    ];
    const impresoras = destinos.map((d) => d.impresora).sort();
    const clave = `${destino.host}:${impresoras.join("|")}`;
    if (monitor.current?.clave === clave) return;
    await monitor.current?.handle.cerrar();
    monitor.current = null;
    setConexiones([]);
    const { escucharImpresora } = await import("@/lib/qz-impresion");
    const handle = await escucharImpresora(
      tenantId,
      destino,
      (dato) => {
        for (const d of destinos) {
          const ev = eventoImpresora(
            dato,
            d.impresora,
            new Set(seguimiento.current.keys()),
          );
          if (!ev || !vivos.current) continue;
          if (ev.tipo === "PRINTER")
            setAvisos((a) => ({
              ...a,
              [d.maquinaId]: ev.estado === "OK" ? "" : ev.detalle,
            }));
          else {
            const estado = estadoDocumentoQz(ev.estado);
            if (estado) registrar(ev.jobName, estado, ev.detalle);
          }
        }
      },
      () => {
        monitor.current = null;
        if (vivos.current) {
          setConexiones([]);
          setMensaje(
            "Seguimiento desconectado. Los envíos guardados no se repiten.",
          );
        }
      },
      impresoras,
    );
    if (!vivos.current) {
      void handle.cerrar();
      return;
    }
    monitor.current = { clave, handle };
    setConexiones(destinos.map((d) => `${d.host}:${d.impresora}`));
  }
  async function enviarUno(t: TrabajoCola, anterior?: EnvioDocumento) {
    const perfil = t.doc.ruta.perfil;
    if (!perfil || t.doc.motivo || t.doc.ruta.estado !== "LISTO")
      throw new Error(t.doc.motivo ?? "El trabajo requiere preparación.");
    await conectar(t);
    setEnviando(t.clave);
    setMensaje(`Enviando a ${perfil.bandeja.destino.nombre}`);
    let preparado: EnvioDocumento | undefined;
    try {
      const { imprimirDocumentoOrden } = await import("@/lib/qz-impresion");
      const e = await imprimirDocumentoOrden(
        tenantId,
        {
          ...perfil.bandeja.destino,
          perfilId: perfil.id,
          revisionPerfil: revisionPerfil(perfil),
        },
        t.ordenId,
        t.doc.itemId,
        crypto.randomUUID(),
        anterior?.id,
        (envio) => {
          preparado = envio;
          seguimiento.current.set(envio.jobName, { ordenId: t.ordenId, envio });
          actualizarEnvio(t.ordenId, envio);
        },
        t.doc.paginaCad?.pagina,
      );
      registrar(e.jobName, "ENVIADO", "QZ confirmó el envío a Windows.");
      await escrituras.current;
    } catch (e) {
      if (preparado)
        registrar(
          preparado.jobName,
          "SIN_CONFIRMAR",
          "No se pudo confirmar el envío. Revisar la cola antes de reimprimir.",
        );
      throw e;
    } finally {
      setEnviando(null);
    }
  }
  async function despachar(claves?: Set<string>, reimpresion?: TrabajoCola) {
    if (!puedeImprimir || ocupadoRef.current) return;
    ocupadoRef.current = true;
    setOcupado(true);
    setError("");
    setReimprimir(null);
    const fallidas = new Set<string>();
    const errores: string[] = [];
    let enviados = 0;
    try {
      if (reimpresion) {
        await enviarUno(reimpresion, reimpresion.envio);
        enviados++;
      } else {
        while (vivos.current) {
          const ronda = siguientesEnvios(
            trabajosDeVistas(vistasRef.current),
          ).filter(
            (t) =>
              (!claves || claves.has(t.clave)) &&
              !fallidas.has(maquinaTrabajo(t)?.maquinaId ?? ""),
          );
          if (!ronda.length) break;
          for (const t of ronda) {
            if (!vivos.current) break;
            try {
              await enviarUno(t);
              enviados++;
            } catch (e) {
              fallidas.add(maquinaTrabajo(t)?.maquinaId ?? "");
              errores.push(
                `${maquinaTrabajo(t)?.nombre}: ${e instanceof Error ? e.message : "No se pudo enviar."}`,
              );
            }
          }
        }
      }
      setMensaje(
        enviados
          ? `${enviados} envíos realizados. Podés seguir trabajando.`
          : "Los pendientes esperan preparación o revisión.",
      );
      if (errores.length) setError(errores.join(" "));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar.");
    } finally {
      await escrituras.current;
      try {
        await cargar();
      } catch {
        /* conservar estado visible y pendientes guardados */
      }
      ocupadoRef.current = false;
      if (vivos.current) setOcupado(false);
      const proxima = abrirPendiente.current.shift();
      if (proxima && vivos.current) void abrir(proxima, true);
    }
  }
  async function abrir(id: string, autoEnviar = false) {
    setAbierto(true);
    if (puedeImprimir) {
      // La intención se persiste inmediatamente, incluso si otro envío está activo.
      try {
        await solicitarImpresionOrden(id);
      } catch (e) {
        setError(
          `La OT está guardada, pero no pudimos agregarla a la cola: ${e instanceof Error ? e.message : "volvé a intentar desde la OT."}`,
        );
        return;
      }
    }
    if (ocupadoRef.current) {
      if (autoEnviar && !abrirPendiente.current.includes(id))
        abrirPendiente.current.push(id);
      return;
    }
    foco.current = id;
    setError("");
    setSeleccionados([]);
    setSeleccionandoSalidas(false);
    setEnviosSeleccionados([]);
    setMensaje("");
    try {
      await cargar();
      if (autoEnviar)
        await despachar(
          new Set(
            trabajosDeVistas(vistasRef.current)
              .filter((t) => t.ordenId === id)
              .map((t) => t.clave),
          ),
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la cola.");
    }
  }
  async function accion(fn: () => Promise<void>) {
    if (ocupadoRef.current) return;
    ocupadoRef.current = true;
    setOcupado(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo completar la acción.",
      );
    } finally {
      ocupadoRef.current = false;
      if (vivos.current) setOcupado(false);
    }
  }
  async function verificar(trabajos: TrabajoCola[]) {
    if (!puedeImprimir) return;
    const elegidos = trabajos.filter((t) => t.envio && !t.envio.confirmacion);
    if (!elegidos.length) return;
    await accion(async () => {
      await escrituras.current;
      const fallos: string[] = [];
      let confirmados = 0;
      for (const ordenId of new Set(elegidos.map((t) => t.ordenId))) {
        const grupo = elegidos.filter((t) => t.ordenId === ordenId);
        let guardados = false;
        // La API valida el último intento y guarda cada lote de la OT atómicamente.
        for (let inicio = 0; inicio < grupo.length; inicio += 500) {
          const lote = grupo.slice(inicio, inicio + 500);
          const ids = lote.map((t) => t.envio!.id);
          try {
            await confirmarDocumentosImpresos(ordenId, ids);
            guardados = true;
            confirmados += lote.length;
            for (const t of lote) seguimiento.current.delete(t.envio!.jobName);
            setEnviosSeleccionados((actuales) =>
              actuales.filter((id) => !ids.includes(id)),
            );
          } catch (e) {
            fallos.push(
              `${grupo[0].numero}: ${e instanceof Error ? e.message : "No se pudo guardar la verificación."}`,
            );
          }
        }
        if (guardados) {
          try {
            incorporar(await getDocumentosOrden(ordenId));
          } catch {
            fallos.push(
              `${grupo[0].numero}: la verificación se guardó. Actualizá para ver el resultado.`,
            );
          }
        }
      }
      if (confirmados) {
        setTotal((actual) => Math.max(0, actual - confirmados));
        toast.success(
          `${confirmados} ${confirmados === 1 ? "salida verificada" : "salidas verificadas"}`,
        );
      }
      if (confirmados === elegidos.length) setSeleccionandoSalidas(false);
      if (fallos.length) setError(fallos.join(" "));
    });
  }
  async function preparar() {
    const ts = trabajosDeVistas(vistasRef.current).filter((t) =>
      seleccionados.includes(t.clave),
    );
    const p = ts[0]?.doc.ruta.perfil;
    if (!p || !puedeImprimir) return;
    let liberado = false;
    await accion(async () => {
      const grupos = [...new Set(ts.map((t) => t.ordenId))].map((ordenId) => ({
        ordenId,
        trabajos: ts.filter((t) => t.ordenId === ordenId).map((t) => t.clave),
      }));
      await liberarLoteImpresion(grupos, p.id, revisionPerfil(p));
      await cargar();
      setSeleccionados([]);
      liberado = true;
    });
    if (liberado) await despachar(new Set(ts.map((t) => t.clave)));
  }
  // El proveedor permanece montado al navegar. Recargar recupera pendientes,
  // pero no dispara automáticamente envíos ni reconexiones a equipos remotos.
  const cargarRef = useRef(cargar);
  cargarRef.current = cargar;
  useEffect(() => {
    vivos.current = true;
    if (puedeVer || puedeImprimir) void cargarRef.current().catch(() => {});
    return () => {
      vivos.current = false;
      void monitor.current?.handle.cerrar();
    };
  }, [tenantId, puedeVer, puedeImprimir]);
  const abrirRef = useRef(abrir);
  abrirRef.current = abrir;
  const contexto = useMemo(
    () => ({
      tenantId,
      abrir: (id: string, enviar?: boolean) =>
        void abrirRef.current(id, enviar),
    }),
    [tenantId],
  );
  const trabajos = trabajosDeVistas(vistas);
  return (
    <Contexto.Provider value={contexto}>
      {children}
      <DesignSystemProvider theme="brand" appearance="light">
        {(puedeVer || puedeImprimir) && !abierto && (
          <AsistenteImpresionMinimizado
            total={total}
            ocupado={!!enviando}
            requiereAtencion={
              !!error ||
              !!guardadoError ||
              trabajos.some(
                (t) =>
                  (!t.envio && t.doc.ruta.estado !== "LISTO") ||
                  (t.envio &&
                    !t.envio.confirmacion &&
                    REVISAR_ENVIO.has(t.envio.estado)),
              )
            }
            onAbrir={() => {
              setAbierto(true);
              if (!ocupadoRef.current) void accion(() => cargar());
            }}
          />
        )}
        <FormDialog
          isOpen={abierto}
          onOpenChange={setAbierto}
          title="Asistente de impresión"
          description="Grafo organiza los archivos y acompaña cada envío."
          className={s.dialog}
        >
          <div className={s.body}>
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
            <ColasImpresionPanel
              trabajos={trabajos}
              enviando={enviando}
              mensaje={mensaje}
              bloqueado={ocupado}
              puedeImprimir={puedeImprimir}
              seleccionados={seleccionados}
              setSeleccionados={setSeleccionados}
              onVerificar={(t) => void verificar([t])}
              seleccionandoSalidas={seleccionandoSalidas}
              setSeleccionandoSalidas={setSeleccionandoSalidas}
              enviosSeleccionados={enviosSeleccionados}
              setEnviosSeleccionados={setEnviosSeleccionados}
              onVerificarSeleccion={() =>
                void verificar(
                  trabajos.filter(
                    (t) =>
                      admiteVerificacionMultiple(t) &&
                      enviosSeleccionados.includes(t.envio!.id),
                  ),
                )
              }
              onReimprimir={setReimprimir}
              onPreparar={() => void preparar()}
              onEnviar={() => void despachar()}
              onSeguir={(t) =>
                void accion(async () => {
                  await conectar(t);
                  await monitor.current?.handle.consultar();
                })
              }
              conexiones={conexiones}
              avisos={avisos}
            />
            {reimprimir && (
              <Alert>
                <AlertDescription>
                  <p>
                    Se volverán a enviar {reimprimir.doc.copias} copias de{" "}
                    <strong>{reimprimir.doc.nombre}</strong>. Revisá la salida y
                    la cola de la impresora antes de confirmar.
                  </p>
                  <div className={s.acciones}>
                    <ActionButton
                      variant="outline"
                      onPress={() => setReimprimir(null)}
                    >
                      Volver
                    </ActionButton>
                    <ActionButton
                      isDisabled={ocupado}
                      onPress={() => void despachar(undefined, reimprimir)}
                    >
                      Confirmar reimpresión
                    </ActionButton>
                  </div>
                </AlertDescription>
              </Alert>
            )}
            {siguiente !== null && (
              <ActionButton
                variant="tertiary"
                isDisabled={ocupado}
                onPress={() => void accion(() => cargar(siguiente))}
              >
                Cargar más pendientes ({total})
              </ActionButton>
            )}
          </div>
          <footer className={s.footer}>
            <span className={s.nota}>
              La cola informa lo que reporta Windows. “Verifiqué la salida”
              registra tu revisión; la producción se completa desde el tablero.
            </span>
            <ActionButton
              variant="tertiary"
              isDisabled={ocupado}
              onPress={() => void accion(() => cargar())}
            >
              <RefreshCw data-icon="inline-start" />
              Actualizar
            </ActionButton>
            <ActionButton variant="outline" onPress={() => setAbierto(false)}>
              <Minus data-icon="inline-start" />
              Minimizar
            </ActionButton>
          </footer>
        </FormDialog>
      </DesignSystemProvider>
    </Contexto.Provider>
  );
}
