"use client";

import {
  Accordion,
  Checkbox,
  Input,
  Label,
  ListBox,
  NumberField,
  Select,
  TextArea,
} from "@heroui/react";
import {
  Box,
  FileText,
  Layers,
  Minus,
  Plus,
  Trash2,
  Upload,
  WandSparkles,
} from "lucide-react";
import { useId, useState } from "react";
import { ActionButton as Button } from "../action-button";
import { useDesignScope } from "../appearance";
import theme from "../theme.module.css";
import focus from "../field-focus.module.css";
import styles from "./product-sheet-preview.module.css";
import {
  sampleMoney,
  type SampleProduct,
  type SheetDraft,
} from "./product-sheet-fixtures";

export type DraftChange = (update: (draft: SheetDraft) => SheetDraft) => void;
export type ProductFieldsProps = {
  product: SampleProduct;
  draft: SheetDraft;
  onChange: DraftChange;
};

export function SheetSelect({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const scope = useDesignScope();
  return (
    <Select
      value={value}
      onChange={(key) => key !== null && onChange(String(key))}
      isDisabled={disabled}
      fullWidth
      className={styles.select}
    >
      <Label className={styles.label}>{label}</Label>
      <Select.Trigger className={focus.singleBorder}>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover {...scope} className={theme.theme}>
        <ListBox>
          {options.map((option) => (
            <ListBox.Item key={option} id={option} textValue={option}>
              {option}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

export function SheetNumber({
  label,
  value,
  onChange,
  min = 1,
  unit,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  unit?: string;
}) {
  return (
    <NumberField
      value={value}
      onChange={(next) => onChange(Number.isFinite(next) ? next : min)}
      minValue={min}
      className="min-w-0"
    >
      <Label className={styles.label}>
        {label}
        {unit && (
          <span className="ml-1 font-normal text-muted-foreground">
            · {unit}
          </span>
        )}
      </Label>
      <NumberField.Group
        className={`${styles.numberGroup} ${focus.singleBorder}`}
      >
        <NumberField.DecrementButton aria-label="Disminuir">
          <Minus size={13} />
        </NumberField.DecrementButton>
        <NumberField.Input className={styles.numberInput} />
        <NumberField.IncrementButton aria-label="Aumentar">
          <Plus size={13} />
        </NumberField.IncrementButton>
      </NumberField.Group>
    </NumberField>
  );
}

function SheetText({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={focus.singleBorder}
      />
    </div>
  );
}

export function SheetCheck({
  label,
  selected,
  onChange,
}: {
  label: string;
  selected: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Checkbox
      isSelected={selected}
      onChange={onChange}
      className={styles.checkbox}
    >
      <Checkbox.Content className={styles.checkContent}>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        <Label>{label}</Label>
      </Checkbox.Content>
    </Checkbox>
  );
}

export function ConfigurationFields({
  product,
  draft,
  onChange,
}: ProductFieldsProps) {
  const setValue = (id: string, value: string | number) =>
    onChange((current) => ({
      ...current,
      values: { ...current.values, [id]: value },
    }));
  return (
    <div className={styles.sectionStack}>
      <section
        className={styles.section}
        aria-label="Configuración del producto"
      >
        <div className={styles.sectionHeading}>
          <span className={styles.step}>01</span>
          <div>
            <h3>Configuración</h3>
            <p>Definí lo que necesita este trabajo.</p>
          </div>
        </div>
        <div className={styles.fieldGrid}>
          <SheetNumber
            label={product.id === "diseno" ? "Tiempo estimado" : "Cantidad"}
            unit={product.unit}
            value={draft.quantity}
            onChange={(quantity) =>
              onChange((current) => ({ ...current, quantity }))
            }
          />
          {product.fields.map((field) =>
            field.type === "select" ? (
              <SheetSelect
                key={field.id}
                label={field.label}
                value={String(draft.values[field.id])}
                options={field.options!}
                onChange={(value) => setValue(field.id, value)}
              />
            ) : field.type === "number" ? (
              <SheetNumber
                key={field.id}
                label={field.label}
                unit={field.unit}
                value={Number(draft.values[field.id])}
                min={field.min}
                onChange={(value) => setValue(field.id, value)}
              />
            ) : (
              <SheetText
                key={field.id}
                label={field.label}
                value={String(draft.values[field.id])}
                onChange={(value) => setValue(field.id, value)}
              />
            ),
          )}
        </div>
      </section>
      <SpecialFields product={product} draft={draft} onChange={onChange} />
      <section
        className={styles.section}
        aria-label="Opcionales y terminaciones"
      >
        <div className={styles.sectionHeading}>
          <span className={styles.step}>02</span>
          <div>
            <h3>Opcionales y terminaciones</h3>
            <p>Elegí los adicionales del producto.</p>
          </div>
        </div>
        <div className={styles.checkGrid}>
          {product.extras.map((extra) => (
            <SheetCheck
              key={extra}
              label={extra}
              selected={draft.extras.includes(extra)}
              onChange={(checked) =>
                onChange((current) => ({
                  ...current,
                  extras: checked
                    ? [...current.extras, extra]
                    : current.extras.filter((item) => item !== extra),
                }))
              }
            />
          ))}
        </div>
        {draft.extras.includes("Instalación") && (
          <div className={`${styles.fieldGrid} mt-4`}>
            <SheetSelect
              label="Zona de instalación"
              value={String(draft.values.zona ?? "Zona urbana")}
              options={["Zona urbana", "Fuera de la ciudad"]}
              onChange={(value) => setValue("zona", value)}
            />
            <SheetNumber
              label="Superficie a instalar"
              unit="m²"
              value={Number(draft.values.instalacion ?? 3)}
              onChange={(value) => setValue("instalacion", value)}
            />
          </div>
        )}
        {draft.extras.includes("Anillado") && (
          <div className="mt-4">
            <SheetSelect
              label="Tipo de anillo"
              value={String(draft.values.anillo ?? "Plástico negro")}
              options={["Plástico negro", "Metálico"]}
              onChange={(value) => setValue("anillo", value)}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function SpecialFields({ product, draft, onChange }: ProductFieldsProps) {
  const [planOpen, setPlanOpen] = useState(false);
  const setValue = (id: string, value: string | number) =>
    onChange((current) => ({
      ...current,
      values: { ...current.values, [id]: value },
    }));
  if (!product.special) return null;
  return (
    <section
      className={styles.section}
      aria-label="Detalles específicos del producto"
    >
      {product.special === "piezas" && (
        <>
          <div className={styles.sectionTitle}>
            <h3>Piezas y medidas</h3>
            <Button
              variant="outline"
              onPress={() =>
                onChange((current) => ({
                  ...current,
                  pieces: [
                    ...current.pieces,
                    {
                      id: Date.now(),
                      name: `Pieza ${current.pieces.length + 1}`,
                      width: 100,
                      height: 100,
                      quantity: 1,
                    },
                  ],
                }))
              }
            >
              <Plus /> Agregar pieza
            </Button>
          </div>
          <div className="mt-4 space-y-3">
            {draft.pieces.map((piece, index) => (
              <div key={piece.id} className={styles.repeatRow}>
                <div className={styles.sectionTitle}>
                  <strong>{piece.name}</strong>
                  <Button
                    variant="ghost"
                    isIconOnly
                    aria-label={`Quitar pieza ${index + 1}`}
                    isDisabled={draft.pieces.length === 1}
                    onPress={() =>
                      onChange((current) => ({
                        ...current,
                        pieces: current.pieces.filter(
                          (item) => item.id !== piece.id,
                        ),
                      }))
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
                <div className={styles.pieceGrid}>
                  {(["width", "height", "quantity"] as const).map((key) => (
                    <SheetNumber
                      key={key}
                      label={`${key === "width" ? "Ancho" : key === "height" ? "Alto" : "Unidades"} pieza ${index + 1}`}
                      unit={key === "quantity" ? undefined : "cm"}
                      value={piece[key]}
                      onChange={(value) =>
                        onChange((current) => ({
                          ...current,
                          pieces: current.pieces.map((item) =>
                            item.id === piece.id
                              ? { ...item, [key]: value }
                              : item,
                          ),
                        }))
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className={styles.hint}>
            Superficie de piezas:{" "}
            {draft.pieces
              .reduce(
                (total, item) =>
                  total + (item.width * item.height * item.quantity) / 10000,
                0,
              )
              .toLocaleString("es-AR")}{" "}
            m². La cotización de esta muestra es ilustrativa.
          </p>
        </>
      )}
      {product.special === "vectorial" && (
        <>
          <div className={styles.sectionTitle}>
            <h3>Geometría y capas</h3>
            <span className={styles.softBadge}>SVG · DXF · PDF</span>
          </div>
          <div className={`${styles.repeatRow} mt-4`}>
            <div className="flex items-center gap-3">
              <Layers size={20} className="text-accent-soft-foreground" />
              <div>
                <strong>letras-estudio.svg</strong>
                <p className={styles.hint}>
                  12 piezas · Medidas leídas del archivo de muestra
                </p>
              </div>
            </div>
          </div>
          <div className={`${styles.fieldGrid} mt-4`}>
            <SheetSelect
              label="Capa contorno"
              value={String(draft.values.capa ?? "Cortar")}
              options={["Cortar", "Grabar", "Ignorar"]}
              onChange={(value) => setValue("capa", value)}
            />
            <SheetSelect
              label="Capa interior"
              value={String(draft.values.interior ?? "Grabar")}
              options={["Grabar", "Cortar", "Ignorar"]}
              onChange={(value) => setValue("interior", value)}
            />
          </div>
          <Button
            variant="outline"
            className="mt-4"
            aria-expanded={planOpen}
            onPress={() => setPlanOpen((value) => !value)}
          >
            <Layers />{" "}
            {planOpen ? "Ocultar plan de corte" : "Ver plan de corte"}
          </Button>
          {planOpen && (
            <div className={styles.plan}>
              <div className={styles.planPieces}>
                {Array.from({ length: 12 }, (_, index) => (
                  <span key={index}>{index + 1}</span>
                ))}
              </div>
              <p className={styles.hint}>
                Distribución de muestra · Placa de 60 × 40 cm · El plan real lo
                calcula el motor.
              </p>
            </div>
          )}
        </>
      )}
      {(product.special === "compuesto" ||
        product.special === "carteleria") && (
        <>
          <div className={styles.sectionTitle}>
            <h3>
              {product.special === "compuesto"
                ? "Componentes del producto"
                : "Volumen y montaje"}
            </h3>
            <Box size={18} />
          </div>
          {product.special === "carteleria" && (
            <div className={styles.letterPreview}>
              <span>{String(draft.values.texto)}</span>
              <small>
                Vista tipográfica de muestra · {draft.values.profundidad} cm de
                profundidad
              </small>
            </div>
          )}
          <div className="mt-4 space-y-2">
            {(product.special === "compuesto"
              ? ["Frente impreso", "Laterales × 2", "Base y encastres"]
              : [
                  "Frente de acrílico",
                  "Cuerpo y laterales",
                  "Iluminación y cableado",
                ]
            ).map((part, index) => (
              <div className={styles.componentRow} key={part}>
                <Box size={16} />
                <div className="flex-1">
                  <strong>{part}</strong>
                  <p className={styles.hint}>
                    {index === 0
                      ? "Archivo heredado del producto"
                      : "Medida vinculada al conjunto"}
                  </p>
                </div>
                <span className={styles.softBadge}>Incluido</span>
              </div>
            ))}
          </div>
          <p className={styles.hint}>
            Las medidas del conjunto actualizan sus componentes. La muestra
            conserva sus nombres y estados.
          </p>
        </>
      )}
      {product.special === "tercerizado" && (
        <>
          <h3>Costo del proveedor</h3>
          <div className={`${styles.fieldGrid} mt-4`}>
            <SheetSelect
              label="Origen del costo"
              value={String(draft.values.origen ?? "Matriz del proveedor")}
              options={["Matriz del proveedor", "Costo manual"]}
              onChange={(value) => setValue("origen", value)}
            />
            <SheetNumber
              label="Costo de referencia"
              unit="$"
              value={Number(draft.values.costo ?? 58000)}
              onChange={(value) => setValue("costo", value)}
            />
          </div>
          <div className={styles.notice}>
            Tirada mínima de muestra: 1.000 unidades. El costo manual requiere
            revisión antes de confirmar.
          </div>
        </>
      )}
      {product.special === "personalizacion" && (
        <>
          <h3>Área de personalización</h3>
          <div className={`${styles.fieldGrid} mt-4`}>
            <SheetNumber
              label="Ancho de impresión"
              unit="cm"
              value={Number(draft.values.anchoArea ?? 20)}
              onChange={(value) => setValue("anchoArea", value)}
            />
            <SheetNumber
              label="Alto de impresión"
              unit="cm"
              value={Number(draft.values.altoArea ?? 9)}
              onChange={(value) => setValue("altoArea", value)}
            />
          </div>
          <div className={styles.artArea}>
            Diseño del cliente · {draft.values.anchoArea ?? 20} ×{" "}
            {draft.values.altoArea ?? 9} cm
          </div>
        </>
      )}
      {product.special === "sello" && (
        <>
          <div className={styles.sectionTitle}>
            <h3>Vista previa del sello</h3>
            <span className={styles.softBadge}>Texto editable</span>
          </div>
          <div
            className={styles.stampPreview}
            style={{
              fontFamily:
                draft.values.tipografia === "Serif"
                  ? "serif"
                  : draft.values.tipografia === "Monoespaciada"
                    ? "monospace"
                    : "inherit",
            }}
          >
            <strong>{String(draft.values.texto)}</strong>
            <span>Diseño de muestra · {String(draft.values.tinta)}</span>
          </div>
        </>
      )}
      {product.special === "brief" && (
        <>
          <div className={styles.sectionTitle}>
            <h3>Brief creativo</h3>
            <WandSparkles size={18} />
          </div>
          <div className="mt-4">
            <SheetText
              label="Público y tono"
              value={String(
                draft.values.publico ??
                  "Profesionales · Cercano y contemporáneo",
              )}
              onChange={(value) => setValue("publico", value)}
            />
          </div>
          <p className={styles.hint}>
            Las referencias y los materiales de marca se reúnen en Archivos. El
            objetivo y los entregables quedan junto a la configuración.
          </p>
        </>
      )}
      {product.special === "documentos" && (
        <>
          <div className={styles.sectionTitle}>
            <h3>Documentos de la carga</h3>
            <Button
              variant="outline"
              onPress={() =>
                onChange((current) => ({
                  ...current,
                  documents: [
                    ...current.documents,
                    {
                      id: Date.now(),
                      name: `Documento ${current.documents.length + 1}.pdf`,
                      pages: 12,
                      copies: 1,
                    },
                  ],
                }))
              }
            >
              <Plus /> Documento
            </Button>
          </div>
          <div className="mt-4 space-y-3">
            {draft.documents.map((document, index) => (
              <div key={document.id} className={styles.repeatRow}>
                <div className={styles.sectionTitle}>
                  <strong className="flex items-center gap-2">
                    <FileText size={16} />
                    {document.name}
                  </strong>
                  <Button
                    variant="ghost"
                    isIconOnly
                    aria-label={`Quitar documento ${index + 1}`}
                    onPress={() =>
                      onChange((current) => ({
                        ...current,
                        documents: current.documents.filter(
                          (item) => item.id !== document.id,
                        ),
                      }))
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
                <div className={styles.fieldGrid}>
                  <SheetNumber
                    label={`Páginas documento ${index + 1}`}
                    value={document.pages}
                    onChange={(pages) =>
                      onChange((current) => ({
                        ...current,
                        documents: current.documents.map((item) =>
                          item.id === document.id ? { ...item, pages } : item,
                        ),
                      }))
                    }
                  />
                  <SheetNumber
                    label={`Copias documento ${index + 1}`}
                    value={document.copies}
                    onChange={(copies) =>
                      onChange((current) => ({
                        ...current,
                        documents: current.documents.map((item) =>
                          item.id === document.id ? { ...item, copies } : item,
                        ),
                      }))
                    }
                  />
                </div>
              </div>
            ))}
          </div>
          {draft.documents.length === 0 && (
            <p className={styles.notice}>
              Todavía no hay documentos. Agregá uno para configurar la carga.
            </p>
          )}
          <div className="mt-4">
            <SheetCheck
              label="Agrupar documentos en un tomo"
              selected={draft.grouped}
              onChange={(grouped) =>
                onChange((current) => ({ ...current, grouped }))
              }
            />
          </div>
          {draft.grouped && (
            <div className="mt-3">
              <SheetText
                label="Nombre del tomo"
                value={String(draft.values.tomo ?? "Manual completo")}
                onChange={(value) => setValue("tomo", value)}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function ProductionFields({
  product,
  draft,
  onChange,
}: ProductFieldsProps) {
  const id = useId();
  const setValue = (key: string, value: string | number) =>
    onChange((current) => ({
      ...current,
      values: { ...current.values, [key]: value },
    }));
  return (
    <section className={styles.section} aria-label="Producción y notas">
      <div className={styles.sectionHeading}>
        <span className={styles.step}>03</span>
        <div>
          <h3>Producción</h3>
          <p>Entrega, instrucciones y opciones avanzadas.</p>
        </div>
      </div>
      <div className={styles.fieldGrid}>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-fecha`} className={styles.label}>
            Fecha de entrega del producto
          </label>
          <Input
            id={`${id}-fecha`}
            type="date"
            value={String(draft.values.fecha ?? "2026-09-24")}
            onChange={(event) => setValue("fecha", event.target.value)}
            className={focus.singleBorder}
          />
        </div>
        <SheetSelect
          label="Prioridad"
          value={String(draft.values.prioridad ?? "Normal")}
          options={["Normal", "Urgente"]}
          onChange={(value) => setValue("prioridad", value)}
        />
      </div>
      <div className="mt-4 flex flex-col gap-1">
        <label htmlFor={`${id}-notas`} className={styles.label}>
          Notas para producción
        </label>
        <TextArea
          id={`${id}-notas`}
          rows={3}
          value={draft.notes}
          onChange={(event) =>
            onChange((current) => ({ ...current, notes: event.target.value }))
          }
          placeholder="Terminación, empaque o instrucciones para el taller…"
          className={focus.singleBorder}
        />
      </div>
      <Accordion className="mt-4" variant="surface">
        <Accordion.Item id="avanzado">
          <Accordion.Heading>
            <Accordion.Trigger className="text-sm">
              Configuración avanzada
              <Accordion.Indicator />
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body>
              <div className={styles.fieldGrid}>
                <SheetSelect
                  label="Ruta de producción"
                  value={String(draft.values.ruta ?? "Ruta recomendada")}
                  options={["Ruta recomendada", "Ruta alternativa"]}
                  onChange={(value) => setValue("ruta", value)}
                />
                <SheetSelect
                  label="Equipo / proveedor"
                  value={String(draft.values.equipo ?? "Asignación sugerida")}
                  options={["Asignación sugerida", "Alternativa disponible"]}
                  onChange={(value) => setValue("equipo", value)}
                />
                <SheetSelect
                  label="Perfil de producción"
                  value={String(draft.values.perfil ?? "Estándar")}
                  options={["Estándar", "Alta calidad"]}
                  onChange={(value) => setValue("perfil", value)}
                />
                <SheetNumber
                  label="Tiempo manual"
                  unit="min"
                  min={0}
                  value={Number(draft.values.tiempo ?? 15)}
                  onChange={(value) => setValue("tiempo", value)}
                />
              </div>
              <p className={styles.hint}>
                Estos controles se muestran sólo cuando el producto y los
                permisos lo habilitan en la ficha real.
              </p>
            </Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item id="costos">
          <Accordion.Heading>
            <Accordion.Trigger className="text-sm">
              Costos y margen de muestra
              <Accordion.Indicator />
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body>
              <dl className={styles.priceRows}>
                <div>
                  <dt>Costo unitario de referencia</dt>
                  <dd>{sampleMoney(product.price * 0.65)}</dd>
                </div>
                <div>
                  <dt>Margen ilustrativo</dt>
                  <dd>35 %</dd>
                </div>
              </dl>
              <p className={styles.hint}>
                La versión operativa conserva el permiso para ver márgenes.
              </p>
            </Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </section>
  );
}

export function FileFields({ draft, onChange }: ProductFieldsProps) {
  return (
    <section className={styles.section} aria-label="Archivos y referencias">
      <div className={styles.sectionHeading}>
        <span className={styles.step}>04</span>
        <div>
          <h3>Archivos y referencias</h3>
          <p>Arte final, vectores, documentos y materiales de diseño.</p>
        </div>
      </div>
      <div className={styles.upload}>
        <Upload size={24} />
        <strong>Los archivos del trabajo, en un lugar</strong>
        <p>PDF, SVG, DXF e imágenes · Muestra sin carga de archivos reales</p>
        <Button
          variant="outline"
          onPress={() =>
            onChange((current) => ({
              ...current,
              files: [
                ...current.files,
                `referencia-${current.files.length + 1}.pdf`,
              ],
            }))
          }
        >
          <Plus /> Añadir archivo de muestra
        </Button>
      </div>
      {draft.files.length ? (
        <div className="mt-4 space-y-2">
          {draft.files.map((file, index) => (
            <div className={styles.componentRow} key={`${file}-${index}`}>
              <FileText size={18} />
              <span className="min-w-0 flex-1 truncate">{file}</span>
              <span className={styles.softBadge}>
                {index === 0 ? "Arte final" : "Referencia"}
              </span>
              <Button
                variant="ghost"
                isIconOnly
                aria-label={`Quitar archivo ${index + 1}`}
                onPress={() =>
                  onChange((current) => ({
                    ...current,
                    files: current.files.filter((_, i) => i !== index),
                  }))
                }
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.hint}>
          Sin archivos adjuntos. Podés agregarlos más adelante.
        </p>
      )}
    </section>
  );
}
