"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  BanknoteIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  HandCoinsIcon,
  LandmarkIcon,
  SearchIcon,
  ShieldAlertIcon,
  Undo2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { usePuede } from "@/components/navigation/permisos-provider";
import {
  useConfigRegional,
  useFecha,
} from "@/components/navigation/config-regional-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type {
  CobroPendienteAcreditacion,
  CuentaFondos,
  ValorTesoreria,
} from "@/lib/administracion";
import {
  acreditarCobro,
  acreditarValor,
  depositarValor,
  rechazarValor,
  revertirAcreditacionValor,
  revertirDepositoValor,
} from "@/lib/administracion-api";
import {
  anularPagoEgreso,
  debitarValorPropio,
  rechazarValorPropio,
} from "@/lib/egresos-api";
import { formatearMoneda, monedaDe } from "@/lib/moneda";

import styles from "./tesoreria-view.module.css";

type OperacionValor =
  | { tipo: "depositar"; valor: ValorTesoreria }
  | { tipo: "acreditar"; valor: ValorTesoreria }
  | { tipo: "debitar"; valor: ValorTesoreria }
  | { tipo: "rechazar"; valor: ValorTesoreria }
  | { tipo: "rechazar_propio"; valor: ValorTesoreria }
  | { tipo: "anular_propio"; valor: ValorTesoreria }
  | { tipo: "revertir_deposito"; valor: ValorTesoreria }
  | { tipo: "revertir_acreditacion"; valor: ValorTesoreria }
  | null;

const ESTADOS: Record<string, string> = {
  recibido: "Recibido del cliente",
  cartera: "En cartera",
  depositado: "Depositado",
  acreditado: "Acreditado",
  endosado: "Endosado",
  rechazado: "Rechazado",
  debitado: "Debitado",
  emitido: "Emitido",
  anulado: "Anulado",
  deposito_revertido: "Depósito corregido",
  acreditacion_revertida: "Acreditación corregida",
  endoso_revertido: "Endoso anulado",
};

function detalleEvento(detalle: unknown): string | null {
  if (!detalle || typeof detalle !== "object") return null;
  const datos = detalle as Record<string, unknown>;
  const partes = [
    typeof datos.proveedorNombre === "string"
      ? `Proveedor: ${datos.proveedorNombre}`
      : null,
    typeof datos.cuentaNombre === "string"
      ? `Cuenta: ${datos.cuentaNombre}`
      : null,
    typeof datos.pagoNumero === "string"
      ? `Orden de pago: ${datos.pagoNumero}`
      : null,
    typeof datos.motivo === "string" ? `Motivo: ${datos.motivo}` : null,
  ].filter(Boolean);
  return partes.length ? partes.join(" · ") : null;
}

function hoyEnZona(zonaHoraria: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zonaHoraria,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function sumarPorMoneda<T>(
  items: T[],
  getMoneda: (item: T) => string,
  getImporte: (item: T) => number,
) {
  const totales = new Map<string, number>();
  for (const item of items) {
    const codigo = getMoneda(item);
    totales.set(codigo, (totales.get(codigo) ?? 0) + getImporte(item));
  }
  return [...totales.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function selectorCuenta(
  value: string,
  onValueChange: (value: string) => void,
  cuentas: CuentaFondos[],
) {
  const seleccionada = cuentas.find((cuenta) => cuenta.id === value);
  return (
    <Select value={value} onValueChange={(next) => onValueChange(next ?? "")}>
      <SelectTrigger className="w-full" aria-label="Cuenta de depósito">
        <SelectValue>
          {seleccionada
            ? `${seleccionada.nombre} · ${seleccionada.moneda}`
            : "Seleccionar cuenta"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {cuentas.map((cuenta) => (
            <SelectItem key={cuenta.id} value={cuenta.id}>
              {cuenta.nombre} · {cuenta.moneda}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function ValorOperacionDialog({
  operacion,
  cuentas,
  hoy,
  ocupado,
  onClose,
  onConfirmar,
}: {
  operacion: Exclude<OperacionValor, null>;
  cuentas: CuentaFondos[];
  hoy: string;
  ocupado: boolean;
  onClose: () => void;
  onConfirmar: (payload: {
    cuentaDestinoId?: string;
    fecha?: string;
    referencia?: string;
    notas?: string;
    motivo?: string;
  }) => void;
}) {
  const compatibles = cuentas.filter(
    (cuenta) =>
      cuenta.activo &&
      cuenta.moneda === operacion.valor.moneda &&
      (cuenta.tipo === "banco" || cuenta.tipo === "billetera"),
  );
  const [cuentaId, setCuentaId] = React.useState(
    operacion.valor.cuentaDeposito?.id ?? compatibles[0]?.id ?? "",
  );
  const [fecha, setFecha] = React.useState(hoy);
  const [referencia, setReferencia] = React.useState("");
  const [notas, setNotas] = React.useState("");
  const [motivo, setMotivo] = React.useState("");
  const esCorreccion =
    operacion.tipo === "revertir_deposito" ||
    operacion.tipo === "revertir_acreditacion";
  const requiereMotivo =
    operacion.tipo === "rechazar" ||
    operacion.tipo === "rechazar_propio" ||
    operacion.tipo === "anular_propio" ||
    esCorreccion;
  const titulo =
    operacion.tipo === "depositar"
      ? "Depositar cheque"
      : operacion.tipo === "acreditar"
        ? "Confirmar acreditación"
        : operacion.tipo === "debitar"
          ? "Confirmar débito bancario"
          : operacion.tipo === "revertir_deposito"
            ? "Deshacer depósito"
            : operacion.tipo === "revertir_acreditacion"
              ? "Deshacer acreditación"
              : operacion.tipo === "anular_propio"
                ? "Anular cheque emitido"
                : operacion.tipo === "rechazar_propio"
                  ? "Registrar rechazo bancario"
                  : "Registrar rechazo";
  const invalido =
    (operacion.tipo === "depositar" && !cuentaId) ||
    (requiereMotivo && motivo.trim().length < 3);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gp-modal" overlayClassName="gp-modal-overlay">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            Cheque {operacion.valor.numero} · {operacion.valor.banco} ·{" "}
            {formatearMoneda(
              operacion.valor.importe,
              monedaDe(operacion.valor.moneda),
            )}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          {operacion.tipo === "depositar" ? (
            <Field>
              <FieldLabel>Cuenta bancaria</FieldLabel>
              {selectorCuenta(cuentaId, setCuentaId, compatibles)}
              {compatibles.length === 0 ? (
                <p className="text-sm text-destructive">
                  No hay una cuenta activa en {operacion.valor.moneda}.
                </p>
              ) : null}
            </Field>
          ) : null}
          {operacion.tipo !== "anular_propio" ? (
            <Field>
              <FieldLabel htmlFor="valor-fecha">
                {operacion.tipo === "depositar"
                  ? "Fecha de depósito"
                  : operacion.tipo === "acreditar"
                    ? "Fecha de acreditación"
                    : operacion.tipo === "debitar"
                      ? "Fecha del débito"
                      : esCorreccion
                        ? "Fecha de corrección"
                        : "Fecha de rechazo"}
              </FieldLabel>
              <Input
                id="valor-fecha"
                type="date"
                value={fecha}
                onChange={(event) => setFecha(event.target.value)}
              />
            </Field>
          ) : null}
          {operacion.tipo === "acreditar" || operacion.tipo === "debitar" ? (
            <Field>
              <FieldLabel htmlFor="valor-referencia">
                Referencia bancaria
              </FieldLabel>
              <Input
                id="valor-referencia"
                value={referencia}
                onChange={(event) => setReferencia(event.target.value)}
              />
            </Field>
          ) : null}
          {requiereMotivo ? (
            <Field data-invalid={motivo.length > 0 && motivo.trim().length < 3}>
              <FieldLabel htmlFor="valor-motivo">
                {esCorreccion
                  ? "Motivo de la corrección"
                  : operacion.tipo === "anular_propio"
                    ? "Motivo de la anulación"
                    : "Motivo del rechazo"}
              </FieldLabel>
              <Textarea
                id="valor-motivo"
                value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
                placeholder={
                  esCorreccion
                    ? "Se seleccionó una cuenta incorrecta, se confirmó antes de tiempo…"
                    : operacion.tipo === "anular_propio"
                      ? "Se reemplazó el medio de pago, se anuló la emisión…"
                      : "Fondos insuficientes, firma, orden de no pagar…"
                }
              />
            </Field>
          ) : (
            <Field>
              <FieldLabel htmlFor="valor-notas">Notas</FieldLabel>
              <Textarea
                id="valor-notas"
                value={notas}
                onChange={(event) => setNotas(event.target.value)}
              />
            </Field>
          )}
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant={
              operacion.tipo === "rechazar" ||
              operacion.tipo === "rechazar_propio" ||
              operacion.tipo === "anular_propio"
                ? "destructive"
                : "default"
            }
            loading={ocupado}
            loadingText="Registrando…"
            disabled={invalido}
            onClick={() =>
              onConfirmar({
                cuentaDestinoId:
                  operacion.tipo === "depositar" ? cuentaId : undefined,
                fecha,
                referencia: referencia.trim() || undefined,
                notas: notas.trim() || undefined,
                motivo: motivo.trim() || undefined,
              })
            }
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AcreditacionesView({
  initialFilas,
  initialValores,
  cuentas,
}: {
  initialFilas: CobroPendienteAcreditacion[];
  initialValores: ValorTesoreria[];
  cuentas: CuentaFondos[];
}) {
  const router = useRouter();
  const puedeGestionar = usePuede("administracion.gestionar");
  const puedeAnular = usePuede("administracion.anular");
  const { zonaHoraria } = useConfigRegional();
  const { fechaNumerica } = useFecha();
  const hoy = React.useMemo(() => hoyEnZona(zonaHoraria), [zonaHoraria]);
  const [filas, setFilas] = React.useState(
    initialFilas.filter((fila) => !fila.esCheque),
  );
  const [valores, setValores] = React.useState(initialValores);
  const [busqueda, setBusqueda] = React.useState("");
  const [estado, setEstado] = React.useState("activos");
  const [ocupadoId, setOcupadoId] = React.useState<string | null>(null);
  const [operacion, setOperacion] = React.useState<OperacionValor>(null);
  const fmt = (importe: number, codigo: string) =>
    formatearMoneda(importe, monedaDe(codigo), { decimales: 0 });

  React.useEffect(() => {
    setFilas(initialFilas.filter((fila) => !fila.esCheque));
  }, [initialFilas]);
  React.useEffect(() => setValores(initialValores), [initialValores]);

  const acreditarElectronico = async (fila: CobroPendienteAcreditacion) => {
    setOcupadoId(fila.id);
    try {
      await acreditarCobro(fila.id);
      setFilas((actuales) => actuales.filter((item) => item.id !== fila.id));
      toast.success("Cobro acreditado.");
      router.refresh();
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "No se pudo acreditar.",
      );
    } finally {
      setOcupadoId(null);
    }
  };

  const operarValor = async (payload: {
    cuentaDestinoId?: string;
    fecha?: string;
    referencia?: string;
    notas?: string;
    motivo?: string;
  }) => {
    if (!operacion) return;
    const actual = operacion;
    setOcupadoId(actual.valor.id);
    try {
      if (actual.tipo === "depositar") {
        await depositarValor(actual.valor.id, {
          cuentaDestinoId: payload.cuentaDestinoId!,
          fecha: payload.fecha!,
          notas: payload.notas,
        });
      } else if (actual.tipo === "acreditar") {
        await acreditarValor(actual.valor.id, {
          fecha: payload.fecha,
          referencia: payload.referencia,
          notas: payload.notas,
          idempotencyKey: crypto.randomUUID(),
        });
      } else if (actual.tipo === "debitar") {
        await debitarValorPropio(actual.valor.id, {
          fecha: payload.fecha,
          referencia: payload.referencia,
          notas: payload.notas,
          idempotencyKey: crypto.randomUUID(),
        });
      } else if (actual.tipo === "revertir_deposito") {
        await revertirDepositoValor(actual.valor.id, {
          fecha: payload.fecha,
          motivo: payload.motivo!,
        });
      } else if (actual.tipo === "revertir_acreditacion") {
        await revertirAcreditacionValor(actual.valor.id, {
          fecha: payload.fecha,
          motivo: payload.motivo!,
          idempotencyKey: crypto.randomUUID(),
        });
      } else if (actual.tipo === "rechazar_propio") {
        await rechazarValorPropio(actual.valor.id, {
          fecha: payload.fecha,
          motivo: payload.motivo!,
          idempotencyKey: crypto.randomUUID(),
        });
      } else if (actual.tipo === "anular_propio" && actual.valor.pagoId) {
        await anularPagoEgreso(actual.valor.pagoId, payload.motivo!);
      } else {
        await rechazarValor(actual.valor.id, {
          motivo: payload.motivo!,
          fecha: payload.fecha,
          idempotencyKey: crypto.randomUUID(),
        });
      }
      setValores((actuales) =>
        actuales.map((valor) =>
          valor.id === actual.valor.id
            ? {
                ...valor,
                estado:
                  actual.tipo === "depositar"
                    ? "depositado"
                    : actual.tipo === "acreditar"
                      ? "acreditado"
                      : actual.tipo === "debitar"
                        ? "debitado"
                        : actual.tipo === "revertir_deposito"
                          ? "cartera"
                          : actual.tipo === "revertir_acreditacion"
                            ? "depositado"
                            : actual.tipo === "rechazar_propio"
                              ? "rechazado"
                              : actual.tipo === "anular_propio"
                                ? "anulado"
                                : "rechazado",
                cuentaDeposito:
                  actual.tipo === "depositar"
                    ? (cuentas
                        .filter(
                          (cuenta) => cuenta.id === payload.cuentaDestinoId,
                        )
                        .map((cuenta) => ({
                          id: cuenta.id,
                          nombre: cuenta.nombre,
                        }))[0] ?? null)
                    : actual.tipo === "revertir_deposito"
                      ? null
                      : valor.cuentaDeposito,
                motivoRechazo:
                  actual.tipo === "rechazar"
                    ? (payload.motivo ?? null)
                    : actual.tipo === "rechazar_propio"
                      ? (payload.motivo ?? null)
                      : valor.motivoRechazo,
              }
            : valor,
        ),
      );
      toast.success(
        actual.tipo === "depositar"
          ? "Cheque depositado."
          : actual.tipo === "acreditar"
            ? "Cheque acreditado y fondos ingresados."
            : actual.tipo === "debitar"
              ? "Débito bancario confirmado."
              : actual.tipo === "revertir_deposito"
                ? "El cheque volvió a cartera."
                : actual.tipo === "revertir_acreditacion"
                  ? "La acreditación se revirtió y el cheque volvió a depositado."
                  : actual.tipo === "rechazar_propio"
                    ? "El rechazo reabrió la deuda y corrigió los fondos si correspondía."
                    : actual.tipo === "anular_propio"
                      ? "El cheque propio quedó anulado."
                      : "Rechazo registrado.",
      );
      setOperacion(null);
      router.refresh();
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "No se pudo operar el valor.",
      );
    } finally {
      setOcupadoId(null);
    }
  };

  const q = busqueda.trim().toLowerCase();
  const valoresFiltrados = valores.filter((valor) => {
    const coincide =
      !q ||
      `${valor.numero} ${valor.banco} ${valor.clienteNombre ?? ""} ${valor.proveedorNombre ?? ""}`
        .toLowerCase()
        .includes(q);
    const estadoCoincide =
      estado === "todos" ||
      (estado === "activos"
        ? ["cartera", "depositado", "emitido"].includes(valor.estado)
        : valor.estado === estado);
    return coincide && estadoCoincide;
  });
  const valoresRecibidosActivos = valores.filter(
    (valor) =>
      valor.origen === "tercero" &&
      ["cartera", "depositado"].includes(valor.estado),
  );
  const totalElectronico = sumarPorMoneda(
    filas,
    (fila) => fila.moneda,
    (fila) => fila.disponibleReal,
  );
  const totalValores = sumarPorMoneda(
    valoresRecibidosActivos,
    (valor) => valor.moneda,
    (valor) => valor.importe,
  );

  return (
    <main className={styles.pagina}>
      <header className={styles.subEncabezado}>
        <Link
          href="/administracion/tesoreria"
          className={`${buttonVariants({ variant: "ghost" })} ${styles.volver}`}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Volver a Tesorería
        </Link>
        <div>
          <span className={styles.eyebrow}>Tesorería · operaciones</span>
          <h1>Acreditaciones y valores</h1>
          <p>
            Confirmá fondos electrónicos y administrá el ciclo completo de
            cheques.
          </p>
        </div>
      </header>

      <section className={styles.kpisDos}>
        <article className={`${styles.kpi} ${styles.kpiPrincipal}`}>
          <span className={styles.kpiIcono} aria-hidden="true">
            <HandCoinsIcon />
          </span>
          <div className={styles.kpiTexto}>
            <span>Cobros electrónicos pendientes</span>
            <strong className={styles.valorMultiple}>
              {totalElectronico.length
                ? totalElectronico.map(([codigo, total]) => (
                    <span key={codigo}>{fmt(total, codigo)}</span>
                  ))
                : "Sin pendientes"}
            </strong>
            <small>{filas.length} operaciones</small>
          </div>
        </article>

        <article className={styles.kpi}>
          <span className={styles.kpiIcono} aria-hidden="true">
            <BanknoteIcon />
          </span>
          <div className={styles.kpiTexto}>
            <span>Cheques en cartera o depositados</span>
            <strong className={styles.valorMultiple}>
              {totalValores.length
                ? totalValores.map(([codigo, total]) => (
                    <span key={codigo}>{fmt(total, codigo)}</span>
                  ))
                : "Sin valores"}
            </strong>
            <small>
              {valoresRecibidosActivos.length} recibidos ·{" "}
              {
                valores.filter(
                  (valor) =>
                    valor.origen === "propio" && valor.estado === "emitido",
                ).length
              }{" "}
              propios por debitar
            </small>
          </div>
        </article>
      </section>

      <Card className={styles.operacionesPanel}>
        <CardHeader className={styles.operacionesHeader}>
          <CardTitle>Cobros electrónicos</CardTitle>
          <CardDescription>
            El importe disponible ya descuenta comisiones y retenciones.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filas.length ? (
            <Table className={styles.tabla}>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha estimada</TableHead>
                  <TableHead>Cliente / operación</TableHead>
                  <TableHead>Cuenta</TableHead>
                  <TableHead className="text-right">Bruto</TableHead>
                  <TableHead className="text-right">Disponible</TableHead>
                  {puedeGestionar ? <TableHead /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((fila) => (
                  <TableRow key={fila.id}>
                    <TableCell>
                      {fechaNumerica(
                        fila.fechaAcreditacionEstimada ?? fila.fecha,
                      )}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <div className="font-medium">
                        {fila.clienteNombre ?? "Sin cliente"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {fila.metodoNombre}
                        {fila.ordenNumero ? ` · ${fila.ordenNumero}` : ""}
                      </div>
                    </TableCell>
                    <TableCell>
                      {fila.cuentaDestinoNombre ?? "Sin cuenta asignada"}
                    </TableCell>
                    <TableCell className="text-right">
                      {fmt(fila.montoBruto, fila.moneda)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {fmt(fila.disponibleReal, fila.moneda)}
                    </TableCell>
                    {puedeGestionar ? (
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          loading={ocupadoId === fila.id}
                          loadingText="Acreditando…"
                          onClick={() => void acreditarElectronico(fila)}
                        >
                          <CheckIcon data-icon="inline-start" />
                          Acreditar
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ClockIcon />
                </EmptyMedia>
                <EmptyTitle>No hay cobros electrónicos pendientes</EmptyTitle>
                <EmptyDescription>
                  Los que vencen se acreditan automáticamente y también pueden
                  confirmarse manualmente.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>

      <Card className={styles.operacionesPanel}>
        <CardHeader className={styles.operacionesHeader}>
          <CardTitle>Cartera de valores</CardTitle>
          <CardDescription>
            Depósito, acreditación, rechazo e historial de cheques y eCheq.
          </CardDescription>
          <CardAction className="flex gap-2">
            <div className="relative hidden sm:block">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="w-56 pl-8"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Cheque, banco, cliente"
              />
            </div>
            <Select
              value={estado}
              onValueChange={(next) => setEstado(next ?? "activos")}
            >
              <SelectTrigger aria-label="Estado de los valores">
                <SelectValue>
                  {estado === "activos"
                    ? "Activos"
                    : estado === "todos"
                      ? "Todos"
                      : (ESTADOS[estado] ?? "Seleccionar estado")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="activos">Activos</SelectItem>
                  <SelectItem value="todos">Todos</SelectItem>
                  {Object.entries(ESTADOS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </CardAction>
        </CardHeader>
        <CardContent className={styles.carteraContenido}>
          <div className="relative sm:hidden">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Cheque, banco, cliente"
            />
          </div>
          {valoresFiltrados.length ? (
            <div className={styles.chequesGrid}>
              {valoresFiltrados.map((valor) => (
                <article
                  key={valor.id}
                  className={styles.cheque}
                  data-estado={valor.estado}
                >
                  <span className={styles.marcaAgua} aria-hidden="true">
                    G
                  </span>

                  <header className={styles.chequeHeader}>
                    <div className={styles.chequeIdentidad}>
                      <span className={styles.chequeClase}>
                        {valor.formato === "echeq"
                          ? "Cheque electrónico"
                          : "Documento de valor"}
                      </span>
                      <h3>
                        {valor.origen === "propio" ? "Cheque propio" : "Cheque"}
                        <span>Nº {valor.numero}</span>
                      </h3>
                    </div>
                    <span
                      className={styles.chequeEstado}
                      data-estado={valor.estado}
                    >
                      {ESTADOS[valor.estado] ?? valor.estado}
                    </span>
                  </header>

                  <div className={styles.chequeBanco}>
                    <span className={styles.bancoIcono} aria-hidden="true">
                      <LandmarkIcon />
                    </span>
                    <div>
                      <span>Entidad emisora</span>
                      <strong>{valor.banco}</strong>
                    </div>
                    <small>
                      {valor.formato === "echeq" ? "eCheq" : "Cheque físico"}
                    </small>
                  </div>

                  <div className={styles.chequeBeneficiario}>
                    <span>
                      {valor.origen === "propio" ? "Emitido a" : "Recibido de"}
                    </span>
                    <strong>
                      {valor.origen === "propio"
                        ? (valor.proveedorNombre ?? "Proveedor sin identificar")
                        : (valor.clienteNombre ?? "Cliente sin identificar")}
                    </strong>
                    {valor.estado === "endosado" ? (
                      <small>
                        Endosado a{" "}
                        {valor.proveedorNombre ?? "proveedor sin identificar"}
                      </small>
                    ) : null}
                  </div>

                  <div className={styles.chequeImporte}>
                    <div>
                      <span>Importe</span>
                      <strong>{fmt(valor.importe, valor.moneda)}</strong>
                    </div>
                    <div className={styles.chequeFecha}>
                      <span>Fecha de pago</span>
                      <strong>
                        {valor.fechaPago
                          ? fechaNumerica(valor.fechaPago)
                          : "A la vista"}
                      </strong>
                      {valor.cuentaDeposito ? (
                        <small>{valor.cuentaDeposito.nombre}</small>
                      ) : null}
                    </div>
                  </div>

                  {valor.identificadorBancario ? (
                    <div className={styles.identificador}>
                      ID bancario · {valor.identificadorBancario}
                    </div>
                  ) : null}

                  <div className={styles.chequeAcciones}>
                    {puedeGestionar &&
                    valor.origen === "tercero" &&
                    valor.estado === "cartera" ? (
                      <Button
                        size="sm"
                        className={styles.accionChequePrincipal}
                        onClick={() =>
                          setOperacion({ tipo: "depositar", valor })
                        }
                      >
                        <LandmarkIcon data-icon="inline-start" />
                        Depositar
                      </Button>
                    ) : null}
                    {puedeGestionar &&
                    valor.origen === "tercero" &&
                    valor.estado === "cartera" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className={styles.accionCheque}
                        onClick={() =>
                          router.push(
                            `/administracion/cuentas-por-pagar?endosarValorId=${valor.id}`,
                          )
                        }
                      >
                        <HandCoinsIcon data-icon="inline-start" />
                        Endosar
                      </Button>
                    ) : null}
                    {puedeGestionar &&
                    valor.origen === "tercero" &&
                    valor.estado === "depositado" ? (
                      <Button
                        size="sm"
                        className={styles.accionChequePrincipal}
                        onClick={() =>
                          setOperacion({ tipo: "acreditar", valor })
                        }
                      >
                        <BanknoteIcon data-icon="inline-start" />
                        Acreditar
                      </Button>
                    ) : null}
                    {puedeAnular &&
                    valor.origen === "tercero" &&
                    valor.estado === "depositado" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className={styles.accionCheque}
                        onClick={() =>
                          setOperacion({ tipo: "revertir_deposito", valor })
                        }
                      >
                        <Undo2Icon data-icon="inline-start" />
                        Deshacer depósito
                      </Button>
                    ) : null}
                    {puedeAnular &&
                    valor.origen === "tercero" &&
                    valor.estado === "acreditado" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className={styles.accionCheque}
                        onClick={() =>
                          setOperacion({
                            tipo: "revertir_acreditacion",
                            valor,
                          })
                        }
                      >
                        <Undo2Icon data-icon="inline-start" />
                        Deshacer acreditación
                      </Button>
                    ) : null}
                    {puedeGestionar &&
                    valor.origen === "propio" &&
                    valor.estado === "emitido" ? (
                      <Button
                        size="sm"
                        className={styles.accionChequePrincipal}
                        onClick={() => setOperacion({ tipo: "debitar", valor })}
                      >
                        <BanknoteIcon data-icon="inline-start" />
                        Confirmar débito
                      </Button>
                    ) : null}
                    {puedeAnular &&
                    valor.origen === "propio" &&
                    ["emitido", "debitado"].includes(valor.estado) ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        className={styles.accionChequePeligro}
                        onClick={() =>
                          setOperacion({ tipo: "rechazar_propio", valor })
                        }
                      >
                        <ShieldAlertIcon data-icon="inline-start" />
                        Informar rechazo
                      </Button>
                    ) : null}
                    {puedeAnular &&
                    ((valor.origen === "tercero" &&
                      ["cartera", "depositado", "acreditado"].includes(
                        valor.estado,
                      )) ||
                      (valor.origen === "propio" &&
                        valor.estado === "emitido" &&
                        valor.pagoId)) ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        className={styles.accionChequePeligro}
                        onClick={() =>
                          setOperacion({
                            tipo:
                              valor.origen === "propio"
                                ? "anular_propio"
                                : "rechazar",
                            valor,
                          })
                        }
                      >
                        <ShieldAlertIcon data-icon="inline-start" />
                        {valor.origen === "propio"
                          ? "Anular emisión"
                          : "Rechazar"}
                      </Button>
                    ) : null}
                  </div>
                  {valor.motivoRechazo ? (
                    <p className={styles.motivoRechazo}>
                      {valor.motivoRechazo}
                    </p>
                  ) : null}
                  {valor.eventos.length ? (
                    <Collapsible className={styles.chequeHistorial}>
                      <CollapsibleTrigger
                        className={buttonVariants({
                          variant: "ghost",
                          size: "sm",
                          className: styles.historialTrigger,
                        })}
                      >
                        <ChevronDownIcon data-icon="inline-start" />
                        Historial ({valor.eventos.length})
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <ol className={styles.historialLista}>
                          {valor.eventos.map((evento) => {
                            const detalle = detalleEvento(evento.detalle);
                            return (
                              <li
                                key={evento.id}
                                className={styles.historialEvento}
                              >
                                <span>
                                  {ESTADOS[evento.tipo] ?? evento.tipo}
                                </span>
                                <small>
                                  {evento.actorNombre
                                    ? `${evento.actorNombre} · `
                                    : ""}
                                  {fechaNumerica(evento.createdAt)}
                                </small>
                                {detalle ? <small>{detalle}</small> : null}
                              </li>
                            );
                          })}
                        </ol>
                      </CollapsibleContent>
                    </Collapsible>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BanknoteIcon />
                </EmptyMedia>
                <EmptyTitle>No hay valores para este filtro</EmptyTitle>
                <EmptyDescription>
                  Los cheques recibidos aparecen acá desde el momento del cobro.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>

      {operacion ? (
        <ValorOperacionDialog
          key={`${operacion.tipo}-${operacion.valor.id}`}
          operacion={operacion}
          cuentas={cuentas}
          hoy={hoy}
          ocupado={ocupadoId === operacion.valor.id}
          onClose={() => setOperacion(null)}
          onConfirmar={(payload) => void operarValor(payload)}
        />
      ) : null}
    </main>
  );
}
