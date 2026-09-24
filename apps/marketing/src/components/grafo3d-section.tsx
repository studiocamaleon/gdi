import { ArrowUpRight } from "lucide-react";
import { Grafo3DDemo } from "./grafo3d-demo";
import styles from "./grafo3d-section.module.css";

export function Grafo3DSection() {
  return (
    <section className={`${styles.section} section-shell`} id="grafo3d">
      <div className={styles.copy}>
        <span className="eyebrow dark-eyebrow">GRAFO3D · HERRAMIENTA GRATUITA</span>
        <h2>Tu próxima letra.<br /><span>En tres dimensiones.</span></h2>
        <p>Diseñá letras corpóreas, banderolas y encastres desde el navegador.
          Ajustá cada componente y llevá tu idea a fabricación.</p>
        <a className="button button-orange" href="/3d?ejemplo=grafoprint">
          Abrir Grafo3D gratis <ArrowUpRight size={18} />
        </a>
        <small>Sin registro · Sin instalación · Proyectos guardados en tu navegador</small>
      </div>
      <Grafo3DDemo />
    </section>
  );
}
