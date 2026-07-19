"use client";

import * as React from "react";
import { PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getProveedores } from "@/lib/proveedores-api";
import type {
  TercerizadoEje,
  TercerizadoEntradaPayload,
  UpsertConfigPasoPayload,
} from "@/lib/productos-servicios-api";

/**
 * Panel de configuración de un paso TERCERIZADO (proveedor + fuente de costo).
 * Aislado del editor grande a propósito: la grilla vive en su propio subárbol
 * y no arrastra al editor de pasos en cada tecla.
 * docs/productos-tercerizados-diseno.md §7a.
 */

type Patch = Partial<UpsertConfigPasoPayload>;

const CLAVE_CANTIDAD = "cantidad";

const FUENTES = [
  { value: "matriz", label: "Matriz (medida/faz/papel × cantidad)" },
  { value: "tarifa_magnitud", label: "Tarifa por magnitud ($/m², $/ml, …)" },
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
}: {
  value: UpsertConfigPasoPayload;
  onChange: (patch: Patch) => void;
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

  // El panel muestra "matriz" por default; hay que dejarlo también en el estado
  // (si no, se guarda fuente vacía y el motor no puede costear).
  React.useEffect(() => {
    if (!value.fuenteCostoTercerizado) onChange({ fuenteCostoTercerizado: "matriz" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.fuenteCostoTercerizado]);

  const fuente = value.fuenteCostoTercerizado ?? "matriz";
  const cfg = cfgDe(value);
  const patchCfg = (extra: Record<string, unknown>) =>
    onChange({ tercerizadoConfigJson: { ...cfg, ...extra } });

  return (
    <div className="flex flex-col gap-5 rounded-lg border border-border bg-muted/30 p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">Proveedor</span>
          <Select
            value={value.proveedorId ?? ""}
            onValueChange={(v) => onChange({ proveedorId: v || null })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Elegí un proveedor">
                {value.proveedorId
                  ? (proveedores.find((p) => p.id === value.proveedorId)?.nombre ??
                    "…")
                  : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {proveedores.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">Fuente de costo</span>
          <Select
            value={fuente}
            onValueChange={(v) =>
              onChange({
                fuenteCostoTercerizado: v,
                // La fuente cambia la config específica (ejes/tarifa/fijo) pero la
                // tecnología del proceso se conserva.
                tercerizadoConfigJson: cfg.tecnologia
                  ? { tecnologia: cfg.tecnologia }
                  : {},
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FUENTES.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">Plazo del proveedor (días)</span>
          <Input
            type="number"
            min={0}
            value={value.plazoProveedorDias ?? ""}
            onChange={(e) =>
              onChange({
                plazoProveedorDias: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            placeholder="—"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">Tecnología (para reportes)</span>
          <Select
            value={typeof cfg.tecnologia === "string" && cfg.tecnologia ? cfg.tecnologia : SIN_TECNOLOGIA}
            onValueChange={(v) =>
              patchCfg({ tecnologia: v === SIN_TECNOLOGIA ? null : v })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Sin tecnología">
                {typeof cfg.tecnologia === "string" && cfg.tecnologia
                  ? (TECNOLOGIAS_TERCERIZADO.find((t) => t.value === cfg.tecnologia)?.label ??
                    cfg.tecnologia)
                  : "Sin tecnología"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SIN_TECNOLOGIA}>Sin tecnología</SelectItem>
              {TECNOLOGIAS_TERCERIZADO.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      {fuente === "matriz" ? (
        <MatrizEditor value={value} onChange={onChange} />
      ) : fuente === "tarifa_magnitud" ? (
        <TarifaEditor cfg={cfg} patchCfg={patchCfg} />
      ) : (
        <FijoEditor cfg={cfg} patchCfg={patchCfg} />
      )}

      <p className="text-xs text-muted-foreground">
        Los costos se cargan en <b>neto (sin IVA)</b>. El precio de venta sale del
        margen configurado en el tab <b>Pricing</b>.
      </p>
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
  const numOrNull = (v: string) => (v === "" ? null : Number(v));
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted-foreground">Magnitud</span>
        <Select
          value={String(cfg.magnitud ?? "area_m2")}
          onValueChange={(v) => patchCfg({ magnitud: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MAGNITUDES.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted-foreground">Tarifa ($)</span>
        <Input
          type="number"
          min={0}
          value={(cfg.tarifa as number) ?? ""}
          onChange={(e) => patchCfg({ tarifa: numOrNull(e.target.value) })}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted-foreground">Mínimo de magnitud</span>
        <Input
          type="number"
          min={0}
          value={(cfg.minimoMagnitud as number) ?? ""}
          onChange={(e) => patchCfg({ minimoMagnitud: numOrNull(e.target.value) })}
          placeholder="opcional"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted-foreground">Mínimo de costo ($)</span>
        <Input
          type="number"
          min={0}
          value={(cfg.minimoCosto as number) ?? ""}
          onChange={(e) => patchCfg({ minimoCosto: numOrNull(e.target.value) })}
          placeholder="opcional"
        />
      </label>
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
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted-foreground">Costo ($)</span>
        <Input
          type="number"
          min={0}
          value={(cfg.costo as number) ?? ""}
          onChange={(e) =>
            patchCfg({ costo: e.target.value === "" ? null : Number(e.target.value) })
          }
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted-foreground">Se cobra por</span>
        <Select
          value={String(cfg.por ?? "trabajo")}
          onValueChange={(v) => patchCfg({ por: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="trabajo">Trabajo (una vez)</SelectItem>
            <SelectItem value="unidad">Unidad (× cantidad)</SelectItem>
          </SelectContent>
        </Select>
      </label>
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
  const cfg = cfgDe(value);
  const ejes: TercerizadoEje[] = Array.isArray(cfg.ejes) ? (cfg.ejes as TercerizadoEje[]) : [];
  const atributos = ejes.filter((e) => e.clave !== CLAVE_CANTIDAD);
  const cantidadEje = ejes.find((e) => e.clave === CLAVE_CANTIDAD);
  const cantidades = cantidadEje?.valores ?? [];
  const entradas = value.tercerizadoEntradas ?? [];

  const setEjes = (next: TercerizadoEje[]) =>
    onChange({ tercerizadoConfigJson: { ...cfg, ejes: next, columnaEjeClave: CLAVE_CANTIDAD } });

  const setEntradas = (next: TercerizadoEntradaPayload[]) =>
    onChange({ tercerizadoEntradas: next });

  // Índice de costos por clave-de-combinación, para lookup O(1) en la grilla.
  const costoPorClave = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entradas) m.set(claveDe(e.valores), e.costo);
    return m;
  }, [entradas]);

  const combos = React.useMemo(() => combinaciones(atributos), [atributos]);

  const setCosto = (rowValores: Record<string, string>, cantClave: string, costo: number | null) => {
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
    setEjes(next.filter((e) => e.clave !== CLAVE_CANTIDAD).concat(cantidadEje ? [cantidadEje] : []));
  };

  const removeEje = (clave: string) =>
    setEjes(atributos.filter((e) => e.clave !== clave).concat(cantidadEje ? [cantidadEje] : []));

  const setCantidades = (vals: Array<{ clave: string; label: string }>) => {
    const nuevoCant: TercerizadoEje = {
      clave: CLAVE_CANTIDAD,
      label: "Cantidad",
      orden: 99,
      valores: vals,
    };
    setEjes([...atributos, nuevoCant]);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Atributos (filas)</span>
          <Button type="button" variant="outline" size="sm" onClick={addEje}>
            <PlusIcon data-icon="inline-start" /> Agregar atributo
          </Button>
        </div>
        {atributos.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Agregá los atributos que mueven el precio (medida, faz, papel…).
          </p>
        ) : (
          atributos.map((eje) => (
            <EjeEditor
              key={eje.clave}
              eje={eje}
              onLabel={(label) => patchEje(eje.clave, { label })}
              onValores={(valores) => patchEje(eje.clave, { valores })}
              onRemove={() => removeEje(eje.clave)}
            />
          ))
        )}
      </div>

      <ChipsEditor
        titulo="Cantidades (columnas)"
        placeholder="Ej. 1000"
        valores={cantidades}
        numerico
        onChange={setCantidades}
      />

      {atributos.length > 0 && atributos.every((e) => e.valores.length > 0) && cantidades.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Grilla de costos (neto)</span>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  {atributos.map((e) => (
                    <th key={e.clave} className="px-3 py-2 text-left font-medium">
                      {e.label}
                    </th>
                  ))}
                  {cantidades.map((c) => (
                    <th key={c.clave} className="px-3 py-2 text-right font-medium">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {combos.map((combo, i) => (
                  <tr key={i} className="border-t border-border">
                    {atributos.map((e) => (
                      <td key={e.clave} className="px-3 py-1.5">
                        {e.valores.find((v) => v.clave === combo[e.clave])?.label ?? combo[e.clave]}
                      </td>
                    ))}
                    {cantidades.map((c) => (
                      <td key={c.clave} className="px-2 py-1 text-right">
                        <Input
                          type="number"
                          min={0}
                          className="h-8 w-24 text-right"
                          value={costoPorClave.get(claveDe({ ...combo, [CLAVE_CANTIDAD]: c.clave })) ?? ""}
                          onChange={(ev) =>
                            setCosto(combo, c.clave, ev.target.value === "" ? null : Number(ev.target.value))
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Cada celda es el costo del proveedor para esa tanda. Dejá vacías las
            combinaciones que no ofrece.
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Cargá al menos un atributo con valores y las cantidades para ver la grilla.
        </p>
      )}
    </div>
  );
}

/* ─────────── Editor de un eje (label + chips de valores) ─────────── */
function EjeEditor({
  eje,
  onLabel,
  onValores,
  onRemove,
}: {
  eje: TercerizadoEje;
  onLabel: (label: string) => void;
  onValores: (valores: Array<{ clave: string; label: string }>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="flex items-center gap-2">
        <Input
          value={eje.label}
          onChange={(e) => onLabel(e.target.value)}
          className="h-8 max-w-[220px]"
          placeholder="Nombre del atributo"
        />
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label="Quitar atributo">
          <XIcon />
        </Button>
      </div>
      <ChipsEditor
        titulo=""
        placeholder="Ej. 10×15"
        valores={eje.valores}
        onChange={onValores}
      />
    </div>
  );
}

/* ─────────── Editor genérico de chips (valores) ─────────── */
function ChipsEditor({
  titulo,
  placeholder,
  valores,
  numerico,
  onChange,
}: {
  titulo: string;
  placeholder: string;
  valores: Array<{ clave: string; label: string }>;
  numerico?: boolean;
  onChange: (valores: Array<{ clave: string; label: string }>) => void;
}) {
  const [texto, setTexto] = React.useState("");
  const agregar = () => {
    const t = texto.trim();
    if (!t) return;
    const clave = numerico ? String(Number(t.replace(/\D/g, "")) || t) : slug(t);
    if (valores.some((v) => v.clave === clave)) {
      setTexto("");
      return;
    }
    onChange([...valores, { clave, label: t }]);
    setTexto("");
  };
  return (
    <div className="flex flex-col gap-2">
      {titulo ? <span className="text-sm font-medium">{titulo}</span> : null}
      <div className="flex flex-wrap items-center gap-1.5">
        {valores.map((v) => (
          <span
            key={v.clave}
            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs"
          >
            {v.label}
            <button
              type="button"
              onClick={() => onChange(valores.filter((x) => x.clave !== v.clave))}
              aria-label={`Quitar ${v.label}`}
              className="text-muted-foreground hover:text-foreground"
            >
              <XIcon className="size-3" />
            </button>
          </span>
        ))}
        <div className="flex items-center gap-1">
          <Input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                agregar();
              }
            }}
            placeholder={placeholder}
            className="h-8 w-28"
            type={numerico ? "number" : "text"}
          />
          <Button type="button" variant="outline" size="sm" onClick={agregar}>
            <PlusIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}
