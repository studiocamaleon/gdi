"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  FileText,
  Send,
  RefreshCw,
  ArrowUpRight,
  Check,
  Paperclip,
  ImageIcon,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { formatBytes } from "@/lib/archivos";
import {
  plantillasInboxApi,
  type PlantillasInboxApi,
  type PlantillaInbox,
  type ArchivoPlantillaInbox,
} from "@/lib/meta-inbox-api";
import {
  validarValoresPlantilla,
  vistaPlantilla,
} from "../../../apps/api/src/common/inbox/plantillas";
import s from "./inbox-plantillas.module.css";
const origenesArchivo = [
  { id: "PRESUPUESTO", nombre: "Presupuestos emitidos" },
  { id: "COMPROBANTE", nombre: "Comprobantes emitidos" },
  { id: "CLIENTE", nombre: "Archivos del cliente" },
] as const;
const etiquetaArchivo = (f: ArchivoPlantillaInbox) => f.referencia || f.nombre;
export type BorradorPlantilla = {
  plantilla: PlantillaInbox;
  valores: string[];
  consentimiento: boolean;
  clave?: string;
  archivo?: ArchivoPlantillaInbox;
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
  compacto = false,
}: {
  canalId: string;
  conversacionId: string;
  destino: string;
  api?: PlantillasInboxApi;
  actualizar: () => Promise<unknown>;
  borradores: BorradoresPlantilla;
  scope: string;
  compacto?: boolean;
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
  const [archivos, setArchivos] = useState<ArchivoPlantillaInbox[]>([]);
  const [archivosEstado, setArchivosEstado] = useState("");
  const [revisionArchivos, setRevisionArchivos] = useState(0);
  const opcionesArchivo = useMemo(
    () => archivos.map((f) => ({ value: f.id, label: etiquetaArchivo(f) })),
    [archivos],
  );
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
  useEffect(() => {
    if (!abierto || !p?.archivo) return;
    const controller = new AbortController();
    setArchivos([]);
    setArchivosEstado("Buscando archivos y documentos del cliente…");
    if (!api.archivos) {
      setArchivosEstado("Los archivos todavía no están disponibles.");
      return;
    }
    void api
      .archivos(
        conversacionId,
        canalId,
        AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
      )
      .then((r) => {
        if (controller.signal.aborted) return;
        const disponibles = r.archivos.filter((f) =>
          p.archivo === "document"
            ? f.mimeType === "application/pdf"
            : ["image/png", "image/jpeg"].includes(f.mimeType),
        );
        setArchivos(disponibles);
        setArchivosEstado(
          r.motivo ||
            (disponibles.length
              ? `Archivos de ${r.cliente?.nombre ?? "tu cliente"}`
              : "No hay archivos compatibles. Agregá uno en la ficha del cliente o generá el PDF desde Presupuestos o Comprobantes. Luego actualizá esta lista."),
        );
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setArchivosEstado(
            "No pudimos consultar los archivos. Revisá tus permisos y volvé a abrir esta ventana.",
          );
      });
    return () => controller.abort();
  }, [
    abierto,
    p?.id,
    p?.archivo,
    api,
    canalId,
    conversacionId,
    revisionArchivos,
  ]);
  const vista = p ? vistaPlantilla(p, draft.valores) : null;
  const validacion = p
    ? validarValoresPlantilla(p, draft.valores) ||
      (p.archivo && !draft.archivo
        ? "Elegí el archivo que llevará esta plantilla."
        : null)
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
          ...(d.archivo
            ? { archivoId: d.archivo.id, archivoVersion: d.archivo.version }
            : {}),
        },
        AbortSignal.any([controller.signal, AbortSignal.timeout(60000)]),
      );
      if (!vivo.current || controller.signal.aborted) return;
      if (!["ACEPTADO", "ENVIANDO", "INCIERTO", "RECHAZADO"].includes(r.estado))
        throw new Error();
      guardar(null);
      setAbierto(false);
      setAviso(
        r.estado === "RECHAZADO"
          ? r.codigo === "ARCHIVO_NO_PREPARADO"
            ? "No se pudo preparar el archivo. El mensaje no se envió."
            : "Meta rechazó el envío. Podés ver el detalle en la conversación."
          : r.estado === "ACEPTADO"
            ? "Plantilla registrada. El estado de entrega aparece en la conversación."
            : "El envío quedó pendiente de confirmación. No se repetirá automáticamente.",
      );
      await actualizar().catch(() => undefined);
    } catch (e) {
      if (!vivo.current || controller.signal.aborted) return;
      if (e instanceof ApiError && [400, 409].includes(e.status)) {
        guardar({ ...d, clave: undefined, archivo: undefined });
        setRevisionArchivos((n) => n + 1);
        setError(
          "Revisá los datos, volvé a elegir el archivo o actualizá el catálogo: algo pudo cambiar. No se inició un nuevo envío.",
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
      <div className={s.entry} data-compact={compacto}>
        <Button
          type="button"
          variant={compacto ? "ghost" : "outline"}
          size={compacto ? "icon" : "sm"}
          className={compacto ? "size-10 rounded-full" : undefined}
          title={draft?.clave ? "Comprobar plantilla" : "Usar plantilla"}
          aria-label={draft?.clave ? "Comprobar plantilla" : "Usar plantilla"}
          onClick={() => abrir(true)}
        >
          <FileText data-icon="inline-start" />
          <span className={compacto ? "sr-only" : undefined}>
            {draft?.clave ? "Comprobar plantilla" : "Usar plantilla"}
          </span>
        </Button>
        {!compacto && (
          <span>Mensajes aprobados por Meta, también fuera de las 24 h.</span>
        )}
      </div>
      {aviso && (
        <p role="status" className={compacto ? "sr-only" : s.notice}>
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
                        {t.archivo && (
                          <span>
                            {t.archivo === "image" ? "Imagen" : "PDF"}
                          </span>
                        )}
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
                      {p.archivo && (
                        <div className={s.mediaPreview}>
                          {draft.archivo &&
                          p.archivo === "image" &&
                          api.urlArchivo ? (
                            // Archivo privado servido por el proxy autenticado; sin optimización ni caché compartida.
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={draft.archivo.version}
                              src={api.urlArchivo(
                                draft.archivo,
                                conversacionId,
                                canalId,
                              )}
                              alt={`Vista previa de ${draft.archivo.nombre}`}
                            />
                          ) : p.archivo === "image" ? (
                            <ImageIcon aria-hidden="true" />
                          ) : (
                            <FileText aria-hidden="true" />
                          )}
                          <strong>
                            {(draft.archivo &&
                              etiquetaArchivo(draft.archivo)) ||
                              (p.archivo === "image"
                                ? "Tu imagen aparecerá acá"
                                : "PDF adjunto")}
                          </strong>
                          <small>
                            {draft.archivo
                              ? `${formatBytes(draft.archivo.bytes)} · Archivo privado`
                              : "Elegí un archivo o documento del cliente"}
                          </small>
                          {draft.archivo?.referencia && (
                            <small>{draft.archivo.nombre}</small>
                          )}
                          {draft.archivo && api.urlArchivo && (
                            <a
                              href={api.urlArchivo(
                                draft.archivo,
                                conversacionId,
                                canalId,
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Revisar archivo{" "}
                              <ArrowUpRight aria-hidden="true" />
                            </a>
                          )}
                        </div>
                      )}
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
                    {p.archivo && (
                      <Field>
                        <FieldLabel htmlFor={`${id}-archivo`}>
                          <Paperclip aria-hidden="true" />{" "}
                          {p.archivo === "image"
                            ? "Imagen de la plantilla"
                            : "PDF de la plantilla"}
                        </FieldLabel>
                        <Select
                          value={draft.archivo?.id ?? null}
                          disabled={
                            enviando || Boolean(draft.clave) || !archivos.length
                          }
                          items={opcionesArchivo}
                          onValueChange={(value) => {
                            if (
                              value === (draft.archivo?.id ?? null) ||
                              draft.clave ||
                              enviandoRef.current
                            )
                              return;
                            guardar({
                              ...draft,
                              archivo: archivos.find((f) => f.id === value),
                            });
                          }}
                        >
                          <SelectTrigger
                            id={`${id}-archivo`}
                            className="w-full"
                          >
                            <SelectValue placeholder="Elegí un archivo del cliente…" />
                          </SelectTrigger>
                          <SelectContent>
                            {origenesArchivo.map((origen) => {
                              const grupo = archivos.filter(
                                (f) => (f.origen ?? "CLIENTE") === origen.id,
                              );
                              return grupo.length > 0 ? (
                                <SelectGroup key={origen.id}>
                                  <SelectLabel>{origen.nombre}</SelectLabel>
                                  {grupo.map((f) => (
                                    <SelectItem key={f.id} value={f.id}>
                                      {etiquetaArchivo(f)}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              ) : null;
                            })}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={enviando || Boolean(draft.clave)}
                          onClick={() => {
                            guardar({ ...draft, archivo: undefined });
                            setRevisionArchivos((n) => n + 1);
                          }}
                        >
                          <RefreshCw data-icon="inline-start" /> Actualizar
                          archivos
                        </Button>
                        <p
                          className={compacto ? "sr-only" : s.notice}
                          role="status"
                        >
                          {archivosEstado}
                        </p>
                        <p className={compacto ? "sr-only" : s.notice}>
                          {p.archivo === "image"
                            ? "JPG o PNG · hasta 5 MB"
                            : "PDF · hasta 20 MB en Grafo"}
                          . Se comparte con Meta y con el destinatario al
                          enviar.
                        </p>
                        {p.archivo === "document" && (
                          <p className={compacto ? "sr-only" : s.notice}>
                            Incluye PDF listos de presupuestos emitidos y
                            comprobantes, según tus permisos. Los borradores y
                            documentos anulados no aparecen. Si falta uno,
                            generá su PDF desde el módulo correspondiente y
                            actualizá la lista.
                          </p>
                        )}
                      </Field>
                    )}
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
                    {!p.variables.length && !p.archivo && (
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
                    <p className={compacto ? "sr-only" : s.notice}>
                      {validacion}
                    </p>
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
