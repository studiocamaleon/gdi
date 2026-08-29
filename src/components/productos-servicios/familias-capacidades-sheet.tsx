"use client";

import * as React from "react";
import {
  CheckIcon,
  CircleDashedIcon,
  CpuIcon,
  DatabaseIcon,
  FactoryIcon,
  ListChecksIcon,
  PackageIcon,
  SlidersHorizontalIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  mecanismoCantidadLabels,
  modoActivacionLabels,
  modoTiempoLabels,
} from "@/lib/labels-humanos";
import type {
  CatalogoFamilias,
  FamiliaListItem,
} from "@/lib/productos-servicios";
import { cn } from "@/lib/utils";

interface FamiliasCapacidadesSheetProps {
  catalogoFamilias: CatalogoFamilias;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const relacionMaquinaLabels: Record<string, string> = {
  "M-0": "Sin máquina",
  "M-1": "Máquina única",
  "M-2": "Alternativas",
};

const tipoSlotLabels: Record<string, string> = {
  SUSTRATO: "Sustrato",
  CONSUMIBLE_MAQUINA: "Consumible",
  INSUMO_PASO: "Insumo",
  TAPA: "Tapa",
  OTRO: "Otro",
};

const tipoParamLabels: Record<string, string> = {
  string: "Texto",
  number: "Número",
  boolean: "Sí/No",
  enum: "Lista",
};

function labelFromMap(map: Record<string, { label: string }>, value: string) {
  return map[value]?.label ?? value;
}

function categoriaNombre(catalogo: CatalogoFamilias, codigo: string) {
  return (
    catalogo.categorias.find((categoria) => categoria.codigo === codigo)
      ?.nombre ?? codigo
  );
}

function hasItems(items?: unknown[]) {
  return Array.isArray(items) && items.length > 0;
}

function CapabilityMark({
  enabled,
  label,
}: {
  enabled: boolean;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium",
        enabled
          ? "bg-secondary text-secondary-foreground"
          : "text-muted-foreground",
      )}
      title={label}
    >
      {enabled ? (
        <CheckIcon className="size-3.5" />
      ) : (
        <CircleDashedIcon className="size-3.5" />
      )}
      <span>{enabled ? "Sí" : "No"}</span>
    </span>
  );
}

function CompactBadges({
  values,
  max = 2,
}: {
  values: string[];
  max?: number;
}) {
  if (values.length === 0) {
    return <span className="text-xs text-muted-foreground">No aplica</span>;
  }
  const visible = values.slice(0, max);
  const extra = values.length - visible.length;
  return (
    <div className="flex min-w-32 flex-wrap gap-1">
      {visible.map((value) => (
        <Badge key={value} variant="outline">
          {value}
        </Badge>
      ))}
      {extra > 0 ? <Badge variant="secondary">+{extra}</Badge> : null}
    </div>
  );
}

function DetailSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 rounded-md border bg-background p-3">
      <h4 className="flex items-center gap-2 text-sm font-medium">
        <Icon className="size-4 text-muted-foreground" />
        {title}
      </h4>
      {children}
    </section>
  );
}

function EmptyDetail({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function FamiliaDetalle({
  familia,
  catalogoFamilias,
}: {
  familia: FamiliaListItem;
  catalogoFamilias: CatalogoFamilias;
}) {
  const materialesRequeridos = familia.slotsRequeridos.filter(
    (slot) => slot.requerido,
  );
  const materialesOpcionales = familia.slotsRequeridos.filter(
    (slot) => !slot.requerido,
  );

  return (
    <aside className="flex flex-col gap-3 lg:sticky lg:top-0">
      <div className="flex flex-col gap-2 rounded-md border bg-muted/20 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            {categoriaNombre(catalogoFamilias, familia.categoria)}
          </Badge>
        </div>
        <div>
          <h3 className="text-lg font-semibold">{familia.nombre}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {familia.descripcion ?? "Sin descripción cargada."}
          </p>
        </div>
      </div>

      <DetailSection title="Máquina y tiempo" icon={FactoryIcon}>
        <div className="flex flex-wrap gap-1">
          {familia.relacionMaquinaSoportada.map((modo) => (
            <Badge key={modo} variant="outline">
              {relacionMaquinaLabels[modo] ?? modo}
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {familia.modosTiempoSoportados.map((modo) => (
            <Badge key={modo} variant="secondary">
              {labelFromMap(modoTiempoLabels, modo)}
            </Badge>
          ))}
        </div>
      </DetailSection>

      <DetailSection title="Cantidad y activación" icon={SlidersHorizontalIcon}>
        <div className="flex flex-wrap gap-1">
          {familia.mecanismosCantidadSoportados.map((modo) => (
            <Badge key={modo} variant="outline">
              {labelFromMap(mecanismoCantidadLabels, modo)}
            </Badge>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          Activación default:{" "}
          <span className="font-medium text-foreground">
            {labelFromMap(modoActivacionLabels, familia.modoActivacionDefault)}
          </span>
        </p>
      </DetailSection>

      <DetailSection title="Materiales" icon={PackageIcon}>
        {!hasItems(familia.slotsRequeridos) ? (
          <EmptyDetail>No consume materiales declarados.</EmptyDetail>
        ) : (
          <div className="flex flex-col gap-2 text-sm">
            {materialesRequeridos.length > 0 ? (
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  Requeridos
                </div>
                <div className="flex flex-wrap gap-1">
                  {materialesRequeridos.map((slot) => (
                    <Badge key={slot.codigo} variant="outline">
                      {slot.nombre} · {tipoSlotLabels[slot.tipo] ?? slot.tipo}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
            {materialesOpcionales.length > 0 ? (
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  Opcionales
                </div>
                <div className="flex flex-wrap gap-1">
                  {materialesOpcionales.map((slot) => (
                    <Badge key={slot.codigo} variant="secondary">
                      {slot.nombre} · {tipoSlotLabels[slot.tipo] ?? slot.tipo}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </DetailSection>

      <DetailSection title="Parámetros" icon={ListChecksIcon}>
        {!hasItems(familia.paramsPasoSchema) ? (
          <EmptyDetail>Sin parámetros propios.</EmptyDetail>
        ) : (
          <div className="flex flex-col gap-2">
            {familia.paramsPasoSchema.map((param) => (
              <div
                key={param.campo}
                className="rounded-md bg-muted/40 p-2 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{param.etiqueta}</span>
                  <Badge variant="outline">
                    {tipoParamLabels[param.tipo] ?? param.tipo}
                  </Badge>
                  {param.requerido ? (
                    <Badge variant="secondary">Requerido</Badge>
                  ) : null}
                </div>
                {param.descripcion ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {param.descripcion}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </DetailSection>

      <DetailSection title="Motor" icon={DatabaseIcon}>
        <div className="flex flex-col gap-2">
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">
              Inputs
            </div>
            <CompactBadges values={familia.inputsRequeridos} max={4} />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">
              Outputs
            </div>
            <CompactBadges values={familia.outputsCanonicos} max={4} />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">
              Validaciones
            </div>
            {!hasItems(familia.validaciones) ? (
              <EmptyDetail>Sin validaciones declaradas.</EmptyDetail>
            ) : (
              <div className="flex flex-col gap-1">
                {familia.validaciones.map((validacion) => (
                  <div
                    key={validacion.codigo}
                    className="text-xs text-muted-foreground"
                  >
                    {validacion.mensaje}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DetailSection>

      <DetailSection title="Máquinas compatibles" icon={CpuIcon}>
        {!hasItems(familia.plantillasCompatibles) ? (
          <EmptyDetail>No requiere plantilla de máquina.</EmptyDetail>
        ) : (
          <CompactBadges values={familia.plantillasCompatibles} max={8} />
        )}
      </DetailSection>
    </aside>
  );
}

export function FamiliasCapacidadesSheet({
  catalogoFamilias,
  open,
  onOpenChange,
}: FamiliasCapacidadesSheetProps) {
  const familias = catalogoFamilias.familias;
  const [selectedCodigo, setSelectedCodigo] = React.useState(
    familias[0]?.codigo ?? "",
  );

  React.useEffect(() => {
    if (!familias.some((familia) => familia.codigo === selectedCodigo)) {
      setSelectedCodigo(familias[0]?.codigo ?? "");
    }
  }, [familias, selectedCodigo]);

  const selectedFamilia =
    familias.find((familia) => familia.codigo === selectedCodigo) ??
    familias[0] ??
    null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:!w-[min(96vw,78rem)] sm:!max-w-none">
        <SheetHeader className="border-b">
          <SheetTitle>Matriz de familias de paso</SheetTitle>
          <SheetDescription>
            Compará qué permite cada familia antes de armar la ruta de
            producción.
          </SheetDescription>
        </SheetHeader>

        <div className="grid flex-1 gap-4 px-4 pb-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="min-w-0 overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-56">Familia</TableHead>
                  <TableHead>Máquina</TableHead>
                  <TableHead>Tiempo</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Materiales</TableHead>
                  <TableHead>Params</TableHead>
                  <TableHead>Outputs</TableHead>
                  <TableHead>Validaciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {familias.map((familia) => {
                  const isSelected = selectedFamilia?.codigo === familia.codigo;
                  return (
                    <TableRow
                      key={familia.codigo}
                      data-state={isSelected ? "selected" : undefined}
                      className="cursor-pointer"
                      onClick={() => setSelectedCodigo(familia.codigo)}
                    >
                      <TableCell className="whitespace-normal">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{familia.nombre}</span>
                          <span className="text-xs text-muted-foreground">
                            {categoriaNombre(
                              catalogoFamilias,
                              familia.categoria,
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <CompactBadges
                          values={familia.relacionMaquinaSoportada.map(
                            (modo) => relacionMaquinaLabels[modo] ?? modo,
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <CompactBadges
                          values={familia.modosTiempoSoportados.map((modo) =>
                            labelFromMap(modoTiempoLabels, modo),
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <CompactBadges
                          values={familia.mecanismosCantidadSoportados.map(
                            (modo) =>
                              labelFromMap(mecanismoCantidadLabels, modo),
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <CapabilityMark
                          enabled={hasItems(familia.slotsRequeridos)}
                          label="Materiales"
                        />
                      </TableCell>
                      <TableCell>
                        <CapabilityMark
                          enabled={hasItems(familia.paramsPasoSchema)}
                          label="Parámetros"
                        />
                      </TableCell>
                      <TableCell>
                        <CapabilityMark
                          enabled={hasItems(familia.outputsCanonicos)}
                          label="Outputs"
                        />
                      </TableCell>
                      <TableCell>
                        <CapabilityMark
                          enabled={hasItems(familia.validaciones)}
                          label="Validaciones"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {selectedFamilia ? (
            <FamiliaDetalle
              familia={selectedFamilia}
              catalogoFamilias={catalogoFamilias}
            />
          ) : (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">
              No hay familias disponibles.
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
