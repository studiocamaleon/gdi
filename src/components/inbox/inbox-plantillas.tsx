"use client";
import { useEffect, useId, useRef, useState } from "react";
import { FileText, Send, RefreshCw, ArrowUpRight, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api";
import {
  plantillasInboxApi,
  type PlantillasInboxApi,
  type PlantillaInbox,
} from "@/lib/meta-inbox-api";
import {
  validarValoresPlantilla,
  vistaPlantilla,
} from "../../../apps/api/src/common/inbox/plantillas";
import s from "./inbox-plantillas.module.css";
export type BorradorPlantilla = {
  plantilla: PlantillaInbox;
  valores: string[];
  consentimiento: boolean;
  clave?: string;
};
export type BorradoresPlantilla = Map<string, BorradorPlantilla>;

/** El intento permanece en memoria al cerrar o cambiar conversación, hasta conocer el resultado. */
export function InboxPlantillas({
  canalId,
  conversacionId,
  destino,
  api = plantillasInboxApi,
  actualizar,
  borradores,
  scope,
}: {
  canalId: string;
  conversacionId: string;
  destino: string;
  api?: PlantillasInboxApi;
  actualizar: () => Promise<unknown>;
  borradores: BorradoresPlantilla;
  scope: string;
}) {
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  const [lista, setLista] = useState<PlantillaInbox[]>([]);
  const [siguiente, setSiguiente] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [draft, setDraft] = useState<BorradorPlantilla | null>(
    () => borradores.get(scope) ?? null,
  );
  const [cargando, setCargando] = useState(false),
    [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const vivo = useRef(true),
    peticion = useRef<AbortController | null>(null),
    envio = useRef<AbortController | null>(null);
  const listadoId = useRef(0),
    enviandoRef = useRef(false);
  const guardar = (d: BorradorPlantilla | null) => {
    setDraft(d);
    if (d) borradores.set(scope, d);
    else borradores.delete(scope);
  };
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
      peticion.current?.abort();
      envio.current?.abort();
    };
  }, []);
  async function cargar(despues: string | null = null) {
    peticion.current?.abort();
    const controller = new AbortController();
    peticion.current = controller;
    const serial = ++listadoId.current;
    setCargando(true);
    setError(null);
    try {
      const r = await api.listar(
        canalId,
        despues,
        AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
      );
      if (
        !vivo.current ||
        controller.signal.aborted ||
        serial !== listadoId.current
      )
        return;
      if (r.canalId !== canalId) throw new Error();
      setLista((prev) => [
        ...new Map(
          [...(despues ? prev : []), ...r.plantillas].map((p) => [p.id, p]),
        ).values(),
      ]);
      setSiguiente(r.siguiente === despues ? null : r.siguiente);
    } catch {
      if (vivo.current && !controller.signal.aborted)
        setError(
          "No pudimos cargar las plantillas. Volvé a consultar el catálogo.",
        );
    } finally {
      if (vivo.current && serial === listadoId.current) setCargando(false);
    }
  }
  const abrir = (valor: boolean) => {
    setAbierto(valor);
    if (valor) {
      setAviso(null);
      void cargar();
    } else {
      peticion.current?.abort();
      listadoId.current++;
      setCargando(false);
    }
  };
  const p = draft?.plantilla;
  const vista = p ? vistaPlantilla(p, draft.valores) : null;
  const validacion = p
    ? validarValoresPlantilla(p, draft.valores)
    : "Elegí una plantilla.";
  async function enviar() {
    if (
      !draft ||
      enviandoRef.current ||
      (!draft.clave && (validacion || !draft.consentimiento))
    )
      return;
    const d = { ...draft, clave: draft.clave ?? crypto.randomUUID() };
    guardar(d);
    setError(null);
    setEnviando(true);
    enviandoRef.current = true;
    const controller = new AbortController();
    envio.current = controller;
    try {
      const r = await api.enviar(
        conversacionId,
        {
          clave: d.clave,
          canalId,
          plantillaId: d.plantilla.id,
          version: d.plantilla.version,
          pagina: d.plantilla.pagina,
          valores: d.valores,
          consentimientoConfirmado: d.consentimiento,
        },
        AbortSignal.any([controller.signal, AbortSignal.timeout(25000)]),
      );
      if (!vivo.current || controller.signal.aborted) return;
      if (!["ACEPTADO", "ENVIANDO", "INCIERTO", "RECHAZADO"].includes(r.estado))
        throw new Error();
      guardar(null);
      setAbierto(false);
      setAviso(
        r.estado === "RECHAZADO"
          ? "Meta rechazó el envío. Podés ver el detalle en la conversación."
          : r.estado === "ACEPTADO"
            ? "Plantilla registrada. El estado de entrega aparece en la conversación."
            : "El envío quedó pendiente de confirmación. No se repetirá automáticamente.",
      );
      await actualizar().catch(() => undefined);
    } catch (e) {
      if (!vivo.current || controller.signal.aborted) return;
      if (e instanceof ApiError && [400, 409].includes(e.status)) {
        guardar({ ...d, clave: undefined });
        setError(
          "Revisá los datos o actualizá el catálogo: la plantilla pudo cambiar. No se inició un nuevo envío.",
        );
      } else
        setError(
          "No pudimos confirmar el resultado. Usá «Comprobar envío» para consultar el mismo intento sin duplicarlo.",
        );
    } finally {
      if (vivo.current) setEnviando(false);
      enviandoRef.current = false;
    }
  }
  return (
    <>
      <div className={s.entry}>
        <Button variant="outline" size="sm" onClick={() => abrir(true)}>
          <FileText data-icon="inline-start" />
          {draft?.clave ? "Comprobar plantilla" : "Usar plantilla"}
        </Button>
        <span>Mensajes aprobados por Meta, también fuera de las 24 h.</span>
      </div>
      {aviso && (
        <p role="status" className={s.notice}>
          {aviso}
        </p>
      )}
      <Dialog open={abierto} onOpenChange={abrir}>
        <DialogContent className={`sm:max-w-5xl ${s.dialog}`}>
          <DialogHeader className={s.heading}>
            <span className={s.eyebrow}>GRAFO · WHATSAPP</span>
            <DialogTitle className={s.title}>
              Plantillas de WhatsApp<span>.</span>
            </DialogTitle>
            <DialogDescription>
              Elegí una plantilla aprobada y completá sus datos para {destino}.
            </DialogDescription>
          </DialogHeader>
          <div className={s.workspace}>
            <section
              className={s.catalogue}
              aria-label="Catálogo de plantillas"
            >
              <Field>
                <FieldLabel htmlFor={`${id}-buscar`}>Tus plantillas</FieldLabel>
                <Input
                  id={`${id}-buscar`}
                  placeholder="Buscar por nombre o contenido…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </Field>
              <div className={s.templates}>
                {lista
                  .filter((t) =>
                    `${t.nombre} ${t.cuerpo}`
                      .toLocaleLowerCase()
                      .includes(busqueda.toLocaleLowerCase()),
                  )
                  .map((t) => (
                    <Button
                      variant="ghost"
                      type="button"
                      key={t.id}
                      className={s.template}
                      aria-pressed={p?.id === t.id}
                      disabled={Boolean(t.motivo || draft?.clave || enviando)}
                      onClick={() => {
                        guardar({
                          plantilla: t,
                          valores: t.variables.map(() => ""),
                          consentimiento: false,
                        });
                        setError(null);
                      }}
                    >
                      <span className={s.templateTop}>
                        <FileText aria-hidden="true" />
                        <strong>{t.nombre.replaceAll("_", " ")}</strong>
                        {p?.id === t.id && <Check aria-hidden="true" />}
                      </span>
                      <span className={s.tags}>
                        <Badge variant="secondary">
                          {t.categoria === "UTILITY"
                            ? "Utilidad"
                            : t.categoria === "MARKETING"
                              ? "Marketing"
                              : "Autenticación"}
                        </Badge>
                        <span>{t.idioma}</span>
                        <span>
                          {t.estado === "APPROVED" ? "Aprobada" : t.estado}
                        </span>
                      </span>
                      <span className={s.excerpt}>{t.motivo || t.cuerpo}</span>
                    </Button>
                  ))}
                {!cargando && !error && !lista.length && (
                  <p>
                    No hay plantillas disponibles. Crealas y enviálas a revisión
                    desde el Administrador de WhatsApp de Meta.
                  </p>
                )}
                {!cargando &&
                  lista.length > 0 &&
                  !lista.some((t) =>
                    `${t.nombre} ${t.cuerpo}`
                      .toLocaleLowerCase()
                      .includes(busqueda.toLocaleLowerCase()),
                  ) && <p>No encontramos plantillas con esa búsqueda.</p>}
                {cargando && <p role="status">Consultando plantillas…</p>}
                {siguiente && (
                  <Button
                    variant="ghost"
                    disabled={cargando}
                    onClick={() => void cargar(siguiente)}
                  >
                    Cargar más plantillas
                  </Button>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={cargando || enviando || Boolean(draft?.clave)}
                onClick={() => void cargar()}
              >
                <RefreshCw data-icon="inline-start" />
                Actualizar catálogo
              </Button>
            </section>
            <section className={s.editor} aria-label="Preparar plantilla">
              {p && vista ? (
                <>
                  <div className={s.previewHeader}>
                    <span>VISTA PREVIA</span>
                    <span>Para {destino}</span>
                  </div>
                  <div className={s.preview}>
                    <div className={s.bubble}>
                      {vista.encabezado && <strong>{vista.encabezado}</strong>}
                      <p>{vista.cuerpo}</p>
                      {vista.pie && <small>{vista.pie}</small>}
                      {p.botones.map((b, i) => (
                        <div key={i} className={s.previewButton}>
                          <ArrowUpRight aria-hidden="true" />
                          <span>{b.texto}</span>
                          {b.destino && <small>{b.destino}</small>}
                        </div>
                      ))}
                    </div>
                    <span className={s.previewHint}>
                      Vista orientativa · el cliente recibe el formato de
                      WhatsApp
                    </span>
                  </div>
                  <FieldGroup className={s.fields}>
                    {p.variables.map((v, i) => (
                      <Field key={`${p.id}-${v.componente}-${v.nombre}`}>
                        <FieldLabel htmlFor={`${id}-${i}`}>
                          {v.componente === "header" ? "Encabezado" : "Mensaje"}{" "}
                          ·{" "}
                          {p.formato === "NAMED"
                            ? v.nombre.replaceAll("_", " ")
                            : `Dato ${v.nombre}`}
                        </FieldLabel>
                        <Input
                          id={`${id}-${i}`}
                          value={draft.valores[i] ?? ""}
                          maxLength={v.componente === "header" ? 60 : 1024}
                          disabled={enviando || Boolean(draft.clave)}
                          autoComplete="off"
                          onChange={(e) =>
                            guardar({
                              ...draft,
                              valores: draft.valores.map((valor, n) =>
                                n === i ? e.target.value : valor,
                              ),
                            })
                          }
                        />
                      </Field>
                    ))}
                    {!p.variables.length && (
                      <p>
                        Esta plantilla está lista: no necesita datos
                        adicionales.
                      </p>
                    )}
                    <Field orientation="horizontal">
                      <Checkbox
                        id={`${id}-consentimiento`}
                        aria-label="El cliente autorizó recibir este tipo de mensaje de nuestra empresa."
                        checked={draft.consentimiento}
                        disabled={enviando || Boolean(draft.clave)}
                        onCheckedChange={(checked) =>
                          guardar({
                            ...draft,
                            consentimiento: checked === true,
                          })
                        }
                      />
                      <FieldLabel htmlFor={`${id}-consentimiento`}>
                        El cliente autorizó recibir este tipo de mensaje de
                        nuestra empresa.
                      </FieldLabel>
                    </Field>
                  </FieldGroup>
                  {validacion && draft.valores.some(Boolean) && (
                    <p className={s.notice}>{validacion}</p>
                  )}
                </>
              ) : (
                <div className={s.empty}>
                  <FileText aria-hidden="true" />
                  <h3>Elegí el mensaje adecuado</h3>
                  <p>
                    Avisá que un trabajo está listo, confirmá un pedido o retomá
                    una conversación.
                  </p>
                  <span>01 Elegí · 02 Completá · 03 Enviá</span>
                </div>
              )}
            </section>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter className={`mx-0 mb-0 ${s.footer}`}>
            <p>
              Meta puede cobrar este mensaje. Enviar una plantilla no habilita
              texto libre: el cliente debe responder.
            </p>
            <Button
              variant="brand"
              disabled={
                enviando ||
                !draft ||
                (!draft.clave && (Boolean(validacion) || !draft.consentimiento))
              }
              onClick={() => void enviar()}
            >
              {enviando ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Send data-icon="inline-start" />
              )}
              {enviando
                ? "Comprobando…"
                : draft?.clave
                  ? "Comprobar envío"
                  : "Enviar plantilla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
