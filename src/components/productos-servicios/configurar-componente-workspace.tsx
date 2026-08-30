"use client";

import * as React from "react";
import { ArrowLeftIcon, BoxesIcon, ExternalLinkIcon } from "lucide-react";
import {
  getFormularioCotizacionProducto,
  type BindingParametroComponente,
  type ConfiguracionComponenteFabricado,
  type FormularioCotizacionProducto,
  type ProductoRecetaComponenteInput,
} from "@/lib/productos-servicios-api";
import styles from "./configurar-componente-workspace.module.css";

const ORIGENES: Array<{
  value: BindingParametroComponente["origen"];
  label: string;
}> = [
  { value: "DEFAULT_HIJO", label: "Predeterminado del hijo" },
  { value: "FIJO", label: "Valor fijo" },
  { value: "PADRE", label: "Heredar del padre" },
  { value: "FORMULA", label: "Calcular desde el padre" },
  { value: "COTIZACION", label: "Definir al cotizar" },
];

function parametrosDelFormulario(
  formulario: FormularioCotizacionProducto,
  cantidadLegacy: number,
): BindingParametroComponente[] {
  const parametros: BindingParametroComponente[] = [
    {
      clave: "cantidad",
      etiqueta: `Cantidad (${formulario.cantidad.unidad})`,
      tipoDato: "number",
      unidad: formulario.cantidad.unidad,
      requerido: true,
      origen: "FORMULA",
      expresion: `padre.cantidad * ${cantidadLegacy || 1}`,
    },
  ];
  if (formulario.medidas.instruccion !== "no_preguntar") {
    parametros.push(
      {
        clave: "medidaCustomMm.anchoMm",
        etiqueta: "Ancho",
        tipoDato: "number",
        unidad: "mm",
        requerido: true,
        origen: formulario.medidas.default ? "DEFAULT_HIJO" : "COTIZACION",
        valor: formulario.medidas.default?.anchoMm,
      },
      {
        clave: "medidaCustomMm.altoMm",
        etiqueta: "Alto",
        tipoDato: "number",
        unidad: "mm",
        requerido: true,
        origen: formulario.medidas.default ? "DEFAULT_HIJO" : "COTIZACION",
        valor: formulario.medidas.default?.altoMm,
      },
    );
  }
  for (const pregunta of formulario.preguntas) {
    const opcionesCrudas = Array.isArray(pregunta.opciones)
      ? (pregunta.opciones as Array<Record<string, unknown>>)
      : [];
    parametros.push({
      clave: pregunta.jobContextKey,
      etiqueta: String(
        pregunta.etiqueta ??
          pregunta.slotNombre ??
          pregunta.paso ??
          pregunta.jobContextKey,
      ),
      tipoDato: String(pregunta.tipoDato ?? pregunta.tipo ?? "text"),
      unidad: typeof pregunta.unidad === "string" ? pregunta.unidad : null,
      requerido: pregunta.requerido === true,
      origen:
        pregunta.sugerido !== undefined || pregunta.default !== undefined
          ? "DEFAULT_HIJO"
          : pregunta.requerido === true
            ? "COTIZACION"
            : "DEFAULT_HIJO",
      valor: pregunta.sugerido ?? pregunta.default,
      opciones: opcionesCrudas.flatMap((opcion) => {
        const valor = opcion.varianteId ?? opcion.valor;
        return typeof valor === "string"
          ? [{ valor, etiqueta: String(opcion.etiqueta ?? valor) }]
          : [];
      }),
    });
  }
  return parametros;
}

function valorInput(value: unknown): string {
  if (value == null) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function parseValor(value: string, tipo: string): unknown {
  if (!value.trim()) return undefined;
  if (["number", "numero", "entero", "decimal"].includes(tipo.toLowerCase())) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

export function ConfigurarComponenteWorkspace({
  componente,
  productoPadreNombre,
  onCancel,
  onSave,
}: {
  componente: ProductoRecetaComponenteInput;
  productoPadreNombre: string;
  onCancel: () => void;
  onSave: (
    configuracion: ConfiguracionComponenteFabricado,
    unidadComercial: string,
  ) => void;
}) {
  const [formulario, setFormulario] =
    React.useState<FormularioCotizacionProducto | null>(null);
  const [bindings, setBindings] = React.useState<BindingParametroComponente[]>(
    componente.configuracionJson?.bindings ?? [],
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    getFormularioCotizacionProducto(componente.productoComponenteId)
      .then((result) => {
        if (!active) return;
        setFormulario(result);
        const base = parametrosDelFormulario(result, componente.cantidad);
        setBindings((actuales) => {
          const existentes = new Map(
            actuales.map((item) => [item.clave, item]),
          );
          return base.map((item) => ({
            ...item,
            ...existentes.get(item.clave),
          }));
        });
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "No se pudo abrir el configurador del producto hijo.",
          );
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [componente.cantidad, componente.productoComponenteId]);

  const cambiar = (index: number, patch: Partial<BindingParametroComponente>) =>
    setBindings((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true">
      <div className={styles.workspace}>
        <header className={styles.header}>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Volver a la receta"
          >
            <ArrowLeftIcon />
          </button>
          <div>
            <span>Producción · BOM · Configuración de uso</span>
            <h2>{componente.nombre}</h2>
            <p>
              Definí cómo {productoPadreNombre} completa cada parámetro de este
              producto hijo. Esto no modifica su receta global.
            </p>
          </div>
          <a
            href={`/productos-servicios/${componente.productoComponenteId}?tab=produccion`}
            target="_blank"
            rel="noreferrer"
          >
            Editar producto hijo <ExternalLinkIcon />
          </a>
        </header>

        <main className={styles.body}>
          {loading ? (
            <div className={styles.message}>Cargando parámetros…</div>
          ) : null}
          {error ? <div className={styles.error}>{error}</div> : null}
          {formulario ? (
            <>
              <div className={styles.contextCard}>
                <BoxesIcon />
                <div>
                  <strong>Contrato público del hijo</strong>
                  <span>
                    {bindings.length} parámetros · receta y ruta propias ·
                    valores congelados al cotizar
                  </span>
                </div>
              </div>
              <div className={styles.table}>
                <div className={styles.tableHead}>
                  <span>Parámetro del hijo</span>
                  <span>Origen</span>
                  <span>Configuración</span>
                </div>
                {bindings.map((binding, index) => (
                  <div className={styles.binding} key={binding.clave}>
                    <div>
                      <strong>{binding.etiqueta}</strong>
                      <small>
                        {binding.clave}
                        {binding.unidad ? ` · ${binding.unidad}` : ""}
                        {binding.requerido ? " · requerido" : ""}
                      </small>
                    </div>
                    <select
                      value={binding.origen}
                      onChange={(event) =>
                        cambiar(index, {
                          origen: event.target
                            .value as BindingParametroComponente["origen"],
                        })
                      }
                    >
                      {ORIGENES.map((origen) => (
                        <option key={origen.value} value={origen.value}>
                          {origen.label}
                        </option>
                      ))}
                    </select>
                    <div className={styles.valueField}>
                      {binding.origen === "PADRE" ? (
                        <input
                          value={binding.padreClave ?? ""}
                          placeholder="medidas.ancho"
                          onChange={(event) =>
                            cambiar(index, { padreClave: event.target.value })
                          }
                        />
                      ) : binding.origen === "FORMULA" ? (
                        <input
                          value={binding.expresion ?? ""}
                          placeholder="padre.medidas.ancho - 40"
                          onChange={(event) =>
                            cambiar(index, { expresion: event.target.value })
                          }
                        />
                      ) : binding.origen === "COTIZACION" ? (
                        <span>Se solicitará en el sheet comercial</span>
                      ) : (
                        <input
                          value={valorInput(binding.valor)}
                          placeholder={
                            binding.origen === "DEFAULT_HIJO"
                              ? "Sin valor predeterminado"
                              : "Ingresar valor"
                          }
                          onChange={(event) =>
                            cambiar(index, {
                              valor: parseValor(
                                event.target.value,
                                binding.tipoDato,
                              ),
                            })
                          }
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className={styles.hint}>
                Campos disponibles del padre: <code>padre.cantidad</code>,{" "}
                <code>padre.medidas.ancho</code> y{" "}
                <code>padre.medidas.alto</code>. Las medidas y fórmulas se
                expresan en milímetros.
              </p>
            </>
          ) : null}
        </main>

        <footer className={styles.footer}>
          <button type="button" onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={!formulario || loading}
            onClick={() =>
              formulario &&
              onSave(
                { version: 1, bindings },
                formulario.producto.unidadComercial,
              )
            }
          >
            Aplicar configuración
          </button>
        </footer>
      </div>
    </div>
  );
}
