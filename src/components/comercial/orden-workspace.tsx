"use client";

import * as React from "react";
import { Tabs } from "@heroui/react";
import { cn } from "@/lib/utils";
import s from "./orden-workspace.module.css";

export type OrdenWorkspaceHandle = { mostrarDatos: () => void };

/** Composición visual. El controlador conserva selección, datos y permisos. */
export function OrdenWorkspace({
  header,
  sidebar,
  navigation,
  summary,
  activeSection,
  onShowData,
  children,
  ref,
}: {
  header: React.ReactNode;
  sidebar: React.ReactNode;
  navigation: React.ReactNode;
  summary: React.ReactNode;
  activeSection: string;
  onShowData: () => void;
  children: React.ReactNode;
  ref?: React.Ref<OrdenWorkspaceHandle>;
}) {
  const headerRef = React.useRef<HTMLElement>(null);
  const [headerHeight, setHeaderHeight] = React.useState(0);
  React.useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const observer = new ResizeObserver(() => {
      setHeaderHeight(header.getBoundingClientRect().height);
    });
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  React.useImperativeHandle(ref, () => ({ mostrarDatos: onShowData }), [
    onShowData,
  ]);
  return (
    <>
      <header ref={headerRef} className={s.header}>
        {header}
      </header>
      {navigation}
      <div
        className={s.workspace}
        style={
          {
            "--order-header-height": `${headerHeight}px`,
          } as React.CSSProperties
        }
      >
        <Tabs.Panel
          key={activeSection}
          id={activeSection}
          className={s.content}
        >
          {activeSection === "datos" ? (
            <section className={s.dataCard} aria-label="Datos de la orden">
              <div>
                <h2>Datos de la orden</h2>
                <p className={s.description}>
                  Cliente, origen y fecha de entrega.
                </p>
              </div>
              <div className={s.sidebarBody}>{sidebar}</div>
            </section>
          ) : (
            children
          )}
        </Tabs.Panel>
        <aside className={s.summary} aria-label="Resumen de la orden">
          {summary}
        </aside>
      </div>
    </>
  );
}

export function OrdenCampoLabel({
  id,
  icon,
  children,
}: {
  id?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      className={cn(
        "flex items-center gap-2 text-xs font-medium text-muted-foreground",
        s.fieldLabel,
      )}
    >
      <span aria-hidden="true">{icon}</span>
      <span>{children}</span>
    </div>
  );
}
