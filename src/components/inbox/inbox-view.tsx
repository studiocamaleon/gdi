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
  LockKeyhole,
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
} from "@/lib/meta-inbox-api";
import { cn } from "@/lib/utils";
import s from "./inbox-workspace.module.css";
import live from "./inbox-view.module.css";
import { InboxBienvenida } from "./inbox-bienvenida";

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

/** Sólo lectura del piloto. No comparte estado ni acciones simuladas del prototipo. */
export function InboxView({
  identidad,
  cargar = getMetaInbox,
}: {
  identidad: InboxIdentidad;
  cargar?: CargarInbox;
}) {
  const [datos, setDatos] = useState<MetaInbox | null>(null);
  const [estado, setEstado] = useState<
    "cargando" | "listo" | "inactivo" | "error" | "sesion"
  >("cargando");
  const [ocupado, setOcupado] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [oscuro, setOscuro] = useState(false);
  const [movilChat, setMovilChat] = useState(false);
  const [contextoAbierto, setContextoAbierto] = useState(false);
  const requestId = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const elegido = useRef<string | undefined>(undefined);
  const thread = useRef<HTMLDivElement>(null);
  const posicion = useRef<{ altura: number; top: number } | null>(null);
  const { fechaHora } = useFecha();
  const tema = cn(brand.theme, brand.legacy);
  const apariencia = oscuro ? "dark" : "light";

  const consultar = useCallback(
    async (query: InboxConsulta = {}, anteriores = false) => {
      controller.current?.abort();
      const control = new AbortController();
      controller.current = control;
      const numero = ++requestId.current;
      setOcupado(true);
      if (!anteriores) {
        setDatos(null);
        setEstado("cargando");
      }
      try {
        const resultado = await cargar(query, control.signal);
        if (control.signal.aborted || numero !== requestId.current) return;
        if (!resultado) {
          setDatos(null);
          setEstado("inactivo");
          elegido.current = undefined;
          return;
        }
        if (
          resultado.empresaId !== identidad.empresaId ||
          resultado.usuarioId !== identidad.usuarioId
        ) {
          setDatos(null);
          setEstado("sesion");
          elegido.current = undefined;
          return;
        }
        elegido.current = query.clienteId;
        posicion.current =
          anteriores && thread.current
            ? {
                altura: thread.current.scrollHeight,
                top: thread.current.scrollTop,
              }
            : null;
        setDatos((prev) => {
          if (
            !anteriores ||
            !prev ||
            prev.contacto.telefono !== resultado.contacto.telefono
          )
            return resultado;
          const unicos = new Map(
            [...resultado.mensajes, ...prev.mensajes].map((m) => [m.id, m]),
          );
          return {
            ...resultado,
            mensajes: [...unicos.values()].sort(
              (a, b) =>
                a.enviadoEl.localeCompare(b.enviadoEl) ||
                a.id.localeCompare(b.id),
            ),
          };
        });
        setEstado("listo");
      } catch {
        if (control.signal.aborted || numero !== requestId.current) return;
        // Un error también al paginar retira toda la información privada.
        setDatos(null);
        setEstado("error");
        elegido.current = undefined;
      } finally {
        if (numero === requestId.current && !control.signal.aborted)
          setOcupado(false);
      }
    },
    [cargar, identidad.empresaId, identidad.usuarioId],
  );

  useEffect(() => {
    elegido.current = undefined;
    void consultar();
    const refrescar = () => {
      if (document.visibilityState === "visible")
        void consultar({ clienteId: elegido.current });
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
    if (!thread.current || !datos) return;
    thread.current.scrollTop = posicion.current
      ? posicion.current.top +
        thread.current.scrollHeight -
        posicion.current.altura
      : thread.current.scrollHeight;
    posicion.current = null;
  }, [datos, movilChat]);

  const nombre =
    datos?.contexto?.cliente?.nombre ||
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
  const panelContexto = (
    <>
      <div className={s.contextTitle}>
        <span>EN GRAFO</span>
        <Badge variant="outline">{cliente ? "Por teléfono" : "Contexto"}</Badge>
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
                Este teléfono aparece en varias fichas. Elegí cuál corresponde a
                esta conversación.
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
                ? "Prueba interna · contacto autorizado · sólo lectura"
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
              <InboxBienvenida />
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
                    <Badge variant="secondary">1</Badge>
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
                  {coincide ? (
                    <button
                      type="button"
                      className={s.conversation}
                      data-active="true"
                      onClick={() => setMovilChat(true)}
                      aria-label={`Abrir conversación con ${nombre}`}
                    >
                      <Avatar>
                        <AvatarFallback>{iniciales}</AvatarFallback>
                      </Avatar>
                      <span className={s.conversationBody}>
                        <span className={s.nameLine}>
                          <strong>{nombre}</strong>
                        </span>
                        <span className={s.company}>
                          {datos.contacto.telefono}
                        </span>
                        <span className={s.snippet}>
                          {datos.mensajes.at(-1)?.texto || "Contacto de prueba"}
                        </span>
                        <span className={s.conversationFoot}>
                          WhatsApp · Recepción
                        </span>
                      </span>
                    </button>
                  ) : (
                    <Empty>
                      <EmptyHeader>
                        <EmptyTitle>Sin coincidencias</EmptyTitle>
                        <EmptyDescription>
                          Probá con otro nombre o teléfono.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )}
                </div>
                <div className={s.listBottom}>
                  <MessageCircle size={14} />
                  Canal de prueba de Meta
                </div>
              </section>
              <section
                className={s.chatPane}
                aria-label="Conversación recibida"
              >
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
                        {ocupado ? "Cargando…" : "Cargar mensajes anteriores"}
                      </Button>
                    </div>
                  )}
                  {datos.mensajes.length === 0 ? (
                    <Empty>
                      <EmptyHeader>
                        <EmptyTitle>Todavía no hay mensajes</EmptyTitle>
                        <EmptyDescription>
                          Los mensajes nuevos recibidos del contacto autorizado
                          aparecerán acá al actualizar.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  ) : (
                    datos.mensajes.map((m) => (
                      <div
                        key={m.id}
                        className={s.messageRow}
                        data-kind="entrada"
                      >
                        <div className={s.bubble} data-kind="entrada">
                          {m.tipo === "text" ? (
                            <p>{m.texto}</p>
                          ) : (
                            <>
                              <Badge variant="secondary">
                                {tipos[m.tipo] || "Otro contenido"}
                              </Badge>
                              <p>
                                Este contenido todavía no se puede abrir en
                                Grafo.
                              </p>
                            </>
                          )}
                          <div className={s.messageMeta}>
                            <time dateTime={m.enviadoEl}>
                              {fechaHora(m.enviadoEl)}
                            </time>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className={s.composer}>
                  <div className={s.unavailable}>
                    <LockKeyhole size={18} />
                    <div>
                      <strong>Recepción de prueba</strong>
                      <p>
                        Las respuestas desde el inbox todavía no están
                        habilitadas.
                      </p>
                    </div>
                  </div>
                </div>
              </section>
              <aside
                className={s.contextPane}
                aria-label="Contexto del cliente"
              >
                {panelContexto}
              </aside>
            </div>
          )}
          <div className={s.statusBar} role="status">
            {datos
              ? `${datos.mensajes.length} mensajes cargados · se actualiza al volver a esta pestaña`
              : "Conexión privada de Grafo"}
          </div>
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
