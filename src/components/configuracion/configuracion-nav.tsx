"use client";

/**
 * La columna de secciones de Configuración: el menú del módulo, que reemplazó
 * a los seis hijos que Configuración tenía en el sidebar.
 *
 * La lista y los permisos viven en `configuracion-secciones.ts` (datos puros,
 * porque el redirect de `/configuracion` es servidor). Acá sólo se le ponen los
 * iconos y se marca la activa.
 */

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BuildingIcon,
  CreditCardIcon,
  HardDriveIcon,
  PlugIcon,
  ReceiptTextIcon,
  UsersIcon,
} from "lucide-react";

import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { usePuedeFn } from "@/components/navigation/permisos-provider";
import { seccionesConfigVisibles } from "@/components/configuracion/configuracion-secciones";

type IconCmp = React.ComponentType<React.SVGProps<SVGSVGElement>>;

const ICONOS: Record<string, IconCmp> = {
  empresa: BuildingIcon,
  usuarios: UsersIcon,
  "datos-fiscales": ReceiptTextIcon,
  "metodos-pago": CreditCardIcon,
  almacenamiento: HardDriveIcon,
  integraciones: PlugIcon,
};

export function ConfiguracionNav() {
  const pathname = usePathname();
  const puede = usePuedeFn();
  const { paisCodigo } = useConfigRegional();
  const visibles = React.useMemo(
    () => seccionesConfigVisibles(puede, paisCodigo),
    [puede, paisCodigo],
  );

  return (
    <nav className="cfgnav" aria-label="Configuración">
      <div className="cfgnav-t">Ajustes</div>
      {visibles.map((s) => {
        const Icon = ICONOS[s.key];
        const on = pathname === s.href;
        return (
          <Link
            key={s.href}
            href={s.href}
            className={`cfgnav-item ${on ? "on" : ""}`}
            aria-current={on ? "page" : undefined}
          >
            <span className="cfgnav-ico">
              {Icon ? <Icon width={16} height={16} /> : null}
            </span>
            <span className="cfgnav-txt">
              <span className="cfgnav-label">{s.label}</span>
              <span className="cfgnav-det">{s.detalle}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
