"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  BriefcaseBusinessIcon,
  CalendarIcon,
  CheckIcon,
  ChevronRightIcon,
  CircleDollarSignIcon,
  CreditCardIcon,
  Edit3Icon,
  ExternalLinkIcon,
  FactoryIcon,
  FileIcon,
  FolderIcon,
  PackageIcon,
  PlusIcon,
  SaveIcon,
  SquareIcon,
  Trash2Icon,
  TriangleAlertIcon,
  UserIcon,
} from "lucide-react";

import type { ClienteDetalle } from "@/lib/clientes";
import type { ProductoListItem } from "@/lib/productos-servicios";
import {
  calcularCostoTotal,
  calcularResumen,
  CANALES_VENTA,
  formatCurrency,
  formatUnidad,
  MOCK_CLIENTES_PROPUESTA,
  MOCK_ITEMS,
  MOCK_VENDEDOR,
  offsetDate,
  type PropuestaItem,
  type TipoPropuesta,
} from "@/lib/propuestas";
import { AgregarProductoSheet } from "@/components/comercial/agregar-producto-sheet";
import { NestingViewer } from "@/components/nesting/nesting-viewer";

type PropuestaFichaProps = {
  initialClientes: ClienteDetalle[];
  initialProductos: ProductoListItem[];
};

type OrdenTab = "productos" | "produccion" | "pagos" | "archivos" | "costos";
type InnerTab = "specs" | "costos" | "produccion";
type CosteoMotor = NonNullable<PropuestaItem["costeo"]>;
type PasoCosteo = CosteoMotor["pasos"][number];
type MaterialCosteo = NonNullable<PasoCosteo["materiales"]>[number];
type CargoPasoCosteo = NonNullable<PasoCosteo["cargosDirectosPaso"]>[number];

const tipoMap: Record<TipoPropuesta, "orden" | "presupuesto"> = {
  orden_trabajo: "orden",
  presupuesto: "presupuesto",
};

function fromOrdenTipo(value: "orden" | "presupuesto"): TipoPropuesta {
  return value === "orden" ? "orden_trabajo" : "presupuesto";
}

function formatDateForDesign(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function parseLocalDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatPlazoEntrega(fechaEstimada: string, fechaCreacion: string) {
  const estimated = parseLocalDate(fechaEstimada);
  const created = parseLocalDate(fechaCreacion);
  if (!estimated || !created) return "A definir";

  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.max(0, Math.ceil((estimated.getTime() - created.getTime()) / dayMs));
  if (days === 0) return "Hoy";
  if (days === 1) return "1 dia";
  return `${days} dias`;
}

function OrdenSegmented({
  value,
  onChange,
}: {
  value: "orden" | "presupuesto";
  onChange: (value: "orden" | "presupuesto") => void;
}) {
  return (
    <div className="orden-toggle">
      <button
        type="button"
        className={`oseg ${value === "orden" ? "on" : ""}`}
        onClick={() => onChange("orden")}
      >
        <SquareIcon />
        Orden de trabajo
      </button>
      <button
        type="button"
        className={`oseg ${value === "presupuesto" ? "on" : ""}`}
        onClick={() => onChange("presupuesto")}
      >
        <FileIcon />
        Presupuesto
      </button>
    </div>
  );
}

function OrdenTabs({
  value,
  onChange,
  count,
}: {
  value: OrdenTab;
  onChange: (value: OrdenTab) => void;
  count: number;
}) {
  const tabs: Array<{
    key: OrdenTab;
    label: string;
    count?: number;
    icon: React.ReactNode;
  }> = [
    { key: "productos", label: "Productos", count, icon: <PackageIcon /> },
    { key: "produccion", label: "Produccion", icon: <FactoryIcon /> },
    { key: "pagos", label: "Pagos", icon: <CreditCardIcon /> },
    { key: "archivos", label: "Archivos", count: 2, icon: <FolderIcon /> },
    { key: "costos", label: "Costos", icon: <CircleDollarSignIcon /> },
  ];

  return (
    <div className="orden-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`otab ${value === tab.key ? "on" : ""}`}
          onClick={() => onChange(tab.key)}
        >
          <span className="ic">{tab.icon}</span>
          <span>{tab.label}</span>
          {tab.count != null ? <span className="ct">{tab.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

function FieldCard({
  label,
  icon,
  children,
  hint,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="ofield">
      <div className="ofield-lbl">
        <span className="ic">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="ofield-ctrl">{children}</div>
      {hint ? <div className="ofield-hint">{hint}</div> : null}
    </div>
  );
}

function formatCantidadItem(item: PropuestaItem) {
  const maximumFractionDigits = item.unidadMedida === "m2" ? 2 : 0;
  const minimumFractionDigits =
    item.unidadMedida === "m2" && !Number.isInteger(item.cantidad) ? 2 : 0;

  return item.cantidad.toLocaleString("es-AR", {
    minimumFractionDigits,
    maximumFractionDigits,
  });
}

function formatCantidadCosto(value: number, unidad: string) {
  const unidadLabel = formatUnidadCosto(unidad, value);
  return `${value.toLocaleString("es-AR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  })} ${unidadLabel}`;
}

function formatUnidadCosto(unidad: string, cantidad = 1) {
  const normalized = unidad.trim().toLowerCase();
  const isSingular = Math.abs(cantidad) === 1;
  const pluralizable: Record<string, { singular: string; plural: string }> = {
    gramo: { singular: "gramo", plural: "gramos" },
    hoja: { singular: "hoja", plural: "hojas" },
    pliego: { singular: "hoja", plural: "hojas" },
    rollo: { singular: "rollo", plural: "rollos" },
    caja: { singular: "caja", plural: "cajas" },
    pack: { singular: "pack", plural: "packs" },
    pieza: { singular: "pieza", plural: "piezas" },
  };
  const pluralized = pluralizable[normalized];
  if (pluralized) return isSingular ? pluralized.singular : pluralized.plural;

  const labels: Record<string, string> = {
    m_lineales: "ml",
    metro_lineal: "ml",
    metros_lineales: "ml",
    m2: "m²",
    m_2: "m²",
    unidad: "u.",
    unidades: "u.",
  };
  return labels[normalized] ?? unidad;
}

function formatModoSeleccion(value: string) {
  const labels: Record<string, string> = {
    HARDCODED: "Base",
    COMERCIAL_ELIGE: "Comercial elige",
    MOTOR_ELIGE_AUTO: "Motor elige",
    MAQUINA_CONSUMIBLE: "Consumible",
  };
  return labels[value] ?? value;
}

function humanizeCodigo(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getCostBuckets(item: PropuestaItem) {
  if (item.costeo?.origen === "motor") {
    return [
      { key: "materiales", label: "Materiales", amount: item.costeo.costos.materialesTotal },
      { key: "centro-costo", label: "Centro de costo", amount: item.costeo.costos.tiempoTotal },
      { key: "cargos", label: "Cargos directos", amount: item.costeo.costos.cargosDirectosTotal },
    ].filter((bucket) => bucket.amount > 0);
  }

  return [
    { key: "materiales", label: "Materiales", amount: item.costos.materiales },
    { key: "centro-costo", label: "Centro de costo", amount: item.costos.produccion },
    { key: "terminacion", label: "Terminación", amount: item.costos.terminacion },
    { key: "terceros", label: "Terceros", amount: item.costos.terceros },
  ].filter((bucket) => bucket.amount > 0);
}

function sumMaterialesPaso(paso: PasoCosteo) {
  return (paso.materiales ?? []).reduce(
    (acc, material) => acc + material.costoTotal,
    0,
  );
}

function sumCargosPaso(paso: PasoCosteo) {
  return (paso.cargosDirectosPaso ?? []).reduce(
    (acc, cargo) => acc + cargo.monto,
    0,
  );
}

function getVisibleCostSteps(pasos: PasoCosteo[]) {
  return pasos.filter(
    (paso) =>
      paso.activado ||
      paso.costoTotal > 0,
  );
}

function formatTiempoPaso(paso: PasoCosteo) {
  if (!paso.tiempo) return "-";
  return `${paso.tiempo.totalMin.toLocaleString("es-AR", {
    maximumFractionDigits: 1,
  })} min`;
}

function formatTarifaCentroCosto(paso: PasoCosteo) {
  if (!paso.tiempo?.tarifaHora) return "Sin tarifa";
  return `${formatCurrency(paso.tiempo.tarifaHora)}/h`;
}

function getCentroCostoLabel(paso: PasoCosteo) {
  if (!paso.activado) return "No aplica";
  if (paso.tiempo?.centroCostoNombre) return paso.tiempo.centroCostoNombre;
  if (paso.tiempo?.costo && paso.tiempo.costo > 0) return "Centro tarifado";
  if (paso.tiempo) return "Sin costo";
  return "Sin tiempo";
}

function MaterialesPasoTable({ materiales }: { materiales: MaterialCosteo[] }) {
  const visibles = materiales.filter((material) => material.costoTotal > 0);
  if (visibles.length === 0) {
    return (
      <div className="cost-empty-line">
        Este paso no consumió materiales ni consumibles con costo.
      </div>
    );
  }

  return (
    <div className="cost-detail-table-wrap">
      <table className="cost-detail-table">
        <thead>
          <tr>
            <th>Material</th>
            <th>Tipo</th>
            <th className="num">Cantidad</th>
            <th className="num">Costo unit.</th>
            <th className="num">Costo</th>
          </tr>
        </thead>
        <tbody>
          {visibles.map((material, index) => (
            <tr key={`${material.slotCodigo}-${material.materialVarianteId}-${index}`}>
              <td>
                <strong>{material.materialDisplayName || material.materialNombre}</strong>
              </td>
              <td>
                <span className="cost-chip">{formatModoSeleccion(material.modoSeleccion)}</span>
              </td>
              <td className="num">{formatCantidadCosto(material.cantidad, material.unidad)}</td>
              <td className="num">{formatCurrency(material.precioUnitario)}</td>
              <td className="num strong">{formatCurrency(material.costoTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CargosPasoList({ cargos }: { cargos: CargoPasoCosteo[] }) {
  const visibles = cargos.filter((cargo) => cargo.monto > 0);
  if (visibles.length === 0) return null;

  return (
    <div className="cost-charges">
      {visibles.map((cargo) => (
        <div className="cost-charge" key={`${cargo.cargoCodigo}-${cargo.cargoNombre}`}>
          <span>{cargo.cargoNombre}</span>
          <small>{humanizeCodigo(cargo.modoCalculo)}</small>
          <strong>{formatCurrency(cargo.monto)}</strong>
        </div>
      ))}
    </div>
  );
}

function ProduccionItemView({
  item,
  calculoPendiente,
}: {
  item: PropuestaItem;
  calculoPendiente: boolean;
}) {
  const costeoMotor = item.costeo?.origen === "motor" ? item.costeo : null;
  const pasosCosteoActivos = costeoMotor
    ? getVisibleCostSteps(costeoMotor.pasos)
    : [];
  const pasosActivos = costeoMotor
    ? pasosCosteoActivos
    : item.pasos.filter((paso) => paso.origen !== "opcional");
  const pasosConNesting = pasosCosteoActivos.filter(
    (paso) => paso.nestingResult,
  );

  if (calculoPendiente) {
    return (
      <div className="op-empty">
        <div className="ttl">Producción pendiente de cotización</div>
        <div className="sub">
          Cotizá el producto para ver ruta activa, tiempos y nesting calculado
          por el Motor Universal.
        </div>
      </div>
    );
  }

  return (
    <div className="op-production">
      {item.notaProduccion ? (
        <div className="production-note">
          <span className="production-note-icon" aria-hidden="true">
            <TriangleAlertIcon />
          </span>
          <div>
            <strong>Nota para producción</strong>
            <p>{item.notaProduccion}</p>
          </div>
        </div>
      ) : null}

      <div className="cost-section">
        <div className="cost-title">Ruta de producción</div>
        <div className="production-route">
          {pasosActivos.map((paso, index) => {
            const isMotorStep = "familiaCodigo" in paso;
            const title = isMotorStep
              ? humanizeCodigo(paso.familiaCodigo)
              : paso.nombre;
            const detail = isMotorStep
              ? paso.tiempo
                ? `${formatTiempoPaso(paso)} · ${getCentroCostoLabel(paso)}`
                : getCentroCostoLabel(paso)
              : `${paso.centroCosto} · ${paso.minutos} min`;
            return (
              <div className="production-step" key={`${title}-${index}`}>
                <span>{index + 1}</span>
                <div>
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {pasosConNesting.length > 0 ? (
        <div className="cost-section">
          <div className="mb-[18px] flex flex-wrap items-end gap-4">
            <div className="min-w-0 flex-1 basis-80">
              <div className="cost-title mb-1">Nesting del item</div>
              <h1 className="m-0 text-[22px] font-semibold leading-[1.2] tracking-[-0.018em] text-[var(--ink)]">
                Disposición de piezas
              </h1>
              <div className="mt-1 text-[13px] text-[var(--muted)]">
                Acomodo calculado por la ruta activa para controlar consumo,
                demasía y cortes.
              </div>
            </div>
          </div>
          <div className="production-nestings">
            {pasosConNesting.map((paso) => (
              <div
                className="production-nesting"
                key={`${paso.rutaPasoOrden}-${paso.familiaCodigo}`}
              >
                <NestingViewer
                  result={paso.nestingResult!}
                  costingDetails={paso.materiales ?? []}
                  maxPx={paso.nestingResult?.substrates[0]?.kind === "sheet" ? 420 : 560}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="op-empty">
          <div className="ttl">Sin nesting para este item</div>
          <div className="sub">
            La ruta activa no generó un gráfico de nesting para los pasos
            calculados.
          </div>
        </div>
      )}
    </div>
  );
}

function PasoCostDetail({ paso }: { paso: PasoCosteo }) {
  const materiales = paso.materiales ?? [];
  const cargos = paso.cargosDirectosPaso ?? [];
  const cargosTotal = sumCargosPaso(paso);

  return (
    <div className="cost-step-expanded">
      <div className="cost-detail-block">
        <div className="cost-detail-title">Materiales del paso</div>
        <MaterialesPasoTable materiales={materiales} />
      </div>

      {cargosTotal > 0 ? (
        <div className="cost-detail-block">
          <div className="cost-detail-title">Cargos directos del paso</div>
          <CargosPasoList cargos={cargos} />
        </div>
      ) : null}
    </div>
  );
}

function CostosItemView({
  item,
  costo,
  margen,
  calculoPendiente,
}: {
  item: PropuestaItem;
  costo: number;
  margen: number;
  calculoPendiente: boolean;
}) {
  const costeoMotor = item.costeo?.origen === "motor" ? item.costeo : null;
  const precioNeto = item.subtotal;
  const margenMonto = precioNeto - costo;
  const costoUnitario = item.cantidad > 0 ? costo / item.cantidad : 0;
  const buckets = getCostBuckets(item);
  const cargosPaso = (costeoMotor?.pasos ?? [])
    .flatMap((paso) => paso.cargosDirectosPaso ?? [])
    .filter((cargo) => cargo.monto > 0);
  const cargosCotizacion = (costeoMotor?.cargosDirectosCotizacion ?? []).filter(
    (cargo) => cargo.monto > 0,
  );
  const visibleCostSteps = costeoMotor
    ? getVisibleCostSteps(costeoMotor.pasos)
    : [];
  const [expandedCostSteps, setExpandedCostSteps] = React.useState<Set<string>>(
    () => new Set(),
  );

  const toggleCostStep = (key: string) => {
    setExpandedCostSteps((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (calculoPendiente) {
    return (
      <div className="op-empty">
        <div className="ttl">Costo pendiente de cotización</div>
        <div className="sub">
          Cotizá el producto para ver materiales, producción y opcionales con
          costos reales del Motor Universal.
        </div>
      </div>
    );
  }

  return (
    <div className="op-costs">
      <div className="cost-hero">
        <div>
          <div className="cost-eyebrow">
            {costeoMotor ? "Costeo del Motor Universal" : "Costo estimado preliminar"}
          </div>
          <div className="cost-main">{formatCurrency(costo)}</div>
          <div className="cost-sub">
            Costo por {formatUnidad(item.unidadMedida)}: {formatCurrency(costoUnitario)} ·{" "}
            Cantidad: {formatCantidadItem(item)} {formatUnidad(item.unidadMedida)}
          </div>
        </div>
        <div className="cost-margin">
          <span>Margen bruto</span>
          <strong className={margen < 25 ? "warn" : ""}>{margen.toFixed(1)}%</strong>
          <small>{formatCurrency(margenMonto)}</small>
        </div>
        <div className="cost-margin">
          <span>Precio neto</span>
          <strong>{formatCurrency(precioNeto)}</strong>
          <small>sin impuestos</small>
        </div>
      </div>

      <div className="cost-section">
        <div className="cost-title">Composición del costo</div>
        <div className="cost-bars">
          {buckets.map((bucket) => {
            const pct = costo > 0 ? (bucket.amount / costo) * 100 : 0;
            return (
              <div className="cost-bar-row" key={bucket.key}>
                <div className="cost-bar-meta">
                  <span>{bucket.label}</span>
                  <strong>{formatCurrency(bucket.amount)}</strong>
                </div>
                <div className="cost-bar-track">
                  <span style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
                </div>
                <div className="cost-bar-pct">{pct.toFixed(0)}%</div>
              </div>
            );
          })}
        </div>
      </div>

      {costeoMotor ? (
        <div className="cost-section">
          <div className="cost-title">Desglose por paso</div>
          <div className="cost-steps-table-wrap">
            <table className="cost-steps-table">
              <thead>
                <tr>
                  <th>Paso</th>
                  <th>Centro de costo</th>
                  <th className="num">Tiempo</th>
                  <th className="num">Materiales</th>
                  <th className="num">Cargos</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {visibleCostSteps.map((paso, visibleIndex) => {
                  const stepKey = `${paso.rutaPasoOrden}-${paso.familiaCodigo}`;
                  const materialesTotal = sumMaterialesPaso(paso);
                  const cargosTotal = sumCargosPaso(paso);
                  const centroCostoTotal = paso.tiempo?.costo ?? 0;
                  const puedeExpandir =
                    paso.activado &&
                    (Boolean(paso.tiempo) ||
                      (paso.materiales?.length ?? 0) > 0 ||
                      (paso.cargosDirectosPaso?.length ?? 0) > 0);
                  const expanded = expandedCostSteps.has(stepKey);
                  return (
                    <React.Fragment key={stepKey}>
                      <tr
                        className={`${paso.activado ? "" : "muted-row"} ${
                          puedeExpandir ? "clickable" : ""
                        } ${expanded ? "open" : ""}`}
                        onClick={puedeExpandir ? () => toggleCostStep(stepKey) : undefined}
                      >
                        <td>
                          <div className="cost-step-name">
                            <span className="cost-step-title">
                              {puedeExpandir ? (
                                <ChevronRightIcon
                                  className="cost-row-chevron"
                                  aria-hidden="true"
                                />
                              ) : null}
                              <span>{visibleIndex + 1}. {humanizeCodigo(paso.familiaCodigo)}</span>
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="cost-step-center">
                            <strong>{getCentroCostoLabel(paso)}</strong>
                            <span>{formatTarifaCentroCosto(paso)}</span>
                          </div>
                        </td>
                        <td className="num">
                          {paso.tiempo ? (
                            <>
                              <strong>{formatCurrency(centroCostoTotal)}</strong>
                              <span>{formatTiempoPaso(paso)}</span>
                            </>
                          ) : (
                            <span>-</span>
                          )}
                        </td>
                        <td className="num">
                          {materialesTotal > 0 ? formatCurrency(materialesTotal) : "-"}
                        </td>
                        <td className="num">
                          {cargosTotal > 0 ? formatCurrency(cargosTotal) : "-"}
                        </td>
                        <td className="num strong">
                          {paso.costoTotal > 0 ? formatCurrency(paso.costoTotal) : "-"}
                        </td>
                      </tr>
                      {puedeExpandir && expanded ? (
                        <tr className="cost-step-detail-row">
                          <td colSpan={6}>
                            <PasoCostDetail paso={paso} />
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {cargosPaso.length > 0 || cargosCotizacion.length > 0 ? (
        <div className="cost-section">
          <div className="cost-title">Opcionales y cargos</div>
          <div className="cost-charges">
            {cargosPaso.map((cargo) => (
              <div className="cost-charge" key={`paso-${cargo.cargoCodigo}`}>
                <span>{cargo.cargoNombre}</span>
                <small>{humanizeCodigo(cargo.modoCalculo)}</small>
                <strong>{formatCurrency(cargo.monto)}</strong>
              </div>
            ))}
            {cargosCotizacion.map((cargo) => (
              <div className="cost-charge" key={`cotizacion-${cargo.cargoCodigo}`}>
                <span>{cargo.cargoNombre}</span>
                <small>Cotización</small>
                <strong>{formatCurrency(cargo.monto)}</strong>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProductRow({
  item,
  index,
  expanded,
  onToggle,
  onRemove,
  onEdit,
  fechaEstimada,
}: {
  item: PropuestaItem;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onEdit: () => void;
  fechaEstimada: string;
}) {
  const [innerTab, setInnerTab] = React.useState<InnerTab>("specs");
  const costo = calcularCostoTotal(item);
  const calculoPendiente = item.precioUnitario === 0 && item.total === 0;
  const margen = item.subtotal > 0 ? ((item.subtotal - costo) / item.subtotal) * 100 : 0;
  const specs = item.atributosSchema
    .filter((attr) => attr.visible)
    .sort((a, b) => a.orden - b.orden)
    .map((attr) => ({
      lbl: attr.label,
      val: item.especificaciones[attr.key] ?? "A definir",
    }));

  return (
    <div className={`oprow ${expanded ? "open" : ""}`}>
      <button type="button" className="oprow-head" onClick={onToggle}>
        <span className="ix">{index + 1}</span>
        <span className="chev">
          <ChevronRightIcon
            style={{
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform .15s ease",
            }}
          />
        </span>
        <div className="prod">
          <div className="nm">{item.productoNombre}</div>
          <div className="cd">
            <span className="code">{item.productoCodigo}</span>
            <span className="fam">
              {item.categoriaComercialNombre} · {item.subcategoriaComercialNombre}
            </span>
          </div>
        </div>
        <div className="num qty">
          <span className="v">{formatCantidadItem(item)}</span>
          <span className="u">{formatUnidad(item.unidadMedida)}</span>
        </div>
        <div className="num">{calculoPendiente ? "A cotizar" : formatCurrency(item.subtotal)}</div>
        <div className="num">{calculoPendiente ? "-" : formatCurrency(item.impuestoMonto)}</div>
        <div className="num total">{calculoPendiente ? "Pendiente" : formatCurrency(item.total)}</div>
        <span
          className="x"
          role="button"
          tabIndex={0}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
              onRemove();
            }
          }}
          title="Quitar producto"
        >
          <Trash2Icon />
        </span>
      </button>

      {expanded ? (
        <div className="oprow-body">
          <div className="op-sub">
            <div className="op-subnav">
              <button
                type="button"
                className={innerTab === "specs" ? "on" : ""}
                onClick={() => setInnerTab("specs")}
              >
                Especificaciones
              </button>
              <button
                type="button"
                className={innerTab === "costos" ? "on" : ""}
                onClick={() => setInnerTab("costos")}
              >
                Costos
              </button>
              <button
                type="button"
                className={innerTab === "produccion" ? "on" : ""}
                onClick={() => setInnerTab("produccion")}
              >
                Produccion
              </button>
            </div>
            <button type="button" className="btn-link" onClick={onEdit}>
              <Edit3Icon />
              Editar especificaciones
            </button>
          </div>

          {innerTab === "specs" ? (
            <>
              <div className="op-specs">
                {specs.map((spec) => (
                  <div className="spec" key={spec.lbl}>
                    <div className="lbl">{spec.lbl}</div>
                    <div className="val">{spec.val}</div>
                  </div>
                ))}
              </div>

              <div className="op-extras">
                <div className="op-adicionales">
                  <div className="op-adi-head">
                    <PlusIcon />
                    <span>Opcionales activados</span>
                  </div>
                  <div className="op-chips">
                    {item.adicionales.length > 0 ? (
                      item.adicionales.map((adicional) => (
                        <span key={adicional} className="adi-chip">
                          <CheckIcon />
                          {adicional}
                        </span>
                      ))
                    ) : (
                      <span className="adi-chip">Sin opcionales activados</span>
                    )}
                    <button type="button" className="adi-add">
                      <PlusIcon />
                      Activar opcional
                    </button>
                  </div>
                </div>

                <div className="op-mini">
                  <div className="op-mini-row">
                    <span className="mlbl">
                      <CalendarIcon />
                      Fecha estimada
                    </span>
                    <span className="mval mono">
                      {formatDateForDesign(item.fechaEntrega ?? fechaEstimada)}
                    </span>
                  </div>
                  <div className="op-mini-row">
                    <span className="mlbl">Costo estimado</span>
                    <span className="mval mono">
                      {calculoPendiente ? "Pendiente" : formatCurrency(costo)}
                    </span>
                  </div>
                  <div className="op-mini-row">
                    <span className="mlbl">Margen bruto</span>
                    <span className={`mval mono ${margen < 25 ? "warn" : ""}`}>
                      {calculoPendiente ? "Pendiente" : `${margen.toFixed(0)}%`}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {innerTab === "costos" ? (
            <CostosItemView
              item={item}
              costo={costo}
              margen={margen}
              calculoPendiente={calculoPendiente}
            />
          ) : null}

          {innerTab === "produccion" ? (
            <ProduccionItemView
              item={item}
              calculoPendiente={calculoPendiente}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function EmptyTab({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="orden-tab-empty">
      <div className="ttl">{title}</div>
      <div className="sub">{description}</div>
    </div>
  );
}

function calcularCargosDirectosItems(items: PropuestaItem[]) {
  return items.reduce((acc, item) => {
    if (item.costeo?.origen === "motor") {
      return acc + item.costeo.costos.cargosDirectosTotal;
    }

    return acc + item.costos.terceros;
  }, 0);
}

function calcularComisionesItems(items: PropuestaItem[]) {
  return items.reduce((acc, item) => {
    const desglose = item.costeo?.desglosePrecio;
    if (!desglose) return acc;

    const cantidad =
      item.costeo?.cantidadComercialPricing ??
      item.costeo?.cantidadEfectiva ??
      item.cantidad;

    return acc + desglose.totalComisiones * cantidad;
  }, 0);
}

function ResumenBar({
  items,
  tipo,
  fechaEstimada,
  fechaCreacion,
}: {
  items: PropuestaItem[];
  tipo: "orden" | "presupuesto";
  fechaEstimada: string;
  fechaCreacion: string;
}) {
  const resumen = calcularResumen(items);
  const subtotal = resumen.subtotal;
  const impuestos = resumen.impuestos;
  const costoTotal = items.reduce(
    (acc, item) => acc + calcularCostoTotal(item),
    0,
  );
  const cargos = calcularCargosDirectosItems(items);
  const comisiones = calcularComisionesItems(items);
  const totalConCargos = resumen.total;
  const margen = subtotal > 0 ? ((subtotal - costoTotal) / subtotal) * 100 : 0;

  return (
    <div className="resumen-bar">
      <div className="rbar-head">
        <div>
          <div className="ttl">Resumen financiero</div>
          <div className="sub">
            {items.length} productos ·{" "}
            {tipo === "orden" ? "Orden de trabajo" : "Presupuesto"}
          </div>
        </div>
        <div className="rbar-conditions">
          {tipo === "presupuesto" ? (
            <span className="cond">
              <span className="cl">Validez</span>
              <span className="cv">7 dias</span>
            </span>
          ) : null}
          <span className="cond">
            <span className="cl">Plazo entrega</span>
            <span className="cv">{formatPlazoEntrega(fechaEstimada, fechaCreacion)}</span>
          </span>
          <span className="cond">
            <span className="cl">Forma de pago</span>
            <span className="cv">A definir</span>
          </span>
        </div>
      </div>

      <div className="rbar-cols">
        <div className="rbcol">
          <div className="lbl">Subtotal</div>
          <div className="val">{formatCurrency(subtotal)}</div>
          <div className="hint">{items.length} productos</div>
        </div>
        <div className="rbsep">+</div>
        <div className="rbcol">
          <div className="lbl">Impuestos</div>
          <div className="val">{formatCurrency(impuestos)}</div>
          <div className="hint">IVA 21%</div>
        </div>
        <div className="rbsep">+</div>
        <div className="rbcol">
          <div className="lbl">Cargos directos</div>
          <div className="val">{formatCurrency(cargos)}</div>
          <div className="hint">
            {cargos > 0 ? "Incluidos en subtotal" : "Sin cargos configurados"}
          </div>
        </div>
        <div className="rbsep">·</div>
        <div className="rbcol muted">
          <div className="lbl">Comisiones</div>
          <div className="val">{formatCurrency(comisiones)}</div>
          <div className="hint">
            {comisiones > 0 ? "Incluidas en subtotal" : "Sin comisiones"}
          </div>
        </div>
        <div className="rbsep eq">=</div>
        <div className="rbcol total">
          <div className="lbl">Total c/ imp.</div>
          <div className="val">{formatCurrency(totalConCargos)}</div>
          <div className="hint">Para emitir al cliente</div>
        </div>
      </div>

      <div className="rbar-foot">
        <div className="rbar-margen">
          <div className="m-head">
            <span className="m-lbl">Margen bruto estimado</span>
            <span className={`m-val ${margen < 25 ? "warn" : ""}`}>
              {margen.toFixed(1)}%
            </span>
          </div>
          <div className="m-track">
            <span
              style={{
                width: `${Math.min(100, Math.max(0, margen))}%`,
              }}
            />
          </div>
          <div className="m-foot">
            <span>Costo estimado</span>
            <span className="mono">{formatCurrency(costoTotal)}</span>
          </div>
        </div>
        <div className="rbar-actions">
          <button type="button" className="btn">
            <SaveIcon />
            Guardar borrador
          </button>
          <button type="button" className="btn btn-primary">
            {tipo === "orden" ? (
              <>
                <CheckIcon />
                Emitir OT
              </>
            ) : (
              <>
                <ExternalLinkIcon />
                Enviar al cliente
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PropuestaFicha({
  initialClientes,
  initialProductos,
}: PropuestaFichaProps) {
  const [tipo, setTipo] = React.useState<TipoPropuesta>("orden_trabajo");
  const ordenTipo = tipoMap[tipo];
  const [tab, setTab] = React.useState<OrdenTab>("productos");
  const [openIds, setOpenIds] = React.useState<Set<string>>(
    () =>
      new Set(
        initialProductos.length > 0
          ? []
          : [MOCK_ITEMS[1]?.id ?? MOCK_ITEMS[0]?.id ?? ""],
      ),
  );
  const [items, setItems] = React.useState<PropuestaItem[]>(
    initialProductos.length > 0 ? [] : MOCK_ITEMS,
  );
  const [addOpen, setAddOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<PropuestaItem | null>(null);
  const [clienteId, setClienteId] = React.useState("");
  const [canalVenta, setCanalVenta] = React.useState("mostrador");
  const [fechaEstimada, setFechaEstimada] = React.useState(offsetDate(7));
  const [fechaCreacion] = React.useState(() => offsetDate(0));

  const clienteItems = React.useMemo(() => {
    const source =
      initialClientes.length > 0 ? initialClientes : MOCK_CLIENTES_PROPUESTA;

    return [...source]
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((cliente) => ({ value: cliente.id, label: cliente.nombre }));
  }, [initialClientes]);

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <section className="ot-v1 flex flex-1 flex-col p-4 md:p-6">
      <div className="orden-head">
        <div className="left">
          <Link className="back-link" href="/">
            <ArrowLeftIcon />
            Volver
          </Link>
          <div className="eyebrow">
            <BriefcaseBusinessIcon />
            Comercial
          </div>
          <h1>
            Nueva {ordenTipo === "orden" ? "orden de trabajo" : "propuesta"}
            <span className="status-chip">
              <span className="d" />
              Borrador
            </span>
          </h1>
          <div className="sub">
            {ordenTipo === "orden"
              ? "Confirma productos, especificaciones y pagos para emitir la OT al taller."
              : "Arma la propuesta para enviar al cliente antes de confirmar la OT."}
          </div>
        </div>
        <div className="right">
          <div className="orden-meta">
            <span className="meta-row">
              <span className="ml">Nº</span>
              <span className="mv mono">OT-2026-0184</span>
            </span>
            <span className="meta-row">
              <span className="ml">Creado</span>
              <span className="mv">hoy · 02:04</span>
            </span>
          </div>
          <OrdenSegmented
            value={ordenTipo}
            onChange={(value) => setTipo(fromOrdenTipo(value))}
          />
        </div>
      </div>

      <div className="orden-form">
        <FieldCard label="Cliente" icon={<UserIcon />}>
          <div className="ctrl-select">
            <select
              value={clienteId}
              onChange={(event) => setClienteId(event.target.value)}
              aria-label="Cliente"
            >
              <option value="">Seleccionar cliente</option>
              {clienteItems.map((cliente) => (
                <option key={cliente.value} value={cliente.value}>
                  {cliente.label}
                </option>
              ))}
            </select>
            <ChevronRightIcon />
          </div>
        </FieldCard>

        <FieldCard label="Vendedor" icon={<UserIcon />}>
          <div className="ctrl-input has-avatar">
            <span className="av-sm">LG</span>
            <span>{MOCK_VENDEDOR.nombreCompleto}</span>
          </div>
        </FieldCard>

        <FieldCard label="Canal de venta" icon={<PackageIcon />}>
          <div className="ctrl-select">
            <select
              value={canalVenta}
              onChange={(event) => setCanalVenta(event.target.value)}
              aria-label="Canal de venta"
            >
              {CANALES_VENTA.map((canal) => (
                <option key={canal.value} value={canal.value}>
                  {canal.label}
                </option>
              ))}
            </select>
            <ChevronRightIcon />
          </div>
        </FieldCard>

        <FieldCard label="Fecha estimada" icon={<CalendarIcon />} hint="Entrega">
          <div className="ctrl-input">
            <input
              type="date"
              value={fechaEstimada}
              onChange={(event) => setFechaEstimada(event.target.value)}
              aria-label="Fecha estimada"
            />
          </div>
        </FieldCard>
      </div>

      <div className="orden-main-full">
        <div className="orden-tabs-row">
          <OrdenTabs value={tab} onChange={setTab} count={items.length} />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditingItem(null);
              setAddOpen(true);
            }}
          >
            <PlusIcon />
            Agregar producto
          </button>
        </div>

        {tab === "productos" ? (
          <div className="orden-table">
            <div className="ohead">
              <span className="ix">#</span>
              <span className="chev" />
              <span className="prod">Producto</span>
              <span className="num qty">Cantidad</span>
              <span className="num">Subtotal</span>
              <span className="num">Imp.</span>
              <span className="num">Total</span>
              <span className="x" />
            </div>
            <div className="orows">
              {items.map((item, index) => (
                <ProductRow
                  key={item.id}
                  item={item}
                  index={index}
                  expanded={openIds.has(item.id)}
                  onToggle={() => toggle(item.id)}
                  onRemove={() =>
                    setItems((current) =>
                      current.filter((candidate) => candidate.id !== item.id),
                    )
                  }
                  onEdit={() => {
                    setEditingItem(item);
                    setAddOpen(true);
                  }}
                  fechaEstimada={fechaEstimada}
                />
              ))}
            </div>
            <button
              type="button"
              className="orden-add-ghost"
              onClick={() => {
                setEditingItem(null);
                setAddOpen(true);
              }}
            >
              <PlusIcon />
              Agregar otro producto a la{" "}
              {ordenTipo === "orden" ? "orden" : "propuesta"}
            </button>
          </div>
        ) : null}

        {tab === "produccion" ? (
          <EmptyTab
            title="Programacion de produccion"
            description="Una vez confirmada la OT vas a poder ver pasos, maquinas asignadas y tiempos estimados aca."
          />
        ) : null}
        {tab === "pagos" ? (
          <EmptyTab
            title="Plan de pagos"
            description="Configura anticipo, condiciones y vencimientos antes de emitir."
          />
        ) : null}
        {tab === "archivos" ? (
          <EmptyTab
            title="Archivos del cliente"
            description="Subi PDFs, vectores o referencias para que produccion los tenga a mano."
          />
        ) : null}
        {tab === "costos" ? (
          <EmptyTab
            title="Vista consolidada de costos"
            description={`Desglose de maquinas, materiales y mano de obra para los ${items.length} productos.`}
          />
        ) : null}

        {tab === "productos" ? (
          <ResumenBar
            items={items}
            tipo={ordenTipo}
            fechaEstimada={fechaEstimada}
            fechaCreacion={fechaCreacion}
          />
        ) : null}
      </div>

      <AgregarProductoSheet
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) setEditingItem(null);
        }}
        productos={initialProductos}
        editingItem={editingItem}
        onAddItem={(item) => {
          setItems((current) => [...current, item]);
          setOpenIds((current) => new Set([...current, item.id]));
          setAddOpen(false);
          setEditingItem(null);
        }}
        onSaveItem={(item) => {
          setItems((current) =>
            current.map((candidate) => (candidate.id === item.id ? item : candidate)),
          );
          setOpenIds((current) => new Set([...current, item.id]));
          setAddOpen(false);
          setEditingItem(null);
        }}
      />
    </section>
  );
}
