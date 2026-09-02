"use client";

import * as React from "react";
import { BoxesIcon, ChevronDownIcon } from "lucide-react";
import {
  construirEspecificacionesComponentes,
  type ComponenteEspecificacionesView,
} from "@/lib/especificaciones-componentes";
import styles from "./componentes-especificaciones.module.css";

function ColorModeValue({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const channels = [
    ["c", "C"],
    ["m", "M"],
    ["y", "Y"],
    ["k", "K"],
    ...(normalized.includes("blanco") || normalized.includes("white")
      ? ([["w", "W"]] as string[][])
      : []),
  ];
  return (
    <span className={styles.colorValue}>
      {normalized.includes("cmyk") ? (
        <span className={styles.colorDots} aria-hidden="true">
          {channels.map(([key, label]) => (
            <span className={styles[`color${key.toUpperCase()}`]} key={key}>
              {label}
            </span>
          ))}
        </span>
      ) : null}
      <span>{value}</span>
    </span>
  );
}

function ComponentCard({
  component,
  depth,
}: {
  component: ComponenteEspecificacionesView;
  depth: number;
}) {
  const [open, setOpen] = React.useState(depth === 0);
  return (
    <details
      className={styles.card}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span className={styles.componentIndex}>{depth ? "SUB" : "COMP"}</span>
        <span className={styles.identity}>
          <strong>{component.nombre}</strong>
          <small>{component.resumen || "Configuración efectiva"}</small>
        </span>
        <ChevronDownIcon aria-hidden="true" />
      </summary>
      <div className={styles.body}>
        {component.filas.length > 0 ? (
          <div className={styles.specGrid}>
            {component.filas.map((row) => (
              <div className={styles.spec} key={row.key}>
                <span>{row.label}</span>
                <strong>
                  {row.colorMode ? (
                    <ColorModeValue value={row.value} />
                  ) : (
                    row.value
                  )}
                </strong>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.empty}>
            Sin parámetros visibles en esta versión.
          </p>
        )}
        {component.hijos.length > 0 ? (
          <div className={styles.children}>
            <span className={styles.childrenLabel}>Subcomponentes</span>
            {component.hijos.map((child) => (
              <ComponentCard
                component={child}
                depth={depth + 1}
                key={child.key}
              />
            ))}
          </div>
        ) : null}
      </div>
    </details>
  );
}

export function ComponentesEspecificaciones({
  componentes,
}: {
  componentes: unknown;
}) {
  const tree = construirEspecificacionesComponentes(componentes);
  if (tree.length === 0) return null;

  return (
    <section
      className={styles.section}
      aria-label="Especificaciones de componentes"
    >
      <header>
        <span className={styles.icon}>
          <BoxesIcon aria-hidden="true" />
        </span>
        <span>
          <strong>Componentes del producto</strong>
          <small>
            Valores efectivos utilizados para cotizar y fabricar esta
            configuración.
          </small>
        </span>
        <span className={styles.count}>{tree.length}</span>
      </header>
      <div className={styles.tree}>
        {tree.map((component) => (
          <ComponentCard component={component} depth={0} key={component.key} />
        ))}
      </div>
    </section>
  );
}
