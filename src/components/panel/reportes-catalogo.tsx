"use client";
import { useFuncionesPlan } from "@/components/navigation/capacidades-provider";
import { FuncionNoIncluida } from "@/components/navigation/funcion-no-incluida";
import { SinPermiso } from "@/components/navigation/sin-permiso";

import Link from "next/link";
import {
  ArrowUpRightIcon,
  CircleIcon,
  ChartNoAxesCombinedIcon,
  TargetIcon,
  FactoryIcon,
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
  const funciones = useFuncionesPlan();
  const visibles = reportesVisibles(puede, funciones);

  if (!visibles.length) {
    return reportesVisibles(() => true, funciones).length
      ? <SinPermiso modulo="los reportes disponibles" />
      : <FuncionNoIncluida />;
  }

  return (
    <div className={styles.catalogo}>
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
                    {destacada ? (
                      <div className={styles.focusAreas} aria-hidden="true">
                        <div>
                          <ChartNoAxesCombinedIcon />
                          <span>Ventas</span>
                        </div>
                        <div>
                          <TargetIcon />
                          <span>Rentabilidad</span>
                        </div>
                        <div>
                          <FactoryIcon />
                          <span>Operación</span>
                        </div>
                      </div>
                    ) : null}
                    <span className={styles.openLabel}>
                      {destacada ? "Explorar resumen" : "Abrir reporte"}
                      <ArrowUpRightIcon aria-hidden="true" />
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
