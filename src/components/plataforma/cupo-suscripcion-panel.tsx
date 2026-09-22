"use client";

import fieldFocus from "@/components/design-system/field-focus.module.css";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import {
  ajustarCupoUsuarios,
  type CupoSuscripcion,
} from "@/lib/plataforma-suscripciones-api";
import { ActionButton } from "@/components/design-system/action-button";
import { Input } from "@heroui/react";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { FormDialog } from "@/components/design-system/form-dialog";
import theme from "@/components/design-system/brand-workspace-theme.module.css";
import styles from "./empresas.module.css";
import cupos from "./cupo-suscripcion.module.css";

export function CupoSuscripcionPanel({
  id,
  esAdmin,
  version,
}: {
  id: string;
  esAdmin: boolean;
  version: number;
}) {
  const [respuesta, setRespuesta] = useState<{
    clave: string;
    datos?: CupoSuscripcion;
    error?: string;
  }>();
  const [recarga, setRecarga] = useState(0);
  const [abierto, setAbierto] = useState(false);
  const clave = `${id}:${version}:${recarga}`;
  const datos = respuesta?.clave === clave ? respuesta.datos : undefined;
  const error = respuesta?.clave === clave ? respuesta.error : undefined;
  useEffect(() => {
    let vigente = true;
    apiRequest<CupoSuscripcion>(
      `/plataforma/suscripciones/${id}/cupo-usuarios`,
      { cache: "no-store" },
    )
      .then((d) => {
        if (vigente) setRespuesta({ clave, datos: d });
      })
      .catch((e) => {
        if (vigente)
          setRespuesta({
            clave,
            error:
              e instanceof Error ? e.message : "No se pudo consultar el cupo.",
          });
      });
    return () => {
      vigente = false;
    };
  }, [id, clave]);
  return (
    <section className={styles.panel} aria-label="Cupo de usuarios">
      <div className={styles.panelHeader}>
        <h3>Usuarios del plan</h3>
        {datos && esAdmin && datos.editable && datos.incluidos !== null && (
          <ActionButton
            variant="outline"
            size="sm"
            onPress={() => setAbierto(true)}
          >
            Ajustar adicionales
          </ActionButton>
        )}
      </div>
      <div className={styles.panelBody}>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>
              {error}
              <ActionButton
                variant="outline"
                onPress={() => setRecarga((v) => v + 1)}
              >
                Reintentar
              </ActionButton>
            </AlertDescription>
          </Alert>
        ) : !datos ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <>
            <dl className={cupos.resumen}>
              <div className={styles.datum}>
                <dt>Cupo total</dt>
                <dd>{datos.limite ?? "Sin límite"}</dd>
              </div>
              <div className={styles.datum}>
                <dt>Incluidos + adicionales</dt>
                <dd>
                  {datos.incluidos === null
                    ? "Sin límite"
                    : `${datos.incluidos} + ${datos.adicionales}`}
                </dd>
              </div>
              <div className={styles.datum}>
                <dt>Accesos habilitados</dt>
                <dd>{datos.activos}</dd>
              </div>
              <div className={styles.datum}>
                <dt>Invitaciones pendientes</dt>
                <dd>{datos.invitacionesPendientes}</dd>
              </div>
              <div className={styles.datum}>
                <dt>Lugares disponibles</dt>
                <dd>{datos.disponibles ?? "Sin límite"}</dd>
              </div>
            </dl>
            {datos.excedidos > 0 && (
              <Alert>
                <AlertDescription>
                  El uso supera el cupo en {datos.excedidos} lugares. Los
                  accesos existentes se conservan; no se pueden sumar otros
                  hasta regularizarlo.
                </AlertDescription>
              </Alert>
            )}
            <p className={styles.note}>
              {datos.editable
                ? "Los adicionales se acuerdan manualmente. Este ajuste no genera un cobro."
                : "El cupo se consulta aquí. En las ofertas publicadas, el administrador de la empresa gestiona los adicionales desde Suscripción, con revisión del cobro."}
            </p>
          </>
        )}
      </div>
      {abierto && datos && (
        <AjustarAdicionales
          id={id}
          datos={datos}
          cerrar={() => setAbierto(false)}
          guardado={() => {
            setAbierto(false);
            setRecarga((v) => v + 1);
          }}
        />
      )}
    </section>
  );
}

export function AjustarAdicionales({
  id,
  datos,
  cerrar,
  guardado,
}: {
  id: string;
  datos: CupoSuscripcion;
  cerrar: () => void;
  guardado: () => void;
}) {
  const [cantidad, setCantidad] = useState(String(datos.adicionales));
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const adicionales = Number(cantidad);
  const total = (datos.incluidos ?? 0) + adicionales;
  const invalida =
    cantidad === "" ||
    !Number.isInteger(adicionales) ||
    adicionales < 0 ||
    adicionales > 10000 ||
    total < datos.ocupados;
  return (
    <FormDialog
      isOpen
      onOpenChange={(open) => {
        if (!open && !guardando) cerrar();
      }}
      isDismissable={!guardando}
      title="Ajustar usuarios adicionales"
      description="Ampliá el cupo de esta empresa. El ajuste queda registrado con su motivo."
      className={theme.theme}
    >
      <form
        className={styles.modalForm}
        data-ui="heroui"
        onSubmit={async (e) => {
          e.preventDefault();
          if (guardando || invalida || motivo.trim().length < 5) return;
          setGuardando(true);
          setError("");
          try {
            await ajustarCupoUsuarios(id, {
              adicionales,
              anteriores: datos.adicionales,
              motivo: motivo.trim(),
            });
            guardado();
          } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo guardar.");
          } finally {
            setGuardando(false);
          }
        }}
      >
        <div>
          <FieldGroup>
            <Field data-invalid={invalida || undefined}>
              <FieldLabel htmlFor="usuarios-adicionales">
                Lugares adicionales
              </FieldLabel>
              <Input
                className={fieldFocus.singleBorder}
                fullWidth
                id="usuarios-adicionales"
                type="number"
                min={0}
                max={10000}
                step={1}
                required
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                aria-invalid={invalida}
                disabled={guardando}
              />
              <FieldDescription>
                {datos.incluidos} incluidos + {cantidad || "0"} adicionales ={" "}
                {total} lugares. Hay {datos.ocupados} ocupados.
              </FieldDescription>
              {invalida && (
                <FieldDescription>
                  Indicá un número entero. El cupo total debe cubrir los lugares
                  ocupados.
                </FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="motivo-adicionales">
                Motivo del ajuste
              </FieldLabel>
              <Input
                className={fieldFocus.singleBorder}
                fullWidth
                id="motivo-adicionales"
                required
                minLength={5}
                maxLength={300}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                disabled={guardando}
              />
              <FieldDescription>
                Por ejemplo: ampliación acordada con la empresa. No genera
                cobros automáticos.
              </FieldDescription>
            </Field>
          </FieldGroup>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
        <div className={styles.modalFooter}>
          <ActionButton
            type="button"
            variant="outline"
            onPress={cerrar}
            isDisabled={guardando}
          >
            Cancelar
          </ActionButton>
          <ActionButton
            type="submit"
            isDisabled={
              guardando ||
              invalida ||
              motivo.trim().length < 5 ||
              adicionales === datos.adicionales
            }
          >
            {guardando ? "Guardando…" : "Guardar cupo"}
          </ActionButton>
        </div>
      </form>
    </FormDialog>
  );
}
