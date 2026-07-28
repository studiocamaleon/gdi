"use client";

import * as React from "react";
import {
  PlusIcon,
  PowerIcon,
  RefreshCcwIcon,
  SearchIcon,
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
  getCurrentPeriodo,
  type ResumenCentroCostoFila,
  type ResumenCentrosCosto,
} from "@/lib/costos";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import { CentroCostoFicha } from "@/components/costos/centro-costo-ficha";

type CostosPanelProps = {
  initialCentros: CentroCosto[];
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
}: CostosPanelProps) {
  const { moneda } = useConfigRegional();

  const [centros, setCentros] = React.useState(initialCentros);
  const [selectedCentro, setSelectedCentro] = React.useState<CentroCosto | null>(null);
  const [centroAEliminar, setCentroAEliminar] = React.useState<CentroCosto | null>(null);
  const [isConfiguratorOpen, setIsConfiguratorOpen] = React.useState(false);
  const [configuracionRefreshKey, setConfiguracionRefreshKey] = React.useState(0);




  const [isReloading, startReloading] = React.useTransition();
  const [, startSaving] = React.useTransition();

  const [periodoResumen, setPeriodoResumen] = React.useState(getCurrentPeriodo);
  const [busquedaCentros, setBusquedaCentros] = React.useState("");
  const [resumen, setResumen] = React.useState<ResumenCentrosCosto | null>(null);
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

  const repartoCuadra =
    Math.abs(totalesResumen.absorbido - totalesResumen.prorrateado) < 0.01;

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
        const nextCentros = await getCentrosCosto();
        setCentros(nextCentros);
        setSelectedCentro((current) =>
          current
            ? (nextCentros.find((centro) => centro.id === current.id) ?? current)
            : current,
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo refrescar costos.");
      }
    });
  }, []);






  const handleToggleCentro = (id: string) => {
    startSaving(async () => {
      try {
        await toggleCentroCosto(id);
        reloadAll();
        setConfiguracionRefreshKey((current) => current + 1);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "No se pudo cambiar el centro.",
        );
      }
    });
  };

  const handleEliminarCentro = (centro: CentroCosto) => {
    setCentroAEliminar(centro);
  };

  return (
    <div className="content cost-centers-content">
      <div className="page-head cc-page-head">
        <div className="title-block">
          <h1>Centros de costo</h1>
          <div className="sub">
            Cada centro es una planilla que se carga a mano: gastos generales, empleados y activos fijos.
          </div>
        </div>
        <button type="button" className="btn cc-refresh" onClick={reloadAll}>
          <RefreshCcwIcon size={14} className={isReloading ? "animate-spin" : undefined} />
          Refrescar
        </button>
      </div>

              <div className="ccosto-toolbar">
                <div className="ccosto-buscador">
                  <SearchIcon />
                  <input
                    type="search"
                    placeholder="Búsqueda"
                    value={busquedaCentros}
                    onChange={(event) => setBusquedaCentros(event.target.value)}
                    aria-label="Buscar centro de costo"
                  />
                </div>
                <label className="ccosto-periodo">
                  <span>Período</span>
                  <input
                    type="month"
                    value={periodoResumen}
                    onChange={(event) =>
                      setPeriodoResumen(event.target.value || getCurrentPeriodo())
                    }
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setSelectedCentro(null);
                    setIsConfiguratorOpen(true);
                  }}
                >
                  <PlusIcon />
                  Añadir centro de costo
                </button>
              </div>

              <div className="card tbl-scroll centros-costo-table-card">
                <table className="tbl centros-costo-table ccosto-tabla">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th className="right">Horas productivas</th>
                      <th className="right">Gastos</th>
                      <th className="right">Absorbido</th>
                      <th className="right">Prorrateado</th>
                      <th className="right">Gasto total</th>
                      <th className="right">Valor de la hora</th>
                      <th className="right sticky-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingResumen && filasResumen.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="ccosto-vacio">
                          <GdiSpinner className="size-4" />
                        </td>
                      </tr>
                    ) : null}
                    {!isLoadingResumen && filasResumen.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="ccosto-vacio">
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
                            <div className="name">{fila.nombre}</div>
                          </td>
                          <td className="right numeric">
                            {fila.horasProductivas == null
                              ? "—"
                              : new Intl.NumberFormat("es-AR", {
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 2,
                                }).format(fila.horasProductivas)}
                          </td>
                          <td className="right numeric">
                            {formatMoneyOrDash(fila.gastos, moneda) ?? "—"}
                          </td>
                          <td className="right numeric muted-value">
                            {fila.absorbido > 0
                              ? formatMoneyOrDash(fila.absorbido, moneda)
                              : "—"}
                          </td>
                          <td className="right numeric muted-value">
                            {repartePorEntero
                              ? formatMoneyOrDash(fila.prorrateado, moneda)
                              : "—"}
                          </td>
                          <td className="right numeric">
                            {formatMoneyOrDash(fila.gastoTotal, moneda) ?? "—"}
                          </td>
                          <td className="right numeric strong-value">
                            {fila.valorHora == null
                              ? "—"
                              : formatMoneyOrDash(fila.valorHora, moneda)}
                          </td>
                          <td className="right sticky-right">
                            <span className="centros-actions">
                              <button
                                type="button"
                                className="btn btn-primary configure-cost-btn"
                                onClick={() => {
                                  if (!centro) return;
                                  setSelectedCentro(centro);
                                  setIsConfiguratorOpen(true);
                                }}
                              >
                                <SlidersHorizontalIcon />
                                Configurar
                              </button>
                              <button
                                type="button"
                                className="icon-btn"
                                title="Inactivar"
                                aria-label={`Inactivar ${fila.nombre}`}
                                onClick={() => handleToggleCentro(fila.id)}
                              >
                                <PowerIcon />
                              </button>
                              <button
                                type="button"
                                className="icon-btn"
                                title="Eliminar"
                                aria-label={`Eliminar ${fila.nombre}`}
                                onClick={() => {
                                  if (centro) handleEliminarCentro(centro);
                                }}
                              >
                                <Trash2Icon />
                              </button>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="centros-totales-row">
                      <td colSpan={2}>
                        Total · {filasResumen.length}{" "}
                        {filasResumen.length === 1 ? "centro" : "centros"}
                      </td>
                      <td className="right numeric">
                        {formatMoneyOrDash(totalesResumen.gastos, moneda) ?? "—"}
                      </td>
                      <td className="right numeric muted-value">
                        {formatMoneyOrDash(totalesResumen.absorbido, moneda) ?? "—"}
                      </td>
                      <td className="right numeric muted-value">
                        {formatMoneyOrDash(totalesResumen.prorrateado, moneda) ?? "—"}
                      </td>
                      <td className="right numeric strong-value">
                        {formatMoneyOrDash(totalesResumen.gastoTotal, moneda) ?? "—"}
                      </td>
                      <td className="right numeric" />
                      <td className="right sticky-right" />
                    </tr>
                    {/* Lo que sale de los centros de estructura tiene que entrar
                        entero a los productivos. Si las dos columnas no dan
                        igual, el reparto perdió plata en el camino. */}
                    {totalesResumen.prorrateado > 0 ? (
                      <tr className="ccosto-cuadre">
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

      <CentroCostoFicha
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
      <ConfirmacionDestructiva
        open={centroAEliminar !== null}
        onOpenChange={(open) => {
          if (!open) setCentroAEliminar(null);
        }}
        titulo="Eliminar centro de costo"
        descripcion={`¿Eliminar definitivamente el centro "${centroAEliminar?.nombre ?? ""}"?`}
        impacto={[
          "Se borran también sus tarifas y recursos de cada período.",
          "Esta acción no se puede deshacer.",
        ]}
        nombreItem={centroAEliminar?.nombre}
        requiereTipear={false}
        accionLabel="Eliminar"
        onConfirmar={() => {
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
                error instanceof Error ? error.message : "No se pudo eliminar el centro.",
              );
            }
          });
        }}
      />
    </div>
  );
}
