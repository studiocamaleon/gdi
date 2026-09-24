import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Field, FieldLabel, FieldDescription, FieldError } from "./ui/field";
import { Input } from "./ui/input";
import { Slider } from "./ui/slider";
import { Switch } from "./ui/switch";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "./ui/select";
export function NumberControl({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 0.1,
  unit = "mm",
  slider = false,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  slider?: boolean;
}) {
  const id = useId();
  // El texto incompleto (vacío, signo o separador decimal) no es una medida
  // del modelo. Conservarlo incluso tras el debounce evita mover el cursor o
  // borrar la coma y los ceros mientras se sigue escribiendo.
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const autoApplied = useRef<number | null>(null);
  const change = useRef(onChange);
  change.current = onChange;
  const format = (n: number) => String(Number(n.toFixed(10)));
  const parse = (text: string) => {
    const normalized = text.trim().replace(",", ".");
    return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)
      ? Number(normalized)
      : NaN;
  };
  useEffect(() => {
    if (autoApplied.current !== value) {
      setDraft(null);
      setError(null);
    }
    autoApplied.current = null;
  }, [value]);
  useEffect(() => {
    setDraft(null);
    setError(null);
    autoApplied.current = null;
  }, [label]);
  useEffect(() => {
    if (draft === null || composing) return;
    const n = parse(draft);
    // Un separador al final todavía está en edición. Los valores incompletos
    // o fuera de rango conservan la última geometría válida.
    if (!Number.isFinite(n) || n < min || n > max || /[.,]$/.test(draft.trim()))
      return;
    const timer = setTimeout(() => {
      if (n !== value) {
        autoApplied.current = n;
        change.current(n);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [draft, composing, value, min, max, label]);
  const apply = (n: number) => {
    autoApplied.current = null;
    setDraft(null);
    setError(null);
    if (n !== value) change.current(n);
  };
  const commit = () => {
    if (draft === null) return;
    const n = parse(draft);
    if (!Number.isFinite(n)) {
      setError("Ingresá un número válido.");
    } else if (n < min || n > max) {
      setError(
        `Ingresá un valor entre ${format(min)} y ${format(max)}${unit ? ` ${unit}` : ""}.`,
      );
    } else {
      apply(n);
    }
  };
  return (
    <Field className="number-control" data-invalid={!!error}>
      <div className="control-line">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <div className="numeric-value">
          <Input
            id={id}
            type="text"
            inputMode="decimal"
            role="spinbutton"
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
            value={draft ?? format(value)}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(null);
            }}
            onBlur={commit}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={() => setComposing(false)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setDraft(null);
                setError(null);
              } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault();
                const parsed = draft === null ? value : parse(draft);
                const base = Number.isFinite(parsed) ? parsed : value;
                const next = base + (e.key === "ArrowUp" ? step : -step);
                apply(Math.min(max, Math.max(min, Number(next.toFixed(10)))));
              }
            }}
          />
          <span>{unit}</span>
        </div>
      </div>
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
      {slider && (
        <Slider
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={[value]}
          onValueChange={(v) => apply(Array.isArray(v) ? v[0] : v)}
        />
      )}
    </Field>
  );
}
export function SwitchControl({
  label,
  value,
  onChange,
  description,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  description?: string;
}) {
  const id = useId();
  return (
    <Field>
      <div className="control-line">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <Switch id={id} checked={value} onCheckedChange={onChange} />
      </div>
      {description && <FieldDescription>{description}</FieldDescription>}
    </Field>
  );
}
export function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: (string | { value: string; label: string })[];
  onChange: (v: string) => void;
}) {
  const id = useId(),
    items = options.map((o) =>
      typeof o === "string" ? { value: o, label: o } : o,
    );
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        value={value}
        items={items}
        onValueChange={(v) => v && onChange(v)}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {items.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}
export function Section({
  title,
  caption,
  children,
  defaultOpen = true,
}: {
  title: string;
  caption?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="inspector-section" open={defaultOpen || undefined}>
      <summary>
        {title}
        <span>⌄</span>
      </summary>
      {caption && <p className="section-caption">{caption}</p>}
      <div className="section-content">{children}</div>
    </details>
  );
}
