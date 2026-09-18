"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/design-system/action-button";
import { SelectField } from "@/components/design-system/select-field";
import { FormDialog } from "@/components/design-system/form-dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input, Tabs } from "@heroui/react";
import {
  Printer,
  Ruler,
  ScanLine,
  Plus,
  RefreshCw,
  Settings2,
  Layers,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { NavigationTabList } from "@/components/design-system/navigation-tab-list";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { SelectorImpresoras } from "./selector-impresoras";
import { categoriaImpresora, type CategoriaImpresora } from "./tipos-impresora";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePuede } from "@/components/navigation/permisos-provider";
import {
  agregarBandejaImpresion,
  getPerfilesImpresion,
  guardarDestinoImpresion,
  guardarPerfilImpresion,
  prepararBandejaImpresion,
  type ConfiguracionPerfiles,
  type DatosDestino,
  type DatosPerfil,
} from "@/lib/impresion-api";
import { buscarImpresoras, imprimirPruebaPerfil } from "@/lib/qz-impresion";
import { leerImpresora } from "@/lib/impresora-puesto";
import { BandejasDetectadasField } from "./bandejas-detectadas-field";
import { CadImpresionDialog } from "./cad-impresion-dialog";
import { PerfilesCadPanel } from "./perfiles-cad-panel";
import s from "./perfiles-impresion.module.css";

type Edicion =
  | { tipo: "destino"; id?: string; datos: DatosDestino }
  | { tipo: "bandeja"; destinoId: string; nombre: string; codigo: string }
  | { tipo: "perfil"; id?: string; datos: DatosPerfil };
function Campo({ nombre, children }: { nombre: string; children: ReactNode }) {
  return (
    <Field>
      <FieldLabel>{nombre}</FieldLabel>
      {children}
    </Field>
  );
}
export function PerfilesImpresionPanel({
  tenantId,
  disabled = false,
  etiquetas,
  etiquetaConfigurada = false,
}: {
  tenantId: string;
  disabled?: boolean;
  etiquetas?: ReactNode;
  etiquetaConfigurada?: boolean;
}) {
  const gestionar = usePuede("configuracion.gestionar");
  const operar = usePuede("produccion.ejecutar") || gestionar;
  const [datos, setDatos] = useState<ConfiguracionPerfiles | null>(null);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [editor, setEditor] = useState<Edicion | null>(null);
  const [colas, setColas] = useState<string[]>([]);
  const [cargas, setCargas] = useState<Record<string, string>>({});
  const lock = useRef(false);
  const [categoria, setCategoria] = useState<CategoriaImpresora | "etiquetas">(
    "documentos",
  );
  const [seleccion, setSeleccion] = useState<
    Partial<Record<CategoriaImpresora, string>>
  >({});
  const [busqueda, setBusqueda] = useState("");
  const [bandejasSeleccionadas, setBandejasSeleccionadas] = useState<
    Record<string, string>
  >({});
  const [cadId, setCadId] = useState<string | null>(null);
  async function cargar() {
    setDatos(await getPerfilesImpresion());
  }
  useEffect(() => {
    let vivo = true;
    getPerfilesImpresion()
      .then((d) => {
        if (vivo) setDatos(d);
      })
      .catch((e) => {
        if (vivo) setError(e.message);
      });
    return () => {
      vivo = false;
    };
  }, []);
  async function ejecutar(fn: () => Promise<unknown>, cerrar = false) {
    if (lock.current) return;
    lock.current = true;
    setOcupado(true);
    setError("");
    try {
      await fn();
      await cargar();
      if (cerrar) setEditor(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo completar la operación.",
      );
    } finally {
      lock.current = false;
      setOcupado(false);
    }
  }
  function destinoCampo<K extends keyof DatosDestino>(
    key: K,
    value: DatosDestino[K],
  ) {
    setEditor((prev) =>
      prev?.tipo === "destino"
        ? { ...prev, datos: { ...prev.datos, [key]: value } }
        : prev,
    );
  }
  function perfilCampo<K extends keyof DatosPerfil>(
    key: K,
    value: DatosPerfil[K],
  ) {
    setEditor((prev) =>
      prev?.tipo === "perfil"
        ? { ...prev, datos: { ...prev.datos, [key]: value } }
        : prev,
    );
  }
  function guardar() {
    if (!editor) return;
    if (editor.tipo === "bandeja" && (!editor.nombre.trim() || !editor.codigo))
      return;
    const e = editor;
    void ejecutar(async () => {
      if (e.tipo === "destino") {
        const guardado = await guardarDestinoImpresion(e.datos, e.id);
        const tipo = categoriaImpresora(guardado, datos?.maquinas ?? []);
        setCategoria(tipo);
        setBusqueda("");
        setSeleccion((actual) => ({ ...actual, [tipo]: guardado.id }));
      } else if (e.tipo === "bandeja") {
        const bandeja = await agregarBandejaImpresion(e.destinoId, {
          nombre: e.nombre,
          codigo: e.codigo,
        });
        setBandejasSeleccionadas((actual) => ({
          ...actual,
          [e.destinoId]: bandeja.id,
        }));
      } else await guardarPerfilImpresion(e.datos, e.id);
    }, true);
  }

  const bloqueado = ocupado || disabled;
  const destinoBandeja =
    editor?.tipo === "bandeja"
      ? datos?.destinos.find((destino) => destino.id === editor.destinoId)
      : undefined;
  const tipo = categoria === "cad" ? "cad" : "documentos";
  const porTipo =
    datos?.destinos.filter(
      (d) => categoriaImpresora(d, datos.maquinas) === tipo,
    ) ?? [];
  const visibles = porTipo.filter((d) =>
    `${d.nombre} ${d.impresora}`
      .toLocaleLowerCase()
      .includes(busqueda.toLocaleLowerCase().trim()),
  );
  const seleccionado =
    visibles.find((d) => d.id === seleccion[tipo]) ?? visibles[0];
  const cuenta = (c: CategoriaImpresora) =>
    datos?.destinos.filter((d) => categoriaImpresora(d, datos.maquinas) === c)
      .length;
  const Icono = tipo === "cad" ? Ruler : Printer;
  return (
    <>
      <Tabs
        selectedKey={categoria}
        onSelectionChange={(key) => {
          setCategoria(String(key) as typeof categoria);
          setBusqueda("");
          setError("");
        }}
        className={s.panel}
      >
        <NavigationTabList
          className={s.tabs}
          label="Tipo de impresora"
          variant="detailed"
          tone="graphite"
          items={[
            {
              id: "documentos",
              label: "Documentos",
              description: "Láser · Papel en hojas",
              icon: <Printer />,
              count: cuenta("documentos"),
            },
            {
              id: "cad",
              label: "Planos CAD",
              description: "Plotters · Papel en rollo",
              icon: <Ruler />,
              count: cuenta("cad"),
            },
            {
              id: "etiquetas",
              label: "Etiquetas",
              description: "Térmicas · Identificación",
              icon: <ScanLine />,
              count: etiquetaConfigurada ? 1 : 0,
            },
          ]}
        />
        <Tabs.Panel key={tipo} id={tipo} className={s.tabPanel}>
          <header className={s.toolbar}>
            <div>
              <h2>
                {tipo === "cad"
                  ? "Plotters de planos"
                  : "Impresoras de documentos"}
              </h2>
              <p>
                {tipo === "cad"
                  ? "Rollo, escala y perfiles de impresión de cada plotter."
                  : "Bandejas y perfiles de papel de cada impresora."}
              </p>
            </div>
            <div className={s.acciones}>
              {gestionar && (
                <ActionButton
                  variant="outline"
                  isDisabled={bloqueado}
                  onPress={() => {
                    const local = leerImpresora(tenantId, "documentos");
                    setColas([]);
                    setEditor({
                      tipo: "destino",
                      datos: {
                        nombre: "",
                        host: local.host || "localhost",
                        impresora: local.impresora,
                        maquinaId: "",
                        activo: true,
                      },
                    });
                  }}
                >
                  <Plus />{" "}
                  {tipo === "cad" ? "Agregar plotter" : "Agregar impresora"}
                </ActionButton>
              )}
              <ActionButton
                variant="tertiary"
                isDisabled={bloqueado}
                onPress={() => void ejecutar(async () => {})}
              >
                <RefreshCw /> Actualizar
              </ActionButton>
            </div>
          </header>
          {error && !editor && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {!datos && !error && (
            <div
              className={s.skeleton}
              role="status"
              aria-label="Cargando impresoras"
            >
              <Skeleton className="h-64" />
              <Skeleton className="h-64" />
            </div>
          )}
          {datos && porTipo.length === 0 && (
            <Empty className={s.empty}>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Icono />
                </EmptyMedia>
                <EmptyTitle>
                  {tipo === "cad"
                    ? "Agregá tu primer plotter"
                    : "Agregá tu primera impresora"}
                </EmptyTitle>
                <EmptyDescription>
                  Vinculá el equipo con su máquina de producción para configurar{" "}
                  {tipo === "cad"
                    ? "el rollo y los perfiles CAD."
                    : "sus bandejas y papeles."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {datos && porTipo.length > 0 && (
            <div className={s.workspace}>
              <SelectorImpresoras
                destinos={visibles}
                seleccionado={seleccionado?.id}
                categoria={tipo}
                busqueda={busqueda}
                onBuscar={setBusqueda}
                onSeleccionar={(id) =>
                  setSeleccion((actual) => ({ ...actual, [tipo]: id }))
                }
                disabled={ocupado}
              />
              {!seleccionado && (
                <Empty className={s.empty}>
                  <EmptyHeader>
                    <EmptyTitle>No hay impresoras con ese nombre</EmptyTitle>
                    <EmptyDescription>
                      Cambiá la búsqueda para seleccionar un equipo.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
              {[seleccionado]
                .filter((d): d is NonNullable<typeof d> => Boolean(d))
                .map((destino) => (
                  <article
                    className={s.destino}
                    key={destino.id}
                    aria-label={`Configuración de ${destino.nombre}`}
                  >
                    <div className={s.cabecera}>
                      <div>
                        <span className={s.eyebrow}>
                          {tipo === "cad"
                            ? "Planos · Rollo"
                            : "Documentos · Hojas"}
                        </span>
                        <h3>
                          {destino.nombre}{" "}
                          {!destino.activo && (
                            <Badge variant="outline">Inactiva</Badge>
                          )}
                        </h3>
                        <p>
                          {destino.impresora} · {destino.host} ·{" "}
                          {datos.maquinas.find(
                            (m) => m.id === destino.maquinaId,
                          )?.nombre ?? "Máquina inactiva"}
                        </p>
                      </div>
                      {gestionar && (
                        <div className={s.acciones}>
                          <ActionButton
                            variant="tertiary"
                            isDisabled={bloqueado}
                            onPress={() => {
                              setColas([]);
                              setEditor({
                                tipo: "destino",
                                id: destino.id,
                                datos: {
                                  nombre: destino.nombre,
                                  host: destino.host,
                                  impresora: destino.impresora,
                                  maquinaId: destino.maquinaId,
                                  activo: destino.activo,
                                  version: destino.version,
                                },
                              });
                            }}
                          >
                            <Settings2 /> Ajustes
                          </ActionButton>
                          {tipo === "cad" && (
                            <ActionButton
                              variant="outline"
                              isDisabled={bloqueado}
                              onPress={() => setCadId(destino.id)}
                            >
                              <Ruler />{" "}
                              {destino.cad
                                ? "Rollo y prueba"
                                : "Configurar rollo"}
                            </ActionButton>
                          )}
                          {tipo === "documentos" && (
                            <ActionButton
                              variant="outline"
                              isDisabled={bloqueado}
                              onPress={() =>
                                setEditor({
                                  tipo: "bandeja",
                                  destinoId: destino.id,
                                  nombre: "",
                                  codigo: "",
                                })
                              }
                            >
                              <Plus /> Agregar bandeja
                            </ActionButton>
                          )}
                        </div>
                      )}
                    </div>
                    {destino.cad && (
                      <p className={s.ayuda}>
                        Rollo {destino.cad.anchoRolloMm} mm · Escala 100% ·{" "}
                        {destino.cad.usarOrigenPredeterminado
                          ? "Origen configurado en Windows"
                          : destino.cad.origenPapel}
                        . Piloto de prueba; planos de las OT pendientes de
                        integración.
                      </p>
                    )}
                    {tipo === "documentos" && !destino.bandejas.length && (
                      <p className={s.vacio}>
                        Todavía no hay bandejas configuradas.
                      </p>
                    )}
                    {destino.cad && gestionar && (
                      <PerfilesCadPanel
                        destino={destino}
                        perfiles={datos.perfiles}
                        tenantId={tenantId}
                        disabled={bloqueado}
                        onSaved={cargar}
                      />
                    )}
                    {tipo === "cad" && !destino.cad && (
                      <Empty>
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <Ruler />
                          </EmptyMedia>
                          <EmptyTitle>Prepará el rollo del plotter</EmptyTitle>
                          <EmptyDescription>
                            Definí el ancho y el origen del papel para crear los
                            perfiles CAD y probar la escala.
                          </EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    )}
                    {tipo === "documentos" && destino.bandejas.length > 0 && (
                      <div className={s.seleccionBandeja}>
                        <div className={s.seccionTitulo}>
                          <span className={s.numero}>01</span>
                          <div>
                            <h4>Bandejas y papel</h4>
                            <p>Elegí la bandeja que querés configurar.</p>
                          </div>
                        </div>
                        <SelectField
                          aria-label="Bandeja a configurar"
                          value={
                            bandejasSeleccionadas[destino.id] &&
                            destino.bandejas.some(
                              (b) => b.id === bandejasSeleccionadas[destino.id],
                            )
                              ? bandejasSeleccionadas[destino.id]
                              : destino.bandejas[0].id
                          }
                          options={destino.bandejas.map((b) => ({
                            value: b.id,
                            label: b.nombre,
                          }))}
                          onChange={(id) =>
                            setBandejasSeleccionadas((actual) => ({
                              ...actual,
                              [destino.id]: id,
                            }))
                          }
                        />
                      </div>
                    )}
                    {tipo === "documentos" &&
                      destino.bandejas
                        .filter(
                          (b) =>
                            b.id ===
                            (destino.bandejas.some(
                              (b) => b.id === bandejasSeleccionadas[destino.id],
                            )
                              ? bandejasSeleccionadas[destino.id]
                              : destino.bandejas[0]?.id),
                        )
                        .map((bandeja) => {
                          const perfiles = datos.perfiles.filter(
                            (p) => p.bandeja.id === bandeja.id,
                          );
                          const automaticos = perfiles.filter(
                            (p) =>
                              p.activo && p.probado && p.modo === "AUTOMATICO",
                          );
                          return (
                            <section key={bandeja.id} className={s.bandeja}>
                              <div className={s.cabecera}>
                                <div>
                                  <h4>{bandeja.nombre}</h4>
                                  <p>
                                    {bandeja.papelPreparadoId
                                      ? `${datos.papeles.find((p) => p.id === bandeja.papelPreparadoId)?.nombre ?? "Papel"} · ${bandeja.gramajePreparado} g cargado`
                                      : "Papel sin confirmar"}
                                  </p>
                                  {bandeja.preparadoEl && (
                                    <p>
                                      {bandeja.preparadoPor} ·{" "}
                                      {new Date(
                                        bandeja.preparadoEl,
                                      ).toLocaleString()}
                                    </p>
                                  )}
                                </div>
                                {gestionar && (
                                  <ActionButton
                                    variant="tertiary"
                                    isDisabled={bloqueado}
                                    onPress={() =>
                                      setEditor({
                                        tipo: "perfil",
                                        datos: {
                                          bandejaId: bandeja.id,
                                          nombre: "",
                                          papelMateriaPrimaId: "",
                                          gramaje: 75,
                                          tamano: "A4",
                                          color: "BN",
                                          faz: 1,
                                          modo: "PREPARACION",
                                          probado: false,
                                          activo: true,
                                          prioridad: 1,
                                        },
                                      })
                                    }
                                  >
                                    Agregar perfil
                                  </ActionButton>
                                )}
                              </div>
                              {perfiles.length > 0 && (
                                <Table className={s.tabla}>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Perfil</TableHead>
                                      <TableHead>Configuración</TableHead>
                                      <TableHead>Envío</TableHead>
                                      <TableHead>Prueba</TableHead>
                                      <TableHead>
                                        <span className="sr-only">
                                          Acciones
                                        </span>
                                      </TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {perfiles.map((p) => (
                                      <TableRow key={p.id}>
                                        <TableCell>
                                          {p.nombre}
                                          <small>
                                            Prioridad {p.prioridad}
                                            {!p.activo ? " · Inactivo" : ""}
                                          </small>
                                        </TableCell>
                                        <TableCell>
                                          {
                                            datos.papeles.find(
                                              (m) =>
                                                m.id === p.papelMateriaPrimaId,
                                            )?.nombre
                                          }{" "}
                                          · {p.gramaje} g
                                          <small>
                                            {p.tamano} ·{" "}
                                            {p.color === "COLOR"
                                              ? "Color"
                                              : "B/N"}{" "}
                                            ·{" "}
                                            {p.faz === 2
                                              ? "Doble faz"
                                              : "Simple faz"}
                                          </small>
                                        </TableCell>
                                        <TableCell>
                                          {p.modo === "AUTOMATICO"
                                            ? "Automático"
                                            : "Con preparación"}
                                        </TableCell>
                                        <TableCell>
                                          <Badge
                                            variant="outline"
                                            className={s.estado}
                                            data-status={
                                              p.probado ? "ok" : "pending"
                                            }
                                          >
                                            {p.probado ? (
                                              <CheckCircle2 />
                                            ) : (
                                              <Circle />
                                            )}{" "}
                                            {p.probado
                                              ? "Verificada"
                                              : "Pendiente"}
                                          </Badge>
                                        </TableCell>
                                        <TableCell>
                                          {gestionar && (
                                            <div className={s.acciones}>
                                              <ActionButton
                                                variant="tertiary"
                                                isDisabled={
                                                  bloqueado ||
                                                  !p.activo ||
                                                  !destino.activo
                                                }
                                                onPress={() =>
                                                  void ejecutar(async () => {
                                                    await imprimirPruebaPerfil(
                                                      tenantId,
                                                      destino.host,
                                                      p.id,
                                                    );
                                                    toast.info(
                                                      "Prueba enviada. Verificá bandeja, papel y faz antes de marcarla como correcta.",
                                                    );
                                                  })
                                                }
                                              >
                                                Imprimir prueba
                                              </ActionButton>
                                              <ActionButton
                                                variant="tertiary"
                                                isDisabled={bloqueado}
                                                onPress={() =>
                                                  setEditor({
                                                    tipo: "perfil",
                                                    id: p.id,
                                                    datos: {
                                                      bandejaId: bandeja.id,
                                                      nombre: p.nombre,
                                                      papelMateriaPrimaId:
                                                        p.papelMateriaPrimaId,
                                                      gramaje: p.gramaje,
                                                      tamano: p.tamano,
                                                      color: p.color,
                                                      faz: p.faz,
                                                      modo: p.modo,
                                                      probado: p.probado,
                                                      activo: p.activo,
                                                      prioridad: p.prioridad,
                                                      version: p.version,
                                                    },
                                                  })
                                                }
                                              >
                                                Editar
                                              </ActionButton>
                                            </div>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              )}
                              {operar && automaticos.length > 0 && (
                                <div className={s.preparacion}>
                                  <SelectField
                                    aria-label={`Papel cargado en ${bandeja.nombre}`}
                                    options={automaticos.map((p) => ({
                                      value: p.id,
                                      label: `${datos.papeles.find((m) => m.id === p.papelMateriaPrimaId)?.nombre} · ${p.gramaje} g (${p.nombre})`,
                                    }))}
                                    value={cargas[bandeja.id] ?? ""}
                                    onChange={(value) =>
                                      setCargas((prev) => ({
                                        ...prev,
                                        [bandeja.id]: value,
                                      }))
                                    }
                                    disabled={bloqueado}
                                  />
                                  <ActionButton
                                    variant="outline"
                                    isDisabled={
                                      bloqueado ||
                                      !cargas[bandeja.id] ||
                                      !destino.activo
                                    }
                                    onPress={() =>
                                      void ejecutar(() =>
                                        prepararBandejaImpresion(
                                          bandeja.id,
                                          bandeja.version,
                                          cargas[bandeja.id],
                                        ),
                                      )
                                    }
                                  >
                                    Confirmar papel cargado
                                  </ActionButton>
                                  {bandeja.papelPreparadoId && (
                                    <ActionButton
                                      variant="tertiary"
                                      isDisabled={bloqueado}
                                      onPress={() =>
                                        void ejecutar(() =>
                                          prepararBandejaImpresion(
                                            bandeja.id,
                                            bandeja.version,
                                          ),
                                        )
                                      }
                                    >
                                      Bandeja sin preparar
                                    </ActionButton>
                                  )}
                                </div>
                              )}
                            </section>
                          );
                        })}
                  </article>
                ))}
            </div>
          )}
        </Tabs.Panel>
        <Tabs.Panel id="etiquetas" className={s.tabPanel}>
          {etiquetas}
        </Tabs.Panel>
      </Tabs>
      {cadId && datos?.destinos.find((d) => d.id === cadId) && (
        <CadImpresionDialog
          key={cadId}
          tenantId={tenantId}
          destino={datos.destinos.find((d) => d.id === cadId)!}
          onClose={() => setCadId(null)}
          onSaved={cargar}
        />
      )}
      {editor && (
        <FormDialog
          isOpen
          onOpenChange={(open) => {
            if (!open && !ocupado) {
              setEditor(null);
              setError("");
            }
          }}
          isDismissable={!ocupado}
          title={
            editor.tipo === "destino" ? (
              <span className={s.modalTitulo}>
                <Icono />
                {editor.id
                  ? "Ajustes de impresora"
                  : tipo === "cad"
                    ? "Agregar plotter CAD"
                    : "Agregar impresora"}
              </span>
            ) : editor.tipo === "bandeja" ? (
              <span className={s.modalTitulo}>
                <Layers />
                Agregar bandeja
              </span>
            ) : (
              <span className={s.modalTitulo}>
                <Printer />
                Perfil de impresión
              </span>
            )
          }
          description={
            editor.tipo === "destino"
              ? "Conectá una cola de impresión con tu equipo de producción."
              : editor.tipo === "bandeja"
                ? `${destinoBandeja?.nombre ?? "Impresora"} · Origen del papel`
                : "Definí el papel y cómo se envían los trabajos."
          }
          className={s.dialog}
        >
          <div className={s.formulario}>
            {error && (
              <p role="alert" className={s.error}>
                {error}
              </p>
            )}
            <FieldGroup className={s.campos}>
              {editor.tipo === "destino" && (
                <>
                  <Campo nombre="Nombre">
                    <Input
                      aria-label="Nombre de la impresora"
                      value={editor.datos.nombre}
                      onChange={(e) => destinoCampo("nombre", e.target.value)}
                    />
                  </Campo>
                  <Campo nombre="Máquina de producción">
                    <SelectField
                      aria-label="Máquina de producción"
                      options={
                        datos?.maquinas
                          .filter(
                            (m) =>
                              m.id === editor.datos.maquinaId ||
                              (m.activo &&
                                (tipo === "cad"
                                  ? m.plantilla === "PLOTTER_CAD"
                                  : m.plantilla === "IMPRESORA_LASER")),
                          )
                          .map((m) => ({
                            value: m.id,
                            label: `${m.nombre}${m.activo ? "" : " · Inactiva"}`,
                            disabled: !m.activo,
                          })) ?? []
                      }
                      value={editor.datos.maquinaId}
                      onChange={(v) => destinoCampo("maquinaId", v)}
                    />
                  </Campo>
                  <Campo nombre="Equipo con QZ Tray">
                    <Input
                      aria-label="Equipo con QZ Tray"
                      placeholder="192.168.88.164"
                      value={editor.datos.host}
                      onChange={(e) => {
                        destinoCampo("host", e.target.value);
                        setColas([]);
                      }}
                    />
                  </Campo>
                  <Campo nombre="Impresora en Windows">
                    <Input
                      aria-label="Impresora en Windows"
                      value={editor.datos.impresora}
                      onChange={(e) =>
                        destinoCampo("impresora", e.target.value)
                      }
                    />
                    {colas.length > 0 && (
                      <SelectField
                        aria-label="Impresoras encontradas"
                        options={colas.map((v) => ({ value: v, label: v }))}
                        value={editor.datos.impresora}
                        onChange={(v) => destinoCampo("impresora", v)}
                      />
                    )}
                    <ActionButton
                      variant="outline"
                      isDisabled={bloqueado}
                      onPress={() =>
                        void ejecutar(async () =>
                          setColas(
                            await buscarImpresoras(editor.datos.host, tenantId),
                          ),
                        )
                      }
                    >
                      Buscar impresoras
                    </ActionButton>
                  </Campo>
                  <label className={s.check}>
                    <Checkbox
                      aria-label="Impresora activa"
                      checked={editor.datos.activo}
                      onCheckedChange={(v) =>
                        destinoCampo("activo", Boolean(v))
                      }
                      disabled={ocupado}
                    />{" "}
                    Impresora activa
                  </label>
                </>
              )}
              {editor.tipo === "bandeja" && (
                <>
                  <Campo nombre="Nombre visible">
                    <Input
                      aria-label="Nombre de la bandeja"
                      value={editor.nombre}
                      onChange={(e) =>
                        setEditor({ ...editor, nombre: e.target.value })
                      }
                      placeholder="Bandeja 1"
                    />
                  </Campo>
                  {destinoBandeja && (
                    <BandejasDetectadasField
                      key={`${tenantId}:${destinoBandeja.id}:${destinoBandeja.host}:${destinoBandeja.impresora}`}
                      tenantId={tenantId}
                      host={destinoBandeja.host}
                      impresora={destinoBandeja.impresora}
                      existentes={destinoBandeja.bandejas.map((b) => b.codigo)}
                      value={editor.codigo}
                      onChange={(codigo) =>
                        setEditor((prev) =>
                          prev?.tipo === "bandeja" ? { ...prev, codigo } : prev,
                        )
                      }
                      disabled={bloqueado}
                    />
                  )}
                  <p className={s.ayuda}>
                    Elegí una bandeja y poné un nombre fácil de reconocer.
                    Después, la prueba del perfil permite verificar de dónde
                    toma el papel.
                  </p>
                </>
              )}
              {editor.tipo === "perfil" && (
                <>
                  <Campo nombre="Nombre">
                    <Input
                      aria-label="Nombre del perfil"
                      value={editor.datos.nombre}
                      onChange={(e) => perfilCampo("nombre", e.target.value)}
                    />
                  </Campo>
                  <Campo nombre="Papel">
                    <SelectField
                      aria-label="Papel del perfil"
                      options={
                        datos?.papeles.map((p) => ({
                          value: p.id,
                          label: p.nombre,
                        })) ?? []
                      }
                      value={editor.datos.papelMateriaPrimaId}
                      onChange={(v) => perfilCampo("papelMateriaPrimaId", v)}
                    />
                  </Campo>
                  <Campo nombre="Gramaje">
                    <Input
                      aria-label="Gramaje"
                      type="number"
                      min={1}
                      max={1000}
                      value={editor.datos.gramaje}
                      onChange={(e) =>
                        perfilCampo("gramaje", Number(e.target.value))
                      }
                    />
                  </Campo>
                  <Campo nombre="Color · A4">
                    <SelectField
                      aria-label="Color del perfil"
                      options={[
                        { value: "BN", label: "Blanco y negro" },
                        { value: "COLOR", label: "Color" },
                      ]}
                      value={editor.datos.color}
                      onChange={(v) => perfilCampo("color", v)}
                    />
                  </Campo>
                  <Campo nombre="Faz">
                    <SelectField
                      aria-label="Faz"
                      options={[
                        { value: "1", label: "Simple" },
                        { value: "2", label: "Doble · borde largo" },
                      ]}
                      value={String(editor.datos.faz)}
                      onChange={(v) => perfilCampo("faz", Number(v))}
                    />
                  </Campo>
                  <Campo nombre="Modo de envío">
                    <SelectField
                      aria-label="Modo de envío"
                      options={[
                        {
                          value: "AUTOMATICO",
                          label: "Automático con papel confirmado",
                        },
                        {
                          value: "PREPARACION",
                          label: "Requiere preparación del operario",
                        },
                      ]}
                      value={editor.datos.modo}
                      onChange={(v) => perfilCampo("modo", v)}
                    />
                  </Campo>
                  <Campo nombre="Prioridad">
                    <Input
                      aria-label="Prioridad"
                      type="number"
                      min={1}
                      max={99}
                      value={editor.datos.prioridad}
                      onChange={(e) =>
                        perfilCampo("prioridad", Number(e.target.value))
                      }
                    />
                  </Campo>
                  <p className={s.ayuda}>
                    La prioridad más alta elige el destino cuando hay varias
                    opciones. Si empatan, el trabajo queda para revisar. Los
                    perfiles con preparación quedarán pendientes hasta
                    incorporar la cola del operario.
                  </p>
                  <label className={s.check}>
                    <Checkbox
                      aria-label="Perfil activo"
                      checked={editor.datos.activo}
                      onCheckedChange={(v) => perfilCampo("activo", Boolean(v))}
                      disabled={ocupado}
                    />{" "}
                    Perfil activo
                  </label>
                  <label className={s.check}>
                    <Checkbox
                      aria-label="Prueba física verificada"
                      checked={editor.datos.probado}
                      onCheckedChange={(v) =>
                        perfilCampo("probado", Boolean(v))
                      }
                      disabled={ocupado}
                    />{" "}
                    Verifiqué en una prueba física el papel, la bandeja, el
                    color y la faz
                  </label>
                  <p className={s.ayuda}>
                    Al cambiar el papel, gramaje, color o faz se deberá repetir
                    la prueba.
                  </p>
                </>
              )}
            </FieldGroup>
          </div>
          <footer className={s.footer}>
            <ActionButton
              variant="tertiary"
              isDisabled={ocupado}
              onPress={() => {
                setEditor(null);
                setError("");
              }}
            >
              Cancelar
            </ActionButton>
            <ActionButton
              isDisabled={
                bloqueado ||
                (editor.tipo === "bandeja" &&
                  (!destinoBandeja || !editor.nombre.trim() || !editor.codigo))
              }
              onPress={guardar}
            >
              {ocupado ? "Guardando…" : "Guardar"}
            </ActionButton>
          </footer>
        </FormDialog>
      )}
    </>
  );
}
