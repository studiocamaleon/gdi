"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRightLeft,
  LockKeyhole,
  Send,
  UserRound,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useLegacyDesignScope } from "@/components/design-system/appearance";
import { cn } from "@/lib/utils";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  equipoInboxApi,
  type EquipoInboxApi,
  type EquipoInbox,
  type EventoEquipoInbox,
  type FiltroInbox,
} from "@/lib/meta-inbox-api";
import { ApiError } from "@/lib/api";
import { useFecha } from "@/components/navigation/config-regional-provider";
import s from "./inbox-equipo.module.css";
const filtros = [
  ["TODAS", "Todas"],
  ["MIAS", "Mías"],
  ["SIN_ASIGNAR", "Sin asignar"],
  ["PARTICIPE", "Participé"],
] as const;
export function InboxFiltros({
  value,
  onChange,
}: {
  value: FiltroInbox;
  onChange: (v: FiltroInbox) => void;
}) {
  return (
    <div className={s.filters}>
      <ToggleGroup
        size="sm"
        spacing={1}
        value={[value]}
        onValueChange={(v) => {
          if (v[0]) onChange(v[0] as FiltroInbox);
        }}
        aria-label="Filtrar conversaciones"
      >
        {filtros.map(([id, label]) => (
          <ToggleGroupItem
            key={id}
            value={id}
            aria-label={id === "PARTICIPE" ? "En las que participé" : label}
          >
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
export function InboxResponsable({
  equipo,
  usuarioId,
  conversacionId,
  canalId,
  api = equipoInboxApi,
  actualizar,
}: {
  equipo: EquipoInbox;
  usuarioId: string;
  conversacionId: string;
  canalId: string;
  api?: EquipoInboxApi;
  actualizar: () => Promise<boolean>;
}) {
  const tema = useLegacyDesignScope();
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [desactualizado, setDesactualizado] = useState(false);
  const version = useRef(equipo.version);
  const intento = useRef<{
    clave: string;
    version: number;
    responsableId: string | null;
  } | null>(null);
  const control = useRef<AbortController | null>(null);
  useEffect(() => () => control.current?.abort(), []);
  const revisar = () => {
    version.current = equipo.version;
    intento.current = null;
    setError("");
    setDesactualizado(false);
  };
  const guardar = async (responsableId: string | null) => {
    if (
      control.current ||
      desactualizado ||
      responsableId === (equipo.responsable?.id ?? null)
    )
      return;
    if (!intento.current || intento.current.responsableId !== responsableId)
      intento.current = {
        clave: crypto.randomUUID(),
        version: version.current,
        responsableId,
      };
    const c = new AbortController();
    control.current = c;
    setOcupado(true);
    setError("");
    try {
      await api.asignar(
        conversacionId,
        { canalId, ...intento.current },
        c.signal,
      );
      if (c.signal.aborted) return;
      setAbierto(false);
      await actualizar();
    } catch (e) {
      if (!c.signal.aborted) {
        setError(
          e instanceof ApiError
            ? e.message
            : "No pudimos confirmar el cambio. Volvé a elegir el mismo integrante para reintentar.",
        );
        if (e instanceof ApiError && e.status === 409) setDesactualizado(true);
        await actualizar();
      }
    } finally {
      if (!c.signal.aborted) {
        control.current = null;
        setOcupado(false);
      }
    }
  };
  const opciones = [{ id: null, nombre: "Sin asignar" }, ...equipo.operadores];
  return (
    <DropdownMenu
      open={abierto}
      onOpenChange={(v) => {
        if (control.current) return;
        if (v) revisar();
        setAbierto(v);
      }}
    >
      <DropdownMenuTrigger
        render={<Button variant="outline" size="sm" className={s.owner} />}
        aria-label={`Responsable: ${equipo.responsable?.nombre ?? "Sin asignar"}`}
        title="Asignar o transferir conversación"
      >
        <UserRound data-icon="inline-start" />
        <span>
          {equipo.responsable?.nombre ?? "Sin asignar"}
          {equipo.responsable?.id === usuarioId ? " · Vos" : ""}
          {equipo.responsable && !equipo.responsable.disponible
            ? " · Sin acceso"
            : ""}
        </span>
        <ArrowRightLeft data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        {...tema}
        className={cn(tema.className, s.ownerMenu)}
        align="end"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            {ocupado ? "Guardando…" : "Asignar responsable"}
          </DropdownMenuLabel>
          {opciones.map((o) => (
            <DropdownMenuItem
              key={o.id ?? "sin-asignar"}
              closeOnClick={false}
              disabled={
                ocupado ||
                desactualizado ||
                o.id === (equipo.responsable?.id ?? null)
              }
              onClick={() => void guardar(o.id)}
            >
              <UserRound />
              <span className="min-w-0 flex-1 truncate">
                {o.nombre}
                {o.id === usuarioId ? " · Vos" : ""}
              </span>
              {o.id === (equipo.responsable?.id ?? null) && <Check />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {desactualizado && (
          <Button variant="outline" size="sm" onClick={revisar}>
            Revisar asignación actual
          </Button>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
export function InboxEventoEquipo({ evento }: { evento: EventoEquipoInbox }) {
  const { fechaHora } = useFecha();
  if (evento.tipo === "NOTA")
    return (
      <article
        className={s.note}
        aria-label={`Nota interna de ${evento.actor.nombre}`}
      >
        <header>
          <LockKeyhole size={12} />
          <strong>{evento.actor.nombre}</strong>
          <span>Nota interna</span>
        </header>
        <p>{evento.texto}</p>
        <time dateTime={evento.creadoEl}>{fechaHora(evento.creadoEl)}</time>
      </article>
    );
  const texto =
    evento.tipo === "AUTOASIGNACION"
      ? `${evento.actor.nombre} quedó a cargo al responder.`
      : evento.tipo === "SIN_ASIGNAR"
        ? `${evento.actor.nombre} dejó la conversación sin asignar.`
        : evento.tipo === "TRANSFERENCIA"
          ? `${evento.actor.nombre} transfirió la conversación de ${evento.anterior?.nombre ?? "un integrante anterior"} a ${evento.responsable?.nombre}.`
          : `${evento.actor.nombre} asignó la conversación a ${evento.responsable?.nombre}.`;
  return (
    <div className={s.event} title={fechaHora(evento.creadoEl)}>
      <ArrowRightLeft size={12} />
      <span>
        {texto}
        <small>Sólo el equipo · {fechaHora(evento.creadoEl)}</small>
      </span>
    </div>
  );
}
export type BorradoresNotas = Map<string, { texto: string; clave: string }>;
export function InboxNota({
  onSalir,
  scope,
  borradores,
  conversacionId,
  canalId,
  api = equipoInboxApi,
  actualizar,
}: {
  onSalir: () => void;
  scope: string;
  borradores: BorradoresNotas;
  conversacionId: string;
  canalId: string;
  api?: EquipoInboxApi;
  actualizar: () => Promise<boolean>;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  const [texto, setTexto] = useState(() => borradores.get(scope)?.texto ?? "");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const control = useRef<AbortController | null>(null);
  useEffect(() => () => control.current?.abort(), []);
  const guardar = async () => {
    if (!texto.trim() || texto.length > 4000 || control.current) return;
    const intento = borradores.get(scope) ?? {
      texto,
      clave: crypto.randomUUID(),
    };
    borradores.set(scope, intento);
    const c = new AbortController();
    control.current = c;
    setOcupado(true);
    setError("");
    try {
      await api.nota(conversacionId, { canalId, ...intento }, c.signal);
      if (c.signal.aborted) return;
      borradores.delete(scope);
      setTexto("");
      await actualizar();
    } catch (e) {
      if (!c.signal.aborted) {
        setError(
          e instanceof ApiError
            ? e.message
            : "No pudimos confirmar la nota. Tu texto sigue aquí para reintentar.",
        );
        if (e instanceof ApiError && [401, 403].includes(e.status))
          await actualizar();
      }
    } finally {
      if (!c.signal.aborted) {
        control.current = null;
        setOcupado(false);
      }
    }
  };
  return (
    <form
      className={s.noteComposer}
      onSubmit={(e) => {
        e.preventDefault();
        void guardar();
      }}
    >
      <div className={s.noteMode}>
        <span>
          <LockKeyhole size={13} /> Nota interna · sólo el equipo
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Volver a responder por WhatsApp"
          title="Volver a WhatsApp; conservar borrador de nota"
          disabled={ocupado}
          onClick={onSalir}
        >
          <X />
        </Button>
      </div>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="inbox-nota" className="sr-only">
            <LockKeyhole size={13} /> Nota interna · sólo el equipo
          </FieldLabel>
          <Textarea
            id="inbox-nota"
            ref={input}
            onKeyDown={(e) => {
              if (
                (e.ctrlKey || e.metaKey) &&
                e.key === "Enter" &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                void guardar();
              } else if (e.key === "Escape" && !ocupado) {
                e.preventDefault();
                onSalir();
              }
            }}
            value={texto}
            disabled={ocupado}
            maxLength={4000}
            rows={2}
            placeholder="Dejá una indicación para tus compañeros…"
            onChange={(e) => {
              setTexto(e.target.value);
              borradores.set(scope, {
                texto: e.target.value,
                clave: crypto.randomUUID(),
              });
            }}
          />
          <FieldDescription>
            No se envía a WhatsApp ni cambia el responsable.{" "}
            {texto.length > 4000 &&
              "Reducí la nota a 4000 caracteres para guardarla."}
          </FieldDescription>
        </Field>
      </FieldGroup>
      <div className={s.noteActions}>
        <Button
          size="sm"
          type="submit"
          disabled={ocupado || !texto.trim() || texto.length > 4000}
        >
          <Send data-icon="inline-start" />
          {ocupado ? "Guardando…" : "Guardar nota"}
        </Button>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}
