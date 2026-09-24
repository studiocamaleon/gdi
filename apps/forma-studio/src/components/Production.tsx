import { useMemo, useState } from "react";
import {
  Download,
  FileText,
  ArrowUpRight,
  PackageCheck,
  Printer,
  Layers,
  TriangleAlert,
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { FieldGroup, Field, FieldLabel } from "./ui/field";
import { Input } from "./ui/input";
import { Alert, AlertDescription } from "./ui/alert";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import {
  NumberControl as Num,
  Choice,
  Section,
  SwitchControl,
} from "./Controls";
import type { Model, Project, Production as Config } from "../core/types";
import {
  packParts,
  placedPart,
  stl,
  dxf,
  download,
  costs,
  quoteEnvelope,
  technicalPdf,
  bundle,
} from "../core/output";
import { addRecord } from "../core/storage";
import { toast } from "sonner";
export function Production({
  project: p,
  model,
  onChange,
  busy,
}: {
  project: Project;
  model: Model | null;
  onChange: (p: Project) => void;
  busy: boolean;
}) {
  const [kind, setKind] = useState("filament"),
    [bed, setBed] = useState(0);
  const change = <K extends keyof Config>(key: K, value: Config[K]) =>
    onChange({ ...p, production: { ...p.production, [key]: value } });
  const parts = model?.parts.filter((x) => x.material === kind) || [];
  const layout = useMemo(
    () => packParts(parts, p),
    [
      model,
      p.production.bedWidth,
      p.production.bedHeight,
      p.production.bedDepth,
      p.production.gap,
      p.production.rotate,
      kind,
    ],
  );
  const estimate = model && !busy ? costs(p, model) : null;
  const money = (v: number) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: p.production.currency,
      maximumFractionDigits: 0,
    }).format(v);
  const activeBed = Math.min(bed, Math.max(0, layout.beds - 1));
  const pdf = () => {
    if (!model) return;
    const number = addRecord(p);
    download(
      technicalPdf(p, model, number),
      `${number}.pdf`,
      "application/pdf",
    );
    toast.success(`Ficha ${number} guardada en el historial`);
  };
  return (
    <div className="production-page">
      <div className="production-main">
        <header className="page-title">
          <div>
            <span className="eyebrow">DEL DISEÑO AL TALLER</span>
            <h1>Prepará la producción.</h1>
            <p>Organizá las piezas, revisá consumos y descargá tus archivos.</p>
            {p.mode==="lightbox"&&<p>El costo local contempla las piezas fabricadas. {p.lightbox.rimClosure==="screws"?"Los tornillos de los aros se cotizan aparte. ":""}Iluminación pendiente de definir; fuente, cableado y anclajes no incluidos.</p>}
          </div>
          <Badge variant="outline">
            {model?.parts.length || 0} componentes
          </Badge>
        </header>
        <div className="production-toolbar">
          <ToggleGroup
            className="flex-wrap"
            value={[kind]}
            onValueChange={(v) => {
              if (v[0]) {
                setKind(v[0]);
                setBed(0);
              }
            }}
            variant="outline"
          >
            <ToggleGroupItem value="filament">
              <Printer />
              Impresión 3D
            </ToggleGroupItem>
            <ToggleGroupItem value="acrylic">
              <Layers />
              Corte de acrílico
            </ToggleGroupItem>
            <ToggleGroupItem value="pvc">
              <Layers />
              Corte de PVC
            </ToggleGroupItem>
            {model?.parts.some(part=>part.material==="flexible")&&<ToggleGroupItem value="flexible">Juntas flexibles</ToggleGroupItem>}
          </ToggleGroup>
          <span>
            {layout.beds} {layout.beds === 1 ? "mesa" : "mesas"} ·{" "}
            {p.production.bedWidth} × {p.production.bedHeight} mm
          </span>
        </div>
        <div className="bed-preview">
          <div className="bed-label">
            {kind === "filament" || kind === "flexible" ? "MESA DE IMPRESIÓN" : "PLACA DE CORTE"}{" "}
            {activeBed + 1}
            <span>ESCALA EN MILÍMETROS</span>
          </div>
          <svg
            role="img"
            aria-label="Distribución de piezas sobre la mesa"
            viewBox={`-15 -15 ${p.production.bedWidth + 30} ${p.production.bedHeight + 30}`}
          >
            <defs>
              <pattern
                id="bed-grid"
                width="10"
                height="10"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M10 0H0V10"
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth=".25"
                />
              </pattern>
            </defs>
            <rect
              width={p.production.bedWidth}
              height={p.production.bedHeight}
              fill="var(--card)"
              stroke="var(--muted-foreground)"
              strokeWidth=".6"
            />
            <rect
              width={p.production.bedWidth}
              height={p.production.bedHeight}
              fill="url(#bed-grid)"
            />
            {layout.placements
              .filter((v) => v.bed === activeBed)
              .map((v, i) => {
                const part = v.part,
                  h = part.bounds.max[1] - part.bounds.min[1];
                const points = part.contours
                  .map(
                    (c) =>
                      "M" +
                      c
                        .map(([x, y]) => {
                          const px = x - part.bounds.min[0],
                            py = y - part.bounds.min[1];
                          return `${v.x + (v.rotated ? h - py : px)},${v.y + (v.rotated ? px : py)}`;
                        })
                        .join("L") +
                      "Z",
                  )
                  .join(" ");
                return (
                  <g key={part.id}>
                    <path
                      transform={`translate(0 ${p.production.bedHeight}) scale(1 -1)`}
                      d={points}
                      fill={p.colors[part.layer]}
                      fillRule="evenodd"
                      stroke="var(--foreground)"
                      strokeWidth=".5"
                    />
                    <text
                      x={v.x + v.width / 2}
                      y={p.production.bedHeight - v.y - v.height / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="var(--foreground)"
                      stroke="var(--card)"
                      strokeWidth="1.2"
                      strokeLinejoin="round"
                      paintOrder="stroke"
                      fontSize="4"
                    >
                      {i + 1}
                    </text>
                  </g>
                );
              })}
          </svg>
          <div className="bed-tabs">
            {Array.from({ length: layout.beds }, (_, i) => (
              <Button
                key={i}
                size="sm"
                variant={activeBed === i ? "secondary" : "ghost"}
                onClick={() => setBed(i)}
              >
                Mesa {i + 1}
              </Button>
            ))}
          </div>
        </div>
        {layout.oversized.length > 0 && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertDescription>
              {layout.oversized.length} piezas superan el volumen de trabajo.
              {p.mode === "lightbox"
                ? p.lightbox.segments===1
                  ? " El cuerpo y los aros se conservan enteros. Configurá el volumen real de tu impresora; el ZIP exporta cada pieza completa a su tamaño original. Los acrílicos requieren una placa de corte del tamaño completo."
                  : " Revisá la altura útil y el tamaño de cama. Para los sectores, aumentá su cantidad o reducí el diámetro; los acrílicos requieren una placa de corte del tamaño completo."
                : " Dividilas con la herramienta Cortes o cambiá las dimensiones."}
            </AlertDescription>
          </Alert>
        )}
        <div className="production-actions">
          <Button
            disabled={busy || !layout.placements.length}
            onClick={() => {
              const selected = layout.placements.filter(
                (v) => v.bed === activeBed,
              );
              if (kind === "filament" || kind === "flexible")
                download(
                  stl(selected.map(placedPart)),
                  `mesa-${activeBed + 1}.stl`,
                );
              else {
                const contours = selected.flatMap((v) => {
                  const h = v.part.bounds.max[1] - v.part.bounds.min[1];
                  return v.part.contours.map((c) =>
                    c.map(([x, y]) => {
                      const px = x - v.part.bounds.min[0],
                        py = y - v.part.bounds.min[1];
                      return [
                        v.x + (v.rotated ? h - py : px),
                        v.y + (v.rotated ? px : py),
                      ] as [number, number];
                    }),
                  );
                });
                download(dxf(contours), `placa-${activeBed + 1}.dxf`);
              }
            }}
          >
            <Download data-icon="inline-start" />
            Descargar {kind === "filament" || kind === "flexible" ? "STL" : "DXF"} de esta mesa
          </Button>
          <Button variant="outline" disabled={busy || !model} onClick={pdf}>
            <FileText data-icon="inline-start" />
            Ficha técnica
          </Button>
        </div>
        <p className="fine-note">
          Distribución por rectángulos envolventes con rotación de 90°. Las
          piezas mantienen su escala real. Revisá la orientación y los
          parámetros de impresión en tu laminador.
        </p>
      </div>
      <aside className="production-inspector">
        <Section title="Mesa y separación">
          <FieldGroup>
            <Choice
              label="Formato"
              value={`${p.production.bedWidth}x${p.production.bedHeight}`}
              options={[
                { value: "220x220", label: "220 × 220 mm" },
                { value: "256x256", label: "256 × 256 mm" },
                { value: "300x300", label: "300 × 300 mm" },
                { value: "600x1200", label: "600 × 1200 mm" },
                {
                  value: `${p.production.bedWidth}x${p.production.bedHeight}`,
                  label: "Medida actual",
                },
              ].filter(
                (v, i, a) => a.findIndex((o) => o.value === v.value) === i,
              )}
              onChange={(v) => {
                const [w, h] = v.split("x").map(Number);
                onChange({
                  ...p,
                  production: { ...p.production, bedWidth: w, bedHeight: h },
                });
              }}
            />
            <Num
              label="Ancho"
              value={p.production.bedWidth}
              min={20}
              max={5000}
              onChange={(v) => change("bedWidth", v)}
            />
            <Num
              label="Alto"
              value={p.production.bedHeight}
              min={20}
              max={5000}
              onChange={(v) => change("bedHeight", v)}
            />
            <Num
              label="Separación"
              value={p.production.gap}
              max={30}
              onChange={(v) => change("gap", v)}
            />
            <Num label="Altura útil de impresión" value={p.production.bedDepth} min={20} max={5000} onChange={v=>change("bedDepth",v)}/>
            <SwitchControl
              label="Permitir rotación de 90°"
              value={p.production.rotate}
              onChange={(v) => change("rotate", v)}
            />
          </FieldGroup>
        </Section>
        <Section title="Materiales y tarifas" defaultOpen={false}>
          <FieldGroup>
            <Choice
              label="Filamento"
              value={p.production.filament}
              options={["PLA", "PETG", "ABS", "ASA"]}
              onChange={(v) =>
                onChange({
                  ...p,
                  production: {
                    ...p.production,
                    filament: v,
                    density:
                      { PLA: 1.24, PETG: 1.27, ABS: 1.04, ASA: 1.07 }[v] ||
                      1.24,
                  },
                })
              }
            />
            <Choice
              label="Moneda"
              value={p.production.currency}
              options={["ARS", "USD", "EUR", "BRL"]}
              onChange={(v) => change("currency", v)}
            />
            <Num
              label="Densidad"
              value={p.production.density}
              min={0.5}
              max={3}
              unit="g/cm³"
              onChange={(v) => change("density", v)}
            />
            <Num
              label="Filamento por kg"
              value={p.production.priceKg}
              max={1000000}
              unit="$"
              onChange={(v) => change("priceKg", v)}
            />
            {p.mode==="lightbox"&&<><Num label="Flexible por kg" value={p.production.flexiblePriceKg} max={1000000} unit="$" onChange={v=>change("flexiblePriceKg",v)}/><Num label="Densidad del flexible" value={p.production.flexibleDensity} min={.5} max={3} unit="g/cm³" onChange={v=>change("flexibleDensity",v)}/></>}
            <Num
              label="Producción por hora"
              value={p.production.gramsHour}
              min={0.1}
              max={300}
              unit="g/h"
              onChange={(v) => change("gramsHour", v)}
            />
            <Num
              label="Hora de máquina"
              value={p.production.machineHour}
              max={1000000}
              unit="$"
              onChange={(v) => change("machineHour", v)}
            />
            <Num
              label="Acrílico por m²"
              value={p.production.acrylicM2}
              max={10000000}
              unit="$"
              onChange={(v) => change("acrylicM2", v)}
            />
            <Num
              label="PVC por m²"
              value={p.production.pvcM2}
              max={10000000}
              unit="$"
              onChange={(v) => change("pvcM2", v)}
            />
            <Num
              label="Merma"
              value={p.production.waste}
              max={100}
              unit="%"
              onChange={(v) => change("waste", v)}
            />
            <Num
              label="Margen sobre venta"
              value={p.production.margin}
              max={95}
              unit="%"
              onChange={(v) => change("margin", v)}
            />
          </FieldGroup>
        </Section>
        {estimate && (
          <div className="estimate-card">
            <span className="eyebrow">ESTIMACIÓN DE PRODUCCIÓN</span>
            <div>
              <span>Filamento con merma</span>
              <strong>{estimate.mass.toFixed(1)} g</strong>
            </div>
            <div>
              <span>Tiempo estimado</span>
              <strong>{estimate.hours.toFixed(1)} h</strong>
            </div>
            <div>
              <span>Acrílico neto</span>
              <strong>{estimate.acrylicArea.toFixed(3)} m²</strong>
            </div>
            <div>
              <span>PVC neto</span>
              <strong>{estimate.pvcArea.toFixed(3)} m²</strong>
            </div>
            <div>
              <span>Costo</span>
              <strong>{money(estimate.cost)}</strong>
            </div>
            <div className="price">
              <span>Precio orientativo</span>
              <strong>{money(estimate.price)}</strong>
            </div>
            <small>
              Cálculo sobre volumen sólido y tarifas configuradas. El laminador
              determina tiempos y consumo finales.
            </small>
          </div>
        )}
        <Section title="Identidad y ficha" defaultOpen={false}>
          <FieldGroup>
            <Field>
              <FieldLabel>Nombre del taller</FieldLabel>
              <Input
                value={p.production.company}
                onChange={(e) => change("company", e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>Contacto</FieldLabel>
              <Input
                value={p.production.contact}
                onChange={(e) => change("contact", e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>Logotipo PNG o JPG</FieldLabel>
              <Input
                type="file"
                accept="image/png,image/jpeg"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 1000000) {
                    toast.error("El logotipo debe pesar menos de 1 MB.");
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => change("logo", String(reader.result));
                  reader.readAsDataURL(f);
                }}
              />
            </Field>
            <Field>
              <FieldLabel>Checklist (una tarea por línea)</FieldLabel>
              <textarea
                className="text-area"
                value={p.production.checklist}
                onChange={(e) => change("checklist", e.target.value)}
              />
            </Field>
          </FieldGroup>
        </Section>
        <div className="grafo-card">
          <PackageCheck />
          <h3>Listo para conectar con Grafo</h3>
          <p>
            Exportá componentes, áreas, perímetros y volúmenes para el motor de
            costos.
          </p>
          <Button
            variant="outline"
            disabled={!model || busy}
            onClick={() =>
              model &&
              download(
                JSON.stringify(quoteEnvelope(p, model), null, 2),
                "grafo-fabricacion.json",
                "application/json",
              )
            }
          >
            Descargar ficha de integración
            <ArrowUpRight data-icon="inline-end" />
          </Button>
        </div>
      </aside>
    </div>
  );
}
