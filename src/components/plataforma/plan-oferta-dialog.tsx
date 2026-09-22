"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@heroui/react";
import { toast } from "sonner";
import { ActionButton } from "@/components/design-system/action-button";
import { FormDialog } from "@/components/design-system/form-dialog";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  consultarOfertaPlan,
  sincronizarOfertaPlan,
  retirarOfertaPlan,
  type EstadoOfertaPlan,
  type VersionPlan,
} from "@/lib/plataforma-planes-api";
import focus from "@/components/design-system/field-focus.module.css";
import styles from "./planes-versiones.module.css";

const importe = (n: number | null | undefined) =>
  n == null ? "Por definir" : `USD ${n.toLocaleString("es-AR")}`;
export function PlanOfertaDialog({
  version,
  esAdmin,
  cerrar,
}: {
  version: VersionPlan;
  esAdmin: boolean;
  cerrar: () => void;
}) {
  const [estado, setEstado] = useState<EstadoOfertaPlan | null>(null);
  const [recomendado, setRecomendado] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [accion, setAccion] = useState<"activar" | "retirar" | null>(null);
  const enCurso = useRef(false);
  const precios = version.contenido.precios;
  const extras = version.contenido.adicionalesPermitidos;
  const comercial = version.contenido.comercial;
  const mensualDefinido =
    precios?.mensual != null && (!extras || precios.usuarioMensual != null);
  const valida = mensualDefinido && !!comercial && motivo.trim().length >= 5;
  const resumen: [string, number | null | undefined][] = [
    ["Plan mensual", precios?.mensual],
    ["Plan anual", precios?.anual],
    ...(extras
      ? [
          ["Usuario adicional mensual", precios?.usuarioMensual] as [
            string,
            number | null | undefined,
          ],
          ["Usuario adicional anual", precios?.usuarioAnual] as [
            string,
            number | null | undefined,
          ],
        ]
      : []),
    ["Implementación · una vez por empresa", comercial?.implementacion],
  ];
  const yaActiva = estado?.actual?.versionId === version.id;
  useEffect(() => {
    let vivo = true;
    consultarOfertaPlan(version.borradorId)
      .then((r) => {
        if (vivo) {
          setEstado(r);
          setRecomendado(r.actual?.recomendado ?? version.codigo === "pro");
        }
      })
      .catch((e) => {
        if (vivo)
          setError(
            e instanceof Error ? e.message : "No se pudo consultar la oferta.",
          );
      });
    return () => {
      vivo = false;
    };
  }, [version.borradorId, version.codigo]);

  async function confirmar() {
    if (enCurso.current || !estado || !esAdmin || !accion) return;
    enCurso.current = true;
    setOcupado(true);
    setError("");
    try {
      const resultado =
        accion === "retirar" && estado.actual
          ? await retirarOfertaPlan({
              ofertaId: estado.actual.ofertaId,
              revision: estado.revision,
              motivo: motivo.trim(),
            }).then(() => consultarOfertaPlan(version.borradorId))
          : await sincronizarOfertaPlan({
              versionId: version.id,
              entorno: estado.entorno,
              revision: estado.revision,
              recomendado,
              motivo: motivo.trim(),
            });
      setEstado(resultado);
      setAccion(null);
      setMotivo("");
      toast.success(
        accion === "retirar"
          ? "Oferta retirada para nuevas contrataciones."
          : "Oferta sincronizada y activada.",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo completar la operación.",
      );
    } finally {
      enCurso.current = false;
      setOcupado(false);
    }
  }

  return (
    <FormDialog
      isOpen
      isDismissable={!ocupado}
      onOpenChange={(open) => {
        if (!open && !ocupado) cerrar();
      }}
      title={`Oferta comercial · ${version.contenido.nombre}`}
      description={`Versión ${version.numero}. Condiciones para futuras contrataciones.`}
    >
      <div className={styles.dialogBody}>
        {!estado && !error && (
          <p role="status">Consultando oferta y entorno de cobro…</p>
        )}
        {estado && (
          <>
            <Badge variant="outline">
              {estado.entorno === "production"
                ? "Paddle · Producción"
                : "Paddle · Pruebas"}
            </Badge>
            <Alert>
              <AlertTitle>
                {estado.actual
                  ? `Oferta vigente: versión ${estado.actual.numeroVersion}`
                  : "Todavía no hay una oferta activa"}
              </AlertTitle>
              <AlertDescription>
                {estado.actual
                  ? `${estado.actual.nombre} · ${importe(estado.actual.precioMensual)} / mes. ${estado.actual.registroPublico ? `Registro público con ${estado.actual.trialDias} días de prueba.` : "Sólo por invitación."}`
                  : "Publicar una versión conserva sus funciones y cupos. Activar su oferta la habilita para contratar con los precios validados en Paddle."}
              </AlertDescription>
            </Alert>
            {!estado.paddleHabilitado && (
              <Alert variant="destructive">
                <AlertTitle>Cobro sin configurar</AlertTitle>
                <AlertDescription>
                  Configurá Paddle en este entorno antes de activar una oferta.
                </AlertDescription>
              </Alert>
            )}
            {yaActiva && (
              <p>
                Esta versión ya está en venta. Para cambiar sus importes o
                condiciones, publicá otra versión: las contrataciones anteriores
                conservarán su oferta.
              </p>
            )}
            {(!mensualDefinido || !comercial) && !yaActiva && (
              <Alert>
                <AlertTitle>Faltan condiciones en esta versión</AlertTitle>
                <AlertDescription>
                  Completá los precios, la implementación y las condiciones de
                  alta en Usuarios y oferta. Después guardá y publicá una nueva
                  versión.
                </AlertDescription>
              </Alert>
            )}
            {esAdmin && !accion && (
              <FieldGroup>
                {!yaActiva && comercial && (
                  <>
                    <FieldSet>
                      <FieldLegend>Condiciones publicadas</FieldLegend>
                      {resumen.map(([titulo, valor]) => (
                        <p key={titulo}>
                          {titulo}: <strong>{importe(valor)}</strong>
                        </p>
                      ))}
                      <p>
                        {comercial.acceso === "invitacion"
                          ? "Sólo por invitación"
                          : "Registro público"}{" "}
                        · {comercial.trialDias} días de prueba sin tarjeta.
                      </p>
                      <FieldDescription>
                        Grafo crea y verifica los productos y precios en Paddle
                        automáticamente. La implementación se agrega al primer
                        pago de la empresa.
                      </FieldDescription>
                    </FieldSet>
                    {comercial.acceso === "publico" && (
                      <Field orientation="horizontal">
                        <Checkbox
                          id="oferta-recomendada"
                          aria-label="Destacar como recomendado"
                          checked={recomendado}
                          disabled={ocupado}
                          onCheckedChange={(x) => setRecomendado(x === true)}
                        />
                        <FieldLabel htmlFor="oferta-recomendada">
                          Destacar como recomendado
                        </FieldLabel>
                      </Field>
                    )}
                  </>
                )}
                <Field>
                  <FieldLabel htmlFor="oferta-motivo">
                    Motivo del cambio
                  </FieldLabel>
                  <Input
                    id="oferta-motivo"
                    className={focus.singleBorder}
                    value={motivo}
                    maxLength={500}
                    disabled={ocupado}
                    onChange={(e) => setMotivo(e.target.value)}
                  />
                  <FieldDescription>
                    Se registra junto con tu usuario. Mínimo 5 caracteres.
                  </FieldDescription>
                </Field>
              </FieldGroup>
            )}
            {accion && (
              <Alert>
                <AlertTitle>
                  {accion === "activar"
                    ? "Confirmar la oferta comercial"
                    : "Retirar la oferta vigente"}
                </AlertTitle>
                <AlertDescription>
                  {accion === "activar" ? (
                    <>
                      <p>
                        Se ofrecerá la versión {version.numero} de{" "}
                        {version.contenido.nombre}.
                      </p>
                      <ul>
                        {resumen.map(([titulo, valor]) => (
                          <li key={titulo}>
                            {titulo}: {importe(valor)}
                          </li>
                        ))}
                      </ul>
                      <p>
                        {comercial?.acceso === "invitacion"
                          ? "Sólo por invitación"
                          : "Registro público"}
                        : {comercial?.trialDias} días de prueba sin tarjeta.
                      </p>
                    </>
                  ) : (
                    <p>
                      Se retirará {estado.actual?.nombre}, versión{" "}
                      {estado.actual?.numeroVersion}, de las nuevas
                      contrataciones.
                    </p>
                  )}
                  <p>
                    Los contratos existentes conservan sus funciones, cupos y
                    precios.
                  </p>
                  <p>Motivo: {motivo}</p>
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertTitle>No se pudo completar la operación</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
      <div className={styles.dialogFooter}>
        <ActionButton
          variant="outline"
          isDisabled={ocupado}
          onPress={accion ? () => setAccion(null) : cerrar}
        >
          {accion ? "Volver" : "Cerrar"}
        </ActionButton>
        {esAdmin && estado && !accion && (
          <>
            {estado.actual && (
              <ActionButton
                variant="outline"
                isDisabled={ocupado || motivo.trim().length < 5}
                onPress={() => setAccion("retirar")}
              >
                Revisar retiro
              </ActionButton>
            )}
            {!yaActiva && (
              <ActionButton
                isDisabled={ocupado || !estado.paddleHabilitado || !valida}
                onPress={() => setAccion("activar")}
              >
                Revisar activación
              </ActionButton>
            )}
          </>
        )}
        {accion && (
          <ActionButton
            isDisabled={ocupado || !esAdmin}
            onPress={() => void confirmar()}
          >
            {ocupado
              ? "Sincronizando con Paddle…"
              : accion === "activar"
                ? "Sincronizar y activar oferta"
                : "Retirar oferta"}
          </ActionButton>
        )}
      </div>
    </FormDialog>
  );
}
