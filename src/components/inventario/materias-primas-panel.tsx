"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CirclePlusIcon,
  PencilIcon,
  ToggleLeftIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  createMateriaPrima,
  toggleMateriaPrima,
} from "@/lib/materias-primas-api";
import {
  familiaMateriaPrimaItems,
  type MateriaPrima,
  type MateriaPrimaPayload,
  type SubfamiliaMateriaPrima,
} from "@/lib/materias-primas";
import {
  getMateriaPrimaTemplate,
  materiaPrimaTemplatesV1,
} from "@/lib/materia-prima-templates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
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

const subfamiliaMateriaPrimaLabels: Record<SubfamiliaMateriaPrima, string> = {
  sustrato_hoja: "Sustrato hoja",
  sustrato_rollo_flexible: "Sustrato rollo flexible",
  sustrato_rigido: "Sustrato rígido",
  objeto_promocional_base: "Objeto promocional base",
  tinta_impresion: "Tinta impresión",
  toner: "Tóner",
  film_transferencia: "Film transferencia",
  papel_transferencia: "Papel transferencia",
  laminado_film: "Laminado film",
  quimico_acabado: "Químico acabado",
  auxiliar_proceso: "Auxiliar proceso",
  polvo_dtf: "Polvo DTF",
  filamento_3d: "Filamento 3D",
  resina_3d: "Resina 3D",
  modulo_led_carteleria: "Módulo LED cartelería",
  fuente_alimentacion_led: "Fuente alimentación LED",
  cableado_conectica: "Cableado y conectica",
  controlador_led: "Controlador LED",
  neon_flex_led: "Neón flex LED",
  accesorio_neon_led: "Accesorio neón LED",
  chapa_metalica: "Chapa metálica",
  perfil_estructural: "Perfil estructural",
  pintura_carteleria: "Pintura cartelería",
  primer_sellador: "Primer sellador",
  anillado_encuadernacion: "Anillado encuadernación",
  tapa_encuadernacion: "Tapa encuadernación",
  iman_ceramico_flexible: "Imán cerámico/flexible",
  fijacion_auxiliar: "Fijación auxiliar",
  accesorio_exhibidor_carton: "Accesorio exhibidor cartón",
  accesorio_montaje_pop: "Accesorio montaje POP",
  semielaborado_pop: "Semielaborado POP",
  argolla_llavero_accesorio: "Argolla llavero accesorio",
  ojal_ojalillo_remache: "Ojal/ojalillo/remache",
  portabanner_estructura: "Portabanner estructura",
  sistema_colgado_montaje: "Sistema colgado/montaje",
  perfil_bastidor_textil: "Perfil bastidor textil",
  cinta_doble_faz_tecnica: "Cinta doble faz técnica",
  adhesivo_liquido_estructural: "Adhesivo líquido estructural",
  velcro_cierre_tecnico: "Velcro/cierre técnico",
  embalaje_proteccion: "Embalaje/protección",
  etiquetado_identificacion: "Etiquetado/identificación",
  consumible_instalacion: "Consumible instalación",
};

type MateriasPrimasPanelProps = {
  initialMateriasPrimas: MateriaPrima[];
};

function buildCodigoBase(nombre: string) {
  const normalized = nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();

  const suffix = String(Date.now()).slice(-6);
  return `MP-${normalized || "ITEM"}-${suffix}`;
}

export function MateriasPrimasPanel({ initialMateriasPrimas }: MateriasPrimasPanelProps) {
  const router = useRouter();
  const [materiasPrimas, setMateriasPrimas] = React.useState(initialMateriasPrimas);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [nombreNuevo, setNombreNuevo] = React.useState("");
  const [templateNuevo, setTemplateNuevo] = React.useState(materiaPrimaTemplatesV1[0]?.id ?? "");
  const selectedTemplate = React.useMemo(
    () => materiaPrimaTemplatesV1.find((template) => template.id === templateNuevo) ?? null,
    [templateNuevo],
  );

  const handleCreate = async () => {
    const nombre = nombreNuevo.trim();
    if (!nombre) {
      toast.error("Ingresa un nombre para la materia prima.");
      return;
    }

    const template = getMateriaPrimaTemplate(templateNuevo);
    if (!template) {
      toast.error("Selecciona una plantilla válida.");
      return;
    }

    const payload: MateriaPrimaPayload = {
      codigo: buildCodigoBase(nombre),
      nombre,
      descripcion: "",
      familia: template.familia,
      subfamilia: template.subfamilia,
      tipoTecnico: template.tipoTecnico,
      templateId: template.id,
      unidadStock: template.unidadStock,
      unidadCompra: template.unidadCompra,
      esConsumible: false,
      esRepuesto: false,
      activo: true,
      atributosTecnicos: { ...template.atributosIniciales },
      variantes: [],
      compatibilidades: [],
    };

    setIsSaving(true);
    try {
      const created = await createMateriaPrima(payload);
      toast.success("Materia prima creada. Completá la ficha técnica.");
      setIsCreateOpen(false);
      setNombreNuevo("");
      router.push(`/inventario/materias-primas/${created.id}`);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const toggle = async (item: MateriaPrima) => {
    try {
      const updated = await toggleMateriaPrima(item.id);
      setMateriasPrimas((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      toast.success(updated.activo ? "Materia prima activada." : "Materia prima desactivada.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo cambiar estado.";
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Catálogo de materias primas</CardTitle>
            <div className="flex gap-2">
              <Button onClick={() => setIsCreateOpen(true)}>
                <CirclePlusIcon className="size-4" />
                Nueva materia prima
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Familia</TableHead>
                <TableHead>Subfamilia</TableHead>
                <TableHead>Variantes</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[220px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materiasPrimas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    Todavía no hay materias primas cargadas.
                  </TableCell>
                </TableRow>
              ) : (
                materiasPrimas.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.nombre}</TableCell>
                    <TableCell>
                      {familiaMateriaPrimaItems.find((familia) => familia.value === item.familia)?.label ??
                        item.familia}
                    </TableCell>
                    <TableCell>{subfamiliaMateriaPrimaLabels[item.subfamilia] ?? item.subfamilia}</TableCell>
                    <TableCell>{item.variantes.length}</TableCell>
                    <TableCell>
                      <Badge variant={item.activo ? "default" : "secondary"}>
                        {item.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="sidebar"
                          size="sm"
                          onClick={() => router.push(`/inventario/materias-primas/${item.id}`)}
                        >
                          <PencilIcon className="size-4" />
                          Abrir ficha
                        </Button>
                        <Button variant="sidebar" size="sm" onClick={() => toggle(item)}>
                          <ToggleLeftIcon className="size-4" />
                          {item.activo ? "Desactivar" : "Activar"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <SheetContent
          side="top"
          className="w-[min(780px,95vw)] rounded-xl border p-0 data-[side=top]:inset-x-auto data-[side=top]:left-1/2 data-[side=top]:top-1/2 data-[side=top]:h-auto data-[side=top]:-translate-x-1/2 data-[side=top]:-translate-y-1/2 data-[side=top]:border"
        >
          <SheetHeader className="border-b px-4 pb-3 md:px-6">
            <SheetTitle>Nueva materia prima</SheetTitle>
            <SheetDescription>
              Paso 1: elegí nombre y plantilla. Luego se abre la ficha dedicada con tabs.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 px-4 py-4 md:px-6">
            <Field>
              <FieldLabel>Nombre</FieldLabel>
              <Input
                placeholder="Ej: Vinilo adhesivo blanco"
                value={nombreNuevo}
                onChange={(event) => setNombreNuevo(event.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel>Plantilla de materia prima</FieldLabel>
              <Select
                value={templateNuevo}
                onValueChange={(value) => setTemplateNuevo(value ?? "")}
              >
                <SelectTrigger>
                  <SelectValue>
                    {selectedTemplate?.nombre ?? "Seleccionar plantilla"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {materiaPrimaTemplatesV1.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {templateNuevo ? (
              <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                {getMateriaPrimaTemplate(templateNuevo)?.descripcion}
              </div>
            ) : null}
          </div>

          <SheetFooter className="flex-row justify-end border-t px-4 py-3 md:px-6">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} loading={isSaving} loadingText="Creando...">
              Crear y abrir ficha
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
