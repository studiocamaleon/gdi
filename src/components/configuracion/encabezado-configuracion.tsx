import type { ReactNode } from "react";
import {
  CoinsIcon,
  GitBranchIcon,
  NetworkIcon,
  Settings2Icon,
} from "lucide-react";
import s from "./grafoprint-configuracion.module.css";

const iconos = {
  centros: CoinsIcon,
  maquinaria: Settings2Icon,
  nodos: NetworkIcon,
  flujos: GitBranchIcon,
};

/** Cabecera común de las herramientas de configuración del taller. */
export function EncabezadoConfiguracion({
  area,
  titulo,
  descripcion,
  acciones,
}: {
  area: keyof typeof iconos;
  titulo: ReactNode;
  descripcion: ReactNode;
  acciones?: ReactNode;
}) {
  const Icono = iconos[area];
  return (
    <header className={s.header}>
      <span className={s.headerIcon} aria-hidden="true">
        <Icono />
      </span>
      <div className={s.headerCopy}>
        <span className={s.eyebrow}>Grafoprint · Configuración del taller</span>
        <h1>{titulo}</h1>
        <div className={s.description}>{descripcion}</div>
      </div>
      {acciones ? <div className={s.headerActions}>{acciones}</div> : null}
    </header>
  );
}
