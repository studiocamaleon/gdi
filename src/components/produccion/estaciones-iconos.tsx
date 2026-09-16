import {
  BookOpenIcon,
  CircleDotIcon,
  CogIcon,
  FactoryIcon,
  LayersIcon,
  LayoutDashboardIcon,
  PackageIcon,
  PaintbrushIcon,
  PrinterIcon,
  ScissorsIcon,
  ShieldCheckIcon,
  SunIcon,
  TruckIcon,
  WrenchIcon,
  ZapIcon,
} from "lucide-react";
import type * as React from "react";
type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;
export const STATION_ICONS = [
  { key: "Layout", nm: "Layout" },
  { key: "Layers", nm: "Capas" },
  { key: "Printer", nm: "Impresora" },
  { key: "Plot", nm: "Plotter" },
  { key: "Cut", nm: "Corte" },
  { key: "Scissors", nm: "Tijeras" },
  { key: "Brush", nm: "Pincel" },
  { key: "Stamp", nm: "Troquel" },
  { key: "Fold", nm: "Plegado" },
  { key: "Cnc", nm: "CNC" },
  { key: "Beam", nm: "Láser" },
  { key: "Book", nm: "Encuadernación" },
  { key: "Tool", nm: "Herramienta" },
  { key: "Shield", nm: "QA" },
  { key: "Package", nm: "Empaque" },
  { key: "Truck", nm: "Despacho" },
  { key: "Wrench", nm: "Instalación" },
  { key: "Sun", nm: "Secado" },
];

const ICONS: Record<string, IconComponent> = {
  Layout: LayoutDashboardIcon,
  Layers: LayersIcon,
  Printer: PrinterIcon,
  Plot: FactoryIcon,
  Cut: ScissorsIcon,
  Scissors: ScissorsIcon,
  Brush: PaintbrushIcon,
  Stamp: CircleDotIcon,
  Fold: LayersIcon,
  Cnc: FactoryIcon,
  Beam: ZapIcon,
  Book: BookOpenIcon,
  Tool: WrenchIcon,
  Shield: ShieldCheckIcon,
  Package: PackageIcon,
  Truck: TruckIcon,
  Wrench: WrenchIcon,
  Sun: SunIcon,
};

function getIcon(icon: string | null | undefined) {
  return (icon && ICONS[icon]) || CogIcon;
}

function iconEl(icon: string | null | undefined) {
  const IconCmp = getIcon(icon);
  return <IconCmp />;
}

/**
 * Ícono de ayuda con el detalle en un tooltip: saca el texto chico de la UI
 * (queda sólo la etiqueta) sin perder la explicación. Nativo (`title`) para
 * que no lo recorte el `overflow` del sheet.
 */

export function StationIcon({ icono }: { icono?: string | null }) {
  return iconEl(icono);
}
