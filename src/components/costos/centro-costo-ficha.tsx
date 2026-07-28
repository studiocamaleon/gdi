"use client";

import * as React from "react";
import { PlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { GdiSpinner } from "@/components/brand/gdi-spinner";
import {
  calcularTarifaCentroCosto,
  createCentroCosto,
  getCentroCostoConfiguracion,
  getCentroCostoTarifas,
  publicarTarifaCentroCosto,
  replaceCentroCostoLineas,
  updateCentroCosto,
  upsertCentroCostoCapacidad,
} from "@/lib/costos-api";
import {
  categoriaComponenteCostoItems,
  CentroCosto,
  CentroCostoLinea,
  CentroCostoLineaPayload,
  CentroCostoPayload,
  CentroCostoTarifaPeriodo,
  type CategoriaComponenteCostoCentro,
  getCategoriaComponenteCostoLabel,
  getCurrentPeriodo,
  getTipoCentroLabel,
  SeccionCentroCostoLinea,
  tipoCentroItems,
  type TipoCentroCosto,
} from "@/lib/costos";
import { formatearMoneda } from "@/lib/moneda";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { Button } from "@/components/ui/button";
import { ConfirmacionSalida } from "@/components/ui/confirmacion-salida";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/**
 * La ficha del centro de costo con carga manual.
 *
 * Reemplaza al configurador anterior, que derivaba los números de la nómina y
 * de la ficha de máquina. Acá el centro es una planilla: tres secciones de
 * texto libre y un número de horas. Ver
 * docs/centros-de-costo-carga-manual-diseno.md
 *
 * Un mismo componente sirve para el alta (los cinco bloques en una sola vista)
 * y para la edición (cuatro solapas), porque las tres secciones son las mismas
 * en los dos casos.
 */

type LineaLocal = {
  /** Sólo para el key de React: la fila no existe en el servidor hasta guardar. */
  key: string;
  seccion: SeccionCentroCostoLinea;
  nombre: string;
  categoria: string;
  // gasto general
  valorMensual: string;
  // empleado
  ocupacion: string;
  salarioMensual: string;
  cargasPct: string;
  dedicacionPct: string;
  // activo fijo
  vidaUtilRestanteMeses: string;
  valorActual: string;
  valorFinalVida: string;
};

type Tab = "datos" | "gastos" | "ajustes" | "historial";

const SECCIONES: {
  seccion: SeccionCentroCostoLinea;
  titulo: string;
  ayuda: string;
}[] = [
  {
    seccion: "gasto_general",
    titulo: "Gastos generales mensuales",
    ayuda:
      "Lo que el sector gasta todos los meses: energía, alquiler prorrateado, insumos de uso general.",
  },
  {
    seccion: "empleado",
    titulo: "Gastos de empleados",
    ayuda:
      "Las personas que trabajan en el sector. Se carga el sueldo completo de cada una y qué parte de su tiempo le dedica al centro: el centro absorbe esa proporción, no el sueldo entero.",
  },
  {
    seccion: "activo_fijo",
    titulo: "Depreciación de los activos fijos",
    ayuda:
      "Máquinas y herramientas. La depreciación mensual sale del valor actual menos el valor al final de la vida, dividido por los meses que le quedan.",
  },
];

let contadorFilas = 0;
function nuevaLinea(seccion: SeccionCentroCostoLinea): LineaLocal {
  contadorFilas += 1;
  return {
    key: `nueva-${contadorFilas}`,
    seccion,
    nombre: "",
    categoria: seccion === "activo_fijo" ? "amortizacion" : "otros",
    valorMensual: "",
    ocupacion: "",
    salarioMensual: "",
    cargasPct: "",
    // Las filas nuevas arrancan en 100%: el default queda a la vista en vez de
    // estar escondido en el cálculo.
    dedicacionPct: seccion === "empleado" ? "100" : "",
    vidaUtilRestanteMeses: "",
    valorActual: "",
    valorFinalVida: "",
  };
}

function desdeServidor(linea: CentroCostoLinea): LineaLocal {
  contadorFilas += 1;
  const texto = (valor: number | null) =>
    valor == null ? "" : String(valor);
  return {
    key: linea.id,
    seccion: linea.seccion,
    nombre: linea.nombre,
    categoria: linea.categoria ?? "otros",
    valorMensual:
      linea.seccion === "gasto_general" ? String(linea.importeMensual) : "",
    ocupacion: linea.ocupacion ?? "",
    salarioMensual: texto(linea.salarioMensual),
    cargasPct: texto(linea.cargasPct),
    dedicacionPct: texto(linea.dedicacionPct),
    vidaUtilRestanteMeses: texto(linea.vidaUtilRestanteMeses),
    valorActual: texto(linea.valorActual),
    valorFinalVida: texto(linea.valorFinalVida),
  };
}

const numero = (valor: string) => {
  const parsed = Number(valor.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * La misma aritmética que aplica el servidor. Acá existe sólo para que el
 * usuario vea el total mientras tipea; el número que se guarda lo calcula el
 * backend a partir de los campos, no de esto.
 */
function importeDeLinea(linea: LineaLocal): number {
  if (linea.seccion === "empleado") {
    // Ausente = 100%: una fila sin dedicación cargada cuesta lo que costaba.
    const dedicacion =
      linea.dedicacionPct.trim() === "" ? 100 : numero(linea.dedicacionPct);
    return (
      Math.round(
        numero(linea.salarioMensual) *
          (1 + numero(linea.cargasPct) / 100) *
          (dedicacion / 100) *
          100,
      ) / 100
    );
  }
  if (linea.seccion === "activo_fijo") {
    const vida = numero(linea.vidaUtilRestanteMeses);
    if (vida <= 0) return 0;
    return (
      Math.round(
        ((numero(linea.valorActual) - numero(linea.valorFinalVida)) / vida) *
          100,
      ) / 100
    );
  }
  return numero(linea.valorMensual);
}

function aPayload(linea: LineaLocal): CentroCostoLineaPayload {
  const base = {
    seccion: linea.seccion,
    nombre: linea.nombre.trim(),
    categoria: linea.categoria
      ? (linea.categoria as CentroCostoLineaPayload["categoria"])
      : undefined,
  };
  if (linea.seccion === "empleado") {
    return {
      ...base,
      ocupacion: linea.ocupacion.trim() || undefined,
      dedicacionPct: linea.dedicacionPct
        ? numero(linea.dedicacionPct)
        : undefined,
      salarioMensual: numero(linea.salarioMensual),
      cargasPct: numero(linea.cargasPct),
    };
  }
  if (linea.seccion === "activo_fijo") {
    return {
      ...base,
      vidaUtilRestanteMeses: numero(linea.vidaUtilRestanteMeses),
      valorActual: numero(linea.valorActual),
      valorFinalVida: numero(linea.valorFinalVida),
    };
  }
  return { ...base, valorMensual: numero(linea.valorMensual) };
}

type CentroCostoFichaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = alta. */
  centro: CentroCosto | null;
  periodo?: string;
  onSaved: () => Promise<void> | void;
};

export function CentroCostoFicha({
  open,
  onOpenChange,
  centro,
  periodo: periodoInicial,
  onSaved,
}: CentroCostoFichaProps) {
  const { moneda } = useConfigRegional();
  const fmt = (valor: number) => formatearMoneda(valor, moneda, { decimales: 2 });
  const esAlta = centro === null;

  const [periodo, setPeriodo] = React.useState(
    periodoInicial ?? getCurrentPeriodo(),
  );
  const [tab, setTab] = React.useState<Tab>("datos");
  const [nombre, setNombre] = React.useState("");
  const [tipoCentro, setTipoCentro] =
    React.useState<TipoCentroCosto>("productivo");
  const [horasProductivas, setHorasProductivas] = React.useState("");
  const [lineas, setLineas] = React.useState<LineaLocal[]>([]);
  const [absorbido, setAbsorbido] = React.useState(0);
  const [tarifas, setTarifas] = React.useState<CentroCostoTarifaPeriodo[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [sucio, setSucio] = React.useState(false);
  const [confirmandoSalida, setConfirmandoSalida] = React.useState(false);

  const marcar = React.useCallback(() => setSucio(true), []);

  const cargar = React.useCallback(async () => {
    if (!centro) {
      setNombre("");
      setTipoCentro("productivo");
      setHorasProductivas("");
      setLineas([]);
      setAbsorbido(0);
      setTarifas([]);
      setSucio(false);
      return;
    }
    setIsLoading(true);
    try {
      const [detalle, historial] = await Promise.all([
        getCentroCostoConfiguracion(centro.id, periodo),
        getCentroCostoTarifas(centro.id),
      ]);
      setNombre(detalle.centro.nombre);
      setTipoCentro(detalle.centro.tipoCentro);
      setHorasProductivas(
        detalle.capacidad ? String(detalle.capacidad.horasProductivas) : "",
      );
      setLineas(detalle.lineas.map(desdeServidor));
      setAbsorbido(detalle.repartoAbsorbido?.total ?? 0);
      setTarifas(historial);
      setSucio(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo cargar el centro.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [centro, periodo]);

  React.useEffect(() => {
    if (!open) return;
    setTab("datos");
    void cargar();
  }, [open, cargar]);

  const porSeccion = React.useMemo(
    () => ({
      gasto_general: lineas.filter((l) => l.seccion === "gasto_general"),
      empleado: lineas.filter((l) => l.seccion === "empleado"),
      activo_fijo: lineas.filter((l) => l.seccion === "activo_fijo"),
    }),
    [lineas],
  );

  const gastoPrincipal = React.useMemo(
    () => lineas.reduce((acc, linea) => acc + importeDeLinea(linea), 0),
    [lineas],
  );
  const gastoTotal = gastoPrincipal + absorbido;
  const horas = numero(horasProductivas);

  const valorHora = horas > 0 ? gastoTotal / horas : null;

  const agregar = (seccion: SeccionCentroCostoLinea) => {
    setLineas((actuales) => [...actuales, nuevaLinea(seccion)]);
    marcar();
  };

  const quitar = (key: string) => {
    setLineas((actuales) => actuales.filter((linea) => linea.key !== key));
    marcar();
  };

  const editar = (key: string, campo: keyof LineaLocal, valor: string) => {
    // Nadie dedica el 140% de su tiempo. Se acota acá y no sólo en el DTO
    // porque un 400 del servidor al guardar llega tarde y sin decir en qué
    // fila; que el número se frene solo al tipear se entiende sin leer nada.
    const acotado =
      campo === "dedicacionPct" && numero(valor) > 100 ? "100" : valor;
    setLineas((actuales) =>
      actuales.map((linea) =>
        linea.key === key ? { ...linea, [campo]: acotado } : linea,
      ),
    );
    marcar();
  };

  const guardar = async () => {
    if (!nombre.trim()) {
      toast.error("El centro necesita un nombre.");
      return;
    }
    const sinNombre = lineas.find((linea) => !linea.nombre.trim());
    if (sinNombre) {
      toast.error("Hay una línea sin nombre.");
      return;
    }

    setIsSaving(true);
    try {
      let centroId = centro?.id ?? "";

      if (esAlta) {
        // El área y la categoría gráfica ya no se piden: el backend resuelve
        // un área por defecto de la planta.
        const payload: CentroCostoPayload = {
          codigo: nombre.trim().slice(0, 12).toUpperCase().replace(/\s+/g, "-"),
          nombre: nombre.trim(),
          descripcion: "",
          tipoCentro,
          activo: true,
        } as CentroCostoPayload;
        const creado = await createCentroCosto(payload);
        centroId = creado.id;
      } else {
        await updateCentroCosto(centro.id, {
          codigo: centro.codigo,
          nombre: nombre.trim(),
          descripcion: centro.descripcion,
          tipoCentro,
          activo: centro.activo,
        } as CentroCostoPayload);
      }

      await replaceCentroCostoLineas(centroId, periodo, lineas.map(aPayload));
      if (horas > 0) {
        await upsertCentroCostoCapacidad(centroId, periodo, {
          horasProductivas: horas,
        });
      }
      // Deja el borrador al día con lo que se acaba de cargar, para que el
      // listado y el motor no queden mirando un cálculo viejo.
      await calcularTarifaCentroCosto(centroId, periodo);

      setSucio(false);
      toast.success(esAlta ? "Centro creado." : "Centro guardado.");
      await onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo guardar el centro.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const publicar = async () => {
    if (!centro) return;
    setIsSaving(true);
    try {
      await publicarTarifaCentroCosto(centro.id, periodo);
      toast.success("Tarifa publicada.");
      await cargar();
      await onSaved();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo publicar.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const pedirCierre = (siguiente: boolean) => {
    if (siguiente) {
      onOpenChange(true);
      return;
    }
    if (sucio) {
      setConfirmandoSalida(true);
      return;
    }
    onOpenChange(false);
  };

  const renderSeccion = (
    seccion: SeccionCentroCostoLinea,
    titulo: string,
    ayuda: string,
  ) => {
    const filas = porSeccion[seccion];
    const subtotal = filas.reduce((acc, fila) => acc + importeDeLinea(fila), 0);

    return (
      <section className="ccosto-seccion" key={seccion}>
        <header className="ccosto-seccion-head">
          <h3>{titulo}</h3>
          <p>{ayuda}</p>
        </header>

        <div className="ccosto-filas">
          <div className={`ccosto-fila ccosto-fila-head ccosto-fila-${seccion}`}>
            <span>Nombre</span>
            {seccion === "gasto_general" ? (
              <>
                <span>Tipo de gasto</span>
                <span className="ccosto-num">Valor</span>
              </>
            ) : null}
            {seccion === "empleado" ? (
              <>
                <span>Ocupación</span>
                <span
                  className="ccosto-num"
                  title="Qué parte del sueldo paga este centro. Alguien repartido entre dos centros va 75% acá y 25% allá, y ninguno lo paga entero."
                >
                  Dedicación
                </span>
                <span className="ccosto-num">Salario + benef.</span>
                <span className="ccosto-num">Cargas %</span>
                <span className="ccosto-num">Costo total</span>
              </>
            ) : null}
            {seccion === "activo_fijo" ? (
              <>
                <span className="ccosto-num">Vida útil restante</span>
                <span className="ccosto-num">Valor actual</span>
                <span className="ccosto-num">Valor al final</span>
                <span className="ccosto-num">Depreciación mes</span>
              </>
            ) : null}
            <span />
          </div>

          {filas.map((fila) => (
            <div
              className={`ccosto-fila ccosto-fila-${seccion}`}
              key={fila.key}
            >
              <input
                value={fila.nombre}
                placeholder={
                  seccion === "empleado"
                    ? "Nombre de la persona"
                    : seccion === "activo_fijo"
                      ? "Nombre del activo"
                      : "Nombre del gasto"
                }
                onChange={(event) =>
                  editar(fila.key, "nombre", event.target.value)
                }
              />

              {seccion === "gasto_general" ? (
                <>
                  <Select
                    value={fila.categoria}
                    onValueChange={(valor) =>
                      editar(fila.key, "categoria", valor ?? "otros")
                    }
                  >
                    <SelectTrigger className="ccosto-select">
                      <SelectValue>
                        {(valor: string) =>
                          getCategoriaComponenteCostoLabel(
                            valor as CategoriaComponenteCostoCentro,
                          )
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {categoriaComponenteCostoItems
                        .filter(
                          (item) =>
                            item.value !== "sueldos" && item.value !== "cargas",
                        )
                        .map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {getCategoriaComponenteCostoLabel(item.value)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <input
                    className="ccosto-num"
                    inputMode="decimal"
                    value={fila.valorMensual}
                    placeholder="0,00"
                    onChange={(event) =>
                      editar(fila.key, "valorMensual", event.target.value)
                    }
                  />
                </>
              ) : null}

              {seccion === "empleado" ? (
                <>
                  <input
                    value={fila.ocupacion}
                    placeholder="Ocupación"
                    onChange={(event) =>
                      editar(fila.key, "ocupacion", event.target.value)
                    }
                  />
                  {/* Qué parte del sueldo paga este centro. NO se traduce a
                      horas: las del centro son la suma de lo que aportan
                      todos, y aplicarle a esa suma el % de una persona da un
                      número que no es ni sus horas ni nada —con dos personas
                      al 75% mostraba 198 h a cada una sobre un centro de 264—.
                      Lo que el % sí produce se ve en "Costo total" de la fila. */}
                  <div className="ccosto-dedicacion">
                    {/* El % va como unidad fija dentro del campo y no como
                        placeholder: un placeholder desaparece al tipear, justo
                        cuando el usuario necesita saber en qué está midiendo. */}
                    <div className="ccosto-dedicacion-campo">
                      <input
                        className="ccosto-num"
                        inputMode="decimal"
                        value={fila.dedicacionPct}
                        placeholder="0"
                        min={0}
                        max={100}
                        aria-label="Porcentaje de dedicación (0 a 100)"
                        onChange={(event) =>
                          editar(fila.key, "dedicacionPct", event.target.value)
                        }
                      />
                      <span className="ccosto-dedicacion-unidad">%</span>
                    </div>
                  </div>
                  <input
                    className="ccosto-num"
                    inputMode="decimal"
                    value={fila.salarioMensual}
                    placeholder="0,00"
                    onChange={(event) =>
                      editar(fila.key, "salarioMensual", event.target.value)
                    }
                  />
                  <input
                    className="ccosto-num"
                    inputMode="decimal"
                    value={fila.cargasPct}
                    placeholder="%"
                    onChange={(event) =>
                      editar(fila.key, "cargasPct", event.target.value)
                    }
                  />
                  <input
                    className="ccosto-num ccosto-calculado"
                    value={fmt(importeDeLinea(fila))}
                    disabled
                    readOnly
                  />
                </>
              ) : null}

              {seccion === "activo_fijo" ? (
                <>
                  <input
                    className="ccosto-num"
                    inputMode="numeric"
                    value={fila.vidaUtilRestanteMeses}
                    placeholder="Mes(es)"
                    onChange={(event) =>
                      editar(
                        fila.key,
                        "vidaUtilRestanteMeses",
                        event.target.value,
                      )
                    }
                  />
                  <input
                    className="ccosto-num"
                    inputMode="decimal"
                    value={fila.valorActual}
                    placeholder="0,00"
                    onChange={(event) =>
                      editar(fila.key, "valorActual", event.target.value)
                    }
                  />
                  <input
                    className="ccosto-num"
                    inputMode="decimal"
                    value={fila.valorFinalVida}
                    placeholder="0,00"
                    onChange={(event) =>
                      editar(fila.key, "valorFinalVida", event.target.value)
                    }
                  />
                  <input
                    className="ccosto-num ccosto-calculado"
                    value={fmt(importeDeLinea(fila))}
                    disabled
                    readOnly
                  />
                </>
              ) : null}

              <button
                type="button"
                className="ccosto-quitar"
                title="Quitar"
                aria-label={`Quitar ${fila.nombre || "la línea"}`}
                onClick={() => quitar(fila.key)}
              >
                <XIcon />
              </button>
            </div>
          ))}
        </div>

        <footer className="ccosto-seccion-foot">
          <button
            type="button"
            className="ccosto-agregar"
            onClick={() => agregar(seccion)}
          >
            <PlusIcon />
            Agregar
          </button>
          <span className="ccosto-subtotal">= {fmt(subtotal)}</span>
        </footer>
      </section>
    );
  };

  const bloqueResumen = (
    <section className="ccosto-resumen">
      <h3>Resumen</h3>
      <div className="ccosto-resumen-grid">
        <div>
          <span className="ccosto-lbl">Empleados</span>
          <strong>{porSeccion.empleado.length}</strong>
        </div>
        <div>
          <span className="ccosto-lbl">Horas productivas</span>
          <strong>{horas > 0 ? horas : "—"}</strong>
        </div>
        <div>
          <span className="ccosto-lbl">Gasto principal</span>
          <strong>{fmt(gastoPrincipal)}</strong>
        </div>
        <div>
          <span className="ccosto-lbl">Total prorrateado</span>
          <strong>{fmt(absorbido)}</strong>
        </div>
        <div>
          <span className="ccosto-lbl">Gasto total</span>
          <strong>{fmt(gastoTotal)}</strong>
        </div>
        <div>
          <span className="ccosto-lbl">Valor de la hora</span>
          <strong className="ccosto-destacado">
            {valorHora == null ? "—" : fmt(valorHora)}
          </strong>
        </div>
      </div>
    </section>
  );

  const bloqueIdentidad = (
    <section className="ccosto-seccion">
      <header className="ccosto-seccion-head">
        <h3>Introduzca el nombre y el tipo</h3>
      </header>
      <div className="ccosto-identidad">
        <label>
          <span>Nombre *</span>
          <input
            value={nombre}
            onChange={(event) => {
              setNombre(event.target.value);
              marcar();
            }}
            placeholder="Acabado y montaje"
          />
        </label>
        <label>
          <span>Tipo *</span>
          {/* Son dos y se excluyen: mostrarlos como botones deja la decisión a
              la vista en vez de esconderla detrás de un desplegable. */}
          <div className="ccosto-segmentado" role="group">
            {tipoCentroItems.map((item) => (
              <button
                key={item.value}
                type="button"
                className={tipoCentro === item.value ? "activo" : ""}
                aria-pressed={tipoCentro === item.value}
                onClick={() => {
                  setTipoCentro(item.value);
                  marcar();
                }}
              >
                {getTipoCentroLabel(item.value)}
              </button>
            ))}
          </div>
          <span className="ccosto-ayuda">
            {tipoCentro === "productivo"
              ? "Produce lo que se vende: tiene valor hora y absorbe parte de la estructura."
              : "Es estructura: su costo se reparte entre los centros productivos y no tiene valor hora."}
          </span>
        </label>
      </div>
    </section>
  );

  return (
    <>
      <Sheet open={open} onOpenChange={pedirCierre}>
        <SheetContent
          side="right"
          className="ccosto-ficha !w-[min(1080px,96vw)] !max-w-none"
        >
          <SheetHeader>
            <SheetTitle>
              {esAlta ? "Insertar nuevo centro de costo" : "Centro de costos"}
            </SheetTitle>
            <SheetDescription>
              {esAlta
                ? "Cargá a mano lo que gasta el sector: no se toma nada de otros módulos."
                : `${centro?.nombre} · período ${periodo}`}
            </SheetDescription>
          </SheetHeader>

          {!esAlta ? (
            <nav className="ccosto-tabs">
              {(
                [
                  ["datos", "Datos generales"],
                  ["gastos", "Gastos"],
                  ["ajustes", "Ajustes"],
                  ["historial", "Historial"],
                ] as [Tab, string][]
              ).map(([valor, etiqueta]) => (
                <button
                  key={valor}
                  type="button"
                  className={`ccosto-tab ${tab === valor ? "activa" : ""}`}
                  onClick={() => setTab(valor)}
                >
                  {etiqueta}
                </button>
              ))}
            </nav>
          ) : null}

          <div className="ccosto-cuerpo">
            {isLoading ? (
              <div className="ccosto-cargando">
                <GdiSpinner className="size-5" />
              </div>
            ) : esAlta ? (
              <>
                {bloqueIdentidad}
                {SECCIONES.map((item) =>
                  renderSeccion(item.seccion, item.titulo, item.ayuda),
                )}
                {bloqueResumen}
              </>
            ) : (
              <>
                {tab === "datos" ? (
                  <>
                    {bloqueIdentidad}
                    {bloqueResumen}
                  </>
                ) : null}

                {tab === "gastos"
                  ? SECCIONES.map((item) =>
                      renderSeccion(item.seccion, item.titulo, item.ayuda),
                    )
                  : null}

                {tab === "ajustes" ? (
                  <section className="ccosto-seccion">
                    <header className="ccosto-seccion-head">
                      <h3>Ajustes del período</h3>
                      <p>
                        Las horas productivas se cargan a mano: son las horas
                        que el sector realmente puede producir en el mes, y son
                        las que dividen el gasto para dar el valor de la hora.
                        Se suman las de todos: dos personas que le dedican 6 h
                        por día son 12 h por día, no 6. Y si acá entran al 75%,
                        estas horas son ese 75% —el mismo criterio de los dos
                        lados de la cuenta.
                      </p>
                    </header>
                    <div className="ccosto-identidad">
                      <label>
                        <span>Período</span>
                        <input
                          type="month"
                          value={periodo}
                          onChange={(event) =>
                            setPeriodo(event.target.value || getCurrentPeriodo())
                          }
                        />
                      </label>
                      <label>
                        <span>Horas productivas</span>
                        <input
                          inputMode="decimal"
                          value={horasProductivas}
                          placeholder="176"
                          onChange={(event) => {
                            setHorasProductivas(event.target.value);
                            marcar();
                          }}
                        />
                      </label>
                    </div>
                  </section>
                ) : null}

                {tab === "historial" ? (
                  <section className="ccosto-seccion">
                    <header className="ccosto-seccion-head">
                      <h3>Historial de tarifas</h3>
                      <p>
                        Cada período queda congelado al publicarse: es lo que
                        impide que una orden vieja cambie de costo.
                      </p>
                    </header>
                    {tarifas.length === 0 ? (
                      <p className="ccosto-vacio">
                        Todavía no se publicó ninguna tarifa.
                      </p>
                    ) : (
                      <table className="ccosto-historial">
                        <thead>
                          <tr>
                            <th>Período</th>
                            <th>Estado</th>
                            <th className="ccosto-num">Costo mensual</th>
                            <th className="ccosto-num">Horas</th>
                            <th className="ccosto-num">Valor hora</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tarifas.map((tarifa) => (
                            <tr key={tarifa.id}>
                              <td>{tarifa.periodo}</td>
                              <td>{tarifa.estado}</td>
                              <td className="ccosto-num">
                                {fmt(tarifa.costoMensualTotal)}
                              </td>
                              <td className="ccosto-num">
                                {tarifa.capacidadPractica}
                              </td>
                              <td className="ccosto-num">
                                {fmt(tarifa.tarifaCalculada)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </section>
                ) : null}
              </>
            )}
          </div>

          <SheetFooter className="ccosto-acciones">
            {!esAlta && tab === "historial" ? (
              <Button variant="outline" onClick={publicar} disabled={isSaving}>
                Publicar tarifa del período
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => pedirCierre(false)}>
              Cancelar
            </Button>
            {/* Sin cambios no hay nada que guardar: el botón lo dice en vez
                de aceptar un click que no hace nada. En un alta siempre está
                habilitado —la ficha entera es el cambio—. */}
            <Button
              onClick={guardar}
              disabled={isSaving || isLoading || (!esAlta && !sucio)}
              title={esAlta || sucio ? undefined : "No hay cambios para guardar"}
            >
              {isSaving ? <GdiSpinner className="size-4" /> : null}
              Guardar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmacionSalida
        open={confirmandoSalida}
        cambios={1}
        donde="este centro de costo"
        guardando={isSaving}
        onGuardarYSalir={async () => {
          setConfirmandoSalida(false);
          await guardar();
        }}
        onDescartarYSalir={() => {
          setConfirmandoSalida(false);
          setSucio(false);
          onOpenChange(false);
        }}
        onSeguirEditando={() => setConfirmandoSalida(false)}
      />
    </>
  );
}
