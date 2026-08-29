"use client";

import Link from "next/link";
import {
  ArrowUpRightIcon,
  ChartNoAxesCombinedIcon,
  CircleIcon,
} from "lucide-react";

import { usePuedeFn } from "@/components/navigation/permisos-provider";
import {
  CATEGORIAS_REPORTES,
  type ReporteCategoria,
  reportesVisibles,
} from "@/lib/reportes-config";

import styles from "./reportes-catalogo.module.css";

const DESCRIPCIONES: Record<ReporteCategoria, string> = {
  Ejecutivo: "La lectura general del negocio.",
  Comercial: "Qué vendemos, a quién y cuánto convierte.",
  Operaciones: "Cómo está funcionando el taller y su equipo.",
  Finanzas: "Rentabilidad, caja y cobranza.",
  Producto: "Qué productos, materiales y medidas explican la venta.",
};

export function ReportesCatalogo() {
  const puede = usePuedeFn();
  const visibles = reportesVisibles(puede);

  return (
    <div className={styles.catalogo}>
      <div className={styles.intro}>
        <div className={styles.introIcon} aria-hidden="true">
          <ChartNoAxesCombinedIcon />
        </div>
        <div>
          <span className={styles.kicker}>Centro de análisis</span>
          <p>
            Una lectura ordenada de tu negocio, desde las ventas hasta la
            operación diaria.
          </p>
        </div>
        <div className={styles.introMeta}>
          <strong>{visibles.length}</strong>
          <span>vistas disponibles</span>
        </div>
      </div>

      <div className={styles.categorias}>
        {CATEGORIAS_REPORTES.map((categoria, indice) => {
          const reportes = visibles.filter(
            (reporte) => reporte.categoria === categoria,
          );
          if (reportes.length === 0) return null;

          const destacada = categoria === "Ejecutivo";
          const compacta = reportes.length === 1 && !destacada;

          return (
            <section
              key={categoria}
              aria-labelledby={`reportes-${categoria}`}
              className={`${styles.categoria} ${
                compacta ? styles.categoriaCompacta : ""
              } ${destacada ? styles.categoriaDestacada : ""}`}
            >
              <header className={styles.categoriaHeader}>
                <span className={styles.indice} aria-hidden="true">
                  {String(indice + 1).padStart(2, "0")}
                </span>
                <div>
                  <h2 id={`reportes-${categoria}`}>{categoria}</h2>
                  <p>{DESCRIPCIONES[categoria]}</p>
                </div>
              </header>

              <div className={styles.grilla}>
                {reportes.map((reporte) => (
                  <Link
                    key={reporte.href}
                    href={reporte.href}
                    className={`${styles.reporte} ${
                      destacada ? styles.reporteDestacado : ""
                    }`}
                  >
                    <span className={styles.icono} aria-hidden="true">
                      <reporte.Icon />
                    </span>
                    <span className={styles.flecha} aria-hidden="true">
                      <ArrowUpRightIcon />
                    </span>

                    <span className={styles.contenido}>
                      {destacada ? (
                        <span className={styles.recomendado}>
                          <CircleIcon aria-hidden="true" /> Vista general
                        </span>
                      ) : null}
                      <strong>{reporte.label}</strong>
                      <span>{reporte.descripcion}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
