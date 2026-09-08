"use client";
import { FieldDescription, FieldGroup } from "@/components/ui/field";
import { OpcionCorte } from "@/components/costos/maquina-editor/herramientas-corte-editor";
import {
  NOMBRES_OPERACION_CORTE,
  OPERACIONES_CORTE,
  registroCorte,
} from "@/lib/procesamiento-corte";
import s from "@/components/costos/maquina-editor/procesamiento-corte.module.css";

export type MaquinaOperacionesCorte = {
  nombre: string;
  perfilesOperativos: Array<{
    id: string;
    nombre: string;
    detalleJson?: unknown;
  }>;
};
export function OperacionesCorteFields({
  params,
  maquina,
  onChange,
}: {
  params: Record<string, unknown>;
  maquina?: MaquinaOperacionesCorte | null;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  if (params.cotizarOperacionesVectoriales !== true) return null;
  const elegidos = registroCorte(params.perfilesOperacionCorte);
  return (
    <section className={s.panel} aria-label="Operaciones sobre las piezas">
      <div className={s.header}>
        <div>
          <h3>Operaciones sobre las piezas</h3>
          <p>
            {maquina
              ? `Máquina: ${maquina.nombre}`
              : "Seleccioná la máquina del nodo para configurar sus operaciones."}
          </p>
        </div>
      </div>
      <div className={s.body}>
        <FieldGroup className={s.grid}>
          {OPERACIONES_CORTE.map((operacion) => (
            <OpcionCorte
              key={operacion}
              label={NOMBRES_OPERACION_CORTE[operacion]}
              value={String(elegidos[operacion] || "__auto")}
              opciones={[
                { value: "__auto", label: "Automático por material y espesor" },
                ...(maquina?.perfilesOperativos ?? [])
                  .filter(
                    (p) =>
                      registroCorte(p.detalleJson).operacionCorte === operacion,
                  )
                  .map((p) => ({ value: p.id, label: p.nombre })),
              ]}
              onChange={(v) =>
                onChange({
                  perfilesOperacionCorte: {
                    ...elegidos,
                    [operacion]: v === "__auto" ? null : v,
                  },
                })
              }
            />
          ))}
        </FieldGroup>
        <FieldDescription>
          Se cotizan las operaciones asignadas a las entidades del archivo. La
          selección automática necesita un único perfil compatible; elegir uno
          aquí también valida su material, espesor y herramienta. Las capas
          conservadas sin operación no suman tiempo.
        </FieldDescription>
      </div>
    </section>
  );
}
