"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Input } from "@heroui/react";
import { FormDialog } from "@/components/design-system/form-dialog";
import { ActionButton } from "@/components/design-system/action-button";
import { SelectField } from "@/components/design-system/select-field";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  revisarContratacion,
  confirmarContratacion,
  consultarContratacion,
  descartarContratacion,
  type PlanContratable,
  type VistaContratacion,
} from "@/lib/suscripcion-api";
import focus from "@/components/design-system/field-focus.module.css";
import styles from "./contratacion.module.css";

const monto = (n: number) =>
  `US$ ${n.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
const pendiente = (r: VistaContratacion | null) =>
  !!r && ["enviando", "checkout", "verificar"].includes(r.estado);

/** Cada revisión es inmutable. Cambiar opciones exige volver a revisar;
 * una confirmación incierta sólo se consulta y nunca genera otro intento. */
export function ContratacionDialog({
  plan,
  inicial,
  cicloInicial,
  adicionalesIniciales,
  cerrar,
  onEstado,
  abrirPago,
  completada,
}: {
  plan: PlanContratable | null;
  inicial: VistaContratacion | null;
  cicloInicial: "mensual" | "anual";
  adicionalesIniciales: number;
  cerrar: () => void;
  onEstado: (r: VistaContratacion) => void;
  abrirPago: (r: VistaContratacion) => void;
  completada: () => void;
}) {
  const [ciclo, setCiclo] = useState(
    inicial?.revision.ciclo ??
      (cicloInicial === "anual" && plan?.anual ? "anual" : "mensual"),
  );
  const [extras, setExtras] = useState(
    String(inicial?.revision.destino.adicionales ?? adicionalesIniciales),
  );
  const [r, setRevision] = useState(inicial);
  const [aceptadas, setAceptadas] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [respuestaIncierta, setRespuestaIncierta] = useState(false);
  const enCurso = useRef(false);
  const extra = ciclo === "anual" ? plan?.usuarioAnual : plan?.usuarioMensual;
  const num = Number(extras);
  const invalido =
    !extras.trim() ||
    !Number.isInteger(num) ||
    num < 0 ||
    num > (extra?.cantidadMaxima ?? 0);
  const enEspera = pendiente(r) || respuestaIncierta;
  const terminado = r?.estado === "aplicada";

  function recibir(next: VistaContratacion) {
    setRevision(next);
    onEstado(next);
    setRespuestaIncierta(false);
    if (next.estado === "aplicada") completada();
  }
  const recibirConsulta = useEffectEvent(recibir);
  const solicitudId = r?.id;
  useEffect(() => {
    if (!enEspera || !solicitudId) return;
    let cancelada = false;
    let intentos = 0;
    let timer: ReturnType<typeof setTimeout>;
    const consultar = async () => {
      if (cancelada) return;
      intentos++;
      if (!enCurso.current && document.visibilityState !== "hidden") {
        enCurso.current = true;
        try {
          const next = await consultarContratacion(solicitudId);
          if (!cancelada) recibirConsulta(next);
          if (!pendiente(next)) return;
        } catch {
          // Un fallo de consulta no autoriza reenviar el cobro. El botón manual
          // sigue disponible cuando termina esta espera acotada.
        } finally {
          enCurso.current = false;
        }
      }
      if (!cancelada && intentos < 12) timer = setTimeout(consultar, 5000);
    };
    timer = setTimeout(consultar, 3000);
    return () => {
      cancelada = true;
      clearTimeout(timer);
    };
  }, [enEspera, solicitudId]);
  async function ejecutar(fn: () => Promise<void>) {
    if (enCurso.current) return;
    enCurso.current = true;
    setOcupado(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo completar la operación.",
      );
    } finally {
      enCurso.current = false;
      setOcupado(false);
    }
  }
  const revisar = () =>
    ejecutar(async () => {
      if (!plan?.ofertaId || invalido) return;
      setAceptadas([]);
      recibir(
        await revisarContratacion({
          ofertaId: plan.ofertaId,
          ciclo,
          adicionales: num,
        }),
      );
    });
  const confirmar = () =>
    ejecutar(async () => {
      if (!r?.id) return;
      // Un fallo HTTP no prueba que el servidor no haya enviado el cobro.
      setRespuestaIncierta(true);
      onEstado({
        ...r,
        estado: "verificar",
        detalle:
          "Consultá el estado para confirmar el resultado de esta solicitud.",
      });
      const next = await confirmarContratacion(r.id, aceptadas);
      recibir(next);
      if (next.estado === "checkout" && next.transaccionId) abrirPago(next);
    });
  const consultar = () =>
    ejecutar(async () => {
      if (r?.id) recibir(await consultarContratacion(r.id));
    });
  const cambiarOpciones = () => {
    setRevision(null);
    setAceptadas([]);
    setError("");
  };
  const v = r?.revision;

  return (
    <FormDialog
      isOpen
      onOpenChange={(open) => {
        if (!open && !ocupado) cerrar();
      }}
      isDismissable={!ocupado}
      title={terminado ? "Suscripción actualizada" : "Revisar contratación"}
      description="Plan, usuarios y condiciones de cobro de tu empresa."
    >
      <div className={styles.body}>
        <div className={styles.heading}>
          <span>PLAN ELEGIDO</span>
          <h3>{v?.destino.nombre ?? plan?.nombre}</h3>
          <p>
            {v
              ? `${v.destino.incluidos} usuarios incluidos · ${v.destino.gb == null ? "Almacenamiento sin límite comercial" : `${v.destino.gb} GB`}`
              : plan?.descripcion}
          </p>
        </div>
        {!r && plan && (
          <FieldGroup className={styles.options}>
            <Field>
              <FieldLabel>Ciclo de pago</FieldLabel>
              <SelectField
                aria-label="Ciclo de pago"
                value={ciclo}
                disabled={ocupado}
                options={[
                  { value: "mensual", label: "Mensual" },
                  ...(plan.anual ? [{ value: "anual", label: "Anual" }] : []),
                ]}
                onChange={(x) => {
                  setCiclo(x as "mensual" | "anual");
                  setExtras("0");
                }}
              />
            </Field>
            <Field data-invalid={invalido}>
              <FieldLabel htmlFor="usuarios-a-contratar">
                Usuarios adicionales
              </FieldLabel>
              <Input
                id="usuarios-a-contratar"
                className={focus.singleBorder}
                type="number"
                min={0}
                max={extra?.cantidadMaxima ?? 0}
                step={1}
                value={extras}
                disabled={ocupado || !extra}
                aria-invalid={invalido}
                onChange={(e) => setExtras(e.target.value)}
              />
              <FieldDescription>
                {extra
                  ? `${monto(extra.importe)} por usuario / ${ciclo === "anual" ? "año" : "mes"}`
                  : "Esta oferta no incluye adicionales para este ciclo."}
              </FieldDescription>
            </Field>
          </FieldGroup>
        )}
        {!r && plan && (
          <p>
            Grafo comprobará las funciones, los usuarios activos, las
            invitaciones pendientes y el espacio ocupado antes de continuar.
          </p>
        )}
        {v && (
          <>
            <dl className={styles.metrics}>
              <div>
                <dt>Cupo resultante</dt>
                <dd>{v.destino.totalUsuarios} usuarios</dd>
                <small>
                  {v.destino.incluidos} incluidos + {v.destino.adicionales}{" "}
                  adicionales
                </small>
              </div>
              <div>
                <dt>Total del plan y adicionales</dt>
                <dd>
                  {monto(v.totalPeriodo)} /{" "}
                  {v.ciclo === "anual" ? "año" : "mes"}
                </dd>
                <small>Antes de impuestos</small>
              </div>
              {r?.tipo === "checkout" && v.implementacion != null && (
                <>
                  <div>
                    <dt>Implementación · pago único</dt>
                    <dd>
                      {v.implementacion > 0
                        ? monto(v.implementacion)
                        : "Sin cargo"}
                    </dd>
                    <small>Una sola vez por empresa</small>
                  </div>
                  <div>
                    <dt>Primer pago</dt>
                    <dd>{monto(v.totalInicial ?? v.totalPeriodo)}</dd>
                    <small>
                      Antes de impuestos. Las renovaciones sólo incluyen el
                      abono.
                    </small>
                  </div>
                </>
              )}
            </dl>
            {v.bloqueos.length > 0 && (
              <Alert variant="destructive">
                <AlertTitle>Hay condiciones por resolver</AlertTitle>
                <AlertDescription>
                  <ul>
                    {v.bloqueos.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            {v.diferencias.length > 0 && (
              <details className={styles.details}>
                <summary>Cambios en funciones ({v.diferencias.length})</summary>
                <ul>
                  {v.diferencias.map((f) => (
                    <li key={f.clave}>
                      <strong>
                        {f.propuesta ? "Se incorpora" : "Se retira"}:
                      </strong>{" "}
                      {f.nombre}
                    </li>
                  ))}
                </ul>
                <p>
                  Los registros guardados se conservan. Las nuevas operaciones
                  dependen de las funciones del plan elegido.
                </p>
              </details>
            )}
            {r?.estado === "preparada" && v.revisiones.length > 0 && (
              <FieldSet>
                <FieldLegend>Revisar antes de continuar</FieldLegend>
                {v.revisiones.map((k) => {
                  const h = v.diagnostico.hallazgos.find(
                    (i) => i.codigo === k,
                  )!;
                  return (
                    <Field orientation="horizontal" key={k}>
                      <Checkbox
                        id={`revision-${k}`}
                        checked={aceptadas.includes(k)}
                        disabled={ocupado || enEspera}
                        onCheckedChange={(checked) =>
                          setAceptadas((a) =>
                            checked ? [...a, k] : a.filter((x) => x !== k),
                          )
                        }
                      />
                      <div>
                        <FieldLabel htmlFor={`revision-${k}`}>
                          {h.titulo}
                          {h.cantidad !== undefined ? ` · ${h.cantidad}` : ""}
                        </FieldLabel>
                        <FieldDescription>{h.detalle}</FieldDescription>
                      </div>
                    </Field>
                  );
                })}
              </FieldSet>
            )}
            {r?.cobro && !terminado && (
              <Alert>
                <AlertTitle>
                  {r.tipo === "checkout"
                    ? "Confirmación del pago"
                    : "Ajuste del período actual"}
                </AlertTitle>
                <AlertDescription>
                  {r.cobro.aCobrar === null
                    ? "Paddle mostrará los impuestos y el total definitivo antes de que autorices el pago. Al completarlo comienza tu suscripción paga."
                    : r.cobro.aCobrar === 0
                      ? "Este cambio no requiere un cobro ahora."
                      : `Se cobrarán ahora ${monto(r.cobro.aCobrar)} con el medio de pago registrado.`}
                  {r.cobro.aCredito > 0 && (
                    <p>
                      Saldo a favor para próximos cobros:{" "}
                      {monto(r.cobro.aCredito)}.
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            )}
            {(r?.detalle || enEspera) && (
              <Alert>
                <AlertTitle>
                  {terminado
                    ? "Cambio confirmado"
                    : enEspera
                      ? "Contratación pendiente"
                      : "Estado de la solicitud"}
                </AlertTitle>
                <AlertDescription>
                  {r?.detalle ??
                    "Consultá el estado para confirmar qué ocurrió. Podés cerrar esta ventana y retomarlo desde Suscripción."}
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
      <div className={styles.footer}>
        <ActionButton variant="outline" isDisabled={ocupado} onPress={cerrar}>
          {terminado ? "Listo" : "Cerrar"}
        </ActionButton>
        {!r && (
          <ActionButton
            isDisabled={ocupado || invalido || !plan}
            onPress={() => void revisar()}
          >
            {ocupado ? "Revisando…" : "Revisar condiciones y cobro"}
          </ActionButton>
        )}
        {r && !enEspera && !terminado && plan && (
          <ActionButton
            variant="outline"
            isDisabled={ocupado}
            onPress={cambiarOpciones}
          >
            Cambiar opciones
          </ActionButton>
        )}
        {r?.estado === "preparada" && !enEspera && (
          <ActionButton
            isDisabled={
              ocupado ||
              v!.bloqueos.length > 0 ||
              v!.revisiones.some((k) => !aceptadas.includes(k))
            }
            onPress={() => void confirmar()}
          >
            {ocupado
              ? "Confirmando…"
              : r.tipo === "checkout"
                ? "Continuar al pago"
                : r.cobro?.aCobrar === 0
                  ? "Confirmar cambio"
                  : "Confirmar cambio y cobro"}
          </ActionButton>
        )}
        {enEspera && (
          <ActionButton
            variant="outline"
            isDisabled={ocupado}
            onPress={() => void consultar()}
          >
            {ocupado ? "Consultando…" : "Consultar estado"}
          </ActionButton>
        )}
        {r?.estado === "checkout" && r.transaccionId && (
          <>
            <ActionButton
              variant="outline"
              isDisabled={ocupado}
              onPress={() =>
                void ejecutar(async () =>
                  recibir(await descartarContratacion(r.id!)),
                )
              }
            >
              Descartar checkout
            </ActionButton>
            <ActionButton isDisabled={ocupado} onPress={() => abrirPago(r)}>
              Retomar pago
            </ActionButton>
          </>
        )}
      </div>
    </FormDialog>
  );
}
