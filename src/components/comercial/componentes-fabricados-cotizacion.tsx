"use client";

import * as React from "react";
import { BoxesIcon, ChevronDownIcon } from "lucide-react";
import {
  getRecetasProducto,
  type BindingParametroComponente,
  type ProductoReceta,
} from "@/lib/productos-servicios-api";
import styles from "./componentes-fabricados-cotizacion.module.css";

function leerRuta(root: Record<string, unknown>, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (value, key) =>
        value && typeof value === "object" && !Array.isArray(value)
          ? (value as Record<string, unknown>)[key]
          : undefined,
      root,
    );
}

function escribirRuta(
  root: Record<string, unknown>,
  path: string,
  value: unknown,
) {
  const clone = structuredClone(root);
  const parts = path.split(".");
  let cursor = clone;
  parts.forEach((part, index) => {
    if (index === parts.length - 1) cursor[part] = value;
    else {
      const next = cursor[part];
      cursor[part] =
        next && typeof next === "object" && !Array.isArray(next) ? next : {};
      cursor = cursor[part] as Record<string, unknown>;
    }
  });
  return clone;
}

export function ComponentesFabricadosCotizacion({
  productoId,
  rutaAlternativaId,
  values,
  onChange,
}: {
  productoId: string;
  rutaAlternativaId: string;
  values: Record<string, Record<string, unknown>>;
  onChange: (values: Record<string, Record<string, unknown>>) => void;
}) {
  const [recetas, setRecetas] = React.useState<ProductoReceta[]>([]);
  React.useEffect(() => {
    let active = true;
    getRecetasProducto(productoId)
      .then((result) => active && setRecetas(result))
      .catch(() => active && setRecetas([]));
    return () => {
      active = false;
    };
  }, [productoId]);

  const revision = recetas.find(
    (receta) => receta.rutaAlternativa.id === rutaAlternativaId,
  )?.revisionPublicada;
  const componentes = (revision?.componentes ?? []).map((componente) => ({
    componente,
    solicitados: (componente.configuracionJson?.bindings ?? []).filter(
      (binding) => binding.origen === "COTIZACION",
    ),
  }));
  if (!componentes.length) return null;

  return (
    <section className={styles.section}>
      <header>
        <BoxesIcon />
        <div>
          <strong>Componentes fabricados</strong>
          <span>
            El sistema combina valores fijos, heredados y los datos que debas
            completar ahora.
          </span>
        </div>
      </header>
      <div className={styles.cards}>
        {componentes.map(({ componente, solicitados }) => (
          <details
            className={styles.card}
            key={componente.id}
            open={solicitados.length > 0}
          >
            <summary>
              <div>
                <strong>{componente.nombre}</strong>
                <span>
                  {solicitados.length
                    ? `${solicitados.length} dato${solicitados.length === 1 ? "" : "s"} para completar`
                    : "Configuración resuelta automáticamente"}
                </span>
              </div>
              <ChevronDownIcon />
            </summary>
            {solicitados.length ? (
              <div className={styles.fields}>
                {solicitados.map((binding: BindingParametroComponente) => {
                  const current = values[componente.codigo] ?? {};
                  return (
                    <label key={binding.clave}>
                      <span>
                        {binding.etiqueta}
                        {binding.unidad ? ` (${binding.unidad})` : ""}
                      </span>
                      {binding.opciones?.length ? (
                        <select
                          value={String(
                            leerRuta(current, binding.clave) ??
                              binding.valor ??
                              "",
                          )}
                          onChange={(event) =>
                            onChange({
                              ...values,
                              [componente.codigo]: escribirRuta(
                                current,
                                binding.clave,
                                event.target.value,
                              ),
                            })
                          }
                          required={binding.requerido !== false}
                        >
                          <option value="">Elegir…</option>
                          {binding.opciones.map((opcion) => (
                            <option value={opcion.valor} key={opcion.valor}>
                              {opcion.etiqueta}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={
                            binding.tipoDato === "number" ? "number" : "text"
                          }
                          min={
                            binding.tipoDato === "number" ? 0.000001 : undefined
                          }
                          value={String(
                            leerRuta(current, binding.clave) ??
                              binding.valor ??
                              "",
                          )}
                          onChange={(event) => {
                            const raw = event.target.value;
                            const value =
                              binding.tipoDato === "number" && raw !== ""
                                ? Number(raw)
                                : raw;
                            onChange({
                              ...values,
                              [componente.codigo]: escribirRuta(
                                current,
                                binding.clave,
                                value,
                              ),
                            });
                          }}
                          required={binding.requerido !== false}
                        />
                      )}
                    </label>
                  );
                })}
              </div>
            ) : null}
          </details>
        ))}
      </div>
    </section>
  );
}
