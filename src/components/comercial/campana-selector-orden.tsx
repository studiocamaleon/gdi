"use client";

import { ListBox, Select } from "@heroui/react";
import theme from "@/components/design-system/theme.module.css";
import fieldFocus from "@/components/design-system/field-focus.module.css";
import { useDesignScope } from "@/components/design-system/appearance";

/** Una campaña se elige de las disponibles para el cliente; nunca es texto libre. */
export function CampanaSelectorOrden({
  value,
  onChange,
  options,
  isDisabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ id: string; nombre: string; codigo?: string }>;
  isDisabled?: boolean;
}) {
  const scope = useDesignScope();
  const items = [
    { id: "sin-campana", nombre: "Sin campaña", codigo: "" },
    ...options,
  ];
  return (
    <Select
      className="h-auto items-stretch border-0 bg-transparent p-0"
      aria-label="Campaña"
      value={value || "sin-campana"}
      isDisabled={isDisabled}
      fullWidth
      onChange={(key) => {
        if (key !== null) onChange(key === "sin-campana" ? "" : String(key));
      }}
    >
      <Select.Trigger className={fieldFocus.singleBorder}>
        <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover {...scope} className={theme.theme}>
        <ListBox items={items}>
          {(item) => (
            <ListBox.Item id={item.id} textValue={item.nombre}>
              <span>
                {item.nombre}
                {item.codigo && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {item.codigo}
                  </span>
                )}
              </span>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          )}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
