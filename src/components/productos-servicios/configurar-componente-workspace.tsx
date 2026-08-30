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
      regla: {
        campoPadre: "cantidad",
        operador: "MULTIPLICAR",
        valor: cantidadLegacy || 1,
      },
    },
  ];
  if (
    formulario.medidas.instruccion !== "no_preguntar" ||
    formulario.medidas.default
  ) {
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

type CampoPadre = { clave: string; etiqueta: string; numerico: boolean };

function normalizarCampoPadre(clave: string): string {
  return clave
    .replace(/^padre\./, "")
    .replace(/^medidas\.ancho$/, "medidaCustomMm.anchoMm")
    .replace(/^medidas\.alto$/, "medidaCustomMm.altoMm");
}

function camposDelPadre(
  formulario: FormularioCotizacionProducto,
): CampoPadre[] {
  const campos: CampoPadre[] = [
    {
      clave: "cantidad",
      etiqueta: "Cantidad del producto padre",
      numerico: true,
    },
  ];
  if (
    formulario.medidas.instruccion !== "no_preguntar" ||
    formulario.medidas.default
  ) {
    campos.push(
      {
        clave: "medidaCustomMm.anchoMm",
        etiqueta: "Ancho del producto padre",
        numerico: true,
      },
      {
        clave: "medidaCustomMm.altoMm",
        etiqueta: "Alto del producto padre",
        numerico: true,
      },
    );
  }
  for (const pregunta of formulario.preguntas) {
    const tipo = String(
      pregunta.tipoDato ?? pregunta.tipo ?? "text",
    ).toLowerCase();
    campos.push({
      clave: pregunta.jobContextKey,
      etiqueta: String(
        pregunta.etiqueta ??
          pregunta.slotNombre ??
          pregunta.paso ??
          pregunta.jobContextKey,
      ),
      numerico: [
        "number",
        "numero",
        "entero",
        "decimal",
        "tiempo_manual",
      ].includes(tipo),
    });
  }
  return campos.filter(
    (campo, index, list) =>
      list.findIndex((candidate) => candidate.clave === campo.clave) === index,
  );
}

function reglaLegacy(
  binding: BindingParametroComponente,
): BindingParametroComponente["regla"] {
  if (binding.regla) return binding.regla;
  if (binding.origen === "PADRE" && binding.padreClave) {
    return {
      campoPadre: normalizarCampoPadre(binding.padreClave),
      operador: "COPIAR",
      valor: null,
    };
  }
  const match = binding.expresion
    ?.trim()
    .match(/^padre\.([A-Za-z0-9_.]+)(?:\s*([+\-*/])\s*(\d+(?:\.\d+)?))?$/);
  if (!match) return null;
  const operadores = {
    "+": "SUMAR",
    "-": "RESTAR",
    "*": "MULTIPLICAR",
    "/": "DIVIDIR",
  } as const;
  return {
    campoPadre: normalizarCampoPadre(match[1]),
    operador: match[2]
      ? operadores[match[2] as keyof typeof operadores]
      : "COPIAR",
    valor: match[3] ? Number(match[3]) : null,
  };
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
  productoPadreId,
  productoPadreNombre,
  onCancel,
  onSave,
}: {
  componente: ProductoRecetaComponenteInput;
  productoPadreId: string;
  productoPadreNombre: string;
  onCancel: () => void;
  onSave: (
    configuracion: ConfiguracionComponenteFabricado,
    unidadComercial: string,
  ) => void;
}) {
  const [formulario, setFormulario] =
    React.useState<FormularioCotizacionProducto | null>(null);
  const [camposPadre, setCamposPadre] = React.useState<CampoPadre[]>([]);
  const [bindings, setBindings] = React.useState<BindingParametroComponente[]>(
    componente.configuracionJson?.bindings ?? [],
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      getFormularioCotizacionProducto(componente.productoComponenteId),
      getFormularioCotizacionProducto(productoPadreId),
    ])
      .then(([result, formularioPadre]) => {
        if (!active) return;
        setFormulario(result);
        setCamposPadre(camposDelPadre(formularioPadre));
        const base = parametrosDelFormulario(result, componente.cantidad);
        setBindings((actuales) => {
          const existentes = new Map(
            actuales.map((item) => [item.clave, item]),
          );
          return base.map((item) => {
            const merged = { ...item, ...existentes.get(item.clave) };
            return { ...merged, regla: reglaLegacy(merged) };
          });
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
  }, [componente.cantidad, componente.productoComponenteId, productoPadreId]);

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
                      onChange={(event) => {
                        const origen = event.target
                          .value as BindingParametroComponente["origen"];
                        const candidatos =
                          origen === "FORMULA"
                            ? camposPadre.filter((campo) => campo.numerico)
                            : camposPadre;
                        const campoPadre =
                          binding.regla?.campoPadre ??
                          candidatos[0]?.clave ??
                          "";
                        cambiar(index, {
                          origen,
                          regla:
                            origen === "PADRE" || origen === "FORMULA"
                              ? {
                                  campoPadre,
                                  operador:
                                    origen === "PADRE"
                                      ? "COPIAR"
                                      : binding.regla?.operador === "COPIAR"
                                        ? "MULTIPLICAR"
                                        : (binding.regla?.operador ??
                                          "MULTIPLICAR"),
                                  valor:
                                    origen === "FORMULA"
                                      ? (binding.regla?.valor ?? 1)
                                      : null,
                                }
                              : binding.regla,
                        });
                      }}
                    >
                      {ORIGENES.map((origen) => (
                        <option key={origen.value} value={origen.value}>
                          {origen.label}
                        </option>
                      ))}
                    </select>
                    <div className={styles.valueField}>
                      {binding.origen === "PADRE" ? (
                        <select
                          value={
                            binding.regla?.campoPadre ??
                            binding.padreClave ??
                            ""
                          }
                          onChange={(event) =>
                            cambiar(index, {
                              padreClave: event.target.value,
                              regla: {
                                campoPadre: event.target.value,
                                operador: "COPIAR",
                                valor: null,
                              },
                            })
                          }
                        >
                          <option value="">Elegir dato del padre…</option>
                          {camposPadre.map((campo) => (
                            <option value={campo.clave} key={campo.clave}>
                              {campo.etiqueta}
                            </option>
                          ))}
                        </select>
                      ) : binding.origen === "FORMULA" ? (
                        <div className={styles.ruleEditor}>
                          <select
                            aria-label={`Dato del padre para ${binding.etiqueta}`}
                            value={binding.regla?.campoPadre ?? ""}
                            onChange={(event) =>
                              cambiar(index, {
                                regla: {
                                  campoPadre: event.target.value,
                                  operador:
                                    binding.regla?.operador ?? "MULTIPLICAR",
                                  valor: binding.regla?.valor ?? 1,
                                },
                              })
                            }
                          >
                            <option value="">Elegir dato…</option>
                            {camposPadre
                              .filter((campo) => campo.numerico)
                              .map((campo) => (
                                <option value={campo.clave} key={campo.clave}>
                                  {campo.etiqueta}
                                </option>
                              ))}
                          </select>
                          <select
                            aria-label={`Operación para ${binding.etiqueta}`}
                            value={binding.regla?.operador ?? "MULTIPLICAR"}
                            onChange={(event) =>
                              cambiar(index, {
                                regla: {
                                  campoPadre:
                                    binding.regla?.campoPadre ?? "cantidad",
                                  operador: event.target.value as Exclude<
                                    NonNullable<
                                      BindingParametroComponente["regla"]
                                    >["operador"],
                                    "COPIAR"
                                  >,
                                  valor: binding.regla?.valor ?? 1,
                                },
                              })
                            }
                          >
                            <option value="MULTIPLICAR">Multiplicar por</option>
                            <option value="RESTAR">Restar</option>
                            <option value="SUMAR">Sumar</option>
                            <option value="DIVIDIR">Dividir por</option>
                          </select>
                          <input
                            aria-label={`Valor de cálculo para ${binding.etiqueta}`}
                            type="number"
                            step="any"
                            value={binding.regla?.valor ?? 1}
                            onChange={(event) =>
                              cambiar(index, {
                                regla: {
                                  campoPadre:
                                    binding.regla?.campoPadre ?? "cantidad",
                                  operador:
                                    binding.regla?.operador ?? "MULTIPLICAR",
                                  valor: Number(event.target.value),
                                },
                              })
                            }
                          />
                        </div>
                      ) : binding.origen === "COTIZACION" ? (
                        <span>Se solicitará en el sheet comercial</span>
                      ) : binding.opciones?.length ? (
                        <select
                          value={String(binding.valor ?? "")}
                          onChange={(event) =>
                            cambiar(index, { valor: event.target.value })
                          }
                        >
                          <option value="">Elegir opción…</option>
                          {binding.opciones.map((opcion) => (
                            <option value={opcion.valor} key={opcion.valor}>
                              {opcion.etiqueta}
                            </option>
                          ))}
                        </select>
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
                Las reglas sólo permiten usar datos publicados por el producto
                padre. Las medidas y los ajustes se expresan en milímetros.
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
