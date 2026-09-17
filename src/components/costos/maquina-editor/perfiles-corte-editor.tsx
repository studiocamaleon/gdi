"use client";
import { useMaquinariaPuedeEditar } from "./maquinaria-edicion";
import styles from "../maquinaria.module.css";
import focus from "@/components/design-system/field-focus.module.css";
import { useState } from "react";
import { CopyIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Chip } from "@heroui/react";
import { ActionButton as Button } from "@/components/design-system/action-button";
import { Modal } from "@heroui/react";
import { MaquinariaDialog } from "./maquinaria-dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@heroui/react";
import { Switch } from "@heroui/react";
import type { MaquinaPayload } from "@/lib/maquinaria";
import type { MateriaPrima } from "@/lib/materias-primas";
import {
  erroresPerfilCorte,
  NOMBRES_OPERACION_CORTE,
  OPERACIONES_CORTE,
  type ConfiguracionProcesamientoCorte,
  type OperacionCorte,
} from "@/lib/procesamiento-corte";
import type { LocalPerfil } from "./helpers";
import { MaterialesPerfilPicker } from "./perfiles-editor";
import {
  NumeroCorte,
  OpcionCorteHero as OpcionCorte,
} from "./herramientas-corte-editor";
import s from "./procesamiento-corte.module.css";

export function PerfilesCorteEditor({
  perfiles,
  setPerfiles,
  form,
  materiasPrimas,
  loadingMaterias,
  onEliminar,
}: {
  perfiles: LocalPerfil[];
  setPerfiles: React.Dispatch<React.SetStateAction<LocalPerfil[]>>;
  form: MaquinaPayload;
  materiasPrimas: MateriaPrima[];
  loadingMaterias: boolean;
  onEliminar: (key: string) => void;
}) {
  const puedeEditar = useMaquinariaPuedeEditar();
  const [draft, setDraft] = useState<LocalPerfil | null>(null);
  const [errores, setErrores] = useState<string[]>([]);
  const config = form.parametrosTecnicos!
    .procesamientoCorte as ConfiguracionProcesamientoCorte;
  const abrir = (p?: LocalPerfil, duplicar = false) => {
    const esNuevo =
      !p || duplicar || p.detalle?.procesamientoCorteVersion !== 1;
    const id = esNuevo ? crypto.randomUUID() : p.id!;
    const heredado = p?.detalle?.procesamientoCorteVersion === 1;
    setDraft({
      ...(heredado ? structuredClone(p) : {}),
      id,
      uiKey: esNuevo ? id : p!.uiKey,
      nombre: p ? `${p.nombre}${esNuevo ? " copia" : ""}` : "Nuevo perfil",
      tipoPerfil: form.plantilla === "router_cnc" ? "mecanizado" : "corte",
      activo: p?.activo ?? true,
      productivityValue: heredado ? p?.productivityValue : undefined,
      productivityUnit: heredado ? p?.productivityUnit : "mm_min",
      detalle: heredado
        ? structuredClone(p.detalle)
        : {
            procesamientoCorteVersion: 1,
            herramientaId: "",
            operacionCorte: "CORTE_COMPLETO",
            material: [],
            espesorMinMm: null,
            espesorMaxMm: null,
            modoVelocidad: "POR_PASADA",
            pasadas: 1,
            anchoCorteMm: 0,
          },
    });
    setErrores([]);
  };
  const setDetalle = (key: string, value: unknown) =>
    setDraft((p) => p && { ...p, detalle: { ...p.detalle, [key]: value } });
  const detalle = draft?.detalle ?? {};
  const herramienta = config.herramientas.find(
    (h) => h.id === detalle.herramientaId,
  );
  const guardar = () => {
    if (!draft) return;
    const problemas = [
      ...(!draft.nombre.trim() ? ["Completá el nombre."] : []),
      ...erroresPerfilCorte(draft, config),
    ];
    if (problemas.length) {
      setErrores(problemas);
      return;
    }
    setPerfiles((actuales) =>
      actuales.some((p) => p.uiKey === draft.uiKey)
        ? actuales.map((p) => (p.uiKey === draft.uiKey ? draft : p))
        : [...actuales, draft],
    );
    setDraft(null);
  };
  return (
    <div className={s.body}>
      <div className={s.actions}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => abrir()}
        >
          <PlusIcon data-icon="inline-start" />
          Agregar perfil por herramienta
        </Button>
      </div>
      <p className={s.help}>
        Cada perfil define cómo una herramienta procesa un material y espesor.
        La preparación de máquina se configura una sola vez, arriba.
      </p>
      {perfiles.map((p) => {
        const d = p.detalle ?? {},
          h = config.herramientas.find((h) => h.id === d.herramientaId),
          moderno = d.procesamientoCorteVersion === 1;
        return (
          <div className={s.row} key={p.uiKey}>
            <div>
              <strong>{p.nombre}</strong>
              <p>
                {moderno
                  ? `${NOMBRES_OPERACION_CORTE[d.operacionCorte as OperacionCorte] ?? "Operación pendiente"} · ${h?.nombre ?? "Herramienta pendiente"} · ${d.espesorMinMm ?? "—"}–${d.espesorMaxMm ?? "—"} mm`
                  : "Perfil por productividad"}
              </p>
            </div>
            <div className={s.actions}>
              <Chip size="sm">{p.activo ? "Activo" : "Inactivo"}</Chip>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => abrir(p)}
              >
                <PencilIcon data-icon="inline-start" />
                {moderno ? "Editar" : "Crear por herramienta"}
              </Button>
              {moderno && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  isIconOnly
                  aria-label={`Duplicar ${p.nombre}`}
                  onClick={() => abrir(p, true)}
                >
                  <CopyIcon />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                isIconOnly
                aria-label={`Eliminar ${p.nombre}`}
                onClick={() => onEliminar(p.uiKey)}
              >
                <Trash2Icon />
              </Button>
            </div>
          </div>
        );
      })}
      <MaquinariaDialog
        isOpen={Boolean(draft)}
        onOpenChange={(open) => !open && setDraft(null)}
        wide
        title={draft?.nombre || "Perfil de herramienta"}
        description="Operación, material y condiciones usadas para cotizar este recorrido."
      >
        {draft && (
          <Modal.Body className={`${styles.modalBody} ${s.dialogBody}`}>
            {errores.length > 0 && (
              <Alert variant="destructive">
                <AlertDescription>
                  <ul>
                    {errores.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            <FieldGroup className={s.grid}>
              <Field>
                <FieldLabel htmlFor="perfil-corte-nombre">
                  Nombre del perfil
                </FieldLabel>
                <Input
                  className={focus.singleBorder}
                  id="perfil-corte-nombre"
                  value={draft.nombre}
                  onChange={(e) =>
                    setDraft({ ...draft, nombre: e.target.value })
                  }
                />
              </Field>
              <Field orientation="horizontal">
                <Switch
                  isDisabled={!puedeEditar}
                  aria-label="Perfil activo"
                  id="perfil-corte-activo"
                  isSelected={draft.activo}
                  onChange={(activo) => setDraft({ ...draft, activo })}
                >
                  <Switch.Content>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch.Content>
                </Switch>
                <FieldLabel htmlFor="perfil-corte-activo">
                  Perfil activo
                </FieldLabel>
              </Field>
              <OpcionCorte
                label="Herramienta"
                value={String(detalle.herramientaId || "")}
                opciones={config.herramientas
                  .filter((h) => h.activo)
                  .map((h) => ({ value: h.id, label: h.nombre }))}
                onChange={(id) =>
                  setDraft({
                    ...draft,
                    detalle: {
                      ...detalle,
                      herramientaId: id,
                      operacionCorte: config.herramientas.find(
                        (h) => h.id === id,
                      )?.operaciones[0],
                    },
                  })
                }
              />
              <OpcionCorte
                label="Operación"
                value={String(detalle.operacionCorte)}
                opciones={(herramienta?.operaciones ?? OPERACIONES_CORTE).map(
                  (value) => ({
                    value,
                    label: NOMBRES_OPERACION_CORTE[value],
                  }),
                )}
                onChange={(v) => setDetalle("operacionCorte", v)}
              />
            </FieldGroup>
            <Field>
              <FieldLabel>Materiales compatibles</FieldLabel>
              <MaterialesPerfilPicker
                value={detalle.material}
                onChange={(v) => setDetalle("material", v)}
                materiasPrimas={materiasPrimas}
                loading={loadingMaterias}
                soloRigidos={false}
              />
            </Field>
            <FieldGroup className={s.grid}>
              <NumeroCorte
                label="Espesor mínimo (mm)"
                value={detalle.espesorMinMm as number | undefined}
                onChange={(v) => setDetalle("espesorMinMm", v)}
              />
              <NumeroCorte
                label="Espesor máximo (mm)"
                value={detalle.espesorMaxMm as number | undefined}
                onChange={(v) => setDetalle("espesorMaxMm", v)}
              />
              <NumeroCorte
                label="Velocidad de trabajo"
                value={draft.productivityValue}
                onChange={(productivityValue) =>
                  setDraft({ ...draft, productivityValue })
                }
              />
              <OpcionCorte
                label="Unidad de velocidad"
                value={draft.productivityUnit ?? "mm_min"}
                opciones={[
                  { value: "mm_min", label: "mm/min" },
                  { value: "mm_s", label: "mm/s" },
                  { value: "m_min", label: "m/min" },
                ]}
                onChange={(v) =>
                  setDraft({
                    ...draft,
                    productivityUnit: v as LocalPerfil["productivityUnit"],
                  })
                }
              />
              <OpcionCorte
                label="La velocidad representa"
                value={String(detalle.modoVelocidad)}
                opciones={[
                  { value: "POR_PASADA", label: "Una pasada" },
                  {
                    value: "PROCESO_COMPLETO",
                    label: "El proceso completo, con maniobras",
                  },
                ]}
                onChange={(v) =>
                  setDraft({
                    ...draft,
                    detalle: {
                      ...detalle,
                      modoVelocidad: v,
                      ...(v === "PROCESO_COMPLETO" ? { entradaSeg: 0 } : {}),
                    },
                  })
                }
              />
              <NumeroCorte
                label="Pasadas"
                value={detalle.pasadas as number}
                min={1}
                onChange={(v) => setDetalle("pasadas", v)}
              />
              <NumeroCorte
                label="Ancho efectivo de corte (mm)"
                value={detalle.anchoCorteMm as number}
                onChange={(v) => setDetalle("anchoCorteMm", v)}
              />
              <NumeroCorte
                label="Ajuste del proceso por placa (min)"
                value={detalle.ajusteMin as number | undefined}
                onChange={(v) => setDetalle("ajusteMin", v)}
              />
              {detalle.modoVelocidad === "POR_PASADA" && (
                <NumeroCorte
                  label="Por entrada de recorrido (s)"
                  value={detalle.entradaSeg as number | undefined}
                  onChange={(v) => setDetalle("entradaSeg", v)}
                />
              )}
            </FieldGroup>
            <p className={s.help}>
              Con velocidad por pasada, el tiempo se multiplica por las pasadas.
              Con velocidad del proceso completo, ya están incluidas en el
              tiempo; las pasadas siguen determinando el desgaste por metros.
            </p>
            <details className={s.advanced}>
              <summary>Parámetros de la herramienta</summary>
              <FieldGroup className={s.grid}>
                {herramienta?.tipo !== "RUEDA" && (
                  <>
                    <NumeroCorte
                      label="Profundidad total (mm)"
                      value={detalle.profundidadMm as number | undefined}
                      onChange={(v) => setDetalle("profundidadMm", v)}
                    />
                    <NumeroCorte
                      label="Profundidad por pasada (mm)"
                      value={detalle.profundidadPasadaMm as number | undefined}
                      onChange={(v) => setDetalle("profundidadPasadaMm", v)}
                    />
                  </>
                )}
                {herramienta?.tipo === "FRESA" ? (
                  <NumeroCorte
                    label="Velocidad de giro (RPM)"
                    value={detalle.rpm as number | undefined}
                    onChange={(v) => setDetalle("rpm", v)}
                  />
                ) : (
                  herramienta?.tipo !== "LASER" && (
                    <NumeroCorte
                      label="Presión (N)"
                      value={detalle.presionN as number | undefined}
                      onChange={(v) => setDetalle("presionN", v)}
                    />
                  )
                )}
              </FieldGroup>
              <p className={s.help}>
                Estos ajustes acompañan al perfil. La estimación usa la
                velocidad calibrada y las pasadas indicadas.
              </p>
            </details>
          </Modal.Body>
        )}
        <Modal.Footer className={styles.modalFooter}>
          <Button
            type="button"
            variant="outline"
            onClick={() => setDraft(null)}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={guardar}>
            Aplicar perfil
          </Button>
        </Modal.Footer>
      </MaquinariaDialog>
    </div>
  );
}
