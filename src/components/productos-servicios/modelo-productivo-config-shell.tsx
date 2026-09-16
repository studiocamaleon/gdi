"use client";

import * as React from "react";
import {
  ArrowLeftIcon,
  ArrowUpRightIcon,
  BlocksIcon,
  BoxesIcon,
  GitCommitHorizontalIcon,
} from "lucide-react";
import { createPortal } from "react-dom";
import {
  useDesignScope,
  useDesignTheme,
  useLegacyDesignScope,
} from "@/components/design-system/appearance";
import { ActionButton } from "@/components/design-system/action-button";

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
  brand = false,
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
  brand?: boolean;
}) {
  const Icono = iconos[tipo];
  const legacyScope = useLegacyDesignScope();
  const designScope = useDesignScope();
  const designTheme = useDesignTheme();
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
      {...(brand ? designScope : legacyScope)}
      className={`${brand ? `${designTheme} ${styles.brandFooter}` : (legacyScope.className ?? "")} ${styles.footer} ${pinFooterToViewport ? styles.footerViewport : ""}`}
    >
      {footerNote ? <p>{footerNote}</p> : <span />}
      <div>
        {brand ? (
          <>
            <ActionButton variant="outline" onPress={onBack}>
              {cancelLabel}
            </ActionButton>
            <ActionButton isDisabled={primaryDisabled} onPress={onPrimary}>
              {primaryLabel}
              <ArrowUpRightIcon data-icon="inline-end" />
            </ActionButton>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </footer>
  ) : null;

  return (
    <div
      {...(brand ? designScope : {})}
      data-component-config={brand || undefined}
      className={`${brand ? `${designTheme} ${styles.brand}` : ""} ${embedded ? styles.embedded : styles.backdrop} ${embedded && pinFooterToViewport ? styles.embeddedViewport : ""}`}
      role={embedded ? "region" : "dialog"}
      aria-modal={embedded ? undefined : true}
      aria-label={`Configuración de ${titulo}`}
    >
      <section
        className={`${styles.workspace} ${embedded ? styles.workspaceEmbedded : ""} ${embedded && pinFooterToViewport ? styles.workspaceViewport : ""} ${wide ? styles.wide : ""}`}
        data-node-type={tipo.toLowerCase()}
      >
        <header className={styles.header}>
          {brand ? (
            <ActionButton
              variant="outline"
              isIconOnly
              onPress={onBack}
              aria-label={backLabel}
            >
              <ArrowLeftIcon />
            </ActionButton>
          ) : (
            <button type="button" onClick={onBack} aria-label={backLabel}>
              <ArrowLeftIcon />
            </button>
          )}
          <span className={styles.typeIcon} aria-hidden="true">
            <Icono />
          </span>
          <div className={styles.heading}>
            <span>{eyebrow}</span>
            <h2>
              {titulo}
              {brand ? <span className={styles.titleDot}>.</span> : null}
            </h2>
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
