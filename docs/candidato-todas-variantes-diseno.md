# Candidato de material: modo "todas las variantes" (diseño 2026-07-31)

## Problema

Un candidato de material en un producto guarda una **lista fija** de qué
variantes tiene habilitadas (`ProductoConfigPasoSlotMaterialCandidatoVariante`,
o `varianteIds` en el JSON de un paso extra). Al agregar una variante nueva a
un material (ej. un espesor de PVC), los productos que "deberían" ofrecerla no
la absorben: hay que entrar producto por producto y re-guardar el candidato.

Lo que NO es problema (verificado en vivo 2026-07-31): el **precio**. El
candidato guarda sólo el `varianteId`, nunca el precio; el motor lee
`precioReferencia` de la variante al cotizar. Un cambio de precio se propaga a
todos los productos al instante, sin re-guardar.

## Solución: un modo por candidato

`ProductoConfigPasoSlotMaterialCandidato.todasLasVariantes Boolean @default(false)`

- **false (default, lo de hoy)**: la lista fija de `variantes` manda. Para
  productos que ofrecen sólo algunos espesores a propósito.
- **true**: el candidato usa TODAS las variantes activas del material,
  resueltas en vivo. Una variante nueva aparece sola. Cero mantenimiento.

## Estrategia: resolver en la CARGA

El flag NO cambia el motor de selección ni el render del editor. Se resuelve en
los loaders: cuando un candidato tiene `todasLasVariantes`, el loader reemplaza
su lista de `variantes` por todas las variantes ACTIVAS de la materia prima
(query en vivo). Todo lo de abajo trabaja igual, con la lista completa y fresca.

Loaders a tocar:
- Motor `cargarProducto` (ruta base): query + mapeo del candidato.
- `productos.service` detalle (editor, ruta base): idem.
- `hydratePasoExtraSlots` (pasos extra): el candidato JSON lleva
  `todasLasVariantes?`; si true, resolver activas.

`defaultVarianteId` se conserva si sigue activa; si no, cae a la primera.

## Persistencia y UI

- Save: config-pasos service (ruta base) y JSON del extra persisten el flag.
  Con `todas`, no hace falta guardar `varianteIds` (se ignoran).
- Editor: toggle "Todas las variantes / Elegir específicas" por candidato. En
  "todas", los checkboxes se muestran todos marcados e inhabilitados, con la
  nota "se agregan solas"; el selector de variante predeterminada sigue.

## Verificación

- Productos existentes (todas=false): precio idéntico al centavo.
- Un producto con todas=true absorbe una variante nueva sin re-guardar.
