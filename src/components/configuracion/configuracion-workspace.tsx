"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { usePathname } from "next/navigation";
import { SaveIcon } from "lucide-react";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import { ActionButton } from "@/components/design-system/action-button";
import theme from "@/components/design-system/brand-workspace-theme.module.css";
import { ConfiguracionNav } from "./configuracion-nav";
import s from "./configuracion-workspace.module.css";

const ConfiguracionScrollContext =
  createContext<RefObject<HTMLDivElement | null> | null>(null);

/** Los detalles internos también abren desde su encabezado, sin heredar el scroll. */
export function useConfiguracionInicio(vista: string) {
  const contenido = useContext(ConfiguracionScrollContext);
  useEffect(() => {
    contenido?.current?.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [contenido, vista]);
}

/** Un solo scroll para el contenido y el mismo tema en formularios y portales. */
export function ConfiguracionWorkspace({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const contenido = useRef<HTMLDivElement>(null);
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <div
        data-ui="heroui"
        data-appearance="light"
        className={`${theme.theme} ${theme.legacy} ${s.workspace}`}
      >
        <ConfiguracionNav />
        <div key={pathname} ref={contenido} className={s.content}>
          <ConfiguracionScrollContext.Provider value={contenido}>
            {children}
          </ConfiguracionScrollContext.Provider>
        </div>
      </div>
    </DesignSystemProvider>
  );
}

export function ConfiguracionPage({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`${s.page} ${className}`}>{children}</div>;
}

export function ConfiguracionHeader({
  titulo,
  descripcion,
  acciones,
  detalle,
}: {
  titulo: string;
  descripcion: string;
  acciones?: ReactNode;
  detalle?: ReactNode;
}) {
  return (
    <header className={s.header}>
      <div className={s.heading}>
        <span className={s.eyebrow}>Configuración · Tu empresa</span>
        <div className={s.titleRow}>
          <h1>
            {titulo}
            <span className={s.dot}>.</span>
          </h1>
          {detalle}
        </div>
        <p>{descripcion}</p>
      </div>
      {acciones && <div className={s.actions}>{acciones}</div>}
    </header>
  );
}

export function GuardarConfiguracion({
  cambios,
  guardando,
  onGuardar,
}: {
  cambios: number;
  guardando: boolean;
  onGuardar: () => void;
}) {
  return (
    <ActionButton
      variant="primary"
      isDisabled={guardando || cambios === 0}
      onPress={onGuardar}
    >
      <SaveIcon />
      {guardando ? "Guardando…" : "Guardar cambios"}
      {cambios > 0 && (
        <span
          className={s.changeCount}
          aria-label={`${cambios} ${cambios === 1 ? "cambio pendiente" : "cambios pendientes"}`}
        >
          {cambios}
        </span>
      )}
    </ActionButton>
  );
}
