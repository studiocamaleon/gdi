"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Calculator,
  ChevronDown,
  Info,
  Square,
  WandSparkles,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { FieldGroup, FieldSet, FieldLegend } from "@/components/ui/field";
import { SegmentedControl } from "@/components/design-system/choice-controls";
import { Button, EstadoCopiado, AvisoCopiado } from "./centro-copiado-ui";
import {
  TextoTarifa,
  ErrorTarifa,
  mensajeErrorTarifa,
} from "./centro-copiado-tarifarios-controles";
import type { MotorTarifario } from "./centro-copiado-tarifarios-simulacion";
import {
  ajustarPrecio,
  normalizarContenido,
} from "@/lib/centro-copiado-tarifarios-editor";
import {
  sugerirCelda,
  sugerirPorVolumen,
  ponerPrecio,
  caidasEntreTramos,
} from "@/lib/centro-copiado-tarifarios-sugerencias";
import {
  claveCeldaSimulacion,
  type CeldaSimulacion,
} from "../../../apps/api/src/centro-copiado/tarifarios/simulacion-tarifario.types";
import { compararSimulacion } from "../../../apps/api/src/centro-copiado/comercial/comparacion-simulacion";
import { DecimalComercial as D } from "../../../apps/api/src/centro-copiado/comercial/validaciones";
import { resumirCostosRango } from "@/lib/centro-copiado-costos-rango";
import {
  objetivosDeMatriz,
  objetivoDeTramo,
  normalizarObjetivoContribucion,
} from "@/lib/centro-copiado-objetivos-contribucion";
import styles from "./centro-copiado-motor-matriz.module.css";

type Sugerencia = ReturnType<typeof sugerirCelda> & {
  ajustadaPorVolumen?: boolean;
};
type Propuesta = { celda: CeldaSimulacion; sugerencia: Sugerencia };
export type RenderDetalleCelda = (fila: number, tramo: number) => ReactNode;

/** Una sola matriz: la revisión agrega valores propuestos sin tocar los inputs. */
export function MotorEnMatriz({
  motor,
  seccion,
  indices,
  descripcionVista,
  disabled,
  children,
}: {
  motor?: MotorTarifario | null;
  seccion: "hojas" | "cad";
  indices: number[];
  descripcionVista: string;
  disabled: boolean;
  children: (detalle?: RenderDetalleCelda) => ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const [mostrar, setMostrar] = useState(false);
  const [redondeo, setRedondeo] = useState("");
  const [alcance, setAlcance] = useState("VISTA");
  const [destino, setDestino] = useState("VACIOS");
  const [revision, setRevision] = useState<{
    firma: string;
    propuestas: Propuesta[];
    caidas: number;
  } | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const contenido = motor?.contenido;
  const matriz = contenido?.[seccion];
  const normalizado = useMemo(() => {
    try {
      return contenido ? normalizarContenido(contenido) : null;
    } catch {
      return null;
    }
  }, [contenido]);
  const celdas =
    motor?.celdas.filter(
      (c) =>
        c.seccion === seccion &&
        (alcance === "MATRIZ" || indices.includes(c.fila)),
    ) ?? [];
  let errorOpciones: string | null = null;
  try {
    if (matriz)
      objetivosDeMatriz(matriz).forEach(normalizarObjetivoContribucion);
    if (redondeo.trim()) ajustarPrecio("1", "IMPORTE", "0", redondeo);
  } catch (e) {
    errorOpciones = mensajeErrorTarifa(e);
  }
  const sugerencias = useMemo(() => {
    const mapa = new Map<string, { sugerencia?: Sugerencia; error?: string }>();
    if (!motor || !normalizado || errorOpciones || !abierto) return mapa;
    return sugerirPorVolumen(
      normalizado,
      motor.resultados,
      seccion,
      redondeo.trim() || undefined,
      (fila, tramo) => objetivoDeTramo(normalizado[seccion]!, fila, tramo),
    );
  }, [motor, normalizado, errorOpciones, abierto, seccion, redondeo]);
  if (!motor) return children();
  const totalMatriz = motor.celdas.filter((c) => c.seccion === seccion).length;
  const descripcionAlcance =
    alcance === "VISTA"
      ? `Sólo ${descripcionVista}. ${celdas.length} de ${totalMatriz} precios de esta matriz, en todas sus páginas.`
      : `Toda la matriz de ${seccion === "cad" ? "CAD" : "hojas"}: ${celdas.length} precios, con todos sus colores, coberturas y tamaños.`;
  const dinero = (v: string) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: motor.contenido.monedaCodigo,
      maximumFractionDigits: 4,
    }).format(Number(v));
  const propuestas: Propuesta[] = celdas.flatMap((celda) => {
    const s = sugerencias.get(claveCeldaSimulacion(celda))?.sugerencia;
    return s &&
      (destino === "TODOS" || s.anterior == null) &&
      (s.anterior == null || !new D(s.anterior).eq(s.nuevo))
      ? [{ celda, sugerencia: s }]
      : [];
  });
  const omitidas = celdas.filter(
    (c) => !sugerencias.get(claveCeldaSimulacion(c))?.sugerencia,
  ).length;
  const firma = JSON.stringify({
    contenido,
    resultados: motor.resultados,
    redondeo,
    destino,
    claves: celdas.map(claveCeldaSimulacion),
  });
  const revisionVigente = revision?.firma === firma;
  const editables = !disabled && motor.puedeAplicar;
  const cambiarObjetivo = (indice: number, valor: string) => {
    if (!editables || !motor.aplicar || !matriz) return;
    const nuevo = structuredClone(motor.contenido);
    const objetivos = [...objetivosDeMatriz(matriz)];
    objetivos[indice] = valor;
    nuevo[seccion]!.objetivosContribucion = objetivos;
    motor.aplicar(nuevo);
  };
  const revisar = () => {
    if (!normalizado || !editables || !propuestas.length) return;
    const nuevo = structuredClone(normalizado);
    propuestas.forEach((p) => ponerPrecio(nuevo, p.celda, p.sugerencia.nuevo));
    const filas = new Set(propuestas.map((p) => p.celda.fila));
    setRevision({
      firma,
      propuestas,
      caidas: caidasEntreTramos(nuevo).filter(
        (c) => c.seccion === seccion && filas.has(c.fila),
      ).length,
    });
    setMostrar(true);
  };
  const aplicar = () => {
    if (
      !revision ||
      !revisionVigente ||
      !editables ||
      !normalizado ||
      !motor.aplicar
    )
      return;
    const nuevo = structuredClone(normalizado);
    revision.propuestas.forEach((p) =>
      ponerPrecio(nuevo, p.celda, p.sugerencia.nuevo),
    );
    motor.aplicar(nuevo);
    setRevision(null);
  };
  const calcular = () => {
    setMostrar(true);
    setRevision(null);
    setErrorAccion(null);
    void motor
      .simular(celdas)
      .catch((e) => setErrorAccion(mensajeErrorTarifa(e)));
  };
  const detalleCelda: RenderDetalleCelda = (fila, tramo) => {
    const celda = { seccion, fila, tramo };
    const clave = claveCeldaSimulacion(celda);
    const resultado = motor.resultados[clave];
    const esperadas =
      motor.contenido[seccion]!.reglas.cobertura === "UNICA" ? 3 : 1;
    const completas =
      resultado?.escenarios.length === esperadas &&
      resultado.escenarios.every((e) => e.estado === "CALCULADO");

    const controles =
      completas && normalizado
        ? resultado.escenarios.flatMap((e) => {
            try {
              return e.estado === "CALCULADO"
                ? [compararSimulacion(normalizado, seccion, e).control]
                : [];
            } catch {
              return [];
            }
          })
        : [];
    const margenActual = peorMargen(controles);
    const sugerida = sugerencias.get(clave);
    const revisada =
      revisionVigente &&
      revision?.propuestas.find((p) => claveCeldaSimulacion(p.celda) === clave)
        ?.sugerencia;
    const cobertura =
      motor.contenido[seccion]!.filas[fila].combinacion.cobertura;
    const costos = resultado
      ? resumirCostosRango(
          resultado,
          cobertura ? [cobertura] : ["borrador", "normal", "alta"],
        )
      : null;
    const unidad =
      seccion === "cad"
        ? "ML consumidos"
        : motor.contenido.hojas!.reglas.unidad === "HOJA"
          ? "hojas"
          : "carillas";
    const referencia = resultado?.escenarios.find(
      (e) => e.estado === "CALCULADO",
    )?.cantidadReferencia;
    return (
      <div className={styles.cellInfo} data-review={!!revisada || undefined}>
        <div
          className={styles.costRange}
          aria-label="Costos unitarios del rango"
        >
          {(
            [
              ["Costo mín.", costos?.minimo],
              ["Costo máx.", costos?.maximo],
              ["Promedio", costos?.promedio],
            ] as const
          ).map(([etiqueta, valor]) => (
            <div className={styles.cellCost} key={etiqueta}>
              <span>{etiqueta}</span>
              <strong>{valor == null ? "—" : dinero(valor)}</strong>
            </div>
          ))}
          <small
            title={
              costos?.motivo ??
              "Extremos entre las dos cantidades simuladas. Promedio = (costo mínimo + costo máximo) / 2. No es el costo de la cantidad central del tramo."
            }
          >
            {costos?.minimo != null
              ? `${costos.abierto ? "Muestra" : "Comparación"}: ${costos.desde}–${costos.hasta} ${unidad}`
              : motor.desactualizadas.has(clave)
                ? "Volvé a calcular"
                : (costos?.motivo ?? "Sin calcular")}
          </small>
        </div>
        {resultado?.escenarios.some((e) => e.estado === "ERROR") && (
          <span className={styles.cellWarning}>
            Error de cálculo · ver detalle
          </span>
        )}
        <div
          className={styles.cellMargin}
          data-state={
            margenActual?.negativo
              ? "NEGATIVO"
              : (margenActual?.estado ?? "NO_VERIFICABLE")
          }
        >
          <span>Contribución actual</span>
          <strong>
            {margenActual?.porcentaje == null
              ? "Sin verificar"
              : `${margenActual.porcentaje}%`}
          </strong>
        </div>
        {referencia && (
          <small className={styles.referenceNote}>
            Contribución y sugerencia a {referencia}{" "}
            {Number(referencia) === 1
              ? seccion === "cad"
                ? "ML consumido"
                : unidad.slice(0, -1)
              : unidad}
          </small>
        )}
        {margenActual?.negativo && (
          <span className={styles.cellWarning}>Contribución negativa</span>
        )}
        {abierto && sugerida?.sugerencia && (
          <div className={styles.cellSuggestion}>
            <span>{revisada ? "Por aplicar" : "Sugerido"}</span>
            <strong>{dinero(sugerida.sugerencia.nuevo)}</strong>
            <small>
              Contribución{" "}
              {peorMargen(sugerida.sugerencia.controles)?.porcentaje ?? "—"}%
            </small>
            {sugerida.sugerencia.ajustadaPorVolumen && (
              <small>Ajustado por volumen</small>
            )}
          </div>
        )}
        {abierto && sugerida?.error && (
          <span className={styles.cellWarning} title={sugerida.error}>
            Sin sugerencia · ver detalle
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => motor.detalle(celda)}
          aria-label={`Ver costo y contribución de ${motor.celdas.find((c) => claveCeldaSimulacion(c) === clave)?.etiqueta}, desde ${motor.celdas.find((c) => claveCeldaSimulacion(c) === clave)?.desde}`}
        >
          <Info /> Detalle
        </Button>
        {abierto && sugerida?.error && <small>{sugerida.error}</small>}
      </div>
    );
  };
  return (
    <>
      <section
        className={styles.assistant}
        aria-label={`Motor de precios de ${seccion === "cad" ? "CAD" : "hojas"}`}
      >
        <div className={styles.toolbar}>
          <Button
            variant="outline"
            aria-expanded={abierto}
            onClick={() => {
              setAbierto(!abierto);
              if (!abierto) setMostrar(true);
            }}
          >
            <Calculator /> Calcular precios con el motor <ChevronDown />
          </Button>
          <label className={styles.visibility}>
            <Switch
              aria-label="Mostrar costos y contribución"
              checked={mostrar}
              onCheckedChange={setMostrar}
            />{" "}
            Mostrar costos y contribución
          </label>
        </div>
        {abierto && (
          <div className={styles.panel}>
            <div className={styles.intro}>
              <span className={styles.eyebrow}>ASISTENTE DE PRECIOS</span>
              <p>
                Calculá costos y probá la contribución. Los precios actuales se
                conservan hasta que apliques la propuesta.
              </p>
            </div>
            {seccion === "hojas" && motor.preparacionHojas != null && (
              <p className={styles.help}>
                Preparación y limpieza productivas:{" "}
                {motor.preparacionHojas ? "activadas" : "desactivadas"}.
              </p>
            )}
            {matriz && (
              <FieldSet>
                <FieldLegend variant="label">
                  Contribución objetivo por rango
                </FieldLegend>
                <p className={styles.help}>
                  Porcentaje sobre venta neta, después de costos variables y
                  cargas. Cada objetivo se comparte entre todos los papeles,
                  formatos, colores y caras de esta matriz, aunque filtres la
                  vista. Se conserva al guardar el borrador.
                </p>
                <FieldGroup className={styles.objectives}>
                  {matriz.rangosGenerales.map((desde, i) => {
                    const siguiente = matriz.rangosGenerales[i + 1];
                    const unidad =
                      seccion === "cad"
                        ? "ML"
                        : matriz.reglas.unidad === "HOJA"
                          ? "hojas"
                          : "carillas";
                    const rango =
                      siguiente == null
                        ? `${desde}+`
                        : seccion === "cad"
                          ? `${desde} a < ${siguiente}`
                          : `${desde}–${Number(siguiente) - 1}`;
                    return (
                      <TextoTarifa
                        key={String(desde)}
                        etiqueta={`${rango} ${unidad} (%)`}
                        valor={objetivosDeMatriz(matriz)[i]}
                        onChange={(valor) => cambiarObjetivo(i, valor)}
                        disabled={!editables}
                        inputMode="decimal"
                      />
                    );
                  })}
                </FieldGroup>
                {matriz.filas.some((f) => f.rangosPropios) && (
                  <p className={styles.help}>
                    Las combinaciones con rangos propios usan el mayor objetivo
                    de los rangos generales que abarcan.
                  </p>
                )}
                <p className={styles.help}>
                  La contribución es informativa: la OT usa los precios del
                  tarifario sin autorización por margen.
                </p>
              </FieldSet>
            )}
            <FieldGroup className={styles.fields}>
              <TextoTarifa
                etiqueta="Redondear hacia arriba a"
                valor={redondeo}
                onChange={setRedondeo}
                inputMode="decimal"
                placeholder="Sin redondeo · ej. 10 o 100"
                ayuda={`Importe en ${motor.contenido.monedaCodigo}.`}
              />
              <div className={styles.scope}>
                <span>Alcance del cálculo y la aplicación</span>
                <SegmentedControl
                  aria-label="Alcance del motor"
                  value={alcance}
                  onChange={setAlcance}
                  options={[
                    { value: "VISTA", label: "Vista filtrada", icon: null },
                    { value: "MATRIZ", label: "Toda la matriz", icon: null },
                  ]}
                />
                <small>{descripcionAlcance}</small>
              </div>
            </FieldGroup>
            <ErrorTarifa error={errorOpciones ?? errorAccion ?? motor.error} />
            {motor.motivoBloqueo && (
              <p className={styles.help}>{motor.motivoBloqueo}</p>
            )}
            <div className={styles.actions}>
              <Button
                disabled={
                  !motor.habilitada || !!errorOpciones || !celdas.length
                }
                onClick={calcular}
                loading={motor.ocupada}
              >
                <Calculator />{" "}
                {Object.keys(motor.resultados).length
                  ? "Recalcular"
                  : "Calcular"}{" "}
                {celdas.length} precios
              </Button>
              {motor.ocupada && (
                <Button variant="outline" onClick={motor.detener}>
                  <Square /> Detener al terminar el lote
                </Button>
              )}
              <span className={styles.help}>
                Cambiar contribución o redondeo reutiliza los costos calculados.
              </span>
            </div>
            {motor.progreso && (
              <div role="status" className={styles.progress}>
                <progress
                  aria-label="Cálculo de costos"
                  value={motor.progreso.hechas}
                  max={Math.max(1, motor.progreso.total)}
                />
                <span>
                  {motor.ocupada
                    ? "Calculando"
                    : motor.progreso.estado === "FINALIZADA"
                      ? "Cálculo terminado"
                      : "Cálculo detenido"}
                  : {motor.progreso.hechas} de {motor.progreso.total} precios
                </span>
              </div>
            )}
            {!!sugerencias.size && (
              <div className={styles.application}>
                <div className={styles.actions}>
                  <SegmentedControl
                    aria-label="Precios a completar"
                    value={destino}
                    onChange={setDestino}
                    options={[
                      { value: "VACIOS", label: "Sólo vacíos", icon: null },
                      { value: "TODOS", label: "También cargados", icon: null },
                    ]}
                  />
                  <Button
                    variant="outline"
                    disabled={
                      !editables || !propuestas.length || !!errorOpciones
                    }
                    onClick={revisar}
                  >
                    <WandSparkles /> Revisar{" "}
                    {cantidadPrecios(propuestas.length)}
                  </Button>
                  <span className={styles.help}>
                    {omitidas > 0
                      ? `${omitidas} sin sugerencia verificable. `
                      : ""}
                    {destino === "VACIOS" && !propuestas.length && !omitidas
                      ? "No hay vacíos en este alcance. Elegí «También cargados» para revisar sus precios."
                      : "El cero es un precio cargado."}
                  </span>
                </div>
                {revision && (
                  <div className={styles.review}>
                    <EstadoCopiado tono={revisionVigente ? "brand" : "warning"}>
                      {revisionVigente
                        ? `${revision.propuestas.length} precios por aplicar`
                        : "La propuesta cambió"}
                    </EstadoCopiado>
                    <p>
                      {revisionVigente
                        ? `${descripcionAlcance} Compará actual y propuesto en las celdas marcadas. Aplicar completa únicamente los precios revisados de este alcance.`
                        : "Cambió un precio, la selección o el cálculo. Volvé a revisar antes de aplicar."}
                    </p>
                    {!!revision.caidas && (
                      <AvisoCopiado
                        icono={<Info />}
                        tono="warning"
                        titulo="Revisá los saltos entre tramos"
                      >
                        {revision.caidas} fronteras de tramo reducen el total al
                        aumentar la cantidad, con preparación y mínimo
                        incluidos.
                      </AvisoCopiado>
                    )}
                    <div className={styles.actions}>
                      <Button
                        disabled={!revisionVigente || !editables}
                        onClick={aplicar}
                      >
                        Aplicar {cantidadPrecios(revision.propuestas.length)} al
                        borrador
                      </Button>
                      <Button variant="ghost" onClick={() => setRevision(null)}>
                        Cancelar revisión
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <p className={styles.help}>
              Precios{" "}
              {motor.contenido.composicion.iva === "INCLUIDO"
                ? "con IVA incluido"
                : "más IVA"}
              . Preparación aparte descontada una vez; terminaciones aparte. El
              mínimo no reduce el precio sugerido. Con precio único se toma la
              cobertura más exigente. Se elevan los tramos anteriores cuando
              hace falta para que el precio unitario no aumente por volumen; su
              contribución puede superar el objetivo. El papel se costea por las
              hojas utilizadas; los sobrantes aprovechables se conservan en
              inventario al registrar el consumo.
            </p>
          </div>
        )}
      </section>
      {children(mostrar ? detalleCelda : undefined)}
      {mostrar && (
        <p className={styles.help}>
          Costos mín. y máx.: extremos entre las dos cantidades simuladas,
          usando la cobertura más exigente si el precio es único. Promedio:
          media de esos dos costos, sin ponderar cantidades. En CAD se compara
          por ML consumido. El tramo abierto usa una muestra con tope editable
          en Detalle. La contribución descuenta materiales, terceros, cargos y
          cargas comerciales; el tiempo interno queda para cubrir con ese
          resultado. Resultados temporales; recalculá si cambian tus costos.
          Aplicar sólo edita el borrador: después guardá y publicá para
          actualizar los canales que comparten este tarifario.
        </p>
      )}
    </>
  );
}

function peorMargen(
  controles: ReturnType<typeof compararSimulacion>["control"][],
) {
  if (!controles.length || controles.some((c) => c.porcentaje == null))
    return null;
  return controles.reduce((peor, c) =>
    new D(c.porcentaje!).lt(peor.porcentaje!) ? c : peor,
  );
}

function cantidadPrecios(n: number) {
  return `${n} ${n === 1 ? "precio" : "precios"}`;
}
