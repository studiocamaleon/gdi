# Persistir los PDF de medición como archivos de la orden (diseño)

> Estado: **diseño**, ejecución arrancando. Rama `feat/planos-persistir`.
> Fase 2 de la herramienta de medidas por PDF (la Fase 1 —lectura client-side—
> ya está). Antes bloqueada por no tener R2; ahora R2 está conectado.
> Fecha: 2026-07-31.

## 1. Objetivo

En productos con planos que usan el lector de medidas por PDF, los PDF que se
suben para medir deben **quedar como Archivos del ítem de la orden** (los que el
operario ve desde el tablero), no descartarse tras leer la medida.

## 2. Estado actual

- `handleAdjuntarPlanos` (`agregar-producto-sheet.tsx`) llama a `leerMedidasPdf`
  (`pdf-medidas.ts`, pdf-lib, 100% navegador), arma las piezas con su ancho/alto
  y guarda en cada pieza `origen: { archivoNombre, pagina, … }`.
- **Descarta el `File`**: conserva el nombre y la medida, no los bytes.

## 3. El molde ya existe (sellos)

Los EPS del configurador de sellos ya persisten así: al guardar la orden,
`publicarArtesDeSello(orden.productos)` (`sello-arte/publicar.ts`) sube cada arte
con `subirArchivo(file, { scope: "ORDEN_ITEM", entidadId: ordenItemId })`,
disparado desde `publicarArtes` en `propuesta-ficha.tsx`. `subirArchivo` (R2 en
prod, disco en dev) está probado E2E contra R2. La diferencia: sellos
**regenera** el EPS de la config persistida; el plano **no se regenera**, hay que
cargar los bytes reales.

## 4. Hallazgo clave: el id del ítem NO sobrevive

- El DTO de creación (`CrearOrdenTrabajoItemDto`) **no** manda `id`, sólo
  `cotizacionItemId`. El server hace `ordenTrabajoItem.create` con id **nuevo**.
- ⇒ El `PropuestaItem.id` de staging ≠ el `ordenItemId` persistido.
- **Match staging → persistido:** por **`cotizacionItemId`** (único por ítem,
  presente en ambos lados tras `persistirSnapshotsItems`). Índice como fallback
  (el payload y `orden.productos` conservan el orden).

## 5. Diseño

**A — Retener y llevar el File (client-side, no persiste):**

1. `handleAdjuntarPlanos` conserva los `File[]` (además de leer la medida).
2. Viajan en un campo **transitorio** del `PropuestaItem` (ej.
   `planosPendientes?: File[]`) que el armado del payload (`itemToOrdenItemPayload`)
   **no** incluye ⇒ no se serializa ni se guarda en el snapshot.
3. Se mantienen en el `items` en memoria de `propuesta-ficha` hasta guardar.

**B — Subir al guardar (`publicarPlanos`, calcado de `publicarArtesDeSello`):**

1. Tras `crearOrdenTrabajo` → `orden.productos` (con `ordenItemId` real).
2. Para cada `{ item, cotizacionItemId }` de `itemsConSnapshot` con
   `item.planosPendientes`, ubicar el producto persistido por `cotizacionItemId`
   y `subirArchivo(file, { scope: "ORDEN_ITEM", entidadId: producto.id,
   autogeneradoPor: "medida_pdf" })`.
3. Se llama junto a `publicarArtes`, en los tres puntos de guardado (emitir,
   borrador, y agregar a orden existente).

**Idempotencia:** el plano es un archivo del usuario, se sube **una vez**. Sólo
se suben los que están en memoria (recién adjuntados). Reabrir una orden vieja no
tiene el `File` pero el PDF ya está en R2 ⇒ se ve en los Archivos del ítem.

## 6. Casos a cubrir

- **Multi-página / varios PDF:** un `File` puede dar varias piezas; se sube el
  archivo una vez, no por pieza. Deduplicar por `File` (por nombre+tamaño).
- **Crear vs. editar:** creación de orden (staging, guarda todo junto) y agregar
  producto a una orden existente (guarda el ítem y sube al toque).
- **Editar un producto:** si se re-adjunta un plano nuevo, se sube; los previos
  ya están en R2.
- **Falla de subida:** igual que sellos — la orden queda guardada y el aviso
  llega mientras está en pantalla; no bloquea el guardado.

## 7. Alcance

- Sólo agrega archivos: **no** toca el motor, el precio ni el costeo → riesgo
  bajo.
- Fase A (retener + llevar) y Fase B (`publicarPlanos`) en `feat/planos-persistir`.
- Prod necesita el bucket de R2 de producción (pendiente global de Archivos); en
  dev anda contra R2 real / disco.
