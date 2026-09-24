import { useId } from "react";
import { Choice, NumberControl, Section } from "./Controls";
import { FieldGroup } from "./ui/field";
import { PATTERNS, patternPitch } from "../core/perforation";
import type { Parameters } from "../core/types";

export function PerforationEditor({
  params: p,
  onChange,
}: {
  params: Parameters;
  onChange: (changes: Partial<Parameters>) => void;
}) {
  const n = (
    key: keyof Parameters,
    label: string,
    min: number,
    max: number,
    step = 0.1,
    unit = "mm",
  ) => (
    <NumberControl
      label={label}
      value={p[key] as number}
      min={min}
      max={max}
      step={step}
      unit={unit}
      slider
      onChange={(value) => onChange({ [key]: value })}
    />
  );
  const pattern = PATTERNS.find((o) => o.value === p.patternType)!;
  return (
    <Section
      title="Patrón del frente"
      caption="Los huecos atraviesan sólo el frente impreso. El acrílico permanece entero detrás."
    >
      <PatternSwatch params={p} />
      <FieldGroup>
        <Choice
          label="Forma del calado"
          value={p.patternType}
          options={PATTERNS}
          onChange={(value) =>
            onChange({
              patternType: value as Parameters["patternType"],
              patternLength: Math.max(p.patternSize, p.patternLength),
            })
          }
        />
        {n(
          "patternSize",
          pattern.sizeLabel,
          0.4,
          p.patternType === "oblong" ? p.patternLength : 100,
        )}
        {p.patternType === "oblong" &&
          n("patternLength", "Largo del oblongo", p.patternSize, 100)}
        {n("patternSpacing", "Separación mínima entre huecos", 0.4, 30)}
        {n("patternBorder", "Borde sin calar", 2, 50)}
        {n("patternMargin", "Margen adicional del calado", 0, 30)}
        {n("patternRotation", "Rotación del patrón", 0, 360, 1, "°")}
        {p.patternType !== "circle" &&
          n("patternAngle", "Rotación de cada hueco", 0, 360, 1, "°")}
      </FieldGroup>
      <p className="section-caption">
        El borde protege el perímetro exterior y los huecos de la letra. Se
        omiten las figuras que no entran completas. La separación se mide entre
        bordes.
      </p>
    </Section>
  );
}

function PatternSwatch({ params: p }: { params: Parameters }) {
  const clipId = useId();
  const { polygon, x, y } = patternPitch(p);
  const scale = 16 / Math.max(x, y),
    cells = [];
  for (let j = -4; j <= 4; j++)
    for (let i = -9; i <= 9; i++)
      cells.push(
        <polygon
          key={`${i}/${j}`}
          points={polygon
            .map(
              ([px, py]) => `${(px + i * x) * scale},${(py + j * y) * scale}`,
            )
            .join(" ")}
        />,
      );
  return (
    <svg
      viewBox="0 0 240 96"
      className="w-full rounded-lg"
      role="img"
      aria-label={`Muestra del patrón ${PATTERNS.find((o) => o.value === p.patternType)?.label.toLowerCase()}`}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="8" y="8" width="224" height="80" rx="8" />
        </clipPath>
      </defs>
      <rect width="240" height="96" rx="12" fill="var(--foreground)" />
      <g clipPath={`url(#${clipId})`}>
        <g
          transform={`translate(120 48) rotate(${p.patternRotation})`}
          fill="var(--background)"
        >
          {cells}
        </g>
      </g>
    </svg>
  );
}
