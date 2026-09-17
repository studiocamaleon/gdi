"use client";

import { useId, type ReactNode } from "react";
import { Chip } from "@heroui/react";
import { XIcon, type LucideIcon } from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import s from "./estaciones-panel.module.css";

/** Buscador arriba y lista de asignaciones debajo, compartido por los tres recursos. */
export function EstacionAsignaciones({
  titulo,
  icono: Icono,
  seleccionados,
  vacio,
  onQuitar,
  disabled,
  children,
  acciones,
}: {
  titulo: string;
  icono: LucideIcon;
  seleccionados: { id: string; nombre: string; detalle?: string }[];
  vacio: string;
  onQuitar: (id: string) => void;
  disabled: boolean;
  children: ReactNode;
  acciones?: (id: string) => ReactNode;
}) {
  const tituloId = useId();
  return (
    <div className={s.asignaciones}>
      {children}
      <section className={s.seleccion} aria-labelledby={tituloId}>
        <header className={s.seleccionHead}>
          <h4 id={tituloId}>{titulo}</h4>
          <Chip
            size="sm"
            variant="soft"
            aria-label={`${seleccionados.length} seleccionados`}
          >
            {seleccionados.length}
          </Chip>
        </header>
        {seleccionados.length ? (
          <ul className={s.seleccionLista}>
            {seleccionados.map((item) => (
              <li key={item.id}>
                <span className={s.seleccionIcono}>
                  <Icono aria-hidden />
                </span>
                <div className={s.seleccionTexto}>
                  <strong>{item.nombre}</strong>
                  {item.detalle && <span>{item.detalle}</span>}
                </div>
                <div className="flex items-center gap-1">
                  {acciones?.(item.id)}
                  <ActionButton
                    variant="ghost"
                    isIconOnly
                    isDisabled={disabled}
                    aria-label={`Quitar ${item.nombre}`}
                    onPress={() => onQuitar(item.id)}
                  >
                    <XIcon />
                  </ActionButton>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.seleccionVacia}>{vacio}</p>
        )}
      </section>
    </div>
  );
}
