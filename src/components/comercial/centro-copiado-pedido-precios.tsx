"use client";
import { Button } from "./centro-copiado-ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import type { RevisionCopiado } from "@/lib/centro-copiado-pedidos-api";
import { formatearMoneda } from "@/lib/moneda";
import { monedaDe, type Moneda } from "@/lib/monedas";
import styles from "./centro-copiado-tarifarios.module.css";

export function CentroCopiadoPedidoPrecios({
  revision,
  vigente,
  ocupado,
  editable,
  error,
  faltaCanal = false,
  moneda = monedaDe("ARS"),
  sinComprobante = false,
  onRevisar,
}: {
  revision: RevisionCopiado | null;
  vigente: boolean;
  ocupado: boolean;
  editable: boolean;
  error?: string | null;
  faltaCanal?: boolean;
  moneda?: Moneda;
  sinComprobante?: boolean;
  onRevisar(): void;
}) {
  const r = revision?.modalidad === "TARIFARIO" ? revision : null;
  const pendiente = r?.calculado.estado === "PRECIO_PENDIENTE";
  const aviso = faltaCanal
    ? "Elegí un canal de venta para cotizar las impresiones."
    : error ||
      (pendiente && vigente
        ? "Falta un precio en el tarifario. Completalo antes de emitir."
        : null);
  if (ocupado)
    return (
      <p className={styles.pedidoPrecios} role="status">
        Actualizando precios de copiado…
      </p>
    );
  if (aviso)
    return (
      <div className={styles.pedidoPrecios}>
        <Alert variant={pendiente || error ? "destructive" : "default"}>
          <AlertDescription>{aviso}</AlertDescription>
        </Alert>
        {editable && !faltaCanal && (error || pendiente) && (
          <Button variant="ghost" size="sm" onClick={onRevisar}>
            Reintentar cálculo
          </Button>
        )}
      </div>
    );
  if (!vigente || !r?.resumenPrecios?.length) return null;
  const cantidad = (v: string) =>
    Number(v).toLocaleString(moneda.locale, { maximumFractionDigits: 4 });
  return (
    <section
      className={styles.pedidoPrecios}
      aria-label="Precios de impresión por papel"
    >
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[43%]">Papel</TableHead>
            <TableHead className="w-[25%]">Rango</TableHead>
            <TableHead className="text-right">Final</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {r.resumenPrecios.map((g, i) => (
            <TableRow key={i}>
              <TableCell className="whitespace-normal align-top">
                <span>{g.papel}</span>
                <small className="block text-muted-foreground">
                  {g.detalle}
                </small>
              </TableCell>
              <TableCell className="whitespace-normal align-top">
                <span>
                  {g.hasta === null
                    ? `${cantidad(g.desde)}+`
                    : `${cantidad(g.desde)}–${g.hastaExclusivo ? "<" : ""}${cantidad(g.hasta)}`}
                </span>
                <small className="block text-muted-foreground">
                  {g.unidadRango === "ML"
                    ? "metros"
                    : g.unidadRango === "CARILLA"
                      ? "carillas"
                      : "hojas"}
                </small>
              </TableCell>
              <TableCell className="whitespace-normal align-top text-right">
                <span>
                  {g.precioFinal === null
                    ? "Pendiente"
                    : formatearMoneda(Number(g.precioFinal), moneda)}
                </span>
                <small className="block text-muted-foreground">
                  por {g.unidadPrecio === "ML" ? "metro" : "hoja"}
                </small>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground">
        {sinComprobante ? "Sin IVA" : "IVA incluido"} · Terminaciones aparte
      </p>
    </section>
  );
}
