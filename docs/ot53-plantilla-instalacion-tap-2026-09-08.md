# OT-2026-0053: plantilla de instalación y TAP de Polyfan

## Causa

La vista de nesting ya recorría los componentes fabricados, pero enviaba el ID del producto padre a los paneles de instalación y corte. El servicio sólo leía `cotizacionItem`, por lo que tampoco reconocía al componente de Polyfan: éste conserva su contexto y cálculo en los snapshots propios de la OT, sin una cotización independiente.

La plantilla, además, sólo aceptaba la antigua fuente única `disenoVectorialFuente`. Las siete piezas importadas del logo están en `disenosVectoriales`. Sus posiciones originales sí estaban conservadas en `fabricacion.origen`.

También se detectó que el SVG entregado al motor TAP incluía `meta.contornos` pero omitía las operaciones `CORTE_INTERIOR` importadas. El nesting y las exportaciones de capas conservaban esos recorridos, pero el TAP y su estimación no los recorrían.

## Corrección

- La pantalla identifica la ruta completa de códigos de componentes y el paso seleccionado. La API la resuelve dentro del item y tenant correspondiente, incluyendo componentes anidados, y todas las descargas conservan esa selección.
- El servicio usa el contexto y cálculo congelados del componente, con compatibilidad para productos simples. Ignora cortes desactivados y toma el plan operativo cuando el paso representa un lote consolidado.
- La preparación automática al crear, agregar o editar items incluye sus descendientes. Las revisiones se reutilizan por huella, sin duplicarlas al abrir la pantalla.
- El TAP incluye los cortes interiores cerrados como subcontornos de cada pieza; hendido y otras operaciones no se convierten en cortes de hilo. Usa la máquina y perfil seleccionados y conserva la velocidad cotizada. Las repeticiones de placa viajan al panel de descarga.
- La plantilla agrupa las interpretaciones del mismo archivo y reconstruye sus posiciones originales en milímetros. La cantidad de productos/piezas para fabricar no multiplica la composición de instalación. Archivos independientes tienen plantillas independientes y un selector en pantalla.
- El constructor SVG también se usa al cotizar: las cotizaciones nuevas incluyen el recorrido interior y sus conexiones. Se cambió la huella de trabajos asíncronos para no reutilizar respuestas anteriores a esta corrección.

## Validación y estado de la orden

Se verificó con el motor real sobre la OT reportada, primero en una transacción revertida. Después se conservó su revisión de corte en **BORRADOR**, sin aprobarla ni enviarla a máquina.

- 7 piezas, 11 contornos, 11 conexiones.
- Recorrido total: 6.945,57 mm a 350 mm/min; tiempo de recorrido: 19 min 51 s.
- TAP descargable de 15.571 bytes.
- Plantilla del logo: 885,75 × 441,33 mm; con borde de 50 mm: 985,75 × 541,33 mm, un panel.
- Descarga SVG y DXF comprobadas. Navegador: aparece «Descargar TAP», la simulación, el negativo completo en su composición original y las descargas de instalación, sin el error anterior.
- Abrir de nuevo el componente reutiliza la misma revisión.
- 39 pruebas de recorridos, fuentes, trabajos asíncronos y materialización de OT; 89 del motor y operaciones de corte. Compilación API y TypeScript frontend correctos; CSS sin globales nuevas. Se conserva la cobertura anterior de enlaces de instalación junto con las nuevas pruebas de selección.

La cotización guardada tenía un recorrido de 17 min 37 s. Los interiores agregan aproximadamente 2 min 14 s de recorrido. **El importe y los tiempos comerciales de la OT existente no se reescribieron**: la corrección se aplica al calcular nuevas cotizaciones, y el panel de preparación muestra la duración del archivo completo. El script `apps/api/test/validacion-ot53-recorridos.ts` deja esta comprobación reproducible; revierte escrituras salvo que se ejecute con `--guardar`.

La API y el worker se recompilaron y reiniciaron con la corrección. No se hicieron commits ni merges en esta tarea.
