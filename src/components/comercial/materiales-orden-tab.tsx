"use client";

import { AlertCircle, Boxes, RefreshCw } from "lucide-react";
import {
  type NecesidadMaterialOrden,
} from "@/lib/materiales-orden-api";
import { useMaterialesOrden } from "@/hooks/use-materiales-orden";
import { ActionButton } from "@/components/design-system/action-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { stockUnitLabel } from "@/components/inventario/stock-conversion-fields";
import { MaterialesOrdenControl } from "./materiales-orden-control";
import styles from "./materiales-orden.module.css";

const number = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 8 });
function quantity(value: number | null, unit: string | null) {
  return value !== null && unit
    ? `${number.format(value)} ${stockUnitLabel(unit)}`
    : "Por determinar";
}

function CantidadNecesaria({ material }: { material: NecesidadMaterialOrden }) {
  if (material.cantidad !== null && material.unidad)
    return (
      <>
        {quantity(material.cantidad, material.unidad)}
        <small>Unidad de stock</small>
      </>
    );
  const unit = material.origenes[0]?.unidadCalculada;
  const native =
    unit &&
    material.origenes.every(
      (o) => o.unidadCalculada === unit && o.cantidadCalculada !== null,
    );
  return native ? (
    <>
      {quantity(
        material.origenes.reduce((total, o) => total + o.cantidadCalculada!, 0),
        unit,
      )}
      <small>Según cotización · revisar stock</small>
    </>
  ) : (
    <>Por determinar</>
  );
}

export function MaterialesOrdenTab({
  ordenId,
  versionOrden,
  consulta,
}: {
  ordenId: string;
  versionOrden?: object;
  consulta?: ReturnType<typeof useMaterialesOrden>;
}) {
  const propia = useMaterialesOrden(consulta ? null : ordenId, versionOrden);
  const { data, error, loading, actualizar } = consulta ?? propia;
  const calculadas = data?.control
    ? data.control.materiales.filter((m) => !m.excluida && !m.revisar).length
    : (data?.resumen.calculadas ?? 0);
  const porRevisar = data?.control
    ? data.control.materiales.filter((m) => m.revisar).length
    : (data?.resumen.porRevisar ?? 0);
  return (
    <section
      className={styles.panel}
      aria-label="Materiales de la orden"
      aria-busy={loading}
    >
      <header className={styles.header}>
        <div>
          <h2>
            <Boxes aria-hidden /> Materiales del trabajo
          </h2>
          <p>
            Necesidades según el cálculo guardado de esta OT. Consultá su origen
            y la disponibilidad de materiales.
          </p>
        </div>
        <ActionButton
          variant="outline"
          isDisabled={loading}
          onPress={actualizar}
        >
          <RefreshCw data-icon="inline-start" /> Actualizar
        </ActionButton>
      </header>
      {loading ? (
        <p className={styles.message} role="status">
          Consultando materiales…
        </p>
      ) : error ? (
        <p className={styles.message} role="alert">
          {error}
        </p>
      ) : data ? (
        <>
          <div className={styles.summary}>
            <span>
              <strong>{data.resumen.variantes}</strong> variantes
            </span>
            <span>
              <strong>{calculadas}</strong> con cantidad resuelta
            </span>
            {porRevisar > 0 && (
              <span className={styles.warning}>
                <AlertCircle aria-hidden />
                <strong>{porRevisar}</strong> por revisar
              </span>
            )}
          </div>
          {data.pendientes.length > 0 && (
            <div className={styles.pending}>
              <h3>Faltan datos para completar las necesidades</h3>
              <ul>
                {data.pendientes.map((p, i) => (
                  <li key={`${p.itemId}-${i}`}>
                    <strong>
                      {p.producto}
                      {p.paso ? ` · ${p.paso}` : ""}
                    </strong>
                    <span>{p.motivo}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.control && (
            <MaterialesOrdenControl
              key={`${ordenId}:${data.revision}`}
              data={data}
              onChanged={actualizar}
            />
          )}
          <details className={styles.calculation} open={!data.control}>
            <summary>Origen de las necesidades · cálculo guardado</summary>
            {data.necesidades.length > 0 ? (
              <Table className={styles.table}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead>Necesario</TableHead>
                    <TableHead>Origen del consumo</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.necesidades.map((m) => (
                    <TableRow key={m.varianteId}>
                      <TableCell>
                        <div className={styles.material}>
                          <strong>{m.nombre}</strong>
                          <span>
                            {m.origenes.every((o) => o.tipo === "consumible")
                              ? "Consumible de máquina · estimado"
                              : "Material"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className={styles.quantity}>
                        <CantidadNecesaria material={m} />
                      </TableCell>
                      <TableCell>
                        <details className={styles.details}>
                          <summary>
                            {m.origenes.length}{" "}
                            {m.origenes.length === 1 ? "origen" : "orígenes"}
                            {m.origenes.some((o) => o.loteCompartido)
                              ? " · Incluye lote compartido"
                              : ""}
                          </summary>
                          <ul>
                            {m.origenes.map((o, i) => (
                              <li key={`${o.itemId}-${i}`}>
                                <strong>{o.producto}</strong>
                                {o.documento && <span>{o.documento}</span>}
                                <span>{o.paso}</span>
                                <span>
                                  {quantity(
                                    o.cantidadCalculada,
                                    o.unidadCalculada,
                                  )}
                                  {o.loteCompartido
                                    ? " · Lote completo, contado una vez"
                                    : ""}
                                </span>
                                {o.observacion && (
                                  <p className={styles.warning}>
                                    {o.observacion}
                                  </p>
                                )}
                              </li>
                            ))}
                          </ul>
                        </details>
                      </TableCell>
                      <TableCell>
                        <span
                          className={styles.badge}
                          data-review={m.estado === "revisar"}
                        >
                          {m.estado === "calculada"
                            ? "Calculada"
                            : "Por revisar"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : !data.pendientes.length ? (
              <p className={styles.message}>
                El cálculo guardado no requiere materiales.
              </p>
            ) : null}
          </details>
          <footer className={styles.footer}>
            Las cantidades incluyen las pérdidas previstas en el cálculo. Los
            desgastes de máquina no se tratan como materiales de stock.
          </footer>
        </>
      ) : null}
    </section>
  );
}
