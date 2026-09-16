import Link from "next/link";
import { ArrowLeftIcon, BoxesIcon, WorkflowIcon } from "lucide-react";
import s from "./nodos-editor.module.css";

export function NodoConfiguracionHeader({
  nombre,
  volverHref = "/productos-servicios/pasos",
  compuesto = false,
  origen,
  estado,
  completo = false,
}: {
  nombre: string;
  volverHref?: string;
  compuesto?: boolean;
  origen?: "sistema" | "tenant";
  estado: string;
  completo?: boolean;
}) {
  const Icon = compuesto ? BoxesIcon : WorkflowIcon;
  return (
    <header className={s.header}>
      <div className={s.headerCopy}>
        <Link href={volverHref} className={s.backLink}>
          <ArrowLeftIcon aria-hidden /> Nodos de producción
        </Link>
        <span className={s.eyebrow}>
          {compuesto ? "Nodo compuesto" : "Nodo simple"}
          {origen
            ? ` · ${origen === "sistema" ? "Plantilla del sistema" : "Nodo propio"}`
            : ""}
        </span>
        <h1>
          {nombre}
          <span className={s.titleDot}>.</span>
        </h1>
        <p>
          {compuesto
            ? "Organizá las operaciones internas que se mostrarán como un único nodo en producción."
            : "Definí los valores predeterminados de materiales, recursos y tiempos para tu taller."}
        </p>
      </div>
      <div className={s.statusCard} data-complete={completo}>
        <span className={s.statusIcon}>
          <Icon aria-hidden />
        </span>
        <div>
          <span>Configuración predeterminada</span>
          <strong>{estado}</strong>
        </div>
      </div>
    </header>
  );
}
