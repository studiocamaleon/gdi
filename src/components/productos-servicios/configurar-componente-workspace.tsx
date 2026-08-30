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
import {
  operacionUsaUnidad,
  unidadVisibleParametro,
  valorInternoAVisible,
  valorReglaInternoAVisible,
  valorReglaVisibleAInterno,
  valorVisibleAInterno,
} from "@/lib/componentes-configuracion-unidades";
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
        fuente: { tipo: "PADRE", campo: "cantidad" },
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

type CampoPadre = {
  clave: string;
  etiqueta: string;
  numerico: boolean;
  unidad: string | null;
  fuenteTipo: "PADRE" | "COMPONENTE";
  componenteCodigo?: string;
};

type ComponenteHermano = Pick<
  ProductoRecetaComponenteInput,
  "codigo" | "nombre" | "productoComponenteId"
>;

function idCampo(campo: CampoPadre): string {
  return campo.fuenteTipo === "COMPONENTE"
    ? `COMPONENTE:${campo.componenteCodigo}:${campo.clave}`
    : `PADRE:${campo.clave}`;
}

function idRegla(
  regla: BindingParametroComponente["regla"],
  padreClave?: string | null,
): string {
  const fuente = regla?.fuente;
  if (fuente?.tipo === "COMPONENTE" && fuente.componenteCodigo) {
    return `COMPONENTE:${fuente.componenteCodigo}:${fuente.campo}`;
  }
  return `PADRE:${fuente?.campo ?? regla?.campoPadre ?? padreClave ?? ""}`;
}

function fuenteDeCampo(campo: CampoPadre) {
  return {
    tipo: campo.fuenteTipo,
    campo: campo.clave,
    componenteCodigo:
      campo.fuenteTipo === "COMPONENTE"
        ? (campo.componenteCodigo ?? null)
        : null,
  } as const;
}

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
      unidad: formulario.cantidad.unidad,
      fuenteTipo: "PADRE",
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
        unidad: "cm",
        fuenteTipo: "PADRE",
      },
      {
        clave: "medidaCustomMm.altoMm",
        etiqueta: "Alto del producto padre",
        numerico: true,
        unidad: "cm",
        fuenteTipo: "PADRE",
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
      unidad: typeof pregunta.unidad === "string" ? pregunta.unidad : null,
      fuenteTipo: "PADRE",
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
      fuente: {
        tipo: "PADRE",
        campo: normalizarCampoPadre(binding.padreClave),
      },
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
    fuente: { tipo: "PADRE", campo: normalizarCampoPadre(match[1]) },
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

function valorBindingVisible(binding: BindingParametroComponente): string {
  const value = binding.valor;
  if (typeof value === "number") {
    return String(valorInternoAVisible(binding.clave, value));
  }
  return valorInput(value);
}

function parseValorBinding(
  value: string,
  binding: BindingParametroComponente,
): unknown {
  const parsed = parseValor(value, binding.tipoDato);
  return typeof parsed === "number"
    ? valorVisibleAInterno(binding.clave, parsed)
    : parsed;
}

export function ConfigurarComponenteWorkspace({
  componente,
  productoPadreId,
  productoPadreNombre,
  componentesHermanos,
  onCancel,
  onSave,
}: {
  componente: ProductoRecetaComponenteInput;
  productoPadreId: string;
  productoPadreNombre: string;
  componentesHermanos: ComponenteHermano[];
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
      Promise.all(
        componentesHermanos.map(async (hermano) =>
          getFormularioCotizacionProducto(hermano.productoComponenteId)
            .then((formulario) => ({ hermano, formulario }))
            .catch(() => null),
        ),
      ),
    ])
      .then(([result, formularioPadre, formulariosHermanos]) => {
        if (!active) return;
        setFormulario(result);
        const camposFuente = [
          ...camposDelPadre(formularioPadre),
          ...formulariosHermanos.flatMap((resultado) =>
            resultado
              ? resultado.formulario.outputsPublicos.map((output) => ({
                  clave: output.clave,
                  etiqueta: `${resultado.hermano.nombre} · ${output.etiqueta.replace(
                    `${output.pasoNombre} · `,
                    "",
                  )}`,
                  numerico: output.tipoDato === "number",
                  unidad: output.unidadVisible ?? output.unidad,
                  fuenteTipo: "COMPONENTE" as const,
                  componenteCodigo: resultado.hermano.codigo,
                }))
              : [],
          ),
        ];
        setCamposPadre(
          camposFuente.filter(
            (campo, index, list) =>
              list.findIndex(
                (candidate) => idCampo(candidate) === idCampo(campo),
              ) === index,
          ),
        );
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
  }, [
    componente.cantidad,
    componente.productoComponenteId,
    componentesHermanos,
    productoPadreId,
  ]);

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
                      {binding.requerido ? (
                        <small className={styles.requiredMark}>
                          <span aria-hidden="true" />
                          Requerido
                        </small>
                      ) : null}
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
                        const campoElegido =
                          candidatos.find(
                            (campo) =>
                              idCampo(campo) ===
                              idRegla(binding.regla, binding.padreClave),
                          ) ?? candidatos[0];
                        const campoPadre = campoElegido?.clave ?? "";
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
                                  fuente: campoElegido
                                    ? fuenteDeCampo(campoElegido)
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
                          value={idRegla(binding.regla, binding.padreClave)}
                          onChange={(event) => {
                            const campo = camposPadre.find(
                              (item) => idCampo(item) === event.target.value,
                            );
                            if (!campo) return;
                            cambiar(index, {
                              padreClave:
                                campo.fuenteTipo === "PADRE"
                                  ? campo.clave
                                  : null,
                              regla: {
                                campoPadre: campo.clave,
                                operador: "COPIAR",
                                valor: null,
                                fuente: fuenteDeCampo(campo),
                              },
                            });
                          }}
                        >
                          <option value="PADRE:">
                            Elegir dato disponible…
                          </option>
                          {camposPadre.map((campo) => (
                            <option value={idCampo(campo)} key={idCampo(campo)}>
                              {campo.etiqueta}
                            </option>
                          ))}
                        </select>
                      ) : binding.origen === "FORMULA" ? (
                        <div className={styles.ruleEditor}>
                          <select
                            aria-label={`Dato disponible para ${binding.etiqueta}`}
                            value={idRegla(binding.regla)}
                            onChange={(event) => {
                              const campo = camposPadre.find(
                                (item) => idCampo(item) === event.target.value,
                              );
                              if (!campo) return;
                              const operador =
                                binding.regla?.operador ?? "MULTIPLICAR";
                              cambiar(index, {
                                regla: {
                                  campoPadre: campo.clave,
                                  operador,
                                  valor: operacionUsaUnidad(operador)
                                    ? valorReglaVisibleAInterno(
                                        campo.clave,
                                        operador,
                                        1,
                                      )
                                    : 1,
                                  fuente: fuenteDeCampo(campo),
                                },
                              });
                            }}
                          >
                            <option value="PADRE:">Elegir dato…</option>
                            {camposPadre
                              .filter((campo) => campo.numerico)
                              .map((campo) => (
                                <option
                                  value={idCampo(campo)}
                                  key={idCampo(campo)}
                                >
                                  {campo.etiqueta}
                                </option>
                              ))}
                          </select>
                          <select
                            aria-label={`Operación para ${binding.etiqueta}`}
                            value={binding.regla?.operador ?? "MULTIPLICAR"}
                            onChange={(event) => {
                              const operador = event.target.value as Exclude<
                                NonNullable<
                                  BindingParametroComponente["regla"]
                                >["operador"],
                                "COPIAR"
                              >;
                              const campoPadre =
                                binding.regla?.campoPadre ?? "cantidad";
                              cambiar(index, {
                                regla: {
                                  campoPadre,
                                  operador,
                                  valor: operacionUsaUnidad(operador)
                                    ? valorReglaVisibleAInterno(
                                        campoPadre,
                                        operador,
                                        1,
                                      )
                                    : 1,
                                  fuente: binding.regla?.fuente ?? {
                                    tipo: "PADRE",
                                    campo: campoPadre,
                                  },
                                },
                              });
                            }}
                          >
                            <option value="MULTIPLICAR">Multiplicar por</option>
                            <option value="RESTAR">Restar</option>
                            <option value="SUMAR">Sumar</option>
                            <option value="DIVIDIR">Dividir por</option>
                          </select>
                          <label className={styles.numberWithUnit}>
                            <input
                              aria-label={`Valor de cálculo para ${binding.etiqueta}`}
                              type="number"
                              step="any"
                              value={valorReglaInternoAVisible(
                                binding.regla?.campoPadre ?? "cantidad",
                                binding.regla?.operador ?? "MULTIPLICAR",
                                binding.regla?.valor ?? 1,
                              )}
                              onChange={(event) => {
                                const campoPadre =
                                  binding.regla?.campoPadre ?? "cantidad";
                                const operador =
                                  binding.regla?.operador ?? "MULTIPLICAR";
                                cambiar(index, {
                                  regla: {
                                    campoPadre,
                                    operador,
                                    valor: valorReglaVisibleAInterno(
                                      campoPadre,
                                      operador,
                                      Number(event.target.value),
                                    ),
                                    fuente: binding.regla?.fuente ?? {
                                      tipo: "PADRE",
                                      campo: campoPadre,
                                    },
                                  },
                                });
                              }}
                            />
                            <span>
                              {operacionUsaUnidad(
                                binding.regla?.operador ?? "MULTIPLICAR",
                              )
                                ? (camposPadre.find(
                                    (campo) =>
                                      idCampo(campo) === idRegla(binding.regla),
                                  )?.unidad ?? "unidad")
                                : "factor"}
                            </span>
                          </label>
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
                        <label className={styles.numberWithUnit}>
                          <input
                            value={valorBindingVisible(binding)}
                            placeholder={
                              binding.origen === "DEFAULT_HIJO"
                                ? "Sin valor predeterminado"
                                : "Ingresar valor"
                            }
                            onChange={(event) =>
                              cambiar(index, {
                                valor: parseValorBinding(
                                  event.target.value,
                                  binding,
                                ),
                              })
                            }
                          />
                          {unidadVisibleParametro(
                            binding.clave,
                            binding.unidad,
                          ) ? (
                            <span>
                              {unidadVisibleParametro(
                                binding.clave,
                                binding.unidad,
                              )}
                            </span>
                          ) : null}
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className={styles.hint}>
                Las reglas sólo permiten usar datos publicados por el producto
                padre o por otros componentes de esta receta. Las medidas se
                ingresan en centímetros, igual que en el sheet comercial; el
                sistema realiza la conversión interna.
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
                {
                  version: componente.configuracionJson
                    ?.operacionesIncorporacion?.length
                    ? 2
                    : 1,
                  bindings,
                  operacionesIncorporacion:
                    componente.configuracionJson?.operacionesIncorporacion,
                },
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
