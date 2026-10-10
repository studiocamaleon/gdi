"use client";
import { useEffect, useState } from "react";
import { Check, Copy, Link2, RefreshCw, UserRoundCheck, X } from "lucide-react";
import { toast } from "sonner";
import { enlacePublicoPath } from "@/lib/enlaces-publicos";
import { apiRequest } from "@/lib/api";
import {
  condicionesAlta,
  listarAltas,
  raizAltas,
  type DetalleAlta,
  type ListaAltas,
} from "@/lib/clientes-autoregistro-api";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import { ActionButton } from "@/components/design-system/action-button";
import { ActionLink } from "@/components/design-system/action-link";
import brandTheme from "@/components/design-system/brand-workspace-theme.module.css";
import styles from "./solicitudes-alta.module.css";
const estados = [
  ["PENDIENTE", "Pendientes"],
  ["APROBADA", "Aprobadas"],
  ["VINCULADA", "Vinculadas"],
  ["RECHAZADA", "Rechazadas"],
];
const fecha = (v: string) =>
  new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(v));
export function SolicitudesAlta({
  initial,
  initialToken,
}: {
  initial: ListaAltas;
  initialToken: string | null;
}) {
  const [lista, setLista] = useState(initial);
  const [token, setToken] = useState(initialToken);
  const [estado, setEstado] = useState("PENDIENTE");
  const [pagina, setPagina] = useState(1);
  const [revision, setRevision] = useState(0);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<DetalleAlta | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [confirma, setConfirma] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enlaceAccion, setEnlaceAccion] = useState<
    "renovar" | "deshabilitar" | null
  >(null);
  const [rechazando, setRechazando] = useState(false);
  const [origen, setOrigen] = useState("");
  useEffect(() => {
    setOrigen(window.location.origin);
  }, []);
  useEffect(() => {
    const control = new AbortController();
    setCargando(true);
    setError("");
    listarAltas(estado, pagina, control.signal)
      .then(setLista)
      .catch((e) => {
        if (!control.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!control.signal.aborted) setCargando(false);
      });
    return () => control.abort();
  }, [estado, pagina, revision]);
  useEffect(() => {
    setDetalle(null);
    setConfirma(false);
    setMotivo("");
    setRechazando(false);
    if (!seleccion) return;
    const control = new AbortController();
    apiRequest<DetalleAlta>(`${raizAltas}/${seleccion}`, {
      signal: control.signal,
    })
      .then(setDetalle)
      .catch((e) => {
        if (!control.signal.aborted) setError(e.message);
      });
    return () => control.abort();
  }, [seleccion]);
  async function link(accion: "habilitar" | "renovar" | "deshabilitar") {
    setOcupado(true);
    setError("");
    try {
      const respuesta = await apiRequest<{ token: string | null }>(
        `${raizAltas}/enlace${accion === "renovar" ? "/renovar" : ""}`,
        { method: accion === "deshabilitar" ? "DELETE" : "POST" },
      );
      setToken(respuesta.token);
      setEnlaceAccion(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos actualizar el enlace.",
      );
    } finally {
      setOcupado(false);
    }
  }
  async function decidir(
    accion: "aprobar" | "rechazar" | "vincular",
    clienteId?: string,
  ) {
    if (!detalle || ocupado) return;
    setOcupado(true);
    setError("");
    try {
      await apiRequest(`${raizAltas}/${detalle.id}/decision`, {
        method: "POST",
        body: JSON.stringify({
          accion,
          clienteId,
          confirmarCoincidencias: confirma,
          motivo,
        }),
      });
      toast.success(
        accion === "aprobar"
          ? "Cliente creado"
          : accion === "vincular"
            ? "Solicitud vinculada al cliente existente"
            : "Solicitud rechazada",
      );
      setSeleccion(null);
      setRevision((v) => v + 1);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos resolver la solicitud.",
      );
    } finally {
      setOcupado(false);
    }
  }
  const url =
    token && origen
      ? `${origen}${enlacePublicoPath("alta_cliente", token)}`
      : "";
  const documentoExistente =
    detalle?.coincidencias.some((c) => c.documento) ?? false;
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <main
        data-ui="heroui"
        data-appearance="light"
        className={`${brandTheme.theme} ${styles.workspace}`}
      >
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>CRM · CLIENTES</span>
            <h1>
              Solicitudes de alta<span>.</span>
            </h1>
            <p>Revisá los datos fiscales antes de incorporar un cliente.</p>
          </div>
          <ActionLink href="/crm/clientes" variant="outline">
            Volver a clientes
          </ActionLink>
        </header>
        <section className={styles.panel} aria-label="Enlace de registro">
          <div className={styles.fila}>
            <h2>
              <Link2 size={18} className="inline mr-2" />
              Enlace para compartir
            </h2>
            <span>{token ? "Activo" : "Desactivado"}</span>
          </div>
          <p>
            Quien complete este formulario quedará pendiente de aprobación. No
            recibe acceso al sistema.
          </p>
          {token ? (
            <>
              <div className={styles.enlace}>{url || "Preparando enlace…"}</div>
              <div className={styles.acciones}>
                <ActionButton
                  variant="outline"
                  isDisabled={!url || ocupado}
                  onPress={async () => {
                    try {
                      await navigator.clipboard.writeText(url);
                      toast.success("Enlace copiado");
                    } catch {
                      setError(
                        "No se pudo copiar. Seleccioná y copiá el enlace que aparece arriba.",
                      );
                    }
                  }}
                >
                  <Copy size={16} />
                  Copiar enlace
                </ActionButton>
                <ActionLink
                  href={enlacePublicoPath("alta_cliente", token)}
                  target="_blank"
                  rel="noreferrer"
                  variant="outline"
                >
                  Ver formulario
                </ActionLink>
                <ActionButton
                  variant="ghost"
                  isDisabled={ocupado}
                  onPress={() => setEnlaceAccion("renovar")}
                >
                  Renovar enlace
                </ActionButton>
                <ActionButton
                  variant="ghost"
                  isDisabled={ocupado}
                  onPress={() => setEnlaceAccion("deshabilitar")}
                >
                  Desactivar
                </ActionButton>
              </div>
            </>
          ) : (
            <div>
              <ActionButton
                onPress={() => void link("habilitar")}
                isDisabled={ocupado}
              >
                Habilitar registro
              </ActionButton>
            </div>
          )}
          {enlaceAccion && (
            <div className={styles.coincidencia}>
              <p>
                {enlaceAccion === "renovar"
                  ? "El enlace anterior dejará de funcionar. Tendrás que compartir el nuevo."
                  : "Dejarás de recibir solicitudes por este enlace. Las solicitudes recibidas se conservan."}
              </p>
              <div className={styles.acciones}>
                <ActionButton
                  isDisabled={ocupado}
                  onPress={() => void link(enlaceAccion)}
                >
                  Confirmar
                </ActionButton>
                <ActionButton
                  variant="outline"
                  isDisabled={ocupado}
                  onPress={() => setEnlaceAccion(null)}
                >
                  Cancelar
                </ActionButton>
              </div>
            </div>
          )}
        </section>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <div className={styles.revision}>
          <section className={styles.panel} aria-label="Solicitudes">
            <div className={styles.tabs}>
              {estados.map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={estado === v}
                  disabled={ocupado}
                  onClick={() => {
                    setEstado(v);
                    setPagina(1);
                    setSeleccion(null);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className={styles.fila}>
              <p>
                {cargando
                  ? "Cargando…"
                  : `${lista.total} ${lista.total === 1 ? "solicitud" : "solicitudes"}`}
              </p>
              <ActionButton
                variant="ghost"
                isIconOnly
                title="Actualizar solicitudes"
                aria-label="Actualizar solicitudes"
                isDisabled={ocupado || cargando}
                onPress={() => setRevision((v) => v + 1)}
              >
                <RefreshCw size={16} />
              </ActionButton>
            </div>
            <div className={styles.lista} aria-busy={cargando}>
              {!cargando &&
                lista.items.map((s) => (
                  <button
                    className={styles.solicitud}
                    key={s.id}
                    disabled={ocupado}
                    aria-pressed={seleccion === s.id}
                    onClick={() => {
                      setSeleccion(s.id);
                      setError("");
                    }}
                  >
                    <strong>{s.nombre}</strong>
                    <span>
                      {s.documentoTipo} {s.documentoNumero}
                    </span>
                    <span>{fecha(s.createdAt)}</span>
                  </button>
                ))}
            </div>
            {!cargando && !lista.items.length && (
              <p>No hay solicitudes en este estado.</p>
            )}
            <div className={styles.paginacion}>
              <ActionButton
                variant="outline"
                isDisabled={pagina === 1 || cargando || ocupado}
                onPress={() => {
                  setPagina((v) => v - 1);
                  setSeleccion(null);
                }}
              >
                Anterior
              </ActionButton>
              <span>{pagina}</span>
              <ActionButton
                variant="outline"
                isDisabled={pagina * 20 >= lista.total || cargando || ocupado}
                onPress={() => {
                  setPagina((v) => v + 1);
                  setSeleccion(null);
                }}
              >
                Siguiente
              </ActionButton>
            </div>
          </section>
          <section className={styles.panel} aria-label="Revisar solicitud">
            {!detalle ? (
              <>
                <UserRoundCheck size={26} />
                <h2>
                  {seleccion ? "Cargando solicitud…" : "Elegí una solicitud"}
                </h2>
                <p>
                  Acá vas a ver sus datos y las posibles coincidencias con
                  clientes existentes.
                </p>
              </>
            ) : (
              <>
                <h2>{detalle.nombre}</h2>
                <p>
                  Datos declarados por el solicitante. Revisalos antes de
                  aprobar.
                </p>
                <dl className={styles.datos}>
                  <div>
                    <dt>{detalle.documentoTipo}</dt>
                    <dd>{detalle.documentoNumero}</dd>
                  </div>
                  <div>
                    <dt>Condición fiscal</dt>
                    <dd>
                      {
                        condicionesAlta.find(
                          (c) => c.value === detalle.condicionFiscal,
                        )?.label
                      }
                    </dd>
                  </div>
                  <div>
                    <dt>Teléfono</dt>
                    <dd>{detalle.telefono}</dd>
                  </div>
                  <div>
                    <dt>Domicilio fiscal</dt>
                    <dd>
                      {detalle.direccion}
                      <br />
                      {detalle.ciudad}, Argentina
                    </dd>
                  </div>
                </dl>
                {detalle.estado !== "PENDIENTE" ? (
                  <>
                    <p>
                      {
                        (
                          {
                            APROBADA: "Aprobada",
                            RECHAZADA: "Rechazada",
                            VINCULADA: "Vinculada",
                          } as Record<string, string>
                        )[detalle.estado]
                      }{" "}
                      · {detalle.resueltoPorNombre} ·{" "}
                      {detalle.resueltoEl && fecha(detalle.resueltoEl)}
                    </p>
                    {detalle.motivo && <p>{detalle.motivo}</p>}
                    {detalle.clienteId && (
                      <ActionLink
                        href={`/crm/clientes/${detalle.clienteId}`}
                        variant="outline"
                      >
                        Ver cliente
                      </ActionLink>
                    )}
                  </>
                ) : (
                  <>
                    {detalle.coincidencias.length > 0 ? (
                      <>
                        <h2>Revisá estas coincidencias</h2>
                        {detalle.coincidencias.map((c) => (
                          <div className={styles.coincidencia} key={c.id}>
                            <strong>
                              {c.nombre}
                              {!c.activo && " · Inhabilitado"}
                            </strong>
                            <p>Coincide: {c.motivos.join(", ")}.</p>
                            <div className={styles.acciones}>
                              <ActionLink
                                href={`/crm/clientes/${c.id}`}
                                target="_blank"
                                variant="outline"
                              >
                                Ver ficha
                              </ActionLink>
                              <ActionButton
                                variant="outline"
                                isDisabled={
                                  ocupado ||
                                  !c.activo ||
                                  (documentoExistente && !c.documento)
                                }
                                onPress={() => void decidir("vincular", c.id)}
                              >
                                Es este cliente · Vincular
                              </ActionButton>
                            </div>
                          </div>
                        ))}
                        <p>
                          Vincular conserva la ficha existente sin reemplazar
                          sus datos.
                        </p>
                        {!documentoExistente && (
                          <label className={styles.confirmacion}>
                            <input
                              type="checkbox"
                              checked={confirma}
                              onChange={(e) => setConfirma(e.target.checked)}
                              disabled={ocupado}
                            />
                            Revisé las coincidencias: es otra persona o empresa.
                          </label>
                        )}
                        {documentoExistente && (
                          <p>
                            El documento ya pertenece a un cliente. No se puede
                            crear otra ficha con ese documento.
                          </p>
                        )}
                      </>
                    ) : (
                      <p>
                        No encontramos coincidencias por documento, nombre o
                        teléfono.
                      </p>
                    )}
                    {rechazando && (
                      <label className={styles.campo}>
                        Motivo del rechazo (interno, opcional)
                        <textarea
                          value={motivo}
                          maxLength={500}
                          onChange={(e) => setMotivo(e.target.value)}
                          disabled={ocupado}
                        />
                      </label>
                    )}
                    <div className={styles.acciones}>
                      {rechazando ? (
                        <>
                          <ActionButton
                            isDisabled={ocupado}
                            onPress={() => void decidir("rechazar")}
                          >
                            Confirmar rechazo
                          </ActionButton>
                          <ActionButton
                            variant="outline"
                            isDisabled={ocupado}
                            onPress={() => setRechazando(false)}
                          >
                            Cancelar
                          </ActionButton>
                        </>
                      ) : (
                        <>
                          <ActionButton
                            isDisabled={
                              ocupado ||
                              documentoExistente ||
                              (!!detalle.coincidencias.length && !confirma)
                            }
                            onPress={() => void decidir("aprobar")}
                          >
                            <Check size={16} />
                            Aprobar y crear cliente
                          </ActionButton>
                          <ActionButton
                            variant="outline"
                            isDisabled={ocupado}
                            onPress={() => setRechazando(true)}
                          >
                            <X size={16} />
                            Rechazar
                          </ActionButton>
                        </>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </section>
        </div>
      </main>
    </DesignSystemProvider>
  );
}
