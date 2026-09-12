"use client";

import * as React from "react";
import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import theme from "@/components/ui/workspace-theme.module.css";
import s from "./orden-workspace.module.css";

const compactQuery = "(max-width: 1023px)";
function subscribeCompact(onChange: () => void) {
  const query = window.matchMedia(compactQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const DatosContext = React.createContext<{
  compact: boolean;
  open: boolean;
  id: string;
  toggle: () => void;
} | null>(null);

/** Sólo organiza la ficha: los valores y las acciones siguen en PropuestaFicha. */
export type OrdenWorkspaceHandle = { mostrarDatos: () => void };

export function OrdenWorkspace({ sidebar, children, ref }: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  ref?: React.Ref<OrdenWorkspaceHandle>;
}) {
  const compact = React.useSyncExternalStore(subscribeCompact,
    () => window.matchMedia(compactQuery).matches, () => false);
  const [desktopOpen, setDesktopOpen] = React.useState(true);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const id = React.useId();
  const open = compact ? drawerOpen : desktopOpen;
  React.useImperativeHandle(ref, () => ({
    mostrarDatos: () => { if (compact) setDrawerOpen(true); else setDesktopOpen(true); },
  }), [compact]);

  return (
    <DatosContext.Provider value={{ compact, open, id, toggle: () => setDesktopOpen((value) => !value) }}>
      <Sheet open={compact && drawerOpen} onOpenChange={setDrawerOpen}>
        <div className={s.workspace} data-sidebar={!compact && desktopOpen}>
          {compact ? (
            <SheetContent side="left" className={cn("ot-v1", s.drawer)} keepMounted>
              <SheetHeader><SheetTitle>Datos de la orden</SheetTitle></SheetHeader>
              <div id={id} className={s.sidebarBody}>{sidebar}</div>
            </SheetContent>
          ) : (
            <aside id={id} aria-label="Datos de la orden" className={s.sidebar} hidden={!desktopOpen}>
              <div className={s.sidebarBody}>{sidebar}</div>
            </aside>
          )}
          <div className={s.content}>{children}</div>
        </div>
      </Sheet>
    </DatosContext.Provider>
  );
}

export function OrdenDatosToggle() {
  const data = React.useContext(DatosContext);
  if (!data) return null;
  const label = data.open ? "Ocultar datos de la orden" : "Mostrar datos de la orden";
  const content = <>{data.open ? <PanelLeftCloseIcon data-icon="inline-start" /> : <PanelLeftOpenIcon data-icon="inline-start" />}<span>Datos</span></>;
  if (data.compact) return (
    <SheetTrigger render={<Button variant="outline" size="sm" className={cn(theme.theme, s.toggle)} />} aria-label={label}>
      {content}
    </SheetTrigger>
  );
  return (
    <Button variant="outline" size="sm" className={cn(theme.theme, s.toggle)} onClick={data.toggle}
      aria-expanded={data.open} aria-controls={data.id} aria-label={label} title={label}>
      {content}
    </Button>
  );
}

/** Etiqueta común a todos los datos laterales de la orden. */
export function OrdenCampoLabel({ id, icon, children }: {
  id?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return <div id={id} className={s.fieldLabel}><span aria-hidden="true">{icon}</span><span>{children}</span></div>;
}
