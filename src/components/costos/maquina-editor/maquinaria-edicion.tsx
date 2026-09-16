"use client";

import { createContext, useContext, type ReactNode } from "react";
import { ButtonContext } from "react-aria-components/Button";
import { SelectContext } from "react-aria-components/Select";
import { ComboBoxContext } from "react-aria-components/ComboBox";
import { ToggleButtonGroupContext } from "react-aria-components/ToggleButtonGroup";

const MaquinariaPuedeEditar = createContext(true);
export const useMaquinariaPuedeEditar = () => useContext(MaquinariaPuedeEditar);

/** El permiso de la ficha alcanza también a los controles con portal. */
export function MaquinariaEdicion({
  puedeGestionar,
  children,
}: {
  puedeGestionar: boolean;
  children: ReactNode;
}) {
  const disabled = { isDisabled: !puedeGestionar };
  return (
    <MaquinariaPuedeEditar.Provider value={puedeGestionar}>
      <ButtonContext.Provider value={disabled}>
        <SelectContext.Provider value={disabled}>
          <ComboBoxContext.Provider value={disabled}>
            <ToggleButtonGroupContext.Provider value={disabled}>
              <fieldset
                disabled={!puedeGestionar}
                className="flex min-w-0 flex-col gap-4"
              >
                {children}
              </fieldset>
            </ToggleButtonGroupContext.Provider>
          </ComboBoxContext.Provider>
        </SelectContext.Provider>
      </ButtonContext.Provider>
    </MaquinariaPuedeEditar.Provider>
  );
}
