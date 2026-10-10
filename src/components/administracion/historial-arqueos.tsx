"use client";
import * as React from "react";
import { getArqueosCuenta } from "@/lib/administracion-api";
import { useFecha } from "@/components/navigation/config-regional-provider";
import { formatearMoneda, monedaDe } from "@/lib/moneda";
import { TesoreriaDialog } from "./tesoreria-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
export function HistorialArqueos({
  cuentaId,
  nombre,
  onCerrar,
}: {
  cuentaId: string;
  nombre: string;
  onCerrar: () => void;
}) {
  const [filas, setFilas] = React.useState<
    Awaited<ReturnType<typeof getArqueosCuenta>>
  >([]);
  const [estado, setEstado] = React.useState("cargando");
  const { fechaHoraCorta } = useFecha();
  React.useEffect(() => {
    let vivo = true;
    void getArqueosCuenta(cuentaId)
      .then((r) => {
        if (vivo) {
          setFilas(r);
          setEstado("listo");
        }
      })
      .catch(() => {
        if (vivo) setEstado("error");
      });
    return () => {
      vivo = false;
    };
  }, [cuentaId]);
  return (
    <TesoreriaDialog
      open
      onOpenChange={(o) => {
        if (!o) onCerrar();
      }}
      title="Historial de arqueos"
      description={`${nombre} · Últimos 50 conteos, incluidos los que cierran sin diferencias.`}
    >
      {estado === "cargando" ? (
        <p role="status">Cargando arqueos…</p>
      ) : estado === "error" ? (
        <Alert variant="destructive">
          <AlertDescription>No pudimos consultar los arqueos.</AlertDescription>
        </Alert>
      ) : filas.length === 0 ? (
        <p>Todavía no hay arqueos registrados.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha y responsable</TableHead>
              <TableHead>Esperado</TableHead>
              <TableHead>Contado</TableHead>
              <TableHead>Diferencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((f) => {
              const d = f.detalleJson;
              const fmt = (n: number) => formatearMoneda(n, monedaDe(d.moneda));
              return (
                <React.Fragment key={f.id}>
                  <TableRow>
                    <TableCell>
                      {fechaHoraCorta(f.createdAt)}
                      <span className="block text-xs text-muted-foreground">
                        {f.actorNombre}
                      </span>
                    </TableCell>
                    <TableCell>{fmt(d.esperado)}</TableCell>
                    <TableCell>{fmt(d.contado)}</TableCell>
                    <TableCell>
                      {d.diferencia === 0
                        ? "Sin diferencia"
                        : fmt(d.diferencia)}
                    </TableCell>
                  </TableRow>
                  {d.notas && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-xs text-muted-foreground"
                      >
                        {d.notas}
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      )}
    </TesoreriaDialog>
  );
}
