"use client";

import * as React from "react";
import {
  Building2Icon,
  FolderTreeIcon,
  PencilIcon,
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
  createPlanta,
  eliminarCentroCosto,
  getCentrosCosto,
  getPlantas,
  getResumenCentrosCosto,
  toggleCentroCosto,
  togglePlanta,
  updatePlanta,
} from "@/lib/costos-api";
import { formatearMoneda, type Moneda } from "@/lib/moneda";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import {
  CentroCosto,
  getCurrentPeriodo,
  Planta,
  type ResumenCentroCostoFila,
  type ResumenCentrosCosto,
  type PlantaPayload,
} from "@/lib/costos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import { CentroCostoFicha } from "@/components/costos/centro-costo-ficha";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent } from "@/components/ui/tabs";

type CostosPanelProps = {
  initialPlantas: Planta[];
  initialCentros: CentroCosto[];
};

function createEmptyPlanta(): PlantaPayload {
  return {
    codigo: "",
    nombre: "",
    descripcion: "",
  };
}



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
  initialPlantas,
  initialCentros,
}: CostosPanelProps) {
  const { moneda } = useConfigRegional();
  const [plantas, setPlantas] = React.useState(initialPlantas);

  const [centros, setCentros] = React.useState(initialCentros);
  const [activeTab, setActiveTab] = React.useState("plantas");
  const [selectedCentro, setSelectedCentro] = React.useState<CentroCosto | null>(null);
  const [centroAEliminar, setCentroAEliminar] = React.useState<CentroCosto | null>(null);
  const [isConfiguratorOpen, setIsConfiguratorOpen] = React.useState(false);
  const [configuracionRefreshKey, setConfiguracionRefreshKey] = React.useState(0);
  const [editingPlantaId, setEditingPlantaId] = React.useState<string | null>(null);

  const [plantaForm, setPlantaForm] = React.useState<PlantaPayload>(createEmptyPlanta);

  const [isReloading, startReloading] = React.useTransition();
  const [isSaving, startSaving] = React.useTransition();
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
    if (activeTab !== "centros") return;
    void cargarResumen(periodoResumen);
  }, [activeTab, periodoResumen, cargarResumen, configuracionRefreshKey]);





  const reloadAll = React.useCallback(() => {
    startReloading(async () => {
      try {
        const [nextPlantas, nextCentros] = await Promise.all([
          getPlantas(),
          getCentrosCosto(),
        ]);

        setPlantas(nextPlantas);
        setCentros(nextCentros);
        setSelectedCentro((current) =>
          current
            ? nextCentros.find((centro) => centro.id === current.id) ?? current
            : current,
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo refrescar costos.");
      }
    });
  }, []);

  const handlePlantSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    startSaving(async () => {
      try {
        if (editingPlantaId) {
          await updatePlanta(editingPlantaId, plantaForm);
          toast.success("Planta actualizada.");
        } else {
          await createPlanta(plantaForm);
          toast.success("Planta creada.");
        }

        setEditingPlantaId(null);
        setPlantaForm(createEmptyPlanta());
        reloadAll();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo guardar la planta.");
      }
    });
  };



  const handleTogglePlanta = (id: string) => {
    startSaving(async () => {
      try {
        await togglePlanta(id);
        reloadAll();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "No se pudo cambiar la planta.",
        );
      }
    });
  };


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
            Las plantas y los centros de costo con los que se costea la gráfica. Cada centro es una planilla que se carga a mano.
          </div>
        </div>
        <button type="button" className="btn cc-refresh" onClick={reloadAll}>
          <RefreshCcwIcon size={14} className={isReloading ? "animate-spin" : undefined} />
          Refrescar
        </button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="cc-tabs">
          <button
            type="button"
            className={`cc-tab ${activeTab === "plantas" ? "active" : ""}`}
            onClick={() => setActiveTab("plantas")}
          >
            Plantas
          </button>
          <button
            type="button"
            className={`cc-tab ${activeTab === "centros" ? "active" : ""}`}
            onClick={() => setActiveTab("centros")}
          >
            Centros
          </button>
        </div>

            <TabsContent value="plantas" className="flex flex-col gap-6">
              <Card className="rounded-2xl border-border/70 shadow-none">
                <CardHeader>
                  <CardTitle className="text-lg">Plantas</CardTitle>
                  <CardDescription>
                    Una planta representa una sede o establecimiento productivo del
                    tenant actual.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="flex flex-col gap-4" onSubmit={handlePlantSubmit}>
                    <FieldGroup className="grid gap-4 lg:grid-cols-3">
                      <Field>
                        <FieldLabel htmlFor="planta-codigo">Codigo</FieldLabel>
                        <Input
                          id="planta-codigo"
                          value={plantaForm.codigo}
                          onChange={(event) =>
                            setPlantaForm((current) => ({
                              ...current,
                              codigo: event.target.value,
                            }))
                          }
                          placeholder="PLT-001"
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="planta-nombre">Nombre</FieldLabel>
                        <Input
                          id="planta-nombre"
                          value={plantaForm.nombre}
                          onChange={(event) =>
                            setPlantaForm((current) => ({
                              ...current,
                              nombre: event.target.value,
                            }))
                          }
                          placeholder="Planta principal"
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="planta-descripcion">Descripcion</FieldLabel>
                        <Input
                          id="planta-descripcion"
                          value={plantaForm.descripcion ?? ""}
                          onChange={(event) =>
                            setPlantaForm((current) => ({
                              ...current,
                              descripcion: event.target.value,
                            }))
                          }
                          placeholder="Observaciones"
                        />
                      </Field>
                    </FieldGroup>

                    <div className="flex gap-2">
                      <Button type="submit" variant="brand">
                        {isSaving ? <GdiSpinner className="size-4" /> : <PlusIcon />}
                        {editingPlantaId ? "Guardar cambios" : "Nueva planta"}
                      </Button>
                      {editingPlantaId ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setEditingPlantaId(null);
                            setPlantaForm(createEmptyPlanta());
                          }}
                        >
                          Cancelar
                        </Button>
                      ) : null}
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border/70 shadow-none">
                <CardContent className="px-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="px-4">Nombre</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="w-40">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plantas.map((planta) => (
                        <TableRow key={planta.id}>
                          <TableCell className="px-4 font-medium">{planta.nombre}</TableCell>
                          <TableCell>
                            <Badge variant={planta.activa ? "secondary" : "outline"}>
                              {planta.activa ? "Activa" : "Inactiva"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingPlantaId(planta.id);
                                  setPlantaForm({
                                    codigo: planta.codigo,
                                    nombre: planta.nombre,
                                    descripcion: planta.descripcion,
                                  });
                                  setActiveTab("plantas");
                                }}
                              >
                                <PencilIcon />
                                Editar
                              </Button>
                              <Button
                                variant="sidebar"
                                size="sm"
                                onClick={() => handleTogglePlanta(planta.id)}
                              >
                                {planta.activa ? "Inactivar" : "Activar"}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="centros" className="cost-centers-tab">
              <div className="wiz-section centros-form-section">
                <div className="wiz-section-head">
                  <div className="body">
                    <h2>Centros de costo</h2>
                    <div className="helptext">
                      Cada centro es una planilla que se carga a mano: gastos
                      generales, empleados y activos fijos. No se toma nada de
                      otros módulos.
                    </div>
                  </div>
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
                            <div className="desc mono-desc">
                              {fila.codigo}
                              {fila.lineas > 0
                                ? ` · ${fila.lineas} ${fila.lineas === 1 ? "línea" : "líneas"}`
                                : " · sin cargar"}
                            </div>
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

              <div className="kpi-row">
                <div className="kpi-card">
                  <div className="lbl">
                    <Building2Icon />
                    Plantas
                  </div>
                  <div className="val">{plantas.length}</div>
                </div>
                <div className="kpi-card">
                  <div className="lbl">
                    <FolderTreeIcon />
                    Centros activos
                  </div>
                  <div className="val">
                    {centros.filter((item) => item.activo).length}
                  </div>
                </div>
              </div>
        </TabsContent>
      </Tabs>
      <CentroCostoFicha
        open={isConfiguratorOpen}
        onOpenChange={(next) => {
          setIsConfiguratorOpen(next);
          if (!next) setSelectedCentro(null);
        }}
        centro={selectedCentro}
        plantas={plantas}
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
