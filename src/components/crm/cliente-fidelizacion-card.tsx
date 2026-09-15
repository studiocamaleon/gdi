"use client";
import * as React from "react";
import { toast } from "sonner";
import {
  ajustarPuntos,
  getFidelizacionCuenta,
  type FidelizacionCuenta,
} from "@/lib/fidelizacion-api";
import { Card, Chip, Input, Label, Modal, TextField } from "@heroui/react";
import { ActionButton } from "@/components/design-system/action-button";
import { FormDialog } from "@/components/design-system/form-dialog";
import focus from "@/components/design-system/field-focus.module.css";
import styles from "@/components/clientes/clientes.module.css";
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
    <Card className={styles.sectionCard}>
      <Card.Header className={styles.sectionHeader}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Card.Title className={styles.sectionTitle}>
              Puntos de fidelización
            </Card.Title>
            <Card.Description>
              Saldo, reservas y movimientos auditados del cliente.
            </Card.Description>
          </div>
          {puedeAjustar && (
            <ActionButton
              type="button"
              variant="outline"
              onPress={() => setOpen(true)}
            >
              Ajustar puntos
            </ActionButton>
          )}
        </div>
      </Card.Header>
      <Card.Content className={styles.sectionBody}>
        <div className={styles.loyaltySummary}>
          <div>
            <p className={styles.points}>{data?.disponiblesPuntos ?? 0}</p>
            <p className={styles.pointsHint}>
              disponibles · equivalente a $
              {(data?.equivalenteMonetario ?? 0).toLocaleString("es-AR")}
            </p>
          </div>
          <Chip size="sm" variant="soft">
            {data?.reservadosPuntos ?? 0} reservados
          </Chip>
          {(data?.saldoPuntos ?? 0) < 0 && (
            <Chip size="sm" color="danger" variant="soft">
              Saldo negativo auditado
            </Chip>
          )}
        </div>
        <div className={styles.tableFrame}>
          <Table className={styles.table}>
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
                  <TableCell colSpan={4} className="text-center">
                    Todavía no hay movimientos.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card.Content>
      {puedeAjustar && (
        <FormDialog
          isOpen={open}
          onOpenChange={setOpen}
          title="Ajustar puntos"
          description="El movimiento quedará auditado y requiere un motivo."
        >
          <Modal.Body className={styles.dialogBody}>
            <TextField>
              <Label htmlFor="ajuste-puntos">Puntos</Label>
              <Input
                id="ajuste-puntos"
                type="number"
                min="1"
                value={puntos || ""}
                onChange={(event) => setPuntos(Number(event.target.value))}
                className={focus.singleBorder}
              />
            </TextField>
            <TextField>
              <Label htmlFor="ajuste-motivo">Motivo</Label>
              <Input
                id="ajuste-motivo"
                value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
                className={focus.singleBorder}
              />
            </TextField>
          </Modal.Body>
          <Modal.Footer className={styles.dialogFooter}>
            <ActionButton
              type="button"
              variant="outline"
              isDisabled={puntos < 1 || motivo.trim().length < 3}
              onPress={() => void ajustar("DEBITO")}
            >
              Debitar
            </ActionButton>
            <ActionButton
              type="button"
              isDisabled={puntos < 1 || motivo.trim().length < 3}
              onPress={() => void ajustar("CREDITO")}
            >
              Acreditar
            </ActionButton>
          </Modal.Footer>
        </FormDialog>
      )}
    </Card>
  );
}
