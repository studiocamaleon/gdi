/** Los buscadores portaleados pueden reenviar la tecla desde otro elemento.
 * El foco real y el recorrido original también cuentan como edición. */
export function permiteAtajoDePagina(event: KeyboardEvent): boolean {
  if (
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    event.shiftKey
  )
    return false;
  const interactivo = (target: EventTarget | null) =>
    target instanceof Element &&
    !!target.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="searchbox"], [role="combobox"], [role="listbox"], [role="dialog"], [role="menu"]',
    );
  return ![event.target, document.activeElement, ...event.composedPath()].some(
    interactivo,
  );
}
