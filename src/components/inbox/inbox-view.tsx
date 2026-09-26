"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  MessageCircle,
  Moon,
  Sun,
  RefreshCw,
  UserRound,
  Search,
} from "lucide-react";
import { GrafoprintBrand } from "@/components/brand/grafoprint-brand";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import brand from "@/components/design-system/brand-workspace-theme.module.css";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { fechaConDia } from "@/lib/fecha";
import { useFecha } from "@/components/navigation/config-regional-provider";
import {
  getMetaInbox,
  type MetaInbox,
  type InboxIdentidad,
  type InboxConsulta,
  type CargarInbox,
  type AbrirAdjuntoInbox,
  type EnviarTextoInbox,
} from "@/lib/meta-inbox-api";
import { cn } from "@/lib/utils";
import s from "./inbox-workspace.module.css";
import live from "./inbox-view.module.css";
import type { MetaConexionApi } from "@/lib/meta-conexion-api";
import { InboxConexion } from "./inbox-conexion";
import { InboxPlantillas, type BorradoresPlantilla } from "./inbox-plantillas";
import type { PlantillasInboxApi } from "@/lib/meta-inbox-api";
import { InboxComposer, type BorradoresInbox } from "./inbox-composer";
import { InboxAdjunto } from "./inbox-adjunto";
import { InboxMessageStatus } from "./inbox-message-status";
import { InboxBienvenida } from "./inbox-bienvenida";
import { ApiError } from "@/lib/api";
import { combinarInbox } from "@/lib/inbox-combinar";
import {
  escucharInbox,
  type EscucharInbox,
  type EstadoInboxVivo,
} from "@/lib/inbox-tiempo-real";

const estadosConexion: Record<EstadoInboxVivo, string> = {
  conectando: "Conectando actualización en vivo",
  en_vivo: "Actualización en vivo",
  reconectando: "Reconectando · actualización periódica",
  sin_conexion: "Sin conexión a Internet",
  pausado: "Actualización pausada",
};

const tipos: Record<string, string> = {
  image: "Imagen",
  audio: "Audio",
  video: "Video",
  document: "Documento",
  sticker: "Sticker",
  location: "Ubicación",
  contacts: "Contacto",
  reaction: "Reacción",
  interactive: "Respuesta interactiva",
  button: "Respuesta a botón",
};

/** Canal general con respuestas explícitas; el piloto conserva sólo lectura. */
export function InboxView({
  identidad,
  cargar = getMetaInbox,
  tiempoReal = escucharInbox,
  conexionApi,
  abrirAdjunto,
  enviarTexto,
  plantillasApi,
}: {
  identidad: InboxIdentidad;
  cargar?: CargarInbox;
  tiempoReal?: EscucharInbox | null;
  conexionApi?: MetaConexionApi;
  abrirAdjunto?: AbrirAdjuntoInbox;
  enviarTexto?: EnviarTextoInbox;
  plantillasApi?: PlantillasInboxApi;
}) {
  const [datos, setDatos] = useState<MetaInbox | null>(null);
  const [estado, setEstado] = useState<
    "cargando" | "listo" | "inactivo" | "error" | "sesion"
  >("cargando");
  const [ocupado, setOcupado] = useState(false);
  const [canalHabilitado, setCanalHabilitado] = useState(false);
  const [conexion, setConexion] = useState<EstadoInboxVivo>("conectando");
  const [busqueda, setBusqueda] = useState("");
  const [oscuro, setOscuro] = useState(false);
  const [movilChat, setMovilChat] = useState(false);
  const [contextoAbierto, setContextoAbierto] = useState(false);
  const [conexionAbierta, setConexionAbierta] = useState(false);
  const borradores = useRef<BorradoresInbox>(new Map());
  const borradoresPlantillas = useRef<BorradoresPlantilla>(new Map());
  const requestId = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const elegido = useRef<string | undefined>(undefined);
  const conversacionElegida = useRef<string | undefined>(undefined);
  const datosActuales = useRef<MetaInbox | null>(null);
  const filtroActual = useRef("");
  const thread = useRef<HTMLDivElement>(null);
  const posicion = useRef<{
    altura: number;
    top: number;
    anteriores: boolean;
  } | null>(null);
  const finalizacion = useRef<Promise<void> | null>(null);
  const { fechaHora } = useFecha();
  const tema = cn(brand.theme, brand.legacy);
  const apariencia = oscuro ? "dark" : "light";

  const consultar = useCallback(
    async (
      query: InboxConsulta = {},
      anteriores = false,
      silencioso = false,
      signal?: AbortSignal,
    ): Promise<boolean> => {
      // Un aviso no interrumpe una página que el usuario está cargando.
      while (silencioso && signal && finalizacion.current) {
        await finalizacion.current;
        if (signal?.aborted) return false;
      }
      if (signal?.aborted) return false;
      if (silencioso && signal) query = { clienteId: elegido.current };
      if (datosActuales.current?.origen === "GENERAL") {
        const conversacionId =
          query.conversacionId ?? conversacionElegida.current;
        query = {
          busqueda: filtroActual.current,
          ...query,
          conversacionId,
          ...(silencioso &&
          !query.antesDe &&
          conversacionId === datosActuales.current.conversacionId &&
          datosActuales.current.mensajes[0]
            ? { desdeId: datosActuales.current.mensajes[0].id }
            : {}),
        };
      }
      controller.current?.abort();
      const control = new AbortController();
      controller.current = control;
      const numero = ++requestId.current;
      let finalizar!: () => void;
      finalizacion.current = new Promise<void>((resolve) => {
        finalizar = resolve;
      });
      const cancelar = () => control.abort();
      signal?.addEventListener("abort", cancelar, { once: true });
      let agotado = false;
      const limite = setTimeout(() => {
        agotado = true;
        control.abort();
      }, 15000);
      if (!silencioso || query.listaAntesDe) setOcupado(true);
      if (!anteriores && !silencioso) {
        if (
          datosActuales.current?.origen === "GENERAL" &&
          query.conversacionId
        ) {
          const previa = datosActuales.current;
          const contacto = previa.conversaciones?.find(
            (c) => c.id === query.conversacionId,
          );
          const vacio = {
            ...previa,
            conversacionId: query.conversacionId,
            contacto: {
              telefono: contacto?.telefono ?? "",
              nombre: contacto?.nombre,
            },
            mensajes: [],
            respuesta: undefined,
            envios: [],
            contexto: null,
            anterior: null,
          };
          datosActuales.current = vacio;
          setDatos(vacio);
        } else {
          datosActuales.current = null;
          setDatos(null);
          setEstado("cargando");
        }
      }
      try {
        const resultado = await cargar(query, control.signal);
        if (agotado) throw new ApiError("La consulta tardó demasiado.", 503);
        if (
          (control.signal.aborted && !agotado) ||
          numero !== requestId.current
        )
          return false;
        if (!resultado) {
          datosActuales.current = null;
          borradores.current.clear();
          borradoresPlantillas.current.clear();
          setDatos(null);
          conversacionElegida.current = undefined;
          setEstado("inactivo");
          setCanalHabilitado(false);
          elegido.current = undefined;
          return false;
        }
        if (
          resultado.empresaId !== identidad.empresaId ||
          resultado.usuarioId !== identidad.usuarioId
        ) {
          datosActuales.current = null;
          borradores.current.clear();
          borradoresPlantillas.current.clear();
          setDatos(null);
          conversacionElegida.current = undefined;
          setEstado("sesion");
          setCanalHabilitado(false);
          elegido.current = undefined;
          return false;
        }
        if (
          query.conversacionId &&
          resultado.origen === "GENERAL" &&
          resultado.conversacionId !== query.conversacionId
        )
          throw new ApiError("Cambió la conversación.", 409);
        elegido.current = query.clienteId;
        conversacionElegida.current = resultado.conversacionId ?? undefined;
        posicion.current =
          thread.current &&
          (anteriores ||
            (silencioso &&
              thread.current.scrollHeight -
                thread.current.scrollTop -
                thread.current.clientHeight >
                80))
            ? {
                altura: thread.current.scrollHeight,
                top: thread.current.scrollTop,
                anteriores,
              }
            : null;
        const previa = datosActuales.current;
        let siguiente =
          anteriores || silencioso
            ? combinarInbox(
                previa,
                resultado,
                anteriores ? "anteriores" : "reciente",
              )
            : resultado;
        if (query.listaAntesDe && previa?.canalId === resultado.canalId) {
          const filas = new Map(
            [
              ...(previa?.conversaciones ?? []),
              ...(resultado.conversaciones ?? []),
            ].map((c) => [c.id, c]),
          );
          siguiente = { ...siguiente, conversaciones: [...filas.values()] };
        }
        datosActuales.current = siguiente;
        setDatos(siguiente);
        setEstado("listo");
        setCanalHabilitado(true);
        return true;
      } catch (error) {
        if (
          (control.signal.aborted && !agotado) ||
          numero !== requestId.current
        )
          return false;
        // Un error también al paginar retira toda la información privada.
        datosActuales.current = null;
        setDatos(null);
        const denegado =
          error instanceof ApiError && [401, 403].includes(error.status);
        setEstado(denegado ? "sesion" : "error");
        if (denegado) {
          borradores.current.clear();
          borradoresPlantillas.current.clear();
          setCanalHabilitado(false);
        }
        elegido.current = undefined;
        return false;
      } finally {
        clearTimeout(limite);
        signal?.removeEventListener("abort", cancelar);
        if (numero === requestId.current) {
          finalizacion.current = null;
          controller.current = null;
          setOcupado(false);
        }
        finalizar();
      }
    },
    [cargar, identidad.empresaId, identidad.usuarioId],
  );

  useEffect(() => {
    borradores.current.clear();
    borradoresPlantillas.current.clear();
    elegido.current = undefined;
    conversacionElegida.current = undefined;
    datosActuales.current = null;
    filtroActual.current = "";
    setCanalHabilitado(false);
    void consultar();
    const refrescar = () => {
      if (document.visibilityState === "visible")
        void consultar({ clienteId: elegido.current }, false, true);
    };
    window.addEventListener("focus", refrescar);
    document.addEventListener("visibilitychange", refrescar);
    return () => {
      controller.current?.abort();
      window.removeEventListener("focus", refrescar);
      document.removeEventListener("visibilitychange", refrescar);
    };
  }, [consultar]);
  useEffect(() => {
    if (!canalHabilitado || !tiempoReal) return;
    return tiempoReal({
      identidad: {
        empresaId: identidad.empresaId,
        usuarioId: identidad.usuarioId,
      },
      actualizar: (signal) =>
        consultar({ clienteId: elegido.current }, false, true, signal),
      estado: setConexion,
      accesoCerrado: () => {
        controller.current?.abort();
        datosActuales.current = null;
        borradores.current.clear();
        borradoresPlantillas.current.clear();
        setDatos(null);
        conversacionElegida.current = undefined;
        setEstado("sesion");
        setCanalHabilitado(false);
        elegido.current = undefined;
      },
    });
  }, [
    canalHabilitado,
    tiempoReal,
    consultar,
    identidad.empresaId,
    identidad.usuarioId,
  ]);
  useEffect(() => {
    if (!thread.current || !datos) return;
    thread.current.scrollTop = posicion.current
      ? posicion.current.top +
        (posicion.current.anteriores
          ? thread.current.scrollHeight - posicion.current.altura
          : 0)
      : thread.current.scrollHeight;
    posicion.current = null;
  }, [datos, movilChat]);

  useEffect(() => {
    filtroActual.current = busqueda;
    if (datosActuales.current?.origen !== "GENERAL") return;
    const timer = setTimeout(() => {
      void consultar({ clienteId: elegido.current, busqueda }, false, true);
    }, 300);
    return () => clearTimeout(timer);
  }, [busqueda, consultar]);
  const nombre =
    datos?.contexto?.cliente?.nombre ||
    datos?.contacto.nombre ||
    [...(datos?.mensajes ?? [])].reverse().find((m) => m.nombreContacto)
      ?.nombreContacto ||
    datos?.contacto.telefono ||
    "Contacto";
  const iniciales = nombre
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((v) => v[0] ?? "")
    .join("")
    .toUpperCase();
  const contexto = datos?.contexto;
  const cliente = contexto?.cliente;
  const coincide = `${nombre} ${datos?.contacto.telefono ?? ""}`
    .toLocaleLowerCase()
    .includes(busqueda.toLocaleLowerCase());
  const iconoTema = (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={oscuro ? "Ver tema claro" : "Ver tema oscuro"}
            onClick={() => setOscuro((v) => !v)}
          />
        }
      >
        {oscuro ? <Sun /> : <Moon />}
      </TooltipTrigger>
      <TooltipContent>Cambiar apariencia</TooltipContent>
    </Tooltip>
  );
  const panelContexto =
    datos?.origen === "GENERAL" && !datos.conversacionId ? (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Contexto del cliente</EmptyTitle>
          <EmptyDescription>
            Elegí una conversación para ver su relación con Grafo.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    ) : (
      <>
        <div className={s.contextTitle}>
          <span>EN GRAFO</span>
          <Badge variant="outline">
            {cliente ? "Por teléfono" : "Contexto"}
          </Badge>
        </div>
        {!contexto ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Contexto restringido</EmptyTitle>
              <EmptyDescription>
                Tu acceso no incluye la consulta de clientes.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <div className={s.phoneMatch}>
              <span>Teléfono del contacto</span>
              <strong>{datos?.contacto.telefono}</strong>
              <p>
                La búsqueda incluye clientes y contactos de {identidad.empresa}.
              </p>
            </div>
            {contexto.estado === "sin_coincidencias" ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Número no registrado</EmptyTitle>
                  <EmptyDescription>
                    Registrá este teléfono en la ficha del cliente o de su
                    contacto. Al actualizar aparecerá su información.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : !cliente ? (
              <>
                <p className={s.matchHelp}>
                  Este teléfono aparece en varias fichas. Elegí cuál corresponde
                  a esta conversación.
                </p>
                {contexto.coincidencias.map((c) => (
                  <Button
                    key={c.id}
                    variant="outline"
                    disabled={ocupado}
                    onClick={() => void consultar({ clienteId: c.id })}
                  >
                    {c.nombre}
                    {!c.activo && " · Inactivo"}
                  </Button>
                ))}
              </>
            ) : (
              <>
                <div className={s.clientIdentity}>
                  <Avatar size="lg">
                    <AvatarFallback>{iniciales}</AvatarFallback>
                  </Avatar>
                  <h3>{cliente.nombre}</h3>
                  {cliente.razonSocial && <p>{cliente.razonSocial}</p>}
                  <Badge variant="outline">
                    {cliente.activo
                      ? "Cliente de la gráfica"
                      : "Cliente inactivo"}
                  </Badge>
                </div>
                {cliente.contactos.length > 0 && (
                  <p className={s.matchHelp}>
                    Contactos coincidentes: {cliente.contactos.join(", ")}
                  </p>
                )}
                <Button
                  nativeButton={false}
                  variant="outline"
                  render={
                    <a
                      href={`/clientes/${encodeURIComponent(cliente.id)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                >
                  Abrir ficha
                  <ArrowUpRight data-icon="inline-end" />
                </Button>
                {contexto.coincidencias.length > 1 && (
                  <Button
                    variant="ghost"
                    disabled={ocupado}
                    onClick={() => void consultar()}
                  >
                    Revisar otra coincidencia
                  </Button>
                )}
                <Separator />
                <div className={s.sectionHeading}>
                  <h3>Órdenes recientes</h3>
                  <span>{contexto.ordenes.length}</span>
                </div>
                {!contexto.permisos.ordenes ? (
                  <p className={s.matchHelp}>
                    Tu acceso no incluye la consulta de órdenes.
                  </p>
                ) : contexto.ordenes.length === 0 ? (
                  <p className={s.matchHelp}>
                    Este cliente todavía no tiene órdenes.
                  </p>
                ) : (
                  contexto.ordenes.map((orden) => (
                    <a
                      key={orden.id}
                      className={s.workCard}
                      href={`/produccion/ordenes/${encodeURIComponent(orden.id)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className={s.workHeading}>
                        <b>{orden.numero}</b>
                        <ArrowUpRight size={15} />
                      </span>
                      <strong>
                        {orden.items[0]?.nombre || "Orden de trabajo"}
                      </strong>
                      <span className={s.workFooter}>
                        {orden.estado.replace(/_/g, " ")}
                      </span>
                      <span className={s.workFooter}>
                        {orden.fechaEntrega
                          ? `Entrega: ${fechaConDia(orden.fechaEntrega)}`
                          : "Sin fecha de entrega"}
                      </span>
                    </a>
                  ))
                )}
              </>
            )}
          </>
        )}
      </>
    );

  return (
    <DesignSystemProvider appearance={apariencia} theme="brand">
      <div className={cn(tema, s.shell)} data-appearance={apariencia}>
        <main className={s.main}>
          <div className={s.previewBar}>
            <span>
              <span className={s.previewDot} />
              {estado === "listo"
                ? datos?.origen === "GENERAL"
                  ? datos.respuesta?.habilitado
                    ? "Grafo Inbox · WhatsApp de tu empresa"
                    : "Grafo Inbox · conversaciones sincronizadas · sólo lectura"
                  : "Prueba interna · contacto autorizado · sólo lectura"
                : "Grafo Inbox · WhatsApp"}
            </span>
            <div>{iconoTema}</div>
          </div>
          <header className={s.pageHeader}>
            <div className={s.headerIdentity}>
              <GrafoprintBrand compact />
              <div>
                <h1>
                  Inbox<span>.</span>
                </h1>
                <p>
                  {identidad.empresa} · {identidad.operador}
                </p>
              </div>
            </div>
            <div className={live.headerActions}>
              <Button
                variant="outline"
                onClick={() => setConexionAbierta(true)}
              >
                <MessageCircle data-icon="inline-start" />
                Conexión
              </Button>
              <Link href="/" className={buttonVariants({ variant: "outline" })}>
                Volver a Grafo
              </Link>
              <Button
                variant="outline"
                disabled={ocupado}
                onClick={() => void consultar({ clienteId: elegido.current })}
              >
                <RefreshCw data-icon="inline-start" />
                {ocupado ? "Actualizando…" : "Actualizar"}
              </Button>
            </div>
          </header>
          {estado === "cargando" ? (
            <div className={live.loading} role="status">
              <p>Cargando conversaciones…</p>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : estado === "inactivo" ? (
            <div className={live.welcome}>
              <InboxBienvenida identidad={identidad} api={conexionApi} />
            </div>
          ) : estado !== "listo" || !datos ? (
            <div className={live.fallback}>
              <Alert variant={estado === "error" ? "destructive" : "default"}>
                <AlertTitle>
                  {estado === "sesion"
                    ? "Cambió tu sesión"
                    : "No pudimos cargar las conversaciones"}
                </AlertTitle>
                <AlertDescription>
                  {estado === "sesion"
                    ? "Volvé a Grafo y abrí el inbox desde la cuenta actual."
                    : "Revisá tu acceso y volvé a actualizar. Los mensajes se ocultaron hasta recuperar la conexión."}
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <div className={s.workspaceGrid} data-mobile-chat={movilChat}>
              <section
                className={s.listPane}
                aria-label="Bandeja de conversaciones"
              >
                <div className={s.listTop}>
                  <div className={s.listTitle}>
                    <h2>Bandeja de entrada</h2>
                    <Badge variant="secondary">
                      {datos.conversaciones?.length ?? 1}
                      {datos.listaAnterior ? "+" : ""}
                    </Badge>
                  </div>
                  <InputGroup>
                    <InputGroupAddon>
                      <Search />
                    </InputGroupAddon>
                    <InputGroupInput
                      aria-label="Buscar contacto"
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      placeholder="Buscar nombre o teléfono…"
                    />
                  </InputGroup>
                </div>
                <div className={s.conversations}>
                  {(datos.origen === "GENERAL"
                    ? (datos.conversaciones ?? [])
                    : coincide
                      ? [
                          {
                            id: "piloto",
                            nombre,
                            telefono: datos.contacto.telefono,
                            ultimoMensaje: datos.mensajes.at(-1) ?? null,
                          },
                        ]
                      : []
                  ).map((c) => {
                    const titulo = c.nombre || c.telefono;
                    return (
                      <button
                        type="button"
                        key={c.id}
                        className={s.conversation}
                        data-active={
                          datos.origen === "GENERAL"
                            ? datos.conversacionId === c.id
                            : true
                        }
                        aria-label={`Abrir conversación con ${titulo}`}
                        onClick={() => {
                          setMovilChat(true);
                          if (
                            datos.origen === "GENERAL" &&
                            datos.conversacionId !== c.id
                          ) {
                            elegido.current = undefined;
                            conversacionElegida.current = c.id;
                            void consultar({ conversacionId: c.id });
                          }
                        }}
                      >
                        <Avatar>
                          <AvatarFallback>
                            {titulo
                              .replace(/[^\p{L}\p{N}\s]/gu, "")
                              .split(/\s+/)
                              .slice(0, 2)
                              .map((x) => x[0] ?? "")
                              .join("")
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className={s.conversationBody}>
                          <span className={s.nameLine}>
                            <strong>{titulo}</strong>
                          </span>
                          <span className={s.snippet}>
                            {c.ultimoMensaje?.eliminado
                              ? "Mensaje eliminado"
                              : c.ultimoMensaje?.texto ||
                                tipos[c.ultimoMensaje?.tipo ?? ""] ||
                                "Sin texto"}
                          </span>
                          <span className={s.conversationFoot}>
                            {c.ultimoMensaje
                              ? fechaHora(c.ultimoMensaje.enviadoEl)
                              : "WhatsApp"}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                  {(datos.origen === "GENERAL"
                    ? !datos.conversaciones?.length
                    : !coincide) && (
                    <Empty>
                      <EmptyHeader>
                        <EmptyTitle>
                          {busqueda
                            ? "Sin coincidencias"
                            : "Todavía no hay conversaciones"}
                        </EmptyTitle>
                        <EmptyDescription>
                          {busqueda
                            ? "Probá con otro nombre o teléfono."
                            : "Aparecerán aquí a medida que se reciban."}
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )}
                </div>
                <div className={s.listBottom}>
                  <MessageCircle size={14} />
                  {datos.origen === "GENERAL"
                    ? "WhatsApp de la empresa"
                    : "Canal de prueba de Meta"}
                  {datos.listaAnterior && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={ocupado}
                      onClick={() =>
                        void consultar(
                          {
                            listaAntesDe: datos.listaAnterior!,
                            clienteId: elegido.current,
                          },
                          false,
                          true,
                        )
                      }
                    >
                      Más conversaciones
                    </Button>
                  )}
                </div>
              </section>
              <section
                className={s.chatPane}
                aria-label="Conversación recibida"
              >
                {datos.origen === "GENERAL" && !datos.conversacionId ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>Tu bandeja está preparada</EmptyTitle>
                      <EmptyDescription>
                        Las conversaciones recibidas aparecerán aquí. Podés
                        cambiar la búsqueda para encontrar otros contactos.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <>
                    <header className={s.chatHeader}>
                      <div className={s.chatPerson}>
                        <span className={s.backMobile}>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Volver a conversaciones"
                            onClick={() => setMovilChat(false)}
                          >
                            <ArrowLeft />
                          </Button>
                        </span>
                        <Avatar size="lg">
                          <AvatarFallback>{iniciales}</AvatarFallback>
                        </Avatar>
                        <div>
                          <h2>{nombre}</h2>
                          <p>{datos.contacto.telefono}</p>
                        </div>
                      </div>
                      <span className={s.contextMobile}>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Ver contexto del cliente"
                          onClick={() => setContextoAbierto(true)}
                        >
                          <UserRound />
                        </Button>
                      </span>
                    </header>
                    <div
                      className={s.thread}
                      ref={thread}
                      role="log"
                      aria-label="Mensajes recibidos"
                      aria-live="polite"
                    >
                      {datos.ventanaAcotada && (
                        <Alert>
                          <AlertTitle>
                            Ventana de lectura actualizada
                          </AlertTitle>
                          <AlertDescription>
                            Mostramos los 500 mensajes más recientes. Podés
                            volver a cargar los anteriores.
                          </AlertDescription>
                        </Alert>
                      )}
                      {datos.anterior && (
                        <div className={live.older}>
                          <Button
                            variant="outline"
                            disabled={ocupado}
                            onClick={() =>
                              void consultar(
                                {
                                  antesDe: datos.anterior!,
                                  clienteId: elegido.current,
                                },
                                true,
                              )
                            }
                          >
                            {ocupado
                              ? "Cargando…"
                              : "Cargar mensajes anteriores"}
                          </Button>
                        </div>
                      )}
                      {datos.mensajes.length === 0 ? (
                        <Empty>
                          <EmptyHeader>
                            <EmptyTitle>
                              {ocupado
                                ? "Cargando conversación…"
                                : "Todavía no hay mensajes"}
                            </EmptyTitle>
                            <EmptyDescription>
                              Los mensajes de esta conversación aparecerán acá
                              automáticamente.
                            </EmptyDescription>
                          </EmptyHeader>
                        </Empty>
                      ) : (
                        datos.mensajes.map((m) => (
                          <div
                            key={m.id}
                            className={s.messageRow}
                            data-kind={
                              m.direccion === "SALIENTE" ? "salida" : "entrada"
                            }
                          >
                            <div
                              className={s.bubble}
                              data-content={
                                !m.eliminado && m.adjunto
                                  ? "adjunto"
                                  : undefined
                              }
                              data-kind={
                                m.direccion === "SALIENTE"
                                  ? "salida"
                                  : "entrada"
                              }
                            >
                              {m.eliminado ? (
                                <p>Mensaje eliminado</p>
                              ) : [
                                  "text",
                                  "button",
                                  "interactive",
                                  "template",
                                ].includes(m.tipo) ? (
                                <p>{m.texto}</p>
                              ) : m.adjunto ? (
                                <>
                                  <InboxAdjunto
                                    key={`${datos.canalId}:${m.id}:${m.adjunto.version}`}
                                    mensajeId={m.id}
                                    tipo={m.tipo}
                                    adjunto={m.adjunto}
                                    abrir={abrirAdjunto}
                                  />
                                  {m.texto && (
                                    <p className={s.attachmentCaption}>
                                      {m.texto}
                                    </p>
                                  )}
                                </>
                              ) : (
                                <>
                                  <Badge variant="secondary">
                                    {tipos[m.tipo] || "Otro contenido"}
                                  </Badge>
                                  {m.texto && <p>{m.texto}</p>}
                                  <p>
                                    Este contenido todavía no se puede abrir en
                                    Grafo.
                                  </p>
                                </>
                              )}
                              <div className={s.messageMeta}>
                                {(m.tipo === "template" || m.plantilla) && (
                                  <span>Plantilla</span>
                                )}
                                {m.editado && !m.eliminado && (
                                  <span>Editado</span>
                                )}
                                {m.delHistorial && <span>Historial</span>}
                                {m.delCelular && (
                                  <span>Desde WhatsApp Business</span>
                                )}
                                <time dateTime={m.enviadoEl}>
                                  {fechaHora(m.enviadoEl)}
                                </time>
                                {m.direccion === "SALIENTE" &&
                                  m.estadoEntrega && (
                                    <InboxMessageStatus
                                      estado={m.estadoEntrega}
                                    />
                                  )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                      {datos.envios
                        ?.filter((e) => !e.mensajeId)
                        .map((e) => (
                          <div
                            key={e.id}
                            className={s.messageRow}
                            data-kind="salida"
                          >
                            <div
                              className={s.bubble}
                              data-kind="salida"
                              data-error={e.estado === "RECHAZADO"}
                            >
                              <p>{e.texto}</p>
                              <div className={s.messageMeta}>
                                <time dateTime={e.creadoEl}>
                                  {fechaHora(e.creadoEl)}
                                </time>
                                <InboxMessageStatus estado={e.estado} />
                              </div>
                              {e.estado === "RECHAZADO" && (
                                <p>
                                  {e.codigo === "ARCHIVO_NO_PREPARADO"
                                    ? "No se pudo preparar el archivo. No se envió el mensaje; revisá el archivo y volvé a elegirlo."
                                    : e.codigo === "131047"
                                      ? "Meta indicó que la ventana está cerrada. Hace falta una plantilla."
                                      : "Meta rechazó este envío. Revisá la conexión antes de volver a intentarlo."}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                    <div className={s.composer}>
                      {datos.conversacionId && datos.canalId ? (
                        <InboxComposer
                          key={`${identidad.empresaId}:${identidad.usuarioId}:${datos.canalId}:${datos.conversacionId}`}
                          scope={`${datos.canalId}:${datos.conversacionId}`}
                          borradores={borradores.current}
                          canalId={datos.canalId}
                          conversacionId={datos.conversacionId}
                          destino={nombre}
                          respuesta={
                            datos.respuesta ?? {
                              habilitado: false,
                              abierta: false,
                              hasta: null,
                              servidorEl: new Date().toISOString(),
                            }
                          }
                          enviar={enviarTexto}
                          actualizar={() =>
                            consultar(
                              { clienteId: elegido.current },
                              false,
                              true,
                            )
                          }
                        />
                      ) : (
                        <div className={s.unavailable}>
                          <strong>Recepción de prueba</strong>
                          <p>
                            Las respuestas desde el inbox todavía no están
                            habilitadas.
                          </p>
                        </div>
                      )}
                      {datos.respuesta?.plantillasHabilitadas &&
                        datos.canalId &&
                        datos.conversacionId && (
                          <InboxPlantillas
                            key={`plantillas:${identidad.empresaId}:${identidad.usuarioId}:${datos.canalId}:${datos.conversacionId}`}
                            canalId={datos.canalId}
                            conversacionId={datos.conversacionId}
                            destino={nombre}
                            api={plantillasApi}
                            borradores={borradoresPlantillas.current}
                            scope={`${datos.canalId}:${datos.conversacionId}`}
                            actualizar={() =>
                              consultar(
                                { clienteId: elegido.current },
                                false,
                                true,
                              )
                            }
                          />
                        )}
                    </div>
                  </>
                )}
              </section>
              <aside
                className={s.contextPane}
                aria-label="Contexto del cliente"
              >
                {panelContexto}
              </aside>
            </div>
          )}
          <div className={cn(s.statusBar, live.connectionStatus)} role="status">
            {datos ? (
              <>
                <span>{datos.mensajes.length} mensajes cargados</span>
                {tiempoReal ? (
                  <Badge variant="outline">{estadosConexion[conexion]}</Badge>
                ) : (
                  <span>Vista de prueba</span>
                )}
              </>
            ) : (
              "Conexión privada de Grafo"
            )}
          </div>
          <Sheet open={conexionAbierta} onOpenChange={setConexionAbierta}>
            <SheetContent
              className={cn(tema, "overflow-y-auto sm:max-w-xl")}
              data-appearance={apariencia}
            >
              <SheetHeader>
                <SheetTitle>Conexión de WhatsApp</SheetTitle>
                <SheetDescription>
                  Estado del número y de la importación de {identidad.empresa}.
                </SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-6">
                {conexionAbierta && (
                  <InboxConexion
                    key={`${identidad.empresaId}:${identidad.usuarioId}`}
                    identidad={identidad}
                    api={conexionApi}
                  />
                )}
              </div>
            </SheetContent>
          </Sheet>
          <Sheet
            open={contextoAbierto && estado === "listo" && Boolean(datos)}
            onOpenChange={setContextoAbierto}
          >
            <SheetContent
              className={cn(tema, s.detailSheet)}
              data-appearance={apariencia}
            >
              <SheetHeader>
                <SheetTitle>Contexto del cliente</SheetTitle>
                <SheetDescription>
                  Información de {identidad.empresa} según tu acceso.
                </SheetDescription>
              </SheetHeader>
              <div className={s.sheetBody}>{panelContexto}</div>
            </SheetContent>
          </Sheet>
        </main>
      </div>
    </DesignSystemProvider>
  );
}
