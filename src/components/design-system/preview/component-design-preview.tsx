"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Check,
  CircleUserRound,
  Copy,
  FileCheck2,
  LayoutPanelTop,
  Moon,
  MousePointer2,
  Plus,
  RadioTower,
  Save,
  Sun,
  ToggleLeft,
  Zap,
} from "lucide-react";
import { ActionButton as Button } from "../action-button";
import { DesignSystemProvider } from "../appearance";
import theme from "../theme.module.css";
import {
  componentFamilies,
  describeComponentChoices,
  approvedComponentChoices,
  type ComponentFamily,
  type ComponentLook,
} from "./component-design-options";
import {
  SampleAvatar,
  SampleChannels,
  SampleSecondary,
  SampleSegmented,
  SampleTabs,
  sampleTabs,
} from "./component-design-samples";

const familyIcons = {
  tabs: LayoutPanelTop,
  avatars: CircleUserRound,
  secondary: MousePointer2,
  segmented: ToggleLeft,
  channels: RadioTower,
};

/** Selecciones y acciones en memoria. No carga ni modifica órdenes reales. */
export function ComponentDesignPreview() {
  const [family, setFamily] = useState<ComponentFamily>("tabs");
  const [choices, setChoices] = useState(approvedComponentChoices);
  const [dark, setDark] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [tab, setTab] = useState("productos");
  const [documentType, setDocumentType] = useState("orden");
  const [channel, setChannel] = useState("email");
  const [notice, setNotice] = useState("");
  const currentFamily = componentFamilies.find((item) => item.id === family)!;
  const selection = describeComponentChoices(choices);
  const isApproved = componentFamilies.every(
    ({ id }) => choices[id] === approvedComponentChoices[id],
  );

  const choose = (look: ComponentLook) => {
    setChoices((current) => ({ ...current, [family]: look }));
    setNotice(
      `${currentFamily.label}: ${currentFamily.prefix}${look} incorporado a la combinación de prueba.`,
    );
  };
  const simulate = (action: string) =>
    setNotice(`${action}: respuesta de muestra, sin guardar cambios.`);

  async function copySelection() {
    try {
      await navigator.clipboard.writeText(selection);
      setNotice(`Selección copiada: ${selection}`);
    } catch {
      setNotice(`Tu selección: ${selection}. Podés copiar este texto.`);
    }
  }

  function renderSample(look: ComponentLook) {
    const label = `${currentFamily.label} ${currentFamily.prefix}${look}`;
    switch (family) {
      case "tabs":
        return (
          <SampleTabs
            look={look}
            value={tab}
            onChange={setTab}
            label={label}
            disabled={disabled}
          />
        );
      case "avatars":
        return (
          <div className="flex w-full flex-wrap items-center justify-between gap-5">
            <div className="flex min-w-0 items-center gap-3">
              <SampleAvatar look={look} />
              <div>
                <p className="text-xs text-muted-foreground">Vendedor</p>
                <p className="mt-1 text-sm font-medium">Lucas Gómez</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SampleAvatar look={look} initials="AP" name="Ana Pérez" />
              <SampleAvatar
                look={look}
                initials=""
                name="Sin vendedor asignado"
              />
            </div>
          </div>
        );
      case "secondary":
        return (
          <div className="flex flex-wrap items-center gap-3">
            <SampleSecondary
              look={look}
              isDisabled={disabled}
              onPress={() => simulate("Impresiones")}
            >
              <Zap /> Impresiones
            </SampleSecondary>
            <SampleSecondary
              look={look}
              isDisabled={disabled}
              isIconOnly
              aria-label={`Guardar con secundario S${look}`}
              onPress={() => simulate("Guardar")}
            >
              <Save />
            </SampleSecondary>
            <div className="ml-auto flex flex-col items-center gap-2">
              <SampleSecondary look={look} isDisabled>
                <Save /> Borrador
              </SampleSecondary>
              <span className="text-xs text-muted-foreground">
                Deshabilitado
              </span>
            </div>
          </div>
        );
      case "segmented":
        return (
          <SampleSegmented
            look={look}
            value={documentType}
            onChange={setDocumentType}
            label={label}
            disabled={disabled}
          />
        );
      case "channels":
        return (
          <SampleChannels
            look={look}
            value={channel}
            onChange={setChannel}
            label={label}
            disabled={disabled}
          />
        );
    }
  }

  return (
    <DesignSystemProvider appearance={dark ? "dark" : "light"}>
      <div
        data-ui="heroui"
        data-appearance={dark ? "dark" : "light"}
        className={`${theme.theme} min-h-dvh bg-background`}
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
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/dev/diseno/sheets" className="text-xs text-muted-foreground hover:text-foreground">
                Sheets de producto
              </Link>
              <Link
                href="/dev/diseno/botones"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Botones principales
              </Link>
              <Link
                href="/dev/diseno/orden"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Ver orden
              </Link>
              <Button
                variant="ghost"
                isIconOnly
                aria-label={dark ? "Ver tema claro" : "Ver tema oscuro"}
                onPress={() => setDark((value) => !value)}
              >
                {dark ? <Sun /> : <Moon />}
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-9 sm:px-8 sm:py-12">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="mb-3 text-xs font-semibold tracking-widest text-accent-soft-foreground">
                GRAFOPRINT / COMPONENTES
              </p>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Las piezas de nuestra interfaz.
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
                Cuatro alternativas para cada elemento. Elegí una por grupo y
                mirá cómo conviven en una orden de trabajo.
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-3 rounded-xl border border-border bg-surface px-5 py-4">
              <span className="text-xs text-muted-foreground">
                Botón principal aprobado · C / Suave / Compacto
              </span>
              <Button onPress={() => simulate("Agregar producto")}>
                <Plus /> Agregar producto
              </Button>
            </div>
          </div>

          <nav
            aria-label="Familias de componentes"
            className="flex flex-wrap gap-2 border-b border-border pb-5"
          >
            {componentFamilies.map((item) => {
              const Icon = familyIcons[item.id];
              return (
                <Button
                  key={item.id}
                  variant={family === item.id ? "secondary" : "ghost"}
                  aria-pressed={family === item.id}
                  aria-controls="family-panel"
                  onPress={() => setFamily(item.id)}
                >
                  <Icon />
                  {item.label}
                  <span className="ml-1 text-xs opacity-60">4</span>
                </Button>
              );
            })}
          </nav>

          <section id="family-panel" aria-labelledby="family-heading">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 id="family-heading" className="text-lg font-semibold">
                  {currentFamily.label}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {currentFamily.description}
                </p>
              </div>
              {family !== "avatars" && (
                <Button
                  variant="tertiary"
                  aria-pressed={disabled}
                  onPress={() => setDisabled((value) => !value)}
                >
                  {disabled ? "Habilitar muestras" : "Probar deshabilitados"}
                </Button>
              )}
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {currentFamily.options.map((option) => {
                const selected = choices[family] === option.look;
                const approved =
                  approvedComponentChoices[family] === option.look;
                const code = `${currentFamily.prefix}${option.look}`;
                return (
                  <article
                    key={`${family}-${option.look}`}
                    aria-label={`${code}: ${option.name}`}
                    className={`flex min-w-0 flex-col rounded-2xl border bg-surface ${selected ? "border-accent-soft-foreground" : "border-border"}`}
                  >
                    <div className="flex items-center justify-between gap-3 px-5 pt-5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 min-w-8 items-center justify-center rounded-lg bg-background px-1 text-xs font-semibold">
                          {code}
                        </span>
                        <h3 className="text-sm font-semibold">{option.name}</h3>
                      </div>
                      {(selected || approved) && (
                        <span className="flex shrink-0 items-center gap-1 text-xs text-accent-soft-foreground">
                          <Check size={13} />{" "}
                          {approved ? "Aprobada" : "En combinación"}
                        </span>
                      )}
                    </div>
                    <div className="flex min-h-32 min-w-0 items-center px-5 py-6">
                      {renderSample(option.look)}
                    </div>
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4">
                      <p className="max-w-sm flex-1 text-xs leading-5 text-muted-foreground">
                        {option.description}
                      </p>
                      <Button
                        variant="ghost"
                        aria-pressed={selected}
                        aria-label={`Combinar ${code}`}
                        onPress={() => choose(option.look)}
                      >
                        {selected ? "Seleccionada" : `Usar ${code}`}
                        <Check />
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              {family === "avatars"
                ? "Todas las muestras incluyen iniciales y un icono para una persona sin nombre asignado."
                : "Probá los controles con el cursor y con Tab o las flechas del teclado. La selección se sincroniza para comparar el mismo estado."}
            </p>
          </section>

          <section
            aria-labelledby="combination-heading"
            className="scroll-mt-5"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="combination-heading" className="text-lg font-semibold">
                  Tu combinación, en una orden
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Una vista de muestra con las cinco piezas elegidas.
                </p>
              </div>
              <span className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground">
                {isApproved
                  ? "Base aprobada · T2 / A3 / S2 / G4 / C2"
                  : "Combinación de prueba"}
              </span>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border bg-surface">
              <div className="flex flex-wrap items-center justify-between gap-5 border-b border-border p-5">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Papelería institucional · Datos de muestra
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {documentType === "orden"
                      ? "Orden de trabajo"
                      : "Presupuesto"}
                  </p>
                </div>
                <SampleSegmented
                  look={choices.segmented}
                  value={documentType}
                  onChange={setDocumentType}
                  label="Tipo de documento en combinación"
                  disabled={disabled}
                />
              </div>
              <div className="p-5">
                <SampleTabs
                  look={choices.tabs}
                  value={tab}
                  onChange={setTab}
                  label="Secciones de la orden de muestra"
                  disabled={disabled}
                >
                  <div className="grid gap-6 pt-3 md:grid-cols-[240px_minmax(0,1fr)]">
                    <aside
                      className="flex min-w-0 flex-col gap-6 rounded-xl bg-background p-4"
                      aria-label="Datos de la orden de muestra"
                    >
                      <div>
                        <p className="mb-2 text-xs text-muted-foreground">
                          Vendedor
                        </p>
                        <div className="flex items-center gap-2.5">
                          <SampleAvatar look={choices.avatars} />
                          <span className="text-sm">Lucas Gómez</span>
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-xs text-muted-foreground">
                          Canal de venta
                        </p>
                        <SampleChannels
                          look={choices.channels}
                          value={channel}
                          onChange={setChannel}
                          label="Canal de venta en combinación"
                          disabled={disabled}
                        />
                      </div>
                    </aside>
                    <div className="flex min-w-0 flex-col gap-5">
                      <div className="flex flex-wrap justify-end gap-2">
                        <SampleSecondary
                          look={choices.secondary}
                          isDisabled={disabled}
                          onPress={() => simulate("Impresiones")}
                        >
                          <Zap /> Impresiones
                        </SampleSecondary>
                        <Button
                          isDisabled={disabled}
                          onPress={() => simulate("Agregar producto")}
                        >
                          <Plus /> Agregar producto
                        </Button>
                      </div>
                      <div className="rounded-xl border border-border px-4 py-5">
                        <p className="text-sm font-medium">
                          {tab === "productos"
                            ? "Tarjetas personales"
                            : sampleTabs.find((item) => item.id === tab)?.label}
                        </p>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          {tab === "productos"
                            ? "500 unidades · Impresión digital · Papel ilustración"
                            : sampleTabs.find((item) => item.id === tab)
                                ?.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </SampleTabs>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border bg-background/60 p-5">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Total de muestra
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    $ 248.655
                  </p>
                </div>
                <div className="flex gap-2">
                  <SampleSecondary
                    look={choices.secondary}
                    isDisabled={disabled}
                    onPress={() => simulate("Borrador")}
                  >
                    <Save /> Borrador
                  </SampleSecondary>
                  <Button
                    isDisabled={disabled}
                    onPress={() => simulate("Emitir")}
                  >
                    <FileCheck2 />
                    {documentType === "orden"
                      ? "Emitir OT"
                      : "Emitir presupuesto"}
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <footer className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Tu selección de muestra</p>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">
                {selection}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {isApproved
                  ? "Esta base ya está aplicada en los componentes migrados de Orden de trabajo."
                  : "Podés seguir explorando; la base aprobada del sistema se mantiene."}
              </p>
            </div>
            <Button variant="tertiary" onPress={copySelection}>
              <Copy /> Copiar selección
            </Button>
          </footer>
          <p
            role="status"
            className="min-h-5 text-center text-xs text-muted-foreground"
          >
            {notice ||
              "Las acciones de este laboratorio sólo cambian la muestra."}
          </p>
        </main>
      </div>
    </DesignSystemProvider>
  );
}
