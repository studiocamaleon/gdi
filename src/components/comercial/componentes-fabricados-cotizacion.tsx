"use client";

import * as React from "react";
import { BoxesIcon, ChevronDownIcon, PlusIcon, Trash2Icon } from "lucide-react";
import {
  getRecetasProducto,
  normalizarFuenteVectorial,
  type BindingParametroComponente,
  type FormatoFuenteVectorial,
  type ProductoReceta,
} from "@/lib/productos-servicios-api";
import {
  unidadVisibleParametro,
  valorInternoAVisible,
  valorVisibleAInterno,
} from "@/lib/componentes-configuracion-unidades";
import {
  esMedidaPlanaDerivada,
  medidasDerivadasDeDisenoVectorial,
} from "@/lib/componentes-contrato-publico";
import {
  escalarGeometriaProporcional,
  obtenerRelacionAspectoSvg,
  type EjeEscalaVectorial,
} from "@/lib/producto-geometrias";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ControlArchivoVectorial } from "./geometrias-vectoriales-cotizacion";
import styles from "./componentes-fabricados-cotizacion.module.css";

const CLAVE_OCURRENCIAS_ADICIONALES = "__ocurrenciasAdicionales";

type OcurrenciaAdicional = {
  id: string;
  nombre: string;
  valores: Record<string, unknown>;
};

type FuenteVectorialComponente = {
  schemaVersion: 1;
  nombreArchivo: string;
  svg: string;
  anchoFinalMm: number;
  altoFinalMm?: number;
  relacionAltoAncho?: number;
  formatoOrigen?: FormatoFuenteVectorial;
  unidadOrigen?: string | null;
};

function esRegistro(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function leerOcurrencias(
  value: Record<string, unknown>,
): OcurrenciaAdicional[] {
  const raw = value[CLAVE_OCURRENCIAS_ADICIONALES];
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) =>
    esRegistro(item) &&
    typeof item.id === "string" &&
    typeof item.nombre === "string" &&
    esRegistro(item.valores)
      ? [
          {
            id: item.id,
            nombre: item.nombre,
            valores: item.valores,
          },
        ]
      : [],
  );
}

function guardarOcurrencias(
  value: Record<string, unknown>,
  adicionales: OcurrenciaAdicional[],
  repetible: boolean,
) {
  const next = { ...value };
  if (repetible) {
    next[CLAVE_OCURRENCIAS_ADICIONALES] = adicionales;
  } else {
    delete next[CLAVE_OCURRENCIAS_ADICIONALES];
  }
  return next;
}

function idNuevaOcurrencia() {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 20);
}

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

function longitudSvgMm(value: string | null): number | null {
  if (!value) return null;
  const match = value.trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*(mm|cm|in|px)?$/i);
  if (!match) return null;
  const numero = Number(match[1]);
  const unidad = (match[2] ?? "px").toLowerCase();
  if (!(numero > 0)) return null;
  if (unidad === "mm") return numero;
  if (unidad === "cm") return numero * 10;
  if (unidad === "in") return numero * 25.4;
  return (numero * 25.4) / 96;
}

function medidasInicialesSvg(svg: string, relacionAltoAncho?: number) {
  const documento = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = documento.documentElement;
  const proporcion =
    relacionAltoAncho && relacionAltoAncho > 0
      ? relacionAltoAncho
      : obtenerRelacionAspectoSvg(svg);
  const anchoDeclarado = longitudSvgMm(root.getAttribute("width"));
  const altoDeclarado = longitudSvgMm(root.getAttribute("height"));
  const anchoFinalMm =
    anchoDeclarado ??
    (altoDeclarado ? altoDeclarado / proporcion : null) ??
    1_000;
  return {
    anchoFinalMm,
    altoFinalMm: anchoFinalMm * proporcion,
  };
}

function esFuenteVectorial(value: unknown): value is FuenteVectorialComponente {
  return (
    esRegistro(value) &&
    value.schemaVersion === 1 &&
    typeof value.nombreArchivo === "string" &&
    typeof value.svg === "string" &&
    Number(value.anchoFinalMm) > 0
  );
}

function CampoVectorialOcurrencia({
  binding,
  current,
  idPrefix,
  onChange,
}: {
  binding: BindingParametroComponente;
  current: Record<string, unknown>;
  idPrefix: string;
  onChange: (value: Record<string, unknown>) => void;
}) {
  const [ejeEscala, setEjeEscala] = React.useState<EjeEscalaVectorial>("ancho");
  const [procesando, setProcesando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const raw = leerRuta(current, binding.clave);
  const fuente = esFuenteVectorial(raw) ? raw : null;
  const relacionAltoAncho =
    fuente?.relacionAltoAncho && fuente.relacionAltoAncho > 0
      ? fuente.relacionAltoAncho
      : obtenerRelacionAspectoSvg(fuente?.svg);
  const actualizar = (patch: Partial<FuenteVectorialComponente>) => {
    if (!fuente) return;
    onChange(escribirRuta(current, binding.clave, { ...fuente, ...patch }));
  };
  const actualizarEscala = (medidaCm: number) => {
    if (!fuente) return;
    actualizar(
      escalarGeometriaProporcional(relacionAltoAncho, ejeEscala, medidaCm * 10),
    );
  };
  const inputId = `${idPrefix}-${binding.clave.replaceAll(".", "-")}`;

  return (
    <div className={styles.vectorField}>
      <ControlArchivoVectorial
        etiqueta={binding.etiqueta}
        nombreArchivo={fuente?.nombreArchivo}
        formatoOrigen={fuente?.formatoOrigen}
        required={binding.requerido !== false && !fuente}
        procesando={procesando}
        disabled={procesando}
        onSelect={async (file) => {
          const contenido = await file.text();
          setProcesando(true);
          setError(null);
          try {
            const normalizada = await normalizarFuenteVectorial({
              contenido,
              nombreArchivo: file.name,
            });
            const medidas =
              normalizada.formatoOrigen === "SVG"
                ? medidasInicialesSvg(
                    normalizada.svg,
                    normalizada.relacionAltoAncho,
                  )
                : {
                    anchoFinalMm: normalizada.anchoSugeridoMm,
                    altoFinalMm: normalizada.altoSugeridoMm,
                  };
            onChange(
              escribirRuta(current, binding.clave, {
                schemaVersion: 1,
                nombreArchivo: file.name,
                svg: normalizada.svg,
                formatoOrigen: normalizada.formatoOrigen,
                unidadOrigen: normalizada.unidadDetectada,
                relacionAltoAncho: normalizada.relacionAltoAncho,
                ...medidas,
              } satisfies FuenteVectorialComponente),
            );
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : "No se pudo interpretar el archivo vectorial.",
            );
          } finally {
            setProcesando(false);
          }
        }}
      />
      {procesando ? (
        <small>Analizando contornos…</small>
      ) : error ? (
        <small className={styles.vectorError}>{error}</small>
      ) : null}
      {fuente ? (
        <div className={styles.vectorLoaded}>
          <div className={styles.vectorMeasures}>
            <div className={styles.axisSwitch}>
              <button
                type="button"
                data-active={ejeEscala === "ancho"}
                onClick={() => setEjeEscala("ancho")}
              >
                Ancho
              </button>
              <button
                type="button"
                data-active={ejeEscala === "alto"}
                onClick={() => setEjeEscala("alto")}
              >
                Alto
              </button>
            </div>
            <label className={styles.vectorMeasureField}>
              <span>{ejeEscala === "ancho" ? "Ancho" : "Alto"} final</span>
              <span className={styles.vectorInputGroup}>
                <input
                  className={styles.vectorMeasureInput}
                  id={`${inputId}-medida`}
                  type="number"
                  min="0.1"
                  step="any"
                  value={
                    (ejeEscala === "ancho"
                      ? fuente.anchoFinalMm
                      : (fuente.altoFinalMm ?? fuente.anchoFinalMm)) / 10
                  }
                  onChange={(event) =>
                    actualizarEscala(Number(event.target.value))
                  }
                />
                <span>cm</span>
              </span>
            </label>
            <div className={styles.resultMeasure}>
              <span>{ejeEscala === "ancho" ? "Alto" : "Ancho"}</span>
              <strong>
                {(
                  (ejeEscala === "ancho"
                    ? (fuente.altoFinalMm ?? fuente.anchoFinalMm)
                    : fuente.anchoFinalMm) / 10
                ).toLocaleString("es-AR", { maximumFractionDigits: 2 })}{" "}
                cm
              </strong>
              <small>Calculado proporcionalmente</small>
            </div>
          </div>
        </div>
      ) : (
        <small>Subí el SVG o DXF propio de esta ocurrencia.</small>
      )}
    </div>
  );
}

function CamposOcurrencia({
  bindings,
  current,
  idPrefix,
  onChange,
}: {
  bindings: BindingParametroComponente[];
  current: Record<string, unknown>;
  idPrefix: string;
  onChange: (value: Record<string, unknown>) => void;
}) {
  if (!bindings.length) {
    return (
      <p className={styles.resolvedMessage}>
        Esta ocurrencia se configura automáticamente desde la receta.
      </p>
    );
  }
  return (
    <FieldGroup className={styles.fields}>
      {bindings.map((binding) => {
        const currentValue = leerRuta(current, binding.clave) ?? binding.valor;
        const unidadVisible = unidadVisibleParametro(
          binding.clave,
          binding.unidad,
        );
        const fieldId = `${idPrefix}-${binding.clave.replaceAll(".", "-")}`;
        if (
          binding.tipoDato.toLowerCase() === "vectorial" ||
          binding.clave === "disenoVectorialFuente"
        ) {
          return (
            <CampoVectorialOcurrencia
              binding={binding}
              current={current}
              idPrefix={idPrefix}
              onChange={onChange}
              key={binding.clave}
            />
          );
        }
        if (binding.tipoDato.toLowerCase() === "boolean") {
          const checked = currentValue === true;
          return (
            <label className={styles.booleanField} key={binding.clave}>
              <span>
                <strong>{binding.etiqueta}</strong>
                <small>
                  {checked ? "Incluido en esta cotización" : "No incluido"}
                </small>
              </span>
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) =>
                  onChange(
                    escribirRuta(current, binding.clave, event.target.checked),
                  )
                }
              />
            </label>
          );
        }
        return (
          <Field className={styles.valueField} key={binding.clave}>
            <FieldLabel htmlFor={fieldId}>{binding.etiqueta}</FieldLabel>
            {binding.opciones?.length ? (
              <select
                id={fieldId}
                value={String(currentValue ?? "")}
                onChange={(event) =>
                  onChange(
                    escribirRuta(current, binding.clave, event.target.value),
                  )
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
              <InputGroup className={styles.inputGroup}>
                <InputGroupInput
                  id={fieldId}
                  type={binding.tipoDato === "number" ? "number" : "text"}
                  min={binding.tipoDato === "number" ? 0.000001 : undefined}
                  step={binding.tipoDato === "number" ? "any" : undefined}
                  value={String(
                    binding.tipoDato === "number" &&
                      typeof currentValue === "number"
                      ? valorInternoAVisible(binding.clave, currentValue)
                      : (currentValue ?? ""),
                  )}
                  onChange={(event) => {
                    const raw = event.target.value;
                    const value =
                      binding.tipoDato === "number" && raw !== ""
                        ? valorVisibleAInterno(binding.clave, Number(raw))
                        : raw;
                    onChange(escribirRuta(current, binding.clave, value));
                  }}
                  required={binding.requerido !== false}
                />
                {unidadVisible ? (
                  <InputGroupAddon align="inline-end">
                    {unidadVisible}
                  </InputGroupAddon>
                ) : null}
              </InputGroup>
            )}
          </Field>
        );
      })}
    </FieldGroup>
  );
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
  const componentes = (revision?.componentes ?? []).map((componente) => {
    const bindings = componente.configuracionJson?.bindings ?? [];
    const derivarMedidas = medidasDerivadasDeDisenoVectorial(bindings);
    return {
      componente,
      solicitados: bindings.filter(
        (binding) =>
          binding.origen === "COTIZACION" &&
          !esMedidaPlanaDerivada(binding, derivarMedidas),
      ),
    };
  });
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
        {componentes.map(({ componente, solicitados }) => {
          const current = values[componente.codigo] ?? {};
          const repeticion = componente.configuracionJson?.repeticion;
          const repetible = repeticion?.permitida === true;
          const incluyeBase = !repetible || repeticion?.minimo !== 0;
          const adicionales = repetible ? leerOcurrencias(current) : [];
          const maximo = repeticion?.maximo ?? 20;
          const cantidadOcurrencias =
            (incluyeBase ? 1 : 0) + adicionales.length;
          const actualizarAdicionales = (items: OcurrenciaAdicional[]) =>
            onChange({
              ...values,
              [componente.codigo]: {
                ...current,
                [CLAVE_OCURRENCIAS_ADICIONALES]: items,
              },
            });
          const agregarOcurrencia = () => {
            const numero = cantidadOcurrencias + 1;
            actualizarAdicionales([
              ...adicionales,
              {
                id: idNuevaOcurrencia(),
                nombre: `Nueva ocurrencia ${numero}`,
                valores: {},
              },
            ]);
          };
          return (
            <details
              className={styles.card}
              key={componente.id}
              open={solicitados.length > 0 || repetible}
            >
              <summary>
                <div>
                  <strong>{componente.nombre}</strong>
                  <span>
                    {repetible
                      ? `${cantidadOcurrencias} de ${maximo} ocurrencias`
                      : solicitados.length
                        ? `${solicitados.length} dato${solicitados.length === 1 ? "" : "s"} para completar`
                        : "Configuración resuelta automáticamente"}
                  </span>
                </div>
                <ChevronDownIcon />
              </summary>
              <div className={styles.occurrenceList}>
                {incluyeBase ? (
                  <section className={styles.occurrence}>
                    {repetible ? (
                      <div className={styles.occurrenceHead}>
                        <div>
                          <strong>{componente.nombre}</strong>
                          <span>Incluida en la receta</span>
                        </div>
                      </div>
                    ) : null}
                    <CamposOcurrencia
                      bindings={solicitados}
                      current={current}
                      idPrefix={`componente-${componente.id}`}
                      onChange={(next) =>
                        onChange({
                          ...values,
                          [componente.codigo]: guardarOcurrencias(
                            next,
                            adicionales,
                            repetible,
                          ),
                        })
                      }
                    />
                  </section>
                ) : null}
                {adicionales.map((ocurrencia, index) => (
                  <section className={styles.occurrence} key={ocurrencia.id}>
                    <div className={styles.occurrenceHead}>
                      <Field className={styles.nameField}>
                        <FieldLabel
                          htmlFor={`nombre-${componente.id}-${ocurrencia.id}`}
                        >
                          Nombre o ubicación
                        </FieldLabel>
                        <Input
                          id={`nombre-${componente.id}-${ocurrencia.id}`}
                          value={ocurrencia.nombre}
                          maxLength={180}
                          onChange={(event) =>
                            actualizarAdicionales(
                              adicionales.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, nombre: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          required
                        />
                      </Field>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Quitar ${ocurrencia.nombre}`}
                        title="Quitar ocurrencia"
                        onClick={() =>
                          actualizarAdicionales(
                            adicionales.filter(
                              (item) => item.id !== ocurrencia.id,
                            ),
                          )
                        }
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                    <CamposOcurrencia
                      bindings={solicitados}
                      current={ocurrencia.valores}
                      idPrefix={`componente-${componente.id}-${ocurrencia.id}`}
                      onChange={(next) =>
                        actualizarAdicionales(
                          adicionales.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, valores: next }
                              : item,
                          ),
                        )
                      }
                    />
                  </section>
                ))}
                {!incluyeBase && adicionales.length === 0 ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>Sin ocurrencias agregadas</EmptyTitle>
                      <EmptyDescription>
                        Este componente comienza vacío. Agregá únicamente las
                        variantes que necesite esta cotización.
                      </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button type="button" onClick={agregarOcurrencia}>
                        <PlusIcon data-icon="inline-start" />
                        {repeticion?.etiquetaAgregar?.trim() ||
                          `Agregar ${componente.nombre}`}
                      </Button>
                    </EmptyContent>
                  </Empty>
                ) : repetible ? (
                  <div className={styles.addOccurrence}>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={cantidadOcurrencias >= maximo}
                      onClick={agregarOcurrencia}
                    >
                      <PlusIcon data-icon="inline-start" />
                      {repeticion?.etiquetaAgregar?.trim() ||
                        `Agregar ${componente.nombre}`}
                    </Button>
                    {cantidadOcurrencias >= maximo ? (
                      <span>Se alcanzó el máximo configurado.</span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
