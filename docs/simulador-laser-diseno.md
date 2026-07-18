# Simulador de impresión láser — diseño

> 2026-07-17, rama `feat/simulador-laser`. Hermano del simulador por área
> (docs/simulador-impresion-diseno.md) para la digital POR HOJA. Boceto de
> referencia del usuario en claude.ai/design (laser.jsx del proyecto
> Grafoprint), adaptado a los datos reales del sistema.
> Journey: el operador de láser ve la cola consolidada, carga la bandeja
> UNA vez por batch (mismo papel/pliego/color/faz), manda todo junto al
> RIP y marca el batch impreso de una.

## 1. Decisiones

- **D1 — Alcance: familia `impresion_por_hoja` en FRONTERA** de órdenes
  vivas, bloqueados afuera. `impresion_por_pieza` NO entra (decisión
  usuario); `grabado_laser` es otra familia y otra vista.
- **D2 — La unidad operativa es el BATCH "enviable junto"**: papel (tipo +
  gramaje) + PLIEGO DE IMPRESIÓN + modo de color + caras. Una carga de
  bandeja, una cola de RIP, un "Marcar impresos (N)" (reusa
  completar-lote). Es el gemelo del "agrupar por materia prima" del
  simulador por área. OJO (corrección 2026-07-17): el pliego de impresión
  (config del paso: `nestingConfig.pliegoImpresion`, ej. A4 210×297) NO
  es el formato de COMPRA del papel (ej. SRA3): las hojas que pasan por
  la máquina son `outputsCanonicos.pliegos_impresos`, no la cantidad
  comprada del material.
- **D3 — Lane por MÁQUINA ASIGNADA** (corrección 2026-07-17: cada paso SÍ
  tiene máquina): `jobContext.maquinaSeleccionada_<configPasoId>` (la
  elegida al cotizar) ?? `maquinaM1Id` de la config del paso. Fallback
  sin máquina resuelta: el centro. Las claves por-paso del jobContext se
  indexan por configPasoId (no rutaPasoId).
- **D4 — Orden por ENTREGA** (decisión usuario): batches por su entrega
  más próxima, jobs por entrega dentro del batch. Sin reordenamiento
  manual de cola (el "subir/poner primero" del boceto queda descartado;
  si algún día hace falta, es un dato nuevo con doc propio).
- **D5 — Sin tóner** (decisión usuario): las barras C/M/Y/K del boceto no
  tienen fuente (no hay telemetría). El color es identificación VISUAL
  del batch/trabajo (chip Color/B&N desde `modoColor`), nada más.
- **D6 — Datos del snapshot/config, no recalculados**: hojas físicas =
  `pliegos_impresos` (pliegos de impresión que pasan por la máquina);
  clics = pliegos × caras; tiempo = `duracionEstimadaMin` materializado
  (ya trae el factor PPM A4-equivalente del centro); pliego de impresión
  = outputs canónicos `pliego_impresion_*_mm` con fallback a la config
  del paso; papel/gramaje = atributos de la variante; caras y modoColor
  = jobContext (por configPasoId).
- **D7 — "Imprimiendo" honesto**: paso `en_curso` muestra progreso
  transcurrido vs. estimado (sin inventar el % del RIP). Acabados
  posteriores del item como chips informativos (adónde va después).
- **D8 — En vivo**: polling 15 s (patrón tablero/simulador), pausado con
  lote en vuelo.

## 2. Contrato

`GET /produccion/simulador-laser`:

```ts
{
  jobs: Array<{
    pasoId, itemId, ordenId, codigo, cliente, producto: string;
    fechaEntrega: string | null;
    estado: "pendiente" | "en_curso";
    iniciadoEl: string | null;
    duracionEstimadaMin: number | null;
    centroCostoId: string | null;
    centroCostoNombre: string | null;
    papel: { nombre, gramaje, formato, anchoMm, altoMm } | null;
    hojas: number | null;        // hojas físicas a cargar en bandeja
    clics: number | null;        // impresiones (caras × pliegos)
    caras: 1 | 2 | null;
    modoColor: string | null;    // "CMYK", "CMYK+blanco", "BYN"…
    acabados: string[];          // pasos siguientes del item (cap 4)
  }>;
  centros: Array<{ id, nombre: string; maquinas: string[] }>;
}
```

Lote: `POST /ordenes-trabajo/tablero/pasos/completar-lote` (existente).

## 3. Casos borde

- Paso sin snapshot (OT manual) → job con papel null: batch "Sin papel
  identificado", sólo lote.
- modoColor ausente → "Sin definir" (batch propio: no se mezcla).
- Centro sin máquinas cargadas → lane sin lista de equipos, funciona
  igual.
- Job en_curso: el batch lo muestra imprimiendo; sigue completable en el
  lote (completar desde en_curso es transición válida).
- Cola vacía → estado explicativo (nada listo para imprimir por hoja).

## 4. Journey (verificación E2E)

1. Con la OT real de tarjetas (paso "Impresion por hoja CMYK"):
   desbloquear → aparece en la lane del centro "Impresion Digital Laser"
   con batch "Papel ilustración brillante 300g · SRA3 · Color · doble
   faz", 25 hojas, 50 clics, 7 min.
2. KPIs consolidados (trabajos, hojas, clics color/B&N). Sin "urgentes",
   "imprimiendo" ni cuello de botella: no aportan en este módulo
   (decisión usuario 2026-07-17).
3. "Marcar impresos (N)" completa el batch → tablero avanza → reabrir
   restaura.
4. Poll: completar desde el tablero saca el job del simulador solo.
