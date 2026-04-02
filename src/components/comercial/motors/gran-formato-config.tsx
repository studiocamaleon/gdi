"use client";

import * as React from "react";
import { PlusIcon, XIcon } from "lucide-react";

import type {
  ProductoServicio,
  GranFormatoConfig,
  GranFormatoChecklistConfig,
  ProductoChecklist,
} from "@/lib/productos-servicios";
import { tecnologiaMaquinaItems, type MaquinaPerfilOperativo } from "@/lib/maquinaria";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ProductoServicioChecklistCotizador } from "@/components/productos-servicios/producto-servicio-checklist";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GranFormatoMedida = {
  anchoMm: number | null;
  altoMm: number | null;
  cantidad: number;
};

export type PerfilCompatible = MaquinaPerfilOperativo & { maquinaNombre: string };

export type GranFormatoProposalConfigProps = {
  producto: ProductoServicio;
  config: GranFormatoConfig;
  perfilesCompatibles: PerfilCompatible[];
  checklistConfig: GranFormatoChecklistConfig | null;
  medidas: GranFormatoMedida[];
  onMedidasChange: (medidas: GranFormatoMedida[]) => void;
  tecnologia: string;
  onTecnologiaChange: (tec: string) => void;
  selectedPerfilId: string;
  onSelectedPerfilIdChange: (id: string) => void;
  checklistRespuestas: Record<string, { respuestaId: string }>;
  onChecklistRespuestasChange: (
    v: Record<string, { respuestaId: string }>,
  ) => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTecnologiaLabel(value: string): string {
  return (
    tecnologiaMaquinaItems.find((t) => t.value === value)?.label ?? value
  );
}

function getActiveChecklist(
  checklistConfig: GranFormatoChecklistConfig | null,
  tecnologia: string,
): ProductoChecklist | null {
  if (!checklistConfig) return null;
  if (checklistConfig.aplicaATodasLasTecnologias) {
    const cl = checklistConfig.checklistComun;
    return cl?.activo && cl.preguntas?.length > 0 ? cl : null;
  }
  const perTec = checklistConfig.checklistsPorTecnologia.find(
    (c) => c.tecnologia === tecnologia,
  );
  const cl = perTec?.checklist;
  return cl?.activo && cl?.preguntas?.length > 0 ? cl : null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GranFormatoProposalConfig({
  config,
  perfilesCompatibles,
  checklistConfig,
  medidas,
  onMedidasChange,
  tecnologia,
  onTecnologiaChange,
  selectedPerfilId,
  onSelectedPerfilIdChange,
  checklistRespuestas,
  onChecklistRespuestasChange,
}: GranFormatoProposalConfigProps) {
  const tecnologias = config.tecnologiasCompatibles;

  // Auto-select si hay una sola tecnología
  React.useEffect(() => {
    if (!tecnologia && tecnologias.length === 1) {
      onTecnologiaChange(tecnologias[0]);
    }
  }, [tecnologia, tecnologias, onTecnologiaChange]);

  // Auto-select perfil si hay uno solo
  React.useEffect(() => {
    if (perfilesCompatibles.length === 1 && selectedPerfilId !== perfilesCompatibles[0].id) {
      onSelectedPerfilIdChange(perfilesCompatibles[0].id);
    } else if (
      perfilesCompatibles.length > 0 &&
      selectedPerfilId &&
      !perfilesCompatibles.some((p) => p.id === selectedPerfilId)
    ) {
      onSelectedPerfilIdChange("");
    }
  }, [perfilesCompatibles, selectedPerfilId, onSelectedPerfilIdChange]);

  const tecItems = React.useMemo(
    () => tecnologias.map((t) => ({ value: t, label: getTecnologiaLabel(t) })),
    [tecnologias],
  );

  const perfilItems = React.useMemo(
    () =>
      perfilesCompatibles.map((p) => {
        const detalle = p.detalle as Record<string, unknown> | null;
        const confTintas = typeof detalle?.configuracionTintas === "string" ? detalle.configuracionTintas : "";
        const label = confTintas ? `${p.nombre} — ${confTintas}` : p.nombre;
        return { value: p.id, label };
      }),
    [perfilesCompatibles],
  );

  const checklist = getActiveChecklist(checklistConfig, tecnologia);

  // --- Medidas handlers ---
  function updateMedida(
    index: number,
    field: keyof GranFormatoMedida,
    value: number | null,
  ) {
    const next = [...medidas];
    next[index] = { ...next[index], [field]: value };
    onMedidasChange(next);
  }

  function addMedida() {
    onMedidasChange([...medidas, { anchoMm: null, altoMm: null, cantidad: 1 }]);
  }

  function removeMedida(index: number) {
    if (medidas.length <= 1) return;
    onMedidasChange(medidas.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Medidas */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Medidas
        </p>
        <div className="flex flex-col gap-2">
          {medidas.map((m, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className="grid flex-1 grid-cols-3 gap-2">
                <div className="flex flex-col gap-1">
                  {idx === 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      Ancho (cm)
                    </span>
                  )}
                  <Input
                    type="number"
                    min={0.1}
                    step={0.1}
                    placeholder="Ancho"
                    value={m.anchoMm != null ? m.anchoMm / 10 : ""}
                    onChange={(e) => {
                      const v = e.target.value
                        ? Math.round(Number(e.target.value) * 10)
                        : null;
                      updateMedida(idx, "anchoMm", v);
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  {idx === 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      Alto (cm)
                    </span>
                  )}
                  <Input
                    type="number"
                    min={0.1}
                    step={0.1}
                    placeholder="Alto"
                    value={m.altoMm != null ? m.altoMm / 10 : ""}
                    onChange={(e) => {
                      const v = e.target.value
                        ? Math.round(Number(e.target.value) * 10)
                        : null;
                      updateMedida(idx, "altoMm", v);
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  {idx === 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      Cantidad
                    </span>
                  )}
                  <Input
                    type="number"
                    min={1}
                    value={m.cantidad || ""}
                    onChange={(e) =>
                      updateMedida(
                        idx,
                        "cantidad",
                        Math.max(1, Number(e.target.value) || 1),
                      )
                    }
                  />
                </div>
              </div>
              {medidas.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="shrink-0"
                  onClick={() => removeMedida(idx)}
                >
                  <XIcon className="size-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={addMedida}
        >
          <PlusIcon />
          Agregar medida
        </Button>
      </div>

      {/* Tecnología */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Tecnologia
        </p>
        {tecnologias.length === 1 ? (
          <p className="text-sm font-medium">
            {getTecnologiaLabel(tecnologias[0])}
          </p>
        ) : (
          <Select
            items={tecItems}
            value={tecnologia}
            onValueChange={(v) => {
              if (v) {
                onTecnologiaChange(v);
                onChecklistRespuestasChange({});
              }
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccionar tecnologia" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {tecItems.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Perfil / Modo de impresión */}
      {perfilItems.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Modo de impresion
          </p>
          {perfilItems.length === 1 ? (
            <p className="text-sm font-medium">{perfilItems[0].label}</p>
          ) : (
            <Select
              items={perfilItems}
              value={selectedPerfilId}
              onValueChange={(v) => v && onSelectedPerfilIdChange(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar modo" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {perfilItems.map((v) => (
                    <SelectItem key={v.value} value={v.value}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* Checklist */}
      {checklist && (
        <>
          <Separator />
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Opcionales del producto
            </p>
            <ProductoServicioChecklistCotizador
              checklist={checklist}
              value={checklistRespuestas}
              onChange={onChecklistRespuestasChange}
            />
          </div>
        </>
      )}
    </div>
  );
}
