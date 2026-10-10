"use client";
import { useEffect, useRef, useState } from "react";
import { Copy, Plus, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
  fechaProgramada,
  filasCad,
  filasOferta,
  normalizarContenido,
  resumenCeldas,
  sumarFilas,
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
    if (soloLectura || !contenido) return;
    await trabajo(async () => {
      const c = structuredClone(contenido);
      if (seccion === "hojas" && c.hojas) {
        const nuevas = filasOferta(cfg, c.hojas);
        const antes = c.hojas.filas.length;
        c.hojas.filas = sumarFilas(c.hojas.filas, nuevas);
        toast.info(
          `${c.hojas.filas.length - antes} combinaciones agregadas. Los precios existentes se conservaron.`,
        );
      }
      if (seccion === "cad" && c.cad) {
        const catalogo = await api.catalogoCadTarifarios();
        setPerfiles(catalogo.perfiles);
        const antes = c.cad.filas.length;
        c.cad.filas = sumarFilas(
          c.cad.filas,
          filasCad(catalogo.perfiles, c.cad),
        );
        toast.info(
          `${c.cad.filas.length - antes} combinaciones CAD agregadas. Se usan los rollos y modos de impresión configurados.`,
        );
      }
      setEdicion((e) => e && { ...e, contenido: c });
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
      {base && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            disabled={ocupado}
            onClick={() => navegar(() => void cargar(base.id))}
          >
            Recargar tarifario guardado
          </Button>
          <span className="text-xs text-muted-foreground">
            Vigencia según {zonaHoraria}
            {vigente
              ? ` · Versión vigente: ${vigente.numero}`
              : " · Sin versión vigente"}
          </span>
        </div>
      )}
      {contenido && edicion ? (
        <>
          <Card>
            <CardContent className="grid gap-4 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={version ? "secondary" : "outline"}>
                    {version
                      ? `Versión ${version.numero} · sólo lectura`
                      : "Borrador"}
                  </Badge>
                  {cambios && (
                    <Badge variant="secondary">Cambios sin guardar</Badge>
                  )}
                  <Badge variant="outline">{contenido.monedaCodigo}</Badge>
                  <Badge variant="outline">
                    {resumen!.pendientes} de {resumen!.total} precios pendientes
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
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
                        variant="outline"
                        disabled={ocupado}
                        onClick={() => nuevo(true)}
                      >
                        <Copy data-icon="inline-start" />
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
                            <Save data-icon="inline-start" />
                            Guardar borrador
                          </Button>
                          <Button
                            disabled={soloLectura || cambios || !base}
                            onClick={() => {
                              setErrorPublicacion(null);
                              setPublicacion({ modo: "INMEDIATA", fecha: "" });
                            }}
                          >
                            <Upload data-icon="inline-start" />
                            Publicar versión
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
              <TextoTarifa
                etiqueta="Nombre del tarifario"
                maxLength={120}
                disabled={soloLectura}
                valor={version?.nombre ?? edicion.nombre}
                onChange={(nombre) => setEdicion({ ...edicion, nombre })}
                placeholder="Por ejemplo: Mostrador"
                ayuda="La moneda se toma de la empresa al crear el tarifario; no se convierten precios automáticamente."
              />
              {contenido.monedaCodigo !== moneda.codigo && (
                <Alert variant="destructive">
                  <AlertTitle>Moneda diferente a la empresa</AlertTitle>
                  <AlertDescription>
                    Este tarifario usa {contenido.monedaCodigo}; la empresa usa{" "}
                    {moneda.codigo}. Su selección por canal quedará pendiente
                    por moneda incompatible.
                  </AlertDescription>
                </Alert>
              )}
              <p className="text-xs text-muted-foreground">
                La simulación de costos de todas las celdas con el motor sigue
                pendiente de implementación.
              </p>
            </CardContent>
          </Card>
          <ReglasTarifario
            contenido={contenido}
            disabled={soloLectura}
            onChange={cambiar}
          />
          {ofertaSinGuardar && (
            <Alert>
              <AlertTitle>Hay cambios de configuración sin guardar</AlertTitle>
              <AlertDescription>
                La generación usa la oferta guardada. Guardá la configuración de
                Oferta antes de agregar combinaciones nuevas.
              </AlertDescription>
            </Alert>
          )}
          {contenido.hojas && (
            <EditorMatriz
              key={`${base?.id ?? "nuevo"}-${version?.id ?? "borrador"}-hojas`}
              matriz={contenido.hojas}
              nombres={nombres}
              disabled={soloLectura}
              generando={ocupado}
              onGenerar={() => void generar("hojas")}
              onChange={(m) =>
                cambiar({ ...contenido, hojas: m as MatrizHojas })
              }
            />
          )}
          {contenido.cad && (
            <EditorMatriz
              key={`${base?.id ?? "nuevo"}-${version?.id ?? "borrador"}-cad`}
              matriz={contenido.cad}
              nombres={nombres}
              disabled={soloLectura}
              generando={ocupado}
              permiteGenerar={permiteCad}
              onGenerar={() => void generar("cad")}
              onChange={(m) => cambiar({ ...contenido, cad: m as MatrizCad })}
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
                    hojas.reglas.cobertura = contenido.cad!.reglas.cobertura;
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
                      cad: cadInicial(contenido.hojas!.reglas.cobertura),
                    })
                  }
                >
                  Agregar matriz CAD por ML
                </Button>
              )}
              {contenido.hojas && contenido.cad && (
                <>
                  <Button variant="ghost" onClick={() => setRetirar("hojas")}>
                    Quitar matriz de hojas
                  </Button>
                  <Button variant="ghost" onClick={() => setRetirar("cad")}>
                    Quitar matriz CAD
                  </Button>
                </>
              )}
            </div>
          )}
          {base && (
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
          )}
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
