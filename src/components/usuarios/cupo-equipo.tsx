"use client";
import { useState } from "react";
import { toast } from "sonner";
import { UsersRound, UserCheck, Mail } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import styles from "./cupo-equipo.module.css";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  cancelarInvitacionUsuario,
  type ListadoUsuarios,
} from "@/lib/usuarios-api";

export function CupoEquipo({
  datos,
  recargar,
}: {
  datos: ListadoUsuarios;
  recargar: () => Promise<void>;
}) {
  const [cancelando, setCancelando] = useState<string | null>(null);
  const cupo = datos.cupo;
  const lleno = datos.limite !== null && datos.enUso >= datos.limite;
  async function cancelar(id: string) {
    setCancelando(id);
    try {
      await cancelarInvitacionUsuario(id);
      await recargar();
      toast.success("Invitación cancelada. El lugar quedó disponible.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cancelar.");
    } finally {
      setCancelando(null);
    }
  }
  return (
    <div className="flex flex-col gap-3 pb-4">
      <section className={styles.panel} aria-label="Lugares del equipo">
        <div className={styles.resumen}>
          <div className={styles.icono}>
            <UsersRound aria-hidden="true" />
          </div>
          <div>
            <span className={styles.etiqueta}>Tu equipo en Grafo</span>
            <p className={styles.ocupacion}>
              <strong>{datos.enUso}</strong>
              <span>
                {datos.enUso === 1 ? "lugar ocupado" : "lugares ocupados"}
              </span>
            </p>
          </div>
          <span className={styles.limite}>
            {datos.limite === null
              ? "Sin límite de lugares"
              : `Cupo total: ${datos.limite}`}
          </span>
        </div>
        {cupo && (
          <dl className={styles.metricas}>
            <div>
              <dt>
                <UserCheck aria-hidden="true" /> Accesos habilitados
              </dt>
              <dd>{cupo.activos}</dd>
            </div>
            <div>
              <dt>
                <Mail aria-hidden="true" /> Invitaciones pendientes
              </dt>
              <dd>{cupo.invitacionesPendientes}</dd>
            </div>
          </dl>
        )}
        <div className={styles.pie}>
          {datos.limite !== null && datos.limite > 0 && (
            <Progress
              className={styles.progreso}
              value={Math.min(datos.enUso, datos.limite)}
              max={datos.limite}
              aria-label="Ocupación del equipo"
              getAriaValueText={() =>
                `${datos.enUso} de ${datos.limite} lugares ocupados`
              }
            />
          )}
          <p>
            {cupo?.incluidos !== null && cupo?.incluidos !== undefined && (
              <span>
                {cupo.incluidos} incluidos + {cupo.adicionales}{" "}
                adicionales.{" "}
              </span>
            )}
            Los accesos desactivados y las invitaciones vencidas no ocupan
            lugar.
          </p>
        </div>
      </section>
      {lleno && (
        <Alert>
          <AlertTitle>
            {cupo?.excedidos
              ? "El uso supera el cupo actual"
              : "El cupo está completo"}
          </AlertTitle>
          <AlertDescription>
            {cupo?.excedidos ? "Se conservan los accesos existentes. " : ""}
            Para sumar personas, liberá un lugar o solicitá ampliar el cupo.
          </AlertDescription>
        </Alert>
      )}
      {!!datos.invitaciones?.length && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invitaciones que reservan un lugar</TableHead>
              <TableHead>Vencimiento</TableHead>
              <TableHead>
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {datos.invitaciones.map((i) => (
              <TableRow key={i.id}>
                <TableCell>{i.email}</TableCell>
                <TableCell>
                  {new Date(i.venceEl).toLocaleDateString("es-AR")}
                </TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={cancelando !== null}
                    onClick={() => cancelar(i.id)}
                    aria-label={`Cancelar invitación de ${i.email}`}
                  >
                    {cancelando === i.id
                      ? "Cancelando…"
                      : "Cancelar invitación"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
