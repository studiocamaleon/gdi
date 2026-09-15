"use client";

import * as React from "react";
import {
  PlusIcon,
  PowerIcon,
  RefreshCcwIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { GdiSpinner } from "@/components/brand/gdi-spinner";
import {
  eliminarCentroCosto,
  getCentrosCosto,
  getResumenCentrosCosto,
  toggleCentroCosto,
} from "@/lib/costos-api";
import { formatearMoneda, type Moneda } from "@/lib/moneda";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import {
  CentroCosto,
  getPeriodoEnZona,
  type ResumenCentroCostoFila,
  type ResumenCentrosCosto,
} from "@/lib/costos";
import { CentroCostoFicha } from "@/components/costos/centro-costo-ficha";
import { Card, Input, Modal, SearchField } from "@heroui/react";
import { ActionButton as Button } from "@/components/design-system/action-button";
import { FormDialog } from "@/components/design-system/form-dialog";
import { useDesignScope } from "@/components/design-system/appearance";
import theme from "@/components/design-system/theme.module.css";
import listPage from "@/components/design-system/list-page.module.css";
import focus from "@/components/design-system/field-focus.module.css";
import styles from "./centros-costo.module.css";

type CostosPanelProps = {
  initialCentros: CentroCosto[];
  puedeGestionar: boolean;
};

function formatPeriodoCorto(periodo: string) {
  const [anio, mes] = periodo.split("-");
  return anio && mes ? `${mes}/${anio}` : periodo;
}

function formatMoneyOrDash(value: number | null | undefined, moneda: Moneda) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return formatearMoneda(value, moneda, { decimales: 0 });
}

export function CostosPanel({
  initialCentros,
  puedeGestionar,
}: CostosPanelProps) {
  const scope = useDesignScope();
  const { moneda, zonaHoraria } = useConfigRegional();

  const [centros, setCentros] = React.useState(initialCentros);
  const [selectedCentro, setSelectedCentro] =
    React.useState<CentroCosto | null>(null);
  const [centroAEliminar, setCentroAEliminar] =
    React.useState<CentroCosto | null>(null);
  const [isConfiguratorOpen, setIsConfiguratorOpen] = React.useState(false);
  const [configuracionRefreshKey, setConfiguracionRefreshKey] =
    React.useState(0);

  const [isReloading, startReloading] = React.useTransition();
  const [, startSaving] = React.useTransition();

  const [periodoResumen, setPeriodoResumen] = React.useState(() =>
    getPeriodoEnZona(zonaHoraria),
  );
  const [busquedaCentros, setBusquedaCentros] = React.useState("");
  const [resumen, setResumen] = React.useState<ResumenCentrosCosto | null>(
    null,
  );
  const [isLoadingResumen, setIsLoadingResumen] = React.useState(false);

  // La fila del resumen trae sólo lo que la tabla muestra; las acciones
  // necesitan el centro completo.
  const centroById = React.useMemo(
    () => new Map(centros.map((centro) => [centro.id, centro])),
    [centros],
  );

  // Las filas que muestra la tabla: los números vivos del período, filtrados
  // por la búsqueda. El orden lo define el backend (por nombre).
  const filasResumen = React.useMemo(() => {
    const filas = resumen?.centros ?? [];
    const termino = busquedaCentros.trim().toLowerCase();
    if (!termino) return filas;
    return filas.filter(
      (fila) =>
        fila.nombre.toLowerCase().includes(termino) ||
        fila.codigo.toLowerCase().includes(termino),
    );
  }, [resumen, busquedaCentros]);

  // Se recalculan sobre las filas visibles y no se toman del backend: si hay
  // una búsqueda activa, los totales tienen que hablar de lo que se está
  // viendo. Sin filtro, absorbido y prorrateado dan igual — es la verificación
  // a ojo de que el reparto no perdió plata.
  const totalesResumen = React.useMemo(() => {
    const sumar = (getValor: (fila: ResumenCentroCostoFila) => number) =>
      filasResumen.reduce((acc, fila) => acc + getValor(fila), 0);
    return {
      gastos: sumar((f) => f.gastos),
      absorbido: sumar((f) => f.absorbido),
      prorrateado: sumar((f) => f.prorrateado),
      gastoTotal: sumar((f) => f.gastoTotal),
    };
  }, [filasResumen]);

  const repartoCuadra = busquedaCentros.trim()
    ? Math.round(totalesResumen.absorbido) ===
      Math.round(totalesResumen.prorrateado)
    : (resumen?.repartoCuadra ?? true);

  const cargarResumen = React.useCallback(async (periodo: string) => {
    setIsLoadingResumen(true);
    try {
      setResumen(await getResumenCentrosCosto(periodo));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo cargar el resumen de centros.",
      );
      setResumen(null);
    } finally {
      setIsLoadingResumen(false);
    }
  }, []);

  React.useEffect(() => {
    void cargarResumen(periodoResumen);
  }, [periodoResumen, cargarResumen, configuracionRefreshKey]);

  const reloadAll = React.useCallback(() => {
    startReloading(async () => {
      try {
        const [nextCentros, nextResumen] = await Promise.all([
          getCentrosCosto(),
          getResumenCentrosCosto(periodoResumen),
        ]);
        setCentros(nextCentros);
        setResumen(nextResumen);
        setSelectedCentro((current) =>
          current
            ? (nextCentros.find((centro) => centro.id === current.id) ??
              current)
            : current,
        );
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "No se pudo refrescar costos.",
        );
      }
    });
  }, [periodoResumen]);

  const handleToggleCentro = (id: string) => {
    startSaving(async () => {
      try {
        await toggleCentroCosto(id, periodoResumen);
        reloadAll();
        setConfiguracionRefreshKey((current) => current + 1);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "No se pudo cambiar el centro.",
        );
      }
    });
  };

  const handleEliminarCentro = (centro: CentroCosto) => {
    setCentroAEliminar(centro);
  };

  return (
    <section
      {...scope}
      className={`${theme.theme} ${listPage.page} ${styles.page}`}
    >
      <header className={listPage.header}>
        <div>
          <h1>Centros de costo</h1>
          <p className={listPage.subtitle}>
            Gastos, capacidad y valor de la hora de cada sector, organizados por
            período.
          </p>
        </div>
        <div className={styles.actions}>
          <Button type="button" variant="outline" onPress={reloadAll}>
            {isReloading ? <GdiSpinner /> : <RefreshCcwIcon />} Refrescar
          </Button>
          {puedeGestionar && (
            <Button
              type="button"
              onPress={() => {
                setSelectedCentro(null);
                setIsConfiguratorOpen(true);
              }}
            >
              <PlusIcon /> Añadir centro de costo
            </Button>
          )}
        </div>
      </header>
      <Card className={listPage.results}>
        <div className={listPage.toolbar}>
          <SearchField
            aria-label="Buscar centro de costo"
            value={busquedaCentros}
            onChange={setBusquedaCentros}
            className={styles.search}
          >
            <SearchField.Group
              className={`${listPage.searchGroup} ${focus.singleBorder}`}
            >
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Nombre o código del centro" />
              <SearchField.ClearButton aria-label="Limpiar búsqueda" />
            </SearchField.Group>
          </SearchField>
          <label className={styles.period}>
            <span>Período</span>
            <Input
              className={focus.singleBorder}
              aria-label="Período del resumen"
              type="month"
              value={periodoResumen}
              onChange={(event) =>
                setPeriodoResumen(
                  event.target.value || getPeriodoEnZona(zonaHoraria),
                )
              }
            />
          </label>
        </div>
        <div className={styles.tableScroll} aria-busy={isLoadingResumen}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th className={styles.number}>Horas productivas</th>
                <th className={styles.number}>Gastos</th>
                <th className={styles.number}>Absorbido</th>
                <th className={styles.number}>Prorrateado</th>
                <th className={styles.number}>Gasto total</th>
                <th className={styles.number}>Valor de la hora</th>
                <th className={`${styles.number} ${styles.sticky}`}>
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoadingResumen && filasResumen.length === 0 ? (
                <tr>
                  <td colSpan={8} className={styles.empty}>
                    <GdiSpinner className="size-4" />
                  </td>
                </tr>
              ) : null}
              {!isLoadingResumen && filasResumen.length === 0 ? (
                <tr>
                  <td colSpan={8} className={styles.empty}>
                    {busquedaCentros.trim()
                      ? "Ningún centro coincide con la búsqueda."
                      : `Todavía no hay centros con datos cargados en ${formatPeriodoCorto(periodoResumen)}.`}
                  </td>
                </tr>
              ) : null}
              {filasResumen.map((fila) => {
                const centro = centroById.get(fila.id);
                // Los centros que reparten su costo entero no tienen valor
                // hora: lo que cuestan ya se cobra dentro de los productivos
                // que los absorbieron.
                const repartePorEntero = fila.prorrateado > 0;

                return (
                  <tr key={fila.id}>
                    <td>
                      <div className={styles.name}>{fila.nombre}</div>
                    </td>
                    <td className={styles.number}>
                      {fila.horasProductivas == null
                        ? "—"
                        : new Intl.NumberFormat("es-AR", {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 2,
                          }).format(fila.horasProductivas)}
                    </td>
                    <td className={styles.number}>
                      {formatMoneyOrDash(fila.gastos, moneda) ?? "—"}
                    </td>
                    <td className={`${styles.number} ${styles.muted}`}>
                      {fila.absorbido > 0
                        ? formatMoneyOrDash(fila.absorbido, moneda)
                        : "—"}
                    </td>
                    <td className={`${styles.number} ${styles.muted}`}>
                      {repartePorEntero
                        ? formatMoneyOrDash(fila.prorrateado, moneda)
                        : "—"}
                    </td>
                    <td className={styles.number}>
                      {formatMoneyOrDash(fila.gastoTotal, moneda) ?? "—"}
                    </td>
                    <td className={`${styles.number} ${styles.strong}`}>
                      {fila.valorHora == null
                        ? "—"
                        : formatMoneyOrDash(fila.valorHora, moneda)}
                    </td>
                    <td className={`${styles.number} ${styles.sticky}`}>
                      {puedeGestionar ? (
                        <span className={styles.actions}>
                          <Button
                            type="button"
                            variant="outline"
                            onPress={() => {
                              if (!centro) return;
                              setSelectedCentro(centro);
                              setIsConfiguratorOpen(true);
                            }}
                          >
                            <SlidersHorizontalIcon />
                            Configurar
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            isIconOnly
                            title="Inactivar"
                            aria-label={`Inactivar ${fila.nombre}`}
                            onPress={() => handleToggleCentro(fila.id)}
                          >
                            <PowerIcon />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            isIconOnly
                            title="Eliminar"
                            aria-label={`Eliminar ${fila.nombre}`}
                            onPress={() => {
                              if (centro) handleEliminarCentro(centro);
                            }}
                          >
                            <Trash2Icon />
                          </Button>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className={styles.totals}>
                <td colSpan={2}>
                  Total · {filasResumen.length}{" "}
                  {filasResumen.length === 1 ? "centro" : "centros"}
                </td>
                <td className={styles.number}>
                  {formatMoneyOrDash(totalesResumen.gastos, moneda) ?? "—"}
                </td>
                <td className={`${styles.number} ${styles.muted}`}>
                  {formatMoneyOrDash(totalesResumen.absorbido, moneda) ?? "—"}
                </td>
                <td className={`${styles.number} ${styles.muted}`}>
                  {formatMoneyOrDash(totalesResumen.prorrateado, moneda) ?? "—"}
                </td>
                <td className={`${styles.number} ${styles.strong}`}>
                  {formatMoneyOrDash(totalesResumen.gastoTotal, moneda) ?? "—"}
                </td>
                <td className={styles.number} />
                <td className={`${styles.number} ${styles.sticky}`} />
              </tr>
              {/* Lo que sale de los centros de estructura tiene que entrar
                        entero a los productivos. Si las dos columnas no dan
                        igual, el reparto perdió plata en el camino. */}
              {totalesResumen.prorrateado > 0 ? (
                <tr className={styles.balance}>
                  <td colSpan={8}>
                    {repartoCuadra
                      ? `El prorrateo cuadra: los ${formatMoneyOrDash(totalesResumen.prorrateado, moneda)} que reparte la estructura entran completos a los centros productivos.`
                      : `El prorrateo no cuadra: se reparten ${formatMoneyOrDash(totalesResumen.prorrateado, moneda)} pero se absorben ${formatMoneyOrDash(totalesResumen.absorbido, moneda)}.`}
                  </td>
                </tr>
              ) : null}
            </tfoot>
          </table>
        </div>
      </Card>

      {puedeGestionar && centros.some((centro) => !centro.activo) ? (
        <section
          className={styles.inactive}
          aria-labelledby="centros-inactivos-titulo"
        >
          <h2 id="centros-inactivos-titulo">Centros inactivos</h2>
          <p>
            Se conservan para no perder su historial. Podés reactivarlos cuando
            vuelvan a utilizarse.
          </p>
          <div className={styles.inactiveList}>
            {centros
              .filter((centro) => !centro.activo)
              .map((centro) => (
                <div key={centro.id} className={styles.inactiveItem}>
                  <span>
                    <strong>{centro.nombre}</strong>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() => handleToggleCentro(centro.id)}
                  >
                    <PowerIcon data-icon="inline-start" />
                    Reactivar
                  </Button>
                </div>
              ))}
          </div>
        </section>
      ) : null}

      <CentroCostoFicha
        key={`${selectedCentro?.id ?? "nuevo"}-${periodoResumen}`}
        open={isConfiguratorOpen}
        onOpenChange={(next) => {
          setIsConfiguratorOpen(next);
          if (!next) setSelectedCentro(null);
        }}
        centro={selectedCentro}
        periodo={periodoResumen}
        onSaved={async () => {
          reloadAll();
          await cargarResumen(periodoResumen);
        }}
      />
      <FormDialog
        isOpen={centroAEliminar !== null}
        onOpenChange={(open) => {
          if (!open) setCentroAEliminar(null);
        }}
        title="Eliminar centro de costo"
        description={`¿Eliminar definitivamente el centro "${centroAEliminar?.nombre ?? ""}"?`}
      >
        <Modal.Body className={styles.confirmBody}>
          <p>
            Sólo se permite si nunca tuvo movimientos, planillas ni tarifas.
          </p>
          <p>Esta acción no se puede deshacer.</p>
        </Modal.Body>
        <Modal.Footer className={styles.confirmFooter}>
          <Button variant="outline" onPress={() => setCentroAEliminar(null)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onPress={() => {
              if (!centroAEliminar) return;
              const centro = centroAEliminar;
              setCentroAEliminar(null);
              startSaving(async () => {
                try {
                  await eliminarCentroCosto(centro.id);
                  toast.success(`Centro "${centro.nombre}" eliminado.`);
                  reloadAll();
                  setConfiguracionRefreshKey((current) => current + 1);
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "No se pudo eliminar el centro.",
                  );
                }
              });
            }}
          >
            <Trash2Icon /> Eliminar
          </Button>
        </Modal.Footer>
      </FormDialog>
    </section>
  );
}
