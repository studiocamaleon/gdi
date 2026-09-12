"use client";

import { partesEnZona } from "@/lib/zona";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { VistaPlanEntrega } from "@/lib/planificacion-entregas";
import s from "./reprogramacion-entregas.module.css";

const niveles = {
  CON_MARGEN: "Entregas sin cambios",
  MARGEN_REDUCIDO: "Entregas sin cambios · margen reducido",
  CAMBIA_ENTREGAS: "Requiere cambiar entregas",
};
const fecha = (f: string | null) =>
  f ? f.split("-").reverse().join("/") : "Sin fecha comprometida";
export function ReprogramacionEntregas({
  plan,
  seleccion,
  onSeleccion,
  excluidas,
  onExcluidas,
  buscar,
  bloqueado,
  acepta,
  onAcepta,
  zona,
}: {
  plan: NonNullable<VistaPlanEntrega["plan"]>;
  seleccion: string;
  onSeleccion: (id: string) => void;
  excluidas: string[];
  onExcluidas: (ids: string[]) => void;
  buscar: () => void;
  bloqueado: boolean;
  acepta: boolean;
  onAcepta: (v: boolean) => void;
  zona: string;
}) {
  const opciones = plan.alternativas.filter((a) => a.reprogramacion);
  const opcion = plan.alternativas.find(
    (a) => a.id === seleccion,
  )?.reprogramacion;
  const hora = (f: string) => {
    const p = partesEnZona(new Date(f), zona);
    const dos = (n: number) => String(n).padStart(2, "0");
    return `${dos(p.d)}/${dos(p.m)}/${p.y} ${dos(p.hh)}:${dos(p.mm)}`;
  };
  return (
    <section className={s.panel} aria-label="Reprogramar trabajos">
      <div className={s.encabezado}>
        <div>
          <h3>Hacer lugar en producción</h3>
          <p>
            Primero las opciones que mantienen las entregas comprometidas. Se
            conservan las piezas y los layouts.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={bloqueado}
          onClick={buscar}
        >
          {bloqueado
            ? "Esperá…"
            : plan.reprogramacion
              ? "Recalcular opciones"
              : "Ver opciones de reprogramación"}
        </Button>
      </div>
      {plan.reprogramacion ? (
        <div className={s.contenido}>
          {plan.reprogramacion.trabajos.length ? (
            <details className={s.detalle}>
              <summary>Elegir trabajos que se pueden mover</summary>
              <FieldSet>
                <FieldLegend variant="label">
                  Desmarcá los trabajos que querés mantener en su lugar.
                </FieldLegend>
                <FieldGroup className={s.trabajos}>
                  {plan.reprogramacion.trabajos.map((t) => (
                    <Field key={t.id} orientation="horizontal">
                      <Checkbox
                        id={`mover-${t.id}`}
                        aria-label={`Permitir mover ${t.numero}`}
                        checked={!excluidas.includes(t.id)}
                        disabled={bloqueado}
                        onCheckedChange={(v) =>
                          onExcluidas(
                            v
                              ? excluidas.filter((id) => id !== t.id)
                              : [...excluidas, t.id],
                          )
                        }
                      />
                      <FieldLabel htmlFor={`mover-${t.id}`}>
                        {t.numero}
                      </FieldLabel>
                    </Field>
                  ))}
                </FieldGroup>
              </FieldSet>
            </details>
          ) : null}
          {plan.reprogramacion.motivo ? (
            <Alert>
              <AlertTitle>No encontramos una opción aplicable</AlertTitle>
              <AlertDescription>{plan.reprogramacion.motivo}</AlertDescription>
            </Alert>
          ) : null}
          {opciones.length ? (
            <>
              <ToggleGroup
                aria-label="Elegir reprogramación"
                value={[seleccion]}
                onValueChange={(v) => v[0] && onSeleccion(v[0])}
                disabled={bloqueado}
                variant="outline"
                spacing={2}
                className={s.opciones}
              >
                <ToggleGroupItem value="por-entrega" className={s.opcion}>
                  Mantener cola actual
                </ToggleGroupItem>
                {opciones.map((a, i) => (
                  <ToggleGroupItem key={a.id} value={a.id} className={s.opcion}>
                    <strong>
                      Opción {i + 1} · {a.reprogramacion!.ordenesMovidas.length}{" "}
                      OT
                    </strong>
                    <span>{niveles[a.reprogramacion!.nivel]}</span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              {opcion ? (
                <>
                  <Alert>
                    <AlertTitle>{niveles[opcion.nivel]}</AlertTitle>
                    <AlertDescription>
                      {opcion.nivel === "CAMBIA_ENTREGAS"
                        ? "Esta opción modifica fechas comprometidas. Revisá y aceptá los cambios indicados abajo."
                        : "Se modifica el calendario productivo. Las fechas comprometidas con los clientes se mantienen."}{" "}
                      La reprogramación conserva los tiempos y materiales
                      cotizados.
                    </AlertDescription>
                  </Alert>
                  <div className={s.scroll}>
                    <table
                      className={s.tabla}
                      aria-label="Impacto en las entregas de otras órdenes"
                    >
                      <thead>
                        <tr>
                          <th>Trabajo / lote</th>
                          <th>Producción lista</th>
                          <th>Entrega</th>
                          <th>Margen hábil</th>
                        </tr>
                      </thead>
                      <tbody>
                        {opcion.entregasAfectadas.map((e) => (
                          <tr key={e.raizId}>
                            <th scope="row">
                              {e.ordenNumero}
                              <span>{e.nombre}</span>
                            </th>
                            <td>
                              <span>Antes: {hora(e.finAnterior)}</span>
                              <strong>{hora(e.finPropuesto)}</strong>
                            </td>
                            <td>
                              <span>{fecha(e.fechaActual)}</span>
                              {e.cambiaEntrega ? (
                                <strong className={s.advertencia}>
                                  → {fecha(e.fechaPropuesta)} · +
                                  {e.demoraHabiles} días hábiles
                                </strong>
                              ) : (
                                <strong>Sin cambios</strong>
                              )}
                            </td>
                            <td>
                              {e.margenAnterior ?? "—"} →{" "}
                              {e.margenRestante ?? "—"} días
                              {e.margenRestante === 0 ? (
                                <span>Sin días extra</span>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <details className={s.detalle}>
                    <summary>
                      {opcion.cambios.length}{" "}
                      {opcion.cambios.length === 1
                        ? "operación cambia"
                        : "operaciones cambian"}{" "}
                      de horario
                    </summary>
                    <div className={s.scroll}>
                      <table
                        className={s.tabla}
                        aria-label="Cambios en operaciones"
                      >
                        <thead>
                          <tr>
                            <th>Operación</th>
                            <th>Recurso</th>
                            <th>Antes</th>
                            <th>Propuesto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {opcion.cambios.map((c) => (
                            <tr key={c.pasoId}>
                              <th>
                                {c.ordenNumero} · {c.item}
                                <span>{c.operacion}</span>
                              </th>
                              <td>{c.recurso}</td>
                              <td>
                                {hora(c.inicioAnterior)} → {hora(c.finAnterior)}
                              </td>
                              <td>
                                {hora(c.inicio)} → {hora(c.fin)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                  {opcion.entregasAfectadas.some((e) => e.cambiaEntrega) ? (
                    <Field orientation="horizontal">
                      <Checkbox
                        id="aceptar-entregas-reprogramadas"
                        aria-label="Acepto cambiar las fechas de entrega indicadas"
                        checked={acepta}
                        onCheckedChange={(v) => onAcepta(v === true)}
                        disabled={bloqueado}
                      />
                      <FieldLabel htmlFor="aceptar-entregas-reprogramadas">
                        Acepto cambiar las fechas de entrega indicadas en esta
                        opción.
                      </FieldLabel>
                    </Field>
                  ) : null}
                </>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
