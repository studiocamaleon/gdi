"use client";

import { useId, useState, type ReactNode } from "react";
import { Card, Chip, SearchField, Tabs } from "@heroui/react";
import {
  ArrowUpRightIcon,
  ChartNoAxesCombinedIcon,
  FileTextIcon,
  LayersIcon,
  ListFilterIcon,
  PlusIcon,
  SearchXIcon,
  ShapesIcon,
  WalletIcon,
} from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { ActionLink } from "@/components/design-system/action-link";
import { NavigationTabList } from "@/components/design-system/navigation-tab-list";
import { ListMetric } from "@/components/design-system/list-metric";
import { SelectField } from "@/components/design-system/select-field";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableFooter,
} from "@/components/ui/table";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { fechaConDia } from "@/lib/fecha";
import { formatearMoneda, monedaDe } from "@/lib/moneda";
import {
  EGRESO_ESTADO_LABELS,
  NATURALEZA_LABELS,
  type Egreso,
  type ReporteEgresos,
  type PresupuestadoVsReal,
} from "@/lib/egresos";
import { cn } from "@/lib/utils";
import {
  errorRangoAnalisis,
  mesAnalisisEgresos,
  mesCompletoAnalisis,
  type RangoAnalisisEgresos,
} from "@/lib/egresos-periodo";
import { claveFechaEnZona } from "@/lib/zona";
import type { useAnalisisEgresos } from "./use-analisis-egresos";
import listPage from "@/components/design-system/list-page.module.css";
import focus from "@/components/design-system/field-focus.module.css";
import shared from "./cuentas-pagar.module.css";
import s from "./registro-egresos.module.css";

type Props = {
  tab: "todos" | "analisis";
  onTab: (tab: "todos" | "analisis") => void;
  conAnalisis: boolean;
  egresos: Egreso[];
  texto: string;
  onTexto: (texto: string) => void;
  puedeGestionar: boolean;
  cargando: boolean;
  error: string | null;
  analisis: ReturnType<typeof useAnalisisEgresos>;
  conPresupuesto: boolean;
  onReintentar: () => void;
  onAlta: () => void;
  onDetalle: (egreso: Egreso) => void;
};

const ESTADOS = [
  { value: "", label: "Todos los estados" },
  ...Object.entries(EGRESO_ESTADO_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
];

/** Presentación del registro; los pagos y vencimientos pertenecen a Cuentas por pagar. */
export function RegistroEgresosWorkspace(p: Props) {
  const [estado, setEstado] = useState("");
  const visibles = p.egresos.filter(
    (egreso) => !estado || egreso.estado === estado,
  );
  const filtrando = !!p.texto.trim() || !!estado;
  const limpiar = () => {
    p.onTexto("");
    setEstado("");
  };
  const tabs = [
    {
      id: "todos",
      label: "Registro",
      description: "Historial y clasificación",
      icon: <FileTextIcon />,
    },
  ];
  if (p.conAnalisis)
    tabs.push({
      id: "analisis",
      label: "Análisis",
      description: "Composición del período",
      icon: <ChartNoAxesCombinedIcon />,
    });

  return (
    <>
      <header className={listPage.header}>
        <div>
          <p className={shared.eyebrow}>Administración · Egresos</p>
          <h1>
            Registro de egresos<span className={shared.dot}>.</span>
          </h1>
          <p className={cn(listPage.subtitle, s.subtitle)}>
            Consultá y clasificá los egresos registrados, pagados, pendientes o
            anulados.
          </p>
        </div>
        <div className={shared.actions}>
          <ActionLink
            href="/administracion/cuentas-por-pagar"
            variant="outline"
          >
            Cuentas por pagar <ArrowUpRightIcon aria-hidden />
          </ActionLink>
          {p.puedeGestionar && (
            <ActionButton onPress={p.onAlta}>
              <PlusIcon aria-hidden /> Registrar egreso
            </ActionButton>
          )}
        </div>
      </header>
      <Tabs
        selectedKey={p.tab}
        onSelectionChange={(key) => p.onTab(key as Props["tab"])}
        className={shared.tabs}
      >
        <NavigationTabList
          label="Consulta del registro de egresos"
          items={tabs}
          variant="detailed"
          tone="graphite"
        />
        <Tabs.Panel id="todos" className={s.panel}>
          <Card className={shared.results} aria-busy={p.cargando}>
            <Card.Header className={shared.sectionHeader}>
              <span className={shared.sectionIcon}>
                <FileTextIcon aria-hidden />
              </span>
              <div>
                <Card.Title>Historial de egresos</Card.Title>
                <Card.Description>
                  Revisá cada registro, su clasificación y los pagos asociados.
                </Card.Description>
              </div>
            </Card.Header>
            <div className={cn(shared.toolbar, s.toolbar)}>
              <div className={s.filters}>
                <SearchField
                  aria-label="Buscar egresos"
                  value={p.texto}
                  onChange={p.onTexto}
                  className={shared.search}
                >
                  <SearchField.Group
                    className={cn(listPage.searchGroup, focus.singleBorder)}
                  >
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder="Descripción, beneficiario o número…" />
                    <SearchField.ClearButton aria-label="Limpiar búsqueda" />
                  </SearchField.Group>
                </SearchField>
                <SelectField
                  aria-label="Estado del egreso"
                  value={estado}
                  onChange={setEstado}
                  options={ESTADOS}
                  className={s.stateFilter}
                />
              </div>
              <span role="status" className={shared.count}>
                {p.cargando
                  ? "Actualizando…"
                  : `${visibles.length} ${visibles.length === 1 ? "registro" : "registros"}`}
              </span>
            </div>
            {p.error && (
              <ErrorConsulta error={p.error} onReintentar={p.onReintentar} />
            )}
            {visibles.length ? (
              <Table
                className={cn(shared.table, s.table)}
                aria-label="Registro de egresos"
              >
                <TableHeader>
                  <TableRow>
                    <TableHead>Competencia</TableHead>
                    <TableHead>Egreso</TableHead>
                    <TableHead>Beneficiario</TableHead>
                    <TableHead>Clasificación</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead className={shared.number}>Total</TableHead>
                    <TableHead className={shared.number}>Saldo</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibles.map((egreso) => {
                    const fmt = (valor: number) =>
                      formatearMoneda(valor, monedaDe(egreso.moneda));
                    return (
                      <TableRow
                        key={egreso.id}
                        data-anulado={egreso.estado === "anulado" || undefined}
                      >
                        <TableCell className={s.date}>
                          {fechaConDia(egreso.fechaCompetencia)}
                        </TableCell>
                        <TableCell className={shared.descriptionCell}>
                          <button
                            type="button"
                            className={shared.detailLink}
                            onClick={() => p.onDetalle(egreso)}
                          >
                            {egreso.descripcion}
                            <ArrowUpRightIcon aria-hidden />
                          </button>
                          <span className={shared.meta}>{egreso.numero}</span>
                        </TableCell>
                        <TableCell>
                          <span className={s.beneficiary}>
                            {egreso.beneficiarioNombre}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={shared.category}>
                            {egreso.categoriaNombre}
                          </span>
                          <span className={s.secondary}>
                            {egreso.naturaleza &&
                              NATURALEZA_LABELS[egreso.naturaleza]}
                          </span>
                        </TableCell>
                        <TableCell className={s.date}>
                          {egreso.fechaVencimiento ? (
                            fechaConDia(egreso.fechaVencimiento)
                          ) : (
                            <span className={s.muted}>Contado</span>
                          )}
                        </TableCell>
                        <TableCell className={shared.number}>
                          {fmt(egreso.total)}
                        </TableCell>
                        <TableCell
                          className={cn(shared.number, shared.balance)}
                        >
                          {egreso.estado === "anulado" || egreso.saldo <= 0
                            ? "—"
                            : fmt(egreso.saldo)}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="sm"
                            variant="soft"
                            className={s.status}
                            data-estado={egreso.estado}
                          >
                            <i aria-hidden />
                            {EGRESO_ESTADO_LABELS[egreso.estado]}
                          </Chip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              !p.error &&
              (p.cargando ? (
                <Carga />
              ) : (
                <Empty className={shared.empty}>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      {filtrando ? <SearchXIcon /> : <FileTextIcon />}
                    </EmptyMedia>
                    <EmptyTitle>
                      {filtrando
                        ? "No encontramos coincidencias"
                        : "Todavía no hay egresos registrados"}
                    </EmptyTitle>
                    <EmptyDescription>
                      {filtrando
                        ? "Probá con otra búsqueda o cambiá el estado seleccionado."
                        : "Registrá un egreso para consultar su clasificación, comprobantes y pagos desde acá."}
                    </EmptyDescription>
                  </EmptyHeader>
                  {filtrando ? (
                    <ActionButton variant="outline" onPress={limpiar}>
                      Limpiar filtros
                    </ActionButton>
                  ) : (
                    p.puedeGestionar && (
                      <ActionButton variant="outline" onPress={p.onAlta}>
                        <PlusIcon aria-hidden />
                        Registrar egreso
                      </ActionButton>
                    )
                  )}
                </Empty>
              ))
            )}
            <Card.Footer className={shared.legend}>
              El registro incluye egresos pagados y pendientes. Los vencimientos
              y los nuevos pagos se gestionan en Cuentas por pagar.
            </Card.Footer>
          </Card>
        </Tabs.Panel>
        {p.conAnalisis && (
          <Tabs.Panel id="analisis" className={s.panel}>
            <div className={s.analysis} aria-busy={p.analisis.cargando}>
              {p.analisis.rango && (
                <SelectorPeriodoAnalisis
                  rango={p.analisis.rango}
                  cargando={p.analisis.cargando}
                  onConsultar={(rango) => void p.analisis.consultar(rango)}
                />
              )}
              {p.analisis.error ? (
                <ErrorConsulta
                  error={p.analisis.error}
                  onReintentar={() => void p.analisis.consultar()}
                />
              ) : p.analisis.cargando ? (
                <Card className={shared.results}>
                  <Carga />
                </Card>
              ) : (
                <>
                  {p.analisis.errorPresupuesto && (
                    <ErrorConsulta
                      error={p.analisis.errorPresupuesto}
                      onReintentar={() => void p.analisis.consultar()}
                    />
                  )}
                  {p.conPresupuesto &&
                    p.analisis.rango &&
                    !mesCompletoAnalisis(p.analisis.rango) && (
                      <p className={s.periodHint}>
                        Para comparar los gastos fijos con su presupuesto
                        mensual, elegí un mes calendario completo.
                      </p>
                    )}
                  <AnalisisEgresos
                    reporte={p.analisis.reporte}
                    presu={p.analisis.presu}
                  />
                </>
              )}
            </div>
          </Tabs.Panel>
        )}
      </Tabs>
      <nav
        className={s.related}
        aria-label="Configuración de gastos periódicos"
      >
        <span>Gastos periódicos</span>
        <ActionLink href="/administracion/gastos-fijos" variant="ghost">
          Configurar gastos fijos <ArrowUpRightIcon aria-hidden />
        </ActionLink>
        <ActionLink href="/administracion/programaciones" variant="ghost">
          Programaciones anteriores
        </ActionLink>
      </nav>
    </>
  );
}

function ErrorConsulta({
  error,
  onReintentar,
}: {
  error: string;
  onReintentar: () => void;
}) {
  return (
    <Alert variant="destructive" className={shared.notice}>
      <AlertTitle>No pudimos actualizar esta consulta</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
      <ActionButton variant="outline" onPress={onReintentar}>
        Reintentar
      </ActionButton>
    </Alert>
  );
}

function Carga() {
  return (
    <div className={shared.loading} role="status" aria-label="Cargando egresos">
      <Skeleton className={shared.skeleton} />
      <Skeleton className={shared.skeleton} />
      <Skeleton className={shared.skeleton} />
    </div>
  );
}

function SelectorPeriodoAnalisis({
  rango,
  cargando,
  onConsultar,
}: {
  rango: RangoAnalisisEgresos;
  cargando: boolean;
  onConsultar: (rango: RangoAnalisisEgresos) => void;
}) {
  const id = useId();
  const { zonaHoraria } = useConfigRegional();
  const [borrador, setBorrador] = useState(rango);
  const error = errorRangoAnalisis(borrador);
  const elegirMes = (desplazamiento: number) => {
    const mes = mesAnalisisEgresos(
      claveFechaEnZona(new Date(), zonaHoraria),
      desplazamiento,
    );
    setBorrador(mes);
    onConsultar(mes);
  };
  return (
    <Card className={shared.results}>
      <form
        className={s.dateFilters}
        aria-label="Período del análisis"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!error && !cargando) onConsultar(borrador);
        }}
      >
        <div className={s.dateFilterHeading}>
          <div>
            <h2>Período del análisis</h2>
            <p>
              Según la fecha de competencia del egreso, con ambas fechas
              incluidas.
            </p>
          </div>
          <div className={shared.actions}>
            <ActionButton
              type="button"
              variant="outline"
              isDisabled={cargando}
              onPress={() => elegirMes(0)}
            >
              Este mes
            </ActionButton>
            <ActionButton
              type="button"
              variant="outline"
              isDisabled={cargando}
              onPress={() => elegirMes(-1)}
            >
              Mes anterior
            </ActionButton>
          </div>
        </div>
        <FieldGroup className={s.dateFields}>
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor={`${id}-desde`}>Desde</FieldLabel>
            <Input
              id={`${id}-desde`}
              type="date"
              required
              value={borrador.desde}
              max={borrador.hasta || undefined}
              aria-invalid={!!error}
              aria-describedby={error ? `${id}-error` : undefined}
              className={cn(s.dateInput, focus.singleBorder)}
              onChange={(event) =>
                setBorrador({ ...borrador, desde: event.target.value })
              }
            />
          </Field>
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor={`${id}-hasta`}>Hasta</FieldLabel>
            <Input
              id={`${id}-hasta`}
              type="date"
              required
              value={borrador.hasta}
              min={borrador.desde || undefined}
              aria-invalid={!!error}
              aria-describedby={error ? `${id}-error` : undefined}
              className={cn(s.dateInput, focus.singleBorder)}
              onChange={(event) =>
                setBorrador({ ...borrador, hasta: event.target.value })
              }
            />
          </Field>
          <ActionButton type="submit" isPending={cargando} isDisabled={!!error}>
            {cargando ? "Consultando…" : "Aplicar período"}
          </ActionButton>
        </FieldGroup>
        {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
      </form>
    </Card>
  );
}

function AnalisisEgresos({
  reporte,
  presu,
}: {
  reporte: ReporteEgresos | null;
  presu: PresupuestadoVsReal | null;
}) {
  const { moneda } = useConfigRegional();
  const fmt = (v: number) => formatearMoneda(v, moneda);
  if (!reporte)
    return (
      <Card className={shared.results}>
        <Carga />
      </Card>
    );
  if (!reporte.egresos)
    return (
      <Card className={shared.results}>
        <Empty className={shared.empty}>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ChartNoAxesCombinedIcon />
            </EmptyMedia>
            <EmptyTitle>Sin egresos en el período</EmptyTitle>
            <EmptyDescription>
              El análisis agrupa por fecha de competencia: el período al que
              pertenece el gasto, aunque se pague después.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </Card>
    );
  const pct = (v: number) =>
    v.toLocaleString("es-AR", { maximumFractionDigits: 1 });
  const desvio = (v: number) => `${v >= 0 ? "+" : "−"}${fmt(Math.abs(v))}`;

  return (
    <div className={s.analysis}>
      <div className={s.period}>
        <span className={shared.eyebrow}>Análisis por competencia</span>
        <strong>
          {fechaConDia(reporte.desde)} — {fechaConDia(reporte.hasta)}
        </strong>
      </div>
      <div className={s.metrics} aria-label="Resumen del período">
        <div className={shared.totalMetric}>
          <ListMetric
            label="Gasto del período"
            value={fmt(reporte.totalResultado)}
            icon={WalletIcon}
            hint="Costo de producción y gastos de estructura."
          />
        </div>
        <ListMetric
          label="Total registrado"
          value={fmt(reporte.totalSalida)}
          icon={FileTextIcon}
          hint={`${reporte.egresos} ${reporte.egresos === 1 ? "egreso" : "egresos"} · incluye pagados y pendientes.`}
        />
        <ListMetric
          label="Fuera del gasto del período"
          value={fmt(reporte.totalSalida - reporte.totalResultado)}
          icon={LayersIcon}
          hint="Inversión, retiros y adelantos."
        />
      </div>
      <div className={s.breakdowns}>
        <Desglose
          titulo="Por naturaleza"
          descripcion="Cómo se compone el importe registrado."
          icono={<ShapesIcon aria-hidden />}
          lineas={reporte.naturalezas.map((n) => ({
            id: n.naturaleza,
            nombre: NATURALEZA_LABELS[n.naturaleza],
            detalle: n.incideEnResultado
              ? "Incide en el gasto del período"
              : "Fuera del gasto del período",
            porcentaje: n.pct,
            importe: fmt(n.monto),
            neutro: !n.incideEnResultado,
          }))}
        />
        <Desglose
          titulo="Por categoría"
          descripcion="Distribución según la clasificación de cada egreso."
          icono={<ListFilterIcon aria-hidden />}
          lineas={reporte.categorias.map((c) => ({
            id: c.categoriaId,
            nombre: c.nombre,
            detalle: `${c.egresos} ${c.egresos === 1 ? "egreso" : "egresos"}`,
            porcentaje: c.pct,
            importe: fmt(c.monto),
          }))}
        />
      </div>
      {presu && presu.lineas.length > 0 && (
        <Card className={shared.results}>
          <Card.Header className={shared.sectionHeader}>
            <span className={shared.sectionIcon}>
              <LayersIcon aria-hidden />
            </span>
            <div>
              <Card.Title>Presupuesto y gasto registrado</Card.Title>
              <Card.Description>
                Estructura de {presu.periodo} · compará los gastos fijos con sus
                egresos asociados.
              </Card.Description>
            </div>
          </Card.Header>
          <Table
            className={cn(shared.table, s.budgetTable)}
            aria-label="Presupuesto y gasto registrado de estructura"
          >
            <TableHeader>
              <TableRow>
                <TableHead>Gasto fijo</TableHead>
                <TableHead className={shared.number}>Presupuestado</TableHead>
                <TableHead className={shared.number}>Registrado</TableHead>
                <TableHead className={shared.number}>Desvío</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {presu.lineas.map((linea) => (
                <TableRow key={linea.gastoFijoId}>
                  <TableCell>
                    {linea.nombre}
                    {linea.sinRegistrar && (
                      <span className={s.secondary}>Sin egresos este mes</span>
                    )}
                  </TableCell>
                  <TableCell className={shared.number}>
                    {fmt(linea.presupuestado)}
                  </TableCell>
                  <TableCell className={shared.number}>
                    {linea.sinRegistrar ? "—" : fmt(linea.real)}
                  </TableCell>
                  <TableCell
                    className={cn(shared.number, {
                      [s.overBudget]: !linea.sinRegistrar && linea.desvio > 0,
                    })}
                  >
                    {linea.sinRegistrar ? (
                      "—"
                    ) : (
                      <>
                        {desvio(linea.desvio)}
                        {linea.desvioPct != null && (
                          <span className={s.secondary}>
                            {linea.desvioPct >= 0 ? "+" : "−"}
                            {pct(Math.abs(linea.desvioPct))}%
                          </span>
                        )}
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Total con registro</TableCell>
                <TableCell className={shared.number}>
                  {fmt(presu.presupuestado)}
                </TableCell>
                <TableCell className={shared.number}>
                  {fmt(presu.real)}
                </TableCell>
                <TableCell
                  className={cn(shared.number, {
                    [s.overBudget]: presu.desvio > 0,
                  })}
                >
                  {desvio(presu.desvio)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
          {presu.sinRegistrar > 0 && (
            <Card.Footer className={shared.legend}>
              {presu.sinRegistrar} gastos fijos todavía sin egresos este mes. Se
              muestran, pero no entran en la comparación para evitar interpretar
              la falta de registros como un ahorro.
            </Card.Footer>
          )}
        </Card>
      )}
    </div>
  );
}

function Desglose({
  titulo,
  descripcion,
  icono,
  lineas,
}: {
  titulo: string;
  descripcion: string;
  icono: ReactNode;
  lineas: {
    id: string;
    nombre: string;
    detalle: string;
    porcentaje: number;
    importe: string;
    neutro?: boolean;
  }[];
}) {
  return (
    <Card className={shared.results}>
      <Card.Header className={shared.sectionHeader}>
        <span className={shared.sectionIcon}>{icono}</span>
        <div>
          <Card.Title>{titulo}</Card.Title>
          <Card.Description>{descripcion}</Card.Description>
        </div>
      </Card.Header>
      <Card.Content className={s.distribution}>
        {lineas.map((linea) => (
          <div key={linea.id} className={s.distributionRow}>
            <div className={s.distributionLabel}>
              <span>{linea.nombre}</span>
              <strong>{linea.importe}</strong>
            </div>
            <div className={s.distributionDetail}>
              <span>{linea.detalle}</span>
              <span>
                {linea.porcentaje.toLocaleString("es-AR", {
                  maximumFractionDigits: 1,
                })}
                %
              </span>
            </div>
            <div className={s.bar} aria-hidden>
              <span
                data-neutral={linea.neutro || undefined}
                style={{
                  width: `${Math.min(100, Math.max(0, linea.porcentaje))}%`,
                }}
              />
            </div>
          </div>
        ))}
      </Card.Content>
    </Card>
  );
}
