"use client";

import { useRef, useState } from "react";
import { Input } from "@heroui/react";
import { toast } from "sonner";
import { ActionButton } from "@/components/design-system/action-button";
import { FormDialog } from "@/components/design-system/form-dialog";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  getEmpresasPlataforma,
  type PaginaEmpresas,
} from "@/lib/plataforma-api";
import {
  diagnosticoAsignacionPlan,
  asignarVersionPlan,
  type VistaAsignacionPlan,
} from "@/lib/plataforma-planes-api";
import { formatBytes } from "@/lib/archivos";
import fieldFocus from "@/components/design-system/field-focus.module.css";
import styles from "./plan-asignacion.module.css";

export function PlanAsignacionDialog({
  version,
  empresaInicial,
  esAdmin,
  cerrar,
  completada,
}: {
  version: { id: string; nombre: string; numero: number } | null;
  empresaInicial?: { id: string; nombre: string };
  esAdmin: boolean;
  cerrar: () => void;
  completada: () => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [empresas, setEmpresas] = useState<PaginaEmpresas | null>(null);
  const [empresa, setEmpresa] = useState(empresaInicial ?? null);
  const [informe, setInforme] = useState<VistaAsignacionPlan | null>(null);
  const [motivo, setMotivo] = useState("");
  const [aceptadas, setAceptadas] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const enCurso = useRef(false);
  const intento = useRef<{ firma: string; id: string } | null>(null);
  const capturarError = (e: unknown) =>
    setError(
      e instanceof Error ? e.message : "No se pudo completar la operación.",
    );

  async function buscar() {
    if (enCurso.current) return;
    enCurso.current = true;
    setOcupado(true);
    setError("");
    setEmpresas(null);
    try {
      setEmpresas(
        await getEmpresasPlataforma(
          new URLSearchParams({
            q: busqueda.trim(),
            pagina: "1",
            limite: "20",
          }),
        ),
      );
    } catch (e) {
      capturarError(e);
    } finally {
      enCurso.current = false;
      setOcupado(false);
    }
  }
  async function diagnosticar(e: { id: string; nombre: string }) {
    if (enCurso.current) return;
    enCurso.current = true;
    setOcupado(true);
    setError("");
    setEmpresa(e);
    setEmpresas(null);
    setInforme(null);
    setAceptadas([]);
    try {
      setInforme(await diagnosticoAsignacionPlan(e.id, version?.id ?? null));
    } catch (err) {
      capturarError(err);
    } finally {
      enCurso.current = false;
      setOcupado(false);
    }
  }
  async function asignar() {
    if (!informe || enCurso.current || !esAdmin) return;
    enCurso.current = true;
    setGuardando(true);
    setError("");
    const datos = {
      tenantId: informe.empresa.id,
      versionId: version?.id ?? null,
      revision: informe.actual.revision,
      huella: informe.huella,
      motivo: motivo.trim(),
      revisionesAceptadas: [...aceptadas].sort(),
    };
    const firma = JSON.stringify(datos);
    if (intento.current?.firma !== firma)
      intento.current = { firma, id: crypto.randomUUID() };
    try {
      await asignarVersionPlan({ ...datos, operacionId: intento.current.id });
      toast.success(
        version
          ? "Versión asignada a la empresa."
          : "Contrato anterior restaurado.",
      );
      completada();
      cerrar();
    } catch (e) {
      capturarError(e);
    } finally {
      enCurso.current = false;
      setGuardando(false);
    }
  }

  return (
    <FormDialog
      isOpen
      onOpenChange={(open) => {
        if (!open && !guardando) cerrar();
      }}
      isDismissable={!guardando}
      title={
        version
          ? `Asignar ${version.nombre} · v${version.numero}`
          : "Restaurar contrato anterior"
      }
      description="Revisá el impacto en la empresa. El cambio conserva su facturación, estado de acceso, adicionales y cuota de archivos personalizada."
      className={styles.dialog}
    >
      <div className={styles.body}>
        {!empresaInicial && (
          <form
            className={styles.search}
            onSubmit={(e) => {
              e.preventDefault();
              void buscar();
            }}
          >
            <Field>
              <FieldLabel htmlFor="empresa-asignacion">
                Buscar empresa
              </FieldLabel>
              <Input
                id="empresa-asignacion"
                className={fieldFocus.singleBorder}
                fullWidth
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                disabled={ocupado || guardando}
              />
            </Field>
            <ActionButton
              type="submit"
              variant="outline"
              isDisabled={ocupado || guardando}
            >
              Buscar
            </ActionButton>
          </form>
        )}
        {empresas && (
          <div className={styles.results}>
            {empresas.empresas.map((e) => (
              <div key={e.id} className={styles.company}>
                <span>
                  <strong>{e.nombre}</strong>
                  <small>
                    {e.plan ?? "Sin plan"} · {e.proveedor ?? "Sin suscripción"}
                  </small>
                </span>
                <ActionButton
                  variant="outline"
                  isDisabled={ocupado || guardando}
                  onPress={() => void diagnosticar(e)}
                >
                  Evaluar
                </ActionButton>
              </div>
            ))}
            {!empresas.total && <p>No se encontraron empresas.</p>}
          </div>
        )}
        {empresa && (
          <div className={styles.company}>
            <strong>{empresa.nombre}</strong>
            <ActionButton
              variant="outline"
              isDisabled={ocupado || guardando}
              onPress={() => void diagnosticar(empresa)}
            >
              {informe ? "Actualizar diagnóstico" : "Evaluar cambio"}
            </ActionButton>
          </div>
        )}
        {ocupado && <p role="status">Consultando condiciones y operaciones…</p>}
        {error && (
          <Alert variant="destructive">
            <AlertTitle>No se completó el cambio</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {informe && (
          <>
            <div className={styles.transition}>
              <div>
                <small>ACTUAL</small>
                <strong>
                  {informe.actual.nombre}
                  {informe.actual.numero ? ` · v${informe.actual.numero}` : ""}
                </strong>
              </div>
              <span aria-hidden>→</span>
              <div>
                <small>DESTINO</small>
                <strong>
                  {informe.destino.nombre}
                  {informe.destino.numero
                    ? ` · v${informe.destino.numero}`
                    : ""}
                </strong>
              </div>
            </div>
            <dl className={styles.metrics}>
              <div>
                <dt>Usuarios e invitaciones</dt>
                <dd>
                  {informe.uso.usuarios.activos +
                    informe.uso.usuarios.invitacionesPendientes}{" "}
                  / {informe.diagnostico.usuariosCupoResultante ?? "sin límite"}
                </dd>
              </div>
              <div>
                <dt>Cupo de archivos resultante</dt>
                <dd>
                  {informe.diagnostico.almacenamientoCupoBytes
                    ? formatBytes(
                        Number(informe.diagnostico.almacenamientoCupoBytes),
                      )
                    : "Sin límite"}
                </dd>
              </div>
              <div>
                <dt>Funciones</dt>
                <dd>
                  +{informe.diagnostico.funcionesAgregadas} / −
                  {informe.diagnostico.funcionesRetiradas}
                </dd>
              </div>
            </dl>
            {!!informe.bloqueos.length && (
              <Alert variant="destructive">
                <AlertTitle>Hay condiciones por resolver</AlertTitle>
                <AlertDescription>
                  <ul>
                    {informe.bloqueos.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            <details>
              <summary>
                Cambios de funciones ({informe.diferencias.length})
              </summary>
              <div className={styles.tableScroll}>
                <table>
                  <thead>
                    <tr>
                      <th>Función</th>
                      <th>Actual</th>
                      <th>Destino</th>
                    </tr>
                  </thead>
                  <tbody>
                    {informe.diferencias.map((d) => (
                      <tr key={d.clave}>
                        <td>{d.nombre}</td>
                        <td>{d.actual ? "Incluida" : "—"}</td>
                        <td>{d.propuesta ? "Incluida" : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            <FieldGroup>
              {informe.diagnostico.hallazgos
                .filter((h) => informe.revisiones.includes(h.codigo))
                .map((h) => (
                  <Field key={h.codigo} orientation="horizontal">
                    <Checkbox
                      id={`revision-${h.codigo}`}
                      checked={aceptadas.includes(h.codigo)}
                      disabled={!esAdmin || guardando}
                      onCheckedChange={(v) =>
                        setAceptadas((a) =>
                          v
                            ? [...a, h.codigo]
                            : a.filter((c) => c !== h.codigo),
                        )
                      }
                    />
                    <div>
                      <FieldLabel htmlFor={`revision-${h.codigo}`}>
                        {h.titulo}
                        {h.cantidad !== undefined ? ` · ${h.cantidad}` : ""}
                      </FieldLabel>
                      <FieldDescription>{h.detalle}</FieldDescription>
                    </div>
                  </Field>
                ))}
            </FieldGroup>
            {esAdmin && (
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="motivo-asignacion">
                    Motivo del cambio
                  </FieldLabel>
                  <Input
                    id="motivo-asignacion"
                    fullWidth
                    className={fieldFocus.singleBorder}
                    value={motivo}
                    maxLength={500}
                    disabled={guardando}
                    onChange={(e) => setMotivo(e.target.value)}
                  />
                  <FieldDescription>
                    Queda registrado en el historial de la empresa. Mínimo 5
                    caracteres.
                  </FieldDescription>
                </Field>
              </FieldGroup>
            )}
          </>
        )}
      </div>
      <div className={styles.footer}>
        <ActionButton variant="outline" isDisabled={guardando} onPress={cerrar}>
          Cerrar
        </ActionButton>
        {esAdmin && (
          <ActionButton
            isDisabled={
              !informe ||
              ocupado ||
              guardando ||
              !!informe.bloqueos.length ||
              motivo.trim().length < 5 ||
              informe.revisiones.some((c) => !aceptadas.includes(c))
            }
            onPress={() => void asignar()}
          >
            {guardando
              ? "Aplicando…"
              : version
                ? "Asignar versión"
                : "Restaurar contrato"}
          </ActionButton>
        )}
      </div>
    </FormDialog>
  );
}
