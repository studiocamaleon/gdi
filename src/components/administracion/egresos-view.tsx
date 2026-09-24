"use client";
import { useCapacidad } from "@/components/navigation/capacidades-provider";

/**
 * Egresos y Cuentas por pagar.
 *
 * Dos vistas del MISMO registro, no dos módulos:
 *   · "Por pagar" — el filtro de lo que vence y todavía se debe, ordenado por
 *     fecha. Es la primera pregunta del lunes a la mañana.
 *   · "Todos" — el historial completo, para consultar y analizar.
 *
 * El alta colapsa el egreso y su pago en un solo gesto: el switch "Ya está
 * pagado" viene ENCENDIDO, porque el 80% de los egresos de una imprenta son de
 * contado (la nafta, la limpieza, el flete) y hacer dos pantallas para eso
 * sería burocracia.
 *
 * Ver docs/egresos-y-cuentas-por-pagar-diseno.md
 */

import { RegistroEgresosWorkspace } from "./registro-egresos-workspace";
import { useAnalisisEgresos } from "./use-analisis-egresos";
import { CuentasPagarWorkspace } from "./cuentas-pagar-workspace";
import { EgresosArea, EgresosBrand, useEgresosBrand, EgresoDialog, EgresoButton, EgresoSelect as SelectBuscable, EgresoConfirmacionSalida as ConfirmacionSalida } from "./egreso-dialog";
import { useDesignScope, useDesignTheme } from "@/components/design-system/appearance";
import listPage from "@/components/design-system/list-page.module.css";
import pagarStyles from "./cuentas-pagar.module.css";
import * as React from "react";
import Link from "next/link";
import {
  FileIcon,
  UploadCloudIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { usePuede } from "@/components/navigation/permisos-provider";
import { ArchivoUploader } from "@/components/archivos/archivo-uploader";
import { formatBytes, validarArchivo } from "@/lib/archivos";
import { subirArchivo } from "@/lib/archivos-api";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MoneyInput } from "@/components/ui/money-input";
import {
  type OpcionSelect,
} from "@/components/ui/select-buscable";
import { formatearMoneda, numeroMoneda, parsearMonto } from "@/lib/moneda";
import { fechaConDia } from "@/lib/fecha";
import {
  NATURALEZAS_EGRESO,
  NATURALEZA_LABELS,
  TIPO_COMPROBANTE_LABELS,
  TIPOS_COMPROBANTE_COMPRA,
  FRECUENCIA_LABELS,
  FRECUENCIAS_RECURRENTE,
  REGIMEN_RETENCION_LABELS,
  REGIMENES_RETENCION,
  ALICUOTAS_IVA,
  LARGO_NUMERO_COMPROBANTE,
  LARGO_PUNTO_VENTA,
  completarCeros,
  discriminaIva,
  ivaDeNeto,
  type CategoriaEgreso,
  type Egreso,
  type ResumenEgresos,
  type GastoRecurrente,
  type SaldoProveedor,
} from "@/lib/egresos";
import {
  anularEgreso,
  anularPagoEgreso,
  crearEgreso,
  editarEgreso,
  getEgresos,
  getPagosDeEgreso,
  getResumenEgresos,
  getSaldosProveedores,
  getValoresEnCartera,
  editarRecurrente,
  registrarPagoEgresos,
  type CrearEgresoBody,
  type ValorEnCartera,
} from "@/lib/egresos-api";
import type { CuentaFondosResumen, MetodoPago } from "@/lib/administracion";
import type { ProveedorOpcion } from "@/lib/proveedores";
import type { PagoDeEgreso } from "@/lib/egresos";
import type { Archivo } from "@/lib/archivos";
import { listarArchivos } from "@/lib/archivos-api";
import type { GastoFijo } from "@/lib/gastos-fijos-api";

type Tab = "por-pagar" | "todos" | "proveedores" | "analisis";

/**
 * Las dos caras del módulo, que son dos preguntas distintas:
 *
 *   · `cuentas-por-pagar` — ¿a quién le debo y cuándo? Sólo lo que tiene
 *     vencimiento y sigue impago, por factura y por proveedor. Es el espejo
 *     exacto de Cuentas por cobrar.
 *   · `egresos` — ¿qué registré y cómo se clasifica? Historial de egresos
 *     y análisis por competencia, tanto pagados como pendientes.
 *
 * Un gasto de contado no es una cuenta por pagar —nunca fue deuda ni un
 * segundo— y por eso no aparece del lado izquierdo. Es el mismo registro
 * mirado con dos filtros, no dos módulos.
 */
export type ModoEgresos = "cuentas-por-pagar" | "egresos";

export const TABS_POR_MODO: Record<ModoEgresos, Tab[]> = {
  "cuentas-por-pagar": ["por-pagar", "proveedores"],
  egresos: ["todos", "analisis"],
};

/** Hoy en ISO local, para comparar vencimientos sin arrastrar zona horaria. */
function hoyIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * MoneyInput trabaja con TEXTO (para no pelear con el cursor mientras se
 * tipea) y acá el formulario razona en números. Este adaptador guarda el texto
 * que el usuario ve y avisa el número al padre.
 */
function CampoMonto({
  valor,
  onCambio,
  ariaLabel,
}: {
  valor: number;
  onCambio: (n: number) => void;
  ariaLabel: string;
}) {
  const { moneda } = useConfigRegional();
  const [texto, setTexto] = React.useState(valor ? String(valor) : "");

  /*
    El texto es del campo (hay que poder tipear "1.2" sin que se reformatee en
    cada tecla), pero si el valor cambia DESDE AFUERA —el IVA que sale de la
    alícuota— hay que mostrarlo. Se distingue uno del otro comparando: mientras
    se tipea, `valor` ya es lo que dice el texto y esto no hace nada.
  */
  React.useEffect(() => {
    if ((parsearMonto(texto, moneda) ?? 0) === valor) return;
    setTexto(valor ? numeroMoneda(valor, moneda) : "");
    // `texto` a propósito fuera: mirarlo re-dispararía en cada tecla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor, moneda]);

  return (
    <MoneyInput
      inputClassName="h-auto"
      value={texto}
      onValueChange={(t, n) => {
        setTexto(t);
        onCambio(n ?? 0);
      }}
      moneda={moneda}
      ariaLabel={ariaLabel}
    />
  );
}

/**
 * Las categorías listas para el selector: agrupadas por naturaleza y en el
 * orden en que la naturaleza importa (primero lo que es costo de producción,
 * al final lo que ni siquiera incide en el resultado).
 *
 * El agrupado no es decoración: "Combustible" y "Retiro de socios" se cargan
 * en el mismo campo pero significan cosas opuestas en el balance, y el título
 * del grupo es lo único que se lo dice a quien carga.
 */
export function opcionesDeCategorias(
  categorias: CategoriaEgreso[],
): OpcionSelect[] {
  const activas = categorias.filter((c) => c.activo);
  return NATURALEZAS_EGRESO.flatMap((naturaleza) =>
    activas
      .filter((c) => c.naturaleza === naturaleza)
      .map((c) => ({
        value: c.id,
        label: c.nombre,
        grupo: NATURALEZA_LABELS[naturaleza],
      })),
  );
}

/**
 * El comprobante que se elige ANTES de que el egreso exista.
 *
 * El uploader de la casa sube apenas soltás el archivo, y para eso necesita
 * un `entidadId` — que acá todavía no hay, porque el egreso se crea al
 * guardar. Así que esto sólo RETIENE los archivos y los sube después, con el
 * id recién creado. Es el precio de poder adjuntar la factura sin haber
 * guardado primero, que es como se carga en la realidad: tenés el papel en la
 * mano mientras tipeás.
 */
function ComprobantePendiente({
  archivos,
  onCambio,
}: {
  archivos: File[];
  onCambio: (f: File[]) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [dentro, setDentro] = React.useState(false);

  const agregar = (lista: FileList | null) => {
    if (!lista) return;
    const aceptados: File[] = [];
    for (const f of Array.from(lista)) {
      const error = validarArchivo(f);
      if (error) toast.error(`${f.name}: ${error}`);
      else aceptados.push(f);
    }
    if (aceptados.length) onCambio([...archivos, ...aceptados]);
  };

  return (
    <div className="egr-adj">
      <button
        type="button"
        className={`arch-drop${dentro ? " dentro" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDentro(true);
        }}
        onDragLeave={() => setDentro(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDentro(false);
          agregar(e.dataTransfer.files);
        }}
      >
        <UploadCloudIcon />
        <span className="arch-drop-txt">
          <span className="arch-drop-t">
            Arrastrá la factura o hacé click para elegirla
          </span>
          <span className="arch-drop-s">
            Se adjunta al egreso cuando lo registrás.
          </span>
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          agregar(e.target.files);
          // Para poder volver a elegir el MISMO archivo si lo sacaron.
          e.target.value = "";
        }}
      />

      {archivos.length > 0 ? (
        <div className="egr-adj-lista">
          {archivos.map((f, i) => (
            <div className="egr-adj-fila" key={`${f.name}-${i}`}>
              <FileIcon size={14} />
              <span className="egr-adj-nom">{f.name}</span>
              <span className="egr-adj-peso">{formatBytes(f.size)}</span>
              <button
                type="button"
                className="egr-adj-x"
                onClick={() => onCambio(archivos.filter((_, j) => j !== i))}
                aria-label={`Sacar ${f.name}`}
              >
                <XIcon size={13} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Reparte un importe disponible entre varios egresos, de arriba hacia abajo.
 *
 * Lo usa el endoso: un cheque de 200.000 contra facturas por 300.000 paga las
 * primeras hasta agotarse y deja el resto pendiente. El orden que llega es el
 * del listado —por vencimiento—, así que se cancela primero lo que vence
 * antes, que es lo que haría cualquiera con la chequera en la mano.
 *
 * Nunca le asigna a un egreso más que su saldo: pagar de más no existe.
 */
export function repartirEntreEgresos(
  egresos: Array<{ id: string; saldo: number }>,
  disponible: number,
): Record<string, number> {
  let restante = Math.max(0, disponible);
  const reparto: Record<string, number> = {};
  for (const e of egresos) {
    const toma = Math.min(e.saldo, restante);
    // Redondeo por paso: sin esto, restar flotantes deja "0.009 restante" y
    // el último egreso se lleva un centavo fantasma.
    reparto[e.id] = Math.round(toma * 100) / 100;
    restante = Math.round((restante - toma) * 100) / 100;
  }
  return reparto;
}

/**
 * Escape cierra el modal.
 *
 * Cierra igual que la "×" —sin avisar—, que es lo que ya hacía. Si alguna vez
 * el formulario tiene que defender lo cargado, la pieza de la casa es
 * ConfirmacionSalida y va acá adentro, no en un confirm() del navegador.
 *
 * El SelectBuscable se come su propio Escape cuando está abierto: cerrar una
 * lista no tiene que cerrar el formulario entero.
 */
function useCerrarConEscape(onCerrar: () => void, activo = true) {
  const brand = useEgresosBrand();
  React.useEffect(() => {
    if (!activo || brand) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [onCerrar, activo, brand]);
}

/** Catálogos fijos: no cambian por tenant, así que se arman una sola vez. */
const OPCIONES_COMPROBANTE: OpcionSelect[] = TIPOS_COMPROBANTE_COMPRA.filter(
  (t) => t !== "NC",
).map((t) => ({ value: t, label: TIPO_COMPROBANTE_LABELS[t] }));

const OPCIONES_FRECUENCIA: OpcionSelect[] = FRECUENCIAS_RECURRENTE.map((f) => ({
  value: f,
  label: FRECUENCIA_LABELS[f],
}));

const OPCIONES_RETENCION: OpcionSelect[] = REGIMENES_RETENCION.map((g) => ({
  value: g,
  label: REGIMEN_RETENCION_LABELS[g],
}));

/** "A mano" al final y no primero: es la excepción, no el default. */
const OPCIONES_ALICUOTA: OpcionSelect[] = [
  ...ALICUOTAS_IVA.map((a) => ({ value: String(a), label: `${a}%` })),
  { value: "manual", label: "A mano" },
];

const OPCIONES_CHEQUE: OpcionSelect[] = [
  { value: "echeq", label: "e-cheq" },
  { value: "fisico", label: "Físico" },
];

function opcionesDeMetodos(metodos: MetodoPago[]): OpcionSelect[] {
  return metodos.map((m) => ({ value: m.id, label: m.nombre }));
}

/**
 * Las cuentas para "salió de".
 *
 * NO se filtran por método de pago, se ORDENA y se marca la que el método
 * tiene configurada: `MetodoPago.cuentaDestinoId` es una cuenta por defecto,
 * no una lista de cuentas habilitadas. Filtrar por ella dejaría un solo
 * elemento y taparía casos reales —el efectivo sale de la caja del mostrador
 * o de la caja fuerte, la transferencia de cualquiera de los dos bancos—.
 * Es el mismo criterio que usa Cobros (`cobro-formulario.tsx`).
 *
 * La moneda va como detalle y no pegada al nombre: en un tenant con cuentas
 * en dos monedas es lo que decide cuál elegir.
 */
export function opcionesDeCuentas(
  cuentas: CuentaFondosResumen[],
  cuentaDelMetodoId?: string | null,
): OpcionSelect[] {
  const opciones = cuentas.map((c) => ({
    value: c.id,
    label: c.nombre,
    detalle:
      c.id === cuentaDelMetodoId
        ? `${c.moneda} · la del método elegido`
        : c.moneda,
  }));
  if (!cuentaDelMetodoId) return opciones;
  // La sugerida primero: es la que se va a usar el 90% de las veces.
  return [
    ...opciones.filter((o) => o.value === cuentaDelMetodoId),
    ...opciones.filter((o) => o.value !== cuentaDelMetodoId),
  ];
}

function sumarDias(iso: string, dias: number): string {
  const t = Date.parse(`${iso}T00:00:00Z`) + dias * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export function EgresosView({
  initialEgresos,
  initialResumen,
  categorias,
  proveedores,
  metodosPago,
  cuentas,
  modo = "egresos",
  valorEndosoInicialId,
  altaInicial = false,
}: {
  initialEgresos: Egreso[];
  initialResumen: ResumenEgresos | null;
  categorias: CategoriaEgreso[];
  proveedores: ProveedorOpcion[];
  metodosPago: MetodoPago[];
  cuentas: CuentaFondosResumen[];
  /** Qué mitad del módulo se está mirando. Ver `ModoEgresos`. */
  modo?: ModoEgresos;
  /** Llega desde Cartera: mantiene el endoso dentro de una orden de pago. */
  valorEndosoInicialId?: string;
  /** Permite abrir el alta desde una acción contextual, por ejemplo el Panel. */
  altaInicial?: boolean;
}) {
  const esCuentasPorPagar = modo === "cuentas-por-pagar";
  const scope = useDesignScope();
  const theme = useDesignTheme();
  const conEgresos = useCapacidad("cuentas_pagar");
  const conValores = useCapacidad("valores");
  const metodosDisponibles = metodosPago.filter(
    (m) => conValores || m.tipo !== "cheque_echeq",
  );
  const conRecurrentes = useCapacidad("gastos_recurrentes");
  const conAnalisis = useCapacidad("reportes_finanzas");
  const tabsVisibles = TABS_POR_MODO[modo].filter(
    (t) => t !== "analisis" || (conEgresos && conAnalisis),
  );
  // Los permisos se resuelven en el cliente (patrón de la casa): el guard del
  // API es el que manda, esto sólo evita ofrecer botones que van a dar 403.
  const permisoGestionar = usePuede("administracion.gestionar");
  const puedeGestionar = permisoGestionar && conEgresos;
  const permisoAnular = usePuede("administracion.anular");
  const puedeAnular = permisoAnular && conEgresos;
  const hoy = React.useMemo(() => hoyIso(), []);

  const [tab, setTab] = React.useState<Tab>(tabsVisibles[0]);
  const [egresos, setEgresos] = React.useState(initialEgresos);
  const [resumen, setResumen] = React.useState(initialResumen);
  const [cargando, setCargando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [texto, setTexto] = React.useState("");
  const [altaAbierta, setAltaAbierta] = React.useState(altaInicial && puedeGestionar);
  const [pagoAbierto, setPagoAbierto] = React.useState(false);
  const [seleccion, setSeleccion] = React.useState<Set<string>>(new Set());
  const [detalle, setDetalle] = React.useState<Egreso | null>(null);
  const [anulando, setAnulando] = React.useState<Egreso | null>(null);
  const [saldos, setSaldos] = React.useState<SaldoProveedor[] | null>(null);
  const analisis = useAnalisisEgresos(conRecurrentes);

  const recargar = React.useCallback(
    async () => {
      setCargando(true);
      setError(null);
      try {
        const [lista, res] = await Promise.all([
          getEgresos(esCuentasPorPagar ? { soloPendientes: true } : {}),
          esCuentasPorPagar ? getResumenEgresos() : Promise.resolve(null),
        ]);
        setEgresos(lista.egresos);
        setResumen(res);
        setSeleccion(new Set());
        return lista.egresos;
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo cargar.");
      } finally {
        setCargando(false);
      }
    },
    [esCuentasPorPagar],
  );

  const cambiarTab = (t: Tab) => {
    setTab(t);
    setError(null);
    if (t === "proveedores") {
      setSaldos(null);
      getSaldosProveedores()
        .then((r) => setSaldos(r.proveedores))
        .catch((e) => { setError(e instanceof Error ? e.message : "No se pudieron cargar los saldos."); });
      return;
    }
    if (t === "analisis") {
      void analisis.consultar();
      return;
    }
    void recargar();
  };

  const visibles = React.useMemo(() => {
    if (!texto.trim()) return egresos;
    const q = texto.trim().toLowerCase();
    return egresos.filter(
      (e) =>
        e.descripcion.toLowerCase().includes(q) ||
        e.beneficiarioNombre.toLowerCase().includes(q) ||
        e.numero.toLowerCase().includes(q),
    );
  }, [egresos, texto]);

  const seleccionados = visibles.filter((e) => seleccion.has(e.id));
  const totalSeleccion = seleccionados.reduce((acc, e) => acc + e.saldo, 0);
  // Un pago es de un solo proveedor: una orden de pago se le manda a alguien.
  const proveedoresSeleccion = new Set(
    seleccionados.map((e) => e.proveedorId ?? "sin"),
  );
  const seleccionPagable =
    seleccionados.length > 0 && proveedoresSeleccion.size === 1;

  return (
    <EgresosArea value={esCuentasPorPagar ? "Cuentas por pagar" : "Registro de egresos"}>
    <EgresosBrand value>
    <div {...scope} className={`${theme} ${listPage.page} ${pagarStyles.page}`}>
      <div>
        {!conEgresos ? <Alert>
          <AlertTitle>Historial de egresos</AlertTitle>
          <AlertDescription>Podés consultar los registros y sus pagos. El plan actual no incluye la gestión de egresos ni cuentas por pagar.</AlertDescription>
        </Alert> : null}
        {esCuentasPorPagar ? <CuentasPagarWorkspace
          resumen={resumen} tab={tab === "proveedores" ? "proveedores" : "por-pagar"} onTab={cambiarTab}
          egresos={visibles} saldos={saldos} texto={texto} onTexto={setTexto}
          seleccion={seleccion} onSeleccion={setSeleccion} seleccionados={seleccionados}
          seleccionPagable={seleccionPagable} totalSeleccion={totalSeleccion}
          puedeGestionar={puedeGestionar} cargando={cargando} error={error}
          onReintentar={() => cambiarTab(tab)} hoy={hoy} endosar={!!valorEndosoInicialId && puedeGestionar && conValores}
          onAlta={() => setAltaAbierta(true)} onPago={() => setPagoAbierto(true)} onDetalle={setDetalle}
        /> : <RegistroEgresosWorkspace
          tab={tab === "analisis" ? "analisis" : "todos"} onTab={cambiarTab}
          conAnalisis={conEgresos && conAnalisis} egresos={visibles}
          texto={texto} onTexto={setTexto} puedeGestionar={puedeGestionar}
          cargando={cargando} error={error} analisis={analisis} conPresupuesto={conRecurrentes}
          onReintentar={() => cambiarTab(tab)} onAlta={() => setAltaAbierta(true)}
          onDetalle={setDetalle}
        />}

        {altaAbierta && puedeGestionar ? (
          <AltaEgreso
            modo={modo}
            categorias={categorias}
            proveedores={proveedores}
            metodosPago={metodosDisponibles}
            cuentas={cuentas}
            hoy={hoy}
            onCerrar={() => setAltaAbierta(false)}
            /*
              Se abre el detalle del recién creado en vez de volver al listado:
              es la confirmación de que quedó guardado y, sobre todo, es donde
              se adjunta la factura escaneada. El adjunto NO puede vivir en el
              alta porque el archivo se cuelga de un egreso que todavía no
              existe.
            */
            onListo={(creadoId) => {
              setAltaAbierta(false);
              void recargar().then((lista) => {
                const nuevo = lista?.find((e) => e.id === creadoId);
                if (nuevo) setDetalle(nuevo);
              });
            }}
          />
        ) : null}

        {pagoAbierto && puedeGestionar ? (
          <RegistrarPago
            egresos={seleccionados}
            metodosPago={metodosDisponibles}
            cuentas={cuentas}
            hoy={hoy}
            valorInicialId={conValores ? valorEndosoInicialId : undefined}
            onCerrar={() => setPagoAbierto(false)}
            onListo={() => {
              setPagoAbierto(false);
              void recargar();
            }}
          />
        ) : null}

        {detalle ? (
          <DetalleEgreso
            egreso={detalle}
            categorias={categorias}
            puedeGestionar={puedeGestionar}
            puedeAnular={puedeAnular}
            onCerrar={() => setDetalle(null)}
            onAnular={() => {
              setAnulando(detalle);
              setDetalle(null);
            }}
            onCambio={() => {
              void recargar().then((lista) => {
                const actualizado = lista?.find((e) => e.id === detalle.id);
                if (actualizado) setDetalle(actualizado);
              });
            }}
          />
        ) : null}

        <ConfirmacionDestructiva
          apariencia="heroui"
          open={anulando !== null && puedeAnular}
          onOpenChange={(v) => {
            if (!v) setAnulando(null);
          }}
          titulo={`Anular ${anulando?.numero ?? ""}`}
          descripcion="El egreso queda registrado como anulado con su motivo: no se borra, para que el historial no tenga huecos."
          nombreItem={anulando?.descripcion}
          requiereTipear={false}
          motivo={{
            label: "Por qué se anula",
            placeholder: "Se cargó por error, factura duplicada…",
          }}
          accionLabel="Anular egreso"
          onConfirmar={async (motivo) => {
            if (!anulando || !puedeAnular) return;
            await anularEgreso(anulando.id, motivo);
            setAnulando(null);
            void recargar();
          }}
        />
      </div>
    </div>
    </EgresosBrand>
    </EgresosArea>
  );
}

/**
 * Plantillas que emiten egresos solas (journeys B5 y B6).
 *
 * El monto es una SUGERENCIA y la pantalla lo dice: la luz no viene igual dos
 * meses seguidos, así que el egreso nace pendiente con ese importe y quien lo
 * paga lo corrige. Si el sistema tratara el monto como verdad, mentiría con
 * precisión.
 */
export function ProgramacionesAnterioresLista({
  recurrentes,
  categorias,
  proveedores,
  gastosFijos,
  hoy,
  puedeGestionar,
  fmt,
  onCambio,
}: {
  recurrentes: GastoRecurrente[] | null;
  categorias: CategoriaEgreso[];
  proveedores: ProveedorOpcion[];
  gastosFijos: GastoFijo[];
  hoy: string;
  puedeGestionar: boolean;
  fmt: (v: number) => string;
  onCambio: () => void;
}) {
  const [editando, setEditando] = React.useState<GastoRecurrente | null>(null);
  const activas = categorias.filter((c) => c.activo);
  const opcionesCategoria = React.useMemo(
    () => opcionesDeCategorias(categorias),
    [categorias],
  );
  const opcionesProveedor = React.useMemo<OpcionSelect[]>(
    () => [
      { value: "", label: "Sin proveedor" },
      ...proveedores.map((p) => ({ value: p.id, label: p.nombre })),
    ],
    [proveedores],
  );
  const opcionesGastoFijo = React.useMemo<OpcionSelect[]>(
    () => [
      { value: "", label: "Sin vincular" },
      ...gastosFijos
        .filter((g) => g.activo)
        .map((g) => ({
          value: g.id,
          label: g.nombre,
          detalle: `${g.categoriaNombre} · ${fmt(g.importeMensual)}/mes`,
        })),
    ],
    [gastosFijos, fmt],
  );
  const cerrarFormulario = React.useCallback(() => {
    setEditando(null);
  }, []);
  useCerrarConEscape(cerrarFormulario, editando !== null);

  const [descripcion, setDescripcion] = React.useState("");
  const [categoriaId, setCategoriaId] = React.useState(activas[0]?.id ?? "");
  const [proveedorId, setProveedorId] = React.useState("");
  const [monto, setMonto] = React.useState(0);
  const [frecuencia, setFrecuencia] = React.useState("mensual");
  const [dia, setDia] = React.useState(10);
  const [desde, setDesde] = React.useState(hoy.slice(0, 7));
  const [hasta, setHasta] = React.useState("");
  const [gastoFijoId, setGastoFijoId] = React.useState("");

  const abrirEdicion = (r: GastoRecurrente) => {
    setEditando(r);
    setDescripcion(r.descripcion);
    setCategoriaId(r.categoriaEgresoId);
    setProveedorId(r.proveedorId ?? "");
    setMonto(r.monto);
    setFrecuencia(r.frecuencia);
    setDia(r.diaVencimiento);
    setDesde(r.vigenteDesde);
    setHasta(r.vigenteHasta ?? "");
    setGastoFijoId(r.gastoFijoEstructuraId ?? "");
  };

  const guardar = async () => {
    if (editando) {
      await editarRecurrente(editando.id, {
        descripcion: descripcion.trim(),
        monto,
        diaVencimiento: dia,
        vigenteHasta: hasta || undefined,
        gastoFijoEstructuraId: gastoFijoId || null,
      });
    }
    cerrarFormulario();
    setDescripcion("");
    setMonto(0);
    onCambio();
  };

  if (!recurrentes) {
    return <div className="egr-cargando">Cargando plantillas…</div>;
  }

  return (
    <div className="egr-analisis">
      {recurrentes.length === 0 ? (
        <div className="egr-empty">
          <div className="ttl">Sin programaciones anteriores</div>
          <div className="sub">
            Las nuevas programaciones se configuran desde cada gasto en Gastos fijos.
          </div>
        </div>
      ) : (
        <div className="egr-tabla-wrap">
          <table className="egr-tabla">
            <thead>
              <tr>
                <th>Plantilla</th>
                <th>Categoría</th>
                <th>Frecuencia</th>
                <th className="num">Importe</th>
                <th>Último emitido</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {recurrentes.map((r) => (
                <tr key={r.id} className={r.activo ? "" : "muted-row"}>
                  <td>
                    {r.descripcion}
                    <span className="egr-sub">
                      {r.proveedorNombre ?? "sin proveedor"} · vence el día{" "}
                      {r.diaVencimiento}
                      {r.gastoFijoNombre
                        ? ` · presupuestado: ${r.gastoFijoNombre}`
                        : ""}
                    </span>
                  </td>
                  <td>{r.categoriaNombre}</td>
                  <td>{FRECUENCIA_LABELS[r.frecuencia] ?? r.frecuencia}</td>
                  <td className="num mono">
                    {fmt(r.monto)}
                    <span className="egr-sub">sugerido</span>
                  </td>
                  <td className="mono">
                    {r.ultimoPeriodoGenerado ?? "—"}
                    <span className="egr-sub">
                      {r.egresosEmitidos} emitido
                      {r.egresosEmitidos === 1 ? "" : "s"}
                    </span>
                  </td>
                  <td>
                    {r.gastoFijoEstructuraId && recurrentes.filter((otro) => otro.gastoFijoEstructuraId === r.gastoFijoEstructuraId).length === 1 ? (
                      <><span className={`egr-badge ${r.activo ? "" : "anulado"}`}>{r.activo ? "Activa" : "Inactiva"}</span><br /><Link className="egr-link" href="/administracion/gastos-fijos">Configurar en Gastos fijos</Link></>
                    ) : puedeGestionar ? (
                      <div className="egr-acciones-inline">
                        <button
                          type="button"
                          className="egr-link"
                          onClick={() => abrirEdicion(r)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="egr-link"
                          onClick={async () => {
                            try {
                              await editarRecurrente(r.id, { activo: !r.activo });
                              onCambio();
                            } catch (error) {
                              toast.error(error instanceof Error ? error.message : "No se pudo cambiar la programación.");
                            }
                          }}
                        >
                          {r.activo ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    ) : (
                      <span
                        className={`egr-badge ${r.activo ? "" : "anulado"}`}
                      >
                        {r.activo ? "Activa" : "Inactiva"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {puedeGestionar && editando ? (
        <div className="mod-bg" role="dialog" aria-modal="true">
          <div className="mod mod-sm">
            <div className="mod-head">
              <h2>Editar programación anterior</h2>
              <button
                type="button"
                className="mod-x"
                onClick={cerrarFormulario}
              >
                ×
              </button>
            </div>
            <div className="mod-body">
              <div className="egr-grid">
                <label className="egr-f egr-f-wide">
                  <span>Descripción</span>
                  <input
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Alquiler del galpón, Internet, Contador…"
                  />
                </label>
                <label className="egr-f">
                  <span>Categoría</span>
                  <SelectBuscable
                    value={categoriaId}
                    onChange={setCategoriaId}
                    opciones={opcionesCategoria}
                    placeholder="Elegir categoría"
                    placeholderBusqueda="Buscar categoría…"
                    vacio="Ninguna categoría coincide."
                    disabled={editando !== null}
                  />
                </label>
                <label className="egr-f">
                  <span>Proveedor</span>
                  <SelectBuscable
                    value={proveedorId}
                    onChange={setProveedorId}
                    opciones={opcionesProveedor}
                    placeholder="Sin proveedor"
                    placeholderBusqueda="Buscar proveedor…"
                    vacio="Ningún proveedor coincide."
                    disabled={editando !== null}
                  />
                </label>
                <label className="egr-f">
                  <span>Importe sugerido</span>
                  <CampoMonto
                    valor={monto}
                    onCambio={setMonto}
                    ariaLabel="Importe sugerido"
                  />
                  <small className="egr-hint">
                    Se puede corregir mes a mes: la luz nunca es igual.
                  </small>
                </label>
                <label className="egr-f">
                  <span>Frecuencia</span>
                  <SelectBuscable
                    value={frecuencia}
                    onChange={setFrecuencia}
                    opciones={OPCIONES_FRECUENCIA}
                    disabled={editando !== null}
                  />
                </label>
                <label className="egr-f">
                  <span>Vence el día</span>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={dia}
                    onChange={(e) =>
                      setDia(
                        Math.max(1, Math.min(31, Number(e.target.value) || 1)),
                      )
                    }
                  />
                  <small className="egr-hint">
                    El 31 en un mes corto cae el último día.
                  </small>
                </label>
                <label className="egr-f">
                  <span>Desde</span>
                  <input
                    type="month"
                    value={desde}
                    onChange={(e) => setDesde(e.target.value)}
                    disabled={editando !== null}
                  />
                </label>
                <label className="egr-f">
                  <span>Hasta</span>
                  <input
                    type="month"
                    value={hasta}
                    min={desde}
                    onChange={(e) => setHasta(e.target.value)}
                  />
                  <small className="egr-hint">
                    Vacío significa sin fecha de fin.
                  </small>
                </label>
                <label className="egr-f egr-f-wide">
                  <span>Gasto fijo presupuestado</span>
                  <SelectBuscable
                    value={gastoFijoId}
                    onChange={setGastoFijoId}
                    opciones={opcionesGastoFijo.filter((opcion) => !opcion.value || opcion.value === editando?.gastoFijoEstructuraId)}
                    placeholder="Sin vincular"
                    placeholderBusqueda="Buscar gasto fijo…"
                    vacio="Ningún gasto fijo coincide."
                  />
                  <small className="egr-hint">
                    Las nuevas vinculaciones se configuran desde Gastos fijos. Podés desvincular una programación anterior para resolver duplicados sin perder sus egresos.
                  </small>
                </label>
              </div>
            </div>
            <div className="mod-foot">
              <button type="button" className="btn" onClick={cerrarFormulario}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={
                  descripcion.trim().length < 2 || !categoriaId || monto <= 0
                }
                onClick={() => void guardar().catch((error) => toast.error(error instanceof Error ? error.message : "No se pudo guardar."))}
              >
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Alta de un egreso. El switch "Ya está pagado" es el corazón de la pantalla:
 * encendido pide la cuenta y el egreso nace saldado; apagado pide el
 * vencimiento y va a Cuentas por pagar.
 */
function AltaEgreso({
  modo,
  categorias,
  proveedores,
  metodosPago,
  cuentas,
  hoy,
  onCerrar,
  onListo,
}: {
  modo: ModoEgresos;
  categorias: CategoriaEgreso[];
  proveedores: ProveedorOpcion[];
  metodosPago: MetodoPago[];
  cuentas: CuentaFondosResumen[];
  hoy: string;
  onCerrar: () => void;
  /** Devuelve el id para que el listado pueda abrir el detalle recién creado. */
  onListo: (creadoId: string) => void;
}) {
  const { moneda } = useConfigRegional();
  const fmt = (v: number) => formatearMoneda(v, moneda);
  const activas = categorias.filter((c) => c.activo);
  const opcionesCategoria = React.useMemo(
    () => opcionesDeCategorias(categorias),
    [categorias],
  );
  // "Sin proveedor" es una opción real y va primera: la mayoría de los egresos
  // de un taller no tienen proveedor cargado (la nafta, un flete suelto).
  const opcionesProveedor = React.useMemo<OpcionSelect[]>(
    () => [
      { value: "", label: "Sin proveedor" },
      ...proveedores.map((p) => ({ value: p.id, label: p.nombre })),
    ],
    [proveedores],
  );
  const opcionesMetodo = React.useMemo(
    () => opcionesDeMetodos(metodosPago),
    [metodosPago],
  );

  const [yaPagado, setYaPagado] = React.useState(modo !== "cuentas-por-pagar");
  const [descripcion, setDescripcion] = React.useState("");
  const [categoriaId, setCategoriaId] = React.useState(activas[0]?.id ?? "");
  const [proveedorId, setProveedorId] = React.useState("");
  const [beneficiario, setBeneficiario] = React.useState("");
  const [competencia, setCompetencia] = React.useState(hoy);
  const [vencimiento, setVencimiento] = React.useState(sumarDias(hoy, 30));
  const [neto, setNeto] = React.useState(0);
  const [iva, setIva] = React.useState(0);
  const [otrosImpuestos, setOtrosImpuestos] = React.useState(0);
  /** Porcentaje elegido, o `null` = lo escribe la persona. */
  const [alicuota, setAlicuota] = React.useState<number | null>(21);
  const [tipoComprobante, setTipoComprobante] = React.useState("SIN_DOCUMENTO");
  const [puntoVenta, setPuntoVenta] = React.useState("");
  const [numeroComprobante, setNumeroComprobante] = React.useState("");
  const [metodoPagoId, setMetodoPagoId] = React.useState(
    metodosPago[0]?.id ?? "",
  );
  /**
   * `null` = todavía no la eligieron a mano, así que la manda el método.
   * Una vez que la persona elige una, se respeta aunque después cambie el
   * método: lo explícito le gana a lo sugerido.
   */
  const [cuentaId, setCuentaId] = React.useState<string | null>(null);
  const [referencia, setReferencia] = React.useState("");
  const [notas, setNotas] = React.useState("");
  /** Retenidos hasta que el egreso exista. Ver `ComprobantePendiente`. */
  const [adjuntos, setAdjuntos] = React.useState<File[]>([]);
  const [cuotas, setCuotas] = React.useState(1);
  const [guardando, setGuardando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // ─── Cerrar con datos cargados ───────────────────────────────────
  //
  // El formulario tiene veinte campos: cerrarlo por Escape o por la × sin
  // avisar tiraba todo lo tipeado. Se compara el estado contra el que tenía
  // al abrirse en vez de marcar campo por campo.
  const instantanea = JSON.stringify([
    yaPagado,
    descripcion,
    categoriaId,
    proveedorId,
    beneficiario,
    competencia,
    vencimiento,
    neto,
    iva,
    otrosImpuestos,
    alicuota,
    tipoComprobante,
    puntoVenta,
    numeroComprobante,
    metodoPagoId,
    cuentaId,
    referencia,
    notas,
    adjuntos.length,
    cuotas,
  ]);
  const [instantaneaInicial] = React.useState(instantanea);
  const hayCambios = instantanea !== instantaneaInicial;
  const [confirmandoSalida, setConfirmandoSalida] = React.useState(false);
  const pedirCierre = React.useCallback(() => {
    if (hayCambios) {
      setConfirmandoSalida(true);
      return;
    }
    onCerrar();
  }, [hayCambios, onCerrar]);
  useCerrarConEscape(pedirCierre, !confirmandoSalida);

  const conIva = discriminaIva(tipoComprobante);
  const requiereDatosFiscales = ["FA", "FB", "FC", "ND"].includes(
    tipoComprobante,
  );
  const total = neto + iva + otrosImpuestos;

  // La cuenta que se va a usar: la elegida, si no la del método, si no la
  // primera. Mismo orden que Cobros.
  const metodo = metodosPago.find((m) => m.id === metodoPagoId);
  const cuentaUsadaId =
    cuentaId ?? metodo?.cuentaDestinoId ?? cuentas[0]?.id ?? "";
  const opcionesCuenta = React.useMemo(
    () => opcionesDeCuentas(cuentas, metodo?.cuentaDestinoId),
    [cuentas, metodo?.cuentaDestinoId],
  );

  /*
    El IVA lo calcula la alícuota, salvo que lo escriban a mano. Escribirlo a
    mano no es un caso raro: una factura con dos alícuotas mezcladas, o el
    proveedor que redondeó distinto y el número tiene que coincidir con el
    papel. Por eso "A mano" es una opción y no un accidente.
  */
  React.useEffect(() => {
    if (!conIva || alicuota === null) return;
    setIva(ivaDeNeto(neto, alicuota));
  }, [neto, alicuota, conIva]);

  /* Un ticket, un recibo o un gasto sin papel no tienen IVA que descontar: el
     campo se va de pantalla Y el valor se limpia, para que no quede colgado
     un crédito fiscal de un comprobante anterior. */
  React.useEffect(() => {
    if (!conIva) setIva(0);
  }, [conIva]);

  /** Tocar el importe del IVA pasa la alícuota a "a mano". */
  const cambiarIva = (n: number) => {
    setAlicuota(null);
    setIva(n);
  };

  const proveedorElegido = proveedores.find((p) => p.id === proveedorId);

  // El plazo del proveedor precarga el vencimiento: es el dato por el que se
  // carga en el maestro. `0` es contado y también es una respuesta, así que se
  // aplica igual (vence hoy) en vez de ignorarse como si no estuviera.
  React.useEffect(() => {
    const dias = proveedorElegido?.condicionPagoDias;
    if (dias != null) setVencimiento(sumarDias(hoy, dias));
  }, [proveedorElegido, hoy]);

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      const body: CrearEgresoBody = {
        descripcion: descripcion.trim(),
        categoriaEgresoId: categoriaId,
        fechaCompetencia: competencia,
        neto,
        iva,
        otrosImpuestos,
        notas: notas.trim() || undefined,
      };
      if (proveedorId) body.proveedorId = proveedorId;
      else body.beneficiarioNombre = beneficiario.trim();
      if (tipoComprobante !== "SIN_DOCUMENTO") {
        body.tipoComprobante = tipoComprobante;
        body.puntoVenta = puntoVenta.trim() || undefined;
        body.numeroComprobante = numeroComprobante.trim() || undefined;
      }
      if (yaPagado) {
        body.pago = {
          metodoPagoId,
          cuentaOrigenId: cuentaUsadaId,
          fecha: competencia,
          referencia: referencia.trim() || undefined,
        };
      } else {
        body.fechaVencimiento = vencimiento;
        if (cuotas > 1) body.cuotas = cuotas;
      }
      const { id } = await crearEgreso(body);

      /*
        Recién ahora hay a qué colgar los archivos. Si alguno falla NO se
        deshace el egreso: ya está registrado y con su pago hecho, y anularlo
        por una subida cortada sería peor. Se avisa cuál falló y el detalle
        —que se abre a continuación— deja volver a intentarlo.
      */
      const fallaron: string[] = [];
      for (const file of adjuntos) {
        try {
          await subirArchivo(file, { scope: "EGRESO", entidadId: id });
        } catch {
          fallaron.push(file.name);
        }
      }
      if (fallaron.length) {
        toast.error(
          `El egreso quedó registrado, pero no se pudo adjuntar ${fallaron.join(", ")}. Probá de nuevo desde el detalle.`,
        );
      }

      onListo(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };

  const listo =
    descripcion.trim().length >= 2 &&
    categoriaId &&
    total > 0 &&
    (proveedorId || beneficiario.trim().length >= 2) &&
    (!requiereDatosFiscales ||
      (proveedorId && puntoVenta.trim() && numeroComprobante.trim())) &&
    // `cuentaUsadaId` y no `cuentaId`: lo que importa es que HAYA una cuenta,
    // no que la hayan elegido a mano. Mirar el estado crudo dejaría el botón
    // apagado hasta tocar un campo que ya venía resuelto.
    (!yaPagado || (metodoPagoId && cuentaUsadaId));

  return (
    <>
      <EgresoDialog title="Registrar egreso" description="La obligación, su comprobante y las condiciones de pago." onCerrar={pedirCierre} bloqueado={guardando}>

        <div className="mod-body">
          {/* El switch primero: define qué pide el resto del formulario. */}
          <label className="egr-switch">
            <input
              type="checkbox"
              checked={yaPagado}
              onChange={(e) => setYaPagado(e.target.checked)}
            />
            <span>
              <b>Ya está pagado</b>
              <small>
                {yaPagado
                  ? "Salió de la caja ahora: no entra en cuentas por pagar."
                  : "Queda pendiente con vencimiento y entra en cuentas por pagar."}
              </small>
            </span>
          </label>

          <div className="egr-grid">
            <label className="egr-f egr-f-wide">
              <span>Descripción</span>
              <input
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Nafta camioneta, papel obra, alquiler agosto…"
              />
            </label>

            <label className="egr-f">
              <span>Categoría</span>
              <SelectBuscable
                ariaLabel="Categoría" value={categoriaId}
                onChange={setCategoriaId}
                opciones={opcionesCategoria}
                placeholder="Elegir categoría"
                placeholderBusqueda="Buscar categoría…"
                vacio="Ninguna categoría coincide."
              />
              {/* Sin la ayuda de la naturaleza: desde que la lista agrupa por
                  naturaleza y muestra su título, repetirla debajo del campo
                  era decir dos veces lo mismo y movía el alto de la fila. */}
            </label>

            <label className="egr-f">
              <span>Proveedor</span>
              <SelectBuscable
                ariaLabel="Proveedor" value={proveedorId}
                onChange={setProveedorId}
                opciones={opcionesProveedor}
                placeholder="Sin proveedor"
                placeholderBusqueda="Buscar proveedor…"
                vacio="Ningún proveedor coincide."
              />
            </label>

            {!proveedorId ? (
              <label className="egr-f">
                <span>¿A quién se le paga?</span>
                <input
                  value={beneficiario}
                  onChange={(e) => setBeneficiario(e.target.value)}
                  placeholder="Flete Ramón, Municipalidad…"
                />
              </label>
            ) : null}

            <label className="egr-f">
              <span>Competencia</span>
              <input
                type="date"
                value={competencia}
                onChange={(e) => setCompetencia(e.target.value)}
              />
              <small className="egr-hint">A qué mes pertenece el gasto.</small>
            </label>

            {!yaPagado ? (
              <label className="egr-f">
                <span>Vencimiento</span>
                <input
                  type="date"
                  value={vencimiento}
                  onChange={(e) => setVencimiento(e.target.value)}
                />
                {proveedorElegido?.condicionPagoDias != null ? (
                  <small className="egr-hint">
                    {proveedorElegido.condicionPagoDias === 0
                      ? `${proveedorElegido.nombre} es de contado.`
                      : `${proveedorElegido.nombre} da ${proveedorElegido.condicionPagoDias} días.`}
                  </small>
                ) : null}
              </label>
            ) : null}

            {!yaPagado ? (
              <label className="egr-f">
                <span>Cuotas</span>
                <input
                  type="number"
                  min={1}
                  max={36}
                  value={cuotas}
                  onChange={(e) =>
                    setCuotas(
                      Math.max(1, Math.min(36, Number(e.target.value) || 1)),
                    )
                  }
                />
                {cuotas > 1 ? (
                  <small className="egr-hint">
                    {cuotas} egresos, uno por mes desde el vencimiento. Cada uno
                    se paga por separado.
                  </small>
                ) : null}
              </label>
            ) : null}

            {/* El importe y el documento van juntos en su propia sub-grilla y
                no sueltos en la grilla de 2 columnas: arriba hay campos
                condicionales (beneficiario, vencimiento) y según cuáles se
                muestren, estos tres caerían corridos de fila. */}
            <div
              className={
                conIva ? "egr-sub egr-sub-importe" : "egr-sub egr-sub-2"
              }
            >
              <label className="egr-f">
                {/* Sin IVA discriminado el importe ES el total, y llamarlo
                    "Neto" haría pensar que falta sumarle algo. */}
                <span>{conIva ? "Neto" : "Importe"}</span>
                <CampoMonto
                  valor={neto}
                  onCambio={setNeto}
                  ariaLabel={conIva ? "Neto" : "Importe"}
                />
              </label>
              {conIva ? (
                <>
                  {/* La alícuota va ANTES del IVA y no adentro de su etiqueta:
                      se lee en el orden en que se piensa —importe, a cuánto,
                      cuánto da— y es el campo que más se toca de los tres. */}
                  <label className="egr-f">
                    <span>Alícuota</span>
                    <SelectBuscable
                      value={alicuota === null ? "manual" : String(alicuota)}
                      onChange={(v) =>
                        setAlicuota(v === "manual" ? null : Number(v))
                      }
                      opciones={OPCIONES_ALICUOTA}
                      ariaLabel="Alícuota de IVA"
                    />
                  </label>
                  <label className="egr-f">
                    <span>IVA</span>
                    <CampoMonto
                      valor={iva}
                      onCambio={cambiarIva}
                      ariaLabel="IVA"
                    />
                  </label>
                </>
              ) : null}
              <label className="egr-f">
                <span>Comprobante</span>
                <SelectBuscable
                  ariaLabel="Comprobante" value={tipoComprobante}
                  onChange={setTipoComprobante}
                  opciones={OPCIONES_COMPROBANTE}
                />
              </label>
            </div>

            <div className="egr-sub egr-sub-2">
              <label className="egr-f">
                <span>Otros impuestos / percepciones</span>
                <CampoMonto
                  valor={otrosImpuestos}
                  onCambio={setOtrosImpuestos}
                  ariaLabel="Otros impuestos y percepciones"
                />
              </label>
              <div className="egr-hint egr-hint-box">
                Importes del comprobante que no son IVA: percepciones de IIBB,
                tasas u otros tributos.
              </div>
            </div>

            {tipoComprobante !== "SIN_DOCUMENTO" ? (
              <div className="egr-sub egr-sub-2">
                {/* Los ceros los pone el sistema al salir del campo, no la
                    persona: se tipea "1" y "12345", que es lo que uno lee en
                    la factura. Al salir y no al tipear, porque rellenar por
                    tecla no dejaría escribir el segundo dígito. */}
                <label className="egr-f">
                  <span>Punto de venta</span>
                  <input
                    inputMode="numeric"
                    value={puntoVenta}
                    onChange={(e) => setPuntoVenta(e.target.value)}
                    onBlur={() =>
                      setPuntoVenta((v) => completarCeros(v, LARGO_PUNTO_VENTA))
                    }
                    placeholder="0001"
                  />
                </label>
                <label className="egr-f">
                  <span>Número</span>
                  <input
                    inputMode="numeric"
                    value={numeroComprobante}
                    onChange={(e) => setNumeroComprobante(e.target.value)}
                    onBlur={() =>
                      setNumeroComprobante((v) =>
                        completarCeros(v, LARGO_NUMERO_COMPROBANTE),
                      )
                    }
                    placeholder="00012345"
                  />
                </label>
              </div>
            ) : null}

            {requiereDatosFiscales && !proveedorId ? (
              <div className="egr-error egr-f-wide">
                Para una factura o nota de débito, elegí el proveedor que la
                emitió.
              </div>
            ) : null}

            {yaPagado ? (
              <>
                <label className="egr-f">
                  <span>Método de pago</span>
                  <SelectBuscable
                    ariaLabel="Método de pago" value={metodoPagoId}
                    onChange={setMetodoPagoId}
                    opciones={opcionesMetodo}
                    placeholderBusqueda="Buscar método…"
                  />
                </label>
                <label className="egr-f">
                  <span>Salió de</span>
                  <SelectBuscable
                    ariaLabel="Cuenta de fondos" value={cuentaUsadaId}
                    onChange={setCuentaId}
                    opciones={opcionesCuenta}
                    placeholderBusqueda="Buscar cuenta…"
                  />
                </label>
                <label className="egr-f">
                  <span>Referencia</span>
                  <input
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    placeholder="N° de operación"
                  />
                </label>
              </>
            ) : null}

            <label className="egr-f egr-f-wide">
              <span>Notas</span>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={2}
              />
            </label>

            <label className="egr-f egr-f-wide">
              <span>Comprobante</span>
              <ComprobantePendiente
                archivos={adjuntos}
                onCambio={setAdjuntos}
              />
            </label>
          </div>

          <div className="egr-total mod-destacado">
            <span>Total</span>
            <strong className="mono">{fmt(total)}</strong>
          </div>

          {error ? <div className="egr-error mod-suelto">{error}</div> : null}
        </div>

        <div className="mod-foot">
          <EgresoButton type="button" className="btn" onClick={pedirCierre}>
            Cancelar
          </EgresoButton>
          <EgresoButton
            type="button"
            className="btn btn-primary"
            disabled={!listo || guardando}
            onClick={() => void guardar()}
          >
            {guardando ? "Guardando…" : "Registrar"}
          </EgresoButton>
        </div>
      </EgresoDialog>

      <ConfirmacionSalida
        open={confirmandoSalida}
        cambios={1}
        donde="este egreso"
        guardando={guardando}
        onGuardarYSalir={async () => {
          setConfirmandoSalida(false);
          await guardar();
        }}
        onDescartarYSalir={() => {
          setConfirmandoSalida(false);
          onCerrar();
        }}
        onSeguirEditando={() => setConfirmandoSalida(false)}
      />
    </>
  );
}

/** Pago de uno o varios egresos del mismo proveedor. */
function RegistrarPago({
  egresos,
  metodosPago,
  cuentas,
  hoy,
  valorInicialId,
  onCerrar,
  onListo,
}: {
  egresos: Egreso[];
  metodosPago: MetodoPago[];
  cuentas: CuentaFondosResumen[];
  hoy: string;
  valorInicialId?: string;
  onCerrar: () => void;
  onListo: () => void;
}) {
  const { moneda } = useConfigRegional();
  const fmt = (v: number) => formatearMoneda(v, moneda);
  const opcionesMetodo = React.useMemo(
    () => opcionesDeMetodos(metodosPago),
    [metodosPago],
  );
  const metodoChequeInicial = metodosPago.find(
    (metodo) => metodo.tipo === "cheque_echeq",
  );
  const [metodoPagoId, setMetodoPagoId] = React.useState(
    valorInicialId
      ? (metodoChequeInicial?.id ?? "")
      : (metodosPago[0]?.id ?? ""),
  );
  /** `null` = la manda el método elegido. Ver `opcionesDeCuentas`. */
  const [cuentaId, setCuentaId] = React.useState<string | null>(null);
  const [fecha, setFecha] = React.useState(hoy);
  const [referencia, setReferencia] = React.useState("");
  // Editable por egreso: así el pago parcial es el mismo formulario.
  const [montos, setMontos] = React.useState<Record<string, number>>(() =>
    Object.fromEntries(egresos.map((e) => [e.id, e.saldo])),
  );
  const [retenciones, setRetenciones] = React.useState<
    Array<{
      regimen: string;
      jurisdiccion: string;
      base: number;
      alicuota: number;
      monto: number;
      nroComprobante: string;
    }>
  >([]);
  const [chequeNumero, setChequeNumero] = React.useState("");
  const [chequeBanco, setChequeBanco] = React.useState("");
  const [chequeFormato, setChequeFormato] = React.useState("echeq");
  const [chequeModalidad, setChequeModalidad] = React.useState<
    "comun" | "diferido"
  >("comun");
  const [chequeIdentificadorBancario, setChequeIdentificadorBancario] =
    React.useState("");
  const [chequeFechaPago, setChequeFechaPago] = React.useState("");
  /** Emitir uno propio o endosar uno que ya está en cartera. */
  const [chequeModo, setChequeModo] = React.useState<"propio" | "endoso">(
    valorInicialId ? "endoso" : "propio",
  );
  const [valorId, setValorId] = React.useState(valorInicialId ?? "");
  /** `null` = todavía no se pidió la cartera. */
  const [valores, setValores] = React.useState<ValorEnCartera[] | null>(null);
  const [guardando, setGuardando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const idempotencyKey = React.useRef(crypto.randomUUID()).current;

  // Mismo guardián que el alta: el pago también se carga a mano.
  const instantanea = JSON.stringify([
    metodoPagoId,
    cuentaId,
    fecha,
    referencia,
    montos,
    retenciones,
    chequeNumero,
    chequeBanco,
    chequeFormato,
    chequeModalidad,
    chequeIdentificadorBancario,
    chequeFechaPago,
    chequeModo,
    valorId,
  ]);
  const [instantaneaInicial] = React.useState(instantanea);
  const hayCambios = instantanea !== instantaneaInicial;
  const [confirmandoSalida, setConfirmandoSalida] = React.useState(false);
  const pedirCierre = React.useCallback(() => {
    if (hayCambios) {
      setConfirmandoSalida(true);
      return;
    }
    onCerrar();
  }, [hayCambios, onCerrar]);
  useCerrarConEscape(pedirCierre, !confirmandoSalida);

  const metodo = metodosPago.find((m) => m.id === metodoPagoId);
  const esCheque = metodo?.tipo === "cheque_echeq";
  const esEndoso = esCheque && chequeModo === "endoso";

  // La cartera se pide sólo cuando hace falta: la mayoría de los pagos no son
  // por endoso y el modal no tiene por qué pagar esa consulta siempre.
  React.useEffect(() => {
    if (!esCheque || chequeModo !== "endoso" || valores !== null) return;
    getValoresEnCartera()
      .then((r) => setValores(r.valores))
      .catch(() => setValores([]));
  }, [esCheque, chequeModo, valores]);

  const valorElegido = valores?.find((v) => v.id === valorId) ?? null;

  /**
   * Deja el pago en exactamente lo que cubre el cheque.
   *
   * Un cheque de 200.000 contra una factura de 300.000 es un pago PARCIAL de
   * 200.000, no un cheque partido: el resto se paga después por otro medio y
   * la factura queda en "parcial" mientras tanto. Esto es lo que evita tener
   * que hacer la cuenta a mano en cada renglón.
   *
   * Reparte de arriba hacia abajo —el orden de la lista es por vencimiento—
   * hasta agotar el cheque, sin pasarse del saldo de cada egreso.
   */
  const ajustarAlCheque = () => {
    if (!valorElegido) return;
    // El cheque respalda lo que SALE; lo retenido no viaja en el cheque.
    setMontos(
      repartirEntreEgresos(egresos, valorElegido.importe + retencionesTotal),
    );
  };

  /** Lo que el cheque puede pagar como máximo de esta selección. */
  const totalSaldos = egresos.reduce((acc, e) => acc + e.saldo, 0);
  const opcionesValores = React.useMemo<OpcionSelect[]>(
    () =>
      (valores ?? []).map((v) => ({
        value: v.id,
        label: `${v.banco} ${v.numero}`,
        // Importe y de quién vino: es lo que decide cuál usar.
        detalle: [
          formatearMoneda(v.importe, moneda),
          v.clienteNombre,
          v.fechaPago ? `al ${v.fechaPago}` : "al día",
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    [valores, moneda],
  );
  const cuentasCompatibles =
    esCheque && chequeModo === "propio"
      ? cuentas.filter((cuenta) => cuenta.tipo === "banco")
      : cuentas;
  const cuentaPredeterminadaId = cuentasCompatibles.some(
    (cuenta) => cuenta.id === metodo?.cuentaDestinoId,
  )
    ? (metodo?.cuentaDestinoId ?? "")
    : (cuentasCompatibles[0]?.id ?? "");
  const cuentaUsadaId =
    cuentaId && cuentasCompatibles.some((cuenta) => cuenta.id === cuentaId)
      ? cuentaId
      : cuentaPredeterminadaId;
  const opcionesCuenta = opcionesDeCuentas(
    cuentasCompatibles,
    cuentaPredeterminadaId,
  );
  const total = egresos.reduce((acc, e) => acc + (montos[e.id] ?? 0), 0);
  const retencionesTotal = retenciones.reduce((acc, r) => acc + r.monto, 0);
  const retencionesInvalidas = retenciones.some(
    (retencion) =>
      retencion.base <= 0 ||
      retencion.alicuota <= 0 ||
      retencion.monto <= 0 ||
      (retencion.regimen === "IIBB_CONVENIO" && !retencion.jurisdiccion.trim()),
  );
  // Lo que realmente sale de la cuenta: lo retenido se deposita al fisco.
  const neto = total - retencionesTotal;
  const excede = egresos.some((e) => (montos[e.id] ?? 0) > e.saldo + 0.005);

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      await registrarPagoEgresos({
        idempotencyKey,
        metodoPagoId,
        cuentaOrigenId: esEndoso ? undefined : cuentaUsadaId,
        fecha,
        referencia: referencia.trim() || undefined,
        imputaciones: egresos
          .filter((e) => (montos[e.id] ?? 0) > 0)
          .map((e) => ({ egresoId: e.id, monto: montos[e.id] })),
        retenciones: retenciones
          .filter((r) => r.monto > 0)
          .map((r) => ({
            regimen: r.regimen,
            jurisdiccion: r.jurisdiccion.trim() || undefined,
            base: r.base,
            alicuota: r.alicuota,
            monto: r.monto,
            nroComprobante: r.nroComprobante.trim() || undefined,
          })),
        // Uno u otro, nunca los dos: el backend lo rechaza si van juntos.
        cheque:
          esCheque && chequeModo === "propio"
            ? {
                numero: chequeNumero.trim(),
                banco: chequeBanco.trim(),
                formato: chequeFormato,
                modalidad: chequeModalidad,
                identificadorBancario:
                  chequeFormato === "echeq"
                    ? chequeIdentificadorBancario.trim() || undefined
                    : undefined,
                fechaPago:
                  chequeModalidad === "diferido"
                    ? chequeFechaPago || undefined
                    : undefined,
              }
            : undefined,
        valorId:
          esCheque && chequeModo === "endoso"
            ? valorId || undefined
            : undefined,
      });
      onListo();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo registrar el pago.",
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <EgresoDialog title="Registrar pago" description="Definí cuánto pagar, el medio y las retenciones que correspondan." onCerrar={pedirCierre} bloqueado={guardando}>
        <div className="mod-body">
          <div className="egr-pago-lista">
            {egresos.map((e) => (
              <div className="egr-pago-fila" key={e.id}>
                <div>
                  <b>{e.descripcion}</b>
                  <span className="egr-sub mono">
                    {e.numero} · debe {fmt(e.saldo)}
                  </span>
                </div>
                <CampoMonto
                  valor={montos[e.id] ?? 0}
                  onCambio={(v) =>
                    setMontos((prev) => ({ ...prev, [e.id]: v }))
                  }
                  ariaLabel={`Monto a pagar de ${e.numero}`}
                />
              </div>
            ))}
          </div>

          <div className="egr-grid">
            <label className="egr-f">
              <span>Método de pago</span>
              <SelectBuscable
                ariaLabel="Método de pago" value={metodoPagoId}
                onChange={setMetodoPagoId}
                opciones={opcionesMetodo}
                placeholderBusqueda="Buscar método…"
              />
            </label>
            {!esEndoso ? (
              <label className="egr-f">
                <span>Sale de</span>
                <SelectBuscable
                  ariaLabel="Cuenta de fondos" value={cuentaUsadaId}
                  onChange={setCuentaId}
                  opciones={opcionesCuenta}
                  placeholderBusqueda="Buscar cuenta…"
                />
                {esCheque &&
                chequeModo === "propio" &&
                cuentasCompatibles.length === 0 ? (
                  <span className="egr-error">
                    Creá una cuenta bancaria antes de emitir un cheque propio.
                  </span>
                ) : null}
              </label>
            ) : null}
            <label className="egr-f">
              <span>Fecha</span>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </label>
            <label className="egr-f">
              <span>Referencia</span>
              <input
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                placeholder="N° de transferencia"
              />
            </label>
          </div>

          {esCheque ? (
            <div className="egr-sub-bloque">
              <div className="egr-panel-t">Cheque</div>
              {/* Emitir uno propio o endosar uno que entró por un cobro: en un
                  taller las dos cosas pasan, y con el cheque del cliente la
                  plata nunca pasa por el banco. */}
              <div className="usr-niveles" style={{ marginBottom: 12 }}>
                <EgresoButton
                  type="button"
                  className={`usr-nivel${chequeModo === "propio" ? " on" : ""}`}
                  aria-pressed={chequeModo === "propio"}
                  onClick={() => setChequeModo("propio")}
                >
                  Emito uno propio
                </EgresoButton>
                <EgresoButton
                  type="button"
                  className={`usr-nivel${chequeModo === "endoso" ? " on" : ""}`}
                  aria-pressed={chequeModo === "endoso"}
                  onClick={() => setChequeModo("endoso")}
                >
                  Endoso uno de la cartera
                </EgresoButton>
              </div>
            </div>
          ) : null}

          {esCheque && chequeModo === "endoso" ? (
            <div className="egr-sub-bloque">
              <div className="egr-panel-t">Cheque a endosar</div>
              {valores === null ? (
                <div className="egr-nota-inline">Buscando la cartera…</div>
              ) : valores.length === 0 ? (
                <div className="egr-nota-inline">
                  No hay cheques de terceros en cartera. Entran cuando un
                  cliente paga con cheque.
                </div>
              ) : (
                <>
                  <label className="egr-f">
                    <span>Cheque</span>
                    <SelectBuscable
                      ariaLabel="Cheque a endosar" value={valorId}
                      onChange={setValorId}
                      opciones={opcionesValores}
                      placeholder="Elegir cheque"
                      placeholderBusqueda="Buscar por número, banco o cliente…"
                      vacio="Ningún cheque coincide."
                    />
                  </label>
                  <div className="egr-nota-inline">
                    {!valorElegido ? (
                      "Sale de la cartera y pasa al proveedor. No toca ninguna cuenta: esta plata nunca entró al banco."
                    ) : valorElegido.importe > totalSaldos ? (
                      /* No se puede pagar de más: no hay vuelto. */
                      <>
                        El cheque es de {fmt(valorElegido.importe)} y lo
                        seleccionado suma {fmt(totalSaldos)}. Elegí más facturas
                        o usá un cheque más chico.
                      </>
                    ) : valorElegido.importe !== neto ? (
                      /*
                        El caso más común: el cheque cubre PARTE. No es un
                        cheque partido, es un pago parcial — el resto se paga
                        después por otro medio.
                      */
                      <>
                        El cheque cubre {fmt(valorElegido.importe)} de los{" "}
                        {fmt(neto)} seleccionados.{" "}
                        <EgresoButton
                          type="button"
                          className="egr-link"
                          onClick={ajustarAlCheque}
                        >
                          Pagar sólo lo del cheque
                        </EgresoButton>{" "}
                        y el resto queda pendiente para otro pago.
                      </>
                    ) : (
                      "Sale de la cartera y pasa al proveedor. No toca ninguna cuenta: esta plata nunca entró al banco."
                    )}
                  </div>
                </>
              )}
            </div>
          ) : null}

          {esCheque && chequeModo === "propio" ? (
            <div className="egr-sub-bloque">
              <div className="egr-panel-t">Datos del cheque propio</div>
              <div className="egr-grid">
                <label className="egr-f">
                  <span>Número</span>
                  <input
                    value={chequeNumero}
                    onChange={(e) => setChequeNumero(e.target.value)}
                    placeholder="00012345"
                  />
                </label>
                <label className="egr-f">
                  <span>Banco</span>
                  <input
                    value={chequeBanco}
                    onChange={(e) => setChequeBanco(e.target.value)}
                    placeholder="Galicia"
                  />
                </label>
                <label className="egr-f">
                  <span>Formato</span>
                  <SelectBuscable
                    ariaLabel="Formato de cheque" value={chequeFormato}
                    onChange={setChequeFormato}
                    opciones={OPCIONES_CHEQUE}
                  />
                </label>
                <label className="egr-f">
                  <span>Modalidad</span>
                  <SelectBuscable
                    ariaLabel="Modalidad de cheque" value={chequeModalidad}
                    onChange={(valor) => {
                      setChequeModalidad(valor as "comun" | "diferido");
                      if (valor === "comun") setChequeFechaPago("");
                    }}
                    opciones={[
                      { value: "comun", label: "Común" },
                      { value: "diferido", label: "Diferido" },
                    ]}
                  />
                </label>
                {chequeFormato === "echeq" ? (
                  <label className="egr-f">
                    <span>ID bancario (opcional)</span>
                    <input
                      value={chequeIdentificadorBancario}
                      onChange={(e) =>
                        setChequeIdentificadorBancario(e.target.value)
                      }
                      placeholder="Identificador informado por el banco"
                    />
                  </label>
                ) : null}
                {chequeModalidad === "diferido" ? (
                  <label className="egr-f">
                    <span>Fecha de pago</span>
                    <input
                      type="date"
                      value={chequeFechaPago}
                      onChange={(e) => setChequeFechaPago(e.target.value)}
                    />
                  </label>
                ) : null}
              </div>
              <div className="egr-nota-inline">
                La factura queda saldada, pero la plata no sale de la cuenta
                hasta que el banco lo debite.
              </div>
            </div>
          ) : null}

          <div className="egr-sub-bloque">
            <div className="egr-panel-t">
              Retenciones practicadas
              <EgresoButton
                type="button"
                className="egr-link egr-mini"
                onClick={() =>
                  setRetenciones((prev) => [
                    ...prev,
                    {
                      regimen: "SICORE_GANANCIAS",
                      jurisdiccion: "",
                      base: total,
                      alicuota: 0,
                      monto: 0,
                      nroComprobante: "",
                    },
                  ])
                }
              >
                + Agregar
              </EgresoButton>
            </div>
            {retenciones.length === 0 ? (
              <div className="egr-sub">
                Sin retenciones: sale el total del pago.
              </div>
            ) : (
              retenciones.map((r, i) => (
                <div className="egr-ret-fila egr-ret-detalle" key={i}>
                  <label className="egr-f">
                    <span>Régimen</span>
                    <SelectBuscable
                      value={r.regimen}
                      onChange={(v) =>
                        setRetenciones((prev) =>
                          prev.map((x, j) =>
                            j === i ? { ...x, regimen: v } : x,
                          ),
                        )
                      }
                      opciones={OPCIONES_RETENCION}
                      ariaLabel="Régimen de retención"
                    />
                  </label>
                  <label className="egr-f">
                    <span>Jurisdicción</span>
                    <input
                      value={r.jurisdiccion}
                      onChange={(event) =>
                        setRetenciones((prev) =>
                          prev.map((x, j) =>
                            j === i
                              ? { ...x, jurisdiccion: event.target.value }
                              : x,
                          ),
                        )
                      }
                      placeholder="Ej. CABA"
                    />
                  </label>
                  <label className="egr-f">
                    <span>Base imponible</span>
                    <CampoMonto
                      valor={r.base}
                      onCambio={(v) =>
                        setRetenciones((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, base: v } : x)),
                        )
                      }
                      ariaLabel="Base imponible de la retención"
                    />
                  </label>
                  <label className="egr-f">
                    <span>Alícuota (%)</span>
                    <input
                      type="number"
                      min={0}
                      step="0.001"
                      value={r.alicuota || ""}
                      onChange={(event) =>
                        setRetenciones((prev) =>
                          prev.map((x, j) =>
                            j === i
                              ? {
                                  ...x,
                                  alicuota: Math.max(
                                    0,
                                    Number(event.target.value) || 0,
                                  ),
                                }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="egr-f">
                    <span>Monto retenido</span>
                    <CampoMonto
                      valor={r.monto}
                      onCambio={(v) =>
                        setRetenciones((prev) =>
                          prev.map((x, j) =>
                            j === i ? { ...x, monto: v } : x,
                          ),
                        )
                      }
                      ariaLabel="Monto retenido"
                    />
                  </label>
                  <label className="egr-f">
                    <span>Certificado / referencia</span>
                    <input
                      value={r.nroComprobante}
                      onChange={(event) =>
                        setRetenciones((prev) =>
                          prev.map((x, j) =>
                            j === i
                              ? { ...x, nroComprobante: event.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <EgresoButton
                    type="button"
                    className="egr-link egr-ret-quitar"
                    onClick={() =>
                      setRetenciones((prev) => prev.filter((_, j) => j !== i))
                    }
                  >
                    Quitar
                  </EgresoButton>
                </div>
              ))
            )}
          </div>

          <div className="egr-total mod-destacado">
            <span>
              {esEndoso
                ? "Cheque endosado"
                : retencionesTotal > 0
                  ? "Sale de la cuenta"
                  : "Total del pago"}
            </span>
            <strong className="mono">{fmt(neto)}</strong>
          </div>
          {retencionesTotal > 0 ? (
            <div className="egr-nota-inline">
              Se saldan {fmt(total)} de deuda; {fmt(retencionesTotal)} quedan
              retenidos para depositar al fisco.
            </div>
          ) : null}

          {retencionesInvalidas ? (
            <div className="egr-error mod-suelto">
              Completá base, alícuota y monto de cada retención. Ingresos Brutos
              también necesita jurisdicción.
            </div>
          ) : null}

          {excede ? (
            <div className="egr-error mod-suelto">
              Estás imputando más de lo que se debe en alguno de los egresos.
            </div>
          ) : null}
          {error ? <div className="egr-error mod-suelto">{error}</div> : null}
        </div>
        <div className="mod-foot">
          <EgresoButton type="button" className="btn" onClick={pedirCierre}>
            Cancelar
          </EgresoButton>
          <EgresoButton
            type="button"
            className="btn btn-primary"
            disabled={
              guardando ||
              total <= 0 ||
              excede ||
              retencionesInvalidas ||
              retencionesTotal > total ||
              (!esEndoso && !cuentaUsadaId) ||
              (esCheque &&
                chequeModo === "propio" &&
                (!chequeNumero.trim() ||
                  !chequeBanco.trim() ||
                  (chequeModalidad === "diferido" && !chequeFechaPago))) ||
              // Endosar exige un cheque elegido Y que su importe sea el del
              // pago: un cheque no se parte, y el backend lo rechaza igual.
              (esCheque &&
                chequeModo === "endoso" &&
                (!valorId || valorElegido?.importe !== neto))
            }
            onClick={() => void guardar()}
          >
            {guardando
              ? "Registrando…"
              : esCheque && chequeModo === "endoso"
                ? `Endosar cheque por ${fmt(neto)}`
                : esCheque
                  ? `Emitir cheque por ${fmt(neto)}`
                  : `Pagar ${fmt(neto)}`}
          </EgresoButton>
        </div>
      </EgresoDialog>

      <ConfirmacionSalida
        open={confirmandoSalida}
        cambios={1}
        donde="este pago"
        guardando={guardando}
        onGuardarYSalir={async () => {
          setConfirmandoSalida(false);
          await guardar();
        }}
        onDescartarYSalir={() => {
          setConfirmandoSalida(false);
          onCerrar();
        }}
        onSeguirEditando={() => setConfirmandoSalida(false)}
      />
    </>
  );
}

/** Ficha del egreso con sus pagos y la acción de anular. */
function DetalleEgreso({
  egreso,
  categorias,
  puedeGestionar,
  puedeAnular,
  onCerrar,
  onAnular,
  onCambio,
}: {
  egreso: Egreso;
  categorias: CategoriaEgreso[];
  puedeGestionar: boolean;
  puedeAnular: boolean;
  onCerrar: () => void;
  onAnular: () => void;
  onCambio: () => void;
}) {
  useCerrarConEscape(onCerrar);
  const conPdf = useCapacidad("documentos_pdf");
  const brand = useEgresosBrand();
  const { moneda } = useConfigRegional();
  const fmt = (v: number) => formatearMoneda(v, moneda);
  const [pagos, setPagos] = React.useState<PagoDeEgreso[] | null>(null);
  const [archivos, setArchivos] = React.useState<Archivo[]>([]);
  const [anulandoPago, setAnulandoPago] = React.useState<PagoDeEgreso | null>(
    null,
  );
  const [editando, setEditando] = React.useState(false);
  const [descripcion, setDescripcion] = React.useState(egreso.descripcion);
  const [categoriaId, setCategoriaId] = React.useState(
    egreso.categoriaEgresoId,
  );
  const [competencia, setCompetencia] = React.useState(
    egreso.fechaCompetencia.slice(0, 10),
  );
  const [vencimiento, setVencimiento] = React.useState(
    egreso.fechaVencimiento?.slice(0, 10) ?? "",
  );
  const [neto, setNeto] = React.useState(egreso.neto);
  const [iva, setIva] = React.useState(egreso.iva);
  const [otrosImpuestos, setOtrosImpuestos] = React.useState(
    egreso.otrosImpuestos,
  );
  const [notas, setNotas] = React.useState(egreso.notas ?? "");
  const [guardandoEdicion, setGuardandoEdicion] = React.useState(false);
  const [errorEdicion, setErrorEdicion] = React.useState<string | null>(null);

  const guardarEdicion = async () => {
    setGuardandoEdicion(true);
    setErrorEdicion(null);
    try {
      await editarEgreso(egreso.id, {
        descripcion: descripcion.trim(),
        categoriaEgresoId: categoriaId,
        fechaCompetencia: competencia,
        ...(vencimiento ? { fechaVencimiento: vencimiento } : {}),
        ...(egreso.pagadoTotal <= 0 ? { neto, iva, otrosImpuestos } : {}),
        notas: notas.trim(),
      });
      toast.success("Egreso actualizado.");
      setEditando(false);
      onCambio();
    } catch (error) {
      setErrorEdicion(
        error instanceof Error ? error.message : "No se pudo actualizar.",
      );
    } finally {
      setGuardandoEdicion(false);
    }
  };

  const cargar = React.useCallback(() => {
    getPagosDeEgreso(egreso.id)
      .then((r) => setPagos(r.pagos))
      .catch(() => setPagos([]));
    listarArchivos("EGRESO", egreso.id)
      .then(setArchivos)
      .catch(() => setArchivos([]));
  }, [egreso.id]);

  React.useEffect(() => cargar(), [cargar]);

  return (
    <>
      <EgresoDialog compact legacySubtitle={egreso.numero} title={egreso.descripcion} description={`${egreso.numero} · ${egreso.beneficiarioNombre}`} onCerrar={onCerrar} bloqueado={guardandoEdicion}>
        {brand && (
          <div className={pagarStyles.detailSummary}>
            <div><span>Total</span><strong>{fmt(egreso.total)}</strong></div>
            <div><span>Pagado</span><strong>{fmt(egreso.pagadoTotal)}</strong></div>
            <div>
              <span>{egreso.estado === "anulado" ? "Estado" : "Pendiente"}</span>
              <strong>{egreso.estado === "anulado" ? "Anulado" : fmt(egreso.saldo)}</strong>
            </div>
          </div>
        )}
        <div className="mod-body">
          {editando && puedeGestionar ? (
            <div className="egr-grid">
              <label className="egr-f egr-f-wide">
                <span>Descripción</span>
                <input
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                />
              </label>
              <label className="egr-f">
                <span>Categoría</span>
                <SelectBuscable
                  ariaLabel="Categoría" value={categoriaId}
                  onChange={setCategoriaId}
                  opciones={opcionesDeCategorias(categorias)}
                />
              </label>
              <label className="egr-f">
                <span>Competencia</span>
                <input
                  type="date"
                  value={competencia}
                  onChange={(e) => setCompetencia(e.target.value)}
                />
              </label>
              {egreso.fechaVencimiento ? (
                <label className="egr-f">
                  <span>Vencimiento</span>
                  <input
                    type="date"
                    value={vencimiento}
                    onChange={(e) => setVencimiento(e.target.value)}
                  />
                </label>
              ) : null}
              {egreso.pagadoTotal <= 0 ? (
                <div className="egr-sub egr-sub-3">
                  <label className="egr-f">
                    <span>Neto / importe</span>
                    <CampoMonto
                      valor={neto}
                      onCambio={setNeto}
                      ariaLabel="Neto o importe"
                    />
                  </label>
                  <label className="egr-f">
                    <span>IVA</span>
                    <CampoMonto valor={iva} onCambio={setIva} ariaLabel="IVA" />
                  </label>
                  <label className="egr-f">
                    <span>Otros impuestos</span>
                    <CampoMonto
                      valor={otrosImpuestos}
                      onCambio={setOtrosImpuestos}
                      ariaLabel="Otros impuestos"
                    />
                  </label>
                </div>
              ) : (
                <Alert className="egr-f-wide">
                  <AlertTitle>Importes bloqueados</AlertTitle>
                  <AlertDescription>
                    Como ya tiene pagos, primero hay que anularlos para cambiar
                    los importes. La clasificación y las fechas sí se pueden
                    corregir.
                  </AlertDescription>
                </Alert>
              )}
              <label className="egr-f egr-f-wide">
                <span>Notas</span>
                <textarea
                  rows={3}
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                />
              </label>
              {errorEdicion ? (
                <div className="egr-error egr-f-wide">{errorEdicion}</div>
              ) : null}
            </div>
          ) : (
            <dl className="egr-dl">
              <dt>Beneficiario</dt>
              <dd>{egreso.beneficiarioNombre}</dd>
              <dt>Categoría</dt>
              <dd>
                {egreso.categoriaNombre}
                {egreso.naturaleza ? (
                  <small> · {NATURALEZA_LABELS[egreso.naturaleza]}</small>
                ) : null}
              </dd>
              <dt>Competencia</dt>
              <dd>{fechaConDia(egreso.fechaCompetencia)}</dd>
              <dt>Vencimiento</dt>
              <dd>
                {egreso.fechaVencimiento
                  ? fechaConDia(egreso.fechaVencimiento)
                  : "fue de contado"}
              </dd>
              {egreso.numeroComprobante ? (
                <>
                  <dt>Comprobante</dt>
                  <dd className="mono">
                    {egreso.tipoComprobante} {egreso.puntoVenta}-
                    {egreso.numeroComprobante}
                  </dd>
                </>
              ) : null}
              <dt>Neto</dt>
              <dd className="mono">{fmt(egreso.neto)}</dd>
              <dt>IVA</dt>
              <dd className="mono">{fmt(egreso.iva)}</dd>
              {egreso.otrosImpuestos > 0 ? (
                <>
                  <dt>Otros impuestos</dt>
                  <dd className="mono">{fmt(egreso.otrosImpuestos)}</dd>
                </>
              ) : null}
              {!brand && <>
                <dt>Total</dt>
                <dd className="mono"><strong>{fmt(egreso.total)}</strong></dd>
                <dt>Pagado</dt>
                <dd className="mono">{fmt(egreso.pagadoTotal)}</dd>
              </>}
              {egreso.registradoPorNombre ? (
                <>
                  <dt>Cargado por</dt>
                  <dd>{egreso.registradoPorNombre}</dd>
                </>
              ) : null}
              {egreso.notas ? (
                <>
                  <dt>Notas</dt>
                  <dd>{egreso.notas}</dd>
                </>
              ) : null}
              {egreso.motivoAnulacion ? (
                <>
                  <dt>Anulado</dt>
                  <dd>{egreso.motivoAnulacion}</dd>
                </>
              ) : null}
            </dl>
          )}

          <div className="egr-pagos">
            <div className="egr-pagos-t">Factura escaneada</div>
            <ArchivoUploader
              scope="EGRESO"
              entidadId={egreso.id}
              archivos={archivos}
              onCambio={setArchivos}
              soloLectura={!puedeGestionar || egreso.estado === "anulado"}
              titulo="Arrastrá la factura del proveedor"
              vacio="Sin la factura adjunta."
            />
          </div>

          <div className="egr-pagos">
            <div className="egr-pagos-t">Pagos</div>
            {pagos === null ? (
              <div className="egr-sub">Cargando…</div>
            ) : pagos.length === 0 ? (
              <div className="egr-sub">Sin pagos registrados.</div>
            ) : (
              pagos.map((p) => (
                <div
                  className={`egr-pago-item ${p.anuladoEl ? "anulado" : ""}`}
                  key={p.id}
                >
                  <div>
                    <b className="mono">{p.numero}</b>
                    <span className="egr-sub">
                      {p.fecha.slice(0, 10)} · {p.metodoNombre} ·{" "}
                      {p.cuentaNombre}
                      {p.referencia ? ` · ${p.referencia}` : ""}
                      {p.anuladoEl ? ` · anulado: ${p.motivoAnulacion}` : ""}
                    </span>
                  </div>
                  <span className="mono">{fmt(p.monto)}</span>
                  {!p.anuladoEl && conPdf ? (
                    <a
                      className="egr-link"
                      href={`/api/backend/egresos/pagos/${p.id}/orden-pago.pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Orden de pago
                    </a>
                  ) : null}
                  {!p.anuladoEl && puedeAnular ? (
                    <EgresoButton
                      type="button"
                      className="egr-link"
                      onClick={() => setAnulandoPago(p)}
                    >
                      Anular
                    </EgresoButton>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
        <div className="mod-foot">
          {puedeGestionar && egreso.estado !== "anulado" ? (
            editando && puedeGestionar ? (
              <>
                <EgresoButton
                  type="button"
                  className="btn"
                  onClick={() => setEditando(false)}
                  disabled={guardandoEdicion}
                >
                  Cancelar edición
                </EgresoButton>
                <EgresoButton
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void guardarEdicion()}
                  disabled={
                    guardandoEdicion ||
                    descripcion.trim().length < 2 ||
                    !categoriaId ||
                    !competencia ||
                    neto + iva + otrosImpuestos <= 0
                  }
                >
                  {guardandoEdicion ? "Guardando…" : "Guardar cambios"}
                </EgresoButton>
              </>
            ) : (
              <EgresoButton
                type="button"
                className="btn"
                onClick={() => setEditando(true)}
              >
                Editar
              </EgresoButton>
            )
          ) : null}
          {puedeAnular && egreso.estado !== "anulado" ? (
            <EgresoButton type="button" className="btn btn-danger" onClick={onAnular}>
              Anular egreso
            </EgresoButton>
          ) : null}
          <EgresoButton type="button" className="btn" onClick={onCerrar}>
            Cerrar
          </EgresoButton>
        </div>
      </EgresoDialog>

      <ConfirmacionDestructiva
        apariencia={brand ? "heroui" : undefined}
        open={anulandoPago !== null && puedeAnular}
        onOpenChange={(v) => {
          if (!v) setAnulandoPago(null);
        }}
        titulo={`Anular el pago ${anulandoPago?.numero ?? ""}`}
        descripcion="El egreso vuelve a deber y la plata vuelve a la cuenta con un contramovimiento. El pago queda en el historial: se intentó y falló, y eso es información."
        requiereTipear={false}
        motivo={{
          label: "Por qué se anula",
          placeholder: "Rechazó la transferencia, cheque sin fondos…",
        }}
        accionLabel="Anular pago"
        onConfirmar={async (motivo) => {
          if (!anulandoPago || !puedeAnular) return;
          await anularPagoEgreso(anulandoPago.id, motivo);
          setAnulandoPago(null);
          cargar();
          onCambio();
        }}
      />
    </>
  );
}
