"use client";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  DialogContent,
  CardFooter,
  AvisoCopiado,
  EstadoCopiado,
} from "./centro-copiado-ui";
import { Tabs } from "@heroui/react";
import { NavigationTabList } from "@/components/design-system/navigation-tab-list";
import styles from "./centro-copiado-tarifarios.module.css";
import { useEffect, useRef, useState } from "react";
import {
  Copy,
  Plus,
  Save,
  Upload,
  RefreshCw,
  TriangleAlert,
  Grid3X3,
  Settings2,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { Badge } from "@/components/ui/badge";

import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmacionSalida } from "@/components/ui/confirmacion-salida";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import type { CentroCopiadoConfig } from "@/lib/centro-copiado-api";
import type { PerfilCadCopiado } from "@/lib/centro-copiado-cad";
import * as api from "@/lib/centro-copiado-tarifarios-api";
import {
  cadInicial,
  contenidoInicial,
  conciliarFilas,
  claveCombinacion,
  fechaProgramada,
  filasCad,
  filasOferta,
  normalizarContenido,
  resumenCeldas,
  type FilaMatriz,
  type MatrizCad,
  type MatrizHojas,
} from "@/lib/centro-copiado-tarifarios-editor";
import {
  AvisoPreparacion,
  Elegir,
  ErrorTarifa,
  TextoTarifa,
  mensajeErrorTarifa,
  useAvisoCambios,
} from "./centro-copiado-tarifarios-controles";
import { ReglasTarifario } from "./centro-copiado-tarifarios-reglas";
import { EditorMatriz } from "./centro-copiado-tarifarios-matriz";
import { SimulacionTarifario } from "./centro-copiado-tarifarios-simulacion";

type Edicion = { nombre: string; contenido: api.ContenidoTarifario };
const firma = (e: Edicion | null) =>
  JSON.stringify(e && { nombre: e.nombre, contenido: e.contenido });
export function CentroCopiadoTarifarios({
  cfg,
  puedeGestionar,
  permiteCad,
  ofertaSinGuardar,
  onGuardado,
}: {
  cfg: CentroCopiadoConfig;
  puedeGestionar: boolean;
  permiteCad: boolean;
  ofertaSinGuardar: boolean;
  onGuardado: () => void;
}) {
  const { moneda, zonaHoraria } = useConfigRegional();
  const [lista, setLista] = useState<api.ResumenTarifario[]>([]);
  const [base, setBase] = useState<api.BorradorTarifario | null>(null);
  const [pestana, setPestana] = useState("matrices");
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [version, setVersion] = useState<api.VersionTarifario | null>(null);
  const [historial, setHistorial] = useState<api.ResumenVersion[]>([]);
  const [vigente, setVigente] = useState<api.VersionTarifario | null>(null);
  const [perfiles, setPerfiles] = useState<PerfilCadCopiado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [recargaRequerida, setRecargaRequerida] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [salida, setSalida] = useState<(() => void) | null>(null);
  const [publicacion, setPublicacion] = useState<{
    modo: "INMEDIATA" | "PROGRAMADA";
    fecha: string;
  } | null>(null);
  const [errorPublicacion, setErrorPublicacion] = useState<string | null>(null);
  const [retirar, setRetirar] = useState<"hojas" | "cad" | null>(null);
  const [actualizacion, setActualizacion] = useState<{
    seccion: "hojas" | "cad";
    propuesta: ReturnType<typeof conciliarFilas<FilaMatriz>>;
    firmaContenido: string;
    firmaOferta: string;
  } | null>(null);
  const bloqueo = useRef(false);
  const cambios = !!edicion && firma(edicion) !== firma(base);
  useAvisoCambios(cambios);
  const contenido = version?.contenido ?? edicion?.contenido;
  const soloLectura =
    !puedeGestionar || !!version || ocupado || recargaRequerida;
  const fecha = (iso: string) =>
    new Intl.DateTimeFormat("es-AR", {
      timeZone: zonaHoraria,
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  const nombres = Object.fromEntries([
    ...cfg.disponibles.papeles.map((p) => [p.materiaPrimaId, p.nombre]),
    ...perfiles.map((p) => [p.papelMateriaPrimaId, p.materialNombre]),
  ]);

  useEffect(() => {
    let activa = true;
    api
      .listarTarifarios()
      .then((l) => {
        if (activa) setLista(l);
      })
      .catch((e) => {
        if (activa) setError(mensajeErrorTarifa(e));
      })
      .finally(() => {
        if (activa) setCargando(false);
      });
    return () => {
      activa = false;
    };
  }, []);
  useEffect(() => {
    if (!permiteCad) return;
    let activa = true;
    api
      .catalogoCadTarifarios()
      .then((c) => {
        if (activa) setPerfiles(c.perfiles);
      })
      .catch(() => {
        /* Se reintenta explícitamente al generar CAD. */
      });
    return () => {
      activa = false;
    };
  }, [permiteCad]);
  async function trabajo(accion: () => Promise<void>) {
    if (bloqueo.current) return;
    bloqueo.current = true;
    setOcupado(true);
    setError(null);
    try {
      await accion();
    } catch (e) {
      setError(mensajeErrorTarifa(e));
    } finally {
      bloqueo.current = false;
      setOcupado(false);
    }
  }
  async function cargar(id: string) {
    setPestana("matrices");
    await trabajo(async () => {
      const [b, h, v] = await Promise.all([
        api.obtenerTarifario(id),
        api.versionesTarifario(id),
        api.vigenteTarifario(id),
      ]);
      setBase(b);
      setEdicion({ nombre: b.nombre, contenido: b.contenido });
      setVersion(null);
      setHistorial(h);
      setVigente(v.version);
      setRecargaRequerida(false);
    });
  }
  function navegar(accion: () => void) {
    if (ocupado) return;
    if (cambios) setSalida(() => accion);
    else accion();
  }
  function nuevo(duplicar = false) {
    setPestana("matrices");
    if (!puedeGestionar) return;
    setBase(null);
    setVersion(null);
    setHistorial([]);
    setVigente(null);
    setRecargaRequerida(false);
    setError(null);
    setEdicion(
      duplicar && contenido
        ? {
            nombre:
              `${version?.nombre ?? edicion?.nombre ?? "Tarifario"} (copia)`.slice(
                0,
                120,
              ),
            contenido: structuredClone(contenido),
          }
        : { nombre: "", contenido: contenidoInicial(moneda.codigo) },
    );
  }
  async function guardar(): Promise<boolean> {
    if (
      !puedeGestionar ||
      !edicion ||
      version ||
      bloqueo.current ||
      recargaRequerida
    )
      return false;
    let guardado = false;
    await trabajo(async () => {
      if (!edicion.nombre.trim())
        throw new Error("Escribí un nombre para el tarifario.");
      const c = normalizarContenido(edicion.contenido);
      const b = await api.guardarTarifario(base?.id ?? null, {
        nombre: edicion.nombre.trim(),
        contenido: c,
        ...(base ? { revision: base.revision } : {}),
      });
      setBase(b);
      setEdicion({ nombre: b.nombre, contenido: b.contenido });
      setLista((l) => [b, ...l.filter((t) => t.id !== b.id)]);
      guardado = true;
      onGuardado();
      toast.success("Borrador del tarifario guardado.");
    });
    return guardado;
  }
  function cambiar(c: api.ContenidoTarifario) {
    if (!soloLectura && edicion) setEdicion({ ...edicion, contenido: c });
  }
  async function generar(seccion: "hojas" | "cad") {
    if (soloLectura || !contenido || ofertaSinGuardar) return;
    await trabajo(async () => {
      const matriz = contenido[seccion];
      if (!matriz) return;
      let nuevas: FilaMatriz[] = [];
      if (seccion === "hojas" && contenido.hojas)
        nuevas = filasOferta(cfg, contenido.hojas);
      if (seccion === "cad" && contenido.cad) {
        const catalogo = await api.catalogoCadTarifarios();
        setPerfiles(catalogo.perfiles);
        nuevas = filasCad(catalogo.perfiles, contenido.cad);
      }
      const propuesta = conciliarFilas<FilaMatriz>(matriz.filas, nuevas);
      if (!propuesta.altas.length && !propuesta.bajas.length) {
        toast.info("Las combinaciones ya están actualizadas con la oferta.");
        return;
      }
      if (!matriz.filas.length) {
        const c = structuredClone(contenido);
        if (seccion === "hojas" && c.hojas)
          c.hojas.filas = propuesta.filas as MatrizHojas["filas"];
        if (seccion === "cad" && c.cad)
          c.cad.filas = propuesta.filas as MatrizCad["filas"];
        setEdicion((e) => e && { ...e, contenido: c });
        toast.info(
          `${propuesta.altas.length} combinaciones agregadas. Guardá el borrador para simular sus costos.`,
        );
      } else
        setActualizacion({
          seccion,
          propuesta,
          firmaContenido: JSON.stringify(contenido),
          firmaOferta: JSON.stringify(cfg),
        });
    });
  }
  async function publicar() {
    if (
      !base ||
      !publicacion ||
      cambios ||
      !puedeGestionar ||
      bloqueo.current ||
      recargaRequerida
    )
      return;
    bloqueo.current = true;
    setOcupado(true);
    setErrorPublicacion(null);
    try {
      const v = await api.publicarTarifario(base.id, {
        revision: base.revision,
        tipoVigencia: publicacion.modo,
        ...(publicacion.modo === "PROGRAMADA"
          ? { vigenteDesde: fechaProgramada(publicacion.fecha, zonaHoraria) }
          : {}),
      });
      setPublicacion(null);
      setRecargaRequerida(true);
      onGuardado();
      toast.success(
        `Versión ${v.numero} publicada${v.tipoVigencia === "PROGRAMADA" ? ` para ${fecha(v.vigenteDesde)}` : ""}.`,
      );
      try {
        const [b, h, actual] = await Promise.all([
          api.obtenerTarifario(base.id),
          api.versionesTarifario(base.id),
          api.vigenteTarifario(base.id),
        ]);
        setBase(b);
        setEdicion({ nombre: b.nombre, contenido: b.contenido });
        setHistorial(h);
        setVigente(actual.version);
        setLista((l) => [b, ...l.filter((t) => t.id !== b.id)]);
        setRecargaRequerida(false);
      } catch {
        setError(
          "La versión se publicó, pero no se pudo actualizar la pantalla. Recargá el tarifario antes de continuar.",
        );
      }
    } catch (e) {
      setErrorPublicacion(mensajeErrorTarifa(e));
    } finally {
      bloqueo.current = false;
      setOcupado(false);
    }
  }
  const resumen = contenido ? resumenCeldas(contenido) : null;
  const clavesOferta = new Set(
    contenido?.hojas
      ? filasOferta(cfg, contenido.hojas).map((f) =>
          claveCombinacion(f.combinacion),
        )
      : [],
  );
  const fueraDeOferta =
    contenido?.hojas?.filas.filter(
      (f) => !clavesOferta.has(claveCombinacion(f.combinacion)),
    ).length ?? 0;
  const actualizacionVigente =
    actualizacion &&
    !soloLectura &&
    !ofertaSinGuardar &&
    actualizacion.firmaContenido === JSON.stringify(contenido) &&
    actualizacion.firmaOferta === JSON.stringify(cfg);
  return (
    <div className="grid min-w-0 gap-4">
      <AvisoPreparacion />
      <Card>
        <CardHeader>
          <CardTitle>Tarifarios</CardTitle>
          <CardDescription>
            Un tarifario reúne las matrices y reglas comerciales. Podés
            compartirlo entre canales o crear copias independientes.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          {cargando ? (
            <Skeleton className="h-10 w-64" />
          ) : (
            <div className="min-w-48 flex-1">
              <Elegir
                etiqueta="Tarifario a editar"
                valor={base?.id ?? "__nuevo__"}
                disabled={ocupado}
                opciones={[
                  {
                    value: "__nuevo__",
                    label:
                      edicion && !base
                        ? "Nuevo tarifario sin guardar"
                        : "Elegí un tarifario",
                  },
                  ...lista.map((t) => ({ value: t.id, label: t.nombre })),
                ]}
                onChange={(id) => {
                  if (id !== "__nuevo__") navegar(() => void cargar(id));
                }}
              />
            </div>
          )}
          <Button
            variant="outline"
            disabled={ocupado}
            onClick={() =>
              void trabajo(async () => {
                setLista(await api.listarTarifarios());
              })
            }
          >
            Actualizar listado
          </Button>
          {puedeGestionar && (
            <Button disabled={ocupado} onClick={() => navegar(() => nuevo())}>
              <Plus data-icon="inline-start" />
              Nuevo tarifario
            </Button>
          )}
        </CardContent>
      </Card>
      <ErrorTarifa error={error} />
      {contenido && edicion ? (
        <>
          <Card>
            <CardContent className={styles.tariffIdentity}>
              <div className={styles.tariffName}>
                <div className={styles.tariffEyebrow}>
                  <span className={styles.eyebrow}>TARIFARIO DE COPIADO</span>
                  <EstadoCopiado tono={version ? "neutral" : "brand"}>
                    {version
                      ? `Versión ${version.numero} · sólo lectura`
                      : "Borrador"}
                  </EstadoCopiado>
                  {cambios && (
                    <EstadoCopiado tono="warning">
                      Cambios sin guardar
                    </EstadoCopiado>
                  )}
                </div>
                <TextoTarifa
                  etiqueta="Nombre del tarifario"
                  maxLength={120}
                  disabled={soloLectura}
                  valor={version?.nombre ?? edicion.nombre}
                  onChange={(nombre) => setEdicion({ ...edicion, nombre })}
                  placeholder="Por ejemplo: Mostrador"
                />
                <p className={styles.tariffCurrency}>
                  Moneda del tarifario ·{" "}
                  <strong>{contenido.monedaCodigo}</strong>
                </p>
              </div>
              <div className={styles.priceProgress}>
                <span className={styles.eyebrow}>CARGA DE PRECIOS</span>
                <p>
                  <strong>{resumen!.total - resumen!.pendientes}</strong>
                  <span>de {resumen!.total} precios cargados</span>
                </p>
                <progress
                  aria-label="Precios cargados"
                  value={resumen!.total - resumen!.pendientes}
                  max={Math.max(1, resumen!.total)}
                />
                <span>
                  {resumen!.total === 0
                    ? "Agregá combinaciones para comenzar"
                    : resumen!.pendientes
                      ? `${resumen!.pendientes} precios pendientes`
                      : "Todos los precios están cargados"}
                </span>
              </div>
              {contenido.monedaCodigo !== moneda.codigo && (
                <div className={styles.fullWidth}>
                  <AvisoCopiado
                    tono="warning"
                    icono={<TriangleAlert />}
                    titulo="Moneda diferente a la empresa"
                  >
                    Este tarifario usa {contenido.monedaCodigo}; la empresa usa{" "}
                    {moneda.codigo}. Su selección por canal quedará pendiente
                    por moneda incompatible.
                  </AvisoCopiado>
                </div>
              )}
            </CardContent>
            <CardFooter className={styles.tariffActions}>
              <div className={styles.tariffMeta}>
                <span>
                  {vigente
                    ? `Versión ${vigente.numero} vigente`
                    : "Sin versión vigente"}
                </span>
                <small>Vigencia según {zonaHoraria}</small>
                {base && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={ocupado}
                    onClick={() => navegar(() => void cargar(base.id))}
                  >
                    <RefreshCw />
                    Recargar tarifario guardado
                  </Button>
                )}
              </div>
              <div className={styles.actionGroup}>
                {version && (
                  <Button
                    variant="outline"
                    disabled={ocupado}
                    onClick={() => setVersion(null)}
                  >
                    Volver al borrador
                  </Button>
                )}
                {puedeGestionar && (
                  <>
                    <Button
                      variant="ghost"
                      disabled={ocupado}
                      onClick={() => nuevo(true)}
                    >
                      <Copy />
                      Duplicar tarifario
                    </Button>
                    {!version && (
                      <>
                        <Button
                          variant="outline"
                          loading={ocupado}
                          disabled={soloLectura || !cambios}
                          onClick={() => void guardar()}
                        >
                          <Save />
                          Guardar borrador
                        </Button>
                        <Button
                          disabled={soloLectura || cambios || !base}
                          onClick={() => {
                            setErrorPublicacion(null);
                            setPublicacion({ modo: "INMEDIATA", fecha: "" });
                          }}
                        >
                          <Upload />
                          Publicar versión
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>
            </CardFooter>
          </Card>
          <Tabs
            className="min-w-0"
            selectedKey={pestana}
            onSelectionChange={(v) => setPestana(String(v))}
            key={`editor-${base?.id ?? "nuevo"}-${version?.id ?? "borrador"}`}
          >
            <NavigationTabList
              label="Editor del tarifario"
              variant="inset"
              items={[
                { id: "matrices", label: "Matrices", icon: <Grid3X3 /> },
                {
                  id: "reglas",
                  label: "Reglas comerciales",
                  icon: <Settings2 />,
                },
                ...(base
                  ? [{ id: "versiones", label: "Versiones", icon: <History /> }]
                  : []),
              ]}
            />
            <Tabs.Panel
              id="matrices"
              shouldForceMount
              className={styles.editorPanel}
            >
              <SimulacionTarifario
                tarifarioId={base?.id ?? null}
                revision={base?.revision}
                versionId={version?.id}
                revisionCostos={JSON.stringify([
                  cfg.version,
                  cfg.actualizadoEl,
                ])}
                preparacionHojas={cfg.cobraSetup}
                contenido={contenido}
                guardado={version?.contenido ?? base?.contenido ?? null}
                nombres={nombres}
                perfiles={perfiles}
                disabled={ocupado || recargaRequerida || ofertaSinGuardar}
                onChange={soloLectura ? undefined : cambiar}
              >
                {(motor) => (
                  <>
                    {ofertaSinGuardar && (
                      <AvisoCopiado
                        tono="warning"
                        icono={<Save />}
                        titulo="Hay cambios de configuración sin guardar"
                      >
                        Guardá la configuración de Oferta antes de actualizar
                        las combinaciones del tarifario.
                      </AvisoCopiado>
                    )}
                    {contenido.hojas && (
                      <>
                        {!version && fueraDeOferta > 0 && (
                          <AvisoCopiado
                            tono="warning"
                            icono={<TriangleAlert />}
                            titulo={`${fueraDeOferta} combinaciones ya no se ofrecen`}
                            accion={
                              puedeGestionar && (
                                <Button
                                  variant="outline"
                                  disabled={soloLectura || ofertaSinGuardar}
                                  onClick={() => void generar("hojas")}
                                >
                                  Revisar cambios de oferta
                                </Button>
                              )
                            }
                          >
                            La oferta guardada cambió. Revisá qué filas se
                            retiran del borrador; las versiones publicadas se
                            conservan.
                          </AvisoCopiado>
                        )}
                        <EditorMatriz
                          key={`${base?.id ?? "nuevo"}-${version?.id ?? "borrador"}-hojas`}
                          motor={motor}
                          matriz={contenido.hojas}
                          nombres={nombres}
                          formatos={cfg.disponibles.formatos}
                          disabled={soloLectura}
                          generando={ocupado}
                          permiteGenerar={!ofertaSinGuardar}
                          onGenerar={() => void generar("hojas")}
                          onChange={(m) =>
                            cambiar({ ...contenido, hojas: m as MatrizHojas })
                          }
                        />
                      </>
                    )}
                    {contenido.cad && (
                      <EditorMatriz
                        key={`${base?.id ?? "nuevo"}-${version?.id ?? "borrador"}-cad`}
                        motor={motor}
                        matriz={contenido.cad}
                        nombres={nombres}
                        formatos={cfg.disponibles.formatos}
                        disabled={soloLectura}
                        generando={ocupado}
                        permiteGenerar={permiteCad && !ofertaSinGuardar}
                        onGenerar={() => void generar("cad")}
                        onChange={(m) =>
                          cambiar({ ...contenido, cad: m as MatrizCad })
                        }
                      />
                    )}
                    {!soloLectura && (
                      <div className="flex flex-wrap gap-2">
                        {!contenido.hojas && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              const hojas = contenidoInicial(
                                contenido.monedaCodigo,
                              ).hojas!;
                              hojas.reglas.cobertura =
                                contenido.cad!.reglas.cobertura;
                              cambiar({ ...contenido, hojas });
                            }}
                          >
                            Agregar matriz de hojas
                          </Button>
                        )}
                        {!contenido.cad && permiteCad && (
                          <Button
                            variant="outline"
                            onClick={() =>
                              cambiar({
                                ...contenido,
                                cad: cadInicial(
                                  contenido.hojas!.reglas.cobertura,
                                ),
                              })
                            }
                          >
                            Agregar matriz CAD por ML
                          </Button>
                        )}
                        {contenido.hojas && contenido.cad && (
                          <>
                            <Button
                              variant="ghost"
                              onClick={() => setRetirar("hojas")}
                            >
                              Quitar matriz de hojas
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => setRetirar("cad")}
                            >
                              Quitar matriz CAD
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </SimulacionTarifario>
            </Tabs.Panel>
            <Tabs.Panel
              id="reglas"
              shouldForceMount
              className={styles.editorPanel}
            >
              <ReglasTarifario
                contenido={contenido}
                disabled={soloLectura}
                onChange={cambiar}
              />
            </Tabs.Panel>
            {base && (
              <Tabs.Panel id="versiones" className={styles.editorPanel}>
                <Card>
                  <CardHeader>
                    <CardTitle>Versiones publicadas</CardTitle>
                    <CardDescription>
                      Las versiones publicadas son inmutables. Abrilas para
                      consultar sus reglas y precios, o duplicalas como otro
                      tarifario.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {historial.length ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Versión</TableHead>
                            <TableHead>Vigencia ({zonaHoraria})</TableHead>
                            <TableHead>Publicada</TableHead>
                            <TableHead>Consulta</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {historial.map((v) => (
                            <TableRow key={v.id}>
                              <TableCell>
                                {v.numero} · {v.nombre}
                                {vigente?.id === v.id && (
                                  <Badge className="ml-2" variant="secondary">
                                    Vigente
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {fecha(v.vigenteDesde)}
                                {new Date(v.vigenteDesde) > new Date() && (
                                  <Badge variant="outline" className="ml-2">
                                    Programada
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>{fecha(v.publicadoEl)}</TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={ocupado || cambios}
                                  onClick={() =>
                                    void trabajo(async () => {
                                      setPestana("matrices");
                                      setVersion(
                                        await api.leerVersionTarifario(
                                          base.id,
                                          v.id,
                                        ),
                                      );
                                    })
                                  }
                                >
                                  Ver versión {v.numero}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Todavía no hay versiones publicadas.
                      </p>
                    )}
                    {cambios && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Guardá o descartá los cambios antes de consultar otra
                        versión.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Tabs.Panel>
            )}
          </Tabs>
        </>
      ) : (
        !cargando && (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>
                {lista.length
                  ? "Elegí un tarifario"
                  : "Prepará tu primera matriz"}
              </EmptyTitle>
              <EmptyDescription>
                {lista.length
                  ? "Abrí un tarifario del listado para ver sus reglas, precios y versiones."
                  : "Creá un tarifario, agregá combinaciones de la oferta y cargá los precios por tramo."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )
      )}
      <ConfirmacionSalida
        open={!!salida}
        cambios={1}
        donde="el tarifario"
        guardando={ocupado}
        onSeguirEditando={() => setSalida(null)}
        onDescartarYSalir={() => {
          const accion = salida;
          setSalida(null);
          accion?.();
        }}
        onGuardarYSalir={async () => {
          if (await guardar()) {
            const accion = salida;
            setSalida(null);
            accion?.();
          }
        }}
      />
      <Dialog
        open={!!actualizacion}
        onOpenChange={(open) => {
          if (!open) setActualizacion(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Actualizar combinaciones del borrador</DialogTitle>
            <DialogDescription>
              Revisá los cambios de la oferta. Las combinaciones que continúan
              conservan sus precios y rangos propios. Las versiones publicadas
              no cambian.
            </DialogDescription>
          </DialogHeader>
          {actualizacion && (
            <>
              <dl className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt>Se agregan</dt>
                  <dd>{actualizacion.propuesta.altas.length}</dd>
                </div>
                <div>
                  <dt>Se conservan</dt>
                  <dd>{actualizacion.propuesta.conservadas}</dd>
                </div>
                <div>
                  <dt>Se retiran</dt>
                  <dd>{actualizacion.propuesta.bajas.length}</dd>
                </div>
              </dl>
              <p className="text-sm text-muted-foreground">
                Las nuevas quedan con precio pendiente. Se retirarán{" "}
                {actualizacion.propuesta.bajas.reduce(
                  (n, f) =>
                    n +
                    f.precios.filter((p) => p.precioUnitario !== null).length,
                  0,
                )}{" "}
                precios cargados de las combinaciones que ya no se ofrecen.
              </p>
              {!!actualizacion.propuesta.bajas.length && (
                <div className="max-h-60 overflow-auto">
                  <p className="mb-2 text-sm font-medium">
                    Combinaciones a retirar
                  </p>
                  <ul className="flex flex-col gap-2 text-sm">
                    {actualizacion.propuesta.bajas.slice(0, 50).map((f) => {
                      const c = f.combinacion;
                      return (
                        <li key={claveCombinacion(c)}>
                          {nombres[c.papelMateriaPrimaId] ??
                            "Papel no disponible"}{" "}
                          ·{" "}
                          {c.gramaje == null ? "Sin gramaje" : `${c.gramaje} g`}{" "}
                          ·{" "}
                          {"tamano" in c
                            ? `${c.tamano} · ${c.faz === 1 ? "Simple faz" : "Doble faz"}`
                            : `${c.anchoRolloMm} mm`}{" "}
                          · {c.color === "COLOR" ? "Color" : "Blanco y negro"} ·{" "}
                          {c.cobertura ?? "Todas las coberturas"}
                        </li>
                      );
                    })}
                  </ul>
                  {actualizacion.propuesta.bajas.length > 50 && (
                    <p className="mt-2 text-sm">
                      Y {actualizacion.propuesta.bajas.length - 50}{" "}
                      combinaciones más.
                    </p>
                  )}
                </div>
              )}
              {!actualizacionVigente && (
                <ErrorTarifa error="La oferta o el borrador cambió. Cerrá esta revisión y volvé a actualizar las combinaciones." />
              )}
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActualizacion(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!actualizacionVigente}
              onClick={() => {
                if (!actualizacion || !contenido || !actualizacionVigente)
                  return;
                const c = structuredClone(contenido);
                if (actualizacion.seccion === "hojas" && c.hojas)
                  c.hojas.filas = structuredClone(
                    actualizacion.propuesta.filas,
                  ) as MatrizHojas["filas"];
                if (actualizacion.seccion === "cad" && c.cad)
                  c.cad.filas = structuredClone(
                    actualizacion.propuesta.filas,
                  ) as MatrizCad["filas"];
                cambiar(c);
                setActualizacion(null);
                toast.success(
                  "Combinaciones actualizadas. Guardá el borrador para conservar los cambios.",
                );
              }}
            >
              Aplicar actualización
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!retirar}
        onOpenChange={(v) => {
          if (!v) setRetirar(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quitar matriz del borrador</DialogTitle>
            <DialogDescription>
              Se quitarán todas sus combinaciones y precios del borrador. Las
              versiones publicadas se conservan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRetirar(null)}>
              Cancelar
            </Button>
            <Button
              disabled={soloLectura}
              onClick={() => {
                if (contenido && retirar)
                  cambiar({ ...contenido, [retirar]: null });
                setRetirar(null);
              }}
            >
              Quitar matriz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!publicacion}
        onOpenChange={(v) => {
          if (!v && !ocupado) setPublicacion(null);
        }}
      >
        <DialogContent showCloseButton={!ocupado}>
          <DialogHeader>
            <DialogTitle>Publicar versión de {base?.nombre}</DialogTitle>
            <DialogDescription>
              Se guardará una copia inmutable de las reglas y precios del
              borrador. Publicarla todavía no activa su uso en pedidos.
            </DialogDescription>
          </DialogHeader>
          {publicacion && (
            <FieldGroup>
              <Elegir
                etiqueta="Inicio de vigencia"
                disabled={ocupado}
                valor={publicacion.modo}
                opciones={[
                  { value: "INMEDIATA", label: "Inmediatamente" },
                  { value: "PROGRAMADA", label: "Programar fecha y hora" },
                ]}
                onChange={(modo) => setPublicacion({ ...publicacion, modo })}
              />
              {publicacion.modo === "PROGRAMADA" && (
                <TextoTarifa
                  etiqueta={`Fecha y hora (${zonaHoraria})`}
                  type="datetime-local"
                  disabled={ocupado}
                  valor={publicacion.fecha}
                  onChange={(fecha) =>
                    setPublicacion({ ...publicacion, fecha })
                  }
                />
              )}
            </FieldGroup>
          )}
          {!!resumen?.pendientes && (
            <Alert>
              <AlertTitle>{resumen.pendientes} precios pendientes</AlertTitle>
              <AlertDescription>
                Esta publicación conserva las celdas vacías. Una combinación sin
                precio no se vuelve gratuita ni recibe automáticamente un precio
                del motor.
              </AlertDescription>
            </Alert>
          )}
          <ErrorTarifa error={errorPublicacion} />
          <DialogFooter>
            <Button
              variant="outline"
              disabled={ocupado}
              onClick={() => setPublicacion(null)}
            >
              Cancelar
            </Button>
            <Button
              loading={ocupado}
              disabled={ocupado || cambios || !puedeGestionar}
              onClick={() => void publicar()}
            >
              Confirmar publicación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
