"use client";

import * as React from "react";
import { ContextMenu } from "@base-ui/react/context-menu";
import type { LucideIcon } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import styles from "./nodo-productivo-menu.module.css";

export type AccionNodoProductivo = {
  id: string;
  etiqueta: string;
  icono: LucideIcon;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
  separadorAntes?: boolean;
};

function Acciones({ acciones }: { acciones: AccionNodoProductivo[] }) {
  return (
    <>
      {acciones.map((accion) => {
        const Icono = accion.icono;
        return (
          <React.Fragment key={accion.id}>
            {accion.separadorAntes ? (
              <ContextMenu.Separator className={styles.separator} />
            ) : null}
            <ContextMenu.Item
              nativeButton
              render={<button type="button" />}
              className={styles.item}
              data-destructive={accion.destructive || undefined}
              disabled={accion.disabled}
              onClickCapture={accion.onSelect}
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              <Icono />
              {accion.etiqueta}
            </ContextMenu.Item>
          </React.Fragment>
        );
      })}
    </>
  );
}

function AccionesDropdown({ acciones }: { acciones: AccionNodoProductivo[] }) {
  return (
    <>
      {acciones.map((accion) => {
        const Icono = accion.icono;
        return (
          <React.Fragment key={accion.id}>
            {accion.separadorAntes ? (
              <DropdownMenuSeparator className={styles.separator} />
            ) : null}
            <DropdownMenuItem
              nativeButton
              render={<button type="button" />}
              className={styles.item}
              variant={accion.destructive ? "destructive" : "default"}
              disabled={accion.disabled}
              onClickCapture={accion.onSelect}
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              <Icono />
              {accion.etiqueta}
            </DropdownMenuItem>
          </React.Fragment>
        );
      })}
    </>
  );
}

export function NodoProductivoMenu({
  acciones,
  children,
  id,
  trigger,
}: {
  acciones: AccionNodoProductivo[];
  children: React.ReactNode;
  id: string;
  trigger: React.ReactNode;
}) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger className={styles.contextTrigger}>
        {children}
        <DropdownMenu>
          <DropdownMenuTrigger
            id={id}
            className={styles.moreTrigger}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            aria-label="Abrir acciones del nodo"
          >
            {trigger}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side="bottom"
            sideOffset={7}
            className={styles.popup}
          >
            <AccionesDropdown acciones={acciones} />
          </DropdownMenuContent>
        </DropdownMenu>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Positioner className={styles.positioner}>
          <ContextMenu.Popup className={styles.popup}>
            <Acciones acciones={acciones} />
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
