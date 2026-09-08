"use client";

import * as React from "react";
import {
  ArrowLeftIcon,
  BlocksIcon,
  BoxesIcon,
  GitCommitHorizontalIcon,
} from "lucide-react";
import { createPortal } from "react-dom";

import styles from "./modelo-productivo-config-shell.module.css";

type TipoConfigurador = "PASO" | "COMPONENTE" | "ETAPA";

const iconos = {
  PASO: GitCommitHorizontalIcon,
  COMPONENTE: BoxesIcon,
  ETAPA: BlocksIcon,
};

const suscribirCliente = () => () => {};
const snapshotCliente = () => true;
const snapshotServidor = () => false;

export function ModeloProductivoConfigShell({
  tipo,
  eyebrow,
  titulo,
  descripcion,
  onBack,
  backLabel,
  headerAction,
  children,
  embedded = false,
  wide = false,
  pinFooterToViewport = false,
  contentClassName,
  footerNote,
  cancelLabel = "Cancelar",
  primaryLabel,
  primaryDisabled = false,
  onPrimary,
}: {
  tipo: TipoConfigurador;
  eyebrow: string;
  titulo: string;
  descripcion: React.ReactNode;
  onBack: () => void;
  backLabel: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  embedded?: boolean;
  wide?: boolean;
  pinFooterToViewport?: boolean;
  contentClassName?: string;
  footerNote?: React.ReactNode;
  cancelLabel?: string;
  primaryLabel?: string;
  primaryDisabled?: boolean;
  onPrimary?: () => void;
}) {
  const Icono = iconos[tipo];
  const footerVisible = Boolean(primaryLabel && onPrimary);
  const clienteMontado = React.useSyncExternalStore(
    suscribirCliente,
    snapshotCliente,
    snapshotServidor,
  );
  const footerHost =
    clienteMontado && embedded && pinFooterToViewport
      ? (document.querySelector<HTMLElement>("[data-slot='sidebar-inset']") ??
        document.body)
      : null;

  const footer = footerVisible ? (
    <footer
      className={`${styles.footer} ${pinFooterToViewport ? styles.footerViewport : ""}`}
    >
      {footerNote ? <p>{footerNote}</p> : <span />}
      <div>
        <button type="button" onClick={onBack}>
          {cancelLabel}
        </button>
        <button
          type="button"
          disabled={primaryDisabled}
          onClick={onPrimary}
        >
          {primaryLabel}
        </button>
      </div>
    </footer>
  ) : null;

  return (
    <div
      className={`${embedded ? styles.embedded : styles.backdrop} ${embedded && pinFooterToViewport ? styles.embeddedViewport : ""}`}
      role={embedded ? "region" : "dialog"}
      aria-modal={embedded ? undefined : true}
      aria-label={embedded ? `Configuración de ${titulo}` : undefined}
    >
      <section
        className={`${styles.workspace} ${embedded ? styles.workspaceEmbedded : ""} ${embedded && pinFooterToViewport ? styles.workspaceViewport : ""} ${wide ? styles.wide : ""}`}
        data-node-type={tipo.toLowerCase()}
      >
        <header className={styles.header}>
          <button type="button" onClick={onBack} aria-label={backLabel}>
            <ArrowLeftIcon />
          </button>
          <span className={styles.typeIcon} aria-hidden="true">
            <Icono />
          </span>
          <div className={styles.heading}>
            <span>{eyebrow}</span>
            <h2>{titulo}</h2>
            <p>{descripcion}</p>
          </div>
          {headerAction ? (
            <div className={styles.headerAction}>{headerAction}</div>
          ) : null}
        </header>

        <main
          className={`${styles.body} ${pinFooterToViewport ? styles.bodyViewport : ""} ${contentClassName ?? ""}`}
        >
          {children}
        </main>

        {footer && !(pinFooterToViewport && footerHost) ? footer : null}
      </section>
      {footer && pinFooterToViewport && footerHost
        ? createPortal(footer, footerHost)
        : null}
    </div>
  );
}
