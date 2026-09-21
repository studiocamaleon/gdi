"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
      <Alert>
        <AlertTitle>
          {datos.enUso}{" "}
          {datos.limite === null
            ? "lugares ocupados · Sin límite"
            : `de ${datos.limite} lugares ocupados`}
        </AlertTitle>
        <AlertDescription>
          {cupo && (
            <p>
              {cupo.activos} accesos habilitados · {cupo.invitacionesPendientes}{" "}
              invitaciones pendientes.
              {cupo.incluidos !== null &&
                ` ${cupo.incluidos} incluidos + ${cupo.adicionales} adicionales.`}
            </p>
          )}
          <p>
            Los accesos desactivados y las invitaciones vencidas no ocupan
            lugar.
          </p>
          {lleno && (
            <p>
              {cupo?.excedidos
                ? "El uso supera el cupo actual. Se conservan los accesos existentes."
                : "El cupo está completo."}{" "}
              Para sumar personas, liberá un lugar o solicitá ampliar el cupo.
            </p>
          )}
        </AlertDescription>
      </Alert>
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
