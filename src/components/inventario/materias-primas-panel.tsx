"use client";

import * as React from "react";
import { useDesignScope, useDesignTheme } from "@/components/design-system/appearance";
import { useRouter } from "next/navigation";
import {
  CirclePlusIcon,
  DollarSignIcon,
  LibraryIcon,
  ArrowUpRightIcon,
  LayersIcon,
  PackageIcon,
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
  getMateriaPrimaTemplateAvailability,
  getMateriaPrimaTemplate,
  materiaPrimaTemplatesV1,
} from "@/lib/materia-prima-templates";
import {
  Card,
  Chip,
  Input,
  SearchField,
  Label,
  Modal,
  Switch,
  TextField,
} from "@heroui/react";
import { ActionButton } from "@/components/design-system/action-button";
import { ActionLink } from "@/components/design-system/action-link";
import { FormDialog } from "@/components/design-system/form-dialog";
import { ListMetric } from "@/components/design-system/list-metric";
import { SelectField } from "@/components/design-system/select-field";
import focus from "@/components/design-system/field-focus.module.css";
import listPage from "@/components/design-system/list-page.module.css";
import styles from "./materiales.module.css";
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
  vinilo_corte: "Vinilo de corte",
  sustrato_rigido: "Sustrato rígido",
  objeto_promocional_base: "Objeto promocional base",
  tinta_impresion: "Tinta impresión",
  toner: "Tóner",
  film_transferencia: "Film transferencia",
  papel_transferencia: "Papel transferencia",
  laminado_film: "Laminado film",
  laminado_pouch: "Laminado pouch",
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
  componente_editorial: "Componente editorial / carpeta",
  pegatina_raspadita: "Pegatina raspadita",
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
  textil_indumentaria: "Textil / indumentaria (blank)",
  cinta_doble_faz_tecnica: "Cinta doble faz técnica",
  adhesivo_liquido_estructural: "Adhesivo líquido estructural",
  velcro_cierre_tecnico: "Velcro/cierre técnico",
  embalaje_proteccion: "Embalaje/protección",
  etiquetado_identificacion: "Etiquetado/identificación",
  consumible_instalacion: "Consumible instalación",
  sellos_automaticos: "Sellos automáticos",
  sellos_manuales: "Sellos manuales",
  goma_laserable: "Goma laserable",
  almohadilla_tinta: "Almohadillas y tintas",
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

function normalizarBusqueda(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function MateriasPrimasPanel({
  initialMateriasPrimas,
}: MateriasPrimasPanelProps) {
  const scope = useDesignScope();
  const themeClass = useDesignTheme();
  const router = useRouter();
  const [materiasPrimas, setMateriasPrimas] = React.useState(
    initialMateriasPrimas,
  );
  const [mostrarOcultas, setMostrarOcultas] = React.useState(false);
  const [busqueda, setBusqueda] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [nombreNuevo, setNombreNuevo] = React.useState("");
  const [templateNuevo, setTemplateNuevo] = React.useState(
    materiaPrimaTemplatesV1[0]?.id ?? "",
  );
  const selectedTemplate = React.useMemo(
    () =>
      materiaPrimaTemplatesV1.find(
        (template) => template.id === templateNuevo,
      ) ?? null,
    [templateNuevo],
  );
  const materiasPrimasVisibles = React.useMemo(() => {
    const base = mostrarOcultas
      ? materiasPrimas
      : materiasPrimas.filter((materiaPrima) => materiaPrima.activo);
    const query = normalizarBusqueda(busqueda.trim());
    if (!query) return base;
    return base.filter((materiaPrima) => {
      const haystack = [
        materiaPrima.nombre,
        materiaPrima.canonicalMaterialName ?? "",
        materiaPrima.codigo,
        ...materiaPrima.variantes.map((variante) => variante.sku),
        ...materiaPrima.variantes.map(
          (variante) => variante.nombreVariante ?? "",
        ),
      ];
      return haystack.some((value) =>
        normalizarBusqueda(value).includes(query),
      );
    });
  }, [materiasPrimas, mostrarOcultas, busqueda]);

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
      esConsumible: getMateriaPrimaTemplateAvailability(template.id)
        .esConsumible,
      esRepuesto: getMateriaPrimaTemplateAvailability(template.id).esRepuesto,
      esProductoBase: getMateriaPrimaTemplateAvailability(template.id)
        .esProductoBase,
      activo: true,
      atributosTecnicos: { ...template.atributosIniciales },
      variantes: [],
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
      const message =
        error instanceof Error ? error.message : "No se pudo crear.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const toggle = async (item: MateriaPrima) => {
    try {
      const updated = await toggleMateriaPrima(item.id);
      setMateriasPrimas((prev) =>
        prev.map((row) => (row.id === updated.id ? updated : row)),
      );
      toast.success(
        updated.activo
          ? "Materia prima activada."
          : "Materia prima desactivada.",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo cambiar estado.";
      toast.error(message);
    }
  };

  return (
    <section
      {...scope} data-visual="brand"
      className={`${themeClass} ${listPage.page} ${styles.page}`}
    >
      <header className={listPage.header}>
        <div>
          <p className={styles.eyebrow}>Inventario · Catálogo</p>
          <h1>Materiales<span className={styles.titleDot}>.</span></h1>
          <p className={listPage.subtitle}>
            Catálogo de materias primas, variantes y precios de referencia.
          </p>
        </div>
        <div className={styles.headerActions}>
          <ActionLink
            variant="outline"
            href="/inventario/materias-primas/biblioteca"
          >
            <LibraryIcon size={16} /> Instalar desde biblioteca
          </ActionLink>
          <ActionLink
            variant="outline"
            href="/inventario/materias-primas/costos"
          >
            <DollarSignIcon size={16} /> Editar costos
          </ActionLink>
          <ActionButton onPress={() => setIsCreateOpen(true)}>
            <CirclePlusIcon size={16} /> Nueva materia prima
          </ActionButton>
        </div>
      </header>
      <div className={styles.metrics}>
        <ListMetric
          label="Materiales activos"
          value={materiasPrimas.filter((item) => item.activo).length}
          hint="Disponibles en tu catálogo"
          icon={PackageIcon}
        />
        <ListMetric
          label="Variantes"
          value={materiasPrimas.reduce((total, item) => total + item.variantes.length, 0)}
          hint="Presentaciones registradas"
          icon={LayersIcon}
        />
        <ListMetric
          label="Familias"
          value={new Set(materiasPrimas.map((item) => item.familia)).size}
          hint="Tipos de materiales en tu empresa"
          icon={LibraryIcon}
        />
      </div>
      <Card className={listPage.results}>
        <div className={listPage.toolbar}>
          <SearchField
            aria-label="Buscar materiales"
            className={styles.search}
            value={busqueda}
            onChange={setBusqueda}
          >
            <SearchField.Group
              className={`${listPage.searchGroup} ${focus.singleBorder}`}
            >
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Buscar por nombre, código o SKU…" />
            </SearchField.Group>
          </SearchField>
          <div className={styles.toolbarEnd}>
            <span className={styles.resultCount}>
              {materiasPrimasVisibles.length} de {materiasPrimas.length}{" "}
              materiales
            </span>
            <Switch
              size="sm"
              isSelected={mostrarOcultas}
              onChange={setMostrarOcultas}
            >
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                <Label>Mostrar ocultas</Label>
              </Switch.Content>
            </Switch>
          </div>
        </div>
        {materiasPrimasVisibles.length === 0 ? (
          <div className={listPage.empty}>
            <LibraryIcon size={28} aria-hidden />
            <p>
              {materiasPrimas.length === 0
                ? "Todavía no hay materias primas cargadas."
                : busqueda.trim()
                  ? `Sin resultados para "${busqueda.trim()}".`
                  : "No hay materias primas activas para mostrar."}
            </p>
          </div>
        ) : (
          <Table className={`${styles.table} ${styles.catalogTable}`}>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Familia</TableHead>
                <TableHead>Subfamilia</TableHead>
                <TableHead className="text-right">Variantes</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materiasPrimasVisibles.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className={styles.materialName}>
                      <span className={styles.materialIcon}>
                        <LayersIcon size={18} aria-hidden />
                      </span>
                      <div>
                        <strong>{item.nombre}</strong>
                        <span>
                          Canónico:{" "}
                          {item.canonicalMaterialName ??
                            "Material propio"}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {familiaMateriaPrimaItems.find(
                      (familia) => familia.value === item.familia,
                    )?.label ?? item.familia}
                  </TableCell>
                  <TableCell>
                    {subfamiliaMateriaPrimaLabels[item.subfamilia] ??
                      item.subfamilia}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.variantes.length}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="sm"
                      variant="soft"
                      color={item.activo ? "success" : "default"}
                    >
                      <span className={styles.statusDot} />
                      {item.activo ? "Activo" : "Inactivo"}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <div className={styles.rowActions}>
                      <ActionLink
                        variant="outline"
                        href={`/inventario/materias-primas/${item.id}`}
                      >
                        Abrir ficha <ArrowUpRightIcon data-icon="inline-end" />
                      </ActionLink>
                      <ActionButton
                        variant="outline"
                        onPress={() => toggle(item)}
                      >
                        <ToggleLeftIcon size={15} />
                        {item.activo ? "Desactivar" : "Activar"}
                      </ActionButton>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <FormDialog
        className={styles.createDialog}
        isOpen={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        isDismissable={!isSaving}
        title={<>Nueva materia prima<span className={styles.titleDot}>.</span></>}
        description="Elegí un nombre y una plantilla. Después podés completar los datos y las variantes en su ficha."
      >
        <Modal.Body className={styles.dialogBody}>
          <div className={styles.formSection}>
            <div className={styles.sectionHeading}>
              <span className={styles.sectionIndex}>01</span>
              <div>
                <h2>Identidad del material</h2>
                <p>El nombre que vas a usar en tu catálogo.</p>
              </div>
            </div>
            <TextField
              className={styles.field}
              value={nombreNuevo}
              onChange={setNombreNuevo}
              autoFocus
            >
              <Label>Nombre</Label>
              <Input placeholder="Ej: Vinilo adhesivo blanco" />
            </TextField>
          </div>
          <div className={styles.formSection}>
            <div className={styles.sectionHeading}>
              <span className={styles.sectionIndex}>02</span>
              <div>
                <h2>Base técnica</h2>
                <p>La plantilla define los campos y las unidades iniciales.</p>
              </div>
            </div>
            <div className={styles.field}>
              <label htmlFor="material-template">
                Plantilla de materia prima
              </label>
              <SelectField
                id="material-template"
                aria-label="Plantilla de materia prima"
                value={templateNuevo}
                onChange={(value) => setTemplateNuevo(value ?? "")}
                options={materiaPrimaTemplatesV1.map((template) => ({
                  value: template.id,
                  label: `${template.nombre} · ${familiaMateriaPrimaItems.find((familia) => familia.value === template.familia)?.label ?? template.familia}`,
                }))}
              />
            </div>
            {templateNuevo ? (
              <div className={styles.templateInfo}>
                <LibraryIcon size={18} aria-hidden />
                <div>
                  <strong>
                    Familia:{" "}
                    {selectedTemplate
                      ? (familiaMateriaPrimaItems.find(
                          (familia) => familia.value === selectedTemplate.familia,
                        )?.label ?? selectedTemplate.familia)
                      : "—"}
                    {selectedTemplate
                      ? ` · Subfamilia: ${subfamiliaMateriaPrimaLabels[selectedTemplate.subfamilia] ?? selectedTemplate.subfamilia}`
                      : ""}
                  </strong>
                  <p>{getMateriaPrimaTemplate(templateNuevo)?.descripcion}</p>
                </div>
              </div>
            ) : null}
          </div>
        </Modal.Body>
        <Modal.Footer className={styles.dialogFooter}>
          <ActionButton
            variant="outline"
            onPress={() => setIsCreateOpen(false)}
            isDisabled={isSaving}
          >
            Cancelar
          </ActionButton>
          <ActionButton
            onPress={handleCreate}
            isDisabled={isSaving}
            isPending={isSaving}
          >
            {isSaving ? "Creando…" : "Crear y abrir ficha"}
            <ArrowUpRightIcon data-icon="inline-end" />
          </ActionButton>
        </Modal.Footer>
      </FormDialog>
    </section>
  );
}
