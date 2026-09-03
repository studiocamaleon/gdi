"use client";

import { BoxesIcon, CircleHelpIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  PoliticaNestingCompuesto,
  ProductoRecetaComponenteInput,
} from "@/lib/productos-servicios-api";
import {
  actualizarExclusionNestingComponente,
  estaExcluidoDelNestingCompuesto,
} from "./nesting-compuesto-helpers";
import styles from "./nesting-compuesto-dialog.module.css";

function Ayuda({ etiqueta, children }: { etiqueta: string; children: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={etiqueta}
          />
        }
      >
        <CircleHelpIcon />
      </TooltipTrigger>
      <TooltipContent side="top">{children}</TooltipContent>
    </Tooltip>
  );
}

export function NestingCompuestoDialog({
  politica,
  componentes,
  disabled = false,
  onPoliticaChange,
  onComponentesChange,
}: {
  politica: PoliticaNestingCompuesto;
  componentes: ProductoRecetaComponenteInput[];
  disabled?: boolean;
  onPoliticaChange: (politica: PoliticaNestingCompuesto) => void;
  onComponentesChange: (componentes: ProductoRecetaComponenteInput[]) => void;
}) {
  const consolidando = politica === "CONSOLIDAR_COMPATIBLES";

  const cambiarExclusion = (index: number, excluido: boolean) => {
    onComponentesChange(
      componentes.map((componente, currentIndex) =>
        currentIndex === index
          ? actualizarExclusionNestingComponente(componente, excluido)
          : componente,
      ),
    );
  };

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
          />
        }
      >
        <BoxesIcon data-icon="inline-start" />
        Nesting
      </DialogTrigger>

      <DialogContent
        className="gp-modal gp-modal-compact"
        overlayClassName="gp-modal-overlay"
      >
        <DialogHeader>
          <DialogTitle>Nesting del compuesto</DialogTitle>
          <DialogDescription>
            Configuración de material para esta receta.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className={styles.body}>
          <Field>
            <div className={styles.labelRow}>
              <FieldLabel>Política</FieldLabel>
              <Ayuda etiqueta="Cómo funciona la política de nesting">
                Consolidar compatibles agrupa sólo piezas con igual material y
                configuración productiva. Si no mejora el consumo o el costo,
                conserva el cálculo individual.
              </Ayuda>
            </div>
            <ToggleGroup
              multiple={false}
              value={[politica]}
              onValueChange={(values) => {
                const siguiente = values.at(-1) as
                  PoliticaNestingCompuesto | undefined;
                if (siguiente) onPoliticaChange(siguiente);
              }}
              variant="outline"
              disabled={disabled}
              className={styles.segmented}
            >
              <ToggleGroupItem value="INDEPENDIENTE">
                Por componente
              </ToggleGroupItem>
              <ToggleGroupItem value="CONSOLIDAR_COMPATIBLES">
                Consolidar compatibles
              </ToggleGroupItem>
            </ToggleGroup>
          </Field>

          <FieldSet className={styles.exclusions}>
            <FieldLegend className={styles.legend}>
              Exclusiones
              <Ayuda etiqueta="Cómo funcionan las exclusiones">
                Un componente excluido conserva siempre su nesting individual.
              </Ayuda>
            </FieldLegend>

            {componentes.length > 0 ? (
              <FieldGroup className={styles.componentList}>
                {componentes.map((componente, index) => {
                  const excluido = estaExcluidoDelNestingCompuesto(
                    componente.configuracionJson,
                  );
                  return (
                    <Field
                      key={`${componente.productoComponenteId}-${componente.codigo}`}
                      orientation="horizontal"
                      data-disabled={!consolidando || disabled}
                      className={styles.component}
                    >
                      <FieldContent>
                        <FieldTitle>
                          {componente.nombre}
                          {excluido ? (
                            <Badge variant="secondary">Excluido</Badge>
                          ) : null}
                        </FieldTitle>
                      </FieldContent>
                      <Switch
                        size="sm"
                        checked={excluido}
                        disabled={!consolidando || disabled}
                        aria-label={`Excluir ${componente.nombre} del nesting consolidado`}
                        onCheckedChange={(checked) =>
                          cambiarExclusion(index, checked)
                        }
                      />
                    </Field>
                  );
                })}
              </FieldGroup>
            ) : (
              <p className={styles.empty}>No hay componentes en esta receta.</p>
            )}
          </FieldSet>
        </FieldGroup>

        <DialogFooter>
          <DialogClose render={<Button type="button" />}>Listo</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
