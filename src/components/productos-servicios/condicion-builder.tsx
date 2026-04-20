"use client";

/**
 * Rule builder visual para expresiones JsonLogic de activación CONDICIONAL.
 *
 * Traduce entre dos representaciones:
 *  - UI: lista de filas { campo, operador, valor } + combinador and|or.
 *  - DB: objeto JsonLogic { and|or: [ { "==": [{var:"x"}, v] }, ... ] }.
 *
 * La forma soportada cubre ~95% de los casos reales (ver docs/... P4-debt).
 * Para expresiones que no encajan (ej. condiciones anidadas con árboles más
 * complejos), el builder detecta la incompatibilidad y muestra un textarea
 * read-only de fallback para que al menos sea visible sin romper edición.
 */
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CAMPOS_JOB_CONTEXT,
  GRUPOS_CAMPO,
  OPERADORES_POR_TIPO,
  buscarCampo,
  type CampoJobContext,
  type CampoTipo,
} from "@/lib/job-context-fields";

type Combinador = "and" | "or";

export type FilaCondicion = {
  campo: string;
  operador: string;
  valor: string;
};

type JsonLogicExpr = Record<string, unknown>;

/** Construye JsonLogic desde filas editadas por la UI. */
export function buildJsonLogic(
  filas: FilaCondicion[],
  combinador: Combinador,
): JsonLogicExpr | null {
  const completas = filas.filter(
    (f) => f.campo.length > 0 && f.operador.length > 0 && f.valor.trim().length > 0,
  );
  if (completas.length === 0) return null;

  const exprs = completas.map((f) => {
    const campo = buscarCampo(f.campo);
    const tipo: CampoTipo = campo?.tipo ?? "text";
    const valorCoercionado = coerceValor(f.valor, tipo);
    return { [f.operador]: [{ var: f.campo }, valorCoercionado] };
  });

  if (exprs.length === 1) return exprs[0];
  return { [combinador]: exprs };
}

function coerceValor(valor: string, tipo: CampoTipo): string | number | boolean {
  if (tipo === "number") {
    const n = Number(valor);
    return Number.isFinite(n) ? n : 0;
  }
  // text | enum → string
  return valor;
}

type ParseResult =
  | { ok: true; filas: FilaCondicion[]; combinador: Combinador }
  | { ok: false };

/** Parsea JsonLogic → filas si coincide con la forma soportada. */
export function parseJsonLogic(expr: unknown): ParseResult {
  if (expr == null || typeof expr !== "object") return { ok: false };
  const obj = expr as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length !== 1) return { ok: false };

  const topKey = keys[0];

  // Caso 1: combinador (and | or) con array de comparaciones.
  if (topKey === "and" || topKey === "or") {
    const children = obj[topKey];
    if (!Array.isArray(children)) return { ok: false };
    const filas: FilaCondicion[] = [];
    for (const child of children) {
      const f = parseComparacion(child);
      if (!f) return { ok: false };
      filas.push(f);
    }
    return { ok: true, filas, combinador: topKey as Combinador };
  }

  // Caso 2: una sola comparación sin combinador.
  const f = parseComparacion(obj);
  if (!f) return { ok: false };
  return { ok: true, filas: [f], combinador: "and" };
}

function parseComparacion(node: unknown): FilaCondicion | null {
  if (node == null || typeof node !== "object") return null;
  const n = node as Record<string, unknown>;
  const keys = Object.keys(n);
  if (keys.length !== 1) return null;
  const op = keys[0];
  const OPS_VALIDOS = ["==", "!=", "<", "<=", ">", ">="];
  if (!OPS_VALIDOS.includes(op)) return null;
  const args = n[op];
  if (!Array.isArray(args) || args.length !== 2) return null;
  const [left, right] = args;
  if (left == null || typeof left !== "object") return null;
  const leftObj = left as Record<string, unknown>;
  if (!("var" in leftObj) || typeof leftObj.var !== "string") return null;
  if (right == null || typeof right === "object") return null;
  return {
    campo: leftObj.var,
    operador: op,
    valor: String(right),
  };
}

export function CondicionBuilder({
  value,
  onChange,
}: {
  value: Record<string, unknown> | null;
  onChange: (expr: Record<string, unknown> | null) => void;
}) {
  // Estado interno (filas + combinador). Se inicializa parseando el value inicial.
  const parsed = React.useMemo(() => parseJsonLogic(value), [value]);
  const [filas, setFilas] = React.useState<FilaCondicion[]>(() =>
    parsed.ok ? parsed.filas : [],
  );
  const [combinador, setCombinador] = React.useState<Combinador>(() =>
    parsed.ok ? parsed.combinador : "and",
  );
  const [modoFallback, setModoFallback] = React.useState<boolean>(
    () => value != null && !parsed.ok,
  );

  // Re-sincroniza cuando cambia el value externo (ej. el usuario cambia de paso).
  const lastValueRef = React.useRef(value);
  React.useEffect(() => {
    if (lastValueRef.current === value) return;
    lastValueRef.current = value;
    const p = parseJsonLogic(value);
    if (p.ok) {
      setFilas(p.filas);
      setCombinador(p.combinador);
      setModoFallback(false);
    } else if (value != null) {
      setModoFallback(true);
    } else {
      setFilas([]);
      setCombinador("and");
      setModoFallback(false);
    }
  }, [value]);

  // Notifica al padre con el JsonLogic correspondiente a las filas actuales.
  const update = React.useCallback(
    (nextFilas: FilaCondicion[], nextCombinador: Combinador) => {
      setFilas(nextFilas);
      setCombinador(nextCombinador);
      const expr = buildJsonLogic(nextFilas, nextCombinador);
      onChange(expr);
    },
    [onChange],
  );

  if (modoFallback) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs">
        <p className="font-medium text-amber-900">
          Esta condición fue creada por fuera del builder visual.
        </p>
        <p className="mt-1 text-amber-800">
          No se puede editar acá sin riesgo de perder su significado. Si querés
          reescribirla, borrala y armala de nuevo con el builder.
        </p>
        <pre className="mt-2 overflow-x-auto rounded bg-white p-2 font-mono text-[11px]">
          {JSON.stringify(value, null, 2)}
        </pre>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => {
            onChange(null);
            setFilas([]);
            setCombinador("and");
            setModoFallback(false);
          }}
        >
          Borrar y empezar de cero
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      {filas.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Sin condiciones. El paso no se activará hasta que agregues al menos
          una regla.
        </p>
      ) : (
        <div className="space-y-2">
          {filas.map((fila, idx) => (
            <FilaEditor
              key={idx}
              fila={fila}
              onChange={(next) => {
                const copy = [...filas];
                copy[idx] = next;
                update(copy, combinador);
              }}
              onRemove={() => {
                const copy = filas.filter((_, i) => i !== idx);
                update(copy, combinador);
              }}
            />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => update([...filas, emptyFila()], combinador)}
        >
          + Agregar condición
        </Button>
        {filas.length > 1 && (
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Combinar:</Label>
            <Button
              type="button"
              size="sm"
              variant={combinador === "and" ? "default" : "outline"}
              onClick={() => update(filas, "and")}
            >
              Y (todas)
            </Button>
            <Button
              type="button"
              size="sm"
              variant={combinador === "or" ? "default" : "outline"}
              onClick={() => update(filas, "or")}
            >
              O (cualquiera)
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function emptyFila(): FilaCondicion {
  return { campo: "", operador: "", valor: "" };
}

function FilaEditor({
  fila,
  onChange,
  onRemove,
}: {
  fila: FilaCondicion;
  onChange: (next: FilaCondicion) => void;
  onRemove: () => void;
}) {
  const campo = buscarCampo(fila.campo);
  const operadores = campo
    ? OPERADORES_POR_TIPO[campo.tipo]
    : OPERADORES_POR_TIPO.text;

  // Agrupar campos por grupo para el Select.
  const camposPorGrupo = React.useMemo(() => {
    const m = new Map<CampoJobContext["grupo"], CampoJobContext[]>();
    for (const c of CAMPOS_JOB_CONTEXT) {
      const arr = m.get(c.grupo) ?? [];
      arr.push(c);
      m.set(c.grupo, arr);
    }
    return m;
  }, []);

  return (
    <div className="flex flex-wrap items-start gap-2">
      {/* Campo */}
      <div className="min-w-[220px] flex-1">
        <Select
          value={fila.campo || undefined}
          onValueChange={(v) =>
            onChange({
              ...fila,
              campo: v ?? "",
              operador: "", // reset operador porque cambió el tipo
              valor: "",
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleccioná un campo">
              {campo?.label ?? "Seleccioná un campo"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Array.from(camposPorGrupo.entries()).map(([grupo, campos]) => (
              <SelectGroup key={grupo}>
                <SelectLabel>{GRUPOS_CAMPO[grupo]}</SelectLabel>
                {campos.map((c) => (
                  <SelectItem key={c.path} value={c.path}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Operador */}
      <div className="min-w-[160px]">
        <Select
          value={fila.operador || undefined}
          onValueChange={(v) => onChange({ ...fila, operador: v ?? "" })}
          disabled={!fila.campo}
        >
          <SelectTrigger>
            <SelectValue placeholder="Operador">
              {operadores.find((o) => o.op === fila.operador)?.label ??
                "Operador"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {operadores.map((o) => (
              <SelectItem key={o.op} value={o.op}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Valor */}
      <div className="min-w-[180px] flex-1">
        {campo?.tipo === "enum" && campo.opciones ? (
          <Select
            value={fila.valor || undefined}
            onValueChange={(v) => onChange({ ...fila, valor: v ?? "" })}
            disabled={!fila.operador}
          >
            <SelectTrigger>
              <SelectValue placeholder="Valor">
                {campo.opciones.find((o) => o.value === fila.valor)?.label ??
                  "Valor"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {campo.opciones.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="flex items-center gap-1">
            <Input
              type={campo?.tipo === "number" ? "number" : "text"}
              value={fila.valor}
              onChange={(e) => onChange({ ...fila, valor: e.target.value })}
              placeholder="Valor"
              disabled={!fila.operador}
            />
            {campo?.sufijo && (
              <span className="text-xs text-muted-foreground">
                {campo.sufijo}
              </span>
            )}
          </div>
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="shrink-0"
      >
        ×
      </Button>
    </div>
  );
}
