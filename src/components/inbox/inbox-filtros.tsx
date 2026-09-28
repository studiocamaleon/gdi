"use client";
import { useRef, useState } from "react";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  filtrosInboxIniciales,
  type FiltrosInbox,
  type EstadoConversacionInbox,
  type FiltroInbox,
} from "@/lib/meta-inbox-api";
import s from "./inbox-equipo.module.css";
export function InboxFiltros({
  value,
  onChange,
}: {
  value: FiltrosInbox;
  onChange: (v: FiltrosInbox) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState(value);
  const trigger = useRef<HTMLButtonElement>(null);
  const cantidad =
    Number(value.responsable !== "TODAS") +
    Number(value.sinLeer) +
    Number(value.sinResponder) +
    Number(value.participe) +
    Number(value.estados.length === 1);
  const patch = (v: Partial<FiltrosInbox>) =>
    setBorrador({ ...borrador, ...v });
  const aplicar = (filtros: FiltrosInbox) => {
    onChange(filtros);
    setAbierto(false);
    trigger.current?.focus();
  };
  return (
    <Collapsible
      className={s.filters}
      open={abierto}
      onOpenChange={(next) => {
        if (next)
          setBorrador({
            ...value,
            estados: value.estados.length === 1 ? value.estados : [],
          });
        setAbierto(next);
      }}
    >
      <div className={s.filterToolbar}>
        <CollapsibleTrigger
          ref={trigger}
          render={<Button variant="ghost" size="sm" />}
          className={s.filterTrigger}
          aria-label="Filtros"
        >
          <SlidersHorizontal data-icon="inline-start" />
          Filtros
          <span className={s.filterSummary} aria-live="polite">
            {cantidad
              ? `${cantidad} ${cantidad === 1 ? "activo" : "activos"}`
              : "Todas las conversaciones"}
          </span>
          <ChevronDown data-icon="inline-end" className={s.filterChevron} />
        </CollapsibleTrigger>
        {cantidad > 0 && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Limpiar filtros"
            title="Limpiar filtros"
            onClick={() => aplicar(filtrosInboxIniciales)}
          >
            <X />
          </Button>
        )}
      </div>
      <CollapsibleContent>
        <div className={s.filterPanel}>
          <div className={s.filterRow}>
            <span className={s.filterLabel}>RESPONSABLE</span>
            <ToggleGroup
              className={s.filterSegments}
              size="sm"
              value={[borrador.responsable]}
              onValueChange={(v) =>
                patch({ responsable: (v[0] ?? "TODAS") as FiltroInbox })
              }
              aria-label="Responsabilidad"
            >
              <ToggleGroupItem value="TODAS">Todas</ToggleGroupItem>
              <ToggleGroupItem value="MIAS">Mías</ToggleGroupItem>
              <ToggleGroupItem value="SIN_ASIGNAR">Sin asignar</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className={s.filterRow}>
            <span className={s.filterLabel}>ESTADO</span>
            <ToggleGroup
              className={s.filterSegments}
              size="sm"
              value={borrador.estados.length ? borrador.estados : ["TODOS"]}
              onValueChange={(v) =>
                patch({
                  estados:
                    v[0] && v[0] !== "TODOS"
                      ? [v[0] as EstadoConversacionInbox]
                      : [],
                })
              }
              aria-label="Estado de la conversación"
            >
              <ToggleGroupItem value="TODOS">Todos</ToggleGroupItem>
              <ToggleGroupItem value="ACTIVA">Activas</ToggleGroupItem>
              <ToggleGroupItem value="RESUELTA">Resueltas</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className={s.filterRow}>
            <span className={s.filterLabel}>SUMAR CRITERIOS</span>
            <ToggleGroup
              className={s.filterSegments}
              multiple
              size="sm"
              value={[
                ...(borrador.sinLeer ? ["lectura"] : []),
                ...(borrador.sinResponder ? ["respuesta"] : []),
                ...(borrador.participe ? ["participe"] : []),
              ]}
              onValueChange={(v) =>
                patch({
                  sinLeer: v.includes("lectura"),
                  sinResponder: v.includes("respuesta"),
                  participe: v.includes("participe"),
                })
              }
              aria-label="Criterios combinables"
            >
              <ToggleGroupItem value="lectura">Sin leer</ToggleGroupItem>
              <ToggleGroupItem value="respuesta">Sin responder</ToggleGroupItem>
              <ToggleGroupItem
                value="participe"
                aria-label="En las que participé"
              >
                Participé
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className={s.filterFooter}>
            <Button
              variant="ghost"
              size="sm"
              disabled={
                !cantidad &&
                borrador.responsable === "TODAS" &&
                !borrador.estados.length &&
                !borrador.sinLeer &&
                !borrador.sinResponder &&
                !borrador.participe
              }
              onClick={() => setBorrador(filtrosInboxIniciales)}
            >
              Restablecer
            </Button>
            <Button variant="brand" size="sm" onClick={() => aplicar(borrador)}>
              Aplicar filtros
            </Button>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
