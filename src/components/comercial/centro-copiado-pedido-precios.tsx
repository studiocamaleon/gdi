"use client";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import {
  autorizarMargenCopiado,
  type RevisionCopiado,
} from "@/lib/centro-copiado-pedidos-api";
import { usePuede } from "@/components/navigation/permisos-provider";
import styles from "./centro-copiado-tarifarios.module.css";

export function CentroCopiadoPedidoPrecios({
  revision,
  vigente,
  ocupado,
  editable,
  onRevisar,
  onAutorizado,
}: {
  revision: RevisionCopiado | null;
  vigente: boolean;
  ocupado: boolean;
  editable: boolean;
  onRevisar(): void;
  onAutorizado(r: RevisionCopiado): void;
}) {
  const puedeAutorizar = usePuede("comercial.aprobar_descuento");
  const puedeVerMargen = usePuede("finanzas.ver_margenes");
  const [abierto, setAbierto] = useState(false),
    [motivo, setMotivo] = useState(""),
    [autorizando, setAutorizando] = useState(false);
  const campoId = useId();
  const r = revision?.modalidad === "TARIFARIO" ? revision : null;
  const c = r?.calculado;
  const estados = c
    ? [c.control.estado, ...c.terminaciones.map((t) => t.control.estado)]
    : [];
  const bloqueado =
    estados.includes("BLOQUEADO") ||
    estados.includes("NO_VERIFICABLE") ||
    c?.estado === "PRECIO_PENDIENTE";
  const necesita = estados.includes("REQUIERE_AUTORIZACION");
  const mensaje = !vigente
    ? "Actualizá los precios para revisar todas las cargas del pedido."
    : c?.estado === "PRECIO_PENDIENTE"
      ? "Falta un precio en la matriz. Completalo antes de emitir."
      : estados.includes("NO_VERIFICABLE")
        ? "Hay costos sin verificar. Revisá la configuración antes de emitir."
        : estados.includes("BLOQUEADO")
          ? "El tarifario exige alcanzar el margen mínimo. Ajustá los precios antes de emitir."
          : necesita && !r?.autorizado
            ? "Se necesita una autorización con motivo antes de emitir."
            : r?.autorizado
              ? `Autorizado por ${r.autorizado.nombre}: ${r.autorizado.motivo}`
              : revision?.modalidad === "MOTOR"
                ? "Este canal utiliza los precios del motor."
                : "Los precios y el margen están revisados.";
  async function autorizar() {
    if (!r?.id || !r.huella || !vigente || autorizando) return;
    setAutorizando(true);
    try {
      const nueva = await autorizarMargenCopiado(r.id, r.huella, motivo.trim());
      onAutorizado(nueva);
      setAbierto(false);
      setMotivo("");
      toast.success("Margen autorizado para este cálculo.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo autorizar.");
    } finally {
      setAutorizando(false);
    }
  }
  return (
    <Card className={styles.pedidoPrecios}>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Precios de Centro de copiado</CardTitle>
          <Badge variant={bloqueado && vigente ? "destructive" : "outline"}>
            {!vigente
              ? "Pendiente de revisión"
              : r
                ? `${r.nombre} · v${r.numero}`
                : "Motor"}
          </Badge>
        </div>
        <CardDescription>
          Volumen de todas las cargas · Preparación y mínimo una vez por pedido
          · Terminaciones aparte
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Alert variant={bloqueado && vigente ? "destructive" : "default"}>
          <AlertTitle>
            {!vigente
              ? "Revisar precios"
              : bloqueado
                ? "Emisión bloqueada"
                : necesita && !r?.autorizado
                  ? "Requiere autorización"
                  : "Revisión comercial"}
          </AlertTitle>
          <AlertDescription>{mensaje}</AlertDescription>
        </Alert>
        {vigente && c && (
          <div className="flex flex-wrap gap-2">
            {c.grupos.map((g, i) => (
              <Badge variant="secondary" key={i}>
                {g.cantidad}{" "}
                {g.unidad === "ML"
                  ? "ML"
                  : g.unidad === "HOJA"
                    ? "hojas"
                    : "carillas"}{" "}
                · tramo desde {g.desde}
              </Badge>
            ))}
            {puedeVerMargen && c.control.porcentaje != null && (
              <Badge variant="outline">
                Margen de impresión: {c.control.porcentaje}%
              </Badge>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          loading={ocupado}
          disabled={!editable || ocupado || autorizando}
          onClick={onRevisar}
        >
          Actualizar precios de copiado
        </Button>
        {vigente &&
          necesita &&
          !bloqueado &&
          !r?.autorizado &&
          puedeAutorizar &&
          puedeVerMargen && (
            <Button disabled={ocupado} onClick={() => setAbierto(true)}>
              Autorizar margen
            </Button>
          )}
      </CardFooter>
      <Dialog
        open={abierto}
        onOpenChange={(v) => {
          if (!autorizando) setAbierto(v);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Autorizar margen de copiado</DialogTitle>
            <DialogDescription>
              La autorización corresponde a estos archivos, cantidades, canal y
              precios. Cualquier cambio requiere una nueva revisión.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={campoId}>Motivo de la excepción</FieldLabel>
              <Textarea
                id={campoId}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                minLength={10}
                maxLength={1000}
                disabled={autorizando}
              />
              <FieldDescription>
                Quedará registrado junto con tu nombre y la fecha.
              </FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={autorizando}
              onClick={() => setAbierto(false)}
            >
              Cancelar
            </Button>
            <Button
              loading={autorizando}
              disabled={!vigente || motivo.trim().length < 10 || autorizando}
              onClick={() => void autorizar()}
            >
              Confirmar autorización
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
