# TPV Centro de copiado — carga rápida — diseño

> 2026-08-01, rama `feat/tpv-centro-copiado`. Boceto de referencia del usuario
> (modal "Centro de copiado · CARGA RÁPIDA" dentro de NUEVA ORDEN). NO existe
> doc previo de centro de copiado/TPV/fotocopia: es un módulo nuevo. El objetivo
> es AGILIDAD de carga y cotización de servicios express (impresión/fotocopia
> multi-archivo con papel/color/faz por documento y anillado agrupado), pasando
> de una cotización manual de ~20 min a ~1 min, **sin perder nada** del costeo
> fino que ya existe (clicks, desgaste, tóner, tiempo, impuestos, márgenes,
> ruteo). Journey: el comercial carga N documentos con defaults heredables,
> agrupa algunos para anillar juntos, ve el precio recalcularse en vivo y agrega
> todo a la OT normal como N renglones agrupados.

## 0. Punto de partida — qué ya existe (no se reinventa)

El costeo fino es reutilizable **tal cual**; el motor no necesita cambios para la
matemática de impresión:

| Necesidad | Pieza existente |
|---|---|
| Imprimir carillas sobre A4/A3, papel, color/BN, simple/doble faz | familia `impresion_por_hoja` (`apps/api/src/productos-servicios/pasos/familias.ts:293`) |
| Costo por click, color vs mono (drums CMY no cargan en BN) | `calcularDesgasteMaquina` (`motor.service.ts:3991`), `clicksA4DelPaso` (`:4059`) |
| Tóner por cobertura + tiempo por perfil de máquina | `calcularConsumiblesMaquina` (`:4082`), tiempo T-3 |
| Elegir papel/gramaje | slot `sustrato_principal` vía `jobContext.slotMateriales` |
| A3 = 2 clicks, A4 = 1 | `factorA4Equivalente` (`motor.service.ts:5428`) |
| Anillado, eligiendo el anillo por espesor | familia `encuadernado_anillado` (`familias.ts:1086`) + `MENOR_CAPACIDAD_QUE_CUMPLA` (`motor.service.ts:4567`) |
| Impuestos / margen / comisiones | `aplicar-precio.service.ts:83` al final del pipeline |
| Renglón → OT → pasos al taller | `CotizacionItem` → `OrdenTrabajoItem` (`cotizacionItemId`) → `materializarPasosItems` (`ordenes-trabajo.service.ts:1874`) desde `trazabilidadJson.pasos` |
| Contar páginas de un PDF en el browser | pdf-lib (Fase 1 herramienta de medidas, ya en el repo) |

**El único hueco real** es semántico, no de motor: el motor piensa en *piezas que
se nestean en pliegos* (tarjetas), no en *documentos de N páginas*. El adaptador
que lo cierra vive en el modal (§3) y es aritmética simple.

## 1. Decisiones

- **D1 — Granularidad: N ítems reales, agrupados visualmente** (decisión
  usuario). Cada documento suelto = 1 `CotizacionItem`; cada tomo anillado = 1
  `CotizacionItem`. Cada uno conserva costeo/impuestos/ruteo/pasos propios. La UI
  los muestra agrupados bajo un encabezado "Centro de copiado", pero por detrás
  son renglones normales. El footer del boceto ("Se agrega como 1 renglón") pasa
  a "Se agregan como N renglones (agrupados)".
- **D2 — Un solo PRODUCTO PLANTILLA** (decisión usuario): "Impresión de
  documento", con ruta `impresion_por_hoja` (+ `encuadernado_anillado` opcional).
  El modal NO elige producto: varía el `jobContext` por fila. Papel = variantes
  de inventario (subfamilia `sustratoHoja`) vía `slotMateriales`; color/faz =
  jobContext; tamaño = pliego de impresión (ver D6). Márgenes, impuestos, máquina
  y costo por click se configuran UNA vez en el producto y sus centros (ya
  existe); el modal los hereda.
- **D3 — La unidad interna es el SEGMENTO de impresión** = un documento con
  settings uniformes (páginas, copias, tamaño, papel, color, faz). Un segmento =
  una cotización normal de `impresion_por_hoja`. Un ítem suelto = 1 segmento
  (cotización estándar, recotizable por el camino normal). Un ítem tomo = varios
  segmentos + 1 paso de anillado (ítem compuesto, ver D4).
- **D4 — El tomo mixto se ENSAMBLA por composición** (Tomo-A). El motor cotiza
  cada segmento por separado y el paso de anillado una vez; el orquestador SUMA
  los buckets de costo (tiempo/materiales/cargos/tercerizado), CONCATENA los
  `pasos` en la trazabilidad, y aplica **precio una sola vez** sobre el costo
  total (`calcularPrecioConSnapshots`) — válido porque todos los segmentos usan la
  misma config fiscal/margen del plantilla. Resultado: un `CotizacionItem`
  compuesto con snapshot sintético coherente (costos sumados, pasos concatenados,
  un `desglosePrecio`). Se necesita porque caras/papel/color/tamaño pueden variar
  entre los documentos de un mismo tomo, y el motor cotiza un solo `caras`/papel
  por llamada. Alternativa futura Tomo-B (motor multi-segmento nativo, ítem no
  sintético) queda anotada, no en v1.
- **D5 — Anillado**: `hojasPorLibro` = Σ hojas físicas de los segmentos del tomo;
  `cantidad` = juegos. El motor elige la variante de anillo cuya
  `capacidadMaxHojas >= hojasPorLibro` (menor que cumpla). Si ningún anillo cubre
  el espesor → error de validación visible en la fila (no se cotiza ese tomo).
  v1 sólo Anillado (+ Ninguna); engrapado/plastificado quedan para después
  (familias ya existen: `encuadernado_engrapado`, terminaciones).
- **D6 — Tamaño = pliego de impresión por-cotización** (extensión necesaria). Hoy
  el pliego vive estático en `paramsPasoJson.nestingConfig.pliegoImpresion`. El
  modal necesita cambiar A4/A3 por documento, así que el tamaño debe viajar en el
  jobContext y alimentar `factorA4`. Es la única extensión de motor de la parte
  de impresión. (El pliego de impresión que pasa por la máquina ≠ formato de
  COMPRA del papel; ese sigue saliendo de la variante.)
- **D7 — Archivos: sólo detección de páginas, sin subir** (decisión usuario). Se
  lee la cantidad de páginas del PDF con pdf-lib en el browser (arrastrar / o
  "Simular archivos" en demo). El archivo NO se sube a R2 en v1; el scope
  `ORDEN_ITEM` ya existe y la subida real queda para una fase posterior. El
  usuario puede corregir el conteo a mano (fallback si el PDF no parsea).
- **D8 — Precio en vivo vía endpoint dedicado**: `POST /centro-copiado/cotizar`
  recibe todo el estado del modal (defaults + documentos + grupos) y devuelve el
  desglose por documento, por tomo y el total, en UNA llamada (debounce en el
  front). Internamente llama al motor por segmento. Evita N×M llamadas sueltas al
  tipear.
- **D9 — Sólo carga y cotización** (decisión usuario): sin caja/cobro/turno. El
  cobro sigue el flujo existente (Administración/Pagos). El TPV produce ítems en
  la OT normal; convive con productos normales en la misma orden.
- **D10 — Entrada dentro de NUEVA ORDEN**: botón "Centro de copiado · carga
  rápida" junto al cotizador (`agregar-producto-sheet` / propuesta-ficha). Al
  "Agregar a la OT" crea los N `CotizacionItem` y los suma a la ficha, agrupados.

## 2. Modelo — de documento a costo

Vocabulario:

- **Documento**: un archivo/entrada del cliente. Tiene `páginas` (del PDF o
  manual), `copias`, y settings: `tamaño` (A4/A3…), `papel` (variante), `color`
  (BN/Color), `faz` (simple/doble).
- **Segmento**: un documento con sus settings → una cotización de
  `impresion_por_hoja`.
- **Ítem**: lo que llega a la OT. Suelto (1 segmento) o tomo (N segmentos +
  anillado).

### 2.1 El adaptador (la aritmética que cierra el gap)

Por documento:

```
carillas = páginas × copias
hojas    = faz simple: carillas   |   faz doble: ceil(carillas / 2)
```

Al motor se le pasa, por segmento, un `jobContext`:

```
cantidad       = hojas            // pliegos que pasan por la máquina
caras          = 1 | 2            // faz
modoColor      = 'BN' | 'CMYK'    // color
slotMateriales = { <sustrato>: <varianteId> }   // papel/gramaje
tamaño/pliego  = 'A4' | 'A3'      // D6, alimenta factorA4
```

Y el motor devuelve (sin tocar su matemática):

```
pliegos = hojas
clicks  = hojas × caras × factorA4  = carillas × factorA4   (A4 → = carillas)
papel   = hojas × precioVariante    (slot sustrato ignora caras → cuenta hojas)
desgaste= (precioRepuesto / vidaUtil) × clicks   (soloColor se saltea en BN)
tóner   = por canales del perfil según modoColor
tiempo  = T-3 por perfil de la láser
```

Verificación contra el boceto: 5 documentos, footer 158 carillas / 120 hojas
físicas. Cada fila cuadra (ej. Contrato: 12 págs × 2 copias = 24 carillas, doble
faz → 12 hojas). El sistema ya distingue **página del PDF → carilla → hoja
física**; sólo faltaba nombrarlo en esta capa.

### 2.2 Ensamblado del ítem

- **Suelto**: 1 segmento → `cotizar-y-guardar` estándar → 1 `CotizacionItem`
  normal (recotizable por el camino normal).
- **Tomo**: por cada segmento, `cotizar` (sin guardar) → costos + pasos; +
  `cotizar` del anillado (`hojasPorLibro` = Σ hojas, `cantidad` = juegos). El
  orquestador:
  1. `costos.total = Σ costos.total` (por bucket) de segmentos + anillado.
  2. `trazabilidad.pasos = concat(pasos de todos)` → materializa igual al taller.
  3. `desglosePrecio = aplicarPrecio(costoTotal)` una sola vez (misma config).
  4. Persiste un `CotizacionItem` compuesto (snapshot sintético) + su
     `OrdenTrabajoItem`.

Los pasos concatenados del tomo se materializan como cualquier ítem (impresión de
cada segmento en la láser + anillado en la anilladora), así que el Tablero, el
simulador láser (batch por papel/color/faz) y el ruteo funcionan sin cambios.

## 3. Contrato

`POST /centro-copiado/cotizar` (preview en vivo; no persiste):

```ts
// request
{
  defaults: {                         // "Valores por defecto" del boceto
    tamano: string; papelVarianteId: string;
    color: 'BN' | 'COLOR'; faz: 1 | 2; copias: number;
    terminacion: 'NINGUNA' | 'ANILLADO';
  };
  documentos: Array<{
    id: string; nombre: string; paginas: number; copias: number;
    tamano: string; papelVarianteId: string;
    color: 'BN' | 'COLOR'; faz: 1 | 2;
    grupoId: string | null;           // null = suelto; mismo id = anillar juntos
  }>;
  grupos: Array<{                      // un tomo por grupo
    id: string; nombre: string; juegos: number; terminacion: 'ANILLADO';
  }>;
}

// response
{
  documentos: Array<{
    id: string; carillas: number; hojas: number; clicks: number;
    costo: number; subtotal: number;              // por documento
    error: string | null;                          // ej. papel inexistente
  }>;
  grupos: Array<{
    id: string; hojasPorLibro: number; juegos: number;
    anilloElegido: string | null; espesorOk: boolean;
    subtotal: number; error: string | null;        // ej. sin anillo que cubra
  }>;
  totales: {
    documentos: number; tomos: number; carillas: number;
    hojasFisicas: number; subtotal: number; iva: number; total: number;
  };
}
```

Guardar: `POST /centro-copiado/agregar-a-orden` (o reusar
`cotizar-y-guardar` por suelto + builder compuesto por tomo) → crea los N
`CotizacionItem` + `OrdenTrabajoItem`, agrupados, y devuelve los ids para
refrescar la ficha.

## 4. Casos borde

- **PDF no parsea / sin archivo** → `paginas` editable a mano (D7); nunca bloquea.
- **Papel elegido sin variante de inventario** → fila con `error`, no cotiza ese
  documento; el resto sí (total parcial).
- **Tomo sin anillo que cubra el espesor** (`hojasPorLibro > max capacidad`) →
  `espesorOk:false`, fila en error; sugerir dividir el tomo.
- **Documento suelto con terminación NINGUNA** → 1 segmento, ítem trivial.
- **Grupo de 1 documento** → sigue siendo tomo (anillado de 1 doc es válido).
- **Color mezclado en un tomo** (docs BN + docs Color) → segmentos distintos, cada
  uno con su modoColor; el anillado no discrimina color. Costos suman bien.
- **A3 y A4 en el mismo tomo** → distinto `factorA4` por segmento (A3 = 2 clicks);
  suma correcta. El anillo se elige por hojas, no por tamaño.
- **Recotizar un tomo compuesto** → no pasa por el `recotizar` estándar (ítem
  sintético); v1 recotiza reejecutando el orquestador desde el jobContext
  guardado. Anotar como deuda si molesta.
- **Cantidad 0 páginas / 0 copias** → fila inválida, excluida del total.

## 5. Journey (verificación E2E)

Caso real del usuario (8 archivos, algunos BN otros color, faz mixta, 4 anillados
juntos):

1. Abrir "Centro de copiado" en NUEVA ORDEN. Setear defaults (A4, Obra 80g, BN,
   simple, 1 copia). Arrastrar/simular 8 documentos → se detectan páginas.
2. "Aplicar a todos" propaga defaults; editar por fila lo que difiera (color,
   faz, papel, copias). El subtotal por fila y el total recalculan en vivo.
3. Seleccionar 4 documentos → "anillar juntos" → se forma un tomo (terminación
   una sola, cobra por espesor total del tomo, N juegos). Los otros 4 quedan
   sueltos.
4. Verificar el footer: documentos, tomos, carillas, hojas físicas, subtotal +
   IVA. Cuadra con el cálculo manual del §2.1.
5. "Agregar a la OT" → aparecen N renglones agrupados bajo "Centro de copiado" en
   la ficha, conviviendo con productos normales de la misma orden.
6. Emitir la OT → se materializan los pasos: impresión de cada segmento (batch en
   el simulador láser por papel/color/faz) + anillado del tomo en la anilladora.
   El Tablero y el ruteo los toman como cualquier paso.
7. Reportes/costos consolidados leen `trazabilidadJson.pasos` normal: el costeo
   fino (clicks color vs BN, desgaste, tóner, tiempo) está intacto.

## 6. Alcance

**v1 (esta rama):** modal de carga rápida; producto plantilla "Impresión de
documento"; adaptador páginas→hojas; tamaño por-cotización (D6); segmentos +
tomos compuestos (Tomo-A); endpoint de preview en vivo; agregar N ítems agrupados
a la OT; detección de páginas client-side. Terminación: Anillado.

**Futuro (no v1):** subida real de archivos a R2 (scope `ORDEN_ITEM`); presets de
combinaciones frecuentes; engrapado/plastificado/otras terminaciones; imposición
2-up/booklet (varias páginas por carilla); Tomo-B (motor multi-segmento nativo,
recotización estándar); caja/cobro inmediato de mostrador (TPV con turno).

## 7. Para el plan técnico

Puntos a resolver ahí, no acá:
- Cómo se provisiona el producto plantilla por tenant (seed vs setup asistido) y
  de dónde toma máquina/costo-por-click/papeles.
- Extensión D6: pasar el pliego de impresión por jobContext y que `factorA4` lo
  lea (hoy estático en `nestingConfig.pliegoImpresion`).
- Builder del `CotizacionItem` compuesto (snapshot sintético) y su persistencia
  junto a `OrdenTrabajoItem` en una transacción.
- Marca de agrupación en la ficha (¿`categoriaComercial`, un `grupoCargaId`, o
  sólo agrupación de UI?) y su impacto en presupuesto/OT/factura.
- Debounce/batch del preview y estados de error por fila.
