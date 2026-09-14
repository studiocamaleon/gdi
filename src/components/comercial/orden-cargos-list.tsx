"use client";

import { Card } from "@heroui/react";
import { Trash2Icon } from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { formatCurrency, type PropuestaCargoDirecto } from "@/lib/propuestas";
import s from "./orden-cargos-list.module.css";

export function OrdenCargosList({
  cargos,
  onRemove,
  isDisabled = false,
}: {
  cargos: PropuestaCargoDirecto[];
  onRemove?: (id: string) => void;
  isDisabled?: boolean;
}) {
  const { moneda } = useConfigRegional();
  if (!cargos.length) return null;
  return (
    <Card className={s.card} aria-label="Cargos de la orden">
      <Card.Header className={s.header}>
        <h2>Cargos de la orden</h2>
      </Card.Header>
      <Card.Content className={s.content}>
        {cargos.map((cargo) => (
          <div className={s.row} key={cargo.id}>
            <div className={s.name}>
              <strong>{cargo.nombreSnapshot}</strong>
              <small>{cargo.detalle}</small>
              {cargo.nota && <p>{cargo.nota}</p>}
            </div>
            <dl className={s.amounts}>
              <div>
                <dt>Neto</dt>
                <dd>{formatCurrency(cargo.montoNeto, moneda)}</dd>
              </div>
              <div>
                <dt>IVA</dt>
                <dd>{formatCurrency(cargo.impuestoMonto, moneda)}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>
                  <strong>{formatCurrency(cargo.total, moneda)}</strong>
                </dd>
              </div>
            </dl>
            {onRemove && (
              <ActionButton
                variant="ghost"
                isIconOnly
                isDisabled={isDisabled}
                aria-label={`Eliminar cargo ${cargo.nombreSnapshot}`}
                title="Eliminar cargo"
                onPress={() => onRemove(cargo.id)}
              >
                <Trash2Icon />
              </ActionButton>
            )}
          </div>
        ))}
      </Card.Content>
    </Card>
  );
}
