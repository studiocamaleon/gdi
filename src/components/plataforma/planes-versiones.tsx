"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@heroui/react";
import { History, LockKeyhole, Upload } from "lucide-react";
import { toast } from "sonner";
import { ActionButton } from "@/components/design-system/action-button";
import { FormDialog } from "@/components/design-system/form-dialog";
import { SelectField } from "@/components/design-system/select-field";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import fieldFocus from "@/components/design-system/field-focus.module.css";
import {
  consultarVersionesPlan,
  consultarVersionPlan,
  publicarVersionPlan,
  problemasPublicacionPlan,
  type BorradorPlan,
  type CatalogoPlanesRespuesta,
  type HistorialPlanes,
  type VersionPlan,
} from "@/lib/plataforma-planes-api";
import styles from "./planes-versiones.module.css";
import { PlanAsignacionDialog } from "./plan-asignacion-dialog";
import { PlanOfertaDialog } from "./plan-oferta-dialog";

const fecha = (value: string) => new Date(value).toLocaleString("es-AR");
const mensaje = (e: unknown) =>
  e instanceof Error ? e.message : "No se pudo completar la operación.";
type Snapshot = Pick<VersionPlan, "contenido" | "catalogoSnapshot">;

function Resumen({ contenido: p, catalogoSnapshot: c }: Snapshot) {
  return (
    <div className={styles.summary}>
      <p>{p.descripcion}</p>
      <dl className={styles.metrics}>
        <div>
          <dt>Usuarios incluidos</dt>
          <dd>{p.usuariosIncluidos}</dd>
        </div>
        <div>
          <dt>Usuarios adicionales</dt>
          <dd>{p.adicionalesPermitidos ? "Permitidos" : "No incluidos"}</dd>
        </div>
        <div>
          <dt>Almacenamiento</dt>
          <dd>
            {p.almacenamientoModo === "limitado"
              ? `${p.almacenamientoGb} GB`
              : p.almacenamientoModo === "ilimitado"
                ? "Sin límite comercial"
                : "Por definir"}
          </dd>
        </div>
      </dl>
      {p.precios && (
        <dl className={styles.metrics}>
          <div>
            <dt>Precio mensual</dt>
            <dd>
              {p.precios.mensual == null
                ? "Por definir"
                : `${p.precios.moneda} ${p.precios.mensual}`}
            </dd>
          </div>
          <div>
            <dt>Precio anual</dt>
            <dd>
              {p.precios.anual == null
                ? "Por definir"
                : `${p.precios.moneda} ${p.precios.anual}`}
            </dd>
          </div>
          <div>
            <dt>Usuario adicional / mes</dt>
            <dd>
              {!p.adicionalesPermitidos
                ? "No disponible"
                : p.precios.usuarioMensual == null
                  ? "Por definir"
                  : `${p.precios.moneda} ${p.precios.usuarioMensual}`}
            </dd>
          </div>
          {p.precios.usuarioAnual != null && (
            <div>
              <dt>Usuario adicional / año</dt>
              <dd>
                {p.precios.moneda} {p.precios.usuarioAnual}
              </dd>
            </div>
          )}
        </dl>
      )}
      {p.comercial && (
        <dl className={styles.metrics}>
          <div>
            <dt>Disponibilidad</dt>
            <dd>
              {p.comercial.acceso === "invitacion"
                ? "Sólo por invitación"
                : "Registro público"}
            </dd>
          </div>
          <div>
            <dt>Prueba sin tarjeta</dt>
            <dd>{p.comercial.trialDias} días</dd>
          </div>
          <div>
            <dt>Implementación · pago único</dt>
            <dd>USD {p.comercial.implementacion}</dd>
          </div>
        </dl>
      )}
      <details>
        <summary>
          Funciones incluidas (
          {Object.values(p.funciones).filter(Boolean).length})
        </summary>
        {Object.entries(c.grupos).map(([clave, nombre]) => {
          const funciones = c.capacidades.filter(
            (f) => f.grupo === clave && p.funciones[f.clave],
          );
          return funciones.length ? (
            <section key={clave}>
              <strong>{nombre}</strong>
              <ul>
                {funciones.map((f) => (
                  <li key={f.clave}>{f.nombre}</li>
                ))}
              </ul>
            </section>
          ) : null;
        })}
      </details>
      <details>
        <summary>Funciones fuera de esta versión</summary>
        <ul>
          {c.capacidades
            .filter((f) => !p.funciones[f.clave])
            .map((f) => (
              <li key={f.clave}>{f.nombre}</li>
            ))}
        </ul>
      </details>
    </div>
  );
}

export function PlanesVersiones({
  datos,
  modificados,
  esAdmin,
  onRecargar,
}: {
  datos: CatalogoPlanesRespuesta;
  modificados: string[];
  esAdmin: boolean;
  onRecargar: () => void;
}) {
  const [id, setId] = useState(datos.borradores[0]?.id ?? "");
  const [historial, setHistorial] = useState<HistorialPlanes | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [recarga, setRecarga] = useState(0);
  const [seleccion, setSeleccion] = useState<BorradorPlan | null>(null);
  const [detalle, setDetalle] = useState<VersionPlan | null>(null);
  const [asignar, setAsignar] = useState<VersionPlan | null>(null);
  const [ofertar, setOfertar] = useState<VersionPlan | null>(null);
  const [motivo, setMotivo] = useState("");
  const [errorPublicacion, setErrorPublicacion] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const enCurso = useRef(false);
  const plan = datos.borradores.find((p) => p.id === id);
  const problemas = plan ? problemasPublicacionPlan(plan.contenido) : [];
  const cambiado = modificados.includes(id);
  const yaPublicada = historial?.versiones.some(
    (v) => v.revisionBorrador === plan?.revision,
  );
  const catalogo = { capacidades: datos.capacidades, grupos: datos.grupos };

  useEffect(() => {
    let activo = true;
    setHistorial(null);
    setCargando(true);
    setError("");
    consultarVersionesPlan(id)
      .then((r) => {
        if (activo) setHistorial(r);
      })
      .catch((e) => {
        if (activo) setError(mensaje(e));
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [id, recarga]);

  async function ver(idVersion: string) {
    if (enCurso.current) return;
    enCurso.current = true;
    setOcupado(true);
    setError("");
    try {
      setDetalle(await consultarVersionPlan(idVersion));
    } catch (e) {
      setError(mensaje(e));
    } finally {
      enCurso.current = false;
      setOcupado(false);
    }
  }
  async function mas() {
    if (enCurso.current || !historial?.siguiente) return;
    enCurso.current = true;
    setOcupado(true);
    setError("");
    try {
      const r = await consultarVersionesPlan(id, historial.siguiente);
      setHistorial({
        versiones: [...historial.versiones, ...r.versiones],
        siguiente: r.siguiente,
      });
    } catch (e) {
      setError(mensaje(e));
    } finally {
      enCurso.current = false;
      setOcupado(false);
    }
  }
  async function publicar(prepararOferta = false) {
    if (!seleccion || enCurso.current || motivo.trim().length < 5) return;
    enCurso.current = true;
    setOcupado(true);
    setErrorPublicacion("");
    try {
      const r = await publicarVersionPlan(seleccion, motivo.trim());
      setSeleccion(null);
      if (prepararOferta) setOfertar(r);
      else setDetalle(r);
      setRecarga((n) => n + 1);
      toast.success(`Versión ${r.numero} publicada.`);
    } catch (e) {
      setErrorPublicacion(mensaje(e));
    } finally {
      enCurso.current = false;
      setOcupado(false);
    }
  }

  return (
    <div className={styles.page}>
      <Alert>
        <LockKeyhole />
        <AlertTitle>Versiones de funciones y cupos</AlertTitle>
        <AlertDescription>
          Publicar conserva una copia fija del plan. Las próximas ediciones se
          hacen en el borrador. Las versiones se asignan a contratos manuales
          después de revisar su impacto. Desde el contenido de una versión podés
          preparar su oferta comercial y validar los precios en Paddle.
        </AlertDescription>
      </Alert>
      <div className={styles.toolbar}>
        <Field>
          <FieldLabel>Plan</FieldLabel>
          <SelectField
            aria-label="Plan del historial"
            value={id}
            disabled={ocupado}
            onChange={setId}
            options={datos.borradores.map((p) => ({
              value: p.id,
              label: p.contenido.nombre,
            }))}
          />
        </Field>
        <ActionButton
          variant="outline"
          isDisabled={ocupado || cargando}
          onPress={() => setRecarga((n) => n + 1)}
        >
          Actualizar historial
        </ActionButton>
      </div>
      {plan && (
        <section className={styles.draft}>
          <div>
            <span className={styles.eyebrow}>
              BORRADOR GUARDADO · REVISIÓN {plan.revision}
            </span>
            <h3>{plan.contenido.nombre}</h3>
            <p>
              {plan.contenido.usuariosIncluidos} usuarios incluidos ·{" "}
              {Object.values(plan.contenido.funciones).filter(Boolean).length}{" "}
              funciones
            </p>
            {cambiado && (
              <p>Guardá los cambios de este plan antes de publicar.</p>
            )}
            {problemas.length > 0 && (
              <ul>
                {problemas.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
            {plan.catalogoVersion !== datos.catalogoVersion && (
              <p>Recargá el catálogo antes de publicar.</p>
            )}
          </div>
          {esAdmin ? (
            <ActionButton
              isDisabled={
                ocupado ||
                cargando ||
                !historial ||
                cambiado ||
                problemas.length > 0 ||
                yaPublicada ||
                plan.catalogoVersion !== datos.catalogoVersion
              }
              onPress={() => {
                setSeleccion(plan);
                setMotivo("");
                setErrorPublicacion("");
              }}
            >
              <Upload data-icon="inline-start" />
              {yaPublicada ? "Revisión publicada" : "Revisar publicación"}
            </ActionButton>
          ) : (
            <Badge variant="outline">Acceso de consulta</Badge>
          )}
        </section>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertTitle>No se pudo completar la consulta</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <section className={styles.history} aria-label="Historial de versiones">
        <h3>
          <History size={17} /> Historial de versiones
        </h3>
        {cargando ? (
          <p role="status">Cargando versiones…</p>
        ) : historial?.versiones.length === 0 ? (
          <p>Todavía no hay versiones publicadas de este plan.</p>
        ) : null}
        {historial?.versiones.map((v) => (
          <article key={v.id} className={styles.row}>
            <div>
              <strong>
                Versión {v.numero} · {v.contenido.nombre}
              </strong>
              <p>
                {fecha(v.publicadoEl)} · {v.publicadoPorNombre} · revisión{" "}
                {v.revisionBorrador}
              </p>
              <p>{v.motivo}</p>
            </div>
            <ActionButton
              variant="outline"
              isDisabled={ocupado}
              onPress={() => void ver(v.id)}
              aria-label={`Ver versión ${v.numero}`}
            >
              Ver contenido
            </ActionButton>
          </article>
        ))}
        {historial?.siguiente && (
          <ActionButton
            variant="outline"
            isDisabled={ocupado}
            onPress={() => void mas()}
          >
            Cargar versiones anteriores
          </ActionButton>
        )}
      </section>
      <FormDialog
        isOpen={!!seleccion}
        onOpenChange={(open) => {
          if (!open && !ocupado) setSeleccion(null);
        }}
        isDismissable={!ocupado}
        title="Publicar versión del plan"
        description="Revisá el contenido guardado. Una versión publicada queda fija y conserva su historial."
      >
        {seleccion && (
          <>
            <div className={styles.dialogBody}>
              <h3>
                {seleccion.contenido.nombre} · revisión {seleccion.revision}
              </h3>
              <Resumen
                contenido={seleccion.contenido}
                catalogoSnapshot={catalogo}
              />
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="motivo-publicacion">
                    Motivo de la publicación
                  </FieldLabel>
                  <Input
                    id="motivo-publicacion"
                    className={fieldFocus.singleBorder}
                    fullWidth
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    maxLength={500}
                    disabled={ocupado}
                  />
                  <FieldDescription>
                    Queda registrado junto con tu nombre y la fecha. Mínimo 5
                    caracteres.
                  </FieldDescription>
                </Field>
              </FieldGroup>
              {errorPublicacion && (
                <Alert variant="destructive">
                  <AlertTitle>No se pudo publicar</AlertTitle>
                  <AlertDescription>{errorPublicacion}</AlertDescription>
                  <ActionButton
                    variant="outline"
                    isDisabled={ocupado}
                    onPress={() => {
                      setSeleccion(null);
                      onRecargar();
                    }}
                  >
                    Recargar borradores
                  </ActionButton>
                </Alert>
              )}
            </div>
            <div className={styles.dialogFooter}>
              <ActionButton
                variant="outline"
                isDisabled={ocupado}
                onPress={() => setSeleccion(null)}
              >
                Volver
              </ActionButton>
              <ActionButton
                isDisabled={ocupado || motivo.trim().length < 5}
                onPress={() => void publicar()}
              >
                {ocupado ? "Publicando…" : "Publicar versión"}
              </ActionButton>
              {seleccion.contenido.comercial && (
                <ActionButton
                  isDisabled={ocupado || motivo.trim().length < 5}
                  onPress={() => void publicar(true)}
                >
                  Publicar y preparar oferta
                </ActionButton>
              )}
            </div>
          </>
        )}
      </FormDialog>
      <FormDialog
        isOpen={!!detalle}
        onOpenChange={(open) => {
          if (!open) setDetalle(null);
        }}
        title={
          detalle
            ? `${detalle.contenido.nombre} · versión ${detalle.numero}`
            : "Versión del plan"
        }
        description="Contenido publicado. Para cambiarlo, editá el borrador y publicá una nueva versión."
      >
        {detalle && (
          <div className={styles.dialogBody}>
            <p>
              {fecha(detalle.publicadoEl)} · {detalle.publicadoPorNombre}
            </p>
            <p>{detalle.motivo}</p>
            <Resumen {...detalle} />
          </div>
        )}
        <div className={styles.dialogFooter}>
          {detalle && (
            <ActionButton
              variant="outline"
              onPress={() => {
                setOfertar(detalle);
                setDetalle(null);
              }}
            >
              Oferta comercial
            </ActionButton>
          )}
          {detalle && (
            <ActionButton
              onPress={() => {
                setAsignar(detalle);
                setDetalle(null);
              }}
            >
              Evaluar asignación
            </ActionButton>
          )}
          <ActionButton variant="outline" onPress={() => setDetalle(null)}>
            Cerrar
          </ActionButton>
        </div>
      </FormDialog>
      {asignar && (
        <PlanAsignacionDialog
          version={{
            id: asignar.id,
            nombre: asignar.contenido.nombre,
            numero: asignar.numero,
          }}
          esAdmin={esAdmin}
          cerrar={() => setAsignar(null)}
          completada={() => {}}
        />
      )}
      {ofertar && (
        <PlanOfertaDialog
          version={ofertar}
          esAdmin={esAdmin}
          cerrar={() => setOfertar(null)}
        />
      )}
    </div>
  );
}
