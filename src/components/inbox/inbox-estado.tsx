"use client";
import { useEffect, useRef, useState } from "react";
import { CircleCheck, CircleDot, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  equipoInboxApi,
  type EquipoInbox,
  type EquipoInboxApi,
  type EstadoConversacionInbox,
} from "@/lib/meta-inbox-api";
import { ApiError } from "@/lib/api";
import s from "./inbox-equipo.module.css";
export function InboxEstado({
  equipo,
  conversacionId,
  canalId,
  api = equipoInboxApi,
  actualizar,
}: {
  equipo: EquipoInbox;
  conversacionId: string;
  canalId: string;
  api?: EquipoInboxApi;
  actualizar: () => Promise<boolean>;
}) {
  const [abierto, setAbierto] = useState(false),
    [ocupado, setOcupado] = useState(false),
    [error, setError] = useState("");
  const control = useRef<AbortController | null>(null);
  const intento = useRef<{
    clave: string;
    estado: EstadoConversacionInbox;
    version: number;
    revision: number;
  } | null>(null);
  const version = useRef({
    version: equipo.estadoVersion ?? 0,
    revision: equipo.entrantesRevision ?? 0,
  });
  const [conflicto, setConflicto] = useState(false);
  useEffect(() => () => control.current?.abort(), []);
  const guardar = async (estado: EstadoConversacionInbox) => {
    if (control.current || !api.estado || conflicto) return;
    if (!intento.current || intento.current.estado !== estado)
      intento.current = {
        clave: crypto.randomUUID(),
        estado,
        ...version.current,
      };
    const c = new AbortController();
    control.current = c;
    setOcupado(true);
    setError("");
    try {
      await api.estado(
        conversacionId,
        { canalId, ...intento.current },
        c.signal,
      );
      if (!c.signal.aborted) {
        setAbierto(false);
        await actualizar();
      }
    } catch (e) {
      if (!c.signal.aborted) {
        setError(
          e instanceof ApiError
            ? e.message
            : "No pudimos confirmar el estado. Volvé a elegirlo para reintentar.",
        );
        if (e instanceof ApiError && e.status === 409) setConflicto(true);
        await actualizar();
      }
    } finally {
      if (!c.signal.aborted) {
        control.current = null;
        setOcupado(false);
      }
    }
  };
  const resuelta = equipo.estado === "RESUELTA";
  return (
    <DropdownMenu
      open={abierto}
      onOpenChange={(v) => {
        if (control.current) return;
        if (v) {
          setError("");
          setConflicto(false);
          intento.current = null;
          version.current = {
            version: equipo.estadoVersion ?? 0,
            revision: equipo.entrantesRevision ?? 0,
          };
        }
        setAbierto(v);
      }}
    >
      <DropdownMenuTrigger
        render={<Button size="sm" variant="outline" />}
        aria-label={`Estado: ${resuelta ? "Resuelta" : "Activa"}`}
      >
        {resuelta ? (
          <CircleCheck data-icon="inline-start" />
        ) : (
          <CircleDot data-icon="inline-start" />
        )}
        {resuelta ? "Resuelta" : "Activa"}
        <ChevronDown data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={s.stateMenu}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Estado para todo el equipo</DropdownMenuLabel>
          <DropdownMenuItem
            closeOnClick={false}
            disabled={ocupado || conflicto || !resuelta}
            onClick={() => void guardar("ACTIVA")}
          >
            <CircleDot />
            Activa
          </DropdownMenuItem>
          <DropdownMenuItem
            closeOnClick={false}
            disabled={ocupado || conflicto || resuelta}
            onClick={() => void guardar("RESUELTA")}
          >
            <CircleCheck />
            Resuelta
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <p className={s.filterHelp}>
          Si el cliente vuelve a escribir, se reabre automáticamente.
        </p>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {conflicto && (
          <Button size="sm" variant="outline" onClick={() => setAbierto(false)}>
            Volver a revisar la conversación
          </Button>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
