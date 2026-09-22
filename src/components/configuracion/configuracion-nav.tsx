"use client";
import {
  useImpresionDirecta,
  useCapacidad,
} from "@/components/navigation/capacidades-provider";

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
  HandCoinsIcon,
  HardDriveIcon,
  LandmarkIcon,
  PlugIcon,
  PrinterIcon,
  ReceiptTextIcon,
  UsersIcon,
  Settings2Icon,
} from "lucide-react";

import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { usePuedeFn } from "@/components/navigation/permisos-provider";
import { seccionesConfigVisibles } from "@/components/configuracion/configuracion-secciones";

import s from "./configuracion-workspace.module.css";

type IconCmp = React.ComponentType<React.SVGProps<SVGSVGElement>>;

const ICONOS: Record<string, IconCmp> = {
  empresa: BuildingIcon,
  usuarios: UsersIcon,
  "datos-fiscales": ReceiptTextIcon,
  "metodos-pago": CreditCardIcon,
  impuestos: LandmarkIcon,
  comisiones: HandCoinsIcon,
  "centro-copiado": PrinterIcon,
  almacenamiento: HardDriveIcon,
  integraciones: PlugIcon,
  impresoras: PrinterIcon,
};

export function ConfiguracionNav() {
  const impresionDirecta = useImpresionDirecta();
  const centroCopiado = useCapacidad("centro_copiado");
  const pathname = usePathname();
  const puede = usePuedeFn();
  const { paisCodigo } = useConfigRegional();
  const visibles = React.useMemo(
    () =>
      seccionesConfigVisibles(
        puede,
        paisCodigo,
        impresionDirecta,
        centroCopiado,
      ),
    [puede, paisCodigo, impresionDirecta, centroCopiado],
  );

  const grupos = [
    { label: "Organización", keys: ["empresa", "usuarios"] },
    {
      label: "Finanzas",
      keys: ["datos-fiscales", "metodos-pago", "impuestos", "comisiones"],
    },
    {
      label: "Operación",
      keys: ["centro-copiado", "impresoras", "almacenamiento", "integraciones"],
    },
  ];

  return (
    <nav className={s.nav} aria-label="Configuración">
      <div className={s.navHeading}>
        <Settings2Icon aria-hidden="true" />
        Configuración
      </div>
      {grupos.map((grupo) => {
        const secciones = visibles.filter((item) =>
          grupo.keys.includes(item.key),
        );
        if (!secciones.length) return null;
        return (
          <div className={s.navGroup} key={grupo.label}>
            <span className={s.navGroupTitle}>{grupo.label}</span>
            {secciones.map((item) => {
              const Icon = ICONOS[item.key];
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={s.navLink}
                  aria-current={pathname === item.href ? "page" : undefined}
                >
                  {Icon && <Icon aria-hidden="true" />}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
