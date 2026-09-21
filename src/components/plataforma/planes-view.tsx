"use client";

import fieldFocus from "@/components/design-system/field-focus.module.css";

import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  FilePenLine,
  ListChecks,
  LockKeyhole,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { ActionButton } from "@/components/design-system/action-button";
import { Input } from "@heroui/react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import brandTheme from "@/components/design-system/brand-workspace-theme.module.css";
import { SelectField } from "@/components/design-system/select-field";
import { FormDialog } from "@/components/design-system/form-dialog";
import {
  consultarBorradores,
  guardarBorradores,
  problemasPlan,
  revisionComercial,
  type BorradorPlan,
  type CatalogoPlanesRespuesta,
  type ContenidoPlan,
} from "@/lib/plataforma-planes-api";
import styles from "./planes.module.css";
import { PlanesComparacion } from "./planes-comparacion";

export type SalidaPlanes = { cambios: number; guardar: () => Promise<boolean> };
type Props = {
  esAdmin: boolean;
  planesActuales: React.ReactNode;
  onSalidaChange?: (estado: SalidaPlanes | null) => void;
};

export function PlanesView({ esAdmin, planesActuales, onSalidaChange }: Props) {
  const [datos, setDatos] = React.useState<CatalogoPlanesRespuesta | null>(
    null,
  );
  const [planes, setPlanes] = React.useState<BorradorPlan[]>([]);
  const [error, setError] = React.useState("");
  const [guardando, setGuardando] = React.useState(false);
  const [cargando, setCargando] = React.useState(true);
  const [pestana, setPestana] = React.useState("matriz");
  const [busqueda, setBusqueda] = React.useState("");
  const [diferencias, setDiferencias] = React.useState(false);
  const [cerrados, setCerrados] = React.useState<string[]>(["B"]);
  const [recargar, setRecargar] = React.useState(false);
  const guardandoRef = React.useRef(false);

  const cargar = React.useCallback(async () => {
    setCargando(true);
    try {
      const respuesta = await consultarBorradores();
      setDatos(respuesta);
      setPlanes(respuesta.borradores);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudieron cargar los planes.",
      );
    } finally {
      setCargando(false);
    }
  }, []);
  React.useEffect(() => {
    void cargar();
  }, [cargar]);
  const cambios = React.useMemo(
    () =>
      planes.filter(
        (p) =>
          JSON.stringify(p.contenido) !==
          JSON.stringify(
            datos?.borradores.find((d) => d.id === p.id)?.contenido,
          ),
      ),
    [planes, datos],
  );
  const errores = React.useMemo(
    () =>
      planes.flatMap((p) =>
        problemasPlan(p.contenido).map(
          (error) => `${p.contenido.nombre}: ${error}`,
        ),
      ),
    [planes],
  );
  const versionCompatible =
    !!datos && planes.every((p) => p.catalogoVersion === datos.catalogoVersion);
  const guardar = React.useCallback(async () => {
    if (
      !esAdmin ||
      !datos ||
      errores.length ||
      !versionCompatible ||
      guardandoRef.current
    )
      return false;
    if (!cambios.length) return true;
    guardandoRef.current = true;
    setGuardando(true);
    try {
      const resultado = await guardarBorradores(datos.catalogoVersion, cambios);
      const merge = (lista: BorradorPlan[]) =>
        lista.map((p) => resultado.borradores.find((d) => d.id === p.id) ?? p);
      setPlanes(merge);
      setDatos((d) => (d ? { ...d, borradores: merge(d.borradores) } : d));
      setError("");
      toast.success("Propuesta guardada.");
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo guardar la propuesta.",
      );
      return false;
    } finally {
      guardandoRef.current = false;
      setGuardando(false);
    }
  }, [esAdmin, datos, errores, versionCompatible, cambios]);

  React.useEffect(() => {
    onSalidaChange?.({ cambios: cambios.length, guardar });
  }, [onSalidaChange, cambios.length, guardar]);
  React.useEffect(() => () => onSalidaChange?.(null), [onSalidaChange]);
  React.useEffect(() => {
    if (!cambios.length) return;
    const evitar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", evitar);
    return () => window.removeEventListener("beforeunload", evitar);
  }, [cambios.length]);

  function editar(id: string, patch: Partial<ContenidoPlan>) {
    if (!esAdmin || guardandoRef.current || !versionCompatible) return;
    setPlanes((ps) =>
      ps.map((p) =>
        p.id === id ? { ...p, contenido: { ...p.contenido, ...patch } } : p,
      ),
    );
  }
  const readonly = !esAdmin || guardando || !versionCompatible;
  const filtrar = (texto: string) =>
    texto
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
  const visibles =
    datos?.capacidades.filter(
      (c) =>
        filtrar(
          `${c.nombre} ${c.descripcion} ${datos.grupos[c.grupo]}`,
        ).includes(filtrar(busqueda)) &&
        (!diferencias ||
          new Set(planes.map((p) => p.contenido.funciones[c.clave])).size > 1),
    ) ?? [];

  return (
    <section
      className={`${styles.page} ${brandTheme.legacy}`}
      aria-label="Editor de planes"
    >
      <header className={styles.intro}>
        <div>
          <span className={styles.eyebrow}>OFERTA DE GRAFO</span>
          <h2>Tres planes. Una operación que crece.</h2>
          <p>Compará funciones y ajustá la propuesta comercial.</p>
        </div>
        <Badge variant="outline">
          <FilePenLine /> Borradores
        </Badge>
      </header>
      <Tabs
        className={styles.tabs}
        value={pestana}
        onValueChange={(v) => setPestana(String(v))}
      >
        <TabsList
          className={styles.tabList}
          variant="graphite"
          aria-label="Vistas de planes"
        >
          <TabsTrigger value="matriz">Funciones</TabsTrigger>
          <TabsTrigger value="recursos">Usuarios y oferta</TabsTrigger>
          <TabsTrigger value="revision">Revisión</TabsTrigger>
          <TabsTrigger value="actuales">Planes actuales</TabsTrigger>
        </TabsList>
        <TabsContent value={pestana} className={styles.content}>
          {pestana === "actuales" ? (
            <div className={styles.legacyContent}>{planesActuales}</div>
          ) : (
            <>
              {error && (
                <Alert variant="destructive">
                  <AlertTitle>No se completó la operación</AlertTitle>
                  <AlertDescription>
                    {error}{" "}
                    {cambios.length > 0 && "Tus cambios siguen en pantalla."}
                  </AlertDescription>
                  <ActionButton
                    variant="outline"
                    onPress={() =>
                      cambios.length ? setRecargar(true) : void cargar()
                    }
                    isDisabled={guardando || cargando}
                  >
                    Recargar planes
                  </ActionButton>
                </Alert>
              )}
              {cargando ? (
                <p role="status">Cargando propuesta…</p>
              ) : !datos ? null : !planes.length ? (
                <Alert>
                  <AlertTitle>Propuesta pendiente de preparar</AlertTitle>
                  <AlertDescription>
                    La instalación debe aplicar la migración de borradores de
                    planes.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  {!versionCompatible && (
                    <Alert variant="destructive">
                      <AlertTitle>El catálogo necesita actualizarse</AlertTitle>
                      <AlertDescription>
                        Estos borradores pertenecen a otra versión. Recargá
                        antes de editar.
                      </AlertDescription>
                    </Alert>
                  )}
                  {pestana === "matriz" && (
                    <>
                      <div className={styles.toolbar}>
                        <Field>
                          <FieldLabel htmlFor="buscar-funcion">
                            Buscar funciones
                          </FieldLabel>
                          <Input
                            className={fieldFocus.singleBorder}
                            fullWidth
                            id="buscar-funcion"
                            placeholder="Compras, CAD, planificación…"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                          />
                        </Field>
                        <Field orientation="horizontal">
                          <Checkbox
                            id="solo-diferencias"
                            aria-label="Sólo diferencias"
                            checked={diferencias}
                            onCheckedChange={setDiferencias}
                          />
                          <FieldLabel htmlFor="solo-diferencias">
                            Sólo diferencias
                          </FieldLabel>
                        </Field>
                        <span>{visibles.length} funciones · 3 recursos</span>
                      </div>
                      <div
                        className={styles.scroll}
                        tabIndex={0}
                        role="region"
                        aria-label="Comparación de funciones por plan"
                      >
                        <table className={styles.matrix}>
                          <caption className="sr-only">
                            Funciones propuestas para Esencial, Pro y Avanzado
                          </caption>
                          <thead>
                            <tr>
                              <th scope="col">Funciones del sistema</th>
                              {planes.map((p) => (
                                <th key={p.id} scope="col">
                                  <span>{p.contenido.nombre}</span>
                                  <strong>
                                    {p.contenido.usuariosIncluidos}{" "}
                                    <small>usuarios incluidos</small>
                                  </strong>
                                  <p>{p.contenido.descripcion}</p>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(datos.grupos).map(
                              ([grupo, nombre]) => {
                                const filas = visibles.filter(
                                  (c) => c.grupo === grupo,
                                );
                                if (!filas.length) return null;
                                const cerrado =
                                  cerrados.includes(grupo) && !busqueda;
                                return (
                                  <React.Fragment key={grupo}>
                                    <tr className={styles.group}>
                                      <th colSpan={planes.length + 1}>
                                        <ActionButton
                                          variant="ghost"
                                          size="sm"
                                          aria-expanded={!cerrado}
                                          onPress={() =>
                                            setCerrados((v) =>
                                              v.includes(grupo)
                                                ? v.filter((x) => x !== grupo)
                                                : [...v, grupo],
                                            )
                                          }
                                        >
                                          {cerrado ? (
                                            <ChevronRight data-icon="inline-start" />
                                          ) : (
                                            <ChevronDown data-icon="inline-start" />
                                          )}
                                          {nombre}
                                          <Badge variant="secondary">
                                            {filas.length}
                                          </Badge>
                                        </ActionButton>
                                      </th>
                                    </tr>
                                    {!cerrado &&
                                      filas.map((c) => (
                                        <tr key={c.clave}>
                                          <th scope="row">
                                            <details>
                                              <summary>{c.nombre}</summary>
                                              <p>{c.descripcion}</p>
                                              <p>{c.nota}</p>
                                              {c.requiere.length > 0 && (
                                                <p>
                                                  Requiere:{" "}
                                                  {c.requiere
                                                    .map(
                                                      (k) =>
                                                        datos.capacidades.find(
                                                          (d) => d.clave === k,
                                                        )?.nombre,
                                                    )
                                                    .join(", ")}
                                                  .
                                                </p>
                                              )}
                                              <p>
                                                Control por plan:{" "}
                                                {c.cobertura === "base"
                                                  ? "base de la cuenta"
                                                  : c.cobertura === "parcial"
                                                    ? "existente, requiere completar validación"
                                                    : "pendiente de implementar"}
                                                .
                                              </p>
                                              {c.revisionOperativa && (
                                                <p>
                                                  Revisión operativa pendiente
                                                  antes de ofrecerla.
                                                </p>
                                              )}
                                            </details>
                                          </th>
                                          {planes.map((p) => (
                                            <td key={p.id}>
                                              {c.base ? (
                                                <Badge variant="secondary">
                                                  <LockKeyhole /> Base
                                                </Badge>
                                              ) : c.destino !== "plan" ? (
                                                <small>
                                                  {c.destino === "adicional"
                                                    ? "Adicional previsto"
                                                    : c.clave === "mcp"
                                                      ? "Piloto interno"
                                                      : "Sólo Founder"}
                                                </small>
                                              ) : (
                                                <div className={styles.choice}>
                                                  <Checkbox
                                                    aria-label={`${c.nombre} · ${p.contenido.nombre}`}
                                                    checked={
                                                      !!p.contenido.funciones[
                                                        c.clave
                                                      ]
                                                    }
                                                    disabled={readonly}
                                                    onCheckedChange={(valor) =>
                                                      editar(p.id, {
                                                        funciones: {
                                                          ...p.contenido
                                                            .funciones,
                                                          [c.clave]: valor,
                                                        },
                                                      })
                                                    }
                                                  />
                                                  <span
                                                    className={
                                                      styles.choiceLabel
                                                    }
                                                    aria-hidden="true"
                                                  >
                                                    {p.contenido.funciones[
                                                      c.clave
                                                    ]
                                                      ? "Incluido"
                                                      : "—"}
                                                  </span>
                                                </div>
                                              )}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                  </React.Fragment>
                                );
                              },
                            )}
                            {!visibles.length && (
                              <tr>
                                <td colSpan={planes.length + 1}>
                                  No hay funciones que coincidan con estos
                                  filtros.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                  {pestana === "recursos" && (
                    <div className={styles.cards}>
                      {planes.map((p) => (
                        <section
                          className={styles.card}
                          key={p.id}
                          aria-label={`Oferta de ${p.contenido.nombre}`}
                        >
                          <h3>{p.contenido.nombre}</h3>
                          <FieldGroup>
                            <Field>
                              <FieldLabel htmlFor={`nombre-${p.id}`}>
                                Nombre
                              </FieldLabel>
                              <Input
                                className={fieldFocus.singleBorder}
                                fullWidth
                                id={`nombre-${p.id}`}
                                value={p.contenido.nombre}
                                maxLength={60}
                                disabled={readonly}
                                onChange={(e) =>
                                  editar(p.id, { nombre: e.target.value })
                                }
                              />
                            </Field>
                            <Field>
                              <FieldLabel htmlFor={`descripcion-${p.id}`}>
                                Propuesta principal
                              </FieldLabel>
                              <Input
                                className={fieldFocus.singleBorder}
                                fullWidth
                                id={`descripcion-${p.id}`}
                                value={p.contenido.descripcion}
                                maxLength={200}
                                disabled={readonly}
                                onChange={(e) =>
                                  editar(p.id, { descripcion: e.target.value })
                                }
                              />
                            </Field>
                            <Field>
                              <FieldLabel htmlFor={`usuarios-${p.id}`}>
                                Usuarios incluidos
                              </FieldLabel>
                              <Input
                                className={fieldFocus.singleBorder}
                                fullWidth
                                id={`usuarios-${p.id}`}
                                type="number"
                                min={1}
                                max={10000}
                                value={p.contenido.usuariosIncluidos || ""}
                                disabled={readonly}
                                onChange={(e) =>
                                  editar(p.id, {
                                    usuariosIncluidos: Number(e.target.value),
                                  })
                                }
                              />
                              <FieldDescription>
                                Personas habilitadas en la empresa. Los clientes
                                que abren enlaces públicos no ocupan un lugar.
                              </FieldDescription>
                            </Field>
                            <Field orientation="horizontal">
                              <Checkbox
                                id={`adicionales-${p.id}`}
                                aria-label={`Permitir usuarios adicionales pagos · ${p.contenido.nombre}`}
                                checked={p.contenido.adicionalesPermitidos}
                                disabled={readonly}
                                onCheckedChange={(v) =>
                                  editar(p.id, { adicionalesPermitidos: v })
                                }
                              />
                              <FieldLabel htmlFor={`adicionales-${p.id}`}>
                                Permitir usuarios adicionales pagos
                              </FieldLabel>
                            </Field>
                            <Field>
                              <FieldLabel>Almacenamiento</FieldLabel>
                              <SelectField
                                aria-label={`Almacenamiento de ${p.contenido.nombre}`}
                                disabled={readonly}
                                value={p.contenido.almacenamientoModo}
                                options={[
                                  { value: "pendiente", label: "Por definir" },
                                  { value: "limitado", label: "Cupo en GB" },
                                  {
                                    value: "ilimitado",
                                    label: "Sin límite comercial",
                                  },
                                ]}
                                onChange={(v) =>
                                  editar(p.id, {
                                    almacenamientoModo:
                                      v as ContenidoPlan["almacenamientoModo"],
                                    almacenamientoGb:
                                      v === "limitado"
                                        ? (p.contenido.almacenamientoGb ?? 10)
                                        : null,
                                  })
                                }
                              />
                              {p.contenido.almacenamientoModo ===
                                "limitado" && (
                                <Input
                                  className={fieldFocus.singleBorder}
                                  fullWidth
                                  aria-label={`GB de ${p.contenido.nombre}`}
                                  type="number"
                                  min={1}
                                  max={100000}
                                  value={p.contenido.almacenamientoGb ?? ""}
                                  disabled={readonly}
                                  onChange={(e) =>
                                    editar(p.id, {
                                      almacenamientoGb: Number(e.target.value),
                                    })
                                  }
                                />
                              )}
                            </Field>
                            <Field>
                              <FieldLabel>Órdenes y presupuestos</FieldLabel>
                              <FieldDescription>
                                Sin cupo comercial en la propuesta.
                              </FieldDescription>
                            </Field>
                            <Field>
                              <FieldLabel>
                                Precio del plan y de adicionales
                              </FieldLabel>
                              <FieldDescription>
                                Por definir. La vinculación de precios actuales
                                permanece en su propia pestaña.
                              </FieldDescription>
                            </Field>
                          </FieldGroup>
                        </section>
                      ))}
                    </div>
                  )}
                  {pestana === "revision" && (
                    <>
                      <PlanesComparacion
                        planes={planes.map((p) => p.contenido)}
                        catalogoVersion={datos.catalogoVersion}
                        invalida={errores.length > 0 || !versionCompatible}
                      />
                      <Alert>
                        <ListChecks />
                        <AlertTitle>
                          Propuesta comercial en preparación
                        </AlertTitle>
                        <AlertDescription>
                          Guardar conserva estos borradores. Para ofrecerlos
                          faltan los precios, la publicación con versiones y
                          completar los controles de acceso. Las empresas
                          conservan su plan actual.
                        </AlertDescription>
                      </Alert>
                      <div className={styles.cards}>
                        {planes.map((p) => {
                          const r = revisionComercial(p.contenido);
                          return (
                            <section className={styles.card} key={p.id}>
                              <h3>{p.contenido.nombre}</h3>
                              <Badge variant="outline">
                                Revisión {p.revision}
                              </Badge>
                              <p>
                                {r.incluidas} funciones incluidas ·{" "}
                                {p.contenido.usuariosIncluidos} usuarios
                              </p>
                              <ul>
                                {r.pendientes.map((v) => (
                                  <li key={v}>{v}</li>
                                ))}
                              </ul>
                              {r.revisionOperativa.length > 0 && (
                                <details>
                                  <summary>
                                    Funciones por validar operativamente
                                  </summary>
                                  <ul>
                                    {r.revisionOperativa.map((v) => (
                                      <li key={v}>{v}</li>
                                    ))}
                                  </ul>
                                </details>
                              )}
                            </section>
                          );
                        })}
                      </div>
                      <Alert>
                        <LockKeyhole />
                        <AlertTitle>
                          Founder conserva la impresión conectada
                        </AlertTitle>
                        <AlertDescription>
                          Impresión directa y su asistente siguen como piloto.
                          Las herramientas especializadas de fabricación quedan
                          previstas como adicionales.
                        </AlertDescription>
                      </Alert>
                    </>
                  )}
                  {errores.length > 0 && (
                    <Alert variant="destructive">
                      <AlertTitle>
                        Revisá las dependencias y los datos
                      </AlertTitle>
                      <AlertDescription>
                        <ul>
                          {errores.map((e) => (
                            <li key={e}>{e}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
      <footer className={styles.footer}>
        <div>
          <strong>
            {cargando
              ? "Cargando propuesta…"
              : !datos
                ? "Propuesta sin cargar"
                : cambios.length
                  ? `${cambios.length} ${cambios.length === 1 ? "plan modificado" : "planes modificados"}`
                  : "Propuesta guardada"}
          </strong>
          <p>
            {esAdmin
              ? "Borradores separados de las suscripciones vigentes."
              : "Acceso de consulta. Administración puede editar la propuesta."}
          </p>
        </div>
        <div className={styles.actions}>
          <ActionButton
            variant="outline"
            onPress={() => setPestana("revision")}
          >
            <ListChecks data-icon="inline-start" />
            Revisar propuesta
          </ActionButton>
          {esAdmin && (
            <ActionButton
              isDisabled={
                !cambios.length ||
                errores.length > 0 ||
                guardando ||
                cargando ||
                !versionCompatible
              }
              onPress={() => void guardar()}
            >
              <Save data-icon="inline-start" />
              {guardando ? "Guardando…" : "Guardar borradores"}
              {cambios.length > 0 && (
                <Badge variant="secondary">{cambios.length}</Badge>
              )}
            </ActionButton>
          )}
        </div>
      </footer>
      <FormDialog
        isOpen={recargar}
        onOpenChange={setRecargar}
        title="Recargar la propuesta"
        description="Se descartarán los cambios que siguen en pantalla y se cargarán las revisiones guardadas."
      >
        <div className={styles.dialogActions}>
          <ActionButton variant="outline" onPress={() => setRecargar(false)}>
            Seguir editando
          </ActionButton>
          <ActionButton
            onPress={() => {
              setRecargar(false);
              void cargar();
            }}
          >
            Descartar y recargar
          </ActionButton>
        </div>
      </FormDialog>
    </section>
  );
}
