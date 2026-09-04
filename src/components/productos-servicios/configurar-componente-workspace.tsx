"use client";

import * as React from "react";
import {
  BoxesIcon,
  ExternalLinkIcon,
  GitBranchIcon,
  SparklesIcon,
} from "lucide-react";
import {
  getFormularioCotizacionProducto,
  type BindingParametroComponente,
  type ConfiguracionComponenteFabricado,
  type FormularioCotizacionProducto,
  type ProductoRecetaComponenteInput,
} from "@/lib/productos-servicios-api";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  condicionalesPublicosDelComponente,
  esMedidaPlanaDerivada,
  medidasDerivadasDeDisenoVectorial,
  parametrosPublicosDelComponente,
} from "@/lib/componentes-contrato-publico";
import {
  operacionUsaUnidad,
  unidadVisibleParametro,
  valorInternoAVisible,
  valorReglaInternoAVisible,
  valorReglaVisibleAInterno,
  valorVisibleAInterno,
} from "@/lib/componentes-configuracion-unidades";
import { ModeloProductivoConfigShell } from "./modelo-productivo-config-shell";
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

type CampoPadre = {
  clave: string;
  etiqueta: string;
  numerico: boolean;
  tipoDato: "number" | "boolean" | "string" | "vectorial";
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
    .replace(/^medidas\.alto$/, "medidaCustomMm.altoMm")
    .replace(/^medidas\.profundidad$/, "profundidadMm");
}

function camposDelPadre(
  formulario: FormularioCotizacionProducto,
): CampoPadre[] {
  const campos: CampoPadre[] = [
    {
      clave: "cantidad",
      etiqueta: "Cantidad del producto padre",
      numerico: true,
      tipoDato: "number",
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
        tipoDato: "number",
        unidad: "cm",
        fuenteTipo: "PADRE",
      },
      {
        clave: "medidaCustomMm.altoMm",
        etiqueta: "Alto del producto padre",
        numerico: true,
        tipoDato: "number",
        unidad: "cm",
        fuenteTipo: "PADRE",
      },
      {
        clave: "piezaAreaTotalM2",
        etiqueta: "Superficie total del producto padre",
        numerico: true,
        tipoDato: "number",
        unidad: "m²",
        fuenteTipo: "PADRE",
      },
      {
        clave: "piezaPerimetroTotalM",
        etiqueta: "Perímetro total del producto padre",
        numerico: true,
        tipoDato: "number",
        unidad: "m",
        fuenteTipo: "PADRE",
      },
    );
    if (formulario.medidas.ejes.includes("PROFUNDIDAD")) {
      campos.push({
        clave: "profundidadMm",
        etiqueta: "Profundidad del producto padre",
        numerico: true,
        tipoDato: "number",
        unidad: "cm",
        fuenteTipo: "PADRE",
      });
    }
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
      tipoDato: [
        "number",
        "numero",
        "entero",
        "decimal",
        "tiempo_manual",
      ].includes(tipo)
        ? "number"
        : ["boolean", "bool"].includes(tipo)
          ? "boolean"
          : "string",
      unidad: typeof pregunta.unidad === "string" ? pregunta.unidad : null,
      fuenteTipo: "PADRE",
    });
  }
  for (const adicional of formulario.adicionales ?? []) {
    if (adicional.tipo !== "paso") continue;
    campos.push({
      clave: adicional.jobContextKey,
      etiqueta: adicional.nombre,
      numerico: false,
      tipoDato: "boolean",
      unidad: null,
      fuenteTipo: "PADRE",
    });
  }
  for (const fuente of formulario.geometrias?.fuentes ?? []) {
    campos.push({
      clave: `geometriasVectoriales.${fuente.id}`,
      etiqueta: `Geometría del padre · ${fuente.nombre}`,
      numerico: false,
      tipoDato: "vectorial",
      unidad: null,
      fuenteTipo: "PADRE",
    });
  }
  // Compatibilidad con productos vectoriales anteriores al registro de
  // fuentes nombradas: su único diseño sigue siendo heredable.
  for (const herramienta of formulario.herramientas ?? []) {
    if (herramienta.tipo !== "diseno_vectorial") continue;
    campos.push({
      clave: herramienta.jobContextKey,
      etiqueta: "Geometría principal del padre",
      numerico: false,
      tipoDato: "vectorial",
      unidad: null,
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

function esActivacionOpcional(binding: BindingParametroComponente): boolean {
  return binding.clave.startsWith("opcionalesActivados.");
}

function tipoCampoBinding(
  binding: BindingParametroComponente,
): CampoPadre["tipoDato"] {
  const tipo = binding.tipoDato.toLowerCase();
  if (tipo === "vectorial" || binding.clave === "disenoVectorialFuente") {
    return "vectorial";
  }
  if (["number", "numero", "entero", "decimal"].includes(tipo)) {
    return "number";
  }
  if (["boolean", "bool"].includes(tipo)) return "boolean";
  return "string";
}

function camposCompatibles(
  binding: BindingParametroComponente,
  campos: CampoPadre[],
): CampoPadre[] {
  const tipo = tipoCampoBinding(binding);
  return campos.filter((campo) => campo.tipoDato === tipo);
}

function opcionActivacion(binding: BindingParametroComponente): string {
  if (binding.origen === "FIJO") {
    return binding.valor === true ? "FIJO_TRUE" : "FIJO_FALSE";
  }
  return binding.origen;
}

function etiquetaCampoCondicional(
  campo: string,
  bindings: BindingParametroComponente[],
): string {
  const exacto = bindings.find((binding) => binding.clave === campo);
  if (exacto) return exacto.etiqueta;
  const ultimo = campo.split(".").at(-1) ?? campo;
  const humano = ultimo.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
  return humano.charAt(0).toUpperCase() + humano.slice(1);
}

export function ConfigurarComponenteWorkspace({
  componente,
  productoPadreId,
  productoPadreNombre,
  componentesHermanos,
  onCancel,
  onSave,
  embedded = false,
}: {
  componente: ProductoRecetaComponenteInput;
  productoPadreId: string;
  productoPadreNombre: string;
  componentesHermanos: ComponenteHermano[];
  onCancel: () => void;
  onSave: (
    configuracion: ConfiguracionComponenteFabricado,
    unidadComercial: string,
    politicaEjecucion: "INLINE" | "INDEPENDIENTE",
    nombreUso: string,
  ) => void;
  embedded?: boolean;
}) {
  const [formulario, setFormulario] =
    React.useState<FormularioCotizacionProducto | null>(null);
  const [camposPadre, setCamposPadre] = React.useState<CampoPadre[]>([]);
  const [bindings, setBindings] = React.useState<BindingParametroComponente[]>(
    componente.configuracionJson?.bindings ?? [],
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [nombreUso, setNombreUso] = React.useState(componente.nombre);
  const [politicaEjecucion, setPoliticaEjecucion] = React.useState<
    "INLINE" | "INDEPENDIENTE"
  >(componente.politicaEjecucion ?? "INDEPENDIENTE");
  const [repeticion, setRepeticion] = React.useState<
    NonNullable<ConfiguracionComponenteFabricado["repeticion"]>
  >(() => {
    const guardada = componente.configuracionJson?.repeticion;
    return {
      version: 1,
      permitida: guardada?.permitida ?? false,
      minimo: guardada?.minimo === 0 ? 0 : 1,
      maximo: guardada?.maximo ?? 20,
      etiquetaAgregar: guardada?.etiquetaAgregar ?? null,
    };
  });

  React.useEffect(() => {
    let active = true;
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
                  tipoDato: "number" as const,
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
        const base = parametrosPublicosDelComponente(
          result,
          componente.cantidad,
        );
        setBindings((actuales) => {
          const existentes = new Map(
            actuales.map((item) => [item.clave, item]),
          );
          return base.map((item) => {
            const merged = { ...item, ...existentes.get(item.clave) };
            return {
              ...merged,
              // Etiqueta, tipo, unidad y opciones pertenecen al contrato
              // público vigente del hijo. La revisión conserva la decisión
              // del usuario, no textos técnicos o unidades antiguas.
              etiqueta: item.etiqueta,
              tipoDato: item.tipoDato,
              unidad: item.unidad,
              requerido: item.requerido,
              opciones: item.opciones,
              regla: reglaLegacy(merged),
            };
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
  const condicionales = formulario
    ? condicionalesPublicosDelComponente(formulario)
    : [];
  const opcionales = bindings.filter(esActivacionOpcional);
  const derivarMedidas = medidasDerivadasDeDisenoVectorial(bindings);
  const bindingsVisibles = bindings
    .map((binding, index) => ({ binding, index }))
    .filter(({ binding }) => !esMedidaPlanaDerivada(binding, derivarMedidas));
  const parametros = bindingsVisibles.filter(
    ({ binding }) => !esActivacionOpcional(binding),
  ).length;

  return (
    <ModeloProductivoConfigShell
      tipo="COMPONENTE"
      eyebrow="Producción · Componente · Configuración de uso"
      titulo={componente.nombre}
      descripcion={
        <>
          Definí cómo {productoPadreNombre} completa cada parámetro de este
          producto hijo. Esto no modifica su receta global.
        </>
      }
      onBack={onCancel}
      backLabel="Volver a la ruta de producción"
      embedded={embedded}
      pinFooterToViewport
      contentClassName={styles.body}
      headerAction={
        <a
          href={`/productos-servicios/${componente.productoComponenteId}?tab=produccion`}
          target="_blank"
          rel="noreferrer"
        >
          Editar producto hijo <ExternalLinkIcon />
        </a>
      }
      primaryLabel="Aplicar configuración"
      primaryDisabled={!formulario || loading || !nombreUso.trim()}
      onPrimary={() =>
        formulario &&
        onSave(
          {
            ...componente.configuracionJson,
            version: repeticion.permitida
              ? 2
              : (componente.configuracionJson?.version ?? 1),
            bindings,
            repeticion,
          },
          formulario.producto.unidadComercial,
          politicaEjecucion,
          nombreUso.trim(),
        )
      }
    >
      {loading ? (
        <div className={styles.message}>Cargando parámetros…</div>
      ) : null}
      {error ? <div className={styles.error}>{error}</div> : null}
      {formulario ? (
        <>
          <FieldGroup className={styles.identityGroup}>
            <Field>
              <FieldLabel htmlFor="nombre-uso-componente">
                Nombre en esta receta
              </FieldLabel>
              <Input
                id="nombre-uso-componente"
                value={nombreUso}
                maxLength={180}
                onChange={(event) => setNombreUso(event.target.value)}
              />
              <FieldDescription>
                Identifica esta ocurrencia sin modificar el producto original.
              </FieldDescription>
            </Field>
          </FieldGroup>
          <div className={styles.contextCard}>
            <BoxesIcon />
            <div>
              <strong>Contrato público del hijo</strong>
              <span>
                {parametros} parámetros
                {opcionales.length
                  ? ` · ${opcionales.length} opcional${opcionales.length === 1 ? "" : "es"}`
                  : ""}
                {condicionales.length
                  ? ` · ${condicionales.length} automático${condicionales.length === 1 ? "" : "s"}`
                  : ""}
              </span>
            </div>
          </div>
          <div className={styles.executionCard}>
            <div>
              <strong>Flujo en producción</strong>
              <span>
                Define si el componente aparecerá como un trabajo separado, con
                sus propios pasos y avance.
              </span>
            </div>
            <div className={styles.executionControl}>
              <select
                aria-label="Flujo en el tablero de producción"
                value={politicaEjecucion}
                onChange={(event) =>
                  setPoliticaEjecucion(
                    event.target.value as "INLINE" | "INDEPENDIENTE",
                  )
                }
              >
                <option value="INDEPENDIENTE">
                  Generar flujo propio en el tablero de producción
                </option>
                <option value="INLINE">
                  No generar flujo en el tablero de producción
                </option>
              </select>
              <span className={styles.executionHint}>
                {politicaEjecucion === "INDEPENDIENTE"
                  ? "El componente aparecerá como un trabajo independiente en el tablero."
                  : "El componente se calculará normalmente, pero no tendrá seguimiento operativo separado."}
              </span>
            </div>
          </div>
          <div className={styles.repeatCard}>
            <div>
              <strong>Componente repetible</strong>
              <span>
                Permite agregar otras ocurrencias de este mismo producto al
                cotizar, cada una con nombre, medidas y configuración propios.
              </span>
            </div>
            <div className={styles.repeatControl}>
              <label>
                <span>Permitir agregar ocurrencias</span>
                <Switch
                  checked={repeticion.permitida}
                  disabled={componente.requerido === false}
                  onCheckedChange={(permitida) =>
                    setRepeticion((actual) => ({
                      ...actual,
                      permitida,
                      minimo: permitida ? actual.minimo : 1,
                    }))
                  }
                />
              </label>
              {componente.requerido === false ? (
                <span className={styles.executionHint}>
                  Para repetirlo, primero definí una ocurrencia base
                  obligatoria.
                </span>
              ) : null}
              {repeticion.permitida ? (
                <>
                  <label>
                    <span>Incluir una ocurrencia inicial</span>
                    <Switch
                      checked={repeticion.minimo === 1}
                      onCheckedChange={(incluida) =>
                        setRepeticion((actual) => ({
                          ...actual,
                          minimo: incluida ? 1 : 0,
                        }))
                      }
                    />
                  </label>
                  <span className={styles.executionHint}>
                    {repeticion.minimo === 1
                      ? "La cotización comienza con una ocurrencia incluida."
                      : "La cotización comienza vacía y el comercial decide cuáles agregar."}
                  </span>
                  <FieldGroup className={styles.repeatFields}>
                    <Field>
                      <FieldLabel htmlFor="maximo-ocurrencias-componente">
                        Máximo por cotización
                      </FieldLabel>
                      <Input
                        id="maximo-ocurrencias-componente"
                        type="number"
                        min={1}
                        max={50}
                        value={repeticion.maximo}
                        onChange={(event) =>
                          setRepeticion((actual) => ({
                            ...actual,
                            maximo: Math.min(
                              50,
                              Math.max(1, Number(event.target.value) || 1),
                            ),
                          }))
                        }
                      />
                      <FieldDescription>
                        Total de ocurrencias que puede tener la cotización.
                      </FieldDescription>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="etiqueta-agregar-componente">
                        Texto del botón
                      </FieldLabel>
                      <Input
                        id="etiqueta-agregar-componente"
                        maxLength={100}
                        placeholder={`Agregar ${componente.nombre}`}
                        value={repeticion.etiquetaAgregar ?? ""}
                        onChange={(event) =>
                          setRepeticion((actual) => ({
                            ...actual,
                            etiquetaAgregar: event.target.value || null,
                          }))
                        }
                      />
                    </Field>
                  </FieldGroup>
                </>
              ) : null}
            </div>
          </div>
          {derivarMedidas ? (
            <div className={styles.geometryNotice}>
              <SparklesIcon />
              <span>
                El ancho y el alto se obtendrán del diseño vectorial,
                conservando su proporción.
              </span>
            </div>
          ) : null}
          <div className={styles.table}>
            <div className={styles.tableHead}>
              <span>Parámetro del hijo</span>
              <span>Origen</span>
              <span>Configuración</span>
            </div>
            {bindingsVisibles.map(({ binding, index }) => (
              <div
                className={`${styles.binding} ${esActivacionOpcional(binding) ? styles.activationBinding : ""}`}
                key={binding.clave}
              >
                <div>
                  <strong>{binding.etiqueta}</strong>
                  {esActivacionOpcional(binding) ? (
                    <small className={styles.optionalMark}>
                      <GitBranchIcon /> Servicio opcional del componente
                    </small>
                  ) : binding.requerido ? (
                    <small className={styles.requiredMark}>
                      <span aria-hidden="true" />
                      Requerido
                    </small>
                  ) : null}
                </div>
                <select
                  value={
                    esActivacionOpcional(binding)
                      ? opcionActivacion(binding)
                      : binding.origen
                  }
                  onChange={(event) => {
                    const opcion = event.target.value;
                    if (esActivacionOpcional(binding)) {
                      if (opcion === "FIJO_TRUE") {
                        cambiar(index, {
                          origen: "FIJO",
                          valor: true,
                          regla: null,
                          padreClave: null,
                        });
                        return;
                      }
                      if (opcion === "FIJO_FALSE") {
                        cambiar(index, {
                          origen: "FIJO",
                          valor: false,
                          regla: null,
                          padreClave: null,
                        });
                        return;
                      }
                    }
                    const origen =
                      opcion as BindingParametroComponente["origen"];
                    const candidatos =
                      origen === "FORMULA"
                        ? camposPadre.filter((campo) => campo.numerico)
                        : camposCompatibles(binding, camposPadre);
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
                  {esActivacionOpcional(binding) ? (
                    <>
                      <option value="DEFAULT_HIJO">
                        Usar predeterminado del hijo
                      </option>
                      <option value="FIJO_TRUE">Incluir siempre</option>
                      <option value="FIJO_FALSE">No incluir</option>
                      <option value="PADRE">Resolver desde el padre</option>
                      <option value="COTIZACION">Definir al cotizar</option>
                    </>
                  ) : (
                    (binding.tipoDato === "vectorial"
                      ? ORIGENES.filter(
                          (origen) =>
                            origen.value === "PADRE" ||
                            origen.value === "COTIZACION",
                        )
                      : ORIGENES
                    ).map((origen) => (
                      <option key={origen.value} value={origen.value}>
                        {origen.label}
                      </option>
                    ))
                  )}
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
                            campo.fuenteTipo === "PADRE" ? campo.clave : null,
                          regla: {
                            campoPadre: campo.clave,
                            operador: "COPIAR",
                            valor: null,
                            fuente: fuenteDeCampo(campo),
                          },
                        });
                      }}
                    >
                      <option value="PADRE:">Elegir dato disponible…</option>
                      {camposCompatibles(binding, camposPadre).map((campo) => (
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
                            <option value={idCampo(campo)} key={idCampo(campo)}>
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
                  ) : esActivacionOpcional(binding) ? (
                    <span className={styles.activationSummary}>
                      {binding.origen === "FIJO"
                        ? binding.valor === true
                          ? "Este trabajo siempre se incluirá"
                          : "Este trabajo no se incluirá"
                        : binding.valor === true
                          ? "El hijo lo incluye de forma predeterminada"
                          : "El hijo lo omite de forma predeterminada"}
                    </span>
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
                      {unidadVisibleParametro(binding.clave, binding.unidad) ? (
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
          {condicionales.length ? (
            <section className={styles.automations}>
              <div className={styles.automationsHead}>
                <SparklesIcon />
                <div>
                  <strong>Automatismos de la ruta hija</strong>
                  <span>
                    No se activan manualmente: el sistema evalúa sus reglas con
                    la configuración resuelta del componente.
                  </span>
                </div>
              </div>
              <div className={styles.automationList}>
                {condicionales.map((condicional) => (
                  <article key={condicional.id}>
                    <strong>{condicional.nombre}</strong>
                    <span>
                      {condicional.condicionadoPor.length
                        ? `Depende de ${condicional.condicionadoPor
                            .map((campo) =>
                              etiquetaCampoCondicional(campo, bindings),
                            )
                            .join(", ")}`
                        : "Se resuelve mediante la condición configurada en su ruta"}
                    </span>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
          <p className={styles.hint}>
            Las reglas sólo permiten usar datos publicados por el producto padre
            o por otros componentes de esta receta. Las medidas se ingresan en
            centímetros, igual que en el sheet comercial; el sistema realiza la
            conversión interna.
          </p>
        </>
      ) : null}
    </ModeloProductivoConfigShell>
  );
}
