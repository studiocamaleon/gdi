"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownIcon,
  ArrowLeftRightIcon,
  BanknoteIcon,
  CheckCircle2Icon,
  ClipboardCheckIcon,
  DownloadIcon,
  FileTextIcon,
  LandmarkIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  Settings2Icon,
  SlidersHorizontalIcon,
  WalletIcon,
} from "lucide-react";
import { toast } from "sonner";

import { usePuede } from "@/components/navigation/permisos-provider";
import {
  useConfigRegional,
  useFecha,
} from "@/components/navigation/config-regional-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardAction,
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
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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
  CuentaFondos,
  MovimientoFondos,
  MovimientosFondosPagina,
  TesoreriaKpis,
} from "@/lib/administracion";
import {
  ajustarCuentaFondos,
  cerrarArqueo,
  conciliarMovimientoFondos,
  crearCuentaFondos,
  editarCuentaFondos,
  getMovimientosCuenta,
  transferirEntreCuentas,
} from "@/lib/administracion-api";
import { formatearMoneda, monedaDe } from "@/lib/moneda";
import { monedas } from "@/lib/monedas";
import { cn } from "@/lib/utils";

type Modal =
  | { tipo: "transferir"; desde?: string }
  | { tipo: "arqueo"; cuenta: CuentaFondos }
  | { tipo: "cuenta"; cuenta?: CuentaFondos }
  | { tipo: "ajuste"; cuenta: CuentaFondos }
  | null;

type Filtros = {
  q: string;
  origenTipo: string;
  estadoConciliacion: string;
  desde: string;
  hasta: string;
};

const PAGINA_VACIA: MovimientosFondosPagina = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 25,
  pages: 1,
};

const ORIGENES: Record<string, string> = {
  cobro: "Cobro",
  pago: "Pago",
  transferencia: "Transferencia",
  valor: "Cheque / eCheq",
  ajuste_arqueo: "Arqueo",
  ajuste_manual: "Ajuste",
  saldo_inicial: "Saldo inicial",
};

const TIPOS_CUENTA: Record<string, string> = {
  caja: "Caja de efectivo",
  banco: "Cuenta bancaria",
  billetera: "Billetera virtual",
};

const ESTADOS_CONCILIACION: Record<string, string> = {
  pendiente: "Pendiente",
  conciliado: "Conciliado",
  diferencia: "Con diferencia",
};

function hoyEnZona(zonaHoraria: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zonaHoraria,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function iconoCuenta(tipo: string) {
  if (tipo === "caja") return BanknoteIcon;
  if (tipo === "billetera") return WalletIcon;
  return LandmarkIcon;
}

function selector(
  value: string,
  onValueChange: (value: string) => void,
  opciones: Array<{ value: string; label: string }>,
  ariaLabel: string,
) {
  return (
    <Select value={value} onValueChange={(next) => onValueChange(next ?? "")}>
      <SelectTrigger className="w-full" aria-label={ariaLabel}>
        <SelectValue>
          {opciones.find((opcion) => opcion.value === value)?.label ??
            "Seleccionar"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {opciones.map((opcion) => (
            <SelectItem key={opcion.value} value={opcion.value}>
              {opcion.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function CuentaDialog({
  open,
  cuenta,
  monedaLocal,
  ocupado,
  onOpenChange,
  onGuardar,
}: {
  open: boolean;
  cuenta?: CuentaFondos;
  monedaLocal: string;
  ocupado: boolean;
  onOpenChange: (open: boolean) => void;
  onGuardar: (payload: {
    tipo: string;
    nombre: string;
    banco?: string;
    cbuAlias?: string;
    moneda: string;
    saldoInicial?: number;
    permiteSaldoNegativo: boolean;
  }) => void;
}) {
  const [tipo, setTipo] = React.useState(cuenta?.tipo ?? "banco");
  const [nombre, setNombre] = React.useState(cuenta?.nombre ?? "");
  const [banco, setBanco] = React.useState(cuenta?.banco ?? "");
  const [alias, setAlias] = React.useState(cuenta?.cbuAlias ?? "");
  const [moneda, setMoneda] = React.useState(cuenta?.moneda ?? monedaLocal);
  const [saldoInicial, setSaldoInicial] = React.useState("");
  const [negativo, setNegativo] = React.useState(
    cuenta?.permiteSaldoNegativo ?? false,
  );
  const invalido = !nombre.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{cuenta ? "Editar cuenta" : "Nueva cuenta"}</DialogTitle>
          <DialogDescription>
            {cuenta
              ? "Actualizá los datos operativos. La moneda no cambia después del primer movimiento."
              : "Registrá la cuenta con su moneda y, si corresponde, el saldo con el que comienza."}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="tes-cuenta-tipo">Tipo</FieldLabel>
            {selector(
              tipo,
              setTipo,
              [
                { value: "caja", label: "Caja de efectivo" },
                { value: "banco", label: "Cuenta bancaria" },
                { value: "billetera", label: "Billetera virtual" },
              ],
              "Tipo de cuenta",
            )}
          </Field>
          <Field data-invalid={invalido || undefined}>
            <FieldLabel htmlFor="tes-cuenta-nombre">Nombre</FieldLabel>
            <Input
              id="tes-cuenta-nombre"
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              placeholder="Ej. Banco Galicia · cuenta corriente"
              aria-invalid={invalido || undefined}
            />
            {invalido ? <FieldError>Ingresá un nombre.</FieldError> : null}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="tes-cuenta-banco">
                Banco / detalle
              </FieldLabel>
              <Input
                id="tes-cuenta-banco"
                value={banco}
                onChange={(event) => setBanco(event.target.value)}
                placeholder="Opcional"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="tes-cuenta-alias">CBU / alias</FieldLabel>
              <Input
                id="tes-cuenta-alias"
                value={alias}
                onChange={(event) => setAlias(event.target.value)}
                placeholder="Opcional"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="tes-cuenta-moneda">Moneda</FieldLabel>
              {selector(
                moneda,
                setMoneda,
                monedas.map((item) => ({
                  value: item.codigo,
                  label: `${item.codigo} · ${item.nombre}`,
                })),
                "Moneda de la cuenta",
              )}
            </Field>
            {!cuenta ? (
              <Field>
                <FieldLabel htmlFor="tes-cuenta-saldo">
                  Saldo inicial
                </FieldLabel>
                <Input
                  id="tes-cuenta-saldo"
                  type="number"
                  min={0}
                  value={saldoInicial}
                  onChange={(event) => setSaldoInicial(event.target.value)}
                  placeholder="0"
                />
                <FieldDescription>
                  Se registra como movimiento conciliado.
                </FieldDescription>
              </Field>
            ) : null}
          </div>
          <Field orientation="horizontal">
            <Checkbox
              id="tes-cuenta-negativo"
              checked={negativo}
              onCheckedChange={(checked) => setNegativo(checked === true)}
            />
            <div>
              <FieldLabel htmlFor="tes-cuenta-negativo">
                Permitir saldo negativo
              </FieldLabel>
              <FieldDescription>
                Usalo únicamente si la cuenta tiene descubierto autorizado.
              </FieldDescription>
            </div>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            loading={ocupado}
            loadingText="Guardando…"
            disabled={invalido}
            onClick={() =>
              onGuardar({
                tipo,
                nombre: nombre.trim(),
                banco: banco.trim() || undefined,
                cbuAlias: alias.trim() || undefined,
                moneda,
                saldoInicial:
                  saldoInicial && Number(saldoInicial) > 0
                    ? Number(saldoInicial)
                    : undefined,
                permiteSaldoNegativo: negativo,
              })
            }
          >
            Guardar cuenta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TransferenciaDialog({
  open,
  cuentas,
  desdeInicial,
  ocupado,
  onOpenChange,
  onGuardar,
}: {
  open: boolean;
  cuentas: CuentaFondos[];
  desdeInicial?: string;
  ocupado: boolean;
  onOpenChange: (open: boolean) => void;
  onGuardar: (payload: Parameters<typeof transferirEntreCuentas>[0]) => void;
}) {
  const [desde, setDesde] = React.useState(
    desdeInicial ?? cuentas[0]?.id ?? "",
  );
  const [hacia, setHacia] = React.useState(
    cuentas.find((cuenta) => cuenta.id !== desdeInicial)?.id ?? "",
  );
  const [monto, setMonto] = React.useState("");
  const [montoDestino, setMontoDestino] = React.useState("");
  const [referencia, setReferencia] = React.useState("");
  const [notas, setNotas] = React.useState("");
  const origen = cuentas.find((cuenta) => cuenta.id === desde);
  const destino = cuentas.find((cuenta) => cuenta.id === hacia);
  const cruzada = Boolean(
    origen && destino && origen.moneda !== destino.moneda,
  );
  const valor = Number(monto);
  const invalido =
    !origen ||
    !destino ||
    origen.id === destino.id ||
    valor <= 0 ||
    (cruzada && Number(montoDestino) <= 0) ||
    (!origen.permiteSaldoNegativo && valor > origen.saldo);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Transferencia entre cuentas</DialogTitle>
          <DialogDescription>
            Genera dos movimientos espejo y no afecta el resultado del negocio.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>Desde</FieldLabel>
            {selector(
              desde,
              setDesde,
              cuentas.map((cuenta) => ({
                value: cuenta.id,
                label: `${cuenta.nombre} · ${formatearMoneda(cuenta.saldo, monedaDe(cuenta.moneda))}`,
              })),
              "Cuenta de origen",
            )}
          </Field>
          <div className="flex justify-center text-muted-foreground">
            <ArrowDownIcon />
          </div>
          <Field>
            <FieldLabel>Hacia</FieldLabel>
            {selector(
              hacia,
              setHacia,
              cuentas
                .filter((cuenta) => cuenta.id !== desde)
                .map((cuenta) => ({ value: cuenta.id, label: cuenta.nombre })),
              "Cuenta de destino",
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              data-invalid={
                (Boolean(origen) &&
                  !origen?.permiteSaldoNegativo &&
                  valor > (origen?.saldo ?? 0)) ||
                undefined
              }
            >
              <FieldLabel htmlFor="tes-transfer-monto">
                Sale ({origen?.moneda ?? "—"})
              </FieldLabel>
              <Input
                id="tes-transfer-monto"
                type="number"
                min={0}
                value={monto}
                onChange={(event) => setMonto(event.target.value)}
              />
              {origen &&
              !origen.permiteSaldoNegativo &&
              valor > origen.saldo ? (
                <FieldError>El saldo disponible es insuficiente.</FieldError>
              ) : null}
            </Field>
            {cruzada ? (
              <Field>
                <FieldLabel htmlFor="tes-transfer-destino">
                  Llega ({destino?.moneda})
                </FieldLabel>
                <Input
                  id="tes-transfer-destino"
                  type="number"
                  min={0}
                  value={montoDestino}
                  onChange={(event) => setMontoDestino(event.target.value)}
                />
                <FieldDescription>
                  Se guarda el tipo de cambio implícito.
                </FieldDescription>
              </Field>
            ) : null}
          </div>
          <Field>
            <FieldLabel htmlFor="tes-transfer-ref">Referencia</FieldLabel>
            <Input
              id="tes-transfer-ref"
              value={referencia}
              onChange={(event) => setReferencia(event.target.value)}
              placeholder="N° de operación bancaria"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="tes-transfer-notas">Notas</FieldLabel>
            <Textarea
              id="tes-transfer-notas"
              value={notas}
              onChange={(event) => setNotas(event.target.value)}
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            loading={ocupado}
            loadingText="Transfiriendo…"
            disabled={invalido}
            onClick={() =>
              onGuardar({
                desdeCuentaId: desde,
                haciaCuentaId: hacia,
                monto: valor,
                montoDestino: cruzada ? Number(montoDestino) : undefined,
                idempotencyKey: crypto.randomUUID(),
                referencia: referencia.trim() || undefined,
                notas: notas.trim() || undefined,
              })
            }
          >
            <ArrowLeftRightIcon data-icon="inline-start" />
            Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AjusteDialog({
  open,
  cuenta,
  ocupado,
  hoy,
  onOpenChange,
  onGuardar,
}: {
  open: boolean;
  cuenta: CuentaFondos;
  ocupado: boolean;
  hoy: string;
  onOpenChange: (open: boolean) => void;
  onGuardar: (payload: Parameters<typeof ajustarCuentaFondos>[1]) => void;
}) {
  const [tipo, setTipo] = React.useState<"entrada" | "salida">("salida");
  const [monto, setMonto] = React.useState("");
  const [fecha, setFecha] = React.useState(hoy);
  const [concepto, setConcepto] = React.useState("");
  const [referencia, setReferencia] = React.useState("");
  const [notas, setNotas] = React.useState("");
  const excede =
    tipo === "salida" &&
    !cuenta.permiteSaldoNegativo &&
    Number(monto) > cuenta.saldo;
  const invalido = Number(monto) <= 0 || concepto.trim().length < 3 || excede;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajuste de fondos</DialogTitle>
          <DialogDescription>
            {cuenta.nombre}. Usalo para comisiones bancarias, intereses o
            correcciones respaldadas; el movimiento queda marcado para
            conciliar.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Movimiento</FieldLabel>
              {selector(
                tipo,
                (value) => setTipo(value as "entrada" | "salida"),
                [
                  { value: "entrada", label: "Entrada" },
                  { value: "salida", label: "Salida" },
                ],
                "Tipo de ajuste",
              )}
            </Field>
            <Field data-invalid={excede || undefined}>
              <FieldLabel htmlFor="tes-ajuste-monto">
                Monto ({cuenta.moneda})
              </FieldLabel>
              <Input
                id="tes-ajuste-monto"
                type="number"
                min={0}
                value={monto}
                onChange={(event) => setMonto(event.target.value)}
                aria-invalid={excede || undefined}
              />
              {excede ? <FieldError>Saldo insuficiente.</FieldError> : null}
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="tes-ajuste-fecha">Fecha</FieldLabel>
            <Input
              id="tes-ajuste-fecha"
              type="date"
              value={fecha}
              onChange={(event) => setFecha(event.target.value)}
            />
          </Field>
          <Field
            data-invalid={concepto.length > 0 && concepto.trim().length < 3}
          >
            <FieldLabel htmlFor="tes-ajuste-concepto">Concepto</FieldLabel>
            <Input
              id="tes-ajuste-concepto"
              value={concepto}
              onChange={(event) => setConcepto(event.target.value)}
              placeholder="Ej. Comisión mantenimiento bancario"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="tes-ajuste-ref">Referencia</FieldLabel>
            <Input
              id="tes-ajuste-ref"
              value={referencia}
              onChange={(event) => setReferencia(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="tes-ajuste-notas">Justificación</FieldLabel>
            <Textarea
              id="tes-ajuste-notas"
              value={notas}
              onChange={(event) => setNotas(event.target.value)}
              placeholder="Detalle y respaldo de la corrección"
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            loading={ocupado}
            loadingText="Registrando…"
            disabled={invalido}
            onClick={() =>
              onGuardar({
                tipo,
                monto: Number(monto),
                fecha,
                concepto: concepto.trim(),
                idempotencyKey: crypto.randomUUID(),
                referencia: referencia.trim() || undefined,
                notas: notas.trim() || undefined,
              })
            }
          >
            Registrar ajuste
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ArqueoDialog({
  open,
  cuenta,
  ocupado,
  onOpenChange,
  onGuardar,
}: {
  open: boolean;
  cuenta: CuentaFondos;
  ocupado: boolean;
  onOpenChange: (open: boolean) => void;
  onGuardar: (contado: number, notas?: string) => void;
}) {
  const [contado, setContado] = React.useState("");
  const [notas, setNotas] = React.useState("");
  const diferencia = contado === "" ? null : Number(contado) - cuenta.saldo;
  const fmt = (valor: number) =>
    formatearMoneda(valor, monedaDe(cuenta.moneda), { decimales: 0 });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Arqueo de caja</DialogTitle>
          <DialogDescription>
            Compará lo contado físicamente con el saldo de {cuenta.nombre}.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="tes-arqueo-contado">
              Efectivo contado
            </FieldLabel>
            <Input
              id="tes-arqueo-contado"
              type="number"
              min={0}
              autoFocus
              value={contado}
              onChange={(event) => setContado(event.target.value)}
            />
          </Field>
          <Card size="sm">
            <CardContent className="grid gap-2">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Según sistema</span>
                <span className="font-medium">{fmt(cuenta.saldo)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Diferencia</span>
                <span className="font-medium">
                  {diferencia === null
                    ? "—"
                    : `${diferencia > 0 ? "+" : ""}${fmt(diferencia)}`}
                </span>
              </div>
            </CardContent>
          </Card>
          <Field>
            <FieldLabel htmlFor="tes-arqueo-notas">Observación</FieldLabel>
            <Textarea
              id="tes-arqueo-notas"
              value={notas}
              onChange={(event) => setNotas(event.target.value)}
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            loading={ocupado}
            loadingText="Cerrando…"
            disabled={contado === "" || Number(contado) < 0}
            onClick={() =>
              onGuardar(Number(contado), notas.trim() || undefined)
            }
          >
            <ClipboardCheckIcon data-icon="inline-start" />
            Cerrar arqueo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TesoreriaView({
  initialCuentas,
  initialKpis,
  monedaLocal,
}: {
  initialCuentas: CuentaFondos[];
  initialKpis: TesoreriaKpis;
  monedaLocal: string;
}) {
  const router = useRouter();
  const puedeGestionar = usePuede("administracion.gestionar");
  const { moneda, zonaHoraria } = useConfigRegional();
  const { fechaHora, fechaNumerica } = useFecha();
  const hoy = React.useMemo(() => hoyEnZona(zonaHoraria), [zonaHoraria]);
  const [seleccionId, setSeleccionId] = React.useState<string | null>(
    initialCuentas.find((cuenta) => cuenta.activo)?.id ??
      initialCuentas[0]?.id ??
      null,
  );
  const [movimientos, setMovimientos] = React.useState(PAGINA_VACIA);
  const [cargando, setCargando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pagina, setPagina] = React.useState(1);
  const [recarga, setRecarga] = React.useState(0);
  const [modal, setModal] = React.useState<Modal>(null);
  const [ocupado, setOcupado] = React.useState(false);
  const [filtros, setFiltros] = React.useState<Filtros>({
    q: "",
    origenTipo: "todos",
    estadoConciliacion: "todos",
    desde: "",
    hasta: "",
  });
  const busqueda = React.useDeferredValue(filtros.q);
  const seleccion =
    initialCuentas.find((cuenta) => cuenta.id === seleccionId) ?? null;
  const activas = initialCuentas.filter((cuenta) => cuenta.activo);
  const fmtLocal = (valor: number) =>
    formatearMoneda(valor, moneda, { decimales: 0 });
  const fmtCuenta = (valor: number, codigo: string) =>
    formatearMoneda(valor, monedaDe(codigo), { decimales: 0 });

  React.useEffect(() => {
    if (!seleccionId) {
      setMovimientos(PAGINA_VACIA);
      return;
    }
    let cancelado = false;
    setCargando(true);
    setError(null);
    void getMovimientosCuenta(seleccionId, {
      page: pagina,
      pageSize: 25,
      q: busqueda.trim() || undefined,
      origenTipo:
        filtros.origenTipo === "todos" ? undefined : filtros.origenTipo,
      estadoConciliacion:
        filtros.estadoConciliacion === "todos"
          ? undefined
          : filtros.estadoConciliacion,
      desde: filtros.desde || undefined,
      hasta: filtros.hasta || undefined,
    })
      .then((data) => {
        if (!cancelado) setMovimientos(data);
      })
      .catch((reason) => {
        if (!cancelado) {
          setError(
            reason instanceof Error
              ? reason.message
              : "No se pudieron cargar los movimientos.",
          );
        }
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [
    seleccionId,
    pagina,
    busqueda,
    filtros.origenTipo,
    filtros.estadoConciliacion,
    filtros.desde,
    filtros.hasta,
    recarga,
  ]);

  React.useEffect(
    () => setPagina(1),
    [
      busqueda,
      filtros.origenTipo,
      filtros.estadoConciliacion,
      filtros.desde,
      filtros.hasta,
    ],
  );

  const ejecutar = async (accion: () => Promise<unknown>, mensaje: string) => {
    setOcupado(true);
    try {
      await accion();
      toast.success(mensaje);
      setModal(null);
      setRecarga((actual) => actual + 1);
      router.refresh();
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "No se pudo completar.",
      );
    } finally {
      setOcupado(false);
    }
  };

  const exportar = async () => {
    if (!seleccion) return;
    try {
      const filas: MovimientoFondos[] = [];
      let paginaActual = 1;
      let totalPaginas = 1;
      do {
        const data = await getMovimientosCuenta(seleccion.id, {
          page: paginaActual,
          pageSize: 100,
          q: busqueda.trim() || undefined,
          origenTipo:
            filtros.origenTipo === "todos" ? undefined : filtros.origenTipo,
          estadoConciliacion:
            filtros.estadoConciliacion === "todos"
              ? undefined
              : filtros.estadoConciliacion,
          desde: filtros.desde || undefined,
          hasta: filtros.hasta || undefined,
        });
        filas.push(...data.items);
        totalPaginas = data.pages;
        paginaActual += 1;
      } while (paginaActual <= totalPaginas);
      const escapar = (valor: unknown) =>
        `"${String(valor ?? "").replaceAll('"', '""')}"`;
      const csv = [
        [
          "Fecha",
          "Concepto",
          "Origen",
          "Entrada",
          "Salida",
          "Saldo",
          "Conciliación",
          "Referencia",
          "Responsable",
        ],
        ...filas.map((fila) => [
          fechaHora(fila.createdAt),
          fila.concepto,
          ORIGENES[fila.origenTipo] ?? fila.origenTipo,
          fila.tipo === "entrada" ? fila.monto : "",
          fila.tipo === "salida" ? fila.monto : "",
          fila.saldoPosterior,
          ESTADOS_CONCILIACION[fila.estadoConciliacion] ??
            fila.estadoConciliacion,
          fila.referencia ?? "",
          fila.actorNombre ?? "",
        ]),
      ]
        .map((fila) => fila.map(escapar).join(","))
        .join("\n");
      const url = URL.createObjectURL(
        new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
      );
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `movimientos-${seleccion.nombre.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}.csv`;
      enlace.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "No se pudo exportar.",
      );
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 self-start flex-col gap-6 p-4 pb-20 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tesorería</h1>
          <p className="text-muted-foreground">
            Posición real, cuentas, valores y conciliación de fondos.
          </p>
        </div>
        {puedeGestionar ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={activas.length < 2}
              onClick={() =>
                setModal({
                  tipo: "transferir",
                  desde: seleccion?.activo ? seleccion.id : undefined,
                })
              }
            >
              <ArrowLeftRightIcon data-icon="inline-start" />
              Transferir
            </Button>
            <Button onClick={() => setModal({ tipo: "cuenta" })}>
              <PlusIcon data-icon="inline-start" />
              Nueva cuenta
            </Button>
          </div>
        ) : null}
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Posición total · {monedaLocal}</CardDescription>
            <CardTitle className="text-2xl">
              {fmtLocal(initialKpis.posicionLocal)}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {Object.entries(initialKpis.posiciones)
              .filter(([codigo]) => codigo !== monedaLocal)
              .map(([codigo, valor]) => (
                <Badge key={codigo} variant="outline">
                  {codigo} {fmtCuenta(valor, codigo)}
                </Badge>
              ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Efectivo en cajas</CardDescription>
            <CardTitle className="text-2xl">
              {fmtLocal(initialKpis.efectivo)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {initialKpis.cajasActivas} cajas activas
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Bancos y billeteras</CardDescription>
            <CardTitle className="text-2xl">
              {fmtLocal(initialKpis.bancos)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {initialKpis.cuentasLocales} cuentas en {monedaLocal}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>A acreditar / en cartera</CardDescription>
            <CardTitle className="text-2xl">
              {fmtLocal(initialKpis.aAcreditar)}
            </CardTitle>
            <CardAction>
              <Link
                href="/administracion/tesoreria/acreditaciones"
                className={buttonVariants({
                  variant: "ghost",
                  size: "icon-sm",
                })}
              >
                <ArrowLeftRightIcon />
                <span className="sr-only">Abrir acreditaciones y valores</span>
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
            <span>Valores: {fmtLocal(initialKpis.valoresEnCartera)}</span>
            <div className="flex flex-wrap gap-1">
              {[
                ...new Set([
                  ...Object.keys(initialKpis.aAcreditarPorMoneda),
                  ...Object.keys(initialKpis.valoresPorMoneda),
                ]),
              ]
                .filter((codigo) => codigo !== monedaLocal)
                .map((codigo) => (
                  <Badge key={codigo} variant="outline">
                    {codigo}: a acreditar{" "}
                    {fmtCuenta(
                      initialKpis.aAcreditarPorMoneda[codigo] ?? 0,
                      codigo,
                    )}{" "}
                    · valores{" "}
                    {fmtCuenta(
                      initialKpis.valoresPorMoneda[codigo] ?? 0,
                      codigo,
                    )}
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Cuentas</CardTitle>
            <CardDescription>Activas e históricas</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {initialCuentas.map((cuenta) => {
              const Icono = iconoCuenta(cuenta.tipo);
              return (
                <button
                  key={cuenta.id}
                  type="button"
                  className={cn(
                    "flex min-w-0 items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/60",
                    seleccionId === cuenta.id &&
                      "border-foreground/30 bg-muted",
                    !cuenta.activo && "opacity-60",
                  )}
                  onClick={() => {
                    setSeleccionId(cuenta.id);
                    setPagina(1);
                  }}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Icono />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {cuenta.nombre}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {TIPOS_CUENTA[cuenta.tipo] ?? "Otra cuenta"} ·{" "}
                      {cuenta.moneda}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-medium">
                    {fmtCuenta(cuenta.saldo, cuenta.moneda)}
                  </span>
                </button>
              );
            })}
            {initialCuentas.length === 0 ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <LandmarkIcon />
                  </EmptyMedia>
                  <EmptyTitle>No hay cuentas</EmptyTitle>
                  <EmptyDescription>
                    Creá la primera cuenta con su saldo inicial.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : null}
          </CardContent>
        </Card>

        {seleccion ? (
          <Card className="min-w-0">
            <CardHeader className="border-b">
              <CardTitle>{seleccion.nombre}</CardTitle>
              <CardDescription>
                {seleccion.banco ||
                  TIPOS_CUENTA[seleccion.tipo] ||
                  "Otra cuenta"}{" "}
                · {seleccion.moneda}
                {!seleccion.activo ? " · Inactiva" : ""}
              </CardDescription>
              <CardAction className="flex flex-wrap justify-end gap-1">
                {puedeGestionar ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setModal({ tipo: "cuenta", cuenta: seleccion })
                      }
                    >
                      <PencilIcon data-icon="inline-start" />
                      Editar
                    </Button>
                    {seleccion.activo ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setModal({ tipo: "ajuste", cuenta: seleccion })
                        }
                      >
                        <SlidersHorizontalIcon data-icon="inline-start" />
                        Ajuste
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        void ejecutar(
                          () =>
                            editarCuentaFondos(seleccion.id, {
                              activo: !seleccion.activo,
                            }),
                          seleccion.activo
                            ? "Cuenta desactivada."
                            : "Cuenta activada.",
                        )
                      }
                    >
                      <Settings2Icon data-icon="inline-start" />
                      {seleccion.activo ? "Desactivar" : "Activar"}
                    </Button>
                    {seleccion.tipo === "caja" && seleccion.activo ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setModal({ tipo: "arqueo", cuenta: seleccion })
                        }
                      >
                        <ClipboardCheckIcon data-icon="inline-start" />
                        Arqueo
                      </Button>
                    ) : null}
                  </>
                ) : null}
              </CardAction>
            </CardHeader>

            <CardContent className="flex min-w-0 flex-col gap-4">
              <div className="flex flex-wrap items-end gap-3 rounded-lg bg-muted/40 p-3">
                <Field className="min-w-56 flex-[1_1_20rem]">
                  <FieldLabel htmlFor="tes-buscar">Buscar</FieldLabel>
                  <div className="relative">
                    <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="tes-buscar"
                      className="pl-8"
                      value={filtros.q}
                      onChange={(event) =>
                        setFiltros((actual) => ({
                          ...actual,
                          q: event.target.value,
                        }))
                      }
                      placeholder="Concepto, referencia o responsable"
                    />
                  </div>
                </Field>
                <Field className="w-full sm:w-44">
                  <FieldLabel>Origen</FieldLabel>
                  {selector(
                    filtros.origenTipo,
                    (value) =>
                      setFiltros((actual) => ({
                        ...actual,
                        origenTipo: value,
                      })),
                    [
                      { value: "todos", label: "Todos" },
                      ...Object.entries(ORIGENES).map(([value, label]) => ({
                        value,
                        label,
                      })),
                    ],
                    "Filtrar por origen",
                  )}
                </Field>
                <Field className="w-full sm:w-44">
                  <FieldLabel>Conciliación</FieldLabel>
                  {selector(
                    filtros.estadoConciliacion,
                    (value) =>
                      setFiltros((actual) => ({
                        ...actual,
                        estadoConciliacion: value,
                      })),
                    [
                      { value: "todos", label: "Todos" },
                      { value: "pendiente", label: "Pendiente" },
                      { value: "conciliado", label: "Conciliado" },
                      { value: "diferencia", label: "Diferencia" },
                    ],
                    "Filtrar por conciliación",
                  )}
                </Field>
                <Field className="w-full sm:w-40">
                  <FieldLabel htmlFor="tes-desde">Desde</FieldLabel>
                  <Input
                    id="tes-desde"
                    type="date"
                    value={filtros.desde}
                    onChange={(event) =>
                      setFiltros((actual) => ({
                        ...actual,
                        desde: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field className="w-full sm:w-40">
                  <FieldLabel htmlFor="tes-hasta">Hasta</FieldLabel>
                  <Input
                    id="tes-hasta"
                    type="date"
                    value={filtros.hasta}
                    onChange={(event) =>
                      setFiltros((actual) => ({
                        ...actual,
                        hasta: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => void exportar()}
                >
                  <DownloadIcon data-icon="inline-start" />
                  CSV
                </Button>
              </div>

              {error ? (
                <Alert variant="destructive">
                  <RefreshCwIcon />
                  <AlertTitle>No pudimos cargar el extracto</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              {cargando ? (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-12 w-full" />
                  ))}
                </div>
              ) : movimientos.items.length > 0 ? (
                <>
                  <div className="hidden lg:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Movimiento</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="text-right">Importe</TableHead>
                          <TableHead className="text-right">Saldo</TableHead>
                          {puedeGestionar ? <TableHead /> : null}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movimientos.items.map((movimiento) => (
                          <TableRow key={movimiento.id}>
                            <TableCell>
                              <div>{fechaNumerica(movimiento.fecha)}</div>
                              <div className="text-xs text-muted-foreground">
                                {fechaHora(movimiento.createdAt).split(", ")[1]}
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[360px] whitespace-normal">
                              <div className="font-medium">
                                {movimiento.concepto}
                              </div>
                              <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                                <span>{ORIGENES[movimiento.origenTipo]}</span>
                                {movimiento.referencia ? (
                                  <span>· {movimiento.referencia}</span>
                                ) : null}
                                {movimiento.actorNombre ? (
                                  <span>· {movimiento.actorNombre}</span>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  movimiento.estadoConciliacion === "conciliado"
                                    ? "secondary"
                                    : movimiento.estadoConciliacion ===
                                        "diferencia"
                                      ? "destructive"
                                      : "outline"
                                }
                              >
                                {ESTADOS_CONCILIACION[
                                  movimiento.estadoConciliacion
                                ] ?? movimiento.estadoConciliacion}
                              </Badge>
                            </TableCell>
                            <TableCell
                              className={cn(
                                "text-right font-medium",
                                movimiento.tipo === "salida" &&
                                  "text-destructive",
                              )}
                            >
                              {movimiento.tipo === "entrada" ? "+" : "−"}
                              {fmtCuenta(movimiento.monto, seleccion.moneda)}
                            </TableCell>
                            <TableCell className="text-right">
                              {fmtCuenta(
                                movimiento.saldoPosterior,
                                seleccion.moneda,
                              )}
                            </TableCell>
                            {puedeGestionar ? (
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className={cn(
                                    movimiento.estadoConciliacion ===
                                      "conciliado" &&
                                      "text-[var(--ok)] disabled:opacity-100",
                                  )}
                                  disabled={
                                    movimiento.estadoConciliacion ===
                                    "conciliado"
                                  }
                                  onClick={() =>
                                    void ejecutar(
                                      () =>
                                        conciliarMovimientoFondos(
                                          seleccion.id,
                                          movimiento.id,
                                          { estado: "conciliado" },
                                        ),
                                      "Movimiento conciliado.",
                                    )
                                  }
                                >
                                  <CheckCircle2Icon />
                                  <span className="sr-only">
                                    {movimiento.estadoConciliacion ===
                                    "conciliado"
                                      ? "Movimiento conciliado"
                                      : "Marcar conciliado"}
                                  </span>
                                </Button>
                              </TableCell>
                            ) : null}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex flex-col gap-2 lg:hidden">
                    {movimientos.items.map((movimiento) => (
                      <Card key={movimiento.id} size="sm">
                        <CardHeader>
                          <CardTitle>{movimiento.concepto}</CardTitle>
                          <CardDescription>
                            {fechaHora(movimiento.createdAt)}
                          </CardDescription>
                          <CardAction>
                            <span className="font-medium">
                              {movimiento.tipo === "entrada" ? "+" : "−"}
                              {fmtCuenta(movimiento.monto, seleccion.moneda)}
                            </span>
                          </CardAction>
                        </CardHeader>
                        <CardContent className="flex items-center justify-between gap-2">
                          <Badge variant="outline">
                            {ESTADOS_CONCILIACION[
                              movimiento.estadoConciliacion
                            ] ?? movimiento.estadoConciliacion}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Saldo{" "}
                            {fmtCuenta(
                              movimiento.saldoPosterior,
                              seleccion.moneda,
                            )}
                          </span>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      {movimientos.total} movimientos · página{" "}
                      {movimientos.page} de {movimientos.pages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pagina <= 1}
                        onClick={() =>
                          setPagina((actual) => Math.max(1, actual - 1))
                        }
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pagina >= movimientos.pages}
                        onClick={() => setPagina((actual) => actual + 1)}
                      >
                        Siguiente
                      </Button>
                    </div>
                  </div>
                </>
              ) : !error ? (
                <Empty className="border">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <FileTextIcon />
                    </EmptyMedia>
                    <EmptyTitle>Sin movimientos para mostrar</EmptyTitle>
                    <EmptyDescription>
                      Cambiá los filtros o registrá el primer movimiento de la
                      cuenta.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    {puedeGestionar && seleccion.activo ? (
                      <Button
                        variant="outline"
                        onClick={() =>
                          setModal({ tipo: "ajuste", cuenta: seleccion })
                        }
                      >
                        <PlusIcon data-icon="inline-start" />
                        Registrar ajuste
                      </Button>
                    ) : null}
                  </EmptyContent>
                </Empty>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </section>

      {modal?.tipo === "cuenta" ? (
        <CuentaDialog
          key={modal.cuenta?.id ?? "nueva"}
          open
          cuenta={modal.cuenta}
          monedaLocal={monedaLocal}
          ocupado={ocupado}
          onOpenChange={(open) => !open && setModal(null)}
          onGuardar={(payload) =>
            void ejecutar(
              () =>
                modal.cuenta
                  ? editarCuentaFondos(modal.cuenta.id, payload)
                  : crearCuentaFondos(payload),
              modal.cuenta ? "Cuenta actualizada." : "Cuenta creada.",
            )
          }
        />
      ) : null}
      {modal?.tipo === "transferir" ? (
        <TransferenciaDialog
          key={modal.desde ?? "transferir"}
          open
          cuentas={activas}
          desdeInicial={modal.desde}
          ocupado={ocupado}
          onOpenChange={(open) => !open && setModal(null)}
          onGuardar={(payload) =>
            void ejecutar(
              () => transferirEntreCuentas(payload),
              "Transferencia registrada.",
            )
          }
        />
      ) : null}
      {modal?.tipo === "ajuste" ? (
        <AjusteDialog
          key={modal.cuenta.id}
          open
          cuenta={modal.cuenta}
          ocupado={ocupado}
          hoy={hoy}
          onOpenChange={(open) => !open && setModal(null)}
          onGuardar={(payload) =>
            void ejecutar(
              () => ajustarCuentaFondos(modal.cuenta.id, payload),
              "Ajuste registrado.",
            )
          }
        />
      ) : null}
      {modal?.tipo === "arqueo" ? (
        <ArqueoDialog
          key={modal.cuenta.id}
          open
          cuenta={modal.cuenta}
          ocupado={ocupado}
          onOpenChange={(open) => !open && setModal(null)}
          onGuardar={(contado, notas) =>
            void ejecutar(
              () =>
                cerrarArqueo(modal.cuenta.id, contado, {
                  idempotencyKey: crypto.randomUUID(),
                  notas,
                }),
              "Arqueo registrado.",
            )
          }
        />
      ) : null}
    </main>
  );
}
