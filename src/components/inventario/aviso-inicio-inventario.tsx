import { PackageOpen } from "lucide-react";
import styles from "./aviso-inicio-inventario.module.css";

export function AvisoInicioInventario() {
  return (
    <section className={styles.aviso} role="status" aria-label="Modo de inicio">
      <span className={styles.icono}>
        <PackageOpen aria-hidden="true" />
      </span>
      <div>
        <span className={styles.etiqueta}>
          INVENTARIO · CONFIGURACIÓN INICIAL
        </span>
        <h3>Trabajá mientras cargás tu stock</h3>
        <p>
          Podés cotizar, emitir y producir. Los materiales mantienen su costo,
          pero estas órdenes no reservan ni descuentan existencias.
        </p>
        <small>
          Verificá la disponibilidad con tu equipo. Cuando termines la carga,
          desactivá el modo de inicio desde Inventario → Stock.
        </small>
      </div>
      <span className={styles.estado}>Modo de inicio activo</span>
    </section>
  );
}
