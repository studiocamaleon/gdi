"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronDown,
  CircleAlert,
  ClipboardList,
  FileText,
  Inbox,
  LayoutDashboard,
  LockKeyhole,
  MessageCircle,
  Moon,
  MoreHorizontal,
  Package,
  Paperclip,
  Plus,
  RotateCcw,
  Search,
  Send,
  Settings2,
  Sun,
  Truck,
  UserRound,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { GrafoprintBrand } from "@/components/brand/grafoprint-brand";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import brand from "@/components/design-system/brand-workspace-theme.module.css";
import {
  conversacionesDemo,
  type ConversacionDemo,
  type MensajeDemo,
} from "./inbox-fixtures";
import s from "./inbox-preview.module.css";

type Filtro = "abiertas" | "mias" | "sin-leer" | "resueltas";
type Panel =
  | "cliente"
  | "presupuesto"
  | "orden"
  | "vincular"
  | "plantilla"
  | "archivo"
  | null;
const filtros: { id: Filtro; label: string }[] = [
  { id: "abiertas", label: "Abiertas" },
  { id: "mias", label: "Mías" },
  { id: "sin-leer", label: "Sin leer" },
  { id: "resueltas", label: "Resueltas" },
];
const hora = () =>
  new Date().toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
function IconButton({
  label,
  children,
  onClick,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={label}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
function Identidad({
  iniciales,
  grande = false,
}: {
  iniciales: string;
  grande?: boolean;
}) {
  return (
    <Avatar size={grande ? "lg" : "default"}>
      <AvatarFallback>{iniciales}</AvatarFallback>
    </Avatar>
  );
}

export function InboxPreview() {
  const [items, setItems] = useState(() => structuredClone(conversacionesDemo));
  const [seleccion, setSeleccion] = useState("alma");
  const [filtro, setFiltro] = useState<Filtro>("abiertas");
  const [busqueda, setBusqueda] = useState("");
  const [modo, setModo] = useState("respuesta");
  const [borradores, setBorradores] = useState<Record<string, string>>({});
  const [panel, setPanel] = useState<Panel>(null);
  const [oscuro, setOscuro] = useState(false);
  const [movilChat, setMovilChat] = useState(false);
  const [fallar, setFallar] = useState(false);
  const [aviso, setAviso] = useState("");
  const scroll = useRef<HTMLDivElement>(null);
  const actual = items.find((c) => c.id === seleccion)!;
  const claveBorrador = `${seleccion}:${modo}`;
  const borrador = borradores[claveBorrador] ?? "";
  const apariencia = oscuro ? "dark" : "light";
  const tema = cn(brand.theme, brand.legacy);
  const sinLeer = items.filter((c) => c.sinLeer && !c.resuelta).length;
  const visibles = items.filter((c) => {
    const coincide = `${c.nombre} ${c.empresa} ${c.preview}`
      .toLocaleLowerCase()
      .includes(busqueda.toLocaleLowerCase());
    return (
      coincide &&
      (filtro === "resueltas" ? c.resuelta : !c.resuelta) &&
      (filtro !== "mias" || c.responsable === "Camila") &&
      (filtro !== "sin-leer" || c.sinLeer > 0)
    );
  });
  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [seleccion, actual.mensajes.length]);
  function cambiar(id: string, patch: Partial<ConversacionDemo>) {
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  function abrir(c: ConversacionDemo) {
    setSeleccion(c.id);
    cambiar(c.id, { sinLeer: 0 });
    setMovilChat(true);
    setAviso("");
    setModo("respuesta");
  }
  function agregar(mensaje: MensajeDemo) {
    setItems((prev) =>
      prev.map((c) =>
        c.id === seleccion
          ? {
              ...c,
              mensajes: [...c.mensajes, mensaje],
              preview:
                mensaje.tipo === "nota"
                  ? `Nota: ${mensaje.texto}`
                  : mensaje.texto,
              hora: mensaje.hora,
            }
          : c,
      ),
    );
  }
  function enviar() {
    if (
      !borrador.trim() ||
      (modo === "respuesta" && (!actual.ventanaAbierta || actual.resuelta))
    )
      return;
    agregar({
      id: crypto.randomUUID(),
      tipo: modo === "nota" ? "nota" : "salida",
      texto: borrador.trim(),
      hora: hora(),
      estado: modo === "respuesta" && fallar ? "error" : "enviado",
    });
    setBorradores((prev) => ({ ...prev, [claveBorrador]: "" }));
    setAviso(
      modo === "nota"
        ? "Nota interna agregada a la muestra."
        : fallar
          ? "Error simulado. Podés probar Reintentar."
          : "Mensaje agregado a la muestra. No se envió a WhatsApp.",
    );
    if (modo === "respuesta") setFallar(false);
  }
  function resolver() {
    cambiar(actual.id, { resuelta: !actual.resuelta, sinLeer: 0 });
    setAviso(
      actual.resuelta
        ? "Conversación reabierta en la muestra."
        : "Conversación resuelta. La encontrás en Resueltas.",
    );
  }
  function reiniciar() {
    setItems(structuredClone(conversacionesDemo));
    setSeleccion("alma");
    setFiltro("abiertas");
    setBusqueda("");
    setBorradores({});
    setPanel(null);
    setModo("respuesta");
    setFallar(false);
    setMovilChat(false);
    setAviso("Vista restablecida.");
  }
  function documento(mensaje: MensajeDemo) {
    setPanel(
      actual.presupuesto &&
        mensaje.texto === `Presupuesto ${actual.presupuesto}`
        ? "presupuesto"
        : "archivo",
    );
  }

  const contexto = (
    <>
      <div className={s.contextTitle}>
        <span>EN GRAFO</span>
        <Badge variant="outline">
          {actual.vinculada ? "Cliente vinculado" : "Sin vincular"}
        </Badge>
      </div>
      <div className={s.clientIdentity}>
        <Identidad iniciales={actual.iniciales} grande />
        <h3>{actual.empresa}</h3>
        <p>
          {actual.vinculada
            ? "Cliente de la gráfica"
            : "Vinculá este chat para ver su contexto"}
        </p>
      </div>
      {!actual.vinculada ? (
        <Button variant="outline" onClick={() => setPanel("vincular")}>
          <Plus data-icon="inline-start" />
          Vincular cliente
        </Button>
      ) : (
        <>
          <dl className={s.clientData}>
            <div>
              <dt>Contacto</dt>
              <dd>{actual.nombre}</dd>
            </div>
            <div>
              <dt>Responsable</dt>
              <dd>{actual.responsable}</dd>
            </div>
            <div>
              <dt>Canal</dt>
              <dd>WhatsApp Business</dd>
            </div>
          </dl>
          <Separator />
          <div className={s.sectionHeading}>
            <h3>Trabajos vinculados</h3>
            <span>
              {Number(Boolean(actual.orden)) +
                Number(Boolean(actual.presupuesto))}
            </span>
          </div>
          {actual.orden && (
            <button
              type="button"
              className={s.workCard}
              onClick={() => setPanel("orden")}
            >
              <span className={s.workHeading}>
                <Package size={16} />
                <b>{actual.orden}</b>
                <ArrowUpRight size={15} />
              </span>
              <strong>
                {actual.id === "alma"
                  ? "Cartelería del local"
                  : "Trabajo de impresión"}
              </strong>
              <span className={s.workStatus}>
                <i />
                {actual.etiqueta}
              </span>
              <span className={s.workFooter}>
                <Truck size={14} />
                Entrega estimada · viernes
              </span>
            </button>
          )}
          {actual.presupuesto && (
            <button
              type="button"
              className={s.workCard}
              onClick={() => setPanel("presupuesto")}
            >
              <span className={s.workHeading}>
                <FileText size={16} />
                <b>{actual.presupuesto}</b>
                <ArrowUpRight size={15} />
              </span>
              <strong>
                {actual.id === "alma" ? "$ 284.000,00" : "$ 168.000,00"}
              </strong>
              <span className={s.workFooter}>
                {actual.id === "alma"
                  ? "Aprobado por el cliente"
                  : "Pendiente de aprobación"}
              </span>
            </button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              if (!actual.presupuesto) {
                setAviso(
                  "Se preparó un borrador de presupuesto ficticio, vinculado a este cliente.",
                );
                cambiar(actual.id, { presupuesto: "PRE-DEMO" });
              }
              setPanel("presupuesto");
            }}
          >
            <Plus data-icon="inline-start" />
            {actual.presupuesto ? "Ver presupuesto" : "Preparar presupuesto"}
          </Button>
          <Separator />
          <div className={s.sectionHeading}>
            <h3>Cuenta del cliente</h3>
            <Wallet size={15} />
          </div>
          <div className={s.balance}>
            <span>Saldo pendiente</span>
            <strong>{actual.id === "alma" ? "$ 142.000,00" : "$ 0,00"}</strong>
            <small>
              {actual.id === "alma"
                ? "Seña del 50 % registrada"
                : "Sin pagos pendientes en esta muestra"}
            </small>
          </div>
          <div className={s.contextHint}>
            <LockKeyhole size={14} />
            <span>
              La información se mostrará según los permisos de cada integrante.
            </span>
          </div>
        </>
      )}
    </>
  );

  return (
    <DesignSystemProvider appearance={apariencia} theme="brand">
      <div className={cn(tema, s.shell)} data-appearance={apariencia}>
        <aside className={s.sidebar} aria-label="Navegación de referencia">
          <GrafoprintBrand />
          <div className={s.workspace}>
            <span className={s.workspaceMark}>G</span>
            <div>
              <strong>Gráfica Demo</strong>
              <small>Espacio de trabajo</small>
            </div>
          </div>
          <span className={s.navLabel}>TU GRÁFICA</span>
          <div className={s.navItem}>
            <LayoutDashboard size={17} />
            Panel general
          </div>
          <div className={cn(s.navItem, s.navActive)} aria-current="page">
            <MessageCircle size={17} />
            Conversaciones<span>{sinLeer}</span>
          </div>
          <div className={s.navItem}>
            <Users size={17} />
            Clientes
          </div>
          <div className={s.navItem}>
            <FileText size={17} />
            Presupuestos
          </div>
          <div className={s.navItem}>
            <ClipboardList size={17} />
            Órdenes de trabajo
          </div>
          <span className={s.navLabel}>OPERACIONES</span>
          <div className={s.navItem}>
            <Package size={17} />
            Producción
          </div>
          <div className={s.navItem}>
            <Wallet size={17} />
            Administración
          </div>
          <div className={s.sidebarBottom}>
            <div className={s.navItem}>
              <Settings2 size={17} />
              Configuración
            </div>
            <div className={s.profile}>
              <span className={s.workspaceMark}>CM</span>
              <div>
                <strong>Camila Moreno</strong>
                <small>Atención comercial</small>
              </div>
            </div>
          </div>
        </aside>
        <main className={s.main}>
          <div className={s.previewBar}>
            <span>
              <span className={s.previewDot} />
              Prototipo interactivo · datos ficticios · sin envíos reales
            </span>
            <div>
              <IconButton label="Reiniciar muestra" onClick={reiniciar}>
                <RotateCcw />
              </IconButton>
              <IconButton
                label={oscuro ? "Ver tema claro" : "Ver tema oscuro"}
                onClick={() => setOscuro((v) => !v)}
              >
                {oscuro ? <Sun /> : <Moon />}
              </IconButton>
            </div>
          </div>
          <header className={s.pageHeader}>
            <div>
              <p className={s.eyebrow}>CLIENTES / ATENCIÓN</p>
              <h1>
                Conversaciones<span>.</span>
              </h1>
              <p>Todo lo que necesitás saber, donde empieza la conversación.</p>
            </div>
            <div className={s.channel}>
              <span className={s.channelIcon}>
                <MessageCircle size={19} />
              </span>
              <div>
                <strong>WhatsApp de la gráfica</strong>
                <small>Canal de demostración</small>
              </div>
            </div>
          </header>
          <div className={s.workspaceGrid} data-mobile-chat={movilChat}>
            <section
              className={s.listPane}
              aria-label="Bandeja de conversaciones"
            >
              <div className={s.listTop}>
                <div className={s.listTitle}>
                  <h2>Bandeja de entrada</h2>
                  <Badge variant="secondary">
                    {items.filter((c) => !c.resuelta).length}
                  </Badge>
                </div>
                <InputGroup>
                  <InputGroupAddon>
                    <Search />
                  </InputGroupAddon>
                  <InputGroupInput
                    aria-label="Buscar conversaciones"
                    placeholder="Buscar cliente o mensaje…"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                  />
                  {busqueda && (
                    <InputGroupAddon align="inline-end">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Limpiar búsqueda"
                        onClick={() => setBusqueda("")}
                      >
                        <X />
                      </Button>
                    </InputGroupAddon>
                  )}
                </InputGroup>
                <Tabs
                  value={filtro}
                  onValueChange={(v) => setFiltro(v as Filtro)}
                >
                  <TabsList
                    variant="line"
                    className="w-full"
                    aria-label="Filtrar conversaciones"
                  >
                    {filtros.map((f) => (
                      <TabsTrigger key={f.id} value={f.id}>
                        {f.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
              <div className={s.conversations}>
                {visibles.length ? (
                  visibles.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      className={s.conversation}
                      data-active={c.id === seleccion}
                      onClick={() => abrir(c)}
                      aria-pressed={c.id === seleccion}
                      aria-label={`Abrir conversación con ${c.nombre}`}
                    >
                      <Identidad iniciales={c.iniciales} />
                      <span className={s.conversationBody}>
                        <span className={s.nameLine}>
                          <strong>{c.nombre}</strong>
                          <time>{c.hora}</time>
                        </span>
                        <span className={s.company}>{c.empresa}</span>
                        <span className={s.snippet}>{c.preview}</span>
                        <span className={s.conversationFoot}>
                          <span>{c.etiqueta}</span>
                          {c.sinLeer > 0 ? (
                            <Badge>{c.sinLeer}</Badge>
                          ) : (
                            <span className={s.ownerInitial}>
                              {c.responsable === "Sin asignar"
                                ? "Sin asignar"
                                : c.responsable}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  ))
                ) : (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Search />
                      </EmptyMedia>
                      <EmptyTitle>No hay conversaciones</EmptyTitle>
                      <EmptyDescription>
                        Probá con otro nombre o cambiá el filtro.
                      </EmptyDescription>
                    </EmptyHeader>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setBusqueda("");
                        setFiltro("abiertas");
                      }}
                    >
                      Ver abiertas
                    </Button>
                  </Empty>
                )}
              </div>
              <div className={s.listBottom}>
                <Inbox size={14} />
                {visibles.length} conversaciones en esta vista
              </div>
            </section>
            <section
              className={s.chatPane}
              aria-label={`Conversación con ${actual.nombre}`}
            >
              <header className={s.chatHeader}>
                <div className={s.chatPerson}>
                  <span className={s.backMobile}>
                    <IconButton
                      label="Volver a conversaciones"
                      onClick={() => setMovilChat(false)}
                    >
                      <ArrowLeft />
                    </IconButton>
                  </span>
                  <Identidad iniciales={actual.iniciales} grande />
                  <div>
                    <h2>{actual.nombre}</h2>
                    <p>
                      {actual.empresa}
                      <span>· WhatsApp</span>
                    </p>
                  </div>
                </div>
                <div className={s.chatTools}>
                  <Button variant="outline" onClick={resolver}>
                    <Check data-icon="inline-start" />
                    {actual.resuelta ? "Reabrir" : "Resolver"}
                  </Button>
                  <span className={s.contextMobile}>
                    <IconButton
                      label="Ver contexto del cliente"
                      onClick={() => setPanel("cliente")}
                    >
                      <UserRound />
                    </IconButton>
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Opciones de conversación"
                        />
                      }
                    >
                      <MoreHorizontal />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      className={tema}
                      data-appearance={apariencia}
                      align="end"
                    >
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          onClick={() => {
                            cambiar(actual.id, { sinLeer: 1 });
                            setAviso("Marcada como no leída en la muestra.");
                          }}
                        >
                          Marcar como no leída
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setFallar(true);
                            setAviso(
                              "El próximo envío de texto simulará un error. Podrás reintentarlo.",
                            );
                          }}
                        >
                          Simular error de envío
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </header>
              <div className={s.chatSubheader}>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button variant="ghost" size="sm" />}
                  >
                    <UserRound data-icon="inline-start" />
                    {actual.responsable === "Camila"
                      ? "Camila (vos)"
                      : actual.responsable}
                    <ChevronDown data-icon="inline-end" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className={tema}
                    data-appearance={apariencia}
                  >
                    <DropdownMenuGroup>
                      {(["Camila", "Julián", "Sin asignar"] as const).map(
                        (nombre) => (
                          <DropdownMenuItem
                            key={nombre}
                            onClick={() =>
                              cambiar(actual.id, { responsable: nombre })
                            }
                          >
                            {nombre}
                            {actual.responsable === nombre && <Check />}
                          </DropdownMenuItem>
                        ),
                      )}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Badge variant="outline">
                  {actual.resuelta ? "Resuelta" : actual.etiqueta}
                </Badge>
                {actual.orden && (
                  <button
                    className={s.orderLink}
                    onClick={() => setPanel("orden")}
                  >
                    <Package size={13} />
                    {actual.orden}
                    <ArrowUpRight size={12} />
                  </button>
                )}
              </div>
              <div
                className={s.thread}
                ref={scroll}
                role="log"
                aria-label="Mensajes de la conversación"
                aria-live="polite"
              >
                <div className={s.dayDivider}>CONVERSACIÓN DE MUESTRA</div>
                {actual.mensajes.map((m) =>
                  m.tipo === "evento" ? (
                    <div key={m.id} className={s.event}>
                      <Check size={13} />
                      {m.texto}
                    </div>
                  ) : (
                    <div key={m.id} className={s.messageRow} data-kind={m.tipo}>
                      <div
                        className={s.bubble}
                        data-kind={m.tipo}
                        data-error={m.estado === "error"}
                      >
                        {m.tipo === "nota" && (
                          <div className={s.noteLabel}>
                            <LockKeyhole size={12} />
                            Nota interna · Camila
                          </div>
                        )}
                        {m.tipo === "documento" ? (
                          <button
                            type="button"
                            className={s.document}
                            onClick={() => documento(m)}
                          >
                            <span className={s.documentIcon}>
                              <FileText size={22} />
                            </span>
                            <span>
                              <strong>{m.texto}</strong>
                              <small>Documento de muestra · PDF</small>
                            </span>
                            <ArrowUpRight size={15} />
                          </button>
                        ) : (
                          <p>{m.texto}</p>
                        )}
                        <div className={s.messageMeta}>
                          <span>{m.hora}</span>
                          {m.tipo === "salida" &&
                            (m.estado === "error" ? (
                              <CircleAlert size={13} />
                            ) : (
                              <CheckCheck
                                size={13}
                                aria-label="Envío simulado"
                              />
                            ))}
                        </div>
                        {m.estado === "error" && (
                          <button
                            className={s.retry}
                            onClick={() => {
                              cambiar(actual.id, {
                                mensajes: actual.mensajes.map((x) =>
                                  x.id === m.id
                                    ? { ...x, estado: "enviado" }
                                    : x,
                                ),
                              });
                              setAviso(
                                "Reintento simulado: se actualizó el mismo mensaje, sin duplicarlo.",
                              );
                            }}
                          >
                            <RotateCcw size={13} />
                            No enviado · Reintentar
                          </button>
                        )}
                      </div>
                    </div>
                  ),
                )}
              </div>
              <div className={s.composer} data-note={modo === "nota"}>
                <div className={s.composerTop}>
                  <Tabs value={modo} onValueChange={(v) => setModo(String(v))}>
                    <TabsList variant="line" aria-label="Tipo de mensaje">
                      <TabsTrigger value="respuesta">
                        <MessageCircle />
                        Responder
                      </TabsTrigger>
                      <TabsTrigger value="nota">
                        <LockKeyhole />
                        Nota interna
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <span className={s.composerHint}>
                    {modo === "nota" ? "Sólo tu equipo" : "WhatsApp"}
                  </span>
                </div>
                {modo === "respuesta" &&
                (actual.resuelta || !actual.ventanaAbierta) ? (
                  <div className={s.unavailable}>
                    <LockKeyhole size={18} />
                    <div>
                      <strong>
                        {actual.resuelta
                          ? "Esta conversación está resuelta"
                          : "Continuá con una plantilla"}
                      </strong>
                      <p>
                        {actual.resuelta
                          ? "Reabrila para volver a responder."
                          : "La respuesta libre no está disponible en este ejemplo."}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={
                        actual.resuelta ? resolver : () => setPanel("plantilla")
                      }
                    >
                      {actual.resuelta ? "Reabrir" : "Elegir plantilla"}
                    </Button>
                  </div>
                ) : (
                  <InputGroup className="has-disabled:bg-transparent has-disabled:opacity-100 dark:has-disabled:bg-transparent">
                    <InputGroupTextarea
                      aria-label={
                        modo === "nota"
                          ? "Escribir nota interna"
                          : "Escribir respuesta"
                      }
                      placeholder={
                        modo === "nota"
                          ? "Dejá contexto para tu equipo. El cliente no verá esta nota…"
                          : `Escribí a ${actual.nombre.split(" ")[0]}…`
                      }
                      value={borrador}
                      maxLength={4096}
                      onChange={(e) =>
                        setBorradores((prev) => ({
                          ...prev,
                          [claveBorrador]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          !e.shiftKey &&
                          !e.nativeEvent.isComposing
                        ) {
                          e.preventDefault();
                          enviar();
                        }
                      }}
                    />
                    <InputGroupAddon align="block-end">
                      <div className={s.composerActions}>
                        <div className={s.attachments}>
                          {modo === "respuesta" && (
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Adjuntar documento de muestra"
                                  />
                                }
                              >
                                <Paperclip />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                className={tema}
                                data-appearance={apariencia}
                              >
                                <DropdownMenuGroup>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      agregar({
                                        id: crypto.randomUUID(),
                                        tipo: "documento",
                                        texto: actual.presupuesto
                                          ? `Presupuesto ${actual.presupuesto}`
                                          : "Documento de referencia",
                                        hora: hora(),
                                      });
                                      setAviso(
                                        "Documento agregado sólo a la muestra.",
                                      );
                                    }}
                                  >
                                    Documento de ejemplo
                                  </DropdownMenuItem>
                                </DropdownMenuGroup>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                          <Button
                            className={s.savedReply}
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setBorradores((prev) => ({
                                ...prev,
                                [claveBorrador]:
                                  modo === "nota"
                                    ? "Confirmar fecha con producción antes de avisar al cliente."
                                    : "¡Hola! Ya estoy revisando tu pedido. Enseguida te confirmo los detalles.",
                              }))
                            }
                          >
                            <FileText data-icon="inline-start" />
                            {modo === "nota"
                              ? "Nota sugerida"
                              : "Respuesta guardada"}
                          </Button>
                        </div>
                        <Button onClick={enviar} disabled={!borrador.trim()}>
                          {modo === "nota" ? "Agregar nota" : "Enviar"}
                          <Send data-icon="inline-end" />
                        </Button>
                      </div>
                    </InputGroupAddon>
                  </InputGroup>
                )}
                <div className={s.composerFooter}>
                  <span>
                    {modo === "nota"
                      ? "Las notas no se envían al cliente"
                      : "Enter para enviar · Shift + Enter para nueva línea"}
                  </span>
                  <span>
                    {borrador.length > 0 && `${borrador.length}/4096`}
                  </span>
                </div>
              </div>
            </section>
            <aside className={s.contextPane} aria-label="Contexto del cliente">
              {contexto}
            </aside>
          </div>
          <div className={s.statusBar} role="status">
            {aviso ||
              "Diseño de atención conectado a Grafo. Los cambios se reinician al recargar."}
          </div>
        </main>
        <Sheet
          open={panel !== null}
          onOpenChange={(open) => {
            if (!open) setPanel(null);
          }}
        >
          <SheetContent
            className={cn(tema, s.detailSheet)}
            data-appearance={apariencia}
          >
            <SheetHeader>
              <SheetTitle>
                {panel === "cliente"
                  ? "Contexto del cliente"
                  : panel === "vincular"
                    ? "Vincular con un cliente"
                    : panel === "archivo"
                      ? "Documento de referencia"
                      : panel === "plantilla"
                        ? "Plantillas de WhatsApp"
                        : panel === "orden"
                          ? `Orden ${actual.orden}`
                          : `Presupuesto ${actual.presupuesto}`}
              </SheetTitle>
              <SheetDescription>
                Vista de diseño · datos y acciones de muestra.
              </SheetDescription>
            </SheetHeader>
            <div className={s.sheetBody}>
              {panel === "cliente" ? (
                contexto
              ) : panel === "vincular" ? (
                <>
                  <p>
                    Este número todavía no tiene un cliente asociado. Elegí una
                    ficha para reunir su historial y sus trabajos.
                  </p>
                  <button
                    className={s.workCard}
                    onClick={() => {
                      cambiar(actual.id, {
                        vinculada: true,
                        nombre: "Nora Vidal",
                        empresa: "Nora · Packaging",
                        iniciales: "NV",
                      });
                      setPanel(null);
                      setAviso(
                        "Contacto vinculado con el cliente ficticio Nora · Packaging.",
                      );
                    }}
                  >
                    <span className={s.workHeading}>
                      <Users size={18} />
                      <b>Nora · Packaging</b>
                      <Plus size={16} />
                    </span>
                    <span>Cliente ficticio disponible para este ensayo</span>
                  </button>
                </>
              ) : panel === "archivo" ? (
                <>
                  <Badge variant="secondary">Archivo de demostración</Badge>
                  <div className={s.templateExample}>
                    <FileText size={28} />
                    <h3>Documento de referencia.pdf</h3>
                    <p>
                      Acá se podrá consultar el archivo adjunto sin perder el
                      chat.
                    </p>
                  </div>
                  <p>
                    Esta muestra no contiene un PDF real ni descarga archivos.
                  </p>
                </>
              ) : panel === "plantilla" ? (
                <>
                  <Badge variant="secondary">Plantilla de demostración</Badge>
                  <h3>Trabajo listo para retirar</h3>
                  <div className={s.templateExample}>
                    ¡Hola! Tu trabajo ya está listo. Podés coordinar el retiro
                    respondiendo a este mensaje.
                  </div>
                  <p>
                    En el inbox real se mostrarán las plantillas y su estado de
                    aprobación en Meta.
                  </p>
                  <Button
                    onClick={() => {
                      agregar({
                        id: crypto.randomUUID(),
                        tipo: "salida",
                        texto:
                          "[Plantilla de muestra] ¡Hola! Tu trabajo ya está listo. Podés coordinar el retiro respondiendo a este mensaje.",
                        hora: hora(),
                        estado: "enviado",
                      });
                      setPanel(null);
                      setAviso(
                        "Plantilla agregada sólo a la muestra. No se envió a WhatsApp.",
                      );
                    }}
                  >
                    Probar plantilla
                    <Send data-icon="inline-end" />
                  </Button>
                </>
              ) : (
                <>
                  <Badge variant="secondary">{actual.empresa}</Badge>
                  <h3>
                    {actual.id === "alma"
                      ? "Cartelería del local"
                      : "Trabajo de impresión"}
                  </h3>
                  <p>
                    {panel === "orden"
                      ? "El estado de producción y la entrega estarán disponibles junto al chat, sin perder la conversación."
                      : "El presupuesto conserva su vínculo con el cliente y la conversación que le dio origen."}
                  </p>
                  <dl className={s.documentDetails}>
                    <div>
                      <dt>Producto</dt>
                      <dd>Impresión sobre vinilo + montaje</dd>
                    </div>
                    <div>
                      <dt>Cantidad</dt>
                      <dd>2 unidades</dd>
                    </div>
                    <div>
                      <dt>{panel === "orden" ? "Estado" : "Total"}</dt>
                      <dd>
                        {panel === "orden"
                          ? actual.etiqueta
                          : actual.id === "alma"
                            ? "$ 284.000,00"
                            : "$ 168.000,00"}
                      </dd>
                    </div>
                  </dl>
                  {panel === "orden" ? (
                    <>
                      {actual.id === "alma" ? (
                        <div className={s.productionSteps}>
                          <span>
                            <Check size={16} />
                            Diseño aprobado
                          </span>
                          <span>
                            <Check size={16} />
                            Materiales preparados
                          </span>
                          <strong>
                            <Package size={16} />
                            Impresión en curso
                          </strong>
                          <span>
                            <Truck size={16} />
                            Entrega · viernes
                          </span>
                        </div>
                      ) : (
                        <div className={s.templateExample}>
                          Estado de la orden: {actual.etiqueta}.
                        </div>
                      )}
                      <Button
                        disabled={actual.resuelta || !actual.ventanaAbierta}
                        onClick={() => {
                          setModo("respuesta");
                          setBorradores((prev) => ({
                            ...prev,
                            [`${seleccion}:respuesta`]:
                              actual.id === "alma"
                                ? "Tu trabajo está en impresión. Estamos coordinando la entrega para el viernes; te confirmo el horario apenas esté definido."
                                : `Estoy revisando tu orden ${actual.orden}, que está en la etapa ${actual.etiqueta.toLocaleLowerCase()}. Enseguida te confirmo los detalles.`,
                          }));
                          setPanel(null);
                          setAviso(
                            "Respuesta preparada. Revisala antes de enviarla en la muestra.",
                          );
                        }}
                      >
                        Preparar respuesta
                        <ArrowUpRight data-icon="inline-end" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      disabled={actual.resuelta || !actual.ventanaAbierta}
                      onClick={() => {
                        agregar({
                          id: crypto.randomUUID(),
                          tipo: "documento",
                          texto: `Presupuesto ${actual.presupuesto}`,
                          hora: hora(),
                        });
                        setPanel(null);
                        setAviso(
                          "Presupuesto compartido sólo dentro de la muestra.",
                        );
                      }}
                    >
                      <Paperclip data-icon="inline-start" />
                      Compartir en la muestra
                    </Button>
                  )}
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </DesignSystemProvider>
  );
}
