import type { ReactNode } from "react";
import s from "./orden-workspace.module.css";

/** Composición de Datos compartida por la ficha y su muestra de diseño. */
export function OrdenDatosSections({
  tipo,
  vendedor,
  cliente,
  campana,
  canalVenta,
  entrega,
}: {
  tipo: ReactNode;
  vendedor: ReactNode;
  cliente: ReactNode;
  campana: ReactNode;
  canalVenta: ReactNode;
  entrega: ReactNode;
}) {
  return (
    <>
      <section className={s.dataSection} aria-label="Datos comerciales">
        <div className={s.dataIdentity}>
          <div>{tipo}</div>
          {vendedor}
        </div>
        <div className={s.fields}>
          {cliente}
          {campana}
        </div>
        {canalVenta}
      </section>
      <section className={s.deliverySection} aria-label="Entrega">
        <h3 className={s.sectionTitle}>Entrega</h3>
        <div className={s.deliveryFields}>{entrega}</div>
      </section>
    </>
  );
}
