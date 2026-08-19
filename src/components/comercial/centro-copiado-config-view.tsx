"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  History,
  Printer,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PreciosEspecialesClientesCard } from "@/components/productos-servicios/tab-precio-completo";
import { ApiError } from "@/lib/api";
import {
  actualizarConfigCentroCopiado,
  cotizarCentroCopiado,
  getConfigCentroCopiado,
  historialCentroCopiado,
  inicializarCentroCopiado,
  repararCentroCopiado,
  saludCentroCopiado,
  type CentroCopiadoConfig,
  type EventoCentroCopiado,
  type SaludCentroCopiado,
} from "@/lib/centro-copiado-api";

const AUTO = "__auto__";
type FirmaArgs = {
  activo: boolean;
  cobraSetup: boolean;
  margen: string;
  margenMin: string;
  politicaPrecio: "MARGEN_FIJO" | "MARGEN_POR_VOLUMEN";
  tramosMargen: { desdeCantidad: number; margenPct: number }[];
  minimoHojas: string;
  setupMin: string;
  cleanupMin: string;
  papeles: Map<string, Set<number>>;
  tamanos: Set<string>;
  terminaciones: Set<string>;
  tiposAnillo: Set<string>;
  maquinaColor: string | null;
  maquinaBn: string | null;
  maquinaAnilladora: string | null;
  tapaFrontal: string | null;
  tapaContratapa: string | null;
};

function firmaFormulario(args: FirmaArgs) {
  return JSON.stringify({
    ...args,
    papeles: [...args.papeles.entries()]
      .map(([id, gs]) => [id, [...gs].sort((a, b) => a - b)])
      .sort(([a], [b]) => String(a).localeCompare(String(b))),
    tamanos: [...args.tamanos].sort(),
    terminaciones: [...args.terminaciones].sort(),
    tiposAnillo: [...args.tiposAnillo].sort(),
    tramosMargen: [...args.tramosMargen].sort(
      (a, b) => a.desdeCantidad - b.desdeCantidad,
    ),
  });
}

function fechaCorta(valor: string | null | undefined) {
  if (!valor) return "Sin cambios registrados";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(valor));
}
function dinero(valor: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(valor);
}

export function CentroCopiadoConfigView() {
  const [cfg, setCfg] = React.useState<CentroCopiadoConfig | null>(null);
  const [salud, setSalud] = React.useState<SaludCentroCopiado | null>(null);
  const [historial, setHistorial] = React.useState<EventoCentroCopiado[]>([]);
  const [activo, setActivo] = React.useState(true);
  const [cobraSetup, setCobraSetup] = React.useState(false);
  const [margen, setMargen] = React.useState("40");
  const [margenMin, setMargenMin] = React.useState("25");
  const [politicaPrecio, setPoliticaPrecio] = React.useState<
    "MARGEN_FIJO" | "MARGEN_POR_VOLUMEN"
  >("MARGEN_FIJO");
  const [tramosMargen, setTramosMargen] = React.useState<
    { desdeCantidad: number; margenPct: number }[]
  >([{ desdeCantidad: 1, margenPct: 40 }]);
  const [minimoHojas, setMinimoHojas] = React.useState("0");
  const [setupMin, setSetupMin] = React.useState("0");
  const [cleanupMin, setCleanupMin] = React.useState("0");
  const [papeles, setPapeles] = React.useState<Map<string, Set<number>>>(
    new Map(),
  );
  const [tamanos, setTamanos] = React.useState<Set<string>>(new Set());
  const [terminaciones, setTerminaciones] = React.useState<Set<string>>(
    new Set(),
  );
  const [tiposAnillo, setTiposAnillo] = React.useState<Set<string>>(new Set());
  const [maquinaColor, setMaquinaColor] = React.useState<string | null>(null);
  const [maquinaBn, setMaquinaBn] = React.useState<string | null>(null);
  const [maquinaAnilladora, setMaquinaAnilladora] = React.useState<
    string | null
  >(null);
  const [tapaFrontal, setTapaFrontal] = React.useState<string | null>(null);
  const [tapaContratapa, setTapaContratapa] = React.useState<string | null>(
    null,
  );
  const [firmaBase, setFirmaBase] = React.useState("");
  const [busquedaPapel, setBusquedaPapel] = React.useState("");
  const [guardando, setGuardando] = React.useState(false);
  const [reparando, setReparando] = React.useState(false);
  const [cotizando, setCotizando] = React.useState(false);
  const [cotizacionPrueba, setCotizacionPrueba] = React.useState<{
    total: number;
    hojas: number;
    descripcion: string;
  } | null>(null);
  const [errorCarga, setErrorCarga] = React.useState<{
    mensaje: string;
    status: number | null;
  } | null>(null);
  const [inicializando, setInicializando] = React.useState(false);

  const cargarFormulario = React.useCallback((config: CentroCopiadoConfig) => {
    const gramajesDe = (id: string) =>
      config.disponibles.papeles.find((p) => p.materiaPrimaId === id)
        ?.gramajes ?? [];
    const seleccionPapeles = new Map<string, Set<number>>();
    if (config.papeles) {
      for (const p of config.papeles)
        seleccionPapeles.set(
          p.materiaPrimaId,
          new Set(
            p.gramajes?.length ? p.gramajes : gramajesDe(p.materiaPrimaId),
          ),
        );
    } else {
      for (const p of config.disponibles.papeles)
        seleccionPapeles.set(p.materiaPrimaId, new Set(p.gramajes));
    }
    const formulario: FirmaArgs = {
      activo: config.activo,
      cobraSetup: config.cobraSetup,
      margen: String(config.margenPct ?? 40),
      margenMin: String(config.margenMinimoPct ?? 25),
      politicaPrecio: config.politicaPrecio ?? "MARGEN_FIJO",
      tramosMargen: config.tramosMargen?.length
        ? config.tramosMargen
        : [{ desdeCantidad: 1, margenPct: config.margenPct ?? 40 }],
      minimoHojas: String(config.minimoHojasFacturables ?? 0),
      setupMin: String(config.setupMin ?? 0),
      cleanupMin: String(config.cleanupMin ?? 0),
      papeles: seleccionPapeles,
      tamanos: new Set(
        config.tamanos ?? config.disponibles.formatos.map((f) => f.nombre),
      ),
      terminaciones: new Set(
        config.terminaciones ?? config.disponibles.terminaciones,
      ),
      tiposAnillo: new Set(
        config.tiposAnillo ??
          config.disponibles.tiposAnillo
            .filter((tipo) => tipo.instalado)
            .map((tipo) => tipo.value),
      ),
      maquinaColor: config.maquinaColorId,
      maquinaBn: config.maquinaBnId,
      maquinaAnilladora: config.maquinaAnilladoraId,
      tapaFrontal: config.tapaFrontalMateriaPrimaId,
      tapaContratapa: config.tapaContratapaMateriaPrimaId,
    };
    setCfg(config);
    setActivo(formulario.activo);
    setCobraSetup(formulario.cobraSetup);
    setMargen(formulario.margen);
    setMargenMin(formulario.margenMin);
    setPoliticaPrecio(formulario.politicaPrecio);
    setTramosMargen(formulario.tramosMargen);
    setMinimoHojas(formulario.minimoHojas);
    setSetupMin(formulario.setupMin);
    setCleanupMin(formulario.cleanupMin);
    setPapeles(formulario.papeles);
    setTamanos(formulario.tamanos);
    setTerminaciones(formulario.terminaciones);
    setTiposAnillo(formulario.tiposAnillo);
    setMaquinaColor(formulario.maquinaColor);
    setMaquinaBn(formulario.maquinaBn);
    setMaquinaAnilladora(formulario.maquinaAnilladora);
    setTapaFrontal(formulario.tapaFrontal);
    setTapaContratapa(formulario.tapaContratapa);
    setFirmaBase(firmaFormulario(formulario));
  }, []);

  const cargarRemoto = React.useCallback(async () => {
    setErrorCarga(null);
    try {
      const [config, diagnostico, eventos] = await Promise.all([
        getConfigCentroCopiado(),
        saludCentroCopiado(),
        historialCentroCopiado(),
      ]);
      cargarFormulario(config);
      setSalud(diagnostico);
      setHistorial(eventos);
    } catch (error) {
      setErrorCarga({
        mensaje:
          error instanceof Error
            ? error.message
            : "No se pudo cargar la configuración.",
        status: error instanceof ApiError ? error.status : null,
      });
    }
  }, [cargarFormulario]);
  React.useEffect(() => {
    void cargarRemoto();
  }, [cargarRemoto]);

  const firmaActual = React.useMemo(
    () =>
      firmaFormulario({
        activo,
        cobraSetup,
        margen,
        margenMin,
        politicaPrecio,
        tramosMargen,
        minimoHojas,
        setupMin,
        cleanupMin,
        papeles,
        tamanos,
        terminaciones,
        tiposAnillo,
        maquinaColor,
        maquinaBn,
        maquinaAnilladora,
        tapaFrontal,
        tapaContratapa,
      }),
    [
      activo,
      cobraSetup,
      margen,
      margenMin,
      politicaPrecio,
      tramosMargen,
      minimoHojas,
      setupMin,
      cleanupMin,
      papeles,
      tamanos,
      terminaciones,
      tiposAnillo,
      maquinaColor,
      maquinaBn,
      maquinaAnilladora,
      tapaFrontal,
      tapaContratapa,
    ],
  );
  const hayCambios = !!cfg && firmaActual !== firmaBase;
  React.useEffect(() => {
    const advertir = (event: BeforeUnloadEvent) => {
      if (hayCambios) event.preventDefault();
    };
    window.addEventListener("beforeunload", advertir);
    return () => window.removeEventListener("beforeunload", advertir);
  }, [hayCambios]);

  const inicializar = async () => {
    setInicializando(true);
    try {
      cargarFormulario(await inicializarCentroCopiado());
      await cargarRemoto();
      toast.success("Centro de Copiado inicializado.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo inicializar el módulo.",
      );
    } finally {
      setInicializando(false);
    }
  };
  const reparar = async () => {
    setReparando(true);
    try {
      setSalud(await repararCentroCopiado());
      await cargarRemoto();
      toast.success("Infraestructura revisada y reparada.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo reparar el módulo.",
      );
    } finally {
      setReparando(false);
    }
  };
  const togglePapel = (id: string, todos: number[]) =>
    setPapeles((prev) => {
      const n = new Map(prev);
      if (n.has(id)) n.delete(id);
      else n.set(id, new Set(todos));
      return n;
    });
  const toggleGramaje = (id: string, g: number) =>
    setPapeles((prev) => {
      const actual = prev.get(id);
      if (!actual) return prev;
      const gs = new Set(actual);
      if (gs.has(g) && gs.size > 1) gs.delete(g);
      else gs.add(g);
      const n = new Map(prev);
      n.set(id, gs);
      return n;
    });
  const toggleSet = (
    valor: string,
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
  ) =>
    setter((prev) => {
      const n = new Set(prev);
      if (n.has(valor)) n.delete(valor);
      else n.add(valor);
      return n;
    });

  const actualizarTramo = (
    index: number,
    campo: "desdeCantidad" | "margenPct",
    valor: number,
  ) =>
    setTramosMargen((prev) =>
      prev.map((tramo, i) =>
        i === index ? { ...tramo, [campo]: Math.max(0, valor) } : tramo,
      ),
    );

  const agregarTramo = () =>
    setTramosMargen((prev) => {
      const ultimo = [...prev].sort(
        (a, b) => a.desdeCantidad - b.desdeCantidad,
      )[prev.length - 1];
      return [
        ...prev,
        {
          desdeCantidad: Math.max(2, (ultimo?.desdeCantidad ?? 1) + 50),
          margenPct: Math.max(
            Number(margenMin) || 0,
            (ultimo?.margenPct ?? (Number(margen) || 40)) - 5,
          ),
        },
      ];
    });

  const guardar = async () => {
    if (!cfg) return;
    if (!papeles.size || !tamanos.size) {
      toast.error("Elegí al menos un papel y un tamaño para ofrecer.");
      return;
    }
    const margenMinimo = Math.max(0, Number(margenMin) || 0);
    const tramosOrdenados = [...tramosMargen].sort(
      (a, b) => a.desdeCantidad - b.desdeCantidad,
    );
    if (
      politicaPrecio === "MARGEN_FIJO" &&
      (Number(margen) || 0) < margenMinimo
    ) {
      toast.error(
        "El margen objetivo no puede quedar por debajo del margen mínimo.",
      );
      return;
    }
    if (
      politicaPrecio === "MARGEN_POR_VOLUMEN" &&
      (tramosOrdenados[0]?.desdeCantidad !== 1 ||
        tramosOrdenados.some(
          (tramo, index) =>
            tramo.margenPct < margenMinimo ||
            (index > 0 &&
              tramo.desdeCantidad <= tramosOrdenados[index - 1].desdeCantidad),
        ))
    ) {
      toast.error(
        "Revisá los tramos: deben comenzar en 1, estar ordenados y respetar el margen mínimo.",
      );
      return;
    }
    if (terminaciones.has("Anillado") && !tiposAnillo.size) {
      toast.error("Habilitá Espiral plástico, Wire-O o ambos.");
      return;
    }
    setGuardando(true);
    try {
      const papelesArr = [...papeles.entries()].map(([materiaPrimaId, gs]) => {
        const disp = cfg.disponibles.papeles.find(
          (p) => p.materiaPrimaId === materiaPrimaId,
        );
        return disp?.gramajes.length === gs.size
          ? { materiaPrimaId }
          : { materiaPrimaId, gramajes: [...gs] };
      });
      const todosPapeles =
        papelesArr.length === cfg.disponibles.papeles.length &&
        papelesArr.every((p) => !("gramajes" in p));
      const actualizada = await actualizarConfigCentroCopiado({
        version: cfg.version,
        activo,
        cobraSetup,
        margenPct: Math.max(0, Number(margen) || 0),
        margenMinimoPct: margenMinimo,
        politicaPrecio,
        tramosMargen: tramosOrdenados,
        minimoHojasFacturables: Math.max(
          0,
          Math.round(Number(minimoHojas) || 0),
        ),
        setupMin: Math.max(0, Number(setupMin) || 0),
        cleanupMin: Math.max(0, Number(cleanupMin) || 0),
        papeles: todosPapeles ? null : papelesArr,
        tamanos:
          tamanos.size === cfg.disponibles.formatos.length
            ? null
            : [...tamanos],
        terminaciones:
          terminaciones.size === cfg.disponibles.terminaciones.length
            ? null
            : [...terminaciones],
        tiposAnillo:
          tiposAnillo.size ===
          cfg.disponibles.tiposAnillo.filter((tipo) => tipo.instalado).length
            ? null
            : [...tiposAnillo],
        maquinaColorId: maquinaColor,
        maquinaBnId: maquinaBn,
        maquinaAnilladoraId: maquinaAnilladora,
        tapaFrontalMateriaPrimaId: tapaFrontal,
        tapaContratapaMateriaPrimaId: tapaContratapa,
      });
      cargarFormulario(actualizada);
      const [diagnostico, eventos] = await Promise.all([
        saludCentroCopiado(),
        historialCentroCopiado(),
      ]);
      setSalud(diagnostico);
      setHistorial(eventos);
      toast.success("Configuración guardada.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo guardar.",
      );
    } finally {
      setGuardando(false);
    }
  };

  const probarCotizacion = async () => {
    if (!cfg) return;
    const papel = cfg.disponibles.papeles.find((p) =>
      papeles.has(p.materiaPrimaId),
    );
    const nombres =
      papel?.formatosProducibles.filter((f) => tamanos.has(f)) ?? [];
    const formato = cfg.disponibles.formatos.find(
      (f) => f.nombre === (nombres.includes("A4") ? "A4" : nombres[0]),
    );
    const gramaje = papel
      ? [...(papeles.get(papel.materiaPrimaId) ?? [])][0]
      : null;
    if (!papel || !formato) {
      toast.error(
        "No hay una combinación papel–formato producible para probar.",
      );
      return;
    }
    setCotizando(true);
    try {
      const r = await cotizarCentroCopiado({
        documentos: [
          {
            id: "prueba-configuracion",
            nombre: "Prueba de 100 páginas",
            paginas: 100,
            copias: 1,
            tamano: formato.nombre,
            tamanoAnchoMm: formato.anchoMm,
            tamanoAltoMm: formato.altoMm,
            papelMateriaPrimaId: papel.materiaPrimaId,
            gramaje,
            color: "BN",
            faz: 2,
            cobertura: "normal",
          },
        ],
      });
      if (r.totales.total <= 0) {
        setCotizacionPrueba(null);
        toast.error(
          "La prueba dio $0. Revisá el costo de la variante de papel y la tarifa de la máquina.",
        );
        return;
      }
      setCotizacionPrueba({
        total: r.totales.total,
        hojas: r.totales.hojasFisicas,
        descripcion: `${papel.nombre}${gramaje ? ` ${gramaje} g` : ""} · ${formato.nombre} · B/N doble faz`,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo realizar la prueba.",
      );
    } finally {
      setCotizando(false);
    }
  };

  if (!cfg) {
    const porPlan = errorCarga?.status === 403;
    const requiereInicio = errorCarga?.status === 409;
    return (
      <div className="flex min-h-72 items-center justify-center p-6">
        {errorCarga ? (
          <Alert className="max-w-xl">
            <AlertTitle>
              {porPlan
                ? "Centro de Copiado no incluido"
                : requiereInicio
                  ? "El Centro de Copiado necesita configuración"
                  : "No se pudo cargar el Centro de Copiado"}
            </AlertTitle>
            <AlertDescription>{errorCarga.mensaje}</AlertDescription>
            {!porPlan ? (
              <AlertAction>
                <Button
                  size="sm"
                  loading={inicializando}
                  loadingText="Inicializando…"
                  onClick={() =>
                    void (requiereInicio ? inicializar() : cargarRemoto())
                  }
                >
                  {requiereInicio ? "Inicializar módulo" : "Reintentar"}
                </Button>
              </AlertAction>
            ) : null}
          </Alert>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="size-4 animate-spin" /> Cargando
            configuración…
          </div>
        )}
      </div>
    );
  }

  const papelesFiltrados = cfg.disponibles.papeles.filter((p) =>
    p.nombre
      .toLocaleLowerCase()
      .includes(busquedaPapel.trim().toLocaleLowerCase()),
  );
  const estadoBadge =
    salud?.estado === "ERROR"
      ? "destructive"
      : salud?.estado === "OPERATIVO"
        ? "default"
        : "secondary";
  return (
    <div className="mx-auto flex min-h-0 min-w-0 max-w-6xl flex-1 flex-col gap-5 overflow-y-auto px-4 pb-24 pt-5 sm:px-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-2">
            <Printer className="size-5" />
            <h1 className="text-xl font-semibold tracking-tight">
              Centro de copiado
            </h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Configurá la oferta express sin salir del motor universal de costos,
            materiales y producción.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={activo ? "default" : "outline"}>
            {activo ? "Activo" : "Pausado"}
          </Badge>
          <span className="text-xs text-muted-foreground">
            v{cfg.version} · {fechaCorta(cfg.actualizadoEl)}
          </span>
        </div>
      </div>

      <Card className="shrink-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {salud?.estado === "OPERATIVO" ? (
              <CheckCircle2 className="size-4 text-emerald-600" />
            ) : salud?.estado === "ERROR" ? (
              <AlertCircle className="size-4 text-destructive" />
            ) : (
              <TriangleAlert className="size-4 text-amber-600" />
            )}
            Estado operativo
          </CardTitle>
          <CardDescription>
            Verifica plantilla, ruta, máquinas, materiales y terminaciones sin
            modificar datos.
          </CardDescription>
          <CardAction>
            <Badge variant={estadoBadge}>{salud?.estado ?? "Cargando"}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {salud
            ? [
                ["Impresoras", salud.resumen.impresoras],
                ["Papeles", salud.resumen.papeles],
                [
                  "Con costo",
                  `${salud.resumen.variantesCosteadas}/${salud.resumen.variantesPapel}`,
                ],
                ["Anilladoras", salud.resumen.anilladoras],
                ["Anillos", salud.resumen.tiposAnillo],
                ["Tapas", salud.resumen.tapas],
              ].map(([e, v]) => (
                <div key={String(e)} className="rounded-lg border p-3">
                  <div className="text-lg font-semibold">{v}</div>
                  <div className="text-xs text-muted-foreground">{e}</div>
                </div>
              ))
            : null}
        </CardContent>
        {salud?.chequeos.some((c) => c.nivel !== "OK") ? (
          <CardFooter className="flex flex-wrap justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              {salud.chequeos.find((c) => c.nivel !== "OK")?.detalle}
            </div>
            <div className="flex flex-wrap gap-2">
              {salud.chequeos.some(
                (chequeo) =>
                  chequeo.codigo === "costos_papel" && chequeo.nivel !== "OK",
              ) ? (
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<Link href="/inventario/materias-primas/costos" />}
                >
                  Abrir costos de materiales
                </Button>
              ) : null}
              {salud.puedeReparar ? (
                <Button
                  variant="outline"
                  loading={reparando}
                  loadingText="Reparando…"
                  onClick={() => void reparar()}
                >
                  <Wrench /> Reparar infraestructura
                </Button>
              ) : null}
            </div>
          </CardFooter>
        ) : null}
      </Card>

      <Tabs defaultValue="general" className="shrink-0">
        <TabsList variant="line" className="max-w-full overflow-x-auto">
          <TabsTrigger value="general">
            <Settings2 /> General
          </TabsTrigger>
          <TabsTrigger value="produccion">
            <Printer /> Ruta y terminaciones
          </TabsTrigger>
          <TabsTrigger value="oferta">Oferta</TabsTrigger>
          <TabsTrigger value="historial">
            <History /> Historial
          </TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="grid gap-4 pt-3 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Disponibilidad</CardTitle>
              <CardDescription>
                Controla si la carga rápida aparece en las órdenes de trabajo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldTitle>Módulo activo</FieldTitle>
                    <FieldDescription>
                      Al pausarlo se conserva toda la configuración.
                    </FieldDescription>
                  </FieldContent>
                  <Switch
                    checked={activo}
                    onCheckedChange={setActivo}
                    aria-label="Módulo activo"
                  />
                </Field>
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldTitle>Cobrar preparación y limpieza</FieldTitle>
                    <FieldDescription>
                      Útil si las cargas pequeñas deben absorber esos tiempos.
                    </FieldDescription>
                  </FieldContent>
                  <Switch
                    checked={cobraSetup}
                    onCheckedChange={setCobraSetup}
                    aria-label="Cobrar preparación y limpieza"
                  />
                </Field>
                {cobraSetup ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="cc-setup">
                        Preparación (min)
                      </FieldLabel>
                      <Input
                        id="cc-setup"
                        type="number"
                        min={0}
                        step={0.5}
                        value={setupMin}
                        onChange={(e) => setSetupMin(e.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="cc-cleanup">
                        Limpieza (min)
                      </FieldLabel>
                      <Input
                        id="cc-cleanup"
                        type="number"
                        min={0}
                        step={0.5}
                        value={cleanupMin}
                        onChange={(e) => setCleanupMin(e.target.value)}
                      />
                    </Field>
                  </div>
                ) : null}
              </FieldGroup>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Política comercial</CardTitle>
              <CardDescription>
                Define cómo transforma el motor universal el costo real en
                precio de venta.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>Forma de calcular el margen</FieldLabel>
                  <Select
                    value={politicaPrecio}
                    onValueChange={(value) =>
                      setPoliticaPrecio(
                        value as "MARGEN_FIJO" | "MARGEN_POR_VOLUMEN",
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {politicaPrecio === "MARGEN_FIJO"
                          ? "Margen único"
                          : "Margen por volumen"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="MARGEN_FIJO">
                          Margen único
                        </SelectItem>
                        <SelectItem value="MARGEN_POR_VOLUMEN">
                          Margen por volumen
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Por volumen permite reducir el margen a medida que aumenta
                    la cantidad de hojas.
                  </FieldDescription>
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="cc-margen">
                      Margen objetivo (%)
                    </FieldLabel>
                    <Input
                      id="cc-margen"
                      type="number"
                      min={0}
                      value={margen}
                      onChange={(e) => setMargen(e.target.value)}
                      disabled={politicaPrecio === "MARGEN_POR_VOLUMEN"}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="cc-margen-min">
                      Margen mínimo (%)
                    </FieldLabel>
                    <Input
                      id="cc-margen-min"
                      type="number"
                      min={0}
                      value={margenMin}
                      onChange={(e) => setMargenMin(e.target.value)}
                    />
                  </Field>
                </div>
                {politicaPrecio === "MARGEN_POR_VOLUMEN" ? (
                  <Field>
                    <FieldLabel>Tramos por hojas</FieldLabel>
                    <div className="flex flex-col gap-2">
                      {tramosMargen.map((tramo, index) => (
                        <div
                          key={`${index}-${tramo.desdeCantidad}`}
                          className="grid grid-cols-[1fr_1fr_auto] items-end gap-2"
                        >
                          <Field>
                            <FieldLabel htmlFor={`cc-tramo-desde-${index}`}>
                              Desde
                            </FieldLabel>
                            <Input
                              id={`cc-tramo-desde-${index}`}
                              type="number"
                              min={1}
                              step={1}
                              value={tramo.desdeCantidad}
                              disabled={index === 0}
                              onChange={(event) =>
                                actualizarTramo(
                                  index,
                                  "desdeCantidad",
                                  Number(event.target.value),
                                )
                              }
                            />
                          </Field>
                          <Field>
                            <FieldLabel htmlFor={`cc-tramo-margen-${index}`}>
                              Margen (%)
                            </FieldLabel>
                            <Input
                              id={`cc-tramo-margen-${index}`}
                              type="number"
                              min={0}
                              max={99}
                              value={tramo.margenPct}
                              onChange={(event) =>
                                actualizarTramo(
                                  index,
                                  "margenPct",
                                  Number(event.target.value),
                                )
                              }
                            />
                          </Field>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            disabled={index === 0 || tramosMargen.length === 1}
                            aria-label={`Eliminar tramo desde ${tramo.desdeCantidad} hojas`}
                            onClick={() =>
                              setTramosMargen((prev) =>
                                prev.filter((_, i) => i !== index),
                              )
                            }
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={tramosMargen.length >= 10}
                      onClick={agregarTramo}
                    >
                      <Plus data-icon="inline-start" /> Agregar tramo
                    </Button>
                  </Field>
                ) : null}
                <Field>
                  <FieldLabel htmlFor="cc-minimo-hojas">
                    Hojas mínimas facturables por documento
                  </FieldLabel>
                  <Input
                    id="cc-minimo-hojas"
                    type="number"
                    min={0}
                    step={1}
                    value={minimoHojas}
                    onChange={(event) => setMinimoHojas(event.target.value)}
                  />
                  <FieldDescription>
                    Usá 0 para cobrar siempre la cantidad real. El mínimo
                    también se calcula dentro del motor universal.
                  </FieldDescription>
                </Field>
                <Alert>
                  <AlertTitle>No existe un tarifario paralelo</AlertTitle>
                  <AlertDescription>
                    Papel, tóner, máquina, tiempo y terminaciones continúan
                    cotizados por el motor universal.
                  </AlertDescription>
                </Alert>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                  <div>
                    <div className="text-sm font-medium">Prueba rápida</div>
                    <div className="text-xs text-muted-foreground">
                      100 páginas, B/N, doble faz.
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    loading={cotizando}
                    loadingText="Cotizando…"
                    onClick={() => void probarCotizacion()}
                  >
                    Probar cotización
                  </Button>
                  {cotizacionPrueba ? (
                    <div className="basis-full border-t pt-3 text-sm">
                      <strong>{dinero(cotizacionPrueba.total)}</strong> ·{" "}
                      {cotizacionPrueba.hojas} hojas ·{" "}
                      {cotizacionPrueba.descripcion}
                    </div>
                  ) : null}
                </div>
              </FieldGroup>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="produccion" className="flex flex-col gap-4 pt-3">
          <Card>
            <CardHeader>
              <CardTitle>Ruta de producción</CardTitle>
              <CardDescription>
                Esta es la ruta que ejecuta Carga rápida. La impresión es
                obligatoria y el anillado se activa por trabajo.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-stretch gap-3 md:flex-row md:items-center">
              <Card className="flex-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Printer /> 1. Impresión láser
                  </CardTitle>
                  <CardDescription>
                    Papel, gramaje, formato, color y faz determinan el costo de
                    las hojas.
                  </CardDescription>
                  <CardAction>
                    <Badge>Obligatorio</Badge>
                  </CardAction>
                </CardHeader>
              </Card>
              <ArrowRight className="self-center text-muted-foreground max-md:rotate-90" />
              <Card className="flex-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen /> 2. Anillado
                  </CardTitle>
                  <CardDescription>
                    Espiral plástico o Wire-O, con máquina y consumibles del
                    taller.
                  </CardDescription>
                  <CardAction>
                    <Badge
                      variant={
                        terminaciones.has("Anillado") ? "secondary" : "outline"
                      }
                    >
                      {terminaciones.has("Anillado")
                        ? "Opcional activo"
                        : "Desactivado"}
                    </Badge>
                  </CardAction>
                </CardHeader>
              </Card>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Impresión</CardTitle>
                <CardDescription>
                  Automática usa las candidatas válidas de la ruta productiva.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <SelectorMaquina
                  label="Impresora color"
                  value={maquinaColor}
                  setValue={setMaquinaColor}
                  opciones={cfg.disponibles.maquinas.map((m) => ({
                    id: m.id,
                    nombre: `${m.nombre}${m.esColor ? " · color" : ""}`,
                  }))}
                />
                <SelectorMaquina
                  label="Impresora blanco y negro"
                  value={maquinaBn}
                  setValue={setMaquinaBn}
                  opciones={cfg.disponibles.maquinas.map((m) => ({
                    id: m.id,
                    nombre: `${m.nombre}${m.esColor ? " · color" : ""}`,
                  }))}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen /> Anillado
                </CardTitle>
                <CardDescription>
                  Configura el paso opcional y las dos tecnologías disponibles.
                </CardDescription>
                <CardAction>
                  <Switch
                    checked={terminaciones.has("Anillado")}
                    onCheckedChange={() =>
                      toggleSet("Anillado", setTerminaciones)
                    }
                    aria-label="Ofrecer anillado"
                  />
                </CardAction>
              </CardHeader>
              <CardContent className="grid gap-4">
                <FieldGroup>
                  {cfg.disponibles.tiposAnillo.map((tipo) => (
                    <Field
                      key={tipo.value}
                      orientation="horizontal"
                      data-disabled={
                        !terminaciones.has("Anillado") || !tipo.instalado
                      }
                    >
                      <FieldContent>
                        <FieldTitle>{tipo.label}</FieldTitle>
                        <FieldDescription>
                          {tipo.instalado
                            ? tipo.value === "WIRE_O"
                              ? "Anillado metálico Wire-O."
                              : "Espiral plástico seleccionado por capacidad."
                            : "No hay consumibles instalados para este tipo."}
                        </FieldDescription>
                      </FieldContent>
                      <Checkbox
                        checked={tiposAnillo.has(tipo.value)}
                        disabled={
                          !terminaciones.has("Anillado") || !tipo.instalado
                        }
                        onCheckedChange={() =>
                          toggleSet(tipo.value, setTiposAnillo)
                        }
                        aria-label={`Ofrecer ${tipo.label}`}
                      />
                    </Field>
                  ))}
                </FieldGroup>
                <SelectorMaquina
                  label="Anilladora"
                  value={maquinaAnilladora}
                  setValue={setMaquinaAnilladora}
                  opciones={cfg.disponibles.anilladoras}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <SelectorMaquina
                    label="Tapa frontal"
                    value={tapaFrontal}
                    setValue={setTapaFrontal}
                    opciones={cfg.disponibles.tapas
                      .filter((t) => t.esFrontal)
                      .map((t) => ({ id: t.materiaPrimaId, nombre: t.nombre }))}
                  />
                  <SelectorMaquina
                    label="Contratapa"
                    value={tapaContratapa}
                    setValue={setTapaContratapa}
                    opciones={cfg.disponibles.tapas
                      .filter((t) => !t.esFrontal)
                      .map((t) => ({ id: t.materiaPrimaId, nombre: t.nombre }))}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="oferta" className="grid gap-4 pt-3">
          {cfg.productoId ? (
            <PreciosEspecialesClientesCard
              productoId={cfg.productoId}
              unidadComercial="hoja"
              descripcion="Aplica la política particular del cliente sobre los costos calculados por el motor universal. Si no hay una regla activa, se usa la política general de Centro de Copiado."
            />
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>Papeles y gramajes</CardTitle>
              <CardDescription>
                Cada papel muestra los formatos que sus variantes activas pueden
                producir.
              </CardDescription>
              <CardAction>
                <Badge variant="outline">
                  {papeles.size} de {cfg.disponibles.papeles.length}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="flex flex-wrap gap-2">
                <div className="relative min-w-56 flex-1">
                  <Search className="absolute left-2.5 top-2 size-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder="Buscar papel…"
                    value={busquedaPapel}
                    onChange={(e) => setBusquedaPapel(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() =>
                    setPapeles(
                      new Map(
                        cfg.disponibles.papeles.map((p) => [
                          p.materiaPrimaId,
                          new Set(p.gramajes),
                        ]),
                      ),
                    )
                  }
                >
                  Seleccionar todos
                </Button>
                <Button variant="ghost" onClick={() => setPapeles(new Map())}>
                  Limpiar
                </Button>
              </div>
              <div className="grid gap-2">
                {papelesFiltrados.map((p) => {
                  const gs = papeles.get(p.materiaPrimaId);
                  return (
                    <div
                      key={p.materiaPrimaId}
                      className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(200px,1fr)_2fr]"
                    >
                      <label className="flex cursor-pointer items-start gap-3">
                        <Checkbox
                          checked={!!gs}
                          onCheckedChange={() =>
                            togglePapel(p.materiaPrimaId, p.gramajes)
                          }
                        />
                        <span>
                          <span className="block font-medium">{p.nombre}</span>
                          <span className="text-xs text-muted-foreground">
                            Produce:{" "}
                            {p.formatosProducibles.join(", ") ||
                              "sin formato compatible"}
                          </span>
                        </span>
                      </label>
                      {gs ? (
                        <div className="flex flex-wrap gap-2">
                          {p.gramajes.map((g) => (
                            <label
                              key={g}
                              className="flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-xs"
                            >
                              <Checkbox
                                checked={gs.has(g)}
                                onCheckedChange={() =>
                                  toggleGramaje(p.materiaPrimaId, g)
                                }
                              />{" "}
                              {g} g
                            </label>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Formatos ofrecidos</CardTitle>
                <CardDescription>
                  La compatibilidad final también se valida por papel.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {cfg.disponibles.formatos.map((f) => (
                  <label
                    key={f.nombre}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border p-3"
                  >
                    <Checkbox
                      checked={tamanos.has(f.nombre)}
                      onCheckedChange={() => toggleSet(f.nombre, setTamanos)}
                    />
                    <span>
                      <span className="block font-medium">{f.nombre}</span>
                      <span className="text-xs text-muted-foreground">
                        {f.anchoMm} × {f.altoMm} mm
                      </span>
                    </span>
                  </label>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="historial" className="pt-3">
          <Card>
            <CardHeader>
              <CardTitle>Historial de configuración</CardTitle>
              <CardDescription>
                Inicializaciones, reparaciones y cambios, con actor y fecha.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historial.length ? (
                <ol className="grid gap-4">
                  {historial.map((e) => (
                    <li
                      key={e.id}
                      className="flex gap-3 border-b pb-4 last:border-0 last:pb-0"
                    >
                      <Clock3 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{e.descripcion}</div>
                        <div className="text-xs text-muted-foreground">
                          {e.actorNombre} · {fechaCorta(e.createdAt)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Todavía no hay cambios auditados.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {hayCambios ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 shadow-lg backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4">
            <div>
              <div className="text-sm font-medium">Hay cambios sin guardar</div>
              <div className="text-xs text-muted-foreground">
                La versión publicada sigue siendo la {cfg.version}.
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => cargarFormulario(cfg)}>
                Descartar
              </Button>
              <Button
                loading={guardando}
                loadingText="Guardando…"
                onClick={() => void guardar()}
              >
                Guardar cambios
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SelectorMaquina({
  label,
  value,
  setValue,
  opciones,
}: {
  label: string;
  value: string | null;
  setValue: (value: string | null) => void;
  opciones: { id: string; nombre: string }[];
}) {
  const opcionSeleccionada = value
    ? opciones.find((opcion) => opcion.id === value)
    : null;
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Select
        value={value ?? AUTO}
        onValueChange={(nuevo) => setValue(nuevo === AUTO ? null : nuevo)}
      >
        <SelectTrigger className="w-full">
          <SelectValue>
            {value
              ? (opcionSeleccionada?.nombre ?? "Selección no disponible")
              : "Automática"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={AUTO}>Automática</SelectItem>
          {opciones.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
