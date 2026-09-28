"use client";

import * as React from "react";
import {
  ArrowUpRightIcon,
  CalendarDaysIcon,
  Clock3Icon,
  CopyIcon,
  FactoryIcon,
  HistoryIcon,
  NetworkIcon,
  PlusIcon,
  ReceiptTextIcon,
  Settings2Icon,
  UsersRoundIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { GdiSpinner } from "@/components/brand/gdi-spinner";
import {
  getCentroCostoConfiguracion,
  getCentroCostoTarifas,
  guardarCentroCostoPlanilla,
  publicarTarifaCentroCosto,
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
  getPeriodoEnZona,
  periodoAnterior,
  getTipoCentroLabel,
  SeccionCentroCostoLinea,
  tipoCentroItems,
  type TipoCentroCosto,
} from "@/lib/costos";
import { formatearMoneda } from "@/lib/moneda";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { Card, Drawer, Input, Modal, Tabs } from "@heroui/react";
import { ActionButton as Button } from "@/components/design-system/action-button";
import { FormDialog } from "@/components/design-system/form-dialog";
import { NavigationTabList } from "@/components/design-system/navigation-tab-list";
import { SelectField } from "@/components/design-system/select-field";
import { SegmentedControl } from "@/components/design-system/choice-controls";
import {
  useDesignScope,
  useDesignTheme,
} from "@/components/design-system/appearance";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import brand from "@/components/crm/contactos-workspace.module.css";
import sheet from "@/components/design-system/form-sheet.module.css";
import focus from "@/components/design-system/field-focus.module.css";
import styles from "./centros-costo.module.css";

/**
 * La ficha del centro de costo con carga manual.
 *
 * Reemplaza al configurador anterior, que derivaba los números de la nómina y
 * de la ficha de máquina. Acá el centro es una planilla: tres secciones de
 * texto libre y un número de horas. Ver
 * docs/centros-de-costo-carga-manual-diseno.md
 *
 * Alta y edición comparten las cuatro solapas. Las horas productivas deben
 * poder cargarse antes del primer guardado para publicar la tarifa del centro.
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
  const texto = (valor: number | null) => (valor == null ? "" : String(valor));
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
  const scope = useDesignScope();
  const theme = useDesignTheme();
  const descriptionId = React.useId();
  const { moneda, zonaHoraria } = useConfigRegional();
  const fmt = (valor: number) =>
    formatearMoneda(valor, moneda, { decimales: 2 });
  const esAlta = centro === null;

  const [periodo, setPeriodo] = React.useState(
    periodoInicial ?? getPeriodoEnZona(zonaHoraria),
  );
  /**
   * Guardar publica las tarifas del período que se está editando, pero el
   * motor cotiza siempre con el mes en curso. Sólo acá, entonces, lo que se
   * guarda pasa a cotizar en el acto — y el botón tiene que decirlo.
   */
  const esPeriodoEnCurso = periodo === getPeriodoEnZona(zonaHoraria);
  const [tab, setTab] = React.useState<Tab>("datos");
  const [codigo, setCodigo] = React.useState("");
  const [nombre, setNombre] = React.useState("");
  const [tipoCentro, setTipoCentro] =
    React.useState<TipoCentroCosto>("productivo");
  const [horasProductivas, setHorasProductivas] = React.useState("");
  const [lineas, setLineas] = React.useState<LineaLocal[]>([]);
  const [absorbido, setAbsorbido] = React.useState(0);
  const [distribuido, setDistribuido] = React.useState(0);
  const [tarifas, setTarifas] = React.useState<CentroCostoTarifaPeriodo[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [sucio, setSucio] = React.useState(false);
  const [confirmandoSalida, setConfirmandoSalida] = React.useState(false);

  const marcar = React.useCallback(() => setSucio(true), []);

  const cargar = React.useCallback(async () => {
    if (!centro) {
      setCodigo("");
      setNombre("");
      setTipoCentro("productivo");
      setHorasProductivas("");
      setLineas([]);
      setAbsorbido(0);
      setDistribuido(0);
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
      setCodigo(detalle.centro.codigo);
      setNombre(detalle.centro.nombre);
      setTipoCentro(detalle.centro.tipoCentro);
      setHorasProductivas(
        detalle.capacidad ? String(detalle.capacidad.horasProductivas) : "",
      );
      setLineas(detalle.lineas.map(desdeServidor));
      setAbsorbido(detalle.repartoAbsorbido?.total ?? 0);
      setDistribuido(detalle.repartoDistribuido?.total ?? 0);
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

  // Trae la planilla del período anterior al form actual (no la guarda: el
  // usuario revisa y guarda). El motor ya arrastra las tarifas mes a mes solo;
  // esto es para EDITAR partiendo de lo anterior.
  const [copiando, setCopiando] = React.useState(false);
  const copiarDelAnterior = async () => {
    if (!centro?.id) return;
    const anterior = periodoAnterior(periodo);
    setCopiando(true);
    try {
      const detalle = await getCentroCostoConfiguracion(centro.id, anterior);
      if (detalle.lineas.length === 0 && !detalle.capacidad) {
        toast.error(`No hay datos en ${anterior} para copiar.`);
        return;
      }
      setLineas(detalle.lineas.map(desdeServidor));
      setHorasProductivas(
        detalle.capacidad ? String(detalle.capacidad.horasProductivas) : "",
      );
      marcar();
      toast.success(`Copiado de ${anterior}. Revisá y guardá para publicar.`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo copiar el período anterior.",
      );
    } finally {
      setCopiando(false);
    }
  };

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
      const codigoNormalizado = (codigo.trim() || nombre.trim())
        .slice(0, 24)
        .toUpperCase()
        .replace(/\s+/g, "-");
      const resultado = await guardarCentroCostoPlanilla({
        id: centro?.id,
        periodo,
        centro: {
          codigo: codigoNormalizado,
          nombre: nombre.trim(),
          descripcion: centro?.descripcion ?? "",
          tipoCentro,
          activo: centro?.activo ?? true,
        } as CentroCostoPayload,
        lineas: lineas.map(aPayload),
        horasProductivas: tipoCentro === "productivo" ? horas : 0,
        expectedUpdatedAt: centro?.updatedAt,
      });

      setSucio(false);
      const accion = esAlta ? "Centro creado" : "Centro guardado";
      if (resultado.publicacion.centrosPublicados > 0) {
        toast.success(
          `${accion}: se recalcularon ${resultado.publicacion.centrosPublicados} tarifa(s) productiva(s).`,
        );
      } else {
        toast.warning(`${accion}, pero no hay tarifas válidas para publicar.`, {
          description: resultado.advertencias.join(" ") || undefined,
        });
      }
      await onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el centro.",
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
    const SectionIcon =
      seccion === "empleado"
        ? UsersRoundIcon
        : seccion === "activo_fijo"
          ? FactoryIcon
          : ReceiptTextIcon;

    return (
      <Card className={styles.section} key={seccion}>
        <header className={styles.sectionHeader}>
          <span className={styles.sectionIcon} aria-hidden="true">
            <SectionIcon />
          </span>
          <div>
            <h3>{titulo}</h3>
            <p>{ayuda}</p>
          </div>
        </header>

        <div className={styles.rows}>
          <div
            className={`${styles.row} ${styles.rowHeader}`}
            data-section={seccion}
          >
            <span>Nombre</span>
            {seccion === "gasto_general" ? (
              <>
                <span>Tipo de gasto</span>
                <span className={styles.number}>Valor</span>
              </>
            ) : null}
            {seccion === "empleado" ? (
              <>
                <span>Ocupación</span>
                <span
                  className={styles.number}
                  title="Qué parte del sueldo paga este centro. Alguien repartido entre dos centros va 75% acá y 25% allá, y ninguno lo paga entero."
                >
                  Dedicación
                </span>
                <span className={styles.number}>Salario + benef.</span>
                <span className={styles.number}>Cargas %</span>
                <span className={styles.number}>Costo total</span>
              </>
            ) : null}
            {seccion === "activo_fijo" ? (
              <>
                <span className={styles.number}>Vida útil restante</span>
                <span className={styles.number}>Valor actual</span>
                <span className={styles.number}>Valor al final</span>
                <span className={styles.number}>Depreciación mes</span>
              </>
            ) : null}
            <span />
          </div>

          {filas.map((fila) => (
            <div className={styles.row} data-section={seccion} key={fila.key}>
              <Input
                aria-label="Nombre de la línea"
                className={focus.singleBorder}
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
                  <SelectField
                    aria-label={`Tipo de gasto de ${fila.nombre || "la línea"}`}
                    value={fila.categoria}
                    onChange={(valor) =>
                      editar(fila.key, "categoria", valor ?? "otros")
                    }
                    options={[
                      ...categoriaComponenteCostoItems
                        .filter(
                          (item) =>
                            item.value !== "sueldos" && item.value !== "cargas",
                        )
                        .map((item) => ({
                          value: item.value,
                          label: getCategoriaComponenteCostoLabel(item.value),
                        })),
                      ...(fila.categoria === "sueldos" ||
                      fila.categoria === "cargas"
                        ? [
                            {
                              value: fila.categoria,
                              label: getCategoriaComponenteCostoLabel(
                                fila.categoria as CategoriaComponenteCostoCentro,
                              ),
                              disabled: true,
                            },
                          ]
                        : []),
                    ]}
                  />
                  <Input
                    aria-label="Valor mensual"
                    className={`${focus.singleBorder} ${styles.number}`}
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
                  <Input
                    aria-label="Ocupación"
                    className={focus.singleBorder}
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
                  <div className={styles.dedication}>
                    {/* El % va como unidad fija dentro del campo y no como
                        placeholder: un placeholder desaparece al tipear, justo
                        cuando el usuario necesita saber en qué está midiendo. */}
                    <div className={styles.dedicationField}>
                      <Input
                        className={`${focus.singleBorder} ${styles.number}`}
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
                      <span className={styles.unit}>%</span>
                    </div>
                  </div>
                  <Input
                    aria-label="Salario y beneficios"
                    className={`${focus.singleBorder} ${styles.number}`}
                    inputMode="decimal"
                    value={fila.salarioMensual}
                    placeholder="0,00"
                    onChange={(event) =>
                      editar(fila.key, "salarioMensual", event.target.value)
                    }
                  />
                  <Input
                    aria-label="Cargas (%)"
                    className={`${focus.singleBorder} ${styles.number}`}
                    inputMode="decimal"
                    value={fila.cargasPct}
                    placeholder="%"
                    onChange={(event) =>
                      editar(fila.key, "cargasPct", event.target.value)
                    }
                  />
                  <Input
                    aria-label="Costo calculado"
                    className={`${focus.singleBorder} ${`${styles.number} ${styles.calculated}`}`}
                    value={fmt(importeDeLinea(fila))}
                    disabled
                    readOnly
                  />
                </>
              ) : null}

              {seccion === "activo_fijo" ? (
                <>
                  <Input
                    aria-label="Vida útil restante (meses)"
                    className={`${focus.singleBorder} ${styles.number}`}
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
                  <Input
                    aria-label="Valor actual"
                    className={`${focus.singleBorder} ${styles.number}`}
                    inputMode="decimal"
                    value={fila.valorActual}
                    placeholder="0,00"
                    onChange={(event) =>
                      editar(fila.key, "valorActual", event.target.value)
                    }
                  />
                  <Input
                    aria-label="Valor al final de la vida"
                    className={`${focus.singleBorder} ${styles.number}`}
                    inputMode="decimal"
                    value={fila.valorFinalVida}
                    placeholder="0,00"
                    onChange={(event) =>
                      editar(fila.key, "valorFinalVida", event.target.value)
                    }
                  />
                  <Input
                    aria-label="Costo calculado"
                    className={`${focus.singleBorder} ${`${styles.number} ${styles.calculated}`}`}
                    value={fmt(importeDeLinea(fila))}
                    disabled
                    readOnly
                  />
                </>
              ) : null}

              <Button
                type="button"
                variant="ghost"
                isIconOnly
                title="Quitar"
                aria-label={`Quitar ${fila.nombre || "la línea"}`}
                onPress={() => quitar(fila.key)}
              >
                <XIcon />
              </Button>
            </div>
          ))}
        </div>

        {filas.length === 0 && (
          <Empty className={`${brand.empty} ${styles.sectionEmpty}`}>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SectionIcon />
              </EmptyMedia>
              <EmptyTitle>
                {seccion === "empleado"
                  ? "Sin empleados en la planilla"
                  : seccion === "activo_fijo"
                    ? "Sin activos cargados"
                    : "Sin gastos generales"}
              </EmptyTitle>
              <EmptyDescription>
                Agregá una línea para incluir este costo en el período.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        <footer className={styles.sectionFooter}>
          <Button
            type="button"
            variant="outline"
            onPress={() => agregar(seccion)}
          >
            <PlusIcon />
            Agregar
          </Button>
          <span className={styles.subtotal}>
            <span>Subtotal</span> {fmt(subtotal)}
          </span>
        </footer>
      </Card>
    );
  };

  const bloqueResumen = (
    <Card className={styles.summary} aria-label="Resumen del costo del período">
      <div className={styles.summaryHeading}>
        <h3>Costo del período</h3>
        <span>{periodo}</span>
      </div>
      <div className={styles.summaryGrid}>
        <div>
          <span className={styles.label}>Empleados</span>
          <strong>{porSeccion.empleado.length}</strong>
        </div>
        <div>
          <span className={styles.label}>Horas productivas</span>
          <strong>
            {tipoCentro === "productivo" && horas > 0 ? horas : "—"}
          </strong>
        </div>
        <div>
          <span className={styles.label}>Gasto principal</span>
          <strong>{fmt(gastoPrincipal)}</strong>
        </div>
        <div>
          <span className={styles.label}>
            {tipoCentro === "productivo"
              ? "Estructura absorbida"
              : "Estructura distribuida"}
          </span>
          <strong>
            {fmt(tipoCentro === "productivo" ? absorbido : distribuido)}
          </strong>
        </div>
        <div>
          <span className={styles.label}>Gasto total</span>
          <strong>{fmt(gastoTotal)}</strong>
        </div>
        <div className={styles.hourSummary}>
          <span className={styles.label}>Valor de la hora</span>
          <strong className={styles.highlight}>
            {tipoCentro !== "productivo" || valorHora == null
              ? "—"
              : fmt(valorHora)}
          </strong>
        </div>
      </div>
    </Card>
  );

  const bloqueIdentidad = (
    <Card className={styles.section}>
      <header className={styles.sectionHeader}>
        <span className={styles.sectionIcon} aria-hidden="true">
          <FactoryIcon />
        </span>
        <div>
          <h3>Identidad del centro</h3>
          <p>El sector y su función dentro de la estructura de costos.</p>
        </div>
      </header>
      <div className={styles.identity}>
        <label>
          <span>Código *</span>
          <Input
            className={focus.singleBorder}
            value={codigo}
            onChange={(event) => {
              setCodigo(event.target.value);
              marcar();
            }}
            placeholder="ACABADO"
          />
        </label>
        <label>
          <span>Nombre *</span>
          <Input
            className={focus.singleBorder}
            value={nombre}
            onChange={(event) => {
              setNombre(event.target.value);
              marcar();
            }}
            placeholder="Acabado y montaje"
          />
        </label>
        <div className={styles.typeField}>
          <span>Tipo *</span>
          {/* Son dos y se excluyen: mostrarlos como botones deja la decisión a
              la vista en vez de esconderla detrás de un desplegable. */}
          <SegmentedControl
            aria-label="Tipo de centro"
            value={tipoCentro}
            options={tipoCentroItems.map((item) => ({
              value: item.value,
              label: getTipoCentroLabel(item.value),
              icon:
                item.value === "productivo" ? <FactoryIcon /> : <NetworkIcon />,
            }))}
            onChange={(value) => {
              const siguiente = value as TipoCentroCosto | undefined;
              if (!siguiente) return;
              setTipoCentro(siguiente);
              marcar();
            }}
          />
          <span className={styles.help}>
            {tipoCentro === "productivo"
              ? "Produce lo que se vende: tiene valor hora y absorbe parte de la estructura."
              : "Es estructura: su costo se reparte entre los centros productivos y no tiene valor hora."}
          </span>
        </div>
      </div>
    </Card>
  );

  const contenido = (
    <>
      {isLoading ? (
        <div className={styles.loading}>
          <GdiSpinner className="size-5" />
        </div>
      ) : (
        <>
          {tab === "datos" ? (
            <>
              {bloqueResumen}
              {bloqueIdentidad}
            </>
          ) : null}

          {tab === "gastos"
            ? SECCIONES.map((item) =>
                renderSeccion(item.seccion, item.titulo, item.ayuda),
              )
            : null}

          {tab === "ajustes" ? (
            <Card className={styles.section}>
              <header className={styles.sectionHeader}>
                <span className={styles.sectionIcon} aria-hidden="true">
                  <Clock3Icon />
                </span>
                <div>
                  <h3>Ajustes del período</h3>
                  <p>
                    Las horas productivas se cargan a mano: son las horas que el
                    sector realmente puede producir en el mes, y son las que
                    dividen el gasto para dar el valor de la hora. Se suman las
                    de todos: dos personas que le dedican 6 h por día son 12 h
                    por día, no 6. Y si acá entran al 75%, estas horas son ese
                    75% —el mismo criterio de los dos lados de la cuenta.
                  </p>
                </div>
              </header>
              <div className={styles.identity}>
                <label>
                  <span>Período</span>
                  <Input
                    className={focus.singleBorder}
                    type="month"
                    value={periodo}
                    onChange={(event) => {
                      const siguiente =
                        event.target.value || getPeriodoEnZona(zonaHoraria);
                      if (sucio) {
                        toast.info(
                          "Guardá o descartá los cambios antes de cambiar de período.",
                        );
                        return;
                      }
                      setPeriodo(siguiente);
                    }}
                  />
                </label>
                {centro?.id ? (
                  <div className={styles.field}>
                    <span>Arrancar del período anterior</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      isDisabled={copiando || isLoading}
                      onPress={() => void copiarDelAnterior()}
                      title={`Traer la planilla de ${periodoAnterior(periodo)} a este período`}
                    >
                      <CopyIcon data-icon="inline-start" />
                      {copiando
                        ? "Copiando…"
                        : `Copiar de ${periodoAnterior(periodo)}`}
                    </Button>
                  </div>
                ) : null}
                {tipoCentro === "productivo" ? (
                  <label>
                    <span>Horas productivas</span>
                    <Input
                      className={focus.singleBorder}
                      inputMode="decimal"
                      value={horasProductivas}
                      placeholder="176"
                      onChange={(event) => {
                        setHorasProductivas(event.target.value);
                        marcar();
                      }}
                    />
                  </label>
                ) : null}
              </div>
            </Card>
          ) : null}

          {tab === "historial" ? (
            <Card className={styles.section}>
              <header className={styles.sectionHeader}>
                <span className={styles.sectionIcon} aria-hidden="true">
                  <HistoryIcon />
                </span>
                <div>
                  <h3>Historial de tarifas</h3>
                  <p>
                    Se muestra el snapshot vigente de cada período y cuándo fue
                    actualizado. Las órdenes conservan su propio snapshot.
                  </p>
                </div>
              </header>
              {tarifas.length === 0 ? (
                <Empty className={brand.empty}>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <HistoryIcon />
                    </EmptyMedia>
                    <EmptyTitle>Sin tarifas publicadas</EmptyTitle>
                    <EmptyDescription>
                      Las tarifas de cada período aparecerán acá con su revisión
                      y responsable.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className={styles.historyScroll}>
                  <table className={styles.historyTable}>
                    <thead>
                      <tr>
                        <th>Período</th>
                        <th>Revisión</th>
                        <th>Estado</th>
                        <th className={styles.number}>Costo mensual</th>
                        <th className={styles.number}>Horas</th>
                        <th className={styles.number}>Valor hora</th>
                        <th>Actualizada</th>
                        <th>Publicada por</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tarifas.map((tarifa) => (
                        <tr key={tarifa.id}>
                          <td>{tarifa.periodo}</td>
                          <td>
                            {tarifa.revision ? `v${tarifa.revision}` : "—"}
                          </td>
                          <td>{tarifa.estado}</td>
                          <td className={styles.number}>
                            {fmt(tarifa.costoMensualTotal)}
                          </td>
                          <td className={styles.number}>
                            {tipoCentro === "productivo"
                              ? tarifa.capacidadPractica
                              : "—"}
                          </td>
                          <td className={styles.number}>
                            {tipoCentro === "productivo"
                              ? fmt(tarifa.tarifaCalculada)
                              : "—"}
                          </td>
                          <td>
                            {new Date(tarifa.updatedAt).toLocaleString("es-AR")}
                          </td>
                          <td>{tarifa.publicadaPor ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ) : null}
        </>
      )}
    </>
  );
  return (
    <>
      <Drawer.Backdrop
        {...scope}
        className={theme}
        isOpen={open}
        onOpenChange={pedirCierre}
        variant="opaque"
      >
        <Drawer.Content placement="right">
          <Drawer.Dialog
            className={`${sheet.dialog} ${styles.sheet}`}
            aria-describedby={descriptionId}
          >
            <Drawer.Header className={`${sheet.header} ${styles.sheetHeader}`}>
              <div>
                <p className={styles.eyebrow}>
                  Costos · {esAlta ? "Nuevo centro" : "Planilla del sector"}
                </p>
                <Drawer.Heading>
                  {esAlta
                    ? "Nuevo centro de costo"
                    : (centro?.nombre ?? "Centro de costo")}
                  <span className={styles.titleDot}>.</span>
                </Drawer.Heading>
                <p id={descriptionId}>
                  {esAlta ? (
                    "Definí el sector y cargá sus gastos para calcular el valor de la hora."
                  ) : (
                    <>
                      <CalendarDaysIcon aria-hidden="true" /> Período {periodo}{" "}
                      · {getTipoCentroLabel(tipoCentro)}
                    </>
                  )}
                </p>
              </div>
              <Button
                variant="ghost"
                isIconOnly
                aria-label="Cerrar"
                onPress={() => pedirCierre(false)}
              >
                <XIcon />
              </Button>
            </Drawer.Header>
            <Tabs
              selectedKey={tab}
              onSelectionChange={(value) => setTab(value as Tab)}
              className={styles.tabs}
            >
              <NavigationTabList
                label="Configuración del centro"
                className={styles.tabList}
                variant="detailed"
                tone="graphite"
                items={[
                  {
                    id: "datos",
                    label: "Datos generales",
                    description: "Identidad y resumen",
                    icon: <FactoryIcon />,
                  },
                  {
                    id: "gastos",
                    label: "Gastos",
                    description: "Planilla del centro",
                    icon: <ReceiptTextIcon />,
                  },
                  {
                    id: "ajustes",
                    label: "Ajustes",
                    description: "Período y capacidad",
                    icon: <Settings2Icon />,
                  },
                  {
                    id: "historial",
                    label: "Historial",
                    description: "Tarifas publicadas",
                    icon: <HistoryIcon />,
                  },
                ]}
              />
              <Drawer.Body className={`${sheet.body} ${styles.body}`}>
                <Tabs.Panel key={tab} id={tab} className={styles.panel}>
                  {contenido}
                </Tabs.Panel>
              </Drawer.Body>
            </Tabs>
            <Drawer.Footer className={`${sheet.footer} ${styles.footer}`}>
              <span className={styles.saveStatus} data-dirty={sucio}>
                {isLoading
                  ? "Cargando planilla…"
                  : esAlta
                    ? "Nuevo centro"
                    : sucio
                      ? "Cambios sin guardar"
                      : "Sin cambios pendientes"}
              </span>
              {!esAlta && tab === "historial" && tipoCentro === "productivo" ? (
                <Button
                  variant="outline"
                  onPress={publicar}
                  isDisabled={isSaving}
                >
                  Publicar tarifa del período
                </Button>
              ) : null}
              <Button variant="outline" onPress={() => pedirCierre(false)}>
                Cancelar
              </Button>
              {/* Sin cambios no hay nada que guardar: el botón lo dice en vez
                de aceptar un click que no hace nada. En un alta siempre está
                habilitado —la ficha entera es el cambio—.

                Y el botón dice a qué se compromete: guardar recalcula y
                publica las tarifas del período, así que en el mes en curso lo
                que se guarda pasa a cotizar en el acto. En otro mes también se
                publica, pero el motor no lo va a mirar hasta que ese mes
                llegue: para el usuario, ahí sólo está guardando. */}
              <Button
                onPress={guardar}
                isDisabled={isSaving || isLoading || (!esAlta && !sucio)}
                title={
                  esAlta || sucio
                    ? esPeriodoEnCurso
                      ? "Las tarifas del período se recalculan y quedan vigentes para cotizar"
                      : `Las tarifas quedan guardadas en ${periodo}; se usan al cotizar cuando llegue ese mes`
                    : "No hay cambios para guardar"
                }
              >
                {isSaving ? (
                  <GdiSpinner className="size-4" />
                ) : (
                  <ArrowUpRightIcon />
                )}
                {tipoCentro === "productivo" && esPeriodoEnCurso
                  ? "Guardar y publicar"
                  : tipoCentro === "no_productivo"
                    ? "Guardar y recalcular"
                    : "Guardar"}
              </Button>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
      <FormDialog
        className={brand.dialog}
        isOpen={confirmandoSalida}
        onOpenChange={(next) => {
          if (!next && !isSaving) setConfirmandoSalida(false);
        }}
        isDismissable={!isSaving}
        title="Cambios sin guardar"
        description="Tenés 1 cambio sin guardar en este centro de costo. Si salís sin guardar, se descarta."
      >
        <Modal.Footer className={styles.confirmFooter}>
          <Button
            variant="ghost"
            isDisabled={isSaving}
            onPress={() => setConfirmandoSalida(false)}
          >
            Seguir editando
          </Button>
          <Button
            variant="outline"
            isDisabled={isSaving}
            onPress={() => {
              setConfirmandoSalida(false);
              setSucio(false);
              onOpenChange(false);
            }}
          >
            Descartar y salir
          </Button>
          <Button
            isDisabled={isSaving}
            onPress={async () => {
              setConfirmandoSalida(false);
              await guardar();
            }}
          >
            {isSaving ? "Guardando…" : "Guardar y salir"}
          </Button>
        </Modal.Footer>
      </FormDialog>
    </>
  );
}
