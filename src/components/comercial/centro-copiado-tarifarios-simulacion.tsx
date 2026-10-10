"use client";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Play, Square } from "lucide-react";
import { usePuede } from "@/components/navigation/permisos-provider";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import type { PerfilCadCopiado } from "@/lib/centro-copiado-cad";
import {
  simularCeldasTarifario,
  type ContenidoTarifario,
} from "@/lib/centro-copiado-tarifarios-api";
import {
  claveRango,
  normalizarContenido,
} from "@/lib/centro-copiado-tarifarios-editor";
import {
  estructuraSimulacion,
  claveCeldaSimulacion,
  type CeldaSimulacion,
  type ResultadoCeldaSimulacion,
  type EscenarioSimulado,
} from "../../../apps/api/src/centro-copiado/tarifarios/simulacion-tarifario.types";
import { compararSimulacion } from "../../../apps/api/src/centro-copiado/comercial/comparacion-simulacion";
import {
  Elegir,
  ErrorTarifa,
  TextoTarifa,
  mensajeErrorTarifa,
} from "./centro-copiado-tarifarios-controles";

type Celda = CeldaSimulacion & {
  etiqueta: string;
  desde: string;
  hasta?: string;
};
type Guardado = { estructura: string; resultado: ResultadoCeldaSimulacion };
const TAMANO_PAGINA = 8;
export function SimulacionTarifario(props: {
  tarifarioId: string | null;
  revision: number | undefined;
  versionId?: string;
  contenido: ContenidoTarifario;
  guardado: ContenidoTarifario | null;
  nombres: Record<string, string>;
  perfiles: PerfilCadCopiado[];
  disabled: boolean;
  onChange?: (contenido: ContenidoTarifario) => void;
}) {
  const puede = usePuede("finanzas.ver_margenes");
  // Desmontar los resultados ante pérdida de permiso, incluso si ya se costearon.
  return puede ? <Simulador {...props} /> : null;
}

function Simulador({
  tarifarioId,
  revision,
  versionId,
  contenido,
  guardado,
  nombres,
  perfiles,
  disabled,
  onChange,
}: Parameters<typeof SimulacionTarifario>[0]) {
  const { zonaHoraria } = useConfigRegional();
  const [filtro, setFiltro] = useState("");
  const [pagina, setPagina] = useState(0);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [resultados, setResultados] = useState<Record<string, Guardado>>({});
  const [referencias, setReferencias] = useState<
    Record<string, CeldaSimulacion>
  >({});
  const [progreso, setProgreso] = useState<{
    hechas: number;
    total: number;
    estructura: string;
    estado: "EN_CURSO" | "DETENIDA" | "FINALIZADA";
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<Celda | null>(null);
  const [cantidad, setCantidad] = useState("");
  const [perfilId, setPerfilId] = useState("AUTO");
  const [geometria, setGeometria] = useState({
    ancho: "",
    alto: "",
    copias: "1",
  });
  const ejecucion = useRef({ activa: false, detener: false, montado: true });
  useEffect(() => {
    const control = ejecucion.current;
    control.montado = true;
    return () => {
      control.montado = false;
      control.detener = true;
    };
  }, []);
  const estructura = useMemo(
    () => estructuraSimulacion(contenido),
    [contenido],
  );
  const actual = useRef(estructura);
  useEffect(() => {
    actual.current = estructura;
  }, [estructura]);
  const estructuraGuardada = guardado && estructuraSimulacion(guardado);
  const celdas = useMemo(
    () =>
      (["hojas", "cad"] as const).flatMap((seccion) => {
        const matriz = contenido[seccion];
        if (!matriz) return [];
        return matriz.filas.flatMap((f, fila) => {
          const c = f.combinacion;
          const papel =
            nombres[c.papelMateriaPrimaId] ?? "Papel fuera de la oferta actual";
          const etiqueta = `${papel}${c.gramaje ? ` ${c.gramaje} g` : ""} · ${"tamano" in c ? `${c.tamano} · ${c.faz === 2 ? "Doble faz" : "Simple faz"}` : `CAD · rollo ${c.anchoRolloMm} mm`} · ${c.color === "BN" ? "K" : "CMYK"} · ${c.cobertura ?? "Todas las coberturas"}`;
          const rangos = f.rangosPropios ?? matriz.rangosGenerales;
          return rangos.map(
            (desde, tramo): Celda => ({
              seccion,
              fila,
              tramo,
              etiqueta,
              desde: String(desde),
              hasta:
                rangos[tramo + 1] == null
                  ? undefined
                  : String(rangos[tramo + 1]),
            }),
          );
        });
      }),
    [contenido, nombres],
  );
  const filtradas = useMemo(
    () =>
      celdas.filter((c) =>
        c.etiqueta
          .toLocaleLowerCase("es")
          .includes(filtro.toLocaleLowerCase("es")),
      ),
    [celdas, filtro],
  );
  const numPagina = Math.min(
    pagina,
    Math.max(0, Math.ceil(filtradas.length / TAMANO_PAGINA) - 1),
  );
  const visibles = filtradas.slice(
    numPagina * TAMANO_PAGINA,
    (numPagina + 1) * TAMANO_PAGINA,
  );
  const ocupada = progreso?.estado === "EN_CURSO";
  const habilitada =
    !!tarifarioId && estructura === estructuraGuardada && !disabled && !ocupada;
  const normalizado = useMemo(() => {
    try {
      return normalizarContenido(contenido);
    } catch {
      return null;
    }
  }, [contenido]);
  const dinero = (valor: string) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: contenido.monedaCodigo,
      maximumFractionDigits: 4,
    }).format(Number(valor));
  const fecha = (valor: string) =>
    new Intl.DateTimeFormat("es-AR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: zonaHoraria,
    }).format(new Date(valor));
  const referenciaDe = (c: Celda): CeldaSimulacion =>
    referencias[claveCeldaSimulacion(c)] ?? {
      seccion: c.seccion,
      fila: c.fila,
      tramo: c.tramo,
    };

  async function simular(elegidas: Celda[]) {
    if (
      !habilitada ||
      !tarifarioId ||
      ejecucion.current.activa ||
      !elegidas.length
    )
      return;
    ejecucion.current.activa = true;
    ejecucion.current.detener = false;
    const firma = estructura;
    let hechas = 0;
    setError(null);
    setProgreso({
      hechas,
      total: elegidas.length,
      estado: "EN_CURSO",
      estructura: firma,
    });
    // Invalidar inmediatamente la selección: nunca mostrar un costo previo como recién calculado.
    setResultados((prev) => {
      const copia = { ...prev };
      elegidas.forEach((c) => delete copia[claveCeldaSimulacion(c)]);
      return copia;
    });
    try {
      for (let i = 0; i < elegidas.length; i += 5) {
        if (ejecucion.current.detener || actual.current !== firma) break;
        const respuesta = await simularCeldasTarifario(tarifarioId, {
          ...(versionId ? { versionId } : { revision }),
          celdas: elegidas.slice(i, i + 5).map(referenciaDe),
        });
        if (!ejecucion.current.montado) return;
        hechas += respuesta.resultados.length;
        setResultados((prev) => ({
          ...prev,
          ...Object.fromEntries(
            respuesta.resultados.map((resultado) => [
              claveCeldaSimulacion(resultado.celda),
              { estructura: firma, resultado },
            ]),
          ),
        }));
        setProgreso({
          hechas,
          total: elegidas.length,
          estado: "EN_CURSO",
          estructura: firma,
        });
      }
    } catch (e) {
      if (ejecucion.current.montado) setError(mensajeErrorTarifa(e));
    } finally {
      ejecucion.current.activa = false;
      if (ejecucion.current.montado)
        setProgreso({
          estructura: firma,
          hechas,
          total: elegidas.length,
          estado: hechas === elegidas.length ? "FINALIZADA" : "DETENIDA",
        });
    }
  }

  function abrir(c: Celda) {
    const ref = referenciaDe(c);
    setDetalle(c);
    setCantidad(ref.cantidadReferencia ?? "");
    setPerfilId(ref.perfilCadId ?? "AUTO");
    setGeometria(
      ref.geometriaCad
        ? {
            ancho: String(ref.geometriaCad.anchoMm),
            alto: String(ref.geometriaCad.altoMm),
            copias: String(ref.geometriaCad.copias),
          }
        : { ancho: "", alto: "", copias: "1" },
    );
  }
  function guardarReferencia() {
    if (!detalle) return;
    const n = cantidad.trim().replace(",", ".");
    if (n && !/^\d+(\.\d+)?$/.test(n)) {
      setError("La cantidad de referencia debe ser un número positivo.");
      return;
    }
    const personalizada =
      geometria.ancho.trim() !== "" || geometria.alto.trim() !== "";
    const geo = {
      anchoMm: Number(geometria.ancho.replace(",", ".")),
      altoMm: Number(geometria.alto.replace(",", ".")),
      copias: Number(geometria.copias),
    };
    if (
      personalizada &&
      (!(geo.anchoMm > 0 && geo.anchoMm <= 100000) ||
        !(geo.altoMm > 0 && geo.altoMm <= 100000) ||
        !Number.isInteger(geo.copias) ||
        geo.copias < 1 ||
        geo.copias > 10000)
    ) {
      setError(
        "Usá medidas positivas de hasta 100.000 mm y entre 1 y 10.000 copias.",
      );
      return;
    }
    const clave = claveCeldaSimulacion(detalle);
    setReferencias((prev) => ({
      ...prev,
      [clave]: {
        seccion: detalle.seccion,
        fila: detalle.fila,
        tramo: detalle.tramo,
        ...(n && !personalizada ? { cantidadReferencia: n } : {}),
        ...(detalle.seccion === "cad"
          ? {
              ...(perfilId !== "AUTO" ? { perfilCadId: perfilId } : {}),
              ...(personalizada ? { geometriaCad: geo } : {}),
            }
          : {}),
      },
    }));
    setResultados((prev) => {
      const copia = { ...prev };
      delete copia[clave];
      return copia;
    });
    setError(null);
    setDetalle(null);
  }

  function verEscenario(
    escenario: EscenarioSimulado,
    seccion: Celda["seccion"],
  ) {
    let comparacion: ReturnType<typeof compararSimulacion> | null = null;
    try {
      if (normalizado)
        comparacion = compararSimulacion(normalizado, seccion, escenario);
    } catch {
      /* Edición incompleta: no mostrar un margen previo. */
    }
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{escenario.cobertura}</Badge>
          <span>
            {escenario.cantidadReferencia}{" "}
            {escenario.unidad === "HOJA"
              ? "hojas"
              : escenario.unidad === "CARILLA"
                ? "carillas"
                : "ML consumidos"}
          </span>
          <span className="text-muted-foreground">
            {fecha(escenario.calculadoEl)}
          </span>
        </div>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Costo productivo</dt>
            <dd className="font-medium tabular-nums">
              {dinero(escenario.costoTotal)}{" "}
              <span className="font-normal">
                ({dinero(escenario.costoUnitario)} /{" "}
                {escenario.unidad.toLowerCase()})
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Venta sin IVA</dt>
            <dd className="font-medium tabular-nums">
              {comparacion?.composicion.total
                ? dinero(comparacion.composicion.total.neto)
                : "Precio pendiente o incompleto"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Margen productivo</dt>
            <dd
              className={`font-medium tabular-nums ${comparacion?.costoSuperaVenta ? "text-destructive" : ""}`}
            >
              {comparacion?.utilidad != null
                ? `${dinero(comparacion.utilidad)}${comparacion.margenPorcentaje != null ? ` · ${comparacion.margenPorcentaje}%` : " · porcentaje no definido"}`
                : "Sin verificar"}
            </dd>
          </div>
        </dl>
        {escenario.avisos.map((aviso) => (
          <p className="text-amber-700 dark:text-amber-400" key={aviso}>
            {aviso}
          </p>
        ))}
        <details>
          <summary className="cursor-pointer text-muted-foreground">
            Referencia y composición
          </summary>
          <div className="mt-2 space-y-1 text-muted-foreground">
            <p>{escenario.referencia}</p>
            <p>
              Cantidad facturable: {escenario.cantidadFacturable}{" "}
              {escenario.unidad}. IVA resuelto: {escenario.ivaPorcentaje}%.
            </p>
            {comparacion && (
              <p>
                Preparación:{" "}
                {dinero(
                  comparacion.composicion.preparacion.importeEnConvencion ??
                    "0",
                )}{" "}
                · Ajuste por mínimo:{" "}
                {comparacion.composicion.minimo.importeEnConvencion == null
                  ? "pendiente"
                  : dinero(
                      comparacion.composicion.minimo.importeEnConvencion,
                    )}{" "}
                · Total con IVA:{" "}
                {comparacion.composicion.total
                  ? dinero(comparacion.composicion.total.total)
                  : "pendiente"}
                .
              </p>
            )}
            {escenario.trazas.map((t, i) => (
              <p key={i}>Período de costos: {t.periodo}.</p>
            ))}
          </div>
        </details>
      </div>
    );
  }
  const compatibleCad =
    detalle?.seccion === "cad"
      ? perfiles.filter((p) => {
          const c = contenido.cad!.filas[detalle.fila].combinacion;
          return (
            p.papelMateriaPrimaId === c.papelMateriaPrimaId &&
            p.gramaje === c.gramaje &&
            p.color === c.color &&
            p.rollo.anchoRolloMm === c.anchoRolloMm
          );
        })
      : [];
  const errores = Object.values(resultados)
    .filter((r) => r.estructura === estructura)
    .flatMap((r) => r.resultado.escenarios)
    .filter((e) => e.estado === "ERROR").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Simular costos de la matriz</CardTitle>
        <CardDescription>
          Compará los precios con pedidos de referencia. Incluye papel,
          impresión y preparación productiva; las terminaciones se cotizan
          aparte.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Cada celda usa una cantidad dentro de su tramo. El margen compara la
          venta sin IVA con el costo productivo del motor, antes de comisiones y
          otros gastos comerciales. Los costos corresponden al momento de la
          simulación, también al consultar una versión histórica.
        </p>
        {estructura !== estructuraGuardada && (
          <Alert>
            <AlertTitle>Guardá las combinaciones antes de simular</AlertTitle>
            <AlertDescription>
              Los precios, la preparación y el mínimo se pueden editar para
              comparar con el costo ya calculado. Los cambios de estructura
              necesitan una nueva simulación.
            </AlertDescription>
          </Alert>
        )}
        <TextoTarifa
          etiqueta="Filtrar simulación"
          valor={filtro}
          onChange={(v) => {
            setFiltro(v);
            setPagina(0);
          }}
          placeholder="Papel, tamaño, caras, cobertura o CAD"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!habilitada || !celdas.length}
            onClick={() => void simular(celdas)}
          >
            <Play data-icon="inline-start" />
            Simular matriz ({celdas.length})
          </Button>
          <Button
            variant="outline"
            disabled={!habilitada || !filtradas.length}
            onClick={() => void simular(filtradas)}
          >
            Simular filtradas ({filtradas.length})
          </Button>
          <Button
            variant="outline"
            disabled={
              !habilitada ||
              !celdas.some((c) => seleccion.has(claveCeldaSimulacion(c)))
            }
            onClick={() =>
              void simular(
                celdas.filter((c) => seleccion.has(claveCeldaSimulacion(c))),
              )
            }
          >
            Simular selección ({seleccion.size})
          </Button>
          {ocupada && (
            <Button
              variant="outline"
              onClick={() => {
                ejecucion.current.detener = true;
              }}
            >
              <Square data-icon="inline-start" />
              Detener al terminar el lote
            </Button>
          )}
        </div>
        {progreso && (
          <p role="status" className="text-sm">
            {progreso.estructura !== estructura
              ? "Resultados de una estructura anterior"
              : progreso.estado === "EN_CURSO"
                ? "Simulando"
                : progreso.estado === "DETENIDA"
                  ? "Simulación parcial"
                  : "Recorrido finalizado"}
            : {progreso.hechas} de {progreso.total} celdas procesadas.{" "}
            {errores > 0
              ? `${errores} escenarios con error; sus márgenes siguen sin verificar.`
              : "Revisá la cobertura y la fecha de cada resultado."}
          </p>
        )}
        <ErrorTarifa error={error} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">Elegir</TableHead>
              <TableHead>Combinación y tramo</TableHead>
              <TableHead>Precio unitario</TableHead>
              <TableHead className="text-right">Referencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.map((c) => {
              const clave = claveCeldaSimulacion(c);
              const guardadoCelda = resultados[clave];
              const vigente = guardadoCelda?.estructura === estructura;
              return (
                <Fragment key={clave}>
                  <TableRow>
                    <TableCell>
                      <Checkbox
                        aria-label={`Seleccionar ${c.etiqueta}, desde ${c.desde}`}
                        disabled={ocupada}
                        checked={seleccion.has(clave)}
                        onCheckedChange={(checked) =>
                          setSeleccion((prev) => {
                            const next = new Set(prev);
                            if (checked) next.add(clave);
                            else next.delete(clave);
                            return next;
                          })
                        }
                      />
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <p className="font-medium">{c.etiqueta}</p>
                      <p className="text-xs text-muted-foreground">
                        Desde {c.desde}
                        {c.hasta
                          ? ` hasta menos de ${c.hasta}`
                          : " en adelante"}{" "}
                        {c.seccion === "cad"
                          ? "ML"
                          : contenido.hojas!.reglas.unidad === "HOJA"
                            ? "hojas"
                            : "carillas"}
                      </p>
                    </TableCell>
                    <TableCell className="min-w-36 max-w-44">
                      <TextoTarifa
                        etiqueta={`Precio de venta, desde ${c.desde}`}
                        valor={
                          contenido[c.seccion]!.filas[c.fila].precios.find(
                            (p) =>
                              claveRango(p.desdeCantidad) ===
                              claveRango(c.desde),
                          )?.precioUnitario ?? ""
                        }
                        disabled={!onChange}
                        placeholder="Pendiente"
                        onChange={(valor) => {
                          if (!onChange) return;
                          const next = structuredClone(contenido);
                          const matriz = next[c.seccion]!;
                          const fila = matriz.filas[c.fila];
                          const precio = fila.precios.find(
                            (p) =>
                              claveRango(p.desdeCantidad) ===
                              claveRango(c.desde),
                          );
                          if (precio) precio.precioUnitario = valor || null;
                          else if (c.seccion === "hojas")
                            next.hojas!.filas[c.fila].precios.push({
                              desdeCantidad: Number(c.desde),
                              precioUnitario: valor || null,
                            });
                          else
                            next.cad!.filas[c.fila].precios.push({
                              desdeCantidad: c.desde,
                              precioUnitario: valor || null,
                            });
                          onChange(next);
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={ocupada}
                        onClick={() => abrir(c)}
                      >
                        Ajustar referencia
                      </Button>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="whitespace-normal bg-muted/20"
                    >
                      <div className="space-y-4 py-2 text-sm">
                        {vigente ? (
                          guardadoCelda.resultado.escenarios.map((e) => (
                            <div key={e.cobertura}>
                              {e.estado === "ERROR" ? (
                                <p className="text-destructive">
                                  {e.cobertura}: {e.motivo} Margen sin
                                  verificar.
                                </p>
                              ) : (
                                verEscenario(e, c.seccion)
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-muted-foreground">
                            {guardadoCelda
                              ? "La referencia cambió. Volvé a simular para comparar."
                              : "Sin simular. El precio puede estar pendiente y aun así se puede calcular su costo."}
                          </p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                </Fragment>
              );
            })}
            {!visibles.length && (
              <TableRow>
                <TableCell colSpan={4}>
                  No hay celdas para este filtro.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {filtradas.length > TAMANO_PAGINA && (
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={numPagina === 0}
              onClick={() => setPagina(numPagina - 1)}
            >
              Anterior
            </Button>
            <span className="text-sm">
              Página {numPagina + 1} de{" "}
              {Math.ceil(filtradas.length / TAMANO_PAGINA)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={(numPagina + 1) * TAMANO_PAGINA >= filtradas.length}
              onClick={() => setPagina(numPagina + 1)}
            >
              Siguiente
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Resultados temporales: se pierden al salir de este tarifario. Editar
          precios actualiza la comparación, sin modificar el costo ni su fecha.
          Volvé a simular cuando cambien tus costos. Una simulación no publica
          precios ni autoriza ventas con pérdida.
        </p>
      </CardContent>
      <Dialog
        open={!!detalle}
        onOpenChange={(open) => {
          if (!open) setDetalle(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pedido de referencia</DialogTitle>
            <DialogDescription>
              {detalle?.etiqueta}. El consumo real debe quedar dentro del tramo
              seleccionado.
            </DialogDescription>
          </DialogHeader>
          <TextoTarifa
            etiqueta="Cantidad de referencia"
            valor={cantidad}
            onChange={setCantidad}
            placeholder={
              detalle?.desde === "0"
                ? "Automática: cantidad positiva del primer tramo"
                : `Inicio del tramo: ${detalle?.desde}`
            }
            ayuda="Dejá vacío para usar el inicio del tramo. En CAD se mide el papel consumido; con medidas personalizadas se obtiene desde esas medidas."
          />
          {detalle?.seccion === "cad" && (
            <div className="space-y-3">
              <Elegir
                etiqueta="Configuración CAD de referencia"
                valor={perfilId}
                onChange={setPerfilId}
                opciones={[
                  {
                    value: "AUTO",
                    label: "Automática si hay una sola compatible",
                  },
                  ...compatibleCad.map((p) => ({
                    value: p.id,
                    label: `${p.maquinaNombre} · ${p.productoNombre} · ${p.materialNombre}`,
                  })),
                ]}
              />
              <p className="text-sm text-muted-foreground">
                Opcional: indicá las medidas del plano y sus copias. Si las
                dejás vacías se usa el ancho útil del rollo y un largo que
                represente la cantidad elegida.
              </p>
              <div className="grid grid-cols-3 gap-3">
                <TextoTarifa
                  etiqueta="Ancho (mm)"
                  valor={geometria.ancho}
                  onChange={(ancho) => setGeometria({ ...geometria, ancho })}
                />
                <TextoTarifa
                  etiqueta="Largo (mm)"
                  valor={geometria.alto}
                  onChange={(alto) => setGeometria({ ...geometria, alto })}
                />
                <TextoTarifa
                  etiqueta="Copias"
                  valor={geometria.copias}
                  onChange={(copias) => setGeometria({ ...geometria, copias })}
                />
              </div>
            </div>
          )}
          <ErrorTarifa error={error} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetalle(null)}>
              Cancelar
            </Button>
            <Button onClick={guardarReferencia}>Guardar referencia</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
