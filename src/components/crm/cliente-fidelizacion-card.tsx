"use client";
import * as React from "react";
import { toast } from "sonner";
import {
  ajustarPuntos,
  getFidelizacionCuenta,
  type FidelizacionCuenta,
} from "@/lib/fidelizacion-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

export function ClienteFidelizacionCard({
  clienteId,
  puedeAjustar,
}: {
  clienteId: string;
  puedeAjustar: boolean;
}) {
  const [data, setData] = React.useState<FidelizacionCuenta | null>(null);
  const [open, setOpen] = React.useState(false);
  const [puntos, setPuntos] = React.useState(0);
  const [motivo, setMotivo] = React.useState("");
  const cargar = React.useCallback(
    () =>
      getFidelizacionCuenta(clienteId)
        .then(setData)
        .catch(() => undefined),
    [clienteId],
  );
  React.useEffect(() => {
    void cargar();
  }, [cargar]);
  const ajustar = async (tipo: "CREDITO" | "DEBITO") => {
    try {
      await ajustarPuntos(clienteId, { tipo, puntos, motivo });
      await cargar();
      setOpen(false);
      toast.success("Ajuste registrado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo ajustar.");
    }
  };
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Puntos de fidelización</CardTitle>
            <CardDescription>
              Saldo, reservas y movimientos auditados del cliente.
            </CardDescription>
          </div>
          {puedeAjustar ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger render={<Button variant="outline" size="sm" />}>
                Ajustar puntos
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Ajustar puntos</DialogTitle>
                  <DialogDescription>
                    El movimiento quedará auditado y requiere un motivo.
                  </DialogDescription>
                </DialogHeader>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="ajuste-puntos">Puntos</FieldLabel>
                    <Input
                      id="ajuste-puntos"
                      type="number"
                      min="1"
                      value={puntos || ""}
                      onChange={(e) => setPuntos(Number(e.target.value))}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="ajuste-motivo">Motivo</FieldLabel>
                    <Input
                      id="ajuste-motivo"
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                    />
                  </Field>
                </FieldGroup>
                <DialogFooter>
                  <Button
                    variant="outline"
                    disabled={puntos < 1 || motivo.trim().length < 3}
                    onClick={() => void ajustar("DEBITO")}
                  >
                    Debitar
                  </Button>
                  <Button
                    disabled={puntos < 1 || motivo.trim().length < 3}
                    onClick={() => void ajustar("CREDITO")}
                  >
                    Acreditar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <p className="text-3xl font-semibold">
              {data?.disponiblesPuntos ?? 0}
            </p>
            <p className="text-sm text-muted-foreground">
              disponibles · equivalente a $
              {(data?.equivalenteMonetario ?? 0).toLocaleString("es-AR")}
            </p>
          </div>
          <div>
            <Badge variant="secondary">
              {data?.reservadosPuntos ?? 0} reservados
            </Badge>
          </div>
          {(data?.saldoPuntos ?? 0) < 0 ? (
            <Badge variant="destructive">Saldo negativo auditado</Badge>
          ) : null}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Movimiento</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead className="text-right">Puntos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.movimientos.length ? (
              data.movimientos.slice(0, 10).map((mov) => (
                <TableRow key={mov.id}>
                  <TableCell>
                    {new Date(mov.createdAt).toLocaleDateString("es-AR")}
                  </TableCell>
                  <TableCell>{mov.tipo.replaceAll("_", " ")}</TableCell>
                  <TableCell>{mov.motivo ?? "—"}</TableCell>
                  <TableCell className="text-right font-medium">
                    {mov.deltaPuntos > 0 ? "+" : ""}
                    {mov.deltaPuntos}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground"
                >
                  Todavía no hay movimientos.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
