"use client";

import fieldFocus from "@/components/design-system/field-focus.module.css";

import * as React from "react";
import { Search, ArrowRightLeft } from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { Input } from "@heroui/react";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  getEmpresasPlataforma,
  type PaginaEmpresas,
} from "@/lib/plataforma-api";
import {
  compararPlanes,
  type ComparacionPlanes,
  type ContenidoPlan,
} from "@/lib/plataforma-planes-api";
import { formatBytes } from "@/lib/archivos";
import styles from "./planes-comparacion.module.css";

export function PlanesComparacion({
  planes,
  catalogoVersion,
  invalida,
}: {
  planes: ContenidoPlan[];
  catalogoVersion: number;
  invalida: boolean;
}) {
  const [busqueda, setBusqueda] = React.useState("");
  const [empresas, setEmpresas] = React.useState<PaginaEmpresas | null>(null);
  const [error, setError] = React.useState("");
  const [ocupado, setOcupado] = React.useState(false);
  const [informe, setInforme] = React.useState<{
    firma: string;
    data: ComparacionPlanes;
  } | null>(null);
  const peticion = React.useRef(0);
  const firma = JSON.stringify([catalogoVersion, planes]);
  const vigente = React.useRef(firma);
  vigente.current = firma;
  React.useEffect(
    () => () => {
      peticion.current++;
    },
    [],
  );
  const resultado = informe?.firma === firma ? informe.data : null;

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    const id = ++peticion.current;
    setOcupado(true);
    setError("");
    setEmpresas(null);
    setInforme(null);
    try {
      const data = await getEmpresasPlataforma(
        new URLSearchParams({ q: busqueda.trim(), pagina: "1", limite: "20" }),
      );
      if (id === peticion.current) setEmpresas(data);
    } catch (e) {
      if (id === peticion.current)
        setError(
          e instanceof Error ? e.message : "No se pudieron buscar empresas.",
        );
    } finally {
      if (id === peticion.current) setOcupado(false);
    }
  }
  async function comparar(tenantId: string) {
    const id = ++peticion.current;
    setOcupado(true);
    setError("");
    setInforme(null);
    try {
      const data = await compararPlanes(tenantId, catalogoVersion, planes);
      if (id === peticion.current && firma === vigente.current)
        setInforme({ firma, data });
    } catch (e) {
      if (id === peticion.current)
        setError(
          e instanceof Error ? e.message : "No se pudo comparar la empresa.",
        );
    } finally {
      if (id === peticion.current) setOcupado(false);
    }
  }

  return (
    <section
      className={styles.panel}
      aria-label="Comparar planes con una empresa"
    >
      <header>
        <span className={styles.eyebrow}>ANTES DE ASIGNAR</span>
        <h3>¿Qué cambiaría en esta empresa?</h3>
        <p>
          Compará la propuesta en pantalla con sus condiciones actuales. Esta
          consulta no cambia su plan ni su facturación.
        </p>
      </header>
      <form onSubmit={buscar} className={styles.search}>
        <Field>
          <FieldLabel htmlFor="empresa-comparacion">Buscar empresa</FieldLabel>
          <Input
            className={fieldFocus.singleBorder}
            fullWidth
            id="empresa-comparacion"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Nombre o identificador"
          />
        </Field>
        <ActionButton type="submit" variant="outline" isDisabled={ocupado}>
          <Search />
          Buscar
        </ActionButton>
      </form>
      {error && <p role="alert">{error}</p>}
      {ocupado && <p role="status">Consultando…</p>}
      {empresas && (
        <div className={styles.results}>
          {empresas.empresas.map((e) => (
            <div className={styles.company} key={e.id}>
              <div>
                <strong>{e.nombre}</strong>
                <p>
                  {e.plan ?? "Sin plan asignado"} · {e.slug}
                </p>
              </div>
              <ActionButton
                type="button"
                variant="outline"
                isDisabled={ocupado || invalida}
                onPress={() => void comparar(e.id)}
                aria-label={`Comparar ${e.nombre}`}
              >
                <ArrowRightLeft />
                Comparar
              </ActionButton>
            </div>
          ))}
          <p>
            {empresas.total === 0
              ? "No se encontraron empresas."
              : empresas.total > 20
                ? "Se muestran 20 resultados. Afiná la búsqueda para encontrar tu empresa."
                : `${empresas.total} ${empresas.total === 1 ? "empresa encontrada" : "empresas encontradas"}.`}
          </p>
        </div>
      )}
      {invalida && (
        <p>Corregí los datos y dependencias de la propuesta para compararla.</p>
      )}
      {informe && !resultado && (
        <p role="status">
          La propuesta cambió. Volvé a comparar para actualizar el resultado.
        </p>
      )}
      {resultado && (
        <div className={styles.report}>
          <div className={styles.summary}>
            <div>
              <h4>{resultado.empresa.nombre}</h4>
              <p>
                {resultado.actual.nombre} · {resultado.usuariosOcupados} lugares
                ocupados
              </p>
            </div>
            <span>
              Consulta del{" "}
              {new Date(resultado.calculadoEl).toLocaleString("es-AR")}
            </span>
            <ActionButton
              type="button"
              variant="outline"
              isDisabled={ocupado || invalida}
              onPress={() => void comparar(resultado.empresa.id)}
            >
              Actualizar diagnóstico
            </ActionButton>
          </div>
          <div className={styles.usage}>
            <div>
              <strong>Equipo actual</strong>
              <p>
                {resultado.uso.usuarios.activos} accesos activos ·{" "}
                {resultado.uso.usuarios.invitacionesPendientes}{" "}
                {resultado.uso.usuarios.invitacionesPendientes === 1
                  ? "invitación pendiente"
                  : "invitaciones pendientes"}
              </p>
              <p>
                {resultado.uso.usuarios.adicionalesVigentes} adicionales
                vigentes
              </p>
            </div>
            <div>
              <strong>Archivos guardados</strong>
              <p>
                {formatBytes(Number(resultado.uso.archivos.guardadosBytes))}
              </p>
            </div>
            <div>
              <strong>Cargas en curso</strong>
              <p>
                {formatBytes(Number(resultado.uso.archivos.reservadosBytes))}{" "}
                reservados · {resultado.uso.archivos.cargasPendientes}{" "}
                {resultado.uso.archivos.cargasPendientes === 1
                  ? "carga"
                  : "cargas"}
              </p>
            </div>
          </div>
          <p>{resultado.accesoActual.descripcion}</p>
          <p>
            Esta es una foto del uso actual. Repetí el diagnóstico antes de
            asignar. Publicar versiones y aplicar cambios de plan todavía está
            pendiente; un resultado sin excedentes no habilita la asignación.
          </p>
          <div className={styles.cards}>
            {resultado.propuestas.map((p, index) => (
              <article key={index}>
                <h4>{p.nombre}</h4>
                <span
                  className={`${styles.status} ${styles[p.diagnostico.estado]}`}
                >
                  {p.diagnostico.estado === "resolver"
                    ? "Hay condiciones por resolver"
                    : p.diagnostico.estado === "revisar"
                      ? "Requiere revisión"
                      : "Sin excedentes detectados"}
                </span>
                <strong className={styles.seats}>
                  {p.limites.usuariosMax} <small>usuarios incluidos</small>
                </strong>
                <p>
                  Cupo resultante:{" "}
                  {p.diagnostico.usuariosCupoResultante ?? "sin límite"}.
                  {resultado.uso.usuarios.adicionalesVigentes > 0 &&
                    ` Incluye los ${resultado.uso.usuarios.adicionalesVigentes} adicionales vigentes.`}
                  {p.diagnostico.usuariosExcedidos > 0
                    ? ` ${p.diagnostico.usuariosExcedidos === 1 ? "Falta 1 lugar" : `Faltan ${p.diagnostico.usuariosExcedidos} lugares`}.`
                    : " El equipo y sus invitaciones entran en el cupo."}
                </p>
                <p>
                  Archivos:{" "}
                  {p.limites.almacenamiento.modo === "pendiente"
                    ? "cupo por definir"
                    : p.limites.almacenamiento.modo === "ilimitado"
                      ? "sin límite del plan"
                      : `${p.limites.almacenamiento.gb} GB`}
                </p>
                {p.diagnostico.almacenamientoCupoBytes && (
                  <p>
                    Cuota efectiva:{" "}
                    {formatBytes(Number(p.diagnostico.almacenamientoCupoBytes))}
                    {resultado.almacenamientoAjustadoBytes
                      ? " (ajuste de empresa)"
                      : ""}
                    .
                  </p>
                )}
                {p.diagnostico.almacenamientoExcedidoBytes !== "0" && (
                  <p className={styles.excess}>
                    Excedente de archivos:{" "}
                    {formatBytes(
                      Number(p.diagnostico.almacenamientoExcedidoBytes),
                    )}
                    .
                  </p>
                )}
                <p>
                  {p.diagnostico.funcionesAgregadas} funciones se incorporan ·{" "}
                  {p.diagnostico.funcionesRetiradas} se retiran
                </p>
                {(["resolver", "revisar"] as const).map((nivel) => {
                  const hallazgos = p.diagnostico.hallazgos.filter(
                    (h) => h.nivel === nivel,
                  );
                  return (
                    hallazgos.length > 0 && (
                      <details
                        className={styles.findings}
                        key={nivel}
                        open={nivel === "resolver"}
                      >
                        <summary>
                          {nivel === "resolver"
                            ? "Condiciones por resolver"
                            : "Continuidad y revisión"}{" "}
                          · {hallazgos.length}
                        </summary>
                        <ul>
                          {hallazgos.map((h) => (
                            <li key={h.codigo}>
                              <strong>
                                {h.titulo}
                                {h.cantidad !== undefined
                                  ? ` · ${h.cantidad}`
                                  : ""}
                              </strong>
                              <p>{h.detalle}</p>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )
                  );
                })}
                {p.advertencias.length > 0 && (
                  <ul className={styles.warnings}>
                    {p.advertencias.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                )}
                <details>
                  <summary>{p.diferencias.length} cambios de funciones</summary>
                  <table>
                    <caption className="sr-only">
                      Cambios propuestos para {p.nombre}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Función</th>
                        <th scope="col">Actual</th>
                        <th scope="col">Propuesta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.diferencias.map((d) => (
                        <tr key={d.clave}>
                          <th scope="row">{d.nombre}</th>
                          <td>{d.actual ? "Incluida" : "—"}</td>
                          <td>{d.propuesta ? "Incluida" : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
