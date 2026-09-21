"use client";
import { PackageSearch, RefreshCw } from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { stockUnitLabel } from "@/components/inventario/stock-conversion-fields";
import type { PrevisionMateriales } from "@/lib/prevision-materiales";
import styles from "./materiales-orden.module.css";
const fecha = (v: string) => v.split("-").reverse().join("/");
const numero = (v: number | null) =>
  v === null
    ? "Por revisar"
    : new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 }).format(v);
export function PrevisionMaterialesPanel({
  data,
  error,
  loading,
  onRefresh,
  entregasDistribuidas = false,
}: {
  data: PrevisionMateriales | null;
  error: string | null;
  loading: boolean;
  onRefresh: () => void;
  entregasDistribuidas?: boolean;
}) {
  if (data?.estado === "no_incluido" && !error) return null;
  const titulo = loading
    ? "Consultando materiales…"
    : error
      ? "Disponibilidad sin verificar"
      : data?.estado === "sin_control"
        ? "Stock sin control activo"
        : data?.estado === "disponible"
          ? "Materiales disponibles"
          : data?.estado === "por_confirmar"
            ? "Entrega por confirmar"
            : "Requiere abastecimiento";
  return (
    <section className={styles.panel} aria-label="Materiales antes de emitir">
      <div className={styles.header}>
        <div>
          <h2>
            <PackageSearch />
            {titulo}
          </h2>
          <p>
            {error ||
              (loading
                ? "La fecha sugerida se actualizará al terminar la consulta."
                : data?.estado === "sin_control"
                  ? "La fecha se calcula sólo con la producción. Activá el control en Stock para verificar materiales."
                  : data?.estado === "disponible"
                    ? data.modoReserva === "AL_EMITIR"
                      ? "El stock libre alcanza para esta cotización. Se volverá a verificar y reservar al emitir."
                      : "El stock libre alcanza para esta cotización. El control de esta empresa usa reservas manuales."
                    : data?.estado === "por_confirmar"
                      ? "Podés cotizar. Antes de comprometer la entrega, confirmá la reposición de los faltantes."
                      : `Materiales previstos para el ${fecha(data?.disponibleDesde ?? "")}. ${entregasDistribuidas ? "Revisá las fechas de las entregas distribuidas teniendo en cuenta esta reposición." : "La entrega sugerida incluye esta espera y la producción."}`)}
          </p>
        </div>
        <ActionButton
          variant="outline"
          isDisabled={loading}
          onPress={onRefresh}
        >
          <RefreshCw />
          Actualizar
        </ActionButton>
      </div>
      {data && data.estado !== "sin_control" && (
        <details className={styles.calculation}>
          <summary>
            {data.materiales.length} materiales · Ver disponibilidad y
            reposición
          </summary>
          <div className={styles.stockTableWrap}>
            <table className={styles.stockTable}>
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Necesario</th>
                  <th>Libre hoy</th>
                  <th>Faltante</th>
                  <th>Reposición prevista</th>
                </tr>
              </thead>
              <tbody>
                {data.materiales.map((m) => (
                  <tr key={m.varianteId}>
                    <td>
                      <strong>{m.nombre}</strong>
                      {m.motivo && <small>{m.motivo}</small>}
                    </td>
                    <td>
                      {numero(m.necesario)} {stockUnitLabel(m.unidad ?? "")}
                    </td>
                    <td>{numero(m.libre)}</td>
                    <td>{numero(m.faltante)}</td>
                    <td>
                      {!m.fuentes.length
                        ? m.revisar
                          ? "Por confirmar"
                          : "Disponible"
                        : m.fuentes.map((f, i) => (
                            <div key={i}>
                              {numero(f.cantidad)} ·{" "}
                              {f.fecha ? fecha(f.fecha) : "Fecha por confirmar"}
                              <small>
                                {f.compraNumero
                                  ? `OC ${f.compraNumero} · `
                                  : ""}
                                {f.proveedor ?? "Proveedor por definir"} ·{" "}
                                {f.tipo === "compra_confirmada"
                                  ? "Fecha confirmada"
                                  : f.tipo === "plazo_proveedor"
                                    ? "Plazo habitual"
                                    : f.tipo === "compra_estimada"
                                      ? "Fecha estimada"
                                      : "Revisar reposición"}
                              </small>
                            </div>
                          ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.pendientes > 0 && (
            <p className={styles.footer}>
              {data.pendientes} partes del cálculo requieren revisar sus
              materiales.
            </p>
          )}
        </details>
      )}
      {data && ["requiere_compra", "por_confirmar"].includes(data.estado) && (
        <p className={styles.footer}>
          Supone solicitar el faltante hoy ({fecha(data.fechaPedidoSupuesto)}).
          La producción se proyecta después del día de recepción, con la carga y
          el calendario del taller. Esta consulta no reserva materiales ni
          genera compras. Las fechas elegidas a mano o distribuidas se conservan
          y requieren revisión.
        </p>
      )}
    </section>
  );
}
