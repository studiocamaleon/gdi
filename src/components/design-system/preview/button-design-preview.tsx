"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import {
  Button as HeroButton,
  ToggleButton,
  ToggleButtonGroup,
  type ButtonProps,
} from "@heroui/react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCheck,
  LoaderCircle,
  Moon,
  Plus,
  Save,
  Sun,
  Trash2,
  Zap,
} from "lucide-react";
import { ActionButton as Button } from "../action-button";
import { DesignSystemProvider } from "../appearance";
import theme from "../theme.module.css";
import styles from "./button-design-preview.module.css";

const proposals = [
  {
    id: "A",
    tone: "original",
    name: "Naranja original",
    detail: "El naranja de marca con texto oscuro.",
    finish: "Sólido · Texto oscuro",
  },
  {
    id: "B",
    tone: "deep",
    name: "Naranja profundo",
    detail: "Un tono más intenso para las letras blancas.",
    finish: "Sólido · Texto blanco",
  },
  {
    id: "C",
    tone: "warm",
    name: "Degradado cálido",
    detail: "Del naranja al terracota, con una transición sutil.",
    finish: "Degradado · Texto blanco",
  },
  {
    id: "D",
    tone: "coral",
    name: "Degradado coral",
    detail: "Naranja rojizo con un cierre coral más expresivo.",
    finish: "Degradado · Texto blanco",
  },
  {
    id: "E",
    tone: "outline",
    name: "Sólo el borde",
    detail: "Contorno naranja y una superficie liviana.",
    finish: "Contorno · Texto naranja",
  },
  {
    id: "F",
    tone: "soft",
    name: "Naranja suave",
    detail: "Un fondo tenue para acompañar otras acciones.",
    finish: "Suave · Texto naranja",
  },
] as const;

type Tone = (typeof proposals)[number]["tone"] | "neutral" | "quiet";
const shapes = [
  { id: "recto", label: "Recto", radius: "6px" },
  { id: "suave", label: "Suave", radius: "var(--action-radius)" },
  { id: "capsula", label: "Cápsula", radius: "999px" },
] as const;
const sizes = [
  {
    id: "compacto",
    label: "Compacto",
    height: "var(--action-height-sm)",
    padding: "var(--action-padding-sm)",
    font: "var(--action-font-sm)",
  },
  {
    id: "medio",
    label: "Medio",
    height: "38px",
    padding: "16px",
    font: "14px",
  },
  {
    id: "amplio",
    label: "Amplio",
    height: "44px",
    padding: "20px",
    font: "14px",
  },
] as const;

/** C usa la primitiva aprobada; las otras opciones siguen siendo experimentos. */
function SampleButton({
  tone,
  previewState,
  className = "",
  ...props
}: ButtonProps & {
  tone: Tone;
  previewState?: "hover" | "pressed" | "focus";
}) {
  const Component = tone === "warm" || tone === "neutral" ? Button : HeroButton;
  return (
    <Component
      {...props}
      variant={tone === "neutral" ? "outline" : "primary"}
      data-tone={tone}
      data-icon-only={props.isIconOnly || undefined}
      data-preview-state={previewState}
      className={`${styles.sample} ${className}`}
    />
  );
}

function ChoiceControl({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { id: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <ToggleButtonGroup
        aria-label={label}
        selectionMode="single"
        disallowEmptySelection
        size="sm"
        selectedKeys={new Set([value])}
        onSelectionChange={(keys) => {
          const key = [...keys][0];
          if (typeof key === "string") onChange(key);
        }}
      >
        {options.map((option) => (
          <ToggleButton key={option.id} id={option.id}>
            {option.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  );
}

function StateExample({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-28 flex-col items-center justify-center gap-4 rounded-xl bg-background p-4">
      {children}
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export function ButtonDesignPreview() {
  const [selected, setSelected] = useState<string>("C");
  const [shape, setShape] = useState<string>("suave");
  const [size, setSize] = useState<string>("compacto");
  const [dark, setDark] = useState(false);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const candidate = proposals.find((p) => p.id === selected) ?? proposals[2];
  const currentShape = shapes.find((s) => s.id === shape) ?? shapes[1];
  const currentSize = sizes.find((s) => s.id === size) ?? sizes[0];
  const selectionText = `Opción ${candidate.id} · ${candidate.name} · ${currentShape.label} · ${currentSize.label}`;
  const sampleVars = {
    "--preview-radius": currentShape.radius,
    "--preview-height": currentSize.height,
    "--preview-padding": currentSize.padding,
    "--preview-font": currentSize.font,
  } as CSSProperties;
  const simulate = (action: string) =>
    setNotice(`${action}: así responde el botón en esta muestra.`);

  async function simulateSave() {
    if (pending) return;
    setPending(true);
    setNotice("Probando el estado de carga…");
    await new Promise((resolve) => setTimeout(resolve, 1400));
    setPending(false);
    setNotice("Prueba terminada. El botón vuelve a estar disponible.");
  }

  return (
    <DesignSystemProvider appearance={dark ? "dark" : "light"}>
      <div
        data-ui="heroui"
        data-appearance={dark ? "dark" : "light"}
        className={`${theme.theme} ${styles.lab} min-h-dvh bg-background`}
        style={sampleVars}
      >
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold tracking-tight">
                grafoprint<span className="text-accent">.</span>
              </span>
              <span className="h-4 w-px bg-border" />
              <span className="text-xs text-muted-foreground">
                Laboratorio de diseño
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/dev/diseno/componentes"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Más componentes
              </Link>
              <Link
                href="/dev/diseno/orden"
                className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft size={14} /> Ver orden
              </Link>
              <Button
                variant="ghost"
                size="sm"
                isIconOnly
                onPress={() => setDark((v) => !v)}
                aria-label={dark ? "Ver tema claro" : "Ver tema oscuro"}
              >
                {dark ? <Sun /> : <Moon />}
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto flex max-w-7xl flex-col gap-9 px-5 py-9 sm:px-8 sm:py-12">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="mb-3 text-xs font-semibold tracking-widest text-accent-soft-foreground">
                GRAFOPRINT / BOTONES
              </p>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Un estilo para cada clic.
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
                Seis propuestas con HeroUI para encontrar nuestra identidad.
                Probá los botones, cambiá su forma y comparalos en una orden de
                trabajo.
              </p>
            </div>
            <span className="w-fit rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground">
              Base aprobada · C / Suave / Compacto
            </span>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-5 rounded-2xl border border-border bg-surface p-5">
            <div className="flex flex-wrap gap-6 sm:gap-10">
              <ChoiceControl
                label="Forma"
                value={shape}
                options={shapes}
                onChange={setShape}
              />
              <ChoiceControl
                label="Tamaño"
                value={size}
                options={sizes}
                onChange={setSize}
              />
            </div>
            <p className="pb-2 text-xs text-muted-foreground">
              Pasá el cursor o usá Tab para probar el foco.
            </p>
          </div>

          <section aria-labelledby="proposals-heading">
            <div className="mb-4 flex items-baseline gap-3">
              <span className="text-xs tabular-nums text-muted-foreground">
                01
              </span>
              <h2 id="proposals-heading" className="text-base font-semibold">
                Elegí una dirección
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {proposals.map((p) => (
                <article
                  key={p.id}
                  aria-label={`Opción ${p.id}: ${p.name}`}
                  className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-surface ${selected === p.id ? "border-accent-soft-foreground" : "border-border"}`}
                >
                  <div className="flex items-center justify-between px-5 pt-5">
                    <div className="flex items-center gap-3">
                      <span className="flex size-7 items-center justify-center rounded-lg bg-background text-xs font-semibold">
                        {p.id}
                      </span>
                      <h3 className="text-sm font-semibold">{p.name}</h3>
                    </div>
                    {(p.id === "C" || selected === p.id) && (
                      <span className="flex items-center gap-1 text-xs text-accent-soft-foreground">
                        <Check size={13} />{" "}
                        {p.id === "C" ? "Aprobada" : "En prueba"}
                      </span>
                    )}
                  </div>
                  <div className="flex min-h-32 flex-wrap items-center justify-center gap-3 px-5 py-6">
                    <SampleButton
                      tone={p.tone}
                      onPress={() => {
                        setSelected(p.id);
                        setNotice(`Opción ${p.id} lista para comparar abajo.`);
                      }}
                    >
                      <Plus /> Agregar producto
                    </SampleButton>
                    <SampleButton
                      tone={p.tone}
                      isIconOnly
                      aria-label={`Probar botón con icono de opción ${p.id}`}
                      onPress={() => {
                        setSelected(p.id);
                        simulate(`Opción ${p.id}`);
                      }}
                    >
                      <Plus />
                    </SampleButton>
                  </div>
                  <div className="flex flex-1 flex-col gap-4 border-t border-border px-5 py-4">
                    <div>
                      <p className="text-xs font-medium">{p.finish}</p>
                      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                        {p.detail}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-pressed={selected === p.id}
                      aria-label={`Comparar opción ${p.id}`}
                      className="mt-auto w-full justify-between"
                      onPress={() => {
                        setSelected(p.id);
                        setNotice(`Opción ${p.id} lista para comparar abajo.`);
                      }}
                    >
                      {selected === p.id
                        ? "Comparando esta opción"
                        : `Comparar opción ${p.id}`}
                      <ArrowUpRight />
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section aria-labelledby="context-heading" className="scroll-mt-5">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
              <div className="flex items-baseline gap-3">
                <span className="text-xs text-muted-foreground">02</span>
                <h2 id="context-heading" className="text-base font-semibold">
                  Así se ve en una orden
                </h2>
              </div>
              <p className="text-xs text-accent-soft-foreground">
                {selectionText}
              </p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border bg-surface">
              <div className="flex flex-wrap items-center justify-between gap-5 border-b border-border p-5 sm:p-7">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Orden de trabajo · Ejemplo
                  </p>
                  <p className="mt-1.5 text-lg font-semibold">
                    Papelería institucional
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <SampleButton
                    tone="neutral"
                    onPress={() => simulate("Impresiones")}
                  >
                    <Zap /> Impresiones
                  </SampleButton>
                  <SampleButton
                    tone={candidate.tone}
                    onPress={() => simulate("Agregar producto")}
                  >
                    <Plus /> Agregar producto
                  </SampleButton>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-6 bg-background/60 p-5 sm:p-7">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Total de la orden
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
                    $ 248.655
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <SampleButton
                    tone="quiet"
                    onPress={() => simulate("Cancelar")}
                  >
                    Cancelar
                  </SampleButton>
                  <SampleButton
                    tone="neutral"
                    onPress={() => simulate("Borrador")}
                  >
                    <Save /> Borrador
                  </SampleButton>
                  <SampleButton
                    tone={candidate.tone}
                    onPress={simulateSave}
                    isPending={pending}
                  >
                    {pending ? (
                      <LoaderCircle
                        aria-hidden
                        className="animate-spin motion-reduce:animate-none"
                      />
                    ) : (
                      <Check />
                    )}
                    {pending ? "Emitiendo…" : "Emitir OT"}
                  </SampleButton>
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Base aprobada: C · Degradado cálido · Suave · Compacto. Las
              acciones de esta vista son de muestra.
            </p>
          </section>

          <section aria-labelledby="states-heading">
            <div className="mb-4 flex items-baseline gap-3">
              <span className="text-xs text-muted-foreground">03</span>
              <h2 id="states-heading" className="text-base font-semibold">
                El mismo botón, en cada estado
              </h2>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <StateExample label="Normal">
                  <SampleButton
                    tone={candidate.tone}
                    onPress={() => simulate("Guardar")}
                  >
                    <Save /> Guardar
                  </SampleButton>
                </StateExample>
                <StateExample label="Al pasar el cursor">
                  <SampleButton
                    tone={candidate.tone}
                    previewState="hover"
                    onPress={() => simulate("Guardar")}
                  >
                    <Save /> Guardar
                  </SampleButton>
                </StateExample>
                <StateExample label="Presionado">
                  <SampleButton
                    tone={candidate.tone}
                    previewState="pressed"
                    onPress={() => simulate("Guardar")}
                  >
                    <Save /> Guardar
                  </SampleButton>
                </StateExample>
                <StateExample label="Foco de teclado">
                  <SampleButton
                    tone={candidate.tone}
                    previewState="focus"
                    onPress={() => simulate("Guardar")}
                  >
                    <Save /> Guardar
                  </SampleButton>
                </StateExample>
                <StateExample label="Deshabilitado">
                  <SampleButton tone={candidate.tone} isDisabled>
                    <Save /> Guardar
                  </SampleButton>
                </StateExample>
                <StateExample label="Procesando">
                  <SampleButton tone={candidate.tone} isPending>
                    <LoaderCircle
                      aria-hidden
                      className="animate-spin motion-reduce:animate-none"
                    />{" "}
                    Guardando
                  </SampleButton>
                </StateExample>
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
                <p className="text-xs text-muted-foreground">
                  También con iconos, acciones discretas y acciones de
                  eliminación.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <SampleButton
                    tone={candidate.tone}
                    isIconOnly
                    aria-label="Probar confirmar"
                    onPress={() => simulate("Confirmar")}
                  >
                    <CheckCheck />
                  </SampleButton>
                  <SampleButton
                    tone="neutral"
                    onPress={() => simulate("Volver")}
                  >
                    Volver
                  </SampleButton>
                  <Button
                    variant="danger-soft"
                    className={styles.sample}
                    onPress={() => simulate("Eliminar")}
                  >
                    <Trash2 /> Eliminar
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6 text-xs">
            <div>
              <p className="font-medium">Tu combinación en pantalla</p>
              <p className="mt-1.5 text-muted-foreground">{selectionText}</p>
            </div>
            <p className="text-muted-foreground">
              La base aprobada ya se utiliza en los botones migrados de la
              orden.
            </p>
          </footer>
          <p
            role="status"
            className="min-h-5 text-center text-xs text-muted-foreground"
          >
            {notice || "Tocá cualquier botón para probar su respuesta."}
          </p>
        </main>
      </div>
    </DesignSystemProvider>
  );
}
