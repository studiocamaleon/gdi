"use client";

import * as React from "react";
import {
  CheckIcon,
  ChevronRightIcon,
  EyeIcon,
  FileTextIcon,
  PaperclipIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  briefDisenoEstaCompleto,
  briefDisenoTieneContenido,
  type BriefDiseno,
} from "@/lib/brief-diseno";

type BriefDisenoProps = {
  brief: BriefDiseno;
  caras: 1 | 2;
};

function resumenBrief(brief: BriefDiseno, caras: 1 | 2) {
  const textos = [brief.frente, caras === 2 ? brief.dorso : ""].filter(
    (texto) => texto.trim().length > 0,
  ).length;
  const vectorizaciones = brief.archivos.filter(
    (archivo) => archivo.requiereVectorizacion,
  ).length;
  const partes = [
    caras === 2 ? "Doble faz" : "Una cara",
    textos > 0
      ? `${textos} ${textos === 1 ? "cara con texto" : "caras con texto"}`
      : null,
    brief.archivos.length > 0
      ? `${brief.archivos.length} ${brief.archivos.length === 1 ? "archivo" : "archivos"}`
      : null,
    vectorizaciones > 0 ? `${vectorizaciones} para vectorizar` : null,
  ].filter(Boolean);

  return partes.join(" · ");
}

function EstadoBrief({ completo }: { completo: boolean }) {
  return (
    <Badge
      variant={completo ? "outline" : "destructive"}
      style={
        completo
          ? {
              background: "var(--ok-bg)",
              borderColor: "color-mix(in srgb, var(--ok) 18%, transparent)",
              color: "var(--ok)",
            }
          : undefined
      }
    >
      {completo ? <CheckIcon data-icon="inline-start" /> : null}
      {completo ? "Completo" : "Incompleto"}
    </Badge>
  );
}

function BriefDisenoDetalle({ brief, caras }: BriefDisenoProps) {
  return (
    <dl className="flex flex-col gap-5 text-sm">
      {brief.frente ? (
        <div className="flex flex-col gap-1.5">
          <dt className="font-medium">{caras === 2 ? "Frente" : "Textos"}</dt>
          <dd className="whitespace-pre-wrap text-muted-foreground">
            {brief.frente}
          </dd>
        </div>
      ) : null}
      {caras === 2 ? (
        <div className="flex flex-col gap-1.5">
          <dt className="font-medium">Dorso</dt>
          <dd className="whitespace-pre-wrap text-muted-foreground">
            {brief.dorso || "Sin información cargada."}
          </dd>
        </div>
      ) : null}
      {brief.colores ? (
        <div className="flex flex-col gap-1.5">
          <dt className="font-medium">Colores de preferencia</dt>
          <dd className="whitespace-pre-wrap text-muted-foreground">
            {brief.colores}
          </dd>
        </div>
      ) : null}
      {brief.indicaciones ? (
        <div className="flex flex-col gap-1.5">
          <dt className="font-medium">Otras indicaciones</dt>
          <dd className="whitespace-pre-wrap text-muted-foreground">
            {brief.indicaciones}
          </dd>
        </div>
      ) : null}
      {brief.archivos.length > 0 ? (
        <div className="flex flex-col gap-2">
          <dt className="font-medium">Archivos del brief</dt>
          <dd className="flex flex-col gap-2">
            {brief.archivos.map((archivo) => (
              <div
                key={archivo.nombre}
                className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2"
              >
                <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                  <PaperclipIcon
                    className="size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="truncate">{archivo.nombre}</span>
                </span>
                {archivo.requiereVectorizacion ? (
                  <Badge variant="outline">Vectorizar</Badge>
                ) : null}
              </div>
            ))}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

export function BriefDisenoEspecificaciones({
  brief,
  caras,
  onOpen,
}: BriefDisenoProps & { onOpen: () => void }) {
  if (!briefDisenoTieneContenido(brief)) return null;
  const completo = briefDisenoEstaCompleto(brief, caras);

  return (
    <div className="grid min-h-24 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 border-t bg-card px-4 py-4 sm:px-6">
      <div
        className="flex h-16 w-12 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground shadow-xs"
        aria-hidden="true"
      >
        <FileTextIcon className="size-7" />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="text-sm font-semibold text-foreground">
            Brief de diseño
          </strong>
          <EstadoBrief completo={completo} />
        </div>
        <p className="m-0 truncate text-sm text-muted-foreground">
          {resumenBrief(brief, caras)}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="shrink-0 text-muted-foreground"
        onClick={onOpen}
      >
        <EyeIcon data-icon="inline-start" />
        Ver brief
      </Button>
    </div>
  );
}

export function BriefDisenoProduccion({
  brief,
  caras,
  onOpen,
  detalleInline = false,
}: BriefDisenoProps & {
  onOpen?: () => void;
  detalleInline?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  if (!briefDisenoTieneContenido(brief)) return null;
  const completo = briefDisenoEstaCompleto(brief, caras);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="mt-3 overflow-hidden rounded-lg border bg-muted/30"
    >
      <CollapsibleTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start rounded-none"
          />
        }
      >
        <ChevronRightIcon
          data-icon="inline-start"
          className="transition-transform"
          style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
        />
        <span className="mr-auto">Brief de diseño</span>
        <EstadoBrief completo={completo} />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t px-3 py-3">
        {detalleInline ? (
          <BriefDisenoDetalle brief={brief} caras={caras} />
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="m-0 text-xs text-muted-foreground">
              {resumenBrief(brief, caras)}
            </p>
            {onOpen ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-end"
                onClick={onOpen}
              >
                <EyeIcon data-icon="inline-start" />
                Ver brief
              </Button>
            ) : null}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function BriefDisenoDialog({
  brief,
  caras,
  productoNombre,
  open,
  onOpenChange,
}: BriefDisenoProps & {
  productoNombre: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!briefDisenoTieneContenido(brief)) return null;
  const completo = briefDisenoEstaCompleto(brief, caras);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[min(760px,calc(100dvh-2rem))] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-5 py-4 pr-14">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <DialogTitle>Brief de diseño</DialogTitle>
              <DialogDescription className="truncate">
                {productoNombre} · {resumenBrief(brief, caras)}
              </DialogDescription>
            </div>
            <EstadoBrief completo={completo} />
          </div>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto px-5 py-5">
          <BriefDisenoDetalle brief={brief} caras={caras} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
