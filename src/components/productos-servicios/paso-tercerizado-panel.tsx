"use client";

import * as React from "react";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { PlusIcon, XIcon } from "lucide-react";
import { getProveedores } from "@/lib/proveedores-api";
import type {
  TercerizadoEje,
  TercerizadoEntradaPayload,
  UpsertConfigPasoPayload,
} from "@/lib/productos-servicios-api";

/**
 * Panel de configuración de un paso TERCERIZADO (proveedor + fuente de costo).
 * UI portada verbatim del diseño canónico (claude.ai/design ·
 * "Tercerización proveedor.html"); estilos scopeados bajo `.terc` en globals.css.
 * Usa `<select>` nativos (como el diseño): renderizan inline y no cierran el
 * sheet del cotizador (el editor de rutas no es sheet, pero mantenemos paridad).
 * docs/productos-tercerizados-diseno.md §7a.
 */

type Patch = Partial<UpsertConfigPasoPayload>;

const CLAVE_CANTIDAD = "cantidad";

const FUENTES = [
  { value: "matriz", label: "Matriz de costos" },
  { value: "tarifa_magnitud", label: "Tarifa por magnitud" },
  { value: "fijo", label: "Costo fijo" },
] as const;

const MAGNITUDES = [
  { value: "area_m2", label: "Área (m²)" },
  { value: "perimetro_ml", label: "Perímetro (ml)" },
  { value: "ml", label: "Metros lineales (ml)" },
  { value: "cantidad", label: "Cantidad (unidades)" },
] as const;

// Tecnología del proceso tercerizado (para que los reportes lo clasifiquen aunque
// no tenga máquina propia). Incluye procesos que la gráfica no hace in-house.
const SIN_TECNOLOGIA = "__none__";
const TECNOLOGIAS_TERCERIZADO = [
  { value: "offset", label: "Offset" },
  { value: "serigrafia", label: "Serigrafía" },
  { value: "tampografia", label: "Tampografía" },
  { value: "sublimacion", label: "Sublimación" },
  { value: "bordado", label: "Bordado" },
  { value: "laser", label: "Corte/grabado láser" },
  { value: "flexografia", label: "Flexografía" },
  { value: "termoformado", label: "Termoformado" },
  { value: "otra", label: "Otra" },
] as const;

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase() || "eje";

function cfgDe(value: UpsertConfigPasoPayload): Record<string, unknown> {
  const c = value.tercerizadoConfigJson;
  return c && typeof c === "object" ? { ...(c as Record<string, unknown>) } : {};
}

/** Producto cartesiano de los valores de cada eje (sin el de cantidad). */
function combinaciones(ejes: TercerizadoEje[]): Array<Record<string, string>> {
  return ejes.reduce<Array<Record<string, string>>>(
    (acc, eje) =>
      acc.flatMap((combo) =>
        eje.valores.map((v) => ({ ...combo, [eje.clave]: v.clave })),
      ),
    [{}],
  );
}

const claveDe = (valores: Record<string, unknown>) =>
  Object.keys(valores)
    .sort()
    .map((k) => `${k}=${valores[k]}`)
    .join("&");

export function PasoTercerizadoPanel({
  value,
  onChange,
  onToggle,
}: {
  value: UpsertConfigPasoPayload;
  onChange: (patch: Patch) => void;
  /** Prende/apaga la tercerización del paso (limpia máquina/perfil al prender). */
  onToggle: (tercerizado: boolean) => void;
}) {
  const [proveedores, setProveedores] = React.useState<
    Array<{ id: string; nombre: string }>
  >([]);

  React.useEffect(() => {
    let vivo = true;
    getProveedores()
      .then((res) => {
        if (vivo) setProveedores(res.map((p) => ({ id: p.id, nombre: p.nombre })));
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const on = !!value.tercerizado;

  // El panel muestra "matriz" por default; hay que dejarlo también en el estado.
  React.useEffect(() => {
    if (on && !value.fuenteCostoTercerizado) {
      onChange({ fuenteCostoTercerizado: "matriz" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, value.fuenteCostoTercerizado]);

  const fuente = value.fuenteCostoTercerizado ?? "matriz";
  const cfg = cfgDe(value);
  const patchCfg = (extra: Record<string, unknown>) =>
    onChange({ tercerizadoConfigJson: { ...cfg, ...extra } });

  return (
    <div className="terc">
      <button
        type="button"
        className={`toggle-card ${on ? "on" : ""}`}
        onClick={() => onToggle(!on)}
        aria-pressed={on}
      >
        <span className="switch" />
        <div>
          <div className="tt">Lo terceriza un proveedor</div>
          <div className="ts">
            No lo produce la empresa — el costo lo define la grilla del proveedor.
          </div>
        </div>
      </button>

      {on ? (
        <div className="panel">
          {/* proveedor */}
          <div className="sec">
            <div className="fields">
              <div className="field">
                <label>Proveedor</label>
                <select
                  className="ctl"
                  value={value.proveedorId ?? ""}
                  onChange={(e) => onChange({ proveedorId: e.target.value || null })}
                >
                  <option value="">Elegí un proveedor</option>
                  {proveedores.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Fuente de costo</label>
                <select
                  className="ctl"
                  value={fuente}
                  onChange={(e) =>
                    onChange({
                      fuenteCostoTercerizado: e.target.value,
                      // Cambiar la fuente resetea la config específica pero conserva
                      // la tecnología del proceso.
                      tercerizadoConfigJson: cfg.tecnologia
                        ? { tecnologia: cfg.tecnologia }
                        : {},
                    })
                  }
                >
                  {FUENTES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Plazo del proveedor (días)</label>
                <input
                  className="ctl mono"
                  type="number"
                  min={0}
                  placeholder="Ej: 5"
                  value={value.plazoProveedorDias ?? ""}
                  onChange={(e) =>
                    onChange({
                      plazoProveedorDias:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="field">
                <label>Tecnología (para reportes)</label>
                <select
                  className="ctl"
                  value={
                    typeof cfg.tecnologia === "string" && cfg.tecnologia
                      ? cfg.tecnologia
                      : SIN_TECNOLOGIA
                  }
                  onChange={(e) =>
                    patchCfg({
                      tecnologia: e.target.value === SIN_TECNOLOGIA ? null : e.target.value,
                    })
                  }
                >
                  <option value={SIN_TECNOLOGIA}>Sin tecnología</option>
                  {TECNOLOGIAS_TERCERIZADO.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {fuente === "tarifa_magnitud" ? (
            <TarifaEditor cfg={cfg} patchCfg={patchCfg} />
          ) : fuente === "fijo" ? (
            <FijoEditor cfg={cfg} patchCfg={patchCfg} />
          ) : (
            <MatrizEditor value={value} onChange={onChange} />
          )}

          <div className="foot">
            <p>
              Cada celda es el costo del proveedor para esa combinación y tanda.
              Dejá vacías las combinaciones que no ofrece.
            </p>
            <p>
              Los costos se cargan en <b>neto (sin IVA)</b>. El precio de venta
              sale del margen configurado en el tab <b>Pricing</b>.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ─────────── Fuente: tarifa por magnitud ─────────── */
function TarifaEditor({
  cfg,
  patchCfg,
}: {
  cfg: Record<string, unknown>;
  patchCfg: (extra: Record<string, unknown>) => void;
}) {
  const { moneda } = useConfigRegional();
  const numOrNull = (v: string) => (v === "" ? null : Number(v));
  return (
    <div className="sec">
      <div className="sec-head">
        <h2>Tarifa por magnitud</h2>
        <span className="hint">el costo se calcula por unidad de magnitud</span>
      </div>
      <div className="fields four">
        <div className="field">
          <label>Magnitud</label>
          <select
            className="ctl"
            value={String(cfg.magnitud ?? "area_m2")}
            onChange={(e) => patchCfg({ magnitud: e.target.value })}
          >
            {MAGNITUDES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Tarifa ({moneda.simbolo})</label>
          <div className="money">
            <span className="mp">{moneda.simbolo}</span>
            <input
              className="ctl mono"
              type="number"
              min={0}
              placeholder="0"
              value={(cfg.tarifa as number) ?? ""}
              onChange={(e) => patchCfg({ tarifa: numOrNull(e.target.value) })}
            />
          </div>
        </div>
        <div className="field">
          <label>Mínimo de magnitud</label>
          <input
            className="ctl mono"
            type="number"
            min={0}
            placeholder="opcional"
            value={(cfg.minimoMagnitud as number) ?? ""}
            onChange={(e) => patchCfg({ minimoMagnitud: numOrNull(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>Mínimo de costo ({moneda.simbolo})</label>
          <div className="money">
            <span className="mp">{moneda.simbolo}</span>
            <input
              className="ctl mono"
              type="number"
              min={0}
              placeholder="opcional"
              value={(cfg.minimoCosto as number) ?? ""}
              onChange={(e) => patchCfg({ minimoCosto: numOrNull(e.target.value) })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Fuente: costo fijo ─────────── */
function FijoEditor({
  cfg,
  patchCfg,
}: {
  cfg: Record<string, unknown>;
  patchCfg: (extra: Record<string, unknown>) => void;
}) {
  const { moneda } = useConfigRegional();
  return (
    <div className="sec">
      <div className="sec-head">
        <h2>Costo fijo</h2>
        <span className="hint">un costo único para el producto</span>
      </div>
      <div className="fields">
        <div className="field">
          <label>Costo ({moneda.simbolo})</label>
          <div className="money">
            <span className="mp">{moneda.simbolo}</span>
            <input
              className="ctl mono"
              type="number"
              min={0}
              placeholder="0"
              value={(cfg.costo as number) ?? ""}
              onChange={(e) =>
                patchCfg({ costo: e.target.value === "" ? null : Number(e.target.value) })
              }
            />
          </div>
        </div>
        <div className="field">
          <label>Se cobra por</label>
          <select
            className="ctl"
            value={String(cfg.por ?? "trabajo")}
            onChange={(e) => patchCfg({ por: e.target.value })}
          >
            <option value="trabajo">Trabajo (una vez)</option>
            <option value="unidad">Unidad (× cantidad)</option>
          </select>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Fuente: matriz (atributos × cantidades + grilla) ─────────── */
function MatrizEditor({
  value,
  onChange,
}: {
  value: UpsertConfigPasoPayload;
  onChange: (patch: Patch) => void;
}) {
  const { moneda } = useConfigRegional();
  const cfg = cfgDe(value);
  const ejes: TercerizadoEje[] = Array.isArray(cfg.ejes)
    ? (cfg.ejes as TercerizadoEje[])
    : [];
  const atributos = ejes.filter((e) => e.clave !== CLAVE_CANTIDAD);
  const cantidadEje = ejes.find((e) => e.clave === CLAVE_CANTIDAD);
  const cantidades = cantidadEje?.valores ?? [];
  const entradas = value.tercerizadoEntradas ?? [];

  const setEjes = (next: TercerizadoEje[]) =>
    onChange({
      tercerizadoConfigJson: { ...cfg, ejes: next, columnaEjeClave: CLAVE_CANTIDAD },
    });

  const setEntradas = (next: TercerizadoEntradaPayload[]) =>
    onChange({ tercerizadoEntradas: next });

  const costoPorClave = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entradas) m.set(claveDe(e.valores), e.costo);
    return m;
  }, [entradas]);

  const combos = React.useMemo(() => combinaciones(atributos), [atributos]);

  const setCosto = (
    rowValores: Record<string, string>,
    cantClave: string,
    costo: number | null,
  ) => {
    const valores = { ...rowValores, [CLAVE_CANTIDAD]: cantClave };
    const clave = claveDe(valores);
    const resto = entradas.filter((e) => claveDe(e.valores) !== clave);
    if (costo == null || Number.isNaN(costo)) {
      setEntradas(resto);
    } else {
      setEntradas([...resto, { valores, cantidad: Number(cantClave) || 1, costo }]);
    }
  };

  const addEje = () => {
    const n = atributos.length + 1;
    const clave = slug(`atributo ${n}`) + "_" + n;
    setEjes([
      ...atributos,
      { clave, label: `Atributo ${n}`, orden: n, valores: [] },
      ...(cantidadEje ? [cantidadEje] : []),
    ]);
  };

  const patchEje = (clave: string, patch: Partial<TercerizadoEje>) => {
    const next = ejes.map((e) => (e.clave === clave ? { ...e, ...patch } : e));
    setEjes(
      next.filter((e) => e.clave !== CLAVE_CANTIDAD).concat(cantidadEje ? [cantidadEje] : []),
    );
  };

  const removeEje = (clave: string) =>
    setEjes(atributos.filter((e) => e.clave !== clave).concat(cantidadEje ? [cantidadEje] : []));

  const addValor = (ejeClave: string, texto: string) => {
    const t = texto.trim();
    if (!t) return;
    const eje = atributos.find((e) => e.clave === ejeClave);
    if (!eje) return;
    const clave = slug(t);
    if (eje.valores.some((v) => v.clave === clave)) return;
    patchEje(ejeClave, { valores: [...eje.valores, { clave, label: t }] });
  };

  const removeValor = (ejeClave: string, valClave: string) => {
    const eje = atributos.find((e) => e.clave === ejeClave);
    if (!eje) return;
    patchEje(ejeClave, { valores: eje.valores.filter((v) => v.clave !== valClave) });
  };

  const setCantidades = (vals: Array<{ clave: string; label: string }>) => {
    setEjes([
      ...atributos,
      { clave: CLAVE_CANTIDAD, label: "Cantidad", orden: 99, valores: vals },
    ]);
  };

  const addCantidad = (texto: string) => {
    const n = parseInt((texto || "").replace(/\D/g, ""), 10);
    if (!n) return;
    if (cantidades.some((c) => c.clave === String(n))) return;
    const next = [...cantidades, { clave: String(n), label: String(n) }].sort(
      (a, b) => Number(a.clave) - Number(b.clave),
    );
    setCantidades(next);
  };

  const gridLista =
    atributos.length > 0 &&
    atributos.every((e) => e.valores.length > 0) &&
    cantidades.length > 0;

  return (
    <>
      {/* atributos */}
      <div className="sec">
        <div className="sec-head">
          <h2>Atributos</h2>
          <span className="hint">definen las filas de la grilla</span>
          <span className="grow" />
          <button type="button" className="btn-add" onClick={addEje}>
            <PlusIcon /> Agregar atributo
          </button>
        </div>
        <div className="attr-list">
          {atributos.length === 0 ? (
            <p style={{ fontSize: 12.5, color: "var(--muted-text-2)", margin: 0 }}>
              Agregá los atributos que mueven el precio (medida, faz, papel…).
            </p>
          ) : (
            atributos.map((eje) => (
              <div className="attr-row" key={eje.clave}>
                <div className="attr-top">
                  <input
                    className="attr-name"
                    value={eje.label}
                    placeholder="Nombre del atributo"
                    onChange={(e) => patchEje(eje.clave, { label: e.target.value })}
                  />
                  <button
                    type="button"
                    className="attr-del"
                    onClick={() => removeEje(eje.clave)}
                    title="Quitar atributo"
                  >
                    <XIcon />
                  </button>
                </div>
                <div className="vals">
                  {eje.valores.map((v) => (
                    <span className="pill" key={v.clave}>
                      {v.label}
                      <button
                        type="button"
                        className="x"
                        onClick={() => removeValor(eje.clave, v.clave)}
                        aria-label={`Quitar ${v.label}`}
                      >
                        <XIcon />
                      </button>
                    </span>
                  ))}
                  <input
                    className="val-in"
                    placeholder="Agregar valor…"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addValor(eje.clave, e.currentTarget.value);
                        e.currentTarget.value = "";
                      }
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* cantidades */}
      <div className="sec">
        <div className="sec-head">
          <h2>Cantidades</h2>
          <span className="hint">definen las columnas de la grilla</span>
        </div>
        <div className="qty-row">
          {cantidades.map((c) => (
            <span className="qpill" key={c.clave}>
              {Number(c.clave).toLocaleString("es-AR")}
              <button
                type="button"
                className="x"
                onClick={() =>
                  setCantidades(cantidades.filter((x) => x.clave !== c.clave))
                }
                aria-label={`Quitar ${c.label}`}
              >
                <XIcon />
              </button>
            </span>
          ))}
          <input
            className="qty-in"
            type="number"
            min={0}
            placeholder="Ej: 5000"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCantidad(e.currentTarget.value);
                e.currentTarget.value = "";
              }
            }}
          />
        </div>
      </div>

      {/* grilla */}
      <div className="sec">
        <div className="sec-head">
          <h2>
            Grilla de costos{" "}
            <span style={{ color: "var(--muted-text-2)", fontWeight: 500 }}>· neto</span>
          </h2>
        </div>
        <div className="grid-scroll">
          {gridLista ? (
            <table className="cgrid">
              <thead>
                <tr>
                  {atributos.map((e) => (
                    <th key={e.clave}>{e.label || "—"}</th>
                  ))}
                  {cantidades.map((c) => (
                    <th key={c.clave} className="q">
                      {Number(c.clave).toLocaleString("es-AR")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {combos.map((combo, i) => (
                  <tr key={i}>
                    {atributos.map((e) => (
                      <td key={e.clave} className="attr-col">
                        <span className="v">
                          {e.valores.find((v) => v.clave === combo[e.clave])?.label ??
                            combo[e.clave]}
                        </span>
                      </td>
                    ))}
                    {cantidades.map((c) => {
                      const val =
                        costoPorClave.get(
                          claveDe({ ...combo, [CLAVE_CANTIDAD]: c.clave }),
                        ) ?? "";
                      return (
                        <td key={c.clave} className="cell">
                          <div className="cell-wrap">
                            <input
                              className={`cell-in ${val !== "" ? "filled" : ""}`}
                              type="number"
                              min={0}
                              placeholder="0"
                              value={val}
                              onChange={(ev) =>
                                setCosto(
                                  combo,
                                  c.clave,
                                  ev.target.value === "" ? null : Number(ev.target.value),
                                )
                              }
                            />
                            <span className="pfx">{moneda.simbolo}</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-grid">
              Agregá atributos con valores y al menos una cantidad para generar la
              grilla.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
