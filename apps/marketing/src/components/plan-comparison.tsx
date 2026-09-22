"use client";

import { Check, Minus, MoveHorizontal } from "lucide-react";
import { useState } from "react";
import type { PublicPlan } from "../lib/public-plans";
import { comparisonRows, hasDifferences } from "../lib/plan-comparison";
import styles from "./plan-comparison.module.css";

export function PlanComparison({ plans }: { plans: PublicPlan[] }) {
  const [differencesOnly, setDifferencesOnly] = useState(false);
  const [category, setCategory] = useState("");
  const rows = comparisonRows(plans);
  const categories = [...new Set(rows.map((row) => row.group))];
  const visible = rows.filter(
    (row) =>
      (!differencesOnly || hasDifferences(row)) &&
      (!category || row.group === category),
  );
  const groups = categories
    .map((name) => ({
      name,
      rows: visible.filter((row) => row.group === name),
    }))
    .filter((group) => group.rows.length);

  if (!rows.length) return null;

  return (
    <section
      className={styles.comparison}
      id="comparar-planes"
      aria-labelledby="comparison-title"
    >
      <div className={styles.heading}>
        <div>
          <span className="eyebrow">CADA FUNCIÓN, EN SU LUGAR</span>
          <h3 id="comparison-title">Compará los planes en detalle.</h3>
          <p>Encontrá el plan que acompaña tu forma de trabajar.</p>
        </div>
        <span className={styles.legend}>
          <Check size={15} aria-hidden="true" /> Incluido en el plan
        </span>
      </div>
      <div className={styles.toolbar}>
        <div
          className={styles.filters}
          role="group"
          aria-label="Funciones a comparar"
        >
          <button
            type="button"
            aria-pressed={!differencesOnly}
            onClick={() => setDifferencesOnly(false)}
          >
            Todas las funciones
          </button>
          <button
            type="button"
            aria-pressed={differencesOnly}
            onClick={() => setDifferencesOnly(true)}
          >
            Sólo diferencias
          </button>
        </div>
        <label className={styles.category}>
          <span>Categoría</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">Todas las categorías</option>
            {categories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={styles.summary}>
        <span role="status">{visible.length} características</span>
        <span className={styles.scrollHint}>
          <MoveHorizontal size={14} aria-hidden="true" /> Deslizá para comparar
        </span>
      </div>
      <div
        className={styles.scroll}
        role="region"
        aria-label="Tabla comparativa de planes"
        tabIndex={0}
      >
        <table className={styles.table}>
          <caption className={styles.srOnly}>
            Funciones y capacidades incluidas en cada plan de Grafo
          </caption>
          <thead>
            <tr>
              <th scope="col">Funciones y capacidades</th>
              {plans.map((plan) => (
                <th
                  scope="col"
                  key={plan.codigo}
                  className={plan.recomendado ? styles.featured : undefined}
                >
                  <span>{plan.nombre}</span>
                  {plan.recomendado && <small>Recomendado</small>}
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.name}>
              <tr className={styles.group}>
                <th scope="rowgroup" colSpan={plans.length + 1}>
                  <span>{group.name}</span>
                </th>
              </tr>
              {group.rows.map((row) => (
                <tr key={row.key}>
                  <th scope="row">{row.name}</th>
                  {row.values.map((value, index) => (
                    <td
                      key={plans[index].codigo}
                      className={
                        plans[index].recomendado ? styles.featured : undefined
                      }
                    >
                      {typeof value === "boolean" ? (
                        <span
                          className={value ? styles.included : styles.excluded}
                        >
                          {value ? (
                            <Check size={16} aria-hidden="true" />
                          ) : (
                            <Minus size={16} aria-hidden="true" />
                          )}
                          <span className={styles.srOnly}>
                            {value ? "Incluido" : "No incluido"}
                          </span>
                        </span>
                      ) : (
                        (value ?? (
                          <span className={styles.unknown}>Consultar</span>
                        ))
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
          {!visible.length && (
            <tbody>
              <tr>
                <td colSpan={plans.length + 1} className={styles.empty}>
                  No hay diferencias en esta categoría. Elegí otra o mostrá
                  todas las funciones.
                </td>
              </tr>
            </tbody>
          )}
        </table>
      </div>
    </section>
  );
}
