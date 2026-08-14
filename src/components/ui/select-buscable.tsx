"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { CheckIcon, ChevronDownIcon, SearchIcon, XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Una lista para elegir, con búsqueda y títulos de grupo.
 *
 * El `<select>` nativo se ve distinto en cada sistema operativo, no se puede
 * estilar y —lo que más duele acá— no deja tipear para buscar ni mostrar de
 * qué es cada opción. Con 35 categorías de egreso repartidas en 5 naturalezas,
 * una lista plana obliga a recorrerla entera para encontrar "Combustible".
 *
 * Sigue la forma del ClienteCombobox de propuesta-ficha (disparador + popover
 * + input de búsqueda + role="listbox"), pero genérico: la lista viene por
 * props y no sabe de dominio. Para elegir de un catálogo cerrado y con
 * descripciones largas está `HumanSelect`, que es Radix y no tiene búsqueda.
 */

export type OpcionSelect = {
  value: string;
  label: string;
  /** Título bajo el que se agrupa. Sin grupo, la opción va suelta arriba. */
  grupo?: string | null;
  /** Segunda línea, para separar dos opciones que se llaman parecido. */
  detalle?: string | null;
  disabled?: boolean;
};

export type GrupoOpciones = {
  titulo: string | null;
  opciones: OpcionSelect[];
};

/**
 * Sin acentos, sin mayúsculas y sin espacios de más.
 *
 * Nadie escribe "energía eléctrica" con tilde cuando está buscando rápido, y
 * una búsqueda que no encuentra "energia" se siente rota.
 */
export function normalizarBusqueda(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Las opciones que sobreviven a lo tipeado.
 *
 * Busca en la etiqueta, en el detalle y TAMBIÉN en el título del grupo: quien
 * escribe "estructura" está buscando las de esa naturaleza aunque ninguna se
 * llame así.
 */
export function filtrarOpciones(
  opciones: OpcionSelect[],
  query: string,
): OpcionSelect[] {
  const q = normalizarBusqueda(query);
  if (!q) return opciones;
  // Cada palabra por separado: "alq ofi" tiene que encontrar "Alquiler de oficina".
  const terminos = q.split(/\s+/);
  return opciones.filter((o) => {
    const heno = normalizarBusqueda(
      [o.label, o.detalle ?? "", o.grupo ?? ""].join(" "),
    );
    return terminos.every((t) => heno.includes(t));
  });
}

/**
 * Arma los grupos respetando el orden en que llegaron las opciones: el orden
 * de la lista lo decide quien la pasa, no este componente.
 */
export function agruparOpciones(opciones: OpcionSelect[]): GrupoOpciones[] {
  const grupos: GrupoOpciones[] = [];
  for (const o of opciones) {
    const titulo = o.grupo ?? null;
    const ultimo = grupos.find((g) => g.titulo === titulo);
    if (ultimo) ultimo.opciones.push(o);
    else grupos.push({ titulo, opciones: [o] });
  }
  return grupos;
}

/** Dónde se dibuja el popover, en coordenadas de viewport. */
type CajaPopover = { left: number; ancho: number; top: number; alto: number };

/**
 * El popover se dibuja en un portal sobre el `<body>`, no dentro del campo.
 *
 * Adentro quedaría recortado: el cuerpo del modal tiene `overflow-y: auto`
 * para que el encabezado y los botones no se vayan de pantalla, y eso corta
 * cualquier hijo posicionado que se salga de la caja. Por eso la posición se
 * calcula acá y no la resuelve el CSS.
 */
function calcularCaja(disparador: HTMLElement): CajaPopover {
  const r = disparador.getBoundingClientRect();
  const MARGEN = 8;
  const ALTO_MAX = 320;
  const abajo = window.innerHeight - r.bottom - MARGEN;
  const arriba = r.top - MARGEN;
  // Se abre para arriba sólo si abajo no entra y arriba hay más lugar.
  const haciaArriba = abajo < 180 && arriba > abajo;
  const alto = Math.min(ALTO_MAX, haciaArriba ? arriba : abajo);
  return {
    left: r.left,
    ancho: r.width,
    top: haciaArriba ? r.top - alto - 4 : r.bottom + 4,
    alto,
  };
}

export function SelectBuscable({
  value,
  onChange,
  opciones,
  placeholder = "Elegir…",
  placeholderBusqueda = "Buscar…",
  vacio = "No hay nada que coincida.",
  disabled,
  id,
  ariaLabel,
  className,
  /** Debajo de cuántas opciones la búsqueda estorba más de lo que ayuda. */
  minimoParaBuscar = 7,
  /** Avisa lo tipeado para que el padre recargue opciones async (ej. materias
   *  primas por servidor). Sin esto, la búsqueda es sólo client-side sobre
   *  `opciones`. Se llama "" al abrir/cerrar/limpiar para volver al set base. */
  onBuscar,
}: {
  value: string;
  onChange: (value: string) => void;
  opciones: OpcionSelect[];
  placeholder?: string;
  placeholderBusqueda?: string;
  vacio?: string;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
  className?: string;
  minimoParaBuscar?: number;
  onBuscar?: (query: string) => void;
}) {
  const raizRef = React.useRef<HTMLDivElement | null>(null);
  const popRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const listaRef = React.useRef<HTMLDivElement | null>(null);
  const [abierto, setAbierto] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activo, setActivo] = React.useState(0);
  const [caja, setCaja] = React.useState<CajaPopover | null>(null);

  const elegida = opciones.find((o) => o.value === value) ?? null;
  const conBusqueda = opciones.length >= minimoParaBuscar;

  const visibles = React.useMemo(
    () => filtrarOpciones(opciones, conBusqueda ? query : ""),
    [opciones, query, conBusqueda],
  );
  const grupos = React.useMemo(() => agruparOpciones(visibles), [visibles]);
  // Las seleccionables, en el orden en que se ven: es sobre esta lista que se
  // mueven las flechas.
  const navegables = React.useMemo(
    () => visibles.filter((o) => !o.disabled),
    [visibles],
  );

  const cerrar = React.useCallback(() => {
    setAbierto(false);
    setQuery("");
    setCaja(null);
    onBuscar?.("");
  }, [onBuscar]);

  const abrir = React.useCallback(() => {
    const disparador = raizRef.current?.querySelector<HTMLElement>(".selb-trigger");
    if (disparador) setCaja(calcularCaja(disparador));
    setAbierto(true);
  }, []);

  const elegir = React.useCallback(
    (opcion: OpcionSelect) => {
      if (opcion.disabled) return;
      onChange(opcion.value);
      cerrar();
    },
    [onChange, cerrar],
  );

  // Al abrir: foco en la búsqueda y el cursor puesto sobre lo ya elegido, no
  // arriba de todo — si vengo a cambiar "Combustible" quiero verlo primero.
  React.useEffect(() => {
    if (!abierto) return;
    const i = navegables.findIndex((o) => o.value === value);
    setActivo(i >= 0 ? i : 0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
    // Sólo al abrir: recalcular con cada tecla pelearía con las flechas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  // Tipear reordena la lista, así que el cursor vuelve al primero.
  React.useEffect(() => {
    if (abierto) setActivo(0);
  }, [query, abierto]);

  // El popover vive en el portal, así que "afuera" es afuera de LOS DOS.
  React.useEffect(() => {
    if (!abierto) return;
    const afuera = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!raizRef.current?.contains(t) && !popRef.current?.contains(t)) cerrar();
    };
    document.addEventListener("pointerdown", afuera);
    return () => document.removeEventListener("pointerdown", afuera);
  }, [abierto, cerrar]);

  // Posición fija = hay que reseguir al disparador si algo se mueve debajo.
  React.useEffect(() => {
    if (!abierto) return;
    const reubicar = () => {
      const disparador =
        raizRef.current?.querySelector<HTMLElement>(".selb-trigger");
      if (disparador) setCaja(calcularCaja(disparador));
    };
    // `true` para escuchar también el scroll del cuerpo del modal, que no
    // burbujea hasta window.
    window.addEventListener("scroll", reubicar, true);
    window.addEventListener("resize", reubicar);
    return () => {
      window.removeEventListener("scroll", reubicar, true);
      window.removeEventListener("resize", reubicar);
    };
  }, [abierto]);

  // El activo siempre a la vista: con 20 opciones bajar con la flecha sin esto
  // mueve una selección que no se ve.
  React.useEffect(() => {
    if (!abierto) return;
    listaRef.current
      ?.querySelector<HTMLElement>('[data-activo="si"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [activo, abierto]);

  const enTeclado = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (navegables.length === 0) return;
      const paso = e.key === "ArrowDown" ? 1 : -1;
      setActivo((i) => (i + paso + navegables.length) % navegables.length);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const opcion = navegables[activo];
      if (opcion) elegir(opcion);
      return;
    }
    if (e.key === "Escape") {
      // Se come el Escape: el de afuera cierra el modal entero y perdería lo
      // cargado por querer cerrar una lista.
      e.preventDefault();
      e.stopPropagation();
      cerrar();
      return;
    }
    if (e.key === "Tab") cerrar();
  };

  return (
    // El teclado se maneja en el popover, no acá: aunque viva en un portal,
    // sus eventos burbujean por el árbol de React y se ejecutaría dos veces.
    <div className={cn("selb", className)} ref={raizRef}>
      <button
        type="button"
        id={id}
        className="selb-trigger"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (abierto ? cerrar() : abrir())}
        onKeyDown={(e) => {
          if (!abierto && (e.key === "ArrowDown" || e.key === "Enter")) {
            e.preventDefault();
            abrir();
          }
        }}
      >
        <span className={cn("selb-val", !elegida && "es-placeholder")}>
          {elegida?.label ?? placeholder}
        </span>
        <ChevronDownIcon className="selb-chev" size={15} aria-hidden />
      </button>

      {abierto && caja
        ? createPortal(
        <div
          className="selb-pop"
          ref={popRef}
          onKeyDown={enTeclado}
          style={{
            left: caja.left,
            width: caja.ancho,
            top: caja.top,
            maxHeight: caja.alto,
            // El popover vive en un portal sobre <body>. Su z-index tiene que
            // ganarle al contenedor que lo dispara (el sheet de estaciones está
            // en 1001): inline y no en `.selb-pop` porque Turbopack a veces no
            // recompila globals.css y el popover quedaba invisible detrás.
            zIndex: 4000,
          }}
        >
          {conBusqueda ? (
            <div className="selb-busq">
              <SearchIcon size={14} aria-hidden />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  onBuscar?.(e.target.value);
                }}
                placeholder={placeholderBusqueda}
                aria-label={placeholderBusqueda}
              />
              {query ? (
                <button
                  type="button"
                  className="selb-limpiar"
                  onClick={() => {
                    setQuery("");
                    onBuscar?.("");
                    inputRef.current?.focus();
                  }}
                  aria-label="Limpiar búsqueda"
                >
                  <XIcon size={13} />
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="selb-lista" role="listbox" ref={listaRef}>
            {grupos.map((grupo) => (
              <div
                key={grupo.titulo ?? "__sueltas"}
                role="group"
                aria-label={grupo.titulo ?? undefined}
              >
                {grupo.titulo ? (
                  <div className="selb-grupo">{grupo.titulo}</div>
                ) : null}
                {grupo.opciones.map((opcion) => {
                  const esActiva =
                    navegables[activo]?.value === opcion.value && !opcion.disabled;
                  const esElegida = opcion.value === value;
                  return (
                    <button
                      key={opcion.value}
                      type="button"
                      role="option"
                      aria-selected={esElegida}
                      data-activo={esActiva ? "si" : undefined}
                      className={cn(
                        "selb-opt",
                        esActiva && "es-activa",
                        esElegida && "es-elegida",
                      )}
                      disabled={opcion.disabled}
                      // `onMouseDown` y no `onClick`: el pointerdown de afuera
                      // cierra el popover antes de que el click llegue.
                      onMouseDown={(e) => {
                        e.preventDefault();
                        elegir(opcion);
                      }}
                      onMouseEnter={() => {
                        const i = navegables.findIndex(
                          (o) => o.value === opcion.value,
                        );
                        if (i >= 0) setActivo(i);
                      }}
                    >
                      <span className="selb-opt-txt">
                        <span className="selb-opt-lbl">{opcion.label}</span>
                        {opcion.detalle ? (
                          <span className="selb-opt-det">{opcion.detalle}</span>
                        ) : null}
                      </span>
                      {esElegida ? <CheckIcon size={14} aria-hidden /> : null}
                    </button>
                  );
                })}
              </div>
            ))}

            {visibles.length === 0 ? (
              <div className="selb-vacio">{vacio}</div>
            ) : null}
          </div>
        </div>,
            document.body,
          )
        : null}
    </div>
  );
}
