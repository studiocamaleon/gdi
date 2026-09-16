"use client";

import * as React from "react";
import { Checkbox, Drawer, Input, Label, TextArea } from "@heroui/react";
import { Save, Settings, X } from "lucide-react";
import { toast } from "sonner";
import { ActionButton } from "@/components/design-system/action-button";
import {
  useDesignScope,
  useDesignTheme,
} from "@/components/design-system/appearance";
import focus from "@/components/design-system/field-focus.module.css";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import {
  actualizarConfigPresupuestos,
  getConfigPresupuestos,
  type ConfigPresupuestos,
} from "@/lib/presupuestos-api";
import s from "./config-presupuestos-sheet.module.css";

export function ConfigPresupuestosSheet({
  onCerrar,
}: {
  onCerrar: () => void;
}) {
  const scope = useDesignScope();
  const themeClass = useDesignTheme();
  const { moneda } = useConfigRegional();
  const [cfg, setCfg] = React.useState<ConfigPresupuestos | null>(null);
  const [guardando, setGuardando] = React.useState(false);

  React.useEffect(() => {
    getConfigPresupuestos()
      .then(setCfg)
      .catch(() => {
        toast.error("No se pudo cargar la configuración.");
        onCerrar();
      });
  }, [onCerrar]);

  const guardar = async () => {
    if (!cfg) return;
    setGuardando(true);
    try {
      await actualizarConfigPresupuestos(cfg);
      toast.success("Configuración guardada.");
      onCerrar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };

  const num = (v: string): number | null =>
    v.trim() === "" ? null : Number(v);
  const campo = (label: string, hint: string, children: React.ReactNode) => (
    <label className={s.field}>
      <span className={s.label}>{label}</span>
      <span className={s.hint}>{hint}</span>
      {children}
    </label>
  );
  const control = `${s.control} ${focus.singleBorder}`;

  return (
    <Drawer>
      <Drawer.Backdrop
        {...scope}
        className={themeClass}
        variant="opaque"
        isOpen
        onOpenChange={(open) => {
          if (!open) onCerrar();
        }}
      >
        <Drawer.Content placement="right">
          <Drawer.Dialog
            className={s.dialog}
            aria-label="Configuración de presupuestos"
          >
            <Drawer.Header className={s.header}>
              <span className={s.icon}>
                <Settings size={19} aria-hidden />
              </span>
              <Drawer.Heading className={s.title}>
                Configuración de presupuestos
              </Drawer.Heading>
              <ActionButton
                variant="outline"
                isIconOnly
                aria-label="Cerrar"
                onPress={onCerrar}
              >
                <X size={16} aria-hidden />
              </ActionButton>
            </Drawer.Header>
            <Drawer.Body className={s.body}>
              {!cfg ? (
                <p className="text-muted-foreground text-sm">Cargando…</p>
              ) : (
                <>
                  {campo(
                    "Validez (días)",
                    "Cuánto vale el presupuesto desde que se envía; después vence solo.",
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      className={control}
                      value={cfg.validezDiasDefault}
                      onChange={(e) =>
                        setCfg({
                          ...cfg,
                          validezDiasDefault: Number(e.target.value) || 15,
                        })
                      }
                    />,
                  )}
                  {campo(
                    "Seña sugerida (%)",
                    "Se imprime como condición de pago en el PDF y el link.",
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      className={control}
                      value={cfg.senaSugeridaPctDefault}
                      onChange={(e) =>
                        setCfg({
                          ...cfg,
                          senaSugeridaPctDefault: Number(e.target.value) || 0,
                        })
                      }
                    />,
                  )}
                  {campo(
                    "Condiciones del PDF",
                    "Términos que se agregan al pie de cada presupuesto.",
                    <TextArea
                      rows={3}
                      className={`${control} ${s.textarea}`}
                      value={cfg.condicionesTexto ?? ""}
                      onChange={(e) =>
                        setCfg({
                          ...cfg,
                          condicionesTexto: e.target.value || null,
                        })
                      }
                    />,
                  )}
                  <section
                    className={s.approval}
                    aria-labelledby="presupuesto-umbrales"
                  >
                    <h3 id="presupuesto-umbrales">
                      Aprobación interna (umbrales)
                    </h3>
                    <p className={s.explanation}>
                      Si un presupuesto se sale de estos límites, un operador no
                      puede enviarlo: queda esperando la aprobación de un
                      supervisor. Vacío = regla desactivada.
                    </p>
                    {campo(
                      `Monto máximo sin aprobación (${moneda.codigo})`,
                      "Totales por encima de este valor requieren aprobación.",
                      <Input
                        type="number"
                        min={0}
                        className={control}
                        placeholder="Sin límite"
                        value={cfg.aprobacionMontoMax ?? ""}
                        onChange={(e) =>
                          setCfg({
                            ...cfg,
                            aprobacionMontoMax: num(e.target.value),
                          })
                        }
                      />,
                    )}
                    {campo(
                      "Margen mínimo (%)",
                      "Presupuestos con margen real por debajo requieren aprobación (usa el costo del snapshot). Sugerido: 25.",
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        className={control}
                        placeholder="Desactivado"
                        value={cfg.aprobacionMargenMinPct ?? ""}
                        onChange={(e) =>
                          setCfg({
                            ...cfg,
                            aprobacionMargenMinPct: num(e.target.value),
                          })
                        }
                      />,
                    )}
                    {campo(
                      "Descuento máximo (%)",
                      "Descuentos por encima de este porcentaje (en cualquier línea) requieren aprobación. Sugerido: 10.",
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        className={control}
                        placeholder="Desactivado"
                        value={cfg.aprobacionDescuentoMaxPct ?? ""}
                        onChange={(e) =>
                          setCfg({
                            ...cfg,
                            aprobacionDescuentoMaxPct: num(e.target.value),
                          })
                        }
                      />,
                    )}
                    <Checkbox
                      isSelected={cfg.requiereAprobacionSinCosteo}
                      onChange={(selected) =>
                        setCfg({
                          ...cfg,
                          requiereAprobacionSinCosteo: selected,
                        })
                      }
                    >
                      <Checkbox.Content className={s.checkbox}>
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        <Label>
                          Exigir aprobación cuando algún producto no tenga
                          costeo verificable
                        </Label>
                      </Checkbox.Content>
                    </Checkbox>
                  </section>
                </>
              )}
            </Drawer.Body>
            {cfg && (
              <Drawer.Footer className={s.footer}>
                <ActionButton variant="outline" onPress={onCerrar}>
                  Cancelar
                </ActionButton>
                <ActionButton
                  isDisabled={guardando}
                  onPress={() => void guardar()}
                >
                  <Save size={15} aria-hidden />
                  {guardando ? "Guardando…" : "Guardar"}
                </ActionButton>
              </Drawer.Footer>
            )}
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}
