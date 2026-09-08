import type { ProcesamientoCorteCosteado } from "@/lib/procesamiento-corte";
import { NOMBRES_OPERACION_CORTE } from "@/lib/procesamiento-corte";
import s from "./desglose-operaciones-corte.module.css";
const numero = (n: number) =>
  n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
export function DesgloseOperacionesCorte({
  valor,
}: {
  valor?: ProcesamientoCorteCosteado;
}) {
  if (!valor) return null;
  return (
    <section
      className={s.section}
      aria-label="Recorridos y herramientas cotizados"
    >
      <div className={s.header}>
        <strong>Recorridos y herramientas</strong>
        <span>
          {valor.placas} placas · {numero(valor.espesorMm)} mm
        </span>
      </div>
      <p>
        {valor.participacion
          ? `Desglose de la tanda compartida. Este componente recibe ${numero(valor.participacion.porcentaje)} % del tiempo y desgaste, según su participación en el lote.`
          : "Parámetros conservados al cotizar."}
      </p>
      <div className={s.scroll}>
        <table>
          <thead>
            <tr>
              <th>Operación y perfil</th>
              <th>Herramienta</th>
              <th>Recorrido</th>
              <th>Pasadas</th>
              <th>Tiempo de recorrido</th>
            </tr>
          </thead>
          <tbody>
            {valor.operaciones.map((op) => (
              <tr key={op.operacion}>
                <td>
                  <strong>{NOMBRES_OPERACION_CORTE[op.operacion]}</strong>
                  <small>{op.perfilNombre}</small>
                </td>
                <td>{op.herramienta.nombre}</td>
                <td>
                  {numero(op.metros - op.ahorroRecorridoM)} m
                  {op.ahorroRecorridoM > 0 && (
                    <small>{numero(op.ahorroRecorridoM)} m compartidos</small>
                  )}
                </td>
                <td>{op.parametros.pasadas}</td>
                <td>{numero(op.recorridoMin)} min</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={s.footer}>
        <span>
          Carga y registro: <b>{numero(valor.manejoMin)} min</b>
        </span>
        <span>
          Cambios:{" "}
          <b>
            {valor.cambiosHerramienta} · {numero(valor.cambiosMin)} min
          </b>
        </span>
        <span>
          Ajustes: <b>{numero(valor.ajustesMin)} min</b>
        </span>
      </div>
      <p>
        La preparación y limpieza se suman una vez en el tiempo del nodo. El
        desgaste específico está incluido en el desglose de materiales.
      </p>
    </section>
  );
}
