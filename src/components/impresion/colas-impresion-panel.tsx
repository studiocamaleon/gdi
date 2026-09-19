"use client";
import {
  Bot,
  Check,
  FileText,
  Printer,
  ScanLine,
  LoaderCircle,
  CircleAlert,
  ArrowRight,
  PackageCheck,
  CheckCheck,
} from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { Badge } from "@/components/ui/badge";
import { textoEstadoDocumento } from "@/lib/impresion-documentos";
import {
  agruparColas,
  admiteVerificacionMultiple,
  maquinaTrabajo,
  REVISAR_ENVIO,
  type TrabajoCola,
} from "@/lib/colas-impresion";
import s from "./colas-impresion.module.css";

export function ColasImpresionPanel({
  trabajos,
  enviando,
  mensaje,
  bloqueado,
  puedeImprimir,
  seleccionados,
  setSeleccionados,
  onVerificar,
  onReimprimir,
  onPreparar,
  onEnviar,
  onSeguir,
  conexiones,
  avisos,
  seleccionandoSalidas,
  setSeleccionandoSalidas,
  enviosSeleccionados,
  setEnviosSeleccionados,
  onVerificarSeleccion,
}: {
  trabajos: TrabajoCola[];
  enviando: string | null;
  mensaje: string;
  bloqueado: boolean;
  puedeImprimir: boolean;
  seleccionados: string[];
  setSeleccionados: (ids: string[]) => void;
  onVerificar: (t: TrabajoCola) => void;
  onReimprimir: (t: TrabajoCola) => void;
  onPreparar: () => void;
  onEnviar: () => void;
  onSeguir: (t: TrabajoCola) => void;
  conexiones: string[];
  avisos: Record<string, string>;
  seleccionandoSalidas: boolean;
  setSeleccionandoSalidas: (activa: boolean) => void;
  enviosSeleccionados: string[];
  setEnviosSeleccionados: (ids: string[]) => void;
  onVerificarSeleccion: () => void;
}) {
  const grupos = agruparColas(trabajos);
  const seleccionables = trabajos.filter(admiteVerificacionMultiple);
  const seleccionadosVigentes = seleccionables.filter((t) =>
    enviosSeleccionados.includes(t.envio!.id),
  );
  const verificados = trabajos.filter((t) => t.envio?.confirmacion).length;
  const pendientes = trabajos.filter((t) => !t.envio).length;
  const enPreparacion = trabajos.filter(
    (t) => !t.envio && t.doc.ruta.estado === "PREPARACION",
  );
  const revisar = trabajos.filter(
    (t) =>
      t.doc.ruta.estado === "REVISAR" ||
      (t.envio && !t.envio.confirmacion && REVISAR_ENVIO.has(t.envio.estado)),
  ).length;
  const perfilSeleccionado = trabajos.find((t) =>
    seleccionados.includes(t.clave),
  )?.doc.ruta.perfil?.id;
  return (
    <>
      <section className={s.asistente} aria-label="Asistente Grafo">
        <div className={s.bot} data-enviando={!!enviando}>
          <Bot aria-hidden="true" />
        </div>
        <div className={s.mensaje}>
          <strong aria-live="polite">
            {mensaje ||
              (enviando
                ? "Grafo está enviando tus trabajos"
                : pendientes
                  ? "Tus trabajos, cada uno a su impresora"
                  : trabajos.length
                    ? "Los envíos están listos para verificar"
                    : "Tu cola está al día")}
          </strong>
          <p>
            {pendientes} pendientes · {enPreparacion.length} esperan papel ·{" "}
            {verificados} verificados
            {revisar ? ` · ${revisar} para revisar` : ""}
          </p>
        </div>
        {puedeImprimir && pendientes > 0 && (
          <ActionButton isDisabled={bloqueado} onPress={onEnviar}>
            <Printer data-icon="inline-start" />
            Enviar listos
          </ActionButton>
        )}
      </section>
      {puedeImprimir && (seleccionables.length > 1 || seleccionandoSalidas) && (
        <section
          className={s.verificacion}
          aria-label="Verificación de varias salidas"
          data-seleccionando={seleccionandoSalidas}
        >
          {seleccionandoSalidas ? (
            <>
              <span className={s.verificacionResumen}>
                <strong>
                  {seleccionadosVigentes.length}{" "}
                  {seleccionadosVigentes.length === 1
                    ? "salida seleccionada"
                    : "salidas seleccionadas"}
                </strong>
                <small>Seleccioná sólo las impresiones que ya revisaste.</small>
              </span>
              <ActionButton
                variant="tertiary"
                isDisabled={bloqueado || !seleccionables.length}
                onPress={() =>
                  setEnviosSeleccionados(seleccionables.map((t) => t.envio!.id))
                }
              >
                Seleccionar todos ({seleccionables.length})
              </ActionButton>
              <ActionButton
                variant="tertiary"
                isDisabled={bloqueado}
                onPress={() => {
                  setSeleccionandoSalidas(false);
                  setEnviosSeleccionados([]);
                }}
              >
                Cancelar
              </ActionButton>
              <ActionButton
                isDisabled={bloqueado || !seleccionadosVigentes.length}
                onPress={onVerificarSeleccion}
              >
                <CheckCheck data-icon="inline-start" />
                Verifiqué los seleccionados ({seleccionadosVigentes.length})
              </ActionButton>
            </>
          ) : (
            <ActionButton
              variant="outline"
              isDisabled={bloqueado}
              onPress={() => {
                setSeleccionados([]);
                setSeleccionandoSalidas(true);
              }}
            >
              <CheckCheck data-icon="inline-start" />
              Verificar varios ({seleccionables.length})
            </ActionButton>
          )}
        </section>
      )}
      {seleccionados.length > 0 && (
        <div className={s.preparacion} role="status">
          <PackageCheck aria-hidden="true" />
          <span>
            <strong>{seleccionados.length} trabajos seleccionados</strong>
            <small>Cargá el papel indicado antes de confirmar.</small>
          </span>
          <ActionButton
            variant="tertiary"
            onPress={() => setSeleccionados([])}
            isDisabled={bloqueado}
          >
            Cancelar selección
          </ActionButton>
          <ActionButton onPress={onPreparar} isDisabled={bloqueado}>
            Papel cargado · enviar
          </ActionButton>
        </div>
      )}
      {grupos.size > 1 && (
        <div className={s.conexiones} aria-hidden="true">
          <span />
        </div>
      )}
      <div className={s.columnas}>
        {[...grupos].map(([maquinaId, filas]) => {
          const destino = maquinaTrabajo(filas[0]);
          const cad = !!destino?.cad;
          const enviosMaquina = filas
            .filter(admiteVerificacionMultiple)
            .map((t) => t.envio!.id);
          const todaMaquina =
            enviosMaquina.length > 0 &&
            enviosMaquina.every((id) => enviosSeleccionados.includes(id));
          const activa = filas.some(
            (t) =>
              t.clave === enviando ||
              (t.envio &&
                !t.envio.confirmacion &&
                t.envio.estado === "PRINTING"),
          );
          const atencion =
            filas.some(
              (t) =>
                (!t.envio && t.doc.ruta.estado !== "LISTO") ||
                (t.envio &&
                  !t.envio.confirmacion &&
                  REVISAR_ENVIO.has(t.envio.estado)),
            ) || !!avisos[maquinaId];
          const conSeguimiento =
            !!destino &&
            conexiones.includes(`${destino.host}:${destino.impresora}`);
          return (
            <section
              className={s.columna}
              key={maquinaId}
              aria-label={destino?.nombre ?? "Sin destino"}
              data-activa={activa}
            >
              <header className={s.maquina}>
                <div>
                  {cad ? (
                    <ScanLine aria-hidden="true" />
                  ) : (
                    <Printer aria-hidden="true" />
                  )}
                  <h3>{destino?.nombre ?? "Revisar destino"}</h3>
                  <Badge variant="secondary">{filas.length}</Badge>
                </div>
                <p>
                  {cad
                    ? "Planos CAD · tamaño real"
                    : destino
                      ? "Documentos"
                      : "Necesitan configuración"}
                </p>
                <span
                  className={s.estadoMaquina}
                  data-activa={activa}
                  data-atencion={atencion}
                >
                  <i />
                  {activa
                    ? "En actividad"
                    : atencion
                      ? "Necesita atención"
                      : "Lista"}
                  {conSeguimiento ? " · seguimiento conectado" : ""}
                </span>
                {avisos[maquinaId] && <p role="status">{avisos[maquinaId]}</p>}
                {seleccionandoSalidas && enviosMaquina.length > 0 && (
                  <ActionButton
                    variant="tertiary"
                    isDisabled={bloqueado}
                    aria-label={`${todaMaquina ? "Quitar selección de" : "Seleccionar salidas de"} ${destino?.nombre ?? "esta impresora"}`}
                    onPress={() =>
                      setEnviosSeleccionados(
                        todaMaquina
                          ? enviosSeleccionados.filter(
                              (id) => !enviosMaquina.includes(id),
                            )
                          : [
                              ...new Set([
                                ...enviosSeleccionados,
                                ...enviosMaquina,
                              ]),
                            ],
                      )
                    }
                  >
                    {todaMaquina
                      ? "Quitar selección"
                      : `Seleccionar enviados (${enviosMaquina.length})`}
                  </ActionButton>
                )}
              </header>
              <ol className={s.trabajos}>
                {filas.map((t, i) => {
                  const { doc, envio } = t;
                  const enviado = !!envio;
                  const verificado = !!envio?.confirmacion;
                  const enviandoEste = t.clave === enviando;
                  const prepara = !envio && doc.ruta.estado === "PREPARACION";
                  const estado = verificado
                    ? "Salida verificada"
                    : enviandoEste
                      ? "Enviando…"
                      : envio
                        ? textoEstadoDocumento[envio.estado]
                        : prepara
                          ? "Cargar papel"
                          : doc.motivo
                            ? "Revisar"
                            : "En espera";
                  const anteriorPendiente = filas
                    .slice(0, i)
                    .some(
                      (f) =>
                        !f.envio ||
                        (!f.envio.confirmacion &&
                          REVISAR_ENVIO.has(f.envio.estado)),
                    );
                  return (
                    <li
                      className={s.trabajo}
                      key={t.clave}
                      data-verificado={verificado}
                      data-seleccionado={
                        !!envio &&
                        enviosSeleccionados.includes(envio.id) &&
                        admiteVerificacionMultiple(t)
                      }
                      data-activo={enviandoEste || envio?.estado === "PRINTING"}
                    >
                      <div className={s.identidad}>
                        <span>{t.numero}</span>
                        <span>{String(i + 1).padStart(2, "0")}</span>
                      </div>
                      <div className={s.nombre}>
                        {verificado ? (
                          <Check aria-hidden="true" />
                        ) : (
                          <FileText aria-hidden="true" />
                        )}
                        <strong>{doc.nombre}</strong>
                      </div>
                      <p className={s.resumen}>
                        {doc.copias} {doc.copias === 1 ? "copia" : "copias"} ·{" "}
                        {doc.paginaCad
                          ? `${doc.paginaCad.anchoMm.toLocaleString("es-AR", { maximumFractionDigits: 1 })} × ${doc.paginaCad.altoMm.toLocaleString("es-AR", { maximumFractionDigits: 1 })} mm`
                          : `${doc.paginas} pág. · ${doc.faz === 2 ? "Doble" : "Simple"} faz`}{" "}
                        ·{" "}
                        {doc.configuracion.color === "COLOR" ? "Color" : "B/N"}
                      </p>
                      {!verificado && (
                        <p className={s.papel}>
                          {doc.configuracion.papelNombre}
                          {doc.configuracion.gramaje
                            ? ` · ${doc.configuracion.gramaje} g`
                            : ""}
                          {doc.ruta.perfil
                            ? ` · ${doc.ruta.perfil.bandeja.nombre}`
                            : ""}
                        </p>
                      )}
                      <div className={s.estado}>
                        <Badge variant="secondary">
                          {enviandoEste ? (
                            <LoaderCircle className={s.girar} />
                          ) : verificado ? (
                            <Check />
                          ) : prepara || doc.motivo ? (
                            <CircleAlert />
                          ) : null}
                          {estado}
                        </Badge>
                      </div>
                      {!enviado && !doc.motivo && anteriorPendiente && (
                        <small className={s.espera}>
                          Espera el trabajo anterior de esta máquina.
                        </small>
                      )}
                      {prepara && puedeImprimir && !seleccionandoSalidas && (
                        <label className={s.seleccionar}>
                          <input
                            type="checkbox"
                            checked={seleccionados.includes(t.clave)}
                            disabled={
                              bloqueado ||
                              (!!perfilSeleccionado &&
                                perfilSeleccionado !== doc.ruta.perfil?.id)
                            }
                            onChange={(e) =>
                              setSeleccionados(
                                e.target.checked
                                  ? [...seleccionados, t.clave]
                                  : seleccionados.filter(
                                      (id) => id !== t.clave,
                                    ),
                              )
                            }
                          />
                          Preparar este trabajo
                        </label>
                      )}
                      {seleccionandoSalidas &&
                        admiteVerificacionMultiple(t) && (
                          <label className={s.seleccionar}>
                            <input
                              type="checkbox"
                              aria-label={`Verificar ${t.doc.nombre} · ${t.numero}`}
                              checked={enviosSeleccionados.includes(envio!.id)}
                              disabled={bloqueado}
                              onChange={(e) =>
                                setEnviosSeleccionados(
                                  e.target.checked
                                    ? [...enviosSeleccionados, envio!.id]
                                    : enviosSeleccionados.filter(
                                        (id) => id !== envio!.id,
                                      ),
                                )
                              }
                            />
                            Incluir en la verificación
                          </label>
                        )}
                      {envio &&
                        !verificado &&
                        puedeImprimir &&
                        (!seleccionandoSalidas ||
                          !admiteVerificacionMultiple(t)) && (
                          <ActionButton
                            variant="outline"
                            isDisabled={bloqueado}
                            onPress={() => onVerificar(t)}
                          >
                            <Check data-icon="inline-start" />
                            Verifiqué la salida
                          </ActionButton>
                        )}
                      <details className={s.detalles}>
                        <summary>
                          Detalles <ArrowRight aria-hidden="true" />
                        </summary>
                        {doc.motivo && <p>{doc.motivo}</p>}
                        {doc.paginaCad && (
                          <p>
                            Escala 100%.{" "}
                            {envio?.planCad
                              ? `Giro ${envio.planCad.giro}° · salida ${envio.planCad.anchoSalidaMm} × ${envio.planCad.largoSalidaMm.toFixed(1)} mm.`
                              : "El plano conserva sus medidas al enviarlo."}
                          </p>
                        )}
                        {envio && (
                          <>
                            <p>
                              {envio.impresora} · {envio.host}
                            </p>
                            <p>
                              Enviado por {envio.usuario} ·{" "}
                              {new Date(envio.fecha).toLocaleString("es-AR")}
                            </p>
                            {envio.eventos.slice(-5).map((e, n) => (
                              <p key={n}>
                                {new Date(e.fecha).toLocaleTimeString("es-AR")}{" "}
                                · {e.detalle}
                              </p>
                            ))}
                            {envio.confirmacion && (
                              <p>
                                Salida verificada por{" "}
                                {envio.confirmacion.usuario}.
                              </p>
                            )}
                          </>
                        )}
                        {doc.seleccionPaginas?.map((r, n) => (
                          <p key={n}>
                            Páginas {r.rango} del original (
                            {r.paginasOriginales}).
                          </p>
                        ))}
                        {puedeImprimir && (
                          <div className={s.acciones}>
                            {destino && (
                              <ActionButton
                                variant="tertiary"
                                isDisabled={bloqueado}
                                onPress={() => onSeguir(t)}
                              >
                                Consultar impresora
                              </ActionButton>
                            )}
                            {envio && (
                              <ActionButton
                                variant="tertiary"
                                isDisabled={bloqueado || !!doc.motivo}
                                onPress={() => onReimprimir(t)}
                              >
                                Reimprimir
                              </ActionButton>
                            )}
                          </div>
                        )}
                      </details>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>
      {!trabajos.length && (
        <div className={s.vacia}>
          <PackageCheck aria-hidden="true" />
          <strong>No hay trabajos pendientes</strong>
          <p>Al emitir e imprimir una OT, Grafo organiza sus archivos acá.</p>
        </div>
      )}
    </>
  );
}
