"use client";

import { type ReactNode } from "react";
import {
  BoxIcon,
  ChartColumnIcon,
  ChevronDownIcon,
  DropletsIcon,
  Layers3Icon,
  PlusIcon,
  RulerIcon,
  ShapesIcon,
  WalletIcon,
} from "lucide-react";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { abreviarMoneda, formatearMoneda } from "@/lib/moneda";
import { technologyCodeLabel } from "@/lib/maquinaria-tecnologias";
import { cantidadMaterialProducto } from "@/lib/reporte-producto";
import type {
  MaterialUsoPanel,
  ProductoPanel,
  RangoPanel,
  TabPanel,
} from "@/lib/panel-api";
import { cn } from "@/lib/utils";
import { Metric, NoData, ReportCard, ReportSource } from "./reportes-ui";
import { ProductoMix, VentasProductoTabla } from "./reporte-producto-mix";
import shared from "./reportes.module.css";
import styles from "./reporte-producto.module.css";

const numero = (n: number) =>
  n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
const pct = (n: number | null) => (n == null ? "—" : `${numero(n)}%`);

function Scroll({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      className={cn(shared.tableScroll, styles.scroll)}
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      {children}
    </div>
  );
}
function Track({ value }: { value: number }) {
  return (
    <div className={styles.track} aria-hidden="true">
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
function Materials({
  rows,
  costos,
  tinta = false,
}: {
  rows: MaterialUsoPanel[];
  costos: boolean;
  tinta?: boolean;
}) {
  const { moneda } = useConfigRegional();
  const label = tinta ? "Consumo de tintas y tóner" : "Uso de papel y material";
  if (!rows.length)
    return (
      <NoData
        title={
          tinta
            ? "Sin consumo de tintas registrado"
            : "Sin consumo de materiales registrado"
        }
        description="El reporte utiliza los consumos guardados al cotizar las órdenes del período."
      />
    );
  return (
    <Scroll label={label}>
      <table className={shared.table} aria-label={label}>
        <thead>
          <tr>
            <th scope="col">{tinta ? "Tinta / tóner" : "Material"}</th>
            <th scope="col">Cantidad teórica</th>
            {!tinta ? <th scope="col">Ítems</th> : null}
            {costos ? <th scope="col">Costo</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((m, i) => (
            <tr key={JSON.stringify([m.material, m.unidad, m.formato, i])}>
              <th scope="row">{m.material}</th>
              <td>{cantidadMaterialProducto(m)}</td>
              {!tinta ? <td>{numero(m.items)}</td> : null}
              {costos ? (
                <td>
                  {m.costo == null ? "—" : formatearMoneda(m.costo, moneda)}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </Scroll>
  );
}

export function ReporteProducto({
  d,
  rango,
}: {
  d: TabPanel<ProductoPanel>;
  rango: RangoPanel;
}) {
  const { moneda } = useConfigRegional();
  const money = (n: number) => formatearMoneda(n, moneda);
  const ad = d.adicionales;
  const med = d.medidas;
  const ventas = d.porCategoria.reduce((s, p) => s + p.ventas, 0);
  const ticketCon = ad.itemsCon > 0;
  const ticketSin = ad.itemsTotales > ad.itemsCon;
  const diferencia =
    ticketCon && ticketSin && ad.ticketItemSin > 0
      ? ((ad.ticketItemCon - ad.ticketItemSin) / ad.ticketItemSin) * 100
      : null;
  const cantidades = [
    { label: "Estándar", items: med.estandar, pct: med.pctEstandar },
    {
      label: "A medida",
      items: med.personalizada,
      pct: med.pctEstandar == null ? null : 100 - med.pctEstandar,
    },
  ];
  return (
    <div className={shared.report}>
      <div className={shared.periodNote}>
        <span>Lectura del catálogo</span>
        <span>Órdenes emitidas · ventas sin IVA</span>
      </div>
      <div className={shared.metrics}>
        <Metric
          featured
          label="Ventas del período"
          value={abreviarMoneda(ventas, moneda)}
          detail={`${money(ventas)} · sin IVA`}
          icon={<WalletIcon />}
        />
        <Metric
          label="Ítems vendidos"
          value={numero(ad.itemsTotales)}
          detail="Ítems principales de las órdenes"
          hint="Cuenta renglones de productos en órdenes emitidas, no piezas ni unidades físicas."
          icon={<BoxIcon />}
        />
        <Metric
          label="Categorías con ventas"
          value={numero(d.porCategoria.length)}
          detail="Familias comerciales del período"
          icon={<ShapesIcon />}
        />
        <Metric
          label="Superficie vendida"
          value={`${numero(d.totalM2)} m²`}
          detail="Según las piezas cotizadas"
          icon={<RulerIcon />}
        />
        <Metric
          label="Con adicionales"
          value={pct(ad.itemsTotales > 0 ? ad.pctCon : null)}
          detail={`${numero(ad.itemsCon)} de ${numero(ad.itemsTotales)} ítems`}
          icon={<PlusIcon />}
        />
      </div>

      <ProductoMix d={d} rango={rango} />

      <div className={shared.detailGrid}>
        <ReportCard
          title="Ventas por categoría"
          description="Importe vendido e ítems por familia comercial"
          action={
            <Layers3Icon className={shared.headerIcon} aria-hidden="true" />
          }
        >
          <VentasProductoTabla
            rows={d.porCategoria}
            categoria
            margenes={d.margenesVisibles}
          />
          {d.margenesVisibles ? (
            <p className={styles.note}>
              Margen: ventas menos costo registrado. Contribución: ventas menos
              costos variables de materiales, consumibles y desgaste.
            </p>
          ) : null}
        </ReportCard>
        <ReportCard
          title="Productos más vendidos"
          description="Hasta 20 productos, ordenados por importe de ventas"
          action={<BoxIcon className={shared.headerIcon} aria-hidden="true" />}
        >
          <VentasProductoTabla
            rows={d.porProducto}
            margenes={d.margenesVisibles}
          />
          <p className={styles.note}>
            Ítems cuenta renglones de las órdenes. No representa la cantidad de
            piezas producidas.
          </p>
        </ReportCard>
      </div>

      <div className={styles.sectionLabel}>
        <PlusIcon aria-hidden="true" />
        <span>Adicionales y configuración del trabajo</span>
      </div>
      <div className={shared.detailGrid}>
        <ReportCard
          title="Adicionales más pedidos"
          description="Frecuencia sobre todos los ítems vendidos"
          action={<PlusIcon className={shared.headerIcon} aria-hidden="true" />}
        >
          {ad.porAdicional.length ? (
            <Scroll label="Adicionales más pedidos">
              <table
                className={shared.table}
                aria-label="Adicionales más pedidos"
              >
                <thead>
                  <tr>
                    <th scope="col">Adicional</th>
                    <th scope="col">Ítems</th>
                    <th scope="col">% del total</th>
                    <th scope="col">Ventas de esos ítems</th>
                  </tr>
                </thead>
                <tbody>
                  {ad.porAdicional.map((a) => (
                    <tr key={a.etiqueta}>
                      <th scope="row">
                        {a.etiqueta}
                        <Track value={a.pctItems} />
                      </th>
                      <td>{numero(a.items)}</td>
                      <td>{pct(a.pctItems)}</td>
                      <td>{money(a.ventas)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Scroll>
          ) : (
            <NoData
              title={
                ad.itemsTotales
                  ? "Sin adicionales en las ventas"
                  : "Sin ventas en el período"
              }
              description="Los adicionales seleccionados en cada trabajo aparecerán acá."
            />
          )}
          <p className={styles.note}>
            Las ventas corresponden al ítem completo, no al precio del
            adicional. Un ítem puede incluir varios adicionales: los porcentajes
            y ventas de estas filas no se suman.
          </p>
        </ReportCard>
        <ReportCard
          title="Ticket por ítem"
          description="Comparación de trabajos con y sin adicionales · sin IVA"
          action={
            <ChartColumnIcon className={shared.headerIcon} aria-hidden="true" />
          }
        >
          {ad.itemsTotales ? (
            <>
              <div className={styles.ticketSummary}>
                <div>
                  <span>Con adicionales</span>
                  <strong>{ticketCon ? money(ad.ticketItemCon) : "—"}</strong>
                  <small>{numero(ad.itemsCon)} ítems</small>
                </div>
                <div>
                  <span>Sin adicionales</span>
                  <strong>{ticketSin ? money(ad.ticketItemSin) : "—"}</strong>
                  <small>{numero(ad.itemsTotales - ad.itemsCon)} ítems</small>
                </div>
              </div>
              {diferencia != null ? (
                <div className={styles.ticketDifference}>
                  <strong>
                    {diferencia > 0 ? "+" : ""}
                    {pct(diferencia)}
                  </strong>
                  <span>diferencia de ticket entre ambos grupos</span>
                </div>
              ) : (
                <p className={styles.comparisonMissing}>
                  Sin base suficiente para comparar ambos grupos.
                </p>
              )}
              <details className={shared.dataDetails}>
                <summary>
                  Ver datos del ticket
                  <ChevronDownIcon size={14} aria-hidden="true" />
                </summary>
                <Scroll label="Ticket por grupo">
                  <table className={shared.table} aria-label="Ticket por grupo">
                    <thead>
                      <tr>
                        <th scope="col">Grupo</th>
                        <th scope="col">Ítems</th>
                        <th scope="col">Ticket promedio</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th scope="row">Con adicionales</th>
                        <td>{numero(ad.itemsCon)}</td>
                        <td>{ticketCon ? money(ad.ticketItemCon) : "—"}</td>
                      </tr>
                      <tr>
                        <th scope="row">Sin adicionales</th>
                        <td>{numero(ad.itemsTotales - ad.itemsCon)}</td>
                        <td>{ticketSin ? money(ad.ticketItemSin) : "—"}</td>
                      </tr>
                    </tbody>
                  </table>
                </Scroll>
              </details>
            </>
          ) : (
            <NoData
              title="Sin tickets para comparar"
              description="El ticket promedio se calcula por ítem vendido, con y sin adicionales."
            />
          )}
          <p className={styles.note}>
            Cada grupo puede contener productos distintos. La diferencia
            observada no mide cuánto agrega un adicional al precio.
          </p>
        </ReportCard>
      </div>

      <ReportCard
        title="Adicionales por producto"
        description="Hasta 12 productos por cantidad de ítems vendidos"
      >
        {ad.porProducto.length ? (
          <Scroll label="Adicionales por producto">
            <table
              className={shared.table}
              aria-label="Adicionales por producto"
            >
              <thead>
                <tr>
                  <th scope="col">Producto</th>
                  <th scope="col">Ítems</th>
                  <th scope="col">Con adicionales</th>
                  <th scope="col">Participación</th>
                </tr>
              </thead>
              <tbody>
                {ad.porProducto.map((p) => (
                  <tr key={p.nombre}>
                    <th scope="row">
                      {p.nombre}
                      <Track value={p.pctCon} />
                    </th>
                    <td>{numero(p.items)}</td>
                    <td>{numero(p.itemsCon)}</td>
                    <td>{pct(p.pctCon)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Scroll>
        ) : (
          <NoData
            title="Sin productos para analizar"
            description="Este detalle aparece cuando hay ítems vendidos en el período."
          />
        )}
      </ReportCard>

      <div className={styles.sectionLabel}>
        <RulerIcon aria-hidden="true" />
        <span>Medidas, materiales y tecnologías</span>
      </div>
      <ReportCard
        title="Medida estándar vs. a medida"
        description="Cómo se cotizaron los trabajos del período"
        action={<RulerIcon className={shared.headerIcon} aria-hidden="true" />}
      >
        {med.items > 0 ? (
          <>
            <div className={styles.measureOverview}>
              <div className={styles.measureHeadline}>
                <strong>
                  {numero(d.totalM2)} <span>m²</span>
                </strong>
                <span>Superficie de piezas cotizadas</span>
              </div>
              <div className={styles.measureDistribution}>
                <div className={styles.measureBar} aria-hidden="true">
                  <span
                    style={{
                      flex: med.estandar,
                      background: "var(--brand-graphite)",
                    }}
                  />
                  <span
                    style={{
                      flex: med.personalizada,
                      background: "var(--accent)",
                    }}
                  />
                </div>
                <div className={styles.measureLabels}>
                  {cantidades.map((c) => (
                    <span key={c.label}>
                      {c.label}
                      <strong>{pct(c.pct)}</strong>
                      <small>{numero(c.items)} ítems</small>
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <Scroll label="Medidas por producto">
              <table className={shared.table} aria-label="Medidas por producto">
                <thead>
                  <tr>
                    <th scope="col">Producto</th>
                    <th scope="col">Ítems con dato</th>
                    <th scope="col">Estándar</th>
                    <th scope="col">A medida</th>
                    <th scope="col">A medida %</th>
                  </tr>
                </thead>
                <tbody>
                  {med.porProducto.map((p) => (
                    <tr key={p.nombre}>
                      <th scope="row">{p.nombre}</th>
                      <td>{numero(p.items)}</td>
                      <td>{numero(p.estandar)}</td>
                      <td>{numero(p.personalizada)}</td>
                      <td>{pct(100 - p.pctEstandar)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Scroll>
          </>
        ) : (
          <NoData
            title="Sin ítems con medida identificada"
            description="El porcentaje se calcula con el modo de medida guardado al cotizar."
          />
        )}
        <p className={styles.note}>
          {numero(med.items)} ítems con dato de medida · {numero(med.sinDato)}{" "}
          sin dato, excluidos del porcentaje. El detalle muestra hasta ocho
          productos por cantidad de ítems.
        </p>
        <details className={shared.dataDetails}>
          <summary>
            Ver totales y medidas estándar
            <ChevronDownIcon size={14} aria-hidden="true" />
          </summary>
          <Scroll label="Totales de medidas">
            <table className={shared.table} aria-label="Totales de medidas">
              <thead>
                <tr>
                  <th scope="col">Modo de medida</th>
                  <th scope="col">Ítems</th>
                  <th scope="col">Porcentaje conocido</th>
                </tr>
              </thead>
              <tbody>
                {cantidades.map((c) => (
                  <tr key={c.label}>
                    <th scope="row">{c.label}</th>
                    <td>{numero(c.items)}</td>
                    <td>{pct(c.pct)}</td>
                  </tr>
                ))}
                <tr>
                  <th scope="row">Sin dato</th>
                  <td>{numero(med.sinDato)}</td>
                  <td>Excluidos</td>
                </tr>
              </tbody>
            </table>
          </Scroll>
          {med.topEstandar.length ? (
            <>
              <div className={styles.drillHeading}>
                <strong>Medidas estándar más usadas</strong>
                <span>Hasta seis nombres registrados</span>
              </div>
              <Scroll label="Medidas estándar más usadas">
                <table
                  className={shared.table}
                  aria-label="Medidas estándar más usadas"
                >
                  <thead>
                    <tr>
                      <th scope="col">Medida</th>
                      <th scope="col">Ítems</th>
                    </tr>
                  </thead>
                  <tbody>
                    {med.topEstandar.map((t) => (
                      <tr key={t.nombre}>
                        <th scope="row">{t.nombre}</th>
                        <td>{numero(t.items)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Scroll>
            </>
          ) : null}
        </details>
      </ReportCard>

      <div className={shared.detailGrid}>
        <ReportCard
          title="Uso de papel y material"
          description="Consumo teórico guardado al cotizar"
          action={
            <Layers3Icon className={shared.headerIcon} aria-hidden="true" />
          }
        >
          <Materials rows={d.porPapel} costos={d.margenesVisibles} />
          <p className={styles.note}>
            Cantidades por unidad y formato. No representa movimientos ni
            disponibilidad de stock.
          </p>
        </ReportCard>
        <ReportCard
          title="Consumo de tintas y tóner"
          description="Consumo teórico de las órdenes emitidas"
          action={
            <DropletsIcon className={shared.headerIcon} aria-hidden="true" />
          }
        >
          <Materials rows={d.consumoTintas} costos={false} tinta />
          <p className={styles.note}>
            Se conservan los decimales del consumo registrado, incluso para
            cantidades pequeñas.
          </p>
        </ReportCard>
      </div>
      <ReportCard
        title="Ventas por tecnología"
        description="Distribución del importe vendido · sin IVA"
        action={
          <ChartColumnIcon className={shared.headerIcon} aria-hidden="true" />
        }
      >
        {d.porTecnologia.length ? (
          <Scroll label="Ventas por tecnología">
            <table
              className={cn(shared.table, styles.technologyTable)}
              aria-label="Ventas por tecnología"
            >
              <thead>
                <tr>
                  <th scope="col">Tecnología</th>
                  <th scope="col">Participación</th>
                  <th scope="col">Ventas</th>
                </tr>
              </thead>
              <tbody>
                {d.porTecnologia.map((m) => (
                  <tr key={m.nombre}>
                    <th scope="row">
                      {technologyCodeLabel(m.nombre) || m.nombre}
                      <Track value={m.pct} />
                    </th>
                    <td>{pct(m.pct)}</td>
                    <td>{money(m.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Scroll>
        ) : (
          <NoData
            title="Sin ventas por tecnología"
            description="La tecnología se obtiene de la configuración guardada en cada cotización."
          />
        )}
      </ReportCard>
      <ReportSource meta={d.meta} />
    </div>
  );
}
