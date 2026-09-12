"use client";
import {
  DIAS_SEMANA,
  etiquetaCalendario,
  type Estacion,
  type DiaSemana,
  type CalendarioEstacion,
} from "@/lib/estaciones";
// ── Editor del calendario semanal ────────────────────────────────────────

const DIA_NOMBRE: Record<DiaSemana, string> = {
  lun: "Lunes",
  mar: "Martes",
  mie: "Miércoles",
  jue: "Jueves",
  vie: "Viernes",
  sab: "Sábado",
  dom: "Domingo",
};

/** Calendario con los 7 días inactivos (base para editar desde cero). */
function calendarioVacio(): CalendarioEstacion {
  return {
    dias: {
      lun: null,
      mar: null,
      mie: null,
      jue: null,
      vie: null,
      sab: null,
      dom: null,
    },
  };
}

/**
 * Días con franjas inválidas: alguna con desde >= hasta, o dos que se
 * solapan (comparadas ya ordenadas). Bloquean el guardado con aviso.
 */
export function diasInvalidos(
  calendario: CalendarioEstacion | null,
): DiaSemana[] {
  if (!calendario) return [];
  return DIAS_SEMANA.filter((dia) => {
    const franjas = calendario.dias[dia];
    if (!franjas) return false;
    if (franjas.some((franja) => franja.desde >= franja.hasta)) return true;
    const ordenadas = [...franjas].sort((a, b) => (a.desde < b.desde ? -1 : 1));
    return ordenadas.some(
      (franja, i) => i > 0 && franja.desde < ordenadas[i - 1].hasta,
    );
  });
}

/** Franja nueva a continuación de la última del día (turno tarde típico). */
function franjaSiguiente(franjas: Array<{ desde: string; hasta: string }>) {
  const ultima = franjas[franjas.length - 1];
  if (!ultima) return { desde: "09:00", hasta: "18:00" };
  const [hh] = ultima.hasta.split(":").map(Number);
  const desde = Math.min(hh + 1, 22);
  const hasta = Math.min(desde + 4, 23);
  const aHora = (h: number) => `${String(h).padStart(2, "0")}:00`;
  return { desde: aHora(desde), hasta: aHora(hasta) };
}

/**
 * Editor semanal: toggle por día + N franjas desde/hasta (jornada cortada:
 * 9–12 y 15–19). Al activar un día hereda las franjas del último día activo
 * anterior (o 9–18). "Copiar horarios de:" pisa el calendario del borrador
 * con el de otra estación (sólo el calendario; los puestos no se copian) —
 * acción de cliente pura.
 */
export function CalendarioEditor({
  value,
  onChange,
  fuentes,
}: {
  value: CalendarioEstacion | null;
  onChange: (calendario: CalendarioEstacion | null) => void;
  fuentes: Pick<Estacion, "id" | "nombre" | "calendario">[];
}) {
  const calendario = value ?? calendarioVacio();
  const invalidos = new Set(diasInvalidos(calendario));

  const setDia = (
    dia: DiaSemana,
    franjas: Array<{ desde: string; hasta: string }> | null,
  ) => {
    onChange({ dias: { ...calendario.dias, [dia]: franjas } });
  };

  const setFranja = (
    dia: DiaSemana,
    indice: number,
    franja: { desde: string; hasta: string },
  ) => {
    const franjas = calendario.dias[dia] ?? [];
    setDia(
      dia,
      franjas.map((previa, i) => (i === indice ? franja : previa)),
    );
  };

  const quitarFranja = (dia: DiaSemana, indice: number) => {
    const franjas = (calendario.dias[dia] ?? []).filter((_, i) => i !== indice);
    setDia(dia, franjas.length > 0 ? franjas : null);
  };

  const toggleDia = (dia: DiaSemana) => {
    if (calendario.dias[dia]) {
      setDia(dia, null);
      return;
    }
    // Hereda las franjas del día activo anterior: cargar L y activar M-V sale gratis.
    const previos = DIAS_SEMANA.slice(0, DIAS_SEMANA.indexOf(dia)).reverse();
    const heredadas = previos
      .map((previo) => calendario.dias[previo])
      .find(Boolean);
    setDia(
      dia,
      heredadas
        ? heredadas.map((franja) => ({ ...franja }))
        : [{ desde: "09:00", hasta: "18:00" }],
    );
  };

  const copiables = fuentes.filter((estacion) => estacion.calendario !== null);

  return (
    <div className="cal-editor">
      <div className="cal-editor-head">
        <label>Calendario operativo</label>
        {copiables.length > 0 ? (
          <select
            className="cal-copy"
            value=""
            onChange={(event) => {
              const fuente = copiables.find(
                (estacion) => estacion.id === event.target.value,
              );
              if (fuente?.calendario)
                onChange({ dias: { ...fuente.calendario.dias } });
            }}
          >
            <option value="" disabled>
              Copiar horarios de…
            </option>
            {copiables.map((estacion) => (
              <option key={estacion.id} value={estacion.id}>
                {estacion.nombre} — {etiquetaCalendario(estacion.calendario)}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      <div className="cal-rows">
        {DIAS_SEMANA.map((dia) => {
          const franjas = calendario.dias[dia];
          return (
            <div
              key={dia}
              className={`cal-row ${franjas ? "on" : ""} ${invalidos.has(dia) ? "invalid" : ""}`}
            >
              <button
                type="button"
                className="cal-day"
                onClick={() => toggleDia(dia)}
                aria-pressed={franjas !== null}
              >
                <span className="dot" />
                {DIA_NOMBRE[dia]}
              </button>
              {franjas ? (
                <div className="cal-franjas">
                  {franjas.map((franja, indice) => (
                    <div key={indice} className="cal-times">
                      <input
                        type="time"
                        value={franja.desde}
                        onChange={(event) =>
                          setFranja(dia, indice, {
                            ...franja,
                            desde: event.target.value,
                          })
                        }
                      />
                      <span className="sep">–</span>
                      <input
                        type="time"
                        value={franja.hasta}
                        onChange={(event) =>
                          setFranja(dia, indice, {
                            ...franja,
                            hasta: event.target.value,
                          })
                        }
                      />
                      {franjas.length > 1 ? (
                        <button
                          type="button"
                          className="cal-quitar"
                          onClick={() => quitarFranja(dia, indice)}
                          aria-label={`Quitar franja ${franja.desde}–${franja.hasta} de ${DIA_NOMBRE[dia]}`}
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="cal-agregar"
                    onClick={() =>
                      setDia(dia, [...franjas, franjaSiguiente(franjas)])
                    }
                    aria-label={`Agregar franja a ${DIA_NOMBRE[dia]}`}
                    title="Agregar otra franja (jornada cortada)"
                  >
                    +
                  </button>
                </div>
              ) : (
                <span className="cal-off">No se trabaja</span>
              )}
            </div>
          );
        })}
      </div>
      <div className={`help ${invalidos.size > 0 ? "err" : ""}`}>
        {invalidos.size > 0
          ? `Revisá ${[...invalidos].map((dia) => DIA_NOMBRE[dia]).join(", ")}: cada franja necesita "desde" anterior a "hasta", sin solaparse con las demás.`
          : "Horas disponibles para proyectar la cola del tablero en días. El + de cada día agrega otra franja (ej.: 9–12 y 15–19)."}
      </div>
    </div>
  );
}
