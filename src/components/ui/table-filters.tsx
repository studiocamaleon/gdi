"use client";

/**
 * <TableFilters /> — barra reusable de búsqueda + filtros de Select para
 * tablas. Diseñada para ir arriba de cualquier tabla (productos, rutas,
 * máquinas, materias primas, etc.).
 *
 * Estado completamente controlado por el caller (zero state interno) para
 * mantener la lógica de filtrado donde corresponde (en el componente de la
 * tabla). Esto permite que el caller deduzca opciones dinámicas, persista en
 * URL, etc.
 *
 * Estructura visual:
 *   [🔍 input search                ] [filter1 ▾] [filter2 ▾] [Limpiar]
 *
 * Si el chip "Limpiar" no se quiere (cuando todo está vacío), se oculta solo.
 */

import * as React from "react";
import { SearchIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface FiltroSelect {
  /** Identificador interno del filtro. */
  id: string;
  /** Label visible en el placeholder cuando no hay selección. */
  label: string;
  /** Opciones; el valor "" se trata como "todos" y limpia el filtro. */
  opciones: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}

interface TableFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filtros?: FiltroSelect[];
  /** Texto de resumen al final ("12 de 35 productos"). */
  resumen?: string;
  className?: string;
}

const TODOS = "__todos__";

export function TableFilters({
  search,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  filtros = [],
  resumen,
  className,
}: TableFiltersProps) {
  const hayFiltrosActivos =
    search.trim().length > 0 || filtros.some((f) => f.value && f.value !== TODOS);

  const limpiar = () => {
    onSearchChange("");
    filtros.forEach((f) => f.onChange(""));
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="relative min-w-[14rem] flex-1">
        <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-9 pl-8"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
            aria-label="Limpiar búsqueda"
          >
            <XIcon className="size-3.5" />
          </button>
        )}
      </div>

      {filtros.map((f) => (
        <Select
          key={f.id}
          value={f.value || TODOS}
          onValueChange={(v) => f.onChange(v === TODOS ? "" : (v ?? ""))}
        >
          <SelectTrigger className="h-9 w-auto min-w-[8rem] gap-1">
            <SelectValue placeholder={f.label} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos: {f.label.toLowerCase()}</SelectItem>
            {f.opciones.map((op) => (
              <SelectItem key={op.value} value={op.value}>
                {op.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}

      {hayFiltrosActivos && (
        <Button variant="ghost" size="sm" onClick={limpiar} className="h-9 text-xs">
          <XIcon className="mr-1 size-3" />
          Limpiar
        </Button>
      )}

      {resumen && <div className="text-muted-foreground ml-auto text-xs">{resumen}</div>}
    </div>
  );
}
