"use client";

import { useState } from "react";
import { Checkbox, Label } from "@heroui/react";
import { UsersRound, ArrowRight, RotateCcw, Factory, Info } from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { SelectField } from "@/components/design-system/select-field";
import { apiRequest } from "@/lib/api";
import type {
  EleccionPersonal,
  PasoPersonalPrevisto,
} from "../../../apps/api/src/ordenes-trabajo/personal-previsto.contrato";
import s from "./orden-personal-previsto.module.css";

type Producto = {
  id: string;
  nombre: string;
  cotizacionItemId?: string;
  ordenItemId?: string;
  asignacionesPersonal?: EleccionPersonal[];
};
type Revision = {
  zona: string;
  items: Array<{
    cotizacionItemId: string;
    aviso: string | null;
    pasos: Array<
      PasoPersonalPrevisto & {
        finAutomatico: string | null;
        finElegido: string | null;
      }
    >;
  }>;
};

async function consultarPersonal(
  lista: Producto[],
  elecciones: Record<string, EleccionPersonal[]>,
) {
  return apiRequest<Revision>("/ordenes-trabajo/personal-previsto/revisar", {
    method: "POST",
    body: JSON.stringify({
      items: lista.map((p) => ({
        cotizacionItemId: p.cotizacionItemId,
        ordenItemId: p.ordenItemId,
        asignacionesPersonal: elecciones[p.id] ?? [],
      })),
    }),
  });
}

export function OrdenPersonalPrevisto({
  productos,
  preparar,
  onChange,
  disabled = false,
  consultar = consultarPersonal,
}: {
  productos: Producto[];
  preparar: () => Promise<Producto[]>;
  onChange: (elecciones: Map<string, EleccionPersonal[]>) => void;
  disabled?: boolean;
  consultar?: typeof consultarPersonal;
}) {
  const [cargados, setCargados] = useState<Producto[]>([]);
  const [revision, setRevision] = useState<Revision | null>(null);
  const [borrador, setBorrador] = useState<Record<string, EleccionPersonal[]>>(
    {},
  );
  const [revisado, setRevisado] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const total = productos.reduce(
    (n, p) => n + (p.asignacionesPersonal?.length ?? 0),
    0,
  );
  const vigente =
    cargados.length === productos.length &&
    cargados.every((p) =>
      productos.some(
        (actual) =>
          actual.id === p.id && actual.cotizacionItemId === p.cotizacionItemId,
      ),
    );
  async function abrir() {
    setBusy(true);
    setError(null);
    try {
      const lista = await preparar();
      const elecciones = Object.fromEntries(
        lista.map((p) => [p.id, p.asignacionesPersonal ?? []]),
      );
      setRevision(await consultar(lista, elecciones));
      setCargados(lista);
      setBorrador(elecciones);
      setRevisado(false);
      setAbierto(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo preparar el personal.",
      );
    } finally {
      setBusy(false);
    }
  }
  function elegir(
    productoId: string,
    nodoClave: string,
    empleadoIds: string[],
  ) {
    setBorrador((actual) => ({
      ...actual,
      [productoId]: [
        ...(actual[productoId] ?? []).filter((e) => e.nodoClave !== nodoClave),
        ...(empleadoIds.length ? [{ nodoClave, empleadoIds }] : []),
      ],
    }));
    setRevisado(false);
    setError(null);
  }
  async function revisar() {
    setBusy(true);
    setError(null);
    try {
      const siguiente = await consultar(cargados, borrador);
      const imposible = siguiente.items.some(
        (i) =>
          !i.aviso &&
          i.pasos.some(
            (p) =>
              (
                borrador[
                  cargados.find(
                    (producto) =>
                      producto.cotizacionItemId === i.cotizacionItemId,
                  )?.id ?? ""
                ] ?? []
              ).some((e) => e.nodoClave === p.nodoClave) && !p.finElegido,
          ),
      );
      setRevision(siguiente);
      if (imposible)
        throw new Error(
          "La selección no tiene una fecha realizable. Revisá horarios, recursos y operadores.",
        );
      setRevisado(true);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudo revisar la disponibilidad.",
      );
    } finally {
      setBusy(false);
    }
  }
  const fecha = (value: string | null) =>
    value && revision
      ? new Date(value).toLocaleString("es-AR", {
          timeZone: revision.zona,
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Sin estimar";
  return (
    <section className={s.panel} aria-label="Operadores de la orden">
      <header className={s.header}>
        <span className={s.icon}>
          <UsersRound aria-hidden />
        </span>
        <div className={s.headerCopy}>
          <h3>Operadores del trabajo</h3>
          <p>
            {total
              ? `${total} ${total === 1 ? "paso" : "pasos"} con personal elegido`
              : "Asignación automática según horarios y carga de trabajo."}
          </p>
          <p className={s.help}>
            Elegí quién hará cada paso antes de emitir. El resto sigue en
            automático.
          </p>
        </div>
        <ActionButton
          variant="outline"
          onPress={() => void abrir()}
          isDisabled={busy || disabled || !productos.length}
        >
          {busy
            ? "Preparando…"
            : abierto
              ? "Volver a cargar"
              : "Elegir operadores"}
        </ActionButton>
      </header>
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      {abierto && revision && (
        <>
          {!vigente && (
            <p className={s.error} role="alert">
              Cambió un producto. Volvé a cargar los operadores antes de aplicar
              la elección.
            </p>
          )}
          {cargados.map((producto) => {
            const info = revision.items.find(
              (i) => i.cotizacionItemId === producto.cotizacionItemId,
            );
            return (
              <section
                key={producto.id}
                className={s.producto}
                aria-label={producto.nombre}
              >
                <div className={s.productoHeader}>
                  <h4>{producto.nombre}</h4>
                  <span>
                    {info?.pasos.length ?? 0}{" "}
                    {info?.pasos.length === 1 ? "paso" : "pasos"}
                  </span>
                </div>
                {info?.aviso && (
                  <p className={s.aviso}>
                    <Info aria-hidden />
                    {info.aviso}
                  </p>
                )}
                {!info?.pasos.length && (
                  <p className={s.help}>
                    Este producto no tiene pasos para asignar.
                  </p>
                )}
                {!!info?.pasos.length && (
                  <div className={s.columnas} aria-hidden="true">
                    <span>Paso / estación</span>
                    <span>Asignación de operadores</span>
                  </div>
                )}
                {info?.pasos.map((paso, indice) => {
                  const seleccion =
                    borrador[producto.id]?.find(
                      (e) => e.nodoClave === paso.nodoClave,
                    )?.empleadoIds ?? [];
                  return (
                    <div className={s.paso} key={paso.nodoClave}>
                      <div className={s.pasoIdentidad}>
                        <span className={s.numero} aria-hidden="true">
                          {String(indice + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <strong>{paso.nombre}</strong>
                          <small>
                            <Factory aria-hidden />
                            {[paso.estacion, paso.maquina]
                              .filter(Boolean)
                              .join(" · ") || "Sin estación"}
                          </small>
                        </div>
                      </div>
                      <div className={s.asignacion}>
                        {paso.motivo ? (
                          <p className={s.motivo}>{paso.motivo}</p>
                        ) : paso.personasNecesarias === 1 ? (
                          <SelectField
                            aria-label={`Operador de ${producto.nombre}: ${paso.nombre}`}
                            value={seleccion[0] ?? ""}
                            disabled={busy || disabled}
                            options={[
                              {
                                value: "",
                                label: "Automático · personal habitual",
                              },
                              ...paso.candidatos.map((c) => ({
                                value: c.id,
                                label: `${c.nombre} · ${c.asignacionAutomatica ? "Habitual" : "Apoyo"}${c.tieneHorario ? "" : " · Sin horario"}`,
                                disabled: !c.tieneHorario,
                              })),
                            ]}
                            onChange={(id) =>
                              elegir(
                                producto.id,
                                paso.nodoClave,
                                id ? [id] : [],
                              )
                            }
                          />
                        ) : (
                          <fieldset className={s.personas}>
                            <legend className="sr-only">
                              Operadores de {producto.nombre}: {paso.nombre}
                            </legend>
                            <div className={s.equipoHeader}>
                              <div>
                                <strong>
                                  Equipo de {paso.personasNecesarias} personas
                                </strong>
                                <span>
                                  {seleccion.length
                                    ? `${seleccion.length} de ${paso.personasNecesarias} elegidos`
                                    : "Asignación automática"}
                                </span>
                              </div>
                              <ActionButton
                                variant="outline"
                                onPress={() =>
                                  elegir(producto.id, paso.nodoClave, [])
                                }
                                isDisabled={
                                  busy || disabled || !seleccion.length
                                }
                              >
                                <RotateCcw /> Automático
                              </ActionButton>
                            </div>
                            <div className={s.candidatos}>
                              {paso.candidatos.map((c) => (
                                <Checkbox
                                  key={c.id}
                                  className={s.persona}
                                  isSelected={seleccion.includes(c.id)}
                                  isDisabled={
                                    busy || disabled || !c.tieneHorario
                                  }
                                  onChange={(marcado) =>
                                    elegir(
                                      producto.id,
                                      paso.nodoClave,
                                      marcado
                                        ? [...seleccion, c.id]
                                        : seleccion.filter((id) => id !== c.id),
                                    )
                                  }
                                >
                                  <Checkbox.Content
                                    className={s.personaContent}
                                  >
                                    <Checkbox.Control>
                                      <Checkbox.Indicator />
                                    </Checkbox.Control>
                                    <Label className={s.personaLabel}>
                                      <span>{c.nombre}</span>
                                      <small>
                                        {c.asignacionAutomatica
                                          ? "Habitual"
                                          : "Apoyo"}
                                        {!c.tieneHorario && " · Sin horario"}
                                      </small>
                                    </Label>
                                  </Checkbox.Content>
                                </Checkbox>
                              ))}
                            </div>
                          </fieldset>
                        )}
                      </div>
                      {revisado && !info.aviso && !paso.motivo && (
                        <p className={s.fecha}>
                          Automático: {fecha(paso.finAutomatico)}{" "}
                          <ArrowRight size={13} /> Con tu elección:{" "}
                          {fecha(paso.finElegido)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </section>
            );
          })}
          <footer className={s.footer}>
            <p>La elección se guarda con la orden.</p>
            <div className={s.footerActions}>
              <ActionButton
                variant="ghost"
                onPress={() => setAbierto(false)}
                isDisabled={busy}
              >
                Cancelar
              </ActionButton>
              <ActionButton
                variant="outline"
                onPress={() => void revisar()}
                isDisabled={busy || disabled || !vigente}
              >
                Revisar disponibilidad
              </ActionButton>
              <ActionButton
                onPress={() => {
                  if (!vigente) return;
                  onChange(
                    new Map(cargados.map((p) => [p.id, borrador[p.id] ?? []])),
                  );
                  setAbierto(false);
                }}
                isDisabled={busy || disabled || !vigente || !revisado}
              >
                Aplicar elección
              </ActionButton>
            </div>
          </footer>
        </>
      )}
    </section>
  );
}
