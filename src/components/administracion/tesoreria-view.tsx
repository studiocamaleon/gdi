"use client";
import { CuentaDialog } from "./cuenta-fondos-dialog";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownIcon,
  ArrowUpRightIcon,
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
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TesoreriaDialog } from "./tesoreria-dialog";
import {
  useDesignScope,
  useLegacyDesignScope,
} from "@/components/design-system/appearance";
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
import { SelectField } from "@/components/design-system/select-field";
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
import { cn } from "@/lib/utils";

import styles from "./tesoreria-view.module.css";

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

function IconoCuenta({ tipo }: { tipo: string }) {
  if (tipo === "caja") return <BanknoteIcon />;
  if (tipo === "billetera") return <WalletIcon />;
  return <LandmarkIcon />;
}

function selector(
  value: string,
  onValueChange: (value: string) => void,
  opciones: Array<{ value: string; label: string }>,
  ariaLabel: string,
) {
  return (
    <SelectField
      value={value}
      onChange={onValueChange}
      options={opciones}
      aria-label={ariaLabel}
    />
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
    <TesoreriaDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Transferencia entre cuentas"
      description={
        <>Genera dos movimientos espejo y no afecta el resultado del negocio.</>
      }
    >
      <FieldGroup className={styles.formBody}>
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
        <div className={styles.transferDirection}>
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
        <div className={styles.formGrid}>
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
            {origen && !origen.permiteSaldoNegativo && valor > origen.saldo ? (
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
      <footer className={styles.formFooter}>
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
      </footer>
    </TesoreriaDialog>
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
    <TesoreriaDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Ajuste de fondos"
      description={
        <>
          {cuenta.nombre}. Usalo para comisiones bancarias, intereses o
          correcciones respaldadas; el movimiento queda marcado para conciliar.
        </>
      }
    >
      <FieldGroup className={styles.formBody}>
        <div className={styles.formGrid}>
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
        <Field data-invalid={concepto.length > 0 && concepto.trim().length < 3}>
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
      <footer className={styles.formFooter}>
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
      </footer>
    </TesoreriaDialog>
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
    formatearMoneda(valor, monedaDe(cuenta.moneda));
  return (
    <TesoreriaDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Arqueo de caja"
      description={
        <>Compará lo contado físicamente con el saldo de {cuenta.nombre}.</>
      }
    >
      <FieldGroup className={styles.formBody}>
        <Field>
          <FieldLabel htmlFor="tes-arqueo-contado">Efectivo contado</FieldLabel>
          <Input
            id="tes-arqueo-contado"
            type="number"
            min={0}
            autoFocus
            value={contado}
            onChange={(event) => setContado(event.target.value)}
          />
        </Field>
        <Card size="sm" className={styles.balancePreview}>
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
      <footer className={styles.formFooter}>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button
          loading={ocupado}
          loadingText="Cerrando…"
          disabled={contado === "" || Number(contado) < 0}
          onClick={() => onGuardar(Number(contado), notas.trim() || undefined)}
        >
          <ClipboardCheckIcon data-icon="inline-start" />
          Cerrar arqueo
        </Button>
      </footer>
    </TesoreriaDialog>
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
  const scope = useLegacyDesignScope();
  const designScope = useDesignScope();
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
  const [cuentaMovimientosId, setCuentaMovimientosId] = React.useState<
    string | null
  >(seleccionId);
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
  const cuentaMovimientos =
    initialCuentas.find((cuenta) => cuenta.id === cuentaMovimientosId) ??
    seleccion;
  const monedaMovimientos = cuentaMovimientos?.moneda ?? monedaLocal;
  const activas = initialCuentas.filter((cuenta) => cuenta.activo);
  const fmtLocal = (valor: number) => formatearMoneda(valor, moneda);
  const fmtCuenta = (valor: number, codigo: string) =>
    formatearMoneda(valor, monedaDe(codigo));

  React.useEffect(() => {
    if (!seleccionId) {
      setMovimientos(PAGINA_VACIA);
      setCuentaMovimientosId(null);
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
        if (!cancelado) {
          setMovimientos(data);
          setCuentaMovimientosId(seleccionId);
        }
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
    <main
      {...designScope}
      {...scope}
      className={[scope.className, styles.pagina].filter(Boolean).join(" ")}
    >
      <header className={styles.encabezado}>
        <div>
          <span className={styles.eyebrow}>Administración · Fondos</span>
          <h1>
            Tesorería<span aria-hidden="true">.</span>
          </h1>
          <p>Posición real, cuentas, valores y conciliación de fondos.</p>
        </div>
        {puedeGestionar ? (
          <div className={styles.acciones}>
            <Button
              variant="outline"
              className={styles.accionSecundaria}
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
            <Button
              className={styles.accionPrincipal}
              onClick={() => setModal({ tipo: "cuenta" })}
            >
              <PlusIcon data-icon="inline-start" />
              Nueva cuenta
            </Button>
          </div>
        ) : null}
      </header>

      <section className={styles.kpis} aria-label="Posición financiera">
        <article className={`${styles.kpi} ${styles.kpiPrincipal}`}>
          <span className={styles.kpiIcono} aria-hidden="true">
            <WalletIcon />
          </span>
          <div className={styles.kpiTexto}>
            <span>Posición total · {monedaLocal}</span>
            <strong>{fmtLocal(initialKpis.posicionLocal)}</strong>
          </div>
          <div className={styles.monedasAlternativas}>
            {Object.entries(initialKpis.posiciones)
              .filter(([codigo]) => codigo !== monedaLocal)
              .map(([codigo, valor]) => (
                <span key={codigo}>
                  {codigo} {fmtCuenta(valor, codigo)}
                </span>
              ))}
          </div>
        </article>

        <article className={styles.kpi}>
          <span className={styles.kpiIcono} aria-hidden="true">
            <BanknoteIcon />
          </span>
          <div className={styles.kpiTexto}>
            <span>Efectivo en cajas</span>
            <strong>{fmtLocal(initialKpis.efectivo)}</strong>
            <small>
              {initialKpis.cajasActivas}{" "}
              {initialKpis.cajasActivas === 1 ? "caja activa" : "cajas activas"}
            </small>
          </div>
        </article>

        <article className={styles.kpi}>
          <span className={styles.kpiIcono} aria-hidden="true">
            <LandmarkIcon />
          </span>
          <div className={styles.kpiTexto}>
            <span>Bancos y billeteras</span>
            <strong>{fmtLocal(initialKpis.bancos)}</strong>
            <small>
              {initialKpis.cuentasLocales}{" "}
              {initialKpis.cuentasLocales === 1 ? "cuenta" : "cuentas"} en{" "}
              {monedaLocal}
            </small>
          </div>
        </article>

        <article className={`${styles.kpi} ${styles.kpiAcreditar}`}>
          <span className={styles.kpiIcono} aria-hidden="true">
            <ArrowDownIcon />
          </span>
          <Link
            href="/administracion/tesoreria/acreditaciones"
            className={styles.accesoAcreditaciones}
          >
            <ArrowUpRightIcon />
            <span className="sr-only">Abrir acreditaciones y valores</span>
          </Link>
          <div className={styles.kpiTexto}>
            <span>A acreditar / en cartera</span>
            <strong>{fmtLocal(initialKpis.aAcreditar)}</strong>
            <small>Valores: {fmtLocal(initialKpis.valoresEnCartera)}</small>
            <div className={styles.detalleMonedas}>
              {[
                ...new Set([
                  ...Object.keys(initialKpis.aAcreditarPorMoneda),
                  ...Object.keys(initialKpis.valoresPorMoneda),
                ]),
              ]
                .filter((codigo) => codigo !== monedaLocal)
                .map((codigo) => (
                  <span key={codigo}>
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
                  </span>
                ))}
            </div>
          </div>
        </article>
      </section>

      <section className={styles.contenidoPrincipal}>
        <Card className={styles.panelCuentas}>
          <CardHeader className={styles.panelHeader}>
            <CardTitle>Cuentas</CardTitle>
            <CardDescription>Activas e históricas</CardDescription>
          </CardHeader>
          <CardContent className={styles.listaCuentas}>
            {initialCuentas.map((cuenta) => {
              return (
                <button
                  key={cuenta.id}
                  type="button"
                  aria-pressed={seleccionId === cuenta.id}
                  className={cn(
                    styles.cuenta,
                    seleccionId === cuenta.id && styles.cuentaSeleccionada,
                    !cuenta.activo && styles.cuentaInactiva,
                  )}
                  onClick={() => {
                    setSeleccionId(cuenta.id);
                    setPagina(1);
                  }}
                >
                  <span className={styles.cuentaIcono}>
                    <IconoCuenta tipo={cuenta.tipo} />
                  </span>
                  <span className={styles.cuentaNombre}>
                    <span>{cuenta.nombre}</span>
                    <small>
                      {TIPOS_CUENTA[cuenta.tipo] ?? "Otra cuenta"} ·{" "}
                      {cuenta.moneda}
                      {!cuenta.activo ? " · Inactiva" : ""}
                    </small>
                  </span>
                  <strong className={styles.cuentaSaldo}>
                    {fmtCuenta(cuenta.saldo, cuenta.moneda)}
                  </strong>
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
          <Card className={styles.panelDetalle}>
            <header className={styles.detalleHeader}>
              <div className={styles.detalleIdentidad}>
                <span className={styles.detalleIcono} aria-hidden="true">
                  <IconoCuenta tipo={seleccion.tipo} />
                </span>
                <div>
                  <span className={styles.detalleKicker}>
                    Cuenta seleccionada
                  </span>
                  <h2>{seleccion.nombre}</h2>
                  <p>
                    {seleccion.banco ||
                      TIPOS_CUENTA[seleccion.tipo] ||
                      "Otra cuenta"}{" "}
                    · {seleccion.moneda}
                    {!seleccion.activo ? " · Inactiva" : ""}
                  </p>
                </div>
              </div>
              <div className={styles.saldoActual}>
                <span>Saldo actual</span>
                <strong>{fmtCuenta(seleccion.saldo, seleccion.moneda)}</strong>
              </div>
              <div className={styles.detalleAcciones}>
                {puedeGestionar ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={styles.detalleAccion}
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
                        className={styles.detalleAccion}
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
                      className={styles.detalleAccion}
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
                        className={styles.detalleAccion}
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
              </div>
            </header>

            <CardContent className={styles.detalleContenido}>
              <div className={styles.filtros}>
                <div className={styles.filtrosHeader}>
                  <div>
                    <SearchIcon aria-hidden="true" />
                    <span>Explorar movimientos</span>
                  </div>
                  <small>
                    {movimientos.total}{" "}
                    {movimientos.total === 1 ? "registro" : "registros"}
                  </small>
                </div>
                <Field className={styles.searchField}>
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
                <Field>
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
                <Field>
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
                <Field>
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
                <Field>
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
                  className={styles.exportar}
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

              <div
                className={styles.extractoArea}
                data-cargando={cargando}
                aria-busy={cargando}
              >
                {cargando && movimientos.items.length === 0 ? (
                  <div className="flex flex-col gap-2">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Skeleton key={index} className="h-12 w-full" />
                    ))}
                  </div>
                ) : movimientos.items.length > 0 ? (
                  <>
                    <div className={`${styles.tablaMarco} hidden lg:block`}>
                      <Table
                        className={styles.tabla}
                        aria-label="Movimientos de la cuenta"
                      >
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Movimiento</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">
                              Importe
                            </TableHead>
                            <TableHead className="text-right">Saldo</TableHead>
                            {puedeGestionar ? <TableHead /> : null}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {movimientos.items.map((movimiento) => (
                            <TableRow key={movimiento.id}>
                              <TableCell className={styles.fechaMovimiento}>
                                <div>{fechaNumerica(movimiento.fecha)}</div>
                                <small>
                                  {
                                    fechaHora(movimiento.createdAt).split(
                                      ", ",
                                    )[1]
                                  }
                                </small>
                              </TableCell>
                              <TableCell className={styles.conceptoMovimiento}>
                                <div>{movimiento.concepto}</div>
                                <small>
                                  <span>{ORIGENES[movimiento.origenTipo]}</span>
                                  {movimiento.referencia ? (
                                    <span>· {movimiento.referencia}</span>
                                  ) : null}
                                  {movimiento.actorNombre ? (
                                    <span>· {movimiento.actorNombre}</span>
                                  ) : null}
                                </small>
                              </TableCell>
                              <TableCell>
                                <span
                                  className={styles.estadoMovimiento}
                                  data-estado={movimiento.estadoConciliacion}
                                >
                                  {ESTADOS_CONCILIACION[
                                    movimiento.estadoConciliacion
                                  ] ?? movimiento.estadoConciliacion}
                                </span>
                              </TableCell>
                              <TableCell
                                className={cn(
                                  styles.importeMovimiento,
                                  movimiento.tipo === "salida" &&
                                    styles.importeSalida,
                                )}
                              >
                                {movimiento.tipo === "entrada" ? "+" : "−"}
                                {fmtCuenta(movimiento.monto, monedaMovimientos)}
                              </TableCell>
                              <TableCell className={styles.saldoMovimiento}>
                                {fmtCuenta(
                                  movimiento.saldoPosterior,
                                  monedaMovimientos,
                                )}
                              </TableCell>
                              {puedeGestionar ? (
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className={cn(
                                      styles.conciliar,
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
                    <div
                      className={`${styles.movimientosMobileLista} flex flex-col gap-2 lg:hidden`}
                    >
                      {movimientos.items.map((movimiento) => (
                        <Card
                          key={movimiento.id}
                          size="sm"
                          className={styles.movimientoMobile}
                        >
                          <CardHeader>
                            <CardTitle>{movimiento.concepto}</CardTitle>
                            <CardDescription>
                              {fechaHora(movimiento.createdAt)}
                            </CardDescription>
                            <CardAction>
                              <span className="font-medium">
                                {movimiento.tipo === "entrada" ? "+" : "−"}
                                {fmtCuenta(movimiento.monto, monedaMovimientos)}
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
                                monedaMovimientos,
                              )}
                            </span>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    <div className={styles.paginacion}>
                      <p className="text-sm text-muted-foreground">
                        {movimientos.total} movimientos · página{" "}
                        {movimientos.page} de {movimientos.pages}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={cargando || pagina <= 1}
                          onClick={() =>
                            setPagina((actual) => Math.max(1, actual - 1))
                          }
                        >
                          Anterior
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={cargando || pagina >= movimientos.pages}
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
              </div>
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
