"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  getConfigCentroCopiado,
  actualizarConfigCentroCopiado,
  CC_FORMATOS_MENU,
  type CentroCopiadoConfig,
} from "@/lib/centro-copiado-api";
import s from "./centro-copiado-config.module.css";

/**
 * Configuración › Centro de copiado. Curación de lo que ofrece el TPV: qué
 * papeles (y sus gramajes), tamaños y terminaciones. "Todo seleccionado" se
 * guarda como null (el módulo ofrece todo, y auto-ofrece lo que se agregue
 * después); un subconjunto se guarda explícito.
 */
export function CentroCopiadoConfigView() {
  const [cfg, setCfg] = React.useState<CentroCopiadoConfig | null>(null);
  const [activo, setActivo] = React.useState(true);
  const [cobraSetup, setCobraSetup] = React.useState(false);
  const [margen, setMargen] = React.useState("40");
  const [margenMin, setMargenMin] = React.useState("25");
  const [setupMin, setSetupMin] = React.useState("0");
  const [cleanupMin, setCleanupMin] = React.useState("0");
  // Papel ofrecido → set de gramajes ofrecidos de ese papel. Ausente = no ofrecido.
  const [papeles, setPapeles] = React.useState<Map<string, Set<number>>>(
    new Map(),
  );
  const [tamanos, setTamanos] = React.useState<Set<string>>(new Set());
  const [terminaciones, setTerminaciones] = React.useState<Set<string>>(
    new Set(),
  );
  const [maquinaColor, setMaquinaColor] = React.useState<string | null>(null);
  const [maquinaBn, setMaquinaBn] = React.useState<string | null>(null);
  const [guardando, setGuardando] = React.useState(false);

  const cargar = React.useCallback((c: CentroCopiadoConfig) => {
    setCfg(c);
    setActivo(c.activo);
    setCobraSetup(c.cobraSetup);
    setMargen(String(c.margenPct ?? 40));
    setMargenMin(String(c.margenMinimoPct ?? 25));
    setSetupMin(String(c.setupMin ?? 0));
    setCleanupMin(String(c.cleanupMin ?? 0));
    const gramajesDe = (id: string) =>
      c.disponibles.papeles.find((p) => p.materiaPrimaId === id)?.gramajes ?? [];
    // null = todos los papeles con todos sus gramajes.
    const m = new Map<string, Set<number>>();
    if (c.papeles) {
      for (const p of c.papeles) {
        const grams = p.gramajes?.length ? p.gramajes : gramajesDe(p.materiaPrimaId);
        m.set(p.materiaPrimaId, new Set(grams));
      }
    } else {
      for (const p of c.disponibles.papeles) {
        m.set(p.materiaPrimaId, new Set(p.gramajes));
      }
    }
    setPapeles(m);
    setTamanos(new Set(c.tamanos ?? CC_FORMATOS_MENU.map((f) => f.nombre)));
    setTerminaciones(new Set(c.terminaciones ?? c.disponibles.terminaciones));
    setMaquinaColor(c.maquinaColorId);
    setMaquinaBn(c.maquinaBnId);
  }, []);

  React.useEffect(() => {
    let vivo = true;
    void getConfigCentroCopiado()
      .then((c) => {
        if (vivo) cargar(c);
      })
      .catch(() => toast.error("No se pudo cargar la configuración."));
    return () => {
      vivo = false;
    };
  }, [cargar]);

  const toggleSet = (
    set: Set<string>,
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    key: string,
  ) => {
    const n = new Set(set);
    if (n.has(key)) n.delete(key);
    else n.add(key);
    setter(n);
  };

  // Papel on/off: al prender arranca con TODOS sus gramajes.
  const togglePapel = (id: string, gramajesTodos: number[]) => {
    setPapeles((prev) => {
      const n = new Map(prev);
      if (n.has(id)) n.delete(id);
      else n.set(id, new Set(gramajesTodos));
      return n;
    });
  };

  // Gramaje de un papel: no se puede dejar en cero (el papel debe tener ≥1).
  const toggleGramaje = (id: string, g: number) => {
    setPapeles((prev) => {
      const actual = prev.get(id);
      if (!actual) return prev;
      const n = new Map(prev);
      const grams = new Set(actual);
      if (grams.has(g)) {
        if (grams.size === 1) return prev; // no dejar el papel sin gramajes
        grams.delete(g);
      } else {
        grams.add(g);
      }
      n.set(id, grams);
      return n;
    });
  };

  const guardar = async () => {
    if (!cfg) return;
    if (papeles.size === 0) {
      toast.error("Elegí al menos un papel para ofrecer.");
      return;
    }
    if (tamanos.size === 0) {
      toast.error("Elegí al menos un tamaño para ofrecer.");
      return;
    }
    setGuardando(true);
    try {
      const todos = cfg.disponibles;
      const papelesArr = [...papeles.entries()].map(([id, grams]) => {
        const disp = todos.papeles.find((p) => p.materiaPrimaId === id);
        const todosGramajes = disp ? disp.gramajes.length === grams.size : false;
        return todosGramajes
          ? { materiaPrimaId: id }
          : { materiaPrimaId: id, gramajes: [...grams] };
      });
      // null (ofrece todo) sólo si están TODOS los papeles con TODOS sus gramajes.
      const papelesFull =
        papelesArr.length === todos.papeles.length &&
        papelesArr.every((p) => !("gramajes" in p));
      const tamanosArr = [...tamanos];
      const termArr = [...terminaciones];
      const actualizada = await actualizarConfigCentroCopiado({
        activo,
        cobraSetup,
        margenPct: Math.max(0, Number(margen) || 0),
        margenMinimoPct: Math.max(0, Number(margenMin) || 0),
        setupMin: Math.max(0, Number(setupMin) || 0),
        cleanupMin: Math.max(0, Number(cleanupMin) || 0),
        papeles: papelesFull ? null : papelesArr,
        tamanos:
          tamanosArr.length === CC_FORMATOS_MENU.length ? null : tamanosArr,
        terminaciones:
          termArr.length === todos.terminaciones.length ? null : termArr,
        maquinaColorId: maquinaColor,
        maquinaBnId: maquinaBn,
      });
      cargar(actualizada);
      toast.success("Configuración guardada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };

  if (!cfg) return <div className={s.loading}>Cargando configuración…</div>;

  return (
    <div className={s.wrap}>
      <div className={s.head}>
        <div>
          <h1 className={s.titulo}>Centro de copiado</h1>
          <p className={s.sub}>
            Elegí qué papeles, tamaños y terminaciones ofrece el TPV de impresión
            por hoja. Lo que dejes sin marcar no aparece al cargar documentos.
          </p>
        </div>
      </div>

      {/* Módulo activo */}
      <div className={s.seccion}>
        <div className={s.toggle}>
          <button
            type="button"
            className={`${s.sw} ${activo ? s.swOn : ""}`}
            role="switch"
            aria-checked={activo}
            aria-label="Módulo activo"
            onClick={() => setActivo((a) => !a)}
          />
          <div className={s.toggleTxt}>
            <b>Módulo activo</b>
            <span>
              Si lo pausás, el TPV de centro de copiado deja de ofrecerse.
            </span>
          </div>
        </div>
      </div>

      {/* Cobrar setup/limpieza */}
      <div className={s.seccion}>
        <div className={s.toggle}>
          <button
            type="button"
            className={`${s.sw} ${cobraSetup ? s.swOn : ""}`}
            role="switch"
            aria-checked={cobraSetup}
            aria-label="Cobrar preparación de máquina"
            onClick={() => setCobraSetup((v) => !v)}
          />
          <div className={s.toggleTxt}>
            <b>Cobrar preparación y limpieza de máquina</b>
            <span>
              Por defecto no se cobra (el centro trabaja por volumen). Si lo
              activás, cada documento suma el tiempo de preparación/limpieza de la
              impresora — sube el precio de las cargas chicas.
            </span>
          </div>
        </div>
        {cobraSetup ? (
          <div className={s.maquinas} style={{ marginTop: 14 }}>
            <label className={s.campo}>
              <span>Preparación / setup (min)</span>
              <input
                className={s.select}
                type="number"
                min={0}
                step={0.5}
                value={setupMin}
                onChange={(e) => setSetupMin(e.target.value)}
                aria-label="Minutos de preparación"
              />
            </label>
            <label className={s.campo}>
              <span>Limpieza / cleanup (min)</span>
              <input
                className={s.select}
                type="number"
                min={0}
                step={0.5}
                value={cleanupMin}
                onChange={(e) => setCleanupMin(e.target.value)}
                aria-label="Minutos de limpieza"
              />
            </label>
          </div>
        ) : null}
        <span className={s.seccionHint} style={{ marginTop: 12 }}>
          El centro de copiado cobra el tiempo real de impresión (sin redondear a
          minutos enteros), así el precio por hoja es estable. Si querés un piso por
          trabajo chico, activá el cobro y poné un setup (ej. 1 min).
        </span>
      </div>

      {/* Precio y margen */}
      <div className={s.seccion}>
        <div className={s.seccionHead}>
          <span className={s.seccionTitulo}>Precio y margen</span>
          <span className={s.seccionHint}>precio = costo × margen</span>
        </div>
        <div className={s.maquinas}>
          <label className={s.campo}>
            <span>Margen (%)</span>
            <input
              className={s.select}
              type="number"
              min={0}
              step={1}
              value={margen}
              onChange={(e) => setMargen(e.target.value)}
              aria-label="Margen porcentaje"
            />
          </label>
          <label className={s.campo}>
            <span>Margen mínimo (%)</span>
            <input
              className={s.select}
              type="number"
              min={0}
              step={1}
              value={margenMin}
              onChange={(e) => setMargenMin(e.target.value)}
              aria-label="Margen mínimo porcentaje"
            />
          </label>
        </div>
        <span className={s.seccionHint} style={{ marginTop: 8 }}>
          El costo lo calcula el motor (papel, tóner, tiempo). El margen fija el
          precio de venta; el mínimo es el piso de rentabilidad.
        </span>
      </div>

      {/* Máquinas */}
      {cfg.disponibles.maquinas.length > 0 ? (
        <div className={s.seccion}>
          <div className={s.seccionHead}>
            <span className={s.seccionTitulo}>Máquinas</span>
            <span className={s.seccionHint}>
              &quot;Automática&quot; elige la láser por su configuración
            </span>
          </div>
          <div className={s.maquinas}>
            <label className={s.campo}>
              <span>Color</span>
              <select
                className={s.select}
                value={maquinaColor ?? ""}
                onChange={(e) => setMaquinaColor(e.target.value || null)}
              >
                <option value="">Automática</option>
                {cfg.disponibles.maquinas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                    {m.esColor ? " (color)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className={s.campo}>
              <span>Blanco y negro</span>
              <select
                className={s.select}
                value={maquinaBn ?? ""}
                onChange={(e) => setMaquinaBn(e.target.value || null)}
              >
                <option value="">Automática</option>
                {cfg.disponibles.maquinas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                    {m.esColor ? " (color)" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      ) : null}

      {/* Papeles + gramajes */}
      <div className={s.seccion}>
        <div className={s.seccionHead}>
          <span className={s.seccionTitulo}>Papeles ofrecidos</span>
          <span className={s.seccionHint}>
            {papeles.size} de {cfg.disponibles.papeles.length}
          </span>
        </div>
        {cfg.disponibles.papeles.length === 0 ? (
          <div className={s.vacio}>No hay papeles cargados en el inventario.</div>
        ) : (
          <div className={s.papelesList}>
            {cfg.disponibles.papeles.map((p) => {
              const grams = papeles.get(p.materiaPrimaId);
              const on = !!grams;
              return (
                <div key={p.materiaPrimaId} className={s.papelRow}>
                  <button
                    type="button"
                    className={on ? s.chipOn : s.chip}
                    onClick={() => togglePapel(p.materiaPrimaId, p.gramajes)}
                  >
                    {p.nombre}
                  </button>
                  {on && p.gramajes.length > 1 ? (
                    <div className={s.gramajes}>
                      {p.gramajes.map((g) => (
                        <button
                          key={g}
                          type="button"
                          className={grams!.has(g) ? s.gramOn : s.gram}
                          onClick={() => toggleGramaje(p.materiaPrimaId, g)}
                        >
                          {g}g
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tamaños */}
      <div className={s.seccion}>
        <div className={s.seccionHead}>
          <span className={s.seccionTitulo}>Tamaños ofrecidos</span>
          <span className={s.seccionHint}>
            {tamanos.size} de {CC_FORMATOS_MENU.length}
          </span>
        </div>
        <div className={s.chips}>
          {CC_FORMATOS_MENU.map((f) => (
            <button
              key={f.nombre}
              type="button"
              className={tamanos.has(f.nombre) ? s.chipOn : s.chip}
              onClick={() => toggleSet(tamanos, setTamanos, f.nombre)}
            >
              {f.nombre}
            </button>
          ))}
        </div>
      </div>

      {/* Terminaciones */}
      <div className={s.seccion}>
        <div className={s.seccionHead}>
          <span className={s.seccionTitulo}>Terminaciones ofrecidas</span>
          <span className={s.seccionHint}>
            {terminaciones.size} de {cfg.disponibles.terminaciones.length}
          </span>
        </div>
        {cfg.disponibles.terminaciones.length === 0 ? (
          <div className={s.vacio}>Todavía no hay terminaciones disponibles.</div>
        ) : (
          <div className={s.chips}>
            {cfg.disponibles.terminaciones.map((t) => (
              <button
                key={t}
                type="button"
                className={terminaciones.has(t) ? s.chipOn : s.chip}
                onClick={() => toggleSet(terminaciones, setTerminaciones, t)}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={s.foot}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void guardar()}
          disabled={guardando}
        >
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
